/* ============================================================
   0098 · EL IVA DE CADA COMPROBANTE, POR ALÍCUOTA
   ============================================================

   Paso 3 de la factura A y B. `comprobantes` guardaba un neto y un IVA
   sueltos, que para la C eran el total y cero. La A y la B informan el
   IVA por alícuota, y ese detalle hace falta después de pedir el CAE:

   - El papel. La A lo discrimina por alícuota y la B muestra el IVA
     contenido (Ley 27.743). Tiene que imprimir lo que se le informó a
     ARCA, no recalcularlo: si mañana cambia la alícuota de un producto,
     una factura reimpresa no puede decir otra cosa.
   - El Libro IVA Digital, que pide ventas por alícuota.

   Se guarda lo que devolvió desglosarIva (src/utils/iva.js), entero:
   { total, neto, iva, exento, noGravado, alicuotas: [{ id, alicuota,
   base, importe }] }. En la C queda null. `neto` e `iva` siguen como
   estaban, con los totales, para las consultas que ya los usan.

   Va ANTES que el código: _arca.js escribe esta columna en cada
   comprobante, también en los C. Sin ella, facturar fallaría.
   ============================================================ */

alter table comprobantes add column detalle_iva jsonb;

comment on column comprobantes.detalle_iva is
  'El IVA por alícuota que se informó a ARCA (A y B), tal como lo devolvió desglosarIva. Null en la C. Ver 0098.';

/* La vista de facturas, con el desglose al final (una vista solo admite
   columnas nuevas al final). Es de donde Caja → Facturas y la
   reimpresión leen la factura; sin esto el papel de una A reimpresa no
   tendría qué discriminar. El resto, igual que en 0093. */
create or replace view facturas_vista
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
  (select r.error from comprobantes r
    where r.operacion_id = o.id and r.estado = 'rechazado'
    order by r.creado_en desc limit 1) as ultimo_error,
  o.tipo               as operacion_tipo,
  coalesce(o.comprobante->>'nota', 'factura') as clase,
  c.emisor,
  c.neto,
  c.iva,
  c.detalle_iva
from operaciones o
left join comprobantes c on c.operacion_id = o.id and c.estado <> 'rechazado'
left join clientes cl on cl.id = o.cliente_id
where o.tipo in ('venta', 'devolucion')
  and o.estado = 'confirmada'
  and o.comprobante->>'fiscal' = 'true'
  and not (o.comprobante ? 'cae');

