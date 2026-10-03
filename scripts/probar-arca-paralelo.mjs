/* ============================================================
   PRUEBA · varios comercios facturando a la vez (03/10/2026)
   ============================================================

   Antes de abrir el registro solo, la pregunta era si Genez aguanta
   muchos comercios facturando al mismo tiempo. Esta prueba crea 8
   comercios temporales, cada uno con su punto de venta en el ARCA de
   homologación, les carga 3 ventas y factura las 24 a la vez: los 8
   en paralelo y, dentro de cada uno, dos cajas pidiendo juntas.

   Lo que prueba: que todas terminen con CAE, que no se repita un número
   en una serie, que el choque de dos cajas del mismo comercio se
   resuelva reintentando y que no se mezclen comercios.

   Lo que no puede probar: en producción cada comercio habla con ARCA
   directo, con su certificado y su CUIT. Acá todos van por Afip SDK con
   el CUIT de pruebas, que comparten todos sus usuarios; por eso cada
   comercio usa un punto de venta propio y alto, para no pisarse con
   nadie.

   No puede ir en una transacción: la facturación va por otra conexión
   (supabase-js) y no vería lo que no está confirmado. Los comercios se
   crean de verdad y se borran al final, pase lo que pase. Super 25 no
   se toca. Gasta unas 30 consultas de la cuenta de Afip SDK.

     node scripts/probar-arca-paralelo.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { facturarPendientes } from "../api/arca/_arca.js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
if (!env.AFIP_ACCESS_TOKEN || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Falta AFIP_ACCESS_TOKEN o SUPABASE_SERVICE_ROLE_KEY en el .env.");
  process.exit(1);
}
process.env.AFIP_ACCESS_TOKEN = env.AFIP_ACCESS_TOKEN;

const COMERCIOS = 8;
const VENTAS = 3;
/* Puntos de venta altos y raros: el CUIT de pruebas lo usa mucha gente,
   casi siempre con el 1. */
const PV_BASE = 4700 + Math.floor(Math.random() * 200) * 10;

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
/* Una prueba cortada dejó una vez una sesión abierta en producción. */
await c.query("set idle_in_transaction_session_timeout = '30s'");
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

