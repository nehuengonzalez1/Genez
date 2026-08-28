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

/* La marca, guardada en el teléfono

   Para que la pantalla de carga diga Almha y no un vacío. El nombre lo
   trae `marca_de`, que es una ida a la base: hasta que vuelve no hay
   marca, y la primera pantalla de una app que se abre todos los días no
   puede ser genérica.

   Se guarda por comercio, porque una misma persona puede tener dos
   instaladas. Y no es un caché de datos: es el envase —el nombre y los
   colores, que ya son públicos—, lo mismo que el service worker guarda
   del HTML y nunca de los turnos.

   Todo entre `try`: en una ventana privada, o con el almacenamiento
   bloqueado, `localStorage` no lee ni escribe y tira. Sin esto la app
   entera no arranca por una comodidad. */
const LLAVE_MARCA = "genez.marca.";

export function marcaGuardada(slug) {
  if (!slug || typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(LLAVE_MARCA + slug);
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

function guardarMarca(marca) {
  if (!marca || !marca.slug) return;
  try {
    window.localStorage.setItem(LLAVE_MARCA + marca.slug, JSON.stringify(marca));
  } catch {
    /* Sin lugar para guardarla, la app anda igual: lo único que se pierde
       es que la pantalla de carga tenga nombre. */
  }
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
  const marca = {
    slug: m.slug,
    nombre: m.nombre,
    rubro: m.rubro,
    tema: m.tema || "calido",
    lema: m.lema || "",
    bajada: m.bajada || "",
    logo: m.logo || null,
    portada: m.portada || null,
  };

  /* Se guarda la que vino, no la que estaba: si el comercio cambia su
     nombre o sube su logo, la próxima carga ya lo muestra. */
  guardarMarca(marca);
  return marca;
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
   Recuperar la contraseña

   El sistema de gestión ya tiene esto y hasta ahora servía para las dos
   aplicaciones. No alcanza, y por dos razones que no se arreglan con un
   parámetro:

   El link volvía al Site URL, o sea a la gestión. Una clienta de Almha
   terminaba eligiendo su contraseña en una pantalla oscura que dice
   Genez —y antes de arreglarlo, ni siquiera eso: `cargarSesion` fallaba
   porque un cliente no tiene perfil y el error cerraba la sesión del
   propio link—.

   Y `cambiarClave` apaga `debe_cambiar_clave` en `perfiles`. Para
   alguien que trabaja en el comercio eso es la mitad del asunto; para un
   cliente es una tabla que no le corresponde ni puede tocar.

   Lo que sí se comparte son los dos avisos de que la carga viene de un
   link, que no son de la gestión ni de esta app: son de Supabase.
   ------------------------------------------------------------ */

export { alRecuperarClave, vinoDeRecuperacion } from "./sesion.js";

/* A dónde tiene que volver el link.

   La dirección de esta app y no la del sistema: en producción es el
   subdominio del comercio y alcanza con el origen. En desarrollo hay que
   conservar el `?c=`, que es lo único que dice de qué comercio es la app
   —sin eso el link vuelve a una pantalla que no es de nadie—.

   Tiene que estar en los Redirect URLs de Supabase. Si no está, Supabase
   ignora esto en silencio y manda al Site URL, que fue exactamente lo
   que pasó la primera vez. */
function aDondeVuelve() {
  const u = new URL(window.location.href);
  const slug = u.searchParams.get("c");
  return `${u.origin}${u.pathname}${slug ? `?c=${encodeURIComponent(slug)}` : ""}`;
}

/* Nunca dice si el correo existe: eso le sirve a quien está averiguando
   qué direcciones tienen cuenta, no a quien se olvidó la contraseña. Por
   eso quien llama muestra el mismo mensaje pase lo que pase. */
export async function pedirClaveNueva(email) {
  await supabase.auth.resetPasswordForEmail((email || "").trim(), {
    redirectTo: aDondeVuelve(),
  });
}

export async function guardarClaveNueva(nueva) {
  if (!nueva || nueva.length < 8) {
    throw new Error("La contraseña necesita al menos 8 caracteres.");
  }

  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (!error) return;

  if (/expired|invalid/i.test(error.message)) {
    throw new Error("El link venció o ya se usó. Pedí uno nuevo.");
  }
  /* Supabase contesta "Auth session missing!" y así como viene parece un
     error del sistema y no algo que se pueda resolver. */
  if (/session missing|sesi[oó]n de autenticaci[oó]n/i.test(error.message)) {
    throw new Error("Se perdió la sesión del link. Abrí de nuevo el link del correo.");
  }
  throw new Error(error.message);
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
    /* Las dos las decide la base. Si la pantalla calculara si se puede
       cancelar, la primera vez que un comercio cambie la regla habria dos
       verdades y la de abajo seria la que se ve. */
    puedeCancelar: !!t.puede_cancelar,
    cancelarHasta: t.cancelar_hasta ? new Date(t.cancelar_hasta) : null,
  }));
}

/* Devuelve que paso: si fue tarde, si gasto la clase y si quedo un cargo.
   La pantalla lo dice; no lo deduce. */
export async function cancelarTurno(reservaId) {
  const { data, error } = await supabase.rpc("cancelar_como_cliente", { p_reserva: reservaId });
  if (error) throw traducirCancelacion(error);
  return {
    tarde: !!data.tarde,
    consumio: !!data.consumio,
    adeuda: Number(data.adeuda || 0),
  };
}

