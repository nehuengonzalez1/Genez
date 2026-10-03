-- ============================================================
-- 0126 · Lo que suma cada plan en Comercio y en Servicios
-- ============================================================
--
-- La landing nueva muestra cada plan por lo que agrega sobre el anterior
-- ("Todo Pro, más:"), armado desde `rubros.modulos` cortado por nivel.
-- Con la lista como estaba, Empresa de Comercio solo sumaba el Asistente
-- y Pro de Servicios casi no se distinguía de Start. Se acordó el 03/10:
--   minimercado (Comercio): Equipo y Permisos, de nivel Empresa
--   servicios:              Abonos (ventas) y Avisos (comunicaciones), de Pro
--
-- Equipo, Abonos y Avisos ya estaban en el menú de su rubro. Permisos no
-- estaba en el de Comercio: se agrega al lado de Ajustes, porque vender
-- un módulo que después no aparece en ningún lado es peor que no venderlo.
--
-- No cambia la pantalla de ningún comercio: el menú se filtra por
-- `comercios.modulos`, y al 03/10 ningún comercio de Comercio tiene
-- Permisos contratado. Almha (servicios) ya tenía Abonos y Avisos.

set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

update rubros r
set modulos = (
  select array_agg(distinct k order by k) from unnest(r.modulos || array['equipo', 'permisos']) k
)
where r.clave = 'minimercado';

update rubros r
set modulos = (
  select array_agg(distinct k order by k) from unnest(r.modulos || array['ventas', 'comunicaciones']) k
)
where r.clave = 'servicios';

-- Permisos en el menú de Comercio, después de Ajustes. Si alguien ya lo
-- había puesto, no se duplica.
do $$
declare
  v_menu jsonb;
  v_grupo int;
  v_pos int;
begin
  select menu into v_menu from rubros where clave = 'minimercado';
  if exists (
    select 1 from jsonb_array_elements(v_menu) g, jsonb_array_elements(g->'modulos') m
    where m->>'k' = 'permisos'
  ) then
    raise notice 'Permisos ya estaba en el menú de minimercado';
    return;
  end if;

  select g.i - 1, m.j - 1 into v_grupo, v_pos
  from jsonb_array_elements(v_menu) with ordinality g(v, i),
       jsonb_array_elements(g.v->'modulos') with ordinality m(v, j)
  where m.v->>'k' = 'ajustes';
  if v_grupo is null then
    raise exception 'El menú de minimercado no tiene Ajustes: no sé dónde poner Permisos';
  end if;

  update rubros
  set menu = jsonb_insert(
    menu,
    array[v_grupo::text, 'modulos', v_pos::text],
    '{"d":"Qué puede hacer cada rol, y quién cambió qué","i":"escudo","k":"permisos","n":"Permisos"}'::jsonb,
    true
  )
  where clave = 'minimercado';
end $$;

do $$
declare c text[]; s text[]; n int;
begin
  select modulos into c from rubros where clave = 'minimercado';
  select modulos into s from rubros where clave = 'servicios';
  select count(*) into n
  from rubros r, jsonb_array_elements(r.menu) g, jsonb_array_elements(g->'modulos') m
  where r.clave = 'minimercado' and m->>'k' = 'permisos';
  if not (c @> array['equipo', 'permisos', 'asistente', 'stock']
          and s @> array['ventas', 'comunicaciones', 'crm', 'permisos']
          and n = 1) then
    raise exception 'No quedó como se esperaba: minimercado %, servicios %, permisos en el menú %', c, s, n;
  end if;
  raise notice 'minimercado: %', c;
  raise notice 'servicios: %', s;
end $$;
