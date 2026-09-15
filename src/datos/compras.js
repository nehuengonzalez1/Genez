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

   El costo del producto se actualiza aparte, con `guardarProducto`: es
   una decisión de quien compra —a veces se factura más caro pero se
   sigue vendiendo al costo viejo hasta agotar el lote—, no algo
   automático de esta función. */

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
     pueden pisarse en el costo que termina quedando guardado. */
  for (const l of lineas) {
    await ajustarStock({
      empresaId, itemId: l.itemId, cantidad: l.cantidad,
      tipo: "compra", motivo: comprobante ? `Compra ${comprobante}` : "Compra",
      operacionId: op.id,
    });
    if (l.actualizarCosto) await guardarProducto(l.itemId, { costo: l.costoUnitario });
  }

  return op.id;
}
