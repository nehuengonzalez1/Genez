/* ============================================================
   PRUEBA · corregir el medio de pago de una venta (0092)
   ============================================================

   Corre entera en una transacción que se deshace: la base es la de
   producción y no puede quedar nada. Si 0092 todavía no está aplicada, la
   carga adentro de la misma transacción: sirve de ensayo de la migración.

   Usa Bnitori, el comercio de prueba, con la identidad de su dueño, para
   que la función controle el permiso y el comercio como desde la
   pantalla.

     node scripts/probar-corregir-medio.mjs
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

const hay = await una("select count(*) n from pg_proc where proname = 'corregir_medio_pago'");
if (hay.n === "0") {
  console.log("\n(0092 no está aplicada: se carga adentro de la transacción, como ensayo)");
  await c.query(readFileSync("supabase/migrations/0092_corregir_medio_de_pago.sql", "utf8"));
}

const comoDe = async (perfilId) => {
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: perfilId, role: "authenticated" })]);
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
const cajero = await una("select id from perfiles where empresa_id = $1 and rol = 'cajero' and activo limit 1", [emp.id]);
const ajeno = await una("select p.id from pagos p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1");

/* Los medios del comercio, fijados para la prueba: débito sin recargo y
   crédito con. Se deshace con todo lo demás. */
await c.query(`update empresas set config = jsonb_set(coalesce(config, '{}'::jsonb), '{medios}', $2::jsonb) where id = $1`, [emp.id, JSON.stringify([
  { k: "efectivo", n: "Efectivo", tasa: 0, recargo: false, activo: true },
  { k: "debito", n: "Débito", tasa: 8, recargo: false, activo: true },
  { k: "credito", n: "Crédito", tasa: 10, recargo: true, activo: true },
  { k: "viejo", n: "Uno apagado", tasa: 0, recargo: false, activo: false },
  { k: "cuenta_corriente", n: "Cuenta corriente", tasa: 0, recargo: false, activo: true },
])]);

const ses = await una("insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 0) returning id", [emp.id, suc.id]);
const cli = await una("insert into clientes (empresa_id, razon_social, condicion) values ($1, 'Cliente de prueba', 'CF') returning id", [emp.id]);

const vender = async (pagos, { sesion = ses.id, cliente = null } = {}) => {
  const id = randomUUID();
  const total = pagos.reduce((s, p) => s + p.monto, 0);
  await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({
    id, empresa_id: emp.id, sucursal_id: suc.id, sesion_id: sesion, numero: `PRUEBA-${id.slice(0, 6)}`,
    subtotal: total, descuento: 0, recargo: 0, total, cliente_id: cliente, comprobante: {},
    lineas: [{ item_id: null, descripcion: "Renglón de prueba", cantidad: 1, precio_unitario: total, costo_unitario: 0, iva: 21, total }],
    pagos,
  })]);
  return id;
};
const pagosDe = async (op) => (await c.query("select id, medio, monto from pagos where operacion_id = $1 order by monto", [op])).rows;
const movsDe = async (op) => (await c.query("select medio, monto, sesion_id from movimientos_caja where operacion_id = $1 order by monto", [op])).rows;
const corregir = "select corregir_medio_pago($1, $2, $3)";

console.log("\nDébito que era efectivo");
const v1 = await vender([{ medio: "debito", monto: 4400 }]);
const [p1] = await pagosDe(v1);
const total1 = await una("select total from operaciones where id = $1", [v1]);
await comoDe(dueno.id);
await c.query(corregir, [p1.id, "efectivo", "se tocó mal"]);
await comoAdmin();
const [p1b] = await pagosDe(v1);
const [m1] = await movsDe(v1);
decir(p1b.medio === "efectivo" && Number(p1b.monto) === 4400, "el pago pasa a efectivo, mismo importe");
decir(m1.medio === "efectivo" && Number(m1.monto) === 4400 && m1.sesion_id === ses.id, "su ingreso en la caja también, en la misma caja");
const t1 = await una("select total from operaciones where id = $1", [v1]);
decir(t1.total === total1.total, "el total de la venta no cambia");
const b1 = await una("select usuario_id, detalle from bitacora where accion = 'venta.medio_corregido' and entidad_id = $1", [v1]);
decir(b1 && b1.usuario_id === dueno.id && b1.detalle.de === "debito" && b1.detalle.a === "efectivo" && b1.detalle.motivo === "se tocó mal",
  "queda en la bitácora: quién, de qué a qué y por qué");

