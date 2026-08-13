/* ============================================================
   0023 · LA COMANDA COMPLETA
   ============================================================

   Lo que le faltaba a la pantalla de comanda para dejar de tener botones
   apagados: la observación, la cuenta con sus pagos, dividir, y saber
   quién sacó un plato de una cuenta.

   Cuatro cosas, y ninguna es un modelo nuevo.

   La observación es una columna, no una fila de `campos_extra`: se
   imprime en la comanda de cocina y se lee en la cuenta, o sea que se
   consulta, no se guarda por las dudas.

   Dividir la cuenta NO parte la operación. Una mesa que paga entre tres
   sigue siendo una sola cuenta con tres pagos: partir la operación
   duplicaría líneas, descuadraría el stock y dejaría dos comandas donde
   hubo una. Lo que se parte es la plata, y para eso ya está `pagos`.

   La foto del producto va en `items`, que es donde vive el producto. La
   pantalla de comanda no tiene un catálogo propio ni podría tenerlo.
   ============================================================ */

/* ------------------------------------------------------------
   La foto del plato
   ------------------------------------------------------------ */

alter table items add column imagen text;

comment on column items.imagen is
  'Foto del producto para la carta. Sin foto, la pantalla dibuja un lugar consistente; nunca una imagen escrita en el código.';

/* ------------------------------------------------------------
   La observación de la comanda
   ------------------------------------------------------------ */

alter table operaciones add column observacion text;

comment on column operaciones.observacion is
  'Lo que hay que saber de este pedido entero: "cliente alérgico", "enviar separado". Lo de un plato en particular va en operacion_lineas.notas.';

/* ------------------------------------------------------------
   Quién cargó cada plato

   La línea decía qué se pidió y cuánto salía, pero no quién la puso.
   Con varios mozos sobre las mismas mesas, eso es la mitad de lo que se
   pregunta cuando una cuenta no cierra.
   ------------------------------------------------------------ */

alter table operacion_lineas add column usuario_id uuid references perfiles(id) on delete set null;

create or replace function poner_usuario_en_linea()
returns trigger language plpgsql as $$
begin
  new.usuario_id := coalesce(new.usuario_id, auth.uid());
  return new;
end;
$$;

create trigger operacion_lineas_usuario
  before insert on operacion_lineas
  for each row execute function poner_usuario_en_linea();

/* Sacar un plato de una cuenta abierta y bajar cantidades es por donde se
   va la plata de un local. No se registra el alta —esa ya es la línea,
   que queda— sino lo que la achica. */
create or replace function anotar_cambio_de_linea()
returns trigger
language plpgsql
as $$
declare
  v_accion  text;
  v_detalle jsonb;
begin
  if new.estado = 'anulada' and old.estado <> 'anulada' then
    v_accion := 'comanda.anular_linea';
  elsif new.cantidad < old.cantidad then
    v_accion := 'comanda.bajar_cantidad';
  else
    return new;
  end if;

  v_detalle := jsonb_build_object(
    'operacion', new.operacion_id,
    'descripcion', new.descripcion,
    'cantidad_antes', old.cantidad,
    'cantidad_ahora', new.cantidad,
    'total', old.total,
    'ya_estaba_en_cocina', old.estado <> 'borrador'
  );

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
    values (new.empresa_id, auth.uid(), v_accion, 'operacion_lineas', new.id, v_detalle);

  return new;
end;
$$;

create trigger operacion_lineas_bitacora
  after update on operacion_lineas
  for each row execute function anotar_cambio_de_linea();

/* Un descuento es plata que el negocio resigna. Quién lo dio y sobre qué
   cuenta es exactamente lo que se revisa al cierre del mes. */
