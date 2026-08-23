/* ============================================================
   0041 · UNA MARCA EN LAS RESERVAS
   ============================================================

   `reservas` es la única tabla operativa que no tiene `campos_extra`.
   `items`, `clientes`, `operaciones` y `operacion_lineas` la tienen desde
   el principio, y es por donde el sistema cuelga lo que todavía no
   merece una columna: la marca de dato de ejemplo, entre otras cosas.

   Sin eso, barrer una semilla de agenda obliga a deducir qué borrar
   —"las reservas que apuntan a items de ejemplo"— y esa consulta se
   escribe distinto cada vez que hace falta. Con la marca es la misma
   línea que ya se usa para el catálogo y para el equipo:

     delete from reservas where empresa_id = (...)
                            and campos_extra ->> 'demo' = 'true';

   QUÉ PASA CON GASTRONOMÍA
   ------------------------
   Nada. Es una columna nueva, anulable, con valor por defecto: en
   Postgres 11 en adelante `add column ... default` no reescribe la tabla,
   así que las reservas del Bar Rivadavia no se tocan. Y las dos vistas
   que leen `reservas` —`agenda_vista` y `salon_vista`— enumeran sus
   columnas una por una, así que no cambian ni hace falta rehacerlas.

   Más adelante hay dos usos previstos en el encargo que también caen acá
   sin migrar de nuevo: si la reserva vino del turno online y si dejó
   seña.
   ============================================================ */

alter table reservas add column campos_extra jsonb not null default '{}'::jsonb;

comment on column reservas.campos_extra is
  'Lo que no merece una columna todavía: la marca de dato de ejemplo, el origen de la reserva, la seña.';
