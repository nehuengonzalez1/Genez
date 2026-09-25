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

/* Antes de reenviar una venta que quedó en el equipo, se mira en la base
   qué de lo que dice ya no existe, y se arregla lo que se puede arreglar
   sin inventar nada. El caso que la motivó: la pantalla de la caja quedó
   abierta de un día para el otro, con datos que se borraron a la noche, y
   la base rechazó ventas que apuntaban a ellos.

   - Un cliente que ya no existe: la venta va sin cliente. Si la venta
     fue fiada no se puede —un fiado siempre tiene cliente— y se dice.
   - Un producto que ya no existe: el renglón queda con su descripción y
     sin ficha, como el de un concepto suelto; el stock de ese renglón no
     se descuenta porque no hay de qué.
   - Una caja que ya no existe: se registra en la caja abierta, que es
     donde está la plata.

   Devuelve { venta, cambios, bloqueo }: los cambios en palabras, para
   mostrarlos antes de reenviar, y el motivo si no se puede. */
export async function repararVenta(venta, sesionAbiertaId = null) {
  const cambios = [];
  let bloqueo = null;
  const v = { ...venta, lineas: (venta.lineas || []).map((l) => ({ ...l })) };

  if (v.cliente_id) {
    const { data } = await supabase.from("clientes").select("id").eq("id", v.cliente_id).maybeSingle();
    if (!data) {
      const fiada = (v.pagos || []).some((p) => p.medio === "cuenta_corriente");
      if (fiada) bloqueo = "Se fió a un cliente que ya no existe. Hay que cobrarla de nuevo a un cliente que exista.";
      else { v.cliente_id = null; cambios.push("Va sin cliente: el que tenía ya no existe."); }
    }
  }

  const ids = [...new Set(v.lineas.map((l) => l.item_id).filter(Boolean))];
  if (ids.length) {
    const { data } = await supabase.from("items").select("id").in("id", ids);
    const hay = new Set((data || []).map((x) => x.id));
    const faltan = v.lineas.filter((l) => l.item_id && !hay.has(l.item_id));
    faltan.forEach((l) => { l.item_id = null; });
    if (faltan.length) cambios.push(`${faltan.length === 1 ? "Un producto ya no existe" : `${faltan.length} productos ya no existen`}: queda${faltan.length === 1 ? "" : "n"} con su descripción, sin descontar stock.`);
  }

  if (v.sesion_id) {
    const { data } = await supabase.from("sesiones_caja").select("id").eq("id", v.sesion_id).maybeSingle();
    if (!data) {
      if (sesionAbiertaId) { v.sesion_id = sesionAbiertaId; cambios.push("Se registra en la caja abierta: la de la venta ya no existe."); }
      else bloqueo = bloqueo || "La caja de esta venta ya no existe. Abrí la caja para registrarla ahí.";
    }
  } else if (sesionAbiertaId) {
    v.sesion_id = sesionAbiertaId;
    cambios.push("Se registra en la caja abierta.");
  }

  return { venta: v, cambios, bloqueo };
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
    .select("total, tipo")
    .eq("empresa_id", empresaId)
    /* Una mesa cobrada es venta del día aunque su tipo siga siendo
       'comanda'. El estado es lo que decide: una mesa todavía abierta no
       se vendió, se está consumiendo. Las devoluciones (0089) restan y no
       cuentan como ticket, igual que en ventas_diarias (0090). */
    .in("tipo", ["venta", "comanda", "devolucion"])
    .eq("estado", "confirmada")
    .gte("fecha", desde.toISOString())
    .limit(5000);

  if (error) throw error;
  const filas = data || [];
  return {
    total: filas.reduce((s, v) => s + (v.tipo === "devolucion" ? -1 : 1) * Number(v.total || 0), 0),
    tickets: filas.filter((v) => v.tipo !== "devolucion").length,
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

/* Las últimas ventas del comercio, para reimprimir desde el cobro sin ir a
   Caja: "no salió el ticket", "¿me das la factura?". Ventas y mesas
   cobradas, de la más nueva a la más vieja, de cualquier caja. Trae lo
   justo para la lista; el papel se arma al imprimir con
   `cargarTicketDeVenta`, como en Caja. */
export async function cargarUltimasVentas(empresaId, cuantas = 5) {
  if (!empresaId) throw new Error("cargarUltimasVentas necesita la empresa.");
  const { data, error } = await supabase
    .from("operaciones")
    .select("id, numero, fecha, total, comprobante, clientes ( razon_social ), comprobantes ( estado, letra, punto_venta, numero )")
    .eq("empresa_id", empresaId)
    .in("tipo", ["venta", "comanda"])
    .eq("estado", "confirmada")
    .order("fecha", { ascending: false })
    .limit(cuantas);
  if (error) throw error;
  return (data || []).map((o) => {
    const fiscal = !!(o.comprobante && o.comprobante.fiscal);
    const c = (o.comprobantes || []).find((x) => x.estado === "autorizado") || null;
    return {
      id: o.id,
      numero: o.numero,
      fecha: new Date(o.fecha),
      total: Number(o.total),
      cliente: (o.clientes && o.clientes.razon_social) || null,
      fiscal,
      nota: (o.comprobante && o.comprobante.nota) || null,
      factura: c ? { letra: c.letra, puntoVenta: c.punto_venta, numero: c.numero } : null,
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
    .select("id, numero, fecha, total, tipo, comprobante, campos_extra, origen_id, clientes ( razon_social ), cajero:perfiles!usuario_id ( nombre ), comprobantes ( estado, modo, cuit, letra, tipo, punto_venta, numero, cae, cae_vto, fecha, total, doc_tipo, doc_nro )")
    .eq("empresa_id", empresaId)
    .eq("id", operacionId)
    .in("tipo", ["venta", "comanda", "devolucion"])
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
    /* venta | comanda | devolucion, y si es nota de crédito o de débito
       (0089). Una nota de débito es una venta que apunta a una factura. */
    tipo: o.tipo,
    nota: (o.comprobante && o.comprobante.nota) || null,
    origenId: o.origen_id || null,
    motivo: (o.campos_extra && o.campos_extra.motivo) || null,
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

/* ------------------------------------------------------------
   DEVOLUCIONES Y NOTAS (0089)
   ------------------------------------------------------------
   Las dos las hace la base, que controla el permiso, la caja, que no se
   devuelva más de lo vendido y la numeración. Necesitan internet: tocan
   una venta que ya está en la base. */

/* Cuánto se devolvió ya de cada renglón de una venta: lineaId → cantidad. */
export async function cargarDevuelto(empresaId, ventaId) {
  const { data, error } = await supabase
    .from("operaciones")
    .select("operacion_lineas ( origen_linea_id, cantidad )")
    .eq("empresa_id", empresaId).eq("origen_id", ventaId).eq("tipo", "devolucion").eq("estado", "confirmada");
  if (error) throw error;
  const devuelto = {};
  for (const o of data || []) for (const l of o.operacion_lineas || []) {
    if (l.origen_linea_id) devuelto[l.origen_linea_id] = (devuelto[l.origen_linea_id] || 0) + Number(l.cantidad);
  }
  return devuelto;
}

/* lineas: [{ lineaId, cantidad }]. Devuelve el id de la devolución. */
export async function registrarDevolucion({ ventaId, lineas, sesionId, medio, motivo }) {
  const { data, error } = await supabase.rpc("registrar_devolucion", {
    p_venta: ventaId,
    p_lineas: lineas.map((l) => ({ linea_id: l.lineaId, cantidad: l.cantidad })),
    p_sesion: sesionId || null,
    p_medio: medio,
    p_motivo: motivo || null,
  });
  if (error) throw new Error(error.message || "No se pudo registrar la devolución.");
  return data;
}

/* Un cargo de más sobre una factura. Devuelve el id de la nota. */
export async function registrarNotaDebito({ ventaId, concepto, monto, sesionId, medio }) {
  const { data, error } = await supabase.rpc("registrar_nota_debito", {
    p_venta: ventaId,
    p_concepto: concepto,
    p_monto: Math.round(monto),
    p_sesion: sesionId || null,
    p_medio: medio,
  });
  if (error) throw new Error(error.message || "No se pudo registrar la nota de débito.");
  return data;
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
