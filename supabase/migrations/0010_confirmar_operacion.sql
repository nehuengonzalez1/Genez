/* ============================================================
   0010 · UN SOLO CAMINO PARA CONFIRMAR
   ============================================================

   Cobrar tiene dos entradas: la venta directa, que nace y se confirma en
   el mismo acto, y la comanda, que ya existe abierta hace una hora y
   recién ahora se cobra.

   Lo que pasa después es idéntico en los dos casos: se exige caja
   abierta, se registran los pagos, sale el stock y entra la plata. Si
   cada entrada escribiera su propia versión de eso, con el tiempo se
   van separando —alguien arregla una y no la otra— y terminan siendo dos
   sistemas de cobro con reglas distintas.

   Así que la parte común se escribe una vez y las dos entradas la llaman.
   ============================================================ */

create or replace function confirmar_operacion(
  p_operacion uuid,
  p_sesion    uuid,
  p_pagos     jsonb
)
returns void
language plpgsql
as $$
declare
  v_empresa  uuid;
  v_sucursal uuid;
  v_numero   text;
  v_fecha    timestamptz;
begin
  select empresa_id, sucursal_id, numero, fecha
    into v_empresa, v_sucursal, v_numero, v_fecha
  from operaciones where id = p_operacion;

  if v_empresa is null then
    raise exception 'No existe la operación que se quiere confirmar.';
  end if;

  if p_sesion is null then
    raise exception 'No hay una caja abierta para registrar esta venta.'
      using errcode = 'P0001';
  end if;

  /* Que exista y sea del comercio. No se pide que siga abierta: una venta
     cobrada sin conexión puede subir después del cierre, y pertenece
     igual a la sesión en la que se cobró. */
  if not exists (
    select 1 from sesiones_caja where id = p_sesion and empresa_id = v_empresa
  ) then
    raise exception 'La caja de esta venta no existe en este comercio.'
      using errcode = 'P0002';
  end if;

  insert into pagos (operacion_id, empresa_id, medio, monto, recargo, referencia, fecha)
  select
    p_operacion, v_empresa,
    p->>'medio',
    (p->>'monto')::numeric,
    coalesce((p->>'recargo')::numeric, 0),
    nullif(p->>'referencia', ''),
    v_fecha
  from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb)) as p;

  /* El stock sale de las líneas ya guardadas y no de lo que mande quien
     llama: para una comanda esas líneas se cargaron a lo largo de la
     noche y son la única versión verdadera de lo que se consumió. */
  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, operacion_id, usuario_id, fecha)
  select v_empresa, v_sucursal, i.id, -l.cantidad, 'venta', p_operacion, auth.uid(), v_fecha
  from operacion_lineas l
  join items i on i.id = l.item_id
  where l.operacion_id = p_operacion
    and l.estado <> 'anulada'
    and i.controla_stock;

  insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, operacion_id, usuario_id, fecha)
  select
    v_empresa, v_sucursal, p_sesion, 'ingreso',
    p->>'medio',
    (p->>'monto')::numeric,
    'Venta ' || coalesce(v_numero, ''),
    p_operacion, auth.uid(), v_fecha
  from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb)) as p;
end;
$$;

comment on function confirmar_operacion is
  'Lo que pasa cuando se cobra, sin importar si la operación nació hace un segundo o hace una hora.';

/* ------------------------------------------------------------
   Entrada 1 · la venta directa
   ------------------------------------------------------------ */

create or replace function registrar_venta(venta jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id      uuid := (venta->>'id')::uuid;
  v_empresa uuid := (venta->>'empresa_id')::uuid;
  v_fecha   timestamptz := coalesce((venta->>'fecha')::timestamptz, now());
  v_nueva   boolean;
begin
  if v_id is null or v_empresa is null then
    raise exception 'La venta necesita id y empresa_id.';
  end if;

  insert into operaciones (
    id, empresa_id, sucursal_id, tipo, estado, numero, fecha,
    cliente_id, usuario_id, subtotal, descuento, recargo, total,
    comprobante, campos_extra, cerrada_en, sincronizada_en
  ) values (
    v_id, v_empresa,
    nullif(venta->>'sucursal_id', '')::uuid,
    'venta', 'confirmada', venta->>'numero', v_fecha,
    nullif(venta->>'cliente_id', '')::uuid,
    auth.uid(),
    coalesce((venta->>'subtotal')::numeric, 0),
    coalesce((venta->>'descuento')::numeric, 0),
    coalesce((venta->>'recargo')::numeric, 0),
    coalesce((venta->>'total')::numeric, 0),
    coalesce(venta->'comprobante', '{}'::jsonb),
    coalesce(venta->'campos_extra', '{}'::jsonb),
    now(), now()
  )
  on conflict (id) do nothing
  returning true into v_nueva;

  /* Ya estaba: es un reintento de la cola, no una venta nueva. */
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

  perform confirmar_operacion(
    v_id,
    nullif(venta->>'sesion_id', '')::uuid,
    coalesce(venta->'pagos', '[]'::jsonb)
  );

  return v_id;
end;
$$;

/* ------------------------------------------------------------
   Entrada 2 · la comanda que se cierra

   Los totales se calculan acá y no se reciben de afuera: las líneas se
   fueron cargando durante toda la atención y son la única versión
   verdadera de lo que se consumió. Un total que llegue del navegador
   podría estar mirando una comanda vieja.
   ------------------------------------------------------------ */

/* La versión de la migración anterior recibía solo el id. Con la nueva
   conviven dos funciones del mismo nombre y Postgres no sabe cuál llamar,
   así que la vieja se va. */
drop function if exists cerrar_comanda(uuid);
drop function if exists cerrar_comanda(uuid, uuid, jsonb, text, numeric, numeric);

/* Los parámetros llevan prefijo. Sin él, `numero` dentro del UPDATE puede
   ser el parámetro o la columna, y Postgres se niega a adivinar. */
create function cerrar_comanda(
  p_comanda   uuid,
  p_sesion    uuid default null,
  p_pagos     jsonb default '[]'::jsonb,
  p_numero    text default null,
  p_descuento numeric default 0,
  p_recargo   numeric default 0
)
returns uuid
language plpgsql
as $$
declare
  v_sub numeric;
begin
  select coalesce(sum(total), 0) into v_sub
  from operacion_lineas
  where operacion_id = p_comanda and estado <> 'anulada';

  update operaciones
     set estado     = 'confirmada',
         cerrada_en = now(),
         numero     = coalesce(p_numero, numero),
         subtotal   = v_sub,
         descuento  = coalesce(p_descuento, 0),
         recargo    = coalesce(p_recargo, 0),
         total      = v_sub - coalesce(p_descuento, 0) + coalesce(p_recargo, 0),
         sincronizada_en = now()
   where id = p_comanda and tipo = 'comanda' and estado = 'abierta';

  if not found then
    raise exception 'Esa comanda no está abierta.' using errcode = 'P0003';
  end if;

  perform confirmar_operacion(p_comanda, p_sesion, p_pagos);

  return p_comanda;
end;
$$;

comment on function cerrar_comanda is
  'Cierra la mesa y cobra. Los totales salen de las líneas, no de lo que informe el navegador.';
