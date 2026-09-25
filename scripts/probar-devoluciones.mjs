/* ============================================================
   PRUEBA · devoluciones, notas de crédito y notas de débito (0089)
   ============================================================

   Corre entera en una transacción que se deshace: la base es la de
   producción y no puede quedar nada (ver probar-venta.mjs, que aprendió
   eso a la fuerza). Si 0089 todavía no está aplicada, la carga adentro de
   la misma transacción: sirve de ensayo de la migración.

   Usa Bnitori, el comercio de prueba, con la identidad de su dueño, para
   que las funciones controlen el permiso y el comercio como desde la
   pantalla. No habla con ARCA: mira que cada nota quede esperando su CAE
   con la clase correcta; el pedido a ARCA se prueba aparte.

     node scripts/probar-devoluciones.mjs
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
await c.query("begin");

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];

const hay = await una("select count(*) n from pg_proc where proname = 'registrar_devolucion'");
if (hay.n === "0") {
  console.log("\n(0089 no está aplicada: se carga adentro de la transacción, como ensayo)");
  await c.query(readFileSync("supabase/migrations/0089_devoluciones_y_notas.sql", "utf8"));
}
const conInformes = await una("select pg_get_functiondef('ventas_diarias(uuid,integer)'::regprocedure) ~ 'devolucion' as si");
if (!conInformes.si) {
  console.log("(0090 no está aplicada: se carga adentro de la transacción, como ensayo)");
  await c.query(readFileSync("supabase/migrations/0090_informes_restan_devoluciones.sql", "utf8"));
}

/* Como administrador se arma el escenario; como el dueño se opera. */
const comoDueno = async () => {
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: dueno.id, role: "authenticated" })]);
};
const comoAdmin = () => c.query("reset role");
/* Un error esperado invalida la transacción: cada uno en su savepoint. */
const falla = async (sql, args, codigo, texto) => {
  await c.query("savepoint s");
  try { await c.query(sql, args); decir(false, texto); }
  catch (e) { decir(e.code === codigo, `${texto}${e.code === codigo ? "" : ` (dio ${e.code}: ${e.message})`}`); }
  await c.query("rollback to savepoint s");
};

const emp = await una("select id from empresas where nombre = 'Bnitori'");
const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [emp.id]);
const dueno = await una("select id from perfiles where empresa_id = $1 and rol = 'dueno' limit 1", [emp.id]);
const prod = await una("select i.id, i.nombre, v.stock from items i join items_vista v on v.id = i.id where i.empresa_id = $1 and i.controla_stock and i.precio > 0 limit 1", [emp.id]);
const ajena = await una("select o.id from operaciones o join empresas e on e.id = o.empresa_id where e.nombre = 'Super 25' and o.tipo = 'venta' limit 1");
const ses = await una("insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 0) returning id", [emp.id, suc.id]);
const cli = await una("insert into clientes (empresa_id, razon_social, condicion) values ($1, 'Cliente de prueba', 'CF') returning id", [emp.id]);

/* Cómo estaban los informes antes de todo lo de esta prueba (0090). */
const informeHoy = async () => {
  const d = await una("select ventas, tickets from ventas_diarias($1, 1)", [emp.id]);
  const p = await una("select coalesce(sum(unidades), 0) u, coalesce(sum(venta), 0) v from ventas_por_item($1, 1) where item_id = $2", [emp.id, prod.id]);
  return { ventas: Number(d.ventas), tickets: Number(d.tickets), unidades: Number(p.u), venta: Number(p.v) };
};
const antes = await informeHoy();

