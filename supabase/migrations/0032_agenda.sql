/* ============================================================
   0032 · LA AGENDA
   ============================================================

   Una reserva de mesa y un turno de pilates son la misma cosa: alguien
   compromete un recurso durante un rato. Por eso esto extiende `reservas`
   en vez de crear una tabla `turnos` al lado. Duplicarla habría hecho que
   el salón y la agenda se separen y que después haya que arreglar cada
   bug dos veces.

   Lo que le falta a `reservas` para servir de agenda es saber **quién
   atiende** y **qué servicio es**. En un restaurante ninguna de las dos
   existe hasta que la gente se sienta; en una estética son la reserva.

   CUIDADO CON EL ESTADO NUEVO
   ---------------------------
   Agregar `confirmada` toca gastronomía en dos lugares que filtran por
   `pendiente` a secas. Los dos se corrigen acá:

     · `salon_vista` dejaba de pintar la mesa de una reserva confirmada.
     · `sentar_reserva` no dejaba sentar a alguien que había confirmado.

   Las dos tablas estaban vacías al aplicar esto, así que no hubo datos en
   riesgo. La corrección va igual, porque el problema no era el dato: era
   que el modelo quedaba incoherente entre los dos rubros.
   ============================================================ */

/* ------------------------------------------------------------
   1 · Quién atiende y qué se hace
   ------------------------------------------------------------ */

alter table reservas add column personal_id uuid references personal(id) on delete set null;
alter table reservas add column item_id     uuid references items(id)    on delete set null;

create index on reservas (personal_id, desde) where personal_id is not null;
create index on reservas (item_id) where item_id is not null;

comment on column reservas.personal_id is 'Quién atiende. Null en gastronomía: a una mesa no la atiende alguien en particular.';
comment on column reservas.item_id     is 'Qué servicio es. Null en gastronomía: lo que se consume se carga después, en la comanda.';

/* ------------------------------------------------------------
   2 · El estado nuevo

   `pendiente` es "lo pedimos"; `confirmada` es "el cliente dijo que
   viene". La diferencia importa para saber a quién hay que recordarle.
   ------------------------------------------------------------ */

alter table reservas drop constraint reservas_estado_valido;

alter table reservas add constraint reservas_estado_valido check (
  estado in ('pendiente', 'confirmada', 'sentada', 'cumplida', 'cancelada', 'ausente')
);

/* ------------------------------------------------------------
   3 · Bloqueos por hora

   `excepciones` guardaba fechas enteras, así que servía para unas
   vacaciones y no para "el martes de 14 a 16 no atiendo". Con timestamp
   entran las dos cosas y no hace falta una segunda tabla.

   La tabla está vacía; el cambio de tipo no pierde nada.
   ------------------------------------------------------------ */

alter table excepciones alter column desde type timestamptz using desde::timestamptz;
alter table excepciones alter column hasta type timestamptz using hasta::timestamptz;

comment on column excepciones.desde is 'Con horas: sirve igual para unas vacaciones que para bloquear dos horas de un martes.';

/* ------------------------------------------------------------
   4 · El salón, con el estado nuevo contemplado

   Se rehace la vista entera porque hay que cambiar una línea del lateral
   de abajo, y una vista no se parchea. Es idéntica a la de 0024 salvo esa
   condición.
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
   sentar a nadie más.

   ACÁ ESTÁ EL CAMBIO: antes decía `estado = 'pendiente'` y con eso una
   reserva confirmada dejaba la mesa figurando libre. */
left join lateral (
  select re.id, re.nombre, re.personas, re.desde
  from reservas re
  where re.recurso_id = r.id
    and re.estado in ('pendiente', 'confirmada')
    and now() >= re.desde - interval '30 minutes'
    and now() <  re.desde + make_interval(mins => re.duracion_min)
  order by re.desde
  limit 1
) res on true;

comment on view salon_vista is
  'Cada mesa con su lugar en el plano, su comanda, su reserva y su estado ya resuelto. El estado sale de acá y no de la pantalla: el mapa, la lista y el recuento tienen que decir lo mismo.';

/* ------------------------------------------------------------
   5 · Sentar una reserva confirmada

   Mismo cambio: antes exigía `pendiente` exacto.
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
  if v_res.estado not in ('pendiente', 'confirmada') then
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

/* ------------------------------------------------------------
   6 · Los choques

   La validación vive en la base y no en la pantalla. La pantalla puede
   anticipar el conflicto para avisar antes, pero dos personas agendando
   al mismo tiempo desde dos dispositivos solo se resuelven acá.

   La zona horaria sale de la configuración del comercio. Un horario
   —"martes de 8 a 13"— es hora de pared, y `desde` es un instante
   absoluto: sin convertir, un turno de las 9 de Buenos Aires se compara
   contra las 12 UTC y queda siempre fuera de horario.
   ------------------------------------------------------------ */

