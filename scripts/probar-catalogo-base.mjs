/* ============================================================
   PRUEBA · el catálogo base (0106)
   ============================================================

   Tres partes:
   - Las reglas (src/utils/catalogo.js): cómo queda el nombre, qué
     descripción se elige, el rubro.
   - La consulta (src/datos/catalogo.js), con una conexión de mentira: que
     no trabe el alta si tarda o falla, y que no recuerde un fallo.
   - La tabla: que la lea quien tiene sesión, que no la lea anon y que
     nadie la escriba desde el navegador. En una transacción que se
     deshace; si 0106 no está aplicada, la aplica adentro.

     node scripts/probar-catalogo-base.mjs
   ============================================================ */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import pg from "pg";
import { normalizarEan, presentacion, nombreProlijo, mejorDescripcion, rubroDe } from "../src/utils/catalogo.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

console.log("\nEl código");
decir(normalizarEan("0779007032207") === "779007032207" && normalizarEan("7790070322074") === "7790070322074", "sin ceros adelante");

console.log("\nLa presentación");
decir(presentacion("400", "grm") === "400 g", "400 grm → 400 g");
decir(presentacion("2250", "cmq") === "2,25 L", "2250 cm³ → 2,25 L");
decir(presentacion("1000", "grm") === "1 kg", "1000 g → 1 kg");
decir(presentacion("00500", "gr") === "500 g", "con ceros adelante");
decir(presentacion("2250", "lt") === "2,25 L", "2250 \"litros\" son mililitros: 2,25 L");
decir(presentacion("0.15", "ltr") === "150 ml" && presentacion("0.5", "kgm") === "500 g", "0,15 L → 150 ml, 0,5 kg → 500 g");
decir(presentacion("1", "uni") === "" && presentacion("6", "uni") === "6 un", "\"1 un\" no dice nada; \"6 un\" sí");
decir(presentacion("3", "xyz") === "", "una unidad que no se conoce: nada, antes que inventar");

console.log("\nEl nombre");
decir(nombreProlijo({ descripcion: "FIDEOS TIRABUZÓN PROTEÍNA PLUS MATARAZZO PAQ 400 GRM", marca: "MATARAZZO", cantidad: "400", unidad: "grm" })
  === "Fideos tirabuzón proteína plus Matarazzo 400 g", "el de la norma: sin envase, marca con mayúscula");
decir(nombreProlijo({ descripcion: "GASEOSA COCA COLA BOT 2250 CMQ", marca: "COCA COLA", cantidad: "2250", unidad: "cmq" })
  === "Gaseosa Coca Cola 2,25 L", "una marca de dos palabras");
decir(nombreProlijo({ descripcion: "ARROZ MOLTO X500G.L/F", marca: "", cantidad: "00500", unidad: "gr" })
  === "Arroz molto 500 g", "el de un sistema viejo: sin el X500G.L/F");
decir(nombreProlijo({ descripcion: "BEB ISOTONICA NARANJA BOT 1250 CMQ", marca: "GATORADE", cantidad: "1250", unidad: "cmq" })
  === "Beb isotonica naranja Gatorade 1,25 L", "la marca que no estaba en el texto se agrega antes de la presentación");
decir(nombreProlijo({ descripcion: "ESPUMA DE AFEITAR SENSITIVE GILLETTE X", marca: "GILLETTE", cantidad: "312", unidad: "grm" })
  === "Espuma de afeitar sensitive Gillette 312 g", "sin la x suelta del final");

console.log("\nLa mejor descripción");
const m = mejorDescripcion([
  { descripcion: "ARROZ MOLTO X500G.L/F", marca: "", unidad: "gr", cadenas: 1 },
  { descripcion: "ARROZ LARGO FINO MOLTO PAQ 500 GRM", marca: "MOLTO", unidad: "grm", cadenas: 1 },
]);
decir(m.marca === "MOLTO", "a igualdad de cadenas, la que trae marca y está escrita con la norma");
decir(mejorDescripcion([
  { descripcion: "A", marca: "", unidad: "", cadenas: 3 },
  { descripcion: "B", marca: "X", unidad: "grm", cadenas: 1 },
]).descripcion === "A", "pero la que usan más cadenas gana");

console.log("\nEl rubro");
const casos = [["Té verde Taragüí", "Almacén"], ["Jabón en polvo Ala", "Limpieza"], ["Jabón de tocador Dove", "Perfumería"],
  ["Cerveza Quilmes lata", "Bebidas con alcohol"], ["Agua sin gas Villavicencio", "Bebidas"], ["Ñoquis de papa", "Refrigerados"],
  ["Alfajor Jorgito triple", "Kiosco"], ["Tornillo 3/8", null]];
for (const [t, r] of casos) decir(rubroDe(t) === r, `${t} → ${r || "sin rubro"}`);

