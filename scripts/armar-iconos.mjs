/* ============================================================
   LOS ÍCONOS DEL SISTEMA INSTALADO · node scripts/armar-iconos.mjs
   ============================================================

   Arma los PNG del manifiesto (public/iconos/) a partir del logo original
   de Genez: scripts/marca/genez-isotipo-sobre-negro.png, el "Logo Blanco
   Solo" de la carpeta de marca (2000x2000, la G blanca y naranja sobre
   negro). Es el formato de un ícono de aplicación y viene grande, así que
   solo se achica: queda nítido en cualquier tamaño.

   La primera versión partía del isotipo incrustado en Logo.jsx (114x110)
   y lo agrandaba; Nehuen pidió el logo bien (08/10).

   Sin dependencias: lee y escribe PNG con zlib, que viene con Node.
   ============================================================ */

import fs from "fs";
import zlib from "zlib";

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

/* Achicar promediando el área que cae en cada pixel: con un logo de 2000
   llevado a 192, tomar un punto solo dejaría el borde serruchado. */
function promedio(img, x0, y0, x1, y1) {
  const xa = Math.max(0, Math.floor(x0)), xb = Math.min(img.ancho, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(img.alto, Math.ceil(y1));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) {
    const i = (y * img.ancho + x) * 4; r += img.px[i]; g += img.px[i + 1]; b += img.px[i + 2]; n++;
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

/* `contenido`: qué parte del ícono ocupa el logo (el resto, negro como su
   fondo). `redondeo`: las esquinas, como fracción del lado. */
function icono(img, tam, contenido, redondeo) {
  const px = new Uint8Array(tam * tam * 4), rad = tam * redondeo;
  const lado = tam * contenido, o = (tam - lado) / 2, esc = img.ancho / lado;
  for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
    const cx = Math.min(Math.max(x + 0.5, rad), tam - rad), cy = Math.min(Math.max(y + 0.5, rad), tam - rad);
    const fuera = rad ? Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - rad : -1;
    const alfa = Math.min(1, Math.max(0, 0.5 - fuera));
    const dentro = x >= o && x < o + lado && y >= o && y < o + lado;
    const [r, g, b] = dentro ? promedio(img, (x - o) * esc, (y - o) * esc, (x + 1 - o) * esc, (y + 1 - o) * esc) : [0, 0, 0];
    const i = (y * tam + x) * 4;
    px[i] = Math.round(r); px[i + 1] = Math.round(g); px[i + 2] = Math.round(b); px[i + 3] = Math.round(255 * alfa);
  }
  return escribirPng(tam, tam, px);
}

const img = leerPng(fs.readFileSync(new URL("./marca/genez-isotipo-sobre-negro.png", import.meta.url)));
const dir = new URL("../public/iconos/", import.meta.url);
fs.mkdirSync(dir, { recursive: true });
/* "any" con las esquinas redondeadas, para la computadora; "maskable" a
   sangre y con el logo más chico, porque Android lo recorta con su propia
   forma (círculo, gota) y el logo tiene que entrar en el 80% del centro. */
fs.writeFileSync(new URL("genez-192.png", dir), icono(img, 192, 1, 0.2));
fs.writeFileSync(new URL("genez-512.png", dir), icono(img, 512, 1, 0.2));
fs.writeFileSync(new URL("genez-mascara-512.png", dir), icono(img, 512, 0.84, 0));
fs.writeFileSync(new URL("genez-180.png", dir), icono(img, 180, 1, 0)); // iPhone: lo redondea él
console.log("Íconos en public/iconos/");
