/* ============================================================
   0048 · LOS ACCESOS
   ============================================================

   Que cada dueño pueda dar de alta a su gente y decidir qué ve, sin
   pedirle a nadie que entre por SQL. Hasta acá `perfiles` se llenaba a
   mano: el bar y el minimercado tienen un usuario cada uno porque
   alguien corrió un insert.

   LO PRIMERO ES UN AGUJERO, NO UNA FUNCIÓN
   ----------------------------------------
   La política que había era esta:

     create policy perfiles_administrar on perfiles
       for all using (puede_ver(empresa_id)) with check (puede_ver(empresa_id));

   `puede_ver` da verdadero para cualquier miembro del comercio. O sea
   que un cajero, desde la consola del navegador, podía correr un update
   sobre su propia fila y ponerse `rol = 'dueno'`. El comentario de 0002
   lo decía sin disimulo —"alta y baja de accesos las hace la plataforma
   o el dueño, y eso se valida en la aplicación"— y eso es exactamente lo
   que `CLAUDE.md` prohíbe: un permiso que solo vive en el navegador no
   protege nada.

   No se notaba porque cada comercio tiene un solo usuario. Esta
   migración es la que hace que haya un segundo, así que el agujero se
   cierra acá y no después.

   TRES CAPAS DE PERMISOS, NO DOS
   ------------------------------
   `roles_base` (fábrica) → `roles` (lo que el comercio cambió) →
   `perfiles.permisos` (la excepción de una persona). La tercera es
   nueva y sigue el mismo criterio que la segunda: **se guarda la
   diferencia, no la foto**. Si mañana se corrige el rol, la persona con
   una excepción sobre otra bandera se lleva igual la corrección.

   Una excepción por persona existe porque el caso es real y hoy obliga a
   inventar un rol: al cajero de la tarde se le quiere dar cerrar caja y
   a los otros tres no. Sin esto hay que crear "cajero que cierra", y a
   la larga un rol por persona, que es no tener roles.

   POR QUÉ NO ALCANZA CON LA POLÍTICA
   ----------------------------------
   La política deja escribir a quien tenga `configurar`. Falta lo que la
   política no puede mirar sola:

   - Nadie se toca a sí mismo el rol ni sus permisos. No es paranoia con
     el dueño —quien tiene `configurar` ya puede casi todo— es evitar el
     accidente de 0045 §6 en su otra forma: bajarse el propio rol y
     quedarse afuera del sistema que administra.
   - `es_plataforma` no se lo pone nadie desde un comercio. Es el más
     grave de todos: `puede_ver` le abre TODOS los comercios, así que un
     dueño que se marque plataforma deja de ser inquilino y pasa a ver a
     los demás. La política no lo ve porque la fila sigue siendo de su
     empresa.
   - `empresa_id` no se cambia de un comercio a otro.

   Todo eso va en un disparador, que es donde se impide de verdad.
   ============================================================ */


/* ------------------------------------------------------------
   1 · Lo que le falta a la tabla

   `activo` ya existía desde 0001 y no lo usaba nadie. Es lo que hace de
   baja: se le saca el acceso a la persona sin borrar el perfil, porque
   borrarlo deja en null el `usuario_id` de cada línea de la bitácora y
   de cada venta que cobró. Una baja no puede costar el historial.
   ------------------------------------------------------------ */

alter table perfiles
  add column if not exists permisos jsonb not null default '{}'::jsonb,
  add column if not exists debe_cambiar_clave boolean not null default false,
  add column if not exists email text,
  add column if not exists invitado_en timestamptz,
  add column if not exists creado_por uuid references perfiles(id) on delete set null;

comment on column perfiles.permisos is
  'Las excepciones de esta persona sobre su rol. Solo la diferencia, como en roles.';

comment on column perfiles.debe_cambiar_clave is
  'Alta con clave provisional: la pantalla obliga a cambiarla antes de dejar entrar.';

comment on column perfiles.email is
  'Copia del correo de auth.users. Se guarda acá porque el front no puede leer auth.users y la lista de accesos necesita mostrarlo.';


/* ------------------------------------------------------------
   2 · La tercera capa

   `permisos_de` ya fusionaba fábrica con lo del comercio. Ahora fusiona
   la persona encima. El orden importa y es el mismo de siempre: lo más
   específico pisa a lo más general.

   La plataforma sigue saliendo por arriba sin mirar nada: es la misma
   decisión que ya toma `puede_ver`.
   ------------------------------------------------------------ */