/* ---------- La consulta, sin base ---------- */
console.log("\nLa consulta");
const dir = mkdtempSync(join(tmpdir(), "genez-catalogo-"));
const falso = join(dir, "supabase-falso.js");
/* El modo va en globalThis: esbuild copia este archivo adentro del
   compilado, y sin eso la prueba cambiaría otra variable que la que lee. */
writeFileSync(falso, `
const g = globalThis.__catalogo ||= { modo: "hay", pedidos: 0 };
const fila = { ean: "7790070322074", nombre: "Fideos Matarazzo 400 g", marca: "Matarazzo", presentacion: "400 g", rubro: "Almacén" };
export const supabase = { from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle() {
  g.pedidos++;
  if (g.modo === "hay") return Promise.resolve({ data: fila, error: null });
  if (g.modo === "no") return Promise.resolve({ data: null, error: null });
  if (g.modo === "error") return Promise.resolve({ data: null, error: { message: "sin red" } });
  return new Promise(() => {});
} }) };
`);
const salida = join(dir, "catalogo.mjs");
await build({
  entryPoints: [resolve("src/datos/catalogo.js")], bundle: true, platform: "node", format: "esm", outfile: salida, logLevel: "error",
  plugins: [{ name: "falso", setup(b) { b.onResolve({ filter: /\/supabase\.js$/ }, () => ({ path: falso })); } }],
});
const { buscarEnCatalogo, rubroSugerido } = await import(pathToFileURL(salida).href);
const g = globalThis.__catalogo;

let s = await buscarEnCatalogo("7790070322074");
decir(s && s.nombre === "Fideos Matarazzo 400 g" && s.rubro === "Almacén", "un código conocido trae nombre, marca y rubro");
const antes = g.pedidos;
await buscarEnCatalogo("07790070322074");
decir(g.pedidos === antes, "el mismo código con un cero adelante no vuelve a preguntar");
decir(await buscarEnCatalogo("12") === null, "algo que no es un código no pregunta");

g.modo = "error";
decir(await buscarEnCatalogo("7791234567890") === null, "si falla, null: el alta sigue vacía");
g.modo = "no";
const n0 = g.pedidos;
decir(await buscarEnCatalogo("7791234567890") === null && g.pedidos === n0 + 1, "el fallo no se recordó: la próxima vuelve a preguntar");

g.modo = "cuelga";
const t0 = Date.now();
s = await buscarEnCatalogo("7799999999999");
const tardo = Date.now() - t0;
decir(s === null && tardo < 2500, `sin respuesta, se rinde a los ${(tardo / 1000).toFixed(1)} s`);

const sug = { rubro: "Almacén" };
decir(rubroSugerido(sug, ["Bebidas", "almacén"]) === "almacén", "el rubro va con el nombre que ya usa el comercio");
decir(rubroSugerido(sug, ["Bebidas", "Kiosco"]) === "", "si el comercio no tiene ese rubro, no se le inventa uno");
decir(rubroSugerido(sug, [null, ""]) === "Almacén", "un comercio sin rubros todavía: se pone el del catálogo");
rmSync(dir, { recursive: true, force: true });

/* ---------- La tabla ---------- */
console.log("\nLa tabla");
const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
const falla = async (sql, p) => {
  await c.query("savepoint s");
  try { await c.query(sql, p); await c.query("release savepoint s"); return null; }
  catch (e) { await c.query("rollback to savepoint s"); return e; }
};
try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  if (!(await c.query("select to_regclass('public.catalogo_base') t")).rows[0].t) {
    await c.query(readFileSync("supabase/migrations/0106_catalogo_base.sql", "utf8"));
  }
  await c.query("insert into catalogo_base (ean, nombre) values ('7790000000001', 'Prueba') on conflict do nothing");
  let e = await falla("insert into catalogo_base (ean, nombre) values ('0779000000002', 'Con cero')");
  decir(e && /catalogo_base_ean_valido/.test(e.message), "un código con cero adelante no entra: se guarda normalizado");

  const usuario = (await c.query("select id from perfiles limit 1")).rows[0].id;
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: usuario, role: "authenticated" })]);
  const r = await c.query("select nombre from catalogo_base where ean = '7790000000001'");
  decir(r.rows.length === 1, "con sesión se lee");
  e = await falla("insert into catalogo_base (ean, nombre) values ('7790000000003', 'Del navegador')");
  decir(e && /permission denied|permiso denegado/.test(e.message), "con sesión no se escribe: permiso denegado, no cero filas");
  e = await falla("update catalogo_base set nombre = 'Otro' where ean = '7790000000001'");
  decir(e && /permission denied|permiso denegado/.test(e.message), "ni se cambia");
  e = await falla("delete from catalogo_base where ean = '7790000000001'");
  decir(e && /permission denied|permiso denegado/.test(e.message), "ni se borra");
  await c.query("reset role");
  await c.query("set local role anon");
  e = await falla("select * from catalogo_base limit 1");
  decir(e && /permission denied|permiso denegado/.test(e.message), "sin sesión no se lee");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
