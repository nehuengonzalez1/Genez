/**
 * Darle la app a una clienta del comercio, y quitársela.
 *
 * Es el camino (a) de `docs/modelo-identidad-del-cliente.md` §4 —el comercio
 * invita— y hasta hoy no existía: enlazar una ficha con una cuenta era correr
 * `almha_clienta.sql` a mano. La app del cliente estaba publicada y andando y
 * no la podía usar nadie más que la única persona que alguien enlazó por SQL.
 *
 * POR QUÉ PASA POR EL SERVIDOR
 * ----------------------------
 * Por lo mismo que `api/usuarios.js`: crear una cuenta en Auth necesita la
 * `service_role`, que saltea RLS por completo y es la llave de toda la base.
 * En el navegador sería regalarla.
 *
 * Y hay una segunda razón, propia de esto: antes de invitar hay que saber si
 * esa dirección ya tiene cuenta —la misma persona puede ser clienta de la
 * estética y del gimnasio— y `auth.users` no se lee desde el front. Eso lo
 * contesta `usuario_por_correo`, que solo puede ejecutar `service_role`
 * porque expuesta a cualquiera sería una forma de averiguar qué direcciones
 * tienen cuenta, probando de a una.
 *
 * EL ENLACE LO HACE EL TOKEN DE QUIEN LLAMA, NO LA LLAVE MAESTRA
 * --------------------------------------------------------------
 * La `service_role` se usa para lo único que no se puede hacer de otra
 * forma: mirar y crear en Auth. El `update` sobre `clientes` va con el token
 * de la persona que está usando el sistema, así que lo miran RLS y los tres
 * disparadores que 0050 dejó puestos —no puede ser personal, no puede tener
 * dos fichas del mismo comercio, y del otro lado un cliente no puede
 * volverse personal—.
 *
 * Escrito al revés funcionaría igual hoy y se saltearía todo eso.
 *
 * EL PERMISO ES `darAppClientes` Y NO `darAccesos`
 * ------------------------------------------------
 * Dar de alta un acceso al sistema es habilitar a alguien a ver la caja, los
 * costos y la agenda entera. Habilitar a una clienta a ver sus propios turnos
 * no se le parece. Ver 0061.
 *
 * A DÓNDE VUELVE EL LINK DE LA INVITACIÓN
 * ---------------------------------------
 * Lo arma el servidor con el slug del comercio y no viene en el pedido. Un
 * `redirectTo` que llegara del cliente sería decidir desde afuera a qué
 * página aterriza un link que trae una sesión: quien pudiera llamar a esto
 * elegiría dónde cae ese token.
 */

import { createClient } from "@supabase/supabase-js";
import { origenValido, quienLlama } from "./_comun.js";

const ACCIONES = ["invitar", "quitar"];

const error = (res, codigo, mensaje) =>
  res.status(codigo).json({ error: { message: mensaje } });

/* En producción, el subdominio del comercio. En desarrollo no hay
   subdominio, así que se usa el origen desde el que se está trabajando con
   el `?c=` que la app necesita para saber de quién es.

   El origen ya lo validó `origenValido` contra el host del pedido: no puede
   ser el de otro sitio abierto en el mismo navegador. */
