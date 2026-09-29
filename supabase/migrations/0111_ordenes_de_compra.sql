/* ============================================================
   0111 · Las órdenes de compra se guardan
   ============================================================

   Compras → Órdenes de compra venía del prototipo: la orden vivía en la
   memoria del navegador, con la fecha fija del prototipo (09/08), y se
   perdía al refrescar. Ahora es una operación de tipo 'compra' en estado
   'pendiente' —la tabla ya lo admitía—, con sus renglones y su
   proveedor. No mueve stock: eso lo hace la recepción, que registra la
   compra de siempre (confirmada) y pasa la orden a 'recibida'. Una orden
   que no va más queda 'cancelada'. La hace la aplicación con las
   políticas de siempre de operaciones, que dejan cambiar una operación
   mientras está pendiente.

   Lo único que hay que tocar en la base: el costo de reposición de cada
   producto (0077) tomaba la última compra sin mirar el estado. Con una
   orden pendiente, un producto que nunca se compró antes tomaba el costo
   de algo que todavía no llegó. Ahora, solo compras confirmadas.
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
            bool_or((movimientos_stock.tipo <> ALL (ARRAY['venta'::text, 'devolucion'::text]))) AS cargado,
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
            sum(
                CASE
                    WHEN (o.tipo = 'devolucion'::text) THEN (- l.cantidad)
                    ELSE l.cantidad
                END) AS u30,
            max(o.fecha) FILTER (WHERE (o.tipo <> 'devolucion'::text)) AS ultima_venta
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((o.tipo = ANY (ARRAY['venta'::text, 'comanda'::text, 'devolucion'::text])) AND (o.estado = 'confirmada'::text) AND (o.fecha > (now() - '30 days'::interval)))
          GROUP BY l.item_id) v ON ((v.item_id = i.id)))
     LEFT JOIN ( SELECT l.item_id,
            sum(
                CASE
                    WHEN (o.tipo = 'devolucion'::text) THEN (- l.cantidad)
                    ELSE l.cantidad
                END) AS u30
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((o.tipo = ANY (ARRAY['venta'::text, 'comanda'::text, 'devolucion'::text])) AND (o.estado = 'confirmada'::text) AND (o.fecha > (now() - '60 days'::interval)) AND (o.fecha <= (now() - '30 days'::interval)))
          GROUP BY l.item_id) vp ON ((vp.item_id = i.id)))
     LEFT JOIN LATERAL ( SELECT l.costo_unitario AS costo_reposicion,
            o.cerrada_en AS costo_reposicion_fecha
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((l.item_id = i.id) AND (o.tipo = 'compra'::text) AND (o.estado = 'confirmada'::text))
          ORDER BY o.cerrada_en DESC NULLS LAST
         LIMIT 1) uc ON (true));
