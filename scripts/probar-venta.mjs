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

/* TODO ADENTRO DE UNA TRANSACCIÓN QUE SE DESHACE
   La base es la de producción, con comercios que están vendiendo. Antes
   esta prueba escribía de verdad y limpiaba al final, y eso rompió cosas
   reales tres veces:
   - Al arrancar barría "restos de una corrida anterior" borrando TODA
     comanda de la base que no fuera de la semilla, de cualquier comercio:
     el 24/09 se llevó una venta cobrada de Bar Rivadavia (0003-00000001,
     $35.400) con su caja y su stock.
   - Si se cortaba a la mitad, la caja de prueba de Super 25 quedaba
     abierta; era la más nueva, la pantalla de Caja la tomaba como la del
     comercio y Axel veía la caja vacía con las ventas del día en otra.
   - Tomaba la primera mesa del bar: con una cuenta real abierta ahí, se
     la reutilizaba, le sumaba renglones, la cobraba y la borraba.

   Ahora nada de lo que escribe se confirma. La aplicación no lo ve
   mientras corre —no está confirmado— y si la prueba se corta, la
   conexión se cierra y Postgres lo deshace solo. No hace falta limpiar
   nada, ni la bitácora. */
await c.query("begin");

const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];
let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* ------------------------------------------------------------
   1 · Venta directa
   ------------------------------------------------------------ */
console.log("\nVenta directa");

const partes = async (id) => una(`
  select (select count(*) from operacion_lineas   where operacion_id = $1) lineas,
         (select count(*) from pagos              where operacion_id = $1) pagos,
         (select count(*) from movimientos_stock  where operacion_id = $1) stock,
         (select count(*) from movimientos_caja   where operacion_id = $1) caja`, [id]);

const emp = await una("select id from empresas where nombre = 'Super 25'");
const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [emp.id]);
/* Cualquier producto que lleve stock: lo que se mira es que baje tres,
   no cuánto hay. Pedía "más de 10" y el día que Super 25 no tuvo ninguno
   la prueba se cayó con la caja de prueba ya abierta. */
const prod = await una(
  "select i.id, i.nombre, i.costo, i.precio, v.stock from items i join items_vista v on v.id = i.id where i.controla_stock and i.precio > 0 and i.empresa_id = $1 limit 1",
  [emp.id]
);

if (!prod) {
  console.log("  --   Super 25 no tiene productos con stock y precio, se saltea");
} else {
const sesion = await una(
  "insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 20000) returning id",
  [emp.id, suc.id]
);

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

const a = await partes(ventaId);
decir(a.lineas === "1" && a.pagos === "2" && a.stock === "1" && a.caja === "2",
  `escribe las cinco partes (lineas ${a.lineas}, pagos ${a.pagos}, stock ${a.stock}, caja ${a.caja})`);

const post = await una("select stock from items_vista where id = $1", [prod.id]);
decir(Number(post.stock) === Number(prod.stock) - 3, `descuenta stock (${prod.stock} -> ${post.stock})`);

await c.query("select registrar_venta($1::jsonb)", [JSON.stringify(venta)]);
const b = await partes(ventaId);
decir(JSON.stringify(a) === JSON.stringify(b), "reintentarla no duplica nada");

/* Un error adentro de la transacción la invalida entera: el rechazo que
   se espera va en su propio punto de guardado. */
await c.query("savepoint sin_caja");
try {
  await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({ ...venta, id: randomUUID(), sesion_id: null })]);
  decir(false, "rechaza cobrar sin caja abierta");
} catch (e) {
  decir(e.code === "P0001", "rechaza cobrar sin caja abierta");
}
await c.query("rollback to savepoint sin_caja");
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
  /* Una mesa libre: en una ocupada, abrir_comanda devuelve la cuenta real
     que está ahí, y la prueba se la cobraría. */
  const mesa = await una(
    `select r.id, r.nombre from recursos r where r.empresa_id = $1 and r.tipo = 'mesa'
       and not exists (select 1 from operaciones o where o.recurso_id = r.id and o.estado = 'abierta')
     order by r.orden limit 1`, [bar.id]);
  const plato = await una("select id, nombre, precio, costo from items where empresa_id = $1 and controla_stock = false limit 1", [bar.id]);
  const bebida = await una("select i.id, i.nombre, i.precio, i.costo, v.stock from items i join items_vista v on v.id = i.id where i.empresa_id = $1 and i.controla_stock limit 1", [bar.id]);

  const sesionBar = await una(
    "insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 10000) returning id",
    [bar.id, sucBar.id]
  );

  const abrir = { empresa_id: bar.id, sucursal_id: sucBar.id, recurso_id: mesa.id };
  const c1 = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify(abrir)]);
  const c2 = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify(abrir)]);
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
  decir(libre.id !== c1.id, "la mesa queda libre y abre una comanda nueva");
}

/* Nada de lo que se escribió queda: ni las ventas, ni las cajas de
   prueba, ni lo que anotó la bitácora. */
await c.query("rollback");

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien. Base como estaba.");
await c.end();
process.exitCode = fallas ? 1 : 0;

