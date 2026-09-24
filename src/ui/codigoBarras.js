/* ============================================================
   CÓDIGOS DE BARRAS PARA ETIQUETAS
   ============================================================

   Convierte un código en las barras que lee la pistola. Tres formatos,
   según lo que tenga el producto:

   - EAN-13: los de fábrica (13 dígitos, con su verificador).
   - EAN-8: los cortos, y los propios que asigna Genez (ver 0086).
   - Code 128: cualquier otra cosa —un código de 12 dígitos, uno mal
     tipeado, uno interno de un proveedor—. Lee cualquier texto.

   A mano y no con una librería por lo mismo que el PDF del ticket: son
   tablas fijas del estándar y un par de bucles.

   El resultado es una tira de módulos ("1" barra, "0" espacio) con los
   márgenes en blanco que el lector necesita a cada lado; `svgCodigo` la
   dibuja.
   ============================================================ */

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
/* En EAN-13 el primer dígito no se dibuja: se codifica en qué mitad de
   los seis de la izquierda van con la tabla L y cuáles con la G. */
const PARIDAD = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function digitoEan(cuerpo) {
  let suma = 0;
  const d = String(cuerpo).split("").reverse();
  d.forEach((c, i) => { suma += Number(c) * (i % 2 === 0 ? 3 : 1); });
  return (10 - (suma % 10)) % 10;
}

const eanValido = (c) => /^\d+$/.test(c) && Number(c[c.length - 1]) === digitoEan(c.slice(0, -1));

function ean13(c) {
  const par = PARIDAD[Number(c[0])];
  let m = "101";
  for (let i = 1; i <= 6; i++) m += (par[i - 1] === "L" ? L : G)[Number(c[i])];
  m += "01010";
  for (let i = 7; i <= 12; i++) m += R[Number(c[i])];
  return m + "101";
}

function ean8(c) {
  let m = "101";
  for (let i = 0; i < 4; i++) m += L[Number(c[i])];
  m += "01010";
  for (let i = 4; i < 8; i++) m += R[Number(c[i])];
  return m + "101";
}

/* Code 128: anchos de barra y espacio alternados, del 0 al 106. */
const C128 = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
  "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
  "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
  "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
  "114131 311141 411131 211412 211214 211232 2331112").split(" ");

function code128(texto) {
  /* Juego B: letras, números y signos comunes. */
  const valores = [104];
  for (const ch of String(texto)) {
    const v = ch.charCodeAt(0) - 32;
    valores.push(v >= 0 && v <= 94 ? v : 31);   // lo que no entra, "?"
  }
  const control = valores.reduce((s, v, i) => s + v * (i === 0 ? 1 : i), 0) % 103;
  valores.push(control, 106);
  let m = "";
  for (const v of valores) {
    C128[v].split("").forEach((ancho, i) => { m += (i % 2 === 0 ? "1" : "0").repeat(Number(ancho)); });
  }
  return m;
}

/** Qué formato le corresponde a un código. */
export function formatoDe(codigo) {
  const c = String(codigo || "").trim();
  if (/^\d{13}$/.test(c) && eanValido(c)) return "EAN13";
  if (/^\d{8}$/.test(c) && eanValido(c)) return "EAN8";
  return c ? "CODE128" : null;
}

/** Los módulos del código, con los márgenes que pide el lector. */
export function modulosDe(codigo) {
  const c = String(codigo).trim();
  const f = formatoDe(c);
  const margen = "0".repeat(10);
  if (f === "EAN13") return margen + ean13(c) + margen;
  if (f === "EAN8") return margen + ean8(c) + margen;
  if (f === "CODE128") return margen + code128(c) + margen;
  return "";
}

/**
 * El código dibujado, para la pantalla o para imprimir. Las barras
 * seguidas van en un solo rectángulo: ninguna rendija blanca entre ellas.
 *
 * @param anchoMM el ancho máximo que puede ocupar; los módulos se achican
 *                para entrar, hasta un mínimo que la pistola todavía lee.
 */
export function svgCodigo(codigo, { anchoMM = 40, altoMM = 14 } = {}) {
  const m = modulosDe(codigo);
  if (!m) return "";
  const modulo = Math.min(0.33, anchoMM / m.length);
  let rects = "";
  let i = 0;
  while (i < m.length) {
    if (m[i] === "1") {
      let j = i;
      while (j < m.length && m[j] === "1") j++;
      rects += `<rect x="${i}" y="0" width="${j - i}" height="1"/>`;
      i = j;
    } else i++;
  }
  const ancho = (m.length * modulo).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${m.length} 1" preserveAspectRatio="none" width="${ancho}mm" height="${altoMM}mm" shape-rendering="crispEdges" fill="#000">${rects}</svg>`;
}
