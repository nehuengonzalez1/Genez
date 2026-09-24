/* ============================================================
   0087 · LOS CÓDIGOS GENERADOS, A LA VISTA
   ============================================================

   0086 le da un código propio a un producto y lo guarda en el producto,
   pero no quedaba en ningún lado cuándo ni quién: el código se generaba,
   se imprimía, y para volver a verlo había que acordarse de qué producto
   era. Super 25 quiere una sección donde estén todos, para entrar cuando
   quiera, buscarlos y reimprimirlos.

   `codigos_generados` es el registro: qué código, a qué producto, cuándo y
   quién. Lo escribe `asignar_codigos_internos`.

   `codigos_propios_vista` es lo que se muestra: los productos que HOY
   tienen un código propio (2 + seis dígitos + verificador), con cuándo se
   generó si está registrado. Sale del producto y no del registro a
   propósito: si alguien le cambia el código a mano a un producto, la
   lista tiene que dejar de mostrar el viejo, no conservarlo como si
   siguiera en la góndola. Los que se cargaron antes de este registro
   aparecen igual, sin fecha.
   ============================================================ */

create table codigos_generados (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  codigo      text not null,
  usuario_id  uuid references perfiles(id) on delete set null,
  fecha       timestamptz not null default now()
);

create index on codigos_generados (empresa_id, fecha desc);
create index on codigos_generados (item_id);

alter table codigos_generados enable row level security;
create policy codigos_generados_ver on codigos_generados
  for select using (public.puede_ver(empresa_id));
/* La función corre con los permisos de quien llama (edita `items` como la
   ficha), así que el registro tiene que dejarse escribir por el mismo. */
create policy codigos_generados_anotar on codigos_generados
  for insert with check (public.puede_ver(empresa_id));

create or replace function public.asignar_codigos_internos(p_empresa uuid, p_items uuid[])
returns table (item_id uuid, barcode text)
language plpgsql
as $$
declare
  v_item  uuid;
  v_sig   int;
  v_cod   text;
begin
  if p_empresa is null then
    raise exception 'Falta el comercio.';
  end if;

  perform pg_advisory_xact_lock(hashtext('codigos_internos:' || p_empresa::text));

  select coalesce(max(substr(i.barcode, 2, 6)::int), 0) + 1 into v_sig
  from items i
  where i.empresa_id = p_empresa
    and i.barcode ~ '^2[0-9]{7}$'
    and right(i.barcode, 1)::int = public.digito_ean(left(i.barcode, 7));

  for v_item in
    select i.id from items i
    where i.empresa_id = p_empresa
      and i.id = any(p_items)
      and coalesce(btrim(i.barcode), '') = ''
    order by i.nombre
  loop
    loop
      if v_sig > 999999 then
        raise exception 'Se terminaron los códigos propios de este comercio.';
      end if;
      v_cod := '2' || lpad(v_sig::text, 6, '0');
      v_cod := v_cod || public.digito_ean(v_cod)::text;
      v_sig := v_sig + 1;
      exit when not exists (select 1 from items x where x.empresa_id = p_empresa and x.barcode = v_cod);
    end loop;

    update items set barcode = v_cod where id = v_item;
    insert into codigos_generados (empresa_id, item_id, codigo, usuario_id)
    values (p_empresa, v_item, v_cod, auth.uid());

    item_id := v_item;
    barcode := v_cod;
    return next;
  end loop;
end;
$$;

create view codigos_propios_vista
with (security_invoker = true)
as
select
  i.id          as item_id,
  i.empresa_id,
  i.nombre,
  i.barcode     as codigo,
  i.precio,
  i.activo,
  g.fecha       as generado_en,
  (select nombre from perfiles where id = g.usuario_id) as generado_por
from items i
left join lateral (
  select cg.fecha, cg.usuario_id from codigos_generados cg
  where cg.item_id = i.id and cg.codigo = i.barcode
  order by cg.fecha desc limit 1
) g on true
where i.barcode ~ '^2[0-9]{7}$'
  and right(i.barcode, 1)::int = public.digito_ean(left(i.barcode, 7));

comment on view codigos_propios_vista is
  'Los productos que hoy tienen un código propio de Genez, con cuándo y quién lo generó.';