create or replace function zona_de(p_empresa uuid)
returns text
language sql stable
as $$
  select coalesce(nullif(config ->> 'zona', ''), 'America/Argentina/Buenos_Aires')
  from empresas where id = p_empresa;
$$;

comment on function zona_de is 'Zona horaria del comercio. Sin ella, comparar un turno contra un horario semanal da cualquier cosa.';

create or replace function revisar_turno(
  p_id       uuid,
  p_empresa  uuid,
  p_desde    timestamptz,
  p_duracion integer,
  p_personal uuid,
  p_recurso  uuid
)
returns void
language plpgsql
as $$
declare
  v_hasta timestamptz := p_desde + make_interval(mins => p_duracion);
  v_zona  text := zona_de(p_empresa);
  v_local timestamp := p_desde at time zone v_zona;
  v_localh timestamp := v_hasta at time zone v_zona;
begin
  if p_duracion <= 0 then
    raise exception 'El turno tiene que durar algo.' using errcode = 'P0030';
  end if;

  /* Un turno que cruza la medianoche no se puede comparar contra un
     horario semanal, que es de un solo día. No es un caso real en un
     negocio de turnos, pero si llega hay que decirlo y no calcular mal. */
  if v_local::date <> v_localh::date then
    raise exception 'Un turno no puede cruzar la medianoche.' using errcode = 'P0031';
  end if;

  /* Que la sala y la persona sean de este comercio. Sin esto, alguien con
     el id de una sala ajena podría agendar adentro de otro negocio. */
  if p_recurso is not null and not exists (
    select 1 from recursos where id = p_recurso and empresa_id = p_empresa
  ) then
    raise exception 'Esa sala no es de este comercio.' using errcode = 'P0032';
  end if;

  if p_personal is not null and not exists (
    select 1 from personal where id = p_personal and empresa_id = p_empresa
  ) then
    raise exception 'Esa persona no es de este comercio.' using errcode = 'P0033';
  end if;

  /* Choque de sala. Una cancelada o una ausencia liberan el lugar. */
  if p_recurso is not null and exists (
    select 1 from reservas r
    where r.recurso_id = p_recurso
      and (p_id is null or r.id <> p_id)
      and r.estado not in ('cancelada', 'ausente')
      and r.desde < v_hasta
      and r.desde + make_interval(mins => r.duracion_min) > p_desde
  ) then
    raise exception 'Esa sala ya está ocupada en ese horario.' using errcode = 'P0034';
  end if;

  /* Choque de persona. */
  if p_personal is not null and exists (
    select 1 from reservas r
    where r.personal_id = p_personal
      and (p_id is null or r.id <> p_id)
      and r.estado not in ('cancelada', 'ausente')
      and r.desde < v_hasta
      and r.desde + make_interval(mins => r.duracion_min) > p_desde
  ) then
    raise exception 'Esa persona ya tiene un turno en ese horario.' using errcode = 'P0035';
  end if;

  /* Fuera del horario de trabajo. Solo se controla si la persona tiene
     horarios cargados: si no tiene ninguno, todavía nadie los cargó y
     frenar el turno por eso sería castigar al que está trabajando. */
  if p_personal is not null
     and exists (select 1 from horarios where personal_id = p_personal and activo)
     and not exists (
       select 1 from horarios h
       where h.personal_id = p_personal and h.activo
         and h.dia = extract(dow from v_local)::int
         and h.desde <= v_local::time
         and h.hasta >= v_localh::time
     ) then
    raise exception 'Esa persona no trabaja en ese horario.' using errcode = 'P0036';
  end if;

  /* Ausencias, vacaciones y bloqueos. Con personal_id en null el bloqueo
     es de todo el comercio: un feriado. */
  if exists (
    select 1 from excepciones e
    where e.empresa_id = p_empresa
      and (e.personal_id is null or e.personal_id = p_personal)
      and e.desde < v_hasta and e.hasta > p_desde
  ) then
    raise exception 'Hay un bloqueo o una ausencia en ese horario.' using errcode = 'P0037';
  end if;
end;
$$;

comment on function revisar_turno is 'Todo lo que puede impedir un turno, en un solo lugar. Lo usan el alta y la reprogramación.';

