/* ============================================================
   CONVERTIR COLORES DE TAILWIND A LOS DEL SISTEMA
   ============================================================

   Reemplaza las clases con el color escrito -bg-white, text-stone-500-
   por las del sistema -bg-superficie, text-texto-suave-. Es mecánico y
   son cerca de mil apariciones: a mano se cometen errores y se pierde
   medio día.

     node scripts/migrar-colores.mjs src/ui/Base.jsx
     node scripts/migrar-colores.mjs --ver src/ui/Base.jsx   (sin escribir)

   NO toca los fondos oscuros puestos a propósito -el panel del login, el
   encabezado de la caja-, porque ahí el negro es una decisión de diseño y
   no el tema. Esos quedan listados al final para revisarlos a mano.
   ============================================================ */

import { readFileSync, writeFileSync } from "node:fs";

const MAPA = [
  // Superficies
  ["bg-white", "bg-superficie"],
  ["bg-stone-50", "bg-superficie-2"],
  ["bg-stone-100", "bg-superficie-2"],
  ["bg-stone-200", "bg-superficie-3"],

  // Texto, de más a menos importante
  ["text-stone-900", "text-texto"],
  ["text-stone-800", "text-texto"],
  ["text-stone-700", "text-texto"],
  ["text-stone-600", "text-texto-suave"],
  ["text-stone-500", "text-texto-suave"],
  ["text-stone-400", "text-texto-tenue"],
  ["text-stone-300", "text-texto-tenue"],

  // Bordes y separadores
  ["border-stone-100", "border-borde"],
  ["border-stone-200", "border-borde"],
  ["border-stone-300", "border-borde-fuerte"],
  ["divide-stone-100", "divide-borde"],
  ["divide-stone-200", "divide-borde"],

  // El acento
  ["bg-orange-500", "bg-acento"],
  ["bg-orange-600", "bg-acento"],
  ["bg-orange-400", "bg-acento-vivo"],
  ["bg-orange-50", "bg-acento-suave"],
  ["bg-orange-100", "bg-acento-suave"],
  ["text-orange-600", "text-acento"],
  ["text-orange-500", "text-acento"],
  ["text-orange-400", "text-acento-vivo"],
  ["text-orange-700", "text-acento"],
  ["border-orange-400", "border-acento"],
  ["border-orange-500", "border-acento"],
  ["border-orange-200", "border-acento"],

  // Estados
  ["bg-emerald-50", "bg-bien-suave"],  ["bg-emerald-500", "bg-bien"],
  ["text-emerald-600", "text-bien"],   ["text-emerald-700", "text-bien"],
  ["text-emerald-500", "text-bien"],   ["border-emerald-200", "border-bien"],
  ["bg-amber-50", "bg-ojo-suave"],     ["bg-amber-500", "bg-ojo"],
  ["text-amber-600", "text-ojo"],      ["text-amber-700", "text-ojo"],
  ["border-amber-200", "border-ojo"],
  ["bg-red-50", "bg-mal-suave"],       ["bg-red-500", "bg-mal"],
  ["text-red-600", "text-mal"],        ["text-red-700", "text-mal"],
  ["text-red-500", "text-mal"],        ["border-red-200", "border-mal"],
  ["border-red-300", "border-mal"],
  ["bg-sky-50", "bg-info-suave"],      ["text-sky-600", "text-info"],
  ["text-sky-700", "text-info"],       ["border-sky-200", "border-info"],
];

/* Fondos oscuros que son decisión de diseño y no tema: el panel del
   login, el encabezado de la caja, la franja de inicio. Convertirlos los
   volvería claros en el tema claro, que es justo lo contrario. */
const A_MANO = ["bg-stone-900", "bg-stone-950", "bg-[#0A0A0A]", "bg-black"];

const soloVer = process.argv.includes("--ver");
const archivos = process.argv.slice(2).filter((a) => !a.startsWith("--"));

for (const archivo of archivos) {
  let texto = readFileSync(archivo, "utf8");
  const antes = texto;
  let cambios = 0;

  for (const [viejo, nuevo] of MAPA) {
    /* El límite de palabra evita que bg-stone-50 se coma a bg-stone-500. */
    const re = new RegExp(`(?<![\\w-])${viejo}(?![\\w-])`, "g");
    const encontrados = (texto.match(re) || []).length;
    if (encontrados) { texto = texto.replace(re, nuevo); cambios += encontrados; }
  }

  const pendientes = A_MANO
    .map((c) => [c, (antes.match(new RegExp(`(?<![\\w-])${c.replace(/[[\]#]/g, "\\$&")}(?![\\w-])`, "g")) || []).length])
    .filter(([, n]) => n > 0);

  console.log(`${archivo}: ${cambios} reemplazos`);
  if (pendientes.length) {
    console.log(`   a revisar a mano: ${pendientes.map(([c, n]) => `${c} (${n})`).join(", ")}`);
  }

  if (!soloVer && cambios) writeFileSync(archivo, texto, "utf8");
}

if (soloVer) console.log("\n(modo --ver: no se escribió nada)");
