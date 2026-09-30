/* ============================================================
   GENEZ FOUNDER · producto y documentación (0116)
   ============================================================

   Proyectos, versiones, el roadmap (ideas, mejoras, bugs, pedidos…) y
   los documentos. Como en internoClientes.js, lo que se escribe pasa por
   una lista de columnas por tabla: las vistas traen nombres de otras
   tablas (versión, proyecto, cliente) que no son columnas de estas.
   ============================================================ */

import { supabase } from "./supabase.js";
import { aApp } from "./internoCrm.js";
import { conColumnas, aAppDia, traducir } from "./internoClientes.js";

const COLUMNAS = {
  interno_proyectos: ["nombre", "descripcion", "objetivo", "categoria", "estado", "prioridad", "inicio", "finEstimado", "responsableId",
    "riesgos", "dependencias", "resultadoEsperado", "archivadoEn"],
  interno_versiones: ["nombre", "objetivo", "fechaObjetivo", "estado", "notas"],
  interno_roadmap: ["tipo", "titulo", "descripcion", "problema", "afectados", "modulo", "prioridad", "impacto", "complejidad", "estado", "orden",
    "responsableId", "versionId", "proyectoId", "clienteId", "criterios", "pruebas", "entorno", "pasos", "esperado", "actual", "gravedad",
    "solucion", "archivadoEn"],
  interno_documentos: ["titulo", "tipo", "categoria", "contenido", "etiquetas", "estado", "modulo", "proyectoId", "clienteId", "roadmapId",
    "tareaId", "archivadoEn"],
};
const mas = (error) => {
  if (!error) return null;
  if (/interno_proyectos_fechas/.test(error.message || "")) return new Error("El proyecto no puede terminar antes de empezar.");
  if (/interno_documentos_largo/.test(error.message || "")) return new Error("El documento es demasiado largo: lo pesado, como archivo adjunto.");
  if (/interno_versiones_nombre_key|duplicate key.*interno_versiones/.test(error.message || "")) return new Error("Ya hay una versión con ese nombre.");
  return traducir(error);
};
const dato = ({ data, error }) => { if (error) throw mas(error); return data; };
const guardar = async (tabla, obj, devolver = "id") => {
  const fila = conColumnas(COLUMNAS[tabla], obj);
  if (obj.id) return dato(await supabase.from(tabla).update(fila).eq("id", obj.id));
  return dato(await supabase.from(tabla).insert(fila).select(devolver).single());
};

/* ---------- Nombres ---------- */
export const TIPO_ROADMAP = { idea: "Idea", funcionalidad: "Funcionalidad", mejora: "Mejora", bug: "Bug", solicitud: "Pedido de cliente", deuda: "Deuda técnica", integracion: "Integración" };
export const ESTADO_ROADMAP = { idea: "Idea", analisis: "En análisis", planificado: "Planificado", en_desarrollo: "En desarrollo", en_prueba: "En prueba", lanzado: "Lanzado", descartado: "Descartado" };
export const ESTADO_PROYECTO = { idea: "Idea", planificado: "Planificado", en_curso: "En curso", en_prueba: "En prueba", pausado: "Pausado", completado: "Completado", cancelado: "Cancelado" };
export const ESTADO_VERSION = { planificada: "Planificada", en_curso: "En curso", lanzada: "Lanzada", descartada: "Descartada" };
export const ESTADO_DOCUMENTO = { borrador: "Borrador", vigente: "Vigente", obsoleto: "Obsoleto" };
export const IMPACTO = { bajo: "Bajo", medio: "Medio", alto: "Alto" };
export const COMPLEJIDAD = { chica: "Chica", media: "Media", grande: "Grande", muy_grande: "Muy grande" };

