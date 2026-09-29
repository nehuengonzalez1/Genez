/* ============================================================
   0105 · PROMOS EN LA COMANDA Y HAPPY HOUR
   ============================================================

   Las promos (0102) las aplicaba solo el mostrador. En un bar, la que
   importa es el happy hour: "2x1 en pintas de 18 a 20". Hacían falta dos
   cosas:

   1. Un horario en la promo (`hora_desde`, `hora_hasta`). Puede cruzar la
      medianoche ("de 22 a 2"). Sin horario, vale todo el día, como antes.

   2. La hora en que se pidió cada renglón (`pedida_en`). Una mesa se
      arma durante horas: la pinta pedida a las 19:50 tiene que conservar
      el 2x1 aunque la mesa pague a las 21. La promo se decide con la hora
      del pedido, no con la del cobro. Los renglones de antes quedan sin
      hora y usan la de apertura de la mesa.

   Dónde queda la promo de una comanda: en el `descuento` y el `total` de
   cada renglón, igual que en el mostrador. La cuenta, el descuento de la
   mesa, los pagos parciales y el cierre suman `total` (0019, 0023), así
   que la toman sin cambios. La recalcula la pantalla de la comanda cada
   vez que la lee (src/datos/comandas.js).
   ============================================================ */

alter table promociones
  add column hora_desde time,
  add column hora_hasta time,
  add constraint promociones_horario check ((hora_desde is null) = (hora_hasta is null) and (hora_desde is null or hora_desde <> hora_hasta));

comment on column promociones.hora_desde is
  'Desde qué hora vale (con hora_hasta). Puede cruzar la medianoche: de 22 a 2. Null = todo el día. Ver 0105.';

/* En dos pasos a propósito: con el default en el mismo alter, Postgres
   les pondría a todos los renglones viejos la hora de esta migración. */
alter table operacion_lineas add column pedida_en timestamptz;
alter table operacion_lineas alter column pedida_en set default now();

comment on column operacion_lineas.pedida_en is
  'Cuándo se pidió el renglón: decide si le toca una promo con horario (happy hour). Null en los de antes de 0105. Ver 0105.';
