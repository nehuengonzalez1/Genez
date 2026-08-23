/* ============================================================
   PRUEBA · la comanda
   ============================================================

   Lo que se verifica es lo que hace que una cuenta cierre: que dividir
   no parta la operación, que nadie pueda cobrar de más, que el cierre no
   vuelva a cobrar lo ya pagado, y que sacar un plato de una cuenta deje
   asiento.

   Deja la base como la encontró.

     node scripts/probar-comanda.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
/* Desde cuándo corre esta prueba, según el reloj de la base y no el de
   Node. Lo usa la limpieza del final para borrar de la bitácora solo lo
   que escribió esta corrida.

   Antes se borraba por acción —o directamente entera— y eso se llevaba
   puesto el registro de los tres comercios. Daba igual mientras nadie la
   leyera; desde que la auditoría tiene pantalla, es destruir un dato
   real cada vez que alguien corre las pruebas. */
const arranque = (await c.query("select now() as t")).rows[0].t;

const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];
let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

const MARCA = "PRUEBA-COM";
await c.query(`delete from movimientos_caja  where operacion_id in (select id from operaciones where referencia like '${MARCA}%')`);
await c.query(`delete from movimientos_stock where operacion_id in (select id from operaciones where referencia like '${MARCA}%')`);
await c.query(`delete from operaciones where referencia like '${MARCA}%'`);

const bar = await una("select id from empresas where nombre = 'Bar Rivadavia'");
if (!bar) { console.log("Sin Bar Rivadavia cargado."); await c.end(); process.exit(1); }
const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [bar.id]);
const plato = await una("select id, nombre, precio, costo from items where empresa_id = $1 and controla_stock = false limit 1", [bar.id]);

const sesion = await una(
  "insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 10000) returning id", [bar.id, suc.id]);

const comanda = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify({
  empresa_id: bar.id, sucursal_id: suc.id, canal: "mostrador", referencia: `${MARCA}-1`,
})]);

const cargar = (cant) => c.query(
  `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
     precio_unitario, costo_unitario, total, destino)
   values ($1,$2,$3,$4,$5::numeric,$6::numeric,$7::numeric,$6::numeric * $5::numeric,'cocina') returning id`,
  [comanda.id, bar.id, plato.id, plato.nombre, cant, plato.precio, plato.costo]);

const l1 = (await cargar(2)).rows[0];
const l2 = (await cargar(1)).rows[0];
const total = Number(plato.precio) * 3;

const cuenta = () => una("select subtotal::int, total::int, pagado::int, saldo::int from cuenta_vista where id = $1", [comanda.id]);

/* ------------------------------------------------------------
   1 · La observación y la cuenta
   ------------------------------------------------------------ */
console.log("\nLa cuenta");

await c.query("update operaciones set observacion = 'Cliente alérgico' where id = $1", [comanda.id]);
const obs = await una("select observacion from cuenta_vista where id = $1", [comanda.id]);
decir(obs.observacion === "Cliente alérgico", "la observación viaja con la cuenta, no en un campo suelto");

let v = await cuenta();
decir(v.total === total && v.pagado === 0 && v.saldo === total,
  `arranca debiendo todo (${v.total}, pagado ${v.pagado})`);

/* ------------------------------------------------------------
   2 · Dividir sin partir la operación
   ------------------------------------------------------------ */
console.log("\nDividir la cuenta");

const parte = Math.round(total / 3);
await c.query("select registrar_pago($1, $2, 'efectivo', $3, null, 'Parte 1/3')", [comanda.id, sesion.id, parte]);
await c.query("select registrar_pago($1, $2, 'debito', $3, null, 'Parte 2/3')", [comanda.id, sesion.id, parte]);

v = await cuenta();
decir(v.pagado === parte * 2, `dos pagos parciales suman (${v.pagado})`);
decir(v.saldo === total - parte * 2, `y el saldo baja (${v.saldo})`);

const cuantas = await una(
  "select count(*) n from operaciones where empresa_id = $1 and referencia like $2", [bar.id, `${MARCA}%`]);
decir(cuantas.n === "1", "sigue habiendo una sola comanda, no tres");

