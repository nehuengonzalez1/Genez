/* ============================================================
   PRUEBA · promos en la comanda y happy hour (0105), en la base
   ============================================================

   Lo que la base tiene que garantizar para que la promo de una mesa
   funcione: el horario bien cargado, la hora de cada renglón (los de
   antes, sin hora; los nuevos, con la del momento) y que la cuenta de la
   mesa sume el total ya descontado.

   En una transacción que se deshace, sobre una mesa libre del bar. Si
   0105 no está aplicada, la aplica adentro.

     node scripts/probar-happy-hour.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
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
const falla = async (sql, p) => {
  await c.query("savepoint s");
  try { await c.query(sql, p); await c.query("release savepoint s"); return null; }
  catch (e) { await c.query("rollback to savepoint s"); return e; }
};

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  const aplicada = await una("select count(*)::int n from information_schema.columns where table_name = 'operacion_lineas' and column_name = 'pedida_en'");
  const viejos = aplicada.n ? null : await una("select count(*)::int n from operacion_lineas");
  if (!aplicada.n) await c.query(readFileSync("supabase/migrations/0105_happy_hour.sql", "utf8"));
  const bar = (await una("select id from empresas where nombre = 'Bar Rivadavia'")).id;

  console.log("\nLos renglones de antes");
  if (viejos) {
    const sinHora = await una("select count(*)::int n from operacion_lineas where pedida_en is null");
    decir(sinHora.n === viejos.n, `los ${viejos.n} de antes quedaron sin hora (no con la de la migración)`);
  } else {
    console.log("  --   0105 ya estaba aplicada: no se puede mirar cómo quedaron los de antes");
  }

  console.log("\nEl horario");
  const promo = (extra) => `insert into promociones (empresa_id, nombre, tipo, parametros, alcance${extra ? ", hora_desde, hora_hasta" : ""}) values ('${bar}', 'hh', 'nxm', '{"lleva":2,"paga":1}', '{"rubros":["Cervezas"]}'${extra ? ", " + extra : ""})`;
  decir(!(await falla(promo("'18:00', '20:00'"))), "de 18 a 20");
  decir(!(await falla(promo("'22:00', '02:00'"))), "de 22 a 2 (cruza la medianoche)");
  decir(!(await falla(promo(null))), "sin horario: todo el día");
  let e = await falla(`insert into promociones (empresa_id, nombre, tipo, parametros, alcance, hora_desde) values ('${bar}', 'hh', 'nxm', '{"lleva":2,"paga":1}', '{}', '18:00')`);
  decir(e && /promociones_horario/.test(e.message), "desde sin hasta: no");
  e = await falla(promo("'18:00', '18:00'"));
  decir(e && /promociones_horario/.test(e.message), "de 18 a 18: no");

  console.log("\nLa comanda");
  const mesa = await una("select id from recursos r where empresa_id = $1 and tipo = 'mesa' and activo and unida_a is null and not exists (select 1 from operaciones o where o.recurso_id = r.id and o.estado = 'abierta') limit 1", [bar]);
  const comanda = (await una("select abrir_comanda($1) as id", [JSON.stringify({ empresa_id: bar, recurso_id: mesa.id })])).id;
  const item = await una("select id, nombre, precio from items where empresa_id = $1 and activo and precio > 0 limit 1", [bar]);
  const linea = await una(
    "insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, total) values ($1, $2, $3, $4, 2, $5, $6) returning id, pedida_en",
    [comanda, bar, item.id, item.nombre, item.precio, Math.round(Number(item.precio) * 2)]
  );
  decir(linea.pedida_en && Math.abs(new Date(linea.pedida_en) - Date.now()) < 5 * 60 * 1000, "un renglón nuevo toma la hora del momento");
  /* Lo que hace la pantalla con un 2x1: descuento en el renglón y el
     total descontado. */
  await c.query("update operacion_lineas set descuento = $2, total = total - $2, campos_extra = campos_extra || '{\"promo\":\"2x1\"}' where id = $1", [linea.id, Number(item.precio)]);
  const cuenta = await una("select subtotal, total, saldo from cuenta_vista where id = $1", [comanda]);
  decir(Number(cuenta.subtotal) === Math.round(Number(item.precio)), `la cuenta de la mesa suma el total ya descontado: $${cuenta.subtotal}`);
  const salon = await una("select consumido from salon_vista where id = $1", [mesa.id]);
  decir(Number(salon.consumido) === Math.round(Number(item.precio)), "y el salón también");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
