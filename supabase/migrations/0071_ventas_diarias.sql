/* ============================================================
   0071 · LA SERIE DIARIA DE VENTAS SALE DE LA BASE
   ============================================================

   Los indicadores del comercio —ticket promedio, tickets del mes, la
   comparación con el mes anterior y los gráficos de Inicio e Informes—
   se armaban sobre noventa días de ventas inventados por el generador
   del prototipo, con un "hoy" congelado. Lo que es por producto ya
   salía de `items_vista`; faltaba la serie por día.

   Es una función y no una vista porque la serie tiene que ser continua:
   un día sin ventas es un cero en el gráfico, no un hueco que corre la
   curva. `generate_series` pone los días; las ventas se suman encima.

   QUÉ CUENTA COMO VENTA
   ---------------------
   El mismo criterio que `resumenDelDia`: una operación confirmada de
   tipo `venta` o `comanda` —una mesa cobrada es una venta aunque su tipo
   siga siendo comanda—. Las devoluciones no se restan: hoy no se restan
   en ningún otro lado, y hacerlo solo acá dejaría este número sin cerrar
   con el de la caja.

   El costo sale de las líneas —cantidad por costo unitario al momento de
   vender—, que es lo que permite ganancia por día sin mirar el catálogo
   de hoy.

   EL DÍA ES EL DEL COMERCIO
   -------------------------
   Las fechas son timestamptz; el corte a medianoche se hace en la zona
   del comercio con `zona_de`, igual que en liquidaciones. Sin eso una
   venta de las 22:00 cae en el día siguiente en UTC.

   Pide la empresa explícita —regla 6 de ARQUITECTURA.md— y corre con
   los permisos de quien llama, así RLS decide qué ve.
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
confirmadas as (
  select o.id, o.total, (o.fecha at time zone desde.z)::date as fecha
  from operaciones o, desde
  where o.empresa_id = p_empresa
    and o.tipo in ('venta', 'comanda')
    and o.estado = 'confirmada'
    and o.fecha >= (desde.primer_dia::timestamp at time zone desde.z)
),
ventas as (
  select fecha, sum(total) as ventas, count(*) as tickets
  from confirmadas
  group by fecha
),
costos as (
  select c.fecha, sum(l.cantidad * l.costo_unitario) as costo
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
  'Ventas, costo y tickets por día del comercio, en su zona horaria, para los últimos p_dias días. Serie continua: los días sin ventas van en cero.';
