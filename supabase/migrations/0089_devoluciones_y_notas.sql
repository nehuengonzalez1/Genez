/* ============================================================
   0089 · DEVOLUCIONES, NOTAS DE CRÉDITO Y NOTAS DE DÉBITO
   ============================================================

   Hasta acá una venta cobrada no tenía vuelta atrás: si el cliente
   devolvía algo, o la caja cobró de más, lo único posible era cargar un
   egreso a mano, el stock no volvía y una factura quedaba emitida. Una
   factura de producción no se borra ni se modifica (0082): se anula con
   una nota de crédito. Esto lo agrega.

   DEVOLUCIÓN (y nota de crédito)
   ------------------------------
   Es una operación nueva, `tipo = 'devolucion'`, que apunta a la venta
   que devuelve (`origen_id`), con los renglones que vuelven y cuánto de
   cada uno (`origen_linea_id`). Nada de la venta original se toca: queda
   como fue, y la devolución se suma al lado.

   - El stock vuelve: un movimiento `devolucion` por cada renglón que
     lleva stock.
   - La plata sale: un egreso en la caja abierta, con el medio con que se
     reintegra. Si se reintegra a cuenta corriente no sale plata: baja la
     deuda con un ajuste de descuento (el saldo de 0085 no mira pagos de
     devoluciones, así que no podía ir como pago).
   - Si la venta fue factura, la devolución queda marcada fiscal y
     `api/arca/facturar` le pide a ARCA una NOTA DE CRÉDITO asociada a esa
     factura, por el mismo camino y en el mismo orden que las facturas.
     La factura original tiene que tener su CAE: no se acredita contra
     algo que ARCA todavía no autorizó.

   Lo que se devuelve es lo que se cobró por esos renglones, con el
   descuento o el recargo de la venta repartidos en proporción: si la
   venta tuvo 10 % de descuento, devolver un producto reintegra su precio
   menos el 10 %. Y nunca más de lo vendido: cada renglón se puede
   devolver hasta la cantidad que se vendió menos lo que ya se devolvió.

   NOTA DE DÉBITO
   --------------
   Un cargo de más sobre una factura: una diferencia de precio, un
   interés. Es una venta (`tipo = 'venta'`) de un solo renglón libre, con
   `origen_id` a la factura y marcada `nota = 'debito'`; se cobra como
   cualquier venta (confirmar_operacion) y ARCA la autoriza como NOTA DE
   DÉBITO asociada. Solo sobre facturas: sobre un ticket, cobrar de más es
   simplemente otra venta.

   Las dos piden el permiso `anular` —el mismo que anular una venta en el
   mostrador— y la caja abierta, y las numera la base: DEV-00000001,
   ND-00000001. El número fiscal lo pone ARCA, como en las facturas.
   ============================================================ */

alter table operaciones add column origen_id uuid references operaciones(id);
comment on column operaciones.origen_id is
  'La venta a la que corresponde: la que se devuelve (devolución) o la factura que se debita (nota de débito).';
create index on operaciones (origen_id) where origen_id is not null;

alter table operacion_lineas add column origen_linea_id uuid references operacion_lineas(id);
comment on column operacion_lineas.origen_linea_id is
  'En una devolución, el renglón de la venta que vuelve. Con esto se sabe cuánto queda por devolver.';
create index on operacion_lineas (origen_linea_id) where origen_linea_id is not null;

/* Las notas de débito (A 2, B 7, C 12) no estaban entre los tipos. */
alter table comprobantes drop constraint comprobantes_tipo_valido;
alter table comprobantes add constraint comprobantes_tipo_valido check (tipo in (1, 2, 3, 6, 7, 8, 11, 12, 13));


/* El descuento de una devolución es el de la venta repartido, no uno que
   alguien dio: no va a la bitácora como "comanda.descuento". Igual a la
   de 0023 salvo esa primera línea. */
create or replace function anotar_descuento()
returns trigger
language plpgsql
as $$
begin
  if new.tipo = 'devolucion' then
    return new;
  end if;
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


/* ------------------------------------------------------------
   El número interno de una devolución o una nota de débito
   ------------------------------------------------------------
   Se numeran acá y no en el equipo, como las ventas: las dos necesitan
   internet igual (tocan una venta que ya está en la base), y así no
   comparten contador con las facturas. El candado evita que dos cajas
   saquen el mismo número a la vez. */
