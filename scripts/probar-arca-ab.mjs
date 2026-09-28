/* ============================================================
   PRUEBA · la factura A y B contra el ARCA de pruebas (homologación)
   ============================================================

   probar-factura-ab.mjs mira el pedido con un ARCA de mentira; esta le
   pide el CAE de verdad al ARCA de homologación, con el CUIT compartido
   de Afip SDK. Es la única forma de saber que ARCA acepta el IVA por
   alícuota como lo arma desglosarIva: el redondeo, los códigos, lo
   exento, la nota asociada.

   ESCRIBE DE VERDAD EN LA BASE, Y SE LIMPIA POR ID
   ------------------------------------------------
   El servidor lee por supabase-js, otra conexión, y no ve lo que una
   transacción no confirmó. Así que, como la parte 3 de probar-arca.mjs,
   crea un comercio temporal y lo borra por su id al terminar, pase lo
   que pase. Nada se busca por nombre ni por fecha. Los CAE son de
   homologación: sin validez fiscal.

   Necesita AFIP_ACCESS_TOKEN y SUPABASE_SERVICE_ROLE_KEY en el .env.

     node scripts/probar-arca-ab.mjs
     node scripts/probar-arca-ab.mjs --pv=8

   EL PUNTO DE VENTA NO ES EL 1
   ----------------------------
   El CUIT de pruebas lo comparten todos los usuarios de Afip SDK, y si
   alguien emite con fecha futura, ese punto de venta queda trabado para
   el resto hasta esa fecha (error 10016). El 27/09/2026 el 1 tenía la
   última A y B con fecha 06/10; el 6, la última A de agosto. Si el 6
   también se traba, se elige otro con --pv.
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
if (!env.AFIP_ACCESS_TOKEN || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Falta AFIP_ACCESS_TOKEN o SUPABASE_SERVICE_ROLE_KEY en el .env.");
  process.exit(1);
}
process.env.AFIP_ACCESS_TOKEN = env.AFIP_ACCESS_TOKEN;
const { facturarVenta } = await import("../api/arca/_arca.js");

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* Un CUIT con el dígito verificador bien, para el comprador de la A. */
function cuitCon(base10) {
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const s = [...base10].reduce((t, d, i) => t + Number(d) * pesos[i], 0);
  const v = 11 - (s % 11);
  return v === 11 ? base10 + "0" : v === 10 ? null : base10 + v;
}
const PV = Number((process.argv.find((a) => a.startsWith("--pv=")) || "").slice(5)) || 6;
const CUIT_COMPRADOR = cuitCon("3071234567") || cuitCon("3071234568");

/* Lo que quede del comercio temporal, tabla por tabla. No se comparan
   conteos de toda la base: Super 25 puede estar vendiendo mientras
   corre. */
const restos = async (id) => (await una(`select
  (select count(*) from empresas where id = $1)::int as empresas,
  (select count(*) from operaciones where empresa_id = $1)::int as operaciones,
  (select count(*) from operacion_lineas where empresa_id = $1)::int as renglones,
  (select count(*) from comprobantes where empresa_id = $1)::int as comprobantes,
  (select count(*) from clientes where empresa_id = $1)::int as clientes,
  (select count(*) from arca_conexiones where empresa_id = $1)::int as conexiones`, [id]));

const { id: emp } = await una(
  `insert into empresas (nombre, config) values ('Prueba ARCA A/B (se borra sola)', $1) returning id`,
  [JSON.stringify({ fiscal: { condicion: "RI", razonSocial: "Prueba A/B", cuit: "20409378472" } })]
);

/* Una venta confirmada con sus renglones. `renglon_con_su_iva` (0097)
   deja la alícuota como viene porque no hay producto. */
let minuto = 0;
const venta = async ({ total, lineas, cliente = null, tipo = "venta", origen = null, comprobante = { fiscal: true } }) => {
  const id = randomUUID();
  minuto++;
  await c.query(
    `insert into operaciones (id, empresa_id, tipo, total, subtotal, cliente_id, comprobante, origen_id, fecha)
     values ($1, $2, $3, $4, $5, $6, $7, $8, now() - interval '1 hour' + $9 * interval '1 minute')`,
    [id, emp, tipo, total, lineas.reduce((s, l) => s + l.total, 0), cliente, JSON.stringify(comprobante), origen, minuto]
  );
  const ids = [];
  for (const l of lineas) {
    ids.push((await una(
      `insert into operacion_lineas (operacion_id, empresa_id, descripcion, cantidad, precio_unitario, iva, iva_condicion, total, origen_linea_id)
       values ($1, $2, 'x', 1, $3, $4, $5, $3, $6) returning id`,
      [id, emp, l.total, l.iva, l.cond || "gravado", l.origen || null]
    )).id);
  }
  return { id, lineas: ids };
};

