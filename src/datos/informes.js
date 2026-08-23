/* ============================================================
   INFORMES · qué pasó, y dónde habría que actuar
   ============================================================

   El informe del minimercado responde "qué se vende y qué margen deja".
   Acá las preguntas son otras, y un informe no existe para mostrar datos
   sino para ayudar a decidir. Cada bloque contesta una:

     Indicadores    ¿cómo está el negocio?
     Insights       ¿qué está pasando?
     Evolución      ¿cómo cambió?
     Fuentes        ¿de dónde viene la plata?
     Prestaciones   ¿qué estoy vendiendo?
     Ocupación      ¿estoy aprovechando la capacidad?
     Asistencia     ¿la gente viene?
     Equipo         ¿cómo trabaja cada uno?
     Clientes       ¿estoy creciendo?
     Atención       ¿dónde tengo que actuar?

   UN SOLO CONTEXTO
   ----------------
   El rango de fechas, la comparación y los filtros son de la pantalla
   entera. Ninguna tarjeta consulta por su cuenta: se arma todo de una y
   la vista dibuja. Dos tarjetas que muestren períodos distintos del mismo
   negocio es la forma más rápida de que nadie vuelva a confiar en el
   informe.

   Son siete lecturas en paralelo y no una por tarjeta.

   LO QUE NO SE PUEDE FILTRAR, SE DICE
   -----------------------------------
   Los egresos viven en `movimientos_caja` y no tienen área ni
   profesional: un alquiler no es de pilates ni de estética. Por eso el
   resultado neto y la curva de egresos son siempre del negocio entero, y
   cuando hay un filtro puesto la pantalla lo aclara en vez de mostrar un
   número que parece filtrado y no lo está.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";
import { cargarSegmentos } from "./crm.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));
const suma = (xs, f) => xs.reduce((s, x) => s + n(f(x)), 0);
const dia = 86400000;

/* Sin base contra la que comparar no hay variación. Un "+100%" contra
   cero no informa nada y encima alarma. */
const variacion = (ahora, antes) => (antes > 0 ? ahora / antes - 1 : null);

const iso = (d) => d.toISOString().slice(0, 10);

const alArrancar = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const alTerminar = (d) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

/* ------------------------------------------------------------
   El período
   ------------------------------------------------------------ */

export const PERIODOS = [
  { k: "hoy", n: "Hoy" },
  { k: "ayer", n: "Ayer" },
  { k: "7d", n: "Últimos 7 días" },
  { k: "30d", n: "Últimos 30 días" },
  { k: "mes", n: "Este mes" },
  { k: "mesAnterior", n: "Mes anterior" },
  { k: "anio", n: "Este año" },
  { k: "libre", n: "Personalizado" },
];

export function rangoDe(clave, hoy = new Date()) {
  const h = alArrancar(hoy);
  const y = h.getFullYear();
  const m = h.getMonth();

  switch (clave) {
    case "hoy": return { desde: h, hasta: alTerminar(h) };
    case "ayer": {
      const a = new Date(h.getTime() - dia);
      return { desde: a, hasta: alTerminar(a) };
    }
    case "7d": return { desde: new Date(h.getTime() - 6 * dia), hasta: alTerminar(h) };
    case "30d": return { desde: new Date(h.getTime() - 29 * dia), hasta: alTerminar(h) };
    case "mes": return { desde: new Date(y, m, 1), hasta: alTerminar(h) };
    case "mesAnterior": return { desde: new Date(y, m - 1, 1), hasta: alTerminar(new Date(y, m, 0)) };
    case "anio": return { desde: new Date(y, 0, 1), hasta: alTerminar(h) };
    default: return { desde: new Date(h.getTime() - 29 * dia), hasta: alTerminar(h) };
  }
}

export const COMPARACIONES = [
  { k: "anterior", n: "Período anterior" },
  { k: "anioAnterior", n: "Mismo período del año anterior" },
  { k: "libre", n: "Personalizado" },
  { k: "sin", n: "Sin comparación" },
];

