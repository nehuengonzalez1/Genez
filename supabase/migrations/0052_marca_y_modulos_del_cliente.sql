/* ============================================================
   0052 · LA MARCA Y LOS MÓDULOS DEL CLIENTE
   ============================================================

   Lo que hace que la app del cliente sea "Almha by GENEZ" y no "una app
   de GENEZ con el nombre de Almha". Son dos cosas: de quién es la app, y
   qué muestra.

   Ver `docs/modelo-identidad-del-cliente.md` para el modelo de identidad,
   que es de dónde cuelga esto.

   EL COMERCIO SE IDENTIFICA POR EL DOMINIO
   ----------------------------------------
   `almha.genez.com.ar` y no `genez.com.ar/almha`. Dos razones:

   Una PWA se instala por origen. Compartir origen entre comercios
   significa un solo service worker, un solo ícono y un solo
   almacenamiento para todos: instalar "Almha" y que aparezca el nombre
   de otro comercio.

   Y porque la pantalla de bienvenida tiene que mostrar la marca **antes**
   de que la persona entre. Si el comercio saliera del login, hasta ese
   momento la app no sería de nadie.

   POR ESO HACE FALTA UNA FUNCIÓN PÚBLICA, Y ES LA ÚNICA
   -----------------------------------------------------
   `marca_de(slug)` la puede llamar cualquiera, sin sesión. Es
   deliberado y es el único lugar del sistema donde eso pasa.

   Devuelve solo lo que ya es público de un comercio: cómo se llama, cómo
   se ve y qué ofrece. Lo mismo que un cartel en la vereda. No devuelve el
   id de la empresa, ni sus módulos de gestión, ni nada que sirva para
   preguntar otra cosa después.

   Sí permite averiguar qué comercios usan Genez probando slugs. Eso es
   aceptable —un cartel también se ve desde la calle— pero es la razón por
   la que devuelve tan poco.

   LOS MÓDULOS DEL CLIENTE NO SON LOS DEL COMERCIO
   -----------------------------------------------
   El comercio contrata `agenda`; el cliente ve "Turnos". El comercio
   contrata `ventas`; el cliente ve "Mi plan". Son dos catálogos con una
   relación entre ellos, y esa relación es **dato y no código**: una
   columna `requiere` que dice qué módulos de gestión tienen que estar
   activos.

   Así la navegación de la app se calcula. Un comercio sin `agenda` no
   muestra Turnos, sin un solo `if` en el front, y el día que lo contrate
   aparece solo.
   ============================================================ */


/* ------------------------------------------------------------
   1 · El subdominio

   `almha` en `almha.genez.com.ar`. Se genera del nombre y se puede
   corregir a mano: "Bar Rivadavia" da `bar-rivadavia`, que está bien,
   pero alguien va a querer `rivadavia` a secas.
   ------------------------------------------------------------ */

create or replace function public.slug_de(p_nombre text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(translate(p_nombre,
        'áéíóúüñÁÉÍÓÚÜÑ',
        'aeiouunAEIOUUN')),
      '[^a-z0-9]+', '-', 'g'))
$$;

alter table empresas
  add column if not exists slug text;

update empresas set slug = public.slug_de(nombre) where slug is null;

/* Único porque es una dirección: dos comercios con el mismo slug serían
   dos apps en el mismo lugar. */
create unique index if not exists empresas_slug_idx on empresas (slug);

/* Un comercio nuevo nace con su slug. Sin esto, la plataforma da de alta
   un comercio y su app no existe hasta que alguien se acuerde. */
create or replace function public.poner_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := public.slug_de(new.nombre);
  end if;
  return new;
end;
$$;

drop trigger if exists empresas_poner_slug on empresas;

create trigger empresas_poner_slug
  before insert on empresas
  for each row execute function public.poner_slug();


/* ------------------------------------------------------------
   2 · La marca

   De fábrica por rubro y cambiada por comercio, igual que las reglas de
   reserva y que los roles. Un comercio nuevo tiene una app presentable
   sin que nadie le cargue nada.

   PERSONALIZACIÓN CONTROLADA
   --------------------------
   El color es una clave del tema y no un valor libre. Con un color
   arbitrario, alguien elige amarillo sobre blanco y la app queda
   ilegible; y el que la mira no sabe si está rota o si es así. La lista
   de temas la define la plataforma, que es donde se puede garantizar el
   contraste.

   Lo demás —nombre, bajada, logo, foto— sí es libre: no puede romper
   nada.
   ------------------------------------------------------------ */

