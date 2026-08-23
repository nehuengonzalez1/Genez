/* ============================================================
   0042 · INFORMES DE UN NEGOCIO QUE VENDE HORAS
   ============================================================

   El informe que había era el de un minimercado: qué se vende, qué
   margen deja, qué producto perdió rentabilidad. Nada de eso aplica a
   una estética. Un negocio de turnos tiene un número propio que el
   comercio no tiene, y es el que decide casi todo: **cuánto de lo que
   se puede vender se vendió**.

   Ingresos y asistencia salen de tablas que ya están y se leen de una;
   la ocupación no. Cruza `reservas`, `horarios`, `excepciones`,
   `recursos` y `personal` y hay que recorrer día por día el período,
   así que va acá abajo y no en el navegador. Regla 5.

   DOS OCUPACIONES QUE NO SON LA MISMA
   -----------------------------------
   Una sala de mat para ocho con tres personas adentro está ocupada al
   100% del tiempo y al 37% de su capacidad. Las dos cosas son ciertas y
   sirven para decisiones distintas: la primera dice si hay lugar para
   abrir otra clase, la segunda si esa clase conviene que exista. Por eso
   la función devuelve las dos y la pantalla las muestra separadas.

   LAS HORAS QUE OFRECE UNA SALA
   -----------------------------
   `horarios` guarda el horario de una persona o de un recurso, pero en
   la práctica nadie carga el de una sala: se carga el de la gente. Así
   que las horas que ofrece un espacio se toman de cuándo abre el local
   —de la primera hora a la última en que hay alguien trabajando ese
   día—, que es la definición que usa cualquiera al mirar una grilla. Si
   algún día se cargan horarios propios de una sala, mandan esos.

   UNA CLASE OCUPA UNA VEZ
   -----------------------
   Seis inscripciones a la misma clase de reformer no son seis horas de
   sala: son una. Por eso todo lo que mide tiempo filtra `clase_id is
   null` y son las inscripciones las que cuentan para la capacidad. Es el
   mismo criterio con el que las liquidaciones cuentan las horas del
   equipo, y tiene que seguir siendo el mismo: si un día dejan de
   coincidir, la ocupación de una profesora y lo que se le paga van a
   contar cosas distintas del mismo día de trabajo.
   ============================================================ */

/* ------------------------------------------------------------
   1 · La ocupación
   ------------------------------------------------------------ */

