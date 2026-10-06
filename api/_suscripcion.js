/**
 * La suscripción de Mercado Pago de cada comercio (0128). La atiende
 * api/founder.js, porque las 12 funciones del plan Hobby ya están usadas.
 *
 *   contratar(...)   el dueño elige plan y período; se crea la suscripción
 *                    en MP y se le devuelve el link para autorizarla.
 *   webhookMP(...)   MP avisa que la suscripción cambió o que hubo un cobro;
 *                    se le pregunta a MP cómo quedó y se escribe en la base.
 *
 * QUÉ CUENTA COMO VERDAD
 * ----------------------
 * El aviso de MP solo dice "mirá esto": trae un id, no el estado. El estado
 * se lee siempre de la API de MP con nuestro token. Así un aviso repetido,
 * fuera de orden o inventado no cambia nada que MP no diga.
 *
 * LA GRACIA
 * ---------
 * Un cobro rechazado abre 5 días de gracia: `prueba_hasta` = primer día del
 * fallo + 5, y `empresa_actual()` (0127) corta el acceso cuando vence, sin
 * otro mecanismo. Un cobro aprobado la vuelve a null. MP reintenta hasta 4
 * veces en 10 días y da de baja la suscripción después de 3 cuotas
 * rechazadas; eso llega como `cancelled` y deja el acceso hasta el último
 * día pago.
 *
 * LOS SECRETOS
 * ------------
 * MP_ACCESS_TOKEN es el de la cuenta de Genez (de Nehuen), no el de ningún
 * comercio: con él se crean las suscripciones y se leen los cobros.
 * MP_WEBHOOK_SECRET es la "clave secreta" de Webhooks del panel de MP, con
 * la que se firma cada aviso. Los dos solo en Vercel.
 */

import crypto from "node:crypto";
import { planes } from "../src/datos/presupuesto.js";

const MP = "https://api.mercadopago.com";
export const GRACIA_DIAS = 5;
const ZONA = "America/Argentina/Buenos_Aires";

export const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: ZONA });
export const masDias = (fecha, n) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const soloFecha = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONA }) : null);

