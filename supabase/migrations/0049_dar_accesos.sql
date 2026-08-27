/* ============================================================
   0049 · DAR ACCESOS ES SU PROPIO PERMISO
   ============================================================

   Dos cosas que van juntas y no se pueden separar: crear usuarios pasa a
   ser un permiso aparte, y nadie puede regalarse un permiso que no tiene.
   La segunda es la que hace que la primera signifique algo.

   POR QUÉ UN PERMISO NUEVO Y NO `configurar`
   ------------------------------------------
   0048 dejó el alta de accesos colgada de `configurar`, con el criterio
   de 0045 §4: dos permisos para lo mismo terminan con uno olvidado. Pero
   no es lo mismo. `configurar` es cambiar la ficha del negocio y los
   roles; dar un acceso es **habilitar a una persona a entrar**, y de
   fábrica lo tenían dueño y encargado por igual.

   Así que se separa: `darAccesos`, verdadero solo para el dueño. Un
   comercio que quiera dárselo a su encargado lo prende y listo; lo que
   cambia es de qué lado arranca.

   Y SIN ESTO NO SERVIRÍA DE NADA
   -----------------------------
   El encargado tiene `configurar`, o sea que puede editar roles. Podía
   editar **el suyo**. `no_dejarse_afuera` (0045 §6) solo impide sacarse
   `configurar`; nunca miró lo que alguien se agrega. Verificado contra la
   base antes de escribir esto: un encargado de fábrica pasa de
   `ajustes: false` a `ajustes: true` con un insert en `roles`.

   Con eso vivo, apagarle `darAccesos` al encargado sería decorativo: se
   lo prende solo. La regla que falta es la de siempre en cualquier
   sistema de permisos, y no estaba: **nadie otorga lo que no tiene**.

   Vale para las dos capas que se pueden editar —`roles` y las excepciones
   de `perfiles`— porque si valiera solo para una, la otra es el camino.

   Revocar no se toca: sacar un permiso no escala nada. Lo que se mira es
   únicamente lo que se prende.
   ============================================================ */


/* ------------------------------------------------------------
   1 · La bandera nueva

   Se agrega a los cuatro roles de fábrica y no solo al dueño: una
   bandera que en un rol no existe se lee como null y no como false, y
   entonces `permisos_de` la devuelve ausente. Mejor que los cuatro digan
   explícitamente qué pasa con ella.

   Los comercios que ya editaron un rol no se tocan: `roles` guarda solo
   la diferencia, así que la bandera les llega de fábrica sola. Hoy no hay
   ninguno, pero la migración no puede depender de eso.
   ------------------------------------------------------------ */

update roles_base
   set permisos = permisos || jsonb_build_object('darAccesos', clave = 'dueno')
 where not (permisos ? 'darAccesos');


/* ------------------------------------------------------------
   2 · Nadie otorga lo que no tiene

   El disparador mira las banderas que quedan en **true** y exige que
   quien está escribiendo las tenga. No mira las que quedan en false:
   revocar no escala.

   Es `security definer` porque necesita leer `permisos_de` del que
   escribe, y esa ya lo es por la misma razón.
   ------------------------------------------------------------ */