/* El período anterior es tan largo como el elegido y termina justo antes.
   Un mes de 31 días se compara contra 31 días y no contra "el mes pasado"
   a secas: si no, febrero siempre parece peor que enero. */
export function comparacionDe(modo, desde, hasta, libre) {
  if (modo === "sin") return null;
  if (modo === "libre") return libre && libre.desde && libre.hasta ? libre : null;

  if (modo === "anioAnterior") {
    const d = new Date(desde); d.setFullYear(d.getFullYear() - 1);
    const h = new Date(hasta); h.setFullYear(h.getFullYear() - 1);
    return { desde: d, hasta: h };
  }

  const largo = alArrancar(hasta).getTime() - alArrancar(desde).getTime() + dia;
  return {
    desde: new Date(alArrancar(desde).getTime() - largo),
    hasta: alTerminar(new Date(alArrancar(desde).getTime() - dia)),
  };
}

/* Cómo se agrupa la curva. Un año en barras diarias son 365 puntos que no
   se leen; una semana en barras mensuales es un punto. Se elige solo y se
   puede cambiar a mano. */
export function granoSugerido(desde, hasta) {
  const dias = Math.round((alArrancar(hasta) - alArrancar(desde)) / dia) + 1;
  if (dias <= 31) return "dia";
  if (dias <= 180) return "semana";
  return "mes";
}

export const ESTADOS_TURNO = [
  { k: "cumplida", n: "Asistieron", tono: "bien" },
  { k: "ausente", n: "No vinieron", tono: "mal" },
  { k: "cancelada", n: "Cancelados", tono: "tenue" },
  { k: "confirmada", n: "Confirmados", tono: "info" },
  { k: "pendiente", n: "Sin confirmar", tono: "ojo" },
];

/* ------------------------------------------------------------
   Las lecturas
   ------------------------------------------------------------ */

/* Los egresos no tienen área ni profesional, así que este bloque nunca se
   filtra. Es a propósito y la pantalla lo dice. */
async function caja(empresaId, desde, hasta) {
  const { data, error } = await supabase
    .from("movimientos_caja")
    .select("tipo, monto, categoria, fecha, operacion_id")
    .eq("empresa_id", empresaId)
    .gte("fecha", desde.toISOString())
    .lte("fecha", hasta.toISOString())
    .limit(20000);
  if (error) throw error;
  return data || [];
}

async function lineas(empresaId, desde, hasta, filtros) {
  let q = supabase
    .from("operacion_lineas")
    .select("descripcion, cantidad, total, item_id, items(categoria, tipo), operaciones!inner(id, fecha, estado, tipo, cliente_id)")
    .eq("empresa_id", empresaId)
    .eq("operaciones.estado", "confirmada")
    .in("operaciones.tipo", ["venta", "comanda"])
    .gte("operaciones.fecha", desde.toISOString())
    .lte("operaciones.fecha", hasta.toISOString())
    .limit(20000);

  if (filtros.item) q = q.eq("item_id", filtros.item);
  const { data, error } = await q;
  if (error) throw error;

  /* El área se filtra acá y no en la consulta porque vive en el item
     enlazado, y filtrar por una tabla anidada obligaría a un `inner` que
     tiraría las líneas sin item —las de un concepto suelto— que también
     son plata que entró. */
  return (data || []).filter((l) =>
    !filtros.area || (l.items && l.items.categoria === filtros.area));
}

