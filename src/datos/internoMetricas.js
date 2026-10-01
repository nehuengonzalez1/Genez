/* ============================================================
   GENEZ FOUNDER · métricas y pedidos de la web (0123)
   ============================================================

   Los informes los cuenta la base (interno_informe_whatsapp y
   interno_informe_descubrimiento), con los permisos de quien pregunta:
   sin un área, esa parte da cero. Acá solo se piden y se traen.
   ============================================================ */

import { supabase } from "./supabase.js";
import { aApp } from "./internoCrm.js";
import { traducir } from "./internoClientes.js";

const dato = ({ data, error }) => { if (error) throw traducir(error); return data; };
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

export async function informeWhatsapp(desde, hasta) {
  return dato(await supabase.rpc("interno_informe_whatsapp", { p_desde: iso(desde), p_hasta: iso(hasta) }));
}
export async function informeDescubrimiento(desde, hasta) {
  return dato(await supabase.rpc("interno_informe_descubrimiento", { p_desde: iso(desde), p_hasta: iso(hasta) }));
}

export async function cargarSolicitudes() {
  return (dato(await supabase.from("solicitudes").select("*").order("creado_en", { ascending: false }).limit(200)) || []).map(aApp);
}
export async function solicitudAProspecto(id) {
  return dato(await supabase.rpc("interno_solicitud_a_prospecto", { p_solicitud: id }));
}
