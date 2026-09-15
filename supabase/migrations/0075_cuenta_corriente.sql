/* ============================================================
   0075 · CUENTA CORRIENTE DE CLIENTES
   ============================================================

   "Te lo llevás y me pagás a fin de mes" es el día a día de una casa de
   sanitarios que le vende a plomeros y constructoras. Hoy `clientes` no
   tiene ni una columna de saldo.

   No hace falta una tabla de saldos: el saldo es la resta entre lo que
   se vendió a cuenta corriente y lo que se cobró de esa cuenta. Guardar
   el saldo como un número aparte es guardar el mismo dato dos veces, y
   tarde o temprano se desincroniza.

   LA VENTA A CUENTA CORRIENTE ES UN MEDIO DE PAGO MÁS
   ----------------------------------------------------
   `registrar_venta`/`confirmar_operacion` no cambian: 'cuenta_corriente'
   entra en `pagos` como cualquier otro medio, con su cliente_id en la
   operación. Lo único que cambia es que esa plata no entró al cajón, así
   que se excluye del ingreso de caja — es una deuda, no un cobro.

   LOS PAGOS DE CUENTA CORRIENTE SÍ SON UNA TABLA NUEVA
   -----------------------------------------------------
   Porque no son parte de una venta: el plomero puede pagar la cuenta un
   día sin llevarse nada. Esos sí entran a la caja de verdad, por eso
   `registrar_pago_cuenta_corriente` inserta un `movimientos_caja` real
   además de la fila del pago. */

create table cuenta_corriente_pagos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  cliente_id  uuid not null references clientes(id) on delete cascade,
  monto       numeric(14,2) not null check (monto > 0),
  medio       text not null default 'efectivo',
  usuario_id  uuid references perfiles(id) on delete set null,
  notas       text,
  fecha       timestamptz not null default now()
);

create index on cuenta_corriente_pagos (empresa_id, cliente_id, fecha desc);

comment on table cuenta_corriente_pagos is
  'Lo que un cliente paga de su cuenta corriente, sin llevarse mercadería. El saldo se calcula, no se guarda.';

alter table cuenta_corriente_pagos enable row level security;

create policy cuenta_corriente_pagos_todo on cuenta_corriente_pagos
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ------------------------------------------------------------
   Excluir 'cuenta_corriente' del ingreso de caja. Único cambio real
   sobre la función existente: una condición más en el último insert.
   ------------------------------------------------------------ */
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
  from jsonb_array_elements(coalesce(p_pagos, '[]'::jsonb)) as p
  where p->>'medio' <> 'cuenta_corriente';
end;
$$;

/* ------------------------------------------------------------
   El saldo: lo que se vendió a cuenta corriente, menos lo que se pagó.
   ------------------------------------------------------------ */
create or replace function saldo_cliente(p_cliente uuid)
returns numeric
language sql
stable
as $$
  select
    coalesce((
      select sum(pg.monto)
      from pagos pg
      join operaciones o on o.id = pg.operacion_id
      where o.cliente_id = p_cliente
        and pg.medio = 'cuenta_corriente'
        and o.estado = 'confirmada'
    ), 0)
    -
    coalesce((
      select sum(cc.monto)
      from cuenta_corriente_pagos cc
      where cc.cliente_id = p_cliente
    ), 0)
$$;

comment on function saldo_cliente(uuid) is
  'Lo que un cliente debe hoy: ventas a cuenta corriente menos pagos recibidos. Positivo = debe.';

/* ------------------------------------------------------------
   Registrar un pago de cuenta corriente: entra plata de verdad, así
   que además del registro va un ingreso real a la caja del turno.
   Sin sesión de caja abierta no se puede cobrar, mismo criterio que una
   venta — la plata tiene que caer en un arqueo de alguien.
   ------------------------------------------------------------ */
create or replace function registrar_pago_cuenta_corriente(
  p_cliente uuid,
  p_sesion  uuid,
  p_monto   numeric,
  p_medio   text default 'efectivo',
  p_notas   text default null
)
returns uuid
language plpgsql
as $$
declare
  v_empresa  uuid;
  v_sucursal uuid;
  v_id       uuid;
begin
  select empresa_id into v_empresa from clientes where id = p_cliente;
  if v_empresa is null then
    raise exception 'No existe ese cliente.';
  end if;

  if p_monto <= 0 then
    raise exception 'El pago tiene que ser mayor a cero.';
  end if;

  select empresa_id, sucursal_id into v_empresa, v_sucursal
  from sesiones_caja where id = p_sesion and empresa_id = v_empresa;

  if v_sucursal is null and p_sesion is not null then
    raise exception 'La caja de este pago no existe en este comercio.' using errcode = 'P0002';
  end if;

  if p_sesion is null then
    raise exception 'No hay una caja abierta para registrar el pago.' using errcode = 'P0001';
  end if;

  insert into cuenta_corriente_pagos (empresa_id, cliente_id, monto, medio, usuario_id, notas)
  values (v_empresa, p_cliente, p_monto, p_medio, auth.uid(), p_notas)
  returning id into v_id;

  insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, usuario_id, fecha)
  select v_empresa, v_sucursal, p_sesion, 'ingreso', p_medio, p_monto,
         'Pago de cuenta corriente · ' || c.razon_social, auth.uid(), now()
  from clientes c where c.id = p_cliente;

  return v_id;
end;
$$;

comment on function registrar_pago_cuenta_corriente(uuid, uuid, numeric, text, text) is
  'Cobra la cuenta corriente de un cliente sin venderle nada: entra a la caja del turno de verdad.';
