/* ============================================================
   PRUEBA · la tabla de promociones (0102), en la base
   ============================================================

   Que la base acepte las cuatro clases bien cargadas y rechace las que
   tienen números imposibles (una promo mal cargada se cobraría mal en
   todas las cajas), y que un usuario de un comercio no pueda cargar
   promos en otro.

   En una transacción que se deshace. Si 0102 no está aplicada, la aplica
   adentro de la misma transacción, así que también se deshace.

     node scripts/probar-promociones-base.mjs
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
const promo = (emp, tipo, parametros, extra = "") =>
  `insert into promociones (empresa_id, nombre, tipo, parametros, alcance${extra ? ", " + extra.split("=")[0] : ""}) values ('${emp}', 'prueba', '${tipo}', '${JSON.stringify(parametros)}', '{"rubros":["Bebidas"]}'${extra ? ", " + extra.split("=")[1] : ""})`;

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  if (!(await una("select to_regclass('promociones') is not null as si")).si) {
    await c.query(readFileSync("supabase/migrations/0102_promociones.sql", "utf8"));
  }
  const super25 = (await una("select id from empresas where nombre = 'Super 25'")).id;
  const bar = (await una("select id from empresas where nombre = 'Bar Rivadavia'")).id;

  console.log("\nLas cuatro clases bien cargadas");
  for (const [tipo, par] of [["nxm", { lleva: 2, paga: 1 }], ["segunda", { pct: 50 }], ["porcentaje", { pct: 20 }], ["pack", { cantidad: 3, precio: 1000 }]]) {
    decir(!(await falla(promo(super25, tipo, par))), `${tipo} ${JSON.stringify(par)}`);
  }

  console.log("\nLas que no");
  for (const [tipo, par, que] of [
    ["nxm", { lleva: 2, paga: 2 }, "2x2 (no regala nada)"],
    ["nxm", { lleva: 1, paga: 0 }, "1x0"],
    ["segunda", { pct: 0 }, "segunda al 0%"],
    ["porcentaje", { pct: 100 }, "100% (gratis)"],
    ["pack", { cantidad: 1, precio: 500 }, "pack de 1"],
    ["regalo", {}, "una clase que no existe"],
  ]) {
    const e = await falla(promo(super25, tipo, par));
    decir(!!e, `${que}: rechazada`);
  }
  let e = await falla(promo(super25, "porcentaje", { pct: 10 }, "dias='{7}'"));
  decir(!!e, "el día 7 no existe");
  e = await falla(`insert into promociones (empresa_id, nombre, tipo, parametros, desde, hasta) values ($1, 'prueba', 'porcentaje', '{"pct":10}', '2026-10-10', '2026-10-01')`, [super25]);
  decir(e && /promociones_fechas/.test(e.message), "hasta antes que desde: rechazada por la regla de fechas");

  console.log("\nQuién puede");
  const axel = await una("select p.id from perfiles p join auth.users u on u.id = p.id where u.email = 'axel@super25.com'");
  if (!axel) {
    console.log("  --   no está el usuario de Super 25: se saltea");
  } else {
    await c.query("savepoint rls");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: axel.id, role: "authenticated" })]);
    e = await falla(promo(super25, "nxm", { lleva: 2, paga: 1 }));
    decir(!e, "el dueño de Super 25 carga una en Super 25");
    e = await falla(promo(bar, "nxm", { lleva: 2, paga: 1 }));
    decir(!!e, "pero no en el bar");
    const vistas = await una("select count(*)::int n from promociones where empresa_id = $1", [bar]);
    decir(vistas.n === 0, "ni ve las del bar");
    await c.query("rollback to savepoint rls");
  }
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
