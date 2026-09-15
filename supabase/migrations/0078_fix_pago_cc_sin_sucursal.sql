/* ============================================================
   0078 · FIX: registrar_pago_cuenta_corriente rechazaba cajas sin sucursal
   ============================================================

   Bug real encontrado probando #30 en vivo contra Bnitori (negocio de una
   sola sucursal, `sesiones_caja.sucursal_id` en null): la validación
   original confundía "no existe esa sesión" con "existe, pero su
   sucursal_id da null" — las dos dejaban `v_sucursal` en null, así que la
   función rechazaba una caja abierta y válida con "La caja de este pago
   no existe en este comercio."

   `confirmar_operacion` (0010) no tiene este problema: no valida por una
   columna que puede ser null, valida con `not exists (...)`. Acá se
   corrige de la misma forma, con `found` en vez de mirar `sucursal_id`. */

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

  if not found and p_sesion is not null then
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
