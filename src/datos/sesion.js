/* ============================================================
   SESIÓN · quién entró y a qué tiene acceso
   ============================================================

   Traduce lo que devuelve Supabase a la forma de sesión que ya usa el
   resto de la aplicación. Mientras esa forma no cambie, ni Sistema ni
   permisosDe se enteran de que atrás hay una base de datos.

     { tipo: "comercio", comercio, rol, nombre, usuario }
     { tipo: "plataforma", nombre, usuario, viendo? }
   ============================================================ */

import { supabase } from "./supabase.js";

/* La base guarda `activa` y `creada_en`; la aplicación viene hablando de
   `activo` y `alta` desde antes. Se traduce acá y no se toca el resto. */
function aComercio(fila) {
  const d = fila.creada_en ? new Date(fila.creada_en) : null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    rubro: fila.rubro,
    plan: fila.plan,
    modulos: fila.modulos || [],
    config: fila.config || {},
    activo: fila.activa,
    alta: d ? `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "",
    usuarios: (fila.perfiles || []).map((p) => ({
      id: p.id,
      nombre: p.nombre,
      usuario: p.nombre,
      rol: p.rol,
      activo: p.activo,
    })),
  };
}

const SELECT_EMPRESA = `
  id, nombre, rubro, plan, modulos, config, activa, creada_en,
  perfiles ( id, nombre, rol, activo )
`;

/* Arma la sesión a partir del usuario autenticado. Devuelve null si no
   hay nadie con sesión abierta, y lanza si el usuario existe en Auth
   pero no tiene perfil (pasa si se creó a mano y no se corrió la semilla). */
export async function cargarSesion() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, es_plataforma, activo, empresa_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!perfil) {
    throw new Error("Tu usuario no tiene un perfil asignado. Avisale al administrador.");
  }
  if (!perfil.activo) {
    throw new Error("Tu acceso está desactivado.");
  }

  if (perfil.es_plataforma) {
    return { tipo: "plataforma", nombre: perfil.nombre, usuario: user.email };
  }

  const { data: empresa, error: e2 } = await supabase
    .from("empresas")
    .select(SELECT_EMPRESA)
    .eq("id", perfil.empresa_id)
    .maybeSingle();

  if (e2) throw e2;
  if (!empresa) throw new Error("No encontramos el comercio de tu usuario.");
  if (!empresa.activa) throw new Error("Esta cuenta está suspendida. Contactate con el administrador.");

  return {
    tipo: "comercio",
    comercio: aComercio(empresa),
    rol: perfil.rol,
    nombre: perfil.nombre,
    usuario: user.email,
  };
}

/* Los comercios que la sesión puede ver. La plataforma los ve todos; un
   comercio ve solo el suyo. Quién ve qué lo decide RLS, no este código:
   la misma consulta devuelve distinto según quién la haga. */
export async function cargarComercios() {
  const { data, error } = await supabase
    .from("empresas")
    .select(SELECT_EMPRESA)
    .order("creada_en", { ascending: true });

  if (error) throw error;
  return (data || []).map(aComercio);
}

export async function entrar(email, clave) {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: clave,
  });

  /* Un mensaje único a propósito: distinguir "no existe" de "clave
     equivocada" le sirve a quien prueba credenciales, no a quien se
     equivocó tipeando. */
  if (error) {
    if (error.message === "Email not confirmed") {
      throw new Error("Tu cuenta todavía no está confirmada. Revisá tu correo.");
    }
    throw new Error("Usuario o contraseña incorrectos.");
  }

  return cargarSesion();
}

export async function salir() {
  await supabase.auth.signOut();
}

/* ------------------------------------------------------------
   RECUPERAR LA CONTRASEÑA
   ------------------------------------------------------------ */

/* Manda el correo con el link. Nunca dice si el mail existe o no: eso le
   sirve a quien está averiguando qué direcciones tienen cuenta, no a
   quien se olvidó la contraseña. Por eso quien llama muestra el mismo
   mensaje pase lo que pase. */
export async function pedirRecuperacion(email) {
  await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/`,
  });
}

/* Solo funciona con la sesión temporal que abre el link del correo, o
   estando adentro del sistema. */
export async function cambiarClave(nueva) {
  if (!nueva || nueva.length < 8) {
    throw new Error("La contraseña necesita al menos 8 caracteres.");
  }
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) {
    if (/expired|invalid/i.test(error.message)) {
      throw new Error("El link venció o ya se usó. Pedí uno nuevo.");
    }
    throw new Error(error.message);
  }
}

/* Avisa cuando el usuario entró por un link de recuperación, para
   mostrarle la pantalla de contraseña nueva en vez del sistema. */
export function alRecuperarClave(callback) {
  const { data } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") callback();
  });
  return () => data.subscription.unsubscribe();
}
