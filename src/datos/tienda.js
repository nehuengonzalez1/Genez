/* ============================================================
   LA TIENDA ONLINE, DEL LADO DEL COMERCIO (0141)
   ============================================================

   Los pedidos que entran por la tienda se leen de `pedidos_tienda` (RLS:
   puede_ver) y se mueven con `estado_pedido_tienda`: la tabla no se
   escribe directo desde el navegador.

   En la pantalla se ven en Pedidos, junto a los que arma el comercio con
   la pistola, con la misma forma: por eso se traducen acá al formato de
   esa pantalla (`aPedidoDePicking`). Los de la pistola siguen viviendo
   en memoria; los de la tienda son de la base y sobreviven al refresco.
   ============================================================ */

import { supabase } from "./supabase.js";

/* Los abiertos: lo cerrado ya no se prepara ni se cobra. */
export async function cargarPedidosTienda(empresaId) {
  const { data, error } = await supabase.from("pedidos_tienda")
    .select("id, numero, estado, nombre, telefono, entrega, direccion, nota, lineas, subtotal, envio, total, creado_en")
    .eq("empresa_id", empresaId)
    .in("estado", ["nuevo", "confirmado", "listo"])
    .order("creado_en", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function estadoPedidoTienda(id, estado, ventaId = null) {
  const { error } = await supabase.rpc("estado_pedido_tienda", { p_pedido: id, p_estado: estado, p_venta: ventaId });
  if (error) throw new Error(error.message || "No se pudo actualizar el pedido de la tienda.");
}

/* El estado de la base y el de la pantalla de Pedidos. "nuevo" es
   "pendiente" (todavía nadie lo abrió); al abrirlo para prepararlo pasa
   a "confirmado". */
export const ESTADO_PICKING = { nuevo: "pendiente", confirmado: "preparando", listo: "listo", entregado: "entregado", cancelado: "cancelado" };
export const ESTADO_TIENDA = { preparando: "confirmado", listo: "listo", entregado: "entregado", cancelado: "cancelado" };

const hora = (f) => new Date(f).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

export function aPedidoDePicking(f) {
  return {
    id: `web-${f.id}`,
    webId: f.id,
    nro: `W-${String(f.numero).padStart(3, "0")}`,
    numero: f.numero,
    cliente: f.nombre,
    tel: f.telefono,
    dir: f.entrega === "envio" ? f.direccion || "" : "Retira en el local",
    canal: "Tienda online",
    entrega: f.entrega === "envio" ? "Envío" : "Retira",
    hora: hora(f.creado_en),
    nota: f.nota || "",
    estado: ESTADO_PICKING[f.estado] || "pendiente",
    envio: Number(f.envio) || 0,
    items: (f.lineas || []).map((l) => ({
      pid: l.item_id, nombre: l.nombre, barcode: l.barcode || "", precio: Number(l.precio), unidad: l.unidad === "kg" ? "kg" : "u",
      pedido: Number(l.cantidad), preparado: 0, faltante: 0,
    })),
  };
}
