/* ============================================================
   PRUEBA · el cierre con todos los medios y la caja grande (0095)
   ============================================================

   Corre entera en una transacción que se deshace; si 0095 no está
   aplicada, la carga adentro, como ensayo. Usa Bnitori con la identidad
   de su dueño, para que las funciones controlen el permiso y el comercio
   como desde la pantalla.

     node scripts/probar-caja-grande.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];

await c.query("begin");
try {
  const hay = await una("select count(*) n from pg_proc where proname = 'cerrar_caja'");
  if (hay.n === "0") {
    console.log("\n(0095 no está aplicada: se carga adentro de la transacción, como ensayo)");
    await c.query(readFileSync("supabase/migrations/0095_cierre_y_caja_grande.sql", "utf8"));
  }

  const emp = await una("select id from empresas where nombre = 'Bnitori'");
  const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [emp.id]);
  const ajena = await una("select id from empresas where nombre = 'Super 25'");
  const dueno = await una("select id from perfiles where empresa_id = $1 and rol = 'dueno' limit 1", [emp.id]);

  const comoDueno = async () => {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: dueno.id, role: "authenticated" })]);
  };
  const comoAdmin = async () => { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true)"); };
  const falla = async (sql, args, codigo, texto) => {
    await c.query("savepoint s");
    try { await c.query(sql, args); decir(false, texto); }
    catch (e) { decir(e.code === codigo, `${texto}${e.code === codigo ? "" : ` (dio ${e.code}: ${e.message})`}`); }
    await c.query("rollback to savepoint s");
  };

  /* Medios fijos para la prueba: débito con 8 % de comisión. */
  await c.query(`update empresas set config = jsonb_set(coalesce(config, '{}'::jsonb), '{medios}', $2::jsonb) where id = $1`, [emp.id, JSON.stringify([
    { k: "efectivo", n: "Efectivo", tasa: 0, recargo: false, activo: true },
    { k: "debito", n: "Débito", tasa: 8, recargo: false, activo: true },
    { k: "mp", n: "Mercado Pago", tasa: 0, recargo: false, activo: true },
    { k: "cuenta_corriente", n: "Cuenta corriente", tasa: 0, recargo: false, activo: true },
  ])]);
  /* La caja grande de Bnitori, vacía para la prueba. */
  await c.query("delete from caja_grande where empresa_id = $1", [emp.id]);
  await c.query("update sesiones_caja set cerrada_en = now() where empresa_id = $1 and cerrada_en is null", [emp.id]);
  const ses = await una("insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 1000) returning id", [emp.id, suc.id]);

  const vender = async (medio, monto) => {
    const id = randomUUID();
    await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({
      id, empresa_id: emp.id, sucursal_id: suc.id, sesion_id: ses.id, numero: `PRUEBA-${id.slice(0, 6)}`,
      subtotal: monto, descuento: 0, recargo: 0, total: monto, comprobante: {},
      lineas: [{ item_id: null, descripcion: "Renglón de prueba", cantidad: 1, precio_unitario: monto, costo_unitario: 0, iva: 21, total: monto }],
      pagos: [{ medio, monto }],
    })]);
  };
  await vender("efectivo", 5000);
  await vender("mp", 3000);
  await vender("debito", 2000);
  const saldos = async () => Object.fromEntries((await c.query("select cuenta, saldo from caja_grande_saldos where empresa_id = $1", [emp.id])).rows.map((r) => [r.cuenta, Number(r.saldo)]));

  console.log("\nDel cajón a la caja grande, en el día");
  await comoDueno();
  await c.query("select pasar_a_caja_grande($1, 1500, 'Sobre al mediodía')", [ses.id]);
  await comoAdmin();
  const eg = await una("select tipo, medio, monto, categoria from movimientos_caja where sesion_id = $1 and categoria = 'caja_grande'", [ses.id]);
  decir(eg && eg.tipo === "egreso" && eg.medio === "efectivo" && Number(eg.monto) === 1500, "sale del cajón como egreso en efectivo");
  decir((await saldos()).efectivo === 1500, "y entra al efectivo de la caja grande");

  console.log("\nEl cierre");
  await comoDueno();
  await falla("select cerrar_caja($1, $2::jsonb, 0, null)", [ses.id, JSON.stringify({ mp: 3000 })], "P0020", "sin el efectivo contado no cierra");
  await falla("select cerrar_caja($1, $2::jsonb, 9000, null)", [ses.id, JSON.stringify({ efectivo: 4500 })], "P0020", "un fondo mayor que lo contado no se deja");
  await falla("select cerrar_caja($1, $2::jsonb, 0, null)", [ses.id, JSON.stringify({ efectivo: -1 })], "P0020", "un número negativo no se deja");
  /* Esperado en efectivo: 1000 de apertura + 5000 − 1500 = 4500. Se
     cuentan 4480 (faltan 20) y quedan 1000 de fondo. */
  await c.query("select cerrar_caja($1, $2::jsonb, 1000, 'Prueba')", [ses.id, JSON.stringify({ efectivo: 4480, mp: 3000, debito: 2000 })]);
  await comoAdmin();
  const cerrada = await una("select cerrada_en, cerrada_por, monto_declarado, declarado, fondo_siguiente, notas from sesiones_caja where id = $1", [ses.id]);
  decir(cerrada.cerrada_en && cerrada.cerrada_por === dueno.id && Number(cerrada.monto_declarado) === 4480,
    "la caja queda cerrada, por quién, con el efectivo contado");
  decir(cerrada.declarado.mp === 3000 && cerrada.declarado.debito === 2000 && Number(cerrada.fondo_siguiente) === 1000,
    "guarda lo declarado de cada medio y el fondo para mañana");
  const s1 = await saldos();
  decir(s1.efectivo === 1500 + 3480, `el efectivo menos el fondo pasa a la caja grande (${s1.efectivo})`);
  decir(s1.mp === 3000, `Mercado Pago a su cuenta (${s1.mp})`);
  decir(s1.banco === 2000 - 160, `el débito al banco, menos su comisión estimada del 8 % (${s1.banco})`);
  decir(!!(await una("select 1 x from bitacora where accion = 'caja.cierre' and entidad_id = $1", [ses.id])), "queda en la bitácora");

  await comoDueno();
  await falla("select cerrar_caja($1, $2::jsonb, 0, null)", [ses.id, JSON.stringify({ efectivo: 1 })], "P0025", "no se cierra dos veces");
  await falla("update sesiones_caja set cerrada_en = null where id = $1", [ses.id], "P0026", "el navegador no reabre una caja escribiendo la fila");
  await comoAdmin();
  const abierta = await una("insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 0) returning id", [emp.id, suc.id]);
  await comoDueno();
  await falla("update sesiones_caja set cerrada_en = now(), monto_declarado = 0 where id = $1", [abierta.id], "P0026",
    "una pestaña vieja que cierra escribiendo la fila falla y dice qué hacer, no cierra en silencio");
  await comoAdmin();
  await c.query("update sesiones_caja set cerrada_en = now() where id = $1", [abierta.id]);
  await comoDueno();

  console.log("\nA mano");
  await c.query("select mover_caja_grande($1, 'efectivo', 'egreso', 700, 'pago', 'Coca-Cola, factura 12')", [emp.id]);
  await c.query("select mover_caja_grande($1, 'banco', 'ingreso', 10000, 'aporte', 'Aporte del dueño')", [emp.id]);
  await c.query("select transferir_caja_grande($1, 'efectivo', 'banco', 2000, 'Depósito')", [emp.id]);
  const s2 = await saldos();
  decir(s2.efectivo === 4980 - 700 - 2000 && s2.banco === 1840 + 10000 + 2000, `pago, aporte y depósito mueven los saldos (efectivo ${s2.efectivo}, banco ${s2.banco})`);
  const par = await una("select count(*) n, count(distinct par_id) p from caja_grande where empresa_id = $1 and categoria = 'transferencia'", [emp.id]);
  decir(par.n === "2" && par.p === "1", "un pase son dos movimientos del mismo par");
  await falla("select mover_caja_grande($1, 'efectivo', 'ingreso', 100, 'pago', 'x')", [emp.id], "P0020", "un pago no puede entrar");
  await falla("select mover_caja_grande($1, 'efectivo', 'egreso', 100, 'pago', '  ')", [emp.id], "P0020", "sin detalle no se guarda");
  await falla("select transferir_caja_grande($1, 'banco', 'banco', 100, null)", [emp.id], "P0020", "un pase a la misma cuenta no");
  await falla("select mover_caja_grande($1, 'efectivo', 'egreso', 100, 'pago', 'x')", [ajena.id], "P0021", "no se mueve la caja grande de otro comercio");
  await falla("insert into caja_grande (empresa_id, cuenta, tipo, monto, categoria) values ($1, 'efectivo', 'ingreso', 1, 'aporte')", [emp.id], "42501", "el navegador no escribe la tabla directo");
  await comoAdmin();
  await falla("update caja_grande set monto = 1 where empresa_id = $1", [emp.id], "P0001", "un movimiento no se modifica, ni como administrador");

  console.log("\nSin el permiso de la caja grande");
  await c.query("update perfiles set permisos = coalesce(permisos, '{}'::jsonb) || '{\"cajaGrande\": false}' where id = $1", [dueno.id]);
  await comoDueno();
  decir((await una("select count(*) n from caja_grande where empresa_id = $1", [emp.id])).n === "0", "no ve ningún movimiento");
  decir((await una("select count(*) n from caja_grande_saldos where empresa_id = $1", [emp.id])).n === "0", "ni los saldos");
  await falla("select mover_caja_grande($1, 'efectivo', 'egreso', 100, 'retiro', 'x')", [emp.id], "P0021", "no mueve");
  await comoAdmin();
  const ses2 = await una("insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 0) returning id", [emp.id, suc.id]);
  await comoDueno();
  await c.query("select pasar_a_caja_grande($1, 300, null)", [ses2.id]);
  decir(true, "pero puede pasar efectivo del cajón, como un retiro");
  await comoAdmin();

  console.log("\nSin el permiso de cerrar");
  await c.query("update perfiles set permisos = coalesce(permisos, '{}'::jsonb) || '{\"cerrarCaja\": false}' where id = $1", [dueno.id]);
  await comoDueno();
  await falla("select cerrar_caja($1, $2::jsonb, 0, null)", [ses2.id, JSON.stringify({ efectivo: 0 })], "P0021", "no cierra");
  await comoAdmin();
} catch (e) {
  decir(false, `caja grande: ${e.message}`);
} finally {
  await c.query("rollback");
}

await c.end();
console.log(fallas ? `\n${fallas} fallaron.` : "\nTodo bien. Nada quedó en la base.");
process.exitCode = fallas ? 1 : 0;
