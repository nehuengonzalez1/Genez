/* ============================================================
   LAS PLANILLAS PARA EL CONTADOR · cómo se arman las filas
   ============================================================

   Funciones puras: reciben lo que ya se leyó de la base y devuelven las
   filas de cada hoja. Aparte de src/datos/contador.js (que lee) para
   poder probarlas sin base: scripts/probar-planillas.mjs.

   POR QUÉ ESTAS TRES (relevamiento del 29/09/2026)
   ------------------------------------------------
   Desde noviembre de 2025 el Libro IVA Digital no existe: lo reemplazó
   IVA Simple (RG 5705/2025), que ARCA precarga con los comprobantes
   electrónicos. Las facturas de Genez ya le llegan solas, así que armar
   el archivo de importación de ventas sería trabajo repetido. Lo que el
   contador necesita de Genez es poder CONTROLAR:

   1. Comprobantes emitidos: lo mismo que ARCA precargó, para cruzarlo,
      con el IVA por alícuota que se informó (0098).
   2. Ventas totales, con los tickets: un monotributista paga por lo que
      vende, no por lo que factura, y la recategorización mira los
      últimos 12 meses.
   3. Compras registradas: con un aviso, porque hoy una compra de Genez
      es un remito cargado, no un comprobante fiscal (sin letra, sin IVA,
      sin percepciones).
   ============================================================ */

const NOMBRE_TIPO = {
  1: "Factura A", 2: "Nota de débito A", 3: "Nota de crédito A",
  6: "Factura B", 7: "Nota de débito B", 8: "Nota de crédito B",
  11: "Factura C", 12: "Nota de débito C", 13: "Nota de crédito C",
  51: "Factura M", 52: "Nota de débito M", 53: "Nota de crédito M",
};
const NOTAS_DE_CREDITO = [3, 8, 13, 53];
const NOMBRE_DOC = { 80: "CUIT", 86: "CUIL", 96: "DNI", 99: "Sin identificar" };
const NOMBRE_CONDICION = { 1: "Responsable inscripto", 4: "Exento", 5: "Consumidor final", 6: "Monotributo" };

/* El orden de las columnas de alícuota: las que más se usan primero. */
const ORDEN_ALICUOTAS = [21, 10.5, 27, 5, 2.5, 0];

const plata = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pct = (a) => `${String(a).replace(".", ",")}%`;

/* Una nota de crédito resta: el contador suma la columna y tiene que dar
   lo vendido neto. */
export const signoDe = (tipo) => (NOTAS_DE_CREDITO.includes(Number(tipo)) ? -1 : 1);

