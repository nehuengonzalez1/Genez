-- ============================================================
-- 0128 · Suscripción de Mercado Pago: contratar Genez sin pasar por Nehuen
-- ============================================================
--
-- Hasta acá, al terminar la prueba el comercio avisaba "ya pagué" y la
-- plataforma lo activaba a mano (0127). Nehuen (03/10): "si tengo que andar
-- aprobando todo no tiene sentido". Desde acá el comercio contrata desde el
-- sistema, Mercado Pago le cobra todos los meses (o el año) y los avisos de
-- Mercado Pago activan, mantienen y suspenden la cuenta solos.
--
-- Lo que se decidió el 05/10:
--   - Precios fijos de `tarifas` (plan:start, plan:pro, anual_meses,
--     sucursales_incluidas, sucursal_extra). Empresa no se contrata acá.
--   - Mensual o anual (10 meses).
--   - 5 días de gracia si un cobro falla: el comercio sigue entrando con un
--     aviso, y después se suspende.
--   - Se cobra sin CUIT por ahora (la plata entra a la cuenta de Nehuen).
--
-- LA SUSPENSIÓN USA LO QUE YA HABÍA
-- ---------------------------------
-- `empresa_actual()` ya deja afuera al comercio con `prueba_hasta` vencida
-- (0127). La gracia y la baja se escriben ahí mismo: un cobro que falla
-- pone `prueba_hasta` en hoy + 5, una baja la pone en el último día pago, y
-- un cobro aprobado la vuelve a null. No hay un segundo mecanismo de
-- suspensión que mantener. La pantalla distingue prueba de gracia mirando
-- la suscripción, que `mi_cuenta()` devuelve ahora.
--
-- QUIÉN ESCRIBE
-- -------------
-- Solo el servidor (api/founder.js, con la service_role): crea la
-- suscripción cuando el comercio contrata y la actualiza con lo que dice
-- Mercado Pago. El navegador no tiene ninguna política de escritura, y el
-- comercio lee la suya por `mi_cuenta()`. Para eso `proteger_lo_comercial`
-- deja pasar al servidor: hasta acá solo dejaba a la plataforma, y el
-- servidor no es un usuario.

set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

create table suscripciones (
  empresa_id          uuid primary key references empresas(id) on delete cascade,
  mp_id               text unique,
  plan                text not null,
  periodo             text not null,
  monto               numeric(14,2) not null,
  sucursales          integer not null default 1,
  payer_email         text not null,
  estado              text not null default 'pendiente',
  pago_fallido_desde  date,
  ultimo_pago_en      timestamptz,
  proximo_cobro       date,
  creada_en           timestamptz not null default now(),
  actualizada_en      timestamptz not null default now(),
  constraint suscripciones_plan check (plan in ('start', 'pro')),
  constraint suscripciones_periodo check (periodo in ('mensual', 'anual')),
  constraint suscripciones_monto check (monto > 0),
  constraint suscripciones_sucursales check (sucursales between 1 and 999),
  constraint suscripciones_estado check (estado in ('pendiente', 'activa', 'pausada', 'cancelada'))
);

comment on table suscripciones is
  'La suscripción de Mercado Pago de cada comercio (0128). La escribe solo el servidor; el comercio la lee por mi_cuenta().';
comment on column suscripciones.estado is
  'pendiente: creada, sin autorizar en MP. activa: MP la autorizó. pausada/cancelada: como en MP.';
comment on column suscripciones.pago_fallido_desde is
  'El primer día de un cobro rechazado sin otro aprobado después. Abre los 5 días de gracia.';

alter table suscripciones enable row level security;
revoke all on suscripciones from anon, authenticated;
grant select on suscripciones to authenticated;
create policy suscripciones_plataforma on suscripciones for select to authenticated using (es_plataforma());


/* El servidor puede cambiar lo comercial; el comercio, no. `auth.role()`
   es el rol del token: 'service_role' solo con la llave maestra, que vive
   en Vercel. */
create or replace function public.proteger_lo_comercial()
returns trigger
language plpgsql
as $function$
begin
  if public.es_plataforma() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.nombre  is distinct from old.nombre
  or new.plan    is distinct from old.plan
  or new.modulos is distinct from old.modulos
  or new.activa  is distinct from old.activa
  or new.rubro   is distinct from old.rubro
  or new.prueba_hasta is distinct from old.prueba_hasta then
    raise exception 'El plan, los módulos y el estado de la cuenta los cambia Genez, no el comercio.'
      using errcode = 'P0004';
  end if;

  return new;
end;
$function$;


/* mi_cuenta(), con la suscripción: la pantalla tiene que saber si el día
   límite es el fin de la prueba o el de la gracia. */