async function agenda(empresaId, desde, hasta, filtros) {
  let q = supabase
    .from("agenda_vista")
    .select("id, desde, estado, forma, cliente_id, cliente, servicio, area, profesional, personal_id, sala, recurso_id, item_id, duracion_min")
    .eq("empresa_id", empresaId)
    .gte("desde", desde.toISOString())
    .lte("desde", hasta.toISOString())
    .order("desde")
    .limit(20000);

  if (filtros.personal) q = q.eq("personal_id", filtros.personal);
  if (filtros.item) q = q.eq("item_id", filtros.item);
  if (filtros.recurso) q = q.eq("recurso_id", filtros.recurso);
  if (filtros.area) q = q.eq("area", filtros.area);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

const limpio = (f) => Object.fromEntries(
  Object.entries(f || {}).filter(([, v]) => v !== null && v !== undefined && v !== ""));

async function ocupacion(empresaId, desde, hasta, filtros) {
  const { data, error } = await supabase.rpc("informe_ocupacion", {
    p_empresa: empresaId, p_desde: iso(desde), p_hasta: iso(hasta), p_filtros: limpio(filtros),
  });
  if (error) throw error;
  return data || [];
}

async function equipo(empresaId, desde, hasta, filtros) {
  const { data, error } = await supabase.rpc("informe_equipo", {
    p_empresa: empresaId, p_desde: iso(desde), p_hasta: iso(hasta), p_filtros: limpio(filtros),
  });
  if (error) throw error;
  return data || [];
}

async function altas(empresaId, desde, hasta) {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, creado_en")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .gte("creado_en", desde.toISOString())
    .lte("creado_en", hasta.toISOString())
    .limit(5000);
  if (error) throw error;
  return data || [];
}

/* Lo que hay para elegir en los filtros. Sale del catálogo del comercio y
   no de lo que aparezca en el período: un servicio que no se vendió este
   mes tiene que poder elegirse, justamente para ver que no se vendió. */
async function opciones(empresaId) {
  const [items, personal, recursos] = await Promise.all([
    supabase.from("items").select("id, nombre, categoria, tipo")
      .eq("empresa_id", empresaId).eq("activo", true).in("tipo", ["servicio", "plan"]).order("nombre"),
    supabase.from("personal").select("id, nombre")
      .eq("empresa_id", empresaId).eq("activo", true).eq("tipo", "profesional").order("orden"),
    supabase.from("recursos").select("id, nombre")
      .eq("empresa_id", empresaId).eq("activo", true).order("orden"),
  ]);
  if (items.error) throw items.error;
  if (personal.error) throw personal.error;
  if (recursos.error) throw recursos.error;

  const areas = [...new Set((items.data || []).map((i) => i.categoria).filter(Boolean))].sort();
  return {
    areas: areas.map((a) => ({ k: a, n: a })),
    profesionales: (personal.data || []).map((p) => ({ k: p.id, n: p.nombre })),
    servicios: (items.data || []).map((i) => ({ k: i.id, n: i.nombre })),
    salas: (recursos.data || []).map((r) => ({ k: r.id, n: r.nombre })),
  };
}

/* ------------------------------------------------------------
   El informe
   ------------------------------------------------------------ */

export async function cargarInforme(empresaId, { desde, hasta, comparar = null, filtros = {}, grano = null } = {}) {
  if (!empresaId) throw new Error("cargarInforme necesita saber de qué comercio.");
  if (!desde || !hasta) throw new Error("cargarInforme necesita un desde y un hasta.");

  const d = alArrancar(desde);
  const h = alTerminar(hasta);
  const f = limpio(filtros);
  const hayFiltro = Object.keys(f).length > 0;

  /* El período de comparación se lee en la misma tanda. Cuando no hay
     comparación se pide igual un rango vacío para no ramificar la
     cantidad de consultas según la opción elegida. */
  const c = comparar ? { desde: alArrancar(comparar.desde), hasta: alTerminar(comparar.hasta) } : null;
  const desdeTodo = c ? new Date(Math.min(d.getTime(), c.desde.getTime())) : d;
  const hastaTodo = c ? new Date(Math.max(h.getTime(), c.hasta.getTime())) : h;

  const [mov, lin, age, ocu, eq, nuevos, opc, segmentos] = await Promise.all([
    caja(empresaId, desdeTodo, hastaTodo),
    lineas(empresaId, desdeTodo, hastaTodo, f),
    agenda(empresaId, desdeTodo, hastaTodo, f),
    ocupacion(empresaId, d, h, f),
    equipo(empresaId, d, h, f),
    altas(empresaId, desdeTodo, hastaTodo),
    opciones(empresaId),
    /* Las oportunidades no dependen del período: son el estado del
       negocio hoy. Se piden acá igual para no hacer una consulta suelta
       desde la pantalla. */
    cargarSegmentos(empresaId).catch(() => []),
  ]);

  const enRango = (fecha, r) => {
    const t = new Date(fecha).getTime();
    return t >= r.desde.getTime() && t <= r.hasta.getTime();
  };
  const actual = { desde: d, hasta: h };

  const movAhora = mov.filter((x) => enRango(x.fecha, actual));
  const linAhora = lin.filter((x) => enRango(x.operaciones.fecha, actual));
  const ageAhora = age.filter((x) => enRango(x.desde, actual));
  const nuevosAhora = nuevos.filter((x) => enRango(x.creado_en, actual));

  const movAntes = c ? mov.filter((x) => enRango(x.fecha, c)) : [];
  const linAntes = c ? lin.filter((x) => enRango(x.operaciones.fecha, c)) : [];
  const ageAntes = c ? age.filter((x) => enRango(x.desde, c)) : [];
  const nuevosAntes = c ? nuevos.filter((x) => enRango(x.creado_en, c)) : [];

  const ocuArmada = armarOcupacion(ocu);
  const ingresos = armarIngresos(linAhora, linAntes, c);
  const asistencia = armarAsistencia(ageAhora, ageAntes, c);
  const finanzas = armarFinanzas(movAhora, movAntes, c);
  const clientes = armarClientes(ageAhora, ageAntes, nuevosAhora, nuevosAntes, c);
  const equipoArmado = armarEquipo(eq, ocuArmada);
  const { porDia, horasPorServicio, horasTotales } = armarCarga(ageAhora);

  const base = {
    desde: d,
    hasta: h,
    comparar: c,
    hayFiltro,
    grano: grano || granoSugerido(d, h),
    opciones: opc,
    generado: new Date(),

    kpis: {
      ingresos: { valor: ingresos.total, delta: ingresos.delta },
      resultado: { valor: finanzas.resultado, delta: finanzas.deltaResultado },
      turnos: { valor: asistencia.total, delta: asistencia.deltaTurnos },
      ocupacion: { valor: ocuArmada.promedio, delta: null },
      clientes: { valor: clientes.activos, delta: clientes.deltaActivos },
      ticket: { valor: ingresos.ticket, delta: ingresos.deltaTicket },
    },

    evolucion: armarEvolucion(movAhora, d, h, grano || granoSugerido(d, h)),
    ingresos,
    finanzas,
    ocupacion: ocuArmada,
    asistencia,
    equipo: equipoArmado,
    clientes,
    porDia,
    horasPorServicio,
    horasTotales,
  };

  /* Los insights se calculan al final porque leen el informe ya armado:
     no hay un motor aparte ni una consulta más. Si un número no está, el
     insight no aparece. */
  return {
    ...base,
    insights: armarInsights(base),
    oportunidades: armarOportunidades(segmentos),
  };
}

/* Cuánto se trabajó, repartido por día de la semana y por prestación.
   Las inscripciones no suman horas: la clase ocupa su hora una vez, la
   den dos personas o seis. Mismo criterio que la ocupación y que las
   liquidaciones. */
function armarCarga(agenda) {
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const dictado = agenda.filter((t) => t.forma !== "inscripcion" && t.estado !== "cancelada");

  const porDia = DIAS.map((nombre, i) => ({
    i, nombre,
    turnos: agenda.filter((t) => t.forma !== "clase" && t.estado !== "cancelada" && new Date(t.desde).getDay() === i).length,
  })).filter((x) => x.turnos > 0);

  const horasPorServicio = new Map();
  for (const t of dictado) {
    const k = t.servicio || "Sin prestación";
    horasPorServicio.set(k, (horasPorServicio.get(k) || 0) + n(t.duracion_min) / 60);
  }

  return {
    porDia,
    horasPorServicio,
    horasTotales: suma(dictado, (t) => t.duracion_min) / 60,
  };
}

/* ------------------------------------------------------------
   1 · De dónde viene la plata
   ------------------------------------------------------------ */

function armarIngresos(ahora, antes, hayComparacion) {
  const total = suma(ahora, (l) => l.total);
  const totalAntes = suma(antes, (l) => l.total);

  const esPlan = (l) => l.items && l.items.tipo === "plan";
  const esProducto = (l) => l.items && l.items.tipo === "producto";

  const abonos = suma(ahora.filter(esPlan), (l) => l.total);
  const productos = suma(ahora.filter(esProducto), (l) => l.total);
  const turnos = suma(ahora.filter((l) => l.items && l.items.tipo === "servicio"), (l) => l.total);
  const otros = total - abonos - productos - turnos;

  const porArea = new Map();
  const porServicio = new Map();
  for (const l of ahora) {
    const area = (l.items && l.items.categoria) || "Sin área";
    porArea.set(area, (porArea.get(area) || 0) + n(l.total));
    const s = porServicio.get(l.descripcion) || { nombre: l.descripcion, cantidad: 0, total: 0, plan: esPlan(l) };
    s.cantidad += n(l.cantidad);
    s.total += n(l.total);
    porServicio.set(l.descripcion, s);
  }

  /* El ticket se cuenta por operación y no por línea: un pack vendido
     junto con una crema bajaría el promedio sin que nadie haya gastado
     menos. */
  const ops = new Set(ahora.map((l) => l.operaciones.id));
  const opsAntes = new Set(antes.map((l) => l.operaciones.id));
  const ticket = ops.size ? Math.round(total / ops.size) : 0;
  const ticketAntes = opsAntes.size ? totalAntes / opsAntes.size : 0;

  /* Solo se muestran las fuentes que existen: un anillo con tres porciones
     en cero es ruido con forma de gráfico. */
  const fuentes = [
    { k: "turnos", n: "Turnos", v: turnos, tono: "acento" },
    { k: "abonos", n: "Abonos y packs", v: abonos, tono: "info" },
    { k: "productos", n: "Productos", v: productos, tono: "bien" },
    { k: "otros", n: "Otros", v: Math.max(0, otros), tono: "tenue" },
  ].filter((x) => x.v > 0);

  return {
    total,
    delta: hayComparacion ? variacion(total, totalAntes) : null,
    ticket,
    deltaTicket: hayComparacion ? variacion(ticket, ticketAntes) : null,
    operaciones: ops.size,
    fuentes,
    porArea: [...porArea.entries()].map(([nombre, t]) => ({ nombre, total: t })).sort((a, b) => b.total - a.total),
    porServicio: [...porServicio.values()].sort((a, b) => b.total - a.total),
  };
}

/* ------------------------------------------------------------
   2 · Ingresos, egresos y resultado
   ------------------------------------------------------------ */

function armarFinanzas(ahora, antes, hayComparacion) {
  const entra = (xs) => suma(xs.filter((m) => m.tipo === "ingreso"), (m) => m.monto);
  const sale = (xs) => suma(xs.filter((m) => m.tipo === "egreso"), (m) => m.monto);

  const ingresos = entra(ahora);
  const egresos = sale(ahora);
  const resultado = ingresos - egresos;
  const resultadoAntes = entra(antes) - sale(antes);

  const porCategoria = new Map();
  for (const m of ahora.filter((x) => x.tipo === "egreso")) {
    const k = m.categoria || "otros";
    porCategoria.set(k, (porCategoria.get(k) || 0) + n(m.monto));
  }

  return {
    ingresos,
    egresos,
    resultado,
    deltaResultado: hayComparacion ? variacion(resultado, resultadoAntes) : null,
    margen: ingresos > 0 ? resultado / ingresos : null,
    egresosPorCategoria: [...porCategoria.entries()]
      .map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total),
  };
}

