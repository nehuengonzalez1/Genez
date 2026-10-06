-- ============================================================
-- 0134 · Quiebres de stock y venta perdida
-- ============================================================
--
-- Lo pidió Nehuen el 06/10, de la lista de reportería: qué productos se
-- quedaron sin stock, cuántos días, y cuánto se dejó de vender por eso.
--
-- No hay una foto diaria del stock, y no hace falta: el stock de un
-- producto es la suma de sus movimientos (items_vista), y cada movimiento
-- tiene fecha. El stock al cierre de cualquier día es la suma de los
-- movimientos hasta ese día. Así el informe tiene historia desde el primer
-- movimiento, en vez de empezar a juntarla hoy.
--
-- Lo que se cuida:
--
-- - Solo cuenta desde que el stock se cargó: el primer movimiento que no
--   es una venta ni una devolución (inicial, compra, ajuste…). Antes de eso
--   el "stock" es solo la suma de lo vendido, negativo, y diría que el
--   producto estuvo siempre en falta. Es el mismo criterio que
--   stock_cargado en items_vista (0110).
--
-- - Un día sin stock es uno que arrancó y terminó en cero o menos, y sin
--   ventas. El día que se agota no cuenta: se vendió hasta que se terminó.
--   Si hubo ventas con el stock en cero, el producto estaba en la góndola
--   y lo que estaba mal era el número: eso se devuelve aparte
--   (dias_vendiendo_en_cero), para que se corrija el conteo, y no se suma
--   como venta perdida.
--
-- - La venta de un día normal sale de los días en que hubo stock en los 30
--   días hasta el final del período: unidades vendidas / días con stock.
--   Promediar con los días en falta la achicaría justo por el quiebre.
--
-- security invoker: lee movimientos_stock e items con las políticas de
-- quien la llama. Sin acceso al comercio, devuelve vacío.
-- ============================================================

create or replace function public.quiebres_de_stock(p_empresa uuid, p_desde date, p_hasta date)
returns table (
  item_id                 uuid,
  dias_sin_stock          int,
  dias_contados           int,
  dias_vendiendo_en_cero  int,
  venta_diaria            numeric,
  unidades_perdidas       numeric,
  sin_stock_desde         date,
  stock                   numeric
)
language sql
stable
security invoker
set search_path to 'public'
as $$
  with
  hoy as (select (now() at time zone 'America/Argentina/Buenos_Aires')::date as d),
  fin as (select least(p_hasta, (select d from hoy)) as d),
  /* Los movimientos por producto y día de Buenos Aires. */
  mov as (
    select m.item_id,
           (m.fecha at time zone 'America/Argentina/Buenos_Aires')::date as dia,
           sum(m.cantidad) as neto,
           -sum(m.cantidad) filter (where m.tipo in ('venta', 'devolucion')) as vendidas,
           bool_or(m.tipo not in ('venta', 'devolucion')) as carga
      from movimientos_stock m
      join items i on i.id = m.item_id
     where m.empresa_id = p_empresa
       and i.controla_stock and i.activo
       and m.fecha < ((select d from fin) + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'
     group by 1, 2
  ),
  cargado as (
    select item_id, min(dia) filter (where carga) as desde from mov group by 1
  ),
  /* Cada día desde que se cargó (o desde 30 días antes del final, para
     tener de dónde sacar la venta normal) hasta el final del período. */
  dias as (
    select c.item_id, g.dia::date as dia, g.dia::date = min(g.dia::date) over (partition by c.item_id) as primero
      from cargado c,
           generate_series(greatest(c.desde, least(p_desde, (select d from fin) - 29)), (select d from fin), interval '1 day') g(dia)
     where c.desde is not null
  ),
  /* El stock al cierre de cada día: lo que había antes del primer día de
     la ventana más la suma acumulada de los movimientos desde ahí. */
  saldo as (
    select d.item_id, d.dia,
           coalesce(mv.vendidas, 0) as vendidas,
           sum(coalesce(mv.neto, 0) + case when d.primero then
                 (select coalesce(sum(x.neto), 0) from mov x where x.item_id = d.item_id and x.dia < d.dia) else 0 end)
             over (partition by d.item_id order by d.dia) as cierre
      from dias d
      left join mov mv on mv.item_id = d.item_id and mv.dia = d.dia
  ),
  dia_a_dia as (
    select s.*,
           s.cierre - coalesce((select mv.neto from mov mv where mv.item_id = s.item_id and mv.dia = s.dia), 0) as apertura
      from saldo s
  ),
  marcado as (
    select d.*,
           (d.apertura <= 0 and d.cierre <= 0 and d.vendidas <= 0) as en_falta,
           (d.apertura <= 0 and d.cierre <= 0 and d.vendidas > 0) as en_cero_vendiendo,
           (d.dia >= p_desde) as en_periodo
      from dia_a_dia d
  ),
  ritmo as (
    select item_id,
           sum(vendidas) filter (where not en_falta and not en_cero_vendiendo) as vendidas,
           count(*) filter (where not en_falta and not en_cero_vendiendo) as dias
      from marcado
     group by 1
  ),
  /* Desde cuándo está en falta, si todavía lo está: el día después del
     último día que no estuvo en falta. */
  ultimo_bueno as (
    select item_id, max(dia) filter (where not en_falta) as dia, max(dia) as ultimo,
           bool_or(en_falta) filter (where dia = (select d from fin)) as hoy_en_falta
      from marcado group by 1
  )
  select m.item_id,
         (count(*) filter (where m.en_periodo and m.en_falta))::int,
         (count(*) filter (where m.en_periodo))::int,
         (count(*) filter (where m.en_periodo and m.en_cero_vendiendo))::int,
         round(case when r.dias > 0 then r.vendidas / r.dias end, 3),
         round(case when r.dias > 0 then r.vendidas / r.dias * count(*) filter (where m.en_periodo and m.en_falta) end, 1),
         case when u.hoy_en_falta then coalesce(u.dia + 1, min(m.dia)) end,
         (select coalesce(sum(x.neto), 0) from mov x where x.item_id = m.item_id)
    from marcado m
    join ritmo r on r.item_id = m.item_id
    join ultimo_bueno u on u.item_id = m.item_id
   group by m.item_id, r.dias, r.vendidas, u.hoy_en_falta, u.dia
  having count(*) filter (where m.en_periodo and (m.en_falta or m.en_cero_vendiendo)) > 0
      or bool_or(m.en_periodo and m.cierre <= 0);
$$;

revoke all on function public.quiebres_de_stock(uuid, date, date) from public, anon;
grant execute on function public.quiebres_de_stock(uuid, date, date) to authenticated;
