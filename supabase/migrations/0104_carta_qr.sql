/* ============================================================
   0104 · LA CARTA QR: PEDIR DESDE LA MESA
   ============================================================

   Un QR pegado en cada mesa. Quien lo escanea ve la carta en el teléfono
   —sin descargar nada, sin crear cuenta— arma su pedido y lo manda. El
   pedido cae en la comanda de esa mesa.

   LO QUE MANDA LA MESA NO VA A LA COCINA SOLO
   -------------------------------------------
   La página es pública: cualquiera con el QR (o con una foto del QR)
   puede mandar pedidos. Por eso lo pedido entra como BORRADOR, que es lo
   que ya existía para "anotado, todavía no salió" (0018): el mozo lo ve
   marcado, lo confirma con el mismo "Enviar a cocina" de siempre o lo
   anula. No hubo que inventar un estado nuevo, y un pedido falso nunca
   llega a cocinarse.

   Tres defensas más:
   - Cada mesa tiene su código (`recursos.qr_token`), que se puede
     renovar si una foto del QR anda circulando.
   - Topes: hasta 20 renglones y 20 unidades por renglón en un pedido, y
     hasta 6 pedidos por mesa cada 10 minutos (`pedidos_qr`).
   - El precio sale de la base, nunca del teléfono: la página manda qué
     y cuánto, no a cuánto.

   Todo por dos funciones con security definer, que son lo único que la
   página pública puede llamar: `carta_de_la_mesa` (leer) y
   `pedir_desde_la_mesa` (pedir). Ninguna tabla se abre a `anon`.
   ============================================================ */

/* ------------------------------------------------------------
   El código de cada mesa
   ------------------------------------------------------------ */

alter table recursos add column qr_token text;
update recursos set qr_token = replace(gen_random_uuid()::text, '-', '') where qr_token is null;
alter table recursos alter column qr_token set default replace(gen_random_uuid()::text, '-', '');
alter table recursos alter column qr_token set not null;
create unique index recursos_qr_token on recursos (qr_token);

comment on column recursos.qr_token is
  'El código del QR de la mesa (0104). Se renueva con renovar_qr() si una foto del QR anda circulando.';

/* Renovar el código deja inservibles los QR impresos de esa mesa: pide
   el permiso de configurar, como editar el plano. */
create or replace function renovar_qr(p_recurso uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  select empresa_id into v_empresa from recursos where id = p_recurso;
  if v_empresa is null or not public.puede_ver(v_empresa) or not public.permiso('configurar') then
    raise exception 'No podés renovar el QR de esa mesa.' using errcode = '42501';
  end if;
  update recursos set qr_token = v_token where id = p_recurso;
  return v_token;
end;
$$;


/* ------------------------------------------------------------
   Los pedidos que llegan por QR
   ------------------------------------------------------------
   Uno por envío. Sirve para el tope por mesa y para saber, después,
   cuándo pidió la mesa y cuánto. */

create table pedidos_qr (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  recurso_id  uuid not null references recursos(id) on delete cascade,
  comanda_id  uuid references operaciones(id) on delete set null,
  renglones   integer not null,
  nombre      text,
  creado_en   timestamptz not null default now()
);

create index on pedidos_qr (recurso_id, creado_en desc);

alter table pedidos_qr enable row level security;
revoke insert, update, delete on pedidos_qr from anon, authenticated;
create policy pedidos_qr_ver on pedidos_qr
  for select using (public.puede_ver(empresa_id));


/* ------------------------------------------------------------
   Leer la carta (pública)
   ------------------------------------------------------------
   Solo lo que se puede pedir: activo, con precio y no marcado como
   fuera de la carta (`campos_extra.fuera_de_carta`). Nada de costos. */

create or replace function carta_de_la_mesa(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when r.id is null then null else jsonb_build_object(
    'comercio', e.nombre,
    'mesa', r.nombre,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'nombre', i.nombre, 'descripcion', i.descripcion,
               'categoria', coalesce(nullif(i.categoria, ''), 'Otros'),
               'precio', i.precio, 'imagen', i.imagen)
             order by i.categoria, i.nombre)
        from items i
       where i.empresa_id = e.id and i.activo and i.precio > 0
         and coalesce((i.campos_extra->>'fuera_de_carta')::boolean, false) = false
    ), '[]'::jsonb)
  ) end
  from recursos r
  join empresas e on e.id = r.empresa_id and e.activa
  where r.qr_token = p_token and r.activo and r.tipo = 'mesa';
