/* ============================================================
   EL CATÁLOGO BASE · cómo se lee una fila de SEPA
   ============================================================

   SEPA (Precios Claros) publica lo que venden las cadenas grandes con el
   formato de la Res. 678/2020: la descripción en mayúsculas, con el
   envase y la presentación pegados al final ("FIDEOS TIRABUZÓN MATARAZZO
   PAQ 400 GRM"). Acá se decide qué descripción conviene entre las de
   varias cadenas, cómo se escribe como la escribiría un comercio, y a qué
   rubro va, que SEPA no trae.

   Puro y sin base: lo usan el script de carga y las pruebas.
   ============================================================ */

/* El código se guarda sin ceros adelante: la pistola lee un UPC de doce
   dígitos como trece con un cero, y SEPA a veces lo publica de una forma
   y el comercio lo tiene de la otra. */
export const normalizarEan = (s) => String(s || "").replace(/\D/g, "").replace(/^0+/, "");

const UNIDADES = {
  grm: "g", gr: "g", g: "g", kgm: "kg", kg: "kg",
  mlt: "ml", ml: "ml", cmq: "ml", cc: "ml", ltr: "L", lt: "L", l: "L",
  uni: "un", un: "un", u: "un", mtr: "m", mt: "m", m: "m",
};

/* Los envases de la norma: dicen cómo viene, no qué es, y en la góndola
   nadie los nombra. */
const ENVASES = new Set(["PAQ", "POU", "BOT", "LAT", "CAJ", "SOB", "DOY", "FRA", "BOL", "PET", "BID", "TET",
  "ENV", "UNI", "BLI", "EST", "POT", "BAN", "TUB", "PAC", "BDJ", "VAS", "ROL", "FCO", "BAL", "BRI", "CAR", "AER", "PCK"]);

/* "400 g", "1,5 L", "6 un". Lo que no tiene unidad conocida queda afuera:
   mejor sin presentación que con una inventada. */
export function presentacion(cantidad, unidad) {
  const u = UNIDADES[String(unidad || "").trim().toLowerCase()];
  let n = Number(String(cantidad || "").replace(",", "."));
  if (!u || !isFinite(n) || n <= 0) return "";
  let uf = u;
  /* Hay cadenas que publican "2250 LT": ninguna gaseosa trae dos mil
     litros, son mililitros. Igual con los kilos. */
  if (u === "L" && n >= 100) uf = "ml";
  if (u === "kg" && n >= 100) uf = "g";
  // "0,15 L" lo escribe una planilla; en la góndola dice 150 ml.
  if (uf === "L" && n < 1) { n = n * 1000; uf = "ml"; }
  if (uf === "kg" && n < 1) { n = n * 1000; uf = "g"; }
  if (uf === "ml" && n >= 1000 && n % 250 === 0) { n = n / 1000; uf = "L"; }
  if (uf === "g" && n >= 1000 && n % 250 === 0) { n = n / 1000; uf = "kg"; }
  // "1 un" es lo que la norma pone cuando no hay presentación: no dice nada.
  if (uf === "un" && n === 1) return "";
  return `${String(Math.round(n * 1000) / 1000).replace(".", ",")} ${uf}`;
}

const conMayuscula = (w) => w.charAt(0).toLocaleUpperCase("es") + w.slice(1);

/* La descripción de la norma pasada a como la escribe un comercio: la
   primera en mayúscula, la marca con su mayúscula, sin el envase y con la
   presentación de los campos (que son más confiables que lo que quedó
   escrito en el texto). */
