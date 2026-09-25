/* ============================================================
   PRUEBA · descuento y comensales
   ============================================================

   Lo que se verifica es que el descuento llegue al cobro. Un porcentaje
   pactado antes del postre tiene que seguir al subtotal, y cerrar la
   mesa no puede borrarlo.

     node scripts/probar-descuento.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
/* TODO ADENTRO DE UNA TRANSACCIÓN QUE SE DESHACE
   La base es la de producción. Antes esta prueba escribía de verdad y
   limpiaba al final —incluida la bitácora de todos los comercios desde
   la hora de arranque, que se llevaba las acciones reales de un cajero en
   esos segundos— y si se cortaba a la mitad dejaba restos. Ahora nada se
   confirma: la aplicación no lo ve y, si se corta, Postgres lo deshace.
   Ver probar-venta.mjs. */
await c.query("begin");
const una = async (s, a = []) => (await c.query(s, a)).rows[0];
let fallas = 0;
const decir = (ok, t) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${t}`); };

const emp = await una("select id from empresas where nombre = 'Bar Rivadavia'");
const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [emp.id]);
const plato = await una("select id, nombre, precio, costo from items where empresa_id = $1 and controla_stock = false limit 1", [emp.id]);

const cm = await una("select abrir_comanda($1::jsonb) id",
  [JSON.stringify({ empresa_id: emp.id, canal: "mostrador" })]);

const cargar = (cant) => c.query(
  `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
     precio_unitario, costo_unitario, total, destino)
   values ($1,$2,$3,$4,$5,$6,$7,$8,'cocina')`,
  [cm.id, emp.id, plato.id, plato.nombre, cant, plato.precio, plato.costo, Math.round(plato.precio * cant)]);

console.log("\nDescuento");

await cargar(2);
const sub1 = Number(plato.precio) * 2;

const d1 = await una("select aplicar_descuento($1, 10, null) d", [cm.id]);
decir(Number(d1.d) === Math.round(sub1 * 0.1), `10% sobre ${sub1} da ${d1.d}`);

/* El caso que importa: la mesa pide el postre despues de pactar el
   descuento y el porcentaje tiene que acompañar. */
await cargar(1);
const sub2 = Number(plato.precio) * 3;
const o = await una("select descuento_pct from operaciones where id = $1", [cm.id]);
decir(Number(o.descuento_pct) === 10, "el porcentaje queda guardado como porcentaje");

const d2 = await una("select aplicar_descuento($1, 10, null) d", [cm.id]);
decir(Number(d2.d) === Math.round(sub2 * 0.1), `y sobre el subtotal nuevo da ${d2.d}, no ${d1.d}`);

/* Por importe fijo: se guarda tal cual y el porcentaje se limpia. */
await c.query("select aplicar_descuento($1, null, 500)", [cm.id]);
const f = await una("select descuento, descuento_pct from operaciones where id = $1", [cm.id]);
decir(Number(f.descuento) === 500 && f.descuento_pct === null, "por importe se guarda el monto y se limpia el porcentaje");

/* Cada error esperado va en su punto de guardado: adentro de la
   transacción, un error la invalida entera. */
await c.query("savepoint esperado");
try {
  await c.query("select aplicar_descuento($1, null, 999999)", [cm.id]);
  decir(false, "no deja descontar mas que la cuenta");
} catch (e) {
  decir(e.code === "P0009", "no deja descontar mas que la cuenta");
}
await c.query("rollback to savepoint esperado");

/* El tope (0088): hasta 99,99 %, medido en plata. La mesa nunca queda
   en cero, ni por porcentaje, ni por importe, ni por redondeo. */
console.log("\nTope de 99,99 %");

const rechaza = async (sql, args, texto) => {
  await c.query("savepoint esperado");
  try { await c.query(sql, args); decir(false, texto); }
  catch (e) { decir(e.code === "P0009" || e.code === "23514", texto); }
  await c.query("rollback to savepoint esperado");
};
const tope = Number((await una("select tope_descuento($1) t", [sub2])).t);
decir(tope === Math.floor(sub2 * 99.99 / 100) && tope < sub2, `el tope de ${sub2} es ${tope}, por debajo del subtotal`);
await rechaza("select aplicar_descuento($1, 100, null)", [cm.id], "no deja poner 100 %");
await rechaza("select aplicar_descuento($1, null, $2)", [cm.id, sub2], "no deja descontar la cuenta entera");
/* 99,99 % de un subtotal chico redondea a la cuenta entera: el caso que
   el porcentaje solo no ve. */
const chico = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify({ empresa_id: emp.id, canal: "mostrador" })]);
await c.query(
  `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, costo_unitario, total, destino)
   values ($1,$2,$3,'Prueba tope',1,1500,0,1500,'cocina')`, [chico.id, emp.id, plato.id]);
await rechaza("select aplicar_descuento($1, 99.99, null)", [chico.id], "99,99 % de $1.500 redondea a $1.500 y se rechaza");
const alTope = await una("select aplicar_descuento($1, null, 1499) d", [chico.id]);
decir(Number(alTope.d) === 1499, "descontar justo el tope ($1.499 de $1.500) se acepta");
await c.query("delete from operacion_lineas where operacion_id = $1", [chico.id]);
await c.query("delete from operaciones where id = $1", [chico.id]);

/* El control de fondo: una venta confirmada por encima del tope no entra,
   venga de donde venga. */
const ventaCon = (desc) => c.query(
  `insert into operaciones (id, empresa_id, sucursal_id, tipo, estado, numero, subtotal, descuento, total)
   values (gen_random_uuid(), $1, $2, 'venta', 'confirmada', 'PRUEBA-TOPE', 1500, $3::numeric, 1500 - $3::numeric) returning id`,
  [emp.id, suc.id, desc]);
await c.query("savepoint esperado");
try { await ventaCon(1500); decir(false, "una venta confirmada en $0 no entra"); }
catch (e) { decir(e.code === "P0009", "una venta confirmada en $0 no entra"); }
await c.query("rollback to savepoint esperado");
const entra = (await ventaCon(1499)).rows[0];
decir(!!entra, "una venta confirmada con el tope justo entra");
await c.query("delete from operaciones where id = $1", [entra.id]);

console.log("\nComensales y cobro");

await c.query("update operaciones set comensales = 3 where id = $1", [cm.id]);
await c.query("select aplicar_descuento($1, 10, null)", [cm.id]);

const ses = await una("insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1,$2,0) returning id", [emp.id, suc.id]);
const esperado = sub2 - Math.round(sub2 * 0.1);

/* Cobrar sin mandar descuento tiene que honrar el que la mesa tenia. */
await c.query("select cerrar_comanda($1, $2, $3::jsonb)", [cm.id, ses.id, JSON.stringify([{ medio: "efectivo", monto: esperado }])]);
const fin = await una("select subtotal, descuento, total, comensales from operaciones where id = $1", [cm.id]);

decir(Number(fin.subtotal) === sub2, `el subtotal es el de las lineas (${fin.subtotal})`);
decir(Number(fin.descuento) === Math.round(sub2 * 0.1), `el descuento sobrevivio al cobro (${fin.descuento})`);
decir(Number(fin.total) === esperado, `el total cobrado los resta (${fin.total})`);
decir(Number(fin.comensales) === 3, "los comensales quedan guardados para el ticket por persona");

/* Nada de lo que se escribió queda, ni la bitácora. */
await c.query("rollback");

console.log(fallas ? `\n${fallas} fallaron.` : "\nTodo bien. Base como estaba.");
await c.end();
process.exitCode = fallas ? 1 : 0;

