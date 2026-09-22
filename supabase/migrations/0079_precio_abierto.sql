/* ============================================================
   0079 · ARTÍCULOS DE PRECIO ABIERTO
   ============================================================

   Hay mostradores donde el precio no está en la ficha: la fiambrería
   corta lo que le piden y el importe sale de la balanza, la panadería
   vende por bandeja. El producto existe, tiene nombre y categoría, pero
   su precio lo pone el cajero en el momento.

   Hasta acá el catálogo no podía representar eso: un producto sin precio
   es un producto mal cargado, y `Vender` lo rechaza antes de sumarlo al
   carrito. Esta columna distingue "no le pusieron precio todavía" de "su
   precio se decide al vender", que son dos cosas distintas y solo una es
   un error.

   POR QUÉ UNA COLUMNA Y NO `campos_extra`
   ---------------------------------------
   Porque cambia el comportamiento del punto de venta, no es un dato
   suelto del rubro. Un informe que quiera separar los renglones de precio
   abierto —y va a querer, porque su margen no se puede calcular igual—
   tiene que poder filtrar por esto sin abrir un jsonb.

   NO ES LO MISMO QUE LOS CÓDIGOS DE BALANZA
   -----------------------------------------
   Esos ya existen (ver `leerCodigoBalanza`) y resuelven el caso en el que
   la balanza imprime una etiqueta: ahí el importe viaja adentro del
   código de barras y nadie tipea nada. Esto es el camino de al lado, para
   cuando esa etiqueta no existe. Conviven: un comercio puede tener los
   dos, y el mismo producto puede venderse de las dos formas.
   ============================================================ */

alter table items
  add column if not exists precio_abierto boolean not null default false;

comment on column items.precio_abierto is
  'El precio lo escribe el cajero al vender, no sale de items.precio. Para mostradores de fiambrería, panadería y afines.';

/* Un producto de precio abierto no necesita precio cargado, así que el
   índice parcial de siempre —el que busca los que están sin precio para
   avisar— no tiene que contarlos. No hay tal índice hoy; queda dicho para
   cuando se agregue el informe de "productos sin precio". */


/* ------------------------------------------------------------
   La vista del catálogo

   Se repite entera porque `create or replace view` exige la misma lista
   de columnas en el mismo orden, y solo deja AGREGAR al final. Por eso
   `precio_abierto` va último y no al lado de `precio`, que es donde
   quedaría mejor.
   ------------------------------------------------------------ */

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
  i.descripcion,
  i.imagen,
  uc.costo_reposicion,
  uc.costo_reposicion_fecha,
  i.precio_abierto
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
) vp on vp.item_id = i.id
left join lateral (
  select l.costo_unitario as costo_reposicion, o.cerrada_en as costo_reposicion_fecha
  from operacion_lineas l join operaciones o on o.id = l.operacion_id
  where l.item_id = i.id and o.tipo = 'compra'
  order by o.cerrada_en desc nulls last
  limit 1
) uc on true;

comment on view items_vista is
  'El catálogo con stock, costo anterior, rotación y costo de reposición (última compra) ya calculados. Es lo que consume el front.';
