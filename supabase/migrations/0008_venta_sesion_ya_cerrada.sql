/* ============================================================
   0008 · UNA VENTA DEMORADA NO SE RECHAZA
   ============================================================

   La migración anterior exigía que la caja siguiera abierta al momento
   de registrar la venta. Está mal, y de una forma que solo se ve cuando
   se juntan las dos cosas que construimos: cobrar sin internet y exigir
   caja abierta.

   Una venta cobrada a las 20:40 sin conexión, que sube a las 23:00
   cuando la caja ya cerró, era rechazada. Pero esa venta ocurrió con la
   caja abierta: pertenece a esa sesión, aunque llegue tarde. Rechazarla
   es perder plata que ya se cobró en el mostrador.

   La caja tiene que estar abierta cuando se COBRA, no cuando el dato
   llega al servidor. Acá se verifica lo que corresponde a este momento:
   que la sesión exista y sea del comercio. Que estuviera abierta lo
   garantiza la pantalla, que es la que está presente en el acto.
   ============================================================ */

create or replace function registrar_venta(venta jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id        uuid := (venta->>'id')::uuid;
  v_empresa   uuid := (venta->>'empresa_id')::uuid;
  v_sucursal  uuid := nullif(venta->>'sucursal_id', '')::uuid;
  v_sesion    uuid := nullif(venta->>'sesion_id', '')::uuid;
  v_numero    text := venta->>'numero';
  v_fecha     timestamptz := coalesce((venta->>'fecha')::timestamptz, now());
  v_nueva     boolean;
begin
  if v_id is null or v_empresa is null then
    raise exception 'La venta necesita id y empresa_id.';
  end if;

  if v_sesion is null then
    raise exception 'No hay una caja abierta para registrar esta venta.'
      using errcode = 'P0001';
  end if;

  /* Existe y es de este comercio. No se pide que siga abierta: una venta
     que subió tarde igual pertenece a la sesión en la que se cobró. */
  if not exists (
    select 1 from sesiones_caja where id = v_sesion and empresa_id = v_empresa
  ) then
    raise exception 'La caja de esta venta no existe en este comercio.'
      using errcode = 'P0002';
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

  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, operacion_id, usuario_id, fecha)
  select
    v_empresa, v_sucursal, i.id,
    -(l->>'cantidad')::numeric,
    'venta', v_id, auth.uid(), v_fecha
  from jsonb_array_elements(coalesce(venta->'lineas', '[]'::jsonb)) as l
  join items i on i.id = nullif(l->>'item_id', '')::uuid
  where i.controla_stock;

  insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, operacion_id, usuario_id, fecha)
  select
    v_empresa, v_sucursal, v_sesion,
    'ingreso',
    p->>'medio',
    (p->>'monto')::numeric,
    'Venta ' || coalesce(v_numero, ''),
    v_id, auth.uid(), v_fecha
  from jsonb_array_elements(coalesce(venta->'pagos', '[]'::jsonb)) as p;

  return v_id;
end;
$$;
