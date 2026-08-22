/* ============================================================
   SEMILLA · el plano del Bar Rivadavia
   ============================================================

   Un salón dibujado, para que el mapa se vea como un local y no como una
   grilla de cuadraditos. Es material de desarrollo: un comercio de
   verdad dibuja el suyo desde "Editar salón", que guarda exactamente
   estas mismas coordenadas.

   Dos decisiones que valen para cualquier plano que se dibuje después:

   Todo vive en UN solo sistema de coordenadas. Los sectores no son
   planos separados sino zonas del mismo local: la barra está contra la
   pared izquierda del salón y la terraza del otro lado del vidrio. Con
   un origen por sector, "Todo el piso" superpone las tres zonas y no se
   entiende nada.

   Las mesas se acomodan, no se recrean. Una mesa borrada se lleva
   puestas las ventas que la referencian —`recurso_id` queda en null— y
   con eso se pierde en qué mesa se vendió cada cosa. Así que las que ya
   existen se mueven y las que faltan se agregan.

     node scripts/aplicar-sql.mjs supabase/seed/salon.sql
   ============================================================ */

do $$
declare
  v_emp uuid;
  v_suc uuid;
  r     record;
begin
  select id into v_emp from empresas where nombre = 'Bar Rivadavia';
  if v_emp is null then
    raise exception 'No existe el Bar Rivadavia. Corré supabase/seed/gastronomia.sql primero.';
  end if;
  select id into v_suc from sucursales where empresa_id = v_emp limit 1;

  /* Lo que ubica pero no se vende se puede rehacer entero: no lo
     referencia nadie. */
  delete from plano_elementos where empresa_id = v_emp;

  insert into plano_elementos (empresa_id, sucursal_id, piso, sector, tipo, etiqueta, x, y, ancho, alto) values
    -- El contorno del salón. La puerta parte la pared de abajo en dos.
    (v_emp, v_suc, 'Planta baja', null, 'pared', null,  0,  0, 30,  1),
    (v_emp, v_suc, 'Planta baja', null, 'pared', null,  0, 17, 12,  1),
    (v_emp, v_suc, 'Planta baja', null, 'pared', null, 18, 17, 12,  1),
    (v_emp, v_suc, 'Planta baja', null, 'pared', null,  0,  1,  1, 16),
    (v_emp, v_suc, 'Planta baja', null, 'pared', null, 29,  1,  1, 16),
    (v_emp, v_suc, 'Planta baja', null, 'entrada', 'Entrada', 12, 17, 6, 1),

    -- La barra contra la pared izquierda y la cocina al fondo derecha,
    -- que es donde están en el local.
    (v_emp, v_suc, 'Planta baja', null, 'barra',  'Barra',  1,  3,  3, 11),
    (v_emp, v_suc, 'Planta baja', null, 'cocina', 'Cocina', 25,  2,  4,  6),
    (v_emp, v_suc, 'Planta baja', null, 'bano',   'Baño',   25, 10,  4,  4),

    (v_emp, v_suc, 'Planta baja', null, 'planta', null,  1,  1,  2,  2),
    (v_emp, v_suc, 'Planta baja', null, 'planta', null,  1, 15,  2,  2),
    (v_emp, v_suc, 'Planta baja', null, 'planta', null, 26, 15,  2,  2),

    -- La terraza, del otro lado del vidrio.
    (v_emp, v_suc, 'Planta baja', null, 'pared', null, 31,  0,  1, 18),
    (v_emp, v_suc, 'Planta baja', null, 'pared', null, 38,  0,  1, 18),
    (v_emp, v_suc, 'Planta baja', null, 'pared', null, 32,  0,  6,  1),
    (v_emp, v_suc, 'Planta baja', null, 'pared', null, 32, 17,  6,  1),
    (v_emp, v_suc, 'Planta baja', null, 'texto', 'TERRAZA', 32, 1, 6, 1),
    (v_emp, v_suc, 'Planta baja', null, 'planta', null, 36, 15,  2,  2);

  /* Las mesas. Se acomoda la que ya está y se crea la que falta, que es
     lo que evita perder de qué mesa fue cada venta vieja. */
  for r in
    select * from (values
      -- nombre,      sector,            x,  y, ancho, alto, capacidad, forma,        orden
      ('Mesa 1',      'Salón Principal',  6,  3, 4, 3, 2, 'rectangulo',  1),
      ('Mesa 2',      'Salón Principal', 11,  3, 4, 3, 4, 'rectangulo',  2),
      ('Mesa 3',      'Salón Principal', 16,  3, 4, 3, 4, 'redonda',     3),
      ('Mesa 4',      'Salón Principal', 21,  3, 4, 3, 4, 'rectangulo',  4),
      ('Mesa 5',      'Salón Principal',  6,  8, 4, 3, 2, 'rectangulo',  5),
      ('Mesa 6',      'Salón Principal', 11,  8, 4, 3, 4, 'rectangulo',  6),
      ('Mesa 7',      'Salón Principal', 16,  8, 4, 3, 4, 'rectangulo',  7),
      ('Mesa 8',      'Salón Principal', 21,  8, 4, 3, 4, 'rectangulo',  8),
      ('Mesa 9',      'Salón Principal',  6, 13, 9, 3, 6, 'barra',       9),
      ('Mesa 10',     'Salón Principal', 16, 13, 4, 3, 2, 'rectangulo', 10),
      ('Mesa 11',     'Salón Principal', 21, 13, 4, 3, 4, 'rectangulo', 11),

      -- Los banquitos, pegados a la barra y mirándola.
      ('Barra 1',     'Barra',            4,  3, 2, 2, 2, 'redonda',    20),
      ('Barra 2',     'Barra',            4,  6, 2, 2, 2, 'redonda',    21),
      ('Barra 3',     'Barra',            4,  9, 2, 2, 2, 'redonda',    22),
      ('Barra 4',     'Barra',            4, 12, 2, 2, 2, 'redonda',    23),

      ('Terraza 1',   'Terraza',         33,  3, 4, 3, 2, 'redonda',    30),
      ('Terraza 2',   'Terraza',         33,  7, 4, 3, 2, 'redonda',    31),
      ('Terraza 3',   'Terraza',         33, 11, 4, 3, 4, 'rectangulo', 32)
    ) as t(nombre, sector, x, y, ancho, alto, capacidad, forma, orden)
  loop
    update recursos
       set sector = r.sector, x = r.x, y = r.y, ancho = r.ancho, alto = r.alto,
           capacidad = r.capacidad, forma = r.forma, orden = r.orden,
           piso = 'Planta baja', activo = true
     where empresa_id = v_emp and nombre = r.nombre;

    if not found then
      insert into recursos (empresa_id, sucursal_id, tipo, nombre, sector, piso,
                            capacidad, orden, x, y, ancho, alto, forma)
        values (v_emp, v_suc, 'mesa', r.nombre, r.sector, 'Planta baja',
                r.capacidad, r.orden, r.x, r.y, r.ancho, r.alto, r.forma);
    end if;
  end loop;

  /* Las de la vereda pasan a ser la terraza: es el mismo lugar con el
     nombre que usa la maqueta. Si ya se movieron a mano, no se tocan. */
  update recursos set activo = false
   where empresa_id = v_emp and (nombre like 'Vereda%' or nombre = 'Terraza 4');

  raise notice 'Salón dibujado: % mesas y % elementos.',
    (select count(*) from recursos where empresa_id = v_emp and activo),
    (select count(*) from plano_elementos where empresa_id = v_emp);
end;
$$;
