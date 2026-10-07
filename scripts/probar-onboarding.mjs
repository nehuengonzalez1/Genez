/* ============================================================
   PRUEBA · onboarding (0137), sin dejar nada
   ============================================================

   Una transacción que termina en rollback, sobre Bnitori (semilla de
   QA). Si se le pasa el archivo, aplica la migración adentro.

     node scripts/probar-onboarding.mjs
     node scripts/probar-onboarding.mjs supabase/migrations/0137_onboarding.sql

   Lo que mira:
   - Cada uno marca lo suyo (bienvenida, pasos ocultos, pasos hechos) y
     se lee de vuelta.
   - Una clave que no está en la lista no pasa: no sirve para escribir
     otra cosa en el perfil, ni el rol ni los permisos.
   - Marcar no toca la fila de otro ni ninguna otra columna.
   - Sin sesión no se puede; anon no la llama.

   Pone `idle_in_transaction_session_timeout`: una prueba cortada dejó una
   vez una sesión abierta en producción, con bloqueos.
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const archivo = process.argv[2];
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

async function como(uid, sql, args = []) {
  await c.query("savepoint s");
  try {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated" } : { role: "authenticated" })]);
    const r = await c.query(sql, args);
    await c.query("reset role"); await c.query("release savepoint s");
    return { r };
  } catch (e) { await c.query("rollback to savepoint s"); await c.query("reset role"); return { e: e.message }; }
}

try {
  await c.query("set idle_in_transaction_session_timeout = '60s'");
  await c.query("begin");
  await c.query("set local lock_timeout = '5s'");
  if (archivo) { console.log(`Aplicando ${archivo} adentro de la transacción…`); await c.query(readFileSync(archivo, "utf8")); }

  const bn = (await c.query("select id from empresas where nombre = 'Bnitori'")).rows[0].id;
  const yo = (await c.query("select id, rol, permisos from perfiles where empresa_id = $1 and rol = 'dueno' and activo limit 1", [bn])).rows[0];
  const otro = (await c.query("select id, onboarding from perfiles where id <> $1 and activo limit 1", [yo.id])).rows[0];

  const b = await como(yo.id, "select marcar_onboarding('bienvenida', to_jsonb(now()::text)) v");
  decir(!b.e && b.r.rows[0].v.bienvenida, `marca la bienvenida (${b.e || "ok"})`);
  const h = await como(yo.id, `select marcar_onboarding('pasos_hechos', '["ticket","stock"]'::jsonb) v`);
  decir(!h.e && JSON.stringify(h.r.rows[0].v.pasos_hechos) === '["ticket","stock"]', "marca pasos a mano");
  const o = await como(yo.id, "select marcar_onboarding('pasos_ocultos') v");
  decir(!o.e && o.r.rows[0].v.pasos_ocultos === true && o.r.rows[0].v.bienvenida, "oculta los pasos sin perder lo anterior");
  const leido = await como(yo.id, "select onboarding from perfiles where id = $1", [yo.id]);
  decir(leido.r && leido.r.rows[0].onboarding.pasos_ocultos === true, "lo lee de vuelta desde su perfil");

  const rol = await como(yo.id, `select marcar_onboarding('rol', '"plataforma"'::jsonb)`);
  decir(/No conozco/.test(rol.e || ""), "una clave fuera de la lista no pasa");
  const despues = (await c.query("select rol, permisos from perfiles where id = $1", [yo.id])).rows[0];
  decir(despues.rol === yo.rol && JSON.stringify(despues.permisos) === JSON.stringify(yo.permisos), "el rol y los permisos quedan como estaban");
  const delOtro = (await c.query("select onboarding from perfiles where id = $1", [otro.id])).rows[0];
  decir(JSON.stringify(delOtro.onboarding) === JSON.stringify(otro.onboarding), "la fila de otro no cambia");

  const sinSesion = await como(null, "select marcar_onboarding('bienvenida')");
  decir(/Falta la sesión/.test(sinSesion.e || ""), "sin sesión no se puede");
  const anon = await c.query("select has_function_privilege('anon', 'marcar_onboarding(text, jsonb)', 'execute') p");
  decir(!anon.rows[0].p, "anon no la puede llamar");
} catch (e) {
  fallas++;
  console.log(`\nMAL  se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
console.log(fallas ? `\n${fallas} cosas no dieron. Nada quedó escrito.` : "\nTodo dio. Nada quedó escrito.");
process.exit(fallas ? 1 : 0);
