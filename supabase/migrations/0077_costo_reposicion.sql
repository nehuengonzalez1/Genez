/* ============================================================
   0077 · COSTO DE REPOSICIÓN
   ============================================================

   El PPP (`items.costo`) dice cuánto costó en promedio lo que hay hoy en
   el estante. No dice cuánto costaría volver a comprarlo — si el
   proveedor subió y todavía queda stock viejo más barato mezclado en el
   promedio, el PPP se atrasa contra la realidad. Para saber si el precio
   de venta actual todavía alcanza para reponer, hace falta el costo de
   la ÚLTIMA compra, aparte del promedio.

   No es una tabla nueva: ya está en `operacion_lineas` (tipo compra)
   desde 0001, solo faltaba traerlo a la vista del catálogo. */

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
  uc.costo_reposicion_fecha

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

comment on view items_vista is 'El catálogo con stock, costo anterior, rotación y costo de reposición (última compra) ya calculados. Es lo que consume el front.';
