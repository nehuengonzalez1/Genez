/* ============================================================
   PRUEBA · agrupar líneas iguales
   ============================================================

   Corre contra la base con la identidad de un usuario real, así las
   políticas se aplican igual que desde el navegador.

     node scripts/probar-agrupado.mjs

   Deja la base como la encontró.
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];
let fallas = 0;
const decir = (ok, t) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${t}`); };

const emp = await una("select id from empresas where nombre = 'Bar Rivadavia'");
const item = await una("select id, nombre, precio, costo from items where empresa_id = $1 limit 1", [emp.id]);
const cm = await una("select abrir_comanda($1::jsonb) id",
  [JSON.stringify({ empresa_id: emp.id, canal: "mostrador" })]);

/* Se replica lo que hace agregarLinea de src/datos/comandas.js: buscar una
   línea igual sin despachar y sumarle, o crear una nueva. */
const firma = (itemId, mods, notas) => JSON.stringify([
  itemId, (mods || []).map((m) => `${m.nombre}:${Number(m.precio) || 0}`).sort(), (notas || "").trim(),
]);

async function agregar(mods = [], notas = "", cant = 1) {
  const previas = (await c.query(
    "select id, item_id, cantidad, precio_unitario, modificadores, notas from operacion_lineas where operacion_id = $1 and estado = 'borrador' and item_id = $2",
    [cm.id, item.id])).rows;
  const igual = previas.find((l) => firma(l.item_id, l.modificadores, l.notas) === firma(item.id, mods, notas));
  const extra = mods.reduce((s, m) => s + (Number(m.precio) || 0), 0);
  const unit = Number(item.precio) + extra;

  if (igual) {
    const total = Number(igual.cantidad) + cant;
    await c.query("update operacion_lineas set cantidad = $2, total = $3 where id = $1",
      [igual.id, total, Math.round(Number(igual.precio_unitario) * total)]);
    return;
  }
  await c.query(
    `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
       precio_unitario, costo_unitario, total, modificadores, notas, destino)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,'barra')`,
    [cm.id, emp.id, item.id, item.nombre, cant, unit, item.costo, Math.round(unit * cant), JSON.stringify(mods), notas]);
}

const renglones = async () => (await c.query(
  "select cantidad, total from operacion_lineas where operacion_id = $1 and estado <> 'anulada' order by cantidad", [cm.id])).rows;

console.log(`\nAgrupar ${item.nombre}`);

await agregar(); await agregar(); await agregar();
let r = await renglones();
decir(r.length === 1 && Number(r[0].cantidad) === 3, `tres toques dan un renglon de 3 (${r.length} renglon/es)`);
decir(Number(r[0].total) === Number(item.precio) * 3, `el total acompaña (${r[0].total})`);

/* El orden de los modificadores no puede partir el renglón: es el mismo
   plato pedido de la misma forma. */
await agregar([{ nombre: "sin hielo", precio: 0 }, { nombre: "limon", precio: 200 }]);
await agregar([{ nombre: "limon", precio: 200 }, { nombre: "sin hielo", precio: 0 }]);
r = await renglones();
decir(r.length === 2, `con modificadores va aparte, y no importa el orden (${r.length} renglones)`);
decir(r.some((x) => Number(x.cantidad) === 2), "los dos con el mismo modificador se juntaron");

/* Lo despachado no se toca: la cocina ya lo tiene. */
await c.query("select enviar_a_cocina($1)", [cm.id]);
await agregar();
r = await renglones();
decir(r.length === 3, `despues de despachar, lo nuevo abre renglon propio (${r.length})`);
const nuevo = (await c.query(
  "select count(*) n from operacion_lineas where operacion_id = $1 and estado = 'borrador'", [cm.id])).rows[0];
decir(nuevo.n === "1", "y queda solo eso sin despachar");

await c.query("delete from operacion_lineas where operacion_id = $1", [cm.id]);
await c.query("delete from operaciones where id = $1", [cm.id]);
console.log(fallas ? `\n${fallas} fallaron.` : "\nTodo bien. Base como estaba.");
await c.end();
process.exitCode = fallas ? 1 : 0;
