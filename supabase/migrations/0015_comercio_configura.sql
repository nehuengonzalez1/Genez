/* ============================================================
   0015 · EL COMERCIO CONFIGURA LO SUYO
   ============================================================

   Hasta ahora solo la plataforma podía modificar la tabla de empresas, y
   la configuración del negocio vive ahí. Un dueño que corregía su CUIT o
   la comisión de su tarjeta no recibía ningún error: el UPDATE no
   encontraba filas y devolvía éxito habiendo hecho nada.

   Pero no todo lo que está en esa fila es del comercio. El plan, los
   módulos contratados y si la cuenta está activa son la relación
   comercial con Genez: si el dueño pudiera tocarlos, se daría de alta
   los módulos que no paga.

   Entonces son dos reglas distintas y las dos hacen falta: RLS decide
   quién puede tocar la fila, y un disparador decide qué columnas. RLS
   sola no alcanza porque no distingue columnas.
   ============================================================ */

create policy empresas_configurar on empresas
  for update
  using (
    id = public.empresa_actual()
    and exists (
      select 1 from perfiles p
      where p.id = auth.uid() and p.rol in ('dueno', 'encargado')
    )
  )
  with check (id = public.empresa_actual());

create or replace function proteger_lo_comercial()
returns trigger
language plpgsql
as $$
begin
  if public.es_plataforma() then
    return new;
  end if;

  if new.nombre  is distinct from old.nombre
  or new.plan    is distinct from old.plan
  or new.modulos is distinct from old.modulos
  or new.activa  is distinct from old.activa
  or new.rubro   is distinct from old.rubro then
    raise exception 'El plan, los módulos y el estado de la cuenta los cambia Genez, no el comercio.'
      using errcode = 'P0004';
  end if;

  return new;
end;
$$;

create trigger empresas_proteger_lo_comercial
  before update on empresas
  for each row execute function proteger_lo_comercial();

comment on function proteger_lo_comercial is
  'Un comercio configura su negocio, no lo que le factura Genez.';
