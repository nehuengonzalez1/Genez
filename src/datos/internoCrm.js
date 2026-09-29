/* ============================================================
   GENEZ FOUNDER · el CRM y la agenda (0114)
   ============================================================

   Prospectos, contactos, oportunidades, la línea de tiempo, tareas y
   eventos. Las pantallas hablan en camelCase y la base en snake_case:
   la traducción vive acá, en aApp/aBase, y ningún módulo se entera de
   cómo se llaman las columnas.

   Lo que protege estos datos son las políticas de 0114 (es_interno por
   área). Varias cosas las escribe la base sola —la primera oportunidad,
   el cambio de etapa en la línea de tiempo, el seguimiento después de
   un contacto, la próxima tarea de una serie—: acá no se repiten.
   ============================================================ */

import { supabase } from "./supabase.js";

const aCamel = (s) => s.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
const aSnake = (s) => s.replace(/[A-Z]/g, (l) => "_" + l.toLowerCase());
const FECHAS = new Set(["creadoEn", "actualizadoEn", "archivadoEn", "ultimoContacto", "proximoContacto", "fecha", "proximaFecha",
  "vence", "completadaEn", "inicio", "fin", "fechaSeguimiento", "ganadaEn", "cerradaEn", "clienteDesde"]);

export function aApp(fila) {
  if (!fila) return fila;
  const o = {};
  for (const [k, v] of Object.entries(fila)) {
    const c = aCamel(k);
    o[c] = FECHAS.has(c) && v && c !== "inicio" ? new Date(v) : c === "inicio" && v && String(v).includes("T") ? new Date(v) : v;
  }
  return o;
}
/* Lo que no se manda nunca: lo pone la base. */
const DE_LA_BASE = new Set(["id", "creadoEn", "creadoPor", "actualizadoEn", "actualizadoPor", "telNorm", "emailNorm", "nombreNorm", "localidadNorm"]);
/* Lo que se leyó de otra tabla o de la vista no es columna de esta:
   si una pantalla edita un objeto leído y lo devuelve entero, se saca. */
const DE_LECTURA = new Set(["prospecto", "prospectoNombre", "etapa", "oportunidadNombre", "etapaNombre", "etapaOrden", "oportunidadEstado"]);
function aBase(obj) {
  const o = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (DE_LA_BASE.has(k) || DE_LECTURA.has(k) || k.startsWith("interno") || v === undefined) continue;
    o[aSnake(k)] = v instanceof Date ? v.toISOString() : v === "" ? null : v;
  }
  return o;
}

const traducir = (error) => {
  if (!error) return null;
  if (/row-level security|permission denied/i.test(error.message || "")) return new Error("Tu usuario no tiene acceso a esta parte de Founder.");
  if (error.code === "23514") {
    if (/fechas/.test(error.message)) return new Error("El evento termina antes de empezar.");
    if (/link/.test(error.message)) return new Error("El link tiene que empezar con http:// o https://.");
    return new Error("Hay un dato fuera de lo permitido. Revisá el formulario.");
  }
  return new Error(error.message || "No se pudo guardar.");
};
const dato = ({ data, error }) => { if (error) throw traducir(error); return data; };

/* ---------- Prospectos ---------- */
export const PROSPECTO_VACIO = { nombre: "", rubro: "", zona: "", localidad: "", direccion: "", telefono: "", whatsapp: "", email: "", instagram: "", fuente: "", interes: "", notas: "" };

export async function cargarProspectos({ archivados = false } = {}) {
  let q = supabase.from("interno_prospectos_vista").select("*").order("creado_en", { ascending: false }).limit(2000);
  q = archivados ? q.not("archivado_en", "is", null) : q.is("archivado_en", null);
  return (dato(await q) || []).map(aApp);
}