create or replace function siguiente_numero_interno(p_empresa uuid, p_prefijo text)
returns text
language plpgsql
as $$
declare
  v_n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_empresa::text || ':' || p_prefijo));
  select coalesce(max(nullif(split_part(numero, '-', 2), '')::int), 0) + 1 into v_n
  from operaciones
  where empresa_id = p_empresa and numero like p_prefijo || '-%';
  return p_prefijo || '-' || lpad(v_n::text, 8, '0');
end;
$$;


/* ------------------------------------------------------------
   Registrar una devolución
   ------------------------------------------------------------
   p_lineas: [{ "linea_id": uuid, "cantidad": n }, ...]
   p_medio:  con qué se reintegra (un medio de pago, o cuenta_corriente). */
create or replace function registrar_devolucion(
  p_venta  uuid,
  p_lineas jsonb,
  p_sesion uuid,
  p_medio  text,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta    operaciones%rowtype;
  v_fiscal   boolean;
  v_id       uuid := gen_random_uuid();
  v_numero   text;
  v_sub      numeric := 0;
  v_total    numeric;
  v_factor   numeric;
  v_devuelto numeric;
  v_pedida   record;
  v_linea    operacion_lineas%rowtype;
begin
  select * into v_venta from operaciones where id = p_venta;
  if v_venta.id is null or not public.puede_ver(v_venta.empresa_id) then
    raise exception 'La venta no existe.' using errcode = 'P0020';
  end if;
  if not public.permiso('anular') then
    raise exception 'Tu usuario no puede hacer devoluciones.' using errcode = 'P0021';
  end if;
  if v_venta.tipo not in ('venta', 'comanda') or v_venta.estado <> 'confirmada' then
    raise exception 'Solo se devuelve una venta cobrada.' using errcode = 'P0020';
  end if;
  if coalesce(p_medio, '') = '' then
    raise exception 'Falta con qué se reintegra.' using errcode = 'P0020';
  end if;
  if p_medio = 'cuenta_corriente' and v_venta.cliente_id is null then
    raise exception 'Una venta sin cliente no se reintegra a cuenta corriente.' using errcode = 'P0020';
  end if;
  if p_medio <> 'cuenta_corriente' and not exists (
    select 1 from sesiones_caja where id = p_sesion and empresa_id = v_venta.empresa_id and cerrada_en is null
  ) then
    raise exception 'Abrí la caja para hacer la devolución: el reintegro sale de ahí.' using errcode = 'P0001';
  end if;

  v_fiscal := coalesce(v_venta.comprobante->>'fiscal', '') = 'true' and not (v_venta.comprobante ? 'cae');
  if v_fiscal and not exists (
    select 1 from comprobantes where operacion_id = v_venta.id and estado = 'autorizado'
  ) then
    raise exception 'La factura todavía no tiene CAE: la devolución se hace cuando ARCA la autorice.' using errcode = 'P0022';
  end if;

  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Elegí qué se devuelve.' using errcode = 'P0020';
  end if;

  v_numero := siguiente_numero_interno(v_venta.empresa_id, 'DEV');

  insert into operaciones (id, empresa_id, sucursal_id, tipo, estado, numero, fecha, cliente_id, usuario_id,
                           subtotal, descuento, recargo, total, comprobante, campos_extra, origen_id)
  values (v_id, v_venta.empresa_id, v_venta.sucursal_id, 'devolucion', 'confirmada', v_numero, now(),
          v_venta.cliente_id, auth.uid(), 0, 0, 0, 0,
          case when v_fiscal then jsonb_build_object('fiscal', true, 'nota', 'credito') else '{}'::jsonb end,
          jsonb_build_object('medio', p_medio, 'motivo', nullif(btrim(coalesce(p_motivo, '')), '')),
          v_venta.id);

  for v_pedida in
    select (x->>'linea_id')::uuid linea_id, (x->>'cantidad')::numeric cantidad
    from jsonb_array_elements(p_lineas) x
  loop
    select * into v_linea from operacion_lineas
     where id = v_pedida.linea_id and operacion_id = v_venta.id and estado <> 'anulada';
    if v_linea.id is null then
      raise exception 'Ese renglón no es de esta venta.' using errcode = 'P0020';
    end if;
    if not (v_pedida.cantidad > 0) then
      raise exception 'La cantidad a devolver tiene que ser mayor que cero.' using errcode = 'P0020';
    end if;

    select coalesce(sum(l.cantidad), 0) into v_devuelto
    from operacion_lineas l join operaciones o on o.id = l.operacion_id
    where l.origen_linea_id = v_linea.id and o.estado = 'confirmada';
    if v_pedida.cantidad > v_linea.cantidad - v_devuelto then
      raise exception 'De "%" quedan % para devolver.', v_linea.descripcion, v_linea.cantidad - v_devuelto
        using errcode = 'P0023';
    end if;

    /* Lo cobrado por unidad es total/cantidad, no precio_unitario: un
       precio bajado a mano guarda ahí el de lista. */
    insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
                                  precio_unitario, costo_unitario, iva, total, origen_linea_id)
    values (v_id, v_venta.empresa_id, v_linea.item_id, v_linea.descripcion, v_pedida.cantidad,
            round(v_linea.total / nullif(v_linea.cantidad, 0), 2), v_linea.costo_unitario, v_linea.iva,
            round(v_linea.total / nullif(v_linea.cantidad, 0) * v_pedida.cantidad),
            v_linea.id);
  end loop;

  select coalesce(sum(total), 0) into v_sub from operacion_lineas where operacion_id = v_id;

  /* El descuento y el recargo de la venta, repartidos en proporción. */
  v_factor := case when coalesce(v_venta.subtotal, 0) > 0 then v_venta.total / v_venta.subtotal else 1 end;
  v_total := round(v_sub * v_factor);
  /* Y nunca más de lo que se cobró, sumando las devoluciones anteriores. */
  v_total := least(v_total, v_venta.total - coalesce((
    select sum(o.total) from operaciones o
    where o.origen_id = v_venta.id and o.tipo = 'devolucion' and o.estado = 'confirmada' and o.id <> v_id
  ), 0));
  if not (v_total > 0) then
    raise exception 'No queda nada por reintegrar de esta venta.' using errcode = 'P0023';
  end if;

  update operaciones
     set subtotal = v_sub, descuento = greatest(v_sub - v_total, 0),
         recargo = greatest(v_total - v_sub, 0), total = v_total
   where id = v_id;

  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, operacion_id, usuario_id, fecha)
  select v_venta.empresa_id, v_venta.sucursal_id, i.id, l.cantidad, 'devolucion', v_id, auth.uid(), now()
  from operacion_lineas l join items i on i.id = l.item_id
  where l.operacion_id = v_id and i.controla_stock;

  if p_medio = 'cuenta_corriente' then
    insert into cuenta_corriente_ajustes (empresa_id, cliente_id, tipo, monto, motivo, usuario_id)
    values (v_venta.empresa_id, v_venta.cliente_id, 'descuento', v_total,
            'Devolución ' || v_numero || ' de la venta ' || coalesce(v_venta.numero, ''), auth.uid());
  else
    insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, operacion_id, usuario_id, fecha)
    values (v_venta.empresa_id, v_venta.sucursal_id, p_sesion, 'egreso', p_medio, v_total,
            'Devolución ' || v_numero || ' · venta ' || coalesce(v_venta.numero, ''), v_id, auth.uid(), now());
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_venta.empresa_id, auth.uid(), 'venta.devolucion', 'operaciones', v_id,
          jsonb_build_object('numero', v_numero, 'venta', v_venta.numero, 'total', v_total,
                             'medio', p_medio, 'motivo', p_motivo, 'nota_credito', v_fiscal));

  return v_id;
