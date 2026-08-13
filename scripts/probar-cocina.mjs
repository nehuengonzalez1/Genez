/* ============================================================
   PRUEBA · la cocina ve pedidos, no líneas sueltas
   ============================================================

   Lo que se verifica es que dos comandas distintas no se mezclen y que
   cada una diga por dónde salió, porque de eso depende cómo se arma.

     node scripts/probar-cocina.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
const una = async (s, a = []) => (await c.query(s, a)).rows[0];
let fallas = 0;
const decir = (ok, t) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${t}`); };

const emp = await una("select id from empresas where nombre = 'Bar Rivadavia'");
const mesa = await una("select id, nombre from recursos where empresa_id = $1 and tipo = 'mesa' order by orden limit 1", [emp.id]);
const platos = (await c.query("select id, nombre, precio, costo from items where empresa_id = $1 and controla_stock = false limit 2", [emp.id])).rows;

const hechas = [];
async function comanda(datos, cuantas) {
  const o = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify({ empresa_id: emp.id, ...datos })]);
  hechas.push(o.id);
  for (let i = 0; i < cuantas; i++) {
    const p = platos[i % platos.length];
    await c.query(
      `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
         precio_unitario, costo_unitario, total, destino)
       values ($1,$2,$3,$4,1,$5,$6,$5,'cocina')`,
      [o.id, emp.id, p.id, p.nombre, p.precio, p.costo]);
  }
  await c.query("select enviar_a_cocina($1)", [o.id]);
  return o.id;
}

console.log("\nCocina agrupada por comanda");

const enMesa = await comanda({ recurso_id: mesa.id }, 2);
const paraLlevar = await comanda({ canal: "takeaway" }, 1);
const deApp = await comanda({ canal: "app", referencia: "5893" }, 3);

const filas = (await c.query(`
  select o.id, o.canal, o.referencia, r.nombre as mesa, count(l.*) as lineas
  from operaciones o
  left join recursos r on r.id = o.recurso_id
  join operacion_lineas l on l.operacion_id = o.id
  where o.empresa_id = $1 and o.estado = 'abierta' and l.estado in ('pedido','preparando','listo')
  group by o.id, o.canal, o.referencia, r.nombre
  order by o.abierta_en`, [emp.id])).rows;

decir(filas.length === 3, `tres comandas distintas, no seis lineas sueltas (${filas.length})`);

const dMesa = filas.find((f) => f.id === enMesa);
const dApp = filas.find((f) => f.id === deApp);
const dLlevar = filas.find((f) => f.id === paraLlevar);

decir(dMesa && Number(dMesa.lineas) === 2, `la de ${mesa.nombre} lleva sus dos platos juntos`);
decir(dMesa && dMesa.canal === "salon" && dMesa.mesa === mesa.nombre, "y dice que es de salon, o sea al plato");
decir(dLlevar && dLlevar.canal === "takeaway", "la de para llevar se distingue: va en packaging");
decir(dApp && dApp.canal === "app" && dApp.referencia === "5893", "la de aplicacion trae su numero para la bolsa correcta");
decir(dApp && Number(dApp.lineas) === 3, "y sus tres platos no se mezclaron con los de la mesa");

/* Mover el pedido entero, que es como trabaja el que cocina. */
await c.query("update operacion_lineas set estado = 'preparando' where operacion_id = $1 and estado = 'pedido'", [enMesa]);
const n = await una("select count(*) n from operacion_lineas where operacion_id = $1 and estado = 'preparando'", [enMesa]);
decir(n.n === "2", "empezar la comanda mueve sus dos platos de una");

for (const id of hechas) {
  await c.query("delete from operacion_lineas where operacion_id = $1", [id]);
  await c.query("delete from operaciones where id = $1", [id]);
}
console.log(fallas ? `\n${fallas} fallaron.` : "\nTodo bien. Base como estaba.");
await c.end();
process.exitCode = fallas ? 1 : 0;
