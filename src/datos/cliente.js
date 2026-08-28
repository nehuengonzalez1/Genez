/* ============================================================
   LA APP DEL CLIENTE · lo que ve quien saca el turno
   ============================================================

   Ver la migración 0050 y `docs/modelo-identidad-del-cliente.md`.

   ACÁ NO HAY UNA SOLA CONSULTA A UNA TABLA
   ----------------------------------------
   Y no es un descuido: es el diseño. El cliente lee funciones que
   proyectan solo lo suyo, columna por columna. Una política de RLS decide
   sobre la fila y deja pasar todas sus columnas —incluido el costo de un
   servicio y las notas internas de recepción— y peor: cada columna que se
   agregue mañana a esas tablas quedaría expuesta sola.

   Si alguna vez alguien escribe acá un `.from("reservas")`, el aislamiento
   se rompe en silencio. La base lo va a rechazar igual —un cliente no ve
   ninguna tabla— pero conviene saber por qué está escrito así.

   El cliente de Supabase es el mismo que usa el sistema de gestión: la
   sesión, el refresco del token y el link de recuperación ya están
   resueltos ahí y no hay razón para tener dos.
   ============================================================ */

import { supabase } from "./supabase.js";

/* ------------------------------------------------------------
   De qué comercio es esta app

   Del dominio y no de la sesión: `almha.genez.com.ar`. Es lo que permite
   mostrar la marca en la bienvenida, antes de que la persona entre. Si
   saliera del login, hasta ese momento la app no sería de nadie.

   En desarrollo no hay subdominio, así que se acepta `?c=almha`. No es un
   agujero: lo único que decide es qué marca se dibuja, y `marca_de` solo
   devuelve lo que ya es público. Quién ve qué datos lo sigue decidiendo
   la sesión.
   ------------------------------------------------------------ */

export function slugDelDominio() {
  if (typeof window === "undefined") return null;

  const forzado = new URLSearchParams(window.location.search).get("c");
  if (forzado) return forzado.trim().toLowerCase();

  const partes = window.location.hostname.split(".");
  /* `almha.genez.com.ar` son cuatro; `almha.localhost` son dos. Lo que se
     descarta es el dominio pelado y el www. */
  if (partes.length >= 2 && partes[0] !== "www" && partes[0] !== "genez") {
    if (partes.length > 2 || partes[1] === "localhost") return partes[0];
  }
  return null;
}

/* La marca del comercio. Es la única consulta del sistema que se puede
   hacer sin sesión, y devuelve solo lo que ya es público: cómo se llama
   y cómo se ve. Ver la migración 0052. */
export async function cargarMarca(slug) {
  if (!slug) return null;

  const { data, error } = await supabase.rpc("marca_de", { p_slug: slug });
  if (error) throw new Error("No pudimos identificar el comercio.");
  if (!data || !data.length) return null;

  const m = data[0];
  return {
    slug: m.slug,
    nombre: m.nombre,
    rubro: m.rubro,
    tema: m.tema || "calido",
    lema: m.lema || "",
    bajada: m.bajada || "",
    logo: m.logo || null,
    portada: m.portada || null,
  };
}

/* Qué muestra la app de este comercio. Sale de cruzar el catálogo de
   plataforma con lo que el comercio contrató y no apagó, así que la
   navegación se dibuja y no se decide en el código. */
export async function cargarModulos(empresaId) {
  if (!empresaId) throw new Error("cargarModulos necesita saber de qué comercio.");

  const { data, error } = await supabase.rpc("modulos_del_cliente", { p_empresa: empresaId });
  if (error) throw new Error("No pudimos cargar la aplicación.");

  return (data || []).map((m) => ({
    k: m.clave,
    n: m.nombre,
    icono: m.icono,
  }));
}

/* ------------------------------------------------------------
   Entrar
   ------------------------------------------------------------ */

export async function entrarComoCliente(email, clave) {
  const { error } = await supabase.auth.signInWithPassword({
    email: (email || "").trim(),
    password: clave,
  });

  /* Un mensaje único, igual que en el sistema de gestión: distinguir "no
     existe" de "clave equivocada" le sirve a quien prueba direcciones, no
     a quien se equivocó tipeando. */
  if (error) throw new Error("Correo o contraseña incorrectos.");

  return cargarClienta();
}

export async function salir() {
  await supabase.auth.signOut();
}

/* ------------------------------------------------------------
   Quién entró

   Devuelve null si no hay sesión. Si hay sesión pero la cuenta no está
   enlazada a ninguna ficha, devuelve `sinFichas`: es alguien que se
   registró y todavía ningún comercio lo reconoció como cliente. No es un
   error, es un estado, y la pantalla tiene que saber decirlo.
   ------------------------------------------------------------ */

export async function cargarClienta() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("mis_comercios");
  if (error) throw new Error("No pudimos cargar tus comercios.");

  const comercios = (data || []).map((c) => ({
    empresaId: c.empresa_id,
    slug: c.slug,
    nombre: c.nombre,
    rubro: c.rubro,
    fichaId: c.ficha_id,
    /* Como la llama el comercio, no como se llama la cuenta. Una persona
       puede llamarse distinto en dos comercios y el que vale es el de la
       ficha. */
    miNombre: c.mi_nombre || '',
    desde: c.desde ? new Date(c.desde) : null,
  }));

  return {
    email: user.email,
    comercios,
    sinFichas: comercios.length === 0,
  };
}

/* ------------------------------------------------------------
   Los turnos

   `mis_turnos` devuelve los de todos los comercios juntos, porque la
   misma persona puede ir a la estética y al gimnasio y lo que quiere ver
   es qué tiene esta semana, no en cuál. El filtro por comercio se hace
   acá, en pantalla, y no en la base.
   ------------------------------------------------------------ */

export async function cargarTurnos({ desde = null } = {}) {
  const { data, error } = await supabase.rpc("mis_turnos", { p_desde: desde });
  if (error) throw new Error("No pudimos cargar tus turnos.");

  return (data || []).map((t) => ({
    id: t.id,
    empresa: t.empresa,
    servicio: t.servicio || "Turno",
    profesional: t.profesional || "",
    desde: new Date(t.desde),
    duracionMin: t.duracion_min,
    estado: t.estado,
    esClase: !!t.es_clase,
  }));
}

/* Lo que todavía no pasó y no se canceló. Es lo que la persona abre la
   app para ver, así que se separa acá y no en cada pantalla. */
export function proximos(turnos) {
  const ahora = new Date();
  return turnos
    .filter((t) => t.desde >= ahora && t.estado !== "cancelada")
    .sort((a, b) => a.desde - b.desde);
}

export function pasados(turnos) {
  const ahora = new Date();
  return turnos.filter((t) => t.desde < ahora || t.estado === "cancelada");
}

/* ------------------------------------------------------------
   Los abonos
   ------------------------------------------------------------ */

export async function cargarAbonos() {
  const { data, error } = await supabase.rpc("mis_abonos");
  if (error) throw new Error("No pudimos cargar tus abonos.");

  return (data || []).map((a) => ({
    id: a.id,
    empresa: a.empresa,
    nombre: a.nombre,
    clases: a.clases,
    usadas: Number(a.usadas || 0),
    desde: a.desde ? new Date(a.desde + "T00:00:00") : null,
    vence: a.vence ? new Date(a.vence + "T00:00:00") : null,
    vigente: !!a.vigente,
  }));
}
