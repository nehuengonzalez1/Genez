/**
 * Mi plan (0130): lo que los términos del 05/10 prometen después de
 * contratar. Lo atiende api/founder.js, por el mismo límite de 12
 * funciones del plan Hobby que explica api/_suscripcion.js.
 *
 *   cambiarPlan(...)       el dueño pasa a otro plan o a otro período.
 *   darDeBaja(...)         el dueño se da de baja; recibe un código.
 *   pedirArrepentimiento   el botón de la Res. 424/2020: sin sesión.
 *   resolverArrepentimiento la plataforma lo resuelve: cancela y devuelve.
 *   tareasDiarias(...)     el cron: ajuste por IPC y borrado a los 90 días.
 *
 * CAMBIAR DE PLAN
 * ---------------
 * El plan nuevo rige ya y su precio se cobra desde el próximo cobro: no se
 * cobran ni devuelven diferencias por días (términos, punto 7). Mismo
 * período: se cambia el monto de la suscripción vigente en MP (PUT
 * /preapproval/{id}). Otro período: MP no cambia la frecuencia de una
 * suscripción, así que se crea otra que arranca en el próximo cobro y,
 * cuando se autoriza, reemplaza a la vieja (completarCambio, en
 * _suscripcion.js). El precio del plan nuevo es el de lista de ese día, y
 * vuelve a quedar congelado seis meses: es "el precio publicado al momento
 * de contratar".
 *
 * EL ARREPENTIMIENTO NO SE RESUELVE SOLO
 * --------------------------------------
 * El formulario no pide sesión (la Res. 424/2020 lo prohíbe), así que
 * cualquiera que sepa el mail de un dueño podría cortarle el servicio y
 * hacerle devolver la plata. Se anota, se da el código en el momento y la
 * plataforma lo resuelve desde Pruebas gratis, con un clic que cancela en
 * MP y devuelve cada cobro aprobado de esa suscripción.
 *
 * EL AJUSTE POR IPC
 * -----------------
 * Al primer cobro en `proximo_ajuste` o después. Se hace entre 12 y 10
 * días antes de ese cobro: los términos prometen avisar con 10 días, así
 * que si el cron no corrió a tiempo el ajuste espera al cobro siguiente en
 * vez de avisar tarde. El factor es IPC del último mes publicado sobre el
 * de referencia (el último publicado cuando arrancó el precio), y el monto
 * se redondea a la centena.
 */

import crypto from "node:crypto";
import { mp, tarifas, montoMensual, modulosDelPlan, dejarSoloAlDueno, arrancarPrecio, ipcUltimo, hoy, masDias } from "./_suscripcion.js";
import { mandar, escapar } from "./_pruebas.js";

const error = (res, codigo, message) => res.status(codigo).json({ error: { message } });
const NOMBRE = { start: "Simple", pro: "Pro" };
const plata = (n) => `$ ${Math.round(Number(n)).toLocaleString("es-AR")}`;
const diaLindo = (f) => (f ? f.split("-").reverse().join("/") : "");

const sumarMeses = (fecha, n) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

/* Un código que se pueda dictar por teléfono: sin 0/O ni 1/I. */
function codigo(prefijo) {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(8);
  return `${prefijo}-${[...bytes].map((b) => letras[b % letras.length]).join("")}`;
}

/* Sin RESEND_API_KEY no sale nada y no se corta nada: el código igual se
   mostró en pantalla, que es el mismo medio por el que se pidió. */
