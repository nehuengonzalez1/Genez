/* ============================================================
   0005 · EL HISTORIAL SE ESCRIBE SOLO
   ============================================================

   Cambiar un costo pasa por cinco pantallas distintas: la ficha del
   producto, la carga de un remito, el pedido sugerido, la ficha rápida
   del escáner y la edición masiva. Si cada una tiene que acordarse de
   registrar el cambio, tarde o temprano una se olvida y el historial
   queda mintiendo.

   Con esto, la base lo registra sola: la pantalla actualiza el costo y
   el historial se escribe como consecuencia.
   ============================================================ */

create or replace function registrar_cambio_de_precio()
returns trigger
language plpgsql
as $$
begin
  /* El alta también deja asiento: sin el costo de partida no hay contra
     qué comparar la primera suba. */
  if tg_op = 'INSERT' then
    insert into historial_costos (empresa_id, item_id, costo, origen)
      values (new.empresa_id, new.id, new.costo, 'alta');
    insert into historial_precios (empresa_id, item_id, precio, origen)
      values (new.empresa_id, new.id, new.precio, 'alta');
    return new;
  end if;

  if new.costo is distinct from old.costo then
    insert into historial_costos (empresa_id, item_id, costo, origen)
      values (new.empresa_id, new.id, new.costo, 'edición');
  end if;

  if new.precio is distinct from old.precio then
    insert into historial_precios (empresa_id, item_id, precio, origen)
      values (new.empresa_id, new.id, new.precio, 'edición');
  end if;

  return new;
end;
$$;

create trigger items_registrar_precio
  after insert or update of costo, precio on items
  for each row execute function registrar_cambio_de_precio();

comment on function registrar_cambio_de_precio is
  'Mantiene historial_costos e historial_precios al día sin que las pantallas tengan que acordarse.';
