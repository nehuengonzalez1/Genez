/* ============================================================
   PRUEBA · la factura electrónica (0082 y api/arca/)
   ============================================================

   Tres partes, de menos a más dependencias:

   1. La base. Que un comprobante autorizado no se toque, que no haya dos
      pendientes en la misma serie —el candado de la numeración— y que
      una venta no tenga dos facturas. Corre como administrador y dentro
      de una transacción que se deshace.

   2. Los permisos. Que un usuario de comercio pueda leer sus
      comprobantes y no pueda escribir uno, ni conectarse solo con ARCA.
      Es la razón de ser de 0082: un CAE lo escribe el servidor con la
      respuesta de ARCA en la mano, o nadie.

   3. ARCA de verdad, contra homologación y con el CUIT de pruebas de
      Afip SDK. Necesita AFIP_ACCESS_TOKEN y SUPABASE_SERVICE_ROLE_KEY en
      el .env; sin eso se saltea. Crea un comercio temporal, factura, y lo
      borra al final.

     node scripts/probar-arca.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { facturarVenta, facturarPendientes, ErrorArca, CUIT_PRUEBAS, hoyEnArgentina } from "../api/arca/_arca.js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];
let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* Corre `hacer` y dice si Postgres lo rechazó. Con savepoint para que un
   error no deje la transacción entera inservible. */
async function rechaza(hacer) {
  await c.query("savepoint p");
  try { await hacer(); await c.query("release savepoint p"); return false; }
  catch { await c.query("rollback to savepoint p"); return true; }
}

const SUPER = await una("select id from empresas where nombre = 'Super 25'");

/* Un comprobante mínimo, con lo que se le quiera cambiar encima. */
const comprobante = (op, extra = {}) => ({
  empresa_id: SUPER.id, operacion_id: op, modo: "homologacion", cuit: CUIT_PRUEBAS, punto_venta: 1,
  tipo: 11, letra: "C", numero: 1, estado: "pendiente", fecha: "2026-09-22", total: 100, neto: 100,
  doc_tipo: 99, condicion_receptor: 5, ...extra,
});
const insertar = (fila) => {
  const k = Object.keys(fila);
  return c.query(`insert into comprobantes (${k.join(", ")}) values (${k.map((_, i) => `$${i + 1}`).join(", ")}) returning id`, Object.values(fila));
};
const venta = async () => {
  const id = randomUUID();
  await c.query("insert into operaciones (id, empresa_id, tipo, total) values ($1, $2, 'venta', 100)", [id, SUPER.id]);
  return id;
};

/* ------------------------------------------------------------
   1 · La base
   ------------------------------------------------------------ */
console.log("\nLa base");
await c.query("begin");
try {
  const v1 = await venta();
  const v2 = await venta();
  const v3 = await venta();
  const v4 = await venta();

  decir(await rechaza(() => insertar(comprobante(v1, { estado: "autorizado" }))),
    "un autorizado sin CAE no entra");

  const { rows: [p1] } = await insertar(comprobante(v1));
  decir(await rechaza(() => insertar(comprobante(v2, { numero: 2 }))),
    "dos pendientes en la misma serie chocan: es el candado de la numeración");
  decir(!(await rechaza(() => insertar(comprobante(v2, { numero: 1, tipo: 6, letra: "B" })))),
    "en otra serie (otro tipo) sí se puede tener uno pendiente");

  decir(await rechaza(() => c.query("update comprobantes set total = 999 where id = $1", [p1.id])),
    "de un pendiente no se cambia el importe");
  await c.query("update comprobantes set estado = 'autorizado', cae = '12345678901234', cae_vto = '2026-10-02' where id = $1", [p1.id]);
  const r = await una("select resuelto_en from comprobantes where id = $1", [p1.id]);
  decir(r.resuelto_en != null, "al resolverse queda la hora");

  decir(await rechaza(() => c.query("update comprobantes set cae = '99999999999999' where id = $1", [p1.id])),
    "un autorizado no se toca, ni como administrador");
  decir(await rechaza(() => insertar(comprobante(v1, { numero: 5 }))),
    "una venta con factura no tiene otra");
  decir(await rechaza(() => insertar(comprobante(v3, { numero: 1, estado: "autorizado", cae: "1", cae_vto: "2026-10-02" }))),
    "el mismo número autorizado dos veces en la serie no entra");

  const { rows: [pr] } = await insertar(comprobante(v4, { modo: "produccion", cuit: "20111111112", numero: 7 }));
  decir(await rechaza(() => c.query("delete from comprobantes where id = $1", [pr.id])),
    "uno de producción no se borra");
  decir(await rechaza(() => c.query("delete from operaciones where id = $1", [v1])),
    "una venta con comprobante no se borra");

  decir(await rechaza(() => c.query("insert into arca_conexiones (empresa_id, modo, punto_venta) values ($1, 'produccion', 3)", [SUPER.id])),
    "producción sin CUIT no se conecta");
  decir(await rechaza(() => c.query("insert into arca_conexiones (empresa_id, punto_venta) values ($1, 0)", [SUPER.id])),
    "el punto de venta 0 no existe");
} finally {
  await c.query("rollback");
}