export async function cargarProspecto(id) {
  const [p, contactos, oportunidades, actividades, tareas, eventos, historial] = await Promise.all([
    supabase.from("interno_prospectos_vista").select("*").eq("id", id).single(),
    supabase.from("interno_contactos").select("*").eq("prospecto_id", id).is("archivado_en", null).order("principal", { ascending: false }).order("creado_en"),
    supabase.from("interno_oportunidades").select("*, interno_etapas(nombre, tipo, orden)").eq("prospecto_id", id).is("archivado_en", null).order("creado_en"),
    supabase.from("interno_actividades").select("*").eq("prospecto_id", id).order("fecha", { ascending: false }).limit(300),
    supabase.from("interno_tareas").select("*").eq("prospecto_id", id).is("archivado_en", null).order("vence"),
    supabase.from("interno_eventos").select("*").eq("prospecto_id", id).is("archivado_en", null).order("inicio", { ascending: false }),
    supabase.from("interno_historial").select("*").eq("tabla", "interno_prospectos").eq("fila_id", id).order("fecha", { ascending: false }).limit(100),
  ]);
  return {
    prospecto: aApp(dato(p)),
    contactos: (dato(contactos) || []).map(aApp),
    oportunidades: (dato(oportunidades) || []).map((o) => ({ ...aApp(o), etapa: o.interno_etapas })),
    actividades: (dato(actividades) || []).map(aApp),
    /* Tareas y eventos son otras áreas: sin acceso, vienen vacías. */
    tareas: (tareas.data || []).map(aApp),
    eventos: (eventos.data || []).map(aApp),
    historial: (historial.data || []).map(aApp),
  };
}

export async function posiblesDuplicados({ nombre, localidad, telefono, email, excluir = null }) {
  const { data, error } = await supabase.rpc("interno_posibles_duplicados", {
    p_nombre: nombre || null, p_localidad: localidad || null, p_telefono: telefono || null, p_email: email || null, p_excluir: excluir,
  });
  if (error) throw traducir(error);
  return data || [];
}

/* Con un contacto principal si se escribió el nombre de la persona. */
export async function crearProspecto(datos, contacto = null) {
  const { contactoNombre, ...resto } = datos;
  const p = dato(await supabase.from("interno_prospectos").insert(aBase(resto)).select("id").single());
  const nombre = (contacto && contacto.nombre) || contactoNombre;
  if (nombre && nombre.trim()) {
    dato(await supabase.from("interno_contactos").insert({ prospecto_id: p.id, nombre: nombre.trim(), principal: true,
      telefono: resto.telefono || null, whatsapp: resto.whatsapp || null, email: resto.email || null }));
  }
  return p.id;
}

/* La importación de una planilla: de a cien, para que una planilla de
   quinientos no sea un solo pedido enorme ni quinientos chicos. Cada
   prospecto recibe su primera oportunidad por el disparador, igual que
   uno cargado a mano. Postgres devuelve lo insertado en el orden en que
   se mandó, y con eso se le pega a cada uno su contacto; si las cuentas
   no dan, se frena antes de pegar contactos al prospecto equivocado.
   Devuelve cuántos se crearon, aunque se corte a mitad de camino. */
export async function importarProspectos(lista, alAvanzar = () => {}) {
  let creados = 0;
  for (let i = 0; i < lista.length; i += 100) {
    const tramo = lista.slice(i, i + 100);
    const { data, error } = await supabase.from("interno_prospectos")
      .insert(tramo.map(({ contactoNombre, ...p }) => aBase(p))).select("id, nombre");
    if (error) { const e = traducir(error); e.creados = creados; throw e; }
    if (!data || data.length !== tramo.length || data.some((d, j) => d.nombre !== tramo[j].nombre)) {
      const e = new Error("La base devolvió otra cosa que la esperada: los contactos de este tramo no se cargaron."); e.creados = creados + (data ? data.length : 0); throw e;
    }
    const contactos = tramo.map((p, j) => (p.contactoNombre && p.contactoNombre.trim() ? {
      prospecto_id: data[j].id, nombre: p.contactoNombre.trim().slice(0, 120), principal: true,
      telefono: p.telefono || null, whatsapp: p.whatsapp || null, email: p.email || null,
    } : null)).filter(Boolean);
    if (contactos.length) dato(await supabase.from("interno_contactos").insert(contactos));
    creados += data.length;
    alAvanzar(creados);
  }
  return creados;
}

export async function editarProspecto(id, cambios) {
  dato(await supabase.from("interno_prospectos").update(aBase(cambios)).eq("id", id));
}

export const archivarProspecto = (id, si = true) => editarProspecto(id, { archivadoEn: si ? new Date() : null });