/* Tres unidades a $1.000 con 10 % de descuento: se cobran $2.700. */
const vender = async ({ fiscal = false, medio = "efectivo", cliente = null } = {}) => {
  const id = randomUUID();
  await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({
    id, empresa_id: emp.id, sucursal_id: suc.id, sesion_id: ses.id, numero: `PRUEBA-${id.slice(0, 6)}`,
    subtotal: 3000, descuento: 300, recargo: 0, total: 2700, cliente_id: cliente,
    comprobante: fiscal ? { fiscal: true } : {},
    lineas: [{ item_id: prod.id, descripcion: prod.nombre, cantidad: 3, precio_unitario: 1000, costo_unitario: 0, iva: 21, total: 3000 }],
    pagos: [{ medio, monto: 2700 }],
  })]);
  const linea = await una("select id from operacion_lineas where operacion_id = $1", [id]);
  return { id, linea: linea.id };
};
const stock = async () => Number((await una("select stock from items_vista where id = $1", [prod.id])).stock);
const devolver = (venta, linea, cantidad, medio = "efectivo") => una(
  "select registrar_devolucion($1, $2::jsonb, $3, $4, 'prueba') id",
  [venta, JSON.stringify([{ linea_id: linea, cantidad }]), ses.id, medio]);

console.log("\nDevolución de un ticket");
const v1 = await vender();
const s0 = await stock();
await comoDueno();
const d1 = await devolver(v1.id, v1.linea, 1);
await comoAdmin();
const op1 = await una("select tipo, numero, total, subtotal, origen_id, comprobante from operaciones where id = $1", [d1.id]);
decir(op1.tipo === "devolucion" && op1.origen_id === v1.id, `queda una devolución apuntando a la venta (${op1.numero})`);
decir(Number(op1.total) === 900, `reintegra lo cobrado con el descuento repartido (${op1.total} de 1 × $1.000 con 10 %)`);
decir((await stock()) === s0 + 1, "el stock vuelve");
const mov1 = await una("select tipo, medio, monto from movimientos_caja where operacion_id = $1", [d1.id]);
decir(mov1 && mov1.tipo === "egreso" && Number(mov1.monto) === 900, "sale de la caja como egreso");
decir(!op1.comprobante.fiscal, "un ticket no pide nota de crédito");

await comoDueno();
await falla("select registrar_devolucion($1, $2::jsonb, $3, 'efectivo', null)", [v1.id, JSON.stringify([{ linea_id: v1.linea, cantidad: 3 }]), ses.id], "P0023", "no deja devolver más de lo que queda (quedan 2)");
const d2 = await devolver(v1.id, v1.linea, 2);
await comoAdmin();
const tot = await una("select sum(total) t from operaciones where origen_id = $1 and tipo = 'devolucion'", [v1.id]);
decir(Number(tot.t) === 2700, `devolver el resto completa lo cobrado, ni un peso más (${tot.t})`);
await comoDueno();
await falla("select registrar_devolucion($1, $2::jsonb, $3, 'efectivo', null)", [v1.id, JSON.stringify([{ linea_id: v1.linea, cantidad: 1 }]), ses.id], "P0023", "con todo devuelto, no deja devolver más");
await falla("select registrar_devolucion($1, $2::jsonb, $3, 'efectivo', null)", [ajena.id, JSON.stringify([]), ses.id], "P0020", "no deja tocar una venta de otro comercio");
await comoAdmin();
const num = await una("select numero from operaciones where id = $1", [d2.id]);
decir(op1.numero === "DEV-00000001" || num.numero > op1.numero, `numera en serie (${op1.numero} → ${num.numero})`);

console.log("\nDevolución a cuenta corriente");
const saldo = async () => Number((await una("select saldo_cliente($1) s", [cli.id])).s);
const v2 = await vender({ medio: "cuenta_corriente", cliente: cli.id });
decir((await saldo()) === 2700, "la venta fiada suma a la deuda");
await comoDueno();
await devolver(v2.id, v2.linea, 3, "cuenta_corriente");
await comoAdmin();
decir((await saldo()) === 0, "devolverla a cuenta corriente la baja, sin tocar la caja");

