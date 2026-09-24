/* ============================================================
   CUENTA CORRIENTE · el fiado
   ============================================================

   Quién debe, el estado de cuenta de cada uno, cobrar, anular y ajustar.
   Todo lo que escribe pasa por funciones de la base (0085): las tablas
   no se dejan escribir desde el navegador, así que un pago no se puede
   borrar con un delete y la deuda no reaparece sin rastro.

   El saldo no se guarda en ningún lado: lo calcula `saldo_cliente` cada
   vez, de las ventas fiadas, los pagos y los ajustes. Por eso el mismo
   número aparece igual en el cobro, en la ficha del cliente y acá.
   ============================================================ */

import { supabase } from "./supabase.js";

const num = (v) => Number(v) || 0;

export async function cargarDeudores(empresaId) {
  if (!empresaId) throw new Error("cargarDeudores necesita la empresa.");
  const { data, error } = await supabase.rpc("deudores", { p_empresa: empresaId });
  if (error) throw error;
  return (data || []).map((d) => ({
    clienteId: d.cliente_id,
    nombre: d.razon_social,
    tel: d.tel || "",
    saldo: num(d.saldo),
    limite: d.limite == null ? null : num(d.limite),
    ultimaCompra: d.ultima_compra ? new Date(d.ultima_compra) : null,
    ultimoPago: d.ultimo_pago ? new Date(d.ultimo_pago) : null,
  }));
}

export async function cargarResumenCuentas(empresaId, desde, hasta) {
  if (!empresaId) throw new Error("cargarResumenCuentas necesita la empresa.");
  const { data, error } = await supabase.rpc("resumen_cuenta_corriente", {
    p_empresa: empresaId, p_desde: desde.toISOString(), p_hasta: hasta.toISOString(),
  });
  if (error) throw error;
  const r = (data && data[0]) || {};
  return {
    fiado: num(r.fiado), cobrado: num(r.cobrado), cargos: num(r.cargos), descuentos: num(r.descuentos),
    enLaCalle: num(r.en_la_calle), deudores: num(r.deudores),
  };
}

export async function saldoDe(clienteId) {
  const { data, error } = await supabase.rpc("saldo_cliente", { p_cliente: clienteId });
  if (error) throw error;
  return num(data);
}

/* Cada movimiento con el saldo que deja. Lo anulado se muestra —tachado,
   con su motivo— pero no suma: un estado de cuenta que esconde lo
   anulado no le explica nada a nadie. */
export async function cargarEstadoDeCuenta(clienteId) {
  const { data, error } = await supabase.rpc("estado_de_cuenta", { p_cliente: clienteId });
  if (error) throw error;
  let saldo = 0;
  return (data || []).map((m) => {
    const debe = num(m.debe);
    const haber = num(m.haber);
    if (!m.anulado) saldo += debe - haber;
    return {
      id: m.id, fecha: new Date(m.fecha), tipo: m.tipo, detalle: m.detalle,
      debe, haber, medio: m.medio, anulado: !!m.anulado, motivo: m.motivo || "",
      usuario: m.usuario || "", saldo,
    };
  });
}

export async function cobrarCuenta(clienteId, sesionId, monto, medio, notas = null) {
  if (!sesionId) throw new Error("Abrí la caja antes de cobrar: es plata que entra al cajón.");
  const { data, error } = await supabase.rpc("registrar_pago_cuenta_corriente", {
    p_cliente: clienteId, p_sesion: sesionId, p_monto: monto, p_medio: medio, p_notas: notas,
  });
  if (error) throw error;
  return data;
}

export async function anularPago(pagoId, sesionId, motivo) {
  if (!sesionId) throw new Error("Abrí la caja antes de anular un pago: la plata tiene que salir de algún cajón.");
  const { error } = await supabase.rpc("anular_pago_cuenta_corriente", { p_pago: pagoId, p_sesion: sesionId, p_motivo: motivo });
  if (error) throw error;
}

export async function ajustarCuenta(clienteId, tipo, monto, motivo) {
  const { data, error } = await supabase.rpc("ajustar_cuenta_corriente", {
    p_cliente: clienteId, p_tipo: tipo, p_monto: monto, p_motivo: motivo,
  });
  if (error) throw error;
  return data;
}

export async function anularAjuste(ajusteId, motivo) {
  const { error } = await supabase.rpc("anular_ajuste_cuenta_corriente", { p_ajuste: ajusteId, p_motivo: motivo });
  if (error) throw error;
}

/* Solo esta columna, y aparte de guardar la ficha: la base la cuida con
   su propio permiso (0085), y mezclarla con el teléfono o el domicilio
   haría fallar una edición inocente por un campo que nadie tocó. */
export async function fijarLimite(clienteId, limite) {
  const { error } = await supabase.from("clientes").update({ limite_credito: limite }).eq("id", clienteId);
  if (error) throw error;
}

/* El límite, leído de la tabla: la vista de clientes que usa la ficha se
   armó antes de que la columna existiera y no lo trae. */
export async function limiteDe(clienteId) {
  const { data, error } = await supabase.from("clientes").select("limite_credito").eq("id", clienteId).maybeSingle();
  if (error) throw error;
  return data && data.limite_credito != null ? Number(data.limite_credito) : null;
}
