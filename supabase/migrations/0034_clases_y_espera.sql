/* ============================================================
   0034 · CLASES GRUPALES Y LISTA DE ESPERA
   ============================================================

   Una clase de reformer compromete la sala y a la profesora durante una
   hora, igual que un turno individual. La diferencia es que adentro entran
   seis personas en vez de una. Así que sigue siendo una `reserva` y no una
   tabla nueva: el mismo argumento por el que un turno no fue una tabla
   aparte de una reserva de mesa.

   TRES FORMAS EN UNA TABLA
   ------------------------
   Una fila de `reservas` puede ser una de estas tres, y una restricción se
   encarga de que nunca sea dos a la vez:

     · TURNO INDIVIDUAL   cupo null, clase_id null
     · CLASE              cupo >= 1, clase_id null, sin cliente
     · INSCRIPCIÓN        clase_id apunta a la clase, cupo null

   Que una clase exista con cero inscriptos no es un caso raro: es lo
   normal. El horario se publica antes de que nadie se anote, y por eso la
   clase no puede ser "las inscripciones que hay".

   QUIÉN OCUPA LA SALA
   -------------------
   Solo la clase. Las inscripciones no ocupan nada: si ocuparan, seis
   personas anotadas al mismo reformer se leerían como seis choques y no
   se podría anotar a la segunda. Es el cambio más importante de esta
   migración y va adentro de `revisar_turno`.
   ============================================================ */

alter table reservas add column cupo     integer;
alter table reservas add column clase_id uuid references reservas(id) on delete cascade;

create index on reservas (clase_id) where clase_id is not null;

alter table reservas add constraint reservas_forma_valida check (
  not (cupo is not null and clase_id is not null)
);

alter table reservas add constraint reservas_cupo_valido check (
  cupo is null or cupo >= 1
);

/* `personas > 0` se escribió cuando toda reserva era una mesa con
   comensales, y ahí tenía razón: una mesa para cero no es una reserva.
   Una clase sí arranca en cero —la gente la traen las inscripciones— así
   que la regla se afina en vez de aflojarse: cero solo lo puede tener una
   clase. Un turno y una inscripción siguen necesitando al menos uno. */
alter table reservas drop constraint reservas_personas_valido;

alter table reservas add constraint reservas_personas_valido check (
  personas > 0 or cupo is not null
);

comment on column reservas.cupo     is 'Lugares de una clase grupal. Null en un turno individual y en una inscripción.';
comment on column reservas.clase_id is 'La clase a la que esta persona se anotó. Null en la clase misma y en un turno individual.';

/* ------------------------------------------------------------
   Los choques, corregidos

   Igual que la versión de la 0032 salvo una línea: las inscripciones no
   ocupan. Sin eso, anotar a la segunda persona en una clase de seis daba
   "esa sala ya está ocupada".
   ------------------------------------------------------------ */

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

  if v_local::date <> v_localh::date then
    raise exception 'Un turno no puede cruzar la medianoche.' using errcode = 'P0031';
  end if;

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

  /* Solo miran las filas que ocupan de verdad: turnos individuales y
     clases. Las inscripciones viven adentro de una clase que ya reservó
     el lugar por todas. */
  if p_recurso is not null and exists (
    select 1 from reservas r
    where r.recurso_id = p_recurso
      and r.clase_id is null
      and (p_id is null or r.id <> p_id)
      and r.estado not in ('cancelada', 'ausente')
      and r.desde < v_hasta
      and r.desde + make_interval(mins => r.duracion_min) > p_desde
  ) then
    raise exception 'Esa sala ya está ocupada en ese horario.' using errcode = 'P0034';
  end if;

  if p_personal is not null and exists (
    select 1 from reservas r
    where r.personal_id = p_personal
      and r.clase_id is null
      and (p_id is null or r.id <> p_id)
      and r.estado not in ('cancelada', 'ausente')
      and r.desde < v_hasta
      and r.desde + make_interval(mins => r.duracion_min) > p_desde
  ) then
    raise exception 'Esa persona ya tiene un turno en ese horario.' using errcode = 'P0035';
  end if;

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

/* ------------------------------------------------------------
   Abrir una clase
   ------------------------------------------------------------ */

