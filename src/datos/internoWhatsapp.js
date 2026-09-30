/* ============================================================
   GENEZ FOUNDER · WhatsApp (0120)
   ============================================================

   Leer es directo contra la base, por RLS ('mensajes'). Mandar no:
   pasa por api/founder.js, que tiene el token de Meta y es el único
   que escribe mensajes. Del navegador solo se cambia la gestión de la
   conversación (estado, a quién está asignada, a qué prospecto va, el
   consentimiento, las notas); la base no deja tocar lo demás.
   ============================================================ */

import { supabase } from "./supabase.js";
import { aApp } from "./internoCrm.js";
import { conColumnas, traducir } from "./internoClientes.js";

const dato = ({ data, error }) => { if (error) throw traducir(error); return data; };
const EDITABLES = ["prospectoId", "estado", "asignadoId", "noLeidos", "consentimiento", "consentimientoNota", "notas", "botPausado", "derivadaEn", "derivadaMotivo"];

export const ESTADOS_CONVERSACION = { abierta: "Abierta", pendiente: "Pendiente", cerrada: "Cerrada" };
export const CONSENTIMIENTOS = {
  sin_dato: "Escribió él",
  dado: "Aceptó recibir mensajes",
  baja: "Pidió la baja",
};

export async function cargarConversaciones() {
  return (dato(await supabase.from("interno_wa_conversaciones_vista").select("*")
    .order("ultimo_mensaje_en", { ascending: false, nullsFirst: false }).limit(500)) || []).map(aApp);
}
export async function cargarConversacion(id) {
  return aApp(dato(await supabase.from("interno_wa_conversaciones_vista").select("*").eq("id", id).maybeSingle()));
}
export async function cargarMensajes(conversacionId) {
  return (dato(await supabase.from("interno_wa_mensajes").select("*").eq("conversacion_id", conversacionId)
    .order("momento", { ascending: true }).limit(1000)) || []).map(aApp);
}
export async function editarConversacion(id, cambios) {
  dato(await supabase.from("interno_wa_conversaciones").update(conColumnas(EDITABLES, cambios)).eq("id", id));
}

/* ---------- Lo que pasa por el servidor ---------- */
async function llamar(cuerpo) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");
  let r;
  try {
    r = await fetch("/api/founder", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error("No se pudo hablar con el servidor. Revisá la conexión.");
  }
  let respuesta = null;
  try { respuesta = await r.json(); } catch {
    throw new Error(r.status === 404
      ? "La función de Founder no está publicada. En desarrollo tiene que estar corriendo `npm run dev`."
      : "El servidor contestó algo que no se entiende.");
  }
  if (!r.ok) {
    const e = new Error((respuesta && respuesta.error && respuesta.error.message) || "No se pudo completar.");
    e.respuesta = respuesta;
    throw e;
  }
  return respuesta;
}

/* La clave la arma quien escribe, una por mensaje: si el envío se
   reintenta (doble clic, la red que se corta), la base reconoce la misma
   y no manda dos. */
export const claveDeEnvio = () =>
  (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const enviarMensaje = (conversacion, texto, idempotencia, borrador = null) => llamar({ accion: "enviar", conversacion, texto, idempotencia, borrador });
export const pedirBorrador = (conversacion) => llamar({ accion: "borrador", conversacion });
export const estadoWhatsapp = () => llamar({ accion: "estado" });
export const registrarNumero = () => llamar({ accion: "registrar" });
export const suscribirApp = () => llamar({ accion: "suscribir" });

/* Cuánto falta para que se cierre la ventana de 24 h, en palabras. */
export function ventanaRestante(ultimoEntrante, ahora = Date.now()) {
  if (!ultimoEntrante) return null;
  const falta = new Date(ultimoEntrante).getTime() + 24 * 3600 * 1000 - ahora;
  if (!(falta > 0)) return null;
  const h = Math.floor(falta / 3600000);
  const m = Math.floor((falta % 3600000) / 60000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/* ---------- El asistente (0121) ---------- */
/* Lo último que hizo el asistente en la conversación: se muestra si está
   esperando (pendiente) o si falló (error). Un derivado ya se ve en la
   conversación marcada; uno enviado o descartado ya no importa. */
export async function cargarUltimoBorrador(conversacionId) {
  const fila = dato(await supabase.from("interno_wa_borradores").select("*").eq("conversacion_id", conversacionId)
    .order("creado_en", { ascending: false }).limit(1).maybeSingle());
  return fila && ["pendiente", "error"].includes(fila.estado) ? aApp(fila) : null;
}
export async function descartarBorrador(id) {
  dato(await supabase.from("interno_wa_borradores").update({ estado: "descartado" }).eq("id", id));
}
export async function cargarErroresDelAsistente(limite = 5) {
  return (dato(await supabase.from("interno_wa_borradores").select("id, creado_en, error, conversacion_id").eq("estado", "error")
    .order("creado_en", { ascending: false }).limit(limite)) || []).map(aApp);
}
export async function cargarBaseDelAsistente() {
  return (dato(await supabase.from("interno_documentos").select("id, titulo, estado, version, actualizado_en")
    .eq("tipo", "base_bot").is("archivado_en", null).order("titulo")) || []).map(aApp);
}
