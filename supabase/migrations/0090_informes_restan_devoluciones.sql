/* ============================================================
   0090 · LOS INFORMES RESTAN LAS DEVOLUCIONES
   ============================================================

   Desde 0089 una devolución es una operación aparte (`tipo =
   'devolucion'`) y la venta original queda como fue. Los informes miraban
   solo `tipo in ('venta', 'comanda')`, así que una venta devuelta seguía
   sumando entera: la caja daba bien —el reintegro es un egreso— pero
   Inicio e Informes mostraban plata que se devolvió.

   Las dos funciones quedan iguales salvo por esto:
   - La devolución resta el día en que se hizo, no el de la venta: es
     cuando salió la plata, y un informe de ayer no cambia porque hoy
     alguien trajo algo.
   - No cuenta como ticket: no es una venta más, es menos plata.
   - En `ventas_por_item`, cada renglón devuelto resta sus unidades, su
     venta y su costo al producto. El costo también vuelve: la mercadería
     volvió al stock.

   Las notas de débito (0089) son ventas y ya suman solas.
   ============================================================ */

create or replace function ventas_diarias(p_empresa uuid, p_dias integer default 90)
returns table (fecha date, ventas numeric, costo numeric, tickets integer)
language sql
stable
as $$
with zona as (
  select zona_de(p_empresa) as z
),
desde as (
  select ((now() at time zone zona.z)::date - (p_dias - 1)) as primer_dia,
         (now() at time zone zona.z)::date as ultimo_dia,
         zona.z
  from zona
),
dias as (
  select d::date as fecha
  from desde, generate_series(desde.primer_dia, desde.ultimo_dia, interval '1 day') as d
),
/* signo: 1 para lo que se vendió, -1 para lo que se devolvió. */
confirmadas as (
  select o.id, o.total, (o.fecha at time zone desde.z)::date as fecha,
         case when o.tipo = 'devolucion' then -1 else 1 end as signo
  from operaciones o, desde
  where o.empresa_id = p_empresa
    and o.tipo in ('venta', 'comanda', 'devolucion')
    and o.estado = 'confirmada'
    and o.fecha >= (desde.primer_dia::timestamp at time zone desde.z)
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

comment on function ventas_diarias(uuid, integer) is
  'Ventas, costo y tickets por día de los últimos p_dias días, en la zona del comercio. Las devoluciones (0089) restan el día en que se hicieron y no cuentan como ticket.';


create or replace function ventas_por_item(p_empresa uuid, p_dias integer default 30)
returns table (
  item_id   uuid,
  nombre    text,
  categoria text,
  unidades  numeric,
  venta     numeric,
  costo     numeric
)
language sql
stable
as $$
with zona as (
  select zona_de(p_empresa) as z
),
desde as (
  select ((now() at time zone zona.z)::date - (p_dias - 1)) as primer_dia, zona.z
  from zona
),
confirmadas as (
  select o.id, case when o.tipo = 'devolucion' then -1 else 1 end as signo
  from operaciones o, desde
  where o.empresa_id = p_empresa
    and o.tipo in ('venta', 'comanda', 'devolucion')
    and o.estado = 'confirmada'
    and o.fecha >= (desde.primer_dia::timestamp at time zone desde.z)
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

comment on function ventas_por_item(uuid, integer) is
  'Unidades, venta y costo por producto en los últimos p_dias días, con el mismo criterio que ventas_diarias: las devoluciones restan. La venta es la suma de las líneas: no incluye el descuento ni el recargo de la operación, que no están repartidos por línea.';