create or replace function crear_clase(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_emp      uuid := (p ->> 'empresa_id')::uuid;
  v_desde    timestamptz := (p ->> 'desde')::timestamptz;
  v_duracion integer := coalesce((p ->> 'duracion_min')::integer, 60);
  v_personal uuid := nullif(p ->> 'personal_id', '')::uuid;
  v_recurso  uuid := nullif(p ->> 'recurso_id', '')::uuid;
  v_item     uuid := nullif(p ->> 'item_id', '')::uuid;
  v_cupo     integer := coalesce((p ->> 'cupo')::integer, 1);
  v_cap      integer;
  v_id       uuid;
begin
  if not public.puede_ver(v_emp) then
    raise exception 'No podés agendar en ese comercio.' using errcode = 'P0038';
  end if;

  if v_cupo < 1 then
    raise exception 'Una clase necesita al menos un lugar.' using errcode = 'P0040';
  end if;

  /* El cupo no puede pasarse de lo que entra en la sala. La capacidad de
     la sala es un dato físico; el cupo de la clase es una decisión, y
     puede ser menor —una clase de principiantes con menos gente— pero
     nunca mayor. */
  if v_recurso is not null then
    select capacidad into v_cap from recursos where id = v_recurso;
    if v_cap is not null and v_cupo > v_cap then
      raise exception 'En esa sala entran % personas.', v_cap using errcode = 'P0041';
    end if;
  end if;

  perform revisar_turno(null, v_emp, v_desde, v_duracion, v_personal, v_recurso);

  insert into reservas (
    empresa_id, sucursal_id, recurso_id, personal_id, item_id,
    nombre, personas, desde, duracion_min, estado, notas, cupo, usuario_id
  ) values (
    v_emp,
    nullif(p ->> 'sucursal_id', '')::uuid,
    v_recurso, v_personal, v_item,
    coalesce(nullif(p ->> 'nombre', ''), 'Clase'),
    0,                                   -- la clase no trae gente; la traen las inscripciones
    v_desde, v_duracion,
    coalesce(nullif(p ->> 'estado', ''), 'confirmada'),
    nullif(p ->> 'notas', ''),
    v_cupo,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

comment on function crear_clase is 'Abre una clase grupal. Existe aunque no se anote nadie: el horario se publica antes.';

/* ------------------------------------------------------------
   Anotarse

   El cupo se cuenta y se compara adentro de la misma transacción, con la
   clase bloqueada. Contarlo en el navegador y escribir después es cómo se
   meten siete personas en una clase de seis.
   ------------------------------------------------------------ */

create or replace function inscribir(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_clase   reservas%rowtype;
  v_tomados integer;
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
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

  /* Dos veces la misma persona en la misma clase es siempre un error de
     dedo, y ocupa un lugar que alguien más necesitaba. */
  if v_cliente is not null and exists (
    select 1 from reservas
     where clase_id = v_clase.id and cliente_id = v_cliente
       and estado not in ('cancelada', 'ausente')
  ) then
    raise exception 'Esa persona ya está anotada en esta clase.' using errcode = 'P0046';
  end if;

  insert into reservas (
    empresa_id, sucursal_id, recurso_id, personal_id, item_id, clase_id,
    cliente_id, nombre, telefono, personas, desde, duracion_min, estado, notas, usuario_id
  ) values (
    v_clase.empresa_id, v_clase.sucursal_id, v_clase.recurso_id,
    v_clase.personal_id, v_clase.item_id, v_clase.id,
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

comment on function inscribir is 'Anota a alguien en una clase controlando el cupo con la clase bloqueada, para que dos personas no entren en el mismo último lugar.';

/* ------------------------------------------------------------
   La lista de espera

   Va en tabla propia y no como un estado más de la reserva: alguien en
   lista de espera no tiene lugar, y una reserva sin lugar no es una
   reserva. Además una misma persona puede estar esperando dos horarios
   distintos, y eso como reserva serían dos turnos que no existen.
   ------------------------------------------------------------ */

create table espera (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  clase_id    uuid not null references reservas(id) on delete cascade,
  cliente_id  uuid references clientes(id) on delete set null,

  nombre      text not null,
  telefono    text,
  notas       text,

  estado      text not null default 'esperando',
  orden       integer not null default 0,
  creada_en   timestamptz not null default now(),
  usuario_id  uuid references perfiles(id) on delete set null,

  constraint espera_estado_valido check (estado in ('esperando', 'avisado', 'entro', 'baja'))
);

create index on espera (empresa_id, clase_id, orden);

alter table espera enable row level security;

create policy espera_todo on espera
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

comment on table espera is
  'Quién quiere entrar a una clase llena, y en qué orden. No se promueve solo: liberar un lugar y meter a alguien sin avisarle es peor que el problema.';

/* ------------------------------------------------------------
   La agenda, con el cupo resuelto
   ------------------------------------------------------------ */

/* Se tira y se rehace en vez de reemplazarse: `create or replace view` no
   admite meter columnas en el medio, y `clase_id` y `cupo` van al lado de
   las otras del turno y no colgando al final. Nadie más depende de esta
   vista, así que tirarla no arrastra nada. */
drop view if exists agenda_vista;

create view agenda_vista
with (security_invoker = true) as
select
  r.id, r.empresa_id, r.sucursal_id, r.recurso_id, r.cliente_id,
  r.personal_id, r.item_id, r.clase_id, r.cupo,
  r.nombre, r.telefono, r.personas, r.desde, r.duracion_min,
  r.desde + make_interval(mins => r.duracion_min) as hasta,
  r.estado, r.notas, r.operacion_id, r.creada_en,

  /* Qué es esta fila, resuelto acá y no en la pantalla. */
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

  coalesce(pg.pagado, 0) as pagado
from reservas r
left join clientes  c  on c.id  = r.cliente_id
left join personal  p  on p.id  = r.personal_id
left join items     i  on i.id  = r.item_id
left join recursos  re on re.id = r.recurso_id
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

/* La lista de espera también viaja en tiempo real: si recepción anota a
   alguien, el profesor lo ve sin refrescar. */
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'espera'
  ) then
    alter publication supabase_realtime add table public.espera;
  end if;
end;
$$;
