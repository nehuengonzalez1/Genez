/* ============================================================
   0076 · RECETAS Y PRODUCCIÓN POR LOTES
   ============================================================

   Para quien fabrica y no solo revende: una pastelería no compra
   "docena de facturas", la produce a partir de harina, manteca y
   azúcar. El costo de esa docena no se carga a mano — se calcula desde
   lo que entra en la receta, con el costo real de cada insumo.

   COMPARTE LA BASE DE COSTOS CON LA CALCULADORA DE SANITARIOS (0074/#75)
   ------------------------------------------------------------------------
   `items.costo` ya es, desde ahora, un precio promedio ponderado: se
   recalcula solo cada vez que entra una compra (ver `registrarCompra` en
   el cliente). `costo_receta()` no inventa una segunda forma de calcular
   costo: multiplica cantidad de cada insumo por SU costo (que ya es
   PPP) y suma. Producir un lote hace lo mismo que una venta le hace al
   stock del insumo, y lo mismo que una compra le hace al costo del
   producto final —consumir, y promediar—, así que no hizo falta
   ninguna función nueva de bajo nivel: 0076 solo agrupa esos dos
   movimientos en un caso más, "producción".

   POR QUÉ DOS TABLAS Y NO `campos_extra`
   ----------------------------------------
   Una receta tiene una cantidad variable de insumos, y cada insumo es
   en sí mismo un item con su propio costo que cambia solo. Guardarlo
   en un jsonb significaría no poder preguntarle a la base "¿qué
   productos usan harina?", ni que el costo de la receta se recalcule
   solo cuando cambia el costo de la harina — hay que poder unir contra
   `items`. */

alter table movimientos_stock drop constraint movimientos_stock_tipo_valido;
alter table movimientos_stock add constraint movimientos_stock_tipo_valido check (
  tipo in ('venta', 'compra', 'ajuste', 'merma', 'devolucion', 'transferencia', 'inicial',
           'produccion_consumo', 'produccion_alta')
);

create table recetas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  nombre      text not null,
  tamano_lote numeric(14,3) not null check (tamano_lote > 0),
  activa      boolean not null default true,
  creada_en   timestamptz not null default now()
);

comment on table recetas is
  'El producto final y en qué cantidad sale por lote — "una docena", "un balde de 5kg". El costo no se guarda acá: se calcula.';
comment on column recetas.tamano_lote is
  'Cuántas unidades de venta salen de un lote (ej: 12 facturas). producir_lote() multiplica esto por la cantidad de lotes.';

create index on recetas (empresa_id, item_id);

create table receta_insumos (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  receta_id  uuid not null references recetas(id) on delete cascade,
  item_id    uuid not null references items(id) on delete restrict,
  cantidad   numeric(14,3) not null check (cantidad > 0)
);

comment on column receta_insumos.cantidad is
  'Por UN lote (no por unidad de venta ni por docena de lotes): 1kg de harina por docena, no 83g por factura.';

create index on receta_insumos (empresa_id, receta_id);

alter table recetas enable row level security;
alter table receta_insumos enable row level security;

create policy recetas_todo on recetas
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

create policy receta_insumos_todo on receta_insumos
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ------------------------------------------------------------
   Costo de un lote y de la unidad de venta que sale de él, sumando el
   costo (PPP) de cada insumo a la cantidad que la receta pide.
   ------------------------------------------------------------ */
create or replace function costo_receta(p_receta uuid)
returns table (costo_lote numeric, costo_unidad numeric, insumos_sin_costo integer)
language sql
stable
as $$
  select
    coalesce(sum(ri.cantidad * i.costo), 0) as costo_lote,
    coalesce(sum(ri.cantidad * i.costo), 0) / r.tamano_lote as costo_unidad,
    count(*) filter (where coalesce(i.costo, 0) = 0)::integer as insumos_sin_costo
  from recetas r
  join receta_insumos ri on ri.receta_id = r.id
  join items i on i.id = ri.item_id
  where r.id = p_receta
  group by r.tamano_lote
