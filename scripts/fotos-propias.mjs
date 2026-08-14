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

   Los PNG se achican acá, porque los que salen de un programa de diseño
   vienen de tres mil pixeles y un mega y medio: la carta los carga todos
   juntos al abrir la comanda. Un JPEG grande no se puede achicar sin
   decodificarlo, así que ese se avisa y se carga tal cual; para que se
   achique solo, subilo desde la ficha del producto.
   ============================================================ */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { PNG } from "pngjs";
import pg from "pg";

const CARPETA = "fotos";
const ANCHO = 220;
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
   decodificar la imagen: los cuatro bytes del IHDR alcanzan. El tipo 3
   es paleta, y ahí la transparencia viene en un trozo aparte (tRNS), así
   que hay que buscarlo. */
function medirPNG(buf) {
  if (buf.length < 26 || buf.readUInt32BE(12) !== 0x49484452) return null;
  const tipoColor = buf[25];
  const alfa = tipoColor === 4 || tipoColor === 6
    || (tipoColor === 3 && buf.includes(Buffer.from("tRNS", "ascii")));
  return { ancho: buf.readUInt32BE(16), alto: buf.readUInt32BE(20), alfa };
}

/* Achicar promediando las cajas de píxeles que caen en cada uno del
   destino. Con transparencia el promedio va premultiplicado por el alfa:
   sin eso, el color de los píxeles invisibles del borde entra en la
   cuenta y el recorte queda con un halo oscuro alrededor, que es
   exactamente lo que se nota sobre una tarjeta negra. */
function achicarPNG(buf, anchoDestino) {
  const src = PNG.sync.read(buf);
  if (src.width <= anchoDestino) return buf;

  const escala = anchoDestino / src.width;
  const dst = new PNG({ width: anchoDestino, height: Math.max(1, Math.round(src.height * escala)) });

  const porX = src.width / dst.width;
  const porY = src.height / dst.height;

  for (let y = 0; y < dst.height; y++) {
    const y0 = Math.floor(y * porY), y1 = Math.min(src.height, Math.ceil((y + 1) * porY));
    for (let x = 0; x < dst.width; x++) {
      const x0 = Math.floor(x * porX), x1 = Math.min(src.width, Math.ceil((x + 1) * porX));
      let r = 0, g = 0, b = 0, a = 0, n = 0;

      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * src.width + sx) << 2;
          const al = src.data[i + 3];
          r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al;
          a += al; n++;
        }
      }

      const j = (y * dst.width + x) << 2;
      dst.data[j]     = a ? Math.round(r / a) : 0;
      dst.data[j + 1] = a ? Math.round(g / a) : 0;
      dst.data[j + 2] = a ? Math.round(b / a) : 0;
      dst.data[j + 3] = Math.round(a / n);
    }
  }

  return PNG.sync.write(dst, { colorType: 6 });
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

const items = (await c.query(
  `select i.id, i.nombre, i.empresa_id, e.nombre as comercio
   from items i join empresas e on e.id = i.empresa_id
   order by i.nombre`)).rows;

/* Dos comercios pueden tener una hamburguesa completa cada uno. Cargarle
   la foto al del otro es de las cosas que nadie mira hasta que un cliente
   pregunta por qué su carta tiene platos ajenos, así que ante la duda no
   se elige: se avisa y se pide el comercio. */
const soloDe = (() => {
  const i = process.argv.indexOf("--comercio");
  return i > 0 ? process.argv[i + 1] : null;
})();

const candidatos = new Map();
for (const i of items) {
  if (soloDe && i.comercio.toLowerCase() !== soloDe.toLowerCase()) continue;
  const k = parecido(i.nombre);
  if (!candidatos.has(k)) candidatos.set(k, []);
  candidatos.get(k).push(i);
}

const tocados = new Set();
let puestas = 0, sinDueño = 0, pesadas = 0, ambiguas = 0;

for (const archivo of archivos.sort()) {
  const base = archivo.slice(0, -extname(archivo).length);
  const encontrados = candidatos.get(parecido(base)) || [];

  if (!encontrados.length) {
    sinDueño++;
    console.log(`  --   ${archivo}: no hay ningún producto que se llame así`);
    continue;
  }
  if (encontrados.length > 1) {
    ambiguas++;
    const comercios = [...new Set(encontrados.map((e) => e.comercio))];
    console.log(`  --   ${archivo}: hay ${encontrados.length} productos con ese nombre (${comercios.join(", ")}). Agregá --comercio "${comercios[0]}"`);
    continue;
  }

  const item = encontrados[0];
  tocados.add(item.empresa_id);

  const original = readFileSync(join(CARPETA, archivo));
  const tipo = TIPOS[extname(archivo).toLowerCase()];
  const png = tipo === "image/png" ? medirPNG(original) : null;

  const notas = [];
  let buf = original;

  if (png) {
    if (!png.alfa) notas.push("sin transparencia: se va a ver con su fondo");
    if (png.ancho > ANCHO) {
      try {
        buf = achicarPNG(original, ANCHO);
        notas.push(`${png.ancho} px → ${ANCHO}`);
      } catch (e) {
        notas.push(`no se pudo achicar (${e.message})`);
      }
    }
  }

  const kb = Math.round(buf.length / 1024);
  if (kb > TOPE_KB) {
    pesadas++;
    notas.push(png ? `${kb} KB` : `${kb} KB · un JPEG grande solo se achica subiéndolo desde la ficha`);
  }

  if (!soloVer) {
    await c.query(
      `update items set imagen = $2, campos_extra = campos_extra - 'foto' where id = $1`,
      [item.id, `data:${tipo};base64,${buf.toString("base64")}`]);
  }

  puestas++;
  const antes = Math.round(original.length / 1024);
  const peso = buf === original ? `${kb} KB` : `${antes} → ${kb} KB`;
  console.log(`  ok   ${item.nombre.padEnd(28)} ${peso.padStart(14)}  ${archivo}${notas.length ? `  · ${notas.join(" · ")}` : ""}`);
}

/* Lo que falta se lista solo de los comercios que recibieron alguna foto:
   sin eso, cargar la imagen de un bar imprime los novecientos productos
   del minimercado de al lado. */
const puestos = new Set(archivos.map((a) => parecido(a.slice(0, -extname(a).length))));
const sinFoto = items.filter((i) => tocados.has(i.empresa_id) && !puestos.has(parecido(i.nombre)));

console.log(`\n${puestas} ${soloVer ? "listas para cargar" : "cargadas"}.`);
if (sinDueño) console.log(`${sinDueño} archivo(s) sin producto que les corresponda.`);
if (ambiguas) console.log(`${ambiguas} archivo(s) con el nombre repetido en más de un comercio.`);
if (pesadas) console.log(`${pesadas} pesan más de ${TOPE_KB} KB. La carta las carga todas juntas al abrir la comanda.`);
if (sinFoto.length) {
  const comercios = [...new Set(sinFoto.map((i) => i.comercio))].join(", ");
  console.log(`\nSin foto todavía en ${comercios} (${sinFoto.length}):`);
  for (const i of sinFoto.slice(0, 30)) console.log(`  ${i.nombre}`);
  if (sinFoto.length > 30) console.log(`  …y ${sinFoto.length - 30} más`);
}

await c.end();
