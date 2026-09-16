/* ============================================================
   PRESUPUESTOS · cotizar sin vender
   ============================================================

   "El plomero pide precio por el baño entero, se lo lleva, vuelve a los
   días y compra parte" (#29). `operaciones.tipo = 'presupuesto'` ya
   existe desde 0001 — no hace falta ninguna tabla nueva, solo escribir
   con `estado = 'pendiente'` en vez de 'confirmada' para que no aparezca
   en ningún reporte de ventas ni mueva caja o stock.

   Convertir a venta NO pasa por acá: usa armarVenta()/registrarVenta()
   (las mismas de `ventas.js` que ya usa el cobro real), así una
   conversión es una venta como cualquier otra, atómica y con el mismo
   `confirmar_operacion` de siempre. Acá solo se marca el presupuesto
   como convertido después. */

import { supabase } from "./supabase.js";

const n = (v) => Number(v) || 0;

function aPresupuesto(f) {
  const c = f.clientes || {};
  return {
    id: f.id,
    fecha: new Date(f.fecha),
    clienteId: f.cliente_id,
    clienteNombre: c.razon_social || "",
    clienteTelefono: c.tel || "",
    subtotal: n(f.subtotal),
    descuento: n(f.descuento),
    total: n(f.total),
    estado: f.estado,
    validoHasta: (f.campos_extra || {}).validoHasta || null,
    lineas: (f.operacion_lineas || []).map((l) => ({
      itemId: l.item_id,
      descripcion: l.descripcion,
      cantidad: n(l.cantidad),
      precioUnitario: n(l.precio_unitario),
      total: n(l.total),
    })),
  };
}

const SELECT = "id, fecha, cliente_id, subtotal, descuento, total, estado, campos_extra, " +
  "clientes(razon_social, tel), operacion_lineas(item_id, descripcion, cantidad, precio_unitario, total)";

export async function cargarPresupuestos(empresaId) {
  if (!empresaId) throw new Error("cargarPresupuestos necesita la empresa.");
  const { data, error } = await supabase
    .from("operaciones")
    .select(SELECT)
    .eq("empresa_id", empresaId)
    .eq("tipo", "presupuesto")
    .order("fecha", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(aPresupuesto);
}

/* lineas: [{ itemId, descripcion, cantidad, precioUnitario }] */
export async function crearPresupuesto({ empresaId, sucursalId, clienteId, validoHasta, lineas }) {
  if (!empresaId) throw new Error("crearPresupuesto necesita la empresa.");
  if (!lineas || !lineas.length) throw new Error("El presupuesto no tiene líneas.");

  const subtotal = lineas.reduce((s, l) => s + Number(l.cantidad) * Number(l.precioUnitario), 0);

  const { data: op, error } = await supabase
    .from("operaciones")
    .insert({
      id: crypto.randomUUID(),
      empresa_id: empresaId,
      sucursal_id: sucursalId || null,
      tipo: "presupuesto",
      estado: "pendiente",
      cliente_id: clienteId || null,
      subtotal: Math.round(subtotal),
      total: Math.round(subtotal),
      campos_extra: validoHasta ? { validoHasta } : {},
    })
    .select("id")
    .single();
  if (error) throw error;

  const filas = lineas.map((l) => ({
    operacion_id: op.id,
    empresa_id: empresaId,
    item_id: l.itemId,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precioUnitario,
    total: Math.round(Number(l.cantidad) * Number(l.precioUnitario)),
  }));
  const { error: e2 } = await supabase.from("operacion_lineas").insert(filas);
  if (e2) throw e2;

  return op.id;
}

/* Se marca convertido recién cuando la venta que sale de él ya se guardó
   (ver Presupuestos.jsx): si se marcara antes y la venta fallara, el
   presupuesto quedaría cerrado sin que nadie haya comprado nada. */
export async function marcarConvertido(presupuestoId) {
  const { error } = await supabase.from("operaciones").update({ estado: "convertido" }).eq("id", presupuestoId);
  if (error) throw error;
}
