/* ============================================================
   0065 · REGISTRARSE SOLO, SIN RECLAMAR NADA
   ============================================================

   La pantalla 4 de la maqueta. Es el camino (c) de
   `docs/modelo-identidad-del-cliente.md` §4, y la diferencia con el (b)
   es todo lo que importa.

   EL CAMINO QUE NO SE CONSTRUYE
   -----------------------------
   El (b) es "me registro y reclamo mi ficha": pongo mi teléfono y el
   sistema me da el historial que coincida. El documento lo dice sin
   vueltas: *"Peligroso tal cual: cualquiera pone el teléfono de otro y se
   lleva su historial."*

   Y no alcanza con verificar el teléfono que la persona escribe: la
   verificación tiene que ir **al contacto que ya está guardado**, no al
   que acaba de tipear. Esa diferencia es todo, y hasta que exista ese
   envío, este camino no se abre.

   Así que acá **no se reclama nada**. Quien se registra empieza una ficha
   nueva, vacía: sin turnos, sin abonos, sin historia. Si además ya era
   clienta del local, el comercio tiene dos fichas y las une a mano.

   LO ABRE EL COMERCIO, Y DE FÁBRICA ESTÁ CERRADO
   ----------------------------------------------
   `config.cliente.autoregistro`. Un consultorio no quiere que cualquiera
   se dé de alta solo; una clase abierta de pilates capaz sí. Apagado por
   defecto porque hasta hoy la única forma de entrar era que el comercio
   invitara, y encender algo así tiene que ser una decisión y no una
   sorpresa después de actualizar.

   Sale por `marca_de`, que es pública: la bienvenida necesita saber si
   ofrecer el botón **antes** de que nadie entre. No es un dato sensible
   —es lo mismo que un cartel en la puerta que diga "se aceptan socios
   nuevos"— y es lo único que se agrega ahí.

   EL DUPLICADO SE MARCA CUANDO SE PUEDE VER
   -----------------------------------------
   El documento deja abierto qué hacer con los duplicados de este camino.
   Unir dos fichas con turnos y abonos de cada lado sigue sin resolverse,
   pero hay algo que sí se puede hacer y es barato: **anotar la sospecha en
   el momento en que existe**.

   Si al registrarse hay otra ficha del mismo comercio con ese correo o
   ese teléfono, la ficha nueva queda marcada. El comercio la ve marcada y
   decide; sin eso, el duplicado se descubre el día que alguien nota que
   una persona figura dos veces, meses después.

   Eso se mira adentro de la función y no sale nunca al cliente: si
   contestara "ya existe una ficha con ese teléfono", sería otra forma de
   averiguar quién es cliente del local.
   ============================================================ */

/* ------------------------------------------------------------
   1 · Que la marca diga si el comercio acepta registros
   ------------------------------------------------------------ */

drop function if exists public.marca_de(text);
drop function if exists public.registrarme_en(uuid, text, text);

create or replace function public.marca_de(p_slug text)
returns table (
  slug         text,
  nombre       text,
  rubro        text,
  tema         text,
  lema         text,
  bajada       text,
  logo         text,
  portada      text,
  autoregistro boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.slug,
    e.nombre,
    e.rubro,
    coalesce(m ->> 'tema',    'calido'),
    coalesce(m ->> 'lema',    ''),
    coalesce(m ->> 'bajada',  ''),
    nullif(m ->> 'logo',    ''),
    nullif(m ->> 'portada', ''),
    coalesce((e.config -> 'cliente' ->> 'autoregistro')::boolean, false)
  from empresas e
  left join rubros r on r.clave = e.rubro
  cross join lateral (
    select coalesce(r.marca, '{}'::jsonb) || coalesce(e.config -> 'marca', '{}'::jsonb) as m
  ) fusion
 where e.slug = p_slug
   and e.activa = true
$$;

grant execute on function public.marca_de(text) to anon, authenticated;


/* ------------------------------------------------------------
   2 · Crear la ficha

   La cuenta la crea Supabase con `signUp` desde el navegador; esto es lo
   que no puede hacer solo, que es escribir en `clientes`.
   ------------------------------------------------------------ */

/* Recibe el slug y no el id del comercio.

   La app, antes de que nadie entre, conoce el slug —es el subdominio— y
   nada más. Pasarle el id obligaría a publicarlo en `marca_de`, o sea a
   exponer en una función pública el identificador que aparece en cada
   política de RLS del sistema. No otorga nada por sí solo, pero tampoco
   hace falta darlo: el slug alcanza y ya es público. */
create or replace function public.registrarme_en(
  p_slug   text,
  p_nombre text,
  p_tel    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_abre  boolean;
  v_email text;
  v_dup   uuid;
  v_id    uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión.' using errcode = 'P00C0';
  end if;

  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'Hace falta tu nombre.' using errcode = 'P00C1';
  end if;

  select e.id, coalesce((e.config -> 'cliente' ->> 'autoregistro')::boolean, false)
    into v_empresa, v_abre
    from empresas e
   where e.slug = p_slug and e.activa = true;

  if v_abre is not true then
    raise exception 'Este comercio no toma registros por la app. Pedile a ellos que te den de alta.'
      using errcode = 'P00C2';
  end if;

  /* Una cuenta, una ficha por comercio. El disparador de 0050 ya lo
     impide; se mira antes para poder decirlo con palabras en vez de
     devolver el error de una restricción. */
  if exists (
    select 1 from clientes
     where usuario_id = auth.uid() and empresa_id = v_empresa
  ) then
    raise exception 'Ya tenés una ficha en este comercio.' using errcode = 'P00C3';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  /* La sospecha de duplicado, anotada donde el comercio la va a ver. No
     se le contesta nada de esto a quien se registra. */
  /* Cualquier otra ficha del comercio, tenga cuenta o no. La primera
     versión pedía `usuario_id is null` —"si ya tiene cuenta no es un
     duplicado"— y es al revés: que el correo o el teléfono ya sean de
     alguien con cuenta es más raro todavía, no menos. */
  select c.id into v_dup
    from clientes c
   where c.empresa_id = v_empresa
     and (
       (v_email is not null and lower(c.email) = lower(v_email))
       or (coalesce(trim(p_tel), '') <> ''
           and regexp_replace(coalesce(c.tel, ''), '\D', '', 'g')
               = regexp_replace(p_tel, '\D', '', 'g')
           and regexp_replace(p_tel, '\D', '', 'g') <> '')
     )
   limit 1;

  insert into clientes (empresa_id, razon_social, condicion, email, tel, usuario_id, enlazado_en, campos_extra)
  values (
    v_empresa,
    trim(p_nombre),
    'CF',
    v_email,
    nullif(trim(p_tel), ''),
    auth.uid(),
    now(),
    jsonb_strip_nulls(jsonb_build_object(
      'autoregistro', true,
      'posibleDuplicadoDe', v_dup
    ))
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.registrarme_en(text, text, text) to authenticated;

comment on function public.registrarme_en(text, text, text) is
  'Crea una ficha nueva para quien se registra desde la app. No reclama ninguna ficha existente: ver el encabezado de 0065.';
