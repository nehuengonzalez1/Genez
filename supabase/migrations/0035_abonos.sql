/* ============================================================
   0035 · ABONOS, PACKS Y CUOTAS
   ============================================================

   Un estudio de pilates cobra ocho clases en marzo y las consume hasta
   mayo. Sin esto la caja no puede reflejar la realidad del negocio: un
   martes sin cobrar un peso puede ser el mejor martes del mes.

   LOS PLANES SON ITEMS
   --------------------
   "Pack 8 clases" y "Plan 2 por semana" son items del catálogo, con
   `tipo = 'plan'`. Así se venden por el mismo camino que todo lo demás
   —`registrar_venta`, que ya escribe la operación, las líneas, los pagos
   y el movimiento de caja— y entran en los informes sin nada nuevo.

   EL CRÉDITO NO SE GUARDA, SE DERIVA
   ----------------------------------
   `usadas` no es una columna. Se cuenta desde los turnos que apuntan al
   abono, igual que el stock se deriva de sus movimientos (regla 1). Un
   contador guardado se desincroniza el día que alguien cancela un turno
   por SQL, y nadie se entera hasta que un cliente reclama.

   EL CONSUMO ES AL RESERVAR, NO AL ASISTIR
   ----------------------------------------
   Es lo que hace que "dos por semana" se pueda hacer cumplir: si el
   crédito se descontara recién al venir, el tope no se puede controlar en
   el momento en que importa, que es cuando la persona pide el turno.

   Una cancelación devuelve la clase. Una ausencia la devuelve o no según
   lo decida cada comercio: hay negocios donde faltar es perderla y otros
   donde se recupera.
   ============================================================ */

/* ------------------------------------------------------------
   1 · El catálogo admite planes
   ------------------------------------------------------------ */

alter table items drop constraint items_tipo_valido;

alter table items add constraint items_tipo_valido check (
  tipo in ('producto', 'servicio', 'insumo', 'combo', 'plan')
);

comment on column items.tipo is
  'Un corte de pelo, una Coca y un pack de 8 clases son la misma entidad: cambia si lleva stock, si tiene duración y si da crédito.';

/* ------------------------------------------------------------
   2 · Los abonos

   `clases` en null es un plan libre: se paga el mes y se viene cuando se
   quiere. El tope semanal es lo que lo hace distinto de un pack.
   ------------------------------------------------------------ */

create table abonos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  cliente_id   uuid not null references clientes(id) on delete cascade,
  item_id      uuid references items(id) on delete set null,
  operacion_id uuid references operaciones(id) on delete set null,

  nombre       text not null,
  clases       integer,
  tope_semanal integer,

  desde        date not null default current_date,
  vence        date,

  anulado      boolean not null default false,
  notas        text,
  creado_en    timestamptz not null default now(),
  usuario_id   uuid references perfiles(id) on delete set null,

  constraint abonos_clases_valido check (clases is null or clases > 0),
  constraint abonos_tope_valido   check (tope_semanal is null or tope_semanal > 0),
  constraint abonos_vigencia      check (vence is null or vence >= desde)
);

create index on abonos (empresa_id, cliente_id) where not anulado;
create index on abonos (empresa_id, vence);

comment on column abonos.clases       is 'Cuántas clases da. Null es libre: se controla con el tope semanal y la vigencia.';
comment on column abonos.tope_semanal is 'Cuántas veces por semana se puede reservar. Null es sin tope.';
comment on column abonos.anulado      is 'No se borra: puede tener turnos tomados atrás y borrarlo los dejaría sin crédito de dónde salieron.';

/* El turno sabe contra qué abono se tomó. Null es un turno suelto, que se
   paga aparte. */
alter table reservas add column abono_id uuid references abonos(id) on delete set null;
create index on reservas (abono_id) where abono_id is not null;

alter table abonos enable row level security;

create policy abonos_todo on abonos
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ------------------------------------------------------------
   3 · La política de ausencias

   Cada comercio decide si faltar cuesta la clase. Va en la configuración
   del comercio y no en el código: hay estudios que la perdonan y
   gimnasios que no.
   ------------------------------------------------------------ */

create or replace function ausencia_consume(p_empresa uuid)
returns boolean
language sql stable
as $$
  select coalesce((config -> 'turnos' ->> 'ausenciaConsume')::boolean, true)
  from empresas where id = p_empresa;
$$;

comment on function ausencia_consume is 'Si faltar a un turno gasta la clase del abono. Por defecto sí; se cambia por comercio.';

