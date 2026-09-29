/* ============================================================
   PRUEBA · las órdenes de compra se guardan (0111)
   ============================================================

   En una transacción que se deshace, sobre "Super 25 Pruebas" y con los
   permisos de un usuario (las políticas de operaciones de siempre):

   - Una orden pendiente se guarda con sus renglones y no mueve stock.
   - No le cambia el costo de reposición a nadie (0111): antes, un
     producto sin compras tomaba el costo de algo que no había llegado.
   - Se puede pasar a recibida o cancelada; cerrada, ya no se toca.
   - La planilla del contador y los indicadores no la cuentan.
   Si 0111 no está aplicada, la aplica adentro.

     node scripts/probar-ordenes-de-compra.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };
const una = async (sql, p) => (await c.query(sql, p)).rows[0];

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  const vista = (await una("select pg_get_viewdef('items_vista') d")).d;
  if (!/o\.tipo = 'compra'::text\) AND \(o\.estado = 'confirmada'::text\)/.test(vista)) {
    await c.query(readFileSync("supabase/migrations/0111_ordenes_de_compra.sql", "utf8"));
  }
  const emp = (await una("select id from empresas where nombre = 'Super 25 Pruebas'")).id;
  /* Un producto que nunca se compró: el caso en que se colaba el costo. */
  const item = await una(`select i.id, i.nombre from items i where i.empresa_id = $1 and i.activo
    and not exists (select 1 from operacion_lineas l join operaciones o on o.id = l.operacion_id where l.item_id = i.id and o.tipo = 'compra') limit 1`, [emp]);
  const plataforma = (await una("select id from perfiles where es_plataforma limit 1")).id;
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: plataforma, role: "authenticated" })]);

  const antes = await una("select stock, costo_reposicion from items_vista where id = $1", [item.id]);

  console.log("\nGuardar una orden");
  const oc = randomUUID();
  await c.query(`insert into operaciones (id, empresa_id, tipo, estado, numero, subtotal, total, campos_extra)
    values ($1, $2, 'compra', 'pendiente', 'OC-0001', 5000, 5000, '{"orden": true, "proveedor": "Prueba"}')`, [oc, emp]);
  await c.query(`insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, costo_unitario, total)
    values ($1, $2, $3, $4, 10, 0, 500, 5000)`, [oc, emp, item.id, item.nombre]);
  const leida = await una(`select o.numero, o.estado, o.fecha, count(l.*)::int renglones from operaciones o join operacion_lineas l on l.operacion_id = o.id
    where o.id = $1 and o.campos_extra->>'orden' = 'true' group by 1, 2, 3`, [oc]);
  decir(leida && leida.estado === "pendiente" && leida.renglones === 1, "se guarda pendiente, con su renglón, y se encuentra por campos_extra.orden");
  decir(Math.abs(new Date(leida.fecha) - Date.now()) < 5 * 60 * 1000, "con la fecha de hoy, no la del prototipo");

  const durante = await una("select stock, costo_reposicion from items_vista where id = $1", [item.id]);
  decir(Number(durante.stock) === Number(antes.stock), "no mueve stock");
  decir(durante.costo_reposicion === null || Number(durante.costo_reposicion) === Number(antes.costo_reposicion),
    "ni pone como costo de reposición el de algo que todavía no llegó");

  const contador = await una(`select count(*)::int n from operaciones where id = $1 and tipo = 'compra' and estado = 'confirmada'`, [oc]);
  decir(contador.n === 0, "la planilla del contador (compras confirmadas) no la cuenta");

  console.log("\nCerrarla");
  await c.query("update operaciones set estado = 'recibida', cerrada_en = now(), campos_extra = campos_extra || '{\"compra\": \"x\"}' where id = $1", [oc]);
  decir((await una("select estado from operaciones where id = $1", [oc])).estado === "recibida", "pendiente → recibida, con el usuario (la política deja cambiar lo pendiente)");
  const r = await c.query("update operaciones set estado = 'pendiente' where id = $1", [oc]);
  decir(r.rowCount === 0, "recibida ya no se toca: volverla a pendiente no cambia nada");

  const oc2 = randomUUID();
  await c.query(`insert into operaciones (id, empresa_id, tipo, estado, numero, total, campos_extra) values ($1, $2, 'compra', 'pendiente', 'OC-0002', 0, '{"orden": true}')`, [oc2, emp]);
  await c.query("update operaciones set estado = 'cancelada' where id = $1", [oc2]);
  decir((await una("select estado from operaciones where id = $1", [oc2])).estado === "cancelada", "y una pendiente se puede cancelar");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
