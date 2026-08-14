/* ============================================================
   FOTOS DE LA CARTA · datos de desarrollo
   ============================================================

   Le pone una foto a cada plato del Bar Rivadavia buscándola en
   Wikimedia Commons, que es material con licencia libre. Es una semilla
   de desarrollo: un comercio de verdad carga las fotos de su propia
   carta desde la ficha del producto.

   La foto se guarda achicada y dentro del producto, igual que cuando se
   sube desde la pantalla: se le pide a Commons la miniatura de 220 px,
   que es lo que necesita una tarjeta de 48. De dónde salió y con qué
   licencia queda en `campos_extra`, porque una foto de otro sin su
   atribución es un problema esperando.

     node scripts/fotos-carta.mjs --ver     solo busca y muestra qué eligió
     node scripts/fotos-carta.mjs           busca, baja y guarda
     node scripts/fotos-carta.mjs --borrar  deja la carta sin fotos
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

/* Qué foto va con cada plato, elegida a mano.

   La búsqueda automática no sirve para esto: pedirle "cheeseburger" a
   Commons devuelve una hamburguesa mordida arriba de un envoltorio, y
   "caesar salad" devuelve fettuccine. Una carta con esas fotos es peor
   que una carta sin fotos. Así que se eligen por archivo, mirando cada
   una, y acá queda escrito cuál es cuál.

   Todas son de Wikimedia Commons, con licencia libre. La atribución de
   cada una se guarda en el producto al cargarla. */
const FOTOS = {
  "Hamburguesa simple": "File:Hamburguesa de carne clásica y sándwich de pollo en plato floreado.jpg",
  "Hamburguesa completa": "File:Argentine chicken burger sandwich with lettuce, tomato, fried egg, and mozzarella cheese on Don Yeyo bun - Front view.jpg",
  "Hamburguesa doble": "File:Smashburger BBQ bacon cheddar burger with deep-fried onions (1).jpg",
  "Hamburguesa veggie": "File:Mushroom vegetarian burger - Grubbs.jpg",
  "Papas fritas": "File:Hesburger French fries on a plate.jpg",
  "Papas cheddar y panceta": "File:Cheese Fries and Bacon.JPG",
  "Aros de cebolla": "File:At Dot's Diner- Onion Rings.jpg",
  "Ensalada César": "File:Caesar-salad.jpg",
  "Brownie con helado": "File:Mikes brownie.jpg",
  "Flan casero": "File:Flan in Asturias.jpg",
  "Café": "File:Espresso cup and saucer, 2011.jpg",
  "Limonada jarra": "File:Home made Lemonade - Potatoast 2026-03-03.jpg",
  "Gaseosa línea Coca 500 ml": "File:Mexican Coke (11380037365) (cropped).jpg",
  "Agua mineral 500 ml": "File:Kirkland Signature Drinking Water 1.5L 20050508.jpg",
  "Cerveza artesanal pinta": "File:Glass of Marmotte Ambrée beer, Saint-Gervais-les-Bains, 2025.jpg",
  "Cerveza Quilmes 1 L": "File:Lav beer and glass - 2012-10-12 - Andy Mabbett.jpg",
  "Fernet con coca": "File:Cuba Libre 00.jpg",
  "Vino tinto copa": "File:Glass of red wine.jpg",
};

const API = "https://commons.wikimedia.org/w/api.php";
/* Wikimedia pide un identificador descriptivo y castiga las ráfagas
   anónimas. Sin `origin=*` —que es solo para pedidos desde un navegador—
   el límite es mucho más holgado: con él, dieciocho fotos tardaban diez
   minutos a fuerza de reintentos. */
const AGENTE = "Genez-semilla/1.0 (https://github.com/nehuengonzalez1; semilla de desarrollo)";

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/* Commons corta con 429 si se le pide de a ráfagas, y con dieciocho
   platos por dos consultas cada uno se llega enseguida. Se va despacio y
   se reintenta con más paciencia cada vez: es una semilla, no una
   pantalla esperando. */
async function traer(url) {
  for (let intento = 0; intento < 4; intento++) {
    const r = await fetch(url, { headers: { "User-Agent": AGENTE } });
    if (r.status !== 429) return r;
    await dormir(2000 * (intento + 1));
  }
  throw new Error("Commons sigue pidiendo que vayamos más despacio (429)");
}

