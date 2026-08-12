/* ============================================================
   SEMILLA · el acceso del comercio de gastronomía
   ============================================================

   Va aparte de gastronomia.sql porque depende de que el usuario ya exista
   en Authentication, y eso se crea a mano en el panel.

   Se le da rol de dueño para poder probar el módulo completo. Cuando el
   salón tenga varias personas, los mozos van con un rol más acotado.

   Se puede correr más de una vez.
   ============================================================ */

insert into perfiles (id, empresa_id, nombre, rol, es_plataforma)
select u.id, e.id, 'Mozo Rivadavia', 'dueno', false
from auth.users u
cross join empresas e
where u.email = 'mozo@rivadavia.com'
  and e.nombre = 'Bar Rivadavia'
on conflict (id) do update
  set empresa_id = excluded.empresa_id,
      rol        = excluded.rol;

select
  p.nombre,
  coalesce(e.nombre, '— plataforma —') as empresa,
  p.rol
from perfiles p
left join empresas e on e.id = p.empresa_id
order by p.es_plataforma desc, e.nombre nulls first, p.nombre;
