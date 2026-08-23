/* ============================================================
   0045 · PERMISOS CONFIGURABLES Y AUDITORÍA
   ============================================================

   Los roles vivían en una constante de JavaScript: cuatro, con sus
   módulos y sus banderas escritos a mano. Funcionaban, y por eso el
   encargo los dejó para el final. El problema no es que estén mal: es
   que un comercio no puede decir "acá el que atiende sí puede dar
   descuentos" sin que alguien toque el código y publique.

   LO QUE ESTO CAMBIA PARA GASTRONOMÍA: NADA, HASTA QUE ALGUIEN EDITE
   -----------------------------------------------------------------
   Es lo primero que hay que saber porque toca dos políticas de RLS de
   las que dependen los tres comercios.

   Hoy dos políticas nombran roles a mano:

     bitacora_leer        rol in ('dueno', 'encargado')
     empresas_configurar  rol in ('dueno', 'encargado')

   Pasan a preguntar por un permiso —`verBitacora` y `configurar`— cuyos
   valores de fábrica son verdadero para dueño y encargado y falso para
   cajero y repositor. Es decir: **exactamente la misma respuesta para
   exactamente la misma gente**. Mientras nadie edite un rol, la tabla de
   overrides está vacía y las dos políticas se comportan igual que antes.
   Lo cubre `probar-rls.mjs`.

   El cambio real es que a partir de ahora se puede editar, y que la
   política ya no tiene nombres de roles adentro: agregar un rol nuevo
   deja de ser tocar veinte lugares.

   DOS TABLAS, NO UNA
   ------------------
   `roles_base` son los cuatro de fábrica y es dato de plataforma, como
   `rubros`. `roles` guarda **solo lo que un comercio cambió**, y se
   fusiona encima. Mismo criterio que las plantillas de Comunicaciones y
   por las mismas dos razones: un comercio nuevo funciona sin que nadie
   le siembre nada, y si mañana se corrige un valor de fábrica, el que
   nunca lo tocó se lleva la corrección.

   UNA DIFERENCIA QUE YA EXISTÍA Y NO SE TAPA
   ------------------------------------------
   El encargado tiene `ajustes: false` en la pantalla —no ve el módulo—
   pero la política de `empresas` lo deja actualizar la fila. La interfaz
   lo esconde y la base lo permite. Se preserva tal cual en vez de
   cerrarlo por las nuestras: cambiar en silencio lo que puede hacer un
   rol es justamente lo que este módulo viene a evitar. Ahora se ve en
   pantalla y se apaga con un clic, que es donde tiene que decidirse.

   NO SE PUEDE UNO DEJAR AFUERA
   ----------------------------
   Un disparador impide sacarle `configurar` al rol propio. Sin eso, el
   primer accidente de este módulo es un dueño que se quita el permiso de
   configurar y necesita que alguien entre por SQL a devolvérselo.
   ============================================================ */

/* ------------------------------------------------------------
   1 · Los roles de fábrica

   `modulos` en null quiere decir "todos los que el comercio contrató".
   Es lo que hoy expresa la cadena "todos" en el código.
   ------------------------------------------------------------ */

create table roles_base (
  clave       text primary key,
  nombre      text not null,
  descripcion text,
  modulos     text[],
  permisos    jsonb not null default '{}'::jsonb,
  orden       int not null default 0
);

comment on table roles_base is
  'Los roles con los que arranca cualquier comercio. Es dato de plataforma, como rubros: un rubro nuevo no necesita roles nuevos.';

alter table roles_base enable row level security;

/* Los lee cualquiera que haya entrado: son la forma del sistema, no
   datos de nadie. Escribirlos es de la plataforma. */
create policy roles_base_ver on roles_base
  for select to authenticated using (true);

