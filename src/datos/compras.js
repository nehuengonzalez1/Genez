/* ============================================================
   COMPRAS · lo que entra de un proveedor queda guardado
   ============================================================

   `operaciones` ya admite `tipo = 'compra'` y ya tiene `proveedor_id`
   desde 0001; `movimientos_stock` ya admite `tipo = 'compra'`. No hacía
   falta una tabla nueva, solo escribir en las que ya estaban.

   No es una función de Postgres como `registrar_venta`: una compra no
   necesita la atomicidad de un cobro (nadie recibe el mismo remito dos
   veces al mismo tiempo) ni pasa por la cola offline. Se arma acá, en
   varios pasos, igual que ya hace `crearProducto` con su stock inicial.

   El costo del producto se actualiza aparte, con `guardarProducto`, y
   `actualizarCosto` decide cómo:
     - true      → lo pisa con el costo de esta compra (a veces se
                   factura más caro pero se sigue vendiendo al costo
                   viejo hasta agotar el lote; overwrite es la opción
                   para cuando eso YA se agotó).
     - "ppp"     → precio promedio ponderado: lo que había pesado por
                   cuánto quedaba, más lo que entra. Es lo que pide un
                   comercio que no vacía el estante antes de reponer
                   (sanitarios, #75) — mezclar el lote viejo con el
                   nuevo sin perder de vista lo que costó cada uno.
     - false/nada → no toca el costo. */

import { supabase } from "./supabase.js";
import { ajustarStock, guardarProducto } from "./items.js";

/* lineas: [{ itemId, descripcion, cantidad, costoUnitario, actualizarCosto }] */
export async function registrarCompra({ empresaId, proveedorId, sucursalId, comprobante, lineas }) {
  if (!empresaId) throw new Error("registrarCompra necesita la empresa.");
  if (!lineas || !lineas.length) throw new Error("La compra no tiene líneas.");

  const subtotal = lineas.reduce((s, l) => s + Number(l.cantidad) * Number(l.costoUnitario), 0);

  const { data: op, error } = await supabase
    .from("operaciones")
    .insert({
      id: crypto.randomUUID(),
      empresa_id: empresaId,
      sucursal_id: sucursalId || null,
      tipo: "compra",
      estado: "confirmada",
      proveedor_id: proveedorId || null,
      numero: comprobante || null,
      subtotal: Math.round(subtotal),
      total: Math.round(subtotal),
      cerrada_en: new Date().toISOString(),
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
    precio_unitario: 0,
    costo_unitario: l.costoUnitario,
    total: Math.round(Number(l.cantidad) * Number(l.costoUnitario)),
  }));
  const { error: e2 } = await supabase.from("operacion_lineas").insert(filas);
  if (e2) throw e2;

  /* En fila, no en paralelo: dos movimientos del mismo producto a la vez
     pueden pisarse en el costo que termina quedando guardado, y el PPP
     necesita leer el stock ANTES de que la línea anterior lo cambie. */
  for (const l of lineas) {
    let nuevoCosto = null;
    if (l.actualizarCosto === "ppp") {
      const { data: previo, error: e3 } = await supabase
        .from("items_vista").select("stock, costo").eq("id", l.itemId).single();
      if (e3) throw e3;
      const stockPrevio = Number(previo.stock) || 0;
      const cantidad = Number(l.cantidad);
      const total = stockPrevio + cantidad;
      nuevoCosto = total > 0
        ? Math.round((stockPrevio * Number(previo.costo || 0) + cantidad * Number(l.costoUnitario)) / total * 100) / 100
        : Number(l.costoUnitario);
    } else if (l.actualizarCosto) {
      nuevoCosto = Number(l.costoUnitario);
    }

    await ajustarStock({
      empresaId, itemId: l.itemId, cantidad: l.cantidad,
      tipo: "compra", motivo: comprobante ? `Compra ${comprobante}` : "Compra",
      operacionId: op.id,
    });
    if (nuevoCosto != null) await guardarProducto(l.itemId, { costo: nuevoCosto });
  }

  return op.id;
}

