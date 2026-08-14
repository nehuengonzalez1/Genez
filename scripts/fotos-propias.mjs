/* ============================================================
   CARGAR LAS FOTOS DE LA CARTA DESDE UNA CARPETA
   ============================================================

   Para cuando las imágenes las trae el comercio, que es como tiene que
   ser. Se dejan los archivos en `fotos/` con el nombre del producto y
   este script los mete en el catálogo:

     fotos/Hamburguesa completa.png
     fotos/Papas fritas.png

   El nombre se compara sin tildes, sin mayúsculas y sin signos, así que
   `hamburguesa-completa.png` también encuentra a "Hamburguesa completa".

     node scripts/fotos-propias.mjs --ver   dice qué archivo va con qué
                                            producto, sin tocar nada
     node scripts/fotos-propias.mjs         las carga

   Los PNG con transparencia se guardan como PNG: pasarlos a JPEG les
   pone fondo negro, que es justo lo que un recorte viene a evitar. La
   pantalla los muestra flotando sobre la tarjeta y a las fotos con fondo
   las lleva hasta el borde.

   Acá no se achican las imágenes —Node no trae con qué—, así que el
   script avisa cuando una es grande. Para que se achique sola, cargala
   desde la ficha del producto, que lo hace en el navegador.
   ============================================================ */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import pg from "pg";

const CARPETA = "fotos";
const TOPE_KB = 120;

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const TIPOS = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/* "Hamburguesa Completa", "hamburguesa-completa" y "HAMBURGUESA_COMPLETA"
   son el mismo plato. Lo único que no se perdona es escribirlo distinto. */
const parecido = (s) => s
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]/g, "");

/* Un PNG dice su ancho y si lleva canal alfa en la cabecera, sin
   decodificar la imagen: los cuatro bytes del IHDR alcanzan. */
function medirPNG(buf) {
  if (buf.length < 26 || buf.readUInt32BE(12) !== 0x49484452) return null;
  const tipoColor = buf[25];
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20), alfa: tipoColor === 4 || tipoColor === 6 };
}

const soloVer = process.argv.includes("--ver");

if (!existsSync(CARPETA)) {
  console.error(`No existe la carpeta "${CARPETA}/". Creala y dejá ahí las imágenes, una por producto.`);
  process.exit(1);
}

const archivos = readdirSync(CARPETA).filter((f) => TIPOS[extname(f).toLowerCase()]);
if (!archivos.length) {
  console.error(`No hay imágenes en "${CARPETA}/". Se aceptan png, jpg y webp.`);
  process.exit(1);
}

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

const items = (await c.query("select id, nombre, empresa_id from items order by nombre")).rows;
const porNombre = new Map(items.map((i) => [parecido(i.nombre), i]));

let puestas = 0, sinDueño = 0, pesadas = 0;

for (const archivo of archivos.sort()) {
  const base = archivo.slice(0, -extname(archivo).length);
  const item = porNombre.get(parecido(base));

  if (!item) {
    sinDueño++;
    console.log(`  --   ${archivo}: no hay ningún producto que se llame así`);
    continue;
  }

  const buf = readFileSync(join(CARPETA, archivo));
  const tipo = TIPOS[extname(archivo).toLowerCase()];
  const kb = Math.round(buf.length / 1024);
  const png = tipo === "image/png" ? medirPNG(buf) : null;

  const notas = [];
  if (png && !png.alfa) notas.push("PNG sin transparencia: se va a ver con su fondo");
  if (png && png.ancho > 400) notas.push(`${png.ancho} px de ancho`);
  if (kb > TOPE_KB) { pesadas++; notas.push(`${kb} KB`); }

  if (!soloVer) {
    await c.query(
      `update items set imagen = $2, campos_extra = campos_extra - 'foto' where id = $1`,
      [item.id, `data:${tipo};base64,${buf.toString("base64")}`]);
  }

  puestas++;
  console.log(`  ok   ${item.nombre.padEnd(28)} ${String(kb).padStart(4)} KB  ${archivo}${notas.length ? `  · ${notas.join(" · ")}` : ""}`);
}

const sinFoto = items.filter((i) => !archivos.some((a) => parecido(a.slice(0, -extname(a).length)) === parecido(i.nombre)));

console.log(`\n${puestas} ${soloVer ? "listas para cargar" : "cargadas"}.`);
if (sinDueño) console.log(`${sinDueño} archivo(s) sin producto que les corresponda.`);
if (pesadas) console.log(`${pesadas} pesan más de ${TOPE_KB} KB. La carta las carga todas juntas: convendría achicarlas, o subirlas desde la ficha del producto, que lo hace sola.`);
if (sinFoto.length) {
  console.log(`\nSin foto todavía (${sinFoto.length}):`);
  for (const i of sinFoto) console.log(`  ${i.nombre}`);
}

await c.end();
