/* ============================================================
   PRUEBA · el asistente de WhatsApp (api/_bot.js), sin red ni base
   ============================================================

   Con un cliente de Anthropic de mentira: lo que se le manda al modelo,
   cómo se lee lo que devuelve, cuándo se deriva sin preguntarle, y qué
   se muestra cuando falla (sobre todo, la falta de crédito).

     node scripts/probar-bot.mjs
   ============================================================ */

import Anthropic from "@anthropic-ai/sdk";
import { pideUnaPersona, armarMensajes, armarBase, conAviso, leerDecision, errorLegible, generar, ESQUEMA, REGLAS } from "../api/_bot.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };
const tira = async (fn, patron) => { try { await fn(); return false; } catch (e) { return patron.test(e.message); } };

console.log("\nPedir una persona no pasa por el modelo");
for (const t of ["PERSONA", "persona.", "Quiero hablar con una persona", "puedo hablar con alguien?", "me comunico con un asesor", "Humano!"]) {
  decir(pideUnaPersona(t), `"${t}" pide una persona`);
}
for (const t of ["hola", "¿cuánto sale por persona?", "somos cinco personas en el local", ""]) {
  decir(!pideUnaPersona(t), `"${t}" no`);
}

console.log("\nLa conversación como turnos");
const h = [
  { direccion: "saliente", tipo: "text", texto: "mensaje viejo del equipo" },
  { direccion: "entrante", tipo: "text", texto: "Hola" },
  { direccion: "entrante", tipo: "image", texto: "mi local" },
  { direccion: "saliente", tipo: "text", texto: "¡Hola! ¿Qué negocio tenés?" },
  { direccion: "entrante", tipo: "audio", texto: null },
];
const t = armarMensajes(h);
decir(t[0].role === "user" && !t.some((x) => x.content.includes("mensaje viejo")), "empieza por un mensaje de la persona: lo anterior no va");
decir(t.length === 3 && t[0].content === "Hola\n\n[mandó una imagen] mi local", "dos mensajes seguidos de la persona van en un turno, y lo que no es texto se describe");
decir(t[2].content === "[mandó un audio]", "un audio sin texto también se describe");

console.log("\nLo demás");
decir(armarBase([]) === "" && /## Qué es Genez\n\nTexto/.test(armarBase([{ titulo: "Qué es Genez", contenido: "Texto" }])), "la base se arma por documento, con su título");
decir(conAviso("Hola", "Soy el asistente.", false) === "Soy el asistente.\n\nHola" && conAviso("Hola", "Soy el asistente.", true) === "Hola", "el aviso de asistente va solo la primera vez");
decir(ESQUEMA.additionalProperties === false && ESQUEMA.properties.datos.additionalProperties === false, "el esquema es cerrado (lo exige la salida estructurada)");
decir(/no lo sabés/.test(REGLAS) && /derivar/.test(REGLAS), "las reglas dicen que no invente y cuándo derivar");

console.log("\nLeer lo que devuelve el modelo");
const resp = (obj, extra = {}) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(obj) }], usage: { input_tokens: 900, output_tokens: 80 }, ...extra });
let d = leerDecision(resp({ accion: "responder", texto: " ¡Hola! ¿Qué negocio tenés? ", motivo: "saludo", datos: { rubro: "", necesidad: "", negocio: "", quiere_demo: false } }));
decir(d.accion === "responder" && d.texto === "¡Hola! ¿Qué negocio tenés?", "una respuesta se lee, sin espacios de más");
d = leerDecision(resp({ accion: "responder", texto: "  ", motivo: "", datos: {} }));
decir(d.accion === "derivar", "responder con nada es derivar");
d = leerDecision(resp({ accion: "derivar", texto: "igual escribo algo", motivo: "pide precios", datos: {} }));
decir(d.accion === "derivar" && d.texto === "", "al derivar no se guarda texto para mandar");
decir(await tira(() => leerDecision({ stop_reason: "refusal", content: [] }), /no quiso/), "si el modelo se niega, es un error, no una respuesta");
decir(await tira(() => leerDecision({ stop_reason: "max_tokens", content: [{ type: "text", text: "{\"acc" }] }), /cortada/), "una respuesta cortada es un error");
decir(await tira(() => leerDecision(resp({ accion: "mandar_a_todos", texto: "x", motivo: "", datos: {} })), /desconocida/), "una acción inventada es un error");

console.log("\nCon un cliente de mentira");
let pedido = null;
const cliente = (respuesta) => ({ messages: { create: async (p) => { pedido = p; if (respuesta instanceof Error) throw respuesta; return respuesta; } } });
const docs = [{ titulo: "Qué es Genez", contenido: "Un sistema de gestión." }];
d = await generar({ cliente: cliente(resp({ accion: "responder", texto: "¡Hola!", motivo: "saludo", datos: { rubro: "almacén", necesidad: "", negocio: "", quiere_demo: false } })), modelo: "claude-opus-5-5", documentos: docs, historial: h });
decir(d.texto === "¡Hola!" && d.datos.rubro === "almacén" && d.uso.entrada === 900 && d.uso.salida === 80, "devuelve la decisión, lo que entendió y los tokens");
decir(pedido.model === "claude-opus-5-5" && pedido.output_config.format.type === "json_schema" && pedido.output_config.effort === "low", "pide el modelo configurado, salida con esquema y esfuerzo bajo");
decir(pedido.system[0].text === REGLAS && /Un sistema de gestión/.test(pedido.system[1].text) && pedido.system[1].cache_control, "las reglas primero, la base después y cacheada");
decir(!("tool_choice" in pedido) && !("tools" in pedido), "sin herramientas: el modelo no puede hacer nada, solo proponer");
decir(await tira(() => generar({ cliente: cliente(resp({})), modelo: "m", documentos: docs, historial: [{ direccion: "saliente", texto: "hola" }] }), /ningún mensaje/), "sin mensajes de la persona no le pregunta al modelo");

console.log("\nLos errores, en castellano");
const sinCredito = new Anthropic.BadRequestError(400, { type: "error", error: { type: "invalid_request_error", message: "Your credit balance is too low to access the Anthropic API." } }, "Your credit balance is too low to access the Anthropic API.", new Headers());
decir(/No hay crédito/.test(errorLegible(sinCredito)), "sin crédito dice que falta crédito y dónde cargarlo");
decir(/clave de Anthropic no es válida/.test(errorLegible(new Anthropic.AuthenticationError(401, {}, "invalid x-api-key", new Headers()))), "una clave mala se dice así");
decir(/limitando/.test(errorLegible(new Anthropic.RateLimitError(429, {}, "rate", new Headers()))), "el límite de pedidos también");
decir(errorLegible(new Error("otra cosa")) === "otra cosa", "y cualquier otro error, con su texto");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exit(fallas ? 1 : 0);
