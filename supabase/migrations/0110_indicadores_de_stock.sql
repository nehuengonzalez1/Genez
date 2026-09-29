/* ============================================================
   0110 · Indicadores de stock con lo que de verdad pasó
   ============================================================

   Los indicadores de Stock ya salían de la base, pero contaban mal y no
   distinguían lo que nunca se contó:

   LA VENTA DE CADA PRODUCTO
   -------------------------
   u30 (lo vendido en 30 días, de donde sale la velocidad) contaba solo
   ventas de mostrador: las comandas cerradas del bar no existían, y sus
   productos figuraban "sin movimiento". Tampoco restaba las devoluciones
   (0090) ni miraba el estado. Ahora: venta, comanda y devolución (en
   negativo), confirmadas. La última venta no cuenta una devolución.

   STOCK CARGADO
   -------------
   Super 25 nunca cargó su stock inicial: arrancó en cero, y cada venta lo
   dejó en negativo. "Para reponer" le mostraba cien productos que no
   estaban por agotarse; nunca se habían contado. stock_cargado dice si el
   producto tuvo alguna vez un movimiento que no sea venta o devolución
   (una compra, un conteo, un stock inicial, un pase): recién ahí su stock
   significa algo.

   CARGAR EL STOCK DE UNA VEZ
   --------------------------
   ajustar_stock_lote hace el conteo de 0109 para muchos productos en una
   transacción: la planilla de stock inicial. Cada fila pasa por
   ajustar_stock, así que queda igual que un conteo a mano, con quién lo
   hizo, y la diferencia contra lo que hay en ese momento.
   ============================================================ */

create or replace view items_vista with (security_invoker = true) as
SELECT i.id,
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
    pr.nombre AS proveedor,
    i.proveedor_id,
    COALESCE(st.stock, (0)::numeric) AS stock,
    st.vence,
    COALESCE(hc.costo, i.costo) AS costo_prev,
    COALESCE(hp.precio, i.precio) AS precio_prev,
    COALESCE(v.u30, (0)::numeric) AS u30,
    COALESCE(vp.u30, (0)::numeric) AS u30p,
    round((COALESCE(v.u30, (0)::numeric) / 30.0), 4) AS vel,
    v.ultima_venta,
    i.descripcion,
    i.imagen,
    uc.costo_reposicion,
    uc.costo_reposicion_fecha,
    i.precio_abierto,
    i.iva_condicion,
    COALESCE(st.cargado, false) AS stock_cargado
   FROM (((((((items i
     LEFT JOIN proveedores pr ON ((pr.id = i.proveedor_id)))
     LEFT JOIN ( SELECT movimientos_stock.item_id,
            sum(movimientos_stock.cantidad) AS stock,
            bool_or(movimientos_stock.tipo <> ALL (ARRAY['venta'::text, 'devolucion'::text])) AS cargado,
            min(movimientos_stock.vence) FILTER (WHERE (movimientos_stock.vence IS NOT NULL)) AS vence
           FROM movimientos_stock
          GROUP BY movimientos_stock.item_id) st ON ((st.item_id = i.id)))
     LEFT JOIN LATERAL ( SELECT h.costo
           FROM historial_costos h
          WHERE ((h.item_id = i.id) AND (h.fecha < (now() - '30 days'::interval)))
          ORDER BY h.fecha DESC
         LIMIT 1) hc ON (true))
     LEFT JOIN LATERAL ( SELECT h.precio
           FROM historial_precios h
          WHERE ((h.item_id = i.id) AND (h.fecha < (now() - '30 days'::interval)))
          ORDER BY h.fecha DESC
         LIMIT 1) hp ON (true))
     LEFT JOIN ( SELECT l.item_id,
            sum(CASE WHEN o.tipo = 'devolucion'::text THEN - l.cantidad ELSE l.cantidad END) AS u30,
            max(o.fecha) FILTER (WHERE o.tipo <> 'devolucion'::text) AS ultima_venta
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((o.tipo = ANY (ARRAY['venta'::text, 'comanda'::text, 'devolucion'::text])) AND (o.estado = 'confirmada'::text) AND (o.fecha > (now() - '30 days'::interval)))
          GROUP BY l.item_id) v ON ((v.item_id = i.id)))
     LEFT JOIN ( SELECT l.item_id,
            sum(CASE WHEN o.tipo = 'devolucion'::text THEN - l.cantidad ELSE l.cantidad END) AS u30
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((o.tipo = ANY (ARRAY['venta'::text, 'comanda'::text, 'devolucion'::text])) AND (o.estado = 'confirmada'::text) AND (o.fecha > (now() - '60 days'::interval)) AND (o.fecha <= (now() - '30 days'::interval)))
          GROUP BY l.item_id) vp ON ((vp.item_id = i.id)))
     LEFT JOIN LATERAL ( SELECT l.costo_unitario AS costo_reposicion,
            o.cerrada_en AS costo_reposicion_fecha
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((l.item_id = i.id) AND (o.tipo = 'compra'::text))
          ORDER BY o.cerrada_en DESC NULLS LAST
         LIMIT 1) uc ON (true));

comment on column items_vista.stock_cargado is
  'Tuvo alguna vez un movimiento de stock que no sea venta ni devolución (compra, conteo, inicial, pase). Sin eso, el stock es lo vendido en negativo y no dice cuánto hay (0110).';


create or replace function ajustar_stock_lote(p_filas jsonb, p_sucursal uuid default null, p_motivo text default null)
returns table (item_id uuid, antes numeric, diferencia numeric)
language plpgsql security invoker set search_path = public as $$
declare
  r record;
begin
  if jsonb_typeof(p_filas) <> 'array' then raise exception 'Se esperaba una lista de productos.' using errcode = 'P0037'; end if;
  if jsonb_array_length(p_filas) > 5000 then raise exception 'Como mucho cinco mil productos por vez.' using errcode = 'P0037'; end if;
  for r in select x.item_id, x.real from jsonb_to_recordset(p_filas) as x(item_id uuid, real numeric) loop
    return query select r.item_id, a.antes, a.diferencia
      from ajustar_stock(r.item_id, r.real, p_sucursal, coalesce(nullif(trim(p_motivo), ''), 'Stock inicial por planilla')) a;
  end loop;
end;
$$;

revoke execute on function ajustar_stock_lote(jsonb, uuid, text) from public, anon;
grant execute on function ajustar_stock_lote(jsonb, uuid, text) to authenticated;
