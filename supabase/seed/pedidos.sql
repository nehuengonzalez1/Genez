/* ============================================================
   SEMILLA · un día de pedidos en el Bar Rivadavia
   ============================================================

   Datos simulados para desarrollar el centro de pedidos: un tablero
   vacío no deja ver si las columnas respiran, si los tiempos se leen ni
   si los totales cierran.

   Todo lo que crea queda marcado con `campos_extra->>'demo' = 'pedidos'`,
   así que se puede correr las veces que haga falta —barre lo anterior— y
   se puede borrar de una:

     delete from operaciones where campos_extra->>'demo' = 'pedidos';

   No tocar en un comercio de verdad.

     node scripts/aplicar-sql.mjs supabase/seed/pedidos.sql
   ============================================================ */

do $$
declare
  v_emp     uuid;
  v_suc     uuid;
  v_ses     uuid;
  v_user    uuid;
  v_id      uuid;
  v_sub     numeric;
  v_estado  text;
  v_hace    int;
  r         record;
  i         int;
  v_canales text[] := array['mostrador', 'delivery', 'pedidosya', 'rappi', 'ubereats', 'takeaway'];
  v_platos  text[] := array['Hamburguesa completa', 'Hamburguesa doble', 'Hamburguesa simple',
                            'Papas fritas', 'Aros de cebolla', 'Ensalada César'];
  v_nombres text[] := array['Sofía Ramírez', 'Diego Morales', 'Carla Ruiz', 'Martín Iglesias',
                            'Florencia Vega', 'Lucas Martínez', 'Ana López', 'Pedro Sánchez'];
