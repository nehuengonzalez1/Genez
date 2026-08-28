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
    nombre: c.nombre,
    rubro: c.rubro,
    fichaId: c.ficha_id,
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
