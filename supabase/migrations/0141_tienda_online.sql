/* ============================================================
   0141 · TIENDA ONLINE
   ============================================================

   La página del comercio (0140) muestra quién es y cómo encontrarlo. La
   tienda le suma lo que vende: los productos publicados, un carrito y
   un pedido que llega al comercio. Es lo que Ventario pone en el centro
   de su producto y Vendi en su plan más caro; Nehuen lo pidió el 08/10.

   QUÉ SE DECIDIÓ (08/10, a confirmar por Nehuen)
   ----------------------------------------------
   - Comercio y minimercado primero. Gastronomía ya tiene pedidos por
     canal y la carta QR; su tienda va después, en el centro de pedidos.
   - Se paga al retirar o al recibir. Mercado Pago online, después: pide
     que cada comercio conecte su cuenta y el cobro hoy ya existe en la
     caja.
   - Es un módulo, `tienda`, que se prende por comercio. En qué plan
     entra lo decide la plataforma.

   LOS PRODUCTOS SON LOS DE SIEMPRE
   --------------------------------
   No hay un catálogo de la tienda: se publica un producto de Productos
   (`items.campos_extra.tienda.publicado`), con su foto (`items.imagen`,
   de 0023) y, si se quiere, un precio para la web
   (`campos_extra.tienda.precio`). El precio, el nombre y el stock son
   los de la caja: lo que se vende en la web es lo que hay.

   EL PEDIDO
   ---------
   Entra en `pedidos_tienda` como "nuevo" y lo confirma el comercio,
   igual que el de la carta QR: la página es pública y cualquiera puede
   mandar un pedido falso. El precio lo pone la base, nunca el
   navegador. No descuenta stock ni entra a la caja: eso pasa cuando se
   cobra, con la venta de siempre (Pedidos → preparar → cobrar).

   Topes, porque la función es pública: 40 renglones, de 1 a 50 unidades
   cada uno; 3 pedidos cada 10 minutos por teléfono y 30 por comercio.

   Nadie de afuera lee la tabla: el navegador del cliente solo llama a
   `catalogo_tienda` y `pedir_en_la_tienda`. El comercio la ve por RLS
   (puede_ver) y cambia el estado por `estado_pedido_tienda`.
   ============================================================ */


/* ---------- Los pedidos ---------- */

create table pedidos_tienda (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  numero         integer not null,
  estado         text not null default 'nuevo',
  nombre         text not null,
  telefono       text not null,
  entrega        text not null default 'retiro',
  direccion      text,
  nota           text,
  lineas         jsonb not null,
  subtotal       numeric(14,2) not null,
  envio          numeric(14,2) not null default 0,
  total          numeric(14,2) not null,
  venta_id       uuid references operaciones(id) on delete set null,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint pedidos_tienda_estado check (estado in ('nuevo', 'confirmado', 'listo', 'entregado', 'cancelado')),
  constraint pedidos_tienda_entrega check (entrega in ('retiro', 'envio')),
  unique (empresa_id, numero)
);

create index on pedidos_tienda (empresa_id, creado_en desc);
create index on pedidos_tienda (empresa_id, telefono, creado_en desc);

alter table pedidos_tienda enable row level security;
revoke all on pedidos_tienda from anon;
revoke insert, update, delete on pedidos_tienda from authenticated;
create policy pedidos_tienda_ver on pedidos_tienda
  for select using (public.puede_ver(empresa_id));


/* ---------- El comercio con tienda ---------- */

/* La empresa del slug, si tiene la tienda contratada y prendida. */
create or replace function tienda_de(p_slug text)
returns empresas
language sql
stable
security definer
set search_path = public
as $$
  select e.* from empresas e
   where e.slug = p_slug and e.activa
     and 'tienda' = any(e.modulos)
     and coalesce((e.config -> 'tienda' ->> 'activa')::boolean, false)
$$;
/* Interna: la usan las dos funciones públicas, no el navegador. Se le
   saca a anon y authenticated además de public: los default privileges
   de Supabase se la dan a los dos (ver ARQUITECTURA.md). */
revoke all on function tienda_de(text) from public, anon, authenticated;


/* ---------- Leer la tienda (pública) ---------- */

/* Solo lo publicado, activo y con precio. Nada de costos. El stock va
   solo si el comercio eligió mostrarlo; "agotado" va siempre que el
   producto lleve stock y no tenga, para no vender lo que no hay. */
