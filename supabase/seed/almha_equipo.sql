/* ============================================================
   SEMILLA · el equipo de Almha
   ============================================================

   TODO ES DE EJEMPLO: los nombres, los valores hora y los horarios. Van
   marcados con `"demo": true` para poder barrerlos de una:

     delete from personal where empresa_id = (select id from empresas where nombre = 'Almha')
                            and campos_extra ->> 'demo' = 'true';

   Los horarios y los servicios habilitados se borran solos con la persona,
   por la cascada.

   Los servicios de cada uno se asignan por categoría y no uno por uno: así
   la semilla sigue andando si mañana se agrega una prestación de pilates,
   y no queda una lista de nombres que hay que mantener a mano.

   Se puede correr más de una vez.
   ============================================================ */

do $$
declare
  v_emp uuid;
  v_suc uuid;
  p     record;
  h     record;
  v_id  uuid;
begin

select id into v_emp from empresas where nombre = 'Almha';
if v_emp is null then
  raise exception 'No existe Almha. Corré antes supabase/seed/almha.sql.';
end if;

select id into v_suc from sucursales where empresa_id = v_emp limit 1;

/* ------------------------------------------------------------
   La gente

   `categoria` es de qué se ocupa; se usa abajo para habilitarle los
   servicios de esa área. En recepción va en null: no da prestaciones.
   ------------------------------------------------------------ */
for p in
  select * from (values
    ('Sofía González',  'profesional', 'Pilates',  'Pilates',  'hora',  8000, 1),
    ('Valentina Rojas', 'profesional', 'Pilates',  'Pilates',  'hora',  8000, 2),
    ('Carla Gómez',     'profesional', 'Estética', 'Estética', 'hora',  9000, 3),
    ('Agustina Pérez',  'profesional', 'Masajes',  'Masajes',  'hora',  8500, 4),
    ('Micaela Ruiz',    'recepcion',   'Mostrador', null,      'hora',  6000, 5)
  ) as t(nombre, tipo, especialidad, categoria, modalidad, valor, orden)
loop
  update personal
     set tipo = p.tipo, especialidad = p.especialidad, modalidad = p.modalidad,
         valor = p.valor, orden = p.orden, sucursal_id = v_suc, activo = true,
         campos_extra = jsonb_build_object('demo', true, 'categoria', p.categoria)
   where empresa_id = v_emp and nombre = p.nombre
   returning id into v_id;

  if v_id is null then
    insert into personal (empresa_id, sucursal_id, nombre, tipo, especialidad,
                          modalidad, valor, orden, campos_extra)
    values (v_emp, v_suc, p.nombre, p.tipo, p.especialidad,
            p.modalidad, p.valor, p.orden,
            jsonb_build_object('demo', true, 'categoria', p.categoria))
    returning id into v_id;
  end if;

  /* Qué puede dar: todo lo de su categoría. Se rehace cada vez para que
     una prestación nueva del área quede habilitada sin tocar nada. */
  delete from personal_servicios where personal_id = v_id;
  if p.categoria is not null then
    insert into personal_servicios (personal_id, item_id, empresa_id)
    select v_id, i.id, v_emp
      from items i
     where i.empresa_id = v_emp and i.tipo = 'servicio' and i.activo
       and i.categoria = p.categoria;
  end if;

  v_id := null;
end loop;

/* ------------------------------------------------------------
   Cuándo está cada uno

   Se rehacen enteros para que correr la semilla dos veces no deje franjas
   duplicadas encima de las mismas horas.
   ------------------------------------------------------------ */
delete from horarios
 where empresa_id = v_emp
   and personal_id in (select id from personal where empresa_id = v_emp
                         and campos_extra ->> 'demo' = 'true');

for h in
  select * from (values
    /* Las de pilates se reparten la mañana y la tarde. */
    ('Sofía González',  1, '08:00', '13:00'), ('Sofía González',  3, '08:00', '13:00'),
    ('Sofía González',  5, '08:00', '13:00'),
    ('Valentina Rojas', 2, '14:00', '20:00'), ('Valentina Rojas', 4, '14:00', '20:00'),
    ('Valentina Rojas', 6, '09:00', '13:00'),
    /* Estética atiende de tarde, que es cuando la gente puede. */
    ('Carla Gómez',     1, '14:00', '20:00'), ('Carla Gómez',     2, '14:00', '20:00'),
    ('Carla Gómez',     3, '14:00', '20:00'), ('Carla Gómez',     4, '14:00', '20:00'),
    ('Agustina Pérez',  2, '10:00', '18:00'), ('Agustina Pérez',  4, '10:00', '18:00'),
    ('Agustina Pérez',  5, '10:00', '18:00'),
    /* Recepción cubre todo el horario del local. */
    ('Micaela Ruiz',    1, '08:00', '20:00'), ('Micaela Ruiz',    2, '08:00', '20:00'),
    ('Micaela Ruiz',    3, '08:00', '20:00'), ('Micaela Ruiz',    4, '08:00', '20:00'),
    ('Micaela Ruiz',    5, '08:00', '20:00'), ('Micaela Ruiz',    6, '09:00', '13:00')
  ) as t(nombre, dia, desde, hasta)
loop
  insert into horarios (empresa_id, personal_id, dia, desde, hasta)
  select v_emp, pe.id, h.dia, h.desde::time, h.hasta::time
    from personal pe
   where pe.empresa_id = v_emp and pe.nombre = h.nombre;
end loop;

raise notice 'Equipo de Almha: % personas, % franjas horarias, % servicios habilitados.',
  (select count(*) from personal where empresa_id = v_emp and activo),
  (select count(*) from horarios where empresa_id = v_emp),
  (select count(*) from personal_servicios where empresa_id = v_emp);
end;
$$;

select nombre, tipo, especialidad, modalidad, valor,
       horas_semana, dias_semana, servicios, tiene_cuenta
from equipo_vista
where empresa_id = (select id from empresas where nombre = 'Almha')
order by orden;
