/* ============================================================
   SEMILLA · el acceso propio de Bnitori
   ============================================================

   Mismo mecanismo que almha_usuario.sql. Va aparte de bnitori.sql
   porque depende de que el usuario ya exista en Authentication, y eso
   se crea a mano en el panel: Authentication → Users → Add user, con
   "Auto Confirm User" tildado.

   Rol de dueño, para poder recorrer los ocho módulos (cobro, caja,
   ajustes, productos, stock, compras, pedidos, clientes, reportes)
   con una sola cuenta durante la QA.

   El correo de acá tiene que ser EL MISMO que pusiste en Authentication.

   Se puede correr más de una vez.
   ============================================================ */

insert into perfiles (id, empresa_id, nombre, rol, es_plataforma)
select u.id, e.id, 'Dueño de Bnitori', 'dueno', false
from auth.users u
cross join empresas e
where u.email = 'dueno@bnitori.com.ar'
  and e.nombre = 'Bnitori'
on conflict (id) do update
  set empresa_id = excluded.empresa_id,
      rol        = excluded.rol;

select
  p.nombre,
  coalesce(e.nombre, '— plataforma —') as empresa,
  p.rol
from perfiles p
left join empresas e on e.id = p.empresa_id
where e.nombre = 'Bnitori';