create or replace function catalogo_tienda(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with e as (select * from tienda_de(p_slug)),
  t as (select coalesce(e.config -> 'tienda', '{}'::jsonb) as c from e)
  select case when (select id from e) is null then null else jsonb_build_object(
    'config', (select jsonb_build_object(
        'minimo',      coalesce((c ->> 'minimo')::numeric, 0),
        'retiro',      coalesce((c ->> 'retiro')::boolean, true),
        'envio',       coalesce((c ->> 'envio')::boolean, false),
        'costoEnvio',  coalesce((c ->> 'costoEnvio')::numeric, 0),
        'envioGratisDesde', nullif((c ->> 'envioGratisDesde')::numeric, 0),
        'zona',        nullif(left(coalesce(c ->> 'zona', ''), 120), ''),
        'mostrarStock', coalesce((c ->> 'mostrarStock')::boolean, false)
      ) from t),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'nombre', i.nombre,
               'descripcion', i.descripcion,
               'categoria', coalesce(nullif(i.categoria, ''), 'Otros'),
               'precio', coalesce(nullif((i.campos_extra -> 'tienda' ->> 'precio')::numeric, 0), i.precio),
               'unidad', i.unidad,
               'imagen', i.imagen,
               'destacado', coalesce((i.campos_extra -> 'tienda' ->> 'destacado')::boolean, false),
               'agotado', i.controla_stock and coalesce(s.stock, 0) <= 0,
               'stock', case when coalesce(((select c from t) ->> 'mostrarStock')::boolean, false) and i.controla_stock
                             then greatest(coalesce(s.stock, 0), 0) end)
             order by coalesce((i.campos_extra -> 'tienda' ->> 'destacado')::boolean, false) desc, i.categoria, i.nombre)
        from items i
        left join lateral (
          select sum(m.cantidad) as stock from movimientos_stock m
           where m.item_id = i.id and m.empresa_id = i.empresa_id
        ) s on true
       where i.empresa_id = (select id from e) and i.activo and i.precio > 0
         and i.tipo in ('producto', 'combo')
         and coalesce((i.campos_extra -> 'tienda' ->> 'publicado')::boolean, false)
    ), '[]'::jsonb)
  ) end
$$;


/* ---------- Pedir (pública) ---------- */

/* p_pedido: { nombre, telefono, entrega: retiro|envio, direccion, nota,
               lineas: [{ item_id, cantidad }] }
   Devuelve { numero, total }. */