function armarEvolucion(movs, desde, hasta, grano) {
  const clave = (f) => {
    const d = new Date(f);
    if (grano === "mes") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (grano === "semana") {
      const l = alArrancar(d);
      l.setDate(l.getDate() - ((l.getDay() + 6) % 7));   // al lunes
      return iso(l);
    }
    return iso(alArrancar(d));
  };

  const rotulo = (k) => {
    if (grano === "mes") {
      const [a, m] = k.split("-");
      return new Date(Number(a), Number(m) - 1, 1)
        .toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
    }
    const d = new Date(`${k}T12:00:00`);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  };

  const cubos = new Map();
  for (const m of movs) {
    const k = clave(m.fecha);
    const c = cubos.get(k) || { k, ingresos: 0, egresos: 0 };
    if (m.tipo === "ingreso") c.ingresos += n(m.monto);
    else c.egresos += n(m.monto);
    cubos.set(k, c);
  }

  return [...cubos.values()]
    .sort((a, b) => (a.k < b.k ? -1 : 1))
    .map((c) => ({ label: rotulo(c.k), ...c, resultado: c.ingresos - c.egresos }));
}

/* ------------------------------------------------------------
   3 · La capacidad
   ------------------------------------------------------------ */

function armarOcupacion(filas) {
  const armar = (f) => ({
    id: f.id,
    nombre: f.nombre,
    detalle: f.detalle || "",
    horasOfrecidas: n(f.ofrecidos) / 60,
    horasOcupadas: n(f.ocupados) / 60,
    pct: n(f.ofrecidos) > 0 ? n(f.ocupados) / n(f.ofrecidos) : null,
    lugares: n(f.lugares),
    tomados: n(f.tomados),
    pctCupo: n(f.lugares) > 0 ? n(f.tomados) / n(f.lugares) : null,
  });

  const profesionales = filas.filter((f) => f.ambito === "profesional").map(armar)
    .sort((a, b) => (b.pct || 0) - (a.pct || 0));
  const salas = filas.filter((f) => f.ambito === "sala").map(armar)
    .sort((a, b) => (b.pct || 0) - (a.pct || 0));

  /* El promedio se pondera por horas ofrecidas: alguien que trabaja
     cuatro horas por semana no puede mover el número del equipo igual que
     alguien de tiempo completo. */
  const ofrecidas = suma(profesionales, (p) => p.horasOfrecidas);
  const promedio = ofrecidas > 0 ? suma(profesionales, (p) => p.horasOcupadas) / ofrecidas : 0;

  const lugares = suma(profesionales, (p) => p.lugares);
  const tomados = suma(profesionales, (p) => p.tomados);

  return {
    profesionales,
    salas,
    promedio,
    clases: { lugares, tomados, pct: lugares > 0 ? tomados / lugares : null },
  };
}