export async function mp(ruta, { metodo = "GET", cuerpo } = {}) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw Object.assign(new Error("Falta MP_ACCESS_TOKEN en el servidor."), { codigo: 503 });
  const r = await fetch(`${MP}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) {
    const motivo = (datos && (datos.message || datos.error)) || `HTTP ${r.status}`;
    throw Object.assign(new Error(`Mercado Pago no aceptó el pedido: ${motivo}`), { codigo: 502, mp: datos });
  }
  return datos;
}

export async function tarifas(db) {
  const { data, error } = await db.from("tarifas").select("clave, monto");
  if (error) throw error;
  const t = Object.fromEntries((data || []).map((f) => [f.clave, f.monto == null ? null : Number(f.monto)]));
  return {
    start: t["plan:start"], pro: t["plan:pro"],
    anualMeses: t.anual_meses, incluidas: t.sucursales_incluidas, extra: t.sucursal_extra,
  };
}

/* Lo que se cobra por mes: el plan, más las sucursales de Pro que pasan
   las incluidas. Simple es para un solo local. */
export function montoMensual(t, plan, sucursales) {
  const base = plan === "start" ? t.start : t.pro;
  if (base == null) return null;
  if (plan === "start") return sucursales > 1 ? null : base;
  const extras = Math.max(0, sucursales - (t.incluidas || sucursales));
  return base + extras * (t.extra || 0);
}

/* Los módulos de un plan para el rubro del comercio, con el mismo cálculo
   que la landing y el registro. */
export async function modulosDelPlan(db, rubroClave, plan) {
  const { data: rubro } = await db.from("rubros").select("clave, nombre, modulos, presentacion").eq("clave", rubroClave).maybeSingle();
  if (!rubro) return null;
  const p = planes({ rubro }).find((x) => x.k === plan);
  return p ? p.armado.elegidos : null;
}


/* ---------- Contratar ---------- */

export async function contratar(res, db, quien, cuerpo, req) {
  const plan = cuerpo.plan === "start" || cuerpo.plan === "pro" ? cuerpo.plan : null;
  const periodo = cuerpo.periodo === "anual" ? "anual" : cuerpo.periodo === "mensual" ? "mensual" : null;
  const email = String(cuerpo.email || quien.email || "").trim().toLowerCase();
  if (!plan || !periodo) return res.status(400).json({ error: { message: "Elegí plan (Simple o Pro) y si pagás por mes o por año." } });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: { message: "Escribí el mail de tu cuenta de Mercado Pago." } });

  const { data: perfil } = await db.from("perfiles").select("rol, empresa_id").eq("id", quien.id).maybeSingle();
  if (!perfil || !perfil.empresa_id) return res.status(403).json({ error: { message: "Tu usuario no tiene un comercio." } });
  if (perfil.rol !== "dueno") return res.status(403).json({ error: { message: "La suscripción la contrata el dueño del comercio." } });
  const empresaId = perfil.empresa_id;

  const [{ data: empresa }, { count: sucursales }, { data: previa }, t] = await Promise.all([
    db.from("empresas").select("id, nombre, rubro, prueba_hasta").eq("id", empresaId).maybeSingle(),
    db.from("sucursales").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("activa", true),
    db.from("suscripciones").select("mp_id, estado").eq("empresa_id", empresaId).maybeSingle(),
    tarifas(db),
  ]);
  if (!empresa) return res.status(404).json({ error: { message: "No encontré el comercio." } });
  if (previa && (previa.estado === "activa" || previa.estado === "pausada")) {
    return res.status(409).json({ error: { message: "Ya tenés una suscripción. Para cambiarla, entrá a Ajustes → Mi cuenta." } });
  }

  const locales = Math.max(1, sucursales || 1);
  const mensual = montoMensual(t, plan, locales);
  if (mensual == null) {
    return res.status(400).json({ error: { message: plan === "start" && locales > 1
      ? "Simple es para un solo local. Con más sucursales, el plan es Pro."
      : "Todavía no hay precio cargado para ese plan." } });
  }
  const meses = periodo === "anual" ? (t.anualMeses || 12) : 1;
  const monto = mensual * meses;

  /* Si todavía está en la prueba, el primer cobro es el día siguiente al
     último de la prueba: MP cobra dentro de la hora de autorizar, y
     contratar antes no puede significar perder los días que quedan. */
  const ahora = hoy();
  const enPrueba = empresa.prueba_hasta && empresa.prueba_hasta >= ahora;
  const inicio = enPrueba ? `${masDias(empresa.prueba_hasta, 1)}T12:00:00.000-03:00` : null;

  const sitio = process.env.SITIO_URL || `https://${req.headers.host}`;
  const nombrePlan = plan === "start" ? "Simple" : "Pro";
  const pedido = {
    reason: `Genez ${nombrePlan} (${periodo}) · ${empresa.nombre}`.slice(0, 250),
    external_reference: empresaId,
    payer_email: email,
    back_url: `${sitio}/?suscripcion=volvio`,
    status: "pending",
    auto_recurring: {
      frequency: periodo === "anual" ? 12 : 1,
      frequency_type: "months",
      transaction_amount: monto,
      currency_id: "ARS",
      ...(inicio ? { start_date: inicio } : {}),
    },
  };

  try {
    /* Una pendiente vieja se cancela en MP: si la persona vuelve a elegir,
       el link anterior no tiene que poder autorizarse también. */
    if (previa && previa.mp_id && previa.estado === "pendiente") {
      await mp(`/preapproval/${previa.mp_id}`, { metodo: "PUT", cuerpo: { status: "cancelled" } }).catch(() => {});
    }
    const creada = await mp("/preapproval", { metodo: "POST", cuerpo: pedido });
    const { error } = await db.from("suscripciones").upsert({
      empresa_id: empresaId, mp_id: creada.id, plan, periodo, monto, sucursales: locales,
      payer_email: email, estado: "pendiente", pago_fallido_desde: null,
      /* Volver a contratar después de una baja empieza de cero (0130). */
      baja_codigo: null, baja_pedida_en: null, cambio_mp_id: null, cambio_plan: null, cambio_periodo: null, cambio_monto: null,
      autorizada_en: null, precio_desde: null, proximo_ajuste: null, ipc_ref_mes: null, ipc_ref: null,
      proximo_cobro: soloFecha(creada.next_payment_date) || (inicio ? inicio.slice(0, 10) : null),
      actualizada_en: new Date().toISOString(),
    }, { onConflict: "empresa_id" });
    if (error) throw error;
    return res.status(200).json({ link: creada.init_point, monto, periodo, plan });
  } catch (e) {
    console.error("contratar:", e.message, e.mp || "");
    return res.status(e.codigo || 500).json({ error: { message: e.message || "No se pudo crear la suscripción." } });
  }
}


/* ---------- Lo que avisa Mercado Pago ---------- */

/* La firma: `x-signature: ts=…,v1=…`, HMAC-SHA256 en hex con la clave
   secreta sobre `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`. El id
   va en minúscula si es alfanumérico, como pide MP. */