/* ------------------------------------------------------------
   4 · El abono, con su saldo ya contado

   Lo que gasta el crédito son los turnos que apuntan al abono. Una
   cancelación siempre lo devuelve; una ausencia, según el comercio.
   ------------------------------------------------------------ */

create or replace view abonos_vista
with (security_invoker = true) as
select
  a.*,
  c.razon_social as cliente,
  i.categoria    as area,
  coalesce(u.usadas, 0) as usadas,
  case when a.clases is null then null else a.clases - coalesce(u.usadas, 0) end as restantes,
  (a.vence is not null and a.vence < current_date) as vencido,
  case
    when a.anulado then 'anulado'
    when a.vence is not null and a.vence < current_date then 'vencido'
    when a.clases is not null and coalesce(u.usadas, 0) >= a.clases then 'consumido'
    else 'activo'
  end as estado
from abonos a
left join clientes c on c.id = a.cliente_id
left join items    i on i.id = a.item_id
left join lateral (
  select count(*) as usadas
  from reservas r
  where r.abono_id = a.id
    and r.estado <> 'cancelada'
    and (r.estado <> 'ausente' or ausencia_consume(a.empresa_id))
) u on true;

comment on view abonos_vista is
  'El abono con su saldo contado desde los turnos que lo usaron. No hay columna `usadas`: un contador guardado se desincroniza y nadie se entera hasta que un cliente reclama.';

/* ------------------------------------------------------------
   5 · Vender un abono

   Se apoya en `registrar_venta`, que ya escribe la operación, la línea,
   los pagos, el movimiento de caja y es idempotente. Acá arriba solo se
   crea el crédito.
   ------------------------------------------------------------ */

