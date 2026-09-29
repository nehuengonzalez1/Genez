/* ============================================================
   CARGA · nombre y rubro del catálogo base con el modelo (0106)
   ============================================================

   Las palabras clave de src/utils/catalogo.js acertaban el rubro en el
   56% de los productos de Super 25 y dejaban sin rubro dos de cada tres
   del catálogo: en 80 mil productos siempre aparece uno que ninguna
   regla previó. Y el nombre arrastraba lo que las cadenas abrevian
   ("Rexona masc aer xtra") y la presentación repetida ("x40 gr").

   Esto le pasa a Haiku, de a cien, el texto original de SEPA y le pide
   las dos cosas. Lo que contesta queda en <tmp>/genez-sepa/modelo.json,
   por código: si se corta, sigue desde donde quedó y no se paga dos
   veces. No escribe en la base; lo usa cargar-catalogo-base.mjs.

     node scripts/clasificar-catalogo.mjs --super25   solo lo de Super 25, y mide
     node scripts/clasificar-catalogo.mjs --todo      el catálogo entero

   Necesita haber corrido antes cargar-catalogo-base.mjs (que baja SEPA)
   y ANTHROPIC_API_KEY en el .env.
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import pg from "pg";
import { normalizarEan } from "../src/utils/catalogo.js";

const MODELO = "claude-haiku-4-5-20251001";
const LOTE = 100;
const A_LA_VEZ = 4;
const RUBROS = ["Almacén", "Bebidas", "Bebidas con alcohol", "Kiosco", "Refrigerados", "Congelados", "Helados",
  "Limpieza", "Perfumería", "Mascotas", "Bazar", "Otros"];

const args = process.argv.slice(2);
const soloSuper25 = args.includes("--super25");
if (!soloSuper25 && !args.includes("--todo")) { console.log("Decí --super25 o --todo."); process.exit(1); }

const dir = join(tmpdir(), "genez-sepa");
const cache = join(dir, "catalogo.json");
const salida = join(dir, "modelo.json");
const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
if (!env.ANTHROPIC_API_KEY) { console.log("Falta ANTHROPIC_API_KEY en el .env."); process.exit(1); }
if (!existsSync(cache)) { console.log("Falta correr antes scripts/cargar-catalogo-base.mjs."); process.exit(1); }

const filas = JSON.parse(readFileSync(cache, "utf8"));
if (!filas[0] || !filas[0].original) { console.log("El catalogo.json es de antes de guardar el texto original: volvé a correr cargar-catalogo-base.mjs."); process.exit(1); }
const hechos = existsSync(salida) ? JSON.parse(readFileSync(salida, "utf8")) : {};

/* Los rubros definidos como los usa un almacén de barrio (los de Super
   25): las galletitas y los jugos en polvo son de almacén, y kiosco es
   lo que se compra para comer en el momento. */
const INSTRUCCIONES = `Sos el encargado de un almacén argentino dando de alta productos. Para cada producto te paso la descripción que publicó una cadena de supermercados, la marca y la presentación.

Devolvé, para cada uno:
- "nombre": como lo escribiría el almacén en su sistema. Tipo de producto, variedad, Marca y presentación al final. Solo la primera letra y la marca con mayúscula inicial; el resto en minúscula, con tildes. La presentación con número y unidad: "500 g", "1 kg", "250 ml", "1,5 L", "6 un". Expandí las abreviaturas de las cadenas (masc → masculino, aer → aerosol, desod → desodorante) y sacá los códigos internos que no se entienden. No repitas la presentación. No inventes nada: si la marca o el gramaje no están, no los agregues. Máximo 60 caracteres.
- "rubro": uno de estos, exactamente como está escrito:
  Almacén: secos y envasados. Fideos, arroz, harinas, aceite, yerba, té, café, azúcar, conservas, salsas, aderezos, galletitas y galletas, bizcochuelos, jugos en polvo, cereales, especias, snacks salados en paquete grande.
  Bebidas: sin alcohol y listas para tomar. Gaseosas, aguas, jugos líquidos, energizantes, isotónicas.
  Bebidas con alcohol: cervezas, vinos, aperitivos, destilados, sidras, tragos listos.
  Kiosco: golosinas. Alfajores, chocolates, caramelos, chicles, pastillas, turrones, barritas de cereal, gomitas, snacks individuales.
  Refrigerados: lácteos (leche fluida, yogur, quesos, manteca, crema, postres, flanes), tapas de empanadas y pascualina, pastas frescas, fiambres envasados, huevos.
  Congelados: hamburguesas, nuggets, vegetales y papas congeladas, comidas congeladas.
  Helados: helados de todo tipo.
  Limpieza: para limpiar la casa y la ropa. Detergentes, lavandina, jabón para ropa, suavizantes, desinfectantes, esponjas, bolsas de residuos, rollos de cocina.
  Perfumería: higiene y cuidado personal. Shampoo, jabón de tocador, desodorantes, pasta dental, toallitas, toallas femeninas, pañales, papel higiénico, afeitar, insecticidas y repelentes.
  Mascotas: alimento y accesorios para mascotas.
  Bazar: velas, fósforos, lamparitas, pilas, film, papel aluminio, carbón, descartables.
  Otros: lo que no entra en ninguno.

Contestá SOLO con un arreglo JSON, sin texto antes ni después: [{"i":0,"nombre":"...","rubro":"..."}, ...] con el mismo "i" que te pasé.`;

let entrada = 0, salidaTok = 0;

