/* ============================================================
   RUBROS · la forma del sistema para cada tipo de negocio
   ============================================================

   El menú dejó de estar escrito en el código. Un rubro define qué grupos
   tiene la barra lateral, qué módulos caen en cada uno, en qué orden y
   cómo se llaman. Agregar "Genez para gimnasios" es un insert, no un
   componente nuevo.

   Ver la migración 0025 para la forma exacta de `menu`.
   ============================================================ */

import { supabase } from "./supabase.js";

export async function cargarRubro(clave) {
  if (!clave) return null;

  const { data, error } = await supabase
    .from("rubros")
    .select("clave, nombre, menu, voces, modulos")
    .eq("clave", clave)
    .eq("activo", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    clave: data.clave,
    nombre: data.nombre,
    grupos: Array.isArray(data.menu) ? data.menu : [],
    voces: data.voces || {},
    modulos: data.modulos || [],
  };
}

/* Cómo llama este negocio a una cosa. Sin traducción cargada devuelve lo
   que se le pasó, así una pantalla nueva puede usar `voz()` desde el
   primer día aunque todavía nadie haya definido las palabras. */
export function voz(rubro, clave, siNoEsta) {
  const v = rubro && rubro.voces ? rubro.voces[clave] : null;
  return v || siNoEsta || clave;
}
