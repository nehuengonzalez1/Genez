/* ============================================================
   PRUEBA · Mi plan (0130), sin dejar nada
   ============================================================

   Una transacción que termina en rollback. Si se le pasa el archivo,
   aplica la migración adentro.

     node scripts/probar-mi-plan.mjs
     node scripts/probar-mi-plan.mjs supabase/migrations/0130_mi_plan.sql

   Lo que mira:
   - mi_cuenta() trae lo nuevo (rol, código de baja, cambio pendiente).
   - Nadie de afuera escribe ni lee arrepentimientos; la plataforma lee.
   - El borrado: un comercio de autoservicio vencido hace 90 días se borra
     entero, con sus usuarios de Auth y sin dejar filas. Con 89 días, con
     suscripción activa, con un comprobante o siendo de los de antes de
     los planes (Bnitori), no; y nadie más que la service_role lo llama.

   Pone `idle_in_transaction_session_timeout`: una prueba cortada dejó una
   vez una sesión abierta en producción, con bloqueos.
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];

async function como(rol, claims, hacer) {
  await c.query("savepoint como");
  await c.query(`set local role ${rol}`);
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  try { return await hacer(); }
  finally {
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    await c.query("release savepoint como");
  }
}
const comoUsuario = (uid, hacer) => como("authenticated", { sub: uid, role: "authenticated" }, hacer);
const comoServidor = (hacer) => como("service_role", { role: "service_role" }, hacer);

async function falla(sql, args = []) {
  await c.query("savepoint f");
  try { await c.query(sql, args); await c.query("release savepoint f"); return null; }
  catch (e) { await c.query("rollback to savepoint f"); return e.message; }
}
async function fallaComo(rol, claims, sql, args = []) {
  await c.query("savepoint g");
  try {
    await c.query(`set local role ${rol}`);
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await c.query(sql, args);
    await c.query("rollback to savepoint g");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint g");
    return e.message;
  } finally {
    await c.query("reset role");
  }
}

async function comercioDePrueba(nombre) {
  const uid = randomUUID();
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now(), now(), now())`,
    [uid, `prueba-mi-plan-${uid.slice(0, 8)}@genez.test`]
  );
  const registro = {
    comercio: nombre, rubro: "minimercado", negocio: "Almacén", nombre: "Persona de Prueba",
    telefono: "11 5555-0000", plan: "pro", modulos: ["stock", "compras", "pedidos", "clientes", "permisos"],
    provincia: "Buenos Aires", sucursales: "1", problema: "Probar Mi plan",
  };
  const empresa = (await comoUsuario(uid, () => una("select crear_comercio_de_prueba($1) as id", [registro]))).id;
  return { uid, empresa };
}

try {
  await c.query("set idle_in_transaction_session_timeout = '60s'");
  await c.query("begin");
  await c.query("set local lock_timeout = '5s'");

  if (archivo) {
    console.log(`Aplicando ${archivo} adentro de la transacción…`);
    await c.query(readFileSync(archivo, "utf8"));
  }

  console.log("mi_cuenta()");
  const a = await comercioDePrueba("Almacén Mi Plan A");
  await comoServidor(() => c.query(
    `insert into suscripciones (empresa_id, mp_id, plan, periodo, monto, payer_email, estado, baja_codigo, cambio_mp_id, cambio_plan, cambio_periodo, cambio_monto)
     values ($1, $2, 'pro', 'mensual', 59900, 'x@genez.test', 'cancelada', 'B-PRUEBA1', $3, 'pro', 'anual', 599000)`,
    [a.empresa, `mp-${a.uid.slice(0, 8)}`, `mp2-${a.uid.slice(0, 8)}`]
  ));
  const cuenta = (await comoUsuario(a.uid, () => una("select mi_cuenta() as m"))).m;
  decir(cuenta.mi_rol === "dueno" && cuenta.autoservicio === true, `rol y autoservicio (${cuenta.mi_rol}, ${cuenta.autoservicio})`);
  decir(cuenta.suscripcion.baja_codigo === "B-PRUEBA1" && cuenta.suscripcion.cambio_periodo === "anual",
    "el código de baja y el cambio pendiente");

  console.log("\nArrepentimientos");
  await comoServidor(() => c.query(
    "insert into arrepentimientos (codigo, nombre, email) values ('A-PRUEBA1', 'Persona', 'x@genez.test')"
  ));
  const escribe = await fallaComo("authenticated", { sub: a.uid, role: "authenticated" },
    "insert into arrepentimientos (codigo, nombre, email) values ('A-PRUEBA2', 'Otra', 'y@genez.test')");
  const anon = await fallaComo("anon", { role: "anon" },
    "insert into arrepentimientos (codigo, nombre, email) values ('A-PRUEBA3', 'Otra', 'y@genez.test')");
  decir(!!escribe && !!anon, "ni un usuario ni anon escriben");
  const veComercio = (await comoUsuario(a.uid, () => una("select count(*)::int as n from arrepentimientos"))).n;
  const plataforma = await una("select id from perfiles where es_plataforma and activo limit 1");
  const vePlataforma = plataforma ? (await comoUsuario(plataforma.id, () => una("select count(*)::int as n from arrepentimientos where codigo = 'A-PRUEBA1'"))).n : null;
  decir(veComercio === 0 && vePlataforma === 1, `el comercio no ve nada (${veComercio}) y la plataforma sí (${vePlataforma})`);

  console.log("\nEl borrado");
  const puede = (id) => comoServidor(async () => (await una("select se_puede_borrar($1) as p", [id])).p);
  const b = await comercioDePrueba("Almacén Mi Plan B");
  await comoServidor(() => c.query("update empresas set prueba_hasta = (now() at time zone 'America/Argentina/Buenos_Aires')::date - 89 where id = $1", [b.empresa]));
  decir((await puede(b.empresa)) === false, "con 89 días, no");
  await comoServidor(() => c.query("update empresas set prueba_hasta = (now() at time zone 'America/Argentina/Buenos_Aires')::date - 90 where id = $1", [b.empresa]));
  decir((await puede(b.empresa)) === true, "con 90 días, sí");

  await comoServidor(() => c.query(
    "insert into suscripciones (empresa_id, mp_id, plan, periodo, monto, payer_email, estado) values ($1, $2, 'pro', 'mensual', 59900, 'x@genez.test', 'activa')",
    [b.empresa, `mpb-${b.uid.slice(0, 8)}`]
  ));
  decir((await puede(b.empresa)) === false, "con suscripción activa, no");
  await comoServidor(() => c.query("update suscripciones set estado = 'cancelada' where empresa_id = $1", [b.empresa]));
  decir((await puede(b.empresa)) === true, "dada de baja, sí");

  const bnitori = await una("select id from empresas where nombre = 'Bnitori'");
  if (bnitori) {
    await c.query("savepoint vieja");
    await comoServidor(() => c.query("update empresas set prueba_hasta = current_date - 400 where id = $1", [bnitori.id]));
    decir((await puede(bnitori.id)) === false, "un comercio de antes de los planes (Bnitori, vencido hace 400 días), no");
    await c.query("rollback to savepoint vieja");
  }

  const deAfuera = await fallaComo("authenticated", { sub: b.uid, role: "authenticated" }, "select borrar_comercio($1)", [b.empresa]);
  decir(/permission denied/.test(deAfuera || ""), `el comercio no se puede borrar a sí mismo (${deAfuera})`);

  const r = await comoServidor(async () => (await una("select borrar_comercio($1) as r", [b.empresa])).r);
  const tablas = (await c.query(`select table_name from information_schema.columns c
    join information_schema.tables t using (table_schema, table_name)
    where c.table_schema = 'public' and c.column_name = 'empresa_id' and t.table_type = 'BASE TABLE'`)).rows.map((x) => x.table_name);
  const sobras = [];
  for (const t of tablas) {
    const n = (await una(`select count(*)::int as n from public."${t}" where empresa_id = $1`, [b.empresa])).n;
    if (n) sobras.push(`${t}:${n}`);
  }
  const usuario = (await una("select count(*)::int as n from auth.users where id = $1", [b.uid])).n;
  decir(r.usuarios === 1 && usuario === 0 && sobras.length === 0,
    `borrado entero: ${r.usuarios} usuario, Auth ${usuario}, filas que quedaron: ${sobras.join(" ") || "ninguna"}`);

  const otra = await falla("select borrar_comercio($1)", [a.empresa]);
  decir(/no se puede borrar/.test(otra || ""), `uno que no cumple, no se borra aunque lo pida el servidor (${otra})`);
} catch (e) {
  fallas++;
  console.log(`\nMAL  se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} cosas no dieron. Nada quedó escrito.` : "\nTodo dio. Nada quedó escrito.");
process.exit(fallas ? 1 : 0);
