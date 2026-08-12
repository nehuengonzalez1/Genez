import { readFileSync } from "node:fs";
import pg from "pg";
import { randomUUID } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

const { rows: [emp] } = await c.query("select id from empresas where nombre = 'Super 25'");
const { rows: [suc] } = await c.query("select id from sucursales where empresa_id = $1 limit 1", [emp.id]);
const { rows: [p] } = await c.query(
  "select i.id, i.nombre, i.costo, i.precio, v.stock from items i join items_vista v on v.id = i.id where v.stock > 10 limit 1"
);

console.log(`Producto: ${p.nombre}`);
console.log(`Stock antes: ${p.stock}`);

const ventaId = randomUUID();
const venta = {
  id: ventaId,
  empresa_id: emp.id,
  sucursal_id: suc.id,
  numero: "PRUEBA-0001",
  subtotal: Number(p.precio) * 3,
  total: Number(p.precio) * 3,
  lineas: [{
    item_id: p.id, descripcion: p.nombre, cantidad: 3,
    precio_unitario: Number(p.precio), costo_unitario: Number(p.costo),
    iva: 21, total: Number(p.precio) * 3,
  }],
  pagos: [
    { medio: "efectivo", monto: Number(p.precio) * 2 },
    { medio: "debito", monto: Number(p.precio) },
  ],
};

await c.query("select registrar_venta($1::jsonb)", [JSON.stringify(venta)]);
console.log("\nVenta registrada.");

const chequear = async (etiqueta) => {
  const { rows: [r] } = await c.query(`
    select
      (select count(*) from operaciones      where id = $1)           as operaciones,
      (select count(*) from operacion_lineas where operacion_id = $1) as lineas,
      (select count(*) from pagos            where operacion_id = $1) as pagos,
      (select count(*) from movimientos_stock where operacion_id = $1) as mov_stock,
      (select count(*) from movimientos_caja  where operacion_id = $1) as mov_caja,
      (select stock from items_vista where id = $2)                   as stock
  `, [ventaId, p.id]);
  console.log(`${etiqueta}  op:${r.operaciones} lineas:${r.lineas} pagos:${r.pagos} stock:${r.mov_stock} caja:${r.mov_caja} → stock queda en ${r.stock}`);
  return r;
};

const a = await chequear("Después de vender: ");

console.log("\nReintentando la misma venta (simula que se perdió la respuesta)…");
await c.query("select registrar_venta($1::jsonb)", [JSON.stringify(venta)]);
const b = await chequear("Después del reintento:");

const duplico = ["operaciones", "lineas", "pagos", "mov_stock", "mov_caja"].some((k) => a[k] !== b[k]);
console.log(duplico ? "\nFALLA: el reintento duplicó filas." : "\nOK: el reintento no duplicó nada.");

console.log(`\nStock: ${p.stock} → ${b.stock} (esperado ${Number(p.stock) - 3})`);
console.log(Number(b.stock) === Number(p.stock) - 3 ? "OK: descontó bien." : "FALLA: el stock no cuadra.");

/* Limpieza: la venta de prueba no queda en la base.
   Los asientos van primero y a mano. Las tablas de libro están
   declaradas con `on delete set null`, no en cascada: borrar el
   comprobante no borra el movimiento, justamente para que nadie pueda
   hacer desaparecer un asiento borrando la venta que lo originó. */
await c.query("delete from movimientos_stock where operacion_id = $1", [ventaId]);
await c.query("delete from movimientos_caja  where operacion_id = $1", [ventaId]);
await c.query("delete from operaciones       where id = $1", [ventaId]);
const { rows: [fin] } = await c.query("select stock from items_vista where id = $1", [p.id]);
console.log(`\nLimpieza hecha. Stock vuelve a ${fin.stock}.`);

await c.end();
