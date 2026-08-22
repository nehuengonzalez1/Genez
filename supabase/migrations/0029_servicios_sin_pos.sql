/* ============================================================
   0029 · UN NEGOCIO DE TURNOS NO ABRE CON UN LECTOR DE CÓDIGOS
   ============================================================

   El botón "Cobrar" del rubro servicios abría el punto de venta del
   minimercado: buscador de artículos, lector de códigos de barras,
   carrito. En una estética eso no tiene ningún sentido, y encima estaba
   arriba de todo en la barra lateral.

   Se le saca la acción al rubro. No se le saca el módulo `cobro`: una
   estética vende una crema de vez en cuando y va a necesitar cobrar. Lo
   que falta es la pantalla adecuada para eso, que es otra cosa y se diseña
   aparte.

   Mientras tanto queda sin acción principal, que es lo honesto: mejor no
   ofrecer nada que ofrecer la pantalla equivocada.
   ============================================================ */

update rubros set accion = null where clave = 'servicios';

select clave, entrada, inicio, coalesce(accion ->> 'n', '— sin acción —') as boton
from rubros order by orden;
