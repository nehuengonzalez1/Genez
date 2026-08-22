/* ============================================================
   FINANZAS · lo que entra, lo que sale y lo que falta cobrar
   ============================================================

   La caja del día ya la resuelve `caja.js`: apertura, arqueo y cierre.
   Acá está lo que la excede — el mes, los movimientos de cualquier fecha,
   lo que falta cobrar y lo que se le paga al equipo.

   Una aclaración que importa: **un egreso no necesita caja abierta**.
   Pagarle a un profesor por transferencia un lunes no es un movimiento
   del cajón del mostrador, y obligar a abrir la caja para eso sería
   inventar un arqueo que no existió. Por eso `sesion_id` puede ir en null.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));
const suma = (xs, f) => xs.reduce((s, x) => s + n(f(x)), 0);

export const CATEGORIAS_EGRESO = [
  { k: "sueldos", n: "Sueldos" },
  { k: "alquiler", n: "Alquiler" },
  { k: "servicios", n: "Servicios" },
  { k: "insumos", n: "Insumos" },
  { k: "impuestos", n: "Impuestos" },
  { k: "mantenimiento", n: "Mantenimiento" },
  { k: "otros", n: "Otros" },
];

export const CATEGORIAS_INGRESO = [
  { k: "turnos", n: "Turnos" },
  { k: "abonos", n: "Abonos" },
  { k: "productos", n: "Productos" },
  { k: "otros", n: "Otros" },
];

export const nombreCategoria = (k) =>
  (CATEGORIAS_EGRESO.find((c) => c.k === k) || CATEGORIAS_INGRESO.find((c) => c.k === k) || { n: k || "Sin categoría" }).n;

function aMovimiento(f) {
  return {
    id: f.id,
    tipo: f.tipo,
    medio: f.medio,
    monto: n(f.monto),
    detalle: f.detalle || "",
    categoria: f.categoria || null,
    operacionId: f.operacion_id || null,
    sesionId: f.sesion_id || null,
    fecha: new Date(f.fecha),
  };
}

export async function cargarMovimientos(empresaId, { desde, hasta, tipo = null, categoria = null } = {}) {
  if (!empresaId) throw new Error("cargarMovimientos necesita saber de qué comercio.");
  if (!desde || !hasta) throw new Error("cargarMovimientos necesita un desde y un hasta.");

  let q = supabase
    .from("movimientos_caja")
    .select("id, tipo, medio, monto, detalle, categoria, operacion_id, sesion_id, fecha")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde.toISOString())
    .lt("fecha", hasta.toISOString())
    .order("fecha", { ascending: false })
    .limit(3000);

  if (tipo) q = q.eq("tipo", tipo);
  if (categoria) q = q.eq("categoria", categoria);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(aMovimiento);
}

/* Un movimiento suelto: un gasto, un ingreso que no vino de una venta.
   Sin sesión es un movimiento del mes y no del cajón: así entra un
   alquiler pagado por transferencia sin tener que abrir la caja. */
