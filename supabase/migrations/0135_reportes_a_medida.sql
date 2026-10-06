-- ============================================================
-- 0135 · Reportes a medida: el constructor de Informes
-- ============================================================
--
-- Lo pidió Nehuen el 06/10, el último de la lista de reportería: que el
-- comercio arme su propio cuadro —"ventas y margen por rubro y sucursal,
-- por mes"—, lo guarde con un nombre y pueda abrir cada número hasta
-- llegar al ticket.
--
-- La cuenta la hace la base y no el navegador: un año de Super 25 son
-- decenas de miles de líneas, y mandarlas todas para sumarlas allá sería
-- lento en la computadora de la caja. reporte_a_medida devuelve ya
-- agrupado.
--
-- Las dimensiones salen de una lista fija (DIMS, abajo). El nombre que
-- manda el navegador solo elige una de esas expresiones: nunca se pega en
-- el SQL. Lo mismo con los filtros: el valor viaja como parámetro.
--
-- Cada dimensión devuelve una clave que se ordena sola (el día como
-- AAAA-MM-DD, el mes como AAAA-MM, la hora con dos dígitos, el día de la
-- semana como 1 a 7) y la pantalla la pone linda. Los filtros comparan
-- contra esa misma clave, así el drill-down es "esta fila pasa a ser un
-- filtro".
--
-- Se suman las líneas de las ventas y comandas confirmadas, con las
-- devoluciones restando: el mismo criterio que ventas_por_item_rango
-- (0080/0108), así "por producto" da lo mismo acá que en el resto de
-- Informes. Un descuento sobre el total del ticket no está en las líneas:
-- por eso la venta de acá puede quedar un poco arriba de la de la serie
-- diaria, igual que en "Por producto".
--
-- security invoker: lee con las políticas de quien la llama.
-- ============================================================

create or replace function public.reporte_a_medida(
  p_empresa  uuid,
  p_desde    date,
  p_hasta    date,
  p_dims     text[],
  p_filtros  jsonb default '{}'::jsonb
)
returns table (d1 text, d2 text, d3 text, ventas numeric, costo numeric, unidades numeric, tickets bigint)
language plpgsql
stable
security invoker
set search_path to 'public'
as $$
declare
  /* La lista fija. Nada fuera de esto llega al SQL. */
  dims constant jsonb := jsonb_build_object(
    'dia',        $q$to_char(b.fecha_local, 'YYYY-MM-DD')$q$,
    'semana',     $q$to_char(date_trunc('week', b.fecha_local), 'YYYY-MM-DD')$q$,
    'mes',        $q$to_char(b.fecha_local, 'YYYY-MM')$q$,
    'dia_semana', $q$extract(isodow from b.fecha_local)::int::text$q$,
    'hora',       $q$to_char(b.fecha_local, 'HH24')$q$,
    'sucursal',   $q$coalesce(b.sucursal, 'Sin sucursal')$q$,
    'vendedor',   $q$coalesce(b.vendedor, 'Sin dato')$q$,
    'canal',      $q$coalesce(nullif(b.canal, ''), 'Sin canal')$q$,
    'categoria',  $q$coalesce(nullif(b.categoria, ''), 'Sin rubro')$q$,
    'marca',      $q$coalesce(nullif(b.marca, ''), 'Sin marca')$q$,
    'proveedor',  $q$coalesce(nullif(b.proveedor, ''), 'Sin proveedor')$q$,
    'producto',   $q$b.producto$q$,
    'cliente',    $q$coalesce(b.cliente, 'Consumidor final')$q$,
    'ticket',     $q$coalesce(b.numero, '') || ' · ' || to_char(b.fecha_local, 'DD/MM HH24:MI')$q$
  );
  sel   text[] := array[]::text[];
  grp   text[] := array[]::text[];
  donde text := '';
  k     text;
  i     int;
