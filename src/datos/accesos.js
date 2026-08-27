/* ============================================================
   ACCESOS · quién entra al comercio y con qué
   ============================================================

   Ver la migración 0048 para el modelo y, sobre todo, para por qué la
   política de `perfiles` era un agujero hasta que hubo un segundo
   usuario.

   Acá hay dos caminos que no se pueden mezclar:

   - Lo que ya existe se edita **contra la base**, por RLS: el rol, las
     excepciones, el alta y la baja. La política pide `configurar` y el
     disparador se encarga de lo que la política no puede mirar.

   - Crear el usuario en Auth pasa **por api/usuarios.js**, porque
     necesita la `service_role` y esa no puede estar en el navegador.

   La regla para saber cuál toca es simple: si el cambio es sobre una
   fila de `perfiles`, va directo; si toca `auth.users`, va por la
   función.

   Todas las consultas filtran por `empresa_id` explícito (regla 6).
   ============================================================ */

import { supabase } from "./supabase.js";

/* Los dos caminos de alta. Ninguno es el correcto: el minimercado da de
   alta un cajero que capaz no tiene correo, y la estética invita a una
   profesora que sí. Lo elige el dueño en la pantalla. */
export const FORMAS = [
  {
    k: "invitar",
    n: "Mandarle una invitación",
    d: "Le llega un correo con un link y se pone la clave que quiera. Nadie más la conoce.",
  },
  {
    k: "crear",
    n: "Ponerle una clave provisional",
    d: "Se la dictás y el sistema la obliga a cambiarla la primera vez que entra. Sirve si no tiene correo.",
  },
];

/* ------------------------------------------------------------
   Leer
   ------------------------------------------------------------ */

export async function cargarAccesos(empresaId) {
  if (!empresaId) throw new Error("cargarAccesos necesita saber de qué comercio.");

  const { data, error } = await supabase
    .from("accesos")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("activo", { ascending: false })
    .order("nombre");

  if (error) throw traducir(error);

  return (data || []).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    email: f.email || "",
    rol: f.rol,
    /* Solo la diferencia contra el rol, que es como se guarda. */
    permisos: f.permisos || {},
    permisosFinales: f.permisos_finales || {},
    activo: !!f.activo,
    debeCambiarClave: !!f.debe_cambiar_clave,
    soyYo: !!f.soy_yo,
    invitadoEn: f.invitado_en ? new Date(f.invitado_en) : null,
    creadoEn: f.creado_en ? new Date(f.creado_en) : null,
    personalId: f.personal_id || null,
    personalNombre: f.personal_nombre || null,
  }));
}

/* ------------------------------------------------------------
   Crear · lo único que pasa por el servidor
   ------------------------------------------------------------ */

async function llamarApi(cuerpo) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");

  let r;
  try {
    r = await fetch("/api/usuarios", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error("No se pudo hablar con el servidor. Revisá la conexión.");
  }

  let respuesta = null;
  try {
    respuesta = await r.json();
  } catch {
    /* Un 404 de Vercel o de Vite no viene en JSON. */
    throw new Error(
      r.status === 404
        ? "La función de accesos no está publicada. En desarrollo tiene que estar corriendo `npm run dev`."
        : "El servidor contestó algo que no se entiende."
    );
  }

  if (!r.ok) {
    throw new Error((respuesta && respuesta.error && respuesta.error.message) || "No se pudo completar.");
  }
  return respuesta;
}

/* `forma` es 'invitar' o 'crear'. La clave solo viaja en el segundo caso
   y no se guarda en ningún lado de este lado: se manda y se olvida.

   `empresaId` va únicamente cuando llama la plataforma, que no tiene
   comercio propio del cual sacarlo. Desde adentro de un comercio se
   manda sin él a propósito: el servidor lo saca del token, y si lo
   aceptara del cliente cualquiera daría de alta en el comercio de otro. */
export async function crearAcceso({ forma, email, nombre, rol, clave, empresaId }) {
  return llamarApi({
    accion: forma,
    email,
    nombre,
    rol,
    clave,
    empresaId,
    /* Adónde vuelve el link de la invitación. Se manda desde acá porque
       el servidor no sabe en qué dominio está corriendo el navegador. */
    redirigirA: `${window.location.origin}/`,
  });
}