/* ---------- Roadmap ---------- */
export async function cargarRoadmap() {
  return (dato(await supabase.from("interno_roadmap_vista").select("*").is("archivado_en", null).order("orden").order("creado_en", { ascending: false }).limit(2000)) || []).map(aApp);
}
export async function cargarElemento(id) {
  const [r, rel, tareas, docs, adjuntos] = await Promise.all([
    supabase.from("interno_roadmap_vista").select("*").eq("id", id).single(),
    supabase.from("interno_roadmap_tickets").select("ticket_id, interno_tickets(id, numero, titulo, estado, cliente_id)").eq("roadmap_id", id),
    supabase.from("interno_tareas").select("*").eq("roadmap_id", id).is("archivado_en", null).order("vence", { ascending: true, nullsFirst: false }),
    supabase.from("interno_documentos").select("id, titulo, tipo, estado").eq("roadmap_id", id).is("archivado_en", null),
    supabase.from("interno_adjuntos").select("*").eq("tabla", "interno_roadmap").eq("fila_id", id).is("archivado_en", null).order("creado_en"),
  ]);
  return {
    elemento: aApp(dato(r)),
    /* Sin soporte, la relación se ve pero el ticket viene vacío: se cuenta sin detalle. */
    tickets: (rel.data || []).map((x) => (x.interno_tickets ? aApp(x.interno_tickets) : { id: x.ticket_id, oculto: true })),
    tareas: (tareas.data || []).map(aApp), documentos: (docs.data || []).map(aApp), adjuntos: (adjuntos.data || []).map(aApp),
  };
}
export const guardarElemento = (r) => guardar("interno_roadmap", r);
export async function ticketAProducto(ticketId, tipo = null) {
  return dato(await supabase.rpc("interno_ticket_a_producto", { p_ticket: ticketId, p_tipo: tipo }));
}
export async function atarTicket(roadmapId, ticketId) {
  dato(await supabase.from("interno_roadmap_tickets").insert({ roadmap_id: roadmapId, ticket_id: ticketId }));
}
export async function desatarTicket(roadmapId, ticketId) {
  dato(await supabase.from("interno_roadmap_tickets").delete().eq("roadmap_id", roadmapId).eq("ticket_id", ticketId));
}
/* Los elementos a los que está atado un ticket (para mostrarlo en el ticket). */
export async function elementosDeTicket(ticketId) {
  const { data } = await supabase.from("interno_roadmap_tickets").select("roadmap_id, interno_roadmap(id, titulo, tipo, estado)").eq("ticket_id", ticketId);
  return (data || []).filter((x) => x.interno_roadmap).map((x) => aApp(x.interno_roadmap));
}

/* ---------- Proyectos y versiones ---------- */
export async function cargarProyectos() {
  return (dato(await supabase.from("interno_proyectos_vista").select("*").is("archivado_en", null).order("creado_en", { ascending: false })) || []).map(aAppDia);
}
export async function cargarProyecto(id) {
  const [p, tareas, elementos, docs, adjuntos] = await Promise.all([
    supabase.from("interno_proyectos_vista").select("*").eq("id", id).single(),
    supabase.from("interno_tareas").select("*").eq("proyecto_id", id).is("archivado_en", null).order("vence", { ascending: true, nullsFirst: false }),
    supabase.from("interno_roadmap").select("id, titulo, tipo, estado, prioridad").eq("proyecto_id", id).is("archivado_en", null).order("orden"),
    supabase.from("interno_documentos").select("id, titulo, tipo, estado").eq("proyecto_id", id).is("archivado_en", null),
    supabase.from("interno_adjuntos").select("*").eq("tabla", "interno_proyectos").eq("fila_id", id).is("archivado_en", null).order("creado_en"),
  ]);
  return { proyecto: aAppDia(dato(p)), tareas: (tareas.data || []).map(aApp), elementos: (elementos.data || []).map(aApp),
    documentos: (docs.data || []).map(aApp), adjuntos: (adjuntos.data || []).map(aApp) };
}
export const guardarProyecto = (p) => guardar("interno_proyectos", p);
export async function cargarVersiones() {
  return (dato(await supabase.from("interno_versiones").select("*").order("fecha_objetivo", { ascending: true, nullsFirst: false })) || []).map(aApp);
}
export const guardarVersion = (v) => guardar("interno_versiones", v);

/* ---------- Documentos ---------- */
/* La búsqueda la hace la base (tsvector en castellano: "impresoras"
   encuentra "impresora"), por título, etiquetas y contenido. */
export async function cargarDocumentos({ buscar = "", archivados = false } = {}) {
  let q = supabase.from("interno_documentos").select("id, titulo, tipo, categoria, etiquetas, estado, version, modulo, proyecto_id, cliente_id, roadmap_id, creado_por, creado_en, actualizado_en, archivado_en, contenido")
    .order("actualizado_en", { ascending: false }).limit(500);
  q = archivados ? q.not("archivado_en", "is", null) : q.is("archivado_en", null);
  if (buscar.trim()) q = q.textSearch("busqueda", buscar.trim(), { type: "websearch", config: "spanish" });
  return (dato(await q) || []).map(aApp);
}
export async function cargarDocumento(id) {
  const [d, versiones, adjuntos] = await Promise.all([
    supabase.from("interno_documentos").select("*").eq("id", id).single(),
    supabase.from("interno_documentos_versiones").select("id, version, titulo, fecha, quien").eq("documento_id", id).order("version", { ascending: false }),
    supabase.from("interno_adjuntos").select("*").eq("tabla", "interno_documentos").eq("fila_id", id).is("archivado_en", null).order("creado_en"),
  ]);
  const doc = aApp(dato(d));
  delete doc.busqueda;
  return { documento: doc, versiones: (dato(versiones) || []).map(aApp), adjuntos: (adjuntos.data || []).map(aApp) };
}
export async function cargarVersionDocumento(id) {
  return aApp(dato(await supabase.from("interno_documentos_versiones").select("*").eq("id", id).single()));
}
export const guardarDocumento = (d) => guardar("interno_documentos", d, "id, version");