/* ------------------------------------------------------------
   2 · Los permisos
   ------------------------------------------------------------ */
console.log("\nLos permisos");
const axel = await una("select id from auth.users where email = 'axel@super25.com'");
if (!axel) {
  console.log("  --   no existe axel@super25.com, se saltea");
} else {
  await c.query("begin");
  try {
    const v = await venta();
    await c.query("insert into arca_conexiones (empresa_id, punto_venta) values ($1, 1)", [SUPER.id]);
    const { rows: [p] } = await insertar(comprobante(v));

    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: axel.id, role: "authenticated" })]);

    decir((await una("select count(*)::int n from comprobantes where id = $1", [p.id])).n === 1,
      "el comercio ve sus comprobantes");
    decir((await una("select count(*)::int n from arca_conexiones where empresa_id = $1", [SUPER.id])).n === 1,
      "y con qué punto de venta factura");

    decir(await rechaza(() => insertar(comprobante(v, { numero: 9, tipo: 6, letra: "B", estado: "autorizado", cae: "1", cae_vto: "2026-10-02" }))),
      "no puede escribir un comprobante con un CAE propio");
    const u = await c.query("update comprobantes set estado = 'rechazado' where id = $1", [p.id]).catch(() => ({ rowCount: 0 }));
    decir(u.rowCount === 0, "no puede resolver uno pendiente");
    const w = await c.query("update arca_conexiones set punto_venta = 7 where empresa_id = $1", [SUPER.id]).catch(() => ({ rowCount: 0 }));
    decir(w.rowCount === 0, "no puede cambiar su CUIT ni su punto de venta");
  } finally {
    await c.query("rollback");
  }
}

/* ------------------------------------------------------------
   3 · ARCA, en homologación
   ------------------------------------------------------------ */
console.log("\nARCA (homologación)");
decir(/^\d{8}$/.test(hoyEnArgentina()) && hoyEnArgentina(new Date("2026-09-23T01:30:00Z")) === "20260922",
  "la fecha es la de Argentina: 22:30 del 22 no factura con fecha 23");