create or replace function public.no_regalar_lo_que_no_se_tiene(p_nuevos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mios  jsonb;
  v_clave text;
begin
  /* La plataforma da de alta comercios enteros, y las semillas corren
     sin sesión: en los dos casos no hay contra qué comparar. */
  if public.es_plataforma() or auth.uid() is null then
    return;
  end if;

  v_mios := public.permisos_de(auth.uid());

  for v_clave in select jsonb_object_keys(coalesce(p_nuevos, '{}'::jsonb))
  loop
    if (p_nuevos ->> v_clave)::boolean is true
       and coalesce((v_mios ->> v_clave)::boolean, false) is not true then
      raise exception 'No podés dar un permiso que vos no tenés (%).', v_clave
        using errcode = 'P0075';
    end if;
  end loop;
end;
$$;

/* Sobre los roles. Se suma al disparador que ya existía en vez de
   reemplazarlo: aquel cuida que nadie se deje afuera y este que nadie se
   agrande. Son dos reglas distintas sobre la misma tabla. */
create or replace function public.roles_no_escalar()
returns trigger
language plpgsql
as $$
begin
  perform public.no_regalar_lo_que_no_se_tiene(new.permisos);
  return new;
end;
$$;

drop trigger if exists roles_no_escalar on roles;

create trigger roles_no_escalar
  before insert or update on roles
  for each row execute function public.roles_no_escalar();

/* Y sobre las excepciones por persona, que es la otra capa editable. Si
   la regla valiera solo para `roles`, esta sería el camino de al lado:
   me doy a mí mismo una excepción con la bandera que me falta. */
create or replace function public.cuidar_el_acceso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_puede boolean;
begin
  if public.es_plataforma() then
    return new;
  end if;

  if auth.uid() is null then
    return new;
  end if;

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

    if new.id = auth.uid() then
      if new.rol is distinct from old.rol
        or new.permisos is distinct from old.permisos
        or new.activo is distinct from old.activo then
        raise exception 'No podés cambiarte a vos mismo el rol, los permisos ni darte de baja. Que lo haga otra persona con permiso para dar accesos.'
          using errcode = 'P0073';
      end if;
      return new;
    end if;

    /* Cambió respecto de 0048: el permiso que hace falta acá ya no es
       `configurar` sino `darAccesos`. */
    select public.permiso('darAccesos') into v_puede;
    if not v_puede then
      raise exception 'No tenés permiso para dar accesos.'
        using errcode = 'P0074';
    end if;
  end if;

  /* Nuevo en 0049: la excepción que se le pone a alguien tampoco puede
     tener banderas que el que la pone no tenga.

     Va último y no primero, que es donde lo había puesto: sobre la propia
     fila el rechazo que corresponde es el de más arriba —"no te cambies
     los permisos a vos mismo"—, que dice qué hacer. Con este adelante,
     alguien que se daba una excepción a sí mismo recibía "no podés dar un
     permiso que no tenés", que es cierto y no ayuda. */
  perform public.no_regalar_lo_que_no_se_tiene(new.permisos);

  return new;
end;
$$;


/* ------------------------------------------------------------
   3 · Las políticas pasan a pedir la bandera nueva

   Leer no cambia. Escribir sobre `perfiles` deja de pedir `configurar`.
   ------------------------------------------------------------ */

drop policy if exists perfiles_crear  on perfiles;
drop policy if exists perfiles_editar on perfiles;
drop policy if exists perfiles_borrar on perfiles;

create policy perfiles_crear on perfiles
  for insert with check (public.puede_ver(empresa_id) and public.permiso('darAccesos'));

create policy perfiles_editar on perfiles
  for update using (public.puede_ver(empresa_id) and public.permiso('darAccesos'))
  with check (public.puede_ver(empresa_id) and public.permiso('darAccesos'));

create policy perfiles_borrar on perfiles
  for delete using (public.puede_ver(empresa_id) and public.permiso('darAccesos'));

/* `perfiles_editarme` sigue igual: corregirse el nombre no es dar un
   acceso, y el disparador ya se encarga de que por esa puerta no pase
   nada más que el nombre. */


/* ------------------------------------------------------------
   4 · Lo que esto NO cierra, dicho para que no sorprenda

   Un encargado conserva `configurar`, así que puede editar el rol del
   dueño y sacarle `darAccesos`. No se agranda —no puede dárselo a sí
   mismo, que es lo que esta migración impide— pero puede molestar.

   Se deja así a propósito y no se tapa con más reglas: el dueño mantiene
   `configurar` y lo vuelve a prender, o le saca `configurar` al
   encargado, que es la decisión que corresponde tomar en pantalla. Un
   comercio donde el encargado no es de confianza no se arregla con un
   disparador.
   ------------------------------------------------------------ */

comment on function public.no_regalar_lo_que_no_se_tiene is
  'Impide que alguien prenda una bandera que él no tiene, en roles o en las excepciones de un perfil.';


/* ------------------------------------------------------------
   5 · El correo de los que ya estaban

   0048 agregó `perfiles.email` y solo lo llena el alta nueva. Los tres
   perfiles que existían desde las semillas lo tienen en null, y las dos
   pantallas que listan gente muestran el correo al lado del rol porque es
   con lo que la persona entra.

   Se copia de auth.users, que es de donde sale. La copia existe porque el
   navegador no puede leer auth.users: no es la fuente, es lo que se
   muestra. Si alguien cambia su correo en Auth, esta columna queda vieja
   —hoy no hay pantalla que lo cambie, y cuando la haya tiene que
   actualizar las dos—.
   ------------------------------------------------------------ */

update perfiles p
   set email = u.email
  from auth.users u
 where u.id = p.id
   and p.email is null;
