/* ============================================================
   SERVICIOS Y RECURSOS · qué se ofrece y dónde se hace
   ============================================================

   No hay tablas propias: una prestación es un `item` con
   `tipo = 'servicio'` y una sala es un `recurso`. Estaba previsto desde la
   primera migración —`duracion_min` dice, textual, "solo para servicios
   con turno"— así que acá no se inventa nada, se lee lo que ya está.

   La modalidad y el cupo viven en `campos_extra` y no en columnas propias
   porque son de este rubro: a un producto de minimercado no le sirven, y
   una columna que está siempre vacía en dos de cada tres comercios es una
   columna que sobra.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

export const TIPOS_RECURSO = [
  { k: "sala", n: "Sala", d: "Un ambiente donde se atiende" },
  { k: "camilla", n: "Camilla o box", d: "Un puesto adentro de un ambiente" },
  { k: "equipamiento", n: "Equipamiento", d: "Una máquina que se reserva y puede moverse" },
  { k: "sillon", n: "Sillón", d: "Un puesto de peluquería o barbería" },
  { k: "otro", n: "Otro", d: "" },
];

export const nombreTipo = (k) => (TIPOS_RECURSO.find((t) => t.k === k) || { n: k }).n;

function aServicio(i) {
  const extra = i.campos_extra || {};
  return {
    id: i.id,
    nombre: i.nombre,
    categoria: i.categoria || "",
    duracion: i.duracion_min || 0,
    precio: n(i.precio),
    activo: i.activo,
    /* Sin modalidad guardada, un servicio con cupo mayor a uno es grupal:
       el dato está, solo que dicho de otra manera. */
    modalidad: extra.modalidad || (Number(extra.capacidad) > 1 ? "grupal" : "individual"),
    capacidad: extra.capacidad != null ? Number(extra.capacidad) : 1,
    demo: extra.demo === true,
  };
}

export async function cargarServicios(empresaId, { soloActivos = true } = {}) {
  if (!empresaId) throw new Error("cargarServicios necesita saber de qué comercio.");

  let q = supabase
    .from("items")
    .select("id, nombre, categoria, duracion_min, precio, activo, campos_extra")
    .eq("empresa_id", empresaId)
    .eq("tipo", "servicio");
  if (soloActivos) q = q.eq("activo", true);

  const { data, error } = await q.order("categoria").order("nombre");
  if (error) throw error;
  return (data || []).map(aServicio);
}

export async function guardarServicio(empresaId, s) {
  const fila = {
    empresa_id: empresaId,
    tipo: "servicio",
    nombre: s.nombre,
    categoria: s.categoria || null,
    duracion_min: Number(s.duracion) || null,
    precio: Number(s.precio) || 0,
    controla_stock: false,
    activo: s.activo !== false,
    campos_extra: {
      modalidad: s.modalidad || "individual",
      capacidad: s.modalidad === "grupal" ? Math.max(2, Number(s.capacidad) || 2) : 1,
      /* La marca de demostración se conserva: es lo que permite barrer de
         una los datos de ejemplo cuando lleguen los de verdad. */
      ...(s.demo ? { demo: true } : {}),
    },
  };

  if (s.id) {
    const { error } = await supabase.from("items").update(fila).eq("id", s.id);
    if (error) throw error;
    return s.id;
  }

  const { data, error } = await supabase.from("items").insert(fila).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya hay una prestación con ese código.");
    throw error;
  }
  return data.id;
}

/* No se borra: puede tener turnos dados atrás, y borrarla dejaría esos
   turnos sin saber qué se hizo. */