/* ------------------------------------------------------------
   4 · ¿Vienen?
   ------------------------------------------------------------ */

function armarAsistencia(ahora, antes, hayComparacion) {
  /* Las clases no se cuentan: la clase no falta ni viene, faltan o vienen
     los inscriptos. Contarlas mezcla dos unidades. */
  const turnos = ahora.filter((t) => t.forma !== "clase");
  const turnosAntes = antes.filter((t) => t.forma !== "clase");
  const ya = Date.now();
  const pasados = turnos.filter((t) => new Date(t.desde).getTime() < ya);

  const cuenta = (k) => pasados.filter((t) => t.estado === k).length;
  const cumplidas = cuenta("cumplida");
  const ausentes = cuenta("ausente");
  const canceladas = cuenta("cancelada");
  const base = cumplidas + ausentes;

  const porServicio = new Map();
  for (const t of pasados) {
    const k = t.servicio || "Sin prestación";
    const s = porServicio.get(k) || { nombre: k, area: t.area || "", total: 0, vino: 0, falto: 0 };
    s.total += 1;
    if (t.estado === "cumplida") s.vino += 1;
    if (t.estado === "ausente") s.falto += 1;
    porServicio.set(k, s);
  }

  return {
    total: turnos.length,
    deltaTurnos: hayComparacion ? variacion(turnos.length, turnosAntes.length) : null,
    pasados: pasados.length,
    cumplidas,
    ausentes,
    canceladas,
    /* Sobre vinieron + faltaron: una cancelación avisada a tiempo no es
       una inasistencia, es un turno que se pudo volver a vender. */
    pct: base > 0 ? cumplidas / base : null,
    porEstado: ESTADOS_TURNO
      .map((e) => ({ ...e, v: turnos.filter((t) => t.estado === e.k).length }))
      .filter((e) => e.v > 0),
    porServicio: [...porServicio.values()]
      .filter((s) => s.vino + s.falto >= 3)
      .map((s) => ({ ...s, pct: s.vino / (s.vino + s.falto) }))
      .sort((a, b) => a.pct - b.pct),
  };
}

