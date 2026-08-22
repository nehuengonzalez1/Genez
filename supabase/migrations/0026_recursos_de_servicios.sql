/* ============================================================
   0026 · RECURSOS PARA NEGOCIOS DE SERVICIOS
   ============================================================

   `recursos` ya modelaba cualquier cosa reservable —mesa, habitación,
   sillón, bahía, cancha— pero la lista se escribió pensando en gastronomía
   y alojamiento. Una estética reserva salas y camillas, y un estudio de
   pilates reserva la sala del reformer.

   Se agregan los dos tipos que faltaban en vez de abrir la columna a texto
   libre: la restricción es lo que evita que mañana convivan 'sala',
   'Sala', 'salita' y 'SALA' y que ninguna consulta agrupe bien.
   ============================================================ */

alter table recursos drop constraint recursos_tipo_valido;

alter table recursos add constraint recursos_tipo_valido check (
  tipo in ('mesa', 'habitacion', 'sillon', 'bahia', 'cancha', 'sala', 'camilla', 'otro')
);

comment on column recursos.tipo is
  'Qué se reserva. Cambia por rubro: mesa en gastronomía, sala o camilla en servicios, cancha en un club.';
