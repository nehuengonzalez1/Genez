/* ============================================================
   EQUIPO · quién trabaja, qué hace y cuándo
   ============================================================

   Ver la migración 0030 para por qué `personal` no es `perfiles` ni
   `recursos`.

   Todas las consultas filtran por `empresa_id` explícito, como manda la
   regla 6 de ARQUITECTURA.md: RLS contesta si podés ver algo, no de qué
   comercio es.
   ============================================================ */

import { supabase } from "./supabase.js";

export const DIAS = [
  { d: 1, n: "Lunes", corto: "Lun" },
  { d: 2, n: "Martes", corto: "Mar" },
  { d: 3, n: "Miércoles", corto: "Mié" },
  { d: 4, n: "Jueves", corto: "Jue" },
  { d: 5, n: "Viernes", corto: "Vie" },
  { d: 6, n: "Sábado", corto: "Sáb" },
  { d: 0, n: "Domingo", corto: "Dom" },
];

export const MODALIDADES = [
  { k: "hora", n: "Por hora", d: "Se le paga por hora trabajada" },
  { k: "clase", n: "Por clase", d: "Se le paga por cada clase que da" },
  { k: "comision", n: "Comisión", d: "Un porcentaje de lo que factura" },
  { k: "fijo", n: "Sueldo fijo", d: "Un monto por mes, sin importar las horas" },
];

export const TIPOS = [
  { k: "profesional", n: "Profesional" },
  { k: "recepcion", n: "Recepción" },
  { k: "otro", n: "Otro" },
];

const COLUMNA = {
  nombre: "nombre",
  tipo: "tipo",
  especialidad: "especialidad",
  tel: "tel",
  email: "email",
  modalidad: "modalidad",
  valor: "valor",
  comision: "comision",
  orden: "orden",
  activo: "activo",
  perfilId: "perfil_id",
  sucursalId: "sucursal_id",
};

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

/* La hora llega de Postgres como "08:00:00" y en pantalla se escribe
   "08:00". Los segundos no le importan a nadie acá. */
const hhmm = (t) => String(t || "").slice(0, 5);

function aPersona(f) {
  return {
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    especialidad: f.especialidad || "",
    tel: f.tel || "",
    email: f.email || "",
    modalidad: f.modalidad,
    valor: n(f.valor),
    comision: n(f.comision),
    orden: f.orden,
    activo: f.activo,
    perfilId: f.perfil_id || null,
    tieneCuenta: !!f.tiene_cuenta,
    horasSemana: n(f.horas_semana),
    diasSemana: n(f.dias_semana),
    /* Los llena `cargarEquipo`; van vacíos si alguien arma una persona
       suelta, para que la pantalla nunca reciba undefined. */
    horarios: [],
    servicios: [],
  };
}

function aFila(datos) {
  const fila = {};
  for (const [campo, valor] of Object.entries(datos)) {
    if (COLUMNA[campo] !== undefined) fila[COLUMNA[campo]] = valor;
  }
  return fila;
}

export async function cargarEquipo(empresaId) {
  if (!empresaId) throw new Error("cargarEquipo necesita saber de qué comercio.");

  const [gente, franjas, habilitados] = await Promise.all([
    supabase.from("equipo_vista").select("*")
      .eq("empresa_id", empresaId).eq("activo", true).order("orden").order("nombre"),
    supabase.from("horarios").select("id, personal_id, dia, desde, hasta")
      .eq("empresa_id", empresaId).eq("activo", true)
      .not("personal_id", "is", null).order("dia").order("desde"),
    supabase.from("personal_servicios").select("personal_id, item_id")
      .eq("empresa_id", empresaId),
  ]);

  for (const r of [gente, franjas, habilitados]) if (r.error) throw r.error;

  const porPersona = new Map();
  for (const h of franjas.data || []) {
    if (!porPersona.has(h.personal_id)) porPersona.set(h.personal_id, []);
    porPersona.get(h.personal_id).push({ id: h.id, dia: h.dia, desde: hhmm(h.desde), hasta: hhmm(h.hasta) });
  }

  const servPorPersona = new Map();
  for (const s of habilitados.data || []) {
    if (!servPorPersona.has(s.personal_id)) servPorPersona.set(s.personal_id, []);
    servPorPersona.get(s.personal_id).push(s.item_id);
  }

  return (gente.data || []).map((f) => ({
    ...aPersona(f),
    horarios: porPersona.get(f.id) || [],
    servicios: servPorPersona.get(f.id) || [],
  }));
}

/* El catálogo de prestaciones, para elegir qué da cada uno. Vive acá y no
   en `items.js` porque `cargarProductos` trae solo `tipo = 'producto'`: un
   servicio no es un producto y no comparte ni pantalla ni columnas útiles. */
export async function cargarServicios(empresaId) {
  if (!empresaId) throw new Error("cargarServicios necesita saber de qué comercio.");

  const { data, error } = await supabase
    .from("items")
    .select("id, nombre, categoria, duracion_min, precio")
    .eq("empresa_id", empresaId)
    .eq("tipo", "servicio")
    .eq("activo", true)
    .order("categoria")
    .order("nombre");
  if (error) throw error;

  return (data || []).map((i) => ({
    id: i.id,
    nombre: i.nombre,
    categoria: i.categoria || "Sin categoría",
    duracion: i.duracion_min || 0,
    precio: n(i.precio),
  }));
}

export async function crearPersona(empresaId, datos) {
  const fila = { ...aFila(datos), empresa_id: empresaId };
  if (!fila.nombre) throw new Error("La persona necesita un nombre.");

  const { data, error } = await supabase.from("personal").insert(fila).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya hay alguien con ese nombre en el equipo.");
    throw error;
  }
  return data.id;
}

export async function guardarPersona(id, cambios) {
  const fila = aFila(cambios);
  if (!Object.keys(fila).length) return;

  const { error } = await supabase.from("personal").update(fila).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Ya hay alguien con ese nombre en el equipo.");
    throw error;
  }
}

/* No se borra: se desactiva. Va a tener turnos dados y liquidaciones
   pagadas atrás, y borrarla dejaría horas trabajadas sin dueño. */
export async function desactivarPersona(id) {
  const { error } = await supabase.from("personal").update({ activo: false }).eq("id", id);
  if (error) throw error;
}

/* Los horarios se reemplazan enteros en vez de diferenciarse fila por
   fila. Son cinco o seis franjas por persona: calcular qué cambió cuesta
   más código y más bugs que rehacerlas. */
export async function guardarHorarios(empresaId, personalId, franjas) {
  const { error: eBorrar } = await supabase
    .from("horarios").delete().eq("empresa_id", empresaId).eq("personal_id", personalId);
  if (eBorrar) throw eBorrar;

  const filas = (franjas || [])
    .filter((f) => f.desde && f.hasta && f.hasta > f.desde)
    .map((f) => ({ empresa_id: empresaId, personal_id: personalId, dia: f.dia, desde: f.desde, hasta: f.hasta }));

  if (!filas.length) return;
  const { error } = await supabase.from("horarios").insert(filas);
  if (error) throw error;
}

export async function guardarServicios(empresaId, personalId, itemIds) {
  const { error: eBorrar } = await supabase
    .from("personal_servicios").delete().eq("empresa_id", empresaId).eq("personal_id", personalId);
  if (eBorrar) throw eBorrar;

  const filas = (itemIds || []).map((item_id) => ({ empresa_id: empresaId, personal_id: personalId, item_id }));
  if (!filas.length) return;

  const { error } = await supabase.from("personal_servicios").insert(filas);
  if (error) throw error;
}
