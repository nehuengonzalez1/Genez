/* ============================================================
   SEMILLA · una clienta de Almha con cuenta para la app
   ============================================================

   Para poder mirar la app del cliente con datos de verdad y no con una
   pantalla vacía. Enlaza una ficha que ya existe —con sus turnos, su
   historia y sus abonos— a una cuenta de Authentication.

   Va aparte por lo mismo que los accesos del personal: depende de que el
   usuario ya exista en Auth, y eso se crea a mano en el panel
   (Authentication → Users, con "Auto Confirm User" tildado).

   POR QUÉ VICTORIA Y NO CUALQUIERA
   --------------------------------
   Tiene siete turnos futuros y seis abonos, así que las tres secciones de
   la pantalla —lo que viene, los abonos y lo de antes— muestran algo. Con
   una ficha vacía no se ve si la pantalla anda o si no hay datos, que es
   la peor forma de revisar una pantalla nueva.

   El correo de acá tiene que ser EL MISMO que se cargó en Authentication.
   Si se eligió otro, cambiarlo en la línea de abajo.

   ESTO ES PARA DESARROLLO
   -----------------------
   Victoria Peralta es una clienta de la semilla de demostración, no una
   persona. Cuando Almha tenga clientas reales con app, el enlace lo va a
   hacer el comercio invitándolas, no este archivo.

   Se puede correr más de una vez.
   ============================================================ */

update clientes c
   set usuario_id  = u.id,
       enlazado_en = now()
  from auth.users u
 where u.email = 'nehuengonzalez1+clienta@gmail.com'
   and c.empresa_id = (select id from empresas where nombre = 'Almha')
   and c.razon_social = 'Victoria Peralta';

/* ------------------------------------------------------------
   Qué quedó

   Si no aparece nada, el insert no encontró el usuario: el correo de
   Authentication no coincide con el de arriba. No falla, no hace nada, y
   por eso hace falta mirar.
   ------------------------------------------------------------ */

select
  c.razon_social,
  u.email,
  (select count(*) from reservas r where r.cliente_id = c.id and r.desde >= now()) as turnos_futuros,
  (select count(*) from abonos a where a.cliente_id = c.id and not a.anulado)      as abonos
from clientes c
join auth.users u on u.id = c.usuario_id
where c.empresa_id = (select id from empresas where nombre = 'Almha');
