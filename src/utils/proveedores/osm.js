/* ============================================================
   Conector: OpenStreetMap (Overpass)
   ============================================================

   Un conector es esto: arma el pedido y convierte la respuesta en
   hallazgos con una forma común ({ externo_id, nombre, rubro, subrubro,
   dirección, teléfono, … }). La pantalla y la base no saben de dónde
   vino cada uno; para sumar otro proveedor se escribe otro archivo así.

   Qué se toma de cada comercio: solo lo que el comercio o un voluntario
   cargó en OpenStreetMap, sin completar nada. Una dirección sin número
   queda sin número; una localidad que no está, no se adivina. Lo que no
   tiene nombre no se trae: no hay a quién visitar.

   Licencia ODbL: se puede guardar y usar, citando "© colaboradores de
   OpenStreetMap". El servidor público de Overpass pide uso razonable:
   búsquedas a pedido, no barridos.
   ============================================================ */

export const OVERPASS = "https://overpass-api.de/api/interpreter";
export const ATRIBUCION = "© colaboradores de OpenStreetMap (ODbL)";

/* Qué es cada rubro de Founder en OpenStreetMap: clave de la etiqueta y
   los valores que cuentan como ese rubro (el valor es el subrubro). */
export const RUBROS_OSM = {
  almacen: { n: "Almacén, kiosco o supermercado", etiquetas: { shop: ["convenience", "supermarket", "kiosk", "greengrocer", "butcher", "bakery", "deli", "dairy", "alcohol", "beverages", "frozen_food", "pastry", "confectionery", "general", "health_food", "seafood", "cheese", "spices"] } },
  gastronomia: { n: "Gastronomía", etiquetas: { amenity: ["restaurant", "cafe", "bar", "fast_food", "ice_cream", "pub", "food_court"] } },
  peluqueria: { n: "Peluquería o barbería", etiquetas: { shop: ["hairdresser", "barber"], craft: ["hairdresser"] } },
  estetica: { n: "Centro de estética", etiquetas: { shop: ["beauty", "massage", "cosmetics", "tattoo", "nails"] } },
  pilates_gimnasio: { n: "Pilates o gimnasio", etiquetas: { leisure: ["fitness_centre", "sports_centre", "dance"], sport: ["pilates", "yoga", "fitness"] } },
  minorista: { n: "Comercio minorista", etiquetas: { shop: ["clothes", "shoes", "hardware", "doityourself", "furniture", "electronics", "mobile_phone", "toys", "books", "stationery", "gift", "pet", "optician", "jewelry", "bicycle", "variety_store", "houseware", "florist", "sports", "second_hand", "chemist", "paint", "car_parts", "fabric", "bag", "computer", "appliance", "garden_centre", "tobacco", "lottery"], amenity: ["pharmacy"] } },
  servicios: { n: "Profesional o servicios", etiquetas: { shop: ["laundry", "dry_cleaning", "copyshop", "car_repair", "tyres"], amenity: ["dentist", "doctors", "veterinary", "clinic", "driving_school"], office: ["accountant", "lawyer", "estate_agent", "insurance"] } },
};

/* El texto del pedido a Overpass. rubros: claves de RUBROS_OSM;
   subrubros: si viene, solo esos valores; centro: {lat, lng}; radio en
   metros (entre 200 y 5.000, para no pedirle de más al servidor). */
export function armarConsulta({ rubros, subrubros = [], centro, radio }) {
  if (!centro || !isFinite(centro.lat) || !isFinite(centro.lng)) throw new Error("Falta el centro de la búsqueda.");
  const r = Math.round(Math.min(5000, Math.max(200, Number(radio) || 1500)));
  const partes = [];
  for (const k of rubros) {
    const def = RUBROS_OSM[k];
    if (!def) continue;
    for (const [clave, valores] of Object.entries(def.etiquetas)) {
      const elegidos = subrubros.length ? valores.filter((v) => subrubros.includes(v)) : valores;
      if (!elegidos.length) continue;
      partes.push(`nwr["${clave}"~"^(${elegidos.join("|")})$"]["name"](around:${r},${centro.lat},${centro.lng});`);
    }
  }
  if (!partes.length) throw new Error("Elegí al menos un rubro.");
  return `[out:json][timeout:60];(${partes.join("")});out center tags;`;
}

