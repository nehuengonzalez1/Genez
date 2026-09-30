/* ============================================================
   PRUEBA · api/founder.js y api/_whatsapp.js, sin red ni base
   ============================================================

   La firma, la verificación del webhook y lo que la función contesta
   antes de llegar a la base o a Meta. Lo que pasa después (guardar,
   mandar) lo prueba probar-founder-whatsapp.mjs contra la base, y lo que
   contesta Meta solo se ve con el número conectado.

     node scripts/probar-whatsapp.mjs
   ============================================================ */

import { createHmac } from "node:crypto";
import { Readable } from "node:stream";
import { errorDeMeta, firmaValida, leerCrudo, mensajeDeTexto, verificarSuscripcion } from "../api/_whatsapp.js";
import handler from "../api/founder.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };
const firmar = (cuerpo, secreto) => "sha256=" + createHmac("sha256", secreto).update(cuerpo).digest("hex");

console.log("\nLa firma");
const SECRETO = "secreto-de-prueba";
/* Como lo manda Meta: con el acento escapado. JSON.stringify lo
   escribiría "á" y la firma no coincidiría: por eso se firma el crudo. */
const crudo = Buffer.from('{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"text":{"body":"Hola, \\u00bfcu\\u00e1nto sale?"}}]}}]}]}');
decir(firmaValida(crudo, firmar(crudo, SECRETO), SECRETO), "la firma de Meta sobre el cuerpo tal cual llegó vale");
decir(!firmaValida(Buffer.from(JSON.stringify(JSON.parse(crudo))), firmar(crudo, SECRETO), SECRETO),
  "sobre el JSON rearmado no vale: hay que firmar los bytes crudos");
decir(!firmaValida(Buffer.from(crudo.toString().replace("Hola", "Chau")), firmar(crudo, SECRETO), SECRETO), "un cuerpo cambiado no pasa");
decir(!firmaValida(crudo, firmar(crudo, "otro"), SECRETO), "con otro secreto no pasa");
decir(!firmaValida(crudo, firmar(crudo, SECRETO).slice(7), SECRETO), "sin el 'sha256=' no pasa");
decir(!firmaValida(crudo, "sha256=zz" + firmar(crudo, SECRETO).slice(9), SECRETO), "con algo que no es hexa no pasa (y no explota)");
decir(!firmaValida(crudo, "sha256=abcd", SECRETO), "con una firma corta no pasa (y no explota)");
decir(!firmaValida(crudo, firmar(crudo, SECRETO), ""), "sin secreto configurado no pasa nada");
decir(!firmaValida(crudo, undefined, SECRETO), "sin encabezado no pasa");

console.log("\nLa verificación del webhook");
const q = (o) => ({ "hub.mode": "subscribe", "hub.verify_token": "token-verif", "hub.challenge": "1158201444", ...o });
let v = verificarSuscripcion(q(), "token-verif");
decir(v.ok && v.desafio === "1158201444", "con el token correcto devuelve el challenge tal cual");
decir(verificarSuscripcion(q({ "hub.verify_token": "otro" }), "token-verif").codigo === 403, "con otro token, 403");
decir(verificarSuscripcion(q({ "hub.verify_token": "token-veri" }), "token-verif").codigo === 403, "con uno de otro largo, 403 (y no explota)");
decir(verificarSuscripcion(q({ "hub.mode": "unsubscribe" }), "token-verif").codigo === 400, "si no es subscribe, 400");
decir(verificarSuscripcion(q(), undefined).codigo === 503, "sin WHATSAPP_VERIFY_TOKEN configurado, 503");

console.log("\nLo demás");
const m = mensajeDeTexto("5491100000001", "Hola");
decir(m.messaging_product === "whatsapp" && m.to === "5491100000001" && m.type === "text" && m.text.body === "Hola" && m.text.preview_url === false,
  "el mensaje de texto tiene la forma que pide Meta");
const e = errorDeMeta({ error: { message: "(#131047) Re-engagement message", code: 131047, error_data: { details: "Pasaron más de 24 horas" } } }, 400);
decir(e.code === 131047 && e.message === "Pasaron más de 24 horas" && e.http === 400, "el error de Meta se lee con su detalle");
decir(errorDeMeta(null, 502).message === "Meta contestó 502.", "y sin cuerpo, dice qué contestó");
let grande = null;
try { await leerCrudo(Readable.from([Buffer.alloc(600), Buffer.alloc(600)]), 1000); } catch (x) { grande = x; }
decir(grande && grande.codigo === 413, "un cuerpo más grande que el límite se corta antes de leerlo entero");
decir((await leerCrudo(Readable.from([Buffer.from("ab"), Buffer.from("c")]))).toString() === "abc", "y uno normal se lee entero");

console.log("\nLa función, antes de llegar a la base");
const llamar = async ({ metodo = "POST", url = "/api/founder", headers = {}, cuerpo = "" }) => {
  const req = Readable.from(cuerpo ? [Buffer.from(cuerpo)] : []);
  Object.assign(req, { method: metodo, url, headers });
  const res = { codigo: 200, cuerpo: null, encabezados: {} };
  res.status = (n) => { res.codigo = n; return res; };
  res.json = (o) => { res.cuerpo = o; return res; };
  res.send = (o) => { res.cuerpo = o; return res; };
  res.setHeader = (k, val) => { res.encabezados[k.toLowerCase()] = val; };
  await handler(req, res);
  return res;
};
const antes = { ...process.env };
process.env.WHATSAPP_VERIFY_TOKEN = "token-verif";
process.env.WHATSAPP_APP_SECRET = SECRETO;
let r = await llamar({ metodo: "GET", url: "/api/founder?hub.mode=subscribe&hub.verify_token=token-verif&hub.challenge=42" });
decir(r.codigo === 200 && r.cuerpo === "42" && /text\/plain/.test(r.encabezados["content-type"]), "GET de Meta: contesta el challenge como texto");
r = await llamar({ metodo: "GET", url: "/api/founder?hub.mode=subscribe&hub.verify_token=mal&hub.challenge=42" });
decir(r.codigo === 403 && r.cuerpo !== "42", "con el token equivocado no lo devuelve");
r = await llamar({ headers: { "x-hub-signature-256": firmar(crudo, "otro") }, cuerpo: crudo.toString() });
decir(r.codigo === 401, "POST con una firma que no es de Meta: 401, y no toca la base");
const basura = "no es json";
r = await llamar({ headers: { "x-hub-signature-256": firmar(Buffer.from(basura), SECRETO) }, cuerpo: basura });
decir(r.codigo === 400, "firmado pero no JSON: 400");
delete process.env.WHATSAPP_APP_SECRET;
r = await llamar({ headers: { "x-hub-signature-256": firmar(crudo, SECRETO) }, cuerpo: crudo.toString() });
decir(r.codigo === 503, "sin WHATSAPP_APP_SECRET: 503, para que Meta reintente y no se pierda nada");
r = await llamar({ headers: { "content-type": "application/json" }, cuerpo: '{"accion":"enviar"}' });
decir(r.codigo === 401, "una acción de Founder sin sesión: 401");
r = await llamar({ headers: { origin: "https://otro.com", host: "genez.com.ar" }, cuerpo: '{"accion":"enviar"}' });
decir(r.codigo === 403, "desde otro origen: 403");
r = await llamar({ metodo: "PUT" });
decir(r.codigo === 405, "otro método: 405");
Object.assign(process.env, antes);

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exit(fallas ? 1 : 0);
