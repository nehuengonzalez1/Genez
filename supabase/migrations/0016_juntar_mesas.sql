/* ============================================================
   0016 · JUNTAR Y SEPARAR MESAS
   ============================================================

   Llegan seis personas y no hay mesa de seis: se juntan la 3 y la 4 y se
   atienden como una sola cuenta.

   Se modela con un puntero de una mesa a otra y no con una tabla de
   relación. La razón es que la regla que ya existe —una mesa no puede
   tener dos comandas abiertas— se sostiene sola: la mesa unida no abre
   comanda propia, apunta a la que manda. Con una tabla de relación
   habría dos lugares diciendo quién atiende a quién, y tarde o temprano
   se contradicen.

   Separar es poner el puntero en nulo. Lo consumido no se reparte: quedó
   en la cuenta de la mesa principal, que es donde estuvo siempre.
   ============================================================ */

alter table recursos add column unida_a uuid references recursos(id) on delete set null;

create index on recursos (unida_a) where unida_a is not null;

/* Una mesa unida no puede a su vez tener otras unidas: sin esto se
   arman cadenas donde nadie sabe cuál es la cuenta que manda. */
create or replace function validar_union_de_mesas()
returns trigger
language plpgsql
as $$
begin
  if new.unida_a is null then return new; end if;

  if new.unida_a = new.id then
    raise exception 'Una mesa no se puede unir a sí misma.' using errcode = 'P0005';
  end if;

  if exists (select 1 from recursos where id = new.unida_a and unida_a is not null) then
    raise exception 'Esa mesa ya está unida a otra. Uní a la principal.' using errcode = 'P0006';
  end if;

  if exists (select 1 from recursos where unida_a = new.id) then
    raise exception 'Esta mesa tiene otras unidas. Separalas primero.' using errcode = 'P0007';
  end if;

  /* Con la mesa ocupada, unirla mandaría su consumo al olvido: lo que ya
     pidió no aparecería en ninguna de las dos cuentas. */
  if exists (
    select 1 from operaciones
    where recurso_id = new.id and estado = 'abierta' and tipo = 'comanda'
  ) then
    raise exception 'Esta mesa tiene una cuenta abierta. Cobrala antes de unirla.' using errcode = 'P0008';
  end if;

  return new;
end;
$$;

create trigger recursos_validar_union
  before insert or update of unida_a on recursos
  for each row execute function validar_union_de_mesas();

/* ------------------------------------------------------------
   El salón, ahora con las uniones
   ------------------------------------------------------------ */

drop view salon_vista;

create view salon_vista
with (security_invoker = true) as
select
  r.id, r.empresa_id, r.sucursal_id, r.tipo, r.nombre,
  r.piso, r.sector, r.capacidad, r.orden, r.activo,
  r.x, r.y, r.ancho, r.alto, r.forma,
  r.unida_a,

  /* Cuántas mesas se le sumaron y para cuánta gente quedó. Lo que se
     muestra en el plano es la mesa que manda, con la capacidad de
     todas. */
  coalesce(u.unidas, 0)     as unidas,
  r.capacidad + coalesce(u.capacidad_extra, 0) as capacidad_total,

  o.id         as comanda_id,
  o.abierta_en,
  o.usuario_id as abierta_por,

  coalesce(l.consumido, 0) as consumido,
  coalesce(l.items, 0)     as items,
  coalesce(l.en_cocina, 0) as en_cocina,
  coalesce(l.listos, 0)    as listos,

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
    count(*) filter (where estado in ('pedido', 'preparando')) as en_cocina,
    count(*) filter (where estado = 'listo')                   as listos
  from operacion_lineas
  where estado <> 'anulada'
  group by operacion_id
) l on l.operacion_id = o.id;

comment on view salon_vista is
  'Cada mesa con su lugar en el plano, con quién está unida, su comanda abierta y lo que espera en cocina.';

/* Abrir la comanda de una mesa unida abre la de la principal: quien toca
   la 4 sabiendo que está pegada a la 3 espera ver esa cuenta, no abrir
   una segunda. */
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

  if v_recurso is not null then
    select coalesce(unida_a, id) into v_recurso from recursos where id = v_recurso;

    select id into v_abierta from operaciones
    where recurso_id = v_recurso and estado = 'abierta' and empresa_id = v_empresa;
    if v_abierta is not null then return v_abierta; end if;
  end if;

  insert into operaciones (
    id, empresa_id, sucursal_id, tipo, estado, fecha, recurso_id,
    canal, referencia, abierta_en, usuario_id, cliente_id, campos_extra
  ) values (
    v_id, v_empresa,
    nullif(datos->>'sucursal_id', '')::uuid,
    'comanda', 'abierta', now(), v_recurso,
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

/* ------------------------------------------------------------
   Unir y separar
   ------------------------------------------------------------ */

create or replace function unir_mesas(principal uuid, secundaria uuid)
returns void
language plpgsql
as $$
begin
  update recursos set unida_a = principal where id = secundaria;
  if not found then
    raise exception 'No se encontró la mesa que se quiere unir.';
  end if;
end;
$$;

create or replace function separar_mesa(mesa uuid)
returns void
language plpgsql
as $$
begin
  /* Separar la principal suelta a todas las que le colgaban. Separar una
     secundaria suelta solo a esa. */
  update recursos set unida_a = null where id = mesa or unida_a = mesa;
end;
$$;