alter table rubros
  add column if not exists marca jsonb not null default '{}'::jsonb;

update rubros
   set marca = jsonb_build_object(
     'tema',    'calido',
     'bajada',  'Reservá tus turnos y seguí tu plan desde la app.',
     'lema',    'Tu espacio. Tu tiempo.'
   )
 where clave = 'servicios' and not (marca ? 'tema');

update rubros
   set marca = jsonb_build_object(
     'tema',    'calido',
     'bajada',  'Mirá la carta, pedí y seguí tus pedidos.',
     'lema',    'Lo de siempre, más rápido.'
   )
 where clave = 'gastronomia' and not (marca ? 'tema');


/* Lo que ve cualquiera que abra la app, con sesión o sin ella.

   `security definer` porque `empresas` está cerrada por RLS y esto tiene
   que contestarle a alguien que todavía no es nadie. Por eso devuelve
   una lista de columnas escrita a mano y no la fila: el día que
   `empresas` gane una columna, no se publica sola. */
create or replace function public.marca_de(p_slug text)
returns table (
  slug        text,
  nombre      text,
  rubro       text,
  tema        text,
  lema        text,
  bajada      text,
  logo        text,
  portada     text
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
    nullif(m ->> 'portada', '')
  from empresas e
  left join rubros r on r.clave = e.rubro
  cross join lateral (
    select coalesce(r.marca, '{}'::jsonb) || coalesce(e.config -> 'marca', '{}'::jsonb) as m
  ) fusion
 where e.slug = p_slug
   and e.activa = true
$$;

comment on function public.marca_de is
  'Lo que se puede mostrar de un comercio sin sesión: cómo se llama y cómo se ve. Lo mismo que un cartel en la vereda.';

/* La única función del sistema que puede llamar alguien sin sesión. */
grant execute on function public.marca_de(text) to anon, authenticated;


/* ------------------------------------------------------------
   2 bis · `mis_comercios` necesita el slug y el nombre de la persona

   El slug porque con el comercio saliendo del dominio, la app tiene que
   encontrar cuál de las fichas de esta persona es la de ESTA app. La
   primera versión del motor las comparaba por nombre de comercio, que
   funciona hasta que existan "Almha" y "Almha Centro".

   Y el nombre porque el saludo del inicio es "Hola, Sofía" y ese dato no
   está en la sesión: en `auth.users` está el correo, el nombre está en la
   ficha que le hizo el comercio. Son dos cosas distintas a propósito —una
   persona puede llamarse distinto en dos comercios— y el que vale es el
   de la ficha.
   ------------------------------------------------------------ */

drop function if exists public.mis_comercios();

create or replace function public.mis_comercios()
returns table (
  empresa_id  uuid,
  slug        text,
  nombre      text,
  rubro       text,
  ficha_id    uuid,
  mi_nombre   text,
  desde       timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.slug, e.nombre, e.rubro, c.id, c.razon_social, c.creado_en
    from clientes c
    join empresas e on e.id = c.empresa_id
   where c.usuario_id = auth.uid()
     and c.activo = true
     and e.activa = true
   order by e.nombre
$$;

grant execute on function public.mis_comercios() to authenticated;


/* ------------------------------------------------------------
   3 · El catálogo de módulos del cliente

   Dato de plataforma, como `rubros` y `roles_base`. Un rubro nuevo no
   necesita módulos nuevos.

   `requiere` es la relación con el sistema de gestión: qué tiene que
   tener contratado el comercio para que este módulo tenga de dónde
   sacar los datos. Sin `agenda` no hay turnos que mostrar, y una
   pantalla de turnos vacía para siempre es peor que no tenerla.
   ------------------------------------------------------------ */

create table if not exists modulos_cliente (
  clave     text primary key,
  nombre    text not null,
  icono     text not null,
  /* Los módulos de gestión que hacen falta. Vacío es "siempre". */
  requiere  text[] not null default '{}',
  /* Si es parte del piso: inicio y cuenta existen en cualquier app. */
  base      boolean not null default false,
  orden     integer not null default 0,

  /* `activo` es "la pantalla está construida", no "el comercio lo
     quiere". Son tres preguntas distintas y conviene no mezclarlas:

       activo    → existe la pantalla                    (plataforma)
       requiere  → el comercio tiene de dónde sacar datos (contrato)
       apagados  → el comercio no la quiere mostrar       (decisión suya)

     Sin la primera, un módulo declarado y no construido le aparece a
     todo el que tenga el módulo de gestión, y la app lleva a una pantalla
     que no existe. */
  activo    boolean not null default true
);

alter table modulos_cliente enable row level security;

/* Lo lee cualquiera que esté autenticado: es un catálogo, no un dato de
   nadie. Escribirlo es de plataforma. */
drop policy if exists modulos_cliente_ver      on modulos_cliente;
drop policy if exists modulos_cliente_escribir on modulos_cliente;

create policy modulos_cliente_ver on modulos_cliente
  for select using (true);

create policy modulos_cliente_escribir on modulos_cliente
  for all using (public.es_plataforma()) with check (public.es_plataforma());

/* Las cuatro construidas van activas. Las otras tres quedan declaradas y
   apagadas: el catálogo entero está escrito porque es lo que hace que
   agregar una pantalla sea prender una fila, pero mientras la pantalla no
   exista no le puede aparecer a nadie.

   Beneficios además pide `fidelizacion`, que ni siquiera es un módulo de
   gestión todavía. No hay puntos que mostrar porque no hay nada que los
   calcule; construir la pantalla del cliente antes que eso sería empezar
   por el final. */
insert into modulos_cliente (clave, nombre, icono, requiere, base, orden, activo) values
  ('inicio',     'Inicio',     'casa',      '{}',               true,  10, true),
  ('turnos',     'Turnos',     'calendario','{agenda}',         false, 20, true),
  ('plan',       'Mi plan',    'credencial','{ventas}',         false, 30, true),
  ('cuenta',     'Cuenta',     'persona',   '{}',               true,  40, true),

  ('compras',    'Compras',    'bolsa',     '{cobro,clientes}', false, 50, false),
  ('pagos',      'Pagos',      'billete',   '{finanzas}',       false, 60, false),
  ('beneficios', 'Beneficios', 'estrella',  '{fidelizacion}',   false, 70, false)
on conflict (clave) do update
  set nombre   = excluded.nombre,
      icono    = excluded.icono,
      requiere = excluded.requiere,
      base     = excluded.base,
      orden    = excluded.orden,
      activo   = excluded.activo;


/* ------------------------------------------------------------
   4 · Qué módulos le tocan a un comercio

   Tres capas, como todo lo demás: el catálogo de plataforma, lo que el
   comercio tiene contratado, y lo que el comercio decidió apagar.

   Se devuelve la navegación entera y ordenada: la app la dibuja, no la
   decide. Si mañana un comercio activa un módulo, la barra de abajo
   cambia sola.
   ------------------------------------------------------------ */

create or replace function public.modulos_del_cliente(p_empresa uuid)
returns table (
  clave  text,
  nombre text,
  icono  text,
  orden  integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    mc.clave,
    /* El comercio puede renombrar: un gimnasio le dice "Clases" a lo que
       una estética le dice "Turnos". El orden también es suyo. */
    coalesce(e.config -> 'cliente' -> 'nombres' ->> mc.clave, mc.nombre),
    mc.icono,
    coalesce((e.config -> 'cliente' -> 'orden' ->> mc.clave)::integer, mc.orden)
  from empresas e
  cross join modulos_cliente mc
 where e.id = p_empresa
   and mc.activo = true
   /* Contratado, o parte del piso. */
   and (mc.base or mc.requiere <@ e.modulos)
   /* Y que el comercio no lo haya apagado. Apagar uno que no contrató no
      hace nada, y prender uno que no contrató tampoco: la primera
      condición manda. */
   and coalesce((e.config -> 'cliente' -> 'apagados' ->> mc.clave)::boolean, false) = false
 order by 4, 1
$$;

comment on function public.modulos_del_cliente is
  'La navegación de la app de un comercio: el catálogo de plataforma cruzado con lo que ese comercio contrató y no apagó.';

grant execute on function public.modulos_del_cliente(uuid) to authenticated;
