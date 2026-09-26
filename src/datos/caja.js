/* ============================================================
   CAJA · sesiones, movimientos y arqueo
   ============================================================

   La caja del día no es un número que se va sumando en pantalla: es la
   suma de sus movimientos, igual que el stock. Cada venta ya escribe los
   suyos —uno por medio de pago— desde la función que registra la venta.
   Acá se leen esos, y se agregan los que no vienen de vender: gastos,
   retiros, adelantos.

   El arqueo compara lo que el sistema dice que debería haber en efectivo
   contra lo que la persona contó. Para que esa comparación signifique
   algo, ninguno de los dos números puede estar inventado.
   ============================================================ */

import { supabase } from "./supabase.js";
import { hora } from "../utils/helpers.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

function aMovimiento(f) {
  return {
    id: f.id,
    tipo: f.tipo,
    medio: f.medio,
    monto: n(f.monto),
    detalle: f.detalle || "",
    /* La app viene llamando `clase` a lo que la base guarda como
       `categoria`: sirve para separar un gasto de un retiro. */
    clase: f.categoria || null,
    hora: hora(f.fecha),
    fecha: f.fecha,
    operacionId: f.operacion_id,
  };
}

/* La sesión abierta, si hay. Solo puede haber una por comercio: si
   quedaran dos, los movimientos de una venta no sabrían a cuál pertenecen. */
export async function sesionAbierta(empresaId) {
  const { data, error } = await supabase
    .from("sesiones_caja")
    .select("id, abierta_en, monto_inicial, sucursal_id")
    .eq("empresa_id", empresaId)
    .is("cerrada_en", null)
    .order("abierta_en", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data.length ? data[0] : null;
}

export async function abrirCaja({ empresaId, sucursalId = null, montoInicial = 0 }) {
  /* Abrir dos veces dejaría movimientos repartidos entre dos sesiones y
     ningún arqueo cerraría. Si ya hay una abierta, se sigue usando esa. */
  const abierta = await sesionAbierta(empresaId);
  if (abierta) return abierta;

  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("sesiones_caja")
    .insert({
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      monto_inicial: Math.round(montoInicial),
      abierta_por: user ? user.id : null,
    })
    .select("id, abierta_en, monto_inicial, sucursal_id")
    .single();

  if (error) throw error;
  return data;
}

/* El cierre con todos los medios (0095). `declarado` es lo que se contó o
   lo que dicen Mercado Pago y el posnet, por medio: { efectivo, mp, … }.
   `fondo` es el efectivo que queda en el cajón para mañana; el resto, y
   los demás medios, pasan a la caja grande en la misma transacción. Por
   eso ya no se cierra escribiendo la fila: tiene que pasar todo o nada. */
export async function cerrarCaja({ sesionId, declarado, fondo, notas = null }) {
  const limpio = Object.fromEntries(Object.entries(declarado || {})
    .filter(([, v]) => v !== "" && v !== null && v !== undefined && isFinite(Number(v)))
    .map(([k, v]) => [k, Math.round(Number(v))]));
  const { error } = await supabase.rpc("cerrar_caja", {
    p_sesion: sesionId,
    p_declarado: limpio,
    p_fondo: Math.round(Number(fondo) || 0),
    p_notas: notas,
  });
  if (error) throw new Error(error.message || "No se pudo cerrar la caja.");
}

/* Sacar efectivo del cajón en el día y guardarlo en la caja grande: un
   egreso de la caja del día y un ingreso de la grande, juntos. */
export async function pasarACajaGrande({ sesionId, monto, detalle }) {
  const { error } = await supabase.rpc("pasar_a_caja_grande", {
    p_sesion: sesionId, p_monto: Math.round(Number(monto) || 0), p_detalle: detalle || null,
  });
  if (error) throw new Error(error.message || "No se pudo pasar a la caja grande.");
}

export async function cargarMovimientos(sesionId) {
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("id, tipo, medio, monto, detalle, categoria, operacion_id, fecha")
    .eq("sesion_id", sesionId)
    .order("fecha", { ascending: true })
    .limit(5000);

  if (error) throw error;
  return (data || []).map(aMovimiento);
}

export async function registrarMovimiento({ empresaId, sucursalId = null, sesionId, tipo, medio = "efectivo", monto, detalle, clase = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("movimientos_caja")
    .insert({
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      sesion_id: sesionId,
      tipo,
      medio,
      monto: Math.round(monto),
      detalle,
      categoria: clase,
      usuario_id: user ? user.id : null,
    })
    .select("id, tipo, medio, monto, detalle, categoria, operacion_id, fecha")
    .single();

  if (error) throw error;
  return aMovimiento(data);
}

/* Los cierres anteriores, para el historial de arqueos. */
export async function cargarCierres(empresaId, cuantos = 30) {
  const { data, error } = await supabase
    .from("sesiones_caja")
    .select("id, abierta_en, cerrada_en, monto_inicial, monto_declarado, declarado, fondo_siguiente, notas")
    .eq("empresa_id", empresaId)
    .not("cerrada_en", "is", null)
    .order("cerrada_en", { ascending: false })
    .limit(cuantos);

  if (error) throw error;
  return data || [];
}

/* Arma el objeto `caja` con la forma que ya usa la aplicación, para que
   la pantalla de arqueo no tenga que aprender el esquema nuevo. */
export async function cargarCaja(empresaId) {
  const sesion = await sesionAbierta(empresaId);
  if (!sesion) {
    return { abierta: false, sesionId: null, saldoInicial: 0, hora: null, movimientos: [], cierres: [] };
  }
  return {
    abierta: true,
    sesionId: sesion.id,
    saldoInicial: n(sesion.monto_inicial),
    hora: hora(sesion.abierta_en),
    movimientos: await cargarMovimientos(sesion.id),
    cierres: [],
  };
}
