/* ============================================================
   STOCK INICIAL · leer la planilla (0110)
   ============================================================

   Puro, sin pantalla: lo usa StockInicial.jsx y lo prueba
   scripts/probar-indicadores.mjs.
   ============================================================ */

import { leerCodigo, leerImporte } from "./listaProveedor.js";

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/* Qué columna es la cantidad: la que dice stock, cantidad, contado… */
export function columnaCantidad(titulos) {
  const t = titulos.map(norm);
  return t.findIndex((c) => ["stock", "cant", "contad", "unidades", "existencia", "conteo"].some((w) => c.includes(w)));
}

/* Cruza la planilla con el catálogo. Un código repetido suma: es lo que
   pasa cuando el mismo producto está en dos góndolas y se contó dos
   veces. */
export function cruzarStock(filas, desde, columnas, productos) {
  const porCodigo = new Map(productos.filter((p) => p.barcode).map((p) => [String(p.barcode).replace(/^0+/, ""), p]));
  const suma = new Map();
  const noEstan = [];
  let malas = 0;
  for (const f of filas.slice(desde)) {
    if (!f || !f.some((c) => String(c ?? "").trim())) continue;
    const codigo = leerCodigo(f[columnas.codigo]);
    const cant = leerImporte(f[columnas.cantidad]);
    if (!codigo || cant == null || cant < 0) { malas++; continue; }
    const p = porCodigo.get(codigo.replace(/^0+/, ""));
    if (!p) { noEstan.push(codigo); continue; }
    suma.set(p.id, { p, real: +((suma.has(p.id) ? suma.get(p.id).real : 0) + cant).toFixed(3) });
  }
  return { cruzan: [...suma.values()], noEstan, malas };
}