const pedir = async (params) => {
  await dormir(250);
  const url = `${API}?${new URLSearchParams({ format: "json", ...params })}`;
  const r = await traer(url);
  if (!r.ok) throw new Error(`Commons contestó ${r.status}`);
  return r.json();
};

/* De un archivo elegido: su miniatura de 400 px y su atribución. */
async function leerFoto(titulo) {
  const info = await pedir({
    action: "query", titles: titulo,
    prop: "imageinfo", iiprop: "url|extmetadata|mime|size", iiurlwidth: "220",
  });

  const p = Object.values(info.query.pages || {})[0];
  const ii = p && p.imageinfo && p.imageinfo[0];
  if (!ii) return null;

  const meta = ii.extmetadata || {};
  const limpio = (v) => (v && v.value ? String(v.value).replace(/<[^>]*>/g, "").trim() : "");
  return {
    titulo,
    url: ii.thumburl,
    licencia: limpio(meta.LicenseShortName) || "ver Commons",
    autor: limpio(meta.Artist) || "desconocido",
    pagina: ii.descriptionurl,
  };
}

/* Commons ya devuelve la miniatura al ancho pedido, así que acá solo se
   envuelve como data URI: el mismo formato que deja el navegador cuando
   alguien sube una foto desde la ficha del producto. */
async function comoDataURI(url) {
  await dormir(250);
  const r = await traer(url);
  if (!r.ok) throw new Error(`no se pudo bajar (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  const tipo = r.headers.get("content-type") || "image/jpeg";
  return { uri: `data:${tipo};base64,${buf.toString("base64")}`, kb: Math.round(buf.length / 1024), buf, tipo };
}

const soloVer = process.argv.includes("--ver");
const borrar = process.argv.includes("--borrar");

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

const emp = (await c.query("select id from empresas where nombre = 'Bar Rivadavia'")).rows[0];
if (!emp) { console.error("No existe el Bar Rivadavia."); await c.end(); process.exit(1); }

if (borrar) {
  const r = await c.query(
    "update items set imagen = null, campos_extra = campos_extra - 'foto' where empresa_id = $1 and imagen is not null", [emp.id]);
  console.log(`Se sacaron ${r.rowCount} fotos.`);
  await c.end();
  process.exit(0);
}

const items = (await c.query(
  "select id, nombre from items where empresa_id = $1 order by categoria, nombre", [emp.id])).rows;

if (soloVer) mkdirSync("fotos-elegidas", { recursive: true });

let puestas = 0, pesoTotal = 0;
for (const it of items) {
  const archivo = FOTOS[it.nombre];
  if (!archivo) { console.log(`  --   ${it.nombre}: sin foto elegida`); continue; }

  try {
    const foto = await leerFoto(archivo);
    if (!foto) { console.log(`  --   ${it.nombre}: Commons no encontró ${archivo}`); continue; }

    const { uri, kb, buf, tipo } = await comoDataURI(foto.url);
    pesoTotal += kb;

    if (soloVer) {
      const ext = tipo.includes("png") ? "png" : "jpg";
      writeFileSync(`fotos-elegidas/${it.nombre.replace(/[^\wáéíóúñ ]/gi, "")}.${ext}`, buf);
    } else {
      await c.query(
        `update items set imagen = $2,
           campos_extra = campos_extra || jsonb_build_object('foto',
             jsonb_build_object('archivo', $3::text, 'licencia', $4::text, 'autor', $5::text, 'pagina', $6::text))
         where id = $1`,
        [it.id, uri, foto.titulo, foto.licencia, foto.autor, foto.pagina]);
    }

    puestas++;
    console.log(`  ok   ${it.nombre.padEnd(28)} ${String(kb).padStart(3)} KB  ${foto.titulo}  [${foto.licencia}]`);
  } catch (e) {
    console.log(`  MAL  ${it.nombre}: ${e.message}`);
  }
}

console.log(`\n${puestas} fotos, ${pesoTotal} KB en total.${soloVer ? " (solo vistas, en fotos-elegidas/)" : ""}`);
await c.end();
