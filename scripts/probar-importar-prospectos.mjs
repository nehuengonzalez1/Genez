/* ============================================================
   PRUEBA · importar prospectos de una planilla, sin base
   ============================================================

   Con una planilla inventada como las que arma uno a mano: un título
   arriba, los encabezados en la tercera fila, una columna "Nombre del
   contacto" que no es el nombre del negocio, teléfonos escritos de tres
   maneras, un rubro que no está en las listas, una fila sin nombre, una
   repetida dentro de la planilla y una que ya estaba cargada.

     node scripts/probar-importar-prospectos.mjs
   ============================================================ */

import { normTel, filaDeTitulos, adivinarColumnas, armarFilas } from "../src/utils/importarProspectos.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

console.log("\nTeléfonos: los últimos diez dígitos");
decir(normTel("011 15-4444-5555") === normTel("+54 9 11 4444-5555"), "011 15 y +54 9 del mismo número dan igual");
decir(normTel("1144445555") === "1144445555", "diez dígitos quedan como están");
decir(normTel("4444") === "", "cuatro dígitos no alcanzan");

const planilla = [
  ["Relevamiento Caseros, septiembre"],
  [],
  ["Negocio", "Nombre del contacto", "Rubro", "Localidad", "Teléfono", "WhatsApp", "Mail", "Interés", "Observaciones"],
  ["Almacén Don Pepe", "Pepe", "Almacén", "Caseros", "011 15-4444-5555", "", "pepe@correo.com", "alto", "Abre a las 8"],
  ["Pizzería La Estrella", "", "Pizzería", "Caseros", "4750-1234", "", "no-es-un-mail", "", ""],
  ["", "Alguien", "Almacén", "Caseros", "1133334444", "", "", "", ""],
  ["Almacén Don Pepe bis", "", "almacen", "Caseros", "", "+54 9 11 4444-5555", "", "", "mismo teléfono que la primera"],
  ["Kiosco Ya Cargado", "", "", "Villa Bosch", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", ""],
  ["Verdulería Nueva", "Ana", "", "Caseros", "12", "", "", "tibio", ""],
];

console.log("\nLa fila de títulos y las columnas");
const desde = filaDeTitulos(planilla);
decir(desde === 2, `títulos en la fila ${desde + 1} (esperado 3)`);
const mapa = adivinarColumnas(planilla[desde]);
decir(mapa.nombre === 0, `nombre del negocio = "Negocio" (${mapa.nombre})`);
decir(mapa.contactoNombre === 1, `"Nombre del contacto" es el contacto, no el negocio (${mapa.contactoNombre})`);
decir(mapa.telefono === 4 && mapa.whatsapp === 5, "teléfono y WhatsApp, cada uno en su columna");
decir(mapa.email === 6 && mapa.notas === 8 && mapa.interes === 7, "mail, interés y observaciones");
decir(mapa.zona === -1 && mapa.fuente === -1, "lo que no está queda en -1");

const listas = { rubro: [{ clave: "almacen", nombre: "Almacén" }, { clave: "gastronomia", nombre: "Gastronomía" }], zona: [], fuente: [] };
const existentes = [{ nombre: "Kiosco ya cargado", localidad: "Villa Bosch", archivadoEn: new Date() }];
const r = armarFilas(planilla, desde, mapa, listas, existentes);

console.log("\nLas filas");
decir(r.length === 6, `seis filas con algo (la vacía no cuenta): ${r.length}`);
const fila = (n) => r.find((x) => x.n === n);
const pepe = fila(4);
decir(pepe && pepe.datos.rubro === "almacen" && pepe.datos.interes === "caliente" && pepe.datos.contactoNombre === "Pepe" && pepe.incluir, "la primera entra entera, con rubro por nombre e interés 'alto' → caliente");
const pizza = fila(5);
decir(pizza && !pizza.datos.rubro && pizza.avisos.some((a) => a.includes("Pizzería")), "un rubro que no está en las listas queda vacío y se avisa");
decir(pizza && !pizza.datos.email && pizza.avisos.some((a) => a.includes("email")), "un mail mal escrito queda vacío y se avisa");
decir(pizza && pizza.incluir, "los avisos no frenan la fila");
const sinNombre = fila(6);
decir(sinNombre && sinNombre.errores.length && !sinNombre.incluir, "sin nombre del negocio no se importa");
const bis = fila(7);
decir(bis && bis.duplicado && bis.duplicado.includes("fila 4") && !bis.incluir, `el mismo teléfono escrito distinto es repetido: ${bis && bis.duplicado}`);
const ya = fila(8);
decir(ya && ya.duplicado && ya.duplicado.includes("archivado") && !ya.incluir, `lo que ya estaba, aunque archivado, se marca: ${ya && ya.duplicado}`);
const verdu = fila(10);
decir(verdu && verdu.incluir && verdu.avisos.some((a) => a.includes("pocos dígitos")) && verdu.datos.interes === "tibio", "un teléfono de dos dígitos se avisa pero la fila entra");

console.log(fallas ? `\n${fallas} MAL\n` : "\nTodo bien\n");
process.exit(fallas ? 1 : 0);
