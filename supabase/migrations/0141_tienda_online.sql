/* ============================================================
   0141 · TIENDA ONLINE
   ============================================================

   El sitio del comercio, al nivel de Tienda Nube: una página con su
   diseño, sus categorías, una página por producto (con fotos y
   variantes), carrito, checkout y el pedido que llega al comercio.
   Nehuen, 08/10 y 09/10: "tiene que ser igual a Tienda Nube".

   Reemplaza a "Presencia online" (0140) como pantalla: la información
   del local (horarios, contacto, aviso) es una parte del sitio, no otro
   módulo. Lo de 0140 sigue: `presencia_de` lo usa el código que está en
   producción, y `config.publico` es de donde sale esa información.

   QUÉ SE DECIDIÓ (Nehuen, 09/10)
   ------------------------------
   - Para cualquier comercio, con variantes (talle, color) desde el
     principio.
   - Se paga al retirar o al recibir (efectivo o transferencia). Mercado
     Pago online es la fase 2.
   - El dominio propio queda para después.
   - Es el módulo `tienda`, que la plataforma prende por comercio. Sin
     el módulo, el comercio igual tiene su sitio con su información
     (lo de 0140), sin productos.

   LAS VARIANTES SON PRODUCTOS
   ---------------------------
   "Remera lisa" con talles y colores es un producto padre, y cada
   combinación ("Remera lisa · M · Negro") es un producto más, hijo
   (`items.padre_id`), con sus atributos (`items.atributos`:
   {"Talle": "M", "Color": "Negro"}), su precio, su código y su stock.
   Así la caja, la pistola, el stock y los informes siguen andando sin
   saber que existen las variantes: venden un producto, como siempre. La
   tienda los junta bajo el padre.

   LOS PRODUCTOS SON LOS DE SIEMPRE
   --------------------------------
   No hay un catálogo de la tienda: se publica un producto de Productos
   (`campos_extra.tienda.publicado`, en el padre si tiene variantes),
   con sus fotos (`items.imagen` la principal; `campos_extra.tienda.fotos`
   las demás), su descripción y, si se quiere, un precio para la web.

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
   `sitio_de` y `pedir_en_la_tienda`. El comercio la ve por RLS
   (puede_ver) y cambia el estado por `estado_pedido_tienda`.
   ============================================================ */


/* ---------- Las variantes ---------- */

alter table items add column if not exists padre_id uuid references items(id) on delete cascade;
alter table items add column if not exists atributos jsonb;
create index if not exists items_padre on items (padre_id) where padre_id is not null;

comment on column items.padre_id is
  'La variante de un producto (0141): "Remera · M · Negro" cuelga de "Remera". Es un producto completo, con su stock y su código.';
comment on column items.atributos is
  'Lo que distingue a una variante: {"Talle": "M", "Color": "Negro"}.';


/* La gestión lee los productos de `items_vista`: las dos columnas nuevas
   van al final (es lo único que `create or replace view` deja hacer). El
   resto es la vista de 0111, igual. */