async function pedir(lote) {
  const lista = lote.map((f, i) => ({ i, descripcion: f.original.descripcion, marca: f.original.marca || "", presentacion: f.presentacion || "" }));
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODELO, max_tokens: 8000, temperature: 0, system: INSTRUCCIONES, messages: [{ role: "user", content: JSON.stringify(lista) }] }),
      });
      if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 5000 * (intento + 1))); continue; }
      const j = await r.json();
      /* Clave mala o cuenta sin crédito: reintentar no lo arregla, y
         seguir con los otros lotes solo llena la pantalla del mismo error. */
      if (r.status === 400 || r.status === 401 || r.status === 403) {
        console.log(`\nLa API no acepta el pedido: ${j.error ? j.error.message : r.status}`);
        process.exit(1);
      }
      if (!r.ok) throw new Error(j.error ? j.error.message : `HTTP ${r.status}`);
      entrada += j.usage.input_tokens; salidaTok += j.usage.output_tokens;
      const texto = j.content.map((c) => c.text || "").join("");
      const arr = JSON.parse(texto.slice(texto.indexOf("["), texto.lastIndexOf("]") + 1));
      const res = {};
      for (const x of arr) {
        const f = lote[x.i];
        if (!f || !x.nombre) continue;
        res[f.ean] = { nombre: String(x.nombre).trim().slice(0, 80), rubro: RUBROS.includes(x.rubro) ? x.rubro : null };
      }
      return res;
    } catch (e) {
      if (intento === 2) { console.log(`  un lote falló: ${e.message}`); return {}; }
    }
  }
  return {};
}

/* ---------- Qué clasificar ---------- */
let propios = [];
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
try {
  await c.query("begin read only");
  propios = (await c.query(
    "select i.nombre, i.barcode, i.categoria from items i join empresas e on e.id = i.empresa_id where e.nombre = 'Super 25' and i.activo and i.barcode ~ '^[0-9]{6,14}$'"
  )).rows;
  await c.query("rollback");
} finally { await c.end(); }

const eanPropios = new Set(propios.map((p) => normalizarEan(p.barcode)));
const elegidas = (soloSuper25 ? filas.filter((f) => eanPropios.has(f.ean)) : filas).filter((f) => !hechos[f.ean]);
console.log(`\n${elegidas.length.toLocaleString("es-AR")} productos para clasificar (${Object.keys(hechos).length.toLocaleString("es-AR")} ya estaban)`);

const lotes = [];
for (let i = 0; i < elegidas.length; i += LOTE) lotes.push(elegidas.slice(i, i + LOTE));
let hechosLotes = 0;
for (let i = 0; i < lotes.length; i += A_LA_VEZ) {
  const res = await Promise.all(lotes.slice(i, i + A_LA_VEZ).map(pedir));
  for (const r of res) Object.assign(hechos, r);
  hechosLotes += res.length;
  writeFileSync(salida, JSON.stringify(hechos));
  if (hechosLotes % 40 === 0 || hechosLotes === lotes.length) console.log(`  ${hechosLotes}/${lotes.length} lotes`);
}
const costo = (entrada / 1e6) * 1 + (salidaTok / 1e6) * 5;
console.log(`Tokens: ${entrada.toLocaleString("es-AR")} de entrada, ${salidaTok.toLocaleString("es-AR")} de salida · unos US$ ${costo.toFixed(2)}`);

/* ---------- Medir contra Super 25 ---------- */
const porEan = new Map(filas.map((f) => [f.ean, f]));
const igual = { lacteos: "Refrigerados", "higiénicos": "Perfumería", "fiambrería": "Refrigerados", inflamables: "Bazar" };
const vistos = new Set();
let conCat = 0, aciertaModelo = 0, aciertaReglas = 0;
const errados = new Map(); const errEj = []; const ejemplos = [];
for (const p of propios) {
  const ean = normalizarEan(p.barcode); if (vistos.has(ean)) continue; vistos.add(ean);
  const f = porEan.get(ean); const m = hechos[ean];
  if (!f || !m) continue;
  if (ejemplos.length < 14 && vistos.size % 70 === 1) ejemplos.push([p.nombre, f.nombre, m.nombre]);
  const suyo = p.categoria && p.categoria !== "Sin rubro" ? (igual[p.categoria.toLowerCase()] || p.categoria) : null;
  if (!suyo) continue; conCat++;
  if (f.rubro === suyo) aciertaReglas++;
  if (m.rubro === suyo) aciertaModelo++;
  else {
    const k = `${suyo} → ${m.rubro || "sin rubro"}`; errados.set(k, (errados.get(k) || 0) + 1);
    if (errEj.length < 12) errEj.push(`${k.padEnd(28)} ${p.nombre}`);
  }
}
console.log(`\nRubro contra Super 25 (${conCat} productos con rubro):`);
console.log(`  palabras clave  ${aciertaReglas} (${(100 * aciertaReglas / conCat).toFixed(1)}%)`);
console.log(`  modelo          ${aciertaModelo} (${(100 * aciertaModelo / conCat).toFixed(1)}%)`);
console.log("Lo que más erra el modelo:");
[...errados].sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
console.log("Ejemplos de lo que erra:");
errEj.forEach((x) => console.log("  " + x));
console.log("\nEl nombre (Super 25 · reglas · modelo):");
ejemplos.forEach(([a, b, m]) => console.log(`  ${a}\n      ${b}\n      ${m}`));