end;
$$;

grant execute on function registrar_devolucion(uuid, jsonb, uuid, text, text) to authenticated;


/* ------------------------------------------------------------
   Registrar una nota de débito sobre una factura
   ------------------------------------------------------------ */
create or replace function registrar_nota_debito(
  p_venta    uuid,
  p_concepto text,
  p_monto    numeric,
  p_sesion   uuid,
  p_medio    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta  operaciones%rowtype;
  v_id     uuid := gen_random_uuid();
  v_numero text;
  v_monto  numeric := round(coalesce(p_monto, 0));
begin
  select * into v_venta from operaciones where id = p_venta;
  if v_venta.id is null or not public.puede_ver(v_venta.empresa_id) then
    raise exception 'La venta no existe.' using errcode = 'P0020';
  end if;
  if not public.permiso('anular') then
    raise exception 'Tu usuario no puede hacer notas de débito.' using errcode = 'P0021';
  end if;
  if not exists (select 1 from comprobantes where operacion_id = v_venta.id and estado = 'autorizado') then
    raise exception 'La nota de débito va sobre una factura con CAE.' using errcode = 'P0022';
  end if;
  if not (v_monto > 0) then
    raise exception 'El importe tiene que ser mayor que cero.' using errcode = 'P0020';
  end if;
  if length(btrim(coalesce(p_concepto, ''))) = 0 then
    raise exception 'Falta el concepto de la nota de débito.' using errcode = 'P0020';
  end if;
  if p_medio = 'cuenta_corriente' and v_venta.cliente_id is null then
    raise exception 'Una venta sin cliente no se carga a cuenta corriente.' using errcode = 'P0020';
  end if;

  v_numero := siguiente_numero_interno(v_venta.empresa_id, 'ND');

  insert into operaciones (id, empresa_id, sucursal_id, tipo, estado, numero, fecha, cliente_id, usuario_id,
                           subtotal, descuento, recargo, total, comprobante, origen_id)
  values (v_id, v_venta.empresa_id, v_venta.sucursal_id, 'venta', 'confirmada', v_numero, now(),
          v_venta.cliente_id, auth.uid(), v_monto, 0, 0, v_monto,
          jsonb_build_object('fiscal', true, 'nota', 'debito'), v_venta.id);

  insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, costo_unitario, iva, total)
  values (v_id, v_venta.empresa_id, null, btrim(p_concepto), 1, v_monto, 0, 21, v_monto);

  /* Se cobra como cualquier venta: pago, caja (o cuenta corriente, que así
     suma a la deuda) y la sesión obligatoria. */
  perform confirmar_operacion(v_id, p_sesion, jsonb_build_array(jsonb_build_object('medio', p_medio, 'monto', v_monto)));

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_venta.empresa_id, auth.uid(), 'venta.nota_debito', 'operaciones', v_id,
          jsonb_build_object('numero', v_numero, 'factura', v_venta.numero, 'total', v_monto,
                             'concepto', btrim(p_concepto), 'medio', p_medio));

  return v_id;
