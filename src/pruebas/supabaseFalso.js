/* ============================================================
   La pantalla de pruebas · una conexión a Supabase de mentira
   ============================================================

   En `vite --mode pruebas` este archivo reemplaza a src/datos/supabase.js
   (lo hace un plugin de vite.config.js): el sistema entero corre igual,
   pero cada consulta va contra las tablas en memoria de datos.js y nunca
   sale del navegador. Sirve para ver las pantallas montadas —que se
   caigan acá es que se caerían en producción— sin una cuenta real.

   No pretende ser Postgres: entiende lo que usa la aplicación (eq, in,
   is, gte/lte, order, limit, range, single, insert, update, delete,
   upsert) y lo demás lo deja pasar. Los filtros sobre tablas anidadas
   ("operaciones.estado") se ignoran. Las funciones de la base que la
   aplicación necesita para arrancar tienen una respuesta armada; las
   demás contestan vacío.
   ============================================================ */

import { armarDatos, USUARIO } from "./datos.js";
import { normTel } from "../utils/importarProspectos.js";

const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const datos = armarDatos(params.get("rubro") || "minimercado", params.get("sesion") || "comercio");
const T = datos.tablas;

/* ?prueba=… (0127): el comercio en prueba gratis. Un número son los días
   que le quedan; "vencida" y "suspendida" muestran la pantalla de
   contratar, y como en la base, el comercio deja de leerse. Con
   ?sesion=plataforma, el panel trae tres pruebas inventadas.
   La suscripción (0128): "gracia" es un cobro rechazado con 3 días por
   delante, "gracia-vencida" la gracia terminada, y "baja" una suscripción
   cancelada con días pagos todavía. */
