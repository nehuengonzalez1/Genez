/* ============================================================
   0061 · QUE EL COMERCIO PUEDA DAR DE ALTA A SU CLIENTA
   ============================================================

   La app del cliente está publicada, andando, y **no la puede usar
   nadie**. Victoria existe porque alguien corrió `almha_clienta.sql` a
   mano: enlazar una ficha con una cuenta era una sentencia de SQL y no
   había ninguna pantalla que lo hiciera.

   Es el camino (a) de `docs/modelo-identidad-del-cliente.md` §4 —el
   comercio invita— y el propio documento explica por qué es el que hay
   que construir primero: *"es el más seguro, porque el comercio es el que
   sabe quién es quién y está poniendo la firma"*.

   LO QUE YA ESTABA Y NO SE TOCA
   -----------------------------
   0050 dejó puestas las tres reglas del enlace, en la base y no en la
   pantalla: un cliente no puede ser personal, alguien del personal no
   puede ser cliente, y una cuenta no puede tener dos fichas del mismo
   comercio. Esto no las repite ni las afloja; se apoya en ellas.

   Y la política de `clientes` ya deja a cualquiera del comercio escribir
   `usuario_id`, con esos disparadores encima. O sea que el enlace en sí
   no necesita una función nueva: lo hace el servidor con el token de
   quien llama, y RLS y los disparadores hacen su trabajo.

   Lo que falta es lo que un comercio no puede hacer solo.

   1 · EL PERMISO, QUE NO ES `darAccesos`
   --------------------------------------
   Dar de alta un acceso al **sistema** es lo más pesado que hay: esa
   persona ve la caja, los costos y la agenda entera. Habilitar a una
   clienta a ver sus propios turnos no se le parece en nada.

   Es el mismo razonamiento con el que 0049 separó `darAccesos` de
   `configurar`, aplicado una vez más: si esto colgara de `darAccesos`, un
   comercio que quiere que recepción invite clientas tendría que darle a
   recepción el alta de empleados. Se juntan dos cosas que no van juntas y
   la más pesada viaja de garrón.

   De fábrica lo tienen dueño y encargado. Recepción es quien conoce a la
   clienta y quien tiene el teléfono a mano; el comercio se lo prende a
   quien quiera, que es de lo que se trata tener el permiso aparte.

   Se agrega solo a `roles_base`. `roles` y `perfiles.permisos` guardan la
   diferencia y no la foto, así que la clave nueva llega sola a todos los
   comercios, incluidos los que ya editaron sus roles.

   **Es un permiso de pantalla, no de base**, como seis de los otros ocho.
   Lo verifica `api/clientes-acceso.js` con la identidad de quien llama, y
   RLS no lo mira: la política de `clientes` deja escribir `usuario_id` a
   cualquiera del comercio. Lo que la base sí impide, y eso no depende de
   ningún permiso, son las tres cosas de 0050: que un cliente sea
   personal, que alguien del personal sea cliente, y que una cuenta tenga
   dos fichas del mismo comercio.

   O sea: el permiso decide **quién puede invitar**; los disparadores
   deciden **qué enlaces son posibles**. Apagarle el permiso a un rol le
   saca el botón y la llamada; no le impide escribir la columna si llega
   por otro camino. Está dicho acá para que nadie lo cuente de más.

   2 · BUSCAR UNA CUENTA POR CORREO
   --------------------------------
   Antes de invitar hay que saber si esa dirección ya tiene cuenta: la
   misma persona puede ser clienta de la estética y del gimnasio, y en ese
   caso no se crea nada, se enlaza lo que ya existe.

   `auth.users` no se puede leer desde el navegador y la API de Supabase
   no tiene "buscar por correo": lo que hay es listar todos los usuarios y
   recorrerlos, que con dos comercios da lo mismo y con doscientos es una
   barbaridad.

   Por eso esta función, que es un índice y no una lista. Y por eso
   **solo la puede ejecutar `service_role`**: expuesta a cualquiera, es
   una forma de averiguar si una dirección tiene cuenta en la plataforma,
   probando de a una. Es el mismo cuidado que ya toma la pantalla de
   recuperar contraseña al contestar siempre lo mismo.

   Devuelve el id y nada más. Ni el nombre, ni cuándo entró, ni si
   confirmó el correo.
   ============================================================ */

/* ------------------------------------------------------------
   1 · El permiso
   ------------------------------------------------------------ */

update roles_base
   set permisos = permisos || jsonb_build_object('darAppClientes', true)
 where clave in ('dueno', 'encargado')
   and not (permisos ? 'darAppClientes');

update roles_base
   set permisos = permisos || jsonb_build_object('darAppClientes', false)
 where clave not in ('dueno', 'encargado')
   and not (permisos ? 'darAppClientes');


/* ------------------------------------------------------------
   2 · La cuenta que ya existe
   ------------------------------------------------------------ */

create or replace function public.usuario_por_correo(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
   limit 1
$$;

/* Nadie más. `authenticated` no lo necesita —el enlace lo hace el
   servidor— y dárselo convertiría esto en un oráculo de direcciones. */
revoke all on function public.usuario_por_correo(text) from public;
revoke all on function public.usuario_por_correo(text) from authenticated;
revoke all on function public.usuario_por_correo(text) from anon;
grant execute on function public.usuario_por_correo(text) to service_role;

comment on function public.usuario_por_correo(text) is
  'Busca una cuenta de Auth por correo. Solo service_role: expuesta a cualquiera sería una forma de averiguar qué direcciones tienen cuenta.';
