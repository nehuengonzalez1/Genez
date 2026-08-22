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

    /* `forma` la resuelve la vista: turno, clase o inscripción. La
       pantalla no tiene que deducirla mirando si hay cupo. */
    forma: f.forma || "turno",
    claseId: f.clase_id || null,
    cupo: f.cupo,
    anotados: n(f.anotados),
    lugares: f.lugares === null || f.lugares === undefined ? null : n(f.lugares),
    esperando: n(f.esperando),

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

/* ============================================================
   CLASES GRUPALES
   ============================================================

   Una clase es una reserva con cupo; anotarse es una reserva que apunta a
   ella. Ver la migración 0034 para por qué van en la misma tabla y por
   qué las inscripciones no ocupan la sala.
   ============================================================ */

const MOTIVOS_CLASE = {
  P0040: "Una clase necesita al menos un lugar.",
  P0041: "En esa sala no entra tanta gente.",
  P0042: "No existe esa clase.",
  P0043: "Eso no es una clase.",
  P0044: "Esa clase está cancelada.",
  P0045: "Esa clase ya está completa.",
  P0046: "Esa persona ya está anotada.",
};

function traducirClase(error) {
  const codigo = error && error.code;
  return new Error(MOTIVOS_CLASE[codigo] || MOTIVOS[codigo] || (error && error.message) || "No se pudo.");
}

export async function crearClase({
  empresaId, sucursalId = null, personalId = null, recursoId = null,
  itemId = null, nombre, desde, duracion = 60, cupo = 1, notas = "",
}) {
  const { data, error } = await supabase.rpc("crear_clase", {
    p: {
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      personal_id: personalId,
      recurso_id: recursoId,
      item_id: itemId,
      nombre: nombre || "Clase",
      desde: desde.toISOString(),
      duracion_min: duracion,
      cupo,
      notas,
    },
  });
  if (error) throw traducirClase(error);
  return data;
}

/* El cupo lo controla la base con la clase bloqueada: dos personas
   apretando "anotar" sobre el último lugar terminan con una adentro y una
   afuera, y no con siete en una clase de seis. */
export async function inscribir({ claseId, clienteId = null, nombre, telefono = null, notas = "" }) {
  const { data, error } = await supabase.rpc("inscribir", {
    p: { clase_id: claseId, cliente_id: clienteId, nombre: nombre || "Sin nombre", telefono, notas },
  });
  if (error) throw traducirClase(error);
  return data;
}

export async function cargarInscriptos(empresaId, claseId) {
  if (!empresaId) throw new Error("cargarInscriptos necesita saber de qué comercio.");
  const { data, error } = await supabase
    .from("agenda_vista")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("clase_id", claseId)
    .order("creada_en");
  if (error) throw error;
  return (data || []).map(aTurno);
}

/* ------------------------------------------------------------
   Lista de espera

   No se promueve sola. Liberar un lugar y meter a alguien sin avisarle es
   peor que el problema: la persona se entera cuando ya no puede ir.
   ------------------------------------------------------------ */

export async function cargarEspera(empresaId, claseId) {
  const { data, error } = await supabase
    .from("espera")
    .select("id, cliente_id, nombre, telefono, notas, estado, orden, creada_en")
    .eq("empresa_id", empresaId)
    .eq("clase_id", claseId)
    .in("estado", ["esperando", "avisado"])
    .order("orden")
    .order("creada_en");
  if (error) throw error;
  return data || [];
}

export async function anotarEnEspera({ empresaId, claseId, clienteId = null, nombre, telefono = null }) {
  const { error } = await supabase.from("espera").insert({
    empresa_id: empresaId, clase_id: claseId, cliente_id: clienteId,
    nombre: nombre || "Sin nombre", telefono,
  });
  if (error) throw error;
}

export async function marcarEspera(id, estado) {
  const { error } = await supabase.from("espera").update({ estado }).eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------
   Bloqueos y ausencias

   Con `personalId` en null el bloqueo es de todo el comercio: eso es un
   feriado o un corte de luz.
   ------------------------------------------------------------ */

export const MOTIVOS_BLOQUEO = [
  { k: "ausencia", n: "Ausencia" },
  { k: "vacaciones", n: "Vacaciones" },
  { k: "feriado", n: "Feriado" },
  { k: "licencia", n: "Licencia" },
];

export async function cargarBloqueos(empresaId, { desde, hasta }) {
  if (!empresaId) throw new Error("cargarBloqueos necesita saber de qué comercio.");
  const { data, error } = await supabase
    .from("excepciones")
    .select("id, personal_id, desde, hasta, motivo, nota")
    .eq("empresa_id", empresaId)
    .lt("desde", hasta.toISOString())
    .gt("hasta", desde.toISOString())
    .order("desde");
  if (error) throw error;
  return (data || []).map((b) => ({
    id: b.id,
    personalId: b.personal_id || null,
    desde: new Date(b.desde),
    hasta: new Date(b.hasta),
    motivo: b.motivo,
    nota: b.nota || "",
  }));
}

export async function bloquear({ empresaId, personalId = null, desde, hasta, motivo = "ausencia", nota = "" }) {
  const { error } = await supabase.from("excepciones").insert({
    empresa_id: empresaId,
    personal_id: personalId,
    desde: desde.toISOString(),
    hasta: hasta.toISOString(),
    motivo,
    nota: nota || null,
  });
  if (error) throw error;
}

export async function quitarBloqueo(id) {
  const { error } = await supabase.from("excepciones").delete().eq("id", id);
  if (error) throw error;
}
