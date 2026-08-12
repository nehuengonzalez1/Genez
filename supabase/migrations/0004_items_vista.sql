/* ============================================================
   0004 · HISTORIAL DE PRECIOS Y VISTA DEL CATÁLOGO
   ============================================================

   El prototipo guardaba en cada producto un `costoPrev` y un `precioPrev`
   para poder decir "esto subió". Guardar el valor anterior en un campo
   solo sirve para un cambio: al segundo se pierde el original.

   Acá el valor anterior se deduce del historial, igual que el stock se
   deduce de los movimientos.

   La vista arma el producto con la forma que ya espera la aplicación,
   así los módulos no tienen que aprender el esquema nuevo.
   ============================================================ */

create table historial_precios (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  precio      numeric(14,2) not null,
  fecha       timestamptz not null default now(),
  origen      text
);

create index on historial_precios (item_id, fecha desc);

alter table historial_precios enable row level security;

create policy historial_precios_todo on historial_precios
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ============================================================
   LA VISTA

   Las ventas todavía no están migradas, así que las columnas de
   rotación devuelven cero. La consulta ya está escrita contra
   operaciones: el día que se carguen ventas, empieza a dar números
   sin tocar nada acá.
   ============================================================ */

create view items_vista
with (security_invoker = true) as
select
  i.id,
  i.empresa_id,
  i.tipo,
  i.nombre,
  i.categoria,
  i.marca,
  i.sku,
  i.barcode,
  i.unidad,
  i.costo,
  i.precio,
  i.precios,
  i.iva,
  i.controla_stock,
  i.stock_min,
  i.bulto,
  i.duracion_min,
  i.campos_extra,
  i.activo,
  pr.nombre as proveedor,
  i.proveedor_id,

  coalesce(st.stock, 0) as stock,
  st.vence,

  /* El costo de referencia es el último anterior a los 30 días. Si el
     producto no tiene historial tan viejo, se compara contra sí mismo:
     sin punto de comparación no hubo suba. */
  coalesce(hc.costo,  i.costo)  as costo_prev,
  coalesce(hp.precio, i.precio) as precio_prev,

  coalesce(v.u30, 0)  as u30,
  coalesce(vp.u30, 0) as u30p,
  round(coalesce(v.u30, 0) / 30.0, 4) as vel,
  v.ultima_venta

from items i
left join proveedores pr on pr.id = i.proveedor_id

left join (
  select item_id, sum(cantidad) as stock, min(vence) filter (where vence is not null) as vence
  from movimientos_stock
  group by item_id
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
  from operacion_lineas l
  join operaciones o on o.id = l.operacion_id
  where o.tipo = 'venta' and o.fecha > now() - interval '30 days'
  group by l.item_id
) v on v.item_id = i.id

left join (
  select l.item_id, sum(l.cantidad) as u30
  from operacion_lineas l
  join operaciones o on o.id = l.operacion_id
  where o.tipo = 'venta'
    and o.fecha > now() - interval '60 days'
    and o.fecha <= now() - interval '30 days'
  group by l.item_id
) vp on vp.item_id = i.id;

comment on view items_vista is 'El catálogo con stock, costo anterior y rotación ya calculados. Es lo que consume el front.';
