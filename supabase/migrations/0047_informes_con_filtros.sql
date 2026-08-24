/* ============================================================
   0047 · EL INFORME, FILTRABLE Y CON EL EQUIPO ADENTRO
   ============================================================

   Dos cosas para que Reportes pueda ser lo que tiene que ser: que los
   filtros del encabezado lleguen hasta el fondo, y que se pueda decir
   cuánto factura cada profesional.

   LOS FILTROS VAN EN UN JSONB Y NO EN CUATRO PARÁMETROS
   -----------------------------------------------------
   `informe_ocupacion` ya se llamaba con tres argumentos y tiene sus
   pruebas escritas así. Sumarle cuatro parámetros sueltos obligaba a
   tocarlas y a repetir la firma cada vez que aparezca un filtro nuevo.
   Con un `jsonb` con valor por defecto, la llamada vieja sigue andando y
   la nueva pasa lo que quiera:

     informe_ocupacion(emp, desde, hasta)
     informe_ocupacion(emp, desde, hasta, '{"area":"Pilates"}')

   Filtra por área, profesional, prestación y sala. Todos opcionales.

   CUÁNTO FACTURA UN PROFESIONAL: DOS CAMINOS, NO UNO
   --------------------------------------------------
   Un turno suelto cobrado apunta a su venta con `reservas.operacion_id`,
   así que ahí la plata es directa.

   Una clase de pilates no. La persona pagó un pack de ocho hace tres
   semanas y hoy usa la cuarta. Si solo se contara lo directo, la profe
   que da todas las clases de mat aparecería facturando cero, que es
   exactamente al revés de lo que pasa.

   Entonces el abono se reparte entre las clases que se usaron: un pack de
   $100.000 consumido en ocho clases pone $12.500 en cada una. Es una
   regla de imputación y como tal está dicha en la pantalla, no escondida
   acá: quien lee el número tiene que saber cómo se armó.

   Se divide por las clases consumidas de ese abono **en toda su vida** y
   no por las del período. Si se dividiera por las del período, el mismo
   pack repartiría distinto según qué fechas se miren, y dos informes del
   mismo negocio dirían cosas diferentes.

   Lo no consumido no se imputa a nadie: es plata cobrada por clases que
   todavía no se dieron, y en el informe del mes que viene aparecerá donde
   corresponda.
   ============================================================ */

/* ------------------------------------------------------------
   1 · La ocupación, ahora filtrable
   ------------------------------------------------------------ */

/* Agregar el parámetro no reemplaza: crea una sobrecarga, y quedaban las
   dos funciones vivas con la vieja sin filtros. Se tira primero. Las
   llamadas de tres argumentos que ya existen —las pruebas, entre otras—
   siguen andando contra la nueva porque el cuarto tiene valor por
   defecto. */
drop function if exists informe_ocupacion(uuid, date, date);

