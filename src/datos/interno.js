/* ============================================================
   GENEZ FOUNDER · la base interna (0113)
   ============================================================

   Todo lo de Founder pasa por acá o por otros archivos de
   src/datos/interno*, igual que lo de los comercios pasa por src/datos/.
   Lo que protege estos datos no es este archivo: son las políticas de
   las tablas interno_* (es_interno). Si esta pantalla se abriera en la
   cuenta de un comercio, las consultas volverían vacías.
   ============================================================ */

import { supabase } from "./supabase.js";

/* La membresía propia: { rol, areas, activo } o null. Sin la tabla
   (antes de 0113) o sin fila, null: Founder no se ofrece. */
export async function miMembresia() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("interno_miembros").select("rol, areas, activo").eq("perfil_id", user.id).maybeSingle();
  if (error || !data) return null;
  /* perfilId: la sesión de plataforma no trae el id, y el equipo lo
     necesita para no ofrecerle a nadie editarse a sí mismo. */
  return { perfilId: user.id, rol: data.rol, areas: data.areas || [], activo: data.activo !== false };
}

export const puedeArea = (interno, area) =>
  !!(interno && interno.activo && (interno.areas.includes("*") || interno.areas.includes(area)));

/* ---------- Las listas configurables ---------- */
export const TIPOS_DE_LISTA = [
  { k: "zona", n: "Zonas comerciales" },
  { k: "rubro", n: "Rubros" },
  { k: "fuente", n: "Fuentes de prospectos" },
  { k: "motivo_perdida", n: "Motivos de pérdida" },
  { k: "tipo_actividad", n: "Tipos de actividad" },
  { k: "tipo_evento", n: "Tipos de evento" },
  { k: "categoria_tarea", n: "Categorías de tareas" },
  { k: "etiqueta", n: "Etiquetas" },
  { k: "etapa_implementacion", n: "Etapas de implementación" },
  { k: "modulo", n: "Módulos (para soporte)" },
  { k: "categoria_ticket", n: "Categorías de tickets" },
  { k: "canal_ticket", n: "Canales de soporte" },
  { k: "tipo_documento", n: "Tipos de documento" },
];

const traducir = (error, que) => {
  if (!error) return null;
  if (error.code === "23505") return new Error(`Ya hay ${que} con ese nombre.`);
  if (/row-level security|permission denied/i.test(error.message || "")) return new Error("Tu usuario no puede cambiar la configuración de Founder.");
  if (error.code === "23514") return new Error("Revisá los datos: hay uno fuera de lo permitido.");
  return new Error(error.message || "No se pudo guardar.");
};

export async function cargarListas() {
  const { data, error } = await supabase.from("interno_listas").select("id, tipo, clave, nombre, orden, activo, datos").order("tipo").order("orden").order("nombre");
  if (error) throw error;
  return data || [];
}

/* La clave sale del nombre la primera vez y no cambia más: es la que
   guardan los registros, así renombrar no rompe nada. */
export const claveDe = (nombre) => String(nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "item";

export async function crearItemDeLista(tipo, nombre, orden = 99) {
  const { error } = await supabase.from("interno_listas").insert({ tipo, clave: claveDe(nombre), nombre: nombre.trim(), orden });
  if (error) throw traducir(error, "uno");
}

export async function editarItemDeLista(id, cambios) {
  const fila = {};
  if (cambios.nombre !== undefined) fila.nombre = cambios.nombre.trim();
  if (cambios.orden !== undefined) fila.orden = cambios.orden;
  if (cambios.activo !== undefined) fila.activo = !!cambios.activo;
  const { error } = await supabase.from("interno_listas").update(fila).eq("id", id);
  if (error) throw traducir(error, "uno");
}

/* ---------- Las etapas del pipeline ---------- */
export async function cargarEtapas() {
  const { data, error } = await supabase.from("interno_etapas").select("id, nombre, orden, probabilidad, tipo, activa").order("orden");
  if (error) throw error;
  return data || [];
}

export async function crearEtapa({ nombre, orden, probabilidad = 0, tipo = "abierta" }) {
  const { error } = await supabase.from("interno_etapas").insert({ nombre: nombre.trim(), orden, probabilidad: Number(probabilidad) || 0, tipo });
  if (error) throw traducir(error, "una etapa");
}

export async function editarEtapa(id, cambios) {
  const fila = {};
  for (const k of ["nombre", "orden", "probabilidad", "tipo", "activa"]) if (cambios[k] !== undefined) fila[k] = k === "nombre" ? cambios[k].trim() : cambios[k];
  const { error } = await supabase.from("interno_etapas").update(fila).eq("id", id);
  if (error) throw traducir(error, "una etapa");
}

/* ---------- El equipo ---------- */
export async function cargarMiembros() {
  const { data, error } = await supabase.from("interno_miembros").select("perfil_id, rol, areas, activo, creado_en, perfiles(nombre, email)").order("creado_en");
  if (error) throw error;
  return (data || []).map((m) => ({ ...m, nombre: (m.perfiles && m.perfiles.nombre) || "", email: (m.perfiles && m.perfiles.email) || "" }));
}

/* ---------- Lo que ya había: los pedidos de la web ---------- */
export async function contarSolicitudes() {
  const { count, error } = await supabase.from("solicitudes").select("id", { count: "exact", head: true });
  if (error) return null;
  return count || 0;
}
