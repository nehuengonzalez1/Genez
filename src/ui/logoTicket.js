/* ============================================================
   EL LOGO EN EL TICKET (08/10)
   ============================================================

   El ticket se imprime de tres formas —directo por ESC/POS, como PDF y
   como página— y ninguna sabía de imágenes: solo del texto y del QR. El
   logo entra igual que el QR, como un mapa de puntos blancos y negros a
   la resolución del cabezal (8 puntos por mm, 203 ppp), y cada forma de
   imprimir lo dibuja a su manera. Así lo que se ve en la vista previa es
   lo que sale: el mismo mapa, punto por punto.

   Se usa el logo "para fondo claro" (el papel es blanco). Con un logo de
   letras blancas, `resolverLogos` ya arma la versión oscura.

   El mapa se arma una vez, al prender el logo o al cambiarlo, y queda
   guardado en memoria: imprimir no puede esperar a cargar una imagen, y
   el diálogo de impresión de Chrome tiene que abrirse en el momento del
   clic. Si todavía no está listo, el ticket sale sin logo, como hasta
   ahora, en vez de no salir.

   El papel térmico no imprime grises: cada punto es negro o blanco. Para
   un logo alcanza con un umbral; una foto con degradés sale manchada, y
   eso lo dice la pantalla de diseño.
   ============================================================ */

import { resolverLogos } from "./logos.js";

export const PUNTOS_POR_MM = 8;
/* Hasta dónde puede crecer: el 60% de lo que imprime el cabezal a lo
   ancho (no se come el ticket) y 15 mm de alto (no gasta papel). */
const ANCHO_MAX = { 58: 230, 80: 300 };
const ALTO_MAX = 120;

let guardado = { src: null, mapas: {} };

function cargar(src) {
  return new Promise((resolver, fallar) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolver(img);
    img.onerror = () => fallar(new Error("No se pudo leer el logo."));
    img.src = src;
  });
}

const oscuro = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] < 140;

function lienzo(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  /* Fondo blanco: lo transparente de un PNG es papel. */
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  return ctx;
}

/* Lo que tiene tinta, en la imagen original. El margen blanco no se
   imprime (sería papel en blanco arriba del nombre), y se recorta antes
   de achicar: si no, un logo con mucho aire saldría chiquito. */
function cajaDeTinta(img) {
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  const ctx = lienzo(w, h);
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (oscuro(d, (y * w + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* { w, h, bits }: bits[y * w + x] = 1 si el punto es negro. */
function mapaDe(img, caja, mm) {
  const escala = Math.min(ANCHO_MAX[mm] / caja.w, ALTO_MAX / caja.h);
  const w = Math.max(1, Math.round(caja.w * escala));
  const h = Math.max(1, Math.round(caja.h * escala));
  const ctx = lienzo(w, h);
  ctx.drawImage(img, caja.x, caja.y, caja.w, caja.h, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const bits = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bits[i] = oscuro(d, i * 4) ? 1 : 0;
  return { w, h, bits };
}

/* Arma los mapas de 58 y 80 mm del logo del comercio. Devuelve el de
   cada ancho, o null si no hay logo o no se pudo leer. */
export async function prepararLogoTicket(marca) {
  const { paraClaro } = await resolverLogos(marca);
  if (!paraClaro) { guardado = { src: null, mapas: {} }; return null; }
  if (guardado.src === paraClaro) return guardado.mapas;
  const img = await cargar(paraClaro);
  const caja = cajaDeTinta(img);
  guardado = { src: paraClaro, mapas: caja ? { 58: mapaDe(img, caja, 58), 80: mapaDe(img, caja, 80) } : {} };
  return guardado.mapas;
}

/* El mapa ya armado, sin esperar: lo que usa la impresión. */
export function logoTicket(ancho) {
  return guardado.mapas[ancho === 58 ? 58 : 80] || null;
}

/* Los puntos negros de cada fila, juntos en tramos: [x, y, largo]. Una
   fila de 200 puntos negros es un solo rectángulo y no doscientos. */
export function tramosDe({ w, h, bits }) {
  const t = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!bits[y * w + x]) { x++; continue; }
      const desde = x;
      while (x < w && bits[y * w + x]) x++;
      t.push([desde, y, x - desde]);
    }
  }
  return t;
}

/* El logo como SVG, para la página de impresión y la vista previa. */
export function svgLogo(mapa) {
  const rects = tramosDe(mapa).map(([x, y, l]) => `<rect x="${x}" y="${y}" width="${l}" height="1"/>`).join("");
  return `<svg viewBox="0 0 ${mapa.w} ${mapa.h}" width="${mapa.w / PUNTOS_POR_MM}mm" height="${mapa.h / PUNTOS_POR_MM}mm" shape-rendering="crispEdges" fill="#000" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
