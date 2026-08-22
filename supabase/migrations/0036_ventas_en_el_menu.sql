/* ============================================================
   0036 · VENTAS DEJA DE ESTAR APAGADA
   ============================================================

   La sección estaba declarada como `proximo` desde la 0028. Ahora tiene
   pantalla y backend: planes en el catálogo, abonos con su saldo contado
   y el consumo al reservar.

   Presupuestos y membresías con cobro automático siguen sin existir, y
   por eso no se listan.
   ============================================================ */

update rubros set menu = jsonb_set(
  menu, '{4}',
  '{
    "clave":"ventas", "nombre":"Ventas", "i":"bolsa",
    "modulos":[
      {"k":"ventas","n":"Ventas","i":"bolsa","d":"Abonos, packs y planes"}
    ]
  }'::jsonb
)
where clave = 'servicios'
  and menu -> 4 ->> 'clave' = 'ventas';

do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  update empresas
     set modulos = array(select distinct unnest(modulos || array['ventas']))
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
