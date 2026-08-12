/* ============================================================
   SEMILLA · un segundo comercio, de otro rubro
   ============================================================

   Hasta ahora Genez tenía un solo inquilino y era un minimercado. Con uno
   solo no se puede saber si la plataforma se adapta o si simplemente está
   hecha para ese negocio.

   Este es una hamburguesería: vende con comanda en vez de cobro directo,
   no contrata los módulos de compras ni de pedidos, y su carta tiene
   platos que no controlan stock junto a bebidas que sí.

   Se puede correr más de una vez sin duplicar.
   ============================================================ */

do $$
declare
  v_empresa  uuid;
  v_sucursal uuid;
begin

if exists (select 1 from empresas where nombre = 'Bar Rivadavia') then
  raise notice 'El comercio de gastronomía ya estaba cargado. No se hizo nada.';
  return;
end if;

insert into empresas (nombre, rubro, plan, modulos, config)
values (
  'Bar Rivadavia',
  'gastronomia',
  'completo',
  array['cobro','caja','ajustes','comandas','productos','stock','clientes','reportes'],
  jsonb_build_object(
    'fiscal', jsonb_build_object(
      'nombreFactura', 'Bar Rivadavia',
      'razonSocial',   'Rivadavia Gastronomica SRL',
      'cuit',          '30-71455872-9',
      'condicion',     'RESPONSABLE INSCRIPTO',
      'iibb',          '902-887654-1',
      'inicio',        '15/06/2022',
      'puntoVenta',    '0003',
      'domicilio',     'Av. Rivadavia 5840 · CABA'
    ),
    'medios', jsonb_build_array(
      jsonb_build_object('k','efectivo',      'n','Efectivo',          'tasa',0,   'recargo',false,'activo',true),
      jsonb_build_object('k','debito',        'n','Débito',            'tasa',1.2, 'recargo',false,'activo',true),
      jsonb_build_object('k','credito',       'n','Crédito',           'tasa',3.1, 'recargo',false,'activo',true),
      jsonb_build_object('k','mp',            'n','QR / Mercado Pago', 'tasa',0.8, 'recargo',false,'activo',true)
    ),
    'ancho', 58,
    /* El dueño decide si cuelga una pantalla en la cocina o si le alcanza
       con imprimir la comanda. Acá está prendida para poder probarla. */
    'cocinaEnPantalla', true,
    'destinos', jsonb_build_array('cocina', 'barra')
  )
)
returning id into v_empresa;

insert into sucursales (empresa_id, nombre, domicilio)
values (v_empresa, 'Salón', 'Av. Rivadavia 5840 · CABA')
returning id into v_sucursal;

/* ------------------------------------------------------------
   El salón
   ------------------------------------------------------------ */

insert into recursos (empresa_id, sucursal_id, tipo, nombre, sector, capacidad, orden)
select v_empresa, v_sucursal, 'mesa', v.nombre, v.sector, v.cap, v.orden
from (values
  ('Mesa 1', 'Salón',  2, 1), ('Mesa 2', 'Salón',  2, 2),
  ('Mesa 3', 'Salón',  4, 3), ('Mesa 4', 'Salón',  4, 4),
  ('Mesa 5', 'Salón',  6, 5), ('Mesa 6', 'Salón',  4, 6),
  ('Vereda 1', 'Vereda', 4, 7), ('Vereda 2', 'Vereda', 4, 8),
  ('Barra 1', 'Barra',  1, 9), ('Barra 2', 'Barra',  1, 10)
) as v(nombre, sector, cap, orden);

/* ------------------------------------------------------------
   La carta

   Los platos no controlan stock: lo que se descuenta al vender una
   hamburguesa son sus insumos, y eso es producción, que todavía no
   existe. Las bebidas sí, porque se venden tal como se compran.
   ------------------------------------------------------------ */

insert into items (empresa_id, tipo, nombre, categoria, precio, costo, iva, controla_stock, unidad, campos_extra)
select v_empresa, 'producto', v.nombre, v.cat, v.precio, v.costo, 21, v.stock, 'un',
       jsonb_build_object('destino', v.destino)
from (values
  ('Hamburguesa simple',        'Hamburguesas', 8500,  3100, false, 'cocina'),
  ('Hamburguesa doble',         'Hamburguesas', 11200, 4400, false, 'cocina'),
  ('Hamburguesa completa',      'Hamburguesas', 12800, 5000, false, 'cocina'),
  ('Hamburguesa veggie',        'Hamburguesas', 9800,  3600, false, 'cocina'),
  ('Papas fritas',              'Para compartir', 5400, 1500, false, 'cocina'),
  ('Papas cheddar y panceta',   'Para compartir', 8900, 2900, false, 'cocina'),
  ('Aros de cebolla',           'Para compartir', 5900, 1800, false, 'cocina'),
  ('Ensalada César',            'Frescos',        8200, 2700, false, 'cocina'),
  ('Cerveza artesanal pinta',   'Cervezas',       6500, 2400, true,  'barra'),
  ('Cerveza Quilmes 1 L',       'Cervezas',       5200, 2100, true,  'barra'),
  ('Gaseosa línea Coca 500 ml', 'Bebidas',        2800, 1100, true,  'barra'),
  ('Agua mineral 500 ml',       'Bebidas',        2200,  800, true,  'barra'),
  ('Limonada jarra',            'Bebidas',        6800, 1900, false, 'barra'),
  ('Vino tinto copa',           'Vinos',          4900, 1600, true,  'barra'),
  ('Fernet con coca',           'Tragos',         7200, 2300, false, 'barra'),
  ('Café',                      'Cafetería',      2600,  700, false, 'barra'),
  ('Brownie con helado',        'Postres',        6400, 2000, false, 'cocina'),
  ('Flan casero',               'Postres',        5200, 1500, false, 'cocina')
) as v(nombre, cat, precio, costo, stock, destino);

/* Las bebidas arrancan con stock; los platos no llevan. */
insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, motivo)
select v_empresa, v_sucursal, i.id, 48, 'inicial', 'Carga inicial de la barra'
from items i
where i.empresa_id = v_empresa and i.controla_stock;

raise notice 'Bar Rivadavia cargado: 10 mesas, 18 items de carta.';

end $$;
