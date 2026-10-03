-- ============================================================
-- 0125 · Un comercio nuevo nace con su sucursal
-- ============================================================
--
-- Desde 0108 toda caja pertenece a una sucursal, y si el comercio no
-- tiene ninguna, la caja se rechaza. Pero la primera caja la crea un
-- disparador apenas se inserta el comercio (0101), y en ese momento el
-- comercio todavía no tiene sucursal: el panel la creaba en un segundo
-- paso que nunca llegaba. Resultado: desde el 29/09 no se podía crear
-- ningún comercio ("El comercio no tiene ninguna sucursal"). Lo encontró
-- la prueba de facturación en paralelo del 03/10; nadie había dado de
-- alta un comercio desde entonces.
--
-- Ahora el mismo disparador crea primero la sucursal "Principal", si
-- no hay ninguna, y la caja va a esa. Es lo que el registro solo
-- (autoservicio) necesita: un comercio que se crea en un paso y ya
-- tiene dónde vender.
--
-- No toca comercios existentes: todos tienen sucursal desde 0108.

set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

create or replace function crear_primera_caja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sucursal uuid;
begin
  select id into v_sucursal from sucursales
   where empresa_id = new.id and activa
   order by creada_en limit 1;
  if v_sucursal is null then
    insert into sucursales (empresa_id, nombre) values (new.id, 'Principal')
    returning id into v_sucursal;
  end if;
  insert into cajas (empresa_id, nombre, sucursal_id) values (new.id, 'Caja 1', v_sucursal);
  return new;
end;
$$;

-- Control: crear un comercio de prueba, ver que nazca con una sucursal y
-- una caja en ella, y deshacerlo (el bloque interno se revierte solo).
do $$
declare
  v_empresa uuid;
  v_sucursales int;
  v_cajas int;
  v_ok boolean := false;
begin
  begin
    insert into empresas (nombre) values ('Prueba 0125 (se deshace)') returning id into v_empresa;
    select count(*) into v_sucursales from sucursales where empresa_id = v_empresa;
    select count(*) into v_cajas from cajas c join sucursales s on s.id = c.sucursal_id
     where c.empresa_id = v_empresa and s.empresa_id = v_empresa;
    v_ok := v_sucursales = 1 and v_cajas = 1;
    raise exception 'deshacer' using errcode = 'P0125';
  exception when sqlstate 'P0125' then null;
  end;
  if not v_ok then
    raise exception 'No quedó como se esperaba: % sucursales, % cajas', v_sucursales, v_cajas;
  end if;
  if exists (select 1 from empresas where nombre = 'Prueba 0125 (se deshace)') then
    raise exception 'El comercio de prueba no se deshizo.';
  end if;
  raise notice 'Un comercio nuevo nace con % sucursal y % caja en ella (y la prueba se deshizo).', v_sucursales, v_cajas;
end $$;