const primero = (v) => (v ? String(v).split(";")[0].trim() || null : null);
const web = (v) => {
  const s = primero(v);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? `https://${s}` : null;
};
/* El rubro de Founder y el subrubro (el valor de OSM) de un elemento. */
export function rubroDe(tags) {
  for (const [k, def] of Object.entries(RUBROS_OSM)) {
    for (const [clave, valores] of Object.entries(def.etiquetas)) {
      if (tags[clave] && valores.includes(tags[clave])) return { rubro: k, subrubro: tags[clave] };
    }
  }
  return { rubro: null, subrubro: tags.shop || tags.amenity || tags.craft || tags.leisure || tags.office || null };
}

/* La respuesta de Overpass, como hallazgos. zona: la de la búsqueda (es
   dónde se buscó, no un dato del comercio). */
export function leerRespuesta(json, { zona = null } = {}) {
  const vistos = new Set();
  const out = [];
  for (const e of (json && json.elements) || []) {
    const t = e.tags || {};
    const nombre = (t.name || "").trim();
    if (!nombre) continue;
    const externo_id = `${e.type}/${e.id}`;
    if (vistos.has(externo_id)) continue;
    vistos.add(externo_id);
    const lat = e.lat ?? (e.center && e.center.lat), lng = e.lon ?? (e.center && e.center.lon);
    const calle = t["addr:street"] ? `${t["addr:street"]}${t["addr:housenumber"] ? ` ${t["addr:housenumber"]}` : ""}` : null;
    const { rubro, subrubro } = rubroDe(t);
    out.push({
      externo_id, nombre, rubro, subrubro, zona,
      direccion: calle, localidad: t["addr:city"] || t["addr:suburb"] || null,
      lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null,
      telefono: primero(t.phone || t["contact:phone"] || t["contact:mobile"]),
      whatsapp: primero(t["contact:whatsapp"]),
      web: web(t.website || t["contact:website"]),
      email: primero(t.email || t["contact:email"]),
      instagram: primero(t["contact:instagram"]),
      horario: t.opening_hours || null,
      /* Las etiquetas crudas, por si hace falta ver de dónde salió un dato. */
      datos: Object.fromEntries(Object.entries(t).filter(([k]) => !/^(name:|old_name|source|note|fixme)/i.test(k))),
    });
  }
  return out;
}

/* El pedido, con su error explicado: Overpass contesta 429 o 504 cuando
   está cargado, y eso no es un problema de Founder. Fuera del navegador
   hay que identificarse (agente): Overpass rechaza con 406 el agente
   genérico de node. El navegador manda el suyo y no se puede cambiar. */
export async function buscar(params, { fetch: f = fetch, zona, agente } = {}) {
  const consulta = armarConsulta(params);
  const r = await f(OVERPASS, { method: "POST", body: new URLSearchParams({ data: consulta }), headers: agente ? { "User-Agent": agente } : {} });
  if (r.status === 429) throw new Error("OpenStreetMap está recibiendo muchos pedidos: esperá un minuto y probá de nuevo.");
  if (r.status === 504) throw new Error("OpenStreetMap tardó demasiado. Probá con un radio más chico o menos rubros.");
  if (!r.ok) throw new Error(`OpenStreetMap respondió ${r.status}.`);
  const json = await r.json();
  if (json.remark && /runtime error|timed out/i.test(json.remark)) throw new Error("OpenStreetMap cortó la búsqueda por tiempo. Probá con un radio más chico.");
  return { consulta, hallazgos: leerRespuesta(json, { zona }) };
}
