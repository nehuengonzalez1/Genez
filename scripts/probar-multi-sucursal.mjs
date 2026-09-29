/* ============================================================
   PRUEBA · varias sucursales (0108), en la base
   ============================================================

   En una transacción que se deshace; si 0108 no está aplicada, la aplica
   adentro y mira cómo quedó lo viejo.

   - Lo viejo: nada queda sin sucursal, y las ventas viejas no cambian de
     fecha de modificación.
   - Lo nuevo: la sesión toma la sucursal de su caja, la venta de su
     sesión, el stock de su venta.
   - Pasar mercadería: sale de una y entra en la otra.
   - Quién: sin configurar no se crean sucursales; la última activa no
     se apaga; una caja no puede ser de la sucursal de otro comercio.

   Trabaja sobre "Super 25 Pruebas", nunca sobre un cliente.

     node scripts/probar-multi-sucursal.mjs
   ============================================================ */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
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
const como = async (usuario) => {
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: usuario, role: "authenticated" })]);
};
const comoAdmin = () => c.query("reset role");

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  const aplicada = (await una("select count(*)::int n from pg_proc where proname = 'transferir_stock'")).n;

  console.log("\nLo viejo");
  if (!aplicada) {
    const antes = await una("select max(actualizada_en) m, count(*) filter (where sucursal_id is null)::int n from operaciones");
    await c.query(readFileSync("supabase/migrations/0108_multi_sucursal.sql", "utf8"));
    const despues = await una("select max(actualizada_en) m from operaciones");
    decir(antes.n > 0 && String(antes.m) === String(despues.m), `${antes.n} ventas viejas completadas sin cambiarles la fecha de modificación`);
  } else {
    console.log("  --   0108 ya estaba aplicada: no se puede mirar cómo quedó lo viejo");
  }
  const sin = await una(`select
    (select count(*) from operaciones where sucursal_id is null)::int ops,
    (select count(*) from movimientos_stock where sucursal_id is null)::int stock,
    (select count(*) from sesiones_caja where sucursal_id is null)::int ses,
    (select count(*) from movimientos_caja where sucursal_id is null)::int caja,
    (select count(*) from cajas where sucursal_id is null)::int cajas`);
  decir(!sin.ops && !sin.stock && !sin.ses && !sin.caja && !sin.cajas, "nada queda sin sucursal: ventas, stock, sesiones, caja y cajas");
  const distinto = await una("select count(*)::int n from sesiones_caja s join cajas c on c.id = s.caja_id where s.sucursal_id <> c.sucursal_id");
  decir(distinto.n === 0, "cada sesión está en la sucursal de su caja");

  const emp = (await una("select id from empresas where nombre = 'Super 25 Pruebas'")).id;
  const otra = (await una("select id from empresas where nombre = 'Super 25'")).id;
  const plataforma = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const principal = (await una("select primera_sucursal($1) id", [emp])).id;

  console.log("\nUna segunda sucursal");
  await como(plataforma);
  const centro = (await una("insert into sucursales (empresa_id, nombre, domicilio) values ($1, 'Centro', 'San Martín 100') returning id", [emp])).id;
  decir(!!centro, "la plataforma la crea");
  let e = await falla("insert into sucursales (empresa_id, nombre) values ($1, 'centro ')", [emp]);
  decir(e && /sucursales_nombre_unico/.test(e.message), "dos con el mismo nombre (sin mirar mayúsculas ni espacios): no");
  const caja2 = (await una("insert into cajas (empresa_id, nombre, sucursal_id) values ($1, 'Mostrador Centro', $2) returning id, sucursal_id", [emp, centro]));
  decir(caja2.sucursal_id === centro, "una caja en el Centro");
  const caja3 = (await una("insert into cajas (empresa_id, nombre) values ($1, 'Sin decir') returning sucursal_id", [emp]));
  decir(caja3.sucursal_id === principal, "una caja sin sucursal va a la primera");
  e = await falla("insert into cajas (empresa_id, nombre, sucursal_id) values ($1, 'Ajena', primera_sucursal($2))", [emp, otra]);
  decir(e && /no es de este comercio/.test(e.message), "una caja en la sucursal de otro comercio: no");

  console.log("\nLa sucursal viaja sola");
  const ses = await una("insert into sesiones_caja (empresa_id, caja_id, monto_inicial, sucursal_id) values ($1, $2, 0, $3) returning id, sucursal_id", [emp, caja2.id, principal]);
  decir(ses.sucursal_id === centro, "la sesión toma la sucursal de su caja, aunque le manden otra");
  /* Como registrar_venta: primero la venta y su stock (sin sucursal: va
     a la primera), después la caja. */
  const op = await una("insert into operaciones (id, empresa_id, tipo, estado, total) values (gen_random_uuid(), $1, 'venta', 'borrador', 0) returning id, sucursal_id", [emp]);
  decir(op.sucursal_id === principal, "una venta sin sucursal arranca en la primera");
  const item = (await una("select id from items where empresa_id = $1 and activo limit 1", [emp])).id;
  const mov = await una("insert into movimientos_stock (empresa_id, item_id, cantidad, tipo, operacion_id) values ($1, $2, -1, 'venta', $3) returning id, sucursal_id", [emp, item, op.id]);
  decir(mov.sucursal_id === principal, "su stock, el de su venta");
  const mc = await una("insert into movimientos_caja (empresa_id, sesion_id, tipo, medio, monto, detalle, operacion_id) values ($1, $2, 'ingreso', 'efectivo', 100, 'prueba', $3) returning sucursal_id", [emp, ses.id, op.id]);
  decir(mc.sucursal_id === centro, "el movimiento de caja, el de su sesión");
  const op2 = await una("select sucursal_id from operaciones where id = $1", [op.id]);
  const mov2 = await una("select sucursal_id from movimientos_stock where id = $1", [mov.id]);
  decir(op2.sucursal_id === centro && mov2.sucursal_id === centro, "y con él, la venta y su stock pasan a la sucursal de la caja donde se cobró");
  const suelto = await una("insert into movimientos_stock (empresa_id, item_id, cantidad, tipo) values ($1, $2, 5, 'ajuste') returning sucursal_id", [emp, item]);
  decir(suelto.sucursal_id === principal, "un ajuste sin venta ni sucursal: a la primera");

  console.log("\nLos informes, por sucursal");
  await comoAdmin();
  await c.query("update operaciones set estado = 'confirmada', total = 1234 where id = $1", [op.id]);
  await como(plataforma);
  const hoy = (await una("select (now() at time zone zona_de($1))::date d", [emp])).d;
  const enCentro = await una("select sum(ventas)::int v, sum(tickets)::int t from ventas_diarias_rango($1, $2, $2, $3)", [emp, hoy, centro]);
  const enPrincipal = await una("select coalesce(sum(tickets), 0)::int t from ventas_diarias_rango(p_empresa => $1, p_desde => $2, p_hasta => $2, p_sucursal => $3)", [emp, hoy, principal]);
  const todas = await una("select sum(tickets)::int t from ventas_diarias_rango(p_empresa => $1, p_desde => $2, p_hasta => $2)", [emp, hoy]);
  decir(enCentro.v === 1234 && enCentro.t === 1, "la venta del Centro aparece en el Centro");
  decir(enPrincipal.t === 0, "y no en la Principal");
  decir(todas.t === 1, "sin sucursal, como antes: todas juntas (y la llamada vieja, sin el parámetro, sigue andando)");

  console.log("\nPasar mercadería");
  const stockDe = async (s) => Number((await una("select coalesce(sum(cantidad), 0) n from movimientos_stock where item_id = $1 and sucursal_id = $2", [item, s])).n);
  const a0 = await stockDe(principal), b0 = await stockDe(centro);
  await c.query("select transferir_stock($1, 3, $2, $3, 'reposición')", [item, principal, centro]);
  decir(await stockDe(principal) === a0 - 3 && await stockDe(centro) === b0 + 3, "3 unidades de la Principal al Centro: sale de una y entra en la otra");
  const tot = await una("select stock from items_vista where id = $1", [item]);
  const suma = Number((await una("select coalesce(sum(cantidad),0) n from movimientos_stock where item_id = $1", [item])).n);
  decir(Number(tot.stock) === suma, "el total del producto no cambia con un pase");
  const vista = await una("select stock from stock_actual where item_id = $1 and sucursal_id = $2", [item, centro]);
  decir(Number(vista.stock) === b0 + 3, "stock_actual lo ve por sucursal");
  e = await falla("select transferir_stock($1, 0, $2, $3)", [item, principal, centro]);
  decir(e && /mayor que cero/.test(e.message), "cantidad cero: no");
  e = await falla("select transferir_stock($1, 1, $2, $2)", [item, centro]);
  decir(e && /misma sucursal/.test(e.message), "a la misma sucursal: no");
  e = await falla("select transferir_stock($1, 1, $2, primera_sucursal($3))", [item, centro, otra]);
  decir(e && /no es de este comercio/.test(e.message), "a la sucursal de otro comercio: no");

  console.log("\nApagar una sucursal");
  e = await falla("update sucursales set activa = false where id = $1", [centro]);
  decir(e && /cajas activas/.test(e.message), "con cajas activas: no");
  await c.query("update cajas set sucursal_id = $1 where id = $2", [principal, caja2.id]);
  e = await falla("update sucursales set activa = false where id = $1", [centro]);
  decir(!e, "sin cajas: sí");
  e = await falla("select transferir_stock($1, 1, $2, $3)", [item, principal, centro]);
  decir(e && /desactivada/.test(e.message), "a una desactivada no se le pasa mercadería");
  e = await falla("update sucursales set activa = false where id = $1", [principal]);
  decir(e && /(única sucursal activa|cajas activas)/.test(e.message), "la última activa: no");

  console.log("\nSin permiso de configurar");
  await comoAdmin();
  /* No hay en la base un usuario sin configurar: se le saca a uno por un
     momento, con la excepción personal (perfiles.permisos), dentro de
     esta transacción que se deshace. */
  const cajero = await una("select id, empresa_id from perfiles where activo and not es_plataforma and empresa_id is not null limit 1");
  if (cajero) await c.query("update perfiles set permisos = coalesce(permisos, '{}'::jsonb) || '{\"configurar\": false}' where id = $1", [cajero.id]);
  if (cajero) decir((await una("select coalesce((permisos_de($1) ->> 'configurar')::boolean, false) v", [cajero.id])).v === false, "(se le sacó configurar a un usuario, solo en esta prueba)");
  if (cajero) {
    await como(cajero.id);
    e = await falla("insert into sucursales (empresa_id, nombre) values ($1, 'Trucha')", [cajero.empresa_id]);
    decir(e && /row-level security/.test(e.message), "un cajero no crea sucursales");
    const r = await c.query("delete from sucursales where empresa_id = $1", [cajero.empresa_id]);
    decir(r.rowCount === 0, "ni las borra");
  } else {
    console.log("  --   no hay un usuario sin configurar para probar");
  }
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

