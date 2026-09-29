/* ============================================================
   PRUEBA · leer la lista de precios de un proveedor, sin base
   ============================================================

   Con una lista inventada como las de verdad: el nombre del proveedor y
   la fecha arriba, los títulos en la cuarta fila, importes con coma y con
   punto, códigos propios del proveedor mezclados con EAN, y productos que
   no están en el catálogo.

     node scripts/probar-lista-proveedor.mjs
   ============================================================ */

import { leerImporte, leerCodigo, encontrarTitulos, adivinarColumnas, cruzarLista } from "../src/utils/listaProveedor.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

console.log("\nImportes como vengan");
for (const [v, esperado] of [["1.234,56", 1234.56], ["1234.56", 1234.56], ["$ 1.234", 1234], ["1,234.50", 1234.5], ["2.500", 2500], ["2,5", 2.5], [1850.4, 1850.4], ["", null], ["s/p", null], ["12.345.678", 12345678]]) {
  decir(leerImporte(v) === esperado, `"${v}" → ${esperado}`);
}

console.log("\nCódigos");
decir(leerCodigo("7790001001018") === "7790001001018", "un EAN-13");
decir(leerCodigo(7790001001018) === "7790001001018", "un EAN que Excel guardó como número");
decir(leerCodigo("7790001001018.0") === "7790001001018", "con el .0 que agrega Excel");
decir(leerCodigo("ART-0042") === null, "un código propio del proveedor no sirve para cruzar");

const lista = [
  ["DISTRIBUIDORA NORTE SA", "", "", ""],
  ["Lista de precios vigente desde 29/09/2026", "", "", ""],
  ["", "", "", ""],
  ["Cód. Barras", "Descripción", "Cod. Prov.", "Precio s/IVA"],
  ["7790001001018", "Leche entera 1 L", "L-01", "1.000,00"],
  ["7790001001025", "Yerba 1 kg", "Y-02", "2.500"],
  ["7790001001032", "Fideos 500 g", "F-03", "900"],
  ["7790009999999", "Producto que no tenemos", "Z-99", "5.000"],
  ["", "SECCIÓN LIMPIEZA", "", ""],
  ["ART-0042", "Lavandina (sin EAN)", "A-42", "800"],
  ["7790001001018", "Leche entera 1 L (repetida)", "L-01", "9.999"],
];

console.log("\nLa lista");
const desde = encontrarTitulos(lista);
decir(desde === 3, `los títulos están en la cuarta fila (encontró la ${desde + 1})`);
const col = adivinarColumnas(lista[desde]);
decir(col.codigo === 0 && col.descripcion === 1 && col.importe === 3, `columnas: código ${col.codigo}, descripción ${col.descripcion}, importe ${col.importe}`);
decir(adivinarColumnas(["EAN", "Artículo", "Costo", "Precio c/IVA"]).importe === 3, "con dos importes, prefiere el que dice c/IVA");

const productos = [
  { id: "leche", barcode: "7790001001018", costo: 900, precio: 1500, iva: 10.5, ivaCondicion: "gravado" },
  { id: "yerba", barcode: "7790001001025", costo: 0, precio: 4000, iva: 21, ivaCondicion: "gravado" },
  { id: "fideos", barcode: "7790001001032", costo: 994.5, precio: 1600, iva: 10.5, ivaCondicion: "gravado" },
];

console.log("\nEl importe es el costo, sin IVA");
let r = cruzarLista({ filas: lista, desde: desde + 1, columnas: col, productos, que: "costo", sumarIva: true });
const de = (id) => r.cambios.find((c) => c.producto.id === id);
decir(de("leche") && de("leche").costo === 1105, "leche: 1.000 + 10,5% de IVA = 1.105");
decir(de("yerba") && de("yerba").costo === 3025, "yerba: 2.500 + 21% = 3.025");
decir(!de("fideos") && r.iguales === 1, "fideos: 900 + 10,5% = 994,5, igual al de hoy, sin cambio");
decir(r.cambios.every((c) => c.precio === undefined), "sin markup, el precio no se toca");
decir(r.noEstan.length === 1 && r.noEstan[0].codigo === "7790009999999" && r.noEstan[0].descripcion === "Producto que no tenemos", "el que no está en el catálogo se lista aparte");
decir(r.sinCodigo === 2, "la fila de sección y el código propio se saltean");
decir(r.cambios.filter((c) => c.producto.id === "leche").length === 1 && de("leche").costo === 1105, "la leche repetida: vale la primera");

console.log("\nEl costo, y el precio con markup");
r = cruzarLista({ filas: lista, desde: desde + 1, columnas: col, productos, que: "costo", sumarIva: true, markup: 40, redondeo: 50 });
decir(r.cambios.find((c) => c.producto.id === "leche").precio === 1550, "leche: 1.105 × 1,40 = 1.547 → 1.550 redondeando a $50 hacia arriba");
decir(r.cambios.find((c) => c.producto.id === "fideos").precio === 1400, "fideos: el costo no cambia pero el precio sí (994,5 × 1,40 = 1.392,3 → 1.400)");

console.log("\nEl importe es el precio de venta");
r = cruzarLista({ filas: lista, desde: desde + 1, columnas: col, productos, que: "precio" });
decir(r.cambios.find((c) => c.producto.id === "yerba").precio === 2500 && r.cambios.every((c) => c.costo === undefined), "pone el precio tal cual, sin tocar el costo");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