function aDondeVuelve(req, slug) {
  const origen = req.headers.origin || "";
  if (/^http:\/\/localhost(:\d+)?$/.test(origen)) {
    return `${origen}/cliente.html?c=${encodeURIComponent(slug)}`;
  }
  return `https://${slug}.genez.com.ar/`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return error(res, 405, "Solo se aceptan peticiones POST.");
  }
  if (!origenValido(req)) {
    return error(res, 403, "Origen no autorizado.");
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const maestra = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) return error(res, 503, "Faltan las variables de Supabase en el servidor.");
  if (!maestra) {
    return error(
      res,
      503,
      "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor. Sin eso no se puede invitar a nadie a la app; " +
        "el resto del sistema funciona igual."
    );
  }

  const quien = await quienLlama(req);
  if (!quien) return error(res, 401, "La sesión no es válida o venció.");

  const cuerpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { accion, fichaId } = cuerpo;

  if (!ACCIONES.includes(accion)) return error(res, 400, "Acción desconocida.");
  if (!fichaId) return error(res, 400, "Falta decir de qué ficha.");

  /* De qué comercio. Igual que en el alta de accesos: sale del perfil de
     quien llama y nunca del cuerpo, salvo que sea la plataforma, que no
     tiene comercio propio. */
  let empresaId;
  if (quien.es_plataforma) {
    if (!cuerpo.empresaId) return error(res, 400, "Falta decir en qué comercio.");
    empresaId = cuerpo.empresaId;
  } else {
    if (!quien.empresa_id) return error(res, 403, "Tu perfil no pertenece a ningún comercio.");
    empresaId = quien.empresa_id;

    const { data: puede, error: ePuede } = await quien.suyo.rpc("permiso", {
      p_clave: "darAppClientes",
    });
    if (ePuede) return error(res, 500, "No se pudo verificar el permiso.");
    if (puede !== true) {
      return error(res, 403, "No tenés permiso para dar de alta clientes en la app.");
    }
  }

  /* La ficha, leída con el token de quien llama y filtrando por empresa
     explícito, que es la regla 6: RLS contesta si podés verla, no de qué
     comercio es. */
  const { data: ficha, error: eFicha } = await quien.suyo
    .from("clientes")
    .select("id, razon_social, email, usuario_id")
    .eq("id", fichaId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (eFicha) return error(res, 500, "No se pudo leer la ficha.");
  if (!ficha) return error(res, 404, "Esa ficha no es de este comercio.");

  const admin = createClient(url, maestra, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /* ------------------------------------------------------------
     Quitarle el acceso

     Se desenlaza la ficha y **no se borra la cuenta**: la misma persona
     puede ser clienta de otro comercio, y borrarla ahí la dejaría afuera
     de algo que este comercio no le dio.

     La ficha queda entera. Es la misma decisión que tomó 0050 con
     `on delete set null`: el comercio la atendió y le facturó, y eso no
     desaparece porque le saquen la app.
     ------------------------------------------------------------ */

  if (accion === "quitar") {
    if (!ficha.usuario_id) return error(res, 409, "Esa ficha no tiene acceso a la app.");

    const { error: eQuitar } = await quien.suyo
      .from("clientes")
      .update({ usuario_id: null, enlazado_en: null })
      .eq("id", ficha.id)
      .eq("empresa_id", empresaId);

    if (eQuitar) return error(res, 500, "No se pudo quitar el acceso.");
    return res.status(200).json({ ok: true, quitada: true });
  }

  /* ------------------------------------------------------------
     Invitarla
     ------------------------------------------------------------ */

  if (ficha.usuario_id) {
    return error(res, 409, "Esa ficha ya tiene acceso a la app.");
  }

  const correo = String(cuerpo.email || ficha.email || "").trim().toLowerCase();
  if (!correo || !correo.includes("@")) {
    return error(res, 400, "Hace falta un correo para invitarla.");
  }

  const { data: slugRow, error: eSlug } = await quien.suyo
    .from("empresas").select("slug").eq("id", empresaId).maybeSingle();
  if (eSlug || !slugRow || !slugRow.slug) {
    return error(res, 500, "Este comercio no tiene su dirección de app configurada.");
  }

  /* ¿Ya tiene cuenta? Si la tiene, no se crea ni se invita nada: se enlaza
     y entra con la contraseña que ya usa en el otro comercio. Mandarle una
     invitación sería pedirle que se ponga una contraseña nueva para algo
     donde ya tiene una. */
  const { data: yaExiste, error: eBuscar } = await admin.rpc("usuario_por_correo", {
    p_email: correo,
  });
  if (eBuscar) return error(res, 500, "No se pudo verificar la cuenta.");

  let usuarioId = yaExiste || null;
  let invitada = false;

  if (!usuarioId) {
    const { data: nueva, error: eInvitar } = await admin.auth.admin.inviteUserByEmail(correo, {
      redirectTo: aDondeVuelve(req, slugRow.slug),
    });

    if (eInvitar || !nueva || !nueva.user) {
      return error(
        res,
        502,
        "No se pudo mandar la invitación: " + ((eInvitar && eInvitar.message) || "sin detalle") +
          ". Si es por el límite de correos, configurá un SMTP propio en Supabase."
      );
    }
    usuarioId = nueva.user.id;
    invitada = true;
  }

  /* El enlace, con el token de quien llama: acá es donde miran RLS y los
     disparadores de 0050. */
  const cambios = { usuario_id: usuarioId, enlazado_en: new Date().toISOString() };

  /* Si la ficha no tenía correo, queda el que el comercio acaba de decir
     que es el de esa persona. No se pisa uno que ya estaba: cambiar un dato
     de contacto es una decisión de la ficha y se hace en la ficha. */
  if (!ficha.email) cambios.email = correo;

  const { error: eEnlazar } = await quien.suyo
    .from("clientes")
    .update(cambios)
    .eq("id", ficha.id)
    .eq("empresa_id", empresaId);

  if (eEnlazar) {
    /* Si se acaba de crear la cuenta y el enlace no entró, esa cuenta no es
       de nadie: se borra. Sin esto queda un usuario suelto en Auth que
       nadie puede usar y que además bloquea el correo para el próximo
       intento. */
    if (invitada) {
      await admin.auth.admin.deleteUser(usuarioId).catch(() => {});
    }
    /* Los mensajes de los disparadores de 0050 están escritos para leerse:
       "esa cuenta ya es de alguien que trabaja en un comercio". Pasan tal
       cual en vez de un "no se pudo" que no dice nada. */
    return error(res, 409, eEnlazar.message || "No se pudo enlazar la ficha.");
  }

  return res.status(200).json({
    ok: true,
    invitada,
    email: correo,
    nombre: ficha.razon_social,
  });
}
