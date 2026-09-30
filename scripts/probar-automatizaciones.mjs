/* ============================================================
   PRUEBA · api/_automatizaciones.js, sin red ni base
   ============================================================

   Cómo se le pide a Meta que apruebe una plantilla, cómo se manda una,
   cómo se lee su estado y qué errores se reintentan. La parte de la base
   (la cola, los frenos, el reloj) la prueba probar-founder-auto.mjs.

     node scripts/probar-automatizaciones.mjs
   ============================================================ */

import { Readable } from "node:stream";
import { plantillaParaMeta, mensajeDePlantilla, estadoDeMeta, reintentable, textoDeError } from "../api/_automatizaciones.js";
import handler from "../api/founder.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

console.log("\nPedir la aprobación de una plantilla");
let p = plantillaParaMeta({ nombre: "recordatorio_demo", idioma: "es_AR", categoria: "UTILITY", cuerpo: "Hola {{1}}, la demo es el {{2}}.", ejemplos: ["Juan", "martes"] });
decir(p.name === "recordatorio_demo" && p.language === "es_AR" && p.category === "UTILITY", "nombre, idioma y categoría como los pide Meta");
decir(p.components[0].type === "BODY" && p.components[0].example.body_text[0][1] === "martes", "el cuerpo con sus ejemplos (una lista dentro de otra)");
p = plantillaParaMeta({ nombre: "sin_variables", idioma: "es_AR", categoria: "MARKETING", cuerpo: "Hola!", ejemplos: [] });
decir(!("example" in p.components[0]), "sin variables no va el ejemplo (Meta lo rechaza vacío)");

console.log("\nMandar una plantilla");
let m = mensajeDePlantilla("5491100000001", "recordatorio_demo", "es_AR", ["Juan", "martes"]);
decir(m.type === "template" && m.to === "5491100000001" && m.template.language.code === "es_AR", "tipo plantilla, al número y en su idioma");
decir(m.template.components[0].parameters.map((x) => x.text).join(",") === "Juan,martes", "con los valores en orden");
m = mensajeDePlantilla("5491100000001", "sin_variables", "es_AR", []);
decir(!("components" in m.template), "sin valores no manda componentes");

console.log("\nEl estado según Meta");
decir(estadoDeMeta("APPROVED") === "aprobada" && estadoDeMeta("REJECTED") === "rechazada" && estadoDeMeta("PENDING") === "enviada", "aprobada, rechazada, pendiente");
decir(estadoDeMeta("PAUSED") === "pausada" && estadoDeMeta("DISABLED") === "desactivada" && estadoDeMeta("OTRA_COSA") === null, "pausada, desactivada, y lo desconocido no pisa nada");

console.log("\nQué se reintenta");
decir(reintentable({ http: 0 }) && reintentable({ http: 503 }) && reintentable({ http: 429 }), "la red caída, un 5xx y un 429 sí");
decir(reintentable({ http: 400, code: 130429 }), "el límite de Meta sí");
decir(!reintentable({ http: 400, code: 131042 }), "un problema de pago no: reintentar no lo arregla");
decir(!reintentable({ http: 400, code: 132001 }) && !reintentable({ http: 400, code: 131026 }), "una plantilla que no existe o un número sin WhatsApp tampoco");
decir(!reintentable(null), "sin error, nada que reintentar");
decir(/medio de pago/.test(textoDeError({ code: 131042 })), "el error de pago se dice en castellano");
decir(textoDeError({ code: 1, message: "otro" }) === "otro", "uno desconocido, con su texto");

console.log("\nLa llamada del reloj");
const req = Readable.from([Buffer.from("{}")]);
Object.assign(req, { method: "POST", url: "/api/founder", headers: { "x-genez-llave": "inventada", "content-type": "application/json" } });
const res = { codigo: 200, cuerpo: null, status(n) { this.codigo = n; return this; }, json(o) { this.cuerpo = o; return this; }, send(o) { this.cuerpo = o; return this; }, setHeader() {} };
const antes = { ...process.env };
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
await handler(req, res);
Object.assign(process.env, antes);
decir(res.codigo === 503, "con llave va por el camino del reloj, no por el de Founder (sin la base, 503)");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exit(fallas ? 1 : 0);
