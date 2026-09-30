/* ============================================================
   GENEZ FOUNDER · el prospector (0119)
   ============================================================

   La búsqueda la hace el navegador con el conector del proveedor
   (utils/proveedores/): acá se registra la búsqueda, se guardan los
   hallazgos sin duplicar y se pasan al CRM. Los errores del proveedor
   también quedan registrados en la búsqueda.
   ============================================================ */

import { supabase } from "./supabase.js";
import { aApp } from "./internoCrm.js";
import { traducir } from "./internoClientes.js";
import * as osm from "../utils/proveedores/osm.js";

const dato = ({ data, error }) => { if (error) throw traducir(error); return data; };

/* Los conectores disponibles, por la clave de interno_proveedores. */
export const CONECTORES = { osm };

export async function cargarProveedores() {
  return (dato(await supabase.from("interno_proveedores").select("*").order("clave")) || []).map(aApp);
}
export async function cargarBusquedas(limite = 30) {
  return (dato(await supabase.from("interno_busquedas").select("*").order("creado_en", { ascending: false }).limit(limite)) || []).map(aApp);
}

/* Una búsqueda completa: se registra antes de pedir (para que un error
   del proveedor también quede), se pide, y se guardan los resultados.
   Devuelve { busqueda, hallazgos } o tira el error del proveedor. */
export async function buscarEnProveedor(proveedor, params, zona) {
  const c = CONECTORES[proveedor];
  if (!c) throw new Error("Ese proveedor no tiene conector.");
  const b = dato(await supabase.from("interno_busquedas").insert({ proveedor, parametros: { ...params, zona } }).select("id").single());
  const t0 = Date.now();
  try {
    const { hallazgos } = await c.buscar(params, { zona });
    dato(await supabase.rpc("interno_guardar_hallazgos", { p_busqueda: b.id, p_items: hallazgos }));
    await supabase.from("interno_busquedas").update({ duracion_ms: Date.now() - t0 }).eq("id", b.id);
    return { busqueda: b.id, total: hallazgos.length };
  } catch (e) {
    await supabase.from("interno_busquedas").update({ error: String(e.message || e).slice(0, 500), duracion_ms: Date.now() - t0 }).eq("id", b.id);
    throw e;
  }
}

export async function cargarHallazgos({ busqueda = null } = {}) {
  let q = supabase.from("interno_hallazgos").select("*, interno_prospectos(id, nombre)").order("visto_en", { ascending: false }).limit(2000);
  if (busqueda) q = q.eq("busqueda_id", busqueda);
  return (dato(await q) || []).map((h) => ({ ...aApp(h), prospecto: h.interno_prospectos ? aApp(h.interno_prospectos) : null, obtenidoEn: new Date(h.obtenido_en), vistoEn: new Date(h.visto_en) }));
}

/* Al CRM: nuevo (sin prospectoId) o vinculado a uno existente. */
export async function incorporarHallazgo(id, prospectoId = null) {
  return dato(await supabase.rpc("interno_incorporar_hallazgo", { p_hallazgo: id, p_prospecto: prospectoId }));
}
export async function descartarHallazgo(id, motivo) {
  dato(await supabase.from("interno_hallazgos").update({ descartado_en: new Date().toISOString(), motivo_descarte: motivo || null }).eq("id", id));
}
export async function recuperarHallazgo(id) {
  dato(await supabase.from("interno_hallazgos").update({ descartado_en: null, motivo_descarte: null }).eq("id", id));
}

/* Una planilla importada también es una búsqueda: queda en el historial. */
export async function registrarPlanilla(archivo, filas, creados) {
  await supabase.from("interno_busquedas").insert({ proveedor: "planilla", parametros: { archivo, filas }, resultados: filas, nuevos: creados });
}
