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
