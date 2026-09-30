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
 *   POST con Authorization      Founder: enviar, estado, registrar, suscribir.
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
    case "estado": return estado(req, res, db, quien);
    case "registrar":
    case "suscribir": return alta(res, db, quien, cuerpo.accion);
    default: return error(res, 400, "Acción desconocida.");
  }
}

async function enviar(res, db, quien, { conversacion, texto, idempotencia }) {
  /* Antes de preparar nada: sin token no sale, y un mensaje que queda en
     'enviando' para siempre confunde más que un aviso. */
  if (!process.env.WHATSAPP_TOKEN) return error(res, 503, "Falta WHATSAPP_TOKEN en el servidor: todavía no se puede mandar.");
  const { phone_number_id: telefono } = await ajustesWhatsapp(db);
  if (!telefono) return error(res, 503, "Falta el phone_number_id en Configuración → WhatsApp.");

  const { data: p, error: e } = await db.rpc("interno_wa_preparar_envio", {
    p_perfil: quien.id, p_conversacion: conversacion, p_texto: texto, p_idempotencia: idempotencia,
  });
  if (e) return error(res, e.code === "42501" ? 403 : 400, e.message);

  /* La misma clave otra vez: ese mensaje ya se mandó o se está mandando.
     No se reintenta acá, porque no hay forma de saber si el primero llegó
     a Meta; mandarlo de nuevo podría hacer que salga dos veces. */
  if (p.repetido) return res.status(200).json({ mensaje: p.mensaje, estado: p.estado, repetido: true });

  let r;
  try {
    r = await graph(`${telefono}/messages`, { metodo: "POST", cuerpo: mensajeDeTexto(p.wa_id, String(texto).trim()) });
  } catch (x) {
    r = { ok: false, estado: 0, datos: { error: { message: `No se pudo hablar con Meta: ${x.message}` } } };
  }

  const wamid = r.ok && r.datos && r.datos.messages && r.datos.messages[0] && r.datos.messages[0].id;
  const falla = wamid ? null : errorDeMeta(r.datos, r.estado);
  await db.rpc("interno_wa_resultado_envio", { p_mensaje: p.mensaje, p_wamid: wamid || null, p_error: falla });

  if (falla) return res.status(502).json({ mensaje: p.mensaje, estado: "fallido", error: falla });
  return res.status(200).json({ mensaje: p.mensaje, estado: "enviado", wamid });
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
