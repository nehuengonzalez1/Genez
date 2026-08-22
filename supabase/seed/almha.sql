/* ============================================================
   SEMILLA · Almha, un tercer comercio de otro rubro
   ============================================================

   Estética y pilates. Es el primer inquilino del rubro `servicios`, y con
   él se estrena el menú agrupado: hasta ahora los dos comercios que había
   usaban un solo grupo sin rótulo.

   TODOS LOS DATOS SON DE EJEMPLO. El negocio existe, los servicios, los
   precios y las salas de acá no. Están marcados con `"demo": true` en
   `campos_extra` para poder barrerlos de una cuando lleguen los reales:

     delete from items    where empresa_id = (select id from empresas where nombre = 'Almha')
                            and campos_extra ->> 'demo' = 'true';
     delete from recursos where empresa_id = (select id from empresas where nombre = 'Almha')
                            and campos_extra ->> 'demo' = 'true';

   No hace falta crear un usuario para entrar: el dueño de plataforma entra
   a cualquier comercio desde el panel, con "entrar como". Cuando Almha
   tenga gente propia se le agrega su acceso, igual que al bar.

   Se puede correr más de una vez sin duplicar.
   ============================================================ */

do $$
declare
  v_emp uuid;
  v_suc uuid;
  s     record;
  r     record;
begin

select id into v_emp from empresas where nombre = 'Almha';

if v_emp is null then
  insert into empresas (nombre, rubro, plan, modulos, config)
  values (
    'Almha',
    'servicios',
    'completo',
    /* Solo los módulos que existen hoy. La agenda, el equipo, los abonos y
       las finanzas se van contratando a medida que se construyen: aparecen
       solas en el menú porque el menú sale de `rubros`. */
    array['cobro','caja','ajustes','clientes','reportes'],
    jsonb_build_object(
      'fiscal', jsonb_build_object(
        'nombreFactura', 'Almha',
        'razonSocial',   'Almha (datos de ejemplo)',
        'cuit',          '30-00000000-0',
        'condicion',     'MONOTRIBUTO',
        'iibb',          '',
        'inicio',        '01/08/2026',
        'puntoVenta',    '0001',
        'domicilio',     'Domicilio de ejemplo'
      ),
      'medios', jsonb_build_array(
        jsonb_build_object('k','efectivo',      'n','Efectivo',          'tasa',0,   'recargo',false,'activo',true),
        jsonb_build_object('k','debito',        'n','Débito',            'tasa',1.2, 'recargo',false,'activo',true),
        jsonb_build_object('k','credito',       'n','Crédito',           'tasa',3.1, 'recargo',false,'activo',true),
        jsonb_build_object('k','mp',            'n','QR / Mercado Pago', 'tasa',0.8, 'recargo',false,'activo',true),
        jsonb_build_object('k','transferencia', 'n','Transferencia',     'tasa',0,   'recargo',false,'activo',true)
      ),
      'ancho', 58,
      'demo', true
    )
  )
  returning id into v_emp;

  raise notice 'Almha creada.';
else
  raise notice 'Almha ya existía. Se completan catálogo y salas.';
end if;

select id into v_suc from sucursales where empresa_id = v_emp limit 1;
if v_suc is null then
  insert into sucursales (empresa_id, nombre, domicilio)
  values (v_emp, 'Casa central', 'Domicilio de ejemplo')
  returning id into v_suc;
end if;

/* ------------------------------------------------------------
   Las prestaciones

   Son items como cualquier otro: la misma tabla que las Coca-Colas de
   Super 25. Lo que cambia es que llevan `duracion_min` y no controlan
   stock. Eso ya estaba previsto en el modelo desde la primera migración.

   La modalidad y el cupo viven por ahora en `campos_extra`. Cuando exista
   la tabla de franjas, el cupo pasa a ser de la franja: una clase puede
   abrirse con menos lugares que los que la sala admite.
   ------------------------------------------------------------ */
