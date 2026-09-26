/* ============================================================
   CAJA GRANDE · la plata del negocio fuera de la caja del día
   ============================================================

   Tres cuentas (0095): el efectivo guardado, la cuenta de Mercado Pago y
   el banco. Entra sola desde cada cierre de caja y desde el cajón en el
   día; lo demás —pagos, retiros del dueño, aportes, pases entre cuentas y
   ajustes— se carga a mano.

   Es solo de agregar: no hay editar ni borrar. Un error se corrige con un
   ajuste, y así el saldo siempre es la suma de lo que pasó. La tabla la
   escriben solo las funciones de la base, que piden el permiso
   `cajaGrande`; leerla, también.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";

export const CUENTAS = [
  { k: "efectivo", n: "Efectivo", d: "El efectivo guardado, fuera del cajón" },
  { k: "mp", n: "Mercado Pago", d: "La cuenta de Mercado Pago" },
  { k: "banco", n: "Banco", d: "Lo que acreditan las tarjetas y las transferencias" },
];
export const nombreCuenta = (k) => (CUENTAS.find((c) => c.k === k) || { n: k }).n;

export const CATEGORIAS = {
  cierre: "Cierre de caja",
  desde_caja: "Desde el cajón",
  comision: "Comisión",
  pago: "Pago",
  retiro: "Retiro del dueño",
  aporte: "Aporte",
  transferencia: "Pase entre cuentas",
  ajuste: "Ajuste",
};

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

export async function cargarSaldos(empresaId) {
  const { data, error } = await supabase
    .from("caja_grande_saldos")
    .select("cuenta, saldo, ultimo")
    .eq("empresa_id", empresaId);
  if (error) throw error;
  const por = Object.fromEntries((data || []).map((f) => [f.cuenta, n(f.saldo)]));
  return Object.fromEntries(CUENTAS.map((c) => [c.k, por[c.k] || 0]));
}

export async function cargarMovimientosGrandes(empresaId, { cuenta = null, cuantos = 200 } = {}) {
  let q = supabase
    .from("caja_grande")
    .select("id, cuenta, tipo, monto, categoria, detalle, sesion_id, par_id, fecha, usuario:perfiles!usuario_id ( nombre )")
    .eq("empresa_id", empresaId)
    .order("fecha", { ascending: false })
    .limit(cuantos);
  if (cuenta) q = q.eq("cuenta", cuenta);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((f) => ({
    id: f.id,
    cuenta: f.cuenta,
    tipo: f.tipo,
    monto: n(f.monto),
    categoria: f.categoria,
    detalle: f.detalle || "",
    sesionId: f.sesion_id,
    parId: f.par_id,
    fecha: new Date(f.fecha),
    quien: (f.usuario && f.usuario.nombre) || "",
  }));
}

/* Un pago, un retiro del dueño, un aporte o un ajuste. */
export async function moverCajaGrande({ empresaId, cuenta, tipo, monto, categoria, detalle }) {
  const { error } = await supabase.rpc("mover_caja_grande", {
    p_empresa: empresaId, p_cuenta: cuenta, p_tipo: tipo,
    p_monto: Math.round(Number(monto) || 0), p_categoria: categoria, p_detalle: detalle,
  });
  if (error) throw new Error(error.message || "No se pudo guardar el movimiento.");
}

export async function transferirCajaGrande({ empresaId, desde, hacia, monto, detalle }) {
  const { error } = await supabase.rpc("transferir_caja_grande", {
    p_empresa: empresaId, p_desde: desde, p_hacia: hacia,
    p_monto: Math.round(Number(monto) || 0), p_detalle: detalle || null,
  });
  if (error) throw new Error(error.message || "No se pudo pasar la plata.");
}
