/* ============================================================
   PRUEBA · el QR dinámico de Mercado Pago (0107)
   ============================================================

   Dos partes:
   - api/mp/qr.js contra un Mercado Pago de mentira: qué le manda al
     armar la orden, cómo traduce cada estado, que cancelar una orden ya
     pagada devuelva "pagada" y no la pierda, y los errores.
   - 0107 en una transacción que se deshace: la columna, y que la lea la
     sesión de un usuario como la lee cargarCajas.

   No habla con Mercado Pago de verdad ni toca ningún comercio: el pago
   real se prueba a mano en "Super 25 Pruebas", nunca en Super 25.

     node scripts/probar-qr-dinamico.mjs
   ============================================================ */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import pg from "pg";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

/* ---------- El servidor, con Mercado Pago de mentira ---------- */
const dir = mkdtempSync(join(tmpdir(), "genez-qr-"));
const falsoMp = join(dir, "mp-falso.js");
writeFileSync(falsoMp, `
export class ErrorMP extends Error { constructor(m, e = 400) { super(m); this.estado = e; } }
export async function comercioDe() { return { admin: {}, empresaId: "e1", yo: {} }; }
export async function credencialDe() { return globalThis.__sinCuenta ? null : { token: "TOKEN-DEL-COMERCIO", cuentaId: "1" }; }
`);
const falsoComun = join(dir, "comun-falso.js");
writeFileSync(falsoComun, "export const origenValido = () => true;");
const salida = join(dir, "qr.mjs");
await build({
  entryPoints: [resolve("api/mp/qr.js")], bundle: true, platform: "node", format: "esm", outfile: salida, logLevel: "error",
  plugins: [{ name: "falsos", setup(b) {
    b.onResolve({ filter: /\/_mp\.js$/ }, () => ({ path: falsoMp }));
    b.onResolve({ filter: /\/_comun\.js$/ }, () => ({ path: falsoComun }));
  } }],
});
const { default: handler } = await import(pathToFileURL(salida).href);

const pedidos = [];
let respuestas = [];
globalThis.fetch = async (url, op = {}) => {
  pedidos.push({ url, metodo: op.method || "GET", headers: op.headers || {}, cuerpo: op.body ? JSON.parse(op.body) : null });
  const [estado, cuerpo] = respuestas.shift() || [200, {}];
  return { ok: estado < 300, status: estado, json: async () => cuerpo };
};
const llamar = (cuerpo) => new Promise((ok) => {
  const res = { status(s) { this.s = s; return this; }, json(d) { ok({ estado: this.s, d }); } };
  handler({ method: "POST", headers: {}, body: cuerpo }, res);
});
const orden = (status, extra = {}) => ({ id: "ORD1", status, type_response: { qr_data: "00020101021243650016COM.MERCADOLIBRE" }, transactions: { payments: [{ id: "PAY1", status: extra.pago || "created" }] }, ...extra });

console.log("\nArmar la orden");
respuestas = [[201, orden("created")]];
let r = await llamar({ accion: "crear", monto: 1500, referencia: "venta-123", cajaMp: "CAJA1" });
const p = pedidos.at(-1);
decir(r.estado === 200 && r.d.orden === "ORD1" && r.d.qr.startsWith("0002"), "devuelve la orden y el texto del QR");
decir(p.url.endsWith("/v1/orders") && p.metodo === "POST", "POST a /v1/orders");
decir(p.headers.Authorization === "Bearer TOKEN-DEL-COMERCIO", "con el token del comercio");
decir(p.headers["X-Idempotency-Key"] === "venta-123", "la referencia de la venta es la clave de idempotencia: un reintento no arma dos órdenes");
decir(p.cuerpo.type === "qr" && p.cuerpo.total_amount === "1500.00" && p.cuerpo.config.qr.mode === "dynamic" && p.cuerpo.config.qr.external_pos_id === "CAJA1",
  "tipo qr, $1500.00, modo dinámico, sobre la caja elegida");
decir(p.cuerpo.expiration_time === "PT10M", "vence a los diez minutos");