for s in
  select * from (values
    ('Pilates Reformer',        'Pilates',    60, 20000, 'grupal',     6),
    ('Pilates Mat',             'Pilates',    50, 15000, 'grupal',     8),
    ('Pilates Personalizado',   'Pilates',    60, 28000, 'individual', 1),
    ('Clase de Prueba',         'Pilates',    50,  8000, 'grupal',     6),
    ('Limpieza Facial',         'Estética',   60, 22000, 'individual', 1),
    ('Depilación Definitiva',   'Estética',   30, 12000, 'individual', 1),
    ('Masaje Relajante',        'Masajes',    60, 20000, 'individual', 1),
    ('Masaje Descontracturante','Masajes',    60, 22000, 'individual', 1),
    ('Drenaje Linfático',       'Corporales', 50, 18000, 'individual', 1)
  ) as t(nombre, categoria, duracion, precio, modalidad, capacidad)
loop
  update items
     set categoria = s.categoria, duracion_min = s.duracion, precio = s.precio,
         tipo = 'servicio', controla_stock = false, activo = true,
         campos_extra = jsonb_build_object('modalidad', s.modalidad, 'capacidad', s.capacidad, 'demo', true)
   where empresa_id = v_emp and nombre = s.nombre;

  if not found then
    insert into items (empresa_id, tipo, nombre, categoria, unidad, precio,
                       controla_stock, duracion_min, campos_extra)
    values (v_emp, 'servicio', s.nombre, s.categoria, 'un', s.precio,
            false, s.duracion,
            jsonb_build_object('modalidad', s.modalidad, 'capacidad', s.capacidad, 'demo', true));
  end if;
end loop;

/* ------------------------------------------------------------
   Las salas

   Mismo mecanismo que las mesas del bar, con otro tipo. Las coordenadas
   son para que el plano no salga amontonado el día que se contrate: hoy
   Almha no tiene el módulo, así que no se dibuja.
   ------------------------------------------------------------ */
for r in
  select * from (values
    ('Sala Reformer 1', 'sala',    'Pilates',  6, 1,  1,  1, 4, 3),
    ('Sala Reformer 2', 'sala',    'Pilates',  6, 2,  6,  1, 4, 3),
    ('Sala Mat 1',      'sala',    'Pilates',  8, 3, 11,  1, 4, 3),
    ('Sala Mat 2',      'sala',    'Pilates',  8, 4, 16,  1, 4, 3),
    ('Sala Estética',   'sala',    'Estética', 1, 5,  1,  5, 3, 3),
    ('Gabinete 1',      'camilla', 'Estética', 1, 6,  5,  5, 2, 2),
    ('Gabinete 2',      'camilla', 'Estética', 1, 7,  8,  5, 2, 2),
    ('Box Masajes 1',   'camilla', 'Masajes',  1, 8, 11,  5, 2, 2),
    ('Box Masajes 2',   'camilla', 'Masajes',  1, 9, 14,  5, 2, 2),
    ('Consultorio 1',   'sala',    'Estética', 1,10, 17,  5, 3, 3)
  ) as t(nombre, tipo, sector, capacidad, orden, x, y, ancho, alto)
loop
  update recursos
     set tipo = r.tipo, sector = r.sector, capacidad = r.capacidad, orden = r.orden,
         x = r.x, y = r.y, ancho = r.ancho, alto = r.alto,
         piso = 'Planta baja', forma = 'rectangulo', activo = true,
         campos_extra = jsonb_build_object('demo', true)
   where empresa_id = v_emp and nombre = r.nombre;

  if not found then
    insert into recursos (empresa_id, sucursal_id, tipo, nombre, sector, piso,
                          capacidad, orden, x, y, ancho, alto, forma, campos_extra)
    values (v_emp, v_suc, r.tipo, r.nombre, r.sector, 'Planta baja',
            r.capacidad, r.orden, r.x, r.y, r.ancho, r.alto, 'rectangulo',
            jsonb_build_object('demo', true));
  end if;
end loop;

raise notice 'Almha lista: % prestaciones y % espacios.',
  (select count(*) from items    where empresa_id = v_emp and tipo = 'servicio' and activo),
  (select count(*) from recursos where empresa_id = v_emp and activo);
end;
$$;

select
  e.nombre, e.rubro, e.plan,
  (select count(*) from items    i where i.empresa_id = e.id and i.tipo = 'servicio') as prestaciones,
  (select count(*) from recursos r where r.empresa_id = e.id)                         as espacios
from empresas e
order by e.nombre;