/* aaaa-mm-dd → dd/mm/aaaa, que es como lo lee cualquiera en Argentina. */
export const fechaAR = (iso) => { const s = String(iso).slice(0, 10); return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`; };

/* ---------- 1 · Comprobantes emitidos ---------- */

/* comprobantes: [{ fecha, tipo, puntoVenta, numero, autorizacion, cae,
   docTipo, docNro, condicionReceptor, comprador, total, detalleIva }] */
export function hojaComprobantes(comprobantes) {
  const tasas = new Set();
  let hayC = false;
  for (const c of comprobantes) {
    if (c.detalleIva) for (const a of c.detalleIva.alicuotas || []) tasas.add(Number(a.alicuota));
    else hayC = true;
  }
  const alicuotas = ORDEN_ALICUOTAS.filter((a) => tasas.has(a));
  const hayExento = comprobantes.some((c) => c.detalleIva && c.detalleIva.exento);
  const hayNoGravado = comprobantes.some((c) => c.detalleIva && c.detalleIva.noGravado);
  /* Un mes con un cambio de titular (Super 25, septiembre de 2026) tiene
     comprobantes de dos CUIT: cada uno va a la declaración de su titular. */
  const variosCuit = new Set(comprobantes.map((c) => c.cuit).filter(Boolean)).size > 1;

  const titulos = [
    "Fecha", ...(variosCuit ? ["CUIT emisor"] : []), "Comprobante", "Punto de venta", "Número", "Autorización", "Código", "Documento", "Número de documento", "Comprador", "Condición frente al IVA",
    ...alicuotas.flatMap((a) => [`Neto ${pct(a)}`, `IVA ${pct(a)}`]),
    ...(hayExento ? ["Exento"] : []),
    ...(hayNoGravado ? ["No gravado"] : []),
    ...(hayC ? ["Sin discriminar (C)"] : []),
    "Total",
  ];

  const totales = new Array(titulos.length).fill(0);
  const primeraSuma = variosCuit ? 11 : 10;
  const filas = comprobantes.map((c) => {
    const s = signoDe(c.tipo);
    const d = c.detalleIva;
    const porTasa = new Map(((d && d.alicuotas) || []).map((a) => [Number(a.alicuota), a]));
    const importes = [
      ...alicuotas.flatMap((a) => { const x = porTasa.get(a); return x ? [s * plata(x.base), s * plata(x.importe)] : [0, 0]; }),
      ...(hayExento ? [s * plata(d ? d.exento : 0)] : []),
      ...(hayNoGravado ? [s * plata(d ? d.noGravado : 0)] : []),
      ...(hayC ? [d ? 0 : s * plata(c.total)] : []),
      s * plata(c.total),
    ];
    importes.forEach((v, i) => { totales[primeraSuma + i] = plata(totales[primeraSuma + i] + v); });
    return [
      fechaAR(c.fecha), ...(variosCuit ? [String(c.cuit || "")] : []), NOMBRE_TIPO[c.tipo] || `Tipo ${c.tipo}`, Number(c.puntoVenta), Number(c.numero),
      c.autorizacion || "CAE", String(c.cae || ""), NOMBRE_DOC[c.docTipo] || String(c.docTipo || ""),
      Number(c.docNro) ? String(c.docNro) : "", c.comprador || (Number(c.docTipo) === 99 ? "Consumidor final" : ""),
      NOMBRE_CONDICION[c.condicionReceptor] || "",
      ...importes,
    ];
  });

  const fila = ["TOTAL", `${comprobantes.length} comprobantes`, ...new Array(primeraSuma - 2).fill(""), ...totales.slice(primeraSuma)];
  return {
    nombre: "Comprobantes emitidos",
    filas: [titulos, ...filas, [], fila],
    anchos: [11, ...(variosCuit ? [13] : []), 20, 8, 10, 12, 16, 16, 14, 28, 22, ...titulos.slice(primeraSuma).map(() => 13)],
  };
}

/* ---------- 2 · Ventas totales ---------- */

/* dias: [{ fecha: "aaaa-mm-dd", ventas, tickets }] (ventas_diarias_rango,
   que ya resta las devoluciones: 0090).
   facturadoPorDia: Map "aaaa-mm-dd" → importe (notas restando).
   pagosPorDia: Map "aaaa-mm-dd" → Map medio → importe.
   meses: [{ mes: "aaaa-mm", ventas, facturado }] de los últimos 12. */
export function hojasVentas({ dias, facturadoPorDia, pagosPorDia, nombreMedio, meses }) {
  const medios = new Set();
  for (const m of pagosPorDia.values()) for (const k of m.keys()) medios.add(k);
  const listaMedios = [...medios].sort();

  /* La cuenta corriente no es plata que entró: es lo que se fió ese día
     (MEDIO_CUENTA_CORRIENTE en helpers.js; no se importa para que esto
     siga sin dependencias). */
  const rotulo = (k) => (k === "cuenta_corriente" ? "Fiado (cuenta corriente)" : `Cobrado en ${nombreMedio(k)}`);
  const titulos = ["Fecha", "Ventas", "Facturado", "Sin factura (tickets)", "Operaciones", ...listaMedios.map(rotulo)];
  const tot = new Array(titulos.length).fill(0);
  const filas = dias.map((d) => {
    const ventas = plata(d.ventas);
    const facturado = plata(facturadoPorDia.get(d.fecha) || 0);
    const pagos = pagosPorDia.get(d.fecha) || new Map();
    const fila = [fechaAR(d.fecha), ventas, facturado, plata(ventas - facturado), Number(d.tickets) || 0, ...listaMedios.map((k) => plata(pagos.get(k) || 0))];
    fila.forEach((v, i) => { if (i > 0) tot[i] = plata(tot[i] + v); });
    return fila;
  });

  const porDia = {
    nombre: "Por día",
    filas: [
      titulos, ...filas, [], ["TOTAL", ...tot.slice(1)], [],
      ["Ventas: lo cobrado, con los tickets y las mesas, menos las devoluciones del día. Facturado: los comprobantes con CAE o CAEA de ese día, con las notas de crédito restando."],
      ["Lo cobrado por medio es lo que entró por cada uno, sin descontar devoluciones: puede no coincidir al peso con Ventas."],
    ],
    anchos: [11, 14, 14, 18, 12, ...listaMedios.map(() => 16)],
  };

  const totMeses = meses.reduce((s, m) => ({ ventas: plata(s.ventas + m.ventas), facturado: plata(s.facturado + m.facturado) }), { ventas: 0, facturado: 0 });
  const doce = {
    nombre: "Últimos 12 meses",
    filas: [
      ["Mes", "Ventas", "Facturado", "Sin factura (tickets)"],
      ...meses.map((m) => [m.mes.split("-").reverse().join("/"), plata(m.ventas), plata(m.facturado), plata(m.ventas - m.facturado)]),
      [],
      ["TOTAL 12 MESES", totMeses.ventas, totMeses.facturado, plata(totMeses.ventas - totMeses.facturado)],
      [],
      ["Para el monotributo, la categoría se mira con los ingresos de los últimos 12 meses: todo lo vendido, facturado o no."],
    ],
    anchos: [16, 16, 16, 20],
  };
  return [porDia, doce];
}

/* ---------- 3 · Compras registradas ---------- */

/* compras: [{ fecha, proveedor, cuit, comprobante, renglones, total }] */
export function hojaCompras(compras) {
  const total = compras.reduce((s, c) => plata(s + Number(c.total || 0)), 0);
  return {
    nombre: "Compras",
    filas: [
      ["NO ES UN LIBRO DE COMPRAS FISCAL. Son las compras cargadas en Genez para el stock: el número puede ser de un remito, y no están la letra, el IVA ni las percepciones. Las facturas electrónicas de los proveedores ya están en ARCA (Mis Comprobantes, recibidos)."],
      [],
      ["Fecha", "Proveedor", "CUIT", "Remito o factura", "Renglones", "Total a costo"],
      ...compras.map((c) => [fechaAR(c.fecha), c.proveedor || "", c.cuit || "", c.comprobante || "", Number(c.renglones) || 0, plata(c.total)]),
      [],
      ["TOTAL", `${compras.length} compras`, "", "", "", total],
    ],
    anchos: [11, 28, 15, 20, 10, 14],
  };
}
