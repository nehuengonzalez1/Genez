-- ============================================================
-- 0132 · El comercio cambia su propio nombre
-- ============================================================
--
-- proteger_lo_comercial (0127, ampliada en 0128) frenaba el nombre junto
-- con el plan, los módulos y el estado de la cuenta: "lo comercial lo
-- cambia Genez". Con el autoservicio eso dejó de tener sentido para el
-- nombre: quien se registra con un error de tipeo lo tenía en todos los
-- tickets y no podía arreglarlo. Lo pidió Nehuen el 06/10, al ordenar
-- Ajustes.
--
-- El plan, los módulos, el rubro, el estado y el vencimiento siguen
-- siendo de Genez. Quién puede escribir el nombre ya lo dice la política
-- empresas_configurar (el permiso `configurar`); acá solo se frena un
-- nombre vacío o absurdo, que dejaría el ticket sin encabezado.
--
-- La función es la de la base (pg_get_functiondef) con ese cambio.
-- ============================================================

create or replace function public.proteger_lo_comercial()
 returns trigger
 language plpgsql
as $function$
begin
  if public.es_plataforma() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.plan    is distinct from old.plan
  or new.modulos is distinct from old.modulos
  or new.activa  is distinct from old.activa
  or new.rubro   is distinct from old.rubro
  or new.prueba_hasta is distinct from old.prueba_hasta then
    raise exception 'El plan, los módulos y el estado de la cuenta los cambia Genez, no el comercio.'
      using errcode = 'P0004';
  end if;

  if new.nombre is distinct from old.nombre then
    new.nombre := btrim(new.nombre);
    if length(coalesce(new.nombre, '')) < 2 or length(new.nombre) > 80 then
      raise exception 'El nombre del comercio tiene que tener entre 2 y 80 caracteres.'
        using errcode = 'P0132';
    end if;
  end if;

  return new;
end;
$function$;