begin
  if p_dims is null or array_length(p_dims, 1) is null or array_length(p_dims, 1) > 3 then
    raise exception 'Elegí de una a tres formas de agrupar.' using errcode = 'P0135';
  end if;
  foreach k in array p_dims loop
    if not dims ? k then raise exception 'No conozco "%".', k using errcode = 'P0135'; end if;
  end loop;
  if p_hasta < p_desde or p_hasta - p_desde > 3660 then
    raise exception 'El período no da.' using errcode = 'P0135';
  end if;

  for i in 1 .. 3 loop
    if i <= array_length(p_dims, 1) then
      sel := sel || ((dims ->> p_dims[i]) || ' as d' || i);
      grp := grp || (i::text);
    else
      sel := sel || ('null::text as d' || i);
    end if;
  end loop;

  /* Los filtros: { "categoria": ["Bebidas"], "sucursal": ["Centro"] }.
     Cada valor va como elemento de $4, nunca pegado. */
  for k in select jsonb_object_keys(coalesce(p_filtros, '{}'::jsonb)) loop
    if not dims ? k then raise exception 'No conozco "%".', k using errcode = 'P0135'; end if;
    if jsonb_typeof(p_filtros -> k) <> 'array' then continue; end if;
    donde := donde || format(' and (%s) = any (array(select jsonb_array_elements_text($4 -> %L)))', dims ->> k, k);

  end loop;

  return query execute format($sql$
    with zona as (select zona_de($1) as z),
    base as (
      select l.operacion_id,
             case when o.tipo = 'devolucion' then -1 else 1 end as signo,
             (o.fecha at time zone zona.z) as fecha_local,
             o.numero, o.canal,
             s.nombre as sucursal,
             pe.nombre as vendedor,
             cl.razon_social as cliente,
             coalesce(it.nombre, l.descripcion) as producto,
             it.categoria, it.marca,
             pr.nombre as proveedor,
             l.cantidad, l.total, l.costo_unitario
        from operacion_lineas l
        join operaciones o on o.id = l.operacion_id
        cross join zona
        left join items it on it.id = l.item_id
        left join proveedores pr on pr.id = it.proveedor_id
        left join sucursales s on s.id = o.sucursal_id
        left join perfiles pe on pe.id = o.usuario_id
        left join clientes cl on cl.id = o.cliente_id
       where o.empresa_id = $1
         and l.empresa_id = $1
         and o.tipo in ('venta', 'comanda', 'devolucion')
         and o.estado = 'confirmada'
         and o.fecha >= ($2::timestamp at time zone zona.z)
         and o.fecha < (($3 + 1)::timestamp at time zone zona.z)
    )
    select %s,
           sum(b.signo * b.total)::numeric,
           sum(b.signo * b.cantidad * b.costo_unitario)::numeric,
           sum(b.signo * b.cantidad)::numeric,
           count(distinct b.operacion_id) filter (where b.signo = 1)
      from base b
     where true %s
     group by %s
     order by 4 desc
     limit 2000
  $sql$, array_to_string(sel, ', '), donde, array_to_string(grp, ', '))
  using p_empresa, p_desde, p_hasta, coalesce(p_filtros, '{}'::jsonb);
end;
$$;

revoke all on function public.reporte_a_medida(uuid, date, date, text[], jsonb) from public, anon;
grant execute on function public.reporte_a_medida(uuid, date, date, text[], jsonb) to authenticated;

-- ------------------------------------------------------------
-- Los reportes guardados
-- ------------------------------------------------------------
-- Del comercio, no de una persona: el dueño arma "Rentabilidad por
-- sucursal" y el encargado lo abre. La definición es lo que eligió en la
-- pantalla (dimensiones, filtros, métricas, período, gráfico); la
-- pantalla ignora lo que no conoce, así un cambio de versión no rompe lo
-- guardado. Borrar o cambiar uno: quien lo hizo o quien puede configurar.
-- ------------------------------------------------------------

create table if not exists reportes_guardados (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null,
  definicion  jsonb not null default '{}'::jsonb,
  usuario_id  uuid references perfiles(id) on delete set null default auth.uid(),
  creado_en   timestamptz not null default now(),
  constraint reportes_guardados_nombre check (length(btrim(nombre)) between 1 and 80)
);

create index if not exists reportes_guardados_empresa on reportes_guardados (empresa_id, nombre);

alter table reportes_guardados enable row level security;
revoke all on reportes_guardados from anon;

drop policy if exists reportes_guardados_ver on reportes_guardados;
create policy reportes_guardados_ver on reportes_guardados
  for select to authenticated using (puede_ver(empresa_id));

drop policy if exists reportes_guardados_crear on reportes_guardados;
create policy reportes_guardados_crear on reportes_guardados
  for insert to authenticated with check (puede_ver(empresa_id) and usuario_id = auth.uid());

drop policy if exists reportes_guardados_cambiar on reportes_guardados;
create policy reportes_guardados_cambiar on reportes_guardados
  for update to authenticated
  using (puede_ver(empresa_id) and (usuario_id = auth.uid() or permiso('configurar')))
  with check (puede_ver(empresa_id));

drop policy if exists reportes_guardados_borrar on reportes_guardados;
create policy reportes_guardados_borrar on reportes_guardados
  for delete to authenticated using (puede_ver(empresa_id) and (usuario_id = auth.uid() or permiso('configurar')));
