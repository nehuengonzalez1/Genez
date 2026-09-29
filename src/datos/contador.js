/* ============================================================
   LO QUE LEEN LAS PLANILLAS PARA EL CONTADOR
   ============================================================

   Cómo se arman las filas está en src/utils/planillasContador.js; acá
   solo se lee y se traduce de los nombres de la base a los de la
   aplicación. Todo de un mes, en la hora de Argentina.
   ============================================================ */

import { supabase } from "./supabase.js";
import { traerTodo } from "./items.js";

/* "aaaa-mm" → el primer y el último día, y los instantes en que el mes
   empieza y termina en Argentina (para columnas con hora). */
export function limitesDelMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const sig = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${String(ultimo).padStart(2, "0")}`,
    desdeTs: new Date(`${mes}-01T00:00:00-03:00`).toISOString(),
    hastaTs: new Date(`${sig}-01T00:00:00-03:00`).toISOString(),
  };
}

/* El día de Argentina de un instante: "aaaa-mm-dd". */
const diaDe = (ts) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));

/* Los comprobantes autorizados del mes, del ambiente en que factura el
   comercio: los de homologación no tienen validez y no van al contador,
   salvo que el comercio esté todavía en pruebas. */
export async function cargarComprobantesDelMes(empresaId, mes, modo = "produccion") {
  if (!empresaId) throw new Error("cargarComprobantesDelMes necesita la empresa.");
  const { desde, hasta } = limitesDelMes(mes);
  const filas = await traerTodo(
    "comprobantes",
    "fecha, cuit, tipo, punto_venta, numero, autorizacion, cae, doc_tipo, doc_nro, condicion_receptor, total, detalle_iva, operaciones ( clientes ( razon_social ) )",
    (q) => q.eq("empresa_id", empresaId).eq("estado", "autorizado").eq("modo", modo)
      .gte("fecha", desde).lte("fecha", hasta)
      .order("fecha").order("tipo").order("numero")
  );
  return filas.map((c) => ({
    fecha: c.fecha,
    cuit: c.cuit,
    tipo: c.tipo,
    puntoVenta: c.punto_venta,
    numero: c.numero,
    autorizacion: c.autorizacion,
    cae: c.cae,
    docTipo: c.doc_tipo,
    docNro: c.doc_nro,
    condicionReceptor: c.condicion_receptor,
    comprador: (c.operaciones && c.operaciones.clientes && c.operaciones.clientes.razon_social) || null,
    total: Number(c.total),
    detalleIva: c.detalle_iva || null,
  }));
}

/* Lo vendido por día (con tickets, menos devoluciones: 0090, 0096), lo
   facturado por día y lo cobrado por día y medio. */
export async function cargarVentasDelMes(empresaId, mes, modo = "produccion") {
  if (!empresaId) throw new Error("cargarVentasDelMes necesita la empresa.");
  const { desde, hasta, desdeTs, hastaTs } = limitesDelMes(mes);

  const [serie, comprobantes, pagos] = await Promise.all([
    supabase.rpc("ventas_diarias_rango", { p_empresa: empresaId, p_desde: desde, p_hasta: hasta }),
    traerTodo("comprobantes", "fecha, tipo, total",
      (q) => q.eq("empresa_id", empresaId).eq("estado", "autorizado").eq("modo", modo).gte("fecha", desde).lte("fecha", hasta)),
    traerTodo("pagos", "medio, monto, fecha, operaciones!inner ( estado )",
      (q) => q.eq("empresa_id", empresaId).eq("operaciones.estado", "confirmada").gte("fecha", desdeTs).lt("fecha", hastaTs)),
  ]);
  if (serie.error) throw serie.error;

  const facturadoPorDia = new Map();
  for (const c of comprobantes) {
    const s = [3, 8, 13, 53].includes(Number(c.tipo)) ? -1 : 1;
    facturadoPorDia.set(c.fecha, (facturadoPorDia.get(c.fecha) || 0) + s * Number(c.total));
  }
  const pagosPorDia = new Map();
  for (const p of pagos) {
    const d = diaDe(p.fecha);
    if (!pagosPorDia.has(d)) pagosPorDia.set(d, new Map());
    const m = pagosPorDia.get(d);
    m.set(p.medio, (m.get(p.medio) || 0) + Number(p.monto));
  }
  return {
    dias: (serie.data || []).map((d) => ({ fecha: d.fecha, ventas: Number(d.ventas) || 0, tickets: Number(d.tickets) || 0 })),
    facturadoPorDia,
    pagosPorDia,
  };
}

/* Vendido y facturado por mes, en los 12 meses que terminan en `mes`. */
export async function cargarDoceMeses(empresaId, mes, modo = "produccion") {
  const [a, m] = mes.split("-").map(Number);
  const inicio = new Date(Date.UTC(a, m - 12, 1));
  const primero = `${inicio.getUTCFullYear()}-${String(inicio.getUTCMonth() + 1).padStart(2, "0")}`;
  const desde = `${primero}-01`;
  const { hasta } = limitesDelMes(mes);

  const [serie, comprobantes] = await Promise.all([
    supabase.rpc("ventas_diarias_rango", { p_empresa: empresaId, p_desde: desde, p_hasta: hasta }),
    traerTodo("comprobantes", "fecha, tipo, total",
      (q) => q.eq("empresa_id", empresaId).eq("estado", "autorizado").eq("modo", modo).gte("fecha", desde).lte("fecha", hasta)),
  ]);
  if (serie.error) throw serie.error;

  const meses = new Map();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(a, m - 12 + i, 1));
    meses.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, { ventas: 0, facturado: 0 });
  }
  for (const d of serie.data || []) {
    const k = String(d.fecha).slice(0, 7);
    if (meses.has(k)) meses.get(k).ventas += Number(d.ventas) || 0;
  }
  for (const c of comprobantes) {
    const k = String(c.fecha).slice(0, 7);
    const s = [3, 8, 13, 53].includes(Number(c.tipo)) ? -1 : 1;
    if (meses.has(k)) meses.get(k).facturado += s * Number(c.total);
  }
  return [...meses.entries()].map(([mes, v]) => ({ mes, ...v }));
}

/* Las compras cargadas en el mes. No son comprobantes fiscales: ver
   planillasContador.js. */
export async function cargarComprasDelMes(empresaId, mes) {
  if (!empresaId) throw new Error("cargarComprasDelMes necesita la empresa.");
  const { desdeTs, hastaTs } = limitesDelMes(mes);
  const filas = await traerTodo(
    "operaciones",
    "fecha, numero, total, proveedores ( nombre, cuit ), operacion_lineas ( count )",
    (q) => q.eq("empresa_id", empresaId).eq("tipo", "compra").eq("estado", "confirmada")
      .gte("fecha", desdeTs).lt("fecha", hastaTs).order("fecha")
  );
  return filas.map((o) => ({
    fecha: diaDe(o.fecha),
    proveedor: o.proveedores ? o.proveedores.nombre : null,
    cuit: o.proveedores ? o.proveedores.cuit : null,
    comprobante: o.numero,
    renglones: o.operacion_lineas && o.operacion_lineas[0] ? o.operacion_lineas[0].count : 0,
    total: Number(o.total),
  }));
}
