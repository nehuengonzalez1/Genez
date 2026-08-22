/* ============================================================
   0020 · LOS CANALES SON FILAS, NO CÓDIGO
   ============================================================

   Hasta acá los canales estaban escritos en dos lugares: la constante
   CANALES del navegador y la restricción de la columna `canal`. Agregar
   WhatsApp, la web o un marketplace nuevo obligaba a tocar el código y a
   migrar la base. Para un sistema que va a vender por donde el comercio
   pueda, eso es un techo.

   Ahora son filas. Cada comercio tiene las suyas, con su nombre, su
   color, su ícono y —lo que más importa— su flujo: por qué estados pasa
   un pedido de ese canal. Un pedido de mostrador no pasa por "en camino"
   y uno de delivery sí, y eso es un dato del canal, no un if.

   PedidosYa, Rappi y Uber Eats dejan de ser el mismo canal 'app'
   distinguido por un campo suelto adentro de campos_extra. Son canales,
   porque el que arma los bolsones los trata como canales distintos.
   ============================================================ */

create table canales (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  clave       text not null,
  nombre      text not null,
  familia     text not null default 'mostrador',
  flujo       text[] not null default array['pendiente', 'en_preparacion', 'listo', 'completado'],
  externo     boolean not null default false,
  color       text,
  icono       text,
  orden       integer not null default 0,
  activo      boolean not null default true,
  config      jsonb not null default '{}'::jsonb,
  creado_en   timestamptz not null default now(),

  constraint canales_clave_unica unique (empresa_id, clave),

  /* La clave es lo que queda guardado en cada operación durante años:
     sin minúsculas y sin espacios no hay forma de escribirla dos veces
     igual. El nombre visible sí se puede cambiar cuando quieran. */
  constraint canales_clave_valida check (clave ~ '^[a-z0-9_]+$'),

  /* Un flujo puede saltear etapas del medio, pero siempre arranca en
     pendiente y termina en completado: son las dos puntas del recorrido
     y sin ellas el tablero no sabría dónde poner el pedido que entra ni
     dónde el que se cobró. */
  constraint canales_flujo_valido check (
    array_length(flujo, 1) >= 2
    and flujo <@ array['pendiente', 'en_preparacion', 'listo', 'en_camino', 'completado']
    and flujo[1] = 'pendiente'
    and flujo[array_length(flujo, 1)] = 'completado'
  )
);

create index on canales (empresa_id, orden);

alter table canales enable row level security;

create policy canales_todo on canales
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

comment on table canales is
  'Por dónde entra un pedido. Se agregan sin tocar código: WhatsApp, la web, un marketplace.';
comment on column canales.familia is
  'De qué se parece: mostrador, retiro, reparto, app, salon. Decide el color y el ícono cuando el canal no traen uno propio.';
comment on column canales.flujo is
  'Los estados por los que pasa un pedido de este canal, en orden. Es lo que hace que mostrador no tenga "en camino" y delivery sí.';
comment on column canales.externo is
  'El número de pedido lo pone otro sistema. Cambia lo que se pide al cargarlo y por dónde se lo busca después.';

/* ------------------------------------------------------------
   Los canales de fábrica

   Se siembran por comercio y no una sola vez para todos porque cada uno
   los renombra, los apaga y agrega los suyos. Lo que viene de fábrica es
   un punto de partida, no una lista compartida.
   ------------------------------------------------------------ */

create or replace function sembrar_canales(p_empresa uuid)
returns integer
language plpgsql
as $$
declare
  v_cuantos integer;
  v_local   text[] := array['pendiente', 'en_preparacion', 'listo', 'completado'];
  v_reparto text[] := array['pendiente', 'en_preparacion', 'listo', 'en_camino', 'completado'];
begin
  insert into canales (empresa_id, clave, nombre, familia, flujo, externo, color, icono, orden, activo) values
    (p_empresa, 'salon',     'Salón',           'salon',     v_local,   false, 'salon',     'UtensilsCrossed', 0, true),
    (p_empresa, 'mostrador', 'Mostrador',       'mostrador', v_local,   false, 'mostrador', 'Store',           1, true),
    (p_empresa, 'delivery',  'Delivery propio', 'reparto',   v_reparto, false, 'reparto',   'Bike',            2, true),
    (p_empresa, 'pedidosya', 'PedidosYa',       'app',       v_reparto, true,  'pedidosya', 'Smartphone',      3, true),
    (p_empresa, 'rappi',     'Rappi',           'app',       v_reparto, true,  'rappi',     'Smartphone',      4, true),
    (p_empresa, 'ubereats',  'Uber Eats',       'app',       v_reparto, true,  'ubereats',  'Smartphone',      5, true),
    (p_empresa, 'takeaway',  'Pasar a buscar',  'retiro',    v_local,   false, 'retiro',    'ShoppingBag',     6, true),
    /* 'app' es de donde vienen los pedidos cargados antes de que cada
       aplicación tuviera su fila. Nace apagado: existe para no dejarlos
       huérfanos, no para que alguien lo elija teniendo las tres
       aplicaciones con nombre. El comercio que trabaje con una
       aplicación chica lo prende desde Configuración. */
    (p_empresa, 'app',       'Otra aplicación', 'app',       v_reparto, true,  'app',       'Smartphone',      7, false)
  on conflict (empresa_id, clave) do nothing;

  get diagnostics v_cuantos = row_count;
  return v_cuantos;
end;
$$;

comment on function sembrar_canales is
  'Los canales con los que arranca un comercio. No pisa los que ya tenga.';

/* Un comercio nuevo tiene que poder vender el mismo día que se crea. Si
   los canales se sembraran desde el panel de la plataforma, alcanzaría
   con que alguien se olvide para que abrir un pedido falle. */
create or replace function sembrar_canales_de_empresa()
returns trigger
language plpgsql
as $$
begin
  perform sembrar_canales(new.id);
  return new;
end;
$$;

create trigger empresas_canales
  after insert on empresas
  for each row execute function sembrar_canales_de_empresa();

do $$
declare e record;
begin
  for e in select id from empresas loop
    perform sembrar_canales(e.id);
  end loop;
end;
$$;

/* ------------------------------------------------------------
   Lo que ya estaba

   Los pedidos de aplicación se guardaban todos como 'app' con el nombre
   adentro de campos_extra. Ahora cada aplicación es un canal, así que se
   los pasa antes de que la clave nueva sea obligatoria.
   ------------------------------------------------------------ */

update operaciones
   set canal = case lower(campos_extra->'cliente'->>'app')
                 when 'pedidosya'  then 'pedidosya'
                 when 'rappi'      then 'rappi'
                 when 'uber eats'  then 'ubereats'
                 when 'ubereats'   then 'ubereats'
               end
 where canal = 'app'
   and lower(campos_extra->'cliente'->>'app') in ('pedidosya', 'rappi', 'uber eats', 'ubereats');

/* ------------------------------------------------------------
   La columna deja de ser una lista escrita a mano

   La restricción se cambia por una clave foránea contra los canales del
   comercio: sigue siendo imposible guardar un canal que no existe, pero
   ahora "que exista" es algo que el comercio decide, no el código.
   ------------------------------------------------------------ */

alter table operaciones drop constraint operaciones_canal_valido;

alter table operaciones
  add constraint operaciones_canal_fk
  foreign key (empresa_id, canal) references canales (empresa_id, clave)
  on update cascade;

comment on column operaciones.canal is
  'Por dónde entró. Apunta a canales.clave del mismo comercio.';
