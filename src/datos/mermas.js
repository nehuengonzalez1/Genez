/* ============================================================
   MERMAS · lo que se pierde, y por qué (06/10)
   ============================================================

   Hasta ahora una baja de mercadería solo se podía hacer como conteo
   ("ajuste"): el stock quedaba bien pero no se sabía si fue una rotura,
   algo vencido o un robo, y el dueño no podía ver cuánto perdía. La base
   ya tenía el tipo `merma` y la columna `motivo` en movimientos_stock
   desde 0001; no había pantalla que los usara.

   El motivo se guarda como texto: "Rotura", "Vencido · lote de marzo".
   La primera parte es una de las de MOTIVOS_MERMA, y es por la que se
   agrupa el informe.
   ============================================================ */

import { supabase } from "./supabase.js";

export const MOTIVOS_MERMA = [
  ["Rotura", "Se rompió o se dañó"],
  ["Vencido", "Se venció y se tiró"],
  ["Robo o faltante", "No está y no se vendió"],
  ["Consumo propio", "Lo usó el negocio o el personal"],
  ["Otro", "Otro motivo"],
];

/* Una salida de stock con su motivo. La cantidad se guarda en negativo:
   el stock de items_vista es la suma de todos los movimientos. */
export async function registrarMerma({ empresaId, itemId, cantidad, motivo, nota = "", sucursalId = null }) {
  const c = Math.abs(Number(cantidad));
  if (!c) throw new Error("Falta la cantidad.");
  if (!MOTIVOS_MERMA.some(([m]) => m === motivo)) throw new Error("Elegí el motivo.");
  const texto = nota.trim() ? `${motivo} · ${nota.trim().slice(0, 120)}` : motivo;
  /* Quién la dio de baja: la columna no se llena sola, y "falta
     mercadería" sin saber quién la anotó no sirve para nada. */
  const { data: s } = await supabase.auth.getSession();
  const usuarioId = s && s.session ? s.session.user.id : null;
  const { error } = await supabase.from("movimientos_stock").insert({
    empresa_id: empresaId, item_id: itemId, cantidad: -c, tipo: "merma", motivo: texto, sucursal_id: sucursalId, usuario_id: usuarioId,
  });
  if (error) throw new Error(error.message || "No se pudo registrar la merma.");
}

/* Las mermas de los últimos `dias`, con el costo del producto para
   valuarlas. Se valúan al costo de hoy: el de ese día no se guarda en el
   movimiento, y para saber "cuánto pierdo" alcanza. */
export async function cargarMermas(empresaId, dias = 30) {
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const { data, error } = await supabase.from("movimientos_stock")
    .select("id, fecha, cantidad, motivo, item_id, items ( nombre, costo, unidad ), perfiles ( nombre )")
    .eq("empresa_id", empresaId).eq("tipo", "merma").gte("fecha", desde)
    .order("fecha", { ascending: false }).limit(1000);
  if (error) throw error;
  return (data || []).map((m) => {
    const motivo = String(m.motivo || "Otro");
    const grupo = (MOTIVOS_MERMA.find(([k]) => motivo.startsWith(k)) || ["Otro"])[0];
    const cantidad = Math.abs(Number(m.cantidad) || 0);
    const costo = m.items ? Number(m.items.costo) || 0 : 0;
    return {
      id: m.id, fecha: m.fecha, cantidad, motivo, grupo,
      nombre: m.items ? m.items.nombre : "(producto borrado)", unidad: m.items ? m.items.unidad : "",
      quien: m.perfiles ? m.perfiles.nombre : null,
      valor: Math.round(cantidad * costo),
    };
  });
}
