/**
 * Pedirle a ARCA el CAE de una venta. Lo usan `api/arca/facturar.js` y
 * `scripts/probar-arca.mjs`; por eso vive aparte del handler y recibe los
 * clientes armados en vez de construirlos.
 *
 * NADA SALE DEL NAVEGADOR
 * -----------------------
 * El endpoint viejo recibía la letra, el punto de venta y el total en el
 * cuerpo del pedido y los mandaba a ARCA así. Cualquiera con sesión podía
 * pedir un CAE por el importe que quisiera. Ahora se recibe el id de la
 * venta y nada más: el total sale de `operaciones`, el CUIT y el punto de
 * venta de `arca_conexiones`, la condición de `empresas.config.fiscal` y la
 * del comprador de su ficha.
 *
 * EL ORDEN IMPORTA
 * ----------------
 *   1. Si la venta ya tiene comprobante, se devuelve ese. Reintentar no
 *      factura dos veces.
 *   2. Si en la serie quedó uno pendiente —un servidor que se cayó
 *      esperando a ARCA—, se averigua qué pasó con ese número antes de
 *      pedir el siguiente.
 *   3. Se pregunta el último número, se reserva el que sigue con una fila
 *      pendiente (es el candado, ver 0082) y recién ahí se pide el CAE.
 *   4. Si ARCA contesta, se guarda lo que dijo. Si no contesta, la fila
 *      queda pendiente: no sabemos si autorizó, y decir que no sería
 *      arriesgarse a reusar un número que ya tiene dueño.
 */

import Afip from "@afipsdk/afip.js";
import { clienteDirecto } from "./_directo.js";
import { cifrar, descifrar } from "./_cifrado.js";

/* El CUIT de pruebas de Afip SDK: en homologación no pide certificado. */
export const CUIT_PRUEBAS = "20409378472";

/* Los códigos de ARCA, distintos de la letra que ve el cliente. */
const TIPO_FACTURA = { A: 1, B: 6, C: 11 };

/* Condición frente al IVA del comprador (RG 5616). Sin este dato ARCA ya
   no autoriza. */
const CONDICION_RECEPTOR = { RI: 1, EXENTO: 4, CF: 5, MONOTRIBUTO: 6 };

/* Tipo de documento del comprador. 99 es "sin identificar", el consumidor
   final de mostrador. */
const DOC_TIPO = { CUIT: 80, CUIL: 86, DNI: 96 };

/* Un pendiente más viejo que esto es un servidor que no volvió. Una
   función de Vercel corta a los 10 s por defecto; con 90 no se pisa a una
   caja que todavía está esperando la respuesta. */
const PENDIENTE_VENCIDO_MS = 90 * 1000;
const vencido = (fila) => Date.now() - new Date(fila.creado_en).getTime() > PENDIENTE_VENCIDO_MS;

export class ErrorArca extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje);
    this.estado = estado;
  }
}

/* La misma regla que `letraComprobante` en src/utils/helpers.js. Se copia
   en vez de importarla porque ese archivo arrastra el generador del
   prototipo, y una función de servidor no tiene por qué cargarlo. */
function letraDe(emisor, receptor) {
  if (emisor === "MONOTRIBUTO" || emisor === "EXENTO") return "C";
  return receptor === "RI" ? "A" : "B";
}

/* La fecha de hoy en Argentina, como la quiere ARCA (aaaammdd).
   El endpoint viejo usaba la hora local del servidor, que en Vercel es
   UTC: de nueve de la noche en adelante facturaba con fecha de mañana. */
export function hoyEnArgentina(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(d).map((x) => [x.type, x.value])
  );
  return `${p.year}${p.month}${p.day}`;
}

const comoFecha = (aaaammdd) => `${aaaammdd.slice(0, 4)}-${aaaammdd.slice(4, 6)}-${aaaammdd.slice(6, 8)}`;
const redondo = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Con quién se habla, según el ambiente.
 *
 * Homologación es el ARCA de pruebas con el CUIT compartido de Afip SDK:
 * no pide certificado y no tiene validez fiscal. Producción es ARCA
 * directo con el certificado del comercio (`_directo.js`): la clave
 * privada no sale de Genez.
 */
export async function clienteArca(admin, conexion) {
  if (conexion.modo === "homologacion") {
    const accessToken = process.env.AFIP_ACCESS_TOKEN;
    if (!accessToken) throw new ErrorArca("Falta AFIP_ACCESS_TOKEN en el servidor.", 501);
    return new Afip({ CUIT: Number(CUIT_PRUEBAS), access_token: accessToken });
  }
  return clienteDeProduccion(admin, conexion.empresa_id, conexion.cuit);
}

/**
 * El cliente directo con el certificado en uso de un comercio. Lo usan
 * la facturación y la prueba de conexión.
 *
 * `cuitEsperado` es el de la conexión: si alguien cargara un certificado
 * de otro CUIT, se factura con ninguno antes que con el equivocado.
 */
