/* ============================================================
   VENTAS · registrar el cobro
   ============================================================

   Una venta se arma entera en el dispositivo y se manda de una sola vez.
   No es un capricho: es lo que va a permitir cobrar sin internet.

   El id lo genera acá, no la base. Un ticket nace con su identidad
   puesta, se imprime al instante y se sincroniza cuando puede. Si el
   envío se reintenta porque se perdió la respuesta, la base reconoce el
   id y no duplica.
   ============================================================ */

import { supabase } from "./supabase.js";
import { fdate } from "./generador.js";
import { facturaDeComprobante } from "./arca.js";

/* ------------------------------------------------------------
   NUMERACIÓN

   El número no puede depender de cuántas ventas lleva la pantalla
   abierta: al recargar vuelve a cero y dos ventas distintas terminan con
   el mismo comprobante.

   Tampoco puede pedirse al servidor, porque entonces no se podría cobrar
   sin internet. Se lleva en el equipo, que es como funciona la
   numeración fiscal de verdad: cada punto de venta tiene su propia
   serie, y por eso dos cajas no chocan aunque numeren a la vez.
   ------------------------------------------------------------ */

const CLAVE_NUMERO = "genez.ventas.numerador";

/* Facturas y tickets van en series distintas: la factura en el punto de
   venta de Ajustes (0001 de fábrica) y el ticket en la suya (0099). Antes
   compartían la 0001 y en la lista de ventas no se distinguía uno del
   otro por el número. Cada serie tiene su contador, así que ninguna salta
   números por la otra.

   Lo decide el tipo de comprobante de la venta, y por eso el número se
   pide recién cuando ya se sabe si es factura. `fiscal` es la
   configuración fiscal del comercio; si no trae la serie de tickets —un
   comercio configurado antes de que existiera— vale la de fábrica. */
export const serieDe = (fiscal, esFactura) => esFactura
  ? (fiscal && fiscal.puntoVenta) || "0001"
  : (fiscal && fiscal.serieTickets) || "0099";

const claveDe = (empresaId, puntoVenta) => `${CLAVE_NUMERO}.${empresaId}.${puntoVenta}`;

const armarNumero = (puntoVenta, n) => `${puntoVenta}-${String(n).padStart(8, "0")}`;

export function siguienteNumero(empresaId, puntoVenta = "0001") {
  const clave = claveDe(empresaId, puntoVenta);
  let n = 0;
  try { n = Number(localStorage.getItem(clave)) || 0; } catch { /* sin storage se arranca de cero */ }
  n += 1;
  try { localStorage.setItem(clave, String(n)); } catch { /* se sigue vendiendo igual */ }
  return armarNumero(puntoVenta, n);
}

/* Si se borra el almacenamiento del navegador —o se entra desde un equipo
   nuevo— el contador arrancaría de nuevo en uno y repetiría números ya
   emitidos. Al abrir con conexión se lo adelanta hasta el último número
   que el servidor ya conoce. */
export async function ponerNumeradorAlDia(empresaId, puntoVenta = "0001") {
  const { data, error } = await supabase
    .from("operaciones")
    .select("numero")
    .eq("empresa_id", empresaId)
    /* Una mesa cobrada queda con tipo 'comanda', no 'venta': conserva
       cómo nació. Pero emitió un comprobante de la misma serie, así que
       si no se la mira acá el contador arranca por debajo y reemite
       números que ya se entregaron impresos. */
    .in("tipo", ["venta", "comanda"])
    .like("numero", `${puntoVenta}-%`)
    .order("numero", { ascending: false })
    .limit(1);

  if (error || !data || !data.length) return;

  const ultimo = Number(String(data[0].numero).split("-")[1]) || 0;
  const clave = claveDe(empresaId, puntoVenta);
  try {
    if ((Number(localStorage.getItem(clave)) || 0) < ultimo) {
      localStorage.setItem(clave, String(ultimo));
    }
  } catch { /* sin storage no hay nada que poner al día */ }
}

