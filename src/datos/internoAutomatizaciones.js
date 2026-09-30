/* ============================================================
   GENEZ FOUNDER · automatizaciones (0122)
   ============================================================

   Reglas, plantillas, la cola de envíos, las corridas y las alertas.
   Leer y editar las reglas y los borradores de plantilla es directo
   contra la base (área 'mensajes'). Lo que habla con Meta (mandar una
   plantilla a aprobar, consultar su estado, mandar la cola) pasa por
   api/founder.js. De la cola, el navegador solo aprueba o cancela.
   ============================================================ */

import { supabase } from "./supabase.js";
import { aApp } from "./internoCrm.js";
import { conColumnas, traducir } from "./internoClientes.js";
import { llamar } from "./internoWhatsapp.js";

const dato = ({ data, error }) => { if (error) throw traducir(error); return data; };

const REGLA = ["nombre", "activa", "plantillaId", "parametros", "horaDesde", "horaHasta", "dias", "topePersonaDia", "topePersonaSemana", "topeDia", "consentimiento", "aprobacionManual"];
const PLANTILLA = ["nombre", "idioma", "categoria", "cuerpo", "variables", "ejemplos", "archivadoEn"];

export const TIPOS_REGLA = {
  recordatorio_evento: { n: "Recordatorio de demo o reunión", whatsapp: true, d: "Antes de una demo, reunión o visita de la Agenda, a la persona del prospecto." },
  seguimiento: { n: "Seguimiento", whatsapp: true, d: "A quien le escribimos y no contestó en unos días. Una sola vez por silencio." },
  alerta_oportunidad: { n: "Alerta: oportunidad sin contacto", whatsapp: false, d: "Te avisa en el Inicio de las oportunidades abiertas sin contacto hace tiempo." },
  alerta_conversacion: { n: "Alerta: conversación que espera", whatsapp: false, d: "Te avisa en el Inicio de las conversaciones sin leer o derivadas que nadie tomó." },
};
export const ESTADO_ENVIO = {
  por_aprobar: ["Por aprobar", "ojo"], aprobado: ["Aprobado", "info"], enviando: ["Enviando", "info"], enviado: ["Enviado", "bien"],
  fallido: ["No salió", "mal"], cancelado: ["Cancelado", "tenue"], omitido: ["Omitido", "tenue"],
};
export const ESTADO_PLANTILLA = {
  borrador: ["Borrador", "tenue"], enviada: ["En revisión de Meta", "info"], aprobada: ["Aprobada", "bien"], rechazada: ["Rechazada", "mal"],
  pausada: ["Pausada por Meta", "ojo"], desactivada: ["Desactivada", "tenue"],
};
export const VARIABLES = [["nombre", "Nombre de la persona"], ["negocio", "Nombre del negocio"], ["dia", "Día (martes)"], ["fecha", "Fecha (02/10)"], ["hora", "Hora (10:00)"], ["lugar", "Lugar del evento"]];

/* Los {{n}} de un cuerpo, en orden y sin repetir: cada uno necesita su
   variable y su ejemplo. */
export const huecos = (cuerpo) => [...new Set((String(cuerpo || "").match(/\{\{\d+\}\}/g) || []).map((h) => Number(h.slice(2, -2))))].sort((a, b) => a - b);

export async function cargarReglas() {
  return (dato(await supabase.from("interno_automatizaciones").select("*").is("archivado_en", null).order("creado_en")) || []).map(aApp);
}
export async function guardarRegla(id, cambios) {
  dato(await supabase.from("interno_automatizaciones").update(conColumnas(REGLA, cambios)).eq("id", id));
}

export async function cargarPlantillas() {
  return (dato(await supabase.from("interno_wa_plantillas").select("*").is("archivado_en", null).order("creado_en", { ascending: false })) || []).map(aApp);
}
export async function guardarPlantilla(p) {
  const fila = conColumnas(PLANTILLA, p);
  if (p.id) return dato(await supabase.from("interno_wa_plantillas").update(fila).eq("id", p.id));
  return dato(await supabase.from("interno_wa_plantillas").insert(fila).select("id").single()).id;
}
export const archivarPlantilla = (id) => guardarPlantilla({ id, archivadoEn: new Date() });

export async function cargarEnvios(estados) {
  let q = supabase.from("interno_envios").select("*, interno_automatizaciones(nombre), interno_wa_plantillas(cuerpo)").order("programado_para", { ascending: false }).limit(200);
  if (estados && estados.length) q = q.in("estado", estados);
  return (dato(await q) || []).map((e) => ({
    ...aApp(e),
    regla: e.interno_automatizaciones ? e.interno_automatizaciones.nombre : "",
    cuerpo: e.interno_wa_plantillas ? e.interno_wa_plantillas.cuerpo : "",
  }));
}
export async function decidirEnvio(id, estado) {
  dato(await supabase.from("interno_envios").update({ estado }).eq("id", id));
}

export async function cargarCorridas(limite = 30) {
  return (dato(await supabase.from("interno_auto_corridas").select("*").order("empezo_en", { ascending: false }).limit(limite)) || []).map(aApp);
}

export async function cargarAlertas() {
  return (dato(await supabase.from("interno_alertas").select("*").is("descartada_en", null).order("creada_en", { ascending: false }).limit(30)) || []).map(aApp);
}
export async function descartarAlerta(id) {
  dato(await supabase.from("interno_alertas").update({ descartada_en: new Date().toISOString() }).eq("id", id));
}

/* El texto como le va a llegar a la persona. */
export const armarTexto = (cuerpo, valores) =>
  String(cuerpo || "").replace(/\{\{(\d+)\}\}/g, (h, n) => (valores && valores[Number(n) - 1] != null ? valores[Number(n) - 1] : h));

export const correrAhora = () => llamar({ accion: "automatizaciones" });
export const mandarPlantillaAMeta = (plantilla) => llamar({ accion: "plantilla", plantilla });
export const consultarPlantillas = () => llamar({ accion: "sincronizar" });