create or replace view items_vista with (security_invoker = true) as
SELECT i.id,
    i.empresa_id,
    i.tipo,
    i.nombre,
    i.categoria,
    i.marca,
    i.sku,
    i.barcode,
    i.unidad,
    i.costo,
    i.precio,
    i.precios,
    i.iva,
    i.controla_stock,
    i.stock_min,
    i.bulto,
    i.duracion_min,
    i.campos_extra,
    i.activo,
    pr.nombre AS proveedor,
    i.proveedor_id,
    COALESCE(st.stock, (0)::numeric) AS stock,
    st.vence,
    COALESCE(hc.costo, i.costo) AS costo_prev,
    COALESCE(hp.precio, i.precio) AS precio_prev,
    COALESCE(v.u30, (0)::numeric) AS u30,
    COALESCE(vp.u30, (0)::numeric) AS u30p,
    round((COALESCE(v.u30, (0)::numeric) / 30.0), 4) AS vel,
    v.ultima_venta,
    i.descripcion,
    i.imagen,
    uc.costo_reposicion,
    uc.costo_reposicion_fecha,
    i.precio_abierto,
    i.iva_condicion,
    COALESCE(st.cargado, false) AS stock_cargado,
    i.padre_id,
    i.atributos
   FROM (((((((items i
     LEFT JOIN proveedores pr ON ((pr.id = i.proveedor_id)))
     LEFT JOIN ( SELECT movimientos_stock.item_id,
            sum(movimientos_stock.cantidad) AS stock,
            bool_or((movimientos_stock.tipo <> ALL (ARRAY['venta'::text, 'devolucion'::text]))) AS cargado,
            min(movimientos_stock.vence) FILTER (WHERE (movimientos_stock.vence IS NOT NULL)) AS vence
           FROM movimientos_stock
          GROUP BY movimientos_stock.item_id) st ON ((st.item_id = i.id)))
     LEFT JOIN LATERAL ( SELECT h.costo
           FROM historial_costos h
          WHERE ((h.item_id = i.id) AND (h.fecha < (now() - '30 days'::interval)))
          ORDER BY h.fecha DESC
         LIMIT 1) hc ON (true))
     LEFT JOIN LATERAL ( SELECT h.precio
           FROM historial_precios h
          WHERE ((h.item_id = i.id) AND (h.fecha < (now() - '30 days'::interval)))
          ORDER BY h.fecha DESC
         LIMIT 1) hp ON (true))
     LEFT JOIN ( SELECT l.item_id,
            sum(
                CASE
                    WHEN (o.tipo = 'devolucion'::text) THEN (- l.cantidad)
                    ELSE l.cantidad
                END) AS u30,
            max(o.fecha) FILTER (WHERE (o.tipo <> 'devolucion'::text)) AS ultima_venta
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((o.tipo = ANY (ARRAY['venta'::text, 'comanda'::text, 'devolucion'::text])) AND (o.estado = 'confirmada'::text) AND (o.fecha > (now() - '30 days'::interval)))
          GROUP BY l.item_id) v ON ((v.item_id = i.id)))
     LEFT JOIN ( SELECT l.item_id,
            sum(
                CASE
                    WHEN (o.tipo = 'devolucion'::text) THEN (- l.cantidad)
                    ELSE l.cantidad
                END) AS u30
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((o.tipo = ANY (ARRAY['venta'::text, 'comanda'::text, 'devolucion'::text])) AND (o.estado = 'confirmada'::text) AND (o.fecha > (now() - '60 days'::interval)) AND (o.fecha <= (now() - '30 days'::interval)))
          GROUP BY l.item_id) vp ON ((vp.item_id = i.id)))
     LEFT JOIN LATERAL ( SELECT l.costo_unitario AS costo_reposicion,
            o.cerrada_en AS costo_reposicion_fecha
           FROM (operacion_lineas l
             JOIN operaciones o ON ((o.id = l.operacion_id)))
          WHERE ((l.item_id = i.id) AND (o.tipo = 'compra'::text) AND (o.estado = 'confirmada'::text))
          ORDER BY o.cerrada_en DESC NULLS LAST
         LIMIT 1) uc ON (true));


/* ---------- Los pedidos ---------- */

create table pedidos_tienda (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  numero         integer not null,
  estado         text not null default 'nuevo',
  nombre         text not null,
  telefono       text not null,
  email          text,
  entrega        text not null default 'retiro',
  direccion      text,
  pago           text not null default 'efectivo',
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
  constraint pedidos_tienda_pago check (pago in ('efectivo', 'transferencia')),
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
/* Interna: la usan las funciones públicas, no el navegador. Se le saca
   a anon y authenticated además de public: los default privileges de
   Supabase se la dan a los dos (ver ARQUITECTURA.md). */
revoke all on function tienda_de(text) from public, anon, authenticated;


/* ---------- El catálogo ---------- */

/* Interna. Lo publicado, activo y con precio, con sus variantes. Nada de
   costos. "agotado" va siempre que lleve stock y no tenga; la cantidad,
   solo si el comercio eligió mostrarla. */
create or replace function catalogo_de_empresa(p_empresa uuid, p_mostrar_stock boolean)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with st as (
    select m.item_id, sum(m.cantidad) as stock from movimientos_stock m
     where m.empresa_id = p_empresa group by m.item_id
  ),
  v as (
    select h.padre_id,
           jsonb_agg(jsonb_build_object(
             'id', h.id,
             'atributos', coalesce(h.atributos, '{}'::jsonb),
             'precio', coalesce(nullif((h.campos_extra -> 'tienda' ->> 'precio')::numeric, 0), h.precio),
             'imagen', h.imagen,
             'agotado', h.controla_stock and coalesce(st.stock, 0) <= 0,
             'stock', case when p_mostrar_stock and h.controla_stock then greatest(coalesce(st.stock, 0), 0) end)
             order by h.nombre) as lista
      from items h left join st on st.item_id = h.id
     where h.empresa_id = p_empresa and h.padre_id is not null and h.activo and h.precio > 0
     group by h.padre_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id,
           'nombre', i.nombre,
           'descripcion', i.descripcion,
           'categoria', coalesce(nullif(i.categoria, ''), 'Otros'),
           'marca', nullif(i.marca, ''),
           'precio', coalesce(nullif((i.campos_extra -> 'tienda' ->> 'precio')::numeric, 0), i.precio),
           'unidad', i.unidad,
           'imagen', i.imagen,
           'fotos', case when jsonb_typeof(i.campos_extra -> 'tienda' -> 'fotos') = 'array'
                         then i.campos_extra -> 'tienda' -> 'fotos' else '[]'::jsonb end,
           'destacado', coalesce((i.campos_extra -> 'tienda' ->> 'destacado')::boolean, false),
           'agotado', case when v.lista is not null
                           then not exists (select 1 from jsonb_array_elements(v.lista) x where not (x ->> 'agotado')::boolean)
                           else i.controla_stock and coalesce(st.stock, 0) <= 0 end,
           'stock', case when v.lista is null and p_mostrar_stock and i.controla_stock then greatest(coalesce(st.stock, 0), 0) end,
           'variantes', coalesce(v.lista, '[]'::jsonb),
           'creado', i.creado_en)
         order by coalesce((i.campos_extra -> 'tienda' ->> 'destacado')::boolean, false) desc, i.categoria, i.nombre), '[]'::jsonb)
    from items i
    left join st on st.item_id = i.id
    left join v on v.padre_id = i.id
   where i.empresa_id = p_empresa and i.activo and i.padre_id is null
     and i.tipo in ('producto', 'combo')
     and coalesce((i.campos_extra -> 'tienda' ->> 'publicado')::boolean, false)
     and (i.precio > 0 or v.lista is not null)