console.log("\nNota de crédito");
const v3 = await vender({ fiscal: true });
await comoDueno();
await falla("select registrar_devolucion($1, $2::jsonb, $3, 'efectivo', null)", [v3.id, JSON.stringify([{ linea_id: v3.linea, cantidad: 1 }]), ses.id], "P0022", "sobre una factura sin CAE, espera");
await comoAdmin();
await c.query(
  `insert into comprobantes (empresa_id, operacion_id, modo, cuit, punto_venta, tipo, letra, numero, estado, cae, cae_vto, fecha, total, neto, doc_tipo, doc_nro, condicion_receptor)
   values ($1, $2, 'homologacion', '20409378472', 1, 11, 'C', 999999, 'autorizado', '12345678901234', current_date + 10, current_date, 2700, 2700, 99, 0, 5)`,
  [emp.id, v3.id]);
/* Desde 0093 la nota sale solo si la factura es de la conexión de hoy:
   Bnitori, conectada a homologación mientras dura la transacción. */
await c.query("delete from arca_conexiones where empresa_id = $1", [emp.id]);
await c.query("insert into arca_conexiones (empresa_id, modo, punto_venta) values ($1, 'homologacion', 1)", [emp.id]);
await comoDueno();
const d3 = await devolver(v3.id, v3.linea, 1);
await comoAdmin();
const nc = await una("select clase, estado, operacion_tipo from facturas_vista where operacion_id = $1", [d3.id]);
decir(nc && nc.clase === "credito" && nc.estado === "sin_cae" && nc.operacion_tipo === "devolucion", "con CAE, la devolución queda esperando su nota de crédito");

console.log("\nNota de débito");
await comoDueno();
const nd = await una("select registrar_nota_debito($1, 'Diferencia de precio', 500, $2, 'efectivo') id", [v3.id, ses.id]);
await falla("select registrar_nota_debito($1, 'x', 100, $2, 'efectivo')", [v1.id, ses.id], "P0022", "sobre un ticket no hay nota de débito");
await falla("select registrar_nota_debito($1, 'x', 0, $2, 'efectivo')", [v3.id, ses.id], "P0020", "en cero, no");
await comoAdmin();
const ndv = await una("select clase, estado from facturas_vista where operacion_id = $1", [nd.id]);
decir(ndv && ndv.clase === "debito" && ndv.estado === "sin_cae", "queda esperando su nota de débito");
const ndm = await una("select tipo, monto from movimientos_caja where operacion_id = $1", [nd.id]);
decir(ndm && ndm.tipo === "ingreso" && Number(ndm.monto) === 500, "se cobra y entra a la caja");
const ndo = await una("select numero, origen_id, total from operaciones where id = $1", [nd.id]);
decir(ndo.origen_id === v3.id && ndo.numero.startsWith("ND-"), `apunta a la factura (${ndo.numero})`);

/* Lo que pasó hoy en esta prueba: tres ventas de $2.700 (3 unidades cada
   una), la primera devuelta entera en dos veces, la segunda entera a
   cuenta corriente, de la tercera 1 unidad ($900), y una nota de débito
   de $500. Neto: 2.700 − 900 + 500 = $2.300, 4 tickets (las devoluciones
   no cuentan), y del producto quedan 2 unidades por $2.000 (el informe
   por producto suma renglones, sin el descuento de la venta). */
console.log("\nInformes (0090)");
const despues = await informeHoy();
decir(despues.ventas - antes.ventas === 2300, `las ventas del día restan lo devuelto (${despues.ventas - antes.ventas}, esperaba 2300)`);
decir(despues.tickets - antes.tickets === 4, `las devoluciones no cuentan como ticket (${despues.tickets - antes.tickets}, esperaba 4)`);
decir(despues.unidades - antes.unidades === 2, `el producto resta las unidades devueltas (${despues.unidades - antes.unidades}, esperaba 2)`);
decir(despues.venta - antes.venta === 2000, `y lo que se había vendido de ellas (${despues.venta - antes.venta}, esperaba 2000)`);

await c.query("rollback");

/* ------------------------------------------------------------
   ARCA de pruebas: que las notas salgan de verdad
   ------------------------------------------------------------
   Como la parte 3 de probar-arca.mjs: un comercio temporal conectado a
   homologación, porque supabase-js va por otra conexión y no ve lo que
   una transacción no confirmó. Se borra al final pase lo que pase. */
