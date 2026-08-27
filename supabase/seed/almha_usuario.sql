/* ============================================================
   SEMILLA · el acceso propio de Almha
   ============================================================

   Va aparte de almha.sql por lo mismo que el del bar: depende de que el
   usuario ya exista en Authentication, y eso se crea a mano en el panel
   (Authentication → Users, con "Auto Confirm User" tildado; sin eso el
   usuario queda sin confirmar y el login rebota sin decir por qué).

   Hasta ahora Almha se miraba con "entrar como" desde la plataforma, que
   alcanza para revisar pantallas pero no para probar permisos: el dueño
   de plataforma ve todo por definición, así que con esa sesión un módulo
   mal habilitado se ve igual de bien que uno bien habilitado. Con un
   usuario propio del comercio, lo que sobra o falta se nota.

   Se le da rol de dueño para poder recorrer los diez módulos. Cuando el
   negocio tenga gente propia, las que atienden van con `profesional` y
   el mostrador con `encargado`.

   El correo de acá tiene que ser EL MISMO que pusiste en Authentication.
   Si elegiste otro, cambialo en las dos líneas de abajo.

   Se puede correr más de una vez.
   ============================================================ */

insert into perfiles (id, empresa_id, nombre, rol, es_plataforma)
select u.id, e.id, 'Titular de Almha', 'dueno', false
from auth.users u
cross join empresas e
where u.email = 'dueno@almha.com'
  and e.nombre = 'Almha'
on conflict (id) do update
  set empresa_id = excluded.empresa_id,
      rol        = excluded.rol;

/* ------------------------------------------------------------
   Qué quedó

   Si Almha no aparece en esta lista, el insert no encontró el usuario:
   el correo de Authentication no coincide con el de arriba.
   ------------------------------------------------------------ */

select
  p.nombre,
  coalesce(e.nombre, '— plataforma —') as empresa,
  p.rol
from perfiles p
left join empresas e on e.id = p.empresa_id
order by p.es_plataforma desc, e.nombre nulls first, p.nombre;
