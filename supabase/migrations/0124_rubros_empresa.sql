-- ============================================================
-- 0124 · Módulos de Empresa en gastronomía y servicios
-- ============================================================
--
-- El alta arma Start, Pro y Empresa con los módulos que el rubro puede
-- ofrecer (`rubros.modulos`), cortados por el nivel de cada uno. En
-- gastronomía y servicios esa lista no tenía ningún módulo de nivel
-- Empresa, así que Empresa salía con el mismo precio que Pro: un plan
-- más caro de nombre que no traía nada más.
--
-- Se suman solo módulos que el rubro ya tiene en su menú, para no
-- vender algo que el comercio después no encuentra:
--   gastronomía: Equipo y Asistente con IA
--   servicios:   Equipo, Finanzas, Seguimiento (crm) y Permisos
--
-- `rubros.modulos` solo lo lee la landing (rubros_publicos): no cambia
-- qué ve ningún comercio, que se rige por `comercios.modulos`.

set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

update rubros r
set modulos = (
  select array_agg(distinct k order by k) from unnest(r.modulos || array['equipo', 'asistente']) k
)
where r.clave = 'gastronomia';

update rubros r
set modulos = (
  select array_agg(distinct k order by k) from unnest(r.modulos || array['equipo', 'finanzas', 'crm', 'permisos']) k
)
where r.clave = 'servicios';

do $$
declare g text[]; s text[];
begin
  select modulos into g from rubros where clave = 'gastronomia';
  select modulos into s from rubros where clave = 'servicios';
  if not (g @> array['equipo', 'asistente', 'comandas', 'stock']
          and s @> array['equipo', 'finanzas', 'crm', 'permisos', 'clientes']) then
    raise exception 'No quedó como se esperaba: gastronomía %, servicios %', g, s;
  end if;
  raise notice 'gastronomía: %', g;
  raise notice 'servicios: %', s;
end $$;
