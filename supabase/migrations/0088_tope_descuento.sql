/* ============================================================
   0088 · EL TOPE DEL DESCUENTO, EN LA BASE
   ============================================================

   El descuento llega hasta 99,99 %: una venta en $0 es mercadería que
   salió sin cobrarse, y la caja no la puede explicar. Las pantallas ya lo
   topean (src/utils/helpers.js, TOPE_DESCUENTO), pero eso apaga botones y
   nada más: una llamada a mano con la sesión de cualquiera lo salteaba.

   El tope se mide en plata, igual que en la pantalla: lo máximo que se
   puede descontar de un subtotal es floor(subtotal * 99,99 / 100), que
   siempre queda por debajo de él. Medido solo en porcentaje el redondeo lo
   saltea: el 99,99 % de $1.500 son $1.499,85, que en pesos enteros es
   $1.500 y deja la venta en cero.

   Tres cosas:

   1. `tope_descuento(subtotal)`: la cuenta, en un solo lugar.

   2. Un disparador sobre `operaciones` que rechaza toda venta confirmada
      con un descuento por encima del tope. Es el control de fondo y no
      depende de por dónde entre la venta: `registrar_venta` (el cobro del
      mostrador) y `cerrar_comanda` (una mesa) terminan los dos en una fila
      confirmada. Se eligió un disparador y no reescribir esas funciones
      porque tienen cinco versiones cada una, y copiarlas para agregar una
      línea arriesga pisar algo.

      Solo mira las confirmadas: una mesa abierta no tiene el subtotal al
      día en su fila —se calcula de los renglones al cerrarla— y comparar
      contra esa columna rechazaría descuentos válidos.

      Una venta hecha sin internet que choque con esto no se pierde: la
      cola del equipo la aparta con el motivo y sigue con las demás
      (src/datos/cola.js). Solo puede pasar con una venta armada a mano o
      con un equipo que todavía corre la versión anterior de la pantalla.

   3. `aplicar_descuento` avisa en el momento, mientras la mesa está
      abierta, en vez de esperar al cobro. Tiene una sola versión (0019),
      así que se la reescribe entera. Y el porcentaje guardado no puede
      pasar de 99,99.

   El error es el mismo P0009 que ya usaban "el descuento no puede ser
   mayor que la cuenta": la pantalla lo traduce en un solo lugar.
   ============================================================ */

create or replace function tope_descuento(p_subtotal numeric)
returns numeric
language sql
immutable
as $$
  select greatest(0, floor(coalesce(p_subtotal, 0) * 99.99 / 100));
$$;

comment on function tope_descuento is
  'Lo máximo que se puede descontar de un subtotal: 99,99 %, en pesos enteros y siempre por debajo del subtotal.';


/* ------------------------------------------------------------
   El control de fondo
   ------------------------------------------------------------ */

create or replace function operaciones_tope_descuento()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'confirmada'
     and new.tipo in ('venta', 'comanda')
     and coalesce(new.descuento, 0) > 0
     and new.descuento > tope_descuento(new.subtotal) then
    raise exception 'El descuento llega hasta 99,99 %% de la cuenta: sobre % se pueden descontar hasta %.',
      new.subtotal, tope_descuento(new.subtotal)
      using errcode = 'P0009';
  end if;
  return new;
end;
$$;

create trigger operaciones_tope_descuento
  before insert or update of descuento, subtotal, estado on operaciones
  for each row execute function operaciones_tope_descuento();


/* ------------------------------------------------------------
   El porcentaje guardado
   ------------------------------------------------------------ */

alter table operaciones drop constraint operaciones_descuento_pct_valido;
alter table operaciones add constraint operaciones_descuento_pct_valido
  check (descuento_pct is null or (descuento_pct >= 0 and descuento_pct <= 99.99));


/* ------------------------------------------------------------
   La mesa avisa al cargar el descuento
   ------------------------------------------------------------
   Igual a la de 0019 salvo el tope. */

create or replace function aplicar_descuento(
  p_comanda uuid,
  p_pct     numeric default null,
  p_monto   numeric default null
)
returns numeric
language plpgsql
as $$
declare
  v_sub  numeric;
  v_desc numeric;
begin
  select coalesce(sum(total), 0) into v_sub
  from operacion_lineas
  where operacion_id = p_comanda and estado <> 'anulada';

  if p_pct is not null then
    v_desc := round(v_sub * p_pct / 100);
  else
    v_desc := coalesce(p_monto, 0);
  end if;

  /* Antes el límite era la cuenta entera, que dejaba la mesa en cero.
     Ahora es el tope, y por el porcentaje también: 100 % no se guarda. */
  if (p_pct is not null and p_pct > 99.99) or (v_desc > 0 and v_desc > tope_descuento(v_sub)) then
    raise exception 'El descuento llega hasta 99,99 %% de la cuenta.' using errcode = 'P0009';
  end if;

  update operaciones
     set descuento_pct = p_pct,
         descuento     = v_desc,
         total         = v_sub - v_desc + coalesce(recargo, 0)
   where id = p_comanda and estado = 'abierta';

  if not found then
    raise exception 'Esa comanda no está abierta.' using errcode = 'P0003';
  end if;

  return v_desc;
end;
$$;

comment on function aplicar_descuento is
  'Descuento por porcentaje o por importe, hasta 99,99 %. El porcentaje sigue al subtotal si la mesa pide más.';