create or replace function informe_ocupacion(
  p_empresa uuid,
  p_desde   date,
  p_hasta   date
)
returns table (
  ambito    text,
  id        uuid,
  nombre    text,
  detalle   text,
  ofrecidos numeric,
  ocupados  numeric,
  lugares   numeric,
  tomados   numeric
)
language sql
stable
as $$
  with dias as (
    select d::date as dia, extract(dow from d)::smallint as dow
      from generate_series(p_desde, p_hasta, interval '1 day') d
  ),

  /* Los minutos que cada persona ofreció cada día: su horario de ese día
     de la semana, menos lo que le pisa una ausencia. La resta es una
     intersección de intervalos y no un "ese día no trabajó": media
     jornada de vacaciones tiene que restar media jornada. */
  turno_persona as (
    select h.personal_id, d.dia,
           greatest(0, extract(epoch from (h.hasta - h.desde)) / 60
             - coalesce((
                 select sum(greatest(0, extract(epoch from (
                          least(x.hasta, d.dia + h.hasta) - greatest(x.desde, d.dia + h.desde)
                        )) / 60))
                   from excepciones x
                  where x.empresa_id = p_empresa
                    and x.personal_id = h.personal_id
                    and x.desde < d.dia + h.hasta
                    and x.hasta > d.dia + h.desde
               ), 0)
           ) as minutos
      from horarios h
      join dias d on d.dow = h.dia
     where h.empresa_id = p_empresa and h.activo and h.personal_id is not null
  ),

  /* Cuándo abre el local: de la primera a la última hora en que hay
     alguien. Es lo que se le puede ofrecer a una sala. */
  apertura as (
    select d.dia,
           coalesce(extract(epoch from (max(h.hasta) - min(h.desde))) / 60, 0) as minutos
      from dias d
      left join horarios h on h.dia = d.dow and h.empresa_id = p_empresa and h.activo
     group by d.dia
  ),

  /* Lo agendado. Una clase cuenta una vez —por eso `clase_id is null`— y
     lo cancelado no ocupa nada: el lugar quedó libre. */
  agendado as (
    select r.personal_id, r.recurso_id, r.duracion_min, r.cupo, r.id
      from reservas r
     where r.empresa_id = p_empresa
       and r.clase_id is null
       and r.estado <> 'cancelada'
       and r.desde >= p_desde
       and r.desde < (p_hasta + 1)
  ),

  inscriptos as (
    select i.clase_id, count(*) as tomados
      from reservas i
     where i.empresa_id = p_empresa
       and i.clase_id is not null
       and i.estado not in ('cancelada', 'ausente')
     group by i.clase_id
  )

  select
    'profesional'::text,
    per.id,
    per.nombre,
    coalesce(per.especialidad, ''),
    coalesce((select sum(t.minutos) from turno_persona t where t.personal_id = per.id), 0),
    coalesce((select sum(a.duracion_min) from agendado a where a.personal_id = per.id), 0),
    coalesce((select sum(a.cupo) from agendado a where a.personal_id = per.id and a.cupo is not null), 0),
    coalesce((select sum(ins.tomados) from agendado a
                join inscriptos ins on ins.clase_id = a.id
               where a.personal_id = per.id), 0)
  from personal per
 where per.empresa_id = p_empresa and per.activo and per.tipo = 'profesional'

  union all

  select
    'sala'::text,
    re.id,
    re.nombre,
    coalesce(re.tipo, ''),
    /* Si la sala tiene horario propio cargado, gana sobre la apertura
       general: alguien se tomó el trabajo de decir que ese box abre
       distinto. */
    coalesce(
      nullif((select sum(extract(epoch from (h.hasta - h.desde)) / 60)
                from horarios h join dias d on d.dow = h.dia
               where h.empresa_id = p_empresa and h.activo and h.recurso_id = re.id), 0),
      (select sum(ap.minutos) from apertura ap), 0),
    coalesce((select sum(a.duracion_min) from agendado a where a.recurso_id = re.id), 0),
    coalesce((select sum(a.cupo) from agendado a where a.recurso_id = re.id and a.cupo is not null), 0),
    coalesce((select sum(ins.tomados) from agendado a
                join inscriptos ins on ins.clase_id = a.id
               where a.recurso_id = re.id), 0)
  from recursos re
 where re.empresa_id = p_empresa and re.activo
$$;

comment on function informe_ocupacion is
  'Cuánto de lo que se podía vender se vendió, por profesional y por sala: minutos ofrecidos contra agendados, y lugares de clase contra tomados. Las dos ocupaciones son distintas y las dos importan.';

/* No es `security definer` a propósito: corre con los permisos de quien
   llama, así RLS se aplica igual que en una consulta común. El
   `empresa_id` va como parámetro obligatorio por la regla 6 —RLS contesta
   si podés ver algo, no de qué comercio es—. */
grant execute on function informe_ocupacion(uuid, date, date) to authenticated;


/* ------------------------------------------------------------
   2 · La sección en el menú

   El grupo Reportes ya estaba; lo que cambia es el módulo que cuelga de
   él. `reportes` sigue existiendo para el minimercado y el bar, con su
   pantalla de siempre: no se toca nada de lo que hoy funciona. Lo que
   ve una estética es otro módulo, `informes`, porque es otro informe.

   Es la misma decisión que se tomó con Finanzas en 0038: una clave nueva
   antes que un `if` por rubro adentro de una pantalla compartida.
   ------------------------------------------------------------ */

update rubros set menu = jsonb_set(
  menu, '{8}',
  '{
    "clave":"reportes", "nombre":"Reportes", "i":"barras",
    "modulos":[
      {"k":"informes","n":"Informes","i":"barras","d":"Ingresos, ocupación, asistencia y clientes"}
    ]
  }'::jsonb
)
where clave = 'servicios'
  and menu -> 8 ->> 'clave' = 'reportes';

do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  /* `reportes` sale y entra `informes`. Dejarlo contratado sería dejar
     una pantalla de minimercado alcanzable desde una estética. */
  update empresas
     set modulos = array(
           select distinct unnest(array_remove(modulos, 'reportes') || array['informes']))
   where nombre = 'Almha';

  perform set_config('request.jwt.claims', '', true);
end;
$$;

select
  g ->> 'clave' as seccion,
  jsonb_array_length(g -> 'modulos') as modulos,
  g -> 'modulos' -> 0 ->> 'k' as primero
from rubros r, jsonb_array_elements(r.menu) with ordinality x(g, orden)
where r.clave = 'servicios' and g ->> 'clave' = 'reportes';
