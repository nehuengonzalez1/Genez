/* ============================================================
   EL TICKET EN EL IDIOMA DE LA IMPRESORA (ESC/POS)
   ============================================================

   Casi todas las impresoras térmicas de mostrador hablan ESC/POS: texto
   plano con unos pocos comandos para la negrita, la alineación, las
   imágenes y el corte. Lo arma el navegador y lo manda al programa de
   impresión de la caja (public/impresora/genez-impresora.ps1), que se lo
   pasa a la impresora sin tocarlo.

   Los renglones son los mismos de `armarLineas`: 32 caracteres a 58 mm y
   48 a 80 mm, que es justo lo que entra con la letra de fábrica de estas
   impresoras (384 y 576 puntos, 12 por carácter). Así el papel sale
   igual a lo que muestra la pantalla, sin cálculos de ancho.

   LOS ACENTOS
   -----------
   Cada impresora trae su tabla de caracteres, y cuál es la que tiene
   cargada no se puede preguntar. Un acento en la tabla equivocada sale
   como un símbolo cualquiera en la mitad del nombre del producto. Por eso
   se sacan: "AZÚCAR" sale "AZUCAR". En un ticket se lee igual, y sale
   igual en todas.
   ============================================================ */

const ESC = 0x1b;
const GS = 0x1d;

const SIN_ACENTO = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n", Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Ü: "U", Ñ: "N", "·": "-", "−": "-", "–": "-", "—": "-", "“": "\"", "”": "\"", "‘": "'", "’": "'", "…": "..." };

function aBytes(texto) {
  const plano = String(texto).replace(/[^\x20-\x7e]/g, (c) => SIN_ACENTO[c] ?? "?");
  const b = new Uint8Array(plano.length);
  for (let i = 0; i < plano.length; i++) b[i] = plano.charCodeAt(i);
  return b;
}

/* Puntos que imprime el cabezal en cada rollo. */
const PUNTOS = { 58: 384, 80: 576 };

/* El QR como imagen (GS v 0), que entienden todas; el comando de QR
   propio de ESC/POS no lo traen todas las de 58 mm. Cada módulo del QR son
   varios puntos, los más que entren en el 80 % del ancho. */
function qrComoImagen({ n, celdas }, mm) {
  const modulo = Math.max(2, Math.floor((PUNTOS[mm] * 0.8) / n));
  const lado = n * modulo;
  const bytesPorFila = Math.ceil(lado / 8);
  const imagen = new Uint8Array(bytesPorFila * lado);
  for (const [x, y] of celdas) {
    for (let dy = 0; dy < modulo; dy++) {
      const fila = y * modulo + dy;
      for (let dx = 0; dx < modulo; dx++) {
        const col = x * modulo + dx;
        imagen[fila * bytesPorFila + (col >> 3)] |= 0x80 >> (col & 7);
      }
    }
  }
  const cab = [GS, 0x76, 0x30, 0x00, bytesPorFila & 0xff, bytesPorFila >> 8, lado & 0xff, lado >> 8];
  return [new Uint8Array(cab), imagen];
}

/**
 * @param lineas  los renglones de `armarLineas`
 * @param mm      58 u 80
 * @param celdas  el QR como { n, celdas } de `celdasQR`, o null
 * @param cortar  cortar el papel al final (las que no tienen cortador lo ignoran)
 */
export function armarEscPos({ lineas, mm = 58, celdas = null, cortar = true }) {
  const partes = [];
  const cmd = (...b) => partes.push(new Uint8Array(b));

  cmd(ESC, 0x40);            // reinicio: sin restos de un ticket anterior
  cmd(ESC, 0x45, 1);         // negrita: el papel térmico no imprime grises
  cmd(ESC, 0x61, 0);         // alineado a la izquierda: el centrado ya viene en el texto
  for (const l of lineas) { partes.push(aBytes(l)); cmd(0x0a); }

  if (celdas) {
    cmd(0x0a);
    cmd(ESC, 0x61, 1);       // el QR, centrado
    partes.push(...qrComoImagen(celdas, mm === 58 ? 58 : 80));
    cmd(0x0a);
    cmd(ESC, 0x61, 0);
  }

  /* Avance antes del corte: el cabezal está unos milímetros más arriba
     que la cuchilla, y sin esto se corta la última línea. */
  cmd(ESC, 0x64, 4);
  if (cortar) cmd(GS, 0x56, 0x42, 0);   // corte parcial

  const largo = partes.reduce((s, p) => s + p.length, 0);
  const todo = new Uint8Array(largo);
  let i = 0;
  for (const p of partes) { todo.set(p, i); i += p.length; }
  return todo;
}

/* ------------------------------------------------------------
   Etiquetas de código de barras en la térmica
   ------------------------------------------------------------
   Con el comando de código de barras de la propia impresora (GS k): la
   barra la dibuja ella, a su resolución, y sale más nítida que una
   imagen. Una etiqueta debajo de la otra, con una línea de puntos para
   cortar. */

const FORMATO_ESCPOS = { EAN13: 67, EAN8: 68, CODE128: 73 };

export function etiquetasEscPos({ etiquetas, mm = 58, W = 32, formatoDe }) {
  const partes = [];
  const cmd = (...b) => partes.push(new Uint8Array(b));
  cmd(ESC, 0x40);
  cmd(GS, 0x68, 70);          // alto de las barras, en puntos (~9 mm)
  cmd(GS, 0x77, mm === 58 ? 2 : 3); // ancho del módulo
  cmd(GS, 0x48, 2);           // los números debajo de las barras
  for (const e of etiquetas) {
    const f = formatoDe(e.codigo);
    if (!f) continue;
    cmd(ESC, 0x61, 1);
    cmd(ESC, 0x45, 1);
    if (e.nombre) { partes.push(aBytes(String(e.nombre).slice(0, W))); cmd(0x0a); }
    cmd(ESC, 0x45, 0);
    const datos = f === "CODE128" ? "{B" + e.codigo : e.codigo;
    const bytes = aBytes(datos);
    cmd(GS, 0x6b, FORMATO_ESCPOS[f], bytes.length);
    partes.push(bytes);
    cmd(0x0a);
    if (e.precio) { cmd(ESC, 0x45, 1); partes.push(aBytes(e.precio)); cmd(0x0a); cmd(ESC, 0x45, 0); }
    cmd(ESC, 0x61, 0);
    partes.push(aBytes("- ".repeat(Math.floor(W / 2))));
    cmd(0x0a);
  }
  cmd(ESC, 0x64, 4);
  cmd(GS, 0x56, 0x42, 0);
  const largo = partes.reduce((s, p) => s + p.length, 0);
  const todo = new Uint8Array(largo);
  let i = 0;
  for (const p of partes) { todo.set(p, i); i += p.length; }
  return todo;
}
