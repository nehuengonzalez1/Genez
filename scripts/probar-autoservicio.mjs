/* ============================================================
   PRUEBA · el autoservicio (0127), de punta a punta y sin dejar nada
   ============================================================

   Todo corre en UNA transacción que termina en rollback, haya salido
   bien o mal: el usuario de Auth, el comercio, los ejemplos y la
   migración misma (si se le pasa el archivo) se deshacen.

     node scripts/probar-autoservicio.mjs                       la base como está
     node scripts/probar-autoservicio.mjs supabase/migrations/0127_autoservicio.sql
                                                                aplica 0127 adentro y prueba

   Lo que mira:
   - Un usuario sin confirmar no crea nada; confirmado, crea su comercio
     con sucursal, caja, ejemplos y diez días de prueba. Un segundo alta
     con la misma cuenta se rechaza.
   - Con la prueba vigente lee lo suyo (RLS de verdad, con su token) y
     el inicio tiene ventas; no ve a ningún otro comercio.
   - Vencida o suspendida: no lee ni escribe nada, pero `mi_cuenta()` y
     "Ya pagué" siguen andando.
   - El comercio no se extiende la prueba a sí mismo.
   - "Borrar ejemplos" deja el comercio vacío y lo que cargó la persona.
   - Cada usuario activo de los comercios que ya existían sigue teniendo
     su comercio (solo empresa_actual(), sin leer sus datos).

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

async function como(uid, hacer) {
  await c.query("savepoint como");
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
  try { return await hacer(); }
  /* La identidad se limpia al salir: set_config(..., true) dura hasta el fin
     de la transacción, y lo que sigue tiene que correr como administrador. */
  finally {
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    await c.query("release savepoint como");
  }
}

async function falla(sql, args = []) {
  await c.query("savepoint f");
  try { await c.query(sql, args); await c.query("release savepoint f"); return null; }
  catch (e) { await c.query("rollback to savepoint f"); return e.message; }
}

/* Lo que hace Genez desde su panel (vencer, suspender, activar) va como el
   usuario de plataforma: proteger_lo_comercial no deja a nadie más, ni
   siquiera al administrador de Postgres. */
async function comoGenez(sql, args = []) {
  const p = await una("select id from perfiles where es_plataforma and activo limit 1");
  return como(p.id, () => c.query(sql, args));
}

const uid = randomUUID();
const email = `prueba-autoservicio-${uid.slice(0, 8)}@genez.test`;