/* Traduce lo que entrega el POS al formato que espera la base.
   El costo se copia a la línea a propósito: si mañana cambia el costo
   del producto, el margen de esta venta tiene que seguir siendo el que
   fue, no el que sería hoy. */
export function armarVenta({ empresaId, sucursalId, sesionId, numero, items, sub, desc, recargo, total, pagos, medio, cliente, fiscal, comprobante }) {
  const lista = pagos && pagos.length ? pagos : [{ medio, monto: total }];

  return {
    id: crypto.randomUUID(),
    empresa_id: empresaId,
    sucursal_id: sucursalId || null,
    sesion_id: sesionId || null,
    numero,
    fecha: new Date().toISOString(),
    cliente_id: cliente ? cliente.id : null,
    subtotal: Math.round(sub || 0),
    descuento: Math.round(desc || 0),
    recargo: Math.round(recargo || 0),
    total: Math.round(total || 0),
    comprobante: comprobante || (fiscal ? { fiscal: true } : {}),
    lineas: (items || []).map((l) => {
      /* Un precio bajado a mano en el mostrador queda escrito: el
         renglón guarda el de lista y lo que se rebajó, y el total es lo
         que se cobró. Es por donde se va la plata de un local, y sin esto
         un "se lo dejo a tanto" no se distinguiría de un precio de lista.
         Subir el precio no es un descuento: ahí el precio es el cobrado. */
      const rebaja = l.precioLista && l.precioLista > l.precio
        ? Math.round((l.precioLista - l.precio) * l.qty) : 0;
      return {
        item_id: l.pid,
        descripcion: l.nombre,
        cantidad: l.qty,
        precio_unitario: rebaja ? l.precioLista : l.precio,
        costo_unitario: l.costo,
        iva: l.iva != null ? l.iva : 21,
        descuento: rebaja,
        total: Math.round(l.precio * l.qty),
      };
    }),
    pagos: lista.map((p) => ({
      medio: p.medio,
      monto: Math.round(p.monto),
      recargo: Math.round(p.recargo || 0),
      referencia: p.referencia || null,
    })),
  };
}

/* Devuelve el id si entró, o lanza. Quien llama decide qué hacer con el
   error: el ticket ya está impreso y la venta ya ocurrió en el mostrador,
   así que un fallo acá es un problema de sincronización, no de cobro. */
export async function registrarVenta(venta) {
  const { data, error } = await supabase.rpc("registrar_venta", { venta });
  if (error) throw error;
  return data;
}

/* Lo vendido hoy según la base, que es lo único que sobrevive a un
   refresco. Trae solo los totales: el detalle de cada venta no hace falta
   para mostrar un encabezado. */
export async function resumenDelDia(empresaId) {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("operaciones")
    .select("total")
    .eq("empresa_id", empresaId)
    /* Una mesa cobrada es venta del día aunque su tipo siga siendo
       'comanda'. El estado es lo que decide: una mesa todavía abierta no
       se vendió, se está consumiendo. */
    .in("tipo", ["venta", "comanda"])
    .eq("estado", "confirmada")
    .gte("fecha", desde.toISOString())
    .limit(5000);

  if (error) throw error;
  return {
    total: (data || []).reduce((s, v) => s + Number(v.total || 0), 0),
    tickets: (data || []).length,
  };
}

/* La serie de los últimos días para los indicadores y los gráficos:
   ventas, costo y tickets por día, continua y en la zona horaria del
   comercio (migración 0071). Reemplaza a los noventa días inventados del
   generador, y se devuelve con la misma forma que tenía aquella serie
   —fecha, label, ventas, costo, tickets— para que `calcular()` y las
   pantallas no cambien. La fecha se arma al mediodía para que "2026-09-13"
   no se corra de día al pasar por la zona horaria del navegador. */