export function firmaDeMPValida(req, dataId, secreto) {
  const firma = String(req.headers["x-signature"] || "");
  const partes = Object.fromEntries(firma.split(",").map((p) => p.trim().split("=")).filter((p) => p.length === 2));
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  const solicitud = req.headers["x-request-id"];
  const manifiesto = `id:${id};${solicitud ? `request-id:${solicitud};` : ""}ts:${partes.ts};`;
  const esperada = crypto.createHmac("sha256", secreto).update(manifiesto).digest("hex");
  const a = Buffer.from(esperada), b = Buffer.from(String(partes.v1));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function webhookMP(req, res, db, cuerpo, query) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return res.status(503).json({ error: { message: "Falta MP_WEBHOOK_SECRET en el servidor." } });
  const tipo = cuerpo.type || query.type || query.topic;
  const dataId = query["data.id"] || (cuerpo.data && cuerpo.data.id) || query.id;
  if (!dataId) return res.status(200).json({ ignorado: "sin id" });
  if (!firmaDeMPValida(req, dataId, secreto)) return res.status(401).json({ error: { message: "Firma inválida." } });

  try {
    if (tipo === "subscription_preapproval") await alCambiarSuscripcion(db, dataId);
    else if (tipo === "subscription_authorized_payment") await alCobrar(db, dataId);
    /* Lo demás (pagos sueltos, planes) no es de acá. */
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("webhook MP:", tipo, dataId, e.message);
    /* 500 para que MP reintente: el aviso no se perdió, falló de este lado. */
    return res.status(500).json({ error: { message: e.message } });
  }
}

const ESTADO_MP = { pending: "pendiente", authorized: "activa", paused: "pausada", cancelled: "cancelada" };

async function suscripcionDe(db, mpId) {
  const { data } = await db.from("suscripciones").select("*").eq("mp_id", mpId).maybeSingle();
  return data;
}

/* El IPC nivel general del INDEC, por la API de series de datos.gob.ar:
   el último mes publicado. Lo usa también el ajuste (api/_mi_plan.js). */
export async function ipcUltimo() {
  const r = await fetch("https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&last=1&format=json");
  if (!r.ok) throw new Error(`La serie del IPC contestó ${r.status}.`);
  const datos = await r.json();
  const [mes, valor] = (datos.data || [])[0] || [];
  if (!mes || !valor) throw new Error("La serie del IPC vino vacía.");
  return { mes, valor: Number(valor) };
}

/* Seis meses de precio congelado desde que MP la autoriza (términos,
   punto 6). La base del IPC es el último mes publicado ese día; si la
   serie no contesta queda en null y el ajuste la completa después. */
export async function arrancarPrecio(db, empresaId, desde) {
  const ipc = await ipcUltimo().catch(() => null);
  const seis = new Date(`${desde}T12:00:00Z`);
  seis.setUTCMonth(seis.getUTCMonth() + 6);
  await db.from("suscripciones").update({
    precio_desde: desde, proximo_ajuste: seis.toISOString().slice(0, 10),
    ipc_ref_mes: ipc ? ipc.mes : null, ipc_ref: ipc ? ipc.valor : null,
  }).eq("empresa_id", empresaId);
}

/* Un cambio de período (0130) es otra suscripción de MP. Cuando la nueva
   se autoriza, la vieja se cancela en MP y la fila pasa a ser la nueva. */
async function completarCambio(db, s, p) {
  if (s.mp_id) await mp(`/preapproval/${s.mp_id}`, { metodo: "PUT", cuerpo: { status: "cancelled" } }).catch(() => {});
  const { data, error } = await db.from("suscripciones").update({
    mp_id: s.cambio_mp_id, plan: s.cambio_plan, periodo: s.cambio_periodo, monto: s.cambio_monto,
    cambio_mp_id: null, cambio_plan: null, cambio_periodo: null, cambio_monto: null,
    estado: "activa", pago_fallido_desde: null,
    proximo_cobro: soloFecha(p.next_payment_date) || s.proximo_cobro,
    actualizada_en: new Date().toISOString(),
  }).eq("empresa_id", s.empresa_id).select("*").single();
  if (error) throw error;
  await arrancarPrecio(db, s.empresa_id, hoy());
  return data;
}

