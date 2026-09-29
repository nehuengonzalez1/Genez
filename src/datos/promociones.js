/* ============================================================
   PROMOCIONES · leer y guardar (0102)
   ============================================================

   La cuenta vive en src/utils/promociones.js. Acá, la base.

   Las últimas que se leyeron quedan también en el navegador: una caja
   que se recarga sin internet tiene que seguir cobrando el 2x1 que
   estaba cobrando. Si la lectura falla, se usan esas.
   ============================================================ */

import { supabase } from "./supabase.js";

const clave = (empresaId) => `genez.promos.${empresaId}`;

const aPromo = (f) => ({
  id: f.id,
  nombre: f.nombre,
  tipo: f.tipo,
  parametros: f.parametros || {},
  alcance: { productos: (f.alcance && f.alcance.productos) || [], rubros: (f.alcance && f.alcance.rubros) || [] },
  desde: f.desde || null,
  hasta: f.hasta || null,
  dias: f.dias || [],
  /* "HH:MM" (0105). La base guarda "HH:MM:SS". */
  horaDesde: f.hora_desde ? String(f.hora_desde).slice(0, 5) : null,
  horaHasta: f.hora_hasta ? String(f.hora_hasta).slice(0, 5) : null,
  activa: f.activa !== false,
});

export async function cargarPromociones(empresaId) {
  if (!empresaId) throw new Error("cargarPromociones necesita la empresa.");
  try {
    const { data, error } = await supabase.from("promociones").select("*")
      .eq("empresa_id", empresaId).order("creada_en");
    if (error) throw error;
    const lista = (data || []).map(aPromo);
    try { localStorage.setItem(clave(empresaId), JSON.stringify(lista)); } catch { /* sin lugar: se sigue */ }
    return lista;
  } catch (e) {
    try {
      const guardadas = JSON.parse(localStorage.getItem(clave(empresaId)) || "null");
      if (Array.isArray(guardadas)) return guardadas;
    } catch { /* nada guardado */ }
    throw e;
  }
}

/* Crea o actualiza. Devuelve la promo como quedó. */
export async function guardarPromocion(empresaId, p) {
  const fila = {
    empresa_id: empresaId,
    nombre: p.nombre.trim(),
    tipo: p.tipo,
    parametros: p.parametros,
    alcance: { productos: p.alcance.productos || [], rubros: p.alcance.rubros || [] },
    desde: p.desde || null,
    hasta: p.hasta || null,
    dias: p.dias || [],
    hora_desde: p.horaDesde && p.horaHasta ? p.horaDesde : null,
    hora_hasta: p.horaDesde && p.horaHasta ? p.horaHasta : null,
    activa: p.activa !== false,
    actualizada_en: new Date().toISOString(),
  };
  const q = p.id
    ? supabase.from("promociones").update(fila).eq("id", p.id).eq("empresa_id", empresaId)
    : supabase.from("promociones").insert(fila);
  const { data, error } = await q.select("*").single();
  if (error) {
    if (error.code === "23514") throw new Error(/horario/.test(error.message) ? "El horario tiene que tener desde y hasta, distintos." : "Los números de la promo no cierran: revisá cantidades y porcentajes.");
    if (error.code === "42501") throw new Error("Tu usuario no puede cargar promociones (hace falta el permiso de cambiar precios).");
    throw error;
  }
  return aPromo(data);
}
