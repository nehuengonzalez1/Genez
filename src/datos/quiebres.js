/* ============================================================
   QUIEBRES DE STOCK (0134)
   ============================================================

   Qué productos se quedaron sin stock en el período, cuántos días, y
   cuánto se dejó de vender. La cuenta la hace la base
   (quiebres_de_stock) reconstruyendo el stock de cada día con los
   movimientos; acá se le suman el nombre, el precio y el costo de hoy.

   La venta perdida es una estimación: días en falta × lo que se vende un
   día con stock, al precio de hoy. Sin días con stock para medirlo, no se
   estima (perdidas null): mejor un "—" que un número inventado.
   ============================================================ */

import { supabase } from "./supabase.js";
import { diaISO } from "./ventas.js";

export async function cargarQuiebres(empresaId, desde, hasta) {
  const { data, error } = await supabase.rpc("quiebres_de_stock", { p_empresa: empresaId, p_desde: diaISO(desde), p_hasta: diaISO(hasta) });
  if (error) throw error;
  const filas = data || [];
  if (!filas.length) return [];
  const { data: items, error: e2 } = await supabase.from("items").select("id, nombre, precio, costo, categoria").in("id", filas.map((f) => f.item_id));
  if (e2) throw e2;
  const porId = new Map((items || []).map((i) => [i.id, i]));
  return filas.map((f) => {
    const i = porId.get(f.item_id) || {};
    const precio = Number(i.precio) || 0, costo = Number(i.costo) || 0;
    const perdidas = f.unidades_perdidas == null ? null : Number(f.unidades_perdidas);
    return {
      id: f.item_id, nombre: i.nombre || "Producto", categoria: i.categoria || "",
      diasSinStock: f.dias_sin_stock, diasContados: f.dias_contados, diasVendiendoEnCero: f.dias_vendiendo_en_cero,
      ventaDiaria: f.venta_diaria == null ? null : Number(f.venta_diaria),
      perdidas, ventaPerdida: perdidas == null ? null : Math.round(perdidas * precio),
      gananciaPerdida: perdidas == null || !costo ? null : Math.round(perdidas * (precio - costo)),
      /* Texto AAAA-MM-DD: como Date caería al día anterior en Buenos Aires. */
      sinStockDesde: f.sin_stock_desde ? String(f.sin_stock_desde).slice(0, 10) : null,
      stock: Number(f.stock) || 0,
    };
  }).sort((a, b) => (b.ventaPerdida ?? -1) - (a.ventaPerdida ?? -1) || b.diasSinStock - a.diasSinStock);
}
