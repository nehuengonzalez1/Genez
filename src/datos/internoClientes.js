/* ============================================================
   GENEZ FOUNDER · clientes, implementación y soporte (0115)
   ============================================================

   Lo que se manda a la base pasa por una lista de columnas por tabla
   (COLUMNAS), no por "todo menos lo de lectura": las vistas traen
   nombre, rubro y teléfonos del prospecto, y "nombre" es una columna
   de verdad en otras tablas. Una lista explícita no deja escapar un
   campo leído de la vista hacia un update.

   Las fechas sin hora (alta, renovación, la fecha de una etapa) viajan
   como texto "AAAA-MM-DD": convertidas a Date caerían a la medianoche
   de Londres, que en Buenos Aires es el día anterior.
   ============================================================ */

import { supabase } from "./supabase.js";
import { aApp, traducir as traducirComun } from "./internoCrm.js";

const aSnake = (s) => s.replace(/[A-Z]/g, (l) => "_" + l.toLowerCase());
const SIN_HORA = ["alta", "renovacion", "fecha"];

const COLUMNAS = {
  interno_clientes: ["empresaId", "plan", "importeMensual", "alta", "renovacion", "estado", "responsableId", "notas", "motivoBaja", "archivadoEn"],
  interno_impl_etapas: ["estado", "responsableId", "fecha", "notas", "bloqueo", "pasos"],
  interno_impl_modelo: ["etapa", "titulo", "rubros", "modulos", "orden", "activo"],
  interno_tickets: ["clienteId", "sucursal", "contactoId", "canal", "modulo", "categoria", "titulo", "descripcion", "pasos",
    "prioridad", "gravedad", "estado", "responsableId", "solucion", "archivadoEn"],
};

function aBase(tabla, obj) {
  const o = {};
  for (const k of COLUMNAS[tabla]) {
    if (!(k in (obj || {})) || obj[k] === undefined) continue;
    const v = obj[k];
    o[aSnake(k)] = v instanceof Date ? v.toISOString() : v === "" ? null : v;
  }
  return o;
}
/* aApp convierte "fecha" a Date (en la línea de tiempo es un momento);
   acá las fechas sin hora quedan como vinieron. */
const aAppDia = (fila) => {
  if (!fila) return fila;
  const o = aApp(fila);
  for (const k of SIN_HORA) if (k in fila && fila[k] && !String(fila[k]).includes("T")) o[k] = fila[k];
  return o;
};

const traducir = (error) => {
  if (!error) return null;
  if (/interno_tickets_solucion/.test(error.message || "")) return new Error("Para resolverlo o cerrarlo, escribí la solución.");
  if (/interno_impl_etapas_bloqueo/.test(error.message || "")) return new Error("Una etapa bloqueada tiene que decir qué la bloquea.");
  if (/interno_clientes_renovacion/.test(error.message || "")) return new Error("La renovación no puede ser antes del alta.");
  if (error.code === "42501" || /Sin acceso/.test(error.message || "")) return new Error("Tu usuario no tiene acceso a esta parte de Founder.");
  return traducirComun(error);
};
const dato = ({ data, error }) => { if (error) throw traducir(error); return data; };

/* ---------- Clientes ---------- */
export const ESTADO_CLIENTE = { implementacion: "En implementación", activo: "Activo", en_riesgo: "En riesgo", pausado: "Pausado", cancelado: "Cancelado" };

export async function cargarClientes({ archivados = false } = {}) {
  let q = supabase.from("interno_clientes_vista").select("*").order("alta", { ascending: false }).limit(1000);
  q = archivados ? q.not("archivado_en", "is", null) : q.is("archivado_en", null);
  return (dato(await q) || []).map(aAppDia);
}