export async function desactivarServicio(id) {
  const { error } = await supabase.from("items").update({ activo: false }).eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------
   Quién da cada cosa

   La tabla es la misma que usa Equipo. Se puede llegar desde los dos
   lados —desde la persona o desde el servicio— porque en la práctica se
   piensa de las dos maneras: "qué hace Carla" y "quién puede dar esto".
   ------------------------------------------------------------ */

export async function cargarQuienDaQue(empresaId) {
  if (!empresaId) throw new Error("cargarQuienDaQue necesita saber de qué comercio.");
  const { data, error } = await supabase
    .from("personal_servicios")
    .select("personal_id, item_id")
    .eq("empresa_id", empresaId);
  if (error) throw error;

  const porServicio = new Map();
  for (const r of data || []) {
    if (!porServicio.has(r.item_id)) porServicio.set(r.item_id, []);
    porServicio.get(r.item_id).push(r.personal_id);
  }
  return porServicio;
}

export async function guardarQuienLoDa(empresaId, itemId, personalIds) {
  const { error: eBorrar } = await supabase
    .from("personal_servicios").delete().eq("empresa_id", empresaId).eq("item_id", itemId);
  if (eBorrar) throw eBorrar;

  const filas = (personalIds || []).map((personal_id) => ({ empresa_id: empresaId, item_id: itemId, personal_id }));
  if (!filas.length) return;

  const { error } = await supabase.from("personal_servicios").insert(filas);
  if (error) throw error;
}

/* ------------------------------------------------------------
   Los espacios
   ------------------------------------------------------------ */

function aRecurso(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    sector: r.sector || "",
    capacidad: r.capacidad == null ? 1 : Number(r.capacidad),
    orden: r.orden,
    activo: r.activo,
    demo: r.campos_extra && r.campos_extra.demo === true,
  };
}

export async function cargarEspacios(empresaId, { soloActivos = true } = {}) {
  if (!empresaId) throw new Error("cargarEspacios necesita saber de qué comercio.");

  let q = supabase
    .from("recursos")
    .select("id, nombre, tipo, sector, capacidad, orden, activo, campos_extra")
    .eq("empresa_id", empresaId);
  if (soloActivos) q = q.eq("activo", true);

  const { data, error } = await q.order("orden").order("nombre");
  if (error) throw error;
  return (data || []).map(aRecurso);
}

export async function guardarEspacio(empresaId, e) {
  const fila = {
    empresa_id: empresaId,
    nombre: e.nombre,
    tipo: e.tipo || "sala",
    sector: e.sector || null,
    capacidad: Number(e.capacidad) || 1,
    orden: Number(e.orden) || 0,
    activo: e.activo !== false,
  };

  if (e.id) {
    const { error } = await supabase.from("recursos").update(fila).eq("id", e.id);
    if (error) throw error;
    return e.id;
  }

  const { data, error } = await supabase.from("recursos").insert(fila).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya hay un espacio con ese nombre.");
    throw error;
  }
  return data.id;
}

/* Tampoco se borra: hay turnos que apuntan a esta sala. */
export async function desactivarEspacio(id) {
  const { error } = await supabase.from("recursos").update({ activo: false }).eq("id", id);
  if (error) throw error;
}

/* Cuántos turnos tiene cada cosa en los próximos días. Sirve para avisar
   antes de dar de baja algo que está en uso. */
export async function usoProximo(empresaId, { dias = 30 } = {}) {
  const hasta = new Date(Date.now() + dias * 86400000);
  const { data, error } = await supabase
    .from("reservas")
    .select("recurso_id, item_id")
    .eq("empresa_id", empresaId)
    .gte("desde", new Date().toISOString())
    .lt("desde", hasta.toISOString())
    .neq("estado", "cancelada")
    .limit(3000);
  if (error) throw error;

  const porRecurso = new Map();
  const porItem = new Map();
  for (const r of data || []) {
    if (r.recurso_id) porRecurso.set(r.recurso_id, (porRecurso.get(r.recurso_id) || 0) + 1);
    if (r.item_id) porItem.set(r.item_id, (porItem.get(r.item_id) || 0) + 1);
  }
  return { porRecurso, porItem };
}
