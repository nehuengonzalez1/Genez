/* ============================================================
   PRUEBA · reportes programados por mail (0136), sin dejar nada
   ============================================================

   Dos partes, y ninguna manda un mail:

   1. La tabla, en una transacción que termina en rollback (si se le pasa
      el archivo, aplica la migración adentro), sobre Bnitori: el dueño
      programa; un cajero no; nadie marca desde el navegador un envío que
      no salió; las direcciones se validan; otro comercio no ve nada.

   2. El período de cada frecuencia (fechas fijas) y el mail de Super 25
      armado con sus números reales, solo leyendo. El HTML queda en
      scripts/salida/reporte-por-mail.html para mirarlo. Necesita
      SUPABASE_SERVICE_ROLE_KEY en el .env; sin ella se saltea.

     node scripts/probar-reportes-por-mail.mjs
     node scripts/probar-reportes-por-mail.mjs supabase/migrations/0136_reportes_por_mail.sql

   Pone `idle_in_transaction_session_timeout`: una prueba cortada dejó una
   vez una sesión abierta en producción, con bloqueos.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { periodoDe, armarResumen, armarMail } from "../api/_reportes.js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const archivo = process.argv[2];
let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* ---------- 1. La tabla ---------- */
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
async function como(uid, sql, args = []) {
  await c.query("savepoint s");
  try {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
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
  const dueno = (await c.query("select id from perfiles where empresa_id = $1 and rol = 'dueno' and activo limit 1", [bn])).rows[0].id;
  const otro = (await c.query("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Almha' and p.activo limit 1")).rows[0].id;
  const cajero = randomUUID();
  await c.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now(), now(), now())`, [cajero, `cajero-${cajero.slice(0, 8)}@genez.test`]);
  await c.query("insert into perfiles (id, empresa_id, nombre, rol) values ($1, $2, 'Cajero de prueba', 'cajero')", [cajero, bn]);

  console.log("La tabla (Bnitori)");
  const alta = await como(dueno, "insert into reportes_programados (empresa_id, frecuencia, para) values ($1, 'semanal', array['dueno@genez.test','contador@genez.test']) returning id", [bn]);
  decir(!alta.e, `el dueño programa uno (${alta.e || "ok"})`);
  const id = alta.r && alta.r.rows[0].id;
  const veCajero = await como(cajero, "select count(*)::int n from reportes_programados where id = $1", [id]);
  decir(veCajero.r && veCajero.r.rows[0].n === 1, "el cajero lo ve");
  const altaCajero = await como(cajero, "insert into reportes_programados (empresa_id, frecuencia, para) values ($1, 'diario', array['x@genez.test'])", [bn]);
  decir(!!altaCajero.e, "el cajero no programa");
  const borraCajero = await como(cajero, "delete from reportes_programados where id = $1", [id]);
  decir(!borraCajero.e && borraCajero.r.rowCount === 0, "el cajero no lo borra");
  const marcar = await como(dueno, "update reportes_programados set ultimo_periodo = '2026-10-05' where id = $1", [id]);
  decir(!!marcar.e, `ni el dueño marca desde el navegador un envío que no salió (${(marcar.e || "").slice(0, 40)})`);
  const altaMarcada = await como(dueno, "insert into reportes_programados (empresa_id, frecuencia, para, ultimo_periodo) values ($1, 'diario', array['x@genez.test'], '2026-10-05')", [bn]);
  decir(!!altaMarcada.e, "ni lo crea ya marcado");
  const pausar = await como(dueno, "update reportes_programados set activo = false, frecuencia = 'mensual' where id = $1", [id]);
  decir(!pausar.e && pausar.r.rowCount === 1, "el dueño lo pausa y le cambia la frecuencia");
  const malMail = await como(dueno, "insert into reportes_programados (empresa_id, frecuencia, para) values ($1, 'diario', array['no es un mail'])", [bn]);
  decir(!!malMail.e, "una dirección que no es un mail no pasa");
  const seis = await como(dueno, "insert into reportes_programados (empresa_id, frecuencia, para) values ($1, 'diario', array['a@x.co','b@x.co','c@x.co','d@x.co','e@x.co','f@x.co'])", [bn]);
  decir(!!seis.e, "seis direcciones no pasan");
  const malaFrec = await como(dueno, "insert into reportes_programados (empresa_id, frecuencia, para) values ($1, 'cada hora', array['a@x.co'])", [bn]);
  decir(!!malaFrec.e, "una frecuencia inventada no pasa");
  const ajeno = await como(otro, "select count(*)::int n from reportes_programados where empresa_id = $1", [bn]);
  decir(ajeno.r && ajeno.r.rows[0].n === 0, "otro comercio no ve nada");
  const anon = await c.query("select has_table_privilege('anon', 'reportes_programados', 'select') p");
  decir(!anon.rows[0].p, "anon no lee la tabla");
} catch (e) {
  fallas++;
  console.log(`\nMAL  se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

/* ---------- 2. Los períodos y el mail ---------- */
console.log("\nLos períodos");
const d = periodoDe("diario", "2026-10-06");
decir(d.desde === "2026-10-05" && d.hasta === "2026-10-05" && d.antes.desde === "2026-09-28" && d.clave === "2026-10-05", `diario el martes 06/10: ${d.nombre}, contra ${d.antes.desde}`);
const s = periodoDe("semanal", "2026-10-06");
decir(s.desde === "2026-09-28" && s.hasta === "2026-10-04" && s.antes.desde === "2026-09-21", `semanal el martes 06/10: ${s.nombre}`);
const s2 = periodoDe("semanal", "2026-10-05");
decir(s2.desde === "2026-09-28", "semanal el lunes 05/10: la misma semana (no se repite el martes)");
const sDom = periodoDe("semanal", "2026-10-11");
decir(sDom.desde === "2026-09-28", "semanal el domingo 11/10: todavía la semana anterior, la de esta no cerró");
const m = periodoDe("mensual", "2026-10-01");
decir(m.desde === "2026-09-01" && m.hasta === "2026-09-30" && m.antes.desde === "2026-08-01" && m.antes.hasta === "2026-08-31" && m.clave === "2026-09", `mensual el 01/10: ${m.nombre}`);
const mEne = periodoDe("mensual", "2027-01-15");
decir(mEne.desde === "2026-12-01" && mEne.hasta === "2026-12-31" && mEne.antes.desde === "2026-11-01", "mensual en enero: diciembre del año anterior");

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("\n(Sin SUPABASE_SERVICE_ROLE_KEY en el .env: no armo el mail de Super 25.)");
} else {
  console.log("\nEl mail de Super 25 (solo lectura, no se manda)");
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: e } = await admin.from("empresas").select("id, nombre").eq("nombre", "Super 25").maybeSingle();
  const p = periodoDe("semanal");
  const r = await armarResumen(admin, e.id, p, { nombre: "Por rubro", definicion: { dims: ["categoria"] } });
  decir(r.ahora.ventas > 0 && r.top.length > 0, `semana ${p.desde} a ${p.hasta}: ${Math.round(r.ahora.ventas)} en ${r.ahora.tickets} tickets, ${r.top.length} productos arriba, ${r.sinStock.length} sin stock, cuadro con ${r.cuadro ? r.cuadro.filas.length : 0} filas`);
  const { data: serie } = await admin.rpc("ventas_diarias_rango", { p_empresa: e.id, p_desde: p.desde, p_hasta: p.hasta });
  const ref = Math.round(serie.reduce((t, x) => t + Number(x.ventas), 0));
  decir(Math.round(r.ahora.ventas) === ref, `las ventas del mail son las de Informes (${ref})`);
  const mail = armarMail({ comercio: e.nombre, p, r });
  console.log(`     asunto: ${mail.asunto}`);
  mkdirSync("scripts/salida", { recursive: true });
  writeFileSync("scripts/salida/reporte-por-mail.html", mail.html);
  console.log("     HTML en scripts/salida/reporte-por-mail.html");
}
console.log(fallas ? `\n${fallas} cosas no dieron. Nada quedó escrito ni se mandó.` : "\nTodo dio. Nada quedó escrito ni se mandó.");
process.exit(fallas ? 1 : 0);
