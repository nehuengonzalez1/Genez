/* ============================================================
   LA LISTA DE PRECIOS DE UN PROVEEDOR
   ============================================================

   Cada proveedor manda su lista como quiere: con el logo y la dirección
   arriba, las columnas en otro orden, "Precio c/IVA" o "Neto", importes
   con coma o con punto. La planilla que exporta Genez (analizarPlanilla,
   en Vender.jsx) espera columnas con nombres fijos, así que con esto no
   servía.

   Acá: encontrar la fila de títulos, adivinar qué columna es cada cosa
   (quien importa la puede corregir), leer los importes como vengan, y
   cruzar por código de barras contra el catálogo. El resultado no se
   aplica: va al borrador de Productos → Editar en tabla, y se guarda
   después de mirarlo, como todo cambio masivo de precios.

   Funciones puras: se prueban sin base con scripts/probar-lista-proveedor.mjs.
   ============================================================ */

const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/* Un importe como venga: "1.234,56", "1234.56", "$ 1.234", 1234.5.
   El separador decimal es el último de los dos que aparezca; con uno solo,
   un punto seguido de grupos de 3 cifras son miles ("1.234" = 1234). */
export function leerImporte(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const coma = s.lastIndexOf(","), punto = s.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    s = coma > punto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (coma >= 0) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (punto >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/* Un código de barras: solo dígitos, de 8 a 14 (EAN-8, EAN-13, DUN-14).
   Los códigos propios del proveedor ("ART-0042") no sirven para cruzar. */
export const leerCodigo = (v) => {
  const d = String(v ?? "").replace(/\.0+$/, "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 14 ? d : null;
};

/* La fila de títulos: entre las primeras 20, la que tiene más celdas de
   texto que parecen títulos (código, descripción, precio…). Arriba suele
   haber el nombre del proveedor, la fecha, un teléfono. */
const PISTAS = ["cod", "ean", "barra", "descrip", "detalle", "articulo", "producto", "precio", "costo", "neto", "lista", "importe", "valor", "unit", "iva"];
export function encontrarTitulos(filas) {
  let mejor = 0, puntaje = -1;
  filas.slice(0, 20).forEach((f, i) => {
    const celdas = (f || []).map(norm).filter(Boolean);
    const p = celdas.filter((c) => PISTAS.some((x) => c.includes(x))).length * 3 + celdas.filter((c) => isNaN(Number(c))).length;
    if (p > puntaje) { puntaje = p; mejor = i; }
  });
  return mejor;
}

/* Qué columna es cada cosa, adivinando por el título. -1 = no se sabe. */
export function adivinarColumnas(titulos) {
  const t = titulos.map(norm);
  const buscar = (...palabras) => t.findIndex((c) => palabras.some((w) => c.includes(w)));
  let codigo = buscar("ean", "barra", "cod. barra", "codigo de barra");
  if (codigo < 0) codigo = buscar("codigo", "cod");
  const descripcion = buscar("descrip", "detalle", "articulo", "producto", "nombre");
  /* "Precio" a secas o "costo": lo que se paga. Se prefiere el que dice
     c/IVA o final si hay dos, porque es el que el comercio paga. */
  let importe = buscar("c/iva", "con iva", "final");
  if (importe < 0) importe = buscar("costo", "precio", "neto", "lista", "importe", "valor", "unit");
  return { codigo, descripcion, importe };
}

/* Cruza la lista contra el catálogo.
   columnas: { codigo, descripcion, importe } (índices)
   que: "costo" | "precio" — qué es el importe de la lista
   markup: si que = "costo" y se quiere el precio también, el % sobre el costo (o null)
   sumarIva: el importe viene sin IVA; se le suma el de cada producto
   redondeo: a cuánto se redondea un precio calculado (10, 50, 100, 1)
   Devuelve { cambios: [{ producto, costo?, precio? }], iguales, noEstan: [{ codigo, descripcion, importe }], sinCodigo } */
export function cruzarLista({ filas, desde, columnas, productos, que = "costo", markup = null, sumarIva = false, redondeo = 10 }) {
  const porCodigo = new Map(productos.filter((p) => p.barcode).map((p) => [String(p.barcode), p]));
  const cambios = [], noEstan = [];
  let iguales = 0, sinCodigo = 0;
  const vistos = new Set();

  for (const f of filas.slice(desde)) {
    if (!f || !f.some((c) => String(c ?? "").trim())) continue;
    const codigo = leerCodigo(f[columnas.codigo]);
    const bruto = leerImporte(f[columnas.importe]);
    if (!codigo || bruto == null || bruto <= 0) { sinCodigo++; continue; }
    const p = porCodigo.get(codigo);
    if (!p) { noEstan.push({ codigo, descripcion: String(f[columnas.descripcion] ?? "").trim(), importe: bruto }); continue; }
    if (vistos.has(p.id)) continue;   // el mismo producto dos veces en la lista: vale la primera
    vistos.add(p.id);

    const iva = p.ivaCondicion && p.ivaCondicion !== "gravado" ? 0 : Number(p.iva ?? 21);
    const importe = sumarIva ? bruto * (1 + iva / 100) : bruto;
    const cambio = { producto: p };
    if (que === "costo") {
      const costo = Math.round(importe);
      if (costo !== Math.round(Number(p.costo) || 0)) cambio.costo = costo;
      if (markup != null) {
        const r = Number(redondeo) || 1;
        const precio = Math.ceil(costo * (1 + markup / 100) / r) * r;
        if (precio !== Number(p.precio)) cambio.precio = precio;
      }
    } else {
      const precio = Math.round(importe);
      if (precio !== Number(p.precio)) cambio.precio = precio;
    }
    if (cambio.costo === undefined && cambio.precio === undefined) iguales++;
    else cambios.push(cambio);
  }
  return { cambios, iguales, noEstan, sinCodigo };
}