create or replace function pedir_en_la_tienda(p_slug text, p_pedido jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_e         empresas%rowtype;
  v_c         jsonb;
  v_nombre    text := left(btrim(coalesce(p_pedido ->> 'nombre', '')), 60);
  v_tel       text := regexp_replace(coalesce(p_pedido ->> 'telefono', ''), '\D', '', 'g');
  v_entrega   text := coalesce(p_pedido ->> 'entrega', 'retiro');
  v_dir       text := nullif(left(btrim(coalesce(p_pedido ->> 'direccion', '')), 160), '');
  v_nota      text := nullif(left(btrim(coalesce(p_pedido ->> 'nota', '')), 300), '');
  v_lineas    jsonb := coalesce(p_pedido -> 'lineas', '[]'::jsonb);
  v_salida    jsonb := '[]'::jsonb;
  v_sub       numeric := 0;
  v_envio     numeric := 0;
  v_numero    integer;
  v_cant      numeric;
  v_precio    numeric;
  v_stock     numeric;
  l           jsonb;
  i           items%rowtype;
begin
  select * into v_e from tienda_de(p_slug);
  if v_e.id is null then
    raise exception 'Esta tienda no está recibiendo pedidos.' using errcode = 'P0040';
  end if;
  v_c := coalesce(v_e.config -> 'tienda', '{}'::jsonb);

  if length(v_nombre) < 2 then raise exception 'Escribí tu nombre.' using errcode = 'P0041'; end if;
  if length(v_tel) < 8 or length(v_tel) > 15 then raise exception 'Escribí un celular con código de área.' using errcode = 'P0041'; end if;
  if v_entrega not in ('retiro', 'envio') then raise exception 'Elegí cómo lo recibís.' using errcode = 'P0041'; end if;
  if v_entrega = 'retiro' and not coalesce((v_c ->> 'retiro')::boolean, true) then
    raise exception 'Esta tienda no tiene retiro en el local.' using errcode = 'P0041';
  end if;
  if v_entrega = 'envio' and not coalesce((v_c ->> 'envio')::boolean, false) then
    raise exception 'Esta tienda no hace envíos.' using errcode = 'P0041';
  end if;
  if v_entrega = 'envio' and coalesce(length(v_dir), 0) < 5 then
    raise exception 'Escribí la dirección para el envío.' using errcode = 'P0041';
  end if;

  if jsonb_typeof(v_lineas) <> 'array' or jsonb_array_length(v_lineas) = 0 then
    raise exception 'El carrito está vacío.' using errcode = 'P0042';
  end if;
  if jsonb_array_length(v_lineas) > 40 then
    raise exception 'Son muchos productos para un pedido: mandalo en dos.' using errcode = 'P0042';
  end if;

  /* Los topes: un robot que manda pedidos falsos se frena, una persona
     de verdad no llega nunca. */
  if (select count(*) from pedidos_tienda where empresa_id = v_e.id and telefono = v_tel and creado_en > now() - interval '10 minutes') >= 3
     or (select count(*) from pedidos_tienda where empresa_id = v_e.id and creado_en > now() - interval '10 minutes') >= 30 then
    raise exception 'Llegaron muchos pedidos seguidos. Esperá unos minutos.' using errcode = 'P0043';
  end if;

  for l in select * from jsonb_array_elements(v_lineas) loop
    v_cant := coalesce((l ->> 'cantidad')::numeric, 0);
    if v_cant <= 0 or v_cant > 50 then
      raise exception 'Cada producto, de 1 a 50.' using errcode = 'P0042';
    end if;
    select * into i from items
     where id = nullif(l ->> 'item_id', '')::uuid and empresa_id = v_e.id
       and activo and precio > 0 and tipo in ('producto', 'combo')
       and coalesce((campos_extra -> 'tienda' ->> 'publicado')::boolean, false);
    if i.id is null then
      raise exception 'Algo del carrito ya no está en la tienda. Actualizá la página.' using errcode = 'P0044';
    end if;
    if i.unidad not in ('kg', 'g', 'l', 'm') and v_cant <> trunc(v_cant) then
      raise exception 'Las unidades van enteras.' using errcode = 'P0042';
    end if;
    if i.controla_stock then
      select coalesce(sum(cantidad), 0) into v_stock from movimientos_stock where item_id = i.id and empresa_id = v_e.id;
      if v_stock <= 0 then
        raise exception '% se agotó. Sacalo del carrito.', i.nombre using errcode = 'P0045';
      end if;
    end if;
    v_precio := coalesce(nullif((i.campos_extra -> 'tienda' ->> 'precio')::numeric, 0), i.precio);
    v_sub := v_sub + round(v_precio * v_cant);
    v_salida := v_salida || jsonb_build_array(jsonb_build_object(
      'item_id', i.id, 'nombre', i.nombre, 'precio', v_precio, 'cantidad', v_cant, 'unidad', i.unidad, 'barcode', i.barcode));
  end loop;

  if v_sub < coalesce((v_c ->> 'minimo')::numeric, 0) then
    raise exception 'La compra mínima es de $%.', replace(to_char(coalesce((v_c ->> 'minimo')::numeric, 0), 'FM999,999,999'), ',', '.') using errcode = 'P0046';
  end if;

  if v_entrega = 'envio' then
    v_envio := coalesce((v_c ->> 'costoEnvio')::numeric, 0);
    if nullif((v_c ->> 'envioGratisDesde')::numeric, 0) is not null and v_sub >= (v_c ->> 'envioGratisDesde')::numeric then
      v_envio := 0;
    end if;
  end if;

  /* El número, correlativo por comercio. El bloqueo de la fila de la
     empresa ordena a dos pedidos que llegan juntos. */
  perform 1 from empresas where id = v_e.id for update;
  select coalesce(max(numero), 0) + 1 into v_numero from pedidos_tienda where empresa_id = v_e.id;

  insert into pedidos_tienda (empresa_id, numero, nombre, telefono, entrega, direccion, nota, lineas, subtotal, envio, total)
  values (v_e.id, v_numero, v_nombre, v_tel, v_entrega, case when v_entrega = 'envio' then v_dir end, v_nota,
          v_salida, v_sub, v_envio, v_sub + v_envio);

  return jsonb_build_object('numero', v_numero, 'total', v_sub + v_envio);
end;
$$;


/* ---------- El comercio mueve el pedido ---------- */

/* nuevo → confirmado → listo → entregado, o cancelado. `entregado` con
   la venta que lo cobró. Solo quien ve el comercio. */
create or replace function estado_pedido_tienda(p_pedido uuid, p_estado text, p_venta uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p pedidos_tienda%rowtype;
begin
  select * into v_p from pedidos_tienda where id = p_pedido for update;
  if v_p.id is null or not public.puede_ver(v_p.empresa_id) then
    raise exception 'No encontramos ese pedido.' using errcode = '42501';
  end if;
  if p_estado not in ('confirmado', 'listo', 'entregado', 'cancelado') then
    raise exception 'Ese estado no existe.' using errcode = 'P0047';
  end if;
  if v_p.estado in ('entregado', 'cancelado') then
    raise exception 'Ese pedido ya está cerrado.' using errcode = 'P0047';
  end if;
  update pedidos_tienda
     set estado = p_estado,
         venta_id = coalesce(p_venta, venta_id),
         actualizado_en = now()
   where id = p_pedido;
end;
$$;


revoke all on function catalogo_tienda(text) from public;
revoke all on function pedir_en_la_tienda(text, jsonb) from public;
revoke all on function estado_pedido_tienda(uuid, text, uuid) from public, anon;
grant execute on function catalogo_tienda(text) to anon, authenticated;
grant execute on function pedir_en_la_tienda(text, jsonb) to anon, authenticated;
grant execute on function estado_pedido_tienda(uuid, text, uuid) to authenticated;
