-- ============================================================
-- 0136 · Reportes programados por mail
-- ============================================================
--
-- Lo pidió Nehuen el 06/10, de la lista de reportería: que el dueño
-- reciba solo, sin entrar, cómo le fue: cada mañana lo de ayer, los
-- lunes la semana, el 1 el mes.
--
-- Quién manda: el cron diario que ya existe (founder.js ?tarea=pruebas,
-- 12 UTC = 9 de Buenos Aires). El plan Hobby de Vercel deja dos crons y
-- los dos están usados, y además solo corren una vez por día: por eso no
-- hay hora a elegir, y "semanal" y "mensual" son el período cerrado más
-- reciente. Lo que no se mandó un día sale al siguiente, una sola vez:
-- `ultimo_periodo` guarda la clave del período ya enviado (el día, el
-- lunes de la semana, el mes) y se anota recién después de que Resend lo
-- aceptó, igual que los mails de la prueba gratis (0127).
--
-- Quién programa: quien puede configurar el comercio (permiso
-- 'configurar'), porque decide a quién le llegan los números del
-- negocio. Verlos, cualquiera del comercio. Hasta cinco direcciones por
-- programación: es un resumen para el dueño y su contador, no una lista
-- de correo.
-- ============================================================

create table if not exists reportes_programados (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  frecuencia       text not null,
  para             text[] not null,
  reporte_id       uuid references reportes_guardados(id) on delete set null,
  activo           boolean not null default true,
  ultimo_periodo   text,
  ultimo_envio     timestamptz,
  ultimo_error     text,
  usuario_id       uuid references perfiles(id) on delete set null default auth.uid(),
  creado_en        timestamptz not null default now(),
  constraint reportes_programados_frecuencia check (frecuencia in ('diario', 'semanal', 'mensual')),
  constraint reportes_programados_para check (
    cardinality(para) between 1 and 5
    and array_to_string(para, ',') ~ '^[^@\s,]+@[^@\s,]+\.[^@\s,]+(,[^@\s,]+@[^@\s,]+\.[^@\s,]+)*$'
  )
);

create index if not exists reportes_programados_activos on reportes_programados (empresa_id) where activo;

alter table reportes_programados enable row level security;
revoke all on reportes_programados from anon;

drop policy if exists reportes_programados_ver on reportes_programados;
create policy reportes_programados_ver on reportes_programados
  for select to authenticated using (puede_ver(empresa_id));

drop policy if exists reportes_programados_crear on reportes_programados;
create policy reportes_programados_crear on reportes_programados
  for insert to authenticated
  with check (puede_ver(empresa_id) and permiso('configurar') and ultimo_periodo is null and ultimo_envio is null);

drop policy if exists reportes_programados_cambiar on reportes_programados;
create policy reportes_programados_cambiar on reportes_programados
  for update to authenticated
  using (puede_ver(empresa_id) and permiso('configurar'))
  with check (puede_ver(empresa_id) and permiso('configurar'));

drop policy if exists reportes_programados_borrar on reportes_programados;
create policy reportes_programados_borrar on reportes_programados
  for delete to authenticated using (puede_ver(empresa_id) and permiso('configurar'));

/* Lo que anota el envío lo escribe el servidor con la service_role: desde
   el navegador no se puede marcar como enviado algo que no salió. Un
   revoke por columna no alcanza mientras quede el permiso de toda la
   tabla (el que Supabase da solo): se saca entero y se devuelve solo
   para lo que se elige en la pantalla. */
revoke update on reportes_programados from authenticated;
grant update (frecuencia, para, reporte_id, activo) on reportes_programados to authenticated;
