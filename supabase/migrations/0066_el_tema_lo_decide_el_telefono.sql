/* ============================================================
   0066 · EL TEMA LO DECIDE EL TELÉFONO
   ============================================================

   `rubros.marca.tema` decía `calido` para los tres rubros, y con eso la
   app del cliente se abría siempre clara, incluso en un teléfono puesto
   en oscuro.

   El comentario que lo justificaba decía algo cierto —el sistema de
   gestión vive en una cocina de noche y la app en un colectivo a las tres
   de la tarde— pero se olvidaba de que **el teléfono ya sabe la
   respuesta**. Alguien que lo puso en oscuro lo puso por algo, y una app
   que igual abre en blanco es la que encandila a las once de la noche. La
   misma persona, el mismo día, necesita las dos cosas.

   Pasa a `auto`, que es "lo que diga el teléfono".

   LOS OTROS DOS VALORES SIGUEN EXISTIENDO
   ---------------------------------------
   `claro` y `oscuro` fuerzan uno de los dos. Existen porque la app es la
   cara de un comercio y hay marcas que solo funcionan de una manera, y se
   ponen en `config.marca.tema` del comercio, que pisa al del rubro como
   todo lo demás de la marca.

   `calido` se sigue aceptando y quiere decir `claro`: es lo que había, y
   un comercio que lo haya escrito a mano en su propia config estaba
   pidiendo el claro. No se le cambia nada.

   SOLO SE TOCA EL VALOR DE FÁBRICA
   --------------------------------
   `update` sobre `rubros` y nada sobre `empresas`. Es la misma regla que
   los roles y las plantillas: el comercio que no eligió se lleva el
   cambio, y el que eligió se queda con lo suyo. Hoy ninguno eligió, así
   que en la práctica cambian los tres; mañana no.
   ============================================================ */

update rubros
   set marca = marca || jsonb_build_object('tema', 'auto')
 where marca ->> 'tema' = 'calido';
