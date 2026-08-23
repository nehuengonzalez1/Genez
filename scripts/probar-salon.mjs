/* ============================================================
   PRUEBA · el mapa de mesas
   ============================================================

   Lo que se verifica es que el color de una mesa siga al servicio y no
   a un click: que pase por sus cinco estados sola, empujada por la
   comanda, la cocina y la caja, y que la reserva se convierta en una
   mesa abierta sin quedar a medias.

   Deja la base como la encontró.

     node scripts/probar-salon.mjs
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

const bar = await una("select id from empresas where nombre = 'Bar Rivadavia'");
if (!bar) { console.log("Sin Bar Rivadavia cargado."); await c.end(); process.exit(1); }
const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [bar.id]);
const plato = await una("select id, nombre, precio, costo from items where empresa_id = $1 and controla_stock = false limit 1", [bar.id]);

/* Una mesa que nadie esté usando, para no pisarle el servicio a otra
   prueba ni a una comanda de verdad. */
const mesa = await una(`
  select r.id, r.nombre from recursos r
  where r.empresa_id = $1 and r.tipo = 'mesa' and r.unida_a is null
    and not exists (select 1 from operaciones o where o.recurso_id = r.id and o.estado = 'abierta')
  order by r.orden limit 1`, [bar.id]);

if (!mesa) { console.log("No hay ninguna mesa libre para probar."); await c.end(); process.exit(1); }

const sesion = await una(
  "insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 10000) returning id", [bar.id, suc.id]);

const estado = async () => (await una("select estado from salon_vista where id = $1", [mesa.id])).estado;
const limpiar = [];

/* ------------------------------------------------------------
   1 · La reserva se convierte en mesa abierta
   ------------------------------------------------------------ */
console.log(`\nLa reserva (${mesa.nombre})`);

decir(await estado() === "libre", "la mesa arranca libre");

const reserva = await una(
  `insert into reservas (empresa_id, sucursal_id, recurso_id, nombre, personas, desde)
   values ($1, $2, $3, 'Prueba Salón', 4, now() + interval '10 minutes') returning id`,
  [bar.id, suc.id, mesa.id]);

decir(await estado() === "reservada", "con una reserva próxima se pinta reservada");

const comanda = await una("select sentar_reserva($1) id", [reserva.id]);
limpiar.push(comanda.id);

const sentada = await una("select estado, operacion_id from reservas where id = $1", [reserva.id]);
decir(sentada.estado === "sentada" && sentada.operacion_id === comanda.id,
  "sentarla abre la mesa y ata la reserva a esa comanda");

const gente = await una("select comensales from operaciones where id = $1", [comanda.id]);
decir(Number(gente.comensales) === 4, "y la comanda arranca con la gente que había reservado");

decir(await estado() === "ocupada", "la mesa queda ocupada");

/* ------------------------------------------------------------
   2 · El color sigue al servicio
   ------------------------------------------------------------ */
console.log("\nLos cinco estados");

await c.query(
  `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
     precio_unitario, costo_unitario, total, destino)
   values ($1,$2,$3,$4,2,$5::numeric,$6::numeric,$5::numeric * 2,'cocina')`,
  [comanda.id, bar.id, plato.id, plato.nombre, plato.precio, plato.costo]);

decir(await estado() === "ocupada", "cargar platos no la cambia: sigue ocupada");

await c.query("select enviar_a_cocina($1)", [comanda.id]);
decir(await estado() === "ocupada", "mandarlos a la cocina tampoco");

await c.query("update operacion_lineas set estado = 'listo', lista_en = now() where operacion_id = $1", [comanda.id]);
decir(await estado() === "entregar", "cuando la cocina termina, pasa a por entregar");

const cuenta = await una("select total::int from cuenta_vista where id = $1", [comanda.id]);
await c.query("select registrar_pago($1, $2, 'efectivo', $3::numeric, null, 'prueba')",
  [comanda.id, sesion.id, cuenta.total]);

decir(await estado() === "cuenta", `pagando toda la cuenta pasa a cuenta/pagada (${cuenta.total})`);

await c.query("select cerrar_comanda($1, $2, '[]'::jsonb, $3)", [comanda.id, sesion.id, "PRUEBA-SALON"]);
decir(await estado() === "libre", "y al cerrarla la mesa vuelve a estar libre");

/* ------------------------------------------------------------
   3 · Lo que queda escrito
   ------------------------------------------------------------ */
console.log("\nAuditoría");

const asientos = (await c.query(
  "select accion from bitacora where entidad_id = $1 order by fecha", [reserva.id])).rows.map((r) => r.accion);
decir(asientos.includes("reserva.crear"), "queda quién tomó la reserva");
decir(asientos.includes("reserva.sentada"), "y quién la sentó");

/* ------------------------------------------------------------
   Limpieza
   ------------------------------------------------------------ */
for (const id of limpiar) {
  await c.query("delete from movimientos_stock where operacion_id = $1", [id]);
  await c.query("delete from movimientos_caja  where operacion_id = $1", [id]);
  await c.query("delete from reservas where operacion_id = $1", [id]);
  await c.query("delete from operaciones where id = $1", [id]);
}
await c.query("delete from reservas where id = $1", [reserva.id]);
await c.query("delete from sesiones_caja where id = $1", [sesion.id]);
await c.query("delete from bitacora where fecha >= $1", [arranque]);

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien. Base como estaba.");
await c.end();
process.exitCode = fallas ? 1 : 0;

