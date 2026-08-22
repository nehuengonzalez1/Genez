/* ============================================================
   0006 · REGISTRAR UNA VENTA
   ============================================================

   Una venta toca cinco tablas: la operación, sus líneas, los pagos, el
   descuento de stock y el ingreso a caja. Si se mandan como cinco
   inserciones sueltas desde el navegador, cualquier corte a mitad de
   camino deja una venta sin stock descontado o un stock descontado sin
   venta. Acá entran las cinco o no entra ninguna.

   El id de la venta lo genera el dispositivo, no la base. Eso es lo que
   permite cobrar sin conexión: el ticket ya nace con su identidad, y
   cuando vuelve internet se sube tal cual. Si la subida se reintenta
   —porque la respuesta se perdió, no porque la venta se repitió— la
   segunda vez no hace nada y devuelve el mismo id.

   Corre con los permisos de quien la llama, no elevados: un cajero no
   puede escribir en el comercio de al lado usando esta función.
   ============================================================ */

create or replace function registrar_venta(venta jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id        uuid := (venta->>'id')::uuid;
  v_empresa   uuid := (venta->>'empresa_id')::uuid;
  v_sucursal  uuid := nullif(venta->>'sucursal_id', '')::uuid;
  v_numero    text := venta->>'numero';
  v_fecha     timestamptz := coalesce((venta->>'fecha')::timestamptz, now());
  v_nueva     boolean;
begin
  if v_id is null or v_empresa is null then
    raise exception 'La venta necesita id y empresa_id.';
  end if;

  insert into operaciones (
    id, empresa_id, sucursal_id, tipo, estado, numero, fecha,
    cliente_id, usuario_id, subtotal, descuento, recargo, total,
    comprobante, campos_extra, sincronizada_en
  ) values (
    v_id, v_empresa, v_sucursal, 'venta', 'confirmada', v_numero, v_fecha,
    nullif(venta->>'cliente_id', '')::uuid,
    auth.uid(),
    coalesce((venta->>'subtotal')::numeric, 0),
    coalesce((venta->>'descuento')::numeric, 0),
    coalesce((venta->>'recargo')::numeric, 0),
    coalesce((venta->>'total')::numeric, 0),
    coalesce(venta->'comprobante', '{}'::jsonb),
    coalesce(venta->'campos_extra', '{}'::jsonb),
    now()
  )
  on conflict (id) do nothing
  returning true into v_nueva;

  /* Ya estaba: es un reintento, no una venta nueva. */
  if v_nueva is null then
    return v_id;
  end if;

  insert into operacion_lineas (
    operacion_id, empresa_id, item_id, descripcion, cantidad,
    precio_unitario, costo_unitario, iva, descuento, total
  )
  select
    v_id, v_empresa,
    nullif(l->>'item_id', '')::uuid,
    l->>'descripcion',
    (l->>'cantidad')::numeric,
    coalesce((l->>'precio_unitario')::numeric, 0),
    coalesce((l->>'costo_unitario')::numeric, 0),
    coalesce((l->>'iva')::numeric, 21),
    coalesce((l->>'descuento')::numeric, 0),
    coalesce((l->>'total')::numeric, 0)
  from jsonb_array_elements(coalesce(venta->'lineas', '[]'::jsonb)) as l;

  insert into pagos (operacion_id, empresa_id, medio, monto, recargo, referencia, fecha)
  select
    v_id, v_empresa,
    p->>'medio',
    (p->>'monto')::numeric,
    coalesce((p->>'recargo')::numeric, 0),
    nullif(p->>'referencia', ''),
    v_fecha
  from jsonb_array_elements(coalesce(venta->'pagos', '[]'::jsonb)) as p;

  /* Sale del stock lo que efectivamente lleva stock: un servicio no
     descuenta nada. La cantidad va en negativo porque el stock es la
     suma del libro, no un campo que se resta. */
  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, operacion_id, usuario_id, fecha)
  select
    v_empresa, v_sucursal, i.id,
    -(l->>'cantidad')::numeric,
    'venta', v_id, auth.uid(), v_fecha
  from jsonb_array_elements(coalesce(venta->'lineas', '[]'::jsonb)) as l
  join items i on i.id = nullif(l->>'item_id', '')::uuid
  where i.controla_stock;

  /* Un movimiento por medio de pago: así el arqueo y el reporte por medio
     siguen cerrando aunque la venta se haya cobrado partida. */
  insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, operacion_id, usuario_id, fecha)
  select
    v_empresa, v_sucursal,
    nullif(venta->>'sesion_id', '')::uuid,
    'ingreso',
    p->>'medio',
    (p->>'monto')::numeric,
    'Venta ' || coalesce(v_numero, ''),
    v_id, auth.uid(), v_fecha
  from jsonb_array_elements(coalesce(venta->'pagos', '[]'::jsonb)) as p;

  return v_id;
end;
$$;

comment on function registrar_venta is
  'Registra una venta completa en una sola transacción. Idempotente: reintentar con el mismo id no duplica.';
