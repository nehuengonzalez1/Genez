/**
 * Alta de accesos de un comercio.
 *
 * Existe por la misma razón que api/anthropic.js: hay una credencial que no
 * puede viajar al navegador. Crear un usuario en Supabase Auth necesita la
 * `service_role`, que saltea RLS por completo —es la llave maestra de toda la
 * base, de todos los comercios—. En el front sería regalarla.
 *
 * QUIÉN PREGUNTA Y QUÉ PUEDE, LO CONTESTA LA BASE
 * -----------------------------------------------
 * La función no le cree nada al cliente. Del cuerpo del pedido salen el
 * correo, el nombre y el rol; el `empresa_id` NO, y `es_plataforma` tampoco:
 * los pone el servidor a partir de quién mandó el token. Si el comercio
 * viniera del cliente, cualquiera con una sesión válida daría de alta un
 * dueño adentro del comercio de otro.
 *
 * Y el permiso se pregunta con la identidad del que llama, no con la llave
 * maestra: se abre un segundo cliente con su propio token y se le pregunta a
 * Postgres `permiso('configurar')`. Así la respuesta sale de las mismas tres
 * capas que usa el resto del sistema (roles_base → roles → perfiles.permisos)
 * y no de una copia de la regla escrita acá, que es lo que después se
 * desincroniza.
 *
 * LOS DOS CAMINOS DE ALTA
 * -----------------------
 * `invitar` manda un correo con un link y la persona se pone su propia clave:
 * nadie más la conoce nunca. Necesita SMTP configurado en Supabase; el de
 * fábrica manda dos o tres correos por hora y no sirve para producción.
 *
 * `crear` es para el cajero o el mozo que puede no tener correo: el dueño le
 * pone una clave provisional y se la dicta. Queda marcado
 * `debe_cambiar_clave`, y la pantalla no lo deja entrar sin cambiarla.
 *
 * Ninguno de los dos es el "correcto": el minimercado y la estética no se
 * dan de alta igual.
 */

import { createClient } from "@supabase/supabase-js";
import { origenValido } from "./_comun.js";

const ACCIONES = ["invitar", "crear", "clave"];
const CLAVE_MINIMA = 8;