insert into roles_base (clave, nombre, descripcion, modulos, permisos, orden) values
  ('dueno', 'Dueño', 'Acceso completo al comercio',
   null,
   '{"verCostos":true,"descuentos":true,"anular":true,"cerrarCaja":true,
     "cambiarPrecios":true,"ajustes":true,"verBitacora":true,"configurar":true}'::jsonb, 1),

  ('encargado', 'Encargado', 'Todo menos la configuración',
   array['cobro','caja','comandas','productos','stock','compras','pedidos','clientes',
         'equipo','agenda','ventas','finanzas','servicios','reportes','informes',
         'crm','comunicaciones','asistente'],
   /* `ajustes` en falso y `configurar` en verdadero es la diferencia que
      se explica arriba: así estaba y así queda. */
   '{"verCostos":true,"descuentos":true,"anular":true,"cerrarCaja":true,
     "cambiarPrecios":true,"ajustes":false,"verBitacora":true,"configurar":true}'::jsonb, 2),

  ('cajero', 'Cajero', 'Cobra, sin ver costos ni ganancias',
   array['cobro','caja','comandas','pedidos','clientes','equipo','agenda',
         'ventas','finanzas','servicios'],
   '{"verCostos":false,"descuentos":false,"anular":false,"cerrarCaja":false,
     "cambiarPrecios":false,"ajustes":false,"verBitacora":false,"configurar":false}'::jsonb, 3),

  ('repositor', 'Repositor', 'Stock y preparación de pedidos',
   array['stock','pedidos','productos'],
   '{"verCostos":false,"descuentos":false,"anular":false,"cerrarCaja":false,
     "cambiarPrecios":false,"ajustes":false,"verBitacora":false,"configurar":false}'::jsonb, 4);


/* ------------------------------------------------------------
   2 · Lo que cada comercio cambió
   ------------------------------------------------------------ */

create table roles (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  clave       text not null references roles_base(clave) on delete cascade,
  nombre      text,
  /* En null: se usa el de fábrica. Un arreglo vacío es distinto y quiere
     decir "ningún módulo", que es una decisión válida. */
  modulos     text[],
  permisos    jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now(),
  usuario_id  uuid references perfiles(id) on delete set null,
  unique (empresa_id, clave)
);

comment on table roles is
  'Solo lo que el comercio cambió de un rol. Se fusiona encima de roles_base: lo que no está acá sigue siendo lo de fábrica.';

alter table roles enable row level security;

/* Las políticas de esta tabla van más abajo, después de las funciones:
   `permisos_de` lee `roles` y las políticas de `roles` preguntan por
   `permiso`. Se rompe el círculo creando la tabla primero, las funciones
   después y las políticas al final. */


/* ------------------------------------------------------------
   3 · Qué puede hacer alguien

   `permisos_de` toma el perfil como parámetro en vez de mirar solo
   `auth.uid()`. Es lo que permite probarla —una función que solo se puede
   ejecutar "siendo" cada rol no se prueba, se cruza los dedos— y es lo
   que la pantalla necesita para mostrar la grilla entera.

   Es `security definer` porque lee `perfiles` y `roles`, que están detrás
   de RLS. Por eso mismo se limita a sí mismo o a perfiles del comercio
   que el que pregunta ya puede ver: qué puede hacer un usuario no es un
   dato grave, pero tampoco es de dominio público.
   ------------------------------------------------------------ */

