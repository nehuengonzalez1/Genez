/**
 * Hablarle a ARCA directo, sin intermediarios: WSAA para autenticarse y
 * WSFEv1 para facturar.
 *
 * POR QUÉ NO AFIP SDK EN PRODUCCIÓN
 * ---------------------------------
 * Afip SDK resuelve la autenticación en sus propios servidores, y para
 * eso les manda el certificado y la clave privada del comercio. La clave
 * privada es la firma fiscal de alguien: con ella se factura a su nombre.
 * Acá la clave no sale del servidor de Genez; se firma el pedido de
 * acceso localmente y a ARCA le llega solo la firma.
 *
 * Afip SDK sigue sirviendo para una cosa: el ambiente de pruebas con su
 * CUIT compartido, que no pide certificado (ver `_arca.js`).
 *
 * LA FORMA
 * --------
 * Este cliente imita la de Afip SDK —`ElectronicBilling.getLastVoucher`,
 * `createVoucher`, `getVoucherInfo`— para que `_arca.js` no tenga que
 * saber con cuál de los dos habla. Los rechazos de ARCA se tiran con el
 * código numérico de ARCA, como hace Afip SDK: es lo que `_arca.js` usa
 * para distinguir "ARCA dijo que no" de "no llegó".
 */

import https from "node:https";
import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";

const URLS = {
  produccion: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
  homologacion: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
};

/* EL TLS DE ARCA
   El WSFE de producción negocia con una clave Diffie-Hellman chica, y el
   OpenSSL de Node la rechaza por defecto: "dh key too small". Verificado
   el 23/09/2026 contra servicios1.afip.gov.ar; homologación y WSAA andan
   sin esto. Se baja el nivel solo en este agente, que solo habla con
   ARCA, y no en todo el proceso. */
const agente = new https.Agent({ ciphers: "DEFAULT@SECLEVEL=1", keepAlive: true });

/* Todo como texto: un CAE tiene 14 dígitos y un número de documento puede
   tener 11, y convertirlos a número en el camino es jugar con la
   precisión. Se convierte donde hace falta, a mano. */
const lector = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false, trimValues: true });

const escapar = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Un elemento, o nada si no hay valor. Los hijos van en el orden en que
   se pasan: el WSDL es una secuencia y SOAP rechaza el orden cambiado. */
function el(nombre, valor) {
  if (valor === undefined || valor === null || valor === "") return "";
  const adentro = Array.isArray(valor) ? valor.join("") : escapar(valor);
  return `<ar:${nombre}>${adentro}</ar:${nombre}>`;
}

const lista = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

function errorArca(mensaje, codigo) {
  return Object.assign(new Error(mensaje), { code: codigo });
}

function soap(url, accion, cuerpo, ms = 20000) {
  return new Promise((resolver, rechazar) => {
    const pedido = https.request(url, {
      method: "POST",
      agent: agente,
      timeout: ms,
      headers: { "content-type": "text/xml; charset=utf-8", SOAPAction: accion },
    }, (res) => {
      let texto = "";
      res.setEncoding("utf8");
      res.on("data", (c) => { texto += c; });
      res.on("end", () => {
        const doc = lector.parse(texto);
        const cuerpoSoap = doc && doc.Envelope && doc.Envelope.Body;
        if (!cuerpoSoap) return rechazar(new Error(`ARCA contestó algo que no es SOAP (HTTP ${res.statusCode}).`));
        if (cuerpoSoap.Fault) {
          const f = cuerpoSoap.Fault;
          /* Los errores de WSAA vienen como faultcode "ns1:cms.cert.untrusted"
             y un texto. El código es lo que sirve para decidir qué hacer. */
          const codigo = String(f.faultcode || "").replace(/^.*:/, "");
          return rechazar(Object.assign(new Error(String(f.faultstring || "ARCA devolvió un error.")), { codigoArca: codigo }));
        }
        resolver(cuerpoSoap);
      });
    });
    pedido.on("timeout", () => pedido.destroy(new Error("ARCA no contestó a tiempo.")));
    pedido.on("error", rechazar);
    pedido.end(cuerpo);
  });
}

/* ------------------------------------------------------------
   WSAA · el pase de 12 horas
   ------------------------------------------------------------ */

/* El pedido de acceso. Las horas van con diez minutos de margen para cada
   lado porque ARCA rechaza un pedido "del futuro" si el reloj del
   servidor adelanta un poco. */
