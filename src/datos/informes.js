/* ============================================================
   INFORMES · lo que pasó, para un negocio que vende horas
   ============================================================

   El informe del minimercado responde "qué se vende y qué margen deja".
   Acá las preguntas son otras cuatro, y en este orden:

     1. Cuánto entró, y de dónde.
     2. Cuánto de lo que se podía vender se vendió.
     3. Cuánta de la gente que sacó turno vino.
     4. Quién es esa gente: cuántos nuevos, cuántos vuelven, cuántos se
        fueron sin avisar.

   Las tres primeras se leen de tablas que ya existen. La ocupación no:
   cruza cinco tablas y recorre el período día por día, así que la
   resuelve `informe_ocupacion` en la base. Ver la migración 0042.

   Todas las consultas filtran por `empresa_id` explícito (regla 6), y
   las funciones revientan si no lo reciben: un id olvidado tiene que
   fallar acá y no convertirse en los números de otro negocio.

   LA FECHA ES LA DE VERDAD
   ------------------------
   Nada de `HOY` congelado. Este módulo no toca el generador: si un dato
   no está en la base, no está.
   ============================================================ */

import { supabase } from "./supabase.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));
const suma = (xs, f) => xs.reduce((s, x) => s + n(f(x)), 0);
const dia = 86400000;

/* Sin base contra la que comparar no hay variación. Un "+100%" contra
   cero no informa nada y encima alarma. Mismo criterio que el tablero. */
const variacion = (ahora, antes) => (antes > 0 ? ahora / antes - 1 : null);

export const PERIODOS = [
  { k: 7, n: "7 días" },
  { k: 30, n: "30 días" },
  { k: 90, n: "90 días" },
];

/* Los cinco estados de un turno, en el orden en que se leen. `cumplida`
   y `ausente` son las dos caras de lo mismo y por eso van juntas. */
export const ESTADOS_TURNO = [
  { k: "cumplida", n: "Vinieron", tono: "bien" },
  { k: "ausente", n: "No vinieron", tono: "mal" },
  { k: "cancelada", n: "Cancelaron", tono: "tenue" },
  { k: "confirmada", n: "Confirmados", tono: "info" },
  { k: "pendiente", n: "Sin confirmar", tono: "ojo" },
];

/* ------------------------------------------------------------
   Las lecturas
   ------------------------------------------------------------ */

/* Se traen dos períodos de una y se parten en memoria: es una consulta en
   vez de dos y la comparación sale gratis. */
async function lineasVendidas(empresaId, desde, hasta) {
  const { data, error } = await supabase
    .from("operacion_lineas")
    .select("descripcion, cantidad, total, item_id, items(categoria, tipo), operaciones!inner(fecha, estado, tipo, cliente_id)")
    .eq("empresa_id", empresaId)
    .eq("operaciones.estado", "confirmada")
    .in("operaciones.tipo", ["venta", "comanda"])
    .gte("operaciones.fecha", desde.toISOString())
    .lt("operaciones.fecha", hasta.toISOString())
    .limit(6000);
  if (error) throw error;
  return data || [];
}

/* La agenda del período y de los seis meses previos: los previos no se
   dibujan, sirven para saber quién ya venía. Sin eso no se puede
   distinguir un cliente nuevo de uno que volvió. */
async function turnos(empresaId, desde, hasta) {
  const { data, error } = await supabase
    .from("agenda_vista")
    .select("id, desde, estado, forma, cliente_id, cliente, servicio, area, profesional, sala, precio, duracion_min")
    .eq("empresa_id", empresaId)
    .gte("desde", desde.toISOString())
    .lt("desde", hasta.toISOString())
    .order("desde")
    .limit(8000);
  if (error) throw error;
  return data || [];
}

async function ocupacion(empresaId, desde, hasta) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc("informe_ocupacion", {
    p_empresa: empresaId,
    p_desde: iso(desde),
    p_hasta: iso(hasta),
  });
  if (error) throw error;
  return data || [];
}

async function altas(empresaId, desde) {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, razon_social, creado_en")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .gte("creado_en", desde.toISOString())
    .limit(3000);
  if (error) throw error;
  return data || [];
}

/* ------------------------------------------------------------
   El informe

   Una sola función arma las cuatro secciones. La pantalla recibe un
   objeto y dibuja: mismo trato que el tablero, y por la misma razón —que
   dos lugares del sistema no puedan decir números distintos del mismo
   período—.
   ------------------------------------------------------------ */