export async function clienteDeProduccion(admin, empresaId, cuitEsperado = null) {
  const { data: cred, error } = await admin.from("arca_credenciales").select("*").eq("empresa_id", empresaId).maybeSingle();
  if (error) throw error;
  if (!cred || !cred.certificado) throw new ErrorArca("Este comercio todavía no cargó su certificado de ARCA.", 409);
  if (cuitEsperado && cred.cert_cuit !== cuitEsperado) {
    throw new ErrorArca(`El certificado es del CUIT ${cred.cert_cuit} y la conexión factura con ${cuitEsperado}.`, 409);
  }
  if (new Date(cred.cert_vence).getTime() < Date.now()) {
    throw new ErrorArca("El certificado de ARCA venció. Hay que pedir uno nuevo desde Ajustes → Factura electrónica.", 409);
  }

  return clienteDirecto({
    produccion: true,
    cuit: cred.cert_cuit,
    certPem: cred.certificado,
    clavePem: descifrar(cred.clave_cifrada),
    cargarTA: async () => {
      const { data } = await admin.from("arca_credenciales").select("ta_cifrado, ta_vence").eq("empresa_id", empresaId).maybeSingle();
      return data && data.ta_cifrado ? { ...JSON.parse(descifrar(data.ta_cifrado)), vence: data.ta_vence } : null;
    },
    guardarTA: async ({ token, sign, vence }) => {
      await admin.from("arca_credenciales")
        .update({ ta_cifrado: cifrar(JSON.stringify({ token, sign })), ta_vence: vence.toISOString() })
        .eq("empresa_id", empresaId);
    },
  });
}

/** El CUIT con el que se factura, según el ambiente. */
export const cuitDe = (conexion) => (conexion.modo === "homologacion" ? CUIT_PRUEBAS : conexion.cuit);

/**
 * Mira en ARCA qué pasó con un comprobante que quedó pendiente y lo
 * resuelve. Devuelve la fila resuelta, o null si ARCA tampoco contestó
 * esta vez (la fila sigue pendiente).
 */
