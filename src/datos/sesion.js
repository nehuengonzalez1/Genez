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
      /* Antes esto era el nombre otra vez, y el panel lo mostraba dos
         veces: "Axel Gonzalez / Axel Gonzalez". El correo es con lo que la
         persona entra, que es el dato que hace falta al lado del rol. */
      usuario: p.email || "sin correo",
      rol: p.rol,
      activo: p.activo,
    })),
  };
}

const SELECT_EMPRESA = `
  id, nombre, rubro, plan, modulos, config, activa, creada_en,
  perfiles ( id, nombre, rol, activo, email )
`;

/* Arma la sesión a partir del usuario autenticado. Devuelve null si no
   hay nadie con sesión abierta, y lanza si el usuario existe en Auth
   pero no tiene perfil (pasa si se creó a mano y no se corrió la semilla). */
export async function cargarSesion() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("id, nombre, rol, es_plataforma, activo, empresa_id, debe_cambiar_clave, invitado_en")
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

  /* Alta con clave provisional: el dueño se la dictó, así que la sabe otra
     persona. Hasta que la cambie no se le muestra el sistema. Va acá y no
     en la pantalla de login porque el que entra por un link de invitación
     tampoco pasa por el login. */
  const debeCambiarClave = !!perfil.debe_cambiar_clave;

  /* De dónde viene condiciona qué se le dice: al invitado nadie le dio
     una clave, se la está poniendo por primera vez. */
  const invitado = !!perfil.invitado_en;

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
    debeCambiarClave,
    invitado,
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
    /* Supabase contesta "Auth session missing!" —a veces traducido— y así
       como viene no le dice nada a nadie: quien lo lee está mirando una
       pantalla que le pidió una contraseña, y "falta la sesión de
       autenticación" parece un error del sistema y no algo que se pueda
       resolver. Es lo que pasa si la sesión del link se cerró en el
       medio. */
    if (/session missing|sesi[oó]n de autenticaci[oó]n/i.test(error.message)) {
      throw new Error("Se perdió la sesión del link. Abrí de nuevo el link del correo, sin refrescar la página.");
    }
    throw new Error(error.message);
  }

  /* Se apaga la marca de clave provisional: desde acá la clave la sabe
     una sola persona. Vale para los dos caminos —el link de recuperación
     y el alta con clave dictada— porque en los dos la eligió quien entra.
     El fallo no se propaga: la clave ya cambió, y dejar entrar a alguien
     que puso su clave es mejor que trabarlo por un update. */
  const { data } = await supabase.auth.getUser();
  if (data && data.user) {
    await supabase.from("perfiles").update({ debe_cambiar_clave: false }).eq("id", data.user.id);
  }
}

/* ¿Esta carga de la página viene del link del correo?

   Se mira al importar el módulo, y no cuando React monta, porque
   supabase-js lee el hash del link y lo borra. Si eso pasa antes de que
   se registre el oyente de abajo, el evento no lo escucha nadie: quien
   tiene perfil entra derecho al sistema con una sesión que solo servía
   para cambiar la clave, y nunca ve la pantalla para elegir una nueva.

   Acá el hash todavía está: `supabase.js` crea el cliente al importarse,
   pero procesar la URL lo hace después, en otra tarea.

   El oyente se queda igual. Los dos caminos miran lo mismo desde dos
   lados, y el que llegue primero gana. */
/* El hash y la query se miran por separado y no pegados uno al otro.

   Pegados, `#type=recovery` + `?c=almha` da `#type=recovery?c=almha`, y
   ahí `type=recovery` ya no termina ni en `&` ni en el final del texto:
   no matchea. Es exactamente la forma que tiene el link cuando la app
   lleva algo en la query —la app del cliente en desarrollo lleva el
   `?c=`— y andaba solo porque en la gestión la dirección no tiene
   ninguna. Encontrado probándolo en la app del cliente. */
const traeRecovery = (parte) => /(^|[#&?])type=recovery(&|$)/.test(parte);

export const vinoDeRecuperacion =
  typeof window !== "undefined" &&
  [window.location.hash, window.location.search].some(traeRecovery);

/* Avisa cuando el usuario entró por un link de recuperación, para
   mostrarle la pantalla de contraseña nueva en vez del sistema. */
export function alRecuperarClave(callback) {
  const { data } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === "PASSWORD_RECOVERY") callback();
  });
  return () => data.subscription.unsubscribe();
}
