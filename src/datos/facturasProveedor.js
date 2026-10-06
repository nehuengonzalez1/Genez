/* ============================================================
   FACTURAS DE PROVEEDORES A PAGAR (0133) y pagos por proveedor
   ============================================================

   Las facturas se cargan, se corrigen o anulan mientras no se pagaron, y
   se pagan con pagar_factura_proveedor, que deja el pago en la caja
   grande en la misma transacción. Todo pide el permiso de la caja grande:
   sin él, RLS devuelve vacío.

   El proveedor es texto, el mismo nombre que se usa en los pagos de la
   caja grande. `proveedoresConocidos` junta los nombres que el comercio
   ya usó (proveedores cargados, pagos, facturas) para sugerirlos y que
   "coca" no termine siendo también "Coca-Cola" y "coca cola".
   ============================================================ */

import { supabase } from "./supabase.js";

/* La parte del detalle de un pago que dice a quién: antes del " · ".
   Los pagos viejos son texto libre ("pago a quilmes", "compra de
   galletita"): se les saca ese arranque, que no es el nombre. */
const ARRANQUE = /^(pagos?|compras?)(\s+(a|al|de|del|por))?\s+/i;
export const aQuienDe = (detalle) => String(detalle || "").split(" · ")[0].trim().replace(ARRANQUE, "").trim();
/* Para juntar: sin mayúsculas, tildes, espacios ni signos. Así "Maxi
   Consumo" y "maxiconsumo" son el mismo (lo eran en Super 25). */
const clave = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

const aFactura = (f) => ({
  id: f.id, proveedor: f.proveedor, numero: f.numero || "", monto: Number(f.monto) || 0,
  emitida: f.emitida || null, vence: f.vence, nota: f.nota || "", anulada: !!f.anulada,
  pagadaEn: f.pagada_en ? new Date(f.pagada_en) : null, cuenta: f.cuenta || null,
});

/* Las que faltan pagar, y las pagadas en los últimos 60 días. */
export async function cargarFacturas(empresaId) {
  const desde = new Date(Date.now() - 60 * 86400000).toISOString();
  const [pend, pagas] = await Promise.all([
    supabase.from("facturas_proveedor").select("*").eq("empresa_id", empresaId).is("pagada_en", null).eq("anulada", false).order("vence"),
    supabase.from("facturas_proveedor").select("*").eq("empresa_id", empresaId).gte("pagada_en", desde).order("pagada_en", { ascending: false }).limit(50),
  ]);
  if (pend.error) throw pend.error;
  if (pagas.error) throw pagas.error;
  /* Pagadas son las que tienen fecha de pago, se diga lo que se diga en
     la consulta: la pantalla no se rompe por un dato inesperado. */
  return { pendientes: (pend.data || []).map(aFactura), pagadas: (pagas.data || []).map(aFactura).filter((f) => f.pagadaEn) };
}

export async function crearFactura(empresaId, { proveedor, numero, monto, emitida, vence, nota }) {
  if (!String(proveedor || "").trim()) throw new Error("Falta a quién.");
  if (!(Number(monto) > 0)) throw new Error("Falta el monto.");
  if (!vence) throw new Error("Falta cuándo vence.");
  const { error } = await supabase.from("facturas_proveedor").insert({
    empresa_id: empresaId, proveedor: proveedor.trim(), numero: (numero || "").trim() || null,
    monto: Math.round(Number(monto)), emitida: emitida || null, vence, nota: (nota || "").trim() || null,
  });
  if (error) throw new Error(error.message || "No se pudo guardar la factura.");
}

export async function anularFactura(id) {
  const { data, error } = await supabase.from("facturas_proveedor").update({ anulada: true }).eq("id", id).select("id");
  if (error) throw new Error(error.message || "No se pudo anular.");
  if (!data || !data.length) throw new Error("No se pudo anular: ya está pagada o no tenés permiso.");
}

export async function pagarFactura(id, cuenta) {
  const { error } = await supabase.rpc("pagar_factura_proveedor", { p_factura: id, p_cuenta: cuenta });
  if (error) throw new Error(error.message || "No se pudo pagar.");
}

/* Los nombres que el comercio ya usó, para sugerirlos. */
export async function proveedoresConocidos(empresaId) {
  const [provs, pagos, facts] = await Promise.all([
    supabase.from("proveedores").select("nombre").eq("empresa_id", empresaId).eq("activo", true),
    supabase.from("caja_grande").select("detalle").eq("empresa_id", empresaId).eq("categoria", "pago").order("fecha", { ascending: false }).limit(500),
    supabase.from("facturas_proveedor").select("proveedor").eq("empresa_id", empresaId).limit(500),
  ]);
  const nombres = [
    ...((provs.data || []).map((p) => p.nombre)),
    ...((pagos.data || []).map((p) => aQuienDe(p.detalle))),
    ...((facts.data || []).map((f) => f.proveedor)),
  ].filter(Boolean);
  const vistos = new Map();
  for (const n of nombres) if (!vistos.has(clave(n))) vistos.set(clave(n), n);
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "es"));
}

/* Lo pagado a cada uno en un período (pagos de la caja grande), agrupado
   por el nombre sin mayúsculas ni tildes. Devuelve [{ nombre, total,
   pagos }] de mayor a menor. */
export async function cargarPagosPorProveedor(empresaId, desde, hasta) {
  const fin = new Date(hasta); fin.setDate(fin.getDate() + 1);
  const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const { data, error } = await supabase.from("caja_grande").select("detalle, monto")
    .eq("empresa_id", empresaId).eq("categoria", "pago").eq("tipo", "egreso")
    .gte("fecha", `${dia(desde)}T00:00:00-03:00`).lt("fecha", `${dia(fin)}T00:00:00-03:00`).limit(5000);
  if (error) throw error;
  const por = new Map();
  for (const p of data || []) {
    const nombre = aQuienDe(p.detalle) || "Sin detalle";
    const k = clave(nombre);
    const x = por.get(k) || { nombre, total: 0, pagos: 0 };
    x.total += Number(p.monto) || 0; x.pagos += 1;
    por.set(k, x);
  }
  return [...por.values()].sort((a, b) => b.total - a.total);
}
