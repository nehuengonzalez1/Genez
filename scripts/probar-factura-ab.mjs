/* ============================================================
   PRUEBA · la factura A y B en el servidor, sin base y sin ARCA
   ============================================================

   `facturarVenta` (api/arca/_arca.js) arma el pedido a ARCA a partir de
   lo que lee de la base. Esta prueba le pasa una base de mentira en
   memoria y un ARCA de mentira que anota lo que le piden, y mira el
   pedido: qué letra, qué tipo, qué documento, qué IVA por alícuota, y
   qué queda guardado en el comprobante.

   No toca la base de verdad ni la red. Lo que no prueba: que ARCA acepte
   estos pedidos. Eso es homologación, con probar-arca.mjs.

     node scripts/probar-factura-ab.mjs
   ============================================================ */

import { facturarVenta, ErrorArca } from "../api/arca/_arca.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

/* ---------- Una base de mentira con la forma de supabase-js ---------- */
function baseDeMentira(tablas) {
  let secuencia = 0;
  const from = (tabla) => {
    const filtros = [];
    let op = "select", datos = null;
    const filas = () => (tablas[tabla] ||= []);
    const pasan = (f) => filtros.every(([k, v, neg]) => (neg ? f[k] !== v : f[k] === v));
    const correr = () => {
      if (op === "insert") {
        const fila = { id: `c${++secuencia}`, creado_en: new Date().toISOString(), estado: "pendiente", ...datos };
        filas().push(fila);
        return [fila];
      }
      const hallados = filas().filter(pasan);
      if (op === "update") hallados.forEach((f) => Object.assign(f, datos));
      return hallados;
    };
    const q = {
      select: () => q,
      eq: (k, v) => (filtros.push([k, v]), q),
      neq: (k, v) => (filtros.push([k, v, true]), q),
      match: (o) => (Object.entries(o).forEach(([k, v]) => filtros.push([k, v])), q),
      insert: (d) => ((op = "insert"), (datos = d), q),
      update: (d) => ((op = "update"), (datos = d), q),
      single: async () => { const r = correr(); return r.length === 1 ? { data: r[0], error: null } : { data: null, error: new Error(`${tabla}: ${r.length} filas`) }; },
      maybeSingle: async () => ({ data: correr()[0] || null, error: null }),
      then: (ok, mal) => Promise.resolve({ data: correr(), error: null }).then(ok, mal),
    };
    return q;
  };
  return { from };
}

/* ---------- Un ARCA de mentira que anota lo que le piden ---------- */
function arcaDeMentira() {
  const pedidos = [];
  const ultimos = {};
  return {
    pedidos,
    ElectronicBilling: {
      getLastVoucher: async (pv, tipo) => ultimos[tipo] || 0,
      createVoucher: async (p) => { pedidos.push(p); ultimos[p.CbteTipo] = p.CbteDesde; return { CAE: "74000000000001", CAEFchVto: "2026-10-07" }; },
      getVoucherInfo: async () => null,
    },
  };
}

const EMP = "emp", CLI_RI = "cli-ri", CLI_DNI = "cli-dni";

function escenario({ condicion = "RI", lineas, total, cliente = null, extra = {} }) {
  const tablas = {
    empresas: [{ id: EMP, config: { fiscal: { condicion, cuit: "20409378472", razonSocial: "Prueba SA" } } }],
    arca_conexiones: [{ empresa_id: EMP, modo: "homologacion", punto_venta: 1 }],
    clientes: [
      { id: CLI_RI, empresa_id: EMP, condicion: "RI", tipo_doc: "CUIT", doc: "30-71234567-1" },
      { id: CLI_DNI, empresa_id: EMP, condicion: "RI", tipo_doc: "DNI", doc: "30123456" },
    ],
    operaciones: [{ id: "v1", empresa_id: EMP, tipo: "venta", estado: "confirmada", total, cliente_id: cliente, comprobante: { fiscal: true }, origen_id: null, ...extra }],
    operacion_lineas: lineas.map((l) => ({ operacion_id: "v1", empresa_id: EMP, ...l })),
    comprobantes: [],
  };
  return { tablas, admin: baseDeMentira(tablas), afip: arcaDeMentira() };
}

const renglon = (total, iva = 21, iva_condicion = "gravado") => ({ total, iva, iva_condicion });
const pedir = async (s, operacionId = "v1") => {
  try { return { c: await facturarVenta({ admin: s.admin, empresaId: EMP, operacionId, afip: s.afip }) }; }
  catch (e) { return { e }; }
};

