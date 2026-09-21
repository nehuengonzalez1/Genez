/**
 * Pide el CAE (Código de Autorización Electrónico) de un comprobante a
 * ARCA, vía Afip SDK.
 *
 * POR QUÉ AFIP SDK Y NO EL WEBSERVICE DIRECTO
 * --------------------------------------------
 * Facturar de verdad exige autenticarse contra WSAA (un token que vence
 * cada 12hs, firmado con el certificado del comercio) y después hablarle
 * a WSFEv1 por SOAP. Afip SDK (`@afipsdk/afip.js`) resuelve las dos cosas:
 * esta función solo arma los datos del comprobante y llama a
 * `ElectronicBilling.createVoucher`.
 *
 * MODO SANDBOX, SIN CERTIFICADO DE NADIE TODAVÍA
 * ------------------------------------------------
 * Con el CUIT de pruebas que Afip SDK expone (20409378472) no hace falta
 * certificado: alcanza con el `access_token` de una cuenta de Afip SDK.
 * Para facturar con el CUIT real de un comercio va a hacer falta además
 * su certificado (.crt/.key), que solo el dueño de ese CUIT puede generar
 * desde su propia Clave Fiscal — eso queda para cuando haya un comercio
 * real facturando, no antes.
 *
 * `AFIP_CUIT` y `AFIP_ACCESS_TOKEN` viven en Vercel, igual que
 * `MP_ACCESS_TOKEN`. Sin `AFIP_CUIT` se usa el de pruebas.
 */

import Afip from "@afipsdk/afip.js";
import { origenValido, quienLlama } from "../_comun.js";

const CUIT_PRUEBAS = 20409378472;

/* A → 1, B → 6, C → 11: los códigos que ARCA usa para el tipo de
   comprobante, distintos de la letra que ve el cliente. */
const TIPO_COMPROBANTE = { A: 1, B: 6, C: 11 };

function fechaComoNumero(d = new Date()) {
  return Number(
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`
  );
}

export default async function handler(req, res) {
  if (!origenValido(req)) return res.status(403).json({ error: { message: "Origen no permitido." } });
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Método no permitido." } });

  const quien = await quienLlama(req);
  if (!quien) return res.status(401).json({ error: { message: "Sesión inválida." } });

  const accessToken = process.env.AFIP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(501).json({ error: { message: "Falta configurar AFIP_ACCESS_TOKEN en Vercel." } });
  }
  const cuit = Number(process.env.AFIP_CUIT) || CUIT_PRUEBAS;

  const {
    letra, puntoVenta, total, importeIva, docTipo, docNro,
    condicionIvaReceptor, concepto,
  } = req.body || {};

  const cbteTipo = TIPO_COMPROBANTE[letra];
  if (!cbteTipo) return res.status(400).json({ error: { message: "La letra tiene que ser A, B o C." } });
  if (!puntoVenta || !total) return res.status(400).json({ error: { message: "Faltan puntoVenta o total." } });

  try {
    const cert = process.env.AFIP_CERT ? process.env.AFIP_CERT.replace(/\\n/g, "\n") : undefined;
    const key = process.env.AFIP_KEY ? process.env.AFIP_KEY.replace(/\\n/g, "\n") : undefined;
    const afip = new Afip({ CUIT: cuit, access_token: accessToken, ...(cert && key ? { cert, key } : {}) });

    const ultimo = await afip.ElectronicBilling.getLastVoucher(puntoVenta, cbteTipo);
    const numero = ultimo + 1;
    const iva = Number(importeIva) || 0;
    const neto = Number(total) - iva;

    const data = {
      CantReg: 1,
      PtoVta: Number(puntoVenta),
      CbteTipo: cbteTipo,
      Concepto: concepto || 1,
      DocTipo: docTipo || 99,
      DocNro: docNro || 0,
      CbteDesde: numero,
      CbteHasta: numero,
      CbteFch: fechaComoNumero(),
      ImpTotal: Number(total),
      ImpTotConc: 0,
      ImpNeto: neto,
      ImpOpEx: 0,
      ImpIVA: iva,
      ImpTrib: 0,
      MonId: "PES",
      MonCotiz: 1,
      CondicionIVAReceptorId: condicionIvaReceptor || 5,
      ...(iva > 0 ? { Iva: [{ Id: 5, BaseImp: neto, Importe: iva }] } : {}),
    };

    const respuesta = await afip.ElectronicBilling.createVoucher(data);

    return res.status(200).json({
      cae: respuesta.CAE,
      vencimiento: respuesta.CAEFchVto,
      numero,
      puntoVenta: Number(puntoVenta),
      letra,
      sandbox: cuit === CUIT_PRUEBAS,
    });
  } catch (e) {
    return res.status(502).json({ error: { message: e.message || "ARCA no pudo procesar el comprobante." } });
  }
}
