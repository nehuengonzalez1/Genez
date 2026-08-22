/* ============================================================
   ABONOS · el crédito de un cliente
   ============================================================

   Un pack de ocho clases, una cuota mensual, un plan de dos por semana.
   Los tres son lo mismo: crédito comprado ahora y consumido después. Ver
   la migración 0035 para por qué los planes son items del catálogo y por
   qué el saldo no se guarda sino que se cuenta.

   El crédito se descuenta **al reservar**, no al asistir. Es lo que hace
   que "dos por semana" se pueda hacer cumplir: si se descontara al venir,
   el tope no se puede controlar en el momento en que importa.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

export const ESTADOS_ABONO = [
  { k: "activo", n: "Activo", tono: "bien" },
  { k: "consumido", n: "Sin clases", tono: "ojo" },
  { k: "vencido", n: "Vencido", tono: "mal" },
  { k: "anulado", n: "Anulado", tono: "tenue" },
];

export const estadoAbono = (k) => ESTADOS_ABONO.find((e) => e.k === k) || { k, n: k, tono: "tenue" };

function aAbono(f) {
  return {
    id: f.id,
    clienteId: f.cliente_id,
    cliente: f.cliente || "",
    itemId: f.item_id || null,
    operacionId: f.operacion_id || null,
    nombre: f.nombre,
    area: f.area || "",
    /* En null es libre: no se cuentan clases, se controla con el tope y
       la vigencia. */
    clases: f.clases,
    usadas: n(f.usadas),
    restantes: f.restantes === null || f.restantes === undefined ? null : n(f.restantes),
    topeSemanal: f.tope_semanal,
    desde: f.desde ? new Date(`${f.desde}T12:00:00`) : null,
    vence: f.vence ? new Date(`${f.vence}T12:00:00`) : null,
    estado: f.estado,
    notas: f.notas || "",
    creado: f.creado_en ? new Date(f.creado_en) : null,
  };
}

export async function cargarAbonos(empresaId, { clienteId = null, soloActivos = false } = {}) {
  if (!empresaId) throw new Error("cargarAbonos necesita saber de qué comercio.");

  let q = supabase.from("abonos_vista").select("*").eq("empresa_id", empresaId);
  if (clienteId) q = q.eq("cliente_id", clienteId);
  q = q.order("creado_en", { ascending: false }).limit(1000);

  const { data, error } = await q;
  if (error) throw error;

  const xs = (data || []).map(aAbono);
  return soloActivos ? xs.filter((a) => a.estado === "activo") : xs;
}

/* Los planes del catálogo. Son items como cualquier otro, con sus
   condiciones en `campos_extra`: cuántas clases da, cuánto dura y cuántas
   veces por semana se puede usar. */
export async function cargarPlanes(empresaId) {
  if (!empresaId) throw new Error("cargarPlanes necesita saber de qué comercio.");

  const { data, error } = await supabase
    .from("items")
    .select("id, nombre, precio, categoria, activo, campos_extra")
    .eq("empresa_id", empresaId)
    .eq("tipo", "plan")
    .order("nombre");
  if (error) throw error;

  return (data || []).map((i) => ({
    id: i.id,
    nombre: i.nombre,
    precio: n(i.precio),
    categoria: i.categoria || "",
    activo: i.activo,
    clases: i.campos_extra && i.campos_extra.clases != null ? Number(i.campos_extra.clases) : null,
    vigenciaDias: i.campos_extra && i.campos_extra.vigenciaDias != null ? Number(i.campos_extra.vigenciaDias) : null,
    topeSemanal: i.campos_extra && i.campos_extra.topeSemanal != null ? Number(i.campos_extra.topeSemanal) : null,
  }));
}

export async function guardarPlan(empresaId, plan) {
  const fila = {
    empresa_id: empresaId,
    tipo: "plan",
    nombre: plan.nombre,
    precio: Number(plan.precio) || 0,
    categoria: plan.categoria || null,
    controla_stock: false,
    activo: plan.activo !== false,
    campos_extra: {
      clases: plan.clases === "" || plan.clases == null ? null : Number(plan.clases),
      vigenciaDias: plan.vigenciaDias === "" || plan.vigenciaDias == null ? null : Number(plan.vigenciaDias),
      topeSemanal: plan.topeSemanal === "" || plan.topeSemanal == null ? null : Number(plan.topeSemanal),
    },
  };

  if (plan.id) {
    const { error } = await supabase.from("items").update(fila).eq("id", plan.id);
    if (error) throw error;
    return plan.id;
  }

  const { data, error } = await supabase.from("items").insert(fila).select("id").single();
  if (error) throw error;
  return data.id;
}

const MOTIVOS = {
  P0038: "No podés vender en ese comercio.",
  P0050: "Un abono necesita un cliente: es de alguien.",
  P0051: "Ese cliente no es de este comercio.",
  P0052: "Ese plan no existe en el catálogo.",
  P0053: "No existe ese abono.",
  P0054: "Ese abono está anulado.",
  P0055: "Ese abono es de otra persona.",
  P0056: "Ese abono ya venció.",
  P0057: "Ese abono todavía no arrancó.",
  P0058: "Ese abono ya no tiene clases.",
  P0059: "Ese plan no permite tantas veces por semana.",
};

function traducir(error) {
  const codigo = error && error.code;
  /* El mensaje de la base ya viene armado con el número —"Ese plan
     permite 2 por semana"— así que si lo tenemos, gana sobre el genérico. */
  if (codigo && MOTIVOS[codigo] && error.message && /\d/.test(error.message)) return new Error(error.message);
  return new Error(MOTIVOS[codigo] || (error && error.message) || "No se pudo.");
}

/* Cobra el plan y crea el crédito en una transacción. Por dentro pasa por
   `registrar_venta`, el mismo camino que cualquier venta: la operación,
   la línea, el pago y el movimiento de caja quedan como corresponde.

   Sin caja abierta la base lo rechaza, igual que cualquier cobro. */
export async function venderAbono({
  empresaId, clienteId, itemId = null, sucursalId = null, sesionId = null,
  precio = null, nombre = null, clases = null, topeSemanal = null,
  vigenciaDias = null, pagos = [], notas = "",
}) {
  const { data, error } = await supabase.rpc("vender_abono", {
    p: {
      empresa_id: empresaId,
      cliente_id: clienteId,
      item_id: itemId,
      sucursal_id: sucursalId,
      sesion_id: sesionId,
      precio,
      nombre,
      clases,
      tope_semanal: topeSemanal,
      vigencia_dias: vigenciaDias,
      pagos,
      notas,
    },
  });
  if (error) throw traducir(error);
  return data;
}

/* No se borra: puede tener turnos tomados atrás, y borrarlo los dejaría
   sin crédito de dónde salieron. */
export async function anularAbono(id) {
  const { error } = await supabase.from("abonos").update({ anulado: true }).eq("id", id);
  if (error) throw error;
}

/* Los turnos que salieron de un abono, para poder mirar en qué se gastó. */
export async function cargarConsumos(empresaId, abonoId) {
  const { data, error } = await supabase
    .from("agenda_vista")
    .select("id, desde, estado, servicio, profesional, sala")
    .eq("empresa_id", empresaId)
    .eq("abono_id", abonoId)
    .order("desde", { ascending: false });
  if (error) throw error;
  return (data || []).map((t) => ({
    id: t.id,
    desde: new Date(t.desde),
    estado: t.estado,
    servicio: t.servicio || "",
    profesional: t.profesional || "",
    sala: t.sala || "",
  }));
}