try {
  await c.query("set idle_in_transaction_session_timeout = '60s'");
  await c.query("begin");
  await c.query("set local lock_timeout = '5s'");

  if (archivo) {
    console.log(`Aplicando ${archivo} adentro de la transacción…`);
    const sql = readFileSync(archivo, "utf8").replace(/^set local (lock_timeout|idle_in_transaction_session_timeout).*$/gm, "");
    await c.query(sql);
  }

  console.log("\nEl alta");
  await c.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now(), now())`,
    [uid, email]
  );
  const registro = {
    comercio: "Almacén de Prueba Autoservicio", rubro: "minimercado", negocio: "Almacén", nombre: "Persona de Prueba",
    telefono: "11 5555-0000", plan: "pro", modulos: ["stock", "compras", "agenda", "inventado"], provincia: "Buenos Aires",
    sucursales: "1", problema: "Probar el alta",
  };
  const sinConfirmar = await como(uid, () => falla("select crear_comercio_de_prueba($1)", [registro]));
  decir(/Confirmá tu mail/.test(sinConfirmar || ""), `sin confirmar el mail no crea nada (${sinConfirmar})`);

  await c.query("update auth.users set email_confirmed_at = now() where id = $1", [uid]);
  const empresa = (await como(uid, () => una("select crear_comercio_de_prueba($1) as id", [registro]))).id;
  decir(!!empresa, "confirmado, crea el comercio");

  const e = await una("select nombre, slug, plan, modulos, prueba_hasta - (now() at time zone 'America/Argentina/Buenos_Aires')::date as dias from empresas where id = $1", [empresa]);
  decir(e.dias === 10, `diez días de prueba (${e.dias})`);
  decir(e.plan === "pro", `con el plan elegido (${e.plan})`);
  decir(e.modulos.includes("stock") && e.modulos.includes("cobro") && !e.modulos.includes("agenda") && !e.modulos.includes("inventado"),
    `módulos recortados al rubro, más los de base (${e.modulos.join(", ")})`);
  decir(e.slug === "almacen-de-prueba-autoservicio" || e.slug.startsWith("almacen-de-prueba-autoservicio-"), `subdominio (${e.slug})`);

  const armado = await una(`select
      (select count(*) from sucursales where empresa_id = $1)::int as sucursales,
      (select count(*) from cajas where empresa_id = $1)::int as cajas,
      (select rol from perfiles where id = $2) as rol,
      (select count(*) from pruebas where empresa_id = $1)::int as prueba`, [empresa, uid]);
  decir(armado.sucursales === 1 && armado.cajas === 1, `sucursal y caja (${armado.sucursales}, ${armado.cajas})`);
  decir(armado.rol === "dueno", `la persona es dueña (${armado.rol})`);
  decir(armado.prueba === 1, "queda anotada en pruebas");

  const otra = await como(uid, () => falla("select crear_comercio_de_prueba($1)", [registro]));
  decir(/ya tiene un comercio/.test(otra || ""), "una cuenta, un comercio");

  console.log("\nCon la prueba vigente, como la persona");
  const vista = await como(uid, () => una(`select
      (select count(*) from items)::int as items,
      (select count(*) from items_vista where stock < stock_min and controla_stock)::int as reponer,
      (select count(*) from clientes)::int as clientes,
      (select count(*) from empresas)::int as empresas,
      (select coalesce(sum(ventas), 0) from ventas_diarias($1, 14)) as ventas,
      (select coalesce(sum(tickets), 0) from ventas_diarias($1, 14))::int as tickets`, [empresa]));
  decir(vista.items === 12, `ve sus productos de ejemplo (${vista.items})`);
  decir(vista.clientes === 3, `y sus clientes de ejemplo (${vista.clientes})`);
  decir(vista.empresas === 1, `y ningún otro comercio (${vista.empresas})`);
  decir(vista.tickets > 50 && Number(vista.ventas) > 0, `el inicio tiene dos semanas de ventas (${vista.tickets} tickets, $ ${Math.round(vista.ventas)})`);
  decir(vista.reponer > 0 && vista.reponer < vista.items, `algo para reponer, no todo (${vista.reponer} de ${vista.items})`);
  const negativos = await como(uid, () => una("select count(*)::int as n from items_vista where controla_stock and stock < 0"));
  decir(negativos.n === 0, `ningún stock en negativo (${negativos.n})`);

  const extender = await como(uid, () => falla("update empresas set prueba_hasta = prueba_hasta + 30 where id = $1", [empresa]));
  decir(/los cambia Genez/.test(extender || ""), "no se extiende la prueba a sí mismo");

  console.log("\nVencida");
  await comoGenez("update empresas set prueba_hasta = (now() at time zone 'America/Argentina/Buenos_Aires')::date - 1 where id = $1", [empresa]);
  const vencida = await como(uid, () => una(`select
      (select count(*) from items)::int as items,
      (select count(*) from empresas)::int as empresas,
      empresa_actual() as actual`));
  decir(vencida.items === 0 && vencida.empresas === 0 && vencida.actual === null, `no lee nada (${vencida.items} productos, ${vencida.empresas} comercios)`);
  const escribir = await como(uid, () => falla("insert into items (empresa_id, nombre) values ($1, 'Colado')", [empresa]));
  decir(!!escribir, `no escribe (${escribir})`);
  const venta = await como(uid, () => falla("select registrar_venta($1)", [{ id: randomUUID(), empresa_id: empresa, total: 100, lineas: [] }]));
  decir(!!venta, `no vende (${venta})`);
  const cuenta = await como(uid, () => una("select mi_cuenta() as c"));
  decir(cuenta.c && cuenta.c.nombre === registro.comercio && cuenta.c.prueba_hasta, "mi_cuenta() contesta para la pantalla de contratar");
  await como(uid, () => c.query("select avisar_pago()"));
  const aviso = await una("select pago_avisado_en from pruebas where empresa_id = $1", [empresa]);
  decir(!!aviso.pago_avisado_en, "\"Ya pagué\" queda anotado");

  console.log("\nSuspendida por Genez");
  await comoGenez("update empresas set prueba_hasta = null, activa = false where id = $1", [empresa]);
  const suspendida = await como(uid, () => una("select (select count(*) from items)::int as items"));
  decir(suspendida.items === 0, "activa = false ahora también la frena la base");

  console.log("\nActivada, y borrando los ejemplos");
  await comoGenez("update empresas set activa = true where id = $1", [empresa]);
  const propio = await como(uid, () => una("insert into items (empresa_id, nombre, precio) values ($1, 'Producto propio', 1000) returning id", [empresa]));
  decir(!!propio.id, "activada, vuelve a escribir");
  await como(uid, () => c.query("select borrar_ejemplos()"));
  const despues = await una(`select
      (select count(*) from items where empresa_id = $1)::int as items,
      (select count(*) from operaciones where empresa_id = $1)::int as ventas,
      (select count(*) from clientes where empresa_id = $1)::int as clientes,
      (select count(*) from movimientos_stock where empresa_id = $1)::int as movimientos`, [empresa]);
  decir(despues.items === 1 && despues.ventas === 0 && despues.clientes === 0 && despues.movimientos === 0,
    `queda solo lo propio (${despues.items} producto, ${despues.ventas} ventas, ${despues.clientes} clientes, ${despues.movimientos} movimientos)`);

  console.log("\nLos demás comercios");
  /* Cada usuario activo de cada comercio que ya existía sigue teniendo su
     comercio. Solo se pregunta empresa_actual(): no se lee nada de ellos. */
  const gente = (await c.query("select p.id, e.nombre from perfiles p join empresas e on e.id = p.empresa_id where p.activo and e.id <> $1", [empresa])).rows;
  let sinComercio = [];
  for (const p of gente) {
    const r = await como(p.id, () => una("select empresa_actual() is not null as entra"));
    if (!r.entra) sinComercio.push(p.nombre);
  }
  decir(gente.length > 0 && sinComercio.length === 0,
    `los ${gente.length} usuarios activos de los comercios de antes siguen entrando${sinComercio.length ? ` (no: ${sinComercio.join(", ")})` : ""}`);
} catch (e) {
  fallas++;
  console.log(`\nMAL  se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} cosas no dieron. Nada quedó escrito.` : "\nTodo dio. Nada quedó escrito.");
process.exit(fallas ? 1 : 0);