create or replace function vender_abono(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_emp     uuid := (p ->> 'empresa_id')::uuid;
  v_cliente uuid := (p ->> 'cliente_id')::uuid;
  v_item    uuid := nullif(p ->> 'item_id', '')::uuid;
  v_op      uuid := coalesce(nullif(p ->> 'operacion_id', '')::uuid, gen_random_uuid());
  v_precio  numeric := coalesce((p ->> 'precio')::numeric, 0);
  v_nombre  text;
  v_clases  integer;
  v_tope    integer;
  v_dias    integer;
  v_extra   jsonb;
  v_id      uuid;
begin
  if not public.puede_ver(v_emp) then
    raise exception 'No podés vender en ese comercio.' using errcode = 'P0038';
  end if;
  if v_cliente is null then
    raise exception 'Un abono necesita un cliente: es de alguien.' using errcode = 'P0050';
  end if;
  if not exists (select 1 from clientes where id = v_cliente and empresa_id = v_emp) then
    raise exception 'Ese cliente no es de este comercio.' using errcode = 'P0051';
  end if;

  /* Los términos salen del plan del catálogo, no de lo que mande la
     pantalla: si el comercio cambia el pack de 8 a 10, los que se venden
     de ahí en adelante salen con 10 sin tocar nada. */
  if v_item is not null then
    select nombre, precio, campos_extra into v_nombre, v_precio, v_extra
      from items where id = v_item and empresa_id = v_emp and tipo = 'plan';
    if v_nombre is null then
      raise exception 'Ese plan no existe en el catálogo.' using errcode = 'P0052';
    end if;
    v_clases := nullif(v_extra ->> 'clases', '')::integer;
    v_tope   := nullif(v_extra ->> 'topeSemanal', '')::integer;
    v_dias   := nullif(v_extra ->> 'vigenciaDias', '')::integer;
    v_precio := coalesce((p ->> 'precio')::numeric, v_precio);
  else
    v_nombre := coalesce(nullif(p ->> 'nombre', ''), 'Abono');
    v_clases := nullif(p ->> 'clases', '')::integer;
    v_tope   := nullif(p ->> 'tope_semanal', '')::integer;
    v_dias   := nullif(p ->> 'vigencia_dias', '')::integer;
  end if;

  /* La venta, por el camino de siempre. */
  perform registrar_venta(jsonb_build_object(
    'id',          v_op,
    'empresa_id',  v_emp,
    'sucursal_id', p ->> 'sucursal_id',
    'sesion_id',   p ->> 'sesion_id',
    'numero',      p ->> 'numero',
    'cliente_id',  v_cliente,
    'subtotal',    v_precio,
    'total',       v_precio,
    'lineas', jsonb_build_array(jsonb_build_object(
      'item_id',         v_item,
      'descripcion',     v_nombre,
      'cantidad',        1,
      'precio_unitario', v_precio,
      'total',           v_precio
    )),
    'pagos', coalesce(p -> 'pagos', '[]'::jsonb)
  ));

  insert into abonos (
    empresa_id, cliente_id, item_id, operacion_id, nombre,
    clases, tope_semanal, desde, vence, notas, usuario_id
  ) values (
    v_emp, v_cliente, v_item, v_op, v_nombre,
    v_clases, v_tope,
    coalesce((p ->> 'desde')::date, current_date),
    case when v_dias is null then nullif(p ->> 'vence', '')::date
         else coalesce((p ->> 'desde')::date, current_date) + v_dias
    end,
    nullif(p ->> 'notas', ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function vender_abono is 'Cobra el plan por el camino de siempre y crea el crédito, en una sola transacción.';

/* ------------------------------------------------------------
   6 · Usar el abono al reservar

   Acá se controla el tope semanal, que es el momento en que importa: si
   se controlara al cobrar, "dos por semana" no se puede hacer cumplir.
   ------------------------------------------------------------ */

create or replace function revisar_abono(p_abono uuid, p_cliente uuid, p_desde timestamptz, p_id uuid default null)
returns void
language plpgsql
as $$
declare
  v_a    abonos%rowtype;
  v_v    record;
  v_zona text;
  v_sem  integer;
begin
  select * into v_a from abonos where id = p_abono;
  if v_a.id is null then
    raise exception 'No existe ese abono.' using errcode = 'P0053';
  end if;
  if v_a.anulado then
    raise exception 'Ese abono está anulado.' using errcode = 'P0054';
  end if;
  if p_cliente is null or v_a.cliente_id <> p_cliente then
    raise exception 'Ese abono es de otra persona.' using errcode = 'P0055';
  end if;

  v_zona := zona_de(v_a.empresa_id);

  if v_a.vence is not null and (p_desde at time zone v_zona)::date > v_a.vence then
    raise exception 'Ese abono vence el %.', to_char(v_a.vence, 'DD/MM') using errcode = 'P0056';
  end if;
  if (p_desde at time zone v_zona)::date < v_a.desde then
    raise exception 'Ese abono arranca el %.', to_char(v_a.desde, 'DD/MM') using errcode = 'P0057';
  end if;

  select restantes into v_v from abonos_vista where id = p_abono;
  if v_a.clases is not null and coalesce(v_v.restantes, 0) <= 0 then
    raise exception 'Ese abono ya no tiene clases.' using errcode = 'P0058';
  end if;

  /* El tope es por semana del calendario, de lunes a domingo, que es como
     lo cuenta la gente. */
  if v_a.tope_semanal is not null then
    select count(*) into v_sem
      from reservas r
     where r.abono_id = p_abono
       and (p_id is null or r.id <> p_id)
       and r.estado <> 'cancelada'
       and date_trunc('week', r.desde at time zone v_zona)
           = date_trunc('week', p_desde at time zone v_zona);

    if v_sem >= v_a.tope_semanal then
      raise exception 'Ese plan permite % por semana.', v_a.tope_semanal using errcode = 'P0059';
    end if;
  end if;
end;
$$;

comment on function revisar_abono is 'Vigencia, saldo y tope semanal, en el momento de reservar. Después es tarde.';

/* `agendar_turno` e `inscribir` aceptan un abono. Se rehacen enteras
   porque plpgsql no admite parchear una función. */

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
  v_cliente  uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_abono    uuid := nullif(p ->> 'abono_id', '')::uuid;
  v_id       uuid;
begin
  if not public.puede_ver(v_emp) then
    raise exception 'No podés agendar en ese comercio.' using errcode = 'P0038';
  end if;

  perform revisar_turno(null, v_emp, v_desde, v_duracion, v_personal, v_recurso);
  if v_abono is not null then
    perform revisar_abono(v_abono, v_cliente, v_desde);
  end if;

  insert into reservas (
    empresa_id, sucursal_id, recurso_id, cliente_id, personal_id, item_id, abono_id,
    nombre, telefono, personas, desde, duracion_min, estado, notas, usuario_id
  ) values (
    v_emp,
    nullif(p ->> 'sucursal_id', '')::uuid,
    v_recurso, v_cliente, v_personal,
    nullif(p ->> 'item_id', '')::uuid,
    v_abono,
    coalesce(nullif(p ->> 'nombre', ''), 'Sin nombre'),
    nullif(p ->> 'telefono', ''),
    coalesce((p ->> 'personas')::integer, 1),
    v_desde, v_duracion,
    coalesce(nullif(p ->> 'estado', ''), 'pendiente'),
    nullif(p ->> 'notas', ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function inscribir(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_clase   reservas%rowtype;
  v_tomados integer;
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_abono   uuid := nullif(p ->> 'abono_id', '')::uuid;
  v_id      uuid;
begin
  select * into v_clase from reservas where id = (p ->> 'clase_id')::uuid for update;

  if v_clase.id is null then
    raise exception 'No existe esa clase.' using errcode = 'P0042';
  end if;
  if v_clase.cupo is null then
    raise exception 'Eso no es una clase: no tiene cupo.' using errcode = 'P0043';
  end if;
  if not public.puede_ver(v_clase.empresa_id) then
    raise exception 'No podés anotar en ese comercio.' using errcode = 'P0038';
  end if;
  if v_clase.estado = 'cancelada' then
    raise exception 'Esa clase está cancelada.' using errcode = 'P0044';
  end if;

  select count(*) into v_tomados
    from reservas
   where clase_id = v_clase.id and estado not in ('cancelada', 'ausente');

  if v_tomados >= v_clase.cupo then
    raise exception 'Esa clase ya está completa.' using errcode = 'P0045';
  end if;

  if v_cliente is not null and exists (
    select 1 from reservas
     where clase_id = v_clase.id and cliente_id = v_cliente
       and estado not in ('cancelada', 'ausente')
  ) then
    raise exception 'Esa persona ya está anotada en esta clase.' using errcode = 'P0046';
  end if;

  if v_abono is not null then
    perform revisar_abono(v_abono, v_cliente, v_clase.desde);
  end if;

  insert into reservas (
    empresa_id, sucursal_id, recurso_id, personal_id, item_id, clase_id, abono_id,
    cliente_id, nombre, telefono, personas, desde, duracion_min, estado, notas, usuario_id
  ) values (
    v_clase.empresa_id, v_clase.sucursal_id, v_clase.recurso_id,
    v_clase.personal_id, v_clase.item_id, v_clase.id, v_abono,
    v_cliente,
    coalesce(nullif(p ->> 'nombre', ''), 'Sin nombre'),
    nullif(p ->> 'telefono', ''),
    1,
    v_clase.desde, v_clase.duracion_min,
    coalesce(nullif(p ->> 'estado', ''), 'confirmada'),
    nullif(p ->> 'notas', ''),
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

/* ------------------------------------------------------------
   7 · El turno, sabiendo de qué abono salió
   ------------------------------------------------------------ */

drop view if exists agenda_vista;

create view agenda_vista
with (security_invoker = true) as
select
  r.id, r.empresa_id, r.sucursal_id, r.recurso_id, r.cliente_id,
  r.personal_id, r.item_id, r.clase_id, r.cupo, r.abono_id,
  r.nombre, r.telefono, r.personas, r.desde, r.duracion_min,
  r.desde + make_interval(mins => r.duracion_min) as hasta,
  r.estado, r.notas, r.operacion_id, r.creada_en,

  case when r.clase_id is not null then 'inscripcion'
       when r.cupo is not null     then 'clase'
       else 'turno'
  end as forma,

  coalesce(ins.tomados, 0) as anotados,
  case when r.cupo is null then null else r.cupo - coalesce(ins.tomados, 0) end as lugares,
  coalesce(esp.esperando, 0) as esperando,

  c.razon_social as cliente,
  p.nombre       as profesional,
  p.especialidad,
  i.nombre       as servicio,
  i.categoria    as area,
  i.precio,
  re.nombre      as sala,
  re.tipo        as sala_tipo,
  ab.nombre      as abono,

  coalesce(pg.pagado, 0) as pagado
from reservas r
left join clientes  c  on c.id  = r.cliente_id
left join personal  p  on p.id  = r.personal_id
left join items     i  on i.id  = r.item_id
left join recursos  re on re.id = r.recurso_id
left join abonos    ab on ab.id = r.abono_id
left join (
  select clase_id, count(*) as tomados
  from reservas where clase_id is not null and estado not in ('cancelada', 'ausente')
  group by clase_id
) ins on ins.clase_id = r.id
left join (
  select clase_id, count(*) as esperando
  from espera where estado = 'esperando'
  group by clase_id
) esp on esp.clase_id = r.id
left join (
  select operacion_id, sum(monto) as pagado from pagos group by operacion_id
) pg on pg.operacion_id = r.operacion_id;

comment on view agenda_vista is
  'Turnos, clases e inscripciones con sus nombres resueltos. `forma` dice cuál de las tres es cada fila, y el cupo ya viene contado.';