async function avisar(para, asunto, parrafos) {
  if (!process.env.RESEND_API_KEY || !para) return false;
  const texto = `${parrafos.join("\n\n")}\n\nGenez`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1c1917;max-width:520px">
${parrafos.map((p) => `<p>${escapar(p)}</p>`).join("\n")}
<p style="color:#78716c;font-size:13px">Genez · Sistema de gestión para comercios</p>
</div>`;
  try {
    await mandar({ para, asunto, texto, html });
    return true;
  } catch (e) {
    console.error("mail:", asunto, e.message);
    return false;
  }
}

async function elDueno(db, quien) {
  const { data: perfil } = await db.from("perfiles").select("rol, empresa_id").eq("id", quien.id).maybeSingle();
  if (!perfil || !perfil.empresa_id) return { falla: [403, "Tu usuario no tiene un comercio."] };
  if (perfil.rol !== "dueno") return { falla: [403, "El plan lo cambia el dueño del comercio."] };
  return { empresaId: perfil.empresa_id };
}


/* ---------- Cambiar de plan ---------- */

export async function cambiarPlan(res, db, quien, cuerpo, req) {
  const plan = cuerpo.plan === "start" || cuerpo.plan === "pro" ? cuerpo.plan : null;
  const periodo = cuerpo.periodo === "anual" ? "anual" : cuerpo.periodo === "mensual" ? "mensual" : null;
  if (!plan || !periodo) return error(res, 400, "Elegí plan (Simple o Pro) y si pagás por mes o por año.");

  const d = await elDueno(db, quien);
  if (d.falla) return error(res, ...d.falla);
  const empresaId = d.empresaId;

  const [{ data: s }, { data: empresa }, { count: sucursales }, t] = await Promise.all([
    db.from("suscripciones").select("*").eq("empresa_id", empresaId).maybeSingle(),
    db.from("empresas").select("id, nombre, rubro").eq("id", empresaId).maybeSingle(),
    db.from("sucursales").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("activa", true),
    tarifas(db),
  ]);
  if (!s || s.estado !== "activa") return error(res, 409, "Para cambiar de plan primero tenés que tener una suscripción activa.");
  if (plan === s.plan && periodo === s.periodo) return error(res, 400, `Ya estás en ${NOMBRE[plan]}, ${periodo}.`);

  const locales = Math.max(1, sucursales || 1);
  const mensual = montoMensual(t, plan, locales);
  if (mensual == null) {
    return error(res, 400, plan === "start" && locales > 1
      ? "Simple es para un solo local. Con más sucursales, el plan es Pro."
      : "Todavía no hay precio cargado para ese plan.");
  }
  const monto = mensual * (periodo === "anual" ? (t.anualMeses || 12) : 1);

  try {
    /* Un cambio de período anterior que no se autorizó se descarta. */
    if (s.cambio_mp_id) {
      await mp(`/preapproval/${s.cambio_mp_id}`, { metodo: "PUT", cuerpo: { status: "cancelled" } }).catch(() => {});
      await db.from("suscripciones").update({ cambio_mp_id: null, cambio_plan: null, cambio_periodo: null, cambio_monto: null }).eq("empresa_id", empresaId);
    }

    if (periodo === s.periodo) {
      await mp(`/preapproval/${s.mp_id}`, {
        metodo: "PUT",
        cuerpo: {
          reason: `Genez ${NOMBRE[plan]} (${periodo}) · ${empresa.nombre}`.slice(0, 250),
          auto_recurring: { transaction_amount: monto, currency_id: "ARS" },
        },
      });
      const { error: e1 } = await db.from("suscripciones").update({
        plan, monto, sucursales: locales, actualizada_en: new Date().toISOString(),
      }).eq("empresa_id", empresaId);
      if (e1) throw e1;
      await arrancarPrecio(db, empresaId, hoy());
      const modulos = await modulosDelPlan(db, empresa.rubro, plan);
      const { error: e2 } = await db.from("empresas").update({ plan, ...(modulos ? { modulos } : {}) }).eq("id", empresaId);
      if (e2) throw e2;
      if (plan === "start") await dejarSoloAlDueno(db, empresaId);
      await db.rpc("suscripcion_a_founder", { p_empresa: empresaId });
      return res.status(200).json({ ok: true, plan, periodo, monto, desde: s.proximo_cobro });
    }

    /* Otro período: una suscripción nueva que arranca cuando termina lo
       que ya está pago, para no cobrar dos veces el mismo tiempo. */
    const ahora = hoy();
    const inicio = s.proximo_cobro && s.proximo_cobro > ahora ? `${s.proximo_cobro}T12:00:00.000-03:00` : null;
    const sitio = process.env.SITIO_URL || `https://${req.headers.host}`;
    const creada = await mp("/preapproval", {
      metodo: "POST",
      cuerpo: {
        reason: `Genez ${NOMBRE[plan]} (${periodo}) · ${empresa.nombre}`.slice(0, 250),
        external_reference: empresaId,
        payer_email: s.payer_email,
        back_url: `${sitio}/?suscripcion=volvio`,
        status: "pending",
        auto_recurring: {
          frequency: periodo === "anual" ? 12 : 1,
          frequency_type: "months",
          transaction_amount: monto,
          currency_id: "ARS",
          ...(inicio ? { start_date: inicio } : {}),
        },
      },
    });
    const { error: e3 } = await db.from("suscripciones").update({
      cambio_mp_id: creada.id, cambio_plan: plan, cambio_periodo: periodo, cambio_monto: monto,
      actualizada_en: new Date().toISOString(),
    }).eq("empresa_id", empresaId);
    if (e3) throw e3;
    return res.status(200).json({ link: creada.init_point, plan, periodo, monto, desde: inicio ? inicio.slice(0, 10) : ahora });
  } catch (e) {
    console.error("cambiarPlan:", e.message, e.mp || "");
    return error(res, e.codigo || 500, e.message || "No se pudo cambiar el plan.");
  }
}


