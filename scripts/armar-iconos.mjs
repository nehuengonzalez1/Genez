/* ============================================================
   LOS ÍCONOS DEL SISTEMA INSTALADO · node scripts/armar-iconos.mjs
   ============================================================

   Arma los PNG del manifiesto (public/iconos/) a partir del isotipo que
   ya vive en src/ui/Logo.jsx, sobre el fondo oscuro del tema de fábrica.

   Por qué un script y no imágenes sueltas: el único logo que tiene el
   proyecto es ese PNG chico (114x110) incrustado. Agrandarlo a 512 con
   un programa cualquiera deja los bordes borrosos; acá se agranda y se
   endurece el borde (el logo son formas planas de dos colores), así el
   ícono se ve nítido en la barra de tareas. Si algún día hay un logo en
   vector, se reemplaza este script por ese archivo.

   Sin dependencias: lee y escribe PNG con zlib, que viene con Node.
   ============================================================ */

import fs from "fs";
import zlib from "zlib";

const FONDO = [0x1c, 0x19, 0x17]; // el fondo del tema oscuro (index.html, theme-color)

/* --- PNG: leer (8 bits, RGBA o RGB, sin entrelazar) --- */
function leerPng(buf) {
  let p = 8, ancho, alto, tipo, datos = [];
  while (p < buf.length) {
    const largo = buf.readUInt32BE(p); const nombre = buf.toString("ascii", p + 4, p + 8);
    const cuerpo = buf.subarray(p + 8, p + 8 + largo);
    if (nombre === "IHDR") { ancho = cuerpo.readUInt32BE(0); alto = cuerpo.readUInt32BE(4); tipo = cuerpo[9]; if (cuerpo[8] !== 8 || cuerpo[12]) throw new Error("PNG no soportado"); }
    if (nombre === "IDAT") datos.push(cuerpo);
    p += 12 + largo;
  }
  const bpp = tipo === 6 ? 4 : tipo === 2 ? 3 : (() => { throw new Error("PNG no soportado: tipo " + tipo); })();
  const crudo = zlib.inflateSync(Buffer.concat(datos));
  const fila = ancho * bpp, px = new Uint8Array(ancho * alto * 4);
  let ant = new Uint8Array(fila);
  for (let y = 0; y < alto; y++) {
    const f = crudo[y * (fila + 1)], lin = new Uint8Array(crudo.subarray(y * (fila + 1) + 1, (y + 1) * (fila + 1)));
    for (let i = 0; i < fila; i++) {
      const a = i >= bpp ? lin[i - bpp] : 0, b = ant[i], c = i >= bpp ? ant[i - bpp] : 0;
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      lin[i] = (lin[i] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
    }
    for (let x = 0; x < ancho; x++) for (let k = 0; k < 4; k++) px[(y * ancho + x) * 4 + k] = k < bpp ? lin[x * bpp + k] : 255;
    ant = lin;
  }
  return { ancho, alto, px };
}

/* --- PNG: escribir RGBA --- */
const TABLA = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = TABLA[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function bloque(nombre, cuerpo) {
  const l = Buffer.alloc(4); l.writeUInt32BE(cuerpo.length);
  const nc = Buffer.concat([Buffer.from(nombre, "ascii"), cuerpo]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(nc));
  return Buffer.concat([l, nc, c]);
}
function escribirPng(ancho, alto, px) {
  const h = Buffer.alloc(13); h.writeUInt32BE(ancho, 0); h.writeUInt32BE(alto, 4); h[8] = 8; h[9] = 6;
  const crudo = Buffer.alloc((ancho * 4 + 1) * alto);
  for (let y = 0; y < alto; y++) Buffer.from(px.buffer, y * ancho * 4, ancho * 4).copy(crudo, y * (ancho * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloque("IHDR", h), bloque("IDAT", zlib.deflateSync(crudo, { level: 9 })), bloque("IEND", Buffer.alloc(0))]);
}

/* --- El ícono --- */
function muestra(img, fx, fy) { // bilineal, con el color premultiplicado para que el borde no oscurezca
  const x0 = Math.max(0, Math.min(img.ancho - 1, Math.floor(fx))), y0 = Math.max(0, Math.min(img.alto - 1, Math.floor(fy)));
  const x1 = Math.min(img.ancho - 1, x0 + 1), y1 = Math.min(img.alto - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const r = [0, 0, 0, 0];
  for (const [x, y, w] of [[x0, y0, (1 - tx) * (1 - ty)], [x1, y0, tx * (1 - ty)], [x0, y1, (1 - tx) * ty], [x1, y1, tx * ty]]) {
    const i = (y * img.ancho + x) * 4, a = img.px[i + 3] / 255;
    r[0] += img.px[i] * a * w; r[1] += img.px[i + 1] * a * w; r[2] += img.px[i + 2] * a * w; r[3] += a * w;
  }
  return r[3] > 0 ? [r[0] / r[3], r[1] / r[3], r[2] / r[3], r[3]] : [0, 0, 0, 0];
}

function icono(img, tam, margen, redondeo) {
  const px = new Uint8Array(tam * tam * 4), rad = tam * redondeo;
  const lado = tam * (1 - 2 * margen), esc = Math.min(lado / img.ancho, lado / img.alto);
  const w = img.ancho * esc, h = img.alto * esc, ox = (tam - w) / 2, oy = (tam - h) / 2;
  const duro = Math.max(1, esc / 1.5); // cuánto se endurece el borde: más cuanto más se agrandó
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    // el fondo, con las esquinas redondeadas y suavizadas
    const cx = Math.min(Math.max(x + 0.5, rad), tam - rad), cy = Math.min(Math.max(y + 0.5, rad), tam - rad);
    const fuera = rad ? Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rad : -1;
    const aFondo = Math.min(1, Math.max(0, 0.5 - fuera));
    let [r, g, b, a] = (x >= ox && x < ox + w && y >= oy && y < oy + h) ? muestra(img, (x + 0.5 - ox) / esc - 0.5, (y + 0.5 - oy) / esc - 0.5) : [0, 0, 0, 0];
    a = Math.min(1, Math.max(0, (a - 0.5) * duro + 0.5));
    const i = (y * tam + x) * 4;
    px[i] = Math.round(r * a + FONDO[0] * (1 - a)); px[i + 1] = Math.round(g * a + FONDO[1] * (1 - a)); px[i + 2] = Math.round(b * a + FONDO[2] * (1 - a));
    px[i + 3] = Math.round(255 * aFondo);
  }
  return escribirPng(tam, tam, px);
}

const logo = fs.readFileSync(new URL("../src/ui/Logo.jsx", import.meta.url), "utf8");
const b64 = logo.match(/GENEZ_CLARO = "data:image\/png;base64,([^"]+)"/)[1];
const img = leerPng(Buffer.from(b64, "base64"));
const dir = new URL("../public/iconos/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });
/* "any" con esquinas redondeadas para la computadora; "maskable" a sangre y
   con más aire, porque Android recorta el ícono con su propia forma. */
fs.writeFileSync(new URL("genez-192.png", dir), icono(img, 192, 0.17, 0.22));
fs.writeFileSync(new URL("genez-512.png", dir), icono(img, 512, 0.17, 0.22));
fs.writeFileSync(new URL("genez-mascara-512.png", dir), icono(img, 512, 0.26, 0));
fs.writeFileSync(new URL("genez-180.png", dir), icono(img, 180, 0.17, 0)); // iPhone: lo redondea él
console.log("Íconos en public/iconos/");