export async function cargarCliente(id) {
  const c = aAppDia(dato(await supabase.from("interno_clientes_vista").select("*").eq("id", id).single()));
  const [etapas, tickets, tareas, adjuntos, comercio] = await Promise.all([
    supabase.from("interno_impl_etapas").select("*").eq("cliente_id", id).order("orden"),
    supabase.from("interno_tickets_vista").select("*").eq("cliente_id", id).is("archivado_en", null).order("creado_en", { ascending: false }),
    supabase.from("interno_tareas").select("*").eq("prospecto_id", c.prospectoId).is("archivado_en", null).order("vence", { ascending: true, nullsFirst: false }),
    supabase.from("interno_adjuntos").select("*").eq("tabla", "interno_clientes").eq("fila_id", id).is("archivado_en", null).order("creado_en"),
    c.empresaId ? supabase.rpc("interno_comercio", { p_empresa: c.empresaId }) : Promise.resolve({ data: null }),
  ]);
  return {
    cliente: c,
    etapas: (dato(etapas) || []).map(aAppDia),
    /* Tickets y tareas son otras áreas: sin acceso, vienen vacíos. */
    tickets: (tickets.data || []).map(aApp),
    tareas: (tareas.data || []).map(aApp),
    adjuntos: (adjuntos.data || []).map(aApp),
    comercio: comercio.data || null,
  };
}

export async function guardarCliente(id, cambios) {
  dato(await supabase.from("interno_clientes").update(aBase("interno_clientes", cambios)).eq("id", id));
}

/* Los datos del alta, en el formato que esperan las funciones. */
const datosAlta = (d) => ({
  importe_mensual: d.importeMensual === "" || d.importeMensual == null ? undefined : Number(d.importeMensual),
  plan: d.plan || null, alta: d.alta || null, renovacion: d.renovacion || null,
  empresa_id: d.empresaId || null, notas: d.notas || null, sin_implementacion: !!d.sinImplementacion,
});

export async function convertirEnCliente(oportunidadId, d) {
  return dato(await supabase.rpc("interno_convertir_en_cliente", { p_oportunidad: oportunidadId, p_datos: datosAlta(d) }));
}
export async function clienteDesdeComercio(empresaId, d) {
  return dato(await supabase.rpc("interno_cliente_desde_comercio", { p_empresa: empresaId, p_datos: datosAlta(d) }));
}
export async function comerciosLibres() {
  return dato(await supabase.rpc("interno_comercios_libres")) || [];
}
export async function clienteDeProspecto(prospectoId) {
  const { data } = await supabase.from("interno_clientes").select("id").eq("prospecto_id", prospectoId).maybeSingle();
  return data ? data.id : null;
}

/* ---------- Implementación ---------- */
export const ESTADO_ETAPA = { pendiente: "Pendiente", en_curso: "En curso", hecha: "Hecha", bloqueada: "Bloqueada", no_aplica: "No aplica" };

export async function guardarEtapa(id, cambios) {
  dato(await supabase.from("interno_impl_etapas").update(aBase("interno_impl_etapas", cambios)).eq("id", id));
}
/* Suma los pasos que falten según el rubro y los módulos. Devuelve cuántos. */
export async function armarImplementacion(clienteId) {
  return dato(await supabase.rpc("interno_impl_armar", { p_cliente: clienteId }));
}
export async function cargarModelo() {
  return (dato(await supabase.from("interno_impl_modelo").select("*").order("etapa").order("orden")) || []).map(aApp);
}
export async function guardarPasoModelo(p) {
  if (p.id) return dato(await supabase.from("interno_impl_modelo").update(aBase("interno_impl_modelo", p)).eq("id", p.id));
  return dato(await supabase.from("interno_impl_modelo").insert(aBase("interno_impl_modelo", p)));
}

/* ---------- Soporte ---------- */
export const ESTADO_TICKET = { nuevo: "Nuevo", en_analisis: "En análisis", esperando_info: "Esperando información", en_curso: "En curso", resuelto: "Resuelto", cerrado: "Cerrado" };
export const GRAVEDAD = { menor: "Menor", moderada: "Moderada", grave: "Grave", critica: "Crítica" };
export const abierto = (t) => !["resuelto", "cerrado"].includes(t.estado);