create or replace function anotar_descuento()
returns trigger
language plpgsql
as $$
begin
  if new.descuento is not distinct from old.descuento
     and new.descuento_pct is not distinct from old.descuento_pct then
    return new;
  end if;
  if coalesce(new.descuento, 0) = 0 and new.descuento_pct is null then
    return new;
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
    values (new.empresa_id, auth.uid(), 'comanda.descuento', 'operaciones', new.id,
            jsonb_build_object('monto', new.descuento, 'porcentaje', new.descuento_pct,
                               'canal', new.canal));
  return new;
end;
$$;

create trigger operaciones_descuento_bitacora
  after update of descuento, descuento_pct on operaciones
  for each row execute function anotar_descuento();

/* ------------------------------------------------------------
   Pagar de a partes

   Es lo mismo que cobrar, pero sin cerrar: la mesa sigue abierta y puede
   seguir pidiendo. Por eso pasa por la misma tabla de pagos y escribe su
   movimiento de caja igual que cualquier cobro; lo único que no hace es
   confirmar la operación ni descontar stock, que son cosas del cierre.

   Exige caja abierta por el mismo motivo que el cobro entero: sin sesión,
   la plata entra y no aparece en ningún arqueo.
   ------------------------------------------------------------ */

create or replace function registrar_pago(
  p_comanda   uuid,
  p_sesion    uuid,
  p_medio     text,
  p_monto     numeric,
  p_referencia text default null,
  p_detalle   text default null
)
returns numeric
language plpgsql
as $$
declare
  v_op      operaciones%rowtype;
  v_sub     numeric;
  v_desc    numeric;
  v_total   numeric;
  v_pagado  numeric;
begin
  select * into v_op from operaciones where id = p_comanda for update;

  if v_op.id is null or v_op.tipo <> 'comanda' then
    raise exception 'No existe esa comanda.' using errcode = 'P0010';
  end if;
  if v_op.estado <> 'abierta' then
    raise exception 'Esa cuenta ya está cerrada.' using errcode = 'P0003';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El pago tiene que ser mayor que cero.' using errcode = 'P0014';
  end if;

  if p_sesion is null then
    raise exception 'No hay una caja abierta para registrar este pago.' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from sesiones_caja
    where id = p_sesion and empresa_id = v_op.empresa_id and cerrada_en is null
  ) then
    raise exception 'La caja de este pago ya fue cerrada.' using errcode = 'P0002';
  end if;

  select coalesce(sum(total), 0) into v_sub
  from operacion_lineas where operacion_id = p_comanda and estado <> 'anulada';

  v_desc := case when v_op.descuento_pct is not null
                 then round(v_sub * v_op.descuento_pct / 100)
                 else coalesce(v_op.descuento, 0) end;
  v_total := v_sub - v_desc + coalesce(v_op.recargo, 0);

  select coalesce(sum(monto), 0) into v_pagado from pagos where operacion_id = p_comanda;

  /* Cobrar de más no es un redondeo, es plata que después hay que
     devolver sin que ningún cierre lo explique. */
  if v_pagado + p_monto > v_total then
    raise exception 'Ese pago supera lo que falta de la cuenta.' using errcode = 'P0014';
  end if;

  insert into pagos (operacion_id, empresa_id, medio, monto, referencia)
    values (p_comanda, v_op.empresa_id, p_medio, p_monto, nullif(p_referencia, ''));

  insert into movimientos_caja (
    empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, operacion_id, usuario_id
  ) values (
    v_op.empresa_id, v_op.sucursal_id, p_sesion, 'ingreso', p_medio, p_monto,
    coalesce(nullif(p_detalle, ''), 'Pago parcial'), p_comanda, auth.uid()
  );

  return v_total - v_pagado - p_monto;
end;
$$;

comment on function registrar_pago is
  'Un pago sobre una cuenta que sigue abierta. Dividir la cuenta es esto, varias veces: la operación no se parte.';

/* ------------------------------------------------------------
   Cerrar cobrando solo lo que falta

   Con pagos parciales ya registrados, el cierre no puede volver a cobrar
   el total. Los pagos que llegan son los del final, y el control es que
   entre todos sumen la cuenta.
   ------------------------------------------------------------ */

