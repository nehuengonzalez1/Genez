-- ============================================================
-- 0138 · Onboarding: las pantallas que cada persona ya recorrió
-- ============================================================
--
-- Lo pidió Nehuen el 07/10: que el onboarding arranque solo, y que cada
-- pantalla a la que se entra por primera vez haga su recorrido guiado.
-- Para no repetirlo, se guarda qué pantallas ya vio cada persona, en la
-- misma columna que la bienvenida (perfiles.onboarding, 0137), con la
-- clave pantallas_vistas: ["inicio", "cobro", "productos"].
--
-- Lo único que cambia es la lista de claves que acepta
-- marcar_onboarding. Sigue tocando solo esa columna y solo la fila de
-- quien llama.
-- ============================================================

create or replace function public.marcar_onboarding(p_clave text, p_valor jsonb default 'true'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v jsonb;
begin
  if auth.uid() is null then
    raise exception 'Falta la sesión.' using errcode = 'P0137';
  end if;
  if p_clave not in ('bienvenida', 'pasos_ocultos', 'pasos_hechos', 'pantallas_vistas') then
    raise exception 'No conozco "%".', p_clave using errcode = 'P0137';
  end if;
  update perfiles
     set onboarding = jsonb_set(coalesce(onboarding, '{}'::jsonb), array[p_clave], coalesce(p_valor, 'true'::jsonb))
   where id = auth.uid()
  returning onboarding into v;
  return coalesce(v, '{}'::jsonb);
end;
$$;

revoke all on function public.marcar_onboarding(text, jsonb) from public, anon;
grant execute on function public.marcar_onboarding(text, jsonb) to authenticated;
