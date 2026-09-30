/* ============================================================
   GENEZ FOUNDER · objetivos, plan comercial y marketing (0117)
   ============================================================

   El valor actual de un objetivo lo trae la vista, calculado por la
   base con los registros reales; acá no se calcula ni se estima nada.
   Lo que se escribe pasa por una lista de columnas por tabla, como en
   internoClientes.js.
   ============================================================ */

import { supabase } from "./supabase.js";
import { aApp } from "./internoCrm.js";
import { conColumnas, aAppDia, traducir } from "./internoClientes.js";

const COLUMNAS = {
  interno_objetivos: ["nombre", "descripcion", "metrica", "valorObjetivo", "valorManual", "periodo", "inicio", "limite", "responsableId", "estado",
    "planId", "semana", "proyectoId", "archivadoEn"],
  interno_planes: ["nombre", "descripcion", "inicio", "fin", "estado", "archivadoEn"],
  interno_contenidos: ["titulo", "descripcion", "rubro", "problema", "solucion", "publico", "canal", "formato", "gancho", "cta", "prioridad", "estado",
    "fechaObjetivo", "publicadoEn", "guion", "copy", "recursos", "url", "responsableId", "grabacionId", "orden", "archivadoEn"],
  interno_grabaciones: ["fecha", "tema", "guion", "escenas", "recursos", "equipamiento", "notas", "estado", "eventoId", "archivadoEn"],
  interno_contenido_metricas: ["momento", "fecha", "visualizaciones", "alcance", "interacciones", "comentarios", "guardados", "compartidos", "clics", "consultas", "nota"],
};
const mas = (error) => {
  if (!error) return null;
  const m = error.message || "";
  if (/interno_objetivos_fechas|interno_planes_fechas/.test(m)) return new Error("La fecha límite no puede ser antes del inicio.");
  if (/interno_objetivos_valor/.test(m)) return new Error("El valor objetivo tiene que ser mayor que cero.");
  if (/interno_contenidos_url/.test(m)) return new Error("El link tiene que empezar con http:// o https://.");
  if (/interno_contenido_metricas_una/.test(m)) return new Error("Ya hay una medición de ese momento: editala.");
  if (/positivas/.test(m)) return new Error("Las métricas no pueden ser negativas.");
  return traducir(error);
};
const dato = ({ data, error }) => { if (error) throw mas(error); return data; };
const guardar = async (tabla, obj) => {
  const fila = conColumnas(COLUMNAS[tabla], obj);
  if (obj.id) return dato(await supabase.from(tabla).update(fila).eq("id", obj.id));
  return dato(await supabase.from(tabla).insert(fila).select("id").single());
};
/* inicio, limite y fin son días sin hora. "fin" (y "inicio") en un evento
   son momentos, y la traducción común los convierte a Date: acá tienen
   que quedar como texto, o el plan del 26/10 termina el 25. */
const aAppObj = (f) => {
  const o = aAppDia(f);
  for (const k of ["inicio", "fin", "limite"]) if (f && f[k] && !String(f[k]).includes("T")) o[k] = f[k];
  return o;
};

/* ---------- Nombres ---------- */
export const METRICA = {
  prospectos: { n: "Prospectos nuevos", u: "prospectos" }, contactos: { n: "Contactos hechos", u: "contactos" },
  demos: { n: "Demos hechas", u: "demos" }, propuestas: { n: "Propuestas enviadas", u: "propuestas" },
  ventas: { n: "Ventas cerradas", u: "ventas" }, recurrente: { n: "Recurrente nuevo", u: "$/mes", plata: true },
  clientes: { n: "Clientes vigentes con importe", u: "clientes" }, manual: { n: "Carga manual", u: "" },
};
export const PERIODO = { diario: "Diario", semanal: "Semanal", mensual: "Mensual", trimestral: "Trimestral", anual: "Anual", otro: "Otro" };
export const ESTADO_CONTENIDO = { idea: "Idea", planificado: "Planificado", guion: "Guion", grabacion: "Grabación", edicion: "Edición", revision: "Revisión",
  programado: "Programado", publicado: "Publicado", medicion: "Medición", descartado: "Descartado" };
export const ESTADO_GRABACION = { planificada: "Planificada", grabada: "Grabada", editada: "Editada", cancelada: "Cancelada" };
export const METRICAS_CONTENIDO = [["visualizaciones", "Visualizaciones"], ["alcance", "Alcance"], ["interacciones", "Interacciones"], ["comentarios", "Comentarios"],
  ["guardados", "Guardados"], ["compartidos", "Compartidos"], ["clics", "Clics"], ["consultas", "Consultas recibidas"]];

/* ---------- Objetivos y planes ---------- */
export async function cargarObjetivos({ archivados = false } = {}) {
  let q = supabase.from("interno_objetivos_vista").select("*").order("limite");
  q = archivados ? q.not("archivado_en", "is", null) : q.is("archivado_en", null);
  return (dato(await q) || []).map((o) => ({ ...aAppObj(o), valorActual: o.valor_actual == null ? null : Number(o.valor_actual), valorObjetivo: Number(o.valor_objetivo) }));
}
export const guardarObjetivo = (o) => guardar("interno_objetivos", o);
export async function tareasDeObjetivo(id) {
  return (dato(await supabase.from("interno_tareas").select("*").eq("objetivo_id", id).is("archivado_en", null).order("vence", { ascending: true, nullsFirst: false })) || []).map(aApp);
}
export async function cargarPlanes() {
  return (dato(await supabase.from("interno_planes").select("*").is("archivado_en", null).order("inicio", { ascending: false })) || []).map(aAppObj);
}
export const guardarPlan = (p) => guardar("interno_planes", p);

