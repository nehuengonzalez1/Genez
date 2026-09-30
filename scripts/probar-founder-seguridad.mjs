/* ============================================================
   PRUEBA · la frontera de GENEZ FOUNDER (0113 en adelante)
   ============================================================

   Lo que protege los datos internos es la base, no la pantalla. Esta
   prueba ataca la API directo —sin pasar por ninguna pantalla— con seis
   perfiles, en una transacción que se deshace:

     A  el fundador (miembro, con todas las áreas)
     B  la plataforma sin membresía activa (la misma persona, desactivada)
     C  el dueño de un comercio (Super 25)
     D  el dueño de otro comercio (el bar)
     E  anon, sin sesión
     F  un miembro interno con una sola área (crm) que además es de un
        comercio: tiene que ver lo interno de su área y nada más, y no
        ganar acceso a otros comercios por ser interno

   Recorre todas las tablas interno_* que existan (las de fases
   siguientes se suman solas) y las funciones. Si 0113 no está aplicada,
   la aplica adentro.

     node scripts/probar-founder-seguridad.mjs
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
const intentar = async (sql, p) => {
  await c.query("savepoint s");
  try { const r = await c.query(sql, p); await c.query("release savepoint s"); return { r }; }
  catch (e) { await c.query("rollback to savepoint s"); return { e }; }
};
const como = async (usuario) => {
  await c.query("reset role");
  if (!usuario) { await c.query("set local role anon"); await c.query("select set_config('request.jwt.claims', '', true)"); return; }
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: usuario, role: "authenticated" })]);
};
const admin = () => c.query("reset role");

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  /* Si la prueba se corta a mitad de camino, el pooler puede dejar la sesión
     abierta y con sus bloqueos: la base la cierra sola (y la deshace). */
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  /* Las migraciones de Founder que falten se aplican adentro, en orden:
     así la frontera se prueba también sobre lo que todavía no se aplicó. */
  for (const [tabla, migracion] of [["interno_miembros", "0113_interno_base.sql"], ["interno_prospectos", "0114_interno_crm.sql"], ["interno_clientes", "0115_interno_clientes.sql"], ["interno_roadmap", "0116_interno_producto.sql"], ["interno_objetivos", "0117_interno_marketing.sql"], ["interno_movimientos", "0118_interno_finanzas.sql"], ["interno_hallazgos", "0119_interno_prospector.sql"]]) {
    if (!(await una(`select to_regclass('public.${tabla}') t`)).t) await c.query(readFileSync(`supabase/migrations/${migracion}`, "utf8"));
  }
  /* Tablas y vistas: una vista mal hecha también es una puerta. */
  const tablas = (await c.query(`select tablename from pg_tables where schemaname = 'public' and tablename like 'interno\\_%'
    union select viewname from pg_views where schemaname = 'public' and viewname like 'interno\\_%' order by 1`)).rows.map((r) => r.tablename);
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' and p.activo limit 1")).id;
  const D = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' and p.activo limit 1")).id;
  const super25 = (await una("select id from empresas where nombre = 'Super 25'")).id;
  console.log(`\nTablas internas: ${tablas.join(", ")}`);

  console.log("\nTodas con RLS y nada para anon");
  const sinRls = (await c.query("select tablename from pg_tables where schemaname = 'public' and tablename like 'interno\\_%' and not rowsecurity")).rows;
  decir(sinRls.length === 0, "todas las tablas interno_* tienen RLS");
  const anonPriv = (await c.query(`select table_name, privilege_type from information_schema.role_table_grants
    where grantee = 'anon' and table_name like 'interno\\_%'`)).rows;
  decir(anonPriv.length === 0, `anon no tiene ningún permiso sobre ellas${anonPriv.length ? ": " + anonPriv.map((p) => p.table_name + "." + p.privilege_type).join(", ") : ""}`);
  const fnAnon = (await c.query(`select p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace
    and (p.proname like 'interno\\_%' or p.proname like 'es\\_interno%') and has_function_privilege('anon', p.oid, 'execute')`)).rows;
  decir(fnAnon.length === 0, `anon no puede ejecutar ninguna función interna${fnAnon.length ? ": " + fnAnon.map((f) => f.proname).join(", ") : ""}`);

  /* ---------- A: el fundador ---------- */
  console.log("\nA · el fundador");
  await como(A);
  decir((await una("select es_interno() v")).v === true && (await una("select es_interno('finanzas') v")).v === true, "es interno, en todas las áreas");
  for (const t of tablas) {
    const { e } = await intentar(`select count(*) from ${t}`);
    decir(!e, `lee ${t}`);
  }
  let x = await intentar("insert into interno_listas (tipo, clave, nombre) values ('zona', 'prueba_a', 'Zona de prueba') returning id, creado_por");
  decir(!x.e && x.r.rows[0].creado_por === A, "crea en la configuración, y el autor lo pone la base");
  const zona = x.r && x.r.rows[0].id;
  x = await intentar("update interno_listas set nombre = 'Zona cambiada' where id = $1", [zona]);
  decir(!x.e && x.r.rowCount === 1, "la cambia");
  x = await intentar("delete from interno_listas where id = $1", [zona]);
  decir(x.e && /permission denied/.test(x.e.message), "no la borra: se desactiva");
  const h = await una("select count(*)::int n from interno_historial where tabla = 'interno_listas' and fila_id = $1", [zona]);
  decir(h.n === 2, "el alta y el cambio quedan en el historial");
  x = await intentar("insert into interno_historial (tabla, fila_id, accion) values ('x', 'x', 'alta')");
  decir(x.e && /permission denied/.test(x.e.message), "nadie escribe el historial a mano");
  x = await intentar("update interno_miembros set areas = array['crm'] where perfil_id = $1", [A]);
  decir(!x.e && x.r.rowCount === 0, "ni el fundador se cambia su propia membresía (no se deja afuera sin querer)");

  /* ---------- F: miembro con un área, que además es de un comercio ---------- */
  await admin();
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'comercial', array['crm'])", [D]);
  console.log("\nF · miembro con solo el área crm");
  await como(D);
  decir((await una("select es_interno() v")).v === true && (await una("select es_interno('crm') v")).v === true, "es interno, en crm");
  decir((await una("select es_interno('finanzas') v")).v === false && (await una("select es_interno('config') v")).v === false, "no en finanzas ni en config");
  decir(Number((await una("select count(*) n from interno_etapas")).n) > 0, "lee las etapas (las necesita para trabajar)");
  x = await intentar("insert into interno_listas (tipo, clave, nombre) values ('zona', 'prueba_f', 'X')");
  decir(x.e && /row-level security/.test(x.e.message), "no toca la configuración");
  x = await intentar("update interno_miembros set areas = array['*'] where perfil_id = $1", [D]);
  decir(!x.e && x.r.rowCount === 0, "no se da más áreas a sí mismo");
  decir(Number((await una("select count(*) n from interno_miembros")).n) === 1, "de los miembros, ve solo su propia fila");
  const ventas = Number((await una("select count(*) n from operaciones where empresa_id = $1", [super25])).n);
  decir(ventas === 0, "ser interno no le abre otro comercio: no ve ninguna venta de Super 25");

  /* ---------- B, C, D (sin membresía), E ---------- */
  await admin();
  await c.query("delete from interno_miembros where perfil_id = $1", [D]);
  await c.query("update interno_miembros set activo = false where perfil_id = $1", [A]);
  const ajenos = [["B · la plataforma sin membresía activa", A], ["C · el dueño de Super 25", C], ["D · el dueño del bar", D], ["E · anon", null]];
  for (const [nombre, quien] of ajenos) {
    console.log(`\n${nombre}`);
    await como(quien);
    if (quien) decir((await una("select es_interno() v")).v === false, "no es interno");
    else { const r = await intentar("select es_interno() v"); decir(r.e && /permission denied/.test(r.e.message), "ni siquiera puede preguntar si es interno"); }
    for (const t of tablas) {
      /* De los miembros, cada uno puede ver su propia fila (aunque esté
         desactivada: así la pantalla le dice que no tiene acceso), y
         ninguna otra. */
      const sql = t === "interno_miembros"
        ? "select count(*)::int n from interno_miembros where perfil_id is distinct from auth.uid()"
        : `select count(*)::int n from ${t}`;
      const r = await intentar(sql);
      decir((r.e && /permission denied/.test(r.e.message)) || (!r.e && r.r.rows[0].n === 0), t === "interno_miembros" ? "de los miembros, no ve a nadie más que a sí mismo" : `no ve nada de ${t}`);
    }
    x = await intentar("insert into interno_listas (tipo, clave, nombre) values ('zona', 'intruso', 'X')");
    decir(!!x.e, "no crea en la configuración");
    x = await intentar("update interno_etapas set nombre = 'X'");
    decir(!!x.e || x.r.rowCount === 0, "no cambia ninguna etapa");
    x = await intentar("insert into interno_miembros (perfil_id, rol, areas) values (coalesce($1::uuid, gen_random_uuid()), 'fundador', array['*'])", [quien]);
    decir(!!x.e, "no se agrega como miembro");
  }
  await admin();
  await c.query("update interno_miembros set activo = true where perfil_id = $1", [A]);

  console.log("\nLos comercios siguen como estaban");
  await como(C);
  decir(Number((await una("select count(*) n from operaciones where empresa_id = $1", [super25])).n) > 0, "el dueño de Super 25 sigue viendo sus ventas");
  await como(A);
  decir(Number((await una("select count(*) n from operaciones where empresa_id = $1", [super25])).n) > 0, "y la plataforma, igual que antes");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
