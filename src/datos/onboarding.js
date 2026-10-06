/* ============================================================
   ONBOARDING (0137): qué vio cada persona y cómo viene el comercio
   ============================================================

   Lo que vio (la bienvenida, si ocultó los primeros pasos, los pasos que
   tildó a mano) vive en perfiles.onboarding y se escribe solo con
   marcar_onboarding, que toca la fila de quien llama y nada más.

   El progreso de los primeros pasos se mira en los datos: si hay
   productos cargados después del alta, si hubo una venta propia, si hay
   alguien más en el equipo. Los datos de ejemplo se cargan en el mismo
   momento del alta, así que "después del alta" (con unos minutos de
   margen) es lo que separa lo propio de lo de ejemplo.
   ============================================================ */

import { supabase } from "./supabase.js";

export async function marcarOnboarding(clave, valor = true) {
  const { data, error } = await supabase.rpc("marcar_onboarding", { p_clave: clave, p_valor: valor });
  if (error) throw new Error(error.message || "No se pudo guardar.");
  return data || {};
}

/* Un comercio (o una persona) es nuevo durante sus primeros 60 días:
   después, los primeros pasos ya no tienen sentido y la bienvenida
   tampoco. Y solo desde que existe el onboarding (06/10): Genez arrancó
   en septiembre, así que todos los comercios tenían menos de 60 días, y
   Super 25 iba a recibir "lo que ves son datos de ejemplo" sobre sus
   ventas reales. */
const DIAS_DE_ARRANQUE = 60;
const DESDE_EL_ONBOARDING = Date.UTC(2026, 9, 6, 3); // 06/10/2026, 0 h de Buenos Aires
export const esNuevo = (fecha) => {
  if (!fecha) return false;
  const t = new Date(fecha).getTime();
  return t >= DESDE_EL_ONBOARDING && Date.now() - t < DIAS_DE_ARRANQUE * 86400000;
};

const cuenta = async (q) => { const { count, error } = await q; return error ? null : count || 0; };

/* Lo que se puede saber solo. Cada cosa por separado: una consulta que
   falla deja ese paso sin tildar, no la lista entera. */
export async function cargarProgreso(empresaId, creadaEn) {
  const desde = new Date(new Date(creadaEn).getTime() + 3 * 60000).toISOString();
  const [productos, ventas, personas, servicios, turnos] = await Promise.all([
    cuenta(supabase.from("items").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).gt("creado_en", desde)),
    cuenta(supabase.from("operaciones").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).in("tipo", ["venta", "comanda"]).gt("fecha", desde)),
    cuenta(supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("activo", true)),
    cuenta(supabase.from("items").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("tipo", "servicio").gt("creado_en", desde)),
    cuenta(supabase.from("reservas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).gt("creada_en", desde)),
  ]);
  return { productos, ventas, personas, servicios, turnos };
}
