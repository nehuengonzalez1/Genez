/* ============================================================
   0096 · LOS INFORMES, DE UNA FECHA A OTRA
   ============================================================

   `ventas_diarias` y `ventas_por_item` contaban "los últimos N días hasta
   hoy". Informes solo podía mirar hacia atrás desde hoy: "otros 45 días",
   nunca "del 1 al 15 de septiembre" (Super 25, 26/09). Para la serie
   diaria se podía pedir más y recortar, pero el ranking de productos no:
   habría sumado lo vendido después del 15.

   Ahora las dos tienen su versión por rango, con el primer y el último
   día incluidos, en la zona horaria del comercio. Las de siempre quedan
   con la misma firma y llaman a las nuevas con "de hace N−1 días a hoy",
   así el criterio —ventas, mesas cobradas y devoluciones restando (0090)—
   vive en un solo lugar y no se desincroniza.
   ============================================================ */

create or replace function ventas_diarias_rango(p_empresa uuid, p_desde date, p_hasta date)
returns table (fecha date, ventas numeric, costo numeric, tickets integer)
language sql
stable
as $$
with zona as (
  select zona_de(p_empresa) as z
),
dias as (
  select d::date as fecha
  from generate_series(p_desde, p_hasta, interval '1 day') as d
),
/* signo: 1 para lo que se vendió, -1 para lo que se devolvió (0090). */
confirmadas as (
  select o.id, o.total, (o.fecha at time zone zona.z)::date as fecha,
         case when o.tipo = 'devolucion' then -1 else 1 end as signo
  from operaciones o, zona
  where o.empresa_id = p_empresa
    and o.tipo in ('venta', 'comanda', 'devolucion')
    and o.estado = 'confirmada'
    and o.fecha >= (p_desde::timestamp at time zone zona.z)
    and o.fecha < ((p_hasta + 1)::timestamp at time zone zona.z)
),
ventas as (
  select fecha,
         sum(signo * total) as ventas,
         count(*) filter (where signo = 1) as tickets
  from confirmadas
  group by fecha
),
costos as (
  select c.fecha, sum(c.signo * l.cantidad * l.costo_unitario) as costo
  from confirmadas c
  join operacion_lineas l on l.operacion_id = c.id
  group by c.fecha
)
select d.fecha,
       coalesce(v.ventas, 0)           as ventas,
       coalesce(c.costo, 0)            as costo,
       coalesce(v.tickets, 0)::integer as tickets
from dias d
left join ventas v on v.fecha = d.fecha
left join costos c on c.fecha = d.fecha
order by d.fecha;
$$;

/* La de siempre: los últimos N días hasta hoy. Resta la devolucion como
   dice 0090, porque llama a la de rango. */
create or replace function ventas_diarias(p_empresa uuid, p_dias integer default 90)
returns table (fecha date, ventas numeric, costo numeric, tickets integer)
language sql
stable
as $$
  select * from ventas_diarias_rango(
    p_empresa,
    (now() at time zone zona_de(p_empresa))::date - (p_dias - 1),
    (now() at time zone zona_de(p_empresa))::date
  );
$$;


create or replace function ventas_por_item_rango(p_empresa uuid, p_desde date, p_hasta date)
returns table (item_id uuid, nombre text, categoria text, unidades numeric, venta numeric, costo numeric)
language sql
stable
as $$
with zona as (
  select zona_de(p_empresa) as z
),
confirmadas as (
  select o.id, case when o.tipo = 'devolucion' then -1 else 1 end as signo
  from operaciones o, zona
  where o.empresa_id = p_empresa
    and o.tipo in ('venta', 'comanda', 'devolucion')
    and o.estado = 'confirmada'
    and o.fecha >= (p_desde::timestamp at time zone zona.z)
    and o.fecha < ((p_hasta + 1)::timestamp at time zone zona.z)
),
lineas as (
  select
    l.item_id,
    /* El nombre de hoy si el producto existe; el que tenía al venderse si
       ya no. Que el informe diga lo mismo que el catálogo mientras el
       catálogo lo tenga. */
    coalesce(i.nombre, l.descripcion)                     as nombre,
    coalesce(nullif(i.categoria, ''), 'Sin rubro')        as categoria,
    c.signo * l.cantidad                                   as cantidad,
    c.signo * l.total                                      as total,
    c.signo * l.cantidad * l.costo_unitario                as costo
  from operacion_lineas l
  join confirmadas c on c.id = l.operacion_id
  left join items i on i.id = l.item_id
)
select
  /* No hay `min()` para uuid, y tampoco haría falta: alcanza con
     cualquiera de las fichas del grupo, que apuntan todas al mismo
     producto. Se descartan los nulos para que un producto que se borró y
     se volvió a crear conserve la ficha viva. */
  (array_agg(item_id) filter (where item_id is not null))[1] as item_id,
  nombre,
  min(categoria)            as categoria,
  sum(cantidad)::numeric    as unidades,
  sum(total)::numeric       as venta,
  sum(costo)::numeric       as costo
from lineas
/* Por nombre y no por item_id: así las líneas de un producto ya borrado
   —que tienen item_id en null— se juntan entre ellas en vez de caer todas
   en un único renglón sin nombre. */
group by nombre
order by venta desc;
$$;

create or replace function ventas_por_item(p_empresa uuid, p_dias integer default 30)
returns table (item_id uuid, nombre text, categoria text, unidades numeric, venta numeric, costo numeric)
language sql
stable
as $$
  select * from ventas_por_item_rango(
    p_empresa,
    (now() at time zone zona_de(p_empresa))::date - (p_dias - 1),
    (now() at time zone zona_de(p_empresa))::date
  );
$$;