/* ------------------------------------------------------------
   5 · El equipo
   ------------------------------------------------------------ */

function armarEquipo(filas, ocu) {
  const porId = new Map(ocu.profesionales.map((p) => [p.id, p]));

  return (filas || []).map((f) => {
    const o = porId.get(f.personal_id);
    const base = n(f.cumplidos) + n(f.ausentes);
    return {
      id: f.personal_id,
      nombre: f.nombre,
      especialidad: f.especialidad || "",
      turnos: n(f.turnos),
      clases: n(f.clases),
      alumnos: n(f.alumnos),
      asistencia: base > 0 ? n(f.cumplidos) / base : null,
      /* Lo cobrado derecho al turno más la parte del abono que consumió
         cada clase. La regla está explicada en la pantalla. */
      ingresos: n(f.directo) + n(f.por_abono),
      directo: n(f.directo),
      porAbono: n(f.por_abono),
      ocupacion: o ? o.pct : null,
      horasOcupadas: o ? o.horasOcupadas : 0,
    };
  }).sort((a, b) => b.ingresos - a.ingresos);
}

/* ------------------------------------------------------------
   6 · La gente
   ------------------------------------------------------------ */

function armarClientes(agenda, agendaAntes, nuevos, nuevosAntes, hayComparacion) {
  /* Activo es quien efectivamente vino, no quien tiene un turno tomado:
     la agenda llena de gente que no aparece no es un negocio que crece. */
  const distintos = (xs) => {
    const veces = new Map();
    for (const t of xs.filter((r) => r.estado === "cumplida" && r.cliente_id)) {
      veces.set(t.cliente_id, (veces.get(t.cliente_id) || 0) + 1);
    }
    return veces;
  };

  const veces = distintos(agenda);
  const vecesAntes = distintos(agendaAntes);

  return {
    nuevos: nuevos.length,
    deltaNuevos: hayComparacion ? variacion(nuevos.length, nuevosAntes.length) : null,
    activos: veces.size,
    deltaActivos: hayComparacion ? variacion(veces.size, vecesAntes.size) : null,
    recurrentes: [...veces.values()].filter((v) => v >= 2).length,
  };
}

