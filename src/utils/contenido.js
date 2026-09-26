/* ============================================================
   EL CONTENIDO DEL ENVASE Y EL PRECIO POR KILO O LITRO
   ============================================================

   La etiqueta de góndola tiene que decir el precio por unidad de medida
   —por kilo, por litro—, y el sistema no guarda cuánto trae cada envase.
   Pero el nombre casi siempre lo dice: "Hileret light 500g", "7up 2l",
   "Lavandina ayudin original 1litro". En Super 25, 854 de 1.408. Se lee
   de ahí, y si el nombre no lo dice o lo dice mal, el comercio lo
   corrige y queda en el producto (`camposExtra.contenido`), que manda
   sobre el nombre.

   Lo que se vende por peso (`unidad: "kg"`) ya tiene el precio por kilo:
   no hay nada que dividir.
   ============================================================ */

const UNIDADES = [
  { re: "kg|kgs|k|kilo|kilos", base: "kg", factor: 1 },
  { re: "g|gr|grs|gramos?", base: "kg", factor: 0.001 },
  { re: "l|lt|lts|litros?", base: "l", factor: 1 },
  { re: "ml|cc|cm3", base: "l", factor: 0.001 },
];

/* Un número con su unidad, pegados o no: "500g", "2,25 lts", "1litro".
   Se toma el último que aparezca: en "Cerveza lata 473ml x6" el
   contenido es el 473ml, y el "x6" multiplica. */
const PATRON = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIDADES.map((u) => u.re).join("|")})(?![a-z])(?:\\s*x\\s*(\\d+))?`, "gi");

/* { cantidad, base: "kg"|"l", texto } en unidades base (kilos o litros),
   o null si no se entiende. */
export function leerContenido(texto) {
  if (!texto) return null;
  let ultimo = null;
  for (const m of String(texto).matchAll(PATRON)) ultimo = m;
  if (!ultimo) return null;
  const numero = Number(ultimo[1].replace(",", "."));
  const unidad = UNIDADES.find((u) => new RegExp(`^(?:${u.re})$`, "i").test(ultimo[2]));
  const veces = ultimo[3] ? Number(ultimo[3]) : 1;
  if (!unidad || !(numero > 0) || !(veces > 0)) return null;
  const cantidad = numero * unidad.factor * veces;
  return { cantidad, base: unidad.base, texto: textoDe(cantidad, unidad.base) };
}

/* Cómo se muestra: 0,5 kg es "500 g"; 2,25 l, "2,25 l". */
export function textoDe(cantidad, base) {
  const fmt = (n) => n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
  if (cantidad < 1) return base === "kg" ? `${fmt(cantidad * 1000)} g` : `${fmt(cantidad * 1000)} ml`;
  return `${fmt(cantidad)} ${base}`;
}

/* El contenido de un producto: el que cargó el comercio, o el del nombre. */
export function contenidoDe(p) {
  const propio = p.camposExtra && p.camposExtra.contenido;
  return leerContenido(propio) || leerContenido(p.nombre);
}

/* { precio, por: "kg"|"litro" } o null. Redondeado a pesos. */
export function precioPorMedida(p) {
  if (!(p.precio > 0)) return null;
  if (p.unidad === "kg") return { precio: Math.round(p.precio), por: "kg" };
  const c = contenidoDe(p);
  if (!c) return null;
  return { precio: Math.round(p.precio / c.cantidad), por: c.base === "kg" ? "kg" : "litro" };
}
