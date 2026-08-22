/* ============================================================
   0021 · EL PEDIDO TIENE ESTADO PROPIO, Y QUEDA ESCRITO
   ============================================================

   Hasta acá la etapa de un pedido se deducía mirando sus líneas: si
   todas estaban listas, el pedido estaba listo. Eso alcanzaba para una
   mesa y no alcanza para un centro de pedidos, por tres motivos.

   Uno: hay estados que las líneas no pueden expresar. Un delivery
   despachado tiene todas sus líneas listas hace rato; lo que cambió es
   que salió a la calle. "En camino" no existía, y un pedido cancelado
   tampoco.

   Dos: deducir no deja rastro. Para saber cuánto tarda la cocina hay que
   saber cuándo empezó y cuándo terminó, y eso no está en ningún lado si
   el estado se recalcula cada vez que alguien mira la pantalla.

   Tres: el flujo depende del canal, y las líneas no saben de qué canal
   son. Los estados válidos salen de `canales.flujo` (ver 0020): el mismo
   motor sirve para un pedido de mostrador de cuatro etapas y para uno de
   aplicación de cinco, y para el que se invente después.

   La transición se escribe sola, con un disparador, por la misma razón
   que la bitácora: si dependiera de que cada pantalla se acuerde,
   alcanzaría una que se olvide para que la medición deje de servir.
   ============================================================ */

alter table operaciones add column estado_pedido text;

alter table operaciones add constraint operaciones_estado_pedido_valido check (
  estado_pedido is null or estado_pedido in
    ('pendiente', 'en_preparacion', 'listo', 'en_camino', 'completado', 'cancelado')
);

create index on operaciones (empresa_id, estado_pedido)
  where estado_pedido is not null and estado_pedido <> 'completado';

comment on column operaciones.estado_pedido is
  'Dónde está el pedido en su recorrido. Los estados posibles de cada canal salen de canales.flujo.';

/* Quién tocó esto por última vez. La creación ya estaba —usuario_id y
   creada_en—, faltaba la otra mitad. Lo escribe un disparador para que
   valga también para lo que cambie desde una función o desde otro
   equipo. */
alter table operaciones add column actualizada_en  timestamptz;
alter table operaciones add column actualizada_por uuid references perfiles(id) on delete set null;

create or replace function tocar_operacion()
returns trigger language plpgsql as $$
begin
  new.actualizada_en  := now();
  new.actualizada_por := coalesce(auth.uid(), new.actualizada_por);
  return new;
end;
$$;

create trigger operaciones_actualizada
  before update on operaciones
  for each row execute function tocar_operacion();

/* ------------------------------------------------------------
   El historial

   Una fila por transición: de dónde venía, a dónde fue, quién y cuándo.
   Es de donde salen todos los tiempos —preparación, entrega, espera— sin
   guardar ni un promedio calculado, que se desactualiza solo.

   Igual que la bitácora, admite insertar y leer y nada más. Un historial
   que se puede editar no prueba nada.
   ------------------------------------------------------------ */

create table pedido_estados (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  operacion_id uuid not null references operaciones(id) on delete cascade,
  estado       text not null,
  anterior     text,
  motivo       text,
  usuario_id   uuid references perfiles(id) on delete set null,
  fecha        timestamptz not null default now()
);

create index on pedido_estados (operacion_id, fecha);
create index on pedido_estados (empresa_id, estado, fecha desc);

alter table pedido_estados enable row level security;

create policy pedido_estados_ver on pedido_estados
  for select using (public.puede_ver(empresa_id));

create policy pedido_estados_escribir on pedido_estados
  for insert with check (public.puede_ver(empresa_id));

comment on table pedido_estados is
  'Cada cambio de estado de un pedido. Solo se inserta y se lee: es la medición, no un borrador.';

/* El motivo de la cancelación viaja en una variable de sesión porque el
   disparador no puede recibir parámetros. La pone `mover_pedido` y dura
   lo que dura la transacción. */
create or replace function registrar_estado_pedido()
returns trigger
language plpgsql
as $$
declare
  v_anterior text := case when tg_op = 'UPDATE' then old.estado_pedido else null end;
  v_motivo   text := nullif(current_setting('genez.motivo_pedido', true), '');
