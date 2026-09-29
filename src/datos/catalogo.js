/* ============================================================
   EL CATÁLOGO BASE · buscar un código (0106)
   ============================================================

   Cuando se escanea un código que el comercio no tiene, se pregunta acá
   si SEPA lo conoce. Es una ayuda y no un paso: el alta se abre igual,
   vacía, y lo que llegue se completa encima solo en los campos que
   todavía nadie tocó.

   Por eso no espera: si la consulta tarda más de un segundo y medio o
   falla, devuelve null y el alta sigue como siempre. Un mostrador sin
   internet no se puede trabar esperando una sugerencia.
   ============================================================ */

import { supabase } from "./supabase.js";
import { normalizarEan } from "../utils/catalogo.js";

const ESPERA = 1500;
const recordados = new Map();

export async function buscarEnCatalogo(codigo) {
  const ean = normalizarEan(codigo);
  if (!/^[1-9]\d{5,13}$/.test(ean)) return null;
  if (recordados.has(ean)) return recordados.get(ean);
  const consulta = supabase
    .from("catalogo_base")
    .select("ean, nombre, marca, presentacion, rubro")
    .eq("ean", ean)
    .maybeSingle()
    .then(({ data, error }) => (error ? undefined : data || null));
  const tarde = new Promise((r) => setTimeout(() => r(undefined), ESPERA));
  const f = await Promise.race([consulta, tarde]).catch(() => undefined);
  if (f === undefined) return null;          // tardó o falló: no se recuerda, puede andar la próxima
  const sugerencia = f && { nombre: f.nombre, marca: f.marca || "", presentacion: f.presentacion || "", rubro: f.rubro || "" };
  recordados.set(ean, sugerencia);
  return sugerencia;
}

/* El rubro sugerido solo se pone si el comercio ya usa ese nombre, o si
   todavía no tiene ninguno: a Super 25, con sus catorce rubros, no le
   sirve que aparezca uno quince escrito parecido. */
export function rubroSugerido(sugerencia, rubrosDelComercio) {
  if (!sugerencia || !sugerencia.rubro) return "";
  const propios = rubrosDelComercio.filter(Boolean);
  if (!propios.length) return sugerencia.rubro;
  const igual = propios.find((r) => r.toLocaleLowerCase("es") === sugerencia.rubro.toLocaleLowerCase("es"));
  return igual || "";
}

export const FUENTE_CATALOGO = "SEPA · Secretaría de Comercio";
