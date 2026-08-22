/* ============================================================
   PRUEBA · el centro de pedidos
   ============================================================

   Lo que se verifica es que el estado del pedido sea una cosa real y no
   una tarjeta que se mueve en pantalla: que el flujo dependa del canal,
   que las líneas acompañen, que quede historial y que completar sea
   cobrar.

   Deja la base como la encontró.

     node scripts/probar-pedidos.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];
const hechos = [];
let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* Lo que quedó de una corrida cortada a la mitad ensucia los conteos:
   las estadísticas contarían pedidos de prueba viejos como si fueran de
   hoy. Se los marca con una referencia propia para poder barrerlos. */
const MARCA = "PRUEBA-PED";
async function barrer() {
  const cond = `referencia like '${MARCA}%'`;
  await c.query(`delete from movimientos_stock where operacion_id in (select id from operaciones where ${cond})`);
  await c.query(`delete from movimientos_caja  where operacion_id in (select id from operaciones where ${cond})`);
  const r = await c.query(`delete from operaciones where ${cond}`);
  if (r.rowCount) console.log(`\n(se limpiaron ${r.rowCount} pedidos de una corrida anterior)`);
}
await barrer();

const bar = await una("select id from empresas where nombre = 'Bar Rivadavia'");
if (!bar) {
  console.log("Sin Bar Rivadavia cargado. Corré la semilla de gastronomía primero.");
  await c.end();
  process.exit(1);
}
const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [bar.id]);
const plato = await una("select id, nombre, precio, costo from items where empresa_id = $1 and controla_stock = false limit 1", [bar.id]);
const bebida = await una(
  "select i.id, i.nombre, i.precio, i.costo, v.stock from items i join items_vista v on v.id = i.id where i.empresa_id = $1 and i.controla_stock limit 1",
  [bar.id]
);

async function pedido(canal, n = 1) {
  const o = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify({
    empresa_id: bar.id, sucursal_id: suc.id, canal, referencia: `${MARCA}-${hechos.length + 1}`,
  })]);
  hechos.push(o.id);
  for (let i = 0; i < n; i++) {
    const it = i % 2 === 0 ? plato : bebida;
    await c.query(
      `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
         precio_unitario, costo_unitario, total, destino)
       values ($1,$2,$3,$4,1,$5,$6,$5,'cocina')`,
      [o.id, bar.id, it.id, it.nombre, it.precio, it.costo]);
  }
  return o.id;
}

const mover = (id, estado, motivo = null) =>
  c.query("select mover_pedido($1, $2, $3)", [id, estado, motivo]);

const lee = (id) => una("select * from pedidos_vista where id = $1", [id]);
const cuantas = async (id, estado) =>
  Number((await una("select count(*) n from operacion_lineas where operacion_id = $1 and estado = $2", [id, estado])).n);

/* ------------------------------------------------------------
   1 · Nace pendiente y el canal decide por dónde puede pasar
   ------------------------------------------------------------ */
console.log("\nEl estado es del pedido, no de sus líneas");

const mostrador = await pedido("mostrador", 2);
let v = await lee(mostrador);
decir(v.estado_pedido === "pendiente", "un pedido nace pendiente");
decir(Number(v.renglones) === 2 && v.detalle.length === 2, "la vista trae sus platos para la tarjeta");
decir(Number(v.total) === Number(plato.precio) + Number(bebida.precio), `y el total de lo cargado (${v.total})`);

const h0 = await una("select count(*) n from pedido_estados where operacion_id = $1", [mostrador]);
decir(h0.n === "1", "y deja su primera línea de historial");

try {
  await mover(mostrador, "en_camino");
  decir(false, "mostrador no pasa por 'en camino'");
} catch (e) {
  decir(e.code === "P0013", "mostrador no pasa por 'en camino'");
}

/* ------------------------------------------------------------
   2 · Mover el pedido mueve la cocina
   ------------------------------------------------------------ */
console.log("\nEl tablero y la cocina son la misma cosa");

decir(await cuantas(mostrador, "borrador") === 2, "lo cargado todavía no salió a la cocina");

await mover(mostrador, "en_preparacion");
decir(await cuantas(mostrador, "preparando") === 2, "ponerlo en preparación lo despacha");

await mover(mostrador, "listo");
decir(await cuantas(mostrador, "listo") === 2, "marcarlo listo marca sus platos");

v = await lee(mostrador);
decir(v.estado_pedido === "listo" && v.estado_desde != null, "y se sabe desde cuándo está listo");

try {
  await mover(mostrador, "completado");
  decir(false, "no se completa un pedido sin cobrarlo");
} catch (e) {
  decir(e.code === "P0012", "no se completa un pedido sin cobrarlo");
}