if (!env.AFIP_ACCESS_TOKEN || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("  --   falta AFIP_ACCESS_TOKEN o SUPABASE_SERVICE_ROLE_KEY en el .env, se saltea");
} else {
  process.env.AFIP_ACCESS_TOKEN = env.AFIP_ACCESS_TOKEN;
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  /* Un comercio de verdad en la base, porque supabase-js va por otra
     conexión y no ve lo que esta transacción no confirmó. Se borra al
     final pase lo que pase. */
  const { id: empresaId } = await una(
    `insert into empresas (nombre, config) values ('Prueba ARCA (se borra sola)', $1) returning id`,
    [JSON.stringify({ fiscal: { condicion: "MONOTRIBUTO" } })]
  );

  /* Las ventas llevan su hora a propósito, separadas por minutos: el
     orden de la numeración tiene que seguir el de las ventas y no el de
     inserción. */
  let minuto = 0;
  const ventaDe = async (total, comprobante = { fiscal: true }) => {
    const id = randomUUID();
    minuto++;
    await c.query(
      "insert into operaciones (id, empresa_id, tipo, total, comprobante, fecha) values ($1, $2, 'venta', $3, $4, now() - interval '1 hour' + $5 * interval '1 minute')",
      [id, empresaId, total, JSON.stringify(comprobante), minuto]
    );
    return id;
  };
  const numeroDe = async (op) => (await una("select numero from comprobantes where operacion_id = $1 and estado = 'autorizado'", [op]) || {}).numero;

  try {
    /* Tres facturas que "quedaron colgadas" sin internet, y un ticket en
       el medio. */
    const [f1, ticket, f2, f3] = [await ventaDe(1234.5), await ventaDe(500, {}), await ventaDe(10), await ventaDe(20)];

    let r = await facturarPendientes({ admin, empresaId });
    decir(r.error && /no está conectado/.test(r.error) && !r.autorizadas.length, "sin conexión con ARCA no factura nada");

    await c.query("insert into arca_conexiones (empresa_id, punto_venta) values ($1, 1)", [empresaId]);

    r = await facturarPendientes({ admin, empresaId });
    decir(!r.error && r.autorizadas.length === 3 && r.quedan === 0, `volvió ARCA: las 3 facturas tienen CAE (${r.error || "sin errores"})`);
    const [n1, n2, n3] = [await numeroDe(f1), await numeroDe(f2), await numeroDe(f3)];
    decir(n1 < n2 && n2 < n3, `en el orden en que se vendieron: ${n1}, ${n2}, ${n3}`);
    /* "Sin huecos" no se puede probar acá: el CUIT de pruebas lo comparten
       todos los usuarios de Afip SDK, y otro puede llevarse un número entre
       dos de los nuestros. Con el CUIT propio de un comercio, sí. */
    decir(!(await numeroDe(ticket)), "la venta con ticket no fiscal no se factura");

    const a = r.autorizadas.find((x) => x.operacionId === f1);
    decir(a && /^\d{14}$/.test(a.cae) && a.total === 1234.5 && a.letra === "C" && a.homologacion,
      `factura C por el total de la venta: CAE ${a && a.cae}`);

    let error = null;
    try { await facturarVenta({ admin, empresaId, operacionId: ticket }); } catch (e) { error = e; }
    decir(error instanceof ErrorArca && error.estado === 409, "ni pidiéndola suelta: un ticket no se convierte en factura");

    const v = await facturarVenta({ admin, empresaId, operacionId: f1 });
    decir(v.numero === n1, "reintentar una ya autorizada devuelve la misma, no emite otra");

    const vieja = await ventaDe(30, { fiscal: true, cae: "74300000000000" });
    r = await facturarPendientes({ admin, empresaId });
    decir(!r.autorizadas.length && !(await numeroDe(vieja)), "la venta con el CAE inventado de antes de 0082 no se factura");

    /* Dos cajas pidiendo a la vez sobre las mismas pendientes. */
    const [g1, g2] = [await ventaDe(40), await ventaDe(50)];
    const dos = await Promise.all([facturarPendientes({ admin, empresaId }), facturarPendientes({ admin, empresaId })]);
    const total = dos.reduce((s, x) => s + x.autorizadas.length, 0);
    const [m1, m2] = [await numeroDe(g1), await numeroDe(g2)];
    decir(m1 && m2 && m1 < m2, `dos cajas a la vez: ${total} autorizadas entre las dos, ${m1} y ${m2}, en orden`);

    error = null;
    try { await facturarVenta({ admin, empresaId: SUPER.id, operacionId: f2 }); } catch (e) { error = e; }
    decir(error instanceof ErrorArca && error.estado === 404, "la venta de otro comercio no se factura");
  } catch (e) {
    decir(false, `ARCA: ${e.message}`);
  } finally {
    await c.query("delete from comprobantes where empresa_id = $1", [empresaId]);
    await c.query("delete from empresas where id = $1", [empresaId]);
  }
}

await c.end();
console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exit(fallas ? 1 : 0);
