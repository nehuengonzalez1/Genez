/* ============================================================
   SUCURSALES · leer, crear, cambiar y pasar mercadería (0108)
   ============================================================

   La sucursal de una venta no la elige nadie en el mostrador: sale de la
   caja donde se cobró, y eso lo resuelve la base. Acá está lo que sí se
   elige a mano: las sucursales mismas, y el pase de mercadería de una a
   otra.
   ============================================================ */

import { supabase } from "./supabase.js";
import { cargarSerieDiaria } from "./ventas.js";
import { traerTodo } from "./items.js";

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

/* El stock inicial por planilla (0110): muchos conteos en una sola
   transacción cada mil. Si una fila está mal, ese lote no queda a medias.
   Devuelve [{ itemId, antes, diferencia }]. */
export async function guardarConteoLote(filas, { sucursalId = null, motivo = null } = {}) {
  const hechos = [];
  for (let i = 0; i < filas.length; i += 1000) {
    const lote = filas.slice(i, i + 1000).map((f) => ({ item_id: f.itemId, real: Number(f.real) }));
    const { data, error } = await supabase.rpc("ajustar_stock_lote", { p_filas: lote, p_sucursal: sucursalId, p_motivo: motivo });
    if (error) throw new Error((error.message || "No se pudo cargar el stock.") + (hechos.length ? ` Ya habían quedado cargados ${hechos.length}.` : ""));
    for (const r of data || []) hechos.push({ itemId: r.item_id, antes: Number(r.antes) || 0, diferencia: Number(r.diferencia) || 0 });
  }
  return hechos;
}

/* EL COMPARATIVO DE SUCURSALES (06/10)

   Cada sucursal en el período y en el anterior del mismo largo, con la
   misma serie que el resto de Informes (ventas_diarias_rango con
   p_sucursal): así la suma de las sucursales da lo que dice "Todas". Una
   consulta por sucursal y período: son pocas, y no hace falta otra
   función en la base.

   El stock de cada una se valoriza al costo de hoy, con stock_actual. Lo
   negativo no resta: un stock en menos es un número mal contado, no
   mercadería que se debe. */
export async function cargarComparativo(empresaId, sucursales, actual, previo) {
  const sumar = (serie) => serie.reduce((s, d) => ({ ventas: s.ventas + d.ventas, costo: s.costo + d.costo, tickets: s.tickets + d.tickets }), { ventas: 0, costo: 0, tickets: 0 });
  const [series, stock, costos] = await Promise.all([
    Promise.all(sucursales.map((s) => Promise.all([
      cargarSerieDiaria(empresaId, { ...actual, sucursal: s.id }),
      cargarSerieDiaria(empresaId, { ...previo, sucursal: s.id }),
    ]))),
    cargarStockPorSucursal(empresaId).catch(() => new Map()),
    traerTodo("items", "id, costo", (q) => q.eq("empresa_id", empresaId)).catch(() => []),
  ]);
  const costoDe = new Map(costos.map((i) => [i.id, Number(i.costo) || 0]));
  const valor = {};
  for (const [item, porSuc] of stock) {
    for (const [suc, n] of Object.entries(porSuc)) if (n > 0) valor[suc] = (valor[suc] || 0) + n * (costoDe.get(item) || 0);
  }
  return sucursales.map((s, i) => ({
    id: s.id, nombre: s.nombre,
    ahora: sumar(series[i][0]), antes: sumar(series[i][1]),
    stock: Math.round(valor[s.id] || 0),
  }));
}
