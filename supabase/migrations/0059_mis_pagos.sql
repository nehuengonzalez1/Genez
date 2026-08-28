/* ============================================================
   0059 · LO QUE PAGUÉ
   ============================================================

   La pantalla de pagos de la maqueta. Hasta ahora el cliente veía sus
   turnos y sus abonos y no lo que pagó, que es de las pocas cosas que una
   persona busca sola y sin preguntarle a nadie: cuánto salió, cuándo, y
   con qué lo pagué.

   El dato existe entero desde siempre —`pagos` cuelga de `operaciones`, y
   `operaciones.cliente_id` dice de quién es— y no había forma de leerlo
   del lado del cliente.

   COLUMNA POR COLUMNA, COMO TODO LO DEMÁS
   ---------------------------------------
   `pagos` tiene `recargo` y `referencia`. La referencia es el número que
   devuelve Mercado Pago y sirve para conciliar del lado del comercio; el
   recargo es una cuenta interna. Ninguna de las dos sale.

   Si esto fuera una política de RLS sobre `pagos`, las dos saldrían, y
   además saldría sola cualquier columna que se agregue mañana. Es la
   razón por la que el cliente lee funciones y no tablas, escrita en el
   encabezado de `src/datos/cliente.js`.

   EL CONCEPTO ES LO QUE COMPRÓ, NO EL NÚMERO DE LA OPERACIÓN
   ----------------------------------------------------------
   "Plan 2 por semana" y no "Operación 4f2a…". Sale del abono si ese pago
   compró uno, y si no de la primera línea de la operación. Si no hay ni
   una cosa ni la otra queda "Compra", que es cierto y no dice de más.

   UN PAGO NO ES UNA OPERACIÓN
   ---------------------------
   Se devuelve un renglón por pago y no por operación, a propósito: una
   cuenta que se pagó mitad en efectivo y mitad con tarjeta son dos pagos,
   y juntarlos en uno perdería con qué se pagó cada parte. Es la misma
   decisión que la comanda ya tomó al dividir la cuenta.
   ============================================================ */

create or replace function public.mis_pagos(p_desde date default null)
returns table (
  id       uuid,
  empresa  text,
  fecha    timestamptz,
  monto    numeric,
  medio    text,
  concepto text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    e.nombre,
    p.fecha,
    p.monto,
    p.medio,
    coalesce(
      (select a.nombre from abonos a where a.operacion_id = o.id order by a.creado_en limit 1),
      (select coalesce(nullif(ol.descripcion, ''), i.nombre)
         from operacion_lineas ol
         left join items i on i.id = ol.item_id
        where ol.operacion_id = o.id
          and ol.estado is distinct from 'anulada'
        limit 1),
      'Compra'
    )
  from pagos p
  join operaciones o on o.id = p.operacion_id
  join empresas e on e.id = p.empresa_id
 where o.cliente_id in (select public.mis_fichas())
   and p.fecha >= coalesce(p_desde, '-infinity'::date)
 order by p.fecha desc
$$;

grant execute on function public.mis_pagos(date) to authenticated;