$$;
revoke all on function catalogo_de_empresa(uuid, boolean) from public, anon, authenticated;


/* ---------- El sitio entero (público) ---------- */

/* Todo lo que la página necesita, en una ida: el diseño, la información
   (lo de presencia_de, si está publicada) y la tienda (si el comercio la
   tiene prendida). Null si no hay nada que mostrar: ni información
   publicada ni tienda. */
create or replace function sitio_de(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_e      empresas%rowtype;
  v_info   jsonb;
  v_tienda jsonb;
  v_t      jsonb;
  v_s      jsonb;
begin
  select * into v_e from empresas where slug = p_slug and activa;
  if v_e.id is null then return null; end if;

  v_info := presencia_de(p_slug);
  if 'tienda' = any(v_e.modulos) and coalesce((v_e.config -> 'tienda' ->> 'activa')::boolean, false) then
    v_t := coalesce(v_e.config -> 'tienda', '{}'::jsonb);
    v_tienda := jsonb_build_object(
      'config', jsonb_build_object(
        'minimo',      coalesce((v_t ->> 'minimo')::numeric, 0),
        'retiro',      coalesce((v_t ->> 'retiro')::boolean, true),
        'envio',       coalesce((v_t ->> 'envio')::boolean, false),
        'costoEnvio',  coalesce((v_t ->> 'costoEnvio')::numeric, 0),
        'envioGratisDesde', nullif((v_t ->> 'envioGratisDesde')::numeric, 0),
        'zona',        nullif(left(coalesce(v_t ->> 'zona', ''), 120), ''),
        'mostrarStock', coalesce((v_t ->> 'mostrarStock')::boolean, false),
        'efectivo',    coalesce((v_t ->> 'efectivo')::boolean, true),
        'transferencia', coalesce((v_t ->> 'transferencia')::boolean, false),
        'alias',       nullif(left(coalesce(v_t ->> 'alias', ''), 60), ''),
        'titular',     nullif(left(coalesce(v_t ->> 'titular', ''), 80), '')),
      'items', catalogo_de_empresa(v_e.id, coalesce((v_t ->> 'mostrarStock')::boolean, false)));
  end if;

  if v_info is null and v_tienda is null then return null; end if;

  /* El diseño: solo lo que se elige, con valores acotados. Las imágenes
     de los banners, solo del bucket público (como la galería). */
  v_s := coalesce(v_e.config -> 'sitio', '{}'::jsonb);
  return jsonb_build_object(
    'diseno', jsonb_build_object(
      'plantilla', case when v_s ->> 'plantilla' in ('clasica', 'moderna', 'minima') then v_s ->> 'plantilla' else 'clasica' end,
      'color',     case when (v_s ->> 'color') ~ '^#[0-9a-fA-F]{6}$' then v_s ->> 'color' end,
      'fuente',    case when v_s ->> 'fuente' in ('inter', 'poppins', 'montserrat', 'playfair', 'lora', 'dmsans') then v_s ->> 'fuente' else 'inter' end,
      'fondo',     case when v_s ->> 'fondo' in ('claro', 'oscuro') then v_s ->> 'fondo' else 'claro' end,
      'anuncio',   nullif(left(coalesce(v_s ->> 'anuncio', ''), 120), ''),
      'secciones', case when jsonb_typeof(v_s -> 'secciones') = 'array' then v_s -> 'secciones' end,
      'banners',   (select coalesce(jsonb_agg(jsonb_build_object(
                       'url', b ->> 'url',
                       'titulo', nullif(left(coalesce(b ->> 'titulo', ''), 80), ''),
                       'texto', nullif(left(coalesce(b ->> 'texto', ''), 160), ''),
                       'boton', nullif(left(coalesce(b ->> 'boton', ''), 30), ''),
                       'enlace', nullif(left(coalesce(b ->> 'enlace', ''), 120), '')) order by o), '[]'::jsonb)
                      from jsonb_array_elements(case when jsonb_typeof(v_s -> 'banners') = 'array' then v_s -> 'banners' else '[]'::jsonb end)
                           with ordinality as x(b, o)
                     where o <= 5 and (b ->> 'url') like '%/storage/v1/object/public/publico/%')),
    'info', v_info,
    'tienda', v_tienda);
end;
$$;


/* ---------- Pedir (pública) ---------- */

/* p_pedido: { nombre, telefono, email, entrega: retiro|envio, direccion,
               pago: efectivo|transferencia, nota,
               lineas: [{ item_id, cantidad }] }
   item_id es el producto o, si tiene variantes, la variante elegida.
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
  v_email     text := nullif(left(lower(btrim(coalesce(p_pedido ->> 'email', ''))), 120), '');
  v_entrega   text := coalesce(p_pedido ->> 'entrega', 'retiro');
  v_pago      text := coalesce(p_pedido ->> 'pago', 'efectivo');
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
  v_publicado boolean;
  l           jsonb;
  i           items%rowtype;
  p           items%rowtype;
begin
  select * into v_e from tienda_de(p_slug);
  if v_e.id is null then
    raise exception 'Esta tienda no está recibiendo pedidos.' using errcode = 'P0040';
  end if;
  v_c := coalesce(v_e.config -> 'tienda', '{}'::jsonb);

  if length(v_nombre) < 2 then raise exception 'Escribí tu nombre.' using errcode = 'P0041'; end if;
  if length(v_tel) < 8 or length(v_tel) > 15 then raise exception 'Escribí un celular con código de área.' using errcode = 'P0041'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Ese mail no parece estar bien.' using errcode = 'P0041'; end if;
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
  if v_pago not in ('efectivo', 'transferencia')
     or (v_pago = 'efectivo' and not coalesce((v_c ->> 'efectivo')::boolean, true))
     or (v_pago = 'transferencia' and not coalesce((v_c ->> 'transferencia')::boolean, false)) then
    raise exception 'Elegí cómo vas a pagar.' using errcode = 'P0041';
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
       and activo and precio > 0 and tipo in ('producto', 'combo');
    /* Publicado: el producto, o el padre si es una variante. */
    p := null;
    if i.padre_id is not null then
      select * into p from items where id = i.padre_id and activo;
      v_publicado := coalesce((p.campos_extra -> 'tienda' ->> 'publicado')::boolean, false);
    else
      v_publicado := coalesce((i.campos_extra -> 'tienda' ->> 'publicado')::boolean, false)
                     and not exists (select 1 from items h where h.padre_id = i.id and h.activo);
    end if;
    if i.id is null or not v_publicado then
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
      'item_id', i.id, 'nombre', i.nombre, 'precio', v_precio, 'cantidad', v_cant, 'unidad', i.unidad,
      'barcode', i.barcode, 'atributos', i.atributos));
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

  insert into pedidos_tienda (empresa_id, numero, nombre, telefono, email, entrega, direccion, pago, nota, lineas, subtotal, envio, total)
  values (v_e.id, v_numero, v_nombre, v_tel, v_email, v_entrega, case when v_entrega = 'envio' then v_dir end, v_pago, v_nota,
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


revoke all on function sitio_de(text) from public;
revoke all on function pedir_en_la_tienda(text, jsonb) from public;
revoke all on function estado_pedido_tienda(uuid, text, uuid) from public, anon;
grant execute on function sitio_de(text) to anon, authenticated;
grant execute on function pedir_en_la_tienda(text, jsonb) to anon, authenticated;
grant execute on function estado_pedido_tienda(uuid, text, uuid) to authenticated;
