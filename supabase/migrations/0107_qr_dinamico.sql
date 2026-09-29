/* ============================================================
   0107 · El QR dinámico de Mercado Pago
   ============================================================

   Cobrar con un QR que trae el monto de la venta (api/mp/qr.js). La
   orden de Mercado Pago se arma sobre una caja de la cuenta del comercio
   —la del QR fijo que ya tienen pegado en el mostrador— y cada caja de
   Genez tiene que saber cuál es la suya: con dos mostradores, el QR de
   uno no puede aparecer en el otro.

   Se guarda el "external_id" de esa caja, que es como la nombra la
   Orders API. Null: esa caja cobra con Mercado Pago como antes, con el
   QR fijo y el aviso.

   Va ANTES que la aplicación: cargarCajas pide esta columna, y sin ella
   la lista de cajas vuelve vacía y no se puede abrir ninguna.
   ============================================================ */

alter table cajas add column mp_caja text;

comment on column cajas.mp_caja is
  'external_id de la caja de Mercado Pago sobre la que se arma el QR dinámico de esta caja. Null: QR fijo y aviso, como antes de 0107.';