export async function cargarInforme(empresaId, dias = 30) {
  if (!empresaId) throw new Error("cargarInforme necesita saber de qué comercio.");

  const hasta = new Date();
  hasta.setHours(23, 59, 59, 999);
  const desde = new Date(hasta.getTime() - (dias - 1) * dia);
  desde.setHours(0, 0, 0, 0);
  const previo = new Date(desde.getTime() - dias * dia);
  const historia = new Date(desde.getTime() - 180 * dia);

  const [lineas, agenda, ocup, nuevos] = await Promise.all([
    lineasVendidas(empresaId, previo, hasta),
    turnos(empresaId, historia, hasta),
    ocupacion(empresaId, desde, hasta),
    altas(empresaId, previo),
  ]);

  return {
    dias,
    desde,
    hasta,
    ingresos: armarIngresos(lineas, desde, hasta, dias),
    ocupacion: armarOcupacion(ocup),
    asistencia: armarAsistencia(agenda, desde, hasta),
    clientes: armarClientes(agenda, nuevos, desde, previo),
  };
}

/* ------------------------------------------------------------
   1 · Cuánto entró y de dónde
   ------------------------------------------------------------ */

function armarIngresos(lineas, desde, hasta, dias) {
  const enPeriodo = lineas.filter((l) => new Date(l.operaciones.fecha) >= desde);
  const enPrevio = lineas.filter((l) => new Date(l.operaciones.fecha) < desde);

  const total = suma(enPeriodo, (l) => l.total);
  const totalPrevio = suma(enPrevio, (l) => l.total);

  /* Un abono no es un turno: es plata que entró hoy por horas que se van
     a dar en las próximas ocho semanas. Mezclarlos hace que un mes con
     muchas renovaciones parezca un mes de mucha actividad. */
  const esPlan = (l) => (l.items && l.items.tipo === "plan");
  const abonos = suma(enPeriodo.filter(esPlan), (l) => l.total);

  const porArea = new Map();
  const porServicio = new Map();
  for (const l of enPeriodo) {
    const area = (l.items && l.items.categoria) || "Sin área";
    porArea.set(area, (porArea.get(area) || 0) + n(l.total));
    const s = porServicio.get(l.descripcion) || { nombre: l.descripcion, cantidad: 0, total: 0, plan: esPlan(l) };
    s.cantidad += n(l.cantidad);
    s.total += n(l.total);
    porServicio.set(l.descripcion, s);
  }

  /* Una operación puede traer varias líneas; el ticket se cuenta por
     operación y no por línea, o un pack vendido junto con una crema
     bajaría el promedio sin que nadie haya gastado menos. */
  const ops = new Set(enPeriodo.map((l) => l.operaciones.fecha + "|" + (l.operaciones.cliente_id || "")));

  const fin = new Date(hasta);
  fin.setHours(0, 0, 0, 0);
  const serie = new Array(dias).fill(0);
  for (const l of enPeriodo) {
    const f = new Date(l.operaciones.fecha);
    f.setHours(0, 0, 0, 0);
    const d = Math.round((fin.getTime() - f.getTime()) / dia);
    if (d >= 0 && d < dias) serie[dias - 1 - d] += n(l.total);
  }

  return {
    total,
    delta: variacion(total, totalPrevio),
    ticket: ops.size ? Math.round(total / ops.size) : 0,
    operaciones: ops.size,
    promedioDiario: Math.round(total / dias),
    abonos,
    sueltos: total - abonos,
    serie,
    porArea: [...porArea.entries()].map(([nombre, t]) => ({ nombre, total: t })).sort((a, b) => b.total - a.total),
    porServicio: [...porServicio.values()].sort((a, b) => b.total - a.total).slice(0, 10),
  };
}

/* ------------------------------------------------------------
   2 · Cuánto de lo que se podía vender se vendió

   Dos ocupaciones distintas y las dos ciertas: una sala de mat para ocho
   con tres personas adentro está usada el 100% del tiempo y al 37% de su
   capacidad. Ver el comentario de la migración 0042.
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
    .sort((a, b) => b.horasOcupadas - a.horasOcupadas);

  const lugares = suma(profesionales, (p) => p.lugares);
  const tomados = suma(profesionales, (p) => p.tomados);

  return {
    profesionales,
    salas,
    clases: { lugares, tomados, pct: lugares > 0 ? tomados / lugares : null },
  };
}

/* ------------------------------------------------------------
   3 · Cuánta de la gente que sacó turno vino

   Solo sobre turnos que ya pasaron. Contar los futuros como "no vino"
   hunde el porcentaje sin motivo: es el mismo criterio que usa la ficha
   del cliente, y tiene que seguir siendo el mismo.
   ------------------------------------------------------------ */

