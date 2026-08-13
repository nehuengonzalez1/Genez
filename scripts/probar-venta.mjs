/* ============================================================
   PRUEBA DE HUMO · las dos entradas de cobro
   ============================================================

   Cobrar tiene dos caminos: la venta directa, que nace y se confirma en
   el mismo acto, y la comanda, que estuvo abierta un rato. Los dos pasan
   por confirmar_operacion, así que esta prueba existe para que ninguno
   se rompa sin que nos enteremos.

   Deja la base como la encontró.

     node scripts/probar-venta.mjs
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
const limpiar = [];
let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* Restos de una corrida que se cortó a la mitad. Sin esto, la comanda que
   quedó abierta de la vez anterior se reutiliza —abrir_comanda hace bien
   su trabajo— y las líneas se suman encima: todo da el doble y parece un
   bug del código. */
async function barrerRestos() {
  const cond = "tipo = 'comanda' or numero like 'PRUEBA%'";
  await c.query(`delete from movimientos_stock where operacion_id in (select id from operaciones where ${cond})`);
  await c.query(`delete from movimientos_caja  where operacion_id in (select id from operaciones where ${cond})`);
  const r = await c.query(`delete from operaciones where ${cond}`);
  if (r.rowCount) console.log(`\n(se limpiaron ${r.rowCount} operaciones de una corrida anterior)`);
}
await barrerRestos();

/* ------------------------------------------------------------
   1 · Venta directa
   ------------------------------------------------------------ */
console.log("\nVenta directa");

const emp = await una("select id from empresas where nombre = 'Super 25'");
const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [emp.id]);
const prod = await una(
  "select i.id, i.nombre, i.costo, i.precio, v.stock from items i join items_vista v on v.id = i.id where v.stock > 10 and i.empresa_id = $1 limit 1",
  [emp.id]
);

const sesion = await una(
  "insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 20000) returning id",
  [emp.id, suc.id]
);
limpiar.push(["sesiones_caja", sesion.id]);

const ventaId = randomUUID();
const venta = {
  id: ventaId, empresa_id: emp.id, sucursal_id: suc.id, sesion_id: sesion.id,
  numero: "PRUEBA-0001", subtotal: Number(prod.precio) * 3, total: Number(prod.precio) * 3,
  lineas: [{
    item_id: prod.id, descripcion: prod.nombre, cantidad: 3,
    precio_unitario: Number(prod.precio), costo_unitario: Number(prod.costo),
    iva: 21, total: Number(prod.precio) * 3,
  }],
  pagos: [
    { medio: "efectivo", monto: Number(prod.precio) * 2 },
    { medio: "debito", monto: Number(prod.precio) },
  ],
};

await c.query("select registrar_venta($1::jsonb)", [JSON.stringify(venta)]);
limpiar.push(["operaciones", ventaId]);

const partes = async (id) => una(`
  select (select count(*) from operacion_lineas   where operacion_id = $1) lineas,
         (select count(*) from pagos              where operacion_id = $1) pagos,
         (select count(*) from movimientos_stock  where operacion_id = $1) stock,
         (select count(*) from movimientos_caja   where operacion_id = $1) caja`, [id]);

const a = await partes(ventaId);
decir(a.lineas === "1" && a.pagos === "2" && a.stock === "1" && a.caja === "2",
  `escribe las cinco partes (lineas ${a.lineas}, pagos ${a.pagos}, stock ${a.stock}, caja ${a.caja})`);

const post = await una("select stock from items_vista where id = $1", [prod.id]);
decir(Number(post.stock) === Number(prod.stock) - 3, `descuenta stock (${prod.stock} -> ${post.stock})`);

await c.query("select registrar_venta($1::jsonb)", [JSON.stringify(venta)]);
const b = await partes(ventaId);
decir(JSON.stringify(a) === JSON.stringify(b), "reintentarla no duplica nada");

try {
  await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({ ...venta, id: randomUUID(), sesion_id: null })]);
  decir(false, "rechaza cobrar sin caja abierta");
} catch (e) {
  decir(e.code === "P0001", "rechaza cobrar sin caja abierta");
}

/* ------------------------------------------------------------
   2 · Comanda
   ------------------------------------------------------------ */
console.log("\nComanda");

