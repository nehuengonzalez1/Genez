/**
 * Cobrar con un QR que ya trae el monto (QR dinámico, Orders API).
 *
 * Con el QR fijo del local el cliente escanea y TIPEA el monto: puede
 * equivocarse, pagar dos veces o pagar lo de otro, y el cajero confirma
 * la venta a ojo cuando suena el aviso. Acá cada venta arma su orden con
 * el monto adentro; el cliente solo confirma, y la venta se registra
 * cuando Mercado Pago dice que la orden está pagada.
 *
 * Acciones (en `accion`):
 *   cajas     las cajas de la cuenta de Mercado Pago, para elegir en
 *             Ajustes → Cajas cuál usa cada caja de Genez (pide configurar)
 *   crear     { monto, referencia, cajaMp }: arma la orden, devuelve el
 *             texto del QR
 *   estado    { orden }: esperando, pagada, vencida, cancelada
 *   cancelar  { orden }: el cajero se arrepintió o el cliente pagó de
 *             otra forma; que nadie pueda pagarla después
 *
 * La orden usa una caja que YA existe en la cuenta del comercio (la del
 * QR fijo que tienen pegado): no se crean sucursales ni cajas en la
 * cuenta de nadie. Esa caja tiene que tener "external_id", que es por
 * donde la Orders API la nombra.
 *
 * Una función aparte y no una acción de conexion.js: aquella pide
 * `configurar`, y cobrar lo hace el cajero. El plan Hobby de Vercel
 * admite 12 funciones; con esta son 11.
 */

import { randomUUID } from "node:crypto";
import { origenValido } from "../_comun.js";
import { comercioDe, credencialDe, ErrorMP } from "./_mp.js";

const MP = "https://api.mercadopago.com";
const MONTO_MAXIMO = 50_000_000;
const error = (res, estado, message) => res.status(estado).json({ error: { message } });

export default async function handler(req, res) {
  if (!origenValido(req)) return error(res, 403, "Origen no permitido.");
  if (req.method !== "POST") return error(res, 405, "Método no permitido.");
  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  try {
    const { admin, empresaId } = await comercioDe(req, cuerpo.empresaId, { pideConfigurar: cuerpo.accion === "cajas" });
    const cred = await credencialDe(admin, empresaId);
    if (!cred) throw new ErrorMP("Este comercio no tiene una cuenta de Mercado Pago conectada.", 409);
    const mp = (ruta, opciones = {}) => fetch(`${MP}${ruta}`, {
      ...opciones,
      headers: { Authorization: `Bearer ${cred.token}`, "content-type": "application/json", ...(opciones.headers || {}) },
    });

    if (cuerpo.accion === "cajas") return res.status(200).json(await cajas(mp));
    if (cuerpo.accion === "crear") return res.status(200).json(await crear(mp, cuerpo));
    if (cuerpo.accion === "estado") return res.status(200).json(await estado(mp, cuerpo.orden));
    if (cuerpo.accion === "cancelar") return res.status(200).json(await cancelar(mp, cuerpo.orden));
    return error(res, 400, "Acción desconocida.");
  } catch (e) {
    return error(res, e instanceof ErrorMP ? e.estado : (e.estado || 502), e.message || "No se pudo completar.");
  }
}

async function leer(r, que) {
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) throw new ErrorMP("Mercado Pago no aceptó el token de la cuenta. Volvé a conectarla en Ajustes.", 409);
  if (!r.ok) throw new ErrorMP(`Mercado Pago no pudo ${que}: ${d.message || (d.errors && d.errors[0] && d.errors[0].message) || r.status}.`, 502);
  return d;
}

async function cajas(mp) {
  const d = await leer(await mp("/pos?limit=100"), "listar las cajas");
  return {
    cajas: (d.results || []).map((p) => ({
      id: String(p.id),
      nombre: p.name || `Caja ${p.id}`,
      externo: p.external_id || null,
      sucursal: p.store_id ? String(p.store_id) : null,
    })),
  };
}

async function crear(mp, { monto, referencia, cajaMp, detalle }) {
  const m = Math.round(Number(monto));
  if (!Number.isFinite(m) || m <= 0 || m > MONTO_MAXIMO) throw new ErrorMP("El monto no es válido.");
  if (!cajaMp) throw new ErrorMP("Esta caja no tiene elegida su caja de Mercado Pago (Ajustes → Cajas).");
  /* La referencia es de la venta: si el pedido se repite por un corte,
     la misma clave de idempotencia devuelve la misma orden y no dos. */
  const ref = String(referencia || randomUUID()).replace(/[^\w-]/g, "").slice(0, 64);
  const d = await leer(await mp("/v1/orders", {
    method: "POST",
    headers: { "X-Idempotency-Key": ref },
    body: JSON.stringify({
      type: "qr",
      total_amount: `${m}.00`,
      external_reference: ref,
      description: String(detalle || "Compra").slice(0, 150),
      expiration_time: "PT10M",
      config: { qr: { external_pos_id: String(cajaMp), mode: "dynamic" } },
      transactions: { payments: [{ amount: `${m}.00` }] },
    }),
  }), "armar el cobro");
  const qr = d.type_response && d.type_response.qr_data;
  if (!qr) throw new ErrorMP("Mercado Pago armó la orden pero no devolvió el QR.", 502);
  return { orden: d.id, qr, estado: traducir(d).estado };
}

/* Lo que importa en el mostrador: si ya se puede dar por cobrada. */
function traducir(d) {
  const pago = ((d.transactions && d.transactions.payments) || [])[0] || {};
  const s = d.status;
  let estado = "esperando";
  if (s === "processed" && (pago.status === "processed" || d.status_detail === "accredited")) estado = "pagada";
  else if (s === "expired") estado = "vencida";
  else if (s === "canceled" || s === "cancelled") estado = "cancelada";
  else if (s === "failed" || pago.status === "failed") estado = "rechazada";
  return { estado, pago: pago.id ? String(pago.id) : null, detalle: d.status_detail || null };
}

async function estado(mp, orden) {
  if (!orden) throw new ErrorMP("Falta la orden.");
  const d = await leer(await mp(`/v1/orders/${encodeURIComponent(orden)}`), "consultar el cobro");
  return { orden, ...traducir(d) };
}

async function cancelar(mp, orden) {
  if (!orden) throw new ErrorMP("Falta la orden.");
  const r = await mp(`/v1/orders/${encodeURIComponent(orden)}/cancel`, { method: "POST", headers: { "X-Idempotency-Key": randomUUID() } });
  /* Si ya se pagó, no se puede cancelar: se contesta el estado real para
     que el mostrador registre la venta en vez de perderla. */
  if (!r.ok) return estado(mp, orden);
  return { orden, ...traducir(await r.json()) };
}