create or replace function informe_ocupacion(
  p_empresa uuid,
  p_desde   date,
  p_hasta   date,
  p_filtros jsonb default '{}'::jsonb
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
  with f as (
    select nullif(p_filtros ->> 'area', '')        as area,
           nullif(p_filtros ->> 'personal', '')::uuid as personal,
           nullif(p_filtros ->> 'item', '')::uuid  as item,
           nullif(p_filtros ->> 'recurso', '')::uuid as recurso
  ),
  dias as (
    select d::date as dia, extract(dow from d)::smallint as dow
      from generate_series(p_desde, p_hasta, interval '1 day') d
  ),

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

  apertura as (
    select d.dia,
           coalesce(extract(epoch from (max(h.hasta) - min(h.desde))) / 60, 0) as minutos
      from dias d
      left join horarios h on h.dia = d.dow and h.empresa_id = p_empresa and h.activo
     group by d.dia
  ),

  /* El filtro se aplica sobre lo agendado y no sobre el catálogo: las
     horas ofrecidas de una sala no cambian porque se mire una prestación
     en particular, lo que cambia es cuánto de esas horas se usó para eso.
     Al revés daría porcentajes por encima de cien. */
  agendado as (
    select r.personal_id, r.recurso_id, r.duracion_min, r.cupo, r.id
      from reservas r
      left join items i on i.id = r.item_id
      cross join f
     where r.empresa_id = p_empresa
       and r.clase_id is null
       and r.estado <> 'cancelada'
       and r.desde >= p_desde
       and r.desde < (p_hasta + 1)
       and (f.area     is null or i.categoria   = f.area)
       and (f.personal is null or r.personal_id = f.personal)
       and (f.item     is null or r.item_id     = f.item)
       and (f.recurso  is null or r.recurso_id  = f.recurso)
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
  cross join f
 where per.empresa_id = p_empresa and per.activo and per.tipo = 'profesional'
   and (f.personal is null or per.id = f.personal)

  union all

  select
    'sala'::text,
    re.id,
    re.nombre,
    coalesce(re.tipo, ''),
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
  cross join f
 where re.empresa_id = p_empresa and re.activo
   and (f.recurso is null or re.id = f.recurso)
$$;

comment on function informe_ocupacion(uuid, date, date, jsonb) is
  'Cuánto de lo que se podía vender se vendió, por profesional y por sala. Los filtros se aplican a lo agendado y no a la capacidad: la capacidad no cambia porque se mire una prestación.';

grant execute on function informe_ocupacion(uuid, date, date, jsonb) to authenticated;


/* ------------------------------------------------------------
   2 · Cuánto trabajó y cuánto facturó cada uno
   ------------------------------------------------------------ */

create or replace function informe_equipo(
  p_empresa uuid,
  p_desde   date,
  p_hasta   date,
  p_filtros jsonb default '{}'::jsonb
)
returns table (
  personal_id  uuid,
  nombre       text,
  especialidad text,
  turnos       int,
  cumplidos    int,
  ausentes     int,
  clases       int,
  alumnos      int,
  directo      numeric,
  por_abono    numeric
)
language sql
stable
as $$
  with f as (
    select nullif(p_filtros ->> 'area', '')           as area,
           nullif(p_filtros ->> 'personal', '')::uuid as personal,
           nullif(p_filtros ->> 'item', '')::uuid     as item,
           nullif(p_filtros ->> 'recurso', '')::uuid  as recurso
  ),

  /* Cuánto vale una clase de cada abono: lo que se pagó dividido por las
     clases que se usaron en toda la vida del abono. Ver la cabecera. */
  valor_clase as (
    select a.id,
           case when u.usadas > 0 then o.total / u.usadas else 0 end as valor
      from abonos a
      join operaciones o on o.id = a.operacion_id and o.estado = 'confirmada'
      cross join lateral (
        select count(*) as usadas
          from reservas r
         where r.abono_id = a.id and r.estado not in ('cancelada')
      ) u
     where a.empresa_id = p_empresa and not a.anulado
  ),

  /* Lo que hizo cada uno en el período. Las inscripciones a una clase
     cuentan para asistencia y para el reparto del abono; la clase en sí
     cuenta como clase dictada. Son dos unidades distintas y las dos
     hacen falta. */
  hechos as (
    select r.personal_id,
           r.estado,
           r.cupo,
           r.clase_id,
           coalesce(o.total, 0)      as directo,
           coalesce(vc.valor, 0)     as del_abono
      from reservas r
      left join items i on i.id = r.item_id
      left join operaciones o on o.id = r.operacion_id and o.estado = 'confirmada'
      left join valor_clase vc on vc.id = r.abono_id
      cross join f
     where r.empresa_id = p_empresa
       and r.personal_id is not null
       and r.desde >= p_desde
       and r.desde < (p_hasta + 1)
       and (f.area     is null or i.categoria   = f.area)
       and (f.personal is null or r.personal_id = f.personal)
       and (f.item     is null or r.item_id     = f.item)
       and (f.recurso  is null or r.recurso_id  = f.recurso)
  )

  select
    per.id,
    per.nombre,
    coalesce(per.especialidad, ''),
    /* Turnos atendidos: los de a uno más los alumnos de las clases. La
       clase vacía no es un turno. */
    coalesce(count(*) filter (where h.cupo is null), 0)::int,
    coalesce(count(*) filter (where h.cupo is null and h.estado = 'cumplida'), 0)::int,
    coalesce(count(*) filter (where h.cupo is null and h.estado = 'ausente'), 0)::int,
    coalesce(count(*) filter (where h.cupo is not null), 0)::int,
    coalesce(count(*) filter (where h.clase_id is not null and h.estado not in ('cancelada', 'ausente')), 0)::int,
    coalesce(sum(h.directo) filter (where h.estado <> 'cancelada'), 0),
    coalesce(sum(h.del_abono) filter (where h.estado <> 'cancelada'), 0)
  from personal per
  cross join f
  left join hechos h on h.personal_id = per.id
 where per.empresa_id = p_empresa and per.activo and per.tipo = 'profesional'
   and (f.personal is null or per.id = f.personal)
 group by per.id, per.nombre, per.especialidad, per.orden
 order by per.orden, per.nombre
$$;

comment on function informe_equipo(uuid, date, date, jsonb) is
  'Qué hizo y cuánto facturó cada profesional. El ingreso viene por dos caminos: lo cobrado derecho al turno y la parte del abono que consumió cada clase.';

grant execute on function informe_equipo(uuid, date, date, jsonb) to authenticated;