create or replace function public.mi_cuenta()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', e.id,
    'nombre', e.nombre,
    'rubro', e.rubro,
    'plan', e.plan,
    'modulos', e.modulos,
    'activa', e.activa,
    'prueba_hasta', e.prueba_hasta,
    'hoy', (now() at time zone zona_de(e.id))::date,
    'pago_avisado_en', pr.pago_avisado_en,
    'plan_elegido', pr.plan,
    'ejemplos', exists (select 1 from items i where i.empresa_id = e.id and i.campos_extra ? 'ejemplo')
             or exists (select 1 from operaciones o where o.empresa_id = e.id and o.campos_extra ? 'ejemplo'),
    'suscripcion', case when s.empresa_id is null then null else jsonb_build_object(
      'plan', s.plan, 'periodo', s.periodo, 'monto', s.monto, 'estado', s.estado,
      'pago_fallido_desde', s.pago_fallido_desde, 'proximo_cobro', s.proximo_cobro
    ) end
  )
  from perfiles p
  join empresas e on e.id = p.empresa_id
  left join pruebas pr on pr.empresa_id = e.id
  left join suscripciones s on s.empresa_id = e.id
  where p.id = auth.uid()
$function$;

revoke all on function public.mi_cuenta() from public, anon;
grant execute on function public.mi_cuenta() to authenticated;


/* El cliente en Founder. Cuando una suscripción se activa por primera vez,
   el comercio pasa a ser cliente de Genez: prospecto (fuente
   'autoservicio'), cliente y suscripción, enlazados por empresa_id, para
   que el MRR y la lista de clientes de Founder lo cuenten sin que nadie lo
   cargue. Después solo se acompaña: importe y estado. El anual se cuenta
   por su doceava parte, que es lo que entra por mes. */
create or replace function public.suscripcion_a_founder(p_empresa uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s suscripciones%rowtype;
  v_prospecto uuid;
  v_cliente uuid;
  v_mensual numeric(14,2);
  v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
  v_estado_cliente text;
  v_estado_sus text;
begin
  select * into s from suscripciones where empresa_id = p_empresa;
  if not found or s.estado = 'pendiente' then return; end if;

  v_mensual := round(case when s.periodo = 'anual' then s.monto / 12 else s.monto end, 2);
  v_estado_cliente := case s.estado when 'activa' then case when s.pago_fallido_desde is null then 'activo' else 'en_riesgo' end
                                    when 'pausada' then 'pausado' else 'cancelado' end;
  v_estado_sus := case s.estado when 'activa' then 'activa' when 'pausada' then 'pausada' else 'baja' end;

  select id into v_cliente from interno_clientes where empresa_id = p_empresa;
  if v_cliente is null then
    if s.estado <> 'activa' then return; end if;
    select id into v_prospecto from interno_prospectos where empresa_id = p_empresa limit 1;
    if v_prospecto is null then
      insert into interno_prospectos (nombre, rubro, email, whatsapp, fuente, empresa_id, cliente_desde)
      select e.nombre, e.rubro, pr.email, pr.telefono, 'autoservicio', e.id, now()
      from empresas e left join pruebas pr on pr.empresa_id = e.id
      where e.id = p_empresa
      returning id into v_prospecto;
    end if;
    insert into interno_clientes (prospecto_id, empresa_id, plan, importe_mensual, estado)
    values (v_prospecto, p_empresa, s.plan, v_mensual, 'activo')
    returning id into v_cliente;
    insert into interno_suscripciones (cliente_id, plan, importe_mensual, inicio, estado, dia_cobro, notas)
    values (v_cliente, s.plan, v_mensual, v_hoy, 'activa', least(extract(day from v_hoy)::int, 28),
            'Mercado Pago ' || s.periodo || coalesce(' · ' || s.mp_id, ''));
    return;
  end if;

  update interno_clientes
  set plan = s.plan, importe_mensual = v_mensual, estado = v_estado_cliente
  where id = v_cliente
    and (plan is distinct from s.plan or importe_mensual <> v_mensual or estado <> v_estado_cliente);

  update interno_suscripciones
  set plan = s.plan, importe_mensual = v_mensual, estado = v_estado_sus,
      fin = case when v_estado_sus = 'baja' then coalesce(fin, v_hoy) else null end
  where cliente_id = v_cliente and estado <> 'baja'
    and (plan is distinct from s.plan or importe_mensual <> v_mensual or estado <> v_estado_sus);
end;
$function$;

revoke all on function public.suscripcion_a_founder(uuid) from public, anon, authenticated;
grant execute on function public.suscripcion_a_founder(uuid) to service_role;


/* ---------- Control ---------- */
do $$
begin
  if exists (select 1 from suscripciones) then
    raise exception 'suscripciones no debería tener filas recién creada';
  end if;
  raise notice 'suscripciones lista; proteger_lo_comercial deja pasar al servidor';
end $$;