export async function cargarSerieDiaria(empresaId, dias = 90) {
  if (!empresaId) throw new Error("cargarSerieDiaria necesita la empresa.");

  const { data, error } = await supabase.rpc("ventas_diarias", { p_empresa: empresaId, p_dias: dias });
  if (error) throw error;

  return (data || []).map((d) => {
    const fecha = new Date(`${d.fecha}T12:00:00`);
    return {
      fecha, label: fdate(fecha),
      ventas: Number(d.ventas) || 0,
      costo: Number(d.costo) || 0,
      tickets: Number(d.tickets) || 0,
    };
  });
}

/* Una venta, para abrirla desde un movimiento de Caja: quién la cobró,
   el cliente y la factura. Los renglones y los importes los trae
   `cargarTicketDeVenta`, que es lo mismo que se imprime. La factura sale
   de `comprobantes`, la que no fue rechazada: una venta tiene a lo sumo
   una viva.

   Devuelve null si la venta todavía no está en la base: se cobró sin
   internet y sigue en la cola de este equipo (src/datos/cola.js). */
export async function cargarVenta(empresaId, operacionId) {
  if (!empresaId) throw new Error("cargarVenta necesita la empresa.");
  const { data, error } = await supabase
    .from("operaciones")
    .select("id, numero, fecha, total, comprobante, clientes ( razon_social ), cajero:perfiles!usuario_id ( nombre ), comprobantes ( estado, modo, cuit, letra, tipo, punto_venta, numero, cae, cae_vto, fecha, total, doc_tipo, doc_nro )")
    .eq("empresa_id", empresaId)
    .eq("id", operacionId)
    .in("tipo", ["venta", "comanda"])
    .limit(1);
  if (error) throw error;

  const o = data && data[0];
  if (!o) return null;

  const fiscal = !!(o.comprobante && o.comprobante.fiscal);
  const c = (o.comprobantes || []).find((x) => x.estado !== "rechazado") || null;
  const factura = c && c.estado === "autorizado" ? facturaDeComprobante(c, o.id) : null;
  return {
    id: o.id,
    numero: o.numero,
    fecha: new Date(o.fecha),
    total: Number(o.total),
    cliente: (o.clientes && o.clientes.razon_social) || (o.comprobante && o.comprobante.cliente && o.comprobante.cliente.nombre) || null,
    cajero: (o.cajero && o.cajero.nombre) || "",
    fiscal,
    factura,
    /* autorizada | pidiendo | sin_cae | simulada, o null si es un
       ticket. "Simulada" es la del prototipo, con un CAE inventado
       escrito en la venta y sin comprobante: no espera nada (la vista de
       facturas también la deja afuera) y no hay que ofrecer pedirle CAE. */
    estadoFactura: !fiscal ? null
      : factura ? "autorizada"
      : c && c.estado === "pendiente" ? "pidiendo"
      : !c && o.comprobante.cae ? "simulada"
      : "sin_cae",
  };
}

/* Lo que se vendió de cada producto en el período (migración 0080).

   Reemplaza a la proyección que hacían los cuadros de Informes: tomaban
   la venta de los últimos treinta días y la multiplicaban por el período
   elegido, lo cual con 365 días decía cualquier cosa.

   La venta es la suma de las líneas, así que no incluye el descuento ni
   el recargo de la operación —viven arriba, sin repartir por línea—. Con
   descuentos, esto queda por encima de `cargarSerieDiaria`. */
export async function cargarVentasPorItem(empresaId, dias = 30) {
  if (!empresaId) throw new Error("cargarVentasPorItem necesita la empresa.");

  const { data, error } = await supabase.rpc("ventas_por_item", { p_empresa: empresaId, p_dias: dias });
  if (error) throw error;

  return (data || []).map((d) => {
    const venta = Number(d.venta) || 0;
    const costo = Number(d.costo) || 0;
    return {
      id: d.item_id,
      nombre: d.nombre,
      categoria: d.categoria || "Sin rubro",
      unidades: Number(d.unidades) || 0,
      venta,
      costo,
      ganancia: venta - costo,
      margen: venta > 0 ? (venta - costo) / venta : 0,
    };
  });
}
