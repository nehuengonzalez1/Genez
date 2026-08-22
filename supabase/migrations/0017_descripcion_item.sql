/* ============================================================
   0017 · QUÉ LLEVA CADA COSA
   ============================================================

   Un producto de minimercado se explica solo: "Coca-Cola 1,5 L" no
   necesita aclaración. Un plato no: quien atiende tiene que poder
   contestar qué lleva la completa sin ir a preguntar a la cocina, y el
   cliente elige por eso.

   Va como columna propia y no dentro de campos_extra porque se muestra
   en pantalla en cada carta y se va a querer buscar por ahí.
   ============================================================ */

alter table items add column descripcion text;

comment on column items.descripcion is
  'Qué lleva. En gastronomía es lo que decide la compra; en un almacén queda vacío.';

/* La vista del catálogo la consume el front, así que tiene que traerla.
   La columna nueva va al final: `create or replace view` no admite
   reordenar las que ya estaban, y recrear la vista para acomodar una
   columna sería arriesgar lo que ya funciona por una cuestión estética. */
create or replace view items_vista
with (security_invoker = true) as
select
  i.id, i.empresa_id, i.tipo, i.nombre, i.categoria, i.marca,
  i.sku, i.barcode, i.unidad, i.costo, i.precio, i.precios, i.iva,
  i.controla_stock, i.stock_min, i.bulto, i.duracion_min, i.campos_extra, i.activo,
  pr.nombre as proveedor,
  i.proveedor_id,

  coalesce(st.stock, 0) as stock,
  st.vence,

  coalesce(hc.costo,  i.costo)  as costo_prev,
  coalesce(hp.precio, i.precio) as precio_prev,

  coalesce(v.u30, 0)  as u30,
  coalesce(vp.u30, 0) as u30p,
  round(coalesce(v.u30, 0) / 30.0, 4) as vel,
  v.ultima_venta,
  i.descripcion

from items i
left join proveedores pr on pr.id = i.proveedor_id

left join (
  select item_id, sum(cantidad) as stock, min(vence) filter (where vence is not null) as vence
  from movimientos_stock group by item_id
) st on st.item_id = i.id

left join lateral (
  select h.costo from historial_costos h
  where h.item_id = i.id and h.fecha < now() - interval '30 days'
  order by h.fecha desc limit 1
) hc on true

left join lateral (
  select h.precio from historial_precios h
  where h.item_id = i.id and h.fecha < now() - interval '30 days'
  order by h.fecha desc limit 1
) hp on true

left join (
  select l.item_id, sum(l.cantidad) as u30, max(o.fecha) as ultima_venta
  from operacion_lineas l join operaciones o on o.id = l.operacion_id
  where o.tipo = 'venta' and o.fecha > now() - interval '30 days'
  group by l.item_id
) v on v.item_id = i.id

left join (
  select l.item_id, sum(l.cantidad) as u30
  from operacion_lineas l join operaciones o on o.id = l.operacion_id
  where o.tipo = 'venta'
    and o.fecha > now() - interval '60 days'
    and o.fecha <= now() - interval '30 days'
  group by l.item_id
) vp on vp.item_id = i.id;

/* ------------------------------------------------------------
   La carta del bar, con lo que lleva cada plato
   ------------------------------------------------------------ */

update items i set descripcion = v.d
from (values
  ('Hamburguesa simple',        'Carne, lechuga, tomate y mayonesa.'),
  ('Hamburguesa doble',         'Doble carne, cheddar y cebolla caramelizada.'),
  ('Hamburguesa completa',      'Carne, cheddar, panceta, huevo y lechuga.'),
  ('Hamburguesa veggie',        'Medallón de garbanzo, lechuga, tomate y alioli.'),
  ('Papas fritas',              'Porción grande, con sal marina.'),
  ('Papas cheddar y panceta',   'Cheddar fundido y panceta crocante.'),
  ('Aros de cebolla',           'Ocho unidades rebozadas, con salsa barbacoa.'),
  ('Ensalada César',            'Lechuga, pollo grillado, croutones y aderezo césar.'),
  ('Cerveza artesanal pinta',   'Pinta de 500 ml. Rubia, roja o negra.'),
  ('Cerveza Quilmes 1 L',       'Botella de litro, bien fría.'),
  ('Gaseosa línea Coca 500 ml', 'Coca, Coca Zero, Sprite o Fanta.'),
  ('Agua mineral 500 ml',       'Con o sin gas.'),
  ('Limonada jarra',            'Jarra de un litro con menta y jengibre.'),
  ('Vino tinto copa',           'Malbec de la casa.'),
  ('Fernet con coca',           'Medida doble, con hielo.'),
  ('Café',                      'Espresso, cortado o con leche.'),
  ('Brownie con helado',        'Brownie tibio con helado de crema americana.'),
  ('Flan casero',               'Con dulce de leche y crema.')
) as v(n, d)
where i.nombre = v.n
  and i.empresa_id = (select id from empresas where nombre = 'Bar Rivadavia');
