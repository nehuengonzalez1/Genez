/* ============================================================
   0024 · RESERVAS Y EL ESTADO REAL DE LA MESA
   ============================================================

   El plano ya dibujaba cinco estados, pero dos eran de mentira: la mesa
   reservada y la que pagó y todavía no se levantó estaban apagadas
   porque el dato no existía en ningún lado. Los otros tres —libre,
   ocupada, por entregar— salían de la comanda y sus líneas.

   Acá se completan los cinco, y el estado se calcula en la vista y no en
   la pantalla: el mapa, la lista de mesas y el recuento de abajo tienen
   que decir lo mismo, y si cada uno lo deduce por su cuenta, un día
   dejan de coincidir.

   La reserva es una tabla nueva porque no es una operación: no vende
   nada, no tiene líneas y puede no ocurrir nunca. Lo que sí hace es
   apuntar a la mesa, y cuando la gente llega, a la comanda que se abrió:
   ahí deja de ser una promesa y pasa a ser un consumo.
   ============================================================ */

create table reservas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  sucursal_id  uuid references sucursales(id) on delete set null,
  recurso_id   uuid references recursos(id) on delete set null,
  cliente_id   uuid references clientes(id) on delete set null,

  nombre       text not null,
  telefono     text,
  personas     integer not null default 2,
  desde        timestamptz not null,
  duracion_min integer not null default 90,

  estado       text not null default 'pendiente',
  notas        text,

  /* La comanda que se abrió cuando llegaron. Es lo que ata la promesa
     con lo que efectivamente consumieron. */
  operacion_id uuid references operaciones(id) on delete set null,

  usuario_id   uuid references perfiles(id) on delete set null,
  creada_en    timestamptz not null default now(),

  constraint reservas_estado_valido check (
    estado in ('pendiente', 'sentada', 'cumplida', 'cancelada', 'ausente')
  ),
  constraint reservas_personas_valido check (personas > 0)
);

create index on reservas (empresa_id, desde);
create index on reservas (recurso_id, desde) where recurso_id is not null;
create index on reservas (empresa_id, estado, desde);

alter table reservas enable row level security;

create policy reservas_todo on reservas
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

comment on table reservas is
  'Una mesa comprometida para más tarde. No es una operación: no vende nada y puede no ocurrir.';
comment on column reservas.duracion_min is
  'Cuánto se le guarda la mesa. Pasado ese rato la reserva deja de pintar la mesa y queda para marcar como ausente.';

/* Quién reservó, quién la sentó y quién la dio de baja. Una mesa que se
   guardó toda la noche para alguien que no vino es plata, y la pregunta
   siempre es quién la tomó. */
create or replace function anotar_reserva()
returns trigger
language plpgsql
as $$
declare
  v_accion text;
begin
  if tg_op = 'INSERT' then
    v_accion := 'reserva.crear';
  elsif new.estado is distinct from old.estado then
    v_accion := 'reserva.' || new.estado;
  else
    return new;
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
    values (new.empresa_id, auth.uid(), v_accion, 'reservas', new.id,
            jsonb_build_object('nombre', new.nombre, 'personas', new.personas,
                               'desde', new.desde, 'mesa', new.recurso_id));
  return new;
end;
$$;

create trigger reservas_bitacora
  after insert or update on reservas
  for each row execute function anotar_reserva();

/* Juntar y separar mesas también deja asiento: es una decisión del
   servicio que cambia dónde se sienta la gente y a qué cuenta va lo que
   piden. */
create or replace function anotar_union()
returns trigger
language plpgsql
as $$
begin
  if new.unida_a is not distinct from old.unida_a then return new; end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
    values (new.empresa_id, auth.uid(),
            case when new.unida_a is null then 'mesa.separar' else 'mesa.unir' end,
            'recursos', new.id,
            jsonb_build_object('mesa', new.nombre, 'unida_a', new.unida_a));
  return new;
end;
$$;

create trigger recursos_union_bitacora
  after update of unida_a on recursos
  for each row execute function anotar_union();

/* ------------------------------------------------------------
   El salón, con el estado ya resuelto

   Cinco estados y un orden entre ellos, porque una mesa puede cumplir
   dos condiciones a la vez y hay que elegir cuál se muestra:

   1. cuenta   · pagó y sigue sentada. Es lo único que pide una acción
                 distinta —levantar la mesa— así que gana a todo.
   2. entregar · tiene algo listo esperando en la cocina. Gana a
                 "ocupada" porque es lo que hay que hacer ahora.
   3. ocupada  · tiene una comanda abierta.
   4. reservada· sin comanda, pero comprometida para dentro de un rato.
   5. libre    · lo que queda.
   ------------------------------------------------------------ */

drop view salon_vista;

