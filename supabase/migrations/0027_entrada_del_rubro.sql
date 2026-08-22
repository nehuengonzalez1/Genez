/* ============================================================
   0027 · POR DÓNDE ENTRA CADA RUBRO
   ============================================================

   El menú ya salía de una fila, pero tres cosas seguían decididas por un
   `if` en el código, y las tres estaban escritas pensando en un comercio
   que vende cosas:

   1. En qué pantalla arranca el sistema. Era: "si contrataste cobro,
      arrancás en la caja registradora". Una estética abría con un lector
      de códigos de barras y un carrito vacío, cuando el 95% de su día es
      agendar turnos y vender es la excepción.

   2. Qué es el botón grande de la barra lateral. Cobrar en un
      minimercado, tomar la comanda en un bar. En un negocio de turnos,
      cobrar existe pero no es lo que se hace todo el día, así que no
      puede ser lo más grande de la pantalla.

   3. Qué tablero muestra el Inicio. Margen bruto, valor del stock y
      vencimientos no le dicen nada a quien vende horas.

   Las tres pasan a la fila del rubro. El tablero va como nombre y no como
   configuración: un tablero es código, no datos, y pretender lo contrario
   termina en un armador de dashboards que nadie pidió. Lo que la fila
   decide es cuál se muestra.
   ============================================================ */

alter table rubros add column entrada text    not null default 'panel';
alter table rubros add column accion  jsonb;
alter table rubros add column inicio  text    not null default 'comercio';

alter table rubros add constraint rubros_entrada_valida check (
  entrada in ('panel', 'cobro', 'comanda')
);

comment on column rubros.entrada is
  'Pantalla en la que abre el sistema. panel es el tablero; cobro y comanda son las pantallas de venta.';
comment on column rubros.accion is
  'El botón principal de la barra lateral: {k, n, i, destacada}. Con destacada en false baja a un renglón más del menú. En null no hay botón.';
comment on column rubros.inicio is
  'Qué tablero dibuja la pantalla de Inicio. El navegador traduce nombre → componente.';

update rubros set
  entrada = 'cobro',
  accion  = '{"k":"cobro","n":"Cobrar","i":"barcode","destacada":true}'::jsonb,
  inicio  = 'comercio'
where clave = 'minimercado';

update rubros set
  entrada = 'comanda',
  accion  = '{"k":"comanda","n":"Comanda","i":"planilla","destacada":true}'::jsonb,
  inicio  = 'comercio'
where clave = 'gastronomia';

/* Vender existe y tiene que seguir a mano —una estética vende una crema de
   vez en cuando— pero deja de ser lo primero que se ve y lo más grande.
   Baja a un renglón del menú, arriba de todo. */
update rubros set
  entrada = 'panel',
  accion  = '{"k":"cobro","n":"Cobrar","i":"barcode","destacada":false}'::jsonb,
  inicio  = 'servicios'
where clave = 'servicios';

select clave, entrada, inicio, accion from rubros order by orden;
