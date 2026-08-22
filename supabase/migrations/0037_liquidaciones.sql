/* ============================================================
   0037 · LIQUIDACIONES
   ============================================================

   Lo que se le paga al equipo. Va en Finanzas y no en "Clientes y equipo"
   por una razón concreta: **pagarle a alguien es un egreso**. Con la
   liquidación colgando del módulo de personal, Finanzas no se entera del
   gasto más grande y más regular del negocio, y los egresos del mes
   mienten.

   LAS HORAS SE PROPONEN, NO SE IMPONEN
   ------------------------------------
   Salen de la agenda: la suma de lo que cada uno dictó en el período. Pero
   quedan editables, porque la agenda no sabe que se quedó media hora más
   ordenando ni que cubrió a alguien sin que quedara registrado.

   Una clase cuenta una vez —su duración— y no una vez por alumno. Las
   inscripciones no son horas del profesor: son la misma hora vista desde
   el otro lado.

   LA NOTA VA PEGADA AL PERÍODO
   ----------------------------
   Los reemplazos y lo que haga falta se anotan sobre la liquidación y no
   sobre la persona. Ahí es donde tienen sentido: son la explicación de por
   qué esas horas no cierran con lo habitual.
   ============================================================ */

create table liquidaciones (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  personal_id  uuid not null references personal(id) on delete cascade,

  desde        date not null,
  hasta        date not null,

  /* La modalidad y el valor se copian al liquidar. Si mañana se le sube
     el valor hora, la liquidación de marzo tiene que seguir diciendo lo
     que se le pagó en marzo. Mismo criterio que `costo_unitario` en una
     línea de venta. */
  modalidad    text not null default 'hora',
  valor        numeric(14,2) not null default 0,
  horas        numeric(8,2)  not null default 0,
  clases       integer       not null default 0,

  /* Adelantos y extras. En negativo descuenta: un adelanto que se dio a
     mitad de semana sale de lo que queda por pagar. */
  ajuste       numeric(14,2) not null default 0,
  total        numeric(14,2) not null default 0,

  estado       text not null default 'borrador',
  medio        text,
  movimiento_id uuid references movimientos_caja(id) on delete set null,
  pagada_en    timestamptz,

  creada_en    timestamptz not null default now(),
  usuario_id   uuid references perfiles(id) on delete set null,

  constraint liquidaciones_estado_valido check (estado in ('borrador', 'pagada', 'anulada')),
  constraint liquidaciones_periodo_valido check (hasta >= desde),
  constraint liquidaciones_unica unique (empresa_id, personal_id, desde, hasta)
);

create index on liquidaciones (empresa_id, desde desc);
create index on liquidaciones (personal_id, desde desc);

create table liquidacion_notas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  liquidacion_id  uuid not null references liquidaciones(id) on delete cascade,
  texto           text not null,
  creada_en       timestamptz not null default now(),
  usuario_id      uuid references perfiles(id) on delete set null
);

create index on liquidacion_notas (liquidacion_id, creada_en);

comment on table liquidacion_notas is
  'Reemplazos y lo que haga falta, pegado al período que se está liquidando: es la explicación de por qué esas horas no cierran con lo habitual.';

alter table liquidaciones      enable row level security;
alter table liquidacion_notas  enable row level security;

create policy liquidaciones_todo on liquidaciones
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

create policy liquidacion_notas_todo on liquidacion_notas
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ------------------------------------------------------------
   Lo que dictó cada uno

   Una clase cuenta una vez, por eso se excluyen las inscripciones. Una
   cancelación no cuenta; una ausencia sí, porque el profesor igual estuvo.
   ------------------------------------------------------------ */

create or replace function dictado_en(p_personal uuid, p_desde date, p_hasta date)
returns table (horas numeric, clases integer)
language sql stable
as $$
  select
    coalesce(sum(r.duracion_min), 0)::numeric / 60 as horas,
    count(*)::integer                              as clases
  from reservas r
  join personal p on p.id = r.personal_id
  where r.personal_id = p_personal
    and r.clase_id is null
    and r.estado <> 'cancelada'
    and (r.desde at time zone zona_de(p.empresa_id))::date between p_desde and p_hasta;
$$;

comment on function dictado_en is 'Horas y clases que dio una persona en un período, desde la agenda. Las inscripciones no cuentan: son la misma hora vista desde el otro lado.';

/* ------------------------------------------------------------
   Armar la liquidación

   Se puede volver a correr: recalcula el borrador con lo que haya en la
   agenda ahora. Una ya pagada no se toca.
   ------------------------------------------------------------ */

create or replace function liquidar(p_personal uuid, p_desde date, p_hasta date)
returns uuid
language plpgsql
as $$
declare
  v_p    personal%rowtype;
  v_d    record;
  v_tot  numeric;
  v_id   uuid;
  v_est  text;
