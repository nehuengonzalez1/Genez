/* ============================================================
   0033 · LA AGENDA DEJA DE ESTAR APAGADA
   ============================================================

   La sección Agenda estaba declarada como `proximo` desde la 0028: se
   dibujaba en gris para que se viera a dónde iba el sistema, sin fingir
   que andaba. Ahora tiene pantalla y backend, así que se enciende.

   Las clases grupales, la lista de espera y la vista de mes siguen
   apagadas adentro de la pantalla, con el mismo criterio.
   ============================================================ */

update rubros set menu = jsonb_set(
  menu, '{1}',
  '{
    "clave":"agenda", "nombre":"Agenda", "i":"agenda",
    "modulos":[
      {"k":"agenda","n":"Agenda","i":"agenda","d":"Turnos del día, quién los da y en qué sala"}
    ]
  }'::jsonb
)
where clave = 'servicios'
  and menu -> 1 ->> 'clave' = 'agenda';   /* si el orden cambió, no toca nada */

/* Almha la contrata. Igual que en la 0031, hay que tomar la identidad de
   plataforma: `proteger_lo_comercial` no deja que un script sin nadie
   detrás cambie los módulos de un comercio. */
do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  update empresas
     set modulos = array(select distinct unnest(modulos || array['agenda']))
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
