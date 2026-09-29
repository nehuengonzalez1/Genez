/* ============================================================
   CARGA · el catálogo base desde SEPA (0106)
   ============================================================

   Baja los archivos diarios de SEPA (Precios Claros), junta los códigos
   de todas las cadenas, elige la mejor descripción de cada uno, la pasa a
   como la escribiría un comercio y le pone rubro por palabras clave
   (src/utils/catalogo.js).

   Cada archivo diario pesa unos 320 MB y trae distintas cadenas: el del
   viernes 25/09 tenía 17. Por eso conviene juntar varios días. Se bajan
   de a uno a una carpeta temporal y se borran después de leerlos.

     node scripts/cargar-catalogo-base.mjs                   mide, no escribe
     node scripts/cargar-catalogo-base.mjs --dias lunes,jueves
     node scripts/cargar-catalogo-base.mjs --cache           reusa lo ya bajado
     node scripts/cargar-catalogo-base.mjs --cache --escribir

   Sin --escribir no toca la base más que para leer, en solo lectura, los
   códigos de Super 25 con los que se mide. Con --escribir carga la tabla
   en una transacción; es dato de plataforma y no pisa nada de ningún
   comercio, pero es la base de producción: avisar antes.

   Lo leído se guarda en <tmp>/genez-sepa/catalogo.json para que medir y
   escribir no obliguen a bajar dos veces los mismos 2 GB.
   ============================================================ */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, createReadStream, createWriteStream } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import pg from "pg";
import { normalizarEan, nombreProlijo, mejorDescripcion, presentacion, rubroDe } from "../src/utils/catalogo.js";

const DATASET = "6f47ec76-d1ce-4e34-a7e1-621fe9b1d0b5";
const args = process.argv.slice(2);
const opcion = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const escribir = args.includes("--escribir");
const usarCache = args.includes("--cache");
const dias = (opcion("--dias") || "lunes,martes,miercoles,jueves,viernes,sabado,domingo").split(",");

const dir = join(tmpdir(), "genez-sepa");
const cache = join(dir, "catalogo.json");
mkdirSync(dir, { recursive: true });

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

/* El tar de Windows (bsdtar) abre zips; el de Git Bash no, por eso va
   con la ruta entera. En otros sistemas, unzip. */
function descomprimir(zip, destino) {
  mkdirSync(destino, { recursive: true });
  if (process.platform === "win32") execFileSync(join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-xf", zip, "-C", destino]);
  else execFileSync("unzip", ["-q", "-o", zip, "-d", destino]);
}

const buscarCsv = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? buscarCsv(join(d, e.name)) : e.name === "productos.csv" ? [join(d, e.name)] : []);
const buscarZips = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? buscarZips(join(d, e.name)) : e.name.endsWith(".zip") ? [join(d, e.name)] : []);

/* ean → descripción → { descripcion, marca, cantidad, unidad, cadenas } */
const codigos = new Map();

async function leerCsv(archivo) {
  const rl = createInterface({ input: createReadStream(archivo, "utf8") });
  let cab = null, n = 0;
  for await (const linea of rl) {
    const c = linea.split("|");
    if (!cab) { cab = Object.fromEntries(c.map((k, i) => [k.replace(/^\uFEFF/, "").trim(), i])); continue; }
    if (c[cab.productos_ean] !== "1") continue;
    const ean = normalizarEan(c[cab.id_producto]);
    if (!/^[1-9]\d{5,13}$/.test(ean)) continue;
    const descripcion = (c[cab.productos_descripcion] || "").trim();
    if (!descripcion) continue;
    const variantes = codigos.get(ean) || codigos.set(ean, new Map()).get(ean);
    const v = variantes.get(descripcion) || variantes.set(descripcion, {
      descripcion, marca: (c[cab.productos_marca] || "").trim(),
      cantidad: c[cab.productos_cantidad_presentacion], unidad: c[cab.productos_unidad_medida_presentacion], cadenas: new Set(),
    }).get(descripcion);
    v.cadenas.add(c[cab.id_comercio]);
    n++;
  }
  return n;
}

async function bajarDia(dia, url) {
  const zip = join(dir, `sepa_${dia}.zip`);
  const carpeta = join(dir, dia);
  process.stdout.write(`  ${dia}: bajando…`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${dia}: ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(zip));
  process.stdout.write(" abriendo…");
  descomprimir(zip, carpeta);
  for (const z of buscarZips(carpeta)) { descomprimir(z, z.replace(/\.zip$/, "")); rmSync(z); }
  let filas = 0;
  const csvs = buscarCsv(carpeta);
  for (const f of csvs) filas += await leerCsv(f);
  rmSync(carpeta, { recursive: true, force: true });
  rmSync(zip, { force: true });
  console.log(` ${csvs.length} cadenas, ${filas.toLocaleString("es-AR")} filas con EAN`);
}

const titulo = (s) => String(s || "").toLocaleLowerCase("es").replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase("es"));

function armarFilas() {
  const filas = [];
  for (const [ean, variantes] of codigos) {
    const lista = [...variantes.values()].map((v) => ({ ...v, cadenas: v.cadenas.size }));
    const todas = new Set([...variantes.values()].flatMap((v) => [...v.cadenas]));
    const mejor = mejorDescripcion(lista);
    const marca = mejor.marca || (lista.find((v) => v.marca) || {}).marca || "";
    const nombre = nombreProlijo({ ...mejor, marca });
    filas.push({
      ean, nombre, marca: marca ? titulo(marca) : null,
      presentacion: presentacion(mejor.cantidad, mejor.unidad) || null,
      rubro: rubroDe(nombre), cadenas: todas.size,
    });
  }
  return filas;
}