const ids = [];
try {
  /* Los comercios, sus conexiones y sus ventas. */
  const comercios = [];
  for (let i = 0; i < COMERCIOS; i++) {
    const { rows: [e] } = await c.query(
      "insert into empresas (nombre, config) values ($1, $2) returning id",
      [`Prueba paralela ${i + 1} (se borra sola)`, JSON.stringify({ fiscal: { condicion: "MONOTRIBUTO" } })]
    );
    ids.push(e.id);
    await c.query("insert into arca_conexiones (empresa_id, punto_venta) values ($1, $2)", [e.id, PV_BASE + i]);
    const ventas = [];
    for (let v = 0; v < VENTAS; v++) {
      const id = randomUUID();
      await c.query(
        "insert into operaciones (id, empresa_id, tipo, total, comprobante, fecha) values ($1, $2, 'venta', $3, $4, now() - interval '1 hour' + $5 * interval '1 minute')",
        [id, e.id, 100 + i * 10 + v, JSON.stringify({ fiscal: true }), v]
      );
      ventas.push(id);
    }
    comercios.push({ id: e.id, pv: PV_BASE + i, ventas });
  }
  console.log(`\n${COMERCIOS} comercios temporales, puntos de venta ${PV_BASE} a ${PV_BASE + COMERCIOS - 1}, ${COMERCIOS * VENTAS} ventas\n`);

  /* Todo a la vez: 8 comercios, dos cajas cada uno. */
  const t0 = Date.now();
  const ronda = await Promise.all(comercios.flatMap((co) => [1, 2].map(async (caja) => {
    const t = Date.now();
    try {
      const r = await facturarPendientes({ admin, empresaId: co.id });
      return { co, caja, ms: Date.now() - t, autorizadas: r.autorizadas.length, error: r.error || null };
    } catch (e) {
      return { co, caja, ms: Date.now() - t, autorizadas: 0, error: e.message };
    }
  })));
  const msRonda = Date.now() - t0;
  const enLaRonda = ronda.reduce((s, x) => s + x.autorizadas, 0);
  const errores = ronda.filter((x) => x.error);
  console.log(`Ronda en paralelo: ${enLaRonda} de ${COMERCIOS * VENTAS} con CAE en ${(msRonda / 1000).toFixed(1)} s`);
  for (const e of errores) console.log(`     caja ${e.caja} del comercio ${comercios.indexOf(e.co) + 1}: ${e.error}`);

  /* Lo que haya quedado por el choque entre cajas, como lo haría la
     cola de la caja al reintentar. */
  const t1 = Date.now();
  const reintento = await Promise.all(comercios.map((co) => facturarPendientes({ admin, empresaId: co.id }).catch((e) => ({ autorizadas: [], error: e.message }))));
  const enReintento = reintento.reduce((s, x) => s + x.autorizadas.length, 0);
  console.log(`Reintento: ${enReintento} más en ${((Date.now() - t1) / 1000).toFixed(1)} s\n`);

  /* Lo que quedó en la base. */
  const { rows } = await c.query(
    "select empresa_id, punto_venta, numero, estado, cae, operacion_id from comprobantes where empresa_id = any($1)",
    [ids]
  );
  const autorizados = rows.filter((r) => r.estado === "autorizado");
  decir(autorizados.length === COMERCIOS * VENTAS, `las ${COMERCIOS * VENTAS} ventas terminaron con CAE (${autorizados.length})`);
  decir(autorizados.every((r) => /^\d{14}$/.test(String(r.cae))), "todos los CAE tienen 14 dígitos");

  const porSerie = new Map();
  for (const r of autorizados) {
    const k = `${r.empresa_id}|${r.punto_venta}`;
    porSerie.set(k, [...(porSerie.get(k) || []), Number(r.numero)]);
  }
  const repetidos = [...porSerie.values()].some((ns) => new Set(ns).size !== ns.length);
  decir(!repetidos, "ningún número repetido en una misma serie");

  const porVenta = new Map();
  for (const r of autorizados) porVenta.set(r.operacion_id, (porVenta.get(r.operacion_id) || 0) + 1);
  decir([...porVenta.values()].every((n) => n === 1), "ninguna venta facturada dos veces");

  const mezclados = comercios.some((co) => autorizados.some((r) => r.empresa_id === co.id && !co.ventas.includes(r.operacion_id)));
  decir(!mezclados, "cada comprobante quedó en el comercio de su venta");
  decir(comercios.every((co) => autorizados.every((r) => r.empresa_id !== co.id || r.punto_venta === co.pv)), "cada comercio facturó en su punto de venta");

  const pendientes = rows.filter((r) => r.estado === "pendiente").length;
  decir(pendientes === 0, `sin comprobantes colgados en pendiente (${pendientes})`);

  const tiempos = ronda.map((x) => x.ms).sort((a, b) => a - b);
  console.log(`\nTiempo por caja en la ronda: el más rápido ${(tiempos[0] / 1000).toFixed(1)} s, la mediana ${(tiempos[Math.floor(tiempos.length / 2)] / 1000).toFixed(1)} s, el más lento ${(tiempos[tiempos.length - 1] / 1000).toFixed(1)} s`);
} catch (e) {
  decir(false, `la prueba se cortó: ${e.message}`);
} finally {
  if (ids.length) {
    await c.query("delete from comprobantes where empresa_id = any($1)", [ids]);
    await c.query("delete from empresas where id = any($1)", [ids]);
    const { rows: [q] } = await c.query("select count(*)::int n from empresas where id = any($1)", [ids]);
    console.log(`\nLimpieza: ${ids.length} comercios temporales borrados (quedan ${q.n})`);
  }
  await c.end();
}

console.log(`\n${fallas ? `${fallas} con problemas` : "todo en verde"}`);
process.exit(fallas ? 1 : 0);
