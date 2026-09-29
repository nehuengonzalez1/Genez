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

const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const datos = armarDatos(params.get("rubro") || "minimercado");
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
  const q = { tabla, filtros: [], orden: [], desde: 0, hasta: null, uno: null, op: "select", datos: null, cuenta: false, soloCabeza: false };
  const b = {
    select(_cols, opciones) { if (opciones && opciones.count) { q.cuenta = true; q.soloCabeza = !!opciones.head; } return p; },
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
  clientes_vista: () => (T.clientes || []).map((c) => ({
    turnos: 0, asistio: 0, ausencias: 0, asistencia: null, gastado: 0, compras: 0, abonos_activos: 0, notas: 0,
    ultima: null, proxima: null, activo: true, ...c,
  })),
};

function ejecutar(q) {
  if (q.op === "select" && VISTAS[q.tabla]) T[q.tabla] = VISTAS[q.tabla]();
  const filas = T[q.tabla] || (T[q.tabla] = []);
  const cumple = (f) => q.filtros.every((fn) => fn(f));
  registro.push({ tabla: q.tabla, op: q.op });
  let res;
  if (q.op === "insert" || q.op === "upsert") {
    const nuevas = (Array.isArray(q.datos) ? q.datos : [q.datos]).map((d) => ({ id: uuid(), creado_en: new Date().toISOString(), fecha: new Date().toISOString(), ...d }));
    for (const n of nuevas) {
      const i = q.op === "upsert" ? filas.findIndex((f) => f.id === n.id) : -1;
      if (i >= 0) filas[i] = { ...filas[i], ...n }; else filas.push(n);
    }
    res = nuevas;
  } else if (q.op === "update") {
    res = filas.filter(cumple);
    res.forEach((f) => Object.assign(f, q.datos));
  } else if (q.op === "delete") {
    res = filas.filter(cumple);
    T[q.tabla] = filas.filter((f) => !cumple(f));
  } else {
    res = filas.filter(cumple);
    for (const [c, asc] of [...q.orden].reverse()) {
      res = [...res].sort((a, z) => (a[c] == null ? 1 : z[c] == null ? -1 : (a[c] > z[c] ? 1 : a[c] < z[c] ? -1 : 0) * (asc ? 1 : -1)));
    }
  }
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
      pestañas.push(e.length || a.length ? { n, errores: e, avisos: a } : `${n} ok`);
    }
    return { arranque, pestañas };
  };
}