const enCaja = await una(
  "select count(*) n, sum(monto)::int total from movimientos_caja where operacion_id = $1", [comanda.id]);
decir(enCaja.n === "2" && enCaja.total === parte * 2, "cada parte entró a la caja por separado");

try {
  await c.query("select registrar_pago($1, $2, 'efectivo', $3)", [comanda.id, sesion.id, total]);
  decir(false, "no deja cobrar más de lo que falta");
} catch (e) {
  decir(e.code === "P0014", "no deja cobrar más de lo que falta");
}

/* Sin caja abierta no hay pago parcial que valga: entraría plata que
   ningún arqueo ve. */
try {
  await c.query("select registrar_pago($1, null, 'efectivo', 100)", [comanda.id]);
  decir(false, "exige caja abierta igual que el cobro entero");
} catch (e) {
  decir(e.code === "P0001", "exige caja abierta igual que el cobro entero");
}

/* ------------------------------------------------------------
   3 · Cerrar cobrando solo el saldo
   ------------------------------------------------------------ */
console.log("\nCerrar");

const saldo = (await cuenta()).saldo;
await c.query("select cerrar_comanda($1, $2, $3::jsonb, $4)", [
  comanda.id, sesion.id, JSON.stringify([{ medio: "efectivo", monto: saldo }]), `${MARCA}-C`,
]);

v = await cuenta();
decir(v.pagado === total, `entre todos los pagos suman la cuenta y ni un peso más (${v.pagado} de ${total})`);
decir(v.saldo === 0, "no queda saldo");

const cerrada = await una("select estado, estado_pedido, total::int from operaciones where id = $1", [comanda.id]);
decir(cerrada.estado === "confirmada" && cerrada.estado_pedido === "completado", "queda cobrada y completada");
decir(cerrada.total === total, "y el total guardado es el de las líneas");

const cajaFinal = await una("select count(*) n, sum(monto)::int total from movimientos_caja where operacion_id = $1", [comanda.id]);
decir(cajaFinal.total === total, `la caja recibió el total una sola vez (${cajaFinal.total})`);

/* ------------------------------------------------------------
   4 · Lo que se saca de una cuenta queda escrito
   ------------------------------------------------------------ */
console.log("\nAuditoría");

const otra = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify({
  empresa_id: bar.id, sucursal_id: suc.id, canal: "mostrador", referencia: `${MARCA}-2`,
})]);
const l3 = (await una(
  `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
     precio_unitario, costo_unitario, total) values ($1,$2,$3,$4,3,$5::numeric,$6::numeric,$5::numeric * 3) returning id`,
  [otra.id, bar.id, plato.id, plato.nombre, plato.precio, plato.costo]));

await c.query("update operacion_lineas set cantidad = 1, total = $2::numeric where id = $1", [l3.id, plato.precio]);
await c.query("update operacion_lineas set estado = 'anulada' where id = $1", [l3.id]);

const asientos = (await c.query(
  "select accion from bitacora where entidad_id = $1 order by fecha", [l3.id])).rows.map((r) => r.accion);
decir(asientos.includes("comanda.bajar_cantidad"), "bajar una cantidad deja asiento");
decir(asientos.includes("comanda.anular_linea"), "sacar un plato de la cuenta deja asiento");

await c.query("select aplicar_descuento($1, 10, null)", [otra.id]);
const desc = await una(
  "select detalle from bitacora where entidad_id = $1 and accion = 'comanda.descuento'", [otra.id]);
decir(desc && Number(desc.detalle.porcentaje) === 10, "un descuento también, con su porcentaje");

/* ------------------------------------------------------------
   Limpieza
   ------------------------------------------------------------ */
for (const id of [comanda.id, otra.id]) {
  await c.query("delete from movimientos_stock where operacion_id = $1", [id]);
  await c.query("delete from movimientos_caja  where operacion_id = $1", [id]);
  await c.query("delete from operaciones where id = $1", [id]);
}
await c.query("delete from sesiones_caja where id = $1", [sesion.id]);
await c.query("delete from bitacora where fecha >= $1", [arranque]);

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien. Base como estaba.");
await c.end();
process.exitCode = fallas ? 1 : 0;

