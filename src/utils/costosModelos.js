/* ============================================================
   Lo que cuesta el asistente, estimado
   ============================================================

   Los tokens son reales (los devuelve Anthropic en cada respuesta y se
   guardan en el borrador); el precio es el de lista, en dólares por
   millón de tokens, tomado el 25/09/2026. No es la factura: no incluye
   impuestos ni descuentos, y si Anthropic cambia los precios hay que
   cambiarlos acá. Por eso la pantalla dice "estimado" y la fecha.

   input_tokens no incluye lo leído ni lo escrito en caché: cada parte
   se cobra a su precio.
   ============================================================ */

export const PRECIOS_FECHA = "25/09/2026";

export const PRECIOS = {
  "claude-opus-5-5": { entrada: 4, salida: 20, cacheLeido: 0.2, cacheEscrito: 5 },
  "claude-sonnet-5-5": { entrada: 2, salida: 10, cacheLeido: 0.2, cacheEscrito: 2.5 },
  "claude-haiku-4-5": { entrada: 1, salida: 5, cacheLeido: 0.1, cacheEscrito: 1.25 },
};

/* Dólares de un grupo de pedidos de un modelo, o null si el modelo no
   está en la tabla (no se inventa un precio). */
export function costoEstimado(u) {
  const p = PRECIOS[u.modelo];
  if (!p) return null;
  const n = (k) => Number(u[k] || 0);
  return (n("entrada") * p.entrada + n("salida") * p.salida + n("cache_leido") * p.cacheLeido + n("cache_escrito") * p.cacheEscrito) / 1e6;
}

export const dolares = (v) => (v == null ? "—" : `US$ ${v < 0.01 && v > 0 ? v.toFixed(4) : v.toFixed(2)}`);
