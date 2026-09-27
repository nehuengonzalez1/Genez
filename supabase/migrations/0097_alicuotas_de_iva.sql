/* ============================================================
   0097 · LA ALÍCUOTA DE IVA DE CADA PRODUCTO, BIEN DICHA
   ============================================================

   Primer paso de la factura A y B. Para discriminar o informar el IVA,
   ARCA pide el importe por alícuota, y además separa dos cosas que hasta
   hoy eran un mismo "0": lo EXENTO (va en ImpOpEx) y lo NO GRAVADO (va en
   ImpTotConc), distintos a su vez de lo gravado al 0% (alícuota 3). Un
   número solo no alcanza para decir cuál es, así que se suma
   `iva_condicion` al producto y al renglón vendido.

   Las alícuotas válidas son las que ARCA acepta: 0, 2,5, 5, 10,5, 21 y
   27. Hasta ahora `iva` aceptaba cualquier número; el 27/09 los 1.462
   productos de la base tenían 21 (nadie cargó las reales: la leche, el
   pan y los fideos van al 10,5), así que la regla nueva no rompe nada.
   En el renglón vendido no se pone la regla: es historia, y una venta
   que quedó en la cola sin internet no puede rebotar por esto.

   EL RENGLÓN TOMA LA ALÍCUOTA DE LA BASE, NO LA DEL NAVEGADOR
   ------------------------------------------------------------
   El navegador manda el `iva` del producto que tiene en memoria, que
   puede estar viejo (otra caja lo cambió) o faltar (la comanda mandaba
   21 si no venía). Para un monotributista no importaba; para una A o una
   B es el IVA que se le informa a ARCA. Un disparador lo completa al
   insertar, en un solo lugar, en vez de reescribir las seis funciones
   que insertan renglones (registrar_venta, las de la comanda, la
   devolución, la nota de débito):

   - Una devolución copia el de su renglón original (`origen_linea_id`):
     se devuelve con el IVA con que se vendió, aunque después el producto
     haya cambiado de alícuota. Si no, la nota de crédito no cerraría
     contra la factura.
   - Un renglón de un producto toma el del producto hoy.
   - Un renglón libre (la nota de débito, un ítem sin producto) queda
     como venga, gravado.
   ============================================================ */

alter table items
  add column iva_condicion text not null default 'gravado'
    check (iva_condicion in ('gravado', 'exento', 'no_gravado'));

alter table items
  add constraint items_iva_valida check (
    (iva_condicion = 'gravado' and iva in (0, 2.5, 5, 10.5, 21, 27))
    or (iva_condicion <> 'gravado' and iva = 0)
  );

comment on column items.iva_condicion is
  'gravado (con la alícuota de iva), exento o no_gravado (iva en 0). ARCA los informa en campos distintos: ver 0097.';

alter table operacion_lineas
  add column iva_condicion text not null default 'gravado'
    check (iva_condicion in ('gravado', 'exento', 'no_gravado'));

comment on column operacion_lineas.iva_condicion is
  'Copiada del producto (o del renglón original, en una devolución) por renglon_con_su_iva(). Ver 0097.';

create or replace function renglon_con_su_iva()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_iva numeric;
  v_cond text;
begin
  if new.origen_linea_id is not null then
    select iva, iva_condicion into v_iva, v_cond from operacion_lineas where id = new.origen_linea_id;
  elsif new.item_id is not null then
    select iva, iva_condicion into v_iva, v_cond from items where id = new.item_id;
  end if;

  if v_cond is not null then
    new.iva := v_iva;
    new.iva_condicion := v_cond;
  end if;
  if new.iva_condicion <> 'gravado' then
    new.iva := 0;
  end if;
  return new;
end;
$$;

create trigger renglon_con_su_iva
  before insert on operacion_lineas
  for each row execute function renglon_con_su_iva();

/* La vista del catálogo, con la columna nueva al final (una vista solo
   admite columnas nuevas al final). El resto, igual que en 0079. */
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
  i.precio_abierto,
  i.iva_condicion
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
