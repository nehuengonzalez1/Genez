/* ============================================================
   AJUSTES · la configuración del comercio
   ============================================================

   Hasta ahora el sistema arrancaba con los datos de Super 25 escritos en
   el código: su nombre, su CUIT, su razón social. Cualquier otro comercio
   imprimía comprobantes con los datos de Axel Gonzalez, y todo lo que se
   cambiaba en Ajustes se perdía al refrescar.

   La configuración vive en `empresas.config`, que ya existía y nadie
   leía. Acá se traduce a la forma que la aplicación viene usando.
   ============================================================ */

import { supabase } from "./supabase.js";
import { MEDIOS_INICIALES, FISCAL_INICIAL, LISTAS_INICIALES } from "../utils/helpers.js";

/* Lo que no depende del rubro ni del comercio y sirve igual para todos.
   Son puntos de partida razonables, no datos de nadie. */
const DE_FABRICA = {
  arca: false,
  cobertura: 14,
  ancho: 58,
  sonido: true,
  desc2: 10,
  cocinaEnPantalla: false,
  destinos: ["cocina"],
};

/* El nombre sale de `empresas.nombre` y no de la config: es el mismo con
   el que la plataforma lo factura, y tener dos nombres para lo mismo
   termina siempre en que uno queda viejo. */
export function ajustesDe(comercio) {
  const c = (comercio && comercio.config) || {};
  return {
    ...DE_FABRICA,
    ...c,
    negocio: (comercio && comercio.nombre) || "",
    fiscal: { ...FISCAL_INICIAL, ...(c.fiscal || {}) },
    medios: c.medios && c.medios.length ? c.medios : MEDIOS_INICIALES,
    listas: c.listas && c.listas.length ? c.listas : LISTAS_INICIALES,
    cuit: (c.fiscal && c.fiscal.cuit) || "",
  };
}

/* Se guarda todo menos lo que no le pertenece: el nombre vive en su
   propia columna y guardarlo acá también sería tener el mismo dato en dos
   lugares que se van a contradecir. */
export async function guardarAjustes(empresaId, ajustes) {
  const { negocio, cuit, ...config } = ajustes;

  const { error } = await supabase
    .from("empresas")
    .update({ config })
    .eq("id", empresaId);

  if (error) throw error;
}