begin
  select id into v_emp from empresas where nombre = 'Bar Rivadavia';
  if v_emp is null then
    raise exception 'No existe el Bar Rivadavia. Corré supabase/seed/gastronomia.sql primero.';
  end if;

  select id into v_suc from sucursales where empresa_id = v_emp limit 1;
  select id into v_user from perfiles where empresa_id = v_emp limit 1;

  /* Lo de la corrida anterior. Los movimientos van primero: la clave
     foránea los deja huérfanos en vez de borrarlos, y un arqueo con
     ingresos de pedidos que ya no existen no cierra nunca. */
  delete from movimientos_caja  where operacion_id in (select id from operaciones where empresa_id = v_emp and campos_extra->>'demo' = 'pedidos');
  delete from movimientos_stock where operacion_id in (select id from operaciones where empresa_id = v_emp and campos_extra->>'demo' = 'pedidos');
  delete from operaciones where empresa_id = v_emp and campos_extra->>'demo' = 'pedidos';

  select id into v_ses from sesiones_caja
   where empresa_id = v_emp and cerrada_en is null order by abierta_en desc limit 1;
  if v_ses is null then
    insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial)
      values (v_emp, v_suc, 40000) returning id into v_ses;
  end if;

  /* ----------------------------------------------------------
     Lo que está en curso

     Repartido como un mediodía de verdad: la mayoría en preparación,
     unos cuantos recién entrados, algunos listos esperando al cadete.
     ---------------------------------------------------------- */

  create temp table demo (
    orden int, canal text, estado text, hace int, cliente text, tel text, ref text,
    p1 text, c1 int, p2 text, c2 int, p3 text, c3 int
  ) on commit drop;

  insert into demo (orden, canal, estado, hace, cliente, tel, ref, p1, c1, p2, c2, p3, c3) values
    -- pendientes
    (1,  'pedidosya', 'pendiente', 3,  'Juan Pérez',       null,         '5893', 'Hamburguesa simple', 2, 'Papas fritas', 1, null, null),
    (2,  'rappi',     'pendiente', 5,  'María González',   null,         '7441', 'Hamburguesa completa', 1, 'Gaseosa línea Coca 500 ml', 1, null, null),
    (3,  'mostrador', 'pendiente', 7,  null,               null,         null,   'Hamburguesa doble', 1, 'Papas fritas', 1, null, null),
    (4,  'takeaway',  'pendiente', 10, 'Lucas Martínez',   '11 5544-2211', null,  'Hamburguesa completa', 1, 'Aros de cebolla', 1, null, null),
    (5,  'ubereats',  'pendiente', 12, 'Nicolás Ferrari',  null,         '769',  'Hamburguesa veggie', 1, 'Papas fritas', 1, null, null),
    (6,  'delivery',  'pendiente', 14, 'Romina Acosta',    '11 6633-9080', null,  'Papas cheddar y panceta', 1, 'Cerveza Quilmes 1 L', 2, null, null),
    -- en preparación
    (7,  'pedidosya', 'en_preparacion', 12, 'Ana López',   null,         '5891', 'Hamburguesa doble', 2, 'Papas fritas', 1, 'Gaseosa línea Coca 500 ml', 1),
    (8,  'delivery',  'en_preparacion', 14, 'Pedro Sánchez', '11 4477-1200', null, 'Hamburguesa completa', 1, 'Papas fritas', 1, null, null),
    (9,  'ubereats',  'en_preparacion', 17, 'Sofía Ramírez', null,        '773',  'Hamburguesa veggie', 1, 'Papas fritas', 1, 'Agua mineral 500 ml', 1),
    (10, 'mostrador', 'en_preparacion', 20, null,           null,         null,   'Hamburguesa simple', 1, 'Gaseosa línea Coca 500 ml', 1, null, null),
    (11, 'rappi',     'en_preparacion', 22, 'Ezequiel Paz', null,         '7443', 'Ensalada César', 1, 'Limonada jarra', 1, null, null),
    (12, 'takeaway',  'en_preparacion', 24, 'Valeria Sosa', '11 2233-8877', null, 'Hamburguesa completa', 2, null, null, null, null),
    (13, 'delivery',  'en_preparacion', 26, 'Hernán Costa', '11 3311-5566', null, 'Papas cheddar y panceta', 1, 'Fernet con coca', 2, null, null),
    -- listos
    (14, 'pedidosya', 'listo', 20, 'Carla Ruiz',      null,          '5887', 'Hamburguesa doble', 1, 'Papas fritas', 1, null, null),
    (15, 'takeaway',  'listo', 22, 'Martín Iglesias', '11 7788-3322', null,  'Hamburguesa completa', 1, 'Gaseosa línea Coca 500 ml', 1, null, null),
    (16, 'mostrador', 'listo', 25, null,              null,          null,   'Hamburguesa simple', 1, null, null, null, null),
    -- en camino
    (17, 'delivery',  'en_camino', 30, 'Diego Morales', '11 5566-7788', null, 'Hamburguesa doble', 1, 'Papas fritas', 1, null, null),
    (18, 'rappi',     'en_camino', 33, 'Florencia Vega', null,         '7439', 'Hamburguesa completa', 1, null, null, null, null);

  for r in select * from demo order by orden loop
    v_id := gen_random_uuid();

    insert into operaciones (
      id, empresa_id, sucursal_id, tipo, estado, estado_pedido, canal, referencia,
      fecha, abierta_en, usuario_id, campos_extra
    ) values (
      v_id, v_emp, v_suc, 'comanda', 'abierta', r.estado, r.canal, r.ref,
      now() - (r.hace || ' minutes')::interval,
      now() - (r.hace || ' minutes')::interval,
      v_user,
      jsonb_build_object('demo', 'pedidos') ||
      case when r.cliente is null and r.tel is null then '{}'::jsonb
           else jsonb_build_object('cliente', jsonb_strip_nulls(
                  jsonb_build_object('nombre', r.cliente, 'telefono', r.tel))) end
    );

    v_estado := case r.estado
      when 'pendiente' then 'borrador'
      when 'en_preparacion' then 'preparando'
      else 'listo' end;

    insert into operacion_lineas (
      operacion_id, empresa_id, item_id, descripcion, cantidad,
      precio_unitario, costo_unitario, iva, total, estado, destino, enviada_en
    )
    select v_id, v_emp, i.id, i.nombre, x.cant, i.precio, i.costo, i.iva,
           i.precio * x.cant, v_estado, i.campos_extra->>'destino',
           case when v_estado = 'borrador' then null else now() - (r.hace || ' minutes')::interval end
    from (values (r.p1, r.c1), (r.p2, r.c2), (r.p3, r.c3)) as x(plato, cant)
    join items i on i.empresa_id = v_emp and i.nombre = x.plato
    where x.plato is not null;

    select coalesce(sum(total), 0) into v_sub from operacion_lineas where operacion_id = v_id;
    update operaciones set subtotal = v_sub, total = v_sub where id = v_id;

    /* El historial que habría dejado el trabajo real. Se reemplaza el
       que escribió el disparador, que puso todo a esta hora: sin
       tiempos escalonados, las estadísticas de preparación dan cero. */
    delete from pedido_estados where operacion_id = v_id;
    insert into pedido_estados (empresa_id, operacion_id, estado, anterior, usuario_id, fecha)
      values (v_emp, v_id, 'pendiente', null, v_user, now() - (r.hace || ' minutes')::interval);

    if r.estado <> 'pendiente' then
      insert into pedido_estados (empresa_id, operacion_id, estado, anterior, usuario_id, fecha)
        values (v_emp, v_id, 'en_preparacion', 'pendiente', v_user, now() - ((r.hace - 2) || ' minutes')::interval);
    end if;
    if r.estado in ('listo', 'en_camino') then
      insert into pedido_estados (empresa_id, operacion_id, estado, anterior, usuario_id, fecha)
        values (v_emp, v_id, 'listo', 'en_preparacion', v_user, now() - ((r.hace - 16) || ' minutes')::interval);
    end if;
    if r.estado = 'en_camino' then
      insert into pedido_estados (empresa_id, operacion_id, estado, anterior, usuario_id, fecha)
        values (v_emp, v_id, 'en_camino', 'listo', v_user, now() - ((r.hace - 25) || ' minutes')::interval);
    end if;
  end loop;

  /* ----------------------------------------------------------
     Lo que ya se cobró hoy

     Van con su pago y su movimiento de caja porque un pedido completado
     que no dejó plata en ningún lado no es un pedido completado: es
     justamente lo que este módulo no tiene que permitir.
     ---------------------------------------------------------- */

  for i in 1..24 loop
    v_id := gen_random_uuid();
    v_hace := 45 + i * 11;

    insert into operaciones (
      id, empresa_id, sucursal_id, tipo, estado, estado_pedido, canal, referencia,
      numero, fecha, abierta_en, cerrada_en, usuario_id, campos_extra
    ) values (
      v_id, v_emp, v_suc, 'comanda', 'confirmada', 'completado',
      v_canales[1 + (i % 6)],
      case when v_canales[1 + (i % 6)] in ('pedidosya', 'rappi', 'ubereats')
           then (5860 + i)::text else null end,
      'DEMO-' || lpad(i::text, 4, '0'),
      now() - (v_hace || ' minutes')::interval,
      now() - (v_hace || ' minutes')::interval,
      now() - ((v_hace - 30) || ' minutes')::interval,
      v_user,
      jsonb_build_object('demo', 'pedidos',
        'cliente', jsonb_build_object('nombre', v_nombres[1 + (i % 8)]))
    );

    insert into operacion_lineas (
      operacion_id, empresa_id, item_id, descripcion, cantidad,
      precio_unitario, costo_unitario, iva, total, estado, destino
    )
    select v_id, v_emp, it.id, it.nombre, x.cant, it.precio, it.costo, it.iva,
           it.precio * x.cant, 'entregado', it.campos_extra->>'destino'
    from (values (v_platos[1 + (i % 6)], 1 + (i % 2)), ('Papas fritas', 1)) as x(plato, cant)
    join items it on it.empresa_id = v_emp and it.nombre = x.plato;

    select coalesce(sum(total), 0) into v_sub from operacion_lineas where operacion_id = v_id;
    update operaciones set subtotal = v_sub, total = v_sub where id = v_id;

    insert into pagos (operacion_id, empresa_id, medio, monto, fecha)
      values (v_id, v_emp, case when i % 3 = 0 then 'efectivo' else 'debito' end, v_sub,
              now() - ((v_hace - 30) || ' minutes')::interval);

    insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, operacion_id, usuario_id, fecha)
      values (v_emp, v_suc, v_ses, 'ingreso', case when i % 3 = 0 then 'efectivo' else 'debito' end,
              v_sub, 'Venta DEMO-' || lpad(i::text, 4, '0'), v_id, v_user,
              now() - ((v_hace - 30) || ' minutes')::interval);

    insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, operacion_id, usuario_id, fecha)
    select v_emp, v_suc, it.id, -l.cantidad, 'venta', v_id, v_user, now() - ((v_hace - 30) || ' minutes')::interval
    from operacion_lineas l join items it on it.id = l.item_id
    where l.operacion_id = v_id and it.controla_stock;

    delete from pedido_estados where operacion_id = v_id;
    insert into pedido_estados (empresa_id, operacion_id, estado, anterior, usuario_id, fecha) values
      (v_emp, v_id, 'pendiente',      null,             v_user, now() - (v_hace || ' minutes')::interval),
      (v_emp, v_id, 'en_preparacion', 'pendiente',      v_user, now() - ((v_hace - 3) || ' minutes')::interval),
      (v_emp, v_id, 'listo',          'en_preparacion', v_user, now() - ((v_hace - 18) || ' minutes')::interval),
      (v_emp, v_id, 'completado',     'listo',          v_user, now() - ((v_hace - 30) || ' minutes')::interval);
  end loop;

  /* Lo escribieron los disparadores mientras se sembraba, pero no lo hizo
     nadie: dejarlo sería ensuciar el registro de quién hizo qué. */
  delete from bitacora where empresa_id = v_emp and accion = 'pedido.estado'
     and entidad_id in (select id from operaciones where campos_extra->>'demo' = 'pedidos');

  raise notice 'Sembrados 18 pedidos en curso y 24 completados para el Bar Rivadavia.';
end;
$$;
