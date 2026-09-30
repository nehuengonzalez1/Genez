/**
 * GENEZ FOUNDER en el servidor: por ahora, WhatsApp (0120).
 *
 * UNA SOLA FUNCIÓN PARA TODO
 * --------------------------
 * El plan Hobby de Vercel deja publicar 12 funciones y esta es la número
 * 12. Por eso no hay un archivo por acción: lo que llega se reparte acá
 * según quién lo manda, sin rutas nuevas ni rewrites.
 *
 *   GET  con hub.mode           Meta verificando el webhook.
 *   POST con X-Hub-Signature-256  Meta avisando mensajes y estados.
 *   POST con Authorization      Founder: enviar, borrador, estado, registrar, suscribir.
 *
 * Lo próximo de Founder que necesite servidor va acá también, como otra
 * `accion`, hasta que el plan cambie.
 *
 * LOS SECRETOS
 * ------------
 * WHATSAPP_TOKEN (el token permanente del usuario del sistema de Meta),
 * WHATSAPP_APP_SECRET (firma los webhooks), WHATSAPP_VERIFY_TOKEN (lo
 * inventa uno y lo pega en Meta y en Vercel) y WHATSAPP_PIN (la
 * verificación en dos pasos del número) viven solo en las variables de
 * Vercel. Nunca en la base, nunca en el navegador, nunca en el repositorio.
 * Los ids del número y de la cuenta no son secretos y están en
 * interno_ajustes.
 *
 * QUIÉN ESCRIBE EN LA BASE
 * ------------------------
 * Con la service_role, y solo por las tres funciones de 0120 que la exigen.
 * Quién pidió un envío lo dice su token (quienLlama); si es del equipo con
 * el área 'mensajes' lo decide la base, no este archivo.
 */

import { createClient } from "@supabase/supabase-js";
import { origenValido, quienLlama } from "./_comun.js";
import { GRAPH, errorDeMeta, firmaValida, leerCrudo, mensajeDeTexto, verificarSuscripcion } from "./_whatsapp.js";
import Anthropic from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import { generar, pideUnaPersona, conAviso, errorLegible } from "./_bot.js";

/* En Vercel (y en Next) esto deja el cuerpo sin leer, que es lo que la
   firma necesita. */
export const config = { api: { bodyParser: false } };

const error = (res, codigo, mensaje) =>
  res.status(codigo).json({ error: { message: mensaje } });

function maestra() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ajustesWhatsapp(db) {
  const { data } = await db.from("interno_ajustes").select("valor").eq("clave", "whatsapp").maybeSingle();
  return (data && data.valor) || {};
}