create or replace function public.permisos_de(p_perfil uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    /* La plataforma entra a todo: es la misma decisión que ya toma
       `puede_ver`, escrita una vez más y en el mismo lugar. */
    when p.es_plataforma then (select permisos from roles_base where clave = 'dueno')
    else coalesce(b.permisos, '{}'::jsonb) || coalesce(r.permisos, '{}'::jsonb)
  end
  from perfiles p
  left join roles_base b on b.clave = p.rol
  left join roles      r on r.empresa_id = p.empresa_id and r.clave = p.rol
  where p.id = p_perfil
    and (p_perfil = auth.uid() or public.puede_ver(p.empresa_id))
$$;

comment on function public.permisos_de is
  'Las banderas de un perfil: las de fábrica de su rol, con lo que el comercio haya cambiado encima.';

create or replace function public.permiso(p_clave text)
returns boolean
language sql
stable
as $$
  select coalesce((public.permisos_de(auth.uid()) ->> p_clave)::boolean, false)
$$;

comment on function public.permiso is
  'Si el que está preguntando tiene esa bandera. Es lo que usan las políticas, para que ninguna vuelva a tener nombres de roles adentro.';

grant execute on function public.permisos_de(uuid) to authenticated;
grant execute on function public.permiso(text) to authenticated;


/* ------------------------------------------------------------
   4 · Quién puede tocar los roles

   Editar roles es configurar el comercio: el mismo permiso que tocar la
   ficha de la empresa, y no uno propio. Dos permisos para lo mismo
   terminan siempre con uno de los dos olvidado.
   ------------------------------------------------------------ */

create policy roles_ver on roles
  for select using (public.puede_ver(empresa_id));

create policy roles_escribir on roles
  for insert with check (public.puede_ver(empresa_id) and public.permiso('configurar'));

create policy roles_editar on roles
  for update using (public.puede_ver(empresa_id) and public.permiso('configurar'));

create policy roles_borrar on roles
  for delete using (public.puede_ver(empresa_id) and public.permiso('configurar'));


/* ------------------------------------------------------------
   5 · Las dos políticas que nombraban roles

   Se rehacen. El resultado es el mismo para todos los usuarios que
   existen hoy; lo que cambia es que mañana se puede mover sin publicar
   una versión.
   ------------------------------------------------------------ */

drop policy bitacora_leer on bitacora;

create policy bitacora_leer on bitacora
  for select using (
    public.puede_ver(empresa_id) and public.permiso('verBitacora')
  );

drop policy empresas_configurar on empresas;

create policy empresas_configurar on empresas
  for update
  using (id = public.empresa_actual() and public.permiso('configurar'))
  with check (id = public.empresa_actual());


/* ------------------------------------------------------------
   6 · No dejarse afuera

   El accidente que este módulo habilita: alguien le saca `configurar` a
   su propio rol y necesita que otro entre por SQL a devolvérselo. La
   base lo impide, que es donde tiene que impedirse: una validación en la
   pantalla la saltea cualquier otra pantalla.
   ------------------------------------------------------------ */

create or replace function public.no_dejarse_afuera()
returns trigger
language plpgsql
as $$
declare
  v_mi_rol  text;
  v_quedan  boolean;
begin
  if public.es_plataforma() then
    return new;
  end if;

  select rol into v_mi_rol from perfiles where id = auth.uid();
  if v_mi_rol is distinct from new.clave then
    return new;
  end if;

  select coalesce(((coalesce(b.permisos, '{}'::jsonb) || new.permisos) ->> 'configurar')::boolean, false)
    into v_quedan
    from roles_base b where b.clave = new.clave;

  if not v_quedan then
    raise exception 'No podés sacarle a tu propio rol el permiso de configurar: te quedarías afuera.'
      using errcode = 'P0070';
  end if;

  return new;
end;
$$;

create trigger roles_no_dejarse_afuera
  before insert or update on roles
  for each row execute function public.no_dejarse_afuera();


/* ------------------------------------------------------------
   7 · La auditoría

   `bitacora` ya existía y nunca tuvo pantalla: se escribía y no la leía
   nadie. Ahora se lee, y lo primero que tiene que registrar es esto
   mismo. Un módulo de permisos que no deje rastro de quién cambió qué es
   el único que no se puede auditar, que es al revés de lo que hace falta.
   ------------------------------------------------------------ */

create or replace function public.anotar_permiso()
returns trigger
language plpgsql
as $$
begin
  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (
    coalesce(new.empresa_id, old.empresa_id),
    auth.uid(),
    case tg_op when 'DELETE' then 'permisos.restaurar' else 'permisos.cambiar' end,
    'rol',
    coalesce(new.id, old.id),
    jsonb_build_object(
      'rol', coalesce(new.clave, old.clave),
      'antes', case when tg_op = 'INSERT' then null else old.permisos end,
      'despues', case when tg_op = 'DELETE' then null else new.permisos end,
      'modulos', case when tg_op = 'DELETE' then null else to_jsonb(new.modulos) end
    )
  );
  return coalesce(new, old);
end;
$$;

create trigger roles_bitacora
  after insert or update or delete on roles
  for each row execute function public.anotar_permiso();


/* ------------------------------------------------------------
   8 · La sección en el menú

   Cuelga de Configuración, al lado de Ajustes. Solo para el rubro
   servicios por ahora: los otros dos rubros lo reciben con un insert el
   día que se decida, y no hay nada en el módulo que sea de servicios.
   ------------------------------------------------------------ */

update rubros set menu = jsonb_set(
  menu, '{9}',
  '{
    "clave":"config", "nombre":"Configuración", "i":"tuerca",
    "modulos":[
      {"k":"ajustes","n":"Ajustes","i":"tuerca","d":"Configuración del negocio y del sistema"},
      {"k":"permisos","n":"Permisos","i":"escudo","d":"Qué puede hacer cada rol, y quién cambió qué"}
    ]
  }'::jsonb
)
where clave = 'servicios'
  and menu -> 9 ->> 'clave' = 'config';

do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  update empresas
     set modulos = array(select distinct unnest(modulos || array['permisos']))
   where nombre = 'Almha';

  perform set_config('request.jwt.claims', '', true);
end;
$$;

select clave, nombre, cardinality(modulos) as modulos,
       permisos ->> 'configurar' as configura,
       permisos ->> 'verBitacora' as ve_bitacora
  from roles_base order by orden;