create or replace function cerrar_comanda(
  p_comanda   uuid,
  p_sesion    uuid default null,
  p_pagos     jsonb default '[]'::jsonb,
  p_numero    text default null,
  p_descuento numeric default null,
  p_recargo   numeric default 0
)
returns uuid
language plpgsql
as $$
declare
  v_sub    numeric;
  v_pct    numeric;
  v_desc   numeric;
  v_previo numeric;
begin
  select coalesce(sum(l.total), 0) into v_sub
  from operacion_lineas l
  where l.operacion_id = p_comanda and l.estado <> 'anulada';

  select o.descuento_pct into v_pct from operaciones o where o.id = p_comanda;

  if p_descuento is not null then
    v_desc := p_descuento;
  elsif v_pct is not null then
    v_desc := round(v_sub * v_pct / 100);
  else
    select coalesce(o.descuento, 0) into v_desc from operaciones o where o.id = p_comanda;
  end if;

  if v_desc > v_sub then
    raise exception 'El descuento no puede ser mayor que la cuenta.' using errcode = 'P0009';
  end if;

  update operaciones
     set estado     = 'confirmada',
         estado_pedido = 'completado',
         cerrada_en = now(),
         numero     = coalesce(p_numero, numero),
         subtotal   = v_sub,
         descuento  = v_desc,
         recargo    = coalesce(p_recargo, 0),
         total      = v_sub - v_desc + coalesce(p_recargo, 0),
         sincronizada_en = now()
   where id = p_comanda and tipo = 'comanda' and estado = 'abierta';

  if not found then
    raise exception 'Esa comanda no está abierta.' using errcode = 'P0003';
  end if;

  update operacion_lineas
     set estado = 'entregado'
   where operacion_id = p_comanda and estado in ('borrador', 'pedido', 'preparando', 'listo');

  perform confirmar_operacion(p_comanda, p_sesion, p_pagos);

  return p_comanda;
end;
$$;

/* ------------------------------------------------------------
   La cuenta

   Cuánto va, cuánto se pagó y cuánto falta, en una sola lectura. La
   pantalla no lo calcula por su cuenta para que no pueda mostrar un
   número distinto del que la base va a cobrar.
   ------------------------------------------------------------ */

create view cuenta_vista
with (security_invoker = true) as
select
  o.id, o.empresa_id, o.estado, o.canal, o.numero, o.observacion,
  coalesce(l.subtotal, 0) as subtotal,
  case when o.descuento_pct is not null
       then round(coalesce(l.subtotal, 0) * o.descuento_pct / 100)
       else coalesce(o.descuento, 0) end as descuento,
  coalesce(o.recargo, 0) as recargo,
  coalesce(l.subtotal, 0)
    - case when o.descuento_pct is not null
           then round(coalesce(l.subtotal, 0) * o.descuento_pct / 100)
           else coalesce(o.descuento, 0) end
    + coalesce(o.recargo, 0) as total,
  coalesce(p.pagado, 0) as pagado,
  coalesce(l.subtotal, 0)
    - case when o.descuento_pct is not null
           then round(coalesce(l.subtotal, 0) * o.descuento_pct / 100)
           else coalesce(o.descuento, 0) end
    + coalesce(o.recargo, 0)
    - coalesce(p.pagado, 0) as saldo
from operaciones o
left join (
  select operacion_id, sum(total) as subtotal
  from operacion_lineas where estado <> 'anulada'
  group by operacion_id
) l on l.operacion_id = o.id
left join (
  select operacion_id, sum(monto) as pagado
  from pagos group by operacion_id
) p on p.operacion_id = o.id
where o.tipo = 'comanda';

comment on view cuenta_vista is
  'Lo que va, lo que se pagó y lo que falta de una comanda. Es lo que contesta el botón Cuenta.';
