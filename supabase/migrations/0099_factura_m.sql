/* ============================================================
   0099 · LA FACTURA M
   ============================================================

   Un responsable inscripto no elige si emite A: ARCA le asigna A, A con
   la leyenda "Operación sujeta a retención" o M, y lo revisa cada cuatro
   meses (RG 1575; RG 5716/2025). Con M, lo que sería una A se pide con
   otros códigos: 51 la factura, 52 la nota de débito, 53 la de crédito.
   Hasta acá `comprobantes` solo aceptaba A, B y C, así que el primer
   inscripto en M no habría podido guardar ni el pendiente.

   La clase vive en empresas.config.fiscal.claseInscripto (Ajustes →
   datos fiscales); la regla de la letra, en src/utils/fiscal.js. El
   análisis está en el doc "Genez: consulta fiscal sobre facturas A y B".
   ============================================================ */

alter table comprobantes drop constraint comprobantes_tipo_valido;
alter table comprobantes add constraint comprobantes_tipo_valido
  check (tipo in (1, 2, 3, 6, 7, 8, 11, 12, 13, 51, 52, 53));