begin
  select * into v_p from personal where id = p_personal;
  if v_p.id is null then
    raise exception 'No existe esa persona.' using errcode = 'P0060';
  end if;
  if not public.puede_ver(v_p.empresa_id) then
    raise exception 'No podés liquidar en ese comercio.' using errcode = 'P0038';
  end if;

  select estado into v_est from liquidaciones
   where empresa_id = v_p.empresa_id and personal_id = p_personal
     and desde = p_desde and hasta = p_hasta;

  if v_est = 'pagada' then
    raise exception 'Esa liquidación ya está pagada.' using errcode = 'P0061';
  end if;

  select * into v_d from dictado_en(p_personal, p_desde, p_hasta);

  /* Cómo se llega al total depende de la modalidad de la persona. El
     sueldo fijo no mira las horas: se paga igual, y las horas quedan
     igual anotadas para poder controlarlas. */
  v_tot := case v_p.modalidad
    when 'hora'  then round(v_d.horas * v_p.valor)
    when 'clase' then v_d.clases * v_p.valor
    when 'fijo'  then v_p.valor
    else 0   -- comisión: se calcula sobre lo facturado y todavía no está
  end;

  insert into liquidaciones (
    empresa_id, personal_id, desde, hasta, modalidad, valor, horas, clases, total, usuario_id
  ) values (
    v_p.empresa_id, p_personal, p_desde, p_hasta, v_p.modalidad, v_p.valor,
    v_d.horas, v_d.clases, v_tot, auth.uid()
  )
  on conflict (empresa_id, personal_id, desde, hasta) do update
    set modalidad = excluded.modalidad,
        valor     = excluded.valor,
        horas     = excluded.horas,
        clases    = excluded.clases,
        /* El ajuste cargado a mano se respeta: lo puso alguien que sabía
           algo que la agenda no sabe. */
        total     = excluded.total + liquidaciones.ajuste
  returning id into v_id;

  return v_id;
end;
$$;

comment on function liquidar is 'Arma o recalcula el borrador de un período con lo que diga la agenda. Una liquidación pagada no se toca.';

/* ------------------------------------------------------------
   Pagarla

   Genera el egreso en el mismo acto. Es lo que hace que la caja cierre
   sola y que nadie tenga que acordarse de anotar el sueldo aparte.

   `sesion_id` puede ir en null: pagar por transferencia un lunes no es un
   movimiento del cajón del mostrador, y obligar a abrir la caja para eso
   sería inventar un arqueo que no existió.
   ------------------------------------------------------------ */

create or replace function pagar_liquidacion(p_id uuid, p_medio text, p_sesion uuid default null)
returns uuid
language plpgsql
as $$
declare
  v_l   liquidaciones%rowtype;
  v_p   text;
  v_mov uuid;
begin
  select * into v_l from liquidaciones where id = p_id for update;
  if v_l.id is null then
    raise exception 'No existe esa liquidación.' using errcode = 'P0062';
  end if;
  if v_l.estado = 'pagada' then
    raise exception 'Esa liquidación ya está pagada.' using errcode = 'P0061';
  end if;

  select nombre into v_p from personal where id = v_l.personal_id;

  insert into movimientos_caja (
    empresa_id, sesion_id, tipo, medio, monto, detalle, categoria, usuario_id
  ) values (
    v_l.empresa_id, p_sesion, 'egreso', coalesce(p_medio, 'efectivo'),
    v_l.total + v_l.ajuste,
    'Sueldo ' || coalesce(v_p, '') || ' · ' || to_char(v_l.desde, 'DD/MM') || ' al ' || to_char(v_l.hasta, 'DD/MM'),
    'sueldos', auth.uid()
  )
  returning id into v_mov;

  update liquidaciones
     set estado = 'pagada', medio = p_medio, movimiento_id = v_mov, pagada_en = now()
   where id = p_id;

  return v_mov;
end;
$$;

comment on function pagar_liquidacion is 'Marca pagada la liquidación y escribe el egreso en el mismo acto, para que nadie tenga que acordarse de anotarlo.';

/* ------------------------------------------------------------
   La liquidación, con los nombres resueltos
   ------------------------------------------------------------ */

create or replace view liquidaciones_vista
with (security_invoker = true) as
select
  l.*,
  p.nombre       as persona,
  p.tipo         as tipo_persona,
  p.especialidad,
  l.total + l.ajuste as a_pagar,
  coalesce(nt.notas, 0) as notas
from liquidaciones l
join personal p on p.id = l.personal_id
left join (
  select liquidacion_id, count(*) as notas from liquidacion_notas group by liquidacion_id
) nt on nt.liquidacion_id = l.id;

comment on view liquidaciones_vista is 'La liquidación con la persona resuelta y el total a pagar ya sumado el ajuste.';
