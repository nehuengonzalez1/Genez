/* ============================================================
   0003 · SEMILLA INICIAL
   ============================================================

   Problema del huevo y la gallina: las políticas de RLS dicen que solo
   el dueño de plataforma puede crear empresas, pero todavía no existe
   ningún dueño de plataforma. Este archivo rompe ese círculo.

   Corre desde el SQL Editor, que trabaja con permisos de administrador
   y por lo tanto no pasa por RLS.

   ANTES DE CORRERLO hay que crear los usuarios en el panel:
   Authentication → Users → Add user, con "Auto Confirm User" tildado.

     nehuengonzalez1@gmail.com   → dueño de plataforma
     axel@super25.com            → dueño de Super 25

   El archivo los busca por mail, así que si usás otras direcciones,
   cambialas acá abajo antes de ejecutar.
   ============================================================ */

/* ------------------------------------------------------------
   La empresa de prueba
   ------------------------------------------------------------ */

insert into empresas (nombre, rubro, plan, modulos, config)
select
  'Super 25',
  'minimercado',
  'completo',
  array['cobro','caja','ajustes','productos','stock','compras','pedidos','clientes','reportes','asistente'],
  jsonb_build_object(
    'fiscal', jsonb_build_object(
      'nombreFactura', 'Super 25',
      'razonSocial',   'Axel Gonzalez',
      'cuit',          '20-41564841-0',
      'condicion',     'MONOTRIBUTO',
      'iibb',          '901-234567-8',
      'inicio',        '01/03/2019',
      'puntoVenta',    '0001',
      'domicilio',     'Av. San Martín 1204 · Caseros'
    ),
    'medios', jsonb_build_array(
      jsonb_build_object('k','efectivo',      'n','Efectivo',          'tasa',0,   'recargo',false,'activo',true),
      jsonb_build_object('k','debito',        'n','Débito',            'tasa',1.2, 'recargo',false,'activo',true),
      jsonb_build_object('k','credito',       'n','Crédito',           'tasa',3.1, 'recargo',false,'activo',true),
      jsonb_build_object('k','mp',            'n','QR / Mercado Pago', 'tasa',0.8, 'recargo',false,'activo',true),
      jsonb_build_object('k','transferencia', 'n','Transferencia',     'tasa',0,   'recargo',false,'activo',true)
    ),
    'ancho', 58
  )
where not exists (select 1 from empresas where nombre = 'Super 25');

insert into sucursales (empresa_id, nombre, domicilio)
select e.id, 'Casa central', 'Av. San Martín 1204 · Caseros'
from empresas e
where e.nombre = 'Super 25'
  and not exists (select 1 from sucursales s where s.empresa_id = e.id);

/* ------------------------------------------------------------
   Las personas

   El dueño de plataforma no pertenece a ninguna empresa: entra a
   cualquiera. Por eso su empresa_id queda en null.
   ------------------------------------------------------------ */

insert into perfiles (id, empresa_id, nombre, rol, es_plataforma)
select u.id, null, 'Nehuen González', 'dueno', true
from auth.users u
where u.email = 'nehuengonzalez1@gmail.com'
on conflict (id) do update
  set es_plataforma = true,
      rol           = 'dueno',
      empresa_id    = null;

insert into perfiles (id, empresa_id, nombre, rol, es_plataforma)
select u.id, e.id, 'Axel Gonzalez', 'dueno', false
from auth.users u
cross join empresas e
where u.email = 'axel@super25.com'
  and e.nombre = 'Super 25'
on conflict (id) do update
  set empresa_id = excluded.empresa_id,
      rol        = excluded.rol;

/* ------------------------------------------------------------
   Qué quedó
   ------------------------------------------------------------ */

select
  p.nombre,
  coalesce(e.nombre, '— plataforma —') as empresa,
  p.rol,
  p.es_plataforma
from perfiles p
left join empresas e on e.id = p.empresa_id
order by p.es_plataforma desc, p.nombre;