function traducirCancelacion(error) {
  const propios = ["P0095", "P0096", "P0097", "P0098"];
  if (error && propios.includes(error.code)) return new Error(error.message);
  return new Error("No pudimos cancelar el turno. Proba de nuevo.");
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
   Reservar

   Tres consultas y ninguna toca una tabla, como todo lo demás de este
   archivo. Las reglas del comercio —con cuánta anticipación, si hace
   falta haber venido antes, si avisa cuando ya hay otro turno ese día—
   están adentro de la base y no acá. La pantalla muestra lo que la base
   deja y dice lo que la base contesta.
   ------------------------------------------------------------ */

export async function cargarServicios(empresaId) {
  if (!empresaId) throw new Error("cargarServicios necesita saber de qué comercio.");

  const { data, error } = await supabase.rpc("servicios_del_cliente", { p_empresa: empresaId });
  if (error) throw new Error("No pudimos cargar los servicios.");

  return (data || []).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    categoria: s.categoria || "",
    precio: Number(s.precio || 0),
    duracionMin: s.duracion_min,
    /* Si el comercio publicó clases de esto. Cambia qué se pregunta
       después: para una clase el horario ya viene armado. */
    enClase: !!s.en_clase,
  }));
}

const soloFecha = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function cargarHorarios({ empresaId, itemId, dias = 14, personalId = null }) {
  if (!empresaId || !itemId) throw new Error("cargarHorarios necesita el comercio y el servicio.");

  const hoy = new Date();
  const hasta = new Date(hoy);
  hasta.setDate(hoy.getDate() + dias);

  const { data, error } = await supabase.rpc("horarios_libres", {
    p_empresa: empresaId,
    p_item: itemId,
    p_desde: soloFecha(hoy),
    p_hasta: soloFecha(hasta),
    p_personal: personalId,
  });
  if (error) throw new Error("No pudimos cargar los horarios.");

  return (data || []).map((h) => ({
    claseId: h.clase_id,
    desde: new Date(h.desde),
    duracionMin: h.duracion_min,
    personalId: h.personal_id,
    profesional: h.profesional || "",
    recursoId: h.recurso_id,
    recurso: h.recurso || "",
    lugares: h.lugares,
    /* Una clase llena llega con lugares en cero cuando el comercio
       habilito la espera. No es un horario que no sirve: es otra cosa que
       se puede hacer con el. */
    enEspera: !!h.en_espera,
    esperando: h.esperando || 0,
  }));
}

/* ------------------------------------------------------------
   La lista de espera

   Pedir lugar en una clase llena. No promueve a nadie: cuando se libere,
   el comercio avisa. Ver la migracion 0056 para por que se dejo asi.
   ------------------------------------------------------------ */

export async function anotarmeEnEspera(claseId) {
  const { data, error } = await supabase.rpc("anotarme_en_espera", { p_clase: claseId });
  if (error) throw traducirEspera(error);
  return { id: data.id, lugar: Number(data.lugar || 0) };
}

export async function salirDeEspera(claseId) {
  const { error } = await supabase.rpc("salir_de_espera", { p_clase: claseId });
  if (error) throw new Error("No pudimos sacarte de la lista. Proba de nuevo.");
}

export async function cargarEsperas() {
  const { data, error } = await supabase.rpc("mis_esperas");
  if (error) throw new Error("No pudimos cargar tus listas de espera.");

  return (data || []).map((e) => ({
    claseId: e.clase_id,
    empresa: e.empresa,
    servicio: e.servicio || "Clase",
    profesional: e.profesional || "",
    desde: new Date(e.desde),
    lugar: e.lugar,
    esperando: e.esperando,
  }));
}

function traducirEspera(error) {
  const propios = ["P0090", "P0042", "P0044", "P0046", "P0098", "P00A0", "P00A1", "P00A2"];
  if (error && propios.includes(error.code)) return new Error(error.message);
  return new Error("No pudimos anotarte en la lista. Proba de nuevo.");
}

/* Devuelve `{ id, aviso }`. El aviso no es un error: es lo que hay que
   mostrar sin frenar nada, y viene de la base para que salga igual desde
   cualquier pantalla que reserve. */
export async function reservar({ empresaId, horario, itemId }) {
  const { data, error } = await supabase.rpc("reservar_como_cliente", {
    p: {
      empresa_id: empresaId,
      clase_id: horario.claseId,
      item_id: itemId,
      desde: horario.desde.toISOString(),
      personal_id: horario.personalId,
      recurso_id: horario.recursoId,
    },
  });

  if (error) throw traducir(error);
  return { id: data.id, aviso: data.aviso || null };
}

/* Los mensajes de la base ya están escritos para que los lea una persona
   —"Ese horario ya está muy cerca", "Para reservar por primera vez, pasá
   por el local"— así que se usan tal cual. Lo que se traduce son los dos
   casos donde el mensaje crudo de Postgres no le dice nada a nadie. */
function traducir(error) {
  const propios = ["P0090", "P0091", "P0092", "P0093", "P0094"];
  if (error && propios.includes(error.code)) return new Error(error.message);

  const otros = {
    P0045: "Esa clase se llenó recién. Probá con otro horario.",
    P0046: "Ya estás anotada en esa clase.",
    P0044: "Esa clase se canceló.",
    P0039: "Ese horario se acaba de ocupar. Probá con otro.",
  };
  if (error && otros[error.code]) return new Error(otros[error.code]);

  return new Error("No pudimos tomar la reserva. Probá de nuevo.");
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