/* ---------- src/datos/sucursales.js, con una conexión de mentira ---------- */
console.log("\nLo que pide el navegador");
const dir = mkdtempSync(join(tmpdir(), "genez-suc-"));
const falso = join(dir, "supabase-falso.js");
/* En globalThis: esbuild copia este archivo adentro del compilado. */
writeFileSync(falso, `
const g = globalThis.__suc ||= { pedidos: [], rpc: null };
const filas = Array.from({ length: 1500 }, (_, i) => ({ item_id: "i" + (i % 800), sucursal_id: i < 800 ? "A" : "B", stock: 2 }));
export const supabase = {
  from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; },
    range(a, b) { g.pedidos.push([a, b]); return Promise.resolve({ data: filas.slice(a, b + 1), error: null }); } }),
  rpc: (n, p) => { g.rpc = { n, p }; return Promise.resolve({ error: null }); },
};
`);
const salida = join(dir, "sucursales.mjs");
await build({
  entryPoints: [resolve("src/datos/sucursales.js")], bundle: true, platform: "node", format: "esm", outfile: salida, logLevel: "error",
  plugins: [{ name: "falso", setup(b) { b.onResolve({ filter: /\/supabase\.js$/ }, () => ({ path: falso })); } }],
});
const { cargarStockPorSucursal, transferirStock } = await import(pathToFileURL(salida).href);
const g = globalThis.__suc;
const mapa = await cargarStockPorSucursal("e1");
decir(g.pedidos.length === 2 && g.pedidos[1][0] === 1000, "1.500 filas: pide de a mil, dos veces (PostgREST corta en mil)");
decir(mapa.size === 800 && mapa.get("i0").A === 2 && mapa.get("i0").B === 2, "arma producto → sucursal → stock");
await transferirStock({ itemId: "i1", cantidad: "3", desde: "A", hacia: "B" });
decir(g.rpc.n === "transferir_stock" && g.rpc.p.p_cantidad === 3 && g.rpc.p.p_desde === "A" && g.rpc.p.p_hacia === "B" && g.rpc.p.p_nota === null,
  "el pase llama a transferir_stock con la cantidad como número");
rmSync(dir, { recursive: true, force: true });

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
