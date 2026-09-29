/* ============================================================
   SUCURSALES · leer, crear, cambiar y pasar mercadería (0108)
   ============================================================

   La sucursal de una venta no la elige nadie en el mostrador: sale de la
   caja donde se cobró, y eso lo resuelve la base. Acá está lo que sí se
   elige a mano: las sucursales mismas, y el pase de mercadería de una a
   otra.
   ============================================================ */

import { supabase } from "./supabase.js";

const aSucursal = (f) => ({ id: f.id, nombre: f.nombre, domicilio: f.domicilio || "", activa: f.activa !== false });

export async function cargarSucursales(empresaId) {
  if (!empresaId) throw new Error("cargarSucursales necesita la empresa.");
  const { data, error } = await supabase.from("sucursales").select("id, nombre, domicilio, activa")
    .eq("empresa_id", empresaId).order("creada_en").order("id");
  if (error) throw error;
  return (data || []).map(aSucursal);
}

const traducir = (error) => {
  if (error.code === "23505") return new Error("Ya hay una sucursal con ese nombre.");
  if (/row-level security/i.test(error.message || "")) return new Error("Cambiar las sucursales necesita el permiso de configurar el comercio.");
  return new Error(error.message || "No se pudo guardar la sucursal.");
};

export async function crearSucursal(empresaId, { nombre, domicilio = "" }) {
  const { error } = await supabase.from("sucursales").insert({ empresa_id: empresaId, nombre: nombre.trim(), domicilio: domicilio.trim() || null });
  if (error) throw traducir(error);
}

export async function editarSucursal(id, cambios) {
  const fila = {};
  if (cambios.nombre !== undefined) fila.nombre = cambios.nombre.trim();
  if (cambios.domicilio !== undefined) fila.domicilio = cambios.domicilio.trim() || null;
  if (cambios.activa !== undefined) fila.activa = !!cambios.activa;
  const { error } = await supabase.from("sucursales").update(fila).eq("id", id);
  if (error) throw traducir(error);
}

/* El stock de cada producto en cada sucursal: Map item → { sucursal → n }.
   El total de todas sigue viniendo en el producto (items_vista). */
export async function cargarStockPorSucursal(empresaId) {
  const porItem = new Map();
  /* De a mil: PostgREST corta ahí, y un almacén con 1.500 productos en
     dos sucursales pasa de largo. */
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase.from("stock_actual").select("item_id, sucursal_id, stock")
      .eq("empresa_id", empresaId).range(desde, desde + 999);
    if (error) throw error;
    for (const f of data || []) {
      const m = porItem.get(f.item_id) || porItem.set(f.item_id, {}).get(f.item_id);
      m[f.sucursal_id] = Number(f.stock) || 0;
    }
    if (!data || data.length < 1000) break;
  }
  return porItem;
}

export async function transferirStock({ itemId, cantidad, desde, hacia, nota = null }) {
  const { error } = await supabase.rpc("transferir_stock", {
    p_item: itemId, p_cantidad: Number(cantidad), p_desde: desde, p_hacia: hacia, p_nota: nota || null,
  });
  if (error) throw new Error(error.message || "No se pudo pasar la mercadería.");
}

/* El conteo de inventario (0109): lo contado en esta sucursal. La base
   calcula la diferencia contra lo que hay en ese momento y la guarda como
   ajuste. Devuelve { antes, diferencia }. */
export async function guardarConteo({ itemId, real, sucursalId = null, motivo = null }) {
  const { data, error } = await supabase.rpc("ajustar_stock", {
    p_item: itemId, p_real: Number(real), p_sucursal: sucursalId, p_motivo: motivo,
  });
  if (error) throw new Error(error.message || "No se pudo guardar el ajuste.");
  const f = (data || [])[0] || {};
  return { antes: Number(f.antes) || 0, diferencia: Number(f.diferencia) || 0 };
}
