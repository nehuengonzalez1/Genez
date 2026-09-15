/* ============================================================
   RECETAS · costo y producción por lotes
   ============================================================

   Para quien fabrica: el costo de un producto elaborado no se carga a
   mano, se arma desde sus insumos (ver 0076). Esto solo lee y escribe
   `recetas`/`receta_insumos` y llama a las dos funciones de la base
   (`costo_receta`, `producir_lote`) que hacen la cuenta real.
   ============================================================ */

import { supabase } from "./supabase.js";

export async function cargarRecetas(empresaId) {
  if (!empresaId) throw new Error("cargarRecetas necesita la empresa.");
  const { data, error } = await supabase
    .from("recetas")
    .select("id, nombre, tamano_lote, activa, item_id, items(nombre)")
    .eq("empresa_id", empresaId)
    .order("nombre");
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id, nombre: r.nombre, tamanoLote: Number(r.tamano_lote), activa: r.activa,
    itemId: r.item_id, itemNombre: (r.items || {}).nombre || "",
  }));
}

export async function cargarReceta(recetaId) {
  const [{ data: receta, error: e1 }, { data: insumos, error: e2 }] = await Promise.all([
    supabase.from("recetas").select("id, empresa_id, item_id, nombre, tamano_lote, activa").eq("id", recetaId).single(),
    supabase.from("receta_insumos").select("id, item_id, cantidad, items(nombre, costo, unidad)").eq("receta_id", recetaId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    id: receta.id, empresaId: receta.empresa_id, itemId: receta.item_id,
    nombre: receta.nombre, tamanoLote: Number(receta.tamano_lote), activa: receta.activa,
    insumos: (insumos || []).map((i) => ({
      id: i.id, itemId: i.item_id, cantidad: Number(i.cantidad),
      nombre: (i.items || {}).nombre || "", costo: Number((i.items || {}).costo) || 0,
      unidad: (i.items || {}).unidad || "un",
    })),
  };
}

/* insumos: [{ itemId, cantidad }]. Reemplaza la lista entera: es más
   simple que llevar la cuenta de qué línea es nueva, cuál cambió y cuál
   se borró para una receta que en general tiene pocos insumos. */
export async function guardarReceta({ id, empresaId, itemId, nombre, tamanoLote, insumos }) {
  if (!nombre || !nombre.trim()) throw new Error("La receta necesita un nombre.");
  if (!itemId) throw new Error("Elegí qué producto sale de esta receta.");
  if (!insumos || !insumos.length) throw new Error("Agregá al menos un insumo.");

  let recetaId = id;
  if (recetaId) {
    const { error } = await supabase.from("recetas")
      .update({ nombre, tamano_lote: tamanoLote, item_id: itemId })
      .eq("id", recetaId);
    if (error) throw error;
    const { error: eDel } = await supabase.from("receta_insumos").delete().eq("receta_id", recetaId);
    if (eDel) throw eDel;
  } else {
    const { data, error } = await supabase.from("recetas")
      .insert({ empresa_id: empresaId, item_id: itemId, nombre, tamano_lote: tamanoLote })
      .select("id").single();
    if (error) throw error;
    recetaId = data.id;
  }

  const filas = insumos.map((i) => ({
    empresa_id: empresaId, receta_id: recetaId, item_id: i.itemId, cantidad: i.cantidad,
  }));
  const { error: eIns } = await supabase.from("receta_insumos").insert(filas);
  if (eIns) throw eIns;

  return recetaId;
}

export async function darDeBajaReceta(recetaId) {
  const { error } = await supabase.from("recetas").update({ activa: false }).eq("id", recetaId);
  if (error) throw error;
}

export async function cargarCostoReceta(recetaId) {
  const { data, error } = await supabase.rpc("costo_receta", { p_receta: recetaId });
  if (error) throw error;
  const fila = (data || [])[0] || { costo_lote: 0, costo_unidad: 0, insumos_sin_costo: 0 };
  return {
    costoLote: Number(fila.costo_lote) || 0,
    costoUnidad: Number(fila.costo_unidad) || 0,
    insumosSinCosto: Number(fila.insumos_sin_costo) || 0,
  };
}

export async function producirLote(recetaId, sucursalId, lotes = 1) {
  const { error } = await supabase.rpc("producir_lote", {
    p_receta: recetaId, p_sucursal: sucursalId, p_lotes: lotes,
  });
  if (error) throw error;
}
