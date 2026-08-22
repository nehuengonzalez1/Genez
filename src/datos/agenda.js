/* ============================================================
   AGENDA · los turnos
   ============================================================

   Un turno es una `reserva`: alguien compromete un recurso durante un
   rato. Es la misma entidad que la reserva de mesa del bar, con dos
   columnas más —quién atiende y qué servicio— que en gastronomía van en
   null. Ver la migración 0032 para por qué no hay una tabla `turnos`.

   Lo que puede impedir un turno vive en la base, no acá: `agendar_turno`
   y `mover_turno` validan choques de sala, de persona, de horario y de
   ausencias en la misma transacción. Esta capa solo traduce el error a
   algo que se pueda leer.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";

/* Los seis estados. `sentada` viene del salón —la mesa se sentó— y en la
   agenda significa lo mismo: la persona llegó y está adentro. Se muestra
   con otra palabra y no se renombra la columna, porque renombrarla
   rompería el mapa de mesas. */
export const ESTADOS = [
  { k: "pendiente", n: "Pendiente", tono: "ojo", d: "Se pidió, falta que el cliente confirme" },
  { k: "confirmada", n: "Confirmado", tono: "info", d: "El cliente dijo que viene" },
  { k: "sentada", n: "En curso", tono: "acento", d: "Está siendo atendido" },
  { k: "cumplida", n: "Asistió", tono: "bien", d: "Vino y se atendió" },
  { k: "ausente", n: "No vino", tono: "mal", d: "No se presentó" },
  { k: "cancelada", n: "Cancelado", tono: "tenue", d: "Se dio de baja" },
];

export const estadoDe = (k) => ESTADOS.find((e) => e.k === k) || { k, n: k, tono: "tenue" };

/* Los que ocupan un lugar. Una cancelación y una ausencia lo liberan, así
   que ese rato se puede volver a vender. */
export const OCUPAN = ["pendiente", "confirmada", "sentada", "cumplida"];

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

function aTurno(f) {
  return {
    id: f.id,
    desde: new Date(f.desde),
    hasta: new Date(f.hasta),
    duracion: f.duracion_min,
    estado: f.estado,
    notas: f.notas || "",
    personas: f.personas,

    clienteId: f.cliente_id || null,
    cliente: f.cliente || f.nombre || "Sin nombre",
    telefono: f.telefono || "",

    personalId: f.personal_id || null,
    profesional: f.profesional || "",
    especialidad: f.especialidad || "",

    itemId: f.item_id || null,
    servicio: f.servicio || "",
    area: f.area || "",
    precio: n(f.precio),

    recursoId: f.recurso_id || null,
    sala: f.sala || "",

    operacionId: f.operacion_id || null,
    pagado: n(f.pagado),
  };
}

/* Los turnos de una ventana de tiempo. La ventana se pide siempre: una
   agenda sin límite trae el historial entero el día que el negocio lleve
   dos años funcionando. */
export async function cargarTurnos(empresaId, { desde, hasta, personalId = null, recursoId = null, itemId = null, estado = null } = {}) {
  if (!empresaId) throw new Error("cargarTurnos necesita saber de qué comercio.");
  if (!desde || !hasta) throw new Error("cargarTurnos necesita un desde y un hasta.");

  let q = supabase
    .from("agenda_vista")
    .select("*")
    .eq("empresa_id", empresaId)
    .gte("desde", desde.toISOString())
    .lt("desde", hasta.toISOString())
    .order("desde")
    .limit(2000);

  if (personalId) q = q.eq("personal_id", personalId);
  if (recursoId) q = q.eq("recurso_id", recursoId);
  if (itemId) q = q.eq("item_id", itemId);
  if (estado) q = q.eq("estado", estado);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(aTurno);
}

/* Los errores que puede tirar la base al agendar, con su explicación. Los
   códigos los define la migración 0032; traducirlos acá evita que la
   pantalla muestre "P0034" o un texto de Postgres. */