async function alCambiarSuscripcion(db, mpId) {
  const p = await mp(`/preapproval/${mpId}`);
  let s = await suscripcionDe(db, mpId);
  if (!s) {
    /* ¿La nueva de un cambio de período? Mientras no se autoriza, cualquier
       otro estado (pendiente, cancelada desde MP) no toca nada. */
    const { data: conCambio } = await db.from("suscripciones").select("*").eq("cambio_mp_id", mpId).maybeSingle();
    if (!conCambio) return; // una suscripción que no creamos nosotros
    if (p.status !== "authorized") return;
    s = await completarCambio(db, conCambio, p);
  }
  const estado = ESTADO_MP[p.status] || s.estado;
  const proximo = soloFecha(p.next_payment_date) || s.proximo_cobro;
  await db.from("suscripciones").update({ estado, proximo_cobro: proximo, actualizada_en: new Date().toISOString() }).eq("empresa_id", s.empresa_id);

  const { data: empresa } = await db.from("empresas").select("rubro").eq("id", s.empresa_id).maybeSingle();
  if (estado === "activa") {
    /* Autorizada: el comercio pasa al plan que contrató, con sus módulos, y
       deja de estar en prueba. Si contrató durante la prueba, el primer
       cobro igual es al terminar (start_date). */
    const modulos = empresa ? await modulosDelPlan(db, empresa.rubro, s.plan) : null;
    await db.from("empresas").update({
      plan: s.plan, ...(modulos ? { modulos } : {}),
      prueba_hasta: s.pago_fallido_desde ? masDias(s.pago_fallido_desde, GRACIA_DIAS) : null,
    }).eq("id", s.empresa_id);
    if (s.plan === "start") await dejarSoloAlDueno(db, s.empresa_id);
    /* La primera autorización: desde acá corren el arrepentimiento y los
       seis meses de precio congelado. */
    if (!s.autorizada_en) {
      await db.from("suscripciones").update({ autorizada_en: new Date().toISOString() }).eq("empresa_id", s.empresa_id);
      if (!s.precio_desde) await arrancarPrecio(db, s.empresa_id, hoy());
    }
  } else if (estado === "pausada" || estado === "cancelada") {
    /* Sigue entrando hasta el último día pago; si no hay fecha, hasta hoy. */
    const hasta = proximo ? masDias(proximo, -1) : hoy();
    await db.from("empresas").update({ prueba_hasta: hasta < hoy() ? hoy() : hasta }).eq("id", s.empresa_id);
  }
  await db.rpc("suscripcion_a_founder", { p_empresa: s.empresa_id });
}

/* Simple es de un usuario (api/_planes.js), pero la prueba es Pro y ahí se
   pueden dar de alta varios. Decidido el 05/10: al contratar Simple queda
   solo el dueño y los demás se dan de baja. Baja y no borrado: quedan en
   la lista y en la bitácora (acceso.baja), y si pasa a Pro se reactivan.

   El dueño es quien se registró (pruebas.usuario_id); si no está o ya no
   es de acá, el dueño activo más antiguo. Sin ninguno de los dos no se da
   de baja a nadie: dejar un comercio pagando sin nadie que entre es peor
   que dejarle un usuario de más. */
export async function dejarSoloAlDueno(db, empresaId) {
  const { data: activos } = await db.from("perfiles").select("id, rol, creado_en")
    .eq("empresa_id", empresaId).eq("activo", true).order("creado_en", { ascending: true });
  if (!activos || activos.length <= 1) return;
  const { data: prueba } = await db.from("pruebas").select("usuario_id").eq("empresa_id", empresaId).maybeSingle();
  const registrado = prueba && activos.find((p) => p.id === prueba.usuario_id);
  const dueno = registrado || activos.find((p) => p.rol === "dueno");
  if (!dueno) return;
  const { error } = await db.from("perfiles").update({ activo: false })
    .eq("empresa_id", empresaId).eq("activo", true).neq("id", dueno.id);
  if (error) throw error;
}

async function alCobrar(db, pagoId) {
  const a = await mp(`/authorized_payments/${pagoId}`);
  const mpId = a.preapproval_id;
  const s = mpId ? await suscripcionDe(db, mpId) : null;
  if (!s) return;
  const estadoPago = a.payment && a.payment.status;
  const ahora = hoy();

  if (estadoPago === "approved") {
    await db.from("suscripciones").update({
      estado: s.estado === "pendiente" ? "activa" : s.estado,
      pago_fallido_desde: null, ultimo_pago_en: new Date().toISOString(),
      actualizada_en: new Date().toISOString(),
    }).eq("empresa_id", s.empresa_id);
    await db.from("empresas").update({ prueba_hasta: null }).eq("id", s.empresa_id);
  } else if (estadoPago === "rejected" || a.status === "recycling") {
    /* Abre la gracia una sola vez: los reintentos de MP no la estiran. */
    const desde = s.pago_fallido_desde || ahora;
    await db.from("suscripciones").update({ pago_fallido_desde: desde, actualizada_en: new Date().toISOString() }).eq("empresa_id", s.empresa_id);
    await db.from("empresas").update({ prueba_hasta: masDias(desde, GRACIA_DIAS) }).eq("id", s.empresa_id);
  } else {
    return; // en proceso: se espera el próximo aviso
  }
  await db.rpc("suscripcion_a_founder", { p_empresa: s.empresa_id });
}
