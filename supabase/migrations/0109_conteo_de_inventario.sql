/* ============================================================
   0109 · El conteo de inventario se guarda
   ============================================================

   Stock → Conteo de inventario venía del prototipo: "Ajustar" cambiaba
   el número en la memoria del navegador y nada más. Quien contaba la
   góndola y ajustaba creía que había quedado; al refrescar volvía el
   número de antes.

   Ahora un ajuste es un movimiento de stock de tipo 'ajuste' por la
   diferencia entre lo contado y lo que la base dice que hay en esa
   sucursal, con quién lo hizo. La diferencia la calcula la base en el
   momento, no la pantalla: el número que tenía la pantalla puede ser de
   hace una hora, con ventas en el medio.

   Con los permisos de quien llama: las políticas de movimientos_stock
   de siempre.
   ============================================================ */

create or replace function ajustar_stock(p_item uuid, p_real numeric, p_sucursal uuid default null, p_motivo text default null)
returns table (antes numeric, diferencia numeric)
language plpgsql security invoker set search_path = public as $$
declare
  v_empresa uuid;
  v_sucursal uuid;
  v_antes numeric;
begin
  if p_real is null or p_real < 0 then
    raise exception 'Lo contado tiene que ser cero o más.' using errcode = 'P0036';
  end if;
  select empresa_id into v_empresa from items where id = p_item;
  if v_empresa is null then raise exception 'No se encontró el producto.' using errcode = 'P0035'; end if;
  v_sucursal := coalesce(p_sucursal, primera_sucursal(v_empresa));
  perform sucursal_del_comercio(v_sucursal, v_empresa);

  /* Dos personas contando el mismo producto a la vez: la segunda espera
     a que termine la primera y calcula sobre lo que quedó. */
  perform pg_advisory_xact_lock(hashtext('ajustar_stock:' || p_item::text || ':' || v_sucursal::text));

  select coalesce(sum(cantidad), 0) into v_antes
    from movimientos_stock where item_id = p_item and sucursal_id = v_sucursal;

  if p_real - v_antes <> 0 then
    insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, usuario_id, motivo)
    values (v_empresa, v_sucursal, p_item, p_real - v_antes, 'ajuste', auth.uid(), coalesce(nullif(trim(p_motivo), ''), 'Conteo de inventario'));
  end if;

  return query select v_antes, p_real - v_antes;
end;
$$;

/* Al crear una función, Postgres le da ejecutar a public y Supabase
   además a anon, cada uno por su lado: hay que sacárselo a los dos. A
   transferir_stock (0108) solo se le había sacado a anon, y public se lo
   seguía dando. Las políticas de las tablas ya frenaban a quien no tiene
   sesión, pero la puerta queda cerrada igual. */
revoke execute on function ajustar_stock(uuid, numeric, uuid, text) from public, anon;
grant execute on function ajustar_stock(uuid, numeric, uuid, text) to authenticated;
revoke execute on function transferir_stock(uuid, numeric, uuid, uuid, text) from public, anon;
grant execute on function transferir_stock(uuid, numeric, uuid, uuid, text) to authenticated;