/* ------------------------------------------------------------
   7 · Lo que hay que mirar

   Insights y oportunidades salen del mismo informe que ya se calculó: no
   hay una consulta más ni un motor aparte. Cada uno nace de un número
   concreto y si ese número no existe, el insight no aparece. Ninguno se
   escribe "por las dudas".

   La diferencia entre los dos bloques: un insight explica lo que pasó en
   el período; una oportunidad es algo para hacer hoy, y por eso sale de
   `crm_segmentos`, que mira el estado actual del negocio y no la ventana
   elegida. Está dicho en la pantalla.
   ------------------------------------------------------------ */

const pctTexto = (v) => (v * 100).toFixed(0).replace(".", ",") + "%";

export function armarInsights(d) {
  const xs = [];

  /* Crecer en turnos y caer en ticket es la historia que más veces se
     lee mal: más trabajo por menos plata. Se dice junta o no se dice. */
  if (d.comparar && d.asistencia.deltaTurnos !== null && d.kpis.ticket.delta !== null) {
    const t = d.asistencia.deltaTurnos;
    const k = d.kpis.ticket.delta;
    if (Math.abs(t) >= 0.05 || Math.abs(k) >= 0.05) {
      xs.push({
        k: "turnos-ticket",
        tono: t >= 0 && k < 0 ? "ojo" : t >= 0 ? "bien" : "mal",
        texto: `Los turnos ${t >= 0 ? "crecieron" : "cayeron"} ${pctTexto(Math.abs(t))} respecto al período anterior` +
          (Math.abs(k) >= 0.03
            ? `, y el ticket promedio ${k >= 0 ? "subió" : "cayó"} ${pctTexto(Math.abs(k))}.`
            : "."),
        accion: "Ver evolución",
        ancla: "evolucion",
      });
    }
  }

  /* Qué día de la semana rinde menos. Se compara contra el promedio de
     los días que el negocio abre, no contra los siete: incluir el domingo
     cerrado haría que todos los días parezcan buenos. */
  if (d.porDia && d.porDia.length >= 3) {
    const activos = d.porDia.filter((x) => x.turnos > 0);
    const prom = suma(activos, (x) => x.turnos) / Math.max(1, activos.length);
    const peor = activos.slice().sort((a, b) => a.turnos - b.turnos)[0];
    if (peor && prom > 0 && peor.turnos < prom * 0.8) {
      xs.push({
        k: "dia-flojo",
        tono: "ojo",
        texto: `Los ${peor.nombre} tienen ${pctTexto(1 - peor.turnos / prom)} menos turnos que el promedio de la semana.`,
        accion: "Ver la agenda",
        tab: "agenda",
      });
    }
  }

  /* La prestación que sostiene el negocio. Con su parte de las horas al
     lado: no es lo mismo que la mitad de los ingresos venga de algo que
     ocupa un quinto del tiempo que de algo que ocupa la mitad. */
  const top = d.ingresos.porServicio[0];
  if (top && d.ingresos.total > 0) {
    const parte = top.total / d.ingresos.total;
    if (parte >= 0.2) {
      const horas = d.horasPorServicio && d.horasPorServicio.get(top.nombre);
      const totalHoras = d.horasTotales || 0;
      xs.push({
        k: "concentracion",
        tono: parte >= 0.5 ? "ojo" : "info",
        texto: `${top.nombre} genera el ${pctTexto(parte)} de los ingresos` +
          (horas && totalHoras > 0 ? ` y ocupa el ${pctTexto(horas / totalHoras)} de las horas dictadas.` : "."),
        accion: "Ver prestaciones",
        ancla: "prestaciones",
      });
    }
  }

  /* Dónde se está yendo la agenda. Solo si hay suficientes turnos como
     para que el porcentaje signifique algo. */
  if (d.asistencia.pct !== null && d.asistencia.pasados >= 20 && d.asistencia.pct < 0.85) {
    xs.push({
      k: "asistencia",
      tono: "mal",
      texto: `${d.asistencia.ausentes} de cada ${d.asistencia.cumplidas + d.asistencia.ausentes} turnos terminaron en ausencia: ${pctTexto(1 - d.asistencia.pct)} del total.`,
      accion: "Mandar recordatorios",
      tab: "comunicaciones",
    });
  }

  /* Capacidad ociosa. El número que define si conviene abrir otra clase
     o cerrar una sala. */
  const flojos = d.ocupacion.profesionales.filter((p) => p.pct !== null && p.pct < 0.5);
  if (flojos.length && d.ocupacion.profesionales.length > 1) {
    xs.push({
      k: "ocupacion",
      tono: "ojo",
      texto: flojos.length === 1
        ? `${flojos[0].nombre} tiene ${pctTexto(1 - flojos[0].pct)} de su horario sin usar.`
        : `${flojos.length} profesionales tienen más de la mitad de su horario sin usar.`,
      accion: "Ver ocupación",
      ancla: "ocupacion",
    });
  }

  return xs;
}

/* Las oportunidades salen enteras de CRM: los segmentos ya están
   calculados, probados y con su acción detrás. Rehacerlos acá sería tener
   dos definiciones de "cliente que se está yendo" y que un día dejen de
   coincidir. */
export function armarOportunidades(segmentos) {
  const tono = { se_van: "mal", sin_segunda: "ojo", abono_por_vencer: "info", abono_vencido: "ojo", falta_seguido: "tenue" };
  return (segmentos || [])
    .filter((s) => s.gente.length > 0)
    .map((s) => ({
      k: s.k,
      tono: tono[s.k] || "tenue",
      texto: `${s.gente.length} ${s.gente.length === 1 ? "cliente" : "clientes"}: ${s.n.toLowerCase()}.`,
      detalle: s.d,
      accion: "Ver en CRM",
      tab: "crm",
    }));
}
