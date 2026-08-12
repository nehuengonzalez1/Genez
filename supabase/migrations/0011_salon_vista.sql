/* ============================================================
   0011 · LA VISTA DEL SALÓN
   ============================================================

   La pantalla del salón muestra cada mesa con lo que un mozo necesita
   decidir de un vistazo: si está ocupada, cuánto lleva consumido, hace
   cuánto está sentada la gente y si hay algo esperando en cocina.

   Se calcula acá y no en el navegador porque, para armarlo del otro lado,
   habría que traerse todas las líneas de todas las comandas abiertas cada
   vez que se refresca el salón. Con veinte mesas ocupadas eso es traer el
   servicio entero para dibujar veinte recuadros.
   ============================================================ */

create view salon_vista
with (security_invoker = true) as
select
  r.id,
  r.empresa_id,
  r.sucursal_id,
  r.tipo,
  r.nombre,
  r.sector,
  r.capacidad,
  r.orden,
  r.activo,

  o.id          as comanda_id,
  o.abierta_en,
  o.usuario_id  as abierta_por,

  coalesce(l.consumido, 0)   as consumido,
  coalesce(l.items, 0)       as items,
  coalesce(l.en_cocina, 0)   as en_cocina,
  coalesce(l.listos, 0)      as listos,

  /* Minutos desde que se ocupó. Sirve para pintar de otro color la mesa
     que lleva dos horas y todavía no pidió el postre. */
  case when o.abierta_en is null then null
       else floor(extract(epoch from (now() - o.abierta_en)) / 60)::int
  end as minutos

from recursos r

left join operaciones o
  on o.recurso_id = r.id and o.estado = 'abierta' and o.tipo = 'comanda'

left join (
  select
    operacion_id,
    sum(total)                                              as consumido,
    sum(cantidad)                                           as items,
    count(*) filter (where estado in ('pedido', 'preparando')) as en_cocina,
    count(*) filter (where estado = 'listo')                as listos
  from operacion_lineas
  where estado <> 'anulada'
  group by operacion_id
) l on l.operacion_id = o.id;

comment on view salon_vista is
  'Cada mesa con su comanda abierta, lo consumido y lo que espera en cocina. Es lo que dibuja la pantalla del salón.';
