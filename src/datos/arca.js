/* ============================================================
   ARCA · la factura electrónica
   ============================================================

   Una venta cobrada como factura sale del mostrador marcada así, con
   internet o sin él. El CAE se pide después: enseguida, si ARCA contesta,
   o cuando vuelvan la red o ARCA, con el botón de Caja → Facturas.

   `obtenerCAEs` no recibe qué facturar. El servidor pide todas las que
   esperan, de la más vieja a la más nueva, para que la numeración siga el
   orden de las ventas. Tampoco manda importes ni letra: salen de la venta
   y del comercio, para que nadie pueda pedir un CAE por lo que se le
   ocurra.
   ============================================================ */

import { supabase } from "./supabase.js";
import { fdatel } from "./generador.js";
import { hora } from "../utils/helpers.js";

/* Lo que sigue funcionando con la sesión que haya: el token lo pide el
   servidor para saber de qué comercio es quien llama. */
async function llamar(cuerpo) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");

  const r = await fetch("/api/arca/facturar", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });

  const respuesta = await r.json().catch(() => null);
  if (!r.ok) throw new Error((respuesta && respuesta.error && respuesta.error.message) || "ARCA no contestó.");
  return respuesta;
}

/**
 * Pide el CAE de todo lo que espera. El servidor contesta de a tandas para
 * que Vercel no lo corte, así que se vuelve a llamar mientras avance.
 *
 * Devuelve { autorizadas, quedan, error }. Sin red, `error` dice eso y
 * `quedan` es null: no se sabe cuántas hay sin preguntarle a la base.
 */
export async function obtenerCAEs(empresaId = null) {
  const autorizadas = [];
  try {
    for (;;) {
      const r = await llamar({ empresaId });
      autorizadas.push(...r.autorizadas);
      if (r.error || !r.quedan || !r.autorizadas.length) {
        return { autorizadas, quedan: r.quedan, error: r.error };
      }
    }
  } catch (e) {
    return { autorizadas, quedan: null, error: e.message || "No hay conexión con el servidor." };
  }
}

/* Con qué punto de venta factura el comercio, o null si no está conectado.
   La escribe la plataforma; acá solo se lee. */
export async function cargarConexionArca(empresaId) {
  if (!empresaId) throw new Error("cargarConexionArca necesita la empresa.");
  const { data, error } = await supabase
    .from("arca_conexiones")
    .select("modo, punto_venta")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  if (error) throw error;
  return data && { modo: data.modo, puntoVenta: data.punto_venta };
}

const aFactura = (f) => f.estado === "autorizada"
  ? {
      operacionId: f.operacion_id,
      letra: f.letra,
      tipo: f.tipo,
      puntoVenta: f.punto_venta,
      numero: f.numero,
      cae: f.cae,
      vencimiento: f.cae_vto,
      fecha: f.fecha_factura,
      cuit: f.cuit,
      total: Number(f.total),
      docTipo: f.doc_tipo,
      docNro: Number(f.doc_nro) || 0,
      homologacion: f.modo === "homologacion",
    }
  : null;

/**
 * Las ventas cobradas como factura: todas las que esperan CAE, y las
 * autorizadas desde `desde`. Las que esperan van siempre, sean de cuando
 * sean: son las que hay que resolver.
 */
export async function cargarFacturas(empresaId, desde) {
  if (!empresaId) throw new Error("cargarFacturas necesita la empresa.");
  const campos = "operacion_id, numero_interno, fecha, total, cliente, estado, modo, cuit, letra, tipo, punto_venta, numero, cae, cae_vto, fecha_factura, doc_tipo, doc_nro, ultimo_error";

  const [esperan, hechas] = await Promise.all([
    supabase.from("facturas_vista").select(campos).eq("empresa_id", empresaId)
      .neq("estado", "autorizada").order("fecha", { ascending: true }),
    supabase.from("facturas_vista").select(campos).eq("empresa_id", empresaId)
      .eq("estado", "autorizada").gte("fecha", desde.toISOString()).order("fecha", { ascending: false }),
  ]);
  if (esperan.error) throw esperan.error;
  if (hechas.error) throw hechas.error;

  const fila = (f) => ({
    operacionId: f.operacion_id,
    numeroInterno: f.numero_interno,
    fecha: new Date(f.fecha),
    total: Number(f.total),
    cliente: f.cliente || null,
    estado: f.estado,
    ultimoError: f.ultimo_error,
    factura: aFactura(f),
  });
  return { esperan: esperan.data.map(fila), hechas: hechas.data.map(fila) };
}

/**
 * Una venta de la base, con la forma de ticket que imprime `ticketVenta`.
 * Es para reimprimir desde Caja → Facturas una que se cobró antes, en
 * otra caja, o antes de refrescar.
 */
export async function cargarTicketDeVenta(empresaId, operacionId) {
  if (!empresaId) throw new Error("cargarTicketDeVenta necesita la empresa.");
  const { data: o, error } = await supabase
    .from("operaciones")
    .select("id, numero, fecha, total, subtotal, descuento, recargo, comprobante, clientes ( razon_social, tipo_doc, doc, condicion, domicilio ), pagos ( medio, monto ), operacion_lineas ( descripcion, cantidad, precio_unitario, total )")
    .eq("empresa_id", empresaId).eq("id", operacionId)
    .single();
  if (error) throw error;

  const f = new Date(o.fecha);
  const cl = o.clientes;
  const pagos = (o.pagos || []).map((p) => ({ medio: p.medio, monto: Number(p.monto) }));
  return {
    id: o.id,
    nro: o.numero,
    fecha: fdatel(f),
    hora: hora(f),
    /* El precio es lo cobrado por unidad y no `precio_unitario`: un
       renglón con el precio bajado a mano guarda ahí el de lista, y el
       papel tiene que sumar lo mismo que el total. */
    items: (o.operacion_lineas || []).map((l) => ({
      nombre: l.descripcion, qty: Number(l.cantidad),
      precio: Number(l.cantidad) ? Number(l.total) / Number(l.cantidad) : Number(l.precio_unitario),
    })),
    sub: Number(o.subtotal), desc: Number(o.descuento), recargo: Number(o.recargo), total: Number(o.total),
    pagos, medio: pagos.length ? pagos[0].medio : null,
    fiscal: !!(o.comprobante && o.comprobante.fiscal),
    cliente: cl ? { razonSocial: cl.razon_social, tipoDoc: cl.tipo_doc || "CUIT", doc: cl.doc || "", condicion: cl.condicion, domicilio: cl.domicilio } : null,
  };
}

/**
 * La conexión con ARCA de producción: el certificado, la prueba y el
 * paso a facturar de verdad (ver `api/arca/conexion.js`). La clave
 * privada no pasa nunca por acá: la genera y la guarda el servidor.
 *
 * `accion`: estado | generar | certificado | probar | activar.
 */
export async function conexionArca(accion, datos = {}, empresaId = null) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");

  const r = await fetch("/api/arca/conexion", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion, empresaId, ...datos }),
  });
  const respuesta = await r.json().catch(() => null);
  if (!r.ok) throw new Error((respuesta && respuesta.error && respuesta.error.message) || "No se pudo hablar con el servidor.");
  return respuesta;
}