begin
  if new.estado_pedido is null then return new; end if;
  if tg_op = 'UPDATE' and new.estado_pedido is not distinct from old.estado_pedido then
    return new;
  end if;

  insert into pedido_estados (empresa_id, operacion_id, estado, anterior, motivo, usuario_id)
    values (new.empresa_id, new.id, new.estado_pedido, v_anterior, v_motivo, auth.uid());

  /* La bitácora contesta "quién hizo qué" para todo el sistema; el
     historial contesta "cuánto tardó" para un pedido. Se anota en las
     dos, pero en la bitácora solo lo que alguien decidió: la apertura
     del pedido ya queda como operación. */
  if v_anterior is not null then
    insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
      values (new.empresa_id, auth.uid(), 'pedido.estado', 'operaciones', new.id,
              jsonb_build_object('de', v_anterior, 'a', new.estado_pedido,
                                 'canal', new.canal, 'motivo', v_motivo));
  end if;

  return new;
end;
$$;

create trigger operaciones_estado_pedido
  after insert or update of estado_pedido on operaciones
  for each row execute function registrar_estado_pedido();

/* ------------------------------------------------------------
   Lo que ya estaba

   Los pedidos abiertos toman el estado que hasta ahora se deducía de sus
   líneas, y los cobrados quedan completados. El historial arranca con
   una fila por pedido: no se puede inventar cuándo pasó por cada etapa,
   pero sí desde cuándo está donde está.
   ------------------------------------------------------------ */

update operaciones o
   set estado_pedido = case
     when o.estado = 'confirmada' then 'completado'
     when exists (select 1 from operacion_lineas l
                   where l.operacion_id = o.id and l.estado not in ('anulada', 'listo', 'entregado'))
       then case when exists (select 1 from operacion_lineas l
                               where l.operacion_id = o.id and l.estado = 'preparando')
                 then 'en_preparacion' else 'pendiente' end
     when exists (select 1 from operacion_lineas l
                   where l.operacion_id = o.id and l.estado in ('listo', 'entregado'))
       then 'listo'
     else 'pendiente'
   end
 where o.tipo = 'comanda';

insert into pedido_estados (empresa_id, operacion_id, estado, fecha)
select o.empresa_id, o.id, o.estado_pedido,
       coalesce(o.cerrada_en, o.abierta_en, o.fecha)
  from operaciones o
 where o.tipo = 'comanda'
   and o.estado_pedido is not null
   and not exists (select 1 from pedido_estados h where h.operacion_id = o.id);

/* ------------------------------------------------------------
   Abrir y cerrar, con estado

   Un pedido nace pendiente y muere completado. La segunda mitad va en
   `cerrar_comanda` y no en una llamada aparte porque completar un pedido
   es cobrarlo: el estado y la venta tienen que moverse juntos o no
   moverse.
   ------------------------------------------------------------ */

