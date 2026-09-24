/* ============================================================
   PRUEBA · la cuenta corriente (0075 y 0085)
   ============================================================

   Todo corre como un usuario de verdad —Axel, dueño de Super 25— con
   `set local role authenticated`, así que las políticas y `permiso()` se
   aplican igual que desde el navegador. La parte del cajero cambia el rol
   de Axel adentro de la misma transacción. Nada queda escrito: todo
   termina en rollback.

     node scripts/probar-cuenta-corriente.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];
let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* Corre `hacer` y devuelve el mensaje si Postgres lo rechazó, o null. */
async function falla(hacer) {
  await c.query("savepoint p");
  try { await hacer(); await c.query("release savepoint p"); return null; }
  catch (e) { await c.query("rollback to savepoint p"); return e.message; }
}

const axel = await una("select id from auth.users where email = 'axel@super25.com'");
const SUPER = await una("select id from empresas where nombre = 'Super 25'");
const OTRO = await una("select id from empresas where nombre = 'Bnitori'");
if (!axel || !SUPER) { console.log("Falta Axel o Super 25."); process.exit(1); }

const comoAxel = async () => {
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: axel.id, role: "authenticated" })]);
};
/* Sin identidad: si quedara la de Axel, la regla de 0048 (nadie se toca
   el rol a sí mismo) frenaría el cambio de rol de la prueba, con razón. */
const comoAdmin = async () => {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', '', true)");
};
const saldo = async (cli) => Number((await una("select saldo_cliente($1) s", [cli])).s);

