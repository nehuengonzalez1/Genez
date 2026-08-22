/* ============================================================
   RESERVAS
   ============================================================

   Una mesa comprometida para más tarde. No es una operación: no vende
   nada, no tiene líneas y puede no ocurrir nunca. Cuando la gente llega,
   `sentar_reserva` abre la comanda y ata las dos cosas; a partir de ahí
   lo que consuman es de la comanda, como cualquier mesa.
   ============================================================ */

import { supabase } from "./supabase.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

export const ESTADOS_RESERVA = [
  { k: "pendiente", n: "Pendiente" },
  { k: "sentada",   n: "Sentada" },
  { k: "cumplida",  n: "Cumplida" },
  { k: "ausente",   n: "No vino" },
  { k: "cancelada", n: "Cancelada" },
];

export const nombreEstadoReserva = (k) =>
  (ESTADOS_RESERVA.find((e) => e.k === k) || { n: k }).n;

function aReserva(f) {
  return {
    id: f.id,
    nombre: f.nombre,
    telefono: f.telefono || "",
    personas: n(f.personas),
    desde: new Date(f.desde),
    duracion: n(f.duracion_min),
    estado: f.estado,
    notas: f.notas || "",
    recursoId: f.recurso_id,
    mesa: f.recursos ? f.recursos.nombre : null,
    sector: f.recursos ? f.recursos.sector : null,
    clienteId: f.cliente_id,
    comandaId: f.operacion_id,
    quien: f.perfiles ? f.perfiles.nombre : "",
    creadaEn: f.creada_en ? new Date(f.creada_en) : null,
  };
}

const COLUMNAS = `
  id, nombre, telefono, personas, desde, duracion_min, estado, notas,
  recurso_id, cliente_id, operacion_id, creada_en,
  recursos ( nombre, sector ),
  perfiles ( nombre )
`;

/* Las del día, que es lo que se mira mientras se atiende. El rango va
   completo y no "desde ahora": a las nueve de la noche todavía importa
   quién reservó a las ocho y no vino. */
export async function cargarReservas(empresaId, { desde = null, hasta = null, estado = null } = {}) {
  let q = supabase
    .from("reservas").select(COLUMNAS)
    .eq("empresa_id", empresaId)
    .order("desde");

  if (desde) q = q.gte("desde", desde instanceof Date ? desde.toISOString() : desde);
  if (hasta) q = q.lt("desde", hasta instanceof Date ? hasta.toISOString() : hasta);
  if (estado) q = q.eq("estado", estado);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(aReserva);
}

export async function crearReserva(empresaId, { sucursalId = null, recursoId = null, clienteId = null, nombre, telefono, personas, desde, duracion = 90, notas = "" }) {
  const { data, error } = await supabase
    .from("reservas")
    .insert({
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      recurso_id: recursoId,
      cliente_id: clienteId,
      nombre: (nombre || "").trim(),
      telefono: (telefono || "").trim() || null,
      personas: Math.max(1, Math.round(personas) || 1),
      desde: desde instanceof Date ? desde.toISOString() : desde,
      duracion_min: Math.max(15, Math.round(duracion) || 90),
      notas: (notas || "").trim() || null,
    })
    .select(COLUMNAS).single();

  if (error) throw error;
  return aReserva(data);
}

export async function guardarReserva(id, cambios) {
  const fila = {};
  if (cambios.nombre !== undefined) fila.nombre = cambios.nombre.trim();
  if (cambios.telefono !== undefined) fila.telefono = cambios.telefono.trim() || null;
  if (cambios.personas !== undefined) fila.personas = Math.max(1, Math.round(cambios.personas) || 1);
  if (cambios.desde !== undefined) fila.desde = cambios.desde instanceof Date ? cambios.desde.toISOString() : cambios.desde;
  if (cambios.duracion !== undefined) fila.duracion_min = Math.max(15, Math.round(cambios.duracion) || 90);
  if (cambios.notas !== undefined) fila.notas = cambios.notas.trim() || null;
  if (cambios.recursoId !== undefined) fila.recurso_id = cambios.recursoId;
  if (cambios.estado !== undefined) fila.estado = cambios.estado;

  const { data, error } = await supabase
    .from("reservas").update(fila).eq("id", id).select(COLUMNAS).single();
  if (error) throw error;
  return aReserva(data);
}

export const cambiarEstadoReserva = (id, estado) => guardarReserva(id, { estado });

/* Abrir la mesa y marcar la reserva en el mismo acto. Separado queda a
   medias: la mesa abierta y la reserva figurando pendiente toda la
   noche. Devuelve la comanda. */
export async function sentarReserva(id) {
  const { data, error } = await supabase.rpc("sentar_reserva", { p_reserva: id });
  if (error) {
    const dicho = {
      P0010: "No encontramos esa reserva.",
      P0015: "Esa reserva ya no está pendiente.",
      P0016: "Asignale una mesa antes de sentarla.",
    }[error.code];
    throw new Error(dicho || error.message);
  }
  return data;
}