const bar = await una("select id from empresas where nombre = 'Bar Rivadavia'");
if (!bar) {
  console.log("  --   sin Bar Rivadavia cargado, se saltea (corré supabase/seed/gastronomia.sql)");
} else {
  const sucBar = await una("select id from sucursales where empresa_id = $1 limit 1", [bar.id]);
  const mesa = await una("select id, nombre from recursos where empresa_id = $1 and tipo = 'mesa' order by orden limit 1", [bar.id]);
  const plato = await una("select id, nombre, precio, costo from items where empresa_id = $1 and controla_stock = false limit 1", [bar.id]);
  const bebida = await una("select i.id, i.nombre, i.precio, i.costo, v.stock from items i join items_vista v on v.id = i.id where i.empresa_id = $1 and i.controla_stock limit 1", [bar.id]);

  const sesionBar = await una(
    "insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 10000) returning id",
    [bar.id, sucBar.id]
  );
  limpiar.push(["sesiones_caja", sesionBar.id]);

  const abrir = { empresa_id: bar.id, sucursal_id: sucBar.id, recurso_id: mesa.id };
  const c1 = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify(abrir)]);
  const c2 = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify(abrir)]);
  limpiar.push(["operaciones", c1.id]);
  decir(c1.id === c2.id, `tocar dos veces ${mesa.nombre} devuelve la misma comanda`);

  const sumar = (item, cant, mods, destino) => c.query(
    `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
       precio_unitario, costo_unitario, total, modificadores, destino)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
    [c1.id, bar.id, item.id, item.nombre, cant, item.precio, item.costo,
     Number(item.precio) * cant, JSON.stringify(mods), destino]
  );

  await sumar(plato, 2, [{ nombre: "sin cebolla", precio: 0 }, { nombre: "extra queso", precio: 900 }], "cocina");
  await sumar(bebida, 3, [], "barra");

  const esperado = Number(plato.precio) * 2 + Number(bebida.precio) * 3;

  /* Cargar no despacha. Antes esta prueba esperaba lo contrario, que era
     el comportamiento que rompia el servicio: lo que el mozo tipeaba
     mientras el cliente todavia se estaba decidiendo ya salia a la
     plancha. */
  const sinMandar = await una(
    "select count(*) n from operacion_lineas where operacion_id = $1 and estado = 'borrador'", [c1.id]);
  decir(sinMandar.n === "2", "lo cargado queda sin despachar hasta que alguien lo mande");

  const salieron = await una("select enviar_a_cocina($1) n", [c1.id]);
  decir(Number(salieron.n) === 2, "despachar manda lo que estaba esperando");

  await c.query("select cerrar_comanda($1, $2, $3::jsonb, $4)", [
    c1.id, sesionBar.id, JSON.stringify([{ medio: "efectivo", monto: esperado }]), "PRUEBA-C1",
  ]);

  const cerrada = await una("select estado, total, cerrada_en from operaciones where id = $1", [c1.id]);
  decir(cerrada.estado === "confirmada", "queda confirmada");
  decir(Number(cerrada.total) === esperado, `calcula el total de las lineas (${cerrada.total} = ${esperado})`);

  const pc = await partes(c1.id);
  decir(pc.pagos === "1" && pc.caja === "1", "registra el pago y el ingreso a caja");
  decir(pc.stock === "1", "descuenta solo la bebida, no el plato preparado");

  const postBeb = await una("select stock from items_vista where id = $1", [bebida.id]);
  decir(Number(postBeb.stock) === Number(bebida.stock) - 3, `stock de barra (${bebida.stock} -> ${postBeb.stock})`);

  const libre = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify(abrir)]);
  limpiar.push(["operaciones", libre.id]);
  decir(libre.id !== c1.id, "la mesa queda libre y abre una comanda nueva");
}

/* ------------------------------------------------------------
   Limpieza
   ------------------------------------------------------------ */
for (const [tabla, id] of limpiar.reverse()) {
  if (tabla === "operaciones") {
    await c.query("delete from movimientos_stock where operacion_id = $1", [id]);
    await c.query("delete from movimientos_caja  where operacion_id = $1", [id]);
  }
  await c.query(`delete from ${tabla} where id = $1`, [id]);
}
await c.query("delete from bitacora");

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien. Base como estaba.");
await c.end();
process.exitCode = fallas ? 1 : 0;