function armarAsistencia(agenda, desde, hasta) {
  const ahora = Date.now();
  /* Las clases no se cuentan: la clase no falta ni viene, faltan o vienen
     los inscriptos. Contarlas mezcla una unidad con la otra. */
  const delPeriodo = agenda.filter((t) => {
    const f = new Date(t.desde);
    return f >= desde && f <= hasta && t.forma !== "clase";
  });

  const pasados = delPeriodo.filter((t) => new Date(t.desde).getTime() < ahora);
  const cuenta = (k) => pasados.filter((t) => t.estado === k).length;

  const cumplidas = cuenta("cumplida");
  const ausentes = cuenta("ausente");
  const canceladas = cuenta("cancelada");
  const base = cumplidas + ausentes;

  const porServicio = new Map();
  for (const t of pasados) {
    const k = t.servicio || "Sin servicio";
    const s = porServicio.get(k) || { nombre: k, area: t.area || "", total: 0, vino: 0, falto: 0 };
    s.total += 1;
    if (t.estado === "cumplida") s.vino += 1;
    if (t.estado === "ausente") s.falto += 1;
    porServicio.set(k, s);
  }

  return {
    total: delPeriodo.length,
    pasados: pasados.length,
    cumplidas,
    ausentes,
    canceladas,
    /* Sobre vinieron + faltaron, no sobre el total: una cancelación
       avisada a tiempo no es una inasistencia, es un turno que se pudo
       volver a vender. */
    pct: base > 0 ? cumplidas / base : null,
    pctCancelacion: pasados.length > 0 ? canceladas / pasados.length : null,
    porEstado: ESTADOS_TURNO.map((e) => ({
      ...e,
      v: delPeriodo.filter((t) => t.estado === e.k).length,
    })).filter((e) => e.v > 0),
    porServicio: [...porServicio.values()]
      .filter((s) => s.vino + s.falto >= 3)
      .map((s) => ({ ...s, pct: s.vino / (s.vino + s.falto) }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 8),
  };
}

/* ------------------------------------------------------------
   4 · Quién es la gente

   La antesala del CRM. Todavía no manda un mensaje: dice a quién habría
   que mandárselo.
   ------------------------------------------------------------ */

function armarClientes(agenda, nuevos, desde, previo) {
  const delPeriodo = nuevos.filter((c) => new Date(c.creado_en) >= desde);
  const delPrevio = nuevos.filter((c) => new Date(c.creado_en) < desde && new Date(c.creado_en) >= previo);

  const vinieron = agenda.filter((t) => t.estado === "cumplida" && t.cliente_id);

  /* La última vez de cada uno, sobre los seis meses que se trajeron. */
  const ultima = new Map();
  const veces = new Map();
  for (const t of vinieron) {
    const f = new Date(t.desde);
    if (f > new Date()) continue;
    if (!ultima.has(t.cliente_id) || f > ultima.get(t.cliente_id).fecha) {
      ultima.set(t.cliente_id, { fecha: f, nombre: t.cliente || null });
    }
    veces.set(t.cliente_id, (veces.get(t.cliente_id) || 0) + 1);
  }

  const enPeriodo = new Map();
  for (const t of vinieron) {
    const f = new Date(t.desde);
    if (f < desde) continue;
    enPeriodo.set(t.cliente_id, (enPeriodo.get(t.cliente_id) || 0) + 1);
  }

  /* Dormido: vino alguna vez y hace más de 45 días que no aparece. No es
     "cliente perdido" —eso lo decide el negocio, no el sistema— es a
     quién conviene llamar. */
  const corte = Date.now() - 45 * dia;
  const dormidos = [...ultima.entries()]
    .filter(([, u]) => u.fecha.getTime() < corte)
    .map(([id, u]) => ({ id, nombre: u.nombre, ultima: u.fecha, veces: veces.get(id) || 0, dias: Math.round((Date.now() - u.fecha.getTime()) / dia) }))
    .sort((a, b) => b.veces - a.veces);

  return {
    nuevos: delPeriodo.length,
    deltaNuevos: variacion(delPeriodo.length, delPrevio.length),
    activos: enPeriodo.size,
    recurrentes: [...enPeriodo.values()].filter((v) => v >= 2).length,
    dormidos: dormidos.slice(0, 8),
    dormidosTotal: dormidos.length,
  };
}
