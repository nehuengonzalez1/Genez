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
    .eq("tipo", "venta")
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
    lineas: (items || []).map((l) => ({
      item_id: l.pid,
      descripcion: l.nombre,
      cantidad: l.qty,
      precio_unitario: l.precio,
      costo_unitario: l.costo,
      iva: l.iva != null ? l.iva : 21,
      descuento: 0,
      total: Math.round(l.precio * l.qty),
    })),
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
    .eq("tipo", "venta")
    .gte("fecha", desde.toISOString())
    .limit(5000);

  if (error) throw error;
  return {
    total: (data || []).reduce((s, v) => s + Number(v.total || 0), 0),
    tickets: (data || []).length,
  };
}

/* El historial de ventas del día. El POS no lo necesita para cobrar,
   pero sí para reimprimir y para el arqueo. */
export async function cargarVentasDelDia(empresaId) {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("operaciones")
    .select("id, numero, fecha, total, subtotal, descuento, recargo, comprobante, cliente_id, pagos ( medio, monto ), operacion_lineas ( item_id, descripcion, cantidad, precio_unitario, costo_unitario, total )")
    .eq("empresa_id", empresaId)
    .eq("tipo", "venta")
    .gte("fecha", desde.toISOString())
    .order("fecha", { ascending: false });

  if (error) throw error;
  return data || [];
}