const MOTIVOS = {
  P0030: "El turno tiene que durar algo.",
  P0031: "Un turno no puede cruzar la medianoche.",
  P0032: "Esa sala no es de este comercio.",
  P0033: "Esa persona no es de este comercio.",
  P0034: "Esa sala ya está ocupada en ese horario.",
  P0035: "Esa persona ya tiene un turno en ese horario.",
  P0036: "Esa persona no trabaja en ese horario.",
  P0037: "Hay una ausencia o un bloqueo en ese horario.",
  P0038: "No podés agendar en ese comercio.",
  P0039: "Un turno cumplido o cancelado no se reprograma.",
};

function traducir(error) {
  const codigo = error && (error.code || (error.details && error.details.code));
  const claro = MOTIVOS[codigo];
  return new Error(claro || (error && error.message) || "No se pudo agendar.");
}

export async function agendarTurno({
  empresaId, sucursalId = null, clienteId = null, personalId = null,
  recursoId = null, itemId = null, nombre, telefono = null,
  desde, duracion = 60, personas = 1, notas = "", estado = "pendiente",
}) {
  const { data, error } = await supabase.rpc("agendar_turno", {
    p: {
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      cliente_id: clienteId,
      personal_id: personalId,
      recurso_id: recursoId,
      item_id: itemId,
      nombre: nombre || "Sin nombre",
      telefono,
      desde: desde.toISOString(),
      duracion_min: duracion,
      personas,
      notas,
      estado,
    },
  });
  if (error) throw traducir(error);
  return data;
}

export async function moverTurno(id, desde, duracion = null) {
  const { error } = await supabase.rpc("mover_turno", {
    p_id: id,
    p_desde: desde.toISOString(),
    p_duracion: duracion,
  });
  if (error) throw traducir(error);
}

/* El estado se cambia con un update simple: no toca varias tablas, así
   que no necesita función. La bitácora la escribe un disparador. */
export async function cambiarEstado(id, estado) {
  const { error } = await supabase.from("reservas").update({ estado }).eq("id", id);
  if (error) throw traducir(error);
}

export async function guardarNotas(id, notas) {
  const { error } = await supabase.from("reservas").update({ notas: notas || null }).eq("id", id);
  if (error) throw traducir(error);
}

/* Recepción y el profesional tienen que ver lo mismo. `reservas` ya está
   publicada en tiempo real desde la migración 0024, así que esto no
   necesitó nada del lado de la base.

   Devuelve la función para desuscribirse; quien llama la usa en el
   cleanup del efecto o deja el canal abierto para siempre. */
export function escucharTurnos(empresaId, alCambiar) {
  const canal = supabase
    .channel(`agenda:${empresaId}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "reservas", filter: `empresa_id=eq.${empresaId}` },
      (msg) => alCambiar(msg))
    .subscribe();

  return () => { supabase.removeChannel(canal); };
}

/* ------------------------------------------------------------
   Disponibilidad, del lado del navegador

   Esto NO reemplaza la validación de la base: es para que la pantalla
   pueda avisar antes de que el usuario apriete guardar, y para dibujar el
   horario laboral de fondo. Lo que decide sigue siendo `revisar_turno`.
   ------------------------------------------------------------ */

/* Las franjas de trabajo de una persona en un día, en minutos desde la
   medianoche. Sin horarios cargados devuelve el día entero: todavía nadie
   los cargó y no corresponde bloquear a quien está trabajando. */
export function franjasDelDia(persona, fecha) {
  if (!persona || !persona.horarios || persona.horarios.length === 0) {
    return [{ desde: 0, hasta: 24 * 60 }];
  }
  const dia = fecha.getDay();
  return persona.horarios
    .filter((h) => h.dia === dia)
    .map((h) => ({ desde: aMinutos(h.desde), hasta: aMinutos(h.hasta) }))
    .sort((a, b) => a.desde - b.desde);
}

export const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
};

export const aReloj = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;

export const minutosDe = (fecha) => fecha.getHours() * 60 + fecha.getMinutes();

/* Si un turno pisa a otro. Se usa para avisar en el formulario. */
export function choca(turnos, { desde, duracion, ignorar = null }) {
  const fin = new Date(desde.getTime() + duracion * 60000);
  return turnos.some((t) =>
    t.id !== ignorar && OCUPAN.includes(t.estado) && t.desde < fin && t.hasta > desde);
}
