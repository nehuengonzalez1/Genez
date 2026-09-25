/**
 * La cuenta de Mercado Pago de un comercio (0091). La usa Ajustes →
 * Mercado Pago.
 *
 * Acciones (en `accion`):
 *   estado   si está conectada y a qué cuenta, sin nada secreto
 *   guardar  { token }: le pregunta a Mercado Pago de quién es, y si
 *            contesta lo guarda cifrado con esa cuenta
 *   quitar   deja al comercio sin cuenta: los avisos se apagan
 *
 * QUIÉN: el que tenga `configurar` en el comercio, o la plataforma
 * nombrando el comercio. El token nunca vuelve al navegador.
 */

import { origenValido } from "../_comun.js";
import { cifrar } from "../arca/_cifrado.js";
import { comercioDe, credencialDe, cuentaDe, ErrorMP } from "./_mp.js";

const error = (res, estado, message) => res.status(estado).json({ error: { message } });

export default async function handler(req, res) {
  if (!origenValido(req)) return error(res, 403, "Origen no permitido.");
  if (req.method !== "POST") return error(res, 405, "Método no permitido.");
  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  try {
    const { admin, empresaId, yo } = await comercioDe(req, cuerpo.empresaId, { pideConfigurar: true });
    if (cuerpo.accion === "estado") return res.status(200).json(await estado(admin, empresaId));
    if (cuerpo.accion === "guardar") return res.status(200).json(await guardar(admin, empresaId, yo, cuerpo.token));
    if (cuerpo.accion === "quitar") {
      await admin.from("mp_credenciales").delete().eq("empresa_id", empresaId);
      return res.status(200).json(await estado(admin, empresaId));
    }
    return error(res, 400, "Acción desconocida.");
  } catch (e) {
    return error(res, e instanceof ErrorMP ? e.estado : (e.estado || 502), e.message || "No se pudo completar.");
  }
}

async function estado(admin, empresaId) {
  const c = await credencialDe(admin, empresaId);
  if (!c) return { conectada: false };
  return {
    conectada: true,
    cuenta: { id: c.cuentaId, nombre: c.fila.cuenta_nombre, email: c.fila.cuenta_email },
    verificadaEn: c.fila.verificada_en,
  };
}

async function guardar(admin, empresaId, yo, tokenCrudo) {
  const token = String(tokenCrudo || "").trim();
  /* APP_USR- es el Access Token de producción. Uno de prueba (TEST-)
     contesta, pero no ve los cobros reales: mejor decirlo ahora que
     descubrirlo cuando no suena nada. */
  if (!/^APP_USR-[\w-]{20,}$/.test(token)) {
    throw new ErrorMP(token.startsWith("TEST-")
      ? "Ese es un token de prueba (TEST-): no ve los cobros reales. Copiá el Access Token de producción (empieza con APP_USR-)."
      : "Eso no parece un Access Token de Mercado Pago. Tiene que empezar con APP_USR-.");
  }
  const cuenta = await cuentaDe(token);
  const fila = {
    empresa_id: empresaId,
    token_cifrado: cifrar(token),
    cuenta_id: cuenta.id,
    cuenta_nombre: cuenta.nombre || cuenta.apodo,
    cuenta_email: cuenta.email,
    verificada_en: new Date().toISOString(),
    cargada_por: yo.id,
    actualizada_en: new Date().toISOString(),
  };
  const { error } = await admin.from("mp_credenciales").upsert(fila, { onConflict: "empresa_id" });
  if (error) throw error;
  return estado(admin, empresaId);
}