console.log("\nResponsable inscripto a responsable inscripto: A");
let s = escenario({ lineas: [renglon(1210), renglon(1105, 10.5)], total: 2315, cliente: CLI_RI });
let r = await pedir(s);
let p = s.afip.pedidos[0];
decir(!r.e && r.c.letra === "A" && p && p.CbteTipo === 1, `factura A, tipo 1 (${r.e ? r.e.message : r.c.letra})`);
decir(p && p.DocTipo === 80 && p.DocNro === 30712345671 && p.CondicionIVAReceptorId === 1, "al CUIT del comprador, condición 1 (RI)");
decir(p && p.ImpNeto === 2000 && p.ImpIVA === 315 && p.ImpTotal === 2315 && p.ImpOpEx === 0 && p.ImpTotConc === 0, "neto 2.000, IVA 315, total 2.315");
decir(p && p.Iva && p.Iva.length === 2 && p.Iva.some((a) => a.Id === 4 && a.BaseImp === 1000 && a.Importe === 105) && p.Iva.some((a) => a.Id === 5 && a.BaseImp === 1000 && a.Importe === 210),
  "Iva: 1.000 + 105 al 10,5% (id 4) y 1.000 + 210 al 21% (id 5)");
decir(!r.e && Number(r.c.neto) === 2000 && Number(r.c.iva) === 315 && r.c.detalle_iva && r.c.detalle_iva.alicuotas.length === 2,
  "el comprobante guarda neto, IVA y el detalle por alícuota");

console.log("\nResponsable inscripto a consumidor final: B");
s = escenario({ lineas: [renglon(1210), renglon(500, 0, "exento")], total: 1710 });
r = await pedir(s);
p = s.afip.pedidos[0];
decir(!r.e && r.c.letra === "B" && p && p.CbteTipo === 6 && p.DocTipo === 99 && p.CondicionIVAReceptorId === 5, `factura B, tipo 6, sin identificar (${r.e ? r.e.message : r.c.letra})`);
decir(p && p.ImpNeto === 1000 && p.ImpIVA === 210 && p.ImpOpEx === 500 && p.Iva && p.Iva.length === 1, "la B también manda el IVA por alícuota; lo exento va en ImpOpEx");

console.log("\nLa A sin CUIT no sale");
s = escenario({ lineas: [renglon(1210)], total: 1210, cliente: CLI_DNI });
r = await pedir(s);
decir(r.e instanceof ErrorArca && /CUIT/.test(r.e.message), `se rechaza antes de pedir nada (${r.e && r.e.message})`);
decir(!s.afip.pedidos.length && !s.tablas.comprobantes.length, "no se le pidió nada a ARCA ni se reservó número");

console.log("\nUna alícuota que no existe no sale");
s = escenario({ lineas: [renglon(1110, 11)], total: 1110 });
r = await pedir(s);
decir(r.e instanceof ErrorArca && r.e.estado === 422 && !s.afip.pedidos.length && !s.tablas.comprobantes.length, `se frena antes de ARCA (${r.e && r.e.message})`);

console.log("\nMonotributo: la C, igual que antes");
s = escenario({ condicion: "MONOTRIBUTO", lineas: [renglon(1210), renglon(1105, 10.5)], total: 2315, cliente: CLI_RI });
r = await pedir(s);
p = s.afip.pedidos[0];
decir(!r.e && r.c.letra === "C" && p && p.CbteTipo === 11, `factura C, tipo 11 (${r.e ? r.e.message : r.c.letra})`);
decir(p && p.ImpNeto === 2315 && p.ImpIVA === 0 && !("Iva" in p) && r.c.detalle_iva === null, "todo neto, sin Iva, sin detalle guardado");

console.log("\nNota de crédito de una A");
s = escenario({ lineas: [renglon(1210), renglon(1105, 10.5)], total: 2315, cliente: CLI_RI });
await pedir(s);
s.tablas.operaciones.push({ id: "d1", empresa_id: EMP, tipo: "devolucion", estado: "confirmada", total: 1089, cliente_id: CLI_RI, comprobante: { fiscal: true, nota: "credito" }, origen_id: "v1" });
s.tablas.operacion_lineas.push({ operacion_id: "d1", empresa_id: EMP, total: 1210, iva: 21, iva_condicion: "gravado" });
s.tablas.comprobantes[0].fecha = "2026-09-27";
r = await pedir(s, "d1");
p = s.afip.pedidos[1];
decir(!r.e && r.c.letra === "A" && p && p.CbteTipo === 3 && p.CbtesAsoc && p.CbtesAsoc[0].Tipo === 1, `nota de crédito A, tipo 3, asociada a la factura (${r.e ? r.e.message : r.c.letra})`);
decir(p && p.ImpNeto === 900 && p.ImpIVA === 189 && p.ImpTotal === 1089 && p.DocTipo === 80, "devolución con 10% de descuento: 900 + 189, al mismo CUIT");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