/* ---------- Contactos ---------- */
export async function guardarContacto(prospectoId, c) {
  if (c.id) return dato(await supabase.from("interno_contactos").update(aBase(c)).eq("id", c.id));
  return dato(await supabase.from("interno_contactos").insert({ ...aBase(c), prospecto_id: prospectoId }));
}
export const archivarContacto = (id) => supabase.from("interno_contactos").update({ archivado_en: new Date().toISOString() }).eq("id", id).then(dato);

/* ---------- Oportunidades ---------- */
export async function cargarOportunidadesAbiertas() {
  const { data, error } = await supabase.from("interno_oportunidades")
    .select("*, interno_prospectos(nombre, localidad, zona, rubro, proximo_contacto, proxima_accion)")
    .is("archivado_en", null).order("actualizado_en", { ascending: false }).limit(2000);
  if (error) throw traducir(error);
  return (data || []).map((o) => ({ ...aApp(o), prospecto: o.interno_prospectos ? aApp(o.interno_prospectos) : null }));
}

export async function guardarOportunidad(o) {
  if (o.id) return dato(await supabase.from("interno_oportunidades").update(aBase(o)).eq("id", o.id));
  return dato(await supabase.from("interno_oportunidades").insert(aBase(o)));
}

/* Mover de etapa: la base anota el cambio y ajusta estado y probabilidad. */
export async function moverOportunidad(id, etapaId, motivoPerdida = null) {
  dato(await supabase.from("interno_oportunidades").update({ etapa_id: etapaId, motivo_perdida: motivoPerdida }).eq("id", id));
}

/* ---------- La línea de tiempo ---------- */
export async function registrarActividad(a) {
  return dato(await supabase.from("interno_actividades").insert(aBase(a)).select("id").single());
}

export async function actividadReciente(limite = 20) {
  const { data, error } = await supabase.from("interno_actividades").select("*, interno_prospectos(nombre)")
    .order("fecha", { ascending: false }).limit(limite);
  if (error) throw traducir(error);
  return (data || []).map((a) => ({ ...aApp(a), prospectoNombre: a.interno_prospectos && a.interno_prospectos.nombre }));
}

/* ---------- Tareas ---------- */
export async function cargarTareas({ completadas = false } = {}) {
  let q = supabase.from("interno_tareas").select("*, interno_prospectos(nombre)").is("archivado_en", null).order("vence", { ascending: true, nullsFirst: false }).limit(1000);
  q = completadas ? q.in("estado", ["completada", "cancelada"]).order("completada_en", { ascending: false }) : q.in("estado", ["pendiente", "en_curso", "en_espera"]);
  return (dato(await q) || []).map((t) => ({ ...aApp(t), prospectoNombre: t.interno_prospectos && t.interno_prospectos.nombre }));
}

export async function guardarTarea(t) {
  const { prospectoNombre, ...resto } = t;
  if (t.id) return dato(await supabase.from("interno_tareas").update(aBase(resto)).eq("id", t.id));
  return dato(await supabase.from("interno_tareas").insert(aBase(resto)).select("id").single());
}

/* ---------- Agenda ---------- */
export async function cargarEventos(desde, hasta) {
  const { data, error } = await supabase.from("interno_eventos").select("*, interno_prospectos(nombre)")
    .is("archivado_en", null).lt("inicio", hasta.toISOString()).gte("fin", desde.toISOString()).order("inicio").limit(1000);
  if (error) throw traducir(error);
  return (data || []).map((e) => ({ ...aApp(e), prospectoNombre: e.interno_prospectos && e.interno_prospectos.nombre }));
}

export async function guardarEvento(e) {
  const { prospectoNombre, ...resto } = e;
  if (e.id) return dato(await supabase.from("interno_eventos").update(aBase(resto)).eq("id", e.id));
  return dato(await supabase.from("interno_eventos").insert(aBase(resto)).select("id").single());
}

/* Para los indicadores del inicio: todo lo registrado desde una fecha. */
export async function actividadesDesde(desde) {
  const { data, error } = await supabase.from("interno_actividades").select("id, tipo, fecha, prospecto_id, oportunidad_id, datos")
    .gte("fecha", desde.toISOString()).order("fecha", { ascending: false }).limit(5000);
  if (error) throw traducir(error);
  return (data || []).map(aApp);
}