/* ------------------------------------------------------------
   7 · Agendar y reprogramar

   Van como funciones y no como inserts sueltos por la regla 5: validar en
   el navegador y escribir después deja la ventana en la que otro agendó
   lo mismo entre las dos cosas.
   ------------------------------------------------------------ */

create or replace function agendar_turno(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_emp      uuid := (p ->> 'empresa_id')::uuid;
  v_desde    timestamptz := (p ->> 'desde')::timestamptz;
  v_duracion integer := coalesce((p ->> 'duracion_min')::integer, 60);
  v_personal uuid := nullif(p ->> 'personal_id', '')::uuid;
  v_recurso  uuid := nullif(p ->> 'recurso_id', '')::uuid;
  v_id       uuid;
begin
  if not public.puede_ver(v_emp) then
    raise exception 'No podés agendar en ese comercio.' using errcode = 'P0038';
  end if;

  perform revisar_turno(null, v_emp, v_desde, v_duracion, v_personal, v_recurso);

  insert into reservas (
    empresa_id, sucursal_id, recurso_id, cliente_id, personal_id, item_id,
    nombre, telefono, personas, desde, duracion_min, estado, notas, usuario_id
  ) values (
    v_emp,
    nullif(p ->> 'sucursal_id', '')::uuid,
    v_recurso,
    nullif(p ->> 'cliente_id', '')::uuid,
    v_personal,
    nullif(p ->> 'item_id', '')::uuid,
    coalesce(nullif(p ->> 'nombre', ''), 'Sin nombre'),
    nullif(p ->> 'telefono', ''),
    coalesce((p ->> 'personas')::integer, 1),
    v_desde,
    v_duracion,
    coalesce(nullif(p ->> 'estado', ''), 'pendiente'),
    nullif(p ->> 'notas', ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function agendar_turno is 'Crea un turno validando choques de sala, de persona y de horario en la misma transacción.';

create or replace function mover_turno(p_id uuid, p_desde timestamptz, p_duracion integer default null)
returns void
language plpgsql
as $$
declare
  v_res reservas%rowtype;
  v_dur integer;
begin
  select * into v_res from reservas where id = p_id for update;
  if v_res.id is null then
    raise exception 'No existe ese turno.' using errcode = 'P0010';
  end if;
  if v_res.estado in ('cumplida', 'cancelada') then
    raise exception 'Un turno cumplido o cancelado no se reprograma.' using errcode = 'P0039';
  end if;

  v_dur := coalesce(p_duracion, v_res.duracion_min);
  perform revisar_turno(p_id, v_res.empresa_id, p_desde, v_dur, v_res.personal_id, v_res.recurso_id);

  update reservas set desde = p_desde, duracion_min = v_dur where id = p_id;
end;
$$;

comment on function mover_turno is 'Reprograma un turno con las mismas validaciones que el alta, ignorándose a sí mismo.';

/* ------------------------------------------------------------
   8 · La agenda, con los nombres ya resueltos

   `security_invoker` no es opcional: sin eso la vista corre con los
   permisos de quien la creó y saltea RLS. Ya nos pasó con `equipo_vista`.
   ------------------------------------------------------------ */

create or replace view agenda_vista
with (security_invoker = true) as
select
  r.id, r.empresa_id, r.sucursal_id, r.recurso_id, r.cliente_id,
  r.personal_id, r.item_id,
  r.nombre, r.telefono, r.personas, r.desde, r.duracion_min,
  r.desde + make_interval(mins => r.duracion_min) as hasta,
  r.estado, r.notas, r.operacion_id, r.creada_en,

  c.razon_social as cliente,
  p.nombre       as profesional,
  p.especialidad,
  i.nombre       as servicio,
  i.categoria    as area,
  i.precio,
  re.nombre      as sala,
  re.tipo        as sala_tipo,

  /* Lo cobrado del turno, si se cobró. Sale de los pagos de la operación
     y no de una columna: un saldo guardado se desincroniza. */
  coalesce(pg.pagado, 0) as pagado
from reservas r
left join clientes  c  on c.id  = r.cliente_id
left join personal  p  on p.id  = r.personal_id
left join items     i  on i.id  = r.item_id
left join recursos  re on re.id = r.recurso_id
left join (
  select operacion_id, sum(monto) as pagado from pagos group by operacion_id
) pg on pg.operacion_id = r.operacion_id;

comment on view agenda_vista is 'Un turno con su cliente, su profesional, su servicio y su sala ya resueltos, para no pedir cinco consultas por pantalla.';
