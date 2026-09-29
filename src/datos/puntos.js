/* ============================================================
   PUNTOS · el saldo y las correcciones (0112)
   ============================================================

   El saldo lo calcula la base (saldo_puntos), por lotes: lo que vence se
   pierde, lo gastado sale de lo más viejo. Sin internet la consulta
   falla y el mostrador sigue cobrando, sin ofrecer el canje: frenar una
   venta por no poder consultar puntos es peor que no canjearlos una vez.
   ============================================================ */

import { supabase } from "./supabase.js";

export async function saldoDePuntos(clienteId) {
  const { data, error } = await supabase.rpc("saldo_puntos", { p_cliente: clienteId });
  if (error) throw error;
  const f = (data || [])[0] || {};
  return { saldo: Number(f.saldo) || 0, porVencer: Number(f.por_vencer) || 0, proximoVencimiento: f.proximo_vencimiento || null };
}

export async function ajustarPuntos(clienteId, puntos, detalle) {
  const { error } = await supabase.rpc("ajustar_puntos", { p_cliente: clienteId, p_puntos: Math.round(Number(puntos)), p_detalle: detalle });
  if (error) throw new Error(error.message || "No se pudieron corregir los puntos.");
}

export async function movimientosDePuntos(clienteId) {
  const { data, error } = await supabase.from("puntos_movimientos")
    .select("id, puntos, tipo, vence, detalle, sin_saldo, fecha, operacion_id")
    .eq("cliente_id", clienteId).order("fecha", { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []).map((m) => ({ ...m, fecha: new Date(m.fecha) }));
}