/* ---------- La baja ---------- */

export async function darDeBaja(res, db, quien) {
  const d = await elDueno(db, quien);
  if (d.falla) return error(res, ...d.falla);
  const empresaId = d.empresaId;

  const [{ data: s }, { data: empresa }] = await Promise.all([
    db.from("suscripciones").select("*").eq("empresa_id", empresaId).maybeSingle(),
    db.from("empresas").select("nombre, prueba_hasta").eq("id", empresaId).maybeSingle(),
  ]);
  if (!s || s.estado === "cancelada") return error(res, 409, "No tenés una suscripción para dar de baja.");

  try {
    /* Primero MP: si no se puede cancelar allá, no se dice "listo" acá,
       porque seguiría cobrando. */
    await mp(`/preapproval/${s.mp_id}`, { metodo: "PUT", cuerpo: { status: "cancelled" } });
    if (s.cambio_mp_id) await mp(`/preapproval/${s.cambio_mp_id}`, { metodo: "PUT", cuerpo: { status: "cancelled" } }).catch(() => {});

    const ahora = hoy();
    const cod = codigo("B");
    /* Hasta el último día pago. Una suscripción que nunca se autorizó no
       cobró nada: la prueba sigue hasta su día, sin tocarla. */
    let hasta = null;
    if (s.estado !== "pendiente") {
      hasta = s.proximo_cobro ? masDias(s.proximo_cobro, -1) : ahora;
      if (hasta < ahora) hasta = ahora;
    }
    const { error: e1 } = await db.from("suscripciones").update({
      estado: "cancelada", baja_codigo: cod, baja_pedida_en: new Date().toISOString(),
      cambio_mp_id: null, cambio_plan: null, cambio_periodo: null, cambio_monto: null,
      actualizada_en: new Date().toISOString(),
    }).eq("empresa_id", empresaId);
    if (e1) throw e1;
    if (hasta) {
      const { error: e2 } = await db.from("empresas").update({ prueba_hasta: hasta }).eq("id", empresaId);
      if (e2) throw e2;
    }
    await db.rpc("suscripcion_a_founder", { p_empresa: empresaId });

    const usaHasta = hasta || empresa.prueba_hasta;
    const parrafos = [
      `Diste de baja la suscripción de Genez de ${empresa.nombre}. Tu código de baja es ${cod}.`,
      usaHasta ? `Seguís usando el sistema hasta el ${diaLindo(usaHasta)}. No se te va a cobrar nada más.` : "No se te va a cobrar nada más.",
      "Tus datos quedan guardados 90 días por si volvés. Para volver a contratar, entrá y tocá Contratar.",
    ];
    const destinos = [...new Set([quien.email, s.payer_email].filter(Boolean))];
    for (const para of destinos) await avisar(para, `Baja de Genez · código ${cod}`, parrafos);

    return res.status(200).json({ codigo: cod, hasta: usaHasta });
  } catch (e) {
    console.error("darDeBaja:", e.message, e.mp || "");
    return error(res, e.codigo || 500, e.message || "No se pudo dar de baja.");
  }
}


