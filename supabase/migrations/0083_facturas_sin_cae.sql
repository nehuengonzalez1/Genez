/* ============================================================
   0083 · LAS FACTURAS QUE ESPERAN SU CAE
   ============================================================

   Una venta que se cobra como factura queda marcada así desde el
   mostrador (`operaciones.comprobante.fiscal`), tenga o no internet en
   ese momento. El CAE llega después: enseguida si ARCA contesta, o
   cuando vuelvan la red o ARCA, desde Caja → Facturas.

   "Esperando CAE" no se guarda en ningún lado: es una venta marcada como
   factura que no tiene comprobante autorizado. Misma regla que el stock y
   que el estado de una mesa. Una columna `tiene_cae` se desincroniza el
   día que un servidor se caiga entre pedir el CAE y anotarlo, que es
   justo el caso que esto tiene que resolver.

   POR QUÉ UNA VENTA NO SE PASA A TICKET
   -------------------------------------
   La marca la pone el mostrador y no se cambia. Si una venta sin CAE se
   pudiera "resolver" como ticket no fiscal, el cliente se iría con un
   ticket y, al volver ARCA, alguien podría facturarla igual: dos papeles
   de la misma venta, uno fiscal y otro no. Por eso el servidor solo
   factura ventas marcadas, y una venta marcada solo sale como factura.

   LA VENTA DE BNITORI
   -------------------
   Antes de 0082 el cobro fabricaba el CAE (74300000000000 + 137 por
   ticket) y lo guardaba en `comprobante.cae`. Quedó una sola venta así,
   en Bnitori, el 21/09. Ya tiene un papel que dice FACTURA C: pedirle un
   CAE de verdad ahora sería emitir una segunda factura de la misma venta.
   Se deja afuera por esa clave, que ninguna venta nueva vuelve a tener.
   ============================================================ */

create view facturas_vista
with (security_invoker = true)
as
select
  o.id                 as operacion_id,
  o.empresa_id,
  o.numero             as numero_interno,
  o.fecha,
  o.total,
  o.cliente_id,
  coalesce(cl.razon_social, o.comprobante->'cliente'->>'nombre') as cliente,
  case c.estado
    when 'autorizado' then 'autorizada'
    when 'pendiente'  then 'pidiendo'
    else 'sin_cae'
  end                  as estado,
  c.id                 as comprobante_id,
  c.modo,
  c.cuit,
  c.letra,
  c.tipo,
  c.punto_venta,
  c.numero,
  c.cae,
  c.cae_vto,
  c.fecha              as fecha_factura,
  c.doc_tipo,
  c.doc_nro,
  /* El motivo del último rechazo: lo que hay que leer para saber si
     reintentar alcanza o hay que corregir algo antes. */
  (select r.error from comprobantes r
    where r.operacion_id = o.id and r.estado = 'rechazado'
    order by r.creado_en desc limit 1) as ultimo_error
from operaciones o
left join comprobantes c on c.operacion_id = o.id and c.estado <> 'rechazado'
left join clientes cl on cl.id = o.cliente_id
where o.tipo = 'venta'
  and o.estado = 'confirmada'
  and o.comprobante->>'fiscal' = 'true'
  and not (o.comprobante ? 'cae');

comment on view facturas_vista is
  'Cada venta cobrada como factura, con su CAE o esperándolo. security_invoker: la ve quien ve la venta.';

/* Las que esperan se buscan en cada venta y cada vez que vuelve la red.
   Son pocas contra todas las ventas del comercio, y sin esto la búsqueda
   recorre el historial entero. */
create index operaciones_facturas
  on operaciones (empresa_id, fecha)
  where tipo = 'venta' and comprobante->>'fiscal' = 'true';
