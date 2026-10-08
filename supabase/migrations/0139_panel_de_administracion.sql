/* ============================================================
   0139 · ADMINISTRACIÓN: UN SOLO LUGAR
   ============================================================

   La 0138 juntó Equipo, Permisos y Ajustes al pie del menú, cada uno en
   su renglón. Nehuen comparó con Vendi y Ventario (08/10) y eligió la
   forma de Ventario: un solo lugar con todo lo que se administra, con su
   propio menú adentro —Datos del negocio, Cobros y facturas, Precios y
   stock, Clientes, Equipos, Equipo, Permisos, Mi plan, Mi cuenta—.

   Queda así, en los tres rubros:
     Administración: Administración
   Ajustes, Equipo y Permisos salen del menú y se abren adentro. En
   servicios, Equipo sigue además en "Clientes y equipo", como estaba.

   `administracion` no es un módulo que se contrate: es una puerta. El
   navegador la muestra si hay algo que administrar adentro. No cambia
   qué puede hacer cada uno: cada sección de adentro sigue pidiendo su
   módulo (ajustes, equipo, permisos).

   Se aplica DESPUÉS de publicar el código: el de antes no conoce
   `administracion` y el menú se quedaría sin Ajustes.

   Si el menú pierde o gana algo que no sea lo de arriba, falla.
   ============================================================ */

create temp table menu_antes as select clave, menu from rubros;

create function pg_temp.claves(p_menu jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(m ->> 'k' order by m ->> 'k'), '{}')
  from jsonb_array_elements(p_menu) g, jsonb_array_elements(g -> 'modulos') m
$$;

update rubros r set menu = (
  select jsonb_agg(
    case when g ->> 'clave' = 'administracion' then g || jsonb_build_object('modulos', jsonb_build_array(
      jsonb_build_object('k', 'administracion', 'n', 'Administración', 'i', 'admin',
        'd', 'Tu negocio, cómo se vende, tu gente y tu cuenta, en un solo lugar')
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
    /* Lo que tiene que quedar: lo de antes, sin nada del grupo
       Administración (Equipo puede seguir en otra sección), más la puerta
       nueva. */
    select coalesce(array_agg(k order by k), '{}') into esperado from (
      select m ->> 'k' as k
        from jsonb_array_elements(r.antes) g, jsonb_array_elements(g -> 'modulos') m
       where g ->> 'clave' is distinct from 'administracion'
      union all select 'administracion'
    ) x;
    if pg_temp.claves(r.despues) <> esperado then
      raise exception 'El menú de % no quedó como se esperaba: %, y tenía que ser %',
        r.clave, pg_temp.claves(r.despues), esperado;
    end if;
  end loop;
end $$;
