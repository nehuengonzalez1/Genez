/* ============================================================
   0046 · EL RÓTULO DEBAJO DEL NOMBRE TAMBIÉN ES DEL RUBRO
   ============================================================

   Debajo del nombre del comercio, en la barra lateral, decía siempre
   "1 caja · N art.". En un minimercado es lo que se quiere ver de un
   vistazo. En una estética son dos datos que no existen: no hay una caja
   registradora y no hay artículos, hay horas.

   A Almha le mostraba "1 CAJA · 0 ART.", que es lo peor de las dos: un
   rótulo ajeno y encima en cero.

   Va a `voces`, que ya es jsonb y ya guarda cómo llama cada rubro a las
   cosas. `{n}` lo reemplaza la pantalla con el catálogo contado.

   El rubro servicios no lo define, y eso es una decisión y no un olvido:
   un número equivocado es peor que ningún número. Cuando exista algo que
   valga la pena contar ahí —turnos de hoy, gente esperando— se agrega la
   fila y la pantalla no se toca.
   ============================================================ */

update rubros
   set voces = coalesce(voces, '{}'::jsonb) || '{"resumen": "1 caja · {n} art."}'::jsonb
 where clave in ('minimercado', 'gastronomia');

select clave, voces ->> 'resumen' as rotulo from rubros order by clave;