/* ---------- El botón de arrepentimiento ---------- */

const corto = (v, n) => String(v || "").trim().slice(0, n);

export async function pedirArrepentimiento(res, db, cuerpo) {
  const nombre = corto(cuerpo.nombre, 120);
  const email = corto(cuerpo.email, 200).toLowerCase();
  if (!nombre) return error(res, 400, "Falta tu nombre.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error(res, 400, "Falta un mail válido.");

  /* El campo que una persona no ve: si viene lleno es un robot. Se le
     contesta como si nada para que no aprenda a esquivarlo. */
  if (corto(cuerpo.sitio, 200)) return res.status(200).json({ codigo: codigo("A") });

  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db.from("arrepentimientos").select("id", { count: "exact", head: true })
    .eq("email", email).gte("creado_en", desde);
  if ((count || 0) >= 3) return error(res, 429, "Ya recibimos tus pedidos de hoy. Te escribimos a la brevedad.");

  /* De qué comercio es, si se puede saber: el dueño con ese mail o el
     mail de la suscripción. Es una pista para quien lo resuelve. */
  let empresaId = null;
  const { data: dueno } = await db.from("perfiles").select("empresa_id").eq("email", email).eq("rol", "dueno").limit(1);
  if (dueno && dueno.length) empresaId = dueno[0].empresa_id;
  if (!empresaId) {
    const { data: sus } = await db.from("suscripciones").select("empresa_id").eq("payer_email", email).limit(1);
    if (sus && sus.length) empresaId = sus[0].empresa_id;
  }

  const cod = codigo("A");
  const { error: e } = await db.from("arrepentimientos").insert({
    codigo: cod, nombre, email, empresa_id: empresaId,
    comercio: corto(cuerpo.comercio, 120) || null, telefono: corto(cuerpo.telefono, 40) || null, motivo: corto(cuerpo.motivo, 1000) || null,
  });
  if (e) {
    console.error("arrepentimiento:", e.message);
    return error(res, 500, "No se pudo guardar el pedido.");
  }

  await avisar(email, `Recibimos tu arrepentimiento · código ${cod}`, [
    `${nombre.split(" ")[0]}, recibimos tu pedido de revocar la contratación de Genez. Tu código de arrepentimiento es ${cod}.`,
    "Damos de baja la suscripción y te devolvemos lo que se haya cobrado por el mismo medio de pago. Te escribimos cuando esté hecho.",
  ]);
  if (process.env.AVISOS_EMAIL) {
    await avisar(process.env.AVISOS_EMAIL, `Arrepentimiento ${cod}`, [
      `${nombre} (${email}) pidió el arrepentimiento${cuerpo.comercio ? ` de ${corto(cuerpo.comercio, 120)}` : ""}.`,
      "Resolverlo en el panel de la plataforma → Pruebas gratis.",
    ]);
  }
  return res.status(200).json({ codigo: cod });
}

/* La plataforma lo resuelve: cancela en MP, devuelve cada cobro aprobado
   de la suscripción y corta el acceso hoy. "descartar" es para un pedido
   que no corresponde (duplicado, de alguien que no contrató). */
export async function resolverArrepentimiento(res, db, quien, { id, decision, nota }) {
  if (!quien.es_plataforma) return error(res, 403, "Solo la plataforma.");
  const { data: a } = await db.from("arrepentimientos").select("*").eq("id", id).maybeSingle();
  if (!a) return error(res, 404, "No existe ese pedido.");
  if (a.estado !== "recibido") return error(res, 409, "Ese pedido ya está resuelto.");

  if (decision === "descartar") {
    await db.from("arrepentimientos").update({ estado: "descartado", resuelto_en: new Date().toISOString(), nota: corto(nota, 500) || null }).eq("id", id);
    return res.status(200).json({ ok: true });
  }

  const devueltos = [];
  try {
    const { data: s } = a.empresa_id
      ? await db.from("suscripciones").select("*").eq("empresa_id", a.empresa_id).maybeSingle()
      : { data: null };
    if (s) {
      if (s.estado !== "cancelada") await mp(`/preapproval/${s.mp_id}`, { metodo: "PUT", cuerpo: { status: "cancelled" } });
      if (s.cambio_mp_id) await mp(`/preapproval/${s.cambio_mp_id}`, { metodo: "PUT", cuerpo: { status: "cancelled" } }).catch(() => {});

      const cobros = await mp(`/authorized_payments/search?preapproval_id=${s.mp_id}`);
      for (const c of (cobros && cobros.results) || []) {
        const pago = c.payment || {};
        if (pago.status !== "approved" || !pago.id) continue;
        await mpConClave(`/v1/payments/${pago.id}/refunds`, `arrepentimiento-${a.id}-${pago.id}`);
        devueltos.push({ pago: pago.id, monto: c.transaction_amount });
      }

      await db.from("suscripciones").update({
        estado: "cancelada", cambio_mp_id: null, cambio_plan: null, cambio_periodo: null, cambio_monto: null,
        actualizada_en: new Date().toISOString(),
      }).eq("empresa_id", a.empresa_id);
      await db.from("empresas").update({ prueba_hasta: hoy() }).eq("id", a.empresa_id);
      await db.rpc("suscripcion_a_founder", { p_empresa: a.empresa_id });
    }

    const resumen = devueltos.length
      ? `Devuelto: ${devueltos.map((x) => plata(x.monto)).join(", ")}.`
      : s ? "No había cobros para devolver." : "Sin comercio asociado: no había nada que cancelar.";
    await db.from("arrepentimientos").update({
      estado: "resuelto", resuelto_en: new Date().toISOString(), nota: [resumen, corto(nota, 400)].filter(Boolean).join(" "),
    }).eq("id", id);

    await avisar(a.email, `Arrepentimiento resuelto · código ${a.codigo}`, [
      `${a.nombre.split(" ")[0]}, revocamos la contratación de Genez (código ${a.codigo}).`,
      devueltos.length
        ? `Te devolvimos ${devueltos.map((x) => plata(x.monto)).join(" y ")} por el mismo medio de pago. Según el medio, puede tardar unos días en verse.`
        : "No se te había cobrado nada, así que no hay nada que devolver.",
    ]);
    return res.status(200).json({ ok: true, devueltos, resumen });
  } catch (e) {
    console.error("resolverArrepentimiento:", e.message, e.mp || "");
    /* Lo que se devolvió antes del error queda anotado: no se devuelve dos
       veces al reintentar (además MP lo frena por la clave de idempotencia). */
    if (devueltos.length) {
      await db.from("arrepentimientos").update({ nota: `A medias: devuelto ${devueltos.map((x) => x.pago).join(", ")}. Error: ${e.message}` }).eq("id", id);
    }
    return error(res, e.codigo || 500, e.message || "No se pudo resolver.");
  }
}

/* La devolución lleva clave de idempotencia: si se reintenta, MP no
   devuelve dos veces el mismo pago. */
async function mpConClave(ruta, clave) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw Object.assign(new Error("Falta MP_ACCESS_TOKEN en el servidor."), { codigo: 503 });
  const r = await fetch(`https://api.mercadopago.com${ruta}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Idempotency-Key": clave },
    body: "{}",
  });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok) throw Object.assign(new Error(`Mercado Pago no hizo la devolución: ${(datos && datos.message) || r.status}`), { codigo: 502, mp: datos });
  return datos;
}


/* ---------- El cron: ajuste por IPC y borrado ---------- */

export async function tareasDiarias(db) {
  const resultado = { ajustes: [], borrados: [], errores: [] };
  const ahora = hoy();

  /* El ajuste. */
  const { data: candidatas, error: e1 } = await db.from("suscripciones")
    .select("empresa_id, mp_id, plan, periodo, monto, payer_email, proximo_cobro, proximo_ajuste, ipc_ref_mes, ipc_ref")
    .eq("estado", "activa").not("proximo_ajuste", "is", null).not("proximo_cobro", "is", null)
    .lte("proximo_cobro", masDias(ahora, 12)).gte("proximo_cobro", masDias(ahora, 10));
  if (e1) resultado.errores.push({ ajuste: e1.message });
  const aAjustar = (candidatas || []).filter((s) => s.proximo_cobro >= s.proximo_ajuste);
  let ipc = null;
  if (aAjustar.length) {
    try { ipc = await ipcUltimo(); } catch (e) { resultado.errores.push({ ipc: e.message }); }
  }
  for (const s of ipc ? aAjustar : []) {
    try {
      /* Sin referencia (la serie no contestó cuando arrancó el precio) o
         sin mes nuevo publicado: se toma la de hoy y se corre el ajuste. */
      if (!s.ipc_ref || !s.ipc_ref_mes || ipc.mes <= s.ipc_ref_mes) {
        await db.from("suscripciones").update({
          ipc_ref_mes: s.ipc_ref_mes || ipc.mes, ipc_ref: s.ipc_ref || ipc.valor, proximo_ajuste: sumarMeses(s.proximo_cobro, 3),
        }).eq("empresa_id", s.empresa_id);
        resultado.ajustes.push({ empresa: s.empresa_id, omitido: "sin IPC nuevo" });
        continue;
      }
      /* El monto de antes se guarda aparte: después del update, s.monto ya
         no es confiable para saber si subió. */
      const antes = Number(s.monto);
      const factor = ipc.valor / Number(s.ipc_ref);
      const nuevo = factor > 1 ? Math.round((antes * factor) / 100) * 100 : antes;
      if (nuevo > antes) {
        await mp(`/preapproval/${s.mp_id}`, { metodo: "PUT", cuerpo: { auto_recurring: { transaction_amount: nuevo, currency_id: "ARS" } } });
      }
      await db.from("suscripciones").update({
        monto_anterior: antes, monto: nuevo, ajustado_en: new Date().toISOString(),
        ipc_ref_mes: ipc.mes, ipc_ref: ipc.valor, precio_desde: s.proximo_cobro, proximo_ajuste: sumarMeses(s.proximo_cobro, 3),
      }).eq("empresa_id", s.empresa_id);
      if (nuevo > antes) {
        const { data: duenos } = await db.from("perfiles").select("email").eq("empresa_id", s.empresa_id).eq("rol", "dueno").eq("activo", true);
        const destinos = [...new Set([s.payer_email, ...(duenos || []).map((x) => x.email)].filter(Boolean))];
        const variacion = ((factor - 1) * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 });
        for (const para of destinos) {
          await avisar(para, "Genez: el precio se ajusta por inflación", [
            `Como dicen los términos, el precio de tu plan ${NOMBRE[s.plan]} se ajusta por la inflación (IPC del INDEC): subió ${variacion}% desde el último ajuste.`,
            `Desde el cobro del ${diaLindo(s.proximo_cobro)} pagás ${plata(nuevo)} ${s.periodo === "anual" ? "por año" : "por mes"} (antes ${plata(antes)}).`,
            "Si no estás de acuerdo, podés darte de baja antes de esa fecha desde Ajustes → Mi plan, sin ningún costo.",
          ]);
        }
      }
      resultado.ajustes.push({ empresa: s.empresa_id, antes, despues: nuevo });
    } catch (e) {
      resultado.errores.push({ ajuste: s.empresa_id, error: e.message });
    }
  }

  /* El borrado. La base vuelve a mirar cada condición (se_puede_borrar):
     esta lista es solo para no preguntar por todos los comercios. */
  const { data: vencidos, error: e2 } = await db.from("empresas").select("id, nombre, plan, prueba_hasta, pruebas!inner(empresa_id)")
    .in("plan", ["start", "pro"]).lte("prueba_hasta", masDias(ahora, -90));
  if (e2) resultado.errores.push({ borrado: e2.message });
  for (const e of vencidos || []) {
    try {
      const { data: puede } = await db.rpc("se_puede_borrar", { p_empresa: e.id });
      if (!puede) continue;
      const { data: r, error } = await db.rpc("borrar_comercio", { p_empresa: e.id });
      if (error) throw error;
      resultado.borrados.push(r);
    } catch (x) {
      resultado.errores.push({ borrado: e.nombre, error: x.message });
    }
  }
  return resultado;
}