end;
$$;

grant execute on function registrar_nota_debito(uuid, text, numeric, uuid, text) to authenticated;


/* ------------------------------------------------------------
   Lo que espera CAE: facturas, notas de crédito y notas de débito
   ------------------------------------------------------------
   Igual a la de 0083 más las devoluciones fiscales, y dos columnas al
   final para saber qué es cada una. */
create or replace view facturas_vista
with (security_invoker = true)
as
select
  o.id                 as operacion_id,
  o.empresa_id,
  o.numero             as numero_interno,
  o.fecha,
  o.total,
  o.cliente_id,
  coalesce(cl.razon_social, o.comprobante->'cliente'->>'nombre') as cliente,
  case c.estado
    when 'autorizado' then 'autorizada'
    when 'pendiente'  then 'pidiendo'
    else 'sin_cae'
  end                  as estado,
  c.id                 as comprobante_id,
  c.modo,
  c.cuit,
  c.letra,
  c.tipo,
  c.punto_venta,
  c.numero,
  c.cae,
  c.cae_vto,
  c.fecha              as fecha_factura,
  c.doc_tipo,
  c.doc_nro,
  (select r.error from comprobantes r
    where r.operacion_id = o.id and r.estado = 'rechazado'
    order by r.creado_en desc limit 1) as ultimo_error,
  o.tipo               as operacion_tipo,
  coalesce(o.comprobante->>'nota', 'factura') as clase
from operaciones o
left join comprobantes c on c.operacion_id = o.id and c.estado <> 'rechazado'
left join clientes cl on cl.id = o.cliente_id
where o.tipo in ('venta', 'devolucion')
  and o.estado = 'confirmada'
  and o.comprobante->>'fiscal' = 'true'
  and not (o.comprobante ? 'cae');