/* ------------------------------------------------------------
   3 · Completar es cobrar
   ------------------------------------------------------------ */
console.log("\nCompletar es cobrar");

const sesion = await una(
  "insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 10000) returning id",
  [bar.id, suc.id]);

const total = Number(plato.precio) + Number(bebida.precio);
await c.query("select cerrar_comanda($1, $2, $3::jsonb, $4)", [
  mostrador, sesion.id, JSON.stringify([{ medio: "efectivo", monto: total }]), `${MARCA}-C`,
]);

v = await lee(mostrador);
decir(v.estado_pedido === "completado", "cobrarlo lo completa");

const partes = await una(`
  select (select count(*) from pagos             where operacion_id = $1) pagos,
         (select count(*) from movimientos_caja  where operacion_id = $1) caja,
         (select count(*) from movimientos_stock where operacion_id = $1) stock`, [mostrador]);
decir(partes.pagos === "1" && partes.caja === "1", "la plata entra por la caja de siempre");
decir(partes.stock === "1", "y descuenta solo lo que lleva stock");

const hist = (await c.query(
  "select estado from pedido_estados where operacion_id = $1 order by fecha, estado", [mostrador])).rows.map((r) => r.estado);
decir(hist.length === 4 && hist[3] === "completado",
  `el historial guarda las cuatro etapas (${hist.join(" → ")})`);

try {
  await mover(mostrador, "listo");
  decir(false, "un pedido cobrado ya no se mueve");
} catch (e) {
  decir(e.code === "P0011", "un pedido cobrado ya no se mueve");
}

/* ------------------------------------------------------------
   4 · Otro canal, otro flujo
   ------------------------------------------------------------ */
console.log("\nCada canal con su recorrido");

const ya = await pedido("pedidosya", 1);
await mover(ya, "en_preparacion");
await mover(ya, "listo");
await mover(ya, "en_camino");
v = await lee(ya);
decir(v.estado_pedido === "en_camino", "un pedido de PedidosYa sí sale a la calle");
decir(v.externo === true && v.canal_nombre === "PedidosYa", "y se sabe que el número lo puso otro");

/* Volver atrás es parte del trabajo: la cocina marca listo el pedido
   equivocado más seguido de lo que a nadie le gustaría. */
await mover(ya, "en_preparacion");
decir((await lee(ya)).estado_pedido === "en_preparacion", "se puede volver atrás cuando alguien se equivoca");

/* ------------------------------------------------------------
   5 · Cancelar
   ------------------------------------------------------------ */
console.log("\nCancelar");

const muerto = await pedido("delivery", 2);
await mover(muerto, "en_preparacion");
await mover(muerto, "cancelado", "El cliente no atendió el teléfono");

v = await lee(muerto);
decir(v.estado_pedido === "cancelado" && v.estado === "cancelada", "queda cancelado y cerrado");
decir(await cuantas(muerto, "anulada") === 2, "sus líneas se anulan, no se borran");

const porque = await una(
  "select motivo from pedido_estados where operacion_id = $1 and estado = 'cancelado'", [muerto]);
decir(porque.motivo === "El cliente no atendió el teléfono", "y queda escrito por qué");

/* ------------------------------------------------------------
   6 · Las estadísticas salen del historial
   ------------------------------------------------------------ */
console.log("\nEstadísticas");

const e = await una("select estadisticas_pedidos($1, now() - interval '1 day', now() + interval '1 day') d", [bar.id]);
const d = e.d;
decir(d.pedidos >= 3, `cuenta los pedidos del período (${d.pedidos})`);
decir(d.cancelados >= 1, `y los cancelados aparte (${d.cancelados})`);
decir(Number(d.ventas) >= total, `suma solo lo cobrado (${d.ventas})`);
decir(Array.isArray(d.por_canal) && d.por_canal.some((x) => x.canal === "pedidosya"),
  "abre por canal con el nombre que ve el comercio");
decir(d.minutos_preparacion !== null, "y sabe cuánto tardó la cocina");

/* ------------------------------------------------------------
   Limpieza
   ------------------------------------------------------------ */
for (const id of hechos) {
  await c.query("delete from movimientos_stock where operacion_id = $1", [id]);
  await c.query("delete from movimientos_caja  where operacion_id = $1", [id]);
  await c.query("delete from operaciones where id = $1", [id]);
}
await c.query("delete from sesiones_caja where id = $1", [sesion.id]);
await c.query("delete from bitacora where accion = 'pedido.estado'");

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien. Base como estaba.");
await c.end();
process.exitCode = fallas ? 1 : 0;