$$;


/* ------------------------------------------------------------
   Pedir (pública)
   ------------------------------------------------------------
   p_lineas: [{ "item_id": uuid, "cantidad": 1..20, "notas": "sin hielo" }]
   Devuelve cuántos renglones entraron. */

create or replace function pedir_desde_la_mesa(p_token text, p_lineas jsonb, p_nombre text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mesa     recursos%rowtype;
  v_comanda  uuid;
  v_cant     integer;
  v_recientes integer;
  l          jsonb;
  v_item     items%rowtype;
  v_n        integer := 0;
begin
  select r.* into v_mesa from recursos r join empresas e on e.id = r.empresa_id and e.activa
   where r.qr_token = p_token and r.activo and r.tipo = 'mesa';
  if v_mesa.id is null then
    raise exception 'Este QR ya no sirve. Pedile al mozo.' using errcode = 'P0030';
  end if;

  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'El pedido está vacío.' using errcode = 'P0031';
  end if;
  if jsonb_array_length(p_lineas) > 20 then
    raise exception 'Son muchos renglones para un pedido: mandalo en dos.' using errcode = 'P0031';
  end if;

  /* Seis pedidos cada diez minutos por mesa: una mesa de verdad no pide
     más rápido que eso, y un robot que manda pedidos falsos se frena. */
  select count(*) into v_recientes from pedidos_qr
   where recurso_id = coalesce(v_mesa.unida_a, v_mesa.id) and creado_en > now() - interval '10 minutes';
  if v_recientes >= 6 then
    raise exception 'Ya mandaron varios pedidos seguidos. Esperá unos minutos o llamá al mozo.' using errcode = 'P0032';
  end if;

  v_comanda := abrir_comanda(jsonb_build_object(
    'empresa_id', v_mesa.empresa_id, 'sucursal_id', v_mesa.sucursal_id, 'recurso_id', v_mesa.id));

  for l in select * from jsonb_array_elements(p_lineas) loop
    v_cant := coalesce((l->>'cantidad')::integer, 0);
    if v_cant < 1 or v_cant > 20 then
      raise exception 'Cada cosa, de 1 a 20 unidades.' using errcode = 'P0031';
    end if;
    select * into v_item from items
     where id = nullif(l->>'item_id', '')::uuid and empresa_id = v_mesa.empresa_id
       and activo and precio > 0
       and coalesce((campos_extra->>'fuera_de_carta')::boolean, false) = false;
    if v_item.id is null then
      raise exception 'Algo del pedido ya no está en la carta. Actualizá la página.' using errcode = 'P0033';
    end if;
    /* El precio, el costo y la alícuota salen de la base (esta última,
       por renglon_con_su_iva, 0097). BORRADOR: el mozo lo confirma. */
    insert into operacion_lineas (
      operacion_id, empresa_id, item_id, descripcion, cantidad,
      precio_unitario, costo_unitario, total, estado, notas, destino, modificadores, campos_extra
    ) values (
      v_comanda, v_mesa.empresa_id, v_item.id, v_item.nombre, v_cant,
      v_item.precio, coalesce(v_item.costo, 0), round(v_item.precio * v_cant), 'borrador',
      nullif(left(btrim(coalesce(l->>'notas', '')), 140), ''),
      nullif(v_item.campos_extra->>'destino', ''),
      '[]'::jsonb,
      jsonb_build_object('origen', 'qr', 'nombre', nullif(left(btrim(coalesce(p_nombre, '')), 40), ''))
    );
    v_n := v_n + 1;
  end loop;

  insert into pedidos_qr (empresa_id, recurso_id, comanda_id, renglones, nombre)
  values (v_mesa.empresa_id, coalesce(v_mesa.unida_a, v_mesa.id), v_comanda, v_n,
          nullif(left(btrim(coalesce(p_nombre, '')), 40), ''));

  return jsonb_build_object('renglones', v_n);
end;
$$;

revoke all on function carta_de_la_mesa(text) from public;
revoke all on function pedir_desde_la_mesa(text, jsonb, text) from public;
grant execute on function carta_de_la_mesa(text) to anon, authenticated;
grant execute on function pedir_desde_la_mesa(text, jsonb, text) to anon, authenticated;
revoke all on function renovar_qr(uuid) from public, anon;
grant execute on function renovar_qr(uuid) to authenticated;


/* ------------------------------------------------------------
   El salón avisa
   ------------------------------------------------------------
   Cuántos renglones pidió la mesa por QR y todavía no confirmó el mozo.
   Al final de la vista (una vista solo admite columnas nuevas al final);
   el resto, igual que en 0032. */

create or replace view salon_vista
with (security_invoker = true) as
select
  r.id, r.empresa_id, r.sucursal_id, r.tipo, r.nombre,
  r.piso, r.sector, r.capacidad, r.orden, r.activo,
  r.x, r.y, r.ancho, r.alto, r.forma, r.unida_a,

  coalesce(u.unidas, 0) as unidas,
  r.capacidad + coalesce(u.capacidad_extra, 0) as capacidad_total,

  o.id          as comanda_id,
  o.abierta_en,
  o.usuario_id  as abierta_por,
  pf.nombre     as mozo,
  o.comensales,
  o.descuento,
  o.descuento_pct,

  coalesce(l.consumido, 0)  as consumido,
  coalesce(l.items, 0)      as items,
  coalesce(l.sin_enviar, 0) as sin_enviar,
  coalesce(l.en_cocina, 0)  as en_cocina,
  coalesce(l.listos, 0)     as listos,

  coalesce(pg.pagado, 0) as pagado,

  res.id       as reserva_id,
  res.nombre   as reserva_nombre,
  res.personas as reserva_personas,
  res.desde    as reserva_desde,

  case when o.abierta_en is null then null
       else floor(extract(epoch from (now() - o.abierta_en)) / 60)::int
  end as minutos,

  case
    when o.id is not null and coalesce(pg.pagado, 0) > 0
         and coalesce(pg.pagado, 0) >= coalesce(l.consumido, 0) - coalesce(o.descuento, 0)
      then 'cuenta'
    when coalesce(l.listos, 0) > 0 then 'entregar'
    when o.id is not null then 'ocupada'
    when res.id is not null then 'reservada'
    else 'libre'
  end as estado,

  coalesce(l.pedidos_qr, 0) as pedidos_qr

from recursos r

left join (
  select unida_a, count(*) as unidas, sum(capacidad) as capacidad_extra
  from recursos where unida_a is not null group by unida_a
) u on u.unida_a = r.id

left join operaciones o
  on o.recurso_id = r.id and o.estado = 'abierta' and o.tipo = 'comanda'

left join perfiles pf on pf.id = o.usuario_id

left join (
  select
    operacion_id,
    sum(total)                                                 as consumido,
    sum(cantidad)                                              as items,
    count(*) filter (where estado = 'borrador')                as sin_enviar,
    count(*) filter (where estado in ('pedido', 'preparando')) as en_cocina,
    count(*) filter (where estado = 'listo')                   as listos,
    count(*) filter (where estado = 'borrador' and campos_extra->>'origen' = 'qr') as pedidos_qr
  from operacion_lineas
  where estado <> 'anulada'
  group by operacion_id
) l on l.operacion_id = o.id

left join (
  select operacion_id, sum(monto) as pagado from pagos group by operacion_id
) pg on pg.operacion_id = o.id

left join lateral (
  select re.id, re.nombre, re.personas, re.desde
  from reservas re
  where re.recurso_id = r.id
    and re.estado in ('pendiente', 'confirmada')
    and now() >= re.desde - interval '30 minutes'
    and now() <  re.desde + make_interval(mins => re.duracion_min)
  order by re.desde
  limit 1
) res on true;