export function armarTRA(servicio = "wsfe", ahora = Date.now()) {
  const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  return `<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header><uniqueId>${Math.floor(ahora / 1000)}</uniqueId><generationTime>${iso(ahora - 10 * 60 * 1000)}</generationTime><expirationTime>${iso(ahora + 10 * 60 * 1000)}</expirationTime></header><service>${servicio}</service></loginTicketRequest>`;
}

/* El pedido firmado: un CMS (PKCS#7) con el texto adentro, el
   certificado y la firma. Es la única vez que se usa la clave privada, y
   se usa acá, en el servidor. */
export function firmarTRA(tra, certPem, clavePem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(tra, "utf8");
  p7.addCertificate(cert);
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(clavePem),
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

async function loginCms(url, cms) {
  const cuerpo = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
  const r = await soap(url, "", cuerpo);
  /* La respuesta es otro XML metido como texto adentro del SOAP. */
  const ticket = lector.parse(r.loginCmsResponse.loginCmsReturn).loginTicketResponse;
  return {
    token: ticket.credentials.token,
    sign: ticket.credentials.sign,
    vence: new Date(ticket.header.expirationTime),
  };
}

/* Lo que WSAA contesta, dicho para quien lo va a leer. */
function explicarWSAA(e) {
  const c = e.codigoArca || "";
  if (c === "coe.alreadyAuthenticated") {
    return "ARCA dice que este certificado ya tiene un acceso vigente que Genez no tiene guardado. Se destraba solo cuando ese acceso vence, en menos de 12 horas.";
  }
  if (c.startsWith("cms.cert")) return `ARCA no reconoce el certificado (${c}). Revisá que sea el que descargaste de ARCA para este pedido.`;
  if (c === "coe.notAuthorized") {
    return "El certificado existe pero no tiene permiso para facturar: en ARCA, Administrador de Relaciones de Clave Fiscal, hay que autorizar a este computador fiscal para \"Facturación Electrónica\".";
  }
  return e.message;
}

/* ------------------------------------------------------------
   El cliente
   ------------------------------------------------------------ */

/**
 * @param produccion   true para el ARCA de verdad
 * @param cuit         el del certificado
 * @param certPem, clavePem
 * @param cargarTA     async () => { token, sign, vence } | null
 * @param guardarTA    async ({ token, sign, vence }) => void
 *
 * El pase dura 12 horas y ARCA no da otro mientras haya uno vigente: si
 * cada función de Vercel pidiera el suyo, la segunda recibiría un error.
 * Por eso se guarda afuera (en la base, cifrado) y se comparte.
 */
export function clienteDirecto({ produccion, cuit, certPem, clavePem, cargarTA, guardarTA }) {
  const urls = produccion ? URLS.produccion : URLS.homologacion;
  let pase = null;

  async function autenticar() {
    const margen = 5 * 60 * 1000;
    if (pase && pase.vence.getTime() - Date.now() > margen) return pase;
    const guardado = cargarTA ? await cargarTA() : null;
    if (guardado && new Date(guardado.vence).getTime() - Date.now() > margen) {
      pase = { ...guardado, vence: new Date(guardado.vence) };
      return pase;
    }
    try {
      pase = await loginCms(urls.wsaa, firmarTRA(armarTRA("wsfe"), certPem, clavePem));
    } catch (e) {
      throw Object.assign(new Error(explicarWSAA(e)), { codigoArca: e.codigoArca, paso: "wsaa" });
    }
    if (guardarTA) await guardarTA(pase);
    return pase;
  }

  async function wsfe(metodo, interior, conAuth = true) {
    let auth = "";
    if (conAuth) {
      const p = await autenticar();
      auth = el("Auth", [el("Token", p.token), el("Sign", p.sign), el("Cuit", cuit)]);
    }
    const cuerpo = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soap:Body><ar:${metodo}>${auth}${interior}</ar:${metodo}></soap:Body></soap:Envelope>`;
    const r = await soap(urls.wsfe, `http://ar.gov.afip.dif.FEV1/${metodo}`, cuerpo);
    return r[`${metodo}Response`][`${metodo}Result`];
  }

  /* Los errores de WSFE vienen adentro de una respuesta "exitosa". */
  function revisar(res) {
    const err = res && res.Errors && lista(res.Errors.Err)[0];
    if (err) throw errorArca(`(${err.Code}) ${err.Msg}`, Number(err.Code));
    return res;
  }

  const ElectronicBilling = {
    async getLastVoucher(ptoVta, tipo) {
      const r = revisar(await wsfe("FECompUltimoAutorizado", el("PtoVta", ptoVta) + el("CbteTipo", tipo)));
      return Number(r.CbteNro);
    },

    async createVoucher(d) {
      const iva = d.Iva ? el("Iva", d.Iva.map((a) => el("AlicIva", [el("Id", a.Id), el("BaseImp", a.BaseImp), el("Importe", a.Importe)]))) : "";
      /* La factura a la que corresponde una nota de crédito o de débito. En
         el WSDL va después de CondicionIVAReceptorId y antes de Iva. */
      const asociados = d.CbtesAsoc ? el("CbtesAsoc", d.CbtesAsoc.map((a) => el("CbteAsoc", [
        el("Tipo", a.Tipo), el("PtoVta", a.PtoVta), el("Nro", a.Nro), el("Cuit", a.Cuit), el("CbteFch", a.CbteFch),
      ]))) : "";
      const det = el("FECAEDetRequest", [
        el("Concepto", d.Concepto), el("DocTipo", d.DocTipo), el("DocNro", d.DocNro),
        el("CbteDesde", d.CbteDesde), el("CbteHasta", d.CbteHasta), el("CbteFch", d.CbteFch),
        el("ImpTotal", d.ImpTotal), el("ImpTotConc", d.ImpTotConc), el("ImpNeto", d.ImpNeto),
        el("ImpOpEx", d.ImpOpEx), el("ImpTrib", d.ImpTrib), el("ImpIVA", d.ImpIVA),
        el("FchServDesde", d.FchServDesde), el("FchServHasta", d.FchServHasta), el("FchVtoPago", d.FchVtoPago),
        el("MonId", d.MonId), el("MonCotiz", d.MonCotiz),
        el("CondicionIVAReceptorId", d.CondicionIVAReceptorId),
        asociados,
        iva,
      ]);
      const pedido = el("FeCAEReq", [
        el("FeCabReq", [el("CantReg", 1), el("PtoVta", d.PtoVta), el("CbteTipo", d.CbteTipo)]),
        el("FeDetReq", [det]),
      ]);
      const r = revisar(await wsfe("FECAESolicitar", pedido));
      const detalle = lista(r.FeDetResp && r.FeDetResp.FECAEDetResponse)[0] || {};
      if (detalle.Resultado !== "A") {
        const obs = lista(detalle.Observaciones && detalle.Observaciones.Obs)[0];
        throw errorArca(obs ? `(${obs.Code}) ${obs.Msg}` : "ARCA rechazó el comprobante.", obs ? Number(obs.Code) : 0);
      }
      const v = String(detalle.CAEFchVto);
      return { CAE: String(detalle.CAE), CAEFchVto: `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` };
    },

    /* null si ARCA no lo tiene (602), como Afip SDK. */
    async getVoucherInfo(numero, ptoVta, tipo) {
      const r = await wsfe("FECompConsultar", el("FeCompConsReq", [el("CbteTipo", tipo), el("CbteNro", numero), el("PtoVta", ptoVta)]));
      const err = r && r.Errors && lista(r.Errors.Err)[0];
      if (err && Number(err.Code) === 602) return null;
      revisar(r);
      const g = r.ResultGet;
      return { ...g, ImpTotal: Number(g.ImpTotal), CodAutorizacion: String(g.CodAutorizacion), FchVto: String(g.FchVto) };
    },

    async getSalesPoints() {
      const r = await wsfe("FEParamGetPtosVenta", "");
      const err = r && r.Errors && lista(r.Errors.Err)[0];
      /* 602: "sin resultados". Un CUIT sin puntos de venta de web service
         no es un error de la conexión, es un dato. */
      if (err && Number(err.Code) === 602) return [];
      revisar(r);
      return lista(r.ResultGet && r.ResultGet.PtoVenta).map((p) => ({
        numero: Number(p.Nro),
        tipo: String(p.EmisionTipo),
        bloqueado: String(p.Bloqueado) === "S",
        baja: p.FchBaja && String(p.FchBaja) !== "NULL" ? String(p.FchBaja) : null,
      }));
    },
  };

  /* Sin autenticación: dice si ARCA está en pie. */
  async function servidores() {
    const r = await wsfe("FEDummy", "", false);
    return { app: r.AppServer, base: r.DbServer, auth: r.AuthServer };
  }

  return { ElectronicBilling, autenticar, servidores };
}
