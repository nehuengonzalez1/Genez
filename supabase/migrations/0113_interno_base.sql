/* ============================================================
   0113 · GENEZ FOUNDER, la base: quién entra y qué se configura
   ============================================================

   Founder es el sistema interno de la empresa Genez (CRM, agenda,
   tareas y lo que venga). No es un módulo de los comercios: sus datos
   —prospectos, notas, estrategia, finanzas— no pueden verse desde
   ninguna cuenta de comercio, y tampoco al revés.

   LA LLAVE NO ES "PLATAFORMA"
   ---------------------------
   puede_ver(empresa) devuelve verdadero para la plataforma en CUALQUIER
   comercio: es la que usa el soporte para "entrar como". Si Founder se
   abriera con esa llave, el primer vendedor que se sume vería las
   ventas, la caja y los clientes de todos los comercios. Por eso Founder
   tiene su propia frontera: interno_miembros, y es_interno(área), que
   mira solo esa tabla —ni es_plataforma ni empresa_id—. Un miembro
   interno que no es plataforma no ve nada de los comercios, y un usuario
   de comercio no ve nada interno.

   Áreas: 'crm', 'agenda', 'tareas', 'producto', 'marketing',
   'finanzas', 'config', o '*' (todas). Por ahora el único miembro es el
   fundador, con todas.

   DENEGADO POR DEFECTO
   --------------------
   Toda tabla interno_* tiene RLS y ninguna política para anon. Supabase
   le da permisos a anon y a public en cada tabla y función nueva: acá se
   revocan explícitamente, y scripts/probar-founder-seguridad.mjs lo
   comprueba con cinco perfiles.
   ============================================================ */

/* ---------- Quién es del equipo ---------- */
create table interno_miembros (
  perfil_id      uuid primary key references perfiles(id) on delete cascade,
  rol            text not null default 'comercial',
  areas          text[] not null default '{}',
  activo         boolean not null default true,
  creado_en      timestamptz not null default now(),
  creado_por     uuid references perfiles(id) on delete set null,
  actualizado_en timestamptz not null default now(),
  constraint interno_miembros_rol_valido check (rol in ('fundador', 'administrador', 'comercial', 'marketing', 'desarrollo', 'soporte', 'administracion')),
  constraint interno_miembros_areas_validas check (areas <@ array['*', 'crm', 'agenda', 'tareas', 'producto', 'marketing', 'finanzas', 'config']::text[])
);
comment on table interno_miembros is
  'La frontera de GENEZ FOUNDER (0113): solo quien está acá y activo entra, y solo a sus áreas. No depende de es_plataforma ni de empresa_id.';

create or replace function es_interno(p_area text default null)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select m.activo and (p_area is null or '*' = any(m.areas) or p_area = any(m.areas))
      from interno_miembros m where m.perfil_id = auth.uid()
  ), false)
$$;

/* Quién administra el equipo: el fundador y los administradores. */
create or replace function es_interno_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select m.activo and m.rol in ('fundador', 'administrador') from interno_miembros m where m.perfil_id = auth.uid()), false)
$$;

alter table interno_miembros enable row level security;
create policy interno_miembros_ver on interno_miembros
  for select using (perfil_id = auth.uid() or es_interno_admin());
/* Nadie se cambia a sí mismo: sin esto, cualquiera con acceso se daba
   todas las áreas (la misma regla que 0049 para los permisos). */
create policy interno_miembros_crear on interno_miembros
  for insert with check (es_interno_admin() and perfil_id <> auth.uid());
create policy interno_miembros_editar on interno_miembros
  for update using (es_interno_admin() and perfil_id <> auth.uid())
  with check (es_interno_admin() and perfil_id <> auth.uid());
/* Sin política de borrar: se desactiva. */

/* El fundador de hoy: el perfil de plataforma que ya existe. */
insert into interno_miembros (perfil_id, rol, areas)
select id, 'fundador', array['*'] from perfiles where es_plataforma
on conflict (perfil_id) do nothing;


/* ---------- La auditoría ---------- */
create table interno_historial (
  id       bigint generated always as identity primary key,
  tabla    text not null,
  fila_id  text not null,
  accion   text not null,
  cambios  jsonb not null default '{}',
  quien    uuid references perfiles(id) on delete set null,
  fecha    timestamptz not null default now()
);
create index on interno_historial (tabla, fila_id, fecha desc);
comment on table interno_historial is
  'Lo que cambió en las tablas internas y quién lo cambió. Lo escribe solo el disparador interno_anotar (0113).';

alter table interno_historial enable row level security;
create policy interno_historial_ver on interno_historial for select using (es_interno());