create or replace function public.permisos_de(p_perfil uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.es_plataforma then (select permisos from roles_base where clave = 'dueno')
    else coalesce(b.permisos, '{}'::jsonb)
      || coalesce(r.permisos, '{}'::jsonb)
      || coalesce(p.permisos, '{}'::jsonb)
  end
  from perfiles p
  left join roles_base b on b.clave = p.rol
  left join roles      r on r.empresa_id = p.empresa_id and r.clave = p.rol
  where p.id = p_perfil
    and (p_perfil = auth.uid() or public.puede_ver(p.empresa_id))
$$;

comment on function public.permisos_de is
  'Las banderas de un perfil: las de fábrica de su rol, lo que el comercio cambió, y la excepción de la persona.';

/* Una persona dada de baja no tiene permisos, sin importar su rol. Se
   resuelve acá y no en cada política: `permiso()` es por donde pasan
   todas, así que apagarlo en un solo lugar lo apaga en todos. */
create or replace function public.permiso(p_clave text)
returns boolean
language sql
stable
as $$
  select coalesce((public.permisos_de(auth.uid()) ->> p_clave)::boolean, false)
     and coalesce((select activo from perfiles where id = auth.uid()), false)
$$;


/* ------------------------------------------------------------
   3 · Quién puede tocar los accesos

   Se cae la política de `for all` y quedan cuatro, separadas. Leer no
   cambia: los compañeros se siguen viendo entre sí porque el ticket
   muestra quién cobró.

   Escribir pide `configurar`, el mismo permiso que editar roles y que
   tocar la ficha del comercio. No se inventa un permiso nuevo: dos
   permisos para lo mismo terminan siempre con uno de los dos olvidado
   (es el criterio de 0045 §4).
   ------------------------------------------------------------ */

drop policy if exists perfiles_administrar on perfiles;
drop policy if exists perfiles_crear      on perfiles;
drop policy if exists perfiles_editar     on perfiles;
drop policy if exists perfiles_borrar     on perfiles;
drop policy if exists perfiles_editarme   on perfiles;

create policy perfiles_crear on perfiles
  for insert with check (public.puede_ver(empresa_id) and public.permiso('configurar'));

create policy perfiles_editar on perfiles
  for update using (public.puede_ver(empresa_id) and public.permiso('configurar'))
  with check (public.puede_ver(empresa_id) and public.permiso('configurar'));

create policy perfiles_borrar on perfiles
  for delete using (public.puede_ver(empresa_id) and public.permiso('configurar'));

/* Cambiarse el propio nombre no es administrar accesos. Sin esto,
   alguien sin `configurar` no puede corregirse una falta de ortografía
   en su nombre, que es absurdo. El disparador de abajo se encarga de que
   por esta puerta no pase nada más que el nombre. */
create policy perfiles_editarme on perfiles
  for update using (id = auth.uid()) with check (id = auth.uid());


/* ------------------------------------------------------------
   4 · Lo que la política no puede mirar

   Una política decide sobre la fila; esto decide sobre el cambio. Son
   las tres cosas del encabezado, y la más grave es `es_plataforma`.
   ------------------------------------------------------------ */

create or replace function public.cuidar_el_acceso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_configura boolean;
begin
  /* La plataforma da de alta comercios enteros: si tuviera que pedirse
     permiso a sí misma no podría crear el primer dueño de nadie. */
  if public.es_plataforma() then
    return new;
  end if;

  /* Y el primer perfil de todos: cuando `auth.uid()` no tiene perfil
     todavía, no hay comercio contra el cual preguntar nada. Es el caso
     de las semillas, que corren como administrador y sin sesión. */
  if auth.uid() is null then
    return new;
  end if;

  /* Nadie se marca plataforma desde adentro de un comercio. Es lo que
     convierte a un inquilino en dueño de todos los inquilinos. */
  if tg_op = 'INSERT' and new.es_plataforma then
    raise exception 'Solo la plataforma puede crear un usuario de plataforma.'
      using errcode = 'P0071';
  end if;

  if tg_op = 'UPDATE' then
    if new.es_plataforma is distinct from old.es_plataforma then
      raise exception 'Solo la plataforma puede cambiar eso.'
        using errcode = 'P0071';
    end if;

    if new.empresa_id is distinct from old.empresa_id then
      raise exception 'Un acceso no se muda de comercio. Se da de baja acá y de alta allá.'
        using errcode = 'P0072';
    end if;

    /* Sobre uno mismo solo se cambia el nombre. Bajarse el propio rol es
       el accidente de 0045 §6 por la otra puerta: el que administra se
       queda afuera del sistema que administra y hace falta que otro
       entre por SQL a devolvérselo. */
    if new.id = auth.uid() then
      if new.rol is distinct from old.rol
        or new.permisos is distinct from old.permisos
        or new.activo is distinct from old.activo then
        raise exception 'No podés cambiarte a vos mismo el rol, los permisos ni darte de baja. Que lo haga otra persona con permiso para configurar.'
          using errcode = 'P0073';
      end if;
      return new;
    end if;

    /* Llegar hasta acá tocando a otro sin `configurar` significa que se
       entró por `perfiles_editarme`, que es solo para uno mismo. */
    select public.permiso('configurar') into v_configura;
    if not v_configura then
      raise exception 'No tenés permiso para administrar los accesos.'
        using errcode = 'P0074';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists perfiles_cuidar_el_acceso on perfiles;

create trigger perfiles_cuidar_el_acceso
  before insert or update on perfiles
  for each row execute function public.cuidar_el_acceso();


/* ------------------------------------------------------------
   5 · Que quede rastro

   Un alta de acceso es el acto más pesado que hay en un comercio:
   habilita a una persona a entrar. Si los cambios de permisos de un rol
   se auditan desde 0045, esto con más razón.

   Se anota el rol y las banderas que quedaron, no el objeto entero: lo
   que se quiere poder leer después es "a quién le dieron qué".
   ------------------------------------------------------------ */

create or replace function public.anotar_acceso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := coalesce(new.empresa_id, old.empresa_id);
  v_accion  text;
begin
  /* El dueño de plataforma no tiene empresa: su alta no es de nadie. */
  if v_empresa is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    v_accion := 'acceso.crear';
  elsif tg_op = 'DELETE' then
    v_accion := 'acceso.borrar';
  elsif new.activo is distinct from old.activo then
    v_accion := case when new.activo then 'acceso.alta' else 'acceso.baja' end;
  elsif new.rol is distinct from old.rol or new.permisos is distinct from old.permisos then
    v_accion := 'acceso.permisos';
  else
    /* Un cambio de nombre no es un acto de auditoría. */
    return new;
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (
    v_empresa,
    auth.uid(),
    v_accion,
    'acceso',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'nombre', coalesce(new.nombre, old.nombre),
      'rol_antes', case when tg_op = 'INSERT' then null else old.rol end,
      'rol', coalesce(new.rol, old.rol),
      'permisos_antes', case when tg_op = 'INSERT' then null else old.permisos end,
      'permisos', coalesce(new.permisos, old.permisos)
    )
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists perfiles_anotar_acceso on perfiles;

create trigger perfiles_anotar_acceso
  after insert or update or delete on perfiles
  for each row execute function public.anotar_acceso();


/* ------------------------------------------------------------
   6 · Enganchar una persona del equipo con su acceso

   `personal.perfil_id` existe desde 0030 y nunca se usó: estaba previsto
   para hoy —"el día que un profesor quiera entrar se le engancha una
   cuenta y nada más"—. La vista deja mostrar las dos cosas juntas sin
   que la pantalla tenga que cruzarlas a mano.
   ------------------------------------------------------------ */

create or replace view accesos
with (security_invoker = true) as
select
  p.id,
  p.empresa_id,
  p.nombre,
  p.email,
  p.rol,
  p.permisos,
  p.activo,
  p.debe_cambiar_clave,
  p.invitado_en,
  p.creado_en,
  p.id = auth.uid()          as soy_yo,
  public.permisos_de(p.id)   as permisos_finales,
  per.id                     as personal_id,
  per.nombre                 as personal_nombre
from perfiles p
left join personal per on per.perfil_id = p.id
where p.es_plataforma = false;

comment on view accesos is
  'Quién entra al comercio, con qué rol, qué banderas le quedan y a qué persona del equipo corresponde.';

grant select on accesos to authenticated;