try {
  await c.query("insert into arca_conexiones (empresa_id, punto_venta) values ($1, $2)", [emp, PV]);
  const { id: cli } = await una(
    "insert into clientes (empresa_id, razon_social, condicion, tipo_doc, doc) values ($1, 'Comprador RI de prueba', 'RI', 'CUIT', $2) returning id",
    [emp, CUIT_COMPRADOR]
  );

  console.log("\nFactura B a consumidor final: 21%, 10,5% y exento, con 10% de descuento");
  const b = await venta({ total: 20880, lineas: [{ total: 17000, iva: 21 }, { total: 1200, iva: 10.5 }, { total: 5000, iva: 0, cond: "exento" }] });
  try {
    const f = await facturarVenta({ admin, empresaId: emp, operacionId: b.id });
    decir(f.letra === "B" && f.tipo === 6 && /^\d{14}$/.test(f.cae), `ARCA autorizó la B ${f.punto_venta}-${f.numero}, CAE ${f.cae}`);
    const d = f.detalle_iva;
    decir(d && d.alicuotas.length === 2 && d.exento === 4500 && Number(f.neto) === d.neto && Number(f.iva) === d.iva,
      `guardó el detalle: neto ${f.neto}, IVA ${f.iva}, exento ${d && d.exento}`);
  } catch (e) { decir(false, `la B: ${e.message}`); }

  console.log("\nFactura A a un responsable inscripto (CUIT " + CUIT_COMPRADOR + ")");
  const a = await venta({ total: 2315, cliente: cli, lineas: [{ total: 1210, iva: 21 }, { total: 1105, iva: 10.5 }] });
  let fa = null;
  try {
    fa = await facturarVenta({ admin, empresaId: emp, operacionId: a.id });
    decir(fa.letra === "A" && fa.tipo === 1 && fa.doc_tipo === 80 && /^\d{14}$/.test(fa.cae), `ARCA autorizó la A ${fa.punto_venta}-${fa.numero}, CAE ${fa.cae}`);
    decir(Number(fa.neto) === 2000 && Number(fa.iva) === 315, "neto 2.000 e IVA 315, como la cuenta a mano");
  } catch (e) { decir(false, `la A: ${e.message}`); }

  console.log("\nNota de crédito A: se devuelve lo del 21%");
  if (fa) {
    const nc = await venta({
      tipo: "devolucion", total: 1210, cliente: cli, origen: a.id, comprobante: { fiscal: true, nota: "credito" },
      lineas: [{ total: 1210, iva: 21, origen: a.lineas[0] }],
    });
    try {
      const n = await facturarVenta({ admin, empresaId: emp, operacionId: nc.id });
      decir(n.letra === "A" && n.tipo === 3 && /^\d{14}$/.test(n.cae), `ARCA autorizó la nota de crédito A ${n.punto_venta}-${n.numero}, CAE ${n.cae}`);
    } catch (e) { decir(false, `la nota de crédito A: ${e.message}`); }
  } else {
    decir(false, "la nota de crédito A no se probó: no hubo factura A");
  }

  /* RG 5003: a un monotributista, A con condición 6 (Responsable
     Monotributo). La leyenda de la Ley 27.618 es del papel: ARCA no la
     pide en el web service. */
  console.log("\nFactura A a un monotributista (RG 5003)");
  const { id: mono } = await una(
    "insert into clientes (empresa_id, razon_social, condicion, tipo_doc, doc) values ($1, 'Monotributista de prueba', 'MONOTRIBUTO', 'CUIT', $2) returning id",
    [emp, cuitCon("2030123456") || cuitCon("2030123457")]
  );
  const am = await venta({ total: 1210, cliente: mono, lineas: [{ total: 1210, iva: 21 }] });
  try {
    const f = await facturarVenta({ admin, empresaId: emp, operacionId: am.id });
    decir(f.letra === "A" && f.tipo === 1 && f.condicion_receptor === 6 && /^\d{14}$/.test(f.cae), `ARCA autorizó la A ${f.punto_venta}-${f.numero} a un monotributista, CAE ${f.cae}`);
  } catch (e) { decir(false, `la A a un monotributista: ${e.message}`); }

  /* RG 1575: un inscripto en clase M. Necesita 0099 (tipos 51 a 53).
     El CUIT de pruebas puede no estar habilitado para M en ARCA: si lo
     rechaza por eso, es un límite de homologación y no de Genez. */
  console.log("\nFactura M (clase M, RG 1575)");
  await c.query(`update empresas set config = jsonb_set(config, '{fiscal,claseInscripto}', '"M"') where id = $1`, [emp]);
  const vm = await venta({ total: 2315, cliente: cli, lineas: [{ total: 1210, iva: 21 }, { total: 1105, iva: 10.5 }] });
  try {
    const f = await facturarVenta({ admin, empresaId: emp, operacionId: vm.id });
    decir(f.letra === "M" && f.tipo === 51 && /^\d{14}$/.test(f.cae), `ARCA autorizó la M ${f.punto_venta}-${f.numero}, CAE ${f.cae}`);
  } catch (e) { decir(false, `la M: ${e.message}`); }
} catch (e) {
  decir(false, `se cortó: ${e.message}`);
} finally {
  await c.query("delete from comprobantes where empresa_id = $1", [emp]);
  await c.query("delete from empresas where id = $1", [emp]);
  const quedan = await restos(emp);
  decir(Object.values(quedan).every((n) => n === 0), `no quedó nada del comercio temporal: ${JSON.stringify(quedan)}`);
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