const prueba = params.get("prueba");
const hoyFalso = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const aHoyMas = (n) => { const [a, m, d] = hoyFalso().split("-").map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
const estadoPrueba = { pago: null, borrados: false };
if (prueba && datos.perfil.empresa_id) {
  datos.empresa.plan = "pro";
  datos.empresa.prueba_hasta = prueba === "vencida" || prueba === "gracia-vencida" ? aHoyMas(-1)
    : prueba === "suspendida" ? null
    : prueba === "gracia" ? aHoyMas(3) : prueba === "baja" ? aHoyMas(12)
    : aHoyMas((Number(prueba) || 10) - 1);
  if (prueba === "suspendida") datos.empresa.activa = false;
  if (prueba === "vencida" || prueba === "suspendida" || prueba === "gracia-vencida") T.empresas = [];
  if (prueba === "gracia" || prueba === "gracia-vencida" || prueba === "baja") {
    estadoPrueba.suscripcion = {
      plan: "pro", periodo: "mensual", monto: 59900, estado: prueba === "baja" ? "cancelada" : "activa",
      pago_fallido_desde: prueba === "baja" ? null : aHoyMas(prueba === "gracia" ? -2 : -6), proximo_cobro: aHoyMas(13),
    };
  }
}
if (!datos.perfil.empresa_id) {
  const alta = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
  const otras = [
    { id: crypto.randomUUID(), nombre: "Almacén La Esquina", rubro: "minimercado", plan: "pro", modulos: ["cobro", "caja", "ajustes", "stock"], activa: true, prueba_hasta: aHoyMas(6), creada_en: alta(4), config: {} },
    { id: crypto.randomUUID(), nombre: "Bodegón del Puerto", rubro: "gastronomia", plan: "start", modulos: ["cobro", "caja", "ajustes"], activa: true, prueba_hasta: aHoyMas(-2), creada_en: alta(12), config: {} },
    { id: crypto.randomUUID(), nombre: "Estudio Pilates Sur", rubro: "servicios", plan: "empresa", modulos: ["cobro", "caja", "ajustes", "agenda"], activa: true, prueba_hasta: aHoyMas(1), creada_en: alta(9), config: {} },
  ];
  T.empresas.push(...otras);
  T.pruebas = [
    { empresa_id: otras[0].id, creada_en: alta(4), email: "laesquina@genez.test", nombre: "Marta Gómez", telefono: "5491155550001", plan: "pro", negocio: "Almacén", provincia: "Buenos Aires", sucursales: "1", problema: "No sé cuánto stock tengo.", aviso_por_vencer_en: null, aviso_vencida_en: null, pago_avisado_en: null, ejemplos_borrados_en: alta(3) },
    { empresa_id: otras[1].id, creada_en: alta(12), email: "bodegon@genez.test", nombre: "Julián Pérez", telefono: "5491155550002", plan: "start", negocio: "Restaurante", provincia: "Santa Fe", sucursales: "1", problema: "Las comandas se pierden.", aviso_por_vencer_en: alta(5), aviso_vencida_en: alta(1), pago_avisado_en: alta(0), ejemplos_borrados_en: null },
    { empresa_id: otras[2].id, creada_en: alta(9), email: "pilates@genez.test", nombre: "Sofía Ruiz", telefono: "5491155550003", plan: "empresa", negocio: "Estudio", provincia: "Córdoba", sucursales: "2", problema: "Los turnos los llevo en un cuaderno.", aviso_por_vencer_en: alta(1), aviso_vencida_en: null, pago_avisado_en: null, ejemplos_borrados_en: null },
  ];
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/* Lo que se llamó, para mirarlo desde la consola: window.__genezPruebas */
const registro = [];
if (typeof window !== "undefined") window.__genezPruebas = { tablas: T, registro };

const valor = (fila, col) => {
  const m = col.match(/^(\w+)->>?(\w+)$/);
  if (m) { const v = fila[m[1]] && fila[m[1]][m[2]]; return v == null ? v : String(v); }
  return fila[col];
};

function consulta(tabla) {
  const q = { tabla, filtros: [], orden: [], desde: 0, hasta: null, uno: null, op: "select", datos: null, cuenta: false, soloCabeza: false, embebidos: [] };
  const b = {
    select(cols, opciones) {
      if (opciones && opciones.count) { q.cuenta = true; q.soloCabeza = !!opciones.head; }
      q.embebidos = [...String(cols || "").matchAll(/(\w+)\(/g)].map((m) => m[1]);
      return p;
    },
    eq(c, v) { if (!c.includes(".")) q.filtros.push((f) => String(valor(f, c)) === String(v)); return p; },
    neq(c, v) { if (!c.includes(".")) q.filtros.push((f) => String(valor(f, c)) !== String(v)); return p; },
    in(c, vs) { if (!c.includes(".")) q.filtros.push((f) => vs.map(String).includes(String(valor(f, c)))); return p; },
    is(c, v) { if (!c.includes(".")) q.filtros.push((f) => (v === null ? valor(f, c) == null : valor(f, c) === v)); return p; },
    gte(c, v) { if (!c.includes(".")) q.filtros.push((f) => valor(f, c) == null || valor(f, c) >= v); return p; },
    lte(c, v) { if (!c.includes(".")) q.filtros.push((f) => valor(f, c) == null || valor(f, c) <= v); return p; },
    gt(c, v) { if (!c.includes(".")) q.filtros.push((f) => valor(f, c) > v); return p; },
    lt(c, v) { if (!c.includes(".")) q.filtros.push((f) => valor(f, c) < v); return p; },
    /* La búsqueda de texto de la base, en chico: todas las palabras
       tienen que estar en el título, las etiquetas o el contenido. */
    textSearch(_c, v) {
      const sin = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      const palabras = sin(v).split(/\s+/).filter(Boolean).map((w) => w.replace(/(es|s)$/, ""));
      q.filtros.push((f) => { const t = sin(`${f.titulo} ${(f.etiquetas || []).join(" ")} ${f.contenido}`); return palabras.every((w) => t.includes(w)); });
      return p;
    },
    order(c, o = {}) { if (!c.includes(".")) q.orden.push([c, o.ascending !== false]); return p; },
    limit(n) { q.hasta = q.desde + n - 1; return p; },
    range(a, z) { q.desde = a; q.hasta = z; return p; },
    single() { q.uno = "single"; return p; },
    maybeSingle() { q.uno = "maybe"; return p; },
    insert(d) { q.op = "insert"; q.datos = d; return p; },
    upsert(d) { q.op = "upsert"; q.datos = d; return p; },
    update(d) { q.op = "update"; q.datos = d; return p; },
    delete() { q.op = "delete"; return p; },
    then(ok, mal) { return Promise.resolve().then(() => ejecutar(q)).then(ok, mal); },
  };
  /* Lo que no se conoce (not, or, like, ilike, match, filter, contains,
     textSearch, returns, abortSignal…) se acepta y no filtra. */
  const p = new Proxy(b, { get: (o, k) => (k in o ? o[k] : typeof k === "string" ? () => p : undefined) });
  return p;
}

/* Las vistas de la base que se arman con otras tablas: acá se arman al
   leerlas, para que lo que se crea en una pantalla aparezca en la otra. */
const hoyDia = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const masDias = (dia, n) => { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tablaDe = (t) => T[t] || (T[t] = []);

const VISTAS = {
  /* Las de 0115, en chico: el cliente con su negocio y sus conteos, y el
     ticket con el nombre del cliente y sus horas de resolución. */
  interno_clientes_vista: () => tablaDe("interno_clientes").map((c) => {
    const p = tablaDe("interno_prospectos").find((x) => x.id === c.prospecto_id) || {};
    const et = tablaDe("interno_impl_etapas").filter((e) => e.cliente_id === c.id);
    const tk = tablaDe("interno_tickets").filter((t) => t.cliente_id === c.id && !t.archivado_en && !["resuelto", "cerrado"].includes(t.estado));
    return { ...c, nombre: p.nombre, rubro: p.rubro, zona: p.zona, localidad: p.localidad, telefono: p.telefono, whatsapp: p.whatsapp, email: p.email,
      ultimo_contacto: p.ultimo_contacto || null, proximo_contacto: p.proximo_contacto || null, proxima_accion: p.proxima_accion || null,
      impl_total: et.length, impl_hechas: et.filter((e) => ["hecha", "no_aplica"].includes(e.estado)).length, impl_bloqueadas: et.filter((e) => e.estado === "bloqueada").length,
      tickets_abiertos: tk.length, tickets_urgentes: tk.filter((t) => ["alta", "urgente"].includes(t.prioridad) || ["grave", "critica"].includes(t.gravedad)).length,
      tareas_vencidas: tablaDe("interno_tareas").filter((t) => t.prospecto_id === c.prospecto_id && !t.archivado_en && ["pendiente", "en_curso", "en_espera"].includes(t.estado) && t.vence && t.vence < new Date().toISOString()).length };
  }),
  /* Las de 0116: el elemento con su versión, proyecto, cliente y
     cuántos lo piden; el proyecto con sus conteos. */
  interno_roadmap_vista: () => tablaDe("interno_roadmap").map((r) => {
    const v = tablaDe("interno_versiones").find((x) => x.id === r.version_id);
    const pr = tablaDe("interno_proyectos").find((x) => x.id === r.proyecto_id);
    const c = tablaDe("interno_clientes").find((x) => x.id === r.cliente_id);
    const pp = c && tablaDe("interno_prospectos").find((x) => x.id === c.prospecto_id);
    const rel = tablaDe("interno_roadmap_tickets").filter((x) => x.roadmap_id === r.id);
    const clientes = new Set(rel.map((x) => (tablaDe("interno_tickets").find((t) => t.id === x.ticket_id) || {}).cliente_id).filter(Boolean));
    return { ...r, version_nombre: v ? v.nombre : null, version_estado: v ? v.estado : null, proyecto_nombre: pr ? pr.nombre : null, cliente_nombre: pp ? pp.nombre : null,
      tickets: rel.length, clientes_que_piden: clientes.size,
      tareas_abiertas: tablaDe("interno_tareas").filter((t) => t.roadmap_id === r.id && !t.archivado_en && ["pendiente", "en_curso", "en_espera"].includes(t.estado)).length };
  }),
  interno_proyectos_vista: () => tablaDe("interno_proyectos").map((p) => {
    const ts = tablaDe("interno_tareas").filter((t) => t.proyecto_id === p.id && !t.archivado_en && t.estado !== "cancelada");
    const rs = tablaDe("interno_roadmap").filter((r) => r.proyecto_id === p.id && !r.archivado_en);
    return { ...p, tareas_total: ts.length, tareas_hechas: ts.filter((t) => t.estado === "completada").length,
      elementos: rs.length, elementos_terminados: rs.filter((r) => ["lanzado", "descartado"].includes(r.estado)).length };
  }),
  /* Las de 0117: el objetivo con su valor medido (la misma cuenta que
     interno_objetivo_valor, en días de Buenos Aires) y el contenido con
     su medición y lo que originó. */
  interno_objetivos_vista: () => tablaDe("interno_objetivos").map((o) => {
    const desde = new Date(`${o.inicio}T00:00:00-03:00`).toISOString();
    const hasta = new Date(new Date(`${o.limite}T00:00:00-03:00`).getTime() + 86400000).toISOString();
    const en = (f) => f && f >= desde && f < hasta;
    const acts = tablaDe("interno_actividades").filter((a) => en(a.fecha));
    const valor = {
      prospectos: () => tablaDe("interno_prospectos").filter((p) => en(p.creado_en)).length,
      contactos: () => acts.filter((a) => ["llamada", "whatsapp", "email", "visita", "reunion", "demo", "propuesta"].includes(a.tipo)).length,
      demos: () => acts.filter((a) => a.tipo === "demo").length,
      propuestas: () => acts.filter((a) => a.tipo === "propuesta" || (a.tipo === "cambio_etapa" && /propuesta/i.test((a.datos && a.datos.a_nombre) || ""))).length,
      ventas: () => tablaDe("interno_oportunidades").filter((x) => x.estado === "ganada" && en(x.ganada_en)).length,
      recurrente: () => tablaDe("interno_clientes").filter((c) => c.alta >= o.inicio && c.alta <= o.limite && c.estado !== "cancelado").reduce((s, c) => s + Number(c.importe_mensual || 0), 0),
      clientes: () => tablaDe("interno_clientes").filter((c) => c.alta <= o.limite && ["implementacion", "activo", "en_riesgo"].includes(c.estado) && Number(c.importe_mensual) > 0).length,
      manual: () => o.valor_manual ?? null,
    }[o.metrica];
    const ts = tablaDe("interno_tareas").filter((t) => t.objetivo_id === o.id && !t.archivado_en && t.estado !== "cancelada");
    return { ...o, valor_actual: valor ? valor() : null, tareas_total: ts.length, tareas_hechas: ts.filter((t) => t.estado === "completada").length };
  }),
  interno_contenidos_vista: () => tablaDe("interno_contenidos").map((c) => {
    const m = (x) => tablaDe("interno_contenido_metricas").find((k) => k.contenido_id === c.id && k.momento === x) || {};
    const ps = tablaDe("interno_prospectos").filter((p) => p.contenido_id === c.id);
    const g = tablaDe("interno_grabaciones").find((x) => x.id === c.grabacion_id);
    return { ...c, grabacion_tema: g ? g.tema : null,
      vis_semana: m("7d").visualizaciones ?? null, int_semana: m("7d").interacciones ?? null, consultas_semana: m("7d").consultas ?? null,
      vis_mes: m("30d").visualizaciones ?? null, int_mes: m("30d").interacciones ?? null, consultas_mes: m("30d").consultas ?? null,
      prospectos_originados: ps.length,
      demos_originadas: ps.filter((p) => tablaDe("interno_actividades").some((a) => a.prospecto_id === p.id && a.tipo === "demo")).length,
      clientes_originados: ps.filter((p) => tablaDe("interno_clientes").some((k) => k.prospecto_id === p.id)).length };
  }),
  /* Las de 0118: la suscripción con su cliente, el movimiento con su
     cliente y su cuenta, y el saldo de cada cuenta desde su saldo inicial. */
  interno_suscripciones_vista: () => tablaDe("interno_suscripciones").map((x) => {
    const c = tablaDe("interno_clientes").find((k) => k.id === x.cliente_id);
    const p = c && tablaDe("interno_prospectos").find((k) => k.id === c.prospecto_id);
    return { ...x, cliente_nombre: p ? p.nombre : null, cliente_estado: c ? c.estado : null };
  }),
  interno_movimientos_vista: () => tablaDe("interno_movimientos").map((m) => {
    const c = tablaDe("interno_clientes").find((k) => k.id === m.cliente_id);
    const p = c && tablaDe("interno_prospectos").find((k) => k.id === c.prospecto_id);
    const k = tablaDe("interno_cuentas").find((x) => x.id === m.cuenta_id);
    return { ...m, cliente_nombre: p ? p.nombre : null, cuenta_nombre: k ? k.nombre : null };
  }),
  interno_cuentas_vista: () => tablaDe("interno_cuentas").map((k) => {
    const ms = tablaDe("interno_movimientos").filter((m) => m.cuenta_id === k.id && m.estado === "pagado" && m.fecha_pago >= k.saldo_inicial_fecha);
    const s = (t) => ms.filter((m) => m.tipo === t).reduce((a, m) => a + Number(m.importe), 0);
    return { ...k, saldo: Number(k.saldo_inicial) + s("ingreso") - s("gasto") };
  }),
  interno_tickets_vista: () => tablaDe("interno_tickets").map((t) => {
    const c = tablaDe("interno_clientes").find((x) => x.id === t.cliente_id);
    const p = c && tablaDe("interno_prospectos").find((x) => x.id === c.prospecto_id);
    return { ...t, cliente_nombre: p ? p.nombre : null, prospecto_id: c ? c.prospecto_id : null,
      horas_resolucion: t.resuelto_en ? (new Date(t.resuelto_en) - new Date(t.creado_en)) / 3600000 : null };
  }),
  /* La del CRM (0114): el prospecto con su oportunidad abierta. */
  interno_prospectos_vista: () => (T.interno_prospectos || []).map((p) => {
    const o = (T.interno_oportunidades || []).filter((x) => x.prospecto_id === p.id && !x.archivado_en)
      .sort((a, z) => (a.estado === "abierta" ? -1 : 1) - (z.estado === "abierta" ? -1 : 1))[0];
    const e = o && (T.interno_etapas || []).find((x) => x.id === o.etapa_id);
    return { ...p, oportunidad_id: o ? o.id : null, etapa_id: o ? o.etapa_id : null, etapa_nombre: e ? e.nombre : null, etapa_orden: e ? e.orden : null,
      valor: o ? o.valor : null, probabilidad: o ? o.probabilidad : null, oportunidad_estado: o ? o.estado : null };
  }),
  interno_wa_conversaciones_vista: () => tablaDe("interno_wa_conversaciones").map((c) => {
    const tel = c.wa_id.replace(/^549/, "");
    const mismos = tablaDe("interno_prospectos").filter((p) => [p.telefono, p.whatsapp].some((t) => String(t || "").replace(/\D/g, "").endsWith(tel)));
    const p = tablaDe("interno_prospectos").find((x) => x.id === c.prospecto_id);
    const k = p && tablaDe("interno_clientes").find((x) => x.prospecto_id === p.id);
    const abierta = !!c.ultimo_entrante_en && Date.now() - new Date(c.ultimo_entrante_en).getTime() < 24 * 3600000;
    return { ...c, tel_norm: tel, ventana_abierta: abierta, prospecto_nombre: p ? p.nombre : null, cliente_id: k ? k.id : null, cliente_estado: k ? k.estado : null,
      prospecto_sugerido_id: !c.prospecto_id && mismos.length === 1 ? mismos[0].id : null, prospecto_sugerido_nombre: !c.prospecto_id && mismos.length === 1 ? mismos[0].nombre : null,
      con_borrador: tablaDe("interno_wa_borradores").some((b) => b.conversacion_id === c.id && b.estado === "pendiente") };
  }),
  clientes_vista: () => (T.clientes || []).map((c) => ({
    turnos: 0, asistio: 0, ausencias: 0, asistencia: null, gastado: 0, compras: 0, abonos_activos: 0, notas: 0,
    ultima: null, proxima: null, activo: true, ...c,
  })),
};

/* Los valores por defecto de las columnas (0114): sin ellos, una tarea
   creada sin estado no aparece entre las pendientes. */
const DEFECTOS = {
  interno_prospectos: { modulos: [], etiquetas: [], campos_extra: {}, archivado_en: null },
  interno_oportunidades: { modulos: [], estado: "abierta", valor: 0, archivado_en: null },
  interno_actividades: { datos: {} },
  interno_tareas: { estado: "pendiente", prioridad: "normal", etiquetas: [], checklist: [], archivado_en: null },
  interno_eventos: { tipo: "reunion", estado: "programado", archivado_en: null },
  interno_contactos: { principal: false, archivado_en: null },
  interno_tickets: { estado: "nuevo", prioridad: "normal", gravedad: "moderada", archivado_en: null },
  interno_ticket_mensajes: { tipo: "nota" },
  interno_adjuntos: { archivado_en: null },
  interno_impl_modelo: { rubros: [], modulos: [], activo: true, orden: 0 },
  interno_cuentas: { tipo: "banco", moneda: "ARS", saldo_inicial: 0, activa: true },
  interno_hallazgos: { datos: {}, prospecto_id: null, descartado_en: null },
  interno_wa_plantillas: { estado: "borrador", archivado_en: null, variables: [], ejemplos: [] },
  interno_suscripciones: { moneda: "ARS", estado: "activa", dia_cobro: 10 },
  interno_movimientos: { moneda: "ARS", estado: "pendiente", facturado: false, fijo: false },
  interno_planes: { estado: "activo", archivado_en: null },
  interno_objetivos: { periodo: "mensual", estado: "activo", archivado_en: null },
  interno_contenidos: { prioridad: "normal", estado: "idea", orden: 0, archivado_en: null },
  interno_grabaciones: { estado: "planificada", archivado_en: null },
  interno_contenido_metricas: { momento: "7d" },
  interno_proyectos: { estado: "idea", prioridad: "normal", archivado_en: null },
  interno_versiones: { estado: "planificada" },
  interno_roadmap: { tipo: "mejora", estado: "idea", prioridad: "normal", orden: 0, archivado_en: null },
  interno_documentos: { tipo: "nota", contenido: "", etiquetas: [], estado: "borrador", version: 1, archivado_en: null },
};

/* Lo que en la base hacen los disparadores de 0114, en chico: la primera
   oportunidad de un prospecto, y qué cambia al mover una de etapa. */
let numeroTicket = 0;
const ANTES = new Map();   // el documento como estaba, para su historial de versiones
const ANTES_SUS = new Map();   // la suscripción como estaba, para su historial
let numeroCambio = 0;
const DISPARADORES = {
  /* Los checks de 0115 que la pantalla tiene que ver fallar: resolver sin
     solución y bloquear sin decir qué bloquea. */
  interno_tickets: (op, filas) => {
    for (const t of filas) {
      if (op === "insert") t.numero = ++numeroTicket;
      if (["resuelto", "cerrado"].includes(t.estado)) {
        if (!String(t.solucion || "").trim()) throw new Error('violates check constraint "interno_tickets_solucion"');
        t.resuelto_en = t.resuelto_en || new Date().toISOString();
      } else t.resuelto_en = null;
      t.cerrado_en = t.estado === "cerrado" ? t.cerrado_en || new Date().toISOString() : null;
    }
  },
  /* 0116: las fechas de terminado y el historial de versiones del documento. */
  interno_roadmap: (op, filas) => { for (const r of filas) r.terminado_en = ["lanzado", "descartado"].includes(r.estado) ? r.terminado_en || new Date().toISOString() : null; },
  interno_proyectos: (op, filas) => { for (const p of filas) p.completado_en = p.estado === "completado" ? p.completado_en || new Date().toISOString() : null; },
  interno_versiones: (op, filas) => { for (const v of filas) v.lanzada_en = v.estado === "lanzada" ? v.lanzada_en || new Date().toISOString() : null; },
  interno_documentos: (op, filas, datos) => {
    for (const d of filas) {
      d.actualizado_en = new Date().toISOString();
      if (op !== "update" || !datos || !ANTES.has(d.id)) { ANTES.set(d.id, { titulo: d.titulo, contenido: d.contenido, fecha: d.actualizado_en }); continue; }
      if (("contenido" in datos && ANTES.get(d.id).contenido !== d.contenido) || ("titulo" in datos && ANTES.get(d.id).titulo !== d.titulo)) {
        tablaDe("interno_documentos_versiones").push({ id: uuid(), documento_id: d.id, version: d.version, titulo: ANTES.get(d.id).titulo, contenido: ANTES.get(d.id).contenido, fecha: ANTES.get(d.id).fecha });
        d.version = (d.version || 1) + 1;
      }
      ANTES.set(d.id, { titulo: d.titulo, contenido: d.contenido, fecha: d.actualizado_en });
    }
  },
  /* 0117: publicado pone su fecha; una medición por momento; lo manual solo en la métrica manual. */
  interno_contenidos: (op, filas) => {
    for (const c of filas) {
      if (c.url && !/^https?:\/\//i.test(c.url)) throw new Error('violates check constraint "interno_contenidos_url"');
      if (["publicado", "medicion"].includes(c.estado)) c.publicado_en = c.publicado_en || new Date().toISOString();
    }
  },
  interno_contenido_metricas: (op, filas) => {
    for (const m of filas) {
      if (m.momento !== "otro" && tablaDe("interno_contenido_metricas").filter((x) => x.contenido_id === m.contenido_id && x.momento === m.momento).length > 1) {
        throw new Error('duplicate key value violates unique constraint "interno_contenido_metricas_una"');
      }
    }
  },
  interno_objetivos: (op, filas) => {
    for (const o of filas) {
      if (o.metrica !== "manual" && o.valor_manual != null) throw new Error('violates check constraint "interno_objetivos_manual"');
      if (o.limite < o.inicio) throw new Error('violates check constraint "interno_objetivos_fechas"');
    }
  },
  /* 0118: los checks de un movimiento, y el historial y el importe del
     cliente que escribe la base al tocar una suscripción. */
  interno_movimientos: (op, filas) => {
    for (const m of filas) {
      if (m.estado !== "anulado" && (m.estado === "pagado") !== !!m.fecha_pago) throw new Error('violates check constraint "interno_movimientos_pago"');
      if (!(Number(m.importe) > 0)) throw new Error('violates check constraint "interno_movimientos_importe"');
    }
  },
  interno_suscripciones: (op, filas, datos) => {
    const hoy = hoyDia();
    for (const x of filas) {
      if (x.estado === "baja" && !x.fin) throw new Error('violates check constraint "interno_suscripciones_baja"');
      const antes = ANTES_SUS.get(x.id);
      if (op === "insert") tablaDe("interno_suscripciones_cambios").push({ id: ++numeroCambio, suscripcion_id: x.id, fecha: x.inicio, importe_antes: null, importe_despues: x.importe_mensual, estado_antes: null, estado_despues: x.estado });
      else if (antes && (Number(antes.importe) !== Number(x.importe_mensual) || antes.estado !== x.estado)) {
        tablaDe("interno_suscripciones_cambios").push({ id: ++numeroCambio, suscripcion_id: x.id, fecha: x.estado === "baja" && antes.estado !== "baja" ? x.fin || hoy : hoy,
          importe_antes: antes.importe, importe_despues: x.importe_mensual, estado_antes: antes.estado, estado_despues: x.estado });
      }
      ANTES_SUS.set(x.id, { importe: x.importe_mensual, estado: x.estado });
      const c = tablaDe("interno_clientes").find((k) => k.id === x.cliente_id);
      if (c) c.importe_mensual = tablaDe("interno_suscripciones").filter((k) => k.cliente_id === c.id && k.estado === "activa" && k.moneda === "ARS").reduce((a, k) => a + Number(k.importe_mensual), 0);
    }
  },
  interno_impl_etapas: (op, filas, datos) => {
    if (op !== "update" || !datos || !datos.estado) return;
    for (const e of filas) {
      if (e.estado === "bloqueada" && !String(e.bloqueo || "").trim()) throw new Error('violates check constraint "interno_impl_etapas_bloqueo"');
      const todas = tablaDe("interno_impl_etapas").filter((x) => x.cliente_id === e.cliente_id);
      const c = tablaDe("interno_clientes").find((x) => x.id === e.cliente_id);
      if (c && c.estado === "implementacion" && todas.every((x) => ["hecha", "no_aplica"].includes(x.estado))) c.estado = "activo";
    }
  },
  interno_prospectos: (op, filas) => {
    if (op !== "insert") return;
    const primera = (T.interno_etapas || []).filter((e) => e.tipo === "abierta" && e.activa).sort((a, z) => a.orden - z.orden)[0];
    for (const p of filas) {
      if (!primera) break;
      (T.interno_oportunidades || (T.interno_oportunidades = [])).push({ id: uuid(), prospecto_id: p.id, nombre: `Genez para ${p.nombre}`, etapa_id: primera.id,
        valor: 0, probabilidad: primera.probabilidad, estado: "abierta", modulos: [], archivado_en: null, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() });
    }
  },
  interno_oportunidades: (op, filas, datos) => {
    if (op !== "update" || !datos || !datos.etapa_id) return;
    const e = (T.interno_etapas || []).find((x) => x.id === datos.etapa_id);
    for (const o of filas) {
      if (!e) continue;
      Object.assign(o, { estado: e.tipo, probabilidad: e.probabilidad, actualizado_en: new Date().toISOString(),
        ganada_en: e.tipo === "ganada" ? new Date().toISOString() : o.ganada_en || null });
      (T.interno_actividades || (T.interno_actividades = [])).push({ id: uuid(), prospecto_id: o.prospecto_id, oportunidad_id: o.id, tipo: "cambio_etapa",
        fecha: new Date().toISOString(), resultado: `→ ${e.nombre}`, datos: { a: e.id, a_nombre: e.nombre } });
    }
  },
  interno_actividades: (op, filas) => {
    if (op !== "insert") return;
    for (const a of filas) {
      if (a.tipo === "cambio_etapa" || a.tipo === "nota") continue;
      const p = (T.interno_prospectos || []).find((x) => x.id === a.prospecto_id);
      if (!p) continue;
      if (!p.ultimo_contacto || a.fecha > p.ultimo_contacto) p.ultimo_contacto = a.fecha;
      if (a.proxima_fecha) p.proximo_contacto = a.proxima_fecha;
      if (a.proxima_fecha || a.proxima_accion) p.proxima_accion = a.proxima_accion || null;
      const o = a.oportunidad_id && (T.interno_oportunidades || []).find((x) => x.id === a.oportunidad_id);
      if (o && (a.proxima_fecha || a.proxima_accion)) Object.assign(o, { proxima_accion: a.proxima_accion || null, fecha_seguimiento: a.proxima_fecha || null });
    }
  },
  interno_tareas: (op, filas, datos) => {
    if (op === "update" && datos && datos.estado === "completada") filas.forEach((t) => { t.completada_en = new Date().toISOString(); });
  },
};

/* Lo embebido (select("*, interno_prospectos(nombre)")): se pega la fila
   relacionada por su clave, prospecto_id para interno_prospectos. */
/* Las que no salen de sacarle la "s": automatizaciones no es
   automatizacione_id, y la plantilla va sin el wa_. */
const CLAVE_EMBEBIDA = { interno_automatizaciones: "automatizacion_id", interno_wa_plantillas: "plantilla_id" };
function embeber(filas, embebidos) {
  for (const tabla of embebidos) {
    const clave = CLAVE_EMBEBIDA[tabla] || tabla.replace(/^interno_/, "").replace(/s$/, "") + "_id";
    for (const f of filas) {
      if (f[tabla] !== undefined || !(clave in f)) continue;
      const r = (T[tabla] || []).find((x) => x.id === f[clave]);
      f[tabla] = r ? structuredClone(r) : null;
    }
  }
  return filas;
}

function ejecutar(q) {
  if (q.op === "select" && VISTAS[q.tabla]) T[q.tabla] = VISTAS[q.tabla]();
  const filas = T[q.tabla] || (T[q.tabla] = []);
  const cumple = (f) => q.filtros.every((fn) => fn(f));
  registro.push({ tabla: q.tabla, op: q.op });
  /* Una escritura que un disparador rechaza no deja nada a medias, como
     en la base: se vuelve a la foto de antes y se devuelve el error. */
  const antes = q.op === "select" ? null : structuredClone(T);
  try { return seguir(q, filas, cumple); }
  catch (e) { for (const k of Object.keys(T)) delete T[k]; Object.assign(T, antes); return { data: null, error: { code: "23514", message: e.message } }; }
}

function seguir(q, filas, cumple) {
  let res;
  if (q.op === "insert" || q.op === "upsert") {
    const nuevas = (Array.isArray(q.datos) ? q.datos : [q.datos]).map((d) => ({ id: uuid(), creado_en: new Date().toISOString(), fecha: new Date().toISOString(), ...(DEFECTOS[q.tabla] || {}), ...d }));
    for (const n of nuevas) {
      const i = q.op === "upsert" ? filas.findIndex((f) => f.id === n.id) : -1;
      if (i >= 0) filas[i] = { ...filas[i], ...n }; else filas.push(n);
    }
    res = nuevas;
    if (DISPARADORES[q.tabla]) DISPARADORES[q.tabla](q.op, filas.filter((f) => nuevas.some((n) => n.id === f.id)), q.datos);
  } else if (q.op === "update") {
    res = filas.filter(cumple);
    res.forEach((f) => Object.assign(f, q.datos));
    if (DISPARADORES[q.tabla]) DISPARADORES[q.tabla](q.op, res, q.datos);
  } else if (q.op === "delete") {
    res = filas.filter(cumple);
    T[q.tabla] = filas.filter((f) => !cumple(f));
  } else {
    res = filas.filter(cumple);
    for (const [c, asc] of [...q.orden].reverse()) {
      res = [...res].sort((a, z) => (a[c] == null ? 1 : z[c] == null ? -1 : (a[c] > z[c] ? 1 : a[c] < z[c] ? -1 : 0) * (asc ? 1 : -1)));
    }
  }
  /* Copias, como las devuelve Supabase: si no, la pantalla tendría en
     memoria las mismas filas que la base de mentira, y un cambio a una
     se vería en la otra sin pasar por ninguna consulta. */
  res = embeber(res.map((f) => structuredClone(f)), q.embebidos);
  const total = res.length;
  if (q.hasta != null) res = res.slice(q.desde, q.hasta + 1);
  if (q.uno) {
    if (!res.length) return q.uno === "single" ? { data: null, error: { code: "PGRST116", message: "No hay filas" } } : { data: null, error: null };
    return { data: res[0], error: null };
  }
  return { data: q.soloCabeza ? null : res, error: null, count: q.cuenta ? total : null };
}

/* Las funciones de la base: las que el sistema necesita para arrancar y
   para cobrar tienen una respuesta armada; las demás, vacío. */
const dia = (d) => d.toISOString().slice(0, 10);
function serie(desde, hasta) {
  const out = [];
  for (let d = new Date(desde); d <= hasta; d = new Date(d.getTime() + 86400000)) {
    const k = d.getDate();
    out.push({ fecha: dia(d), ventas: 20000 + (k * 7919) % 60000, costo: 12000 + (k * 3001) % 30000, tickets: 8 + (k * 13) % 20 });
  }
  return out;
}
let numero = 0;
/* Las funciones de 0115, en chico. */
function implArmar(clienteId) {
  const c = tablaDe("interno_clientes").find((x) => x.id === clienteId);
  const p = tablaDe("interno_prospectos").find((x) => x.id === c.prospecto_id) || {};
  const em = c.empresa_id && tablaDe("empresas").find((x) => x.id === c.empresa_id);
  const modulos = em ? em.modulos || [] : [];
  let sumados = 0;
  for (const l of tablaDe("interno_listas").filter((x) => x.tipo === "etapa_implementacion" && x.activo)) {
    let e = tablaDe("interno_impl_etapas").find((x) => x.cliente_id === clienteId && x.etapa === l.clave);
    if (!e) { e = { id: uuid(), cliente_id: clienteId, etapa: l.clave, orden: l.orden, estado: "pendiente", pasos: [], creado_en: new Date().toISOString() }; tablaDe("interno_impl_etapas").push(e); }
    for (const m of tablaDe("interno_impl_modelo").filter((x) => x.activo && x.etapa === l.clave)) {
      if (m.rubros.length && !m.rubros.includes(p.rubro)) continue;
      if (m.modulos.length && !m.modulos.some((x) => modulos.includes(x))) continue;
      if (e.pasos.some((x) => x.titulo === m.titulo)) continue;
      e.pasos = [...e.pasos, { titulo: m.titulo, hecho: false }]; sumados++;
    }
  }
  return sumados;
}
function convertir({ p_oportunidad, p_datos = {} }) {
  const o = tablaDe("interno_oportunidades").find((x) => x.id === p_oportunidad);
  if (!o) throw new Error("No existe la oportunidad");
  if (o.estado !== "ganada") throw new Error("Solo una oportunidad ganada pasa a cliente");
  if (tablaDe("interno_clientes").some((x) => x.prospecto_id === o.prospecto_id)) throw new Error("Ya es cliente");
  const alta = p_datos.alta || hoyDia(); const sin = !!p_datos.sin_implementacion;
  const c = { id: uuid(), prospecto_id: o.prospecto_id, oportunidad_id: o.id, empresa_id: p_datos.empresa_id || null, plan: p_datos.plan || null,
    importe_mensual: p_datos.importe_mensual ?? o.valor ?? 0, alta, renovacion: p_datos.renovacion || null, estado: sin ? "activo" : "implementacion",
    notas: p_datos.notas || null, archivado_en: null, creado_en: new Date().toISOString() };
  tablaDe("interno_clientes").push(c);
  const p = tablaDe("interno_prospectos").find((x) => x.id === o.prospecto_id);
  if (p) Object.assign(p, { cliente_desde: p.cliente_desde || `${alta}T12:00:00Z`, empresa_id: c.empresa_id });
  if (!sin) {
    implArmar(c.id);
    const v = tablaDe("interno_impl_etapas").find((x) => x.cliente_id === c.id && x.etapa === "venta_confirmada");
    if (v) Object.assign(v, { estado: "hecha", fecha: alta });
  }
  const tarea = (titulo, dia) => tablaDe("interno_tareas").push({ id: uuid(), titulo, categoria: "comercial", prioridad: "normal", estado: "pendiente",
    prospecto_id: o.prospecto_id, vence: `${dia}T13:00:00Z`, archivado_en: null, checklist: [], etiquetas: [], creado_en: new Date().toISOString() });
  if (!sin) for (const [titulo, dias] of [["Primer seguimiento después del alta", 7], ["Revisar cómo lo están usando", 30], ["Pedir un testimonio o una recomendación", 60]]) tarea(titulo, masDias(alta, dias));
  if (c.renovacion) tarea("Renovación: confirmar que sigue", masDias(c.renovacion, -15));
  return c.id;
}
const palabras = (t) => [...new Set(String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length >= 4))];

const FUNCIONES = {
  interno_convertir_en_cliente: convertir,
  /* 0123, en chico: los informes cuentan lo que hay en las tablas de
     mentira, sin mirar fechas (la prueba de verdad es la de la base). */
  interno_informe_whatsapp: () => {
    const ms = tablaDe("interno_wa_mensajes");
    const sal = (o) => ms.filter((m) => m.direccion === "saliente" && (o === "automatico" ? m.tipo === "template" : o === "asistente" ? m.del_bot : m.tipo !== "template" && !m.del_bot));
    const cuenta = (l) => ({ enviados: l.filter((m) => ["enviado", "entregado", "leido"].includes(m.estado)).length, entregados: l.filter((m) => ["entregado", "leido"].includes(m.estado)).length,
      leidos: l.filter((m) => m.estado === "leido").length, fallidos: l.filter((m) => m.estado === "fallido").length, enviando: 0 });
    const cs = tablaDe("interno_wa_conversaciones");
    const bs = tablaDe("interno_wa_borradores");
    return {
      salientes: { equipo: cuenta(sal("equipo")), asistente: cuenta(sal("asistente")), automatico: cuenta(sal("automatico")) },
      entrantes: ms.filter((m) => m.direccion === "entrante").length, conversaciones_nuevas: cs.length, conversaciones_con_respuesta: cs.length,
      calificadas: cs.filter((c) => c.prospecto_id).length, calificadas_ganadas: 0, bajas: cs.filter((c) => c.consentimiento === "baja").length,
      consentimientos: cs.filter((c) => c.consentimiento === "dado").length, errores: {},
      automatizaciones: { enviados: tablaDe("interno_envios").filter((e) => e.estado === "enviado").length, respondidos: 1, fallidos: 0, omitidos: 1, cancelados: 0, utilidad: 1, marketing: 0 },
      asistente: { respuestas: bs.filter((b) => b.accion === "responder").length, usados: bs.filter((b) => b.estado === "enviado").length, derivadas: 1, descartados: 0, errores: 0 },
      uso_modelos: [{ modelo: "claude-opus-5-5", pedidos: 12, entrada: 14000, salida: 1100, cache_leido: 30000, cache_escrito: 4000 }],
    };
  },
  interno_informe_descubrimiento: () => ({
    por_proveedor: [{ proveedor: "osm", descubiertos: tablaDe("interno_hallazgos").length, con_telefono: 1, al_crm: 0, descartados: 0 }],
    busquedas: tablaDe("interno_busquedas").length, busquedas_con_error: 0,
    pedidos_web: tablaDe("solicitudes").length, pedidos_web_al_crm: tablaDe("solicitudes").filter((s) => s.prospecto_id).length,
    demos_agendadas: 1, demos_realizadas: 0, demos_canceladas: 0, demos_vencidas: 0,
  }),
  interno_solicitud_a_prospecto: ({ p_solicitud }) => {
    const s = tablaDe("solicitudes").find((x) => x.id === p_solicitud);
    if (!s) throw new Error("No existe ese pedido.");
    if (s.prospecto_id) throw new Error("Ese pedido ya está en el CRM.");
    const p = { id: uuid(), nombre: s.negocio || s.nombre, telefono: s.telefono, whatsapp: s.telefono, email: s.email, fuente: "landing",
      modulos: s.modulos || [], etiquetas: [], campos_extra: {}, archivado_en: null, creado_en: new Date().toISOString() };
    tablaDe("interno_prospectos").push(p);
    s.prospecto_id = p.id;
    return p.id;
  },
  /* 0119, en chico: guardar sin duplicar por proveedor e id, y pasar al CRM. */
  interno_guardar_hallazgos: ({ p_busqueda, p_items }) => {
    const b = tablaDe("interno_busquedas").find((x) => x.id === p_busqueda);
    if (!b) throw new Error("No existe la búsqueda");
    const out = [];
    for (const it of p_items || []) {
      if (!String(it.nombre || "").trim() || !it.externo_id) continue;
      let h = tablaDe("interno_hallazgos").find((x) => x.proveedor === b.proveedor && x.externo_id === it.externo_id);
      const nuevo = !h;
      const campos = { ...it, web: /^https?:\/\//i.test(it.web || "") ? it.web : null, busqueda_id: p_busqueda, visto_en: new Date().toISOString() };
      if (h) Object.assign(h, campos, { zona: h.zona || it.zona });
      else { h = { id: uuid(), proveedor: b.proveedor, prospecto_id: null, descartado_en: null, obtenido_en: new Date().toISOString(), creado_en: new Date().toISOString(), ...campos }; tablaDe("interno_hallazgos").push(h); }
      out.push({ hallazgo_id: h.id, nuevo });
    }
    Object.assign(b, { resultados: out.length, nuevos: out.filter((x) => x.nuevo).length });
    return out;
  },
  interno_incorporar_hallazgo: ({ p_hallazgo, p_prospecto }) => {
    const h = tablaDe("interno_hallazgos").find((x) => x.id === p_hallazgo);
    if (!h) throw new Error("No existe el hallazgo");
    if (h.prospecto_id) throw new Error("Ya está en el CRM");
    let p;
    if (!p_prospecto) {
      p = { id: uuid(), nombre: h.nombre, rubro: h.rubro, zona: h.zona, localidad: h.localidad, direccion: h.direccion, telefono: h.telefono, email: h.email,
        fuente: h.proveedor === "osm" ? "openstreetmap" : "planilla", origen_proveedor: h.proveedor, origen_externo_id: h.externo_id, origen_obtenido_en: h.obtenido_en,
        origen_verificado_en: null, archivado_en: null, creado_en: new Date().toISOString(), modulos: [], etiquetas: [], campos_extra: {} };
      tablaDe("interno_prospectos").push(p);
      DISPARADORES.interno_prospectos("insert", [p]);
    } else {
      p = tablaDe("interno_prospectos").find((x) => x.id === p_prospecto);
      if (!p) throw new Error("No existe el prospecto");
      for (const k of ["rubro", "zona", "localidad", "direccion", "telefono", "email"]) if (p[k] == null || p[k] === "") p[k] = h[k];
      p.origen_proveedor = p.origen_proveedor || h.proveedor; p.origen_externo_id = p.origen_externo_id || h.externo_id; p.origen_obtenido_en = p.origen_obtenido_en || h.obtenido_en;
    }
    h.prospecto_id = p.id;
    tablaDe("interno_actividades").push({ id: uuid(), prospecto_id: p.id, tipo: "nota", fecha: new Date().toISOString(), resultado: `Encontrado en OpenStreetMap. Datos sin verificar.`, datos: {} });
    return p.id;
  },
  interno_generar_cobros: ({ p_mes }) => {
    const mes = String(p_mes).slice(0, 7), ini = `${mes}-01`;
    const fin = new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)).toISOString().slice(0, 10);
    let n = 0;
    for (const x of tablaDe("interno_suscripciones")) {
      if (x.estado !== "activa" || !(Number(x.importe_mensual) > 0) || x.inicio > fin || (x.fin && x.fin < ini)) continue;
      if (tablaDe("interno_movimientos").some((m) => m.suscripcion_id === x.id && m.periodo === ini && m.estado !== "anulado")) continue;
      const c = tablaDe("interno_clientes").find((k) => k.id === x.cliente_id);
      const p = c && tablaDe("interno_prospectos").find((k) => k.id === c.prospecto_id);
      tablaDe("interno_movimientos").push({ id: uuid(), tipo: "ingreso", concepto: `Suscripción ${x.plan ? `${x.plan} · ` : ""}${p ? p.nombre : ""} · ${mes.slice(5)}/${mes.slice(0, 4)}`,
        categoria: "suscripcion", importe: x.importe_mensual, moneda: x.moneda, periodo: ini, emision: ini, vencimiento: `${mes}-${String(x.dia_cobro).padStart(2, "0")}`,
        estado: "pendiente", facturado: false, fijo: false, cliente_id: x.cliente_id, suscripcion_id: x.id, creado_en: new Date().toISOString() });
      n++;
    }
    return n;
  },
  interno_buscar_perfil: ({ p_email }) => tablaDe("perfiles").filter((p) => String(p.email || "").toLowerCase() === String(p_email || "").trim().toLowerCase())
    .map((p) => ({ id: p.id, nombre: p.nombre, email: p.email, es_de_un_comercio: !!p.empresa_id, ya_es_miembro: tablaDe("interno_miembros").some((m) => m.perfil_id === p.id) })),
  interno_ticket_a_producto: ({ p_ticket, p_tipo }) => {
    const t = tablaDe("interno_tickets").find((x) => x.id === p_ticket);
    if (!t) throw new Error("No existe el ticket, o no tenés acceso a soporte");
    const tipo = p_tipo || (t.categoria === "error" ? "bug" : "solicitud");
    const r = { id: uuid(), tipo, titulo: t.titulo, descripcion: t.descripcion || null, pasos: t.pasos || null, modulo: t.modulo || null,
      gravedad: tipo === "bug" ? t.gravedad : null, cliente_id: t.cliente_id || null, prioridad: t.prioridad, estado: "idea", orden: 0,
      archivado_en: null, creado_en: new Date().toISOString() };
    tablaDe("interno_roadmap").push(r);
    tablaDe("interno_roadmap_tickets").push({ roadmap_id: r.id, ticket_id: t.id, creado_en: new Date().toISOString() });
    return r.id;
  },
  interno_cliente_desde_comercio: ({ p_empresa, p_datos = {} }) => {
    const em = tablaDe("empresas").find((x) => x.id === p_empresa);
    if (!em) throw new Error("No existe el comercio");
    if (tablaDe("interno_clientes").some((x) => x.empresa_id === p_empresa)) throw new Error("Ese comercio ya es cliente");
    const ganada = tablaDe("interno_etapas").filter((e) => e.tipo === "ganada").sort((a, b) => a.orden - b.orden)[0];
    const p = { id: uuid(), nombre: em.nombre, rubro: { minimercado: "almacen_kiosco_o_supermercado", gastronomia: "gastronomia" }[em.rubro] || null, empresa_id: em.id,
      archivado_en: null, creado_en: new Date().toISOString(), modulos: [], etiquetas: [], campos_extra: {} };
    tablaDe("interno_prospectos").push(p);
    const o = { id: uuid(), prospecto_id: p.id, nombre: `Genez para ${p.nombre}`, etapa_id: ganada.id, valor: p_datos.importe_mensual || 0, probabilidad: 100,
      estado: "ganada", ganada_en: new Date().toISOString(), modulos: [], archivado_en: null, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() };
    tablaDe("interno_oportunidades").push(o);
    tablaDe("interno_actividades").push({ id: uuid(), prospecto_id: p.id, oportunidad_id: o.id, tipo: "cambio_etapa", fecha: new Date().toISOString(), resultado: `Nuevo → ${ganada.nombre}`, datos: {} });
    return convertir({ p_oportunidad: o.id, p_datos: { ...p_datos, empresa_id: p_empresa } });
  },
  interno_comercio: ({ p_empresa }) => {
    const e = tablaDe("empresas").find((x) => x.id === p_empresa);
    return e ? { id: e.id, nombre: e.nombre, rubro: e.rubro, plan: e.plan, modulos: e.modulos || [], activa: e.activa !== false, slug: e.slug || null,
      sucursales: tablaDe("sucursales").filter((s) => s.empresa_id === e.id && s.activa).map((s) => s.nombre) } : null;
  },
  interno_comercios_libres: () => tablaDe("empresas").filter((e) => !tablaDe("interno_clientes").some((c) => c.empresa_id === e.id))
    .map((e) => ({ id: e.id, nombre: e.nombre, rubro: e.rubro, creada_en: e.creada_en })),
  interno_impl_armar: ({ p_cliente }) => implArmar(p_cliente),
  interno_tickets_parecidos: ({ p_texto, p_modulo, p_excluir }) => {
    const buscadas = palabras(p_texto);
    return tablaDe("interno_tickets").filter((t) => !t.archivado_en && t.id !== p_excluir)
      .map((t) => ({ t, n: palabras(`${t.titulo} ${t.descripcion || ""}`).filter((w) => buscadas.includes(w)).length }))
      .filter((x) => x.n > 0).map(({ t, n }) => ({ id: t.id, numero: t.numero, titulo: t.titulo, estado: t.estado, modulo: t.modulo,
        coincidencias: n + (p_modulo && t.modulo === p_modulo ? 1 : 0), creado_en: t.creado_en }))
      .sort((a, b) => b.coincidencias - a.coincidencias).slice(0, 5);
  },
  permiso: () => true,
  tarifas_publicas: () => T.tarifas || [],
  /* El autoservicio (0127). */
  mi_cuenta: () => {
    const e = datos.empresa;
    return { id: e.id, nombre: e.nombre, rubro: e.rubro, plan: e.plan, modulos: e.modulos, activa: e.activa !== false,
      prueba_hasta: e.prueba_hasta || null, hoy: hoyFalso(), pago_avisado_en: estadoPrueba.pago, ejemplos: !estadoPrueba.borrados,
      plan_elegido: "start", suscripcion: estadoPrueba.suscripcion || null };
  },
  crear_comercio_de_prueba: ({ p }) => { T.altaDePrueba = p; return datos.empresa.id; },
  borrar_ejemplos: () => { estadoPrueba.borrados = true; return null; },
  avisar_pago: () => { estadoPrueba.pago = new Date().toISOString(); return null; },
  /* El pedido de la landing (alta, "Hacemos más"): queda en la tabla de
     mentira para que el formulario se pueda probar entero. */
  pedir_presupuesto: ({ p }) => {
    const id = `sol-${Date.now()}`;
    (T.solicitudes = T.solicitudes || []).unshift({ id, creado_en: new Date().toISOString(), estado: "nueva", ...p });
    return id;
  },
  interno_posibles_duplicados: ({ p_nombre, p_telefono, p_excluir }) => {
    const n = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    const tel = normTel;
    return (T.interno_prospectos || []).filter((p) => p.id !== p_excluir && ((p_nombre && n(p.nombre) === n(p_nombre)) || (p_telefono && tel(p_telefono).length >= 8 && tel(p.telefono) === tel(p_telefono))))
      .map((p) => ({ id: p.id, nombre: p.nombre, localidad: p.localidad, telefono: p.telefono, email: p.email, motivo: n(p.nombre) === n(p_nombre) ? "nombre y localidad" : "teléfono", archivado: !!p.archivado_en }));
  },
  ventas_diarias: ({ p_dias = 90 }) => serie(new Date(Date.now() - (p_dias - 1) * 86400000), new Date()),
  ventas_diarias_rango: ({ p_desde, p_hasta }) => serie(new Date(`${p_desde}T12:00:00`), new Date(`${p_hasta}T12:00:00`)),
  ventas_por_item: () => [], ventas_por_item_rango: () => [],
  reservar_numeros: () => (numero += 50) - 49,
  registrar_venta: ({ venta }) => {
    T.operaciones.push({ ...venta, tipo: "venta", estado: "confirmada" });
    return venta.id;
  },
  transferir_stock: () => null, ajustar_stock: ({ p_real }) => [{ antes: 0, diferencia: p_real }],
  ajustar_stock_lote: ({ p_filas }) => p_filas.map((f) => ({ item_id: f.item_id, antes: 0, diferencia: f.real })),
  abrir_comanda: () => uuid(),
  /* Cualquier cliente tiene 530 puntos, 30 por vencer: alcanza para ver
     el canje en el cobro. Sumar y restar lo hace la base de verdad. */
  saldo_puntos: () => [{ saldo: 530, por_vencer: 30, proximo_vencimiento: dia(new Date(Date.now() + 20 * 86400000)) }],
  ajustar_puntos: ({ p_cliente, p_puntos, p_detalle }) => {
    (T.puntos_movimientos || (T.puntos_movimientos = [])).push({ id: uuid(), cliente_id: p_cliente, puntos: p_puntos, tipo: "ajuste", detalle: p_detalle, vence: null, sin_saldo: false, fecha: new Date().toISOString() });
    return null;
  },
};

function rpc(nombre, params = {}) {
  registro.push({ rpc: nombre });
  const fn = FUNCIONES[nombre];
  /* Una función que falla en la base devuelve el error, no revienta: acá igual. */
  let data = null, error = null;
  try { data = fn ? fn(params) : null; } catch (e) { error = { message: e.message }; }
  const b = {
    then(ok, mal) { return Promise.resolve({ data, error }).then(ok, mal); },
    single() { return b; }, maybeSingle() { return b; }, select() { return b; },
  };
  return b;
}

const sesion = { access_token: "falso", user: USUARIO };

/* ?sesion=ninguna: arranca sin sesión, para ver el login. Cualquier correo
   y contraseña entran (al comercio de siempre), y Salir vuelve al login. */
const sinSesion = params.get("sesion") === "ninguna";
let conectado = !sinSesion;
const canal = () => { const c = { on: () => c, subscribe: () => c, unsubscribe: () => {} }; return c; };

export const supabase = {
  from: consulta,
  rpc,
  channel: canal,
  removeChannel: () => {},
  auth: {
    getUser: async () => ({ data: { user: conectado ? USUARIO : null }, error: null }),
    getSession: async () => ({ data: { session: conectado ? sesion : null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => { conectado = true; return { data: { session: sesion }, error: null }; },
    /* El registro de la landing: no crea nada, deja anotado qué se mandó. */
    signUp: async ({ email, options }) => {
      registro.push({ signUp: email, registro: options && options.data && options.data.registro });
      return { data: { user: { id: uuid(), email, identities: [{}] }, session: null }, error: null };
    },
    signOut: async () => { if (sinSesion) conectado = false; return { error: null }; },
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: USUARIO }, error: null }),
  },
  storage: {
    from: () => ({
      upload: async (ruta) => { registro.push({ subir: ruta }); return { data: { path: ruta }, error: null }; },
      createSignedUrl: async (ruta) => ({ data: { signedUrl: `data:text/plain,archivo de prueba: ${encodeURIComponent(ruta)}` }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      remove: async () => ({ error: null }),
    }),
  },
};

/* ============================================================
   OpenStreetMap de mentira
   ============================================================
   El prospector le pide a Overpass desde el navegador. En la pantalla
   de pruebas contesta esto, siempre igual: la prueba no depende de que
   el servidor público esté libre (el 29/09 devolvió 504), y no le suma
   pedidos. Comercios inventados, con ids que no existen en OSM. */
if (typeof window !== "undefined" && !window.__genezOverpassFalso) {
  window.__genezOverpassFalso = true;
  const original = window.fetch.bind(window);
  window.fetch = (url, opciones) => {
    if (!String(url).includes("overpass-api.de")) return original(url, opciones);
    registro.push({ overpass: true });
    const elementos = [
      { type: "node", id: 9000001, lat: -34.6071, lon: -58.5655, tags: { name: "Almacén de prueba El Sol", shop: "convenience", phone: "011 4750-0001", "addr:street": "Calle de prueba", "addr:housenumber": "100" } },
      { type: "node", id: 9000002, lat: -34.6080, lon: -58.5670, tags: { name: "Panadería de prueba", shop: "bakery", website: "panaderia.test" } },
      { type: "way", id: 9000003, center: { lat: -34.6065, lon: -58.5640 }, tags: { name: "Kiosco de prueba 24", shop: "kiosk", phone: "1100000000" } },
    ];
    return Promise.resolve(new Response(JSON.stringify({ elements: elementos }), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
}

/* ============================================================
   api/founder.js de mentira (WhatsApp, 0120)
   ============================================================
   En modo pruebas api/ no se sirve. Mandar deja el mensaje como lo
   dejaría el servidor (con las mismas negativas de la base: la baja y la
   ventana) y "estado" contesta como un número todavía pendiente, con
   las variables a medio cargar, que es donde está hoy el de Genez. */
if (typeof window !== "undefined" && !window.__genezFounderFalso) {
  window.__genezFounderFalso = true;
  const anterior = window.fetch;
  const json = (o, status = 200) => Promise.resolve(new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } }));
  window.fetch = (url, opciones = {}) => {
    if (!String(url).startsWith("/api/founder")) return anterior(url, opciones);
    const cuerpo = JSON.parse(opciones.body || "{}");
    registro.push({ api: "founder", accion: cuerpo.accion });
    if (cuerpo.accion === "contratar") {
      const precios = { start: 29900, pro: 59900 };
      const monto = (precios[cuerpo.plan] || 0) * (cuerpo.periodo === "anual" ? 10 : 1);
      estadoPrueba.suscripcion = { plan: cuerpo.plan, periodo: cuerpo.periodo, monto, estado: "pendiente", pago_fallido_desde: null, proximo_cobro: null };
      return json({ link: `${location.pathname}${location.search}${location.search ? "&" : "?"}suscripcion=volvio`, monto, periodo: cuerpo.periodo, plan: cuerpo.plan });
    }
    if (cuerpo.accion === "enviar") {
      const c = tablaDe("interno_wa_conversaciones").find((x) => x.id === cuerpo.conversacion);
      if (!c) return json({ error: { message: "No existe esa conversación." } }, 400);
      if (c.consentimiento === "baja") return json({ error: { message: "Esta persona pidió que no le escriban." } }, 403);
      if (!c.ultimo_entrante_en || Date.now() - new Date(c.ultimo_entrante_en).getTime() > 24 * 3600000) {
        return json({ error: { message: "Pasaron más de 24 horas desde su último mensaje: Meta solo deja mandar una plantilla aprobada." } }, 403);
      }
      if (cuerpo.borrador) { const b = tablaDe("interno_wa_borradores").find((x) => x.id === cuerpo.borrador && x.estado === "pendiente"); if (b) b.estado = "enviado"; }
      const ya = tablaDe("interno_wa_mensajes").find((m) => m.idempotencia === cuerpo.idempotencia);
      if (ya) return json({ mensaje: ya.id, estado: ya.estado, repetido: true });
      const ahora = new Date().toISOString();
      const m = { id: uuid(), conversacion_id: c.id, direccion: "saliente", tipo: "text", texto: String(cuerpo.texto).trim(), datos: {}, estado: "enviado",
        error: null, idempotencia: cuerpo.idempotencia, wamid: `wamid.prueba-${Date.now()}`, momento: ahora, estado_en: ahora };
      tablaDe("interno_wa_mensajes").push(m);
      Object.assign(c, { ultimo_mensaje_en: ahora, ultimo_texto: m.texto.slice(0, 200), ultimo_direccion: "saliente", no_leidos: 0 });
      return json({ mensaje: m.id, estado: "enviado", wamid: m.wamid });
    }
    /* Las automatizaciones de mentira: la corrida no genera nada nuevo;
       mandar a Meta pasa la plantilla a revisión. */
    if (cuerpo.accion === "automatizaciones") {
      const r = { generados: 0, alertas: 0, enviados: 0, fallidos: 0, error: null };
      tablaDe("interno_auto_corridas").unshift({ id: Date.now(), empezo_en: new Date().toISOString(), termino_en: new Date().toISOString(), origen: "manual", ...r });
      return json(r);
    }
    if (cuerpo.accion === "plantilla") {
      const p = tablaDe("interno_wa_plantillas").find((x) => x.id === cuerpo.plantilla);
      if (p) p.estado = "enviada";
      return json({ ok: true, estado: "enviada" });
    }
    if (cuerpo.accion === "sincronizar") return json({ ok: true });
    /* El asistente de mentira: siempre el mismo borrador, sin modelo. */
    if (cuerpo.accion === "borrador") {
      tablaDe("interno_wa_borradores").forEach((b) => { if (b.conversacion_id === cuerpo.conversacion && b.estado === "pendiente") b.estado = "reemplazado"; });
      const b = { id: uuid(), conversacion_id: cuerpo.conversacion, accion: "responder", estado: "pendiente", creado_en: new Date().toISOString(), modelo: "de-prueba",
        texto: "¡Hola! Genez es un sistema de gestión para comercios. ¿Qué tipo de negocio tenés?", motivo: "Primer contacto.", datos: { rubro: "", necesidad: "", negocio: "", quiere_demo: false },
        conocimiento: [{ id: "doc", titulo: "Qué es Genez", version: 2 }] };
      tablaDe("interno_wa_borradores").push(b);
      return json({ borrador: b });
    }
    if (cuerpo.accion === "estado") {
      const aj = (tablaDe("interno_ajustes").find((a) => a.clave === "whatsapp") || {}).valor || {};
      return json({
        webhook: `${location.origin}/api/founder`,
        variables: { WHATSAPP_TOKEN: true, WHATSAPP_APP_SECRET: true, WHATSAPP_VERIFY_TOKEN: false, WHATSAPP_PIN: false },
        ajustes: aj,
        numero: { display_phone_number: aj.numero, verified_name: "Genez", name_status: "APPROVED", status: "PENDING", quality_rating: "UNKNOWN" },
        suscripcion: { data: [] },
        eventos: tablaDe("interno_wa_eventos").slice().reverse(),
      });
    }
    return json({ error: { message: "En la pantalla de pruebas no se habla con Meta." } }, 503);
  };
}

/* ============================================================
   Recorrer todas las pestañas: await window.__genezRecorrer()
   ============================================================
   Entra a cada sección del menú del Panel, espera a que monte y anota
   los errores y los avisos rojos que aparecieron. Devuelve { arranque,
   pestañas }: "ok" o lo que falló. Es lo que hay que correr antes de
   publicar un cambio de pantalla (ver CLAUDE.md). */
if (typeof window !== "undefined") {
  window.__genezRecorrer = async (espera = 1200) => {
    const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
    const boton = (raiz, n) => [...raiz.querySelectorAll("button")].find((b) => b.textContent.trim() === n);
    const alPanel = async () => {
      if (!document.querySelector("aside")) { const p = boton(document.body, "Panel"); if (p) { p.click(); await pausa(1000); } }
    };
    const arranque = { errores: [...window.__genezErrores], avisos: [...window.__genezAvisos] };
    await alPanel();
    const lado = document.querySelector("aside");
    if (!lado) return { arranque, sinMenu: true, texto: document.body.innerText.slice(0, 200) };
    const nombres = [...new Set([...lado.querySelectorAll("button")].map((b) => b.textContent.trim())
      .filter((t) => t && t.length < 30 && !/^(Comanda|Cobrar)/.test(t) && !/Salir|Cerrar sesión|modo claro|modo oscuro/i.test(t)))];
    const pestañas = [];
    for (const n of nombres) {
      await alPanel();
      const e0 = window.__genezErrores.length, a0 = window.__genezAvisos.length;
      const b = document.querySelector("aside") && boton(document.querySelector("aside"), n);
      if (!b) { pestañas.push({ n, falta: true }); continue; }
      b.click();
      await pausa(espera);
      const e = window.__genezErrores.slice(e0), a = window.__genezAvisos.slice(a0);
      /* Una sección que no monta nada no tira error: pasó con Founder,
         cuando el menú tenía la entrada y el marco no la dibujaba. */
      const main = document.querySelector("main");
      const vacia = main && main.innerText.trim().length < 10;
      pestañas.push(e.length || a.length || vacia ? { n, errores: e, avisos: a, ...(vacia ? { vacia: true } : {}) } : `${n} ok`);
    }
    return { arranque, pestañas };
  };
}
