-- ============================================================
-- 0137 · Onboarding: lo que cada persona ya vio
-- ============================================================
--
-- Lo pidió Nehuen el 06/10: que quien entra por primera vez sepa cómo se
-- usa, cómo funciona y qué hace cada cosa. Hay una bienvenida, una lista
-- de primeros pasos en Inicio y ayuda en cada sección; lo que hace falta
-- guardar es qué vio cada persona, para no mostrárselo de nuevo.
--
-- En la base y no en el navegador: el dueño entra desde la caja y
-- después desde la casa, y la bienvenida no tiene que volver a salir en
-- cada computadora.
--
-- Una columna jsonb en perfiles ({"bienvenida": "2026-10-06T…",
-- "pasos_ocultos": true, "pasos_hechos": ["ticket"]}) y una sola función
-- para escribirla. pasos_hechos son los que se tildan a mano: lo que la
-- base no puede saber sola (si ya probó la impresora). No por
-- UPDATE directo: perfiles tiene los permisos y el rol, y "nadie se
-- cambia sus propios permisos" (0049). La función toca solo esta columna
-- y solo la fila de quien llama, con una lista fija de claves.
-- ============================================================

alter table perfiles add column if not exists onboarding jsonb not null default '{}'::jsonb;

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
  if p_clave not in ('bienvenida', 'pasos_ocultos', 'pasos_hechos') then
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
