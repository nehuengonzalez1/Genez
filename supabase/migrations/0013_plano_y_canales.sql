/* ============================================================
   0013 · EL PLANO DEL LOCAL Y LOS CANALES DE VENTA
   ============================================================

   Dos cosas que el módulo de comandas necesita y el esquema todavía no
   tenía.

   El plano. Un salón no es una lista de mesas: es un lugar donde la mesa
   8 está contra la ventana y la 3 al lado de la barra. El mozo no busca
   "Mesa 8" en una grilla, mira dónde está parado. Para que la pantalla
   se parezca al local, cada recurso guarda dónde está y qué forma tiene.

   Los canales. No todo lo que se vende ocupa una mesa: está el mostrador,
   el que pasa a buscar, y los pedidos que entran por aplicaciones. Es la
   misma comanda con la misma carta; lo único que cambia es de dónde vino
   y a dónde va.
   ============================================================ */

/* ------------------------------------------------------------
   Dónde está cada mesa

   Las medidas van en una grilla propia y no en píxeles: la pantalla del
   mozo puede ser un celular o un monitor de 27 pulgadas, y el plano
   tiene que ser el mismo en los dos.
   ------------------------------------------------------------ */

alter table recursos add column piso  text not null default 'Planta baja';
alter table recursos add column x     integer not null default 0;
alter table recursos add column y     integer not null default 0;
alter table recursos add column ancho integer not null default 2;
alter table recursos add column alto  integer not null default 2;
alter table recursos add column forma text not null default 'rectangulo';

alter table recursos add constraint recursos_forma_valida check (
  forma in ('rectangulo', 'redonda', 'barra')
);

create index on recursos (empresa_id, piso, sector);

comment on column recursos.x is 'Posición en la grilla del plano, no en píxeles: el plano tiene que verse igual en un celular y en un monitor grande.';

/* Los elementos que no se ocupan pero ubican: la barra, la cocina, la
   entrada, una pared. No son recursos que se vendan, son referencias
   para que el mozo reconozca su local. */
create table plano_elementos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  piso        text not null default 'Planta baja',
  sector      text,
  tipo        text not null,
  etiqueta    text,
  x           integer not null default 0,
  y           integer not null default 0,
  ancho       integer not null default 2,
  alto        integer not null default 2,

  constraint plano_elementos_tipo_valido check (
    tipo in ('pared', 'barra', 'cocina', 'entrada', 'bano', 'planta', 'texto')
  )
);

create index on plano_elementos (empresa_id, piso, sector);

alter table plano_elementos enable row level security;

create policy plano_elementos_todo on plano_elementos
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ------------------------------------------------------------
   De dónde vino el pedido

   Va en la operación y no en una tabla aparte porque no es otra cosa:
   una hamburguesa que sale por PedidosYa consume el mismo stock, deja el
   mismo margen y entra a la misma caja que una que se come en la mesa 4.
   Lo único distinto es el canal.
   ------------------------------------------------------------ */

alter table operaciones add column canal text not null default 'salon';
alter table operaciones add column referencia text;

alter table operaciones add constraint operaciones_canal_valido check (
  canal in ('salon', 'mostrador', 'takeaway', 'delivery', 'app')
);

/* El número que le puso la aplicación al pedido. Es por donde lo busca
   quien atiende cuando el repartidor llega y pregunta por el #5893. */
comment on column operaciones.referencia is 'Identificador del pedido en el canal externo. No lo genera Genez.';

create index on operaciones (empresa_id, canal, estado);
create index on operaciones (empresa_id, referencia) where referencia is not null;

/* Un pedido de mostrador o de aplicación no ocupa mesa, así que
   abrir_comanda tiene que poder crearlo sin recurso. */
