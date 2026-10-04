-- ============================================================
-- 0128 · La foto del login, subible desde el panel de plataforma
-- ============================================================
--
-- El login nuevo (03/10) es una imagen con el diseño entero (foto, panel
-- y texto) y la tarjeta real encima. Nehuen quiere poder cambiar la
-- imagen por otra, en más calidad, sin pasar por el código.
--
-- "Imagen del login" ya estaba en el panel, pero guardaba la imagen en la
-- memoria del navegador: nunca le llegaba al login, que no tiene sesión.
--
-- Va a Storage, en un bucket público: el login la lee por su URL pública,
-- sin sesión. Escribir solo la plataforma, y solo en login/. No toca nada
-- de los comercios.

set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publico', 'publico', true, 8388608, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists publico_login_subir on storage.objects;
create policy publico_login_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'publico' and name like 'login/%' and public.es_plataforma());

drop policy if exists publico_login_cambiar on storage.objects;
create policy publico_login_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'publico' and name like 'login/%' and public.es_plataforma())
  with check (bucket_id = 'publico' and name like 'login/%' and public.es_plataforma());

drop policy if exists publico_login_sacar on storage.objects;
create policy publico_login_sacar on storage.objects for delete to authenticated
  using (bucket_id = 'publico' and name like 'login/%' and public.es_plataforma());

/* Para subir con upsert, Storage necesita poder ver si el archivo ya está. */
drop policy if exists publico_login_ver on storage.objects;
create policy publico_login_ver on storage.objects for select to authenticated
  using (bucket_id = 'publico' and name like 'login/%' and public.es_plataforma());

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'publico' and public) then
    raise exception 'El bucket publico no quedó público';
  end if;
  raise notice 'bucket publico listo';
end $$;
