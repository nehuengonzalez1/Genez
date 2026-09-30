/* ============================================================
   PRUEBA · el conector de OpenStreetMap, sin red
   ============================================================

   Arma pedidos y lee una respuesta inventada con la forma de Overpass:
   un nodo, un edificio (way, con su centro), uno sin nombre, uno
   repetido, teléfonos con varios valores y webs sin protocolo o raras.
   Con --en-vivo hace además una búsqueda real chica (gastronomía, 1 km en
   Caseros) para confirmar que Overpass sigue contestando igual.

     node scripts/probar-osm.mjs [--en-vivo]
   ============================================================ */

import { armarConsulta, leerRespuesta, rubroDe, buscar } from "../src/utils/proveedores/osm.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

console.log("\nEl pedido");
const q = armarConsulta({ rubros: ["peluqueria"], centro: { lat: -34.6, lng: -58.56 }, radio: 99999 });
decir(q.includes('["shop"~"^(hairdresser|barber)$"]') && q.includes('["craft"~"^(hairdresser)$"]') && q.includes("around:5000,"), "un rubro son varias etiquetas, y el radio no pasa de 5 km");
decir(q.includes('["name"]') && q.includes("out center tags"), "solo lo que tiene nombre, con el centro de los edificios");
decir(armarConsulta({ rubros: ["almacen"], subrubros: ["bakery"], centro: { lat: -34.6, lng: -58.56 }, radio: 50 }) === '[out:json][timeout:60];(nwr["shop"~"^(bakery)$"]["name"](around:200,-34.6,-58.56););out center tags;',
  "un subrubro achica el pedido; el radio mínimo es 200 m");
let e = null; try { armarConsulta({ rubros: [], centro: { lat: 1, lng: 1 } }); } catch (x) { e = x; }
decir(e && /rubro/.test(e.message), "sin rubros no se pide nada");

console.log("\nLa respuesta");
const r = leerRespuesta({ elements: [
  { type: "node", id: 1, lat: -34.6, lon: -58.5, tags: { name: "Panadería La Espiga", shop: "bakery", phone: "+54 11 4444-5555;011 4750-1234", "addr:street": "Avenida San Martín", "addr:housenumber": "2400", website: "laespiga.com.ar", opening_hours: "Mo-Sa 07:00-20:00" } },
  { type: "way", id: 2, center: { lat: -34.61, lon: -58.51 }, tags: { name: "Pilates Centro", leisure: "fitness_centre", "contact:instagram": "pilatescentro", website: "javascript:alert(1)" } },
  { type: "node", id: 3, lat: 0, lon: 0, tags: { shop: "kiosk" } },
  { type: "node", id: 1, lat: -34.6, lon: -58.5, tags: { name: "Panadería La Espiga", shop: "bakery" } },
  { type: "node", id: 4, lat: -34.62, lon: -58.52, tags: { name: "Ferretería X", shop: "hardware", "addr:street": "Mitre", "contact:email": "ventas@ferreteria.test", "name:en": "Hardware X" } },
] }, { zona: "caseros" });
decir(r.length === 3, `sin el que no tiene nombre ni el repetido: ${r.length}`);
const [pan, pil, fer] = r;
decir(pan.externo_id === "node/1" && pan.rubro === "almacen" && pan.subrubro === "bakery" && pan.zona === "caseros", "id del proveedor, rubro de Founder, subrubro de OSM y la zona donde se buscó");
decir(pan.telefono === "+54 11 4444-5555" && pan.direccion === "Avenida San Martín 2400" && pan.web === "https://laespiga.com.ar" && pan.horario === "Mo-Sa 07:00-20:00",
  "el primer teléfono, la dirección con número y la web con https");
decir(pil.externo_id === "way/2" && pil.lat === -34.61 && pil.rubro === "pilates_gimnasio" && pil.web === null && pil.instagram === "pilatescentro",
  "un edificio usa su centro; una web que no es web no pasa");
decir(fer.direccion === "Mitre" && fer.localidad === null && fer.email === "ventas@ferreteria.test" && !("name:en" in fer.datos),
  "una dirección sin número queda sin número y la localidad que no está no se inventa");
decir(rubroDe({ shop: "something_else" }).rubro === null, "lo que no es de ningún rubro queda sin rubro, con su tipo como subrubro");

if (process.argv.includes("--en-vivo")) {
  console.log("\nEn vivo (un pedido chico a Overpass)");
  try {
    const { hallazgos } = await buscar({ rubros: ["gastronomia"], centro: { lat: -34.607366, lng: -58.5661311 }, radio: 1000 }, { zona: "caseros", agente: "Genez-prospector/1.0 (genez.com.ar)" });
    decir(hallazgos.length > 0 && hallazgos.every((h) => h.nombre && h.externo_id.includes("/")), `Overpass contesta: ${hallazgos.length} lugares de gastronomía a 1 km del centro de Caseros`);
  } catch (x) { decir(false, `Overpass: ${x.message}`); }
}

console.log(fallas ? `\n${fallas} MAL\n` : "\nTodo bien\n");
process.exit(fallas ? 1 : 0);
