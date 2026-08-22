/* ============================================================
   0031 · EQUIPO ENTRA AL MENÚ
   ============================================================

   En servicios va adentro de "Clientes y equipo", que pasa a ser la
   primera sección con dos módulos. Ahí es donde el menú de diez secciones
   empieza a funcionar de verdad: la sección sigue siendo un renglón y los
   dos módulos se eligen con pestañas arriba del contenido.

   Se lista también en comercio y gastronomía. No aparece hasta que el
   comercio lo contrate —un módulo no contratado no lo ve ni el dueño— pero
   dejarlo listado significa que Super 25 puede contratarlo mañana sin una
   migración.
   ============================================================ */

update rubros set menu = jsonb_set(
  menu,
  '{2,modulos}',
  '[
    {"k":"clientes","n":"Clientes","i":"gente","d":"Ficha, historial y turnos de cada cliente"},
    {"k":"equipo","n":"Equipo","i":"equipo","d":"Quién trabaja, qué hace cada uno y cuándo está"}
  ]'::jsonb
)
where clave = 'servicios'
  and menu -> 2 ->> 'clave' = 'gente';   /* si el orden cambió, no se toca nada */

/* En los otros dos rubros va detrás de clientes, dentro del grupo único. */
update rubros set menu = jsonb_set(
  menu, '{0,modulos}',
  (
    select jsonb_agg(m order by orden)
    from (
      select m, orden from jsonb_array_elements(menu -> 0 -> 'modulos') with ordinality t(m, orden)
      union all
      select '{"k":"equipo","n":"Equipo","i":"equipo","d":"Quién trabaja, qué hace cada uno y cuándo está"}'::jsonb,
             (select orden + 0.5 from jsonb_array_elements(menu -> 0 -> 'modulos') with ordinality u(m2, orden)
               where m2 ->> 'k' = 'clientes')
    ) x
  )
)
where clave in ('minimercado', 'gastronomia')
  and not exists (
    select 1 from jsonb_array_elements(menu -> 0 -> 'modulos') m where m ->> 'k' = 'equipo'
  );

/* ------------------------------------------------------------
   Almha sí lo contrata: es lo que va a alimentar la agenda.

   Hay que tomar la identidad del dueño de plataforma para esto. El
   disparador `proteger_lo_comercial` no deja cambiar plan, módulos ni
   rubro salvo que sea Genez quien lo hace, y una migración corre sin
   nadie autenticado detrás.

   Que haya frenado a esta migración es exactamente lo que tiene que pasar:
   la protección no distingue entre un comercio curioso y un script
   apurado, y está bien que no lo haga.
   ------------------------------------------------------------ */
do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  if v_plataforma is null then
    raise exception 'No hay ningún perfil de plataforma. Corré antes la semilla 0003.';
  end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  update empresas
     set modulos = array(select distinct unnest(modulos || array['equipo']))
   where nombre = 'Almha';

  perform set_config('request.jwt.claims', '', true);
end;
$$;

select
  r.clave,
  (select count(*) from jsonb_array_elements(r.menu) g, jsonb_array_elements(g -> 'modulos') m
    where m ->> 'k' = 'equipo') as equipo_en_el_menu
from rubros r order by r.orden;