const error = (res, codigo, mensaje) =>
  res.status(codigo).json({ error: { message: mensaje } });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return error(res, 405, "Solo se aceptan peticiones POST.");
  }

  /* Segunda línea y no la única: acá lo que protege es el token de abajo,
     con su permiso. El chequeo de origen frena a un navegador ajeno y a un
     script no lo frena nadie, porque `Origin` lo pone el navegador. */
  if (!origenValido(req)) {
    return error(res, 403, "Origen no autorizado.");
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const maestra = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon) {
    return error(res, 503, "Faltan las variables de Supabase en el servidor.");
  }
  if (!maestra) {
    return error(
      res,
      503,
      "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Sin eso no se pueden crear accesos; " +
        "el resto del sistema funciona igual y los permisos de los roles se siguen editando."
    );
  }

  const token = (req.headers.authorization || "").replace(/^Bearer /i, "").trim();
  if (!token) return error(res, 401, "Falta la sesión.");

  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { accion, email, nombre, rol, clave, perfilId, redirigirA } = cuerpo;

  if (!ACCIONES.includes(accion)) {
    return error(res, 400, "Acción desconocida.");
  }

  /* Dos clientes a propósito. `admin` es la llave maestra y solo se usa
     para lo que no se puede hacer de otra forma: tocar auth.users. `suyo`
     lleva la identidad del que llama y es quien contesta si puede. */
  const admin = createClient(url, maestra, { auth: { persistSession: false, autoRefreshToken: false } });
  const suyo = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  /* ------------------------------------------------------------
     Quién llama
     ------------------------------------------------------------ */

  const { data: sesion, error: eSesion } = await admin.auth.getUser(token);
  if (eSesion || !sesion || !sesion.user) {
    return error(res, 401, "La sesión no es válida o venció.");
  }

  const { data: yo, error: eYo } = await suyo
    .from("perfiles")
    .select("empresa_id, es_plataforma")
    .eq("id", sesion.user.id)
    .single();

  if (eYo || !yo) return error(res, 403, "No se encontró tu perfil.");

  /* ------------------------------------------------------------
     De qué comercio, y si puede

     Dos caminos que no se mezclan.

     El de un comercio: el `empresa_id` sale de su propio perfil y nunca
     del cuerpo del pedido. Si viniera del cliente, cualquiera con una
     sesión válida daría de alta un dueño adentro del comercio de otro.

     El de la plataforma: no tiene comercio propio, así que este es el
     único caso donde el `empresaId` llega por parámetro. Existe porque
     si no, un comercio sin ningún usuario no puede conseguir el primero:
     para dar de alta hay que estar adentro, y adentro no hay nadie. Ese
     arranque lo hacía una semilla por SQL.

     Y ojo: "entrar como" no sirve para esto. Cambia lo que se dibuja en
     pantalla y no el token, así que el perfil sigue teniendo
     `empresa_id` en null. El mensaje de error decía lo contrario y
     mandaba a un callejón sin salida.
     ------------------------------------------------------------ */

  let empresaId;

  if (yo.es_plataforma) {
    if (!cuerpo.empresaId) {
      return error(res, 400, "Falta decir en qué comercio.");
    }
    /* Que exista lo contesta la base, no el cliente. La plataforma las ve
       todas por RLS, así que preguntar con su propia identidad alcanza. */
    const { data: emp } = await suyo
      .from("empresas").select("id").eq("id", cuerpo.empresaId).single();
    if (!emp) return error(res, 404, "Ese comercio no existe.");
    empresaId = emp.id;
  } else {
    if (!yo.empresa_id) {
      return error(res, 403, "Tu perfil no pertenece a ningún comercio.");
    }
    empresaId = yo.empresa_id;

    /* Cambió en 0049: el permiso ya no es `configurar`. Dar un acceso es
       habilitar a una persona a entrar, y eso es más pesado que cambiar
       la ficha del negocio; de fábrica lo tenían dueño y encargado por
       igual y ahora arranca solo en el dueño.

       Se pregunta con la identidad del que llama para que la respuesta
       salga de las mismas tres capas que usa el resto y no de una copia
       de la regla escrita acá. */
    const { data: puede, error: ePuede } = await suyo.rpc("permiso", { p_clave: "darAccesos" });
    if (ePuede) return error(res, 500, "No se pudo verificar el permiso.");
    if (puede !== true) {
      return error(res, 403, "No tenés permiso para dar de alta accesos en este comercio.");
    }
  }

  /* ------------------------------------------------------------
     Cambiar la clave de alguien que ya existe

     Va primero porque no crea nada: es el "se la olvidó" de todos los
     días, y no tiene por qué pasar por el panel de Supabase.
     ------------------------------------------------------------ */

  if (accion === "clave") {
    if (!perfilId) return error(res, 400, "Falta a quién.");
    if (!clave || String(clave).length < CLAVE_MINIMA) {
      return error(res, 400, `La clave provisional tiene que tener al menos ${CLAVE_MINIMA} caracteres.`);
    }

    /* Que sea de su comercio lo contesta la base con la identidad del que
       llama: si no lo puede ver, no existe para él. */
    const { data: destino } = await suyo
      .from("perfiles")
      .select("id, nombre")
      .eq("id", perfilId)
      .eq("empresa_id", empresaId)
      .single();

    if (!destino) return error(res, 404, "Esa persona no es de este comercio.");

    const { error: eClave } = await admin.auth.admin.updateUserById(perfilId, { password: String(clave) });
    if (eClave) return error(res, 400, eClave.message || "No se pudo cambiar la clave.");

    await admin.from("perfiles").update({ debe_cambiar_clave: true }).eq("id", perfilId);

    return res.status(200).json({ ok: true, nombre: destino.nombre });
  }

  /* ------------------------------------------------------------
     El alta
     ------------------------------------------------------------ */

  const correo = String(email || "").trim().toLowerCase();
  if (!correo || !correo.includes("@")) return error(res, 400, "Falta un correo válido.");
  if (!String(nombre || "").trim()) return error(res, 400, "Falta el nombre.");

  /* El rol tiene que existir. Sin esto se puede escribir cualquier texto
     en `perfiles.rol`, y un rol que no está en roles_base no matchea en
     permisos_de: la persona entra sin ninguna bandera y nadie entiende
     por qué. */
  const { data: rolValido } = await admin.from("roles_base").select("clave").eq("clave", rol).single();
  if (!rolValido) return error(res, 400, "Ese rol no existe.");

  /* Un correo es de un solo comercio: `perfiles.id` es la clave de
     auth.users, así que una misma cuenta no puede tener dos perfiles. Se
     avisa acá con nombre y apellido en vez de dejar reventar la clave
     foránea con un mensaje de Postgres. */
  const { data: existentes } = await admin
    .from("perfiles")
    .select("id, empresa_id, activo")
    .eq("email", correo)
    .limit(1);

  if (existentes && existentes.length) {
    const ya = existentes[0];
    if (ya.empresa_id === empresaId) {
      return error(
        res,
        409,
        ya.activo
          ? "Ese correo ya tiene acceso a este comercio."
          : "Ese correo ya existe pero está dado de baja. Volvé a darle el alta desde la lista."
      );
    }
    return error(res, 409, "Ese correo ya se usa en otro comercio.");
  }

  let usuarioId = null;
  let invitado = null;

  if (accion === "invitar") {
    const { data, error: eInv } = await admin.auth.admin.inviteUserByEmail(correo, {
      redirectTo: redirigirA || undefined,
    });
    if (eInv) {
      /* El SMTP de fábrica de Supabase corta por acá y el mensaje crudo
         no le dice nada a quien está mirando la pantalla. */
      const m = (eInv.message || "").toLowerCase();
      if (m.includes("rate") || m.includes("limit")) {
        return error(
          res,
          429,
          "Supabase no dejó mandar el correo: el servidor de fábrica permite muy pocos por hora. " +
            "Configurá un SMTP propio, o dale de alta con una clave provisional."
        );
      }
      return error(res, 400, eInv.message || "No se pudo mandar la invitación.");
    }
    usuarioId = data.user.id;
    invitado = new Date().toISOString();
  } else {
    if (!clave || String(clave).length < CLAVE_MINIMA) {
      return error(res, 400, `La clave provisional tiene que tener al menos ${CLAVE_MINIMA} caracteres.`);
    }
    const { data, error: eCrear } = await admin.auth.admin.createUser({
      email: correo,
      password: String(clave),
      /* Confirmado de entrada: no hay a quién mandarle el correo de
         confirmación si la persona no tiene correo propio. */
      email_confirm: true,
    });
    if (eCrear) return error(res, 400, eCrear.message || "No se pudo crear el acceso.");
    usuarioId = data.user.id;
  }

  /* El perfil se escribe con la llave maestra porque el usuario de
     auth.users recién nace y todavía no hay nadie que pueda insertarlo por
     RLS. Los dos campos que importan los pone el servidor: el comercio sale
     de quién llamó, y es_plataforma es false y punto. */
  const { error: ePerfil } = await admin.from("perfiles").insert({
    id: usuarioId,
    empresa_id: empresaId,
    nombre: String(nombre).trim(),
    email: correo,
    rol,
    es_plataforma: false,
    activo: true,
    /* Los dos caminos, no solo el de la clave dictada.

       El link de invitación abre sesión sin que la persona haya elegido
       nunca una contraseña, y la app solo intercepta PASSWORD_RECOVERY:
       un invitado entraba derecho al sistema y, cuando esa sesión vencía,
       no podía volver. Marcarlo acá lo manda a la misma pantalla, que es
       adonde tenía que ir desde el principio.

       No es "cambiar" la clave en el caso del invitado sino ponérsela por
       primera vez; la pantalla lo dice distinto según de dónde venga. */
    debe_cambiar_clave: true,
    invitado_en: invitado,
    creado_por: sesion.user.id,
  });

  if (ePerfil) {
    /* Si el perfil no entró, el usuario de auth queda huérfano: puede
       loguearse y no pertenecer a ningún comercio. Se deshace. */
    await admin.auth.admin.deleteUser(usuarioId);
    return error(res, 500, ePerfil.message || "No se pudo crear el perfil.");
  }

  return res.status(200).json({
    ok: true,
    id: usuarioId,
    invitado: accion === "invitar",
  });
}
