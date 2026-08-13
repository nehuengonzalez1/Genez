/* ============================================================
   0019 · DESCUENTO Y COMENSALES
   ============================================================

   El descuento se usa de las dos formas y hay que guardar cuál fue: no
   es lo mismo "diez por ciento" que "dos mil pesos". Si se guardara solo
   el monto, un diez por ciento aplicado antes del postre se quedaría
   viejo apenas la mesa pide algo más.

   Por eso se guarda el porcentaje cuando fue porcentaje, y el monto se
   deriva del subtotal cada vez. Cuando fue un importe fijo se guarda ese
   y no se toca.

   Los comensales van como columna y no adentro de campos_extra porque
   son para mirar rápido cuánta gente hay en el salón y para el ticket
   por persona: se van a contar y a promediar, no solo a mostrar.
   ============================================================ */

alter table operaciones add column comensales integer;
alter table operaciones add column descuento_pct numeric(5,2);

alter table operaciones add constraint operaciones_descuento_pct_valido
  check (descuento_pct is null or (descuento_pct >= 0 and descuento_pct <= 100));

comment on column operaciones.descuento_pct is
  'Si el descuento se pactó en porcentaje, queda acá y el monto se recalcula. Si fue un importe fijo, esto va en nulo.';

/* ------------------------------------------------------------
   Aplicar el descuento

   Devuelve el monto que quedó, para que la pantalla no tenga que
   recalcularlo por su cuenta y arriesgarse a mostrar otro número.
   ------------------------------------------------------------ */

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

  /* Un descuento mayor que la cuenta dejaría un total negativo, o sea
     plata que el negocio le estaría devolviendo a alguien que no pagó. */
  if v_desc > v_sub then
    raise exception 'El descuento no puede ser mayor que la cuenta.' using errcode = 'P0009';
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
  'Descuento por porcentaje o por importe. El porcentaje sigue al subtotal si la mesa pide más.';

/* ------------------------------------------------------------
   Cerrar la comanda honrando el descuento guardado
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

  perform confirmar_operacion(p_comanda, p_sesion, p_pagos);

  return p_comanda;
end;
$$;

/* ------------------------------------------------------------
   El salón cuenta la gente

   Un encargado que mira el plano tiene que poder ver cuánta gente hay
   sentada sin sumar mesa por mesa.
   ------------------------------------------------------------ */

drop view salon_vista;

create view salon_vista
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
  o.comensales,
  o.descuento,
  o.descuento_pct,

  coalesce(l.consumido, 0)  as consumido,
  coalesce(l.items, 0)      as items,
  coalesce(l.sin_enviar, 0) as sin_enviar,
  coalesce(l.en_cocina, 0)  as en_cocina,
  coalesce(l.listos, 0)     as listos,

  case when o.abierta_en is null then null
       else floor(extract(epoch from (now() - o.abierta_en)) / 60)::int
  end as minutos

from recursos r

left join (
  select unida_a, count(*) as unidas, sum(capacidad) as capacidad_extra
  from recursos where unida_a is not null group by unida_a
) u on u.unida_a = r.id

left join operaciones o
  on o.recurso_id = r.id and o.estado = 'abierta' and o.tipo = 'comanda'

left join (
  select
    operacion_id,
    sum(total)                                                 as consumido,
    sum(cantidad)                                              as items,
    count(*) filter (where estado = 'borrador')                as sin_enviar,
    count(*) filter (where estado in ('pedido', 'preparando')) as en_cocina,
    count(*) filter (where estado = 'listo')                   as listos
  from operacion_lineas
  where estado <> 'anulada'
  group by operacion_id
) l on l.operacion_id = o.id;
