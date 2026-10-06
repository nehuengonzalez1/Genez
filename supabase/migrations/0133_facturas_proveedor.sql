-- ============================================================
-- 0133 · Facturas de proveedores a pagar
-- ============================================================
--
-- Lo pidió Nehuen el 06/10, al armar la reportería: saber qué se le debe
-- a cada proveedor, qué vence y cuánta plata hace falta en los próximos
-- días. Hasta ahora no había dónde anotarlo: Super 25 paga en el momento
-- y lo carga como "pago" en la caja grande, pero el comercio que compra a
-- 15 o 30 días no tenía cómo acordarse de qué vence.
--
-- Una factura es lo mínimo: a quién, número, monto, cuándo vence. Sin
-- renglones: para eso están las compras. El proveedor es texto (el mismo
-- nombre que se usa en los pagos de la caja grande, "coca",
-- "maxiconsumo"), no una clave a proveedores: Super 25 no tiene ninguno
-- cargado y obligarlo sería pedirle una carga que hoy no hace.
--
-- Pagarla es una sola función (pagar_factura_proveedor): registra el
-- pago en la caja grande con mover_caja_grande —el mismo control de
-- permiso y la misma bitácora— y marca la factura en la misma
-- transacción. Así no queda una factura pagada sin su salida de plata, ni
-- al revés.
--
-- Quién: el permiso de la caja grande (cajaGrande), porque es la plata
-- del negocio. Una factura pagada no se toca más; una sin pagar se puede
-- corregir o anular.
-- ============================================================

create table if not exists facturas_proveedor (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  proveedor       text not null,
  numero          text,
  monto           numeric(14,2) not null,
  emitida         date,
  vence           date not null,
  nota            text,
  anulada         boolean not null default false,
  pagada_en       timestamptz,
  cuenta          text,
  caja_grande_id  uuid references caja_grande(id) on delete set null,
  usuario_id      uuid references perfiles(id) on delete set null default auth.uid(),
  creada_en       timestamptz not null default now(),
  constraint facturas_proveedor_monto check (monto > 0),
  constraint facturas_proveedor_proveedor check (length(btrim(proveedor)) > 0)
);

create index if not exists facturas_proveedor_por_vencer
  on facturas_proveedor (empresa_id, vence) where pagada_en is null and not anulada;

alter table facturas_proveedor enable row level security;
revoke all on facturas_proveedor from anon;

drop policy if exists facturas_proveedor_ver on facturas_proveedor;
create policy facturas_proveedor_ver on facturas_proveedor
  for select to authenticated using (puede_ver(empresa_id) and permiso('cajaGrande'));

drop policy if exists facturas_proveedor_crear on facturas_proveedor;
create policy facturas_proveedor_crear on facturas_proveedor
  for insert to authenticated with check (puede_ver(empresa_id) and permiso('cajaGrande') and pagada_en is null);

/* Corregir o anular, solo lo que no se pagó. Pagar es por la función. */
drop policy if exists facturas_proveedor_corregir on facturas_proveedor;
create policy facturas_proveedor_corregir on facturas_proveedor
  for update to authenticated
  using (puede_ver(empresa_id) and permiso('cajaGrande') and pagada_en is null)
  with check (puede_ver(empresa_id) and permiso('cajaGrande') and pagada_en is null);

create or replace function public.pagar_factura_proveedor(p_factura uuid, p_cuenta text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  f    facturas_proveedor%rowtype;
  v_id uuid;
begin
  select * into f from facturas_proveedor where id = p_factura for update;
  if not found or not public.puede_ver(f.empresa_id) then
    raise exception 'No encontré esa factura.' using errcode = 'P0133';
  end if;
  if f.anulada then
    raise exception 'Esa factura está anulada.' using errcode = 'P0133';
  end if;
  if f.pagada_en is not null then
    raise exception 'Esa factura ya está pagada.' using errcode = 'P0133';
  end if;

  /* El permiso, la cuenta y la bitácora los controla mover_caja_grande. */
  v_id := public.mover_caja_grande(
    f.empresa_id, p_cuenta, 'egreso', f.monto, 'pago',
    btrim(f.proveedor) || coalesce(' · factura ' || nullif(btrim(f.numero), ''), '')
  );

  update facturas_proveedor
     set pagada_en = now(), cuenta = p_cuenta, caja_grande_id = v_id
   where id = p_factura;
  return v_id;
end;
$$;

revoke all on function public.pagar_factura_proveedor(uuid, text) from public, anon;
grant execute on function public.pagar_factura_proveedor(uuid, text) to authenticated;