async function graph(ruta, { metodo = "GET", cuerpo } = {}) {
  const r = await fetch(`${GRAPH}/${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      ...(cuerpo ? { "Content-Type": "application/json" } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  return { ok: r.ok, estado: r.status, datos };
}

export default async function handler(req, res) {
  const query = Object.fromEntries(new URL(req.url, "http://genez").searchParams);

  if (req.method === "GET") {
    const v = verificarSuscripcion(query, process.env.WHATSAPP_VERIFY_TOKEN);
    if (!v.ok) return res.status(v.codigo).send(v.motivo);
    res.setHeader("content-type", "text/plain; charset=utf-8");
    return res.status(200).send(v.desafio);
  }

  if (req.method !== "POST") return error(res, 405, "Solo GET y POST.");

  if (req.headers["x-hub-signature-256"]) return webhook(req, res);
  return accionDeFounder(req, res);
}


/* ---------- Lo que manda Meta ---------- */
async function webhook(req, res) {
  const secreto = process.env.WHATSAPP_APP_SECRET;
  /* Sin el secreto no hay cómo saber si es de Meta. Un 503 y no un 200:
     Meta reintenta hasta 7 días, y así lo que llegue mientras se carga la
     variable no se pierde. */
  if (!secreto) return error(res, 503, "Falta WHATSAPP_APP_SECRET en el servidor.");

  let crudo;
  try {
    crudo = await leerCrudo(req);
  } catch (e) {
    return error(res, e.codigo || 400, e.message);
  }
  if (!firmaValida(crudo, req.headers["x-hub-signature-256"], secreto)) {
    return error(res, 401, "Firma inválida.");
  }

  let cuerpo;
  try {
    cuerpo = JSON.parse(crudo.toString("utf8"));
  } catch {
    return error(res, 400, "El cuerpo no es JSON.");
  }

  const db = maestra();
  if (!db) return error(res, 503, "Faltan las variables de Supabase en el servidor.");

  /* Si la base no contesta, un 500: que Meta lo mande de nuevo más tarde.
     Si contesta con un error de lectura del cuerpo, 0120 ya lo guardó en
     interno_wa_eventos y devuelve bien, para que Meta no reintente algo
     que va a fallar igual. */
  const { data, error: e } = await db.rpc("interno_wa_procesar", { p_cuerpo: cuerpo });
  if (e) return error(res, 500, "No se pudo guardar el evento.");

  /* El asistente trabaja después de contestarle a Meta: Meta espera la
     respuesta pocos segundos, y un modelo puede tardar más. waitUntil
     mantiene viva la función hasta que termina. Si el asistente falla, el
     mensaje ya está guardado: lo contesta una persona. */
  const convs = (data && data.conversaciones) || [];
  if (convs.length) {
    const trabajo = Promise.allSettled(convs.map((id) => atender(db, id)));
    try { waitUntil(trabajo); } catch { /* fuera de Vercel (desarrollo) corre igual */ }
  }
  return res.status(200).json({ ok: true, evento: data && data.evento });
}


/* ---------- Lo que pide Founder ---------- */
async function accionDeFounder(req, res) {
  if (!origenValido(req)) return error(res, 403, "Origen no autorizado.");

  const quien = await quienLlama(req);
  if (!quien) return error(res, 401, "Falta la sesión.");

  let cuerpo;
  try {
    cuerpo = typeof req.body === "object" && req.body && !Buffer.isBuffer(req.body)
      ? req.body
      : JSON.parse((await leerCrudo(req, 64 * 1024)).toString("utf8") || "{}");
  } catch {
    return error(res, 400, "El cuerpo no es JSON.");
  }

  const db = maestra();
  if (!db) return error(res, 503, "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");

  switch (cuerpo.accion) {
    case "enviar": return enviar(res, db, quien, cuerpo);
    case "borrador": return pedirBorrador(res, db, quien, cuerpo);
    case "estado": return estado(req, res, db, quien);
    case "registrar":
    case "suscribir": return alta(res, db, quien, cuerpo.accion);
    default: return error(res, 400, "Acción desconocida.");
  }
}

/* Prepara en la base y manda por Meta. Lo usan una persona desde Founder
   (con su perfil) y el asistente en modo automático (perfil null: la
   base le aplica sus frenos). Devuelve { mensaje, estado, wamid?, error?,
   repetido? } o tira el error de la base, con su código. */
async function mandar(db, { perfil, conversacion, texto, idempotencia, borrador = null }) {
  /* Antes de preparar nada: sin token no sale, y un mensaje que queda en
     'enviando' para siempre confunde más que un aviso. */
  if (!process.env.WHATSAPP_TOKEN) throw Object.assign(new Error("Falta WHATSAPP_TOKEN en el servidor: todavía no se puede mandar."), { http: 503 });
  const { phone_number_id: telefono } = await ajustesWhatsapp(db);
  if (!telefono) throw Object.assign(new Error("Falta el phone_number_id en Configuración → WhatsApp."), { http: 503 });

  const { data: p, error: e } = await db.rpc("interno_wa_preparar_envio", {
    p_perfil: perfil, p_conversacion: conversacion, p_texto: texto, p_idempotencia: idempotencia, p_borrador: borrador,
  });
  if (e) throw Object.assign(new Error(e.message), { http: e.code === "42501" ? 403 : 400 });

  /* La misma clave otra vez: ese mensaje ya se mandó o se está mandando.
     No se reintenta acá, porque no hay forma de saber si el primero llegó
     a Meta; mandarlo de nuevo podría hacer que salga dos veces. */
  if (p.repetido) return { mensaje: p.mensaje, estado: p.estado, repetido: true };

  let r;
  try {
    r = await graph(`${telefono}/messages`, { metodo: "POST", cuerpo: mensajeDeTexto(p.wa_id, String(texto).trim()) });
  } catch (x) {
    r = { ok: false, estado: 0, datos: { error: { message: `No se pudo hablar con Meta: ${x.message}` } } };
  }

  const wamid = r.ok && r.datos && r.datos.messages && r.datos.messages[0] && r.datos.messages[0].id;
  const falla = wamid ? null : errorDeMeta(r.datos, r.estado);
  await db.rpc("interno_wa_resultado_envio", { p_mensaje: p.mensaje, p_wamid: wamid || null, p_error: falla });
  return falla ? { mensaje: p.mensaje, estado: "fallido", error: falla } : { mensaje: p.mensaje, estado: "enviado", wamid };
}

async function enviar(res, db, quien, { conversacion, texto, idempotencia, borrador }) {
  try {
    const r = await mandar(db, { perfil: quien.id, conversacion, texto, idempotencia, borrador: borrador || null });
    return res.status(r.error ? 502 : 200).json(r);
  } catch (e) {
    return error(res, e.http || 500, e.message);
  }
}


/* ---------- El asistente (0121) ---------- */
async function ajustesBot(db) {
  const { data } = await db.from("interno_ajustes").select("valor").eq("clave", "bot").maybeSingle();
  return (data && data.valor) || {};
}

/**
 * Le pide al asistente que atienda una conversación: arma el borrador
 * (o deriva) y, en modo automático, lo manda. `forzar` es el "Pedir
 * borrador" de Founder: corre aunque el asistente esté apagado o
 * pausado en esa conversación, y nunca manda solo.
 *
 * Nunca tira: todo lo que sale mal queda como un borrador con error,
 * que es lo que se ve en la conversación. Devuelve el id del borrador,
 * o null si no correspondía hacer nada.
 */
async function atender(db, conversacionId, { forzar = false, cliente = null } = {}) {
  const guardar = (o) => db.rpc("interno_bot_guardar", {
    p_conversacion: conversacionId, p_origen: o.origen || null, p_accion: o.accion, p_texto: o.texto || null,
    p_motivo: o.motivo || null, p_datos: o.datos || {}, p_conocimiento: o.conocimiento || [], p_modelo: o.modelo || null,
    p_uso: o.uso || null, p_error: o.error || null,
  }).then(({ data, error: e }) => { if (e) throw e; return data; });

  const bot = await ajustesBot(db);
  if (!forzar && !bot.activo) return null;

  const { data: c } = await db.from("interno_wa_conversaciones").select("*").eq("id", conversacionId).maybeSingle();
  if (!c) return null;
  const ventana = c.ultimo_entrante_en && Date.now() - new Date(c.ultimo_entrante_en).getTime() < 24 * 3600 * 1000;
  /* A quien pidió la baja no se le contesta, y fuera de la ventana no hay
     nada que se pueda mandar: un borrador ahí sería trabajo tirado. */
  if (c.consentimiento === "baja" || !ventana) return null;
  if (!forzar && c.bot_pausado) return null;

  const { data: historial } = await db.from("interno_wa_mensajes").select("id, direccion, tipo, texto, del_bot, momento")
    .eq("conversacion_id", conversacionId).order("momento", { ascending: false }).limit(30);
  const mensajes = (historial || []).reverse();
  const ultimo = mensajes[mensajes.length - 1];
  if (!ultimo || (ultimo.direccion !== "entrante" && !forzar)) return null;
  const origen = [...mensajes].reverse().find((m) => m.direccion === "entrante");

  if (origen && pideUnaPersona(origen.texto)) {
    return guardar({ origen: origen.id, accion: "derivar", motivo: "Pidió hablar con una persona." });
  }

  const { data: docs } = await db.from("interno_documentos").select("id, titulo, version, contenido")
    .eq("tipo", "base_bot").eq("estado", "vigente").is("archivado_en", null).order("titulo");
  const documentos = docs || [];
  const conocimiento = documentos.map((d) => ({ id: d.id, titulo: d.titulo, version: d.version }));
  /* Sin base, el modelo solo podría inventar. */
  if (!documentos.length) {
    return guardar({ origen: origen && origen.id, accion: "error", error: "La base del asistente está vacía: pasá al menos un documento de tipo \"Base del asistente\" a vigente." });
  }
  if (!cliente && !process.env.ANTHROPIC_API_KEY) {
    return guardar({ origen: origen && origen.id, accion: "error", error: "Falta ANTHROPIC_API_KEY en el servidor." });
  }

  const modelo = bot.modelo || "claude-opus-5-5";
  let d;
  try {
    d = await generar({ cliente: cliente || new Anthropic(), modelo, documentos, historial: mensajes });
  } catch (e) {
    return guardar({ origen: origen && origen.id, accion: "error", error: errorLegible(e), modelo, conocimiento });
  }
  const id = await guardar({ origen: origen && origen.id, ...d, conocimiento, modelo });

  if (d.accion === "responder" && !forzar && bot.activo && bot.modo === "automatico") {
    const yaSePresento = mensajes.some((m) => m.del_bot);
    try {
      await mandar(db, { perfil: null, conversacion: conversacionId, texto: conAviso(d.texto, bot.aviso, yaSePresento), idempotencia: `bot-${id}`, borrador: id });
    } catch {
      /* Si la base lo frenó (tope por hora, pausa) o Meta falló, el
         borrador queda pendiente para que lo mande una persona. */
    }
  }
  return id;
}

async function pedirBorrador(res, db, quien, { conversacion }) {
  const { data: puede } = await quien.suyo.rpc("es_interno", { p_area: "mensajes" });
  if (!puede) return error(res, 403, "Hace falta el área Conversaciones de WhatsApp.");
  try {
    const id = await atender(db, conversacion, { forzar: true });
    if (!id) return error(res, 400, "No hay nada para contestar: la ventana de 24 horas está cerrada o la persona pidió la baja.");
    const { data: b } = await db.from("interno_wa_borradores").select("*").eq("id", id).maybeSingle();
    return res.status(200).json({ borrador: b });
  } catch (e) {
    return error(res, 500, e.message);
  }
}

/* Lo que muestra Configuración → WhatsApp. De los secretos dice si están,
   jamás cuánto valen. */
async function estado(req, res, db, quien) {
  const { data: puede } = await quien.suyo.rpc("es_interno", { p_area: "config" });
  if (!puede) return error(res, 403, "Hace falta el área Configuración.");

  const aj = await ajustesWhatsapp(db);
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const salida = {
    webhook: `https://${host}/api/founder`,
    variables: {
      WHATSAPP_TOKEN: !!process.env.WHATSAPP_TOKEN,
      WHATSAPP_APP_SECRET: !!process.env.WHATSAPP_APP_SECRET,
      WHATSAPP_VERIFY_TOKEN: !!process.env.WHATSAPP_VERIFY_TOKEN,
      WHATSAPP_PIN: !!process.env.WHATSAPP_PIN,
    },
    ajustes: aj,
    numero: null,
    suscripcion: null,
  };

  const { data: ultimos } = await db.from("interno_wa_eventos")
    .select("id, recibido_en, mensajes, estados, error").order("id", { ascending: false }).limit(5);
  salida.eventos = ultimos || [];

  if (process.env.WHATSAPP_TOKEN && aj.phone_number_id) {
    try {
      const n = await graph(`${aj.phone_number_id}?fields=display_phone_number,verified_name,name_status,code_verification_status,quality_rating,platform_type,status,throughput,messaging_limit_tier`);
      salida.numero = n.ok ? n.datos : { error: errorDeMeta(n.datos, n.estado) };
    } catch (x) {
      salida.numero = { error: { message: x.message } };
    }
  }
  if (process.env.WHATSAPP_TOKEN && aj.waba_id) {
    try {
      const s = await graph(`${aj.waba_id}/subscribed_apps`);
      salida.suscripcion = s.ok ? s.datos : { error: errorDeMeta(s.datos, s.estado) };
    } catch (x) {
      salida.suscripcion = { error: { message: x.message } };
    }
  }
  return res.status(200).json(salida);
}