/* ============================================================
   LAS ÓRDENES DE COMPRA (0111)
   ============================================================
   Una operación de tipo 'compra' en estado 'pendiente': lo que se le
   pidió a un proveedor y todavía no llegó. No mueve stock ni costo; eso
   lo hace la recepción con registrarCompra, y la orden pasa a
   'recibida'. Se marcan en campos_extra.orden para no confundirlas con
   una compra cargada directo (que nace confirmada).

   La forma que devuelve es la que ya usaba la pantalla cuando vivían en
   memoria: { id, nro, prov, fecha, estado, items, total }. */

const ESTADO_EN_PANTALLA = { pendiente: "pendiente", recibida: "recibido", cancelada: "cancelado" };

const aOrden = (o) => ({
  id: o.id,
  nro: o.numero || "OC",
  prov: (o.proveedores && o.proveedores.nombre) || (o.campos_extra && o.campos_extra.proveedor) || "Sin proveedor",
  fecha: new Date(o.fecha),
  estado: ESTADO_EN_PANTALLA[o.estado] || o.estado,
  items: (o.operacion_lineas || []).map((l) => ({
    pid: l.item_id, nombre: l.descripcion, barcode: (l.items && l.items.barcode) || "",
    cant: Number(l.cantidad) || 0, costo: Number(l.costo_unitario) || 0,
  })),
  total: Number(o.total) || 0,
});

export async function cargarOrdenes(empresaId) {
  if (!empresaId) throw new Error("cargarOrdenes necesita la empresa.");
  const { data, error } = await supabase
    .from("operaciones")
    .select("id, numero, fecha, estado, total, campos_extra, proveedores(nombre), operacion_lineas(item_id, descripcion, cantidad, costo_unitario, items(barcode))")
    .eq("empresa_id", empresaId).eq("tipo", "compra").eq("campos_extra->>orden", "true")
    .order("fecha", { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map(aOrden);
}

/* El número sigue al último de este comercio: OC-0001, OC-0002… */
async function siguienteNumeroDeOrden(empresaId) {
  const { data } = await supabase.from("operaciones").select("numero")
    .eq("empresa_id", empresaId).eq("tipo", "compra").eq("campos_extra->>orden", "true")
    .order("fecha", { ascending: false }).limit(50);
  const ultimo = Math.max(0, ...(data || []).map((o) => Number(String(o.numero || "").replace(/\D/g, "")) || 0));
  return `OC-${String(ultimo + 1).padStart(4, "0")}`;
}

/* items: [{ itemId, descripcion, cantidad, costo }] */
export async function crearOrden({ empresaId, sucursalId = null, proveedorId = null, proveedor = "", items }) {
  if (!items || !items.length) throw new Error("La orden no tiene productos.");
  const numero = await siguienteNumeroDeOrden(empresaId);
  const total = Math.round(items.reduce((s, l) => s + Number(l.cantidad) * Number(l.costo), 0));
  const id = crypto.randomUUID();
  const { error } = await supabase.from("operaciones").insert({
    id, empresa_id: empresaId, sucursal_id: sucursalId || null, tipo: "compra", estado: "pendiente",
    proveedor_id: proveedorId || null, numero, subtotal: total, total,
    campos_extra: { orden: true, proveedor },
  });
  if (error) throw error;
  const { error: e2 } = await supabase.from("operacion_lineas").insert(items.map((l) => ({
    operacion_id: id, empresa_id: empresaId, item_id: l.itemId, descripcion: l.descripcion,
    cantidad: l.cantidad, precio_unitario: 0, costo_unitario: l.costo,
    total: Math.round(Number(l.cantidad) * Number(l.costo)),
  })));
  if (e2) {
    /* Sin renglones la orden no sirve: se cancela para que no quede una
       vacía en la lista. */
    await supabase.from("operaciones").update({ estado: "cancelada" }).eq("id", id);
    throw e2;
  }
  return { id, numero, total };
}

/* 'recibida' (con la compra que la recibió) o 'cancelada'. */
export async function cerrarOrden(id, estado, { compraId = null, total = null } = {}) {
  const { data: actual, error: e0 } = await supabase.from("operaciones").select("campos_extra").eq("id", id).single();
  if (e0) throw e0;
  const cambios = {
    estado,
    cerrada_en: new Date().toISOString(),
    campos_extra: { ...(actual.campos_extra || {}), ...(compraId ? { compra: compraId } : {}) },
    ...(total != null ? { total: Math.round(total) } : {}),
  };
  const { error } = await supabase.from("operaciones").update(cambios).eq("id", id);
  if (error) throw error;
}
