-- ============================================================
-- 0130 · Mi plan: cambiar, dar de baja, arrepentirse, ajustar y borrar
-- ============================================================
--
-- Los términos del 05/10 (src/landing/Terminos.jsx) prometen cosas que el
-- sistema no hacía. Esto es la parte de la base; lo demás está en
-- api/_mi_plan.js.
--
-- 1. suscripciones, más columnas:
--    - autorizada_en: la primera vez que MP la autorizó. Desde ahí corren
--      los 10 días del arrepentimiento.
--    - precio_desde / proximo_ajuste / ipc_ref_mes / ipc_ref: el precio
--      queda congelado 6 meses y después sigue al IPC del INDEC cada 3. El
--      ajuste se aplica al primer cobro que cae en proximo_ajuste o
--      después; ipc_ref es el índice contra el que se mide el próximo.
--    - monto_anterior / ajustado_en: el último ajuste, para mostrarlo.
--    - baja_codigo / baja_pedida_en: el código de baja (Ley 24.240 art. 10
--      ter, Res. 316/2018 como buena práctica).
--    - cambio_*: pasar de mensual a anual (o al revés) necesita una
--      suscripción nueva en MP; mientras no se autoriza, vive acá y la
--      vieja sigue cobrando.
--
-- 2. arrepentimientos: el botón de la Res. 424/2020. Lo escribe solo el
--    servidor (el formulario no pide sesión) y lo lee la plataforma.
--
-- 3. mi_cuenta(): lo que necesita la pantalla Mi plan.
--
-- 4. borrar_comercio(): los términos dicen que a los 90 días de quedar sin
--    acceso los datos se borran. Solo la service_role, y con frenos que la
--    función verifica ella misma aunque quien llame ya los haya mirado:
--    - solo comercios que se dieron de alta solos (tienen fila en pruebas):
--      los de antes de los planes (Super 25, Bar Rivadavia, Almha…) no se
--      tocan nunca;
--    - sin suscripción activa ni pausada;
--    - con prueba_hasta (el último día de acceso) 90 días atrás o más;
--    - sin comprobantes fiscales: esos la ley obliga a guardarlos, y un
--      comercio que los tiene se resuelve a mano.
--    Borra primero los perfiles: si se borra el comercio de una, el
--    disparador anotar_acceso (0048) quiere anotar la baja de cada perfil
--    en la bitácora de un comercio que ya no existe y todo falla (probado
--    sobre Bnitori en una transacción deshecha el 05/10). Después los
--    insumos de recetas (su clave es `restrict`), el comercio con todo lo
--    que cuelga en cascada, y los usuarios de Auth.
-- ============================================================

alter table suscripciones
  add column if not exists autorizada_en     timestamptz,
  add column if not exists precio_desde      date,
  add column if not exists proximo_ajuste    date,
  add column if not exists ipc_ref_mes       date,
  add column if not exists ipc_ref           numeric(14,4),
  add column if not exists monto_anterior    numeric(14,2),
  add column if not exists ajustado_en       timestamptz,
  add column if not exists baja_codigo       text,
  add column if not exists baja_pedida_en    timestamptz,
  add column if not exists cambio_mp_id      text unique,
  add column if not exists cambio_plan       text,
  add column if not exists cambio_periodo    text,
  add column if not exists cambio_monto      numeric(14,2);

alter table suscripciones drop constraint if exists suscripciones_cambio;
alter table suscripciones add constraint suscripciones_cambio check (
  (cambio_mp_id is null) or (cambio_plan in ('start', 'pro') and cambio_periodo in ('mensual', 'anual') and cambio_monto > 0)
);

comment on column suscripciones.proximo_ajuste is
  'El ajuste por IPC se aplica al primer cobro en esta fecha o después (api/_mi_plan.js).';
comment on column suscripciones.cambio_mp_id is
  'Suscripción nueva de MP por un cambio de período, todavía sin autorizar. Al autorizarse reemplaza a mp_id.';


create table if not exists arrepentimientos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null unique,
  nombre       text not null,
  email        text not null,
  comercio     text,
  telefono     text,
  motivo       text,
  empresa_id   uuid references empresas(id) on delete set null,
  estado       text not null default 'recibido',
  creado_en    timestamptz not null default now(),
  resuelto_en  timestamptz,
  nota         text,
  constraint arrepentimientos_estado check (estado in ('recibido', 'resuelto', 'descartado'))
);

alter table arrepentimientos enable row level security;
revoke all on arrepentimientos from anon, authenticated;
grant select on arrepentimientos to authenticated;
drop policy if exists arrepentimientos_plataforma on arrepentimientos;
create policy arrepentimientos_plataforma on arrepentimientos
  for select to authenticated using (es_plataforma());


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
    'mi_rol', p.rol,
    'autoservicio', pr.empresa_id is not null,
    'ejemplos', exists (select 1 from items i where i.empresa_id = e.id and i.campos_extra ? 'ejemplo')
             or exists (select 1 from operaciones o where o.empresa_id = e.id and o.campos_extra ? 'ejemplo'),
    'suscripcion', case when s.empresa_id is null then null else jsonb_build_object(
      'plan', s.plan, 'periodo', s.periodo, 'monto', s.monto, 'estado', s.estado,
      'pago_fallido_desde', s.pago_fallido_desde, 'proximo_cobro', s.proximo_cobro,
      'autorizada_en', s.autorizada_en, 'proximo_ajuste', s.proximo_ajuste,
      'monto_anterior', s.monto_anterior, 'ajustado_en', s.ajustado_en,
      'baja_codigo', s.baja_codigo, 'baja_pedida_en', s.baja_pedida_en,
      'cambio_plan', s.cambio_plan, 'cambio_periodo', s.cambio_periodo, 'cambio_monto', s.cambio_monto
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


create or replace function public.se_puede_borrar(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from empresas e
    join pruebas pr on pr.empresa_id = e.id
    where e.id = p_empresa
      and e.plan in ('start', 'pro')
      and e.prueba_hasta is not null
      and e.prueba_hasta <= (now() at time zone 'America/Argentina/Buenos_Aires')::date - 90
      and not exists (select 1 from suscripciones s where s.empresa_id = e.id and s.estado in ('activa', 'pausada'))
      and not exists (select 1 from comprobantes c where c.empresa_id = e.id)
  )
$$;

create or replace function public.borrar_comercio(p_empresa uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nombre   text;
  v_usuarios uuid[];
begin
  if not public.se_puede_borrar(p_empresa) then
    raise exception 'Ese comercio no se puede borrar (ver 0130).' using errcode = 'P0130';
  end if;

  select nombre into v_nombre from empresas where id = p_empresa for update;
  select coalesce(array_agg(id), '{}') into v_usuarios from perfiles where empresa_id = p_empresa;

  delete from perfiles where empresa_id = p_empresa;
  delete from receta_insumos where item_id in (select id from items where empresa_id = p_empresa);
  delete from empresas where id = p_empresa;
  delete from auth.users where id = any(v_usuarios);

  return jsonb_build_object('nombre', v_nombre, 'usuarios', coalesce(array_length(v_usuarios, 1), 0));
end;
$$;

revoke all on function public.se_puede_borrar(uuid) from public, anon, authenticated;
revoke all on function public.borrar_comercio(uuid) from public, anon, authenticated;
grant execute on function public.se_puede_borrar(uuid) to service_role;
grant execute on function public.borrar_comercio(uuid) to service_role;