async function resolverPendiente(admin, afip, fila) {
  let info;
  try {
    info = await afip.ElectronicBilling.getVoucherInfo(fila.numero, fila.punto_venta, fila.tipo);
  } catch {
    return null;
  }

  /* ARCA lo tiene y es el nuestro: se autorizó y nos perdimos la
     respuesta. Se compara el total para no adoptar un comprobante que
     haya emitido otro sistema con el mismo punto de venta. */
  const esElNuestro = info && info.CodAutorizacion && redondo(info.ImpTotal) === redondo(fila.total);
  const cambios = esElNuestro
    ? { estado: "autorizado", cae: String(info.CodAutorizacion), cae_vto: comoFecha(String(info.FchVto)), respuesta: info }
    : info
      ? { estado: "rechazado", error: `ARCA tiene el número ${fila.numero} con otro importe: lo emitió otro sistema en este punto de venta.`, respuesta: info }
      : { estado: "rechazado", error: "El pedido no llegó a ARCA." };

  const { data, error } = await admin.from("comprobantes").update(cambios).eq("id", fila.id).eq("estado", "pendiente").select().maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Factura una venta. Devuelve la fila de `comprobantes`, autorizada.
 * Tira `ErrorArca` con el estado HTTP que corresponde si no se pudo.
 */
export async function facturarVenta({ admin, empresaId, operacionId, usuarioId = null, afip: afipDado = null }) {
  if (!empresaId || !operacionId) throw new ErrorArca("Faltan el comercio o la venta.");

  /* 1 · La venta, filtrada por comercio (regla 6): con la service_role
     RLS no mira, así que el filtro es lo único que impide facturar la
     venta de otro. */
  const { data: venta, error: e1 } = await admin
    .from("operaciones")
    .select("id, empresa_id, tipo, estado, total, cliente_id, comprobante")
    .eq("id", operacionId).eq("empresa_id", empresaId)
    .maybeSingle();
  if (e1) throw e1;
  if (!venta) throw new ErrorArca("La venta no existe o todavía no llegó a la base.", 404);
  if (venta.tipo !== "venta" || venta.estado !== "confirmada") throw new ErrorArca("Solo se factura una venta confirmada.");
  if (!(Number(venta.total) > 0)) throw new ErrorArca("Una venta en cero no se factura.");

  /* Solo las que el mostrador cobró como factura. Una que se entregó con
     ticket no fiscal ya tiene su papel, y facturarla después serían dos
     comprobantes de la misma venta. La que tiene `cae` en el jsonb es la
     de antes de 0082, con un CAE inventado: ver 0083. */
  const comp = venta.comprobante || {};
  if (comp.fiscal !== true) throw new ErrorArca("Esta venta se cobró con ticket no fiscal: no se factura.", 409);
  if (comp.cae) throw new ErrorArca("Esta venta ya tiene un comprobante impreso de antes de ARCA: no se factura.", 409);

  const { data: conexion, error: e2 } = await admin.from("arca_conexiones").select("*").eq("empresa_id", empresaId).maybeSingle();
  if (e2) throw e2;
  if (!conexion) throw new ErrorArca("Este comercio no está conectado con ARCA.", 409);

  const afip = afipDado || await clienteArca(admin, conexion);
  const cuit = cuitDe(conexion);

  /* 2 · ¿Ya tiene? */
  const { data: previo, error: e3 } = await admin
    .from("comprobantes").select("*")
    .eq("operacion_id", operacionId).neq("estado", "rechazado")
    .maybeSingle();
  if (e3) throw e3;
  if (previo && previo.estado === "autorizado") return previo;
  if (previo) {
    /* Un doble clic, o la cola reintentando mientras el primer pedido
       todavía espera a ARCA. Resolverlo ahora lo daría por perdido con el
       CAE en camino. */
    if (!vencido(previo)) throw new ErrorArca("Esta venta ya se está facturando. Esperá unos segundos.", 409);
    const r = await resolverPendiente(admin, afip, previo);
    if (r && r.estado === "autorizado") return r;
    if (!r) throw new ErrorArca("ARCA no contesta. La factura quedó pendiente y se revisa en el próximo intento.", 503);
  }

  /* 3 · Qué se factura. */
  const { data: empresa, error: e4 } = await admin.from("empresas").select("config").eq("id", empresaId).single();
  if (e4) throw e4;
  const emisor = (empresa.config && empresa.config.fiscal && empresa.config.fiscal.condicion) || null;
  if (!emisor) throw new ErrorArca("Falta la condición frente al IVA del comercio (Ajustes → datos fiscales).");

  let comprador = null;
  if (venta.cliente_id) {
    const { data, error } = await admin.from("clientes").select("condicion, tipo_doc, doc").eq("id", venta.cliente_id).eq("empresa_id", empresaId).maybeSingle();
    if (error) throw error;
    comprador = data;
  }
  const condicion = (comprador && comprador.condicion) || "CF";
  const letra = letraDe(emisor, condicion);

  /* A y B discriminan o informan el IVA por alícuota, y eso necesita la
     alícuota de cada producto repartida con el descuento de la venta.
     Todavía no está: mejor decirlo que mandar un IVA mal calculado. */
  if (letra !== "C") throw new ErrorArca(`La factura ${letra} todavía no está disponible; por ahora solo C.`, 501);

  const docNro = comprador && comprador.doc ? Number(String(comprador.doc).replace(/\D/g, "")) : 0;
  const docTipo = docNro ? (DOC_TIPO[String(comprador.tipo_doc || "").toUpperCase()] || (String(docNro).length === 11 ? 80 : 96)) : 99;
  const tipo = TIPO_FACTURA[letra];
  const total = redondo(venta.total);
  const fecha = hoyEnArgentina();

  /* Un pendiente de otra venta en la misma serie: si es de un servidor
     que se cayó, se resuelve; si es de una caja que está esperando ahora,
     se espera. */
  const { data: trabado } = await admin
    .from("comprobantes").select("*")
    .match({ modo: conexion.modo, cuit, punto_venta: conexion.punto_venta, tipo, estado: "pendiente" })
    .maybeSingle();
  if (trabado) {
    if (!vencido(trabado) || !(await resolverPendiente(admin, afip, trabado))) {
      throw new ErrorArca("Otra caja está facturando en este momento. Probá de nuevo en unos segundos.", 409);
    }
  }

  /* 4 · Reservar el número. */
  const ultimo = await afip.ElectronicBilling.getLastVoucher(conexion.punto_venta, tipo);
  const numero = Number(ultimo) + 1;

  const pedido = {
    CantReg: 1,
    PtoVta: conexion.punto_venta,
    CbteTipo: tipo,
    Concepto: 1,
    DocTipo: docTipo,
    DocNro: docNro,
    CbteDesde: numero,
    CbteHasta: numero,
    CbteFch: Number(fecha),
    ImpTotal: total,
    ImpTotConc: 0,
    ImpNeto: total,
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: "PES",
    MonCotiz: 1,
    CondicionIVAReceptorId: CONDICION_RECEPTOR[condicion] || 5,
  };

  const { data: fila, error: e5 } = await admin.from("comprobantes").insert({
    empresa_id: empresaId,
    operacion_id: operacionId,
    modo: conexion.modo,
    cuit,
    punto_venta: conexion.punto_venta,
    tipo,
    letra,
    numero,
    fecha: comoFecha(fecha),
    total,
    neto: total,
    iva: 0,
    doc_tipo: docTipo,
    doc_nro: docNro,
    condicion_receptor: pedido.CondicionIVAReceptorId,
    pedido,
    usuario_id: usuarioId,
  }).select().single();

  if (e5) {
    /* 23505: otro pidió al mismo tiempo, en esta serie o para esta venta. */
    if (e5.code === "23505") throw new ErrorArca("Otra caja está facturando en este momento. Probá de nuevo en unos segundos.", 409);
    throw e5;
  }

  /* 5 · Pedir el CAE. */
  try {
    const r = await afip.ElectronicBilling.createVoucher(pedido);
    const { data, error } = await admin.from("comprobantes")
      .update({ estado: "autorizado", cae: String(r.CAE), cae_vto: r.CAEFchVto, respuesta: r })
      .eq("id", fila.id).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    /* ARCA contestó que no: el número no se consumió y se puede
       reintentar. El error trae el código y el motivo, que es lo que hay
       que mostrar. */
    /* Se reconoce por el código numérico, que es el de ARCA; los de red
       traen uno de texto ("ECONNRESET"). */
    if (e && typeof e.code === "number") {
      await admin.from("comprobantes").update({ estado: "rechazado", error: e.message }).eq("id", fila.id);
      throw new ErrorArca(`ARCA rechazó la factura: ${e.message}`, 422);
    }
    /* Cualquier otra cosa —se cortó, tardó, Afip SDK no contestó— no
       dice si ARCA la autorizó. Se pregunta una vez; si tampoco contesta,
       queda pendiente para el próximo intento. */
    const r = await resolverPendiente(admin, afip, fila);
    if (r && r.estado === "autorizado") return r;
    if (r) throw new ErrorArca(`ARCA no autorizó la factura: ${r.error}`, 502);
    throw new ErrorArca("ARCA no contesta. La factura quedó pendiente y se revisa en el próximo intento.", 503);
  }
}

/* Lo que ve el navegador de un comprobante autorizado. Los nombres de la
   base no salen de acá, igual que no salen de `src/datos/`. */
export function comoFactura(c) {
  return {
    operacionId: c.operacion_id,
    letra: c.letra,
    tipo: c.tipo,
    puntoVenta: c.punto_venta,
    numero: c.numero,
    cae: c.cae,
    vencimiento: c.cae_vto,
    fecha: c.fecha,
    cuit: c.cuit,
    total: Number(c.total),
    docTipo: c.doc_tipo,
    docNro: Number(c.doc_nro) || 0,
    homologacion: c.modo === "homologacion",
  };
}

/* Cuánto se sigue pidiendo en una sola llamada. Cada CAE son dos idas a
   ARCA; con esto la función contesta antes de que Vercel la corte, y el
   navegador vuelve a llamar si quedan. */
const PRESUPUESTO_MS = 20 * 1000;

/**
 * Pide el CAE de todas las ventas que lo esperan, de la más vieja a la
 * más nueva, una por una.
 *
 * EN ORDEN Y DE A UNA
 * -------------------
 * El número lo pone ARCA en el orden en que se le pide. Si las facturas
 * que quedaron colgadas durante un corte se pidieran en cualquier orden
 * —o si la venta nueva pasara adelante de las viejas—, la numeración
 * dejaría de seguir el orden de las ventas. Por eso no hay forma de pedir
 * el CAE de una venta suelta: se piden todas las que esperan, empezando
 * por la primera.
 *
 * Y se corta en el primer error. Seguir con la siguiente dejaría a la que
 * falló con un número más alto que una venta posterior, que es justo lo
 * que se quiere evitar.
 *
 * Devuelve { autorizadas, quedan, error }. Un error no se tira: lo que se
 * autorizó antes de él ya es real y el navegador tiene que enterarse.
 */
export async function facturarPendientes({ admin, empresaId, usuarioId = null, afip = null }) {
  if (!empresaId) throw new ErrorArca("Falta el comercio.");

  const esperan = async () => {
    const { data, error } = await admin
      .from("facturas_vista")
      .select("operacion_id")
      .eq("empresa_id", empresaId)
      .neq("estado", "autorizada")
      .order("fecha", { ascending: true })
      .limit(50);
    if (error) throw error;
    return data || [];
  };

  const inicio = Date.now();
  const autorizadas = [];
  let error = null;

  for (const { operacion_id } of await esperan()) {
    if (Date.now() - inicio > PRESUPUESTO_MS) break;
    try {
      const c = await facturarVenta({ admin, empresaId, operacionId: operacion_id, usuarioId, afip });
      autorizadas.push(comoFactura(c));
    } catch (e) {
      error = e instanceof ErrorArca ? e.message : (e.message || "ARCA no pudo procesar el comprobante.");
      break;
    }
  }

  return { autorizadas, quedan: (await esperan()).length, error };
}
