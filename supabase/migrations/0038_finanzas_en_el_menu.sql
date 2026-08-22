/* ============================================================
   0038 · FINANZAS ABSORBE A CAJA
   ============================================================

   Hasta acá la sección Finanzas tenía un solo módulo, Caja, y por eso se
   dibujaba como un renglón suelto. Ahora tiene la pantalla completa —el
   mes, los movimientos, lo que falta cobrar y las liquidaciones— con la
   caja del día adentro como una pestaña más.

   Caja sale del menú pero **no se elimina ni se rehace**: sigue siendo la
   misma pantalla de siempre, resolviendo lo suyo, que es el día y no el
   mes. Solo cambió por dónde se llega.
   ============================================================ */

update rubros set menu = jsonb_set(
  menu, '{5}',
  '{
    "clave":"finanzas", "nombre":"Finanzas", "i":"billetera",
    "modulos":[
      {"k":"finanzas","n":"Finanzas","i":"billetera","d":"Caja, ingresos, egresos y lo que se le paga al equipo"}
    ]
  }'::jsonb
)
where clave = 'servicios'
  and menu -> 5 ->> 'clave' = 'finanzas';

do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  update empresas
     set modulos = array(select distinct unnest(modulos || array['finanzas']))
   where nombre = 'Almha';

  perform set_config('request.jwt.claims', '', true);
end;
$$;

select
  g ->> 'clave' as seccion,
  coalesce(g ->> 'nombre', '(sin rótulo)') as rotulo,
  jsonb_array_length(g -> 'modulos') as modulos,
  coalesce(g ->> 'proximo', 'false') as proximo
from rubros r, jsonb_array_elements(r.menu) with ordinality x(g, orden)
where r.clave = 'servicios'
order by x.orden;