create view salon_vista
with (security_invoker = true) as
select
  r.id, r.empresa_id, r.sucursal_id, r.tipo, r.nombre,
  r.piso, r.sector, r.capacidad, r.orden, r.activo,
  r.x, r.y, r.ancho, r.alto, r.forma, r.unida_a,

  coalesce(u.unidas, 0) as unidas,
  r.capacidad + coalesce(u.capacidad_extra, 0) as capacidad_total,

  o.id          as comanda_id,
  o.abierta_en,
  o.usuario_id  as abierta_por,
  pf.nombre     as mozo,
  o.comensales,
  o.descuento,
  o.descuento_pct,

  coalesce(l.consumido, 0)  as consumido,
  coalesce(l.items, 0)      as items,
  coalesce(l.sin_enviar, 0) as sin_enviar,
  coalesce(l.en_cocina, 0)  as en_cocina,
  coalesce(l.listos, 0)     as listos,

  coalesce(pg.pagado, 0) as pagado,

  res.id       as reserva_id,
  res.nombre   as reserva_nombre,
  res.personas as reserva_personas,
  res.desde    as reserva_desde,

  case when o.abierta_en is null then null
       else floor(extract(epoch from (now() - o.abierta_en)) / 60)::int
  end as minutos,

  case
    when o.id is not null and coalesce(pg.pagado, 0) > 0
         and coalesce(pg.pagado, 0) >= coalesce(l.consumido, 0) - coalesce(o.descuento, 0)
      then 'cuenta'
    when coalesce(l.listos, 0) > 0 then 'entregar'
    when o.id is not null then 'ocupada'
    when res.id is not null then 'reservada'
    else 'libre'
  end as estado

from recursos r

left join (
  select unida_a, count(*) as unidas, sum(capacidad) as capacidad_extra
  from recursos where unida_a is not null group by unida_a
) u on u.unida_a = r.id

left join operaciones o
  on o.recurso_id = r.id and o.estado = 'abierta' and o.tipo = 'comanda'

left join perfiles pf on pf.id = o.usuario_id

left join (
  select
    operacion_id,
    sum(total)                                                 as consumido,
    sum(cantidad)                                              as items,
    count(*) filter (where estado = 'borrador')                as sin_enviar,
    count(*) filter (where estado in ('pedido', 'preparando')) as en_cocina,
    count(*) filter (where estado = 'listo')                   as listos
  from operacion_lineas
  where estado <> 'anulada'
  group by operacion_id
) l on l.operacion_id = o.id

left join (
  select operacion_id, sum(monto) as pagado from pagos group by operacion_id
) pg on pg.operacion_id = o.id

/* La reserva que está por caer: la más próxima que todavía no venció.
   Media hora antes ya pinta la mesa, porque a esa altura no conviene
   sentar a nadie más. */
left join lateral (
  select re.id, re.nombre, re.personas, re.desde
  from reservas re
  where re.recurso_id = r.id
    and re.estado = 'pendiente'
    and now() >= re.desde - interval '30 minutes'
    and now() <  re.desde + make_interval(mins => re.duracion_min)
  order by re.desde
  limit 1
) res on true;

comment on view salon_vista is
  'Cada mesa con su lugar en el plano, su comanda, su reserva y su estado ya resuelto. El estado sale de acá y no de la pantalla: el mapa, la lista y el recuento tienen que decir lo mismo.';

/* ------------------------------------------------------------
   Sentar una reserva

   Abrir la mesa y marcar la reserva de una sola vez. Separado, es una de
   esas cosas que quedan a medias: la mesa abierta y la reserva
   figurando pendiente toda la noche.
   ------------------------------------------------------------ */

create or replace function sentar_reserva(p_reserva uuid)
returns uuid
language plpgsql
as $$
declare
  v_res reservas%rowtype;
  v_comanda uuid;
begin
  select * into v_res from reservas where id = p_reserva for update;

  if v_res.id is null then
    raise exception 'No existe esa reserva.' using errcode = 'P0010';
  end if;
  if v_res.estado <> 'pendiente' then
    raise exception 'Esa reserva ya no está pendiente.' using errcode = 'P0015';
  end if;
  if v_res.recurso_id is null then
    raise exception 'Esa reserva no tiene mesa asignada.' using errcode = 'P0016';
  end if;

  v_comanda := abrir_comanda(jsonb_build_object(
    'empresa_id',  v_res.empresa_id,
    'sucursal_id', v_res.sucursal_id,
    'recurso_id',  v_res.recurso_id,
    'cliente_id',  v_res.cliente_id
  ));

  update operaciones
     set comensales = coalesce(comensales, v_res.personas)
   where id = v_comanda;

  update reservas
     set estado = 'sentada', operacion_id = v_comanda
   where id = p_reserva;

  return v_comanda;
end;
$$;

comment on function sentar_reserva is
  'Abre la mesa de la reserva y la marca sentada en el mismo acto. Devuelve la comanda.';

/* ------------------------------------------------------------
   Tiempo real
   ------------------------------------------------------------ */

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservas'
  ) then
    alter publication supabase_realtime add table public.reservas;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recursos'
  ) then
    alter publication supabase_realtime add table public.recursos;
  end if;
end;
$$;
