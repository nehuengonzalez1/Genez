/* ============================================================
   PRUEBA · la suscripción (0128), sin dejar nada
   ============================================================

   Todo corre en UNA transacción que termina en rollback: el usuario de
   Auth, el comercio de prueba, la suscripción, la ficha en Founder y la
   migración misma (si se le pasa el archivo) se deshacen.

     node scripts/probar-suscripcion.mjs                                   la base como está
     node scripts/probar-suscripcion.mjs supabase/migrations/0128_suscripciones.sql

   No habla con Mercado Pago: prueba lo que hace la base con lo que el
   servidor escribe después de hablar con Mercado Pago.

   Lo que mira:
   - El servidor (service_role) cambia plan, módulos y prueba_hasta; el
     comercio, no.
   - El comercio ve su suscripción en mi_cuenta(), y no la tabla.
   - Activa por primera vez: crea prospecto, cliente y suscripción en
     Founder, con el anual contado por mes. Una segunda llamada no
     duplica nada.
   - Un cobro fallido deja al cliente "en riesgo"; una baja cierra la
     suscripción de Founder con fecha.
   - Una suscripción pendiente no crea nada en Founder.

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

const uid = randomUUID();
const email = `prueba-suscripcion-${uid.slice(0, 8)}@genez.test`;

try {
  await c.query("set idle_in_transaction_session_timeout = '60s'");
  await c.query("begin");
  await c.query("set local lock_timeout = '5s'");

  if (archivo) {
    console.log(`Aplicando ${archivo} adentro de la transacción…`);
    const sql = readFileSync(archivo, "utf8").replace(/^set local (lock_timeout|idle_in_transaction_session_timeout).*$/gm, "");
    await c.query(sql);
  }

  console.log("\nUn comercio de prueba");
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now(), now(), now())`,
    [uid, email]
  );
  const registro = {
    comercio: "Almacén de Prueba Suscripción", rubro: "minimercado", negocio: "Almacén", nombre: "Persona de Prueba",
    telefono: "11 5555-0000", plan: "start", modulos: ["stock", "compras", "pedidos", "clientes", "permisos"],
    provincia: "Buenos Aires", sucursales: "1", problema: "Probar la suscripción",
  };
  const empresa = (await comoUsuario(uid, () => una("select crear_comercio_de_prueba($1) as id", [registro]))).id;
  decir(!!empresa, "se crea con la prueba");

  console.log("\nQuién cambia lo comercial");
  const delComercio = await comoUsuario(uid, () => falla("update empresas set prueba_hasta = null where id = $1", [empresa]));
  decir(/los cambia Genez/.test(delComercio || ""), `el comercio no se saca la prueba (${delComercio})`);
  const delServidor = await comoServidor(() => falla("update empresas set plan = 'start', prueba_hasta = prueba_hasta + 1 where id = $1", [empresa]));
  decir(delServidor === null, `el servidor sí (${delServidor || "sin error"})`);

  console.log("\nLa tabla y mi_cuenta()");
  await comoServidor(() => c.query(
    `insert into suscripciones (empresa_id, mp_id, plan, periodo, monto, payer_email) values ($1, $2, 'start', 'anual', 299000, $3)`,
    [empresa, `prueba-${uid.slice(0, 8)}`, email]
  ));
  const ve = await comoUsuario(uid, () => falla("select * from suscripciones"));
  const filas = ve === null ? (await comoUsuario(uid, () => c.query("select count(*)::int as n from suscripciones"))).rows[0].n : null;
  decir(filas === 0, `el comercio no ve la tabla (${ve || `${filas} filas`})`);
  const cuenta = (await comoUsuario(uid, () => una("select mi_cuenta() as m"))).m;
  decir(cuenta.suscripcion && cuenta.suscripcion.estado === "pendiente" && Number(cuenta.suscripcion.monto) === 299000,
    `mi_cuenta() trae la suya (${JSON.stringify(cuenta.suscripcion)})`);
  decir(cuenta.plan_elegido === "start", `y el plan que eligió al registrarse (${cuenta.plan_elegido})`);
  const escribe = await comoUsuario(uid, () => falla("update suscripciones set monto = 1 where empresa_id = $1", [empresa]));
  const monto = Number((await una("select monto from suscripciones where empresa_id = $1", [empresa])).monto);
  decir(monto === 299000, `el comercio no la cambia (${escribe || "sin error"}, monto ${monto})`);
  const desdeNavegador = await comoUsuario(uid, () => falla("select suscripcion_a_founder($1)", [empresa]));
  decir(/permission denied/.test(desdeNavegador || ""), `ni llama a la de Founder (${desdeNavegador})`);

  console.log("\nFounder");
  await comoServidor(() => c.query("select suscripcion_a_founder($1)", [empresa]));
  const pendiente = await una("select count(*)::int as n from interno_clientes where empresa_id = $1", [empresa]);
  decir(pendiente.n === 0, "pendiente: no crea nada");

  await comoServidor(() => c.query("update suscripciones set estado = 'activa' where empresa_id = $1", [empresa]));
  await comoServidor(() => c.query("select suscripcion_a_founder($1)", [empresa]));
  await comoServidor(() => c.query("select suscripcion_a_founder($1)", [empresa]));
  const f = await una(`select
      (select count(*) from interno_prospectos where empresa_id = $1)::int as prospectos,
      (select fuente from interno_prospectos where empresa_id = $1 limit 1) as fuente,
      (select count(*) from interno_clientes where empresa_id = $1)::int as clientes,
      (select importe_mensual from interno_clientes where empresa_id = $1) as mensual,
      (select estado from interno_clientes where empresa_id = $1) as estado,
      (select count(*) from interno_suscripciones s join interno_clientes cl on cl.id = s.cliente_id where cl.empresa_id = $1)::int as suscripciones`,
    [empresa]);
  decir(f.prospectos === 1 && f.clientes === 1 && f.suscripciones === 1,
    `activa: un prospecto, un cliente, una suscripción, aunque se llame dos veces (${f.prospectos}, ${f.clientes}, ${f.suscripciones})`);
  decir(f.fuente === "autoservicio", `con fuente autoservicio (${f.fuente})`);
  decir(Number(f.mensual) === 24916.67, `el anual contado por mes (${f.mensual})`);
  decir(f.estado === "activo", `cliente activo (${f.estado})`);

  await comoServidor(() => c.query("update suscripciones set pago_fallido_desde = current_date where empresa_id = $1", [empresa]));
  await comoServidor(() => c.query("select suscripcion_a_founder($1)", [empresa]));
  const riesgo = await una("select estado from interno_clientes where empresa_id = $1", [empresa]);
  decir(riesgo.estado === "en_riesgo", `cobro fallido: en riesgo (${riesgo.estado})`);

  await comoServidor(() => c.query("update suscripciones set estado = 'cancelada', pago_fallido_desde = null where empresa_id = $1", [empresa]));
  await comoServidor(() => c.query("select suscripcion_a_founder($1)", [empresa]));
  const baja = await una(`select cl.estado as cliente, s.estado, s.fin is not null as con_fin
    from interno_clientes cl join interno_suscripciones s on s.cliente_id = cl.id where cl.empresa_id = $1`, [empresa]);
  decir(baja.cliente === "cancelado" && baja.estado === "baja" && baja.con_fin, `baja: cliente cancelado y suscripción cerrada con fecha (${JSON.stringify(baja)})`);

  console.log("\nLos demás comercios");
  const gente = (await c.query("select p.id, e.nombre from perfiles p join empresas e on e.id = p.empresa_id where p.activo and e.id <> $1", [empresa])).rows;
  const sinComercio = [];
  for (const p of gente) {
    const r = await comoUsuario(p.id, () => una("select empresa_actual() is not null as entra"));
    if (!r.entra) sinComercio.push(p.nombre);
  }
  decir(gente.length > 0 && sinComercio.length === 0,
    `los ${gente.length} usuarios activos de los otros comercios siguen entrando${sinComercio.length ? ` (no: ${sinComercio.join(", ")})` : ""}`);
} catch (e) {
  fallas++;
  console.log(`\nMAL  se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} cosas no dieron. Nada quedó escrito.` : "\nTodo dio. Nada quedó escrito.");
process.exit(fallas ? 1 : 0);
