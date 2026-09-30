/**
 * Lo que `api/founder.js` necesita para las automatizaciones (0122), sin
 * red ni base: cómo se le pide a Meta que apruebe una plantilla, cómo se
 * manda una, cómo se lee su estado y qué errores vale la pena reintentar.
 * Se prueba con `node scripts/probar-automatizaciones.mjs`.
 */

/* El cuerpo de POST /{waba_id}/message_templates. Meta pide un ejemplo
   de cada variable para aprobar; sin variables, el ejemplo no va. */
export function plantillaParaMeta(p) {
  const cuerpo = { type: "BODY", text: p.cuerpo };
  if ((p.ejemplos || []).length) cuerpo.example = { body_text: [p.ejemplos] };
  return { name: p.nombre, language: p.idioma, category: p.categoria, components: [cuerpo] };
}

/* El cuerpo de POST /{phone_number_id}/messages para una plantilla. */
export function mensajeDePlantilla(waId, nombre, idioma, valores) {
  const t = { name: nombre, language: { code: idioma } };
  if ((valores || []).length) {
    t.components = [{ type: "body", parameters: valores.map((v) => ({ type: "text", text: String(v) })) }];
  }
  return { messaging_product: "whatsapp", recipient_type: "individual", to: waId, type: "template", template: t };
}

const ESTADOS = { APPROVED: "aprobada", REJECTED: "rechazada", PAUSED: "pausada", DISABLED: "desactivada", PENDING: "enviada", IN_APPEAL: "enviada", PENDING_DELETION: "desactivada" };
export const estadoDeMeta = (status) => ESTADOS[String(status || "").toUpperCase()] || null;

/* Cuáles errores se reintentan: los de red y los que Meta dice que son
   pasajeros. Un error de pago (131042), de plantilla (132xxx) o un número
   que no tiene WhatsApp (131026) no se arreglan reintentando: se marcan
   como fallidos y los mira una persona. */
const PASAJEROS = new Set([130429, 131000, 131016, 131048, 131056]);
export function reintentable(error) {
  if (!error) return false;
  if (!error.http || error.http >= 500 || error.http === 429) return true;
  return PASAJEROS.has(Number(error.code));
}

/* Lo que se muestra de un error de Meta, en castellano cuando se sabe. */
const CONOCIDOS = {
  131042: "Meta no tiene un medio de pago válido para la cuenta de WhatsApp: cargalo en el Administrador de WhatsApp.",
  131026: "Ese número no tiene WhatsApp o no puede recibir el mensaje.",
  132001: "La plantilla no existe o no está aprobada en ese idioma.",
  132000: "La cantidad de variables no coincide con la plantilla.",
  131047: "Pasaron más de 24 horas: hace falta una plantilla.",
  130429: "Meta está limitando los envíos. Se reintenta más tarde.",
};
export const textoDeError = (error) => (error && CONOCIDOS[Number(error.code)]) || (error && error.message) || "Error desconocido.";
