/* ============================================================
   0092 · CORREGIR EL MEDIO DE PAGO DE UNA VENTA
   ============================================================

   El cajero cobra en efectivo y toca "Débito", o al revés. Hasta acá eso
   no tenía arreglo desde la pantalla: la venta es append-only, y la
   primera corrección (Super 25, 0099-00000036, 25/09/2026) se hizo a mano
   en la base. Esto la vuelve una acción de Caja.

   QUÉ SE TOCA
   -----------
   El medio está en dos lugares y se cambian los dos juntos: el pago de la
   venta (`pagos`, lo que leen los informes) y su ingreso en la caja
   (`movimientos_caja`, lo que suma el arqueo). Cambiar uno solo haría que
   Caja e Informes digan cosas distintas de la misma plata. El importe no
   se toca: es un error de botón, no de cuánto se cobró.

   QUÉ NO SE DEJA
   --------------
   - Con la caja de esa venta cerrada: el arqueo ya se contó con ese medio,
     y moverlo después cambiaría un cierre que alguien firmó.
   - Hacia o desde cuenta corriente: eso no es un medio, es deuda. Cambia
     el saldo del cliente y no pasa por la caja; se arregla con una
     devolución o un pago.
   - Con recargo, de un lado o del otro: el recargo cambia el total de la
     venta, y eso ya no es corregir un botón. Devolución y cobrar de nuevo.

   QUIÉN
   -----
   El permiso `anular`, el mismo de las devoluciones. No es un detalle: de
   efectivo a débito es exactamente cómo se tapa un faltante del cajón, así
   que el cajero de fábrica no puede, y cada corrección queda en la
   bitácora con quién, de qué a qué y por qué.
   ============================================================ */

create or replace function corregir_medio_pago(
  p_pago   uuid,
  p_medio  text,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago   pagos%rowtype;
  v_venta  operaciones%rowtype;
  v_mov    movimientos_caja%rowtype;
  v_medios jsonb;
  v_nuevo  jsonb;
begin
  /* El pago se bloquea: dos correcciones a la vez sobre el mismo pago
     buscarían el ingreso con el medio viejo, y la segunda no lo
     encontraría o movería otro. */
  select * into v_pago from pagos where id = p_pago for update;
  if v_pago.id is null or not public.puede_ver(v_pago.empresa_id) then
    raise exception 'El pago no existe.' using errcode = 'P0020';
  end if;
  if not public.permiso('anular') then
    raise exception 'Tu usuario no puede corregir cobros.' using errcode = 'P0021';
  end if;

  select * into v_venta from operaciones where id = v_pago.operacion_id;
  if v_venta.tipo not in ('venta', 'comanda') or v_venta.estado <> 'confirmada' then
    raise exception 'Solo se corrige el cobro de una venta cobrada.' using errcode = 'P0020';
  end if;

  p_medio := btrim(coalesce(p_medio, ''));
  if p_medio = '' then
    raise exception 'Falta el medio correcto.' using errcode = 'P0020';
  end if;
  if p_medio = v_pago.medio then
    raise exception 'Ese ya es el medio del cobro.' using errcode = 'P0020';
  end if;
  if 'cuenta_corriente' in (p_medio, v_pago.medio) then
    raise exception 'La cuenta corriente no se corrige acá: cambia la deuda del cliente. Hacé una devolución o registrá el pago.'
      using errcode = 'P0024';
  end if;
  if v_pago.recargo <> 0 then
    raise exception 'Este cobro tuvo recargo: cambiar el medio cambia el total. Hacé una devolución y cobrá de nuevo.'
      using errcode = 'P0024';
  end if;

  /* El medio nuevo tiene que ser uno del comercio. Un comercio que nunca
     guardó sus medios usa los de fábrica (MEDIOS_INICIALES), que no tienen
     recargo. */
  select config->'medios' into v_medios from empresas where id = v_pago.empresa_id;
  if jsonb_typeof(v_medios) = 'array' and jsonb_array_length(v_medios) > 0 then
    select m into v_nuevo from jsonb_array_elements(v_medios) m where m->>'k' = p_medio;
    if v_nuevo is null or coalesce(v_nuevo->>'activo', 'true') = 'false' then
      raise exception 'Ese medio no está activo en este comercio.' using errcode = 'P0020';
    end if;
    if coalesce(v_nuevo->>'recargo', 'false') = 'true' and coalesce((v_nuevo->>'tasa')::numeric, 0) > 0 then
      raise exception '% lleva recargo: cambiar a ese medio cambia el total. Hacé una devolución y cobrá de nuevo.', v_nuevo->>'n'
        using errcode = 'P0024';
    end if;
  elsif p_medio not in ('efectivo', 'debito', 'credito', 'mp', 'transferencia') then
    raise exception 'Ese medio no está activo en este comercio.' using errcode = 'P0020';
  end if;

  /* Su ingreso en la caja. Una venta pagada en partes tiene uno por
     pago; se toma el que coincide en medio e importe, y si hay dos
     iguales da lo mismo cuál. */
  select * into v_mov from movimientos_caja
   where operacion_id = v_pago.operacion_id and empresa_id = v_pago.empresa_id
     and tipo = 'ingreso' and medio = v_pago.medio and monto = v_pago.monto
   order by fecha, id
   limit 1
   for update;
  if v_mov.id is null then
    raise exception 'No se encontró el ingreso de este cobro en la caja.' using errcode = 'P0020';
  end if;
  if not exists (select 1 from sesiones_caja where id = v_mov.sesion_id and cerrada_en is null) then
    raise exception 'La caja de esta venta ya se cerró: el arqueo se contó con este medio.' using errcode = 'P0025';
  end if;

  update pagos set medio = p_medio where id = v_pago.id;
  update movimientos_caja set medio = p_medio where id = v_mov.id;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_pago.empresa_id, auth.uid(), 'venta.medio_corregido', 'operaciones', v_venta.id,
          jsonb_build_object('venta', v_venta.numero, 'de', v_pago.medio, 'a', p_medio, 'monto', v_pago.monto,
                             'motivo', nullif(btrim(coalesce(p_motivo, '')), ''),
                             'pago_id', v_pago.id, 'movimiento_id', v_mov.id));
end;
$$;

revoke execute on function corregir_medio_pago(uuid, text, text) from public, anon;
grant execute on function corregir_medio_pago(uuid, text, text) to authenticated;
