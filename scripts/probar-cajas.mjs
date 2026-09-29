/* ============================================================
   PRUEBA · varias cajas abiertas a la vez (0101)
   ============================================================

   Que cada comercio tenga su "Caja 1" con las sesiones de siempre, que
   dos cajas distintas se puedan abrir a la vez, que la misma no, y que
   la aplicación de antes (que abre sin decir qué caja) siga andando.

   Todo adentro de una transacción que se deshace, sobre Bnitori (el
   comercio de QA). Si 0101 todavía no está aplicada, la aplica adentro
   de la misma transacción, así que también se deshace.

     node scripts/probar-cajas.mjs
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
  const yaEsta = await una("select to_regclass('cajas') is not null as si");
  if (!yaEsta.si) await c.query(readFileSync("supabase/migrations/0101_varias_cajas.sql", "utf8"));

  console.log("\nLo que ya había");
  const sinCaja = await una("select count(*)::int n from empresas e where not exists (select 1 from cajas c where c.empresa_id = e.id)");
  decir(sinCaja.n === 0, "cada comercio tiene al menos una caja");
  const sesiones = await una("select count(*)::int total, count(caja_id)::int con_caja from sesiones_caja");
  decir(sesiones.total === sesiones.con_caja, `todas las sesiones tienen su caja (${sesiones.con_caja} de ${sesiones.total})`);
  const ajenas = await una("select count(*)::int n from sesiones_caja s join cajas c on c.id = s.caja_id where c.empresa_id <> s.empresa_id");
  decir(ajenas.n === 0, "ninguna sesión quedó en la caja de otro comercio");

  const emp = (await una("select id from empresas where nombre = 'Bnitori'")).id;
  /* Bnitori no tiene la caja abierta; si la tuviera, la prueba la cierra
     adentro de la transacción. */
  await c.query("update sesiones_caja set cerrada_en = now() where empresa_id = $1 and cerrada_en is null", [emp]);
  const caja1 = (await una("select id from cajas where empresa_id = $1 order by orden, creada_en limit 1", [emp])).id;
  const caja2 = (await una("insert into cajas (empresa_id, nombre) values ($1, 'Caja de prueba') returning id", [emp])).id;

  console.log("\nAbrir");
  const s1 = await una("insert into sesiones_caja (empresa_id, caja_id) values ($1, $2) returning id, caja_id", [emp, caja1]);
  const s2 = await una("insert into sesiones_caja (empresa_id, caja_id) values ($1, $2) returning id, caja_id", [emp, caja2]);
  decir(s1 && s2 && s1.caja_id !== s2.caja_id, "dos cajas distintas abiertas a la vez");
  let e = await falla("insert into sesiones_caja (empresa_id, caja_id) values ($1, $2)", [emp, caja1]);
  decir(e && /sesiones_caja_una_abierta_por_caja/.test(e.message), "la misma caja dos veces, no");
  await c.query("update sesiones_caja set cerrada_en = now() where id = $1", [s1.id]);
  e = await falla("insert into sesiones_caja (empresa_id, caja_id) values ($1, $2)", [emp, caja1]);
  decir(!e, "cerrada, se vuelve a abrir");
  await c.query("update sesiones_caja set cerrada_en = now() where empresa_id = $1 and caja_id = $2 and cerrada_en is null", [emp, caja1]);

  console.log("\nLa aplicación de antes");
  const vieja = await una("insert into sesiones_caja (empresa_id) values ($1) returning caja_id", [emp]);
  decir(vieja.caja_id === caja1, "abrir sin decir qué caja va a la primera del comercio");

  console.log("\nLo que no se deja");
  const otra = (await una("select c.id from cajas c join empresas e on e.id = c.empresa_id where e.nombre = 'Almha' limit 1")).id;
  e = await falla("insert into sesiones_caja (empresa_id, caja_id) values ($1, $2)", [emp, otra]);
  decir(e && /no es de este comercio/.test(e.message), "abrir con la caja de otro comercio, no");
  e = await falla("insert into cajas (empresa_id, nombre) values ($1, 'Caja de prueba')", [emp]);
  decir(e && e.code === "23505", "dos cajas con el mismo nombre en un comercio, no");

  console.log("\nUn comercio nuevo");
  const nuevo = (await una("insert into empresas (nombre) values ('Prueba cajas (se deshace)') returning id")).id;
  const suyas = await una("select count(*)::int n, min(nombre) nombre from cajas where empresa_id = $1", [nuevo]);
  decir(suyas.n === 1 && suyas.nombre === "Caja 1", "arranca con su Caja 1");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