create or replace function abrir_comanda(datos jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id      uuid := coalesce(nullif(datos->>'id', '')::uuid, gen_random_uuid());
  v_empresa uuid := (datos->>'empresa_id')::uuid;
  v_recurso uuid := nullif(datos->>'recurso_id', '')::uuid;
  v_canal   text := coalesce(nullif(datos->>'canal', ''), case when nullif(datos->>'recurso_id', '') is null then 'mostrador' else 'salon' end);
  v_abierta uuid;
begin
  if v_empresa is null then
    raise exception 'La comanda necesita empresa_id.';
  end if;

  /* Si la mesa ya tiene una comanda abierta se devuelve esa. Tocar dos
     veces la misma mesa es lo más normal del mundo y no puede terminar
     en dos cuentas paralelas.

     Con los pedidos sin mesa pasa al revés: dos personas distintas en el
     mostrador son dos pedidos, aunque lleguen con un segundo de
     diferencia. Por eso solo se reutiliza cuando hay recurso. */
  if v_recurso is not null then
    /* Una mesa unida no abre cuenta propia: la cuenta es la de la mesa
       que manda (ver 0016). */
    select coalesce(unida_a, id) into v_recurso from recursos where id = v_recurso;

    select id into v_abierta from operaciones
    where recurso_id = v_recurso and estado = 'abierta' and empresa_id = v_empresa;
    if v_abierta is not null then return v_abierta; end if;
  end if;

  insert into operaciones (
    id, empresa_id, sucursal_id, tipo, estado, estado_pedido, fecha, recurso_id,
    canal, referencia, abierta_en, usuario_id, cliente_id, campos_extra
  ) values (
    v_id, v_empresa,
    nullif(datos->>'sucursal_id', '')::uuid,
    'comanda', 'abierta', 'pendiente', now(), v_recurso,
    v_canal,
    nullif(datos->>'referencia', ''),
    now(), auth.uid(),
    nullif(datos->>'cliente_id', '')::uuid,
    coalesce(datos->'campos_extra', '{}'::jsonb)
  )
  on conflict (id) do nothing;

  return v_id;
end;
$$;

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
  v_sub  numeric;
  v_pct  numeric;
  v_desc numeric;
begin
  select coalesce(sum(l.total), 0) into v_sub
  from operacion_lineas l
  where l.operacion_id = p_comanda and l.estado <> 'anulada';

  select o.descuento_pct into v_pct from operaciones o where o.id = p_comanda;

  /* Lo que mande quien llama pisa lo guardado; si no manda nada, vale el
     descuento que ya tenía la comanda. Un porcentaje se recalcula contra
     el subtotal de ahora, que puede haber cambiado desde que se pactó. */
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

  /* Lo que la cocina no llegó a marcar queda entregado igual: el pedido
     se está cobrando, o sea que salió. Sin esto, un mostrador rápido
     —donde nadie toca la pantalla de cocina— deja para siempre líneas
     esperando en un tablero que ya no mira nadie. */
  update operacion_lineas
     set estado = 'entregado'
   where operacion_id = p_comanda and estado in ('borrador', 'pedido', 'preparando', 'listo');

  perform confirmar_operacion(p_comanda, p_sesion, p_pagos);

  return p_comanda;
end;
$$;

/* ------------------------------------------------------------
   Mover el pedido

   Una sola puerta para cambiar de estado, con las tres cosas que tienen
   que pasar juntas o no pasar: validar contra el flujo del canal, mover
   las líneas que correspondan, y dejar el rastro. Repartido en llamadas
   sueltas desde el navegador, un corte de conexión en el medio deja un
   pedido "listo" que la cocina sigue viendo pendiente.
   ------------------------------------------------------------ */

create or replace function mover_pedido(
  p_pedido uuid,
  p_estado text,
  p_motivo text default null
)
returns text
language plpgsql
as $$
declare
  v_op      operaciones%rowtype;
  v_flujo   text[];
  v_canal   text;
  v_actual  text;
begin
  select * into v_op from operaciones where id = p_pedido for update;

  if v_op.id is null then
    raise exception 'No existe ese pedido.' using errcode = 'P0010';
  end if;
  if v_op.tipo <> 'comanda' then
    raise exception 'Eso no es un pedido.' using errcode = 'P0010';
  end if;

  select c.flujo, c.nombre into v_flujo, v_canal
  from canales c where c.empresa_id = v_op.empresa_id and c.clave = v_op.canal;

  v_actual := coalesce(v_op.estado_pedido, 'pendiente');

  if v_actual = p_estado then
    return v_actual;
  end if;

  if v_actual in ('completado', 'cancelado') then
    raise exception 'Ese pedido ya está cerrado.' using errcode = 'P0011';
  end if;

  /* Completar es cobrar, y cobrar tiene sus propias reglas —caja
     abierta, stock, numeración— que viven en cerrar_comanda. Si se
     pudiera completar desde acá habría dos formas de terminar un pedido
     y una de ellas no dejaría plata en ninguna caja. */
  if p_estado = 'completado' then
    raise exception 'Un pedido se completa cobrándolo.' using errcode = 'P0012';
  end if;

  if p_estado <> 'cancelado' and array_position(v_flujo, p_estado) is null then
    raise exception 'Un pedido de % no pasa por ese estado.', coalesce(v_canal, v_op.canal)
      using errcode = 'P0013';
  end if;

  /* El motivo lo levanta el disparador que escribe el historial: no
     puede recibir parámetros, y hacerlo dos veces —una acá y otra en el
     disparador— abriría la puerta a que queden distintos. */
  perform set_config('genez.motivo_pedido', coalesce(p_motivo, ''), true);

  if p_estado = 'cancelado' then
    update operaciones
       set estado_pedido = 'cancelado', estado = 'cancelada', cerrada_en = now()
     where id = p_pedido;

    /* Las líneas se anulan, no se borran: alguien las pidió y capaz se
       cocinaron. Los totales y el stock ya las ignoran. */
    update operacion_lineas set estado = 'anulada'
     where operacion_id = p_pedido and estado <> 'anulada';

  else
    update operaciones set estado_pedido = p_estado where id = p_pedido;

    if p_estado = 'en_preparacion' then
      /* Poner un pedido en preparación es mandarlo a la cocina. Que sean
         dos actos distintos era la forma más fácil de que la plancha se
         entere veinte minutos tarde. */
      perform enviar_a_cocina(p_pedido);
      update operacion_lineas set estado = 'preparando', enviada_en = coalesce(enviada_en, now())
       where operacion_id = p_pedido and estado = 'pedido';

    elsif p_estado = 'listo' then
      update operacion_lineas set estado = 'listo', lista_en = now()
       where operacion_id = p_pedido and estado in ('borrador', 'pedido', 'preparando');
    end if;
  end if;

  perform set_config('genez.motivo_pedido', '', true);
  return p_estado;
end;
$$;

comment on function mover_pedido is
  'La única puerta para cambiar el estado de un pedido: valida contra el flujo del canal, mueve las líneas y deja historial.';

/* ------------------------------------------------------------
   El tablero, en una sola consulta

   Todo lo que muestra una tarjeta —canal, cliente, platos, total, hace
   cuánto que está donde está— sale de acá. Con esto el tablero es una
   lectura y no doce: con veinte pedidos en pantalla, pedir las líneas
   por separado es pedir veintiuna cosas cada vez que entra un pedido.
   ------------------------------------------------------------ */

create view pedidos_vista
with (security_invoker = true) as
select
  o.id, o.empresa_id, o.sucursal_id,
  o.estado, o.estado_pedido, o.numero, o.referencia,

  o.canal, c.nombre as canal_nombre, c.familia, c.color, c.icono,
  c.flujo, c.externo,

  o.fecha, o.abierta_en, o.cerrada_en, o.actualizada_en,
  o.recurso_id, r.nombre as mesa, r.sector,
  o.cliente_id,
  coalesce(cl.razon_social, o.campos_extra->'cliente'->>'nombre')   as cliente_nombre,
  coalesce(cl.tel,          o.campos_extra->'cliente'->>'telefono') as cliente_tel,
  coalesce(cl.domicilio,    o.campos_extra->'cliente'->>'domicilio') as cliente_domicilio,
  o.usuario_id, pf.nombre as usuario_nombre,
  o.comensales, o.descuento, o.descuento_pct, o.recargo, o.campos_extra,

  coalesce(l.subtotal, 0)  as subtotal,
  coalesce(l.items, 0)     as items,
  coalesce(l.renglones, 0) as renglones,
  coalesce(l.sin_enviar, 0) as sin_enviar,
  coalesce(l.en_cocina, 0)  as en_cocina,
  coalesce(l.listos, 0)     as listos,
  coalesce(l.detalle, '[]'::jsonb) as detalle,

  /* Una comanda abierta todavía no tiene total guardado: se arma con lo
     cargado hasta ahora, con el descuento pactado aplicado igual que lo
     hace cerrar_comanda. Una cobrada muestra lo que se cobró. */
  case when o.estado in ('confirmada', 'cancelada') then o.total
       else coalesce(l.subtotal, 0)
            - case when o.descuento_pct is not null
                   then round(coalesce(l.subtotal, 0) * o.descuento_pct / 100)
                   else coalesce(o.descuento, 0) end
            + coalesce(o.recargo, 0)
  end as total,

  h.fecha as estado_desde,
  floor(extract(epoch from (now() - coalesce(o.abierta_en, o.fecha))) / 60)::int as minutos,
  floor(extract(epoch from (now() - coalesce(h.fecha, o.abierta_en, o.fecha))) / 60)::int as minutos_estado

from operaciones o

join canales c on c.empresa_id = o.empresa_id and c.clave = o.canal
left join recursos r on r.id = o.recurso_id
left join clientes cl on cl.id = o.cliente_id
left join perfiles pf on pf.id = o.usuario_id

left join (
  select
    operacion_id,
    sum(total)                                                 as subtotal,
    sum(cantidad)                                              as items,
    count(*)                                                   as renglones,
    count(*) filter (where estado = 'borrador')                as sin_enviar,
    count(*) filter (where estado in ('pedido', 'preparando')) as en_cocina,
    count(*) filter (where estado = 'listo')                   as listos,
    jsonb_agg(jsonb_build_object(
      'id', id, 'nombre', descripcion, 'cantidad', cantidad,
      'estado', estado, 'total', total, 'notas', notas,
      'modificadores', modificadores
    ) order by descripcion) as detalle
  from operacion_lineas
  where estado <> 'anulada'
  group by operacion_id
) l on l.operacion_id = o.id

left join lateral (
  select pe.fecha from pedido_estados pe
   where pe.operacion_id = o.id and pe.estado = o.estado_pedido
   order by pe.fecha desc limit 1
) h on true

where o.tipo = 'comanda';

comment on view pedidos_vista is
  'Cada pedido con su canal, su cliente, sus platos y hace cuánto que está donde está. Es lo que dibuja el tablero.';

/* ------------------------------------------------------------
   Las estadísticas

   Los tiempos salen del historial y no de columnas guardadas: un
   promedio guardado queda viejo apenas se corrige un pedido, y no se
   puede recalcular hacia atrás.

   La hora del día se cuenta en hora argentina. En UTC, el pico de las
   nueve de la noche aparece a la medianoche y el informe no significa
   nada para quien atiende el local.
   ------------------------------------------------------------ */

create or replace function estadisticas_pedidos(
  p_empresa uuid,
  p_desde   timestamptz,
  p_hasta   timestamptz
)
returns jsonb
language sql
stable
as $$
with ped as (
  select o.id, o.canal, o.estado_pedido, o.total, o.fecha,
         c.nombre as canal_nombre, c.color, c.familia
  from operaciones o
  join canales c on c.empresa_id = o.empresa_id and c.clave = o.canal
  where o.empresa_id = p_empresa
    and o.tipo = 'comanda'
    and c.familia <> 'salon'
    and o.fecha >= p_desde and o.fecha < p_hasta
),
tiempos as (
  select h.operacion_id,
    min(h.fecha) filter (where h.estado = 'pendiente')      as t_alta,
    min(h.fecha) filter (where h.estado = 'en_preparacion') as t_prep,
    min(h.fecha) filter (where h.estado = 'listo')          as t_listo,
    min(h.fecha) filter (where h.estado = 'completado')     as t_fin
  from pedido_estados h
  join ped on ped.id = h.operacion_id
  group by h.operacion_id
),
canal as (
  select p.canal, p.canal_nombre, p.color,
         count(*) as pedidos,
         coalesce(sum(p.total) filter (where p.estado_pedido = 'completado'), 0) as ventas
  from ped p group by p.canal, p.canal_nombre, p.color
),
hora as (
  select extract(hour from (p.fecha at time zone 'America/Argentina/Buenos_Aires'))::int as hora,
         count(*) as pedidos,
         coalesce(sum(p.total) filter (where p.estado_pedido = 'completado'), 0) as ventas
  from ped p group by 1
),
dia as (
  select (p.fecha at time zone 'America/Argentina/Buenos_Aires')::date as dia,
         count(*) as pedidos,
         coalesce(sum(p.total) filter (where p.estado_pedido = 'completado'), 0) as ventas
  from ped p group by 1
)
select jsonb_build_object(
  'pedidos',     (select count(*) from ped),
  'completados', (select count(*) from ped where estado_pedido = 'completado'),
  'cancelados',  (select count(*) from ped where estado_pedido = 'cancelado'),
  'activos',     (select count(*) from ped where estado_pedido not in ('completado', 'cancelado')),
  'ventas',      (select coalesce(sum(total), 0) from ped where estado_pedido = 'completado'),
  'ticket',      (select coalesce(round(avg(total)), 0) from ped where estado_pedido = 'completado'),

  'minutos_preparacion', (select round(avg(extract(epoch from (t_listo - t_prep)) / 60))
                            from tiempos where t_prep is not null and t_listo is not null),
  'minutos_entrega',     (select round(avg(extract(epoch from (t_fin - t_listo)) / 60))
                            from tiempos where t_listo is not null and t_fin is not null),
  'minutos_total',       (select round(avg(extract(epoch from (t_fin - t_alta)) / 60))
                            from tiempos where t_alta is not null and t_fin is not null),

  'por_canal', (select coalesce(jsonb_agg(jsonb_build_object(
                  'canal', canal, 'nombre', canal_nombre, 'color', color,
                  'pedidos', pedidos, 'ventas', ventas) order by ventas desc, pedidos desc), '[]'::jsonb) from canal),
  'por_hora',  (select coalesce(jsonb_agg(jsonb_build_object(
                  'hora', hora, 'pedidos', pedidos, 'ventas', ventas) order by hora), '[]'::jsonb) from hora),
  'por_dia',   (select coalesce(jsonb_agg(jsonb_build_object(
                  'dia', dia, 'pedidos', pedidos, 'ventas', ventas) order by dia), '[]'::jsonb) from dia)
);
$$;

comment on function estadisticas_pedidos is
  'Pedidos, ventas, ticket, tiempos y evolución de un período. Los tiempos salen del historial de estados.';