/* El plan de 30 días en un paso: el plan, la meta del período y una meta
   por semana para cada ritmo. Si algo falla a mitad de camino, lo creado
   queda y se puede completar a mano: se dice cuánto se llegó a crear. */
export async function crearPlan30(d) {
  const sumar = (dia, n) => { const x = new Date(`${dia}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const fin = sumar(d.inicio, 29);
  const plan = await guardarPlan({ nombre: d.nombre, descripcion: d.descripcion || null, inicio: d.inicio, fin });
  const metas = [{ nombre: `${d.ventas} ${Number(d.ventas) === 1 ? "cliente" : "clientes"} en 30 días`, metrica: "ventas", valorObjetivo: Number(d.ventas), periodo: "mensual", inicio: d.inicio, limite: fin, planId: plan.id }];
  const ritmos = [["prospectos", "Prospectos nuevos"], ["contactos", "Contactos"], ["demos", "Demos"], ["propuestas", "Propuestas"]];
  for (let s = 0; s < 5; s++) {
    const ini = sumar(d.inicio, s * 7);
    if (ini > fin) break;
    const lim = s === 4 ? fin : sumar(ini, 6) > fin ? fin : sumar(ini, 6);
    for (const [m, n] of ritmos) {
      const v = Number(d[m]);
      /* La quinta "semana" son dos días: la meta se prorratea, redondeando para arriba. */
      const dias = (new Date(`${lim}T12:00:00Z`) - new Date(`${ini}T12:00:00Z`)) / 86400000 + 1;
      const meta = dias < 7 ? Math.ceil((v * dias) / 7) : v;
      if (meta > 0) metas.push({ nombre: `${n} · semana ${s + 1}`, metrica: m, valorObjetivo: meta, periodo: "semanal", inicio: ini, limite: lim, planId: plan.id, semana: s + 1 });
    }
  }
  const { error } = await supabase.from("interno_objetivos").insert(metas.map((o) => conColumnas(COLUMNAS.interno_objetivos, o)));
  if (error) throw new Error(`Se creó el plan pero no sus metas: ${mas(error).message}`);
  return plan.id;
}

/* ---------- Contenidos ---------- */
export async function cargarContenidos() {
  return (dato(await supabase.from("interno_contenidos_vista").select("*").is("archivado_en", null).order("fecha_objetivo", { ascending: true, nullsFirst: false }).limit(2000)) || []).map(aApp);
}
export async function cargarContenido(id) {
  const [c, metricas, prospectos, tareas, adjuntos] = await Promise.all([
    supabase.from("interno_contenidos_vista").select("*").eq("id", id).single(),
    supabase.from("interno_contenido_metricas").select("*").eq("contenido_id", id).order("fecha"),
    supabase.from("interno_prospectos_vista").select("id, nombre, etapa_nombre, oportunidad_estado, cliente_desde").eq("contenido_id", id),
    supabase.from("interno_tareas").select("*").eq("contenido_id", id).is("archivado_en", null),
    supabase.from("interno_adjuntos").select("*").eq("tabla", "interno_contenidos").eq("fila_id", id).is("archivado_en", null).order("creado_en"),
  ]);
  return {
    contenido: aApp(dato(c)), metricas: (dato(metricas) || []).map(aAppDia),
    /* Sin el área de crm, los prospectos no se ven: la lista viene vacía. */
    prospectos: (prospectos.data || []).map(aApp), tareas: (tareas.data || []).map(aApp), adjuntos: (adjuntos.data || []).map(aApp),
  };
}
export const guardarContenido = (c) => guardar("interno_contenidos", c);
export async function guardarMetrica(contenidoId, m) {
  const fila = conColumnas(COLUMNAS.interno_contenido_metricas, m);
  for (const [k] of METRICAS_CONTENIDO) if (fila[k] !== undefined && fila[k] !== null) fila[k] = Number(fila[k]);
  if (m.id) return dato(await supabase.from("interno_contenido_metricas").update(fila).eq("id", m.id));
  return dato(await supabase.from("interno_contenido_metricas").insert({ ...fila, contenido_id: contenidoId }));
}
/* Atar o desatar el origen de un prospecto: vive en el prospecto. */
export async function origenDeProspecto(prospectoId, contenidoId) {
  dato(await supabase.from("interno_prospectos").update({ contenido_id: contenidoId }).eq("id", prospectoId));
}

/* ---------- Grabaciones ---------- */
export async function cargarGrabaciones() {
  return (dato(await supabase.from("interno_grabaciones").select("*").is("archivado_en", null).order("fecha", { ascending: true, nullsFirst: false })) || []).map(aApp);
}
export const guardarGrabacion = (g) => guardar("interno_grabaciones", g);