/* Los dos pasos que se hacen una vez al conectar el número: registrarlo
   en la Cloud API (con el PIN de dos pasos) y suscribir la app a la
   cuenta, sin lo cual Meta no manda ningún webhook. Solo el
   administrador del equipo: son sobre el número de toda la empresa. */
async function alta(res, db, quien, accion) {
  const { data: admin } = await quien.suyo.rpc("es_interno_admin");
  if (!admin) return error(res, 403, "Solo el administrador del equipo.");
  if (!process.env.WHATSAPP_TOKEN) return error(res, 503, "Falta WHATSAPP_TOKEN en el servidor.");

  const aj = await ajustesWhatsapp(db);
  let r;
  if (accion === "registrar") {
    if (!process.env.WHATSAPP_PIN) return error(res, 503, "Falta WHATSAPP_PIN en el servidor.");
    if (!aj.phone_number_id) return error(res, 503, "Falta el phone_number_id.");
    r = await graph(`${aj.phone_number_id}/register`, {
      metodo: "POST", cuerpo: { messaging_product: "whatsapp", pin: process.env.WHATSAPP_PIN },
    });
  } else {
    if (!aj.waba_id) return error(res, 503, "Falta el waba_id.");
    r = await graph(`${aj.waba_id}/subscribed_apps`, { metodo: "POST" });
  }
  if (!r.ok) return res.status(502).json({ error: errorDeMeta(r.datos, r.estado) });
  return res.status(200).json({ ok: true, respuesta: r.datos });
}
