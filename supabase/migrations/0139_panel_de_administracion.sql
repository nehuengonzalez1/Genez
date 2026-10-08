/* ============================================================
   0139 · ADMINISTRACIÓN: PANEL, MI PLAN Y AJUSTES
   ============================================================

   La 0138 juntó Equipo, Permisos y Ajustes al pie del menú. Nehuen pidió
   lo que tiene Vendi (08/10): una sección Administración con tres
   entradas —el panel de administración, la suscripción y la
   configuración— y no los módulos sueltos.

   Queda así, en los tres rubros:
     Administración: Panel de administración · Mi plan · Ajustes
   Equipo y Permisos pasan a estar adentro del panel (una tarjeta cada
   uno). En servicios, Equipo sigue además en "Clientes y equipo", como
   estaba.

   `administracion` y `plan` no son módulos que se contraten: son puertas.
   El navegador decide si se ven (el panel, si hay algo que administrar
   adentro; el plan, con Ajustes). No cambia qué puede hacer cada uno.

   Si el menú pierde o gana algo que no sea lo de arriba, falla.
   ============================================================ */

create temp table menu_antes as select clave, menu from rubros;

create function pg_temp.claves(p_menu jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(m ->> 'k' order by m ->> 'k'), '{}')
  from jsonb_array_elements(p_menu) g, jsonb_array_elements(g -> 'modulos') m
$$;

/* El de Ajustes se toma del menú tal como está (texto, ícono, bajada). */
update rubros r set menu = (
  select jsonb_agg(
    case when g ->> 'clave' = 'administracion' then g || jsonb_build_object('modulos', jsonb_build_array(
      jsonb_build_object('k', 'administracion', 'n', 'Panel de administración', 'i', 'admin',
        'd', 'Equipo, permisos, tu plan y la configuración, en un solo lugar'),
      jsonb_build_object('k', 'plan', 'n', 'Mi plan', 'i', 'tarjeta',
        'd', 'El plan que tenés, cuánto pagás, cambiarlo o darlo de baja'),
      (select m from jsonb_array_elements(g -> 'modulos') m where m ->> 'k' = 'ajustes')
    ))
    else g end
    order by o)
  from jsonb_array_elements(r.menu) with ordinality as e(g, o)
)
where exists (select 1 from jsonb_array_elements(r.menu) g where g ->> 'clave' = 'administracion');

do $$
declare
  r record;
  esperado text[];
begin
  for r in select a.clave, a.menu as antes, n.menu as despues from menu_antes a join rubros n using (clave) loop
    /* Lo que tiene que quedar: lo de antes, sin Equipo ni Permisos en
       Administración (Equipo puede seguir en otra sección), más las dos
       puertas nuevas. */
    select coalesce(array_agg(k order by k), '{}') into esperado from (
      select m ->> 'k' as k
        from jsonb_array_elements(r.antes) g, jsonb_array_elements(g -> 'modulos') m
       where not (g ->> 'clave' = 'administracion' and m ->> 'k' in ('equipo', 'permisos'))
      union all select 'administracion' union all select 'plan'
    ) x;
    if pg_temp.claves(r.despues) <> esperado then
      raise exception 'El menú de % no quedó como se esperaba: %, y tenía que ser %',
        r.clave, pg_temp.claves(r.despues), esperado;
    end if;
  end loop;
end $$;