r = await llamar({ accion: "crear", monto: 1500, referencia: "x" });
decir(r.estado === 400 && /Ajustes → Cajas/.test(r.d.error.message), "sin caja de Mercado Pago elegida: lo dice y dónde se elige");
r = await llamar({ accion: "crear", monto: 0, cajaMp: "CAJA1" });
decir(r.estado === 400, "monto cero: no");
const antes = pedidos.length;
r = await llamar({ accion: "crear", monto: "abc", cajaMp: "CAJA1" });
decir(r.estado === 400 && pedidos.length === antes, "monto que no es número: ni pregunta");

console.log("\nEl estado");
const estados = [
  [orden("created"), "esperando"],
  [orden("processed", { pago: "processed", status_detail: "accredited" }), "pagada"],
  [orden("expired"), "vencida"],
  [orden("canceled"), "cancelada"],
  [orden("failed", { pago: "failed" }), "rechazada"],
];
for (const [o, esperado] of estados) {
  respuestas = [[200, o]];
  r = await llamar({ accion: "estado", orden: "ORD1" });
  decir(r.d.estado === esperado, `${o.status} → ${esperado}`);
}
respuestas = [[200, orden("processed", { pago: "processed", status_detail: "accredited" })]];
r = await llamar({ accion: "estado", orden: "ORD1" });
decir(r.d.pago === "PAY1", "pagada trae el número de pago");

console.log("\nCancelar");
respuestas = [[409, { message: "order already processed" }], [200, orden("processed", { pago: "processed", status_detail: "accredited" })]];
r = await llamar({ accion: "cancelar", orden: "ORD1" });
decir(r.d.estado === "pagada", "si ya se pagó no se puede cancelar: contesta pagada, y la venta se registra igual");
respuestas = [[200, orden("canceled")]];
r = await llamar({ accion: "cancelar", orden: "ORD1" });
decir(r.d.estado === "cancelada" && pedidos.at(-1).url.endsWith("/v1/orders/ORD1/cancel"), "cancelada de verdad");

console.log("\nLas cajas de la cuenta");
respuestas = [[200, { results: [{ id: 1, name: "Mostrador", external_id: "CAJA1", store_id: 9 }, { id: 2, name: "Vieja" }] }]];
r = await llamar({ accion: "cajas" });
decir(r.d.cajas.length === 2 && r.d.cajas[0].externo === "CAJA1" && r.d.cajas[1].externo === null, "trae todas; la que no tiene external_id viene marcada");

console.log("\nErrores");
respuestas = [[401, { message: "invalid token" }]];
r = await llamar({ accion: "estado", orden: "ORD1" });
decir(r.estado === 409 && /Volvé a conectarla/.test(r.d.error.message), "token vencido: dice que se reconecte");
globalThis.__sinCuenta = true;
r = await llamar({ accion: "crear", monto: 10, cajaMp: "CAJA1" });
decir(r.estado === 409 && /no tiene una cuenta/.test(r.d.error.message), "sin cuenta conectada: 409, y el mostrador cobra como antes");
globalThis.__sinCuenta = false;
r = await llamar({ accion: "otra" });
decir(r.estado === 400, "acción desconocida");
rmSync(dir, { recursive: true, force: true });

/* ---------- 0107 ---------- */
console.log("\nLa base");
const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  const hay = (await c.query("select count(*)::int n from information_schema.columns where table_name = 'cajas' and column_name = 'mp_caja'")).rows[0].n;
  if (!hay) await c.query(readFileSync("supabase/migrations/0107_qr_dinamico.sql", "utf8"));
  const pruebas = (await c.query("select id from empresas where nombre = 'Super 25 Pruebas'")).rows[0];
  if (!pruebas) throw new Error("no está Super 25 Pruebas");
  const antesN = (await c.query("select count(*)::int n from cajas where mp_caja is not null")).rows[0].n;
  decir(!hay ? antesN === 0 : true, hay ? "0107 ya estaba aplicada" : "todas las cajas arrancan sin caja de Mercado Pago: cobran como antes");
  await c.query("update cajas set mp_caja = 'CAJA1' where empresa_id = $1", [pruebas.id]);
  const plataforma = (await c.query("select id from perfiles where es_plataforma limit 1")).rows[0].id;
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: plataforma, role: "authenticated" })]);
  const f = (await c.query("select id, nombre, orden, activa, sucursal_id, mp_caja from cajas where empresa_id = $1", [pruebas.id])).rows;
  decir(f.length === 1 && f[0].mp_caja === "CAJA1", "la consulta de cargarCajas trae mp_caja con la sesión de un usuario");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
