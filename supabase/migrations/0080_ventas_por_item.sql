/* ============================================================
   0080 · LO QUE SE VENDIÓ DE CADA COSA, DE VERDAD
   ============================================================

   Los tres cuadros de Informes —los que más facturan, los que más
   ganancia dejan y las ventas por rubro— no miraban el historial: tomaban
   la venta de los últimos treinta días de `items_vista.u30` y la
   multiplicaban por el período elegido. Con 7, 30 y 90 días la diferencia
   era chica y quedaba implícita. Desde que el período lo elige el que
   mira, alguien pide 365 y lee una proyección de un mes como si fuera un
   año.

   Esta función devuelve lo que pasó: unidades, venta y costo por producto
   en el período, leídos de `operacion_lineas`.

   EL MISMO CRITERIO QUE `ventas_diarias`
   --------------------------------------
   Operación confirmada de tipo `venta` o `comanda` —una mesa cobrada es
   una venta aunque su tipo siga siendo comanda— y el corte del día en la
   zona horaria del comercio. Si los criterios difirieran, el total de los
   cuadros no cerraría con el del gráfico de arriba y no habría forma de
   saber cuál de los dos mirar.

   LO QUE NO CIERRA, Y POR QUÉ
   ---------------------------
   El descuento y el recargo de una venta viven en la operación, no
   repartidos en sus líneas. Así que la suma de esta función da el
   SUBTOTAL del período y no el total: si el comercio hace descuentos, va
   a quedar por encima de lo que muestra `ventas_diarias`.

   Repartir el descuento entre las líneas sería inventar un criterio
   —¿proporcional al importe?, ¿al margen?— y dejaría dos números
   distintos según desde dónde se mire. Se prefiere decirlo.

   UN PRODUCTO BORRADO SIGUE APARECIENDO
   -------------------------------------
   `operacion_lineas.item_id` queda en null cuando se borra el producto,
   pero `descripcion` guarda el nombre con el que se vendió. Esas líneas
   se agrupan por su descripción: lo vendido no desaparece del informe
   porque alguien haya limpiado el catálogo después.

   Pide la empresa explícita —regla 6 de ARQUITECTURA.md— y corre con los
   permisos de quien llama, así RLS decide qué ve.
   ============================================================ */

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
  select o.id
  from operaciones o, desde
  where o.empresa_id = p_empresa
    and o.tipo in ('venta', 'comanda')
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
    l.cantidad,
    l.total,
    l.cantidad * l.costo_unitario                          as costo
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
  'Unidades, venta y costo por producto en los últimos p_dias días, con el mismo criterio que ventas_diarias. La venta es la suma de las líneas: no incluye el descuento ni el recargo de la operación, que no están repartidos por línea.';

grant execute on function ventas_por_item(uuid, integer) to authenticated;