export async function registrarMovimiento({ empresaId, sucursalId = null, sesionId = null, tipo, medio = "efectivo", monto, detalle, categoria = null, fecha = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("movimientos_caja").insert({
    empresa_id: empresaId,
    sucursal_id: sucursalId,
    sesion_id: sesionId,
    tipo,
    medio,
    monto: Math.round(Number(monto) || 0),
    detalle,
    categoria,
    usuario_id: user ? user.id : null,
    ...(fecha ? { fecha: fecha.toISOString() } : {}),
  });
  if (error) throw error;
}

/* ------------------------------------------------------------
   El mes

   Se traen dos meses de una y se parten acá: es una sola consulta en vez
   de dos, y la comparación contra el mes anterior sale gratis.
   ------------------------------------------------------------ */

export async function resumenDelMes(empresaId, mes = new Date()) {
  if (!empresaId) throw new Error("resumenDelMes necesita saber de qué comercio.");

  const desde = new Date(mes.getFullYear(), mes.getMonth() - 1, 1);
  const hasta = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
  const corte = new Date(mes.getFullYear(), mes.getMonth(), 1);

  const movs = await cargarMovimientos(empresaId, { desde, hasta });
  const esteMes = movs.filter((m) => m.fecha >= corte);
  const anterior = movs.filter((m) => m.fecha < corte);

  const cuenta = (xs) => {
    const ingresos = xs.filter((m) => m.tipo === "ingreso");
    const egresos = xs.filter((m) => m.tipo === "egreso");
    return {
      ingresos: suma(ingresos, (m) => m.monto),
      egresos: suma(egresos, (m) => m.monto),
      movimientos: xs.length,
    };
  };

  const a = cuenta(esteMes);
  const b = cuenta(anterior);

  const agrupar = (xs, por) => {
    const m = new Map();
    for (const x of xs) {
      const k = por(x) || "otros";
      m.set(k, (m.get(k) || 0) + x.monto);
    }
    return [...m.entries()].map(([k, total]) => ({ k, total })).sort((x, y) => y.total - x.total);
  };

  return {
    ingresos: a.ingresos,
    egresos: a.egresos,
    resultado: a.ingresos - a.egresos,
    movimientos: a.movimientos,
    previo: { ingresos: b.ingresos, egresos: b.egresos, resultado: b.ingresos - b.egresos },
    /* Sin base contra la que comparar no hay variación: un "+100%" contra
       cero no informa nada y encima alarma. */
    variacion: b.ingresos > 0 ? a.ingresos / b.ingresos - 1 : null,
    porMedio: agrupar(esteMes.filter((m) => m.tipo === "ingreso"), (m) => m.medio),
    porCategoria: agrupar(esteMes.filter((m) => m.tipo === "egreso"), (m) => m.categoria),
    /* Los últimos, para el resumen. */
    ultimos: esteMes.slice(0, 8),
  };
}

/* ------------------------------------------------------------
   Lo que falta cobrar

   El saldo se calcula: total de la operación menos lo pagado. No hay una
   columna "saldo" a propósito, porque un número copiado se desincroniza
   apenas alguien registre un pago a mano.
   ------------------------------------------------------------ */

export async function cargarPendientes(empresaId, { dias = 180 } = {}) {
  if (!empresaId) throw new Error("cargarPendientes necesita saber de qué comercio.");

  const desde = new Date(Date.now() - dias * 86400000);
  const { data, error } = await supabase
    .from("operaciones")
    .select("id, total, fecha, numero, cliente_id, clientes(razon_social), pagos(monto)")
    .eq("empresa_id", empresaId)
    .in("tipo", ["venta", "comanda"])
    .eq("estado", "confirmada")
    .gte("fecha", desde.toISOString())
    .order("fecha", { ascending: false })
    .limit(2000);
  if (error) throw error;

  return (data || [])
    .map((o) => ({
      id: o.id,
      numero: o.numero || "",
      fecha: new Date(o.fecha),
      cliente: (o.clientes && o.clientes.razon_social) || "Sin cliente",
      clienteId: o.cliente_id || null,
      total: n(o.total),
      pagado: suma(o.pagos || [], (p) => p.monto),
      falta: n(o.total) - suma(o.pagos || [], (p) => p.monto),
    }))
    /* El peso de tolerancia evita arrastrar centavos de redondeo como si
       fueran una deuda. */
    .filter((o) => o.falta > 1)
    .sort((a, b) => a.fecha - b.fecha);
}

/* ------------------------------------------------------------
   Liquidaciones
   ------------------------------------------------------------ */

const MOTIVOS = {
  P0038: "No podés liquidar en ese comercio.",
  P0060: "No existe esa persona.",
  P0061: "Esa liquidación ya está pagada.",
  P0062: "No existe esa liquidación.",
};

const traducir = (e) => new Error((e && MOTIVOS[e.code]) || (e && e.message) || "No se pudo.");

function aLiquidacion(f) {
  return {
    id: f.id,
    personalId: f.personal_id,
    persona: f.persona,
    tipoPersona: f.tipo_persona,
    especialidad: f.especialidad || "",
    desde: new Date(`${f.desde}T12:00:00`),
    hasta: new Date(`${f.hasta}T12:00:00`),
    modalidad: f.modalidad,
    valor: n(f.valor),
    horas: n(f.horas),
    clases: n(f.clases),
    ajuste: n(f.ajuste),
    total: n(f.total),
    aPagar: n(f.a_pagar),
    estado: f.estado,
    medio: f.medio || null,
    notas: n(f.notas),
    pagadaEn: f.pagada_en ? new Date(f.pagada_en) : null,
  };
}

export async function cargarLiquidaciones(empresaId, { desde, hasta } = {}) {
  if (!empresaId) throw new Error("cargarLiquidaciones necesita saber de qué comercio.");

  let q = supabase.from("liquidaciones_vista").select("*").eq("empresa_id", empresaId);
  if (desde) q = q.gte("desde", desde);
  if (hasta) q = q.lte("hasta", hasta);

  const { data, error } = await q.order("desde", { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []).map(aLiquidacion);
}

/* Arma o recalcula el borrador de un período con lo que diga la agenda.
   Las horas quedan editables: la agenda no sabe que se quedó media hora
   más ordenando. */
export async function liquidar(personalId, desde, hasta) {
  const { data, error } = await supabase.rpc("liquidar", {
    p_personal: personalId, p_desde: desde, p_hasta: hasta,
  });
  if (error) throw traducir(error);
  return data;
}

export async function ajustarLiquidacion(id, { horas = null, ajuste = null, valor = null }) {
  const fila = {};
  if (horas !== null) fila.horas = horas;
  if (ajuste !== null) fila.ajuste = ajuste;
  if (valor !== null) fila.valor = valor;
  if (!Object.keys(fila).length) return;

  /* El total se recalcula acá y no en la base: al corregir las horas a
     mano, lo que se está corrigiendo es el cálculo, no el dato. */
  const { data: actual, error: e1 } = await supabase
    .from("liquidaciones").select("modalidad, valor, horas, clases").eq("id", id).single();
  if (e1) throw e1;

  const v = fila.valor !== undefined ? fila.valor : n(actual.valor);
  const h = fila.horas !== undefined ? fila.horas : n(actual.horas);
  fila.total = actual.modalidad === "hora" ? Math.round(h * v)
    : actual.modalidad === "clase" ? n(actual.clases) * v
    : actual.modalidad === "fijo" ? v
    : 0;

  const { error } = await supabase.from("liquidaciones").update(fila).eq("id", id);
  if (error) throw traducir(error);
}

export async function pagarLiquidacion(id, medio, sesionId = null) {
  const { error } = await supabase.rpc("pagar_liquidacion", {
    p_id: id, p_medio: medio, p_sesion: sesionId,
  });
  if (error) throw traducir(error);
}

export async function cargarNotas(empresaId, liquidacionId) {
  const { data, error } = await supabase
    .from("liquidacion_notas")
    .select("id, texto, creada_en")
    .eq("empresa_id", empresaId)
    .eq("liquidacion_id", liquidacionId)
    .order("creada_en");
  if (error) throw error;
  return (data || []).map((x) => ({ id: x.id, texto: x.texto, fecha: new Date(x.creada_en) }));
}

export async function anotar(empresaId, liquidacionId, texto) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("liquidacion_notas").insert({
    empresa_id: empresaId, liquidacion_id: liquidacionId,
    texto, usuario_id: user ? user.id : null,
  });
  if (error) throw error;
}

/* La semana de una fecha, de lunes a domingo, que es como la cuenta la
   gente y como la cuenta el tope de los abonos. */
export function semanaDe(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  const lunes = new Date(x.getTime() - (dow === 0 ? 6 : dow - 1) * 86400000);
  const domingo = new Date(lunes.getTime() + 6 * 86400000);
  const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  return { desde: iso(lunes), hasta: iso(domingo), lunes, domingo };
}
