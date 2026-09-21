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