console.log("\nARCA de pruebas");
const aplicada = (await una("select count(*) n from pg_proc where proname = 'registrar_devolucion'")).n !== "0";
if (!env.AFIP_ACCESS_TOKEN || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("  --   falta AFIP_ACCESS_TOKEN o SUPABASE_SERVICE_ROLE_KEY en el .env, se saltea");
} else if (!aplicada) {
  console.log("  --   0089 no está aplicada en la base, se saltea");
} else {
  process.env.AFIP_ACCESS_TOKEN = env.AFIP_ACCESS_TOKEN;
  const { createClient } = await import("@supabase/supabase-js");
  const { facturarVenta, ErrorArca } = await import("../api/arca/_arca.js");
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { id: empresaId } = await una(
    "insert into empresas (nombre, config) values ('Prueba notas ARCA (se borra sola)', $1) returning id",
    [JSON.stringify({ fiscal: { condicion: "MONOTRIBUTO" } })]);
  const operacion = async (tipo, total, comprobante, origen = null, minutos = 0) => {
    const id = randomUUID();
    await c.query(
      `insert into operaciones (id, empresa_id, tipo, estado, subtotal, total, comprobante, origen_id, fecha)
       values ($1, $2, $3, 'confirmada', $4, $4, $5, $6, now() - interval '30 minutes' + $7 * interval '1 minute')`,
      [id, empresaId, tipo, total, JSON.stringify(comprobante), origen, minutos]);
    return id;
  };

  try {
    await c.query("insert into arca_conexiones (empresa_id, punto_venta) values ($1, 1)", [empresaId]);
    const venta = await operacion("venta", 1000, { fiscal: true }, null, 1);
    const f = await facturarVenta({ admin, empresaId, operacionId: venta });
    decir(f.tipo === 11 && /^\d{14}$/.test(f.cae), `la factura C sale (número ${f.numero}, CAE ${f.cae})`);

    const dev = await operacion("devolucion", 400, { fiscal: true, nota: "credito" }, venta, 2);
    const nc = await facturarVenta({ admin, empresaId, operacionId: dev });
    decir(nc.tipo === 13 && nc.asociado_id === f.id && /^\d{14}$/.test(nc.cae) && Number(nc.total) === 400,
      `la nota de crédito C sale asociada a la factura (número ${nc.numero}, CAE ${nc.cae})`);
    decir(nc.pedido && nc.pedido.CbtesAsoc && nc.pedido.CbtesAsoc[0].Nro === f.numero && nc.pedido.CbtesAsoc[0].Tipo === 11,
      "a ARCA se le dijo a qué factura corresponde");

    const deb = await operacion("venta", 150, { fiscal: true, nota: "debito" }, venta, 3);
    const nd = await facturarVenta({ admin, empresaId, operacionId: deb });
    decir(nd.tipo === 12 && nd.asociado_id === f.id && /^\d{14}$/.test(nd.cae),
      `la nota de débito C sale asociada a la factura (número ${nd.numero}, CAE ${nd.cae})`);

    const otra = await facturarVenta({ admin, empresaId, operacionId: dev });
    decir(otra.id === nc.id, "pedirla de nuevo devuelve la misma nota, no emite otra");

    const ticket = await operacion("venta", 300, {}, null, 4);
    const huerfana = await operacion("devolucion", 100, { fiscal: true, nota: "credito" }, ticket, 5);
    let error = null;
    try { await facturarVenta({ admin, empresaId, operacionId: huerfana }); } catch (e) { error = e; }
    decir(error instanceof ErrorArca && error.estado === 409, "una nota contra algo que no tiene CAE no sale");
  } catch (e) {
    decir(false, `ARCA: ${e.message}`);
  } finally {
    await c.query("delete from comprobantes where empresa_id = $1", [empresaId]);
    await c.query("delete from empresas where id = $1", [empresaId]);
  }
}

await c.end();
console.log(fallas ? `\n${fallas} fallaron.` : "\nTodo bien. Nada quedó en la base.");
process.exitCode = fallas ? 1 : 0;