create or replace function abrir_comanda(datos jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id      uuid := coalesce(nullif(datos->>'id', '')::uuid, gen_random_uuid());
  v_empresa uuid := (datos->>'empresa_id')::uuid;
  v_recurso uuid := nullif(datos->>'recurso_id', '')::uuid;
  v_canal   text := coalesce(nullif(datos->>'canal', ''), case when nullif(datos->>'recurso_id', '') is null then 'mostrador' else 'salon' end);
  v_abierta uuid;
begin
  if v_empresa is null then
    raise exception 'La comanda necesita empresa_id.';
  end if;

  /* Si la mesa ya tiene una comanda abierta se devuelve esa. Tocar dos
     veces la misma mesa es lo más normal del mundo y no puede terminar
     en dos cuentas paralelas.

     Con los pedidos sin mesa pasa al revés: dos personas distintas en el
     mostrador son dos pedidos, aunque lleguen con un segundo de
     diferencia. Por eso solo se reutiliza cuando hay recurso. */
  if v_recurso is not null then
    select id into v_abierta from operaciones
    where recurso_id = v_recurso and estado = 'abierta' and empresa_id = v_empresa;
    if v_abierta is not null then return v_abierta; end if;
  end if;

  insert into operaciones (
    id, empresa_id, sucursal_id, tipo, estado, fecha, recurso_id,
    canal, referencia, abierta_en, usuario_id, cliente_id, campos_extra
  ) values (
    v_id, v_empresa,
    nullif(datos->>'sucursal_id', '')::uuid,
    'comanda', 'abierta', now(), v_recurso,
    v_canal,
    nullif(datos->>'referencia', ''),
    now(), auth.uid(),
    nullif(datos->>'cliente_id', '')::uuid,
    coalesce(datos->'campos_extra', '{}'::jsonb)
  )
  on conflict (id) do nothing;

  return v_id;
end;
$$;

/* ------------------------------------------------------------
   La vista del salón, ahora con el plano
   ------------------------------------------------------------ */

drop view salon_vista;

create view salon_vista
with (security_invoker = true) as
select
  r.id, r.empresa_id, r.sucursal_id, r.tipo, r.nombre,
  r.piso, r.sector, r.capacidad, r.orden, r.activo,
  r.x, r.y, r.ancho, r.alto, r.forma,

  o.id         as comanda_id,
  o.abierta_en,
  o.usuario_id as abierta_por,

  coalesce(l.consumido, 0) as consumido,
  coalesce(l.items, 0)     as items,
  coalesce(l.en_cocina, 0) as en_cocina,
  coalesce(l.listos, 0)    as listos,

  case when o.abierta_en is null then null
       else floor(extract(epoch from (now() - o.abierta_en)) / 60)::int
  end as minutos

from recursos r

left join operaciones o
  on o.recurso_id = r.id and o.estado = 'abierta' and o.tipo = 'comanda'

left join (
  select
    operacion_id,
    sum(total)                                                 as consumido,
    sum(cantidad)                                              as items,
    count(*) filter (where estado in ('pedido', 'preparando')) as en_cocina,
    count(*) filter (where estado = 'listo')                   as listos
  from operacion_lineas
  where estado <> 'anulada'
  group by operacion_id
) l on l.operacion_id = o.id;

comment on view salon_vista is
  'Cada mesa con su lugar en el plano, su comanda abierta y lo que espera en cocina.';

/* ------------------------------------------------------------
   Acomodar lo que ya estaba

   Las mesas del bar se cargaron antes de que existiera el plano, así que
   están todas en la posición cero. Se las reparte en una grilla para que
   el plano tenga algo que mostrar mientras nadie lo edita.
   ------------------------------------------------------------ */

update recursos r
   set x = 1 + ((sub.fila - 1) % 4) * 3,
       y = 1 + ((sub.fila - 1) / 4) * 3,
       forma = case when r.tipo = 'mesa' and r.capacidad = 2 then 'redonda' else r.forma end
from (
  select id, row_number() over (partition by empresa_id, sector order by orden) as fila
  from recursos
) sub
where sub.id = r.id and r.x = 0 and r.y = 0;
