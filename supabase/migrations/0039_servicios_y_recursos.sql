/* ============================================================
   0039 · SERVICIOS Y RECURSOS
   ============================================================

   Esta sección no necesita tablas nuevas: las prestaciones ya son `items`
   con `tipo = 'servicio'` y las salas ya son `recursos`. Lo que faltaba
   era la pantalla, y dos cosas chicas de acá.

   Se agrega `equipamiento` a los tipos de recurso. Una camilla es un
   lugar donde alguien se acuesta; un reformer o una máquina de rayos es
   una cosa que se reserva y puede moverse de sala. Distinguirlos importa
   el día que haya que decir "el reformer 2 está en mantenimiento" sin
   bloquear la sala entera.
   ============================================================ */

alter table recursos drop constraint recursos_tipo_valido;

alter table recursos add constraint recursos_tipo_valido check (
  tipo in ('mesa', 'habitacion', 'sillon', 'bahia', 'cancha',
           'sala', 'camilla', 'equipamiento', 'otro')
);

comment on column recursos.tipo is
  'Qué se reserva. Mesa en gastronomía; sala, camilla o equipamiento en servicios; cancha en un club.';

/* ------------------------------------------------------------
   La sección se enciende
   ------------------------------------------------------------ */

update rubros set menu = jsonb_set(
  menu, '{3}',
  '{
    "clave":"catalogo", "nombre":"Servicios y recursos", "i":"tuerca",
    "modulos":[
      {"k":"servicios","n":"Servicios y recursos","i":"tuerca","d":"Qué se ofrece, cuánto dura, cuánto sale y dónde se hace"}
    ]
  }'::jsonb
)
where clave = 'servicios'
  and menu -> 3 ->> 'clave' = 'catalogo';

do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  update empresas
     set modulos = array(select distinct unnest(modulos || array['servicios']))
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