console.log("\nPagada en partes");
const v2 = await vender([{ medio: "efectivo", monto: 1000 }, { medio: "debito", monto: 1700 }]);
const [, p2deb] = await pagosDe(v2);
await comoDe(dueno.id);
await c.query(corregir, [p2deb.id, "efectivo", null]);
await comoAdmin();
const m2 = await movsDe(v2);
decir(m2.every((m) => m.medio === "efectivo") && m2.map((m) => Number(m.monto)).join() === "1000,1700",
  "corrige el pago elegido y su ingreso, sin tocar el otro");

console.log("\nLo que no se deja");
const v3 = await vender([{ medio: "debito", monto: 500 }]);
const [p3] = await pagosDe(v3);
await comoDe(dueno.id);
await falla(corregir, [p3.id, "debito", null], "P0020", "al mismo medio que ya tiene");
await falla(corregir, [p3.id, "viejo", null], "P0020", "a un medio apagado");
await falla(corregir, [p3.id, "inventado", null], "P0020", "a un medio que el comercio no tiene");
await falla(corregir, [p3.id, "credito", null], "P0024", "a un medio con recargo (cambiaría el total)");
await falla(corregir, [p3.id, "cuenta_corriente", null], "P0024", "a cuenta corriente");
if (ajeno) await falla(corregir, [ajeno.id, "efectivo", null], "P0020", "un pago de otro comercio no existe");
await comoAdmin();

const v4 = await vender([{ medio: "cuenta_corriente", monto: 800 }], { cliente: cli.id });
const [p4] = await pagosDe(v4);
await comoDe(dueno.id);
await falla(corregir, [p4.id, "efectivo", null], "P0024", "desde cuenta corriente");
await comoAdmin();

const v5 = await vender([{ medio: "credito", monto: 1100, recargo: 100 }]);
const [p5] = await pagosDe(v5);
await c.query("update pagos set recargo = 100 where id = $1", [p5.id]);
await comoDe(dueno.id);
await falla(corregir, [p5.id, "efectivo", null], "P0024", "un cobro que tuvo recargo");
await comoAdmin();

const ses2 = await una("insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 0) returning id", [emp.id, suc.id]);
const v6 = await vender([{ medio: "debito", monto: 900 }], { sesion: ses2.id });
const [p6] = await pagosDe(v6);
await c.query("update sesiones_caja set cerrada_en = now() where id = $1", [ses2.id]);
await comoDe(dueno.id);
await falla(corregir, [p6.id, "efectivo", null], "P0025", "con la caja de esa venta cerrada");
await comoAdmin();
decir((await pagosDe(v6))[0].medio === "debito", "y el pago queda como estaba");

if (cajero) {
  await comoDe(cajero.id);
  await falla(corregir, [p3.id, "efectivo", null], "P0021", "un cajero de fábrica (sin anular) no puede");
  await comoAdmin();
} else {
  /* Sin cajero en Bnitori, al dueño se le apaga `anular` como excepción
     de su persona (perfiles.permisos); se deshace con todo lo demás.
     Sin identidad: con la del dueño todavía puesta, la base no deja que
     nadie se cambie sus propios permisos. */
  await c.query("select set_config('request.jwt.claims', '', true)");
  await c.query("update perfiles set permisos = coalesce(permisos, '{}'::jsonb) || '{\"anular\": false}' where id = $1", [dueno.id]);
  await comoDe(dueno.id);
  await falla(corregir, [p3.id, "efectivo", null], "P0021", "sin el permiso de anular no se puede");
  await comoAdmin();
}

await c.query("rollback");
await c.end();
console.log(fallas ? `\n${fallas} fallaron.` : "\nTodo bien. Nada quedó en la base.");
process.exitCode = fallas ? 1 : 0;