export function nombreProlijo({ descripcion, marca, cantidad, unidad }) {
  const pres = presentacion(cantidad, unidad);
  let palabras = String(descripcion || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  // La presentación que ya estaba al final del texto: "400 GRM", "X500G.", "1.5 LTR".
  while (palabras.length > 1) {
    const ult = palabras[palabras.length - 1].toUpperCase();
    const ant = palabras.length > 1 ? palabras[palabras.length - 2].toUpperCase() : "";
    if (UNIDADES[ult.toLowerCase().replace(/\.$/, "")] !== undefined && /^[\d.,]+$/.test(ant)) { palabras = palabras.slice(0, -2); continue; }
    if (/^X?[\d.,]+(GRS?|GRM|G|KGS?|KGM|ML|MLT|CC|CMQ|LTS?|LTR|L|UN|U)([./]\S*)?$/.test(ult)) { palabras = palabras.slice(0, -1); continue; }
    if (ENVASES.has(ult)) { palabras = palabras.slice(0, -1); continue; }
    // La "x" de "x 312 g" cuando el número ya se fue con la presentación.
    if (ult === "X") { palabras = palabras.slice(0, -1); continue; }
    break;
  }
  const marcaMin = String(marca || "").trim().toLocaleLowerCase("es");
  const marcaPal = new Set(marcaMin.split(/\s+/).filter(Boolean));
  const texto = palabras
    .map((w) => w.toLocaleLowerCase("es"))
    .map((w) => (marcaPal.has(w) ? conMayuscula(w) : w))
    .join(" ");
  /* Algunas cadenas no ponen la marca en la descripción ("BEB ISOTONICA
     NARANJA") y viene solo en su campo: sin ella, en la góndola nadie
     sabe qué es. Va antes de la presentación, como la escribe un
     almacén. */
  const enTexto = new Set(texto.toLocaleLowerCase("es").split(" "));
  const faltan = marcaMin.split(/\s+/).filter((w) => w && !enTexto.has(w));
  const conMarca = faltan.length ? `${texto} ${faltan.map(conMayuscula).join(" ")}` : texto;
  const base = conMayuscula(conMarca);
  return pres ? `${base} ${pres}` : base;
}

/* Entre las descripciones de un mismo código, la que más cadenas usan;
   a igualdad, la que trae marca y la que está escrita con la norma (las
   de "ARROZ MOLTO X500G.L/F" son de cadenas que mandan su sistema viejo
   tal cual). */
export function mejorDescripcion(candidatas) {
  const puntaje = (c) => c.cadenas * 10
    + (c.marca ? 5 : 0)
    + (UNIDADES[String(c.unidad || "").toLowerCase()] ? 2 : 0)
    - (/[./]\S/.test(c.descripcion) ? 4 : 0);
  return [...candidatas].sort((a, b) => puntaje(b) - puntaje(a))[0] || null;
}

/* El rubro por la primera palabra que lo delata. El orden importa: la
   primera regla que calza gana, así "jabón en polvo" es limpieza antes de
   que "jabón" lo mande a perfumería, y "cerveza" no cae en bebidas. */
const REGLAS = [
  ["Helados", /\b(helados?|palito helado|bombón helado)\b/],
  ["Congelados", /\b(congelad[oa]s?|hamburguesas?|medallones|patitas|nuggets|bastones de|papas prefritas|vegetales congelados)\b/],
  ["Bebidas con alcohol", /\b(cervezas?|vinos?|fernet|aperitivos?|whisky|vodka|gin|ron|licor(es)?|sidra|champa(ñ|n)a|espumantes?|vermut|gancia|campari|aperol|tequila|malbec|cabernet|chardonnay|torront[eé]s|bonarda|merlot|syrah|blend)\b/],
  ["Limpieza", /\b(detergentes?|lavandina|limpiador(es)?|desengrasante|jab[oó]n (en polvo|l[ií]quido para ropa|para ropa)|suavizante|quitamanchas|lustramuebles|insecticida|repelente|esponjas?|trapos?|rejillas?|bolsas de residuos|desinfectante|cera|limpiavidrios|destapa|aromatizante|pastillas? para inodoro|lavavajillas|papel de cocina|rollo de cocina|servilletas?|guantes)\b/],
  ["Perfumería", /\b(shampoo|champ[uú]|acondicionador|crema (de enjuague|dental|corporal|para manos|de peinar)|jab[oó]n|desodorantes?|antitranspirante|pasta dental|dent[ií]frico|cepillo dental|enjuague bucal|toallitas|toallas (femeninas|higi[eé]nicas)|protectores diarios|tampones|pa[ñn]ales|papel higi[eé]nico|afeitar|m[aá]quina de afeitar|espuma de afeitar|colonia|perfume|talco|algod[oó]n|hisopos|preservativos|protector solar|tintura|gel para el cabello|fijador)\b/],
  ["Bebidas", /\b(gaseosas?|agua|aguas|jugos?|soda|bebida|energizante|isot[oó]nica|amargo|t[oó]nica|pomelo|cola|lima lim[oó]n|naranjada)\b/],
  ["Refrigerados", /\b(leche|yogur|yogurt|queso|quesos|manteca|crema de leche|dulce de leche|ricota|postre|flan|salchichas|jam[oó]n|salame|mortadela|fiambre|tapas para|pascualina|empanadas|ravioles|sorrentinos|[ñn]oquis|pastas frescas|huevos?|margarina|leche cultivada)\b/],
  ["Kiosco", /\b(alfajor(es)?|chocolates?|caramelos?|chicles?|golosinas?|turr[oó]n|bombones|pastillas|chupet[ií]n|obleas?|barritas?|barra de cereal|galletitas?|papas fritas|snacks?|palitos|chizitos|man[ií]|confites|gomitas|mentitas|cigarrillos?)\b/],
  ["Mascotas", /\b(alimento para (perros?|gatos?)|perros?|gatos?|piedras sanitarias)\b/],
  ["Almacén", /\b(fideos?|arroz|harina|aceite|az[uú]car|yerba|t[eé]|caf[eé]|mate cocido|sal|vinagre|mayonesa|ketchup|mostaza|salsa|pur[eé]|tomate|arvejas|choclo|lentejas|porotos|garbanzos|at[uú]n|caballa|sardinas|galletas|pan rallado|rebozador|polenta|s[eé]mola|levadura|polvo de hornear|almid[oó]n|maicena|mermelada|dulce de|cacao|edulcorante|caldo|sopa|condimento|pimienta|or[eé]gano|piment[oó]n|aceitunas|palmitos|duraznos|conserva|premezcla|bizcochuelo|gelatina|leche en polvo|cereales?|avena|miel|pan|tostadas|grisines|budin|magdalenas|vainillas)\b/],
];

export function rubroDe(texto) {
  /* Sin tildes antes de comparar: el \b de JavaScript no sabe que "é" es
     una letra, y "té" no terminaba nunca en un límite de palabra. */
  const t = String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const [rubro, re] of REGLAS) if (re.test(t)) return rubro;
  return null;
}

export const RUBROS_CATALOGO = REGLAS.map(([r]) => r);
