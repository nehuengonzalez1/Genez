-- ============================================================
-- 0129 · Cuánta IA usó cada comercio
-- ============================================================
--
-- Los planes prometen un tope (05/10): Pro 150 preguntas y 30 remitos por
-- mes, Empresa 1.000 y 200, la prueba 20 y 5 en total, Simple nada. La
-- clave de Anthropic es de Genez, así que sin tope cada pregunta la paga
-- Genez y un comercio solo puede gastar lo que pagan diez.
--
-- El conteo lo hace la base y no api/anthropic.js porque dos pedidos al
-- mismo tiempo leerían "149" los dos y pasarían los dos. `consumir_ia`
-- suma y compara en la misma sentencia: el que llega cuando ya está en el
-- tope no suma.
--
-- `periodo` es 'AAAA-MM' en Buenos Aires, o 'prueba' para los diez días
-- gratis, que no se reinician el primero del mes.
--
-- Solo la service_role: el comercio no tiene por qué poder escribir su
-- propio contador. La plataforma lo lee para ver quién usa cuánto.
-- ============================================================

create table if not exists uso_ia (
  empresa_id  uuid not null references empresas(id) on delete cascade,
  periodo     text not null,
  tipo        text not null check (tipo in ('pregunta', 'remito')),
  cantidad    integer not null default 0,
  actualizado timestamptz not null default now(),
  primary key (empresa_id, periodo, tipo)
);

alter table uso_ia enable row level security;
revoke all on uso_ia from anon, authenticated;
grant select on uso_ia to authenticated;

drop policy if exists uso_ia_plataforma on uso_ia;
create policy uso_ia_plataforma on uso_ia
  for select to authenticated using (es_plataforma());

-- Devuelve cuántas quedan después de esta, o null si ya no quedaba ninguna
-- (y entonces no suma).
create or replace function public.consumir_ia(p_empresa uuid, p_periodo text, p_tipo text, p_tope integer)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_cantidad integer;
begin
  if coalesce(p_tope, 0) <= 0 then
    return null;
  end if;

  insert into uso_ia as u (empresa_id, periodo, tipo, cantidad)
  values (p_empresa, p_periodo, p_tipo, 1)
  on conflict (empresa_id, periodo, tipo) do update
    set cantidad = u.cantidad + 1, actualizado = now()
    where u.cantidad < p_tope
  returning cantidad into v_cantidad;

  if v_cantidad is null then
    return null;
  end if;
  return p_tope - v_cantidad;
end;
$$;

-- Si Anthropic no contestó, la pregunta no se cobra: se devuelve.
create or replace function public.devolver_ia(p_empresa uuid, p_periodo text, p_tipo text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update uso_ia set cantidad = greatest(cantidad - 1, 0), actualizado = now()
  where empresa_id = p_empresa and periodo = p_periodo and tipo = p_tipo;
$$;

revoke all on function public.consumir_ia(uuid, text, text, integer) from public, anon, authenticated;
revoke all on function public.devolver_ia(uuid, text, text) from public, anon, authenticated;
grant execute on function public.consumir_ia(uuid, text, text, integer) to service_role;
grant execute on function public.devolver_ia(uuid, text, text) to service_role;