$$;

comment on function costo_receta(uuid) is
  'Costo del lote y de la unidad de venta, sumando el costo (ya ponderado) de cada insumo. insumos_sin_costo avisa si alguno todavía no tiene costo cargado.';

/* ------------------------------------------------------------
   Producir p_lotes lotes de una receta: consume el stock de cada
   insumo (proporcional a p_lotes), promedia el costo del producto
   final con lo que costó producir este lote, y da de alta su stock.

   Sin transacción explícita porque cada `insert` ya corre dentro de la
   transacción implícita de la función — si algo falla a mitad, Postgres
   deshace todo, ningún insumo queda consumido sin su producto dado de
   alta.
   ------------------------------------------------------------ */
create or replace function producir_lote(
  p_receta    uuid,
  p_sucursal  uuid,
  p_lotes     numeric default 1
)
returns void
language plpgsql
as $$
declare
  v_empresa       uuid;
  v_item_final    uuid;
  v_tamano_lote   numeric;
  v_costo_lote    numeric;
  v_cantidad_final numeric;
  v_stock_previo  numeric;
  v_costo_previo  numeric;
  v_costo_nuevo   numeric;
  ins             record;
begin
  if p_lotes <= 0 then
    raise exception 'La cantidad de lotes tiene que ser mayor a cero.';
  end if;

  select r.empresa_id, r.item_id, r.tamano_lote
    into v_empresa, v_item_final, v_tamano_lote
  from recetas r where r.id = p_receta and r.activa;

  if v_empresa is null then
    raise exception 'Esa receta no existe o está de baja.';
  end if;

  /* Consumir cada insumo. Si a alguno no le alcanza el stock, la
     excepción deshace todo lo anterior: no hay una producción "a
     medias" con la mitad de los insumos ya descontados. */
  for ins in
    select ri.item_id, ri.cantidad * p_lotes as cantidad
    from receta_insumos ri where ri.receta_id = p_receta
  loop
    if (select stock from items_vista where id = ins.item_id) < ins.cantidad then
      raise exception 'No alcanza el stock de un insumo para producir % lote(s).', p_lotes
        using errcode = 'P0004';
    end if;

    insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, motivo)
    values (v_empresa, p_sucursal, ins.item_id, -ins.cantidad, 'produccion_consumo',
            'Producción de receta');
  end loop;

  /* El costo de este lote, con el costo (PPP) de cada insumo AL MOMENTO
     de producir — si se consulta después de haber restado el stock de
     arriba no cambia nada, el costo de un item no depende de su stock. */
  select cl.costo_lote * p_lotes into v_costo_lote from costo_receta(p_receta) cl;
  v_cantidad_final := v_tamano_lote * p_lotes;

  select stock, costo into v_stock_previo, v_costo_previo
  from items_vista where id = v_item_final;

  /* Mismo promedio ponderado que una compra: lo que había, más lo que
     entra, pesado por cantidad. Si no había nada todavía, el costo es
     directamente el de este lote. */
  v_costo_nuevo := case
    when coalesce(v_stock_previo, 0) + v_cantidad_final > 0
      then (coalesce(v_stock_previo, 0) * coalesce(v_costo_previo, 0) + v_costo_lote) / (coalesce(v_stock_previo, 0) + v_cantidad_final)
    else v_costo_previo
  end;

  update items set costo = round(v_costo_nuevo, 2) where id = v_item_final;

  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, motivo)
  values (v_empresa, p_sucursal, v_item_final, v_cantidad_final, 'produccion_alta',
          'Producción: ' || p_lotes || ' lote(s)');
end;
$$;

comment on function producir_lote(uuid, uuid, numeric) is
  'Consume los insumos de una receta, promedia el costo del producto final y da de alta su stock. Falla entero si falta algún insumo.';