export async function cargarTickets() {
  return (dato(await supabase.from("interno_tickets_vista").select("*").is("archivado_en", null).order("creado_en", { ascending: false }).limit(2000)) || []).map(aApp);
}
export async function cargarTicket(id) {
  const [t, mensajes, tareas, adjuntos] = await Promise.all([
    supabase.from("interno_tickets_vista").select("*").eq("id", id).single(),
    supabase.from("interno_ticket_mensajes").select("*").eq("ticket_id", id).order("fecha"),
    supabase.from("interno_tareas").select("*").eq("ticket_id", id).is("archivado_en", null),
    supabase.from("interno_adjuntos").select("*").eq("tabla", "interno_tickets").eq("fila_id", id).is("archivado_en", null).order("creado_en"),
  ]);
  return { ticket: aApp(dato(t)), mensajes: (dato(mensajes) || []).map(aApp), tareas: (tareas.data || []).map(aApp), adjuntos: (adjuntos.data || []).map(aApp) };
}
export async function guardarTicket(t) {
  if (t.id) return dato(await supabase.from("interno_tickets").update(aBase("interno_tickets", t)).eq("id", t.id));
  return dato(await supabase.from("interno_tickets").insert(aBase("interno_tickets", t)).select("id, numero").single());
}
export async function agregarMensaje(ticketId, { tipo, canal, texto }) {
  dato(await supabase.from("interno_ticket_mensajes").insert({ ticket_id: ticketId, tipo, canal: canal || null, texto }));
}
export async function ticketsParecidos(texto, modulo, excluir = null) {
  if (!texto || texto.trim().length < 8) return [];
  const { data, error } = await supabase.rpc("interno_tickets_parecidos", { p_texto: texto, p_modulo: modulo || null, p_excluir: excluir });
  if (error) return [];   // buscar parecidos es una ayuda: si falla, no frena el alta
  return (data || []).map(aApp);
}

/* ---------- Adjuntos ---------- */
/* Los mismos límites que el bucket (0115): se validan acá para decir por
   qué no, pero los hace cumplir Storage aunque alguien saltee esto. */
export const TIPOS_ADJUNTO = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain", "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
export const MAX_ADJUNTO = 10 * 1024 * 1024;

export function validarAdjunto(archivo) {
  if (!archivo) return "No hay archivo.";
  if (!TIPOS_ADJUNTO.includes(archivo.type)) return "Ese tipo de archivo no se acepta: imágenes, PDF, texto o planillas.";
  if (archivo.size > MAX_ADJUNTO) return "El archivo pasa los 10 MB.";
  return null;
}

/* La ruta es área/id-de-la-fila/aleatorio-nombre: la primera carpeta es
   la que mira la política de Storage. El nombre se limpia para que un
   archivo no pueda subir con barras o puntos a otra carpeta. */
export async function subirAdjunto(area, tabla, filaId, archivo) {
  const mal = validarAdjunto(archivo);
  if (mal) throw new Error(mal);
  const limpio = archivo.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/\.{2,}/g, ".").replace(/^\.+/, "").slice(-80) || "archivo";
  const ruta = `${area}/${filaId}/${Math.random().toString(36).slice(2, 10)}-${limpio}`;
  const { error } = await supabase.storage.from("interno").upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) throw new Error(/row-level|policy|Unauthorized|403/i.test(error.message || "") ? "Tu usuario no puede subir archivos acá." : error.message || "No se pudo subir el archivo.");
  dato(await supabase.from("interno_adjuntos").insert({ area, tabla, fila_id: filaId, ruta, nombre: archivo.name.slice(0, 200), tipo_mime: archivo.type, tamano: archivo.size }));
}
/* El bucket es privado: se abre con un link firmado que vence en diez minutos. */
export async function abrirAdjunto(ruta) {
  const { data, error } = await supabase.storage.from("interno").createSignedUrl(ruta, 600);
  if (error || !data) throw new Error("No se pudo abrir el archivo.");
  return data.signedUrl;
}
export async function archivarAdjunto(id) {
  dato(await supabase.from("interno_adjuntos").update({ archivado_en: new Date().toISOString() }).eq("id", id));
}
