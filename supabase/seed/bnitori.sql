/* ============================================================
   SEMILLA DE QA · Bnitori, casa de sanitarios (rubro minimercado)
   ============================================================

   El acceso (dueno@bnitori.com.ar) se crea aparte, en bnitori_usuario.sql,
   por la misma razón que el de Almha: depende de un usuario que ya
   exista en Authentication.

   Comercio de prueba end-to-end para validar el flujo de venta de
   artículos de sanitarios (inodoros, griferías, piletas) sobre el motor
   de "minimercado": mismo POS, mismo stock, mismas compras que un
   almacén, con su propio catálogo. TODOS LOS DATOS SON DE EJEMPLO.

   Se puede correr más de una vez sin duplicar.
   ============================================================ */

do $$
declare
  v_emp  uuid;
  v_suc  uuid;
  v_item uuid;
  it     record;
begin

select id into v_emp from empresas where nombre = 'Bnitori';

if v_emp is null then
  insert into empresas (nombre, rubro, plan, modulos, config)
  values (
    'Bnitori',
    'minimercado',
    'completo',
    array['cobro','caja','ajustes','productos','stock','compras','pedidos','clientes','reportes'],
    jsonb_build_object(
      'fiscal', jsonb_build_object(
        'nombreFactura', 'Bnitori',
        'razonSocial',   'Bnitori Sanitarios SRL (datos de ejemplo)',
        'cuit',          '30-71234567-8',
        'condicion',     'RESPONSABLE_INSCRIPTO',
        'iibb',          '901-999888-7',
        'inicio',        '01/01/2020',
        'puntoVenta',    '0001',
        'domicilio',     'Av. de los Sanitarios 456 · Buenos Aires'
      ),
      'medios', jsonb_build_array(
        jsonb_build_object('k','efectivo',      'n','Efectivo',          'tasa',0,   'recargo',false,'activo',true),
        jsonb_build_object('k','debito',        'n','Débito',            'tasa',1.2, 'recargo',false,'activo',true),
        jsonb_build_object('k','credito',       'n','Crédito',           'tasa',3.1, 'recargo',false,'activo',true),
        jsonb_build_object('k','mp',            'n','QR / Mercado Pago', 'tasa',0.8, 'recargo',false,'activo',true),
        jsonb_build_object('k','transferencia', 'n','Transferencia',     'tasa',0,   'recargo',false,'activo',true)
      ),
      'ancho', 80,
      'demo', true
    )
  )
  returning id into v_emp;
  raise notice 'Bnitori creada.';
else
  raise notice 'Bnitori ya existía. Se completa el catálogo.';
end if;

select id into v_suc from sucursales where empresa_id = v_emp limit 1;
if v_suc is null then
  insert into sucursales (empresa_id, nombre, domicilio)
  values (v_emp, 'Casa central', 'Av. de los Sanitarios 456 · Buenos Aires')
  returning id into v_suc;
end if;

/* ------------------------------------------------------------
   El catálogo: sanitarios, griferías y accesorios de baño.
   ------------------------------------------------------------ */
for it in
  select * from (values
    ('Inodoro Ferrum Bari Blanco',            'Inodoros',   'Ferrum',    '7791234000011', 145000, 210000, 12),
    ('Inodoro Roca Victoria c/mochila',       'Inodoros',   'Roca',      '7791234000028', 168000, 245000,  8),
    ('Mochila descarga Ferrum universal',     'Inodoros',   'Ferrum',    '7791234000035',  22000,  36000, 20),
    ('Bidet Ferrum Bari Blanco',              'Bidets',     'Ferrum',    '7791234000042',  98000, 152000, 10),
    ('Grifería monocomando FV Acquablu',      'Griferías',  'FV',        '7791234000059',  54000,  89000, 18),
    ('Grifería para cocina FV Nickel',        'Griferías',  'FV',        '7791234000066',  47000,  76000, 15),
    ('Ducha telefono c/soporte Newport',      'Duchas',     'Newport',   '7791234000073',  18500,  31000, 25),
    ('Columna de hidromasaje Rusco',          'Duchas',     'Rusco',     '7791234000080', 210000, 320000,  4),
    ('Pileta de cocina Johnson 1 bacha',      'Piletas',    'Johnson',   '7791234000097',  62000,  99000,  9),
    ('Bacha para baño Ferrum ovalada',        'Piletas',    'Ferrum',    '7791234000103',  35000,  58000, 14),
    ('Caño PVC 110mm x 3m',                   'Cañerías',   'Awaduct',   '7791234000110',   8900,  14500, 60),
    ('Codo PVC 90° 110mm',                    'Cañerías',   'Awaduct',   '7791234000127',   1200,   2100,150),
    ('Cinta de teflón 12mm',                  'Accesorios', 'Genérico',  '7791234000134',    350,    900,300),
    ('Asiento inodoro universal blanco',      'Accesorios', 'Genérico',  '7791234000141',   9800,  16500, 40),
    ('Kit tornillería para inodoro',          'Accesorios', 'Genérico',  '7791234000158',   1800,   3400, 80)
  ) as t(nombre, categoria, marca, barcode, costo, precio, stock_inicial)
loop
  select id into v_item from items where empresa_id = v_emp and nombre = it.nombre;

  if v_item is null then
    insert into items (empresa_id, tipo, nombre, categoria, marca, barcode, unidad,
                       costo, precio, controla_stock, campos_extra)
    values (v_emp, 'producto', it.nombre, it.categoria, it.marca, it.barcode, 'un',
            it.costo, it.precio, true, jsonb_build_object('demo', true))
    returning id into v_item;

    insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, motivo)
    values (v_emp, v_suc, v_item, it.stock_inicial, 'inicial', 'Carga inicial de catálogo (QA Bnitori)');
  end if;
end loop;

/* ------------------------------------------------------------
   Un cliente de ejemplo, para probar factura A/B en el POS.
   ------------------------------------------------------------ */
insert into clientes (empresa_id, razon_social, tipo_doc, doc, condicion, domicilio, tel)
select v_emp, 'Constructora del Sur SRL', 'CUIT', '30-70000000-1', 'RI', 'Ruta 8 km 45', '1145550000'
where not exists (select 1 from clientes where empresa_id = v_emp and razon_social = 'Constructora del Sur SRL');

raise notice 'Bnitori lista: % productos, % clientes.',
  (select count(*) from items    where empresa_id = v_emp and activo),
  (select count(*) from clientes where empresa_id = v_emp and activo);
end;
$$;

select
  e.nombre, e.rubro,
  (select count(*) from items i where i.empresa_id = e.id) as productos,
  (select p.nombre from perfiles p where p.empresa_id = e.id limit 1) as usuario
from empresas e
where e.nombre = 'Bnitori';