await c.query("begin");
try {
  /* --- Preparación, como administrador --- */
  const { id: cli } = await una("insert into clientes (empresa_id, razon_social, tel) values ($1, 'Doña Prueba', '11 5555 5555') returning id", [SUPER.id]);
  const { id: ajeno } = await una("insert into clientes (empresa_id, razon_social) values ($1, 'Cliente de otro comercio') returning id", [OTRO.id]);
  const { id: caja } = await una("insert into sesiones_caja (empresa_id, abierta_en, monto_inicial) values ($1, now(), 0) returning id", [SUPER.id]);
  const { id: cerrada } = await una("insert into sesiones_caja (empresa_id, abierta_en, cerrada_en, monto_inicial) values ($1, now() - interval '1 day', now() - interval '20 hours', 0) returning id", [SUPER.id]);

  const venta = async (cliente, monto, tipo = "venta", estado = "confirmada") => {
    const id = randomUUID();
    await c.query("insert into operaciones (id, empresa_id, tipo, estado, total, cliente_id, numero) values ($1, $2, $3, $4, $5, $6, 'P-1')",
      [id, SUPER.id, tipo, estado, monto, cliente]);
    return id;
  };

  console.log("\nFiar");
  const v1 = await venta(cli, 10000);
  await c.query("insert into pagos (operacion_id, empresa_id, medio, monto) values ($1, $2, 'cuenta_corriente', 10000)", [v1, SUPER.id]);
  decir((await saldo(cli)) === 10000, "una venta fiada suma al saldo");

  const sinCliente = await venta(null, 500);
  decir(/necesita un cliente/.test(await falla(() => c.query("insert into pagos (operacion_id, empresa_id, medio, monto) values ($1, $2, 'cuenta_corriente', 500)", [sinCliente, SUPER.id])) || ""),
    "un fiado sin cliente no entra, venga de donde venga");
  const comanda = await venta(cli, 800, "comanda", "abierta");
  decir(/al cerrar la cuenta/.test(await falla(() => c.query("insert into pagos (operacion_id, empresa_id, medio, monto) values ($1, $2, 'cuenta_corriente', 400)", [comanda, SUPER.id])) || ""),
    "en una comanda abierta no se fía como pago parcial");

  console.log("\nCobrar (como Axel, dueño)");
  await comoAxel();
  decir(/más de lo que debe/.test(await falla(() => c.query("select registrar_pago_cuenta_corriente($1, $2, 20000, 'efectivo', null)", [cli, caja])) || ""),
    "no se cobra más de lo que debe");
  decir(/ya fue cerrada/.test(await falla(() => c.query("select registrar_pago_cuenta_corriente($1, $2, 1000, 'efectivo', null)", [cli, cerrada])) || ""),
    "con la caja cerrada no se cobra");
  decir(/con plata/.test(await falla(() => c.query("select registrar_pago_cuenta_corriente($1, $2, 1000, 'cuenta_corriente', null)", [cli, caja])) || ""),
    "una deuda no se paga con más fiado");
  decir(/No existe ese cliente/.test(await falla(() => c.query("select registrar_pago_cuenta_corriente($1, $2, 100, 'efectivo', null)", [ajeno, caja])) || ""),
    "no se le cobra a un cliente de otro comercio");

  const { registrar_pago_cuenta_corriente: pago } = await una("select registrar_pago_cuenta_corriente($1, $2, 3000, 'transferencia', 'pagó la quincena')", [cli, caja]);
  decir((await saldo(cli)) === 7000, "un pago parcial baja el saldo: debe 7.000");
  const mov = await una("select m.tipo, m.medio, m.monto, m.sesion_id from cuenta_corriente_pagos p join movimientos_caja m on m.id = p.movimiento_id where p.id = $1", [pago]);
  decir(mov && mov.tipo === "ingreso" && mov.medio === "transferencia" && Number(mov.monto) === 3000 && mov.sesion_id === caja,
    "el pago entra a la caja abierta y queda enlazado a su movimiento");

  decir(!!(await falla(() => c.query("delete from cuenta_corriente_pagos where id = $1", [pago]))) ||
        (await una("select count(*)::int n from cuenta_corriente_pagos where id = $1", [pago])).n === 1,
    "un pago no se puede borrar desde el navegador");
  decir(!!(await falla(() => c.query("insert into cuenta_corriente_pagos (empresa_id, cliente_id, monto) values ($1, $2, 99999)", [SUPER.id, cli]))),
    "ni cargar uno a mano, salteando la función");

  console.log("\nAnular y ajustar (dueño)");
  decir(/Escribí por qué/.test(await falla(() => c.query("select anular_pago_cuenta_corriente($1, $2, '  ')", [pago, caja])) || ""),
    "anular sin motivo no se puede");
  await c.query("select anular_pago_cuenta_corriente($1, $2, 'se cargó en el cliente equivocado')", [pago, caja]);
  decir((await saldo(cli)) === 10000, "anular el pago devuelve la deuda: debe 10.000 otra vez");
  const eg = await una("select count(*)::int n from movimientos_caja where sesion_id = $1 and tipo = 'egreso' and medio = 'transferencia' and monto = 3000", [caja]);
  decir(eg.n === 1, "y saca la plata de la caja con un egreso del mismo medio");
  const bit = await una("select count(*)::int n from bitacora where entidad_id = $1 and accion = 'anular_pago_cuenta_corriente'", [pago]);
  decir(bit.n === 1, "queda en la bitácora");
  decir(/ya está anulado/.test(await falla(() => c.query("select anular_pago_cuenta_corriente($1, $2, 'otra vez')", [pago, caja])) || ""),
    "un pago anulado no se anula dos veces");

  const { ajustar_cuenta_corriente: cargo } = await una("select ajustar_cuenta_corriente($1, 'cargo', 2500, 'saldo del cuaderno al 24/09')", [cli]);
  decir((await saldo(cli)) === 12500, "un cargo manual suma: 12.500");
  await c.query("select ajustar_cuenta_corriente($1, 'descuento', 500, 'redondeo')", [cli]);
  decir((await saldo(cli)) === 12000, "un descuento resta: 12.000");
  await c.query("select anular_ajuste_cuenta_corriente($1, 'era de otro cliente')", [cargo]);
  decir((await saldo(cli)) === 9500, "anular el cargo lo saca: 9.500");
  decir(/el motivo/.test(await falla(() => c.query("select ajustar_cuenta_corriente($1, 'cargo', 100, '')", [cli])) || ""),
    "un ajuste sin motivo no entra");

  await c.query("update clientes set limite_credito = 15000 where id = $1", [cli]);
  decir(Number((await una("select limite_credito l from clientes where id = $1", [cli])).l) === 15000, "el dueño fija el límite");

  const est = (await c.query("select * from estado_de_cuenta($1)", [cli])).rows;
  decir(est.length === 4 && est.filter((m) => m.anulado).length === 2,
    `el estado de cuenta tiene todo, lo anulado marcado (${est.length} movimientos, ${est.filter((m) => m.anulado).length} anulados)`);
  const suma = est.filter((m) => !m.anulado).reduce((s, m) => s + Number(m.debe) - Number(m.haber), 0);
  decir(suma === 9500, "y lo que no está anulado suma el saldo");

  const d = (await c.query("select * from deudores($1)", [SUPER.id])).rows.find((x) => x.cliente_id === cli);
  decir(d && Number(d.saldo) === 9500 && Number(d.limite) === 15000, "aparece en la lista de deudores con su saldo y su límite");
  decir(!(await c.query("select * from deudores($1)", [SUPER.id])).rows.some((x) => x.cliente_id === ajeno),
    "y no aparecen clientes de otro comercio");
  const r = await una("select * from resumen_cuenta_corriente($1, now() - interval '1 hour', now() + interval '1 hour')", [SUPER.id]);
  decir(Number(r.fiado) === 10000 && Number(r.cobrado) === 0 && Number(r.cargos) === 0 && Number(r.descuentos) === 500,
    `el resumen del día: fiado 10.000, cobrado 0 (el anulado no cuenta), descuentos 500`);

  console.log("\nComo cajero");
  await comoAdmin();
  await c.query("update perfiles set rol = 'cajero' where id = $1", [axel.id]);
  await comoAxel();
  decir(/permiso de ajustar/.test(await falla(() => c.query("select ajustar_cuenta_corriente($1, 'descuento', 1000, 'porque sí')", [cli])) || ""),
    "el cajero no puede perdonar deuda");
  const { registrar_pago_cuenta_corriente: pago2 } = await una("select registrar_pago_cuenta_corriente($1, $2, 1500, 'efectivo', null)", [cli, caja]);
  decir((await saldo(cli)) === 8000, "pero sí cobrar: es tarea de mostrador");
  decir(/permiso de ajustar/.test(await falla(() => c.query("select anular_pago_cuenta_corriente($1, $2, 'me equivoqué')", [pago2, caja])) || ""),
    "y no puede anular un pago");
  decir(/límite de crédito/.test(await falla(() => c.query("update clientes set limite_credito = 999999 where id = $1", [cli])) || ""),
    "ni subirle el límite a un cliente");
  const tel = await falla(() => c.query("update clientes set tel = '11 4444 4444' where id = $1", [cli]));
  decir(!tel, "pero sí editar el resto de la ficha");
} catch (e) {
  decir(false, `error inesperado: ${e.message}`);
} finally {
  await c.query("rollback");
}

await c.end();
console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exit(fallas ? 1 : 0);