/* ---------- Leer ---------- */
let filas;
if (usarCache && existsSync(cache)) {
  filas = JSON.parse(readFileSync(cache, "utf8"));
  console.log(`\nDesde lo ya bajado: ${filas.length.toLocaleString("es-AR")} códigos`);
} else {
  console.log("\nBajando SEPA");
  const meta = await (await fetch(`https://datos.produccion.gob.ar/api/3/action/package_show?id=${DATASET}`)).json();
  const recursos = meta.result.resources.filter((r) => /sepa_\w+\.zip$/.test(r.url || ""));
  for (const dia of dias) {
    const r = recursos.find((x) => x.url.endsWith(`sepa_${dia}.zip`));
    if (!r) { console.log(`  ${dia}: no está en el portal`); continue; }
    try { await bajarDia(dia, r.url); } catch (e) { console.log(`\n  ${dia}: ${e.message}`); }
  }
  filas = armarFilas();
  writeFileSync(cache, JSON.stringify(filas));
  console.log(`\n${filas.length.toLocaleString("es-AR")} códigos distintos · guardado en ${cache}`);
}

const conRubro = filas.filter((f) => f.rubro).length;
console.log(`Con rubro: ${conRubro.toLocaleString("es-AR")} (${Math.round(100 * conRubro / filas.length)}%) · con marca: ${filas.filter((f) => f.marca).length.toLocaleString("es-AR")}`);

/* ---------- Medir contra Super 25 ---------- */
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
try {
  await c.query("begin read only");
  const propios = (await c.query(
    "select i.nombre, i.barcode, i.categoria from items i join empresas e on e.id = i.empresa_id where e.nombre = 'Super 25' and i.activo and i.barcode ~ '^[0-9]{6,14}$'"
  )).rows;
  await c.query("rollback");
  const porEan = new Map(filas.map((f) => [f.ean, f]));
  /* Los rubros de Super 25 con otro nombre que el del catálogo. */
  const igual = { lacteos: "Refrigerados", "higiénicos": "Perfumería", "fiambrería": "Refrigerados" };
  const vistos = new Set(); let n = 0, hay = 0, conCat = 0, acierto = 0;
  const errados = new Map(); const ejemplos = [];
  for (const p of propios) {
    const ean = normalizarEan(p.barcode); if (vistos.has(ean)) continue; vistos.add(ean); n++;
    const f = porEan.get(ean); if (!f) continue; hay++;
    if (ejemplos.length < 10 && hay % 90 === 1) ejemplos.push(`${p.nombre.padEnd(40)} ${f.nombre}`);
    const suyo = p.categoria && p.categoria !== "Sin rubro" ? (igual[p.categoria.toLowerCase()] || p.categoria) : null;
    if (!suyo) continue; conCat++;
    if (f.rubro === suyo) acierto++;
    else { const k = `${suyo} → ${f.rubro || "sin rubro"}`; errados.set(k, (errados.get(k) || 0) + 1); }
  }
  console.log(`\nSuper 25: ${n} códigos · en el catálogo ${hay} (${(100 * hay / n).toFixed(1)}%)`);
  console.log(`Rubro: acierta ${acierto} de ${conCat} (${(100 * acierto / conCat).toFixed(1)}%)`);
  console.log("Lo que más erra:");
  [...errados].sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
  console.log("\nCómo queda el nombre (Super 25 · catálogo):");
  ejemplos.forEach((x) => console.log("  " + x));
} finally {
  if (!escribir) await c.end();
}

/* ---------- Escribir ---------- */
if (escribir) {
  console.log("\nEscribiendo catalogo_base");
  try {
    await c.query("begin");
    await c.query("set local lock_timeout = '3s'");
    const hay = (await c.query("select to_regclass('public.catalogo_base') t")).rows[0].t;
    if (!hay) throw new Error("falta aplicar 0106_catalogo_base.sql");
    const antes = (await c.query("select count(*)::int n from catalogo_base")).rows[0].n;
    for (let i = 0; i < filas.length; i += 2000) {
      const lote = filas.slice(i, i + 2000);
      await c.query(
        `insert into catalogo_base (ean, nombre, marca, presentacion, rubro, cadenas, actualizado_en)
         select * , now() from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::int[])
         on conflict (ean) do update set nombre = excluded.nombre, marca = excluded.marca, presentacion = excluded.presentacion,
           rubro = excluded.rubro, cadenas = excluded.cadenas, actualizado_en = excluded.actualizado_en`,
        [lote.map((f) => f.ean), lote.map((f) => f.nombre), lote.map((f) => f.marca), lote.map((f) => f.presentacion), lote.map((f) => f.rubro), lote.map((f) => f.cadenas)]
      );
    }
    const despues = (await c.query("select count(*)::int n from catalogo_base")).rows[0].n;
    await c.query("commit");
    console.log(`Listo: ${antes.toLocaleString("es-AR")} → ${despues.toLocaleString("es-AR")} códigos.`);
  } catch (e) {
    await c.query("rollback").catch(() => {});
    console.log(`No se escribió nada: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}
