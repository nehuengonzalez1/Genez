/* ============================================================
   COMUNICACIONES · lo que hay que avisar hoy
   ============================================================

   CRM contesta a quién conviene escribirle esta semana. Esto contesta a
   quién hay que avisarle algo ahora, que es una tarea de todos los días y
   la hace otra persona. Ver la migración 0044 para por qué son dos
   módulos y una sola tabla de mensajes.

   LAS PLANTILLAS SON UN TEXTO CON HUECOS
   --------------------------------------
   `{nombre}`, `{fecha}`, `{hora}`, `{servicio}`. Se reemplazan acá y no
   en la base: el texto lo escribe una persona en un textarea y tiene que
   poder verlo resuelto mientras lo escribe, sin ida y vuelta al servidor.

   Un hueco que no existe se deja tal cual y no se borra: si alguien
   escribe `{profe}` y no anda, tiene que verlo en la pantalla. Borrarlo
   en silencio le deja un mensaje mocho y ninguna pista de por qué.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";
import { voz } from "./rubros.js";

const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "";

/* ------------------------------------------------------------
   Los textos de fábrica

   No están en la base a propósito: un comercio nuevo tiene que poder
   mandar un recordatorio el primer día sin que nadie le siembre nada, y
   "volver al original" tiene que ser borrar una fila y no reescribir un
   texto de memoria.

   Están escritos como los escribe alguien del mostrador: cortos, sin una
   palabra de sistema y sin mayúsculas de formulario.
   ------------------------------------------------------------ */

export const PLANTILLAS = [
  {
    k: "recordatorio",
    n: "Recordatorio de turno",
    d: "El aviso del día anterior. Es el que más se manda y el que evita la mitad de las ausencias.",
    texto:
      "Hola {nombre}! Te recuerdo tu turno de {servicio} el {fecha} a las {hora}. " +
      "Si no vas a poder venir avisame así libero el lugar. ¡Nos vemos!",
  },
  {
    k: "confirmacion",
    n: "Pedido de confirmación",
    d: "Para los turnos que todavía figuran sin confirmar.",
    texto:
      "Hola {nombre}! Tenés turno de {servicio} el {fecha} a las {hora} con {profesional}. " +
      "¿Me confirmás que venís? Gracias!",
  },
  {
    k: "cambio",
    n: "Cambio de horario",
    d: "Cuando hay que mover un turno ya dado.",
    texto:
      "Hola {nombre}! Se nos complicó con el horario del {fecha} a las {hora}. " +
      "¿Te sirve otro día de esta semana? Decime cuál te queda cómodo y te lo reservo.",
  },
  {
    k: "hueco",
    n: "Se liberó un lugar",
    d: "Para ofrecer un lugar que quedó libre a quien está esperando.",
    texto:
      "Hola {nombre}! Se liberó un lugar en {servicio} el {fecha} a las {hora}. " +
      "¿Lo querés? Avisame y te lo guardo.",
  },
];

export const plantillaPorK = (k) => PLANTILLAS.find((p) => p.k === k) || PLANTILLAS[0];

/* Los huecos que se pueden usar, con un ejemplo al lado. La pantalla los
   muestra para que nadie tenga que adivinarlos ni buscarlos en un
   manual que no existe. */
export const HUECOS = [
  { k: "nombre", d: "el primer nombre del cliente" },
  { k: "fecha", d: "martes 26 de agosto" },
  { k: "hora", d: "09:00" },
  { k: "servicio", d: "Pilates Reformer" },
  { k: "profesional", d: "quién lo atiende" },
  { k: "sala", d: "dónde es" },
  { k: "negocio", d: "el nombre del comercio" },
];

const fechaLarga = (d) =>
  d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

const horaCorta = (d) =>
  d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

/* Reemplaza los huecos con lo del turno. Lo que no reconoce lo deja
   escrito: un `{profe}` que aparece tal cual en la vista previa se
   corrige solo; uno que desaparece manda un mensaje incompleto. */
export function resolver(texto, turno, ajustes, rubro) {
  const valores = {
    nombre: primerNombre(turno.cliente),
    fecha: turno.desde ? fechaLarga(turno.desde) : "",
    hora: turno.desde ? horaCorta(turno.desde) : "",
    servicio: turno.servicio || voz(rubro, "turno", "turno"),
    profesional: turno.profesional || voz(rubro, "profesional", "profesional"),
    sala: turno.sala || "",
    negocio: (ajustes && ajustes.negocio) || "",
  };

  return String(texto || "").replace(/\{(\w+)\}/g, (todo, k) =>
    Object.prototype.hasOwnProperty.call(valores, k) ? valores[k] : todo);
}

/* ------------------------------------------------------------
   Las lecturas
   ------------------------------------------------------------ */

export async function cargarPendientes(empresaId, horas = 24) {
  if (!empresaId) throw new Error("cargarPendientes necesita saber de qué comercio.");

  const { data, error } = await supabase.rpc("comunicaciones_pendientes", {
    p_empresa: empresaId,
    p_horas: horas,
  });
  if (error) throw error;

  return (data || []).map((f) => ({
    reservaId: f.reserva_id,
    clienteId: f.cliente_id,
    cliente: f.cliente || "",
    tel: f.tel || "",
    desde: new Date(f.desde),
    estado: f.estado,
    servicio: f.servicio || "",
    profesional: f.profesional || "",
    sala: f.sala || "",
    esClase: !!f.es_clase,
  }));
}

/* Las plantillas del comercio, con las de fábrica abajo. Devuelve las
   cuatro siempre: la pantalla no tiene que saber cuál está guardada y
   cuál no, solo si fue cambiada —para poder ofrecer volver atrás—. */
export async function cargarPlantillas(empresaId) {
  if (!empresaId) throw new Error("cargarPlantillas necesita saber de qué comercio.");

  const { data, error } = await supabase
    .from("plantillas")
    .select("clave, texto, actualizada")
    .eq("empresa_id", empresaId);
  if (error) throw error;

  const propias = new Map((data || []).map((p) => [p.clave, p]));

  return PLANTILLAS.map((p) => {
    const mia = propias.get(p.k);
    return {
      ...p,
      texto: mia ? mia.texto : p.texto,
      original: p.texto,
      propia: !!mia,
      actualizada: mia ? new Date(mia.actualizada) : null,
    };
  });
}

/* ------------------------------------------------------------
   Las escrituras
   ------------------------------------------------------------ */

export async function guardarPlantilla(empresaId, clave, texto) {
  if (!empresaId) throw new Error("guardarPlantilla necesita saber de qué comercio.");

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("plantillas")
    .upsert(
      { empresa_id: empresaId, clave, texto, actualizada: new Date().toISOString(), usuario_id: user ? user.id : null },
      { onConflict: "empresa_id,clave" });
  if (error) throw error;
}

/* Volver al original es borrar la fila y no copiar el texto de fábrica
   encima: si mañana ese texto mejora, el comercio que nunca lo tocó se
   lleva la mejora sin hacer nada. */
export async function restaurarPlantilla(empresaId, clave) {
  if (!empresaId) throw new Error("restaurarPlantilla necesita saber de qué comercio.");

  const { error } = await supabase
    .from("plantillas")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("clave", clave);
  if (error) throw error;
}

export async function anotarAviso({ empresaId, clienteId, reservaId, motivo = "recordatorio", canal = "whatsapp", texto = null }) {
  if (!empresaId) throw new Error("anotarAviso necesita saber de qué comercio.");

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("contactos").insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    reserva_id: reservaId,
    motivo,
    canal,
    texto,
    usuario_id: user ? user.id : null,
  });
  if (error) throw error;
}