/* `empresaId` va siempre, aunque desde adentro de un comercio el servidor
   lo ignore y use el del token. Lo necesita la sesión de plataforma, que
   no pertenece a ningún comercio: entrando "como" un comercio la pantalla
   es la misma pero el token sigue siendo el de plataforma, y sin esto el
   servidor contesta "falta decir en qué comercio".

   Mandarlo no abre nada: el servidor solo lo mira si quien llama es
   plataforma, y para un comercio usa el suyo pase lo que pase. */
export async function ponerClaveProvisional(empresaId, perfilId, clave) {
  return llamarApi({ accion: "clave", empresaId, perfilId, clave });
}

/* ------------------------------------------------------------
   Editar · esto va por RLS, no por el servidor
   ------------------------------------------------------------ */

export async function cambiarRol(empresaId, perfilId, rol) {
  if (!empresaId) throw new Error("cambiarRol necesita saber de qué comercio.");

  const { error } = await supabase
    .from("perfiles").update({ rol }).eq("id", perfilId).eq("empresa_id", empresaId);
  if (error) throw traducir(error);
}

/* Las excepciones se guardan como diferencia contra lo que dice el rol,
   igual que `roles` guarda la diferencia contra `roles_base`. Guardar la
   foto funcionaría hoy y rompería mañana: el día que el rol se corrija,
   la persona con una excepción sobre otra bandera se quedaría con el
   valor viejo para siempre. Es la misma decisión de 0045, una capa más
   abajo. */
export async function guardarExcepciones(empresaId, perfilId, { permisosDelRol, permisos }) {
  if (!empresaId) throw new Error("guardarExcepciones necesita saber de qué comercio.");

  const diff = {};
  for (const k of Object.keys(permisos)) {
    if (!!permisos[k] !== !!permisosDelRol[k]) diff[k] = !!permisos[k];
  }

  const { error } = await supabase
    .from("perfiles").update({ permisos: diff }).eq("id", perfilId).eq("empresa_id", empresaId);
  if (error) throw traducir(error);

  return diff;
}

export async function cambiarActivo(empresaId, perfilId, activo) {
  if (!empresaId) throw new Error("cambiarActivo necesita saber de qué comercio.");

  const { error } = await supabase
    .from("perfiles").update({ activo }).eq("id", perfilId).eq("empresa_id", empresaId);
  if (error) throw traducir(error);
}

/* El enganche con la ficha del equipo todavía no tiene pantalla. La vista
   `accesos` ya trae `personal_nombre` y la lista lo muestra cuando existe,
   pero ponerlo se hace por SQL. `personal.perfil_id` existe desde 0030 y la
   pantalla que lo edite va con el módulo Equipo, que es donde se entiende
   para qué sirve: ahí se ve a la persona a la que se le paga. Se deja
   anotado y no a medio hacer. */

/* La clave propia se cambia con `cambiarClave` de sesion.js, que ya
   existía para el link de recuperación y también apaga la marca de clave
   provisional. Dos funciones para lo mismo terminan siempre con una de
   las dos olvidada. */

/* ------------------------------------------------------------
   Los errores del disparador

   Llegan con su código y se traducen acá, para que la pantalla no tenga
   que saber de códigos de Postgres. Es el mismo criterio de permisos.js.
   ------------------------------------------------------------ */

function traducir(error) {
  const codigos = {
    P0071: "Solo la plataforma puede hacer eso.",
    P0072: "Un acceso no se muda de comercio. Se da de baja acá y de alta allá.",
    P0073: "No podés cambiarte a vos mismo el rol, los permisos ni darte de baja. Que lo haga otra persona con permiso para dar accesos.",
    P0074: "No tenés permiso para dar accesos.",
    P0075: "No podés darle a otro un permiso que vos no tenés.",
  };
  if (error && codigos[error.code]) return new Error(codigos[error.code]);

  /* Una política que no encuentra la fila no da error: da cero filas. Si
     igual llegó un error de permisos, es del insert. */
  if (error && error.code === "42501") {
    return new Error("No tenés permiso para administrar los accesos de este comercio.");
  }
  return new Error((error && error.message) || "No se pudo guardar.");
}
