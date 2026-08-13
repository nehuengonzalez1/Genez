/* ============================================================
   0018 · LO QUE SE CARGA NO SALE SOLO A COCINA
   ============================================================

   Una línea nacía en 'pedido', o sea que aparecía en la cocina en el
   momento en que alguien la tocaba. Eso rompe cómo se atiende de verdad:
   el cliente pide una cosa, se arrepiente, agrega otra, y el mozo se
   equivoca y corrige. Todo eso llegaba a la plancha.

   Y el botón de despachar reenviaba la comanda entera. Si a las nueve se
   pidieron dos hamburguesas y a las diez una porción de papas, la cocina
   volvía a recibir las hamburguesas.

   Ahora la línea nace en 'borrador': está en la cuenta, suma al total y
   descuenta stock al cobrar, pero la cocina no la ve. Sale recién cuando
   alguien despacha, y solo sale lo que todavía no había salido.
   ============================================================ */

alter table operacion_lineas drop constraint lineas_estado_valido;

alter table operacion_lineas add constraint lineas_estado_valido check (
  estado in ('borrador', 'pedido', 'preparando', 'listo', 'entregado', 'anulada')
);

alter table operacion_lineas alter column estado set default 'borrador';

comment on column operacion_lineas.estado is
  'borrador: cargada y todavía sin despachar. pedido: la cocina ya la vio.';

/* Despacha solo lo que falta despachar y devuelve cuántas salieron. El
   filtro por estado es lo que hace que agregar algo a la media hora no
   vuelva a mandar lo de antes. */
create or replace function enviar_a_cocina(comanda uuid)
returns integer
language plpgsql
as $$
declare
  v_salieron integer;
begin
  update operacion_lineas
     set estado = 'pedido', enviada_en = now()
   where operacion_id = comanda and estado = 'borrador';

  get diagnostics v_salieron = row_count;
  return v_salieron;
end;
$$;

comment on function enviar_a_cocina is
  'Manda a la cocina lo que todavía no salió. Lo ya despachado no se repite.';

/* ------------------------------------------------------------
   El salón cuenta lo que falta despachar

   Un mozo que pasa por al lado de la mesa tiene que ver que hay algo
   cargado sin mandar: es el error más caro del servicio, porque nadie se
   entera hasta que el cliente pregunta por qué tarda.
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

  o.id         as comanda_id,
  o.abierta_en,
  o.usuario_id as abierta_por,

  coalesce(l.consumido, 0)   as consumido,
  coalesce(l.items, 0)       as items,
  coalesce(l.sin_enviar, 0)  as sin_enviar,
  coalesce(l.en_cocina, 0)   as en_cocina,
  coalesce(l.listos, 0)      as listos,

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

comment on view salon_vista is
  'Cada mesa con su lugar en el plano, con quién está unida, lo que falta despachar y lo que espera en cocina.';
