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
const VISTAS = {
  /* La del CRM (0114): el prospecto con su oportunidad abierta. */
  interno_prospectos_vista: () => (T.interno_prospectos || []).map((p) => {
    const o = (T.interno_oportunidades || []).filter((x) => x.prospecto_id === p.id && !x.archivado_en)
      .sort((a, z) => (a.estado === "abierta" ? -1 : 1) - (z.estado === "abierta" ? -1 : 1))[0];
    const e = o && (T.interno_etapas || []).find((x) => x.id === o.etapa_id);
    return { ...p, oportunidad_id: o ? o.id : null, etapa_id: o ? o.etapa_id : null, etapa_nombre: e ? e.nombre : null, etapa_orden: e ? e.orden : null,
      valor: o ? o.valor : null, probabilidad: o ? o.probabilidad : null, oportunidad_estado: o ? o.estado : null };
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
};

/* Lo que en la base hacen los disparadores de 0114, en chico: la primera
   oportunidad de un prospecto, y qué cambia al mover una de etapa. */
const DISPARADORES = {
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
function embeber(filas, embebidos) {
  for (const tabla of embebidos) {
    const clave = tabla.replace(/^interno_/, "").replace(/s$/, "") + "_id";
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
const FUNCIONES = {
  permiso: () => true,
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
  const data = fn ? fn(params) : null;
  const b = {
    then(ok, mal) { return Promise.resolve({ data, error: null }).then(ok, mal); },
    single() { return b; }, maybeSingle() { return b; }, select() { return b; },
  };
  return b;
}

const sesion = { access_token: "falso", user: USUARIO };
const canal = () => { const c = { on: () => c, subscribe: () => c, unsubscribe: () => {} }; return c; };

export const supabase = {
  from: consulta,
  rpc,
  channel: canal,
  removeChannel: () => {},
  auth: {
    getUser: async () => ({ data: { user: USUARIO }, error: null }),
    getSession: async () => ({ data: { session: sesion }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: { session: sesion }, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: USUARIO }, error: null }),
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: "prueba" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      remove: async () => ({ error: null }),
    }),
  },
};

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