/* Anota altas, bajas y, en un cambio, solo las columnas que cambiaron.
   Security definer: el historial no tiene políticas de escritura, así
   nadie lo edita desde el navegador. */
create or replace function interno_anotar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_cambios jsonb := '{}';
  k text;
begin
  if tg_op = 'DELETE' then
    v_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'perfil_id');
    insert into interno_historial (tabla, fila_id, accion, cambios, quien) values (tg_table_name, v_id, 'borrado', to_jsonb(old), auth.uid());
    return old;
  end if;
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'perfil_id');
  if tg_op = 'INSERT' then
    insert into interno_historial (tabla, fila_id, accion, cambios, quien) values (tg_table_name, v_id, 'alta', to_jsonb(new), auth.uid());
  else
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if k not in ('actualizado_en', 'actualizado_por') and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
        v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('antes', to_jsonb(old) -> k, 'despues', to_jsonb(new) -> k));
      end if;
    end loop;
    if v_cambios <> '{}' then
      insert into interno_historial (tabla, fila_id, accion, cambios, quien) values (tg_table_name, v_id, 'cambio', v_cambios, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

/* Quién y cuándo lo pone la base, no la pantalla. */
create or replace function interno_sellar()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.creado_en := now();
    new.creado_por := auth.uid();
  end if;
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

create trigger interno_miembros_historial after insert or update or delete on interno_miembros
  for each row execute function interno_anotar();


/* ---------- Las listas configurables ---------- */
/* Zonas, rubros, fuentes, motivos de pérdida, tipos de actividad y de
   evento, categorías: una sola tabla con un tipo, en vez de una por
   lista. La clave es la que usa el código; el nombre, el que se ve. */
create table interno_listas (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null,
  clave           text not null,
  nombre          text not null,
  orden           integer not null default 0,
  activo          boolean not null default true,
  datos           jsonb not null default '{}',
  creado_en       timestamptz not null default now(),
  creado_por      uuid references perfiles(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references perfiles(id) on delete set null,
  constraint interno_listas_tipo_valido check (tipo in ('zona', 'rubro', 'fuente', 'motivo_perdida', 'tipo_actividad', 'tipo_evento', 'categoria_tarea', 'etiqueta')),
  constraint interno_listas_nombre check (length(btrim(nombre)) between 1 and 80),
  constraint interno_listas_clave check (clave ~ '^[a-z0-9_]{1,40}$'),
  unique (tipo, clave)
);
create index on interno_listas (tipo, orden);

alter table interno_listas enable row level security;
create policy interno_listas_ver on interno_listas for select using (es_interno());
create policy interno_listas_crear on interno_listas for insert with check (es_interno('config'));
create policy interno_listas_editar on interno_listas for update using (es_interno('config')) with check (es_interno('config'));
/* Sin borrar: se desactiva, así lo que ya la usa no queda apuntando a nada. */

create trigger interno_listas_sello before insert or update on interno_listas for each row execute function interno_sellar();
create trigger interno_listas_historial after insert or update or delete on interno_listas for each row execute function interno_anotar();

insert into interno_listas (tipo, clave, nombre, orden) values
  ('zona', 'caseros', 'Caseros', 1), ('zona', 'san_martin_centro', 'San Martín Centro', 2),
  ('zona', 'villa_ballester', 'Villa Ballester', 3), ('zona', 'villa_bosch', 'Villa Bosch', 4),
  ('rubro', 'minorista', 'Comercio minorista', 1), ('rubro', 'almacen', 'Almacén, kiosco o supermercado', 2),
  ('rubro', 'gastronomia', 'Gastronomía', 3), ('rubro', 'peluqueria', 'Peluquería o barbería', 4),
  ('rubro', 'estetica', 'Centro de estética', 5), ('rubro', 'pilates_gimnasio', 'Pilates o gimnasio', 6),
  ('rubro', 'servicios', 'Profesional o prestador de servicios', 7), ('rubro', 'multisucursal', 'Empresa con sucursales', 8),
  ('fuente', 'visita', 'Visita en persona', 1), ('fuente', 'whatsapp', 'WhatsApp', 2), ('fuente', 'instagram', 'Instagram', 3),
  ('fuente', 'referido', 'Referido', 4), ('fuente', 'landing', 'Formulario de la web', 5), ('fuente', 'llamada', 'Llamada', 6),
  ('fuente', 'otra', 'Otra', 9),
  ('motivo_perdida', 'precio', 'Precio', 1), ('motivo_perdida', 'tiene_sistema', 'Ya tiene sistema', 2),
  ('motivo_perdida', 'no_es_momento', 'No es el momento', 3), ('motivo_perdida', 'sin_respuesta', 'Dejó de responder', 4),
  ('motivo_perdida', 'no_lo_necesita', 'No lo necesita', 5), ('motivo_perdida', 'otro', 'Otro', 9),
  ('tipo_actividad', 'llamada', 'Llamada', 1), ('tipo_actividad', 'whatsapp', 'WhatsApp', 2), ('tipo_actividad', 'email', 'Email', 3),
  ('tipo_actividad', 'visita', 'Visita', 4), ('tipo_actividad', 'reunion', 'Reunión', 5), ('tipo_actividad', 'demo', 'Demo', 6),
  ('tipo_actividad', 'propuesta', 'Propuesta', 7), ('tipo_actividad', 'nota', 'Nota interna', 8),
  ('tipo_evento', 'llamada', 'Llamada', 1), ('tipo_evento', 'visita', 'Visita comercial', 2), ('tipo_evento', 'reunion', 'Reunión', 3),
  ('tipo_evento', 'demo', 'Demo de Genez', 4), ('tipo_evento', 'capacitacion', 'Capacitación', 5), ('tipo_evento', 'producto', 'Reunión de producto', 6),
  ('tipo_evento', 'contenido', 'Grabación de contenido', 7), ('tipo_evento', 'administrativo', 'Trabajo administrativo', 8),
  ('tipo_evento', 'desarrollo', 'Trabajo de desarrollo', 9), ('tipo_evento', 'personal', 'Personal', 10),
  ('tipo_evento', 'foco', 'Trabajo profundo', 11), ('tipo_evento', 'otro', 'Otro', 12),
  ('categoria_tarea', 'comercial', 'Comercial', 1), ('categoria_tarea', 'producto', 'Producto', 2),
  ('categoria_tarea', 'desarrollo', 'Desarrollo', 3), ('categoria_tarea', 'marketing', 'Marketing', 4),
  ('categoria_tarea', 'soporte', 'Soporte', 5), ('categoria_tarea', 'administracion', 'Administración', 6),
  ('categoria_tarea', 'personal', 'Personal', 7);


/* ---------- Las etapas del pipeline ---------- */
create table interno_etapas (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  orden           integer not null,
  probabilidad    integer not null default 0,
  tipo            text not null default 'abierta',
  activa          boolean not null default true,
  creado_en       timestamptz not null default now(),
  creado_por      uuid references perfiles(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references perfiles(id) on delete set null,
  constraint interno_etapas_nombre check (length(btrim(nombre)) between 1 and 60),
  constraint interno_etapas_prob check (probabilidad between 0 and 100),
  constraint interno_etapas_tipo check (tipo in ('abierta', 'ganada', 'perdida', 'pausada'))
);
comment on column interno_etapas.tipo is
  'Qué significa para las cuentas: abierta (suma al pipeline ponderado), ganada, perdida o pausada (no suman).';

alter table interno_etapas enable row level security;
create policy interno_etapas_ver on interno_etapas for select using (es_interno());
create policy interno_etapas_crear on interno_etapas for insert with check (es_interno('config'));
create policy interno_etapas_editar on interno_etapas for update using (es_interno('config')) with check (es_interno('config'));

create trigger interno_etapas_sello before insert or update on interno_etapas for each row execute function interno_sellar();
create trigger interno_etapas_historial after insert or update or delete on interno_etapas for each row execute function interno_anotar();

insert into interno_etapas (nombre, orden, probabilidad, tipo) values
  ('Nuevo', 1, 5, 'abierta'), ('Para investigar', 2, 5, 'abierta'), ('Contacto pendiente', 3, 10, 'abierta'),
  ('Contactado', 4, 15, 'abierta'), ('Interesado', 5, 30, 'abierta'), ('Demo agendada', 6, 45, 'abierta'),
  ('Demo realizada', 7, 60, 'abierta'), ('Propuesta enviada', 8, 70, 'abierta'), ('Negociación', 9, 80, 'abierta'),
  ('Ganado', 10, 100, 'ganada'), ('Perdido', 11, 0, 'perdida'), ('Pausado', 12, 0, 'pausada');


/* ---------- Nada para anon, nada de más para authenticated ---------- */
revoke all on interno_miembros, interno_historial, interno_listas, interno_etapas from anon;
revoke truncate, references, trigger on interno_miembros, interno_historial, interno_listas, interno_etapas from authenticated;
revoke insert, update, delete on interno_historial from authenticated;
revoke delete on interno_miembros, interno_listas, interno_etapas from authenticated;

revoke execute on function es_interno(text) from public, anon;
grant execute on function es_interno(text) to authenticated;
revoke execute on function es_interno_admin() from public, anon;
grant execute on function es_interno_admin() to authenticated;
revoke execute on function interno_anotar() from public, anon, authenticated;
revoke execute on function interno_sellar() from public, anon, authenticated;
