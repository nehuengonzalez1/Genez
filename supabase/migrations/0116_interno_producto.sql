/* ============================================================
   0116 · GENEZ FOUNDER, fase 3b: producto y documentación
   ============================================================

   PRODUCTO (área 'producto')
   --------------------------
   Proyectos, el roadmap y las versiones de Genez. Ideas, funcionalidades,
   mejoras, bugs, pedidos de clientes, deuda técnica e integraciones son
   una sola tabla con un tipo (interno_roadmap), no siete: comparten casi
   todo, se mueven por los mismos estados y un bug puede terminar siendo
   una mejora. Los campos propios del bug (entorno, pasos, resultado
   esperado y actual, gravedad) quedan vacíos en lo que no es bug.

   Un ticket de soporte pasa a producto sin perder al cliente: la relación
   ticket-elemento queda en interno_roadmap_tickets, y un mismo pedido
   puede juntar los tickets de varios clientes. Eso es "cuántos lo piden".

   Esto no es el seguimiento del código (commits, ramas): es qué construir,
   por qué y para quién.

   DOCUMENTACIÓN (área 'docs')
   ---------------------------
   Documentos en markdown, con búsqueda por título, etiquetas y contenido
   (tsvector en castellano) y el historial de versiones: cada cambio de
   título o contenido guarda la versión anterior, así que editar no pisa
   nada. No hay ninguna columna "público": un documento interno no tiene
   forma de volverse público por un tilde. Lo protege RLS como al resto.
   ============================================================ */

/* ---------- Listas ---------- */
alter table interno_listas drop constraint interno_listas_tipo_valido;
alter table interno_listas add constraint interno_listas_tipo_valido
  check (tipo in ('zona', 'rubro', 'fuente', 'motivo_perdida', 'tipo_actividad', 'tipo_evento', 'categoria_tarea', 'etiqueta',
                  'etapa_implementacion', 'canal_ticket', 'categoria_ticket', 'modulo', 'tipo_documento'));

insert into interno_listas (tipo, clave, nombre, orden) values
  ('tipo_documento', 'procedimiento', 'Procedimiento', 1), ('tipo_documento', 'manual', 'Manual', 2),
  ('tipo_documento', 'guion_comercial', 'Guion comercial', 3), ('tipo_documento', 'guion_demo', 'Guion de demo', 4),
  ('tipo_documento', 'propuesta', 'Propuesta', 5), ('tipo_documento', 'reunion', 'Reunión', 6), ('tipo_documento', 'acta', 'Acta', 7),
  ('tipo_documento', 'decision', 'Decisión de producto', 8), ('tipo_documento', 'idea', 'Idea', 9),
  ('tipo_documento', 'investigacion', 'Investigación', 10), ('tipo_documento', 'nota', 'Nota', 11),
  ('tipo_documento', 'administrativo', 'Proceso administrativo', 12), ('tipo_documento', 'capacitacion', 'Material de capacitación', 13),
  ('tipo_documento', 'caso_de_uso', 'Caso de uso', 14), ('tipo_documento', 'tecnico', 'Documentación técnica', 15)
on conflict (tipo, clave) do nothing;


/* ---------- Versiones ---------- */
create table interno_versiones (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null unique,
  objetivo         text,
  fecha_objetivo   date,
  estado           text not null default 'planificada',
  lanzada_en       timestamptz,
  notas            text,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_versiones_nombre check (length(btrim(nombre)) between 1 and 40),
  constraint interno_versiones_estado check (estado in ('planificada', 'en_curso', 'lanzada', 'descartada'))
);

create or replace function interno_version_estado()
returns trigger language plpgsql as $$
begin
  new.lanzada_en := case when new.estado = 'lanzada' then coalesce(new.lanzada_en, now()) end;
  return new;
end;
$$;
create trigger interno_versiones_estado before insert or update of estado on interno_versiones
  for each row execute function interno_version_estado();


/* ---------- Proyectos ---------- */
create table interno_proyectos (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  descripcion         text,
  objetivo            text,
  categoria           text,
  estado              text not null default 'idea',
  prioridad           text not null default 'normal',
  inicio              date,
  fin_estimado        date,
  completado_en       timestamptz,
  responsable_id      uuid references perfiles(id) on delete set null,
  riesgos             text,
  dependencias        text,
  resultado_esperado  text,
  archivado_en        timestamptz,
  creado_en           timestamptz not null default now(),
  creado_por          uuid references perfiles(id) on delete set null,
  actualizado_en      timestamptz not null default now(),
  actualizado_por     uuid references perfiles(id) on delete set null,
  constraint interno_proyectos_nombre check (length(btrim(nombre)) between 1 and 120),
  constraint interno_proyectos_estado check (estado in ('idea', 'planificado', 'en_curso', 'en_prueba', 'pausado', 'completado', 'cancelado')),
  constraint interno_proyectos_prioridad check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  constraint interno_proyectos_fechas check (fin_estimado is null or inicio is null or fin_estimado >= inicio)
);
comment on column interno_proyectos.categoria is 'Una clave de interno_listas categoria_tarea: el área de la empresa (comercial, producto, marketing…).';

create or replace function interno_proyecto_estado()
returns trigger language plpgsql as $$
begin
  new.completado_en := case when new.estado = 'completado' then coalesce(new.completado_en, now()) end;
  return new;
end;
$$;
create trigger interno_proyectos_estado before insert or update of estado on interno_proyectos
  for each row execute function interno_proyecto_estado();


/* ---------- El roadmap ---------- */
create table interno_roadmap (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null default 'mejora',
  titulo           text not null,
  descripcion      text,
  problema         text,
  afectados        text,
  modulo           text,
  prioridad        text not null default 'normal',
  impacto          text,
  complejidad      text,
  estado           text not null default 'idea',
  orden            integer not null default 0,
  responsable_id   uuid references perfiles(id) on delete set null,
  version_id       uuid references interno_versiones(id) on delete set null,
  proyecto_id      uuid references interno_proyectos(id) on delete set null,
  cliente_id       uuid references interno_clientes(id) on delete set null,
  criterios        text,
  pruebas          text,
  entorno          text,
  pasos            text,
  esperado         text,
  actual           text,
  gravedad         text,
  solucion         text,
  terminado_en     timestamptz,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_roadmap_titulo check (length(btrim(titulo)) between 1 and 200),
  constraint interno_roadmap_tipo check (tipo in ('idea', 'funcionalidad', 'mejora', 'bug', 'solicitud', 'deuda', 'integracion')),
  constraint interno_roadmap_estado check (estado in ('idea', 'analisis', 'planificado', 'en_desarrollo', 'en_prueba', 'lanzado', 'descartado')),
  constraint interno_roadmap_prioridad check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  constraint interno_roadmap_impacto check (impacto is null or impacto in ('bajo', 'medio', 'alto')),
  constraint interno_roadmap_complejidad check (complejidad is null or complejidad in ('chica', 'media', 'grande', 'muy_grande')),
  constraint interno_roadmap_gravedad check (gravedad is null or gravedad in ('menor', 'moderada', 'grave', 'critica'))
);
comment on column interno_roadmap.version_id is 'La versión en la que sale (o, en un bug, en la que se corrigió).';
create index on interno_roadmap (estado, orden) where archivado_en is null;

create or replace function interno_roadmap_estado()
returns trigger language plpgsql as $$
begin
  new.terminado_en := case when new.estado in ('lanzado', 'descartado') then coalesce(case when tg_op = 'UPDATE' then old.terminado_en end, now()) end;
  return new;
end;
$$;
create trigger interno_roadmap_estado before insert or update of estado on interno_roadmap
  for each row execute function interno_roadmap_estado();

/* Qué tickets (y por lo tanto qué clientes) piden o sufren cada cosa. */
create table interno_roadmap_tickets (
  roadmap_id       uuid not null references interno_roadmap(id) on delete restrict,
  ticket_id        uuid not null references interno_tickets(id) on delete restrict,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  primary key (roadmap_id, ticket_id)
);

/* Tareas de un proyecto o de un elemento del roadmap. */
alter table interno_tareas add column proyecto_id uuid references interno_proyectos(id) on delete set null;
alter table interno_tareas add column roadmap_id uuid references interno_roadmap(id) on delete set null;
create index on interno_tareas (proyecto_id) where proyecto_id is not null;
create index on interno_tareas (roadmap_id) where roadmap_id is not null;

/* De un ticket a producto, en un paso: el elemento copia lo que sirve
   (título, descripción, pasos, módulo, gravedad, cliente) y queda atado
   al ticket. Security invoker: hace falta ver el ticket (soporte) y poder
   escribir en el roadmap (producto); las políticas deciden. */
create or replace function interno_ticket_a_producto(p_ticket uuid, p_tipo text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare t record; v_id uuid;
begin
  select * into t from interno_tickets where id = p_ticket;
  if not found then raise exception 'No existe el ticket, o no tenés acceso a soporte' using errcode = '42501'; end if;
  insert into interno_roadmap (tipo, titulo, descripcion, pasos, modulo, gravedad, cliente_id, prioridad, estado)
  values (coalesce(p_tipo, case when t.categoria = 'error' then 'bug' else 'solicitud' end), t.titulo, t.descripcion, t.pasos, t.modulo,
          case when coalesce(p_tipo, case when t.categoria = 'error' then 'bug' end) = 'bug' then t.gravedad end, t.cliente_id, t.prioridad, 'idea')
  returning id into v_id;
  insert into interno_roadmap_tickets (roadmap_id, ticket_id) values (v_id, p_ticket);
  return v_id;
end;
$$;


/* ---------- Documentos ---------- */
/* array_to_string no es inmutable (depende de cómo se escribe cada tipo),
   y una columna generada lo exige. Para text[] el resultado no cambia
   nunca: se declara inmutable acá. */
create or replace function interno_etiquetas_texto(t text[])
returns text language sql immutable as $$ select coalesce(array_to_string(t, ' '), '') $$;

create table interno_documentos (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  tipo             text not null default 'nota',
  categoria        text,
  contenido        text not null default '',
  etiquetas        text[] not null default '{}',
  estado           text not null default 'borrador',
  version          integer not null default 1,
  modulo           text,
  proyecto_id      uuid references interno_proyectos(id) on delete set null,
  cliente_id       uuid references interno_clientes(id) on delete set null,
  roadmap_id       uuid references interno_roadmap(id) on delete set null,
  tarea_id         uuid references interno_tareas(id) on delete set null,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  busqueda         tsvector generated always as (
                     setweight(to_tsvector('spanish', coalesce(titulo, '')), 'A') ||
                     setweight(to_tsvector('spanish', interno_etiquetas_texto(etiquetas)), 'A') ||
                     setweight(to_tsvector('spanish', coalesce(contenido, '')), 'B')) stored,
  constraint interno_documentos_titulo check (length(btrim(titulo)) between 1 and 200),
  constraint interno_documentos_estado check (estado in ('borrador', 'vigente', 'obsoleto')),
  /* Un documento no es un archivo: lo pesado va a Storage. */
  constraint interno_documentos_largo check (length(contenido) <= 200000)
);
create index on interno_documentos using gin (busqueda);

create table interno_documentos_versiones (
  id               bigint generated always as identity primary key,
  documento_id     uuid not null references interno_documentos(id) on delete restrict,
  version          integer not null,
  titulo           text not null,
  contenido        text not null,
  fecha            timestamptz not null default now(),
  quien            uuid references perfiles(id) on delete set null,
  unique (documento_id, version)
);

/* Cambiar el título o el contenido guarda lo anterior y sube la versión.
   Lo escribe la base (security definer): la tabla de versiones no tiene
   política de escritura, así nadie reescribe el pasado. */
create or replace function interno_documento_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.contenido is distinct from old.contenido or new.titulo is distinct from old.titulo then
    insert into interno_documentos_versiones (documento_id, version, titulo, contenido, fecha, quien)
    values (old.id, old.version, old.titulo, old.contenido, old.actualizado_en, old.actualizado_por);
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end;
$$;
create trigger interno_documentos_version before update on interno_documentos
  for each row execute function interno_documento_version();


/* ---------- Adjuntos de estas tablas ---------- */
alter table interno_adjuntos drop constraint interno_adjuntos_tabla;
alter table interno_adjuntos add constraint interno_adjuntos_tabla
  check (tabla in ('interno_clientes', 'interno_impl_etapas', 'interno_tickets', 'interno_proyectos', 'interno_roadmap', 'interno_documentos'));


/* ---------- Sellos, historial y permisos ---------- */
do $$
declare t text; area text;
begin
  foreach t in array array['interno_versiones', 'interno_proyectos', 'interno_roadmap', 'interno_documentos'] loop
    area := case when t = 'interno_documentos' then 'docs' else 'producto' end;
    execute format('create trigger %I before insert or update on %I for each row execute function interno_sellar()', t || '_sello', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function interno_anotar()', t || '_historial', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (es_interno(%L))', t || '_ver', t, area);
    execute format('create policy %I on %I for insert with check (es_interno(%L))', t || '_crear', t, area);
    execute format('create policy %I on %I for update using (es_interno(%L)) with check (es_interno(%L))', t || '_editar', t, area, area);
    execute format('revoke all on %I from anon', t);
    execute format('revoke delete, truncate, references, trigger on %I from authenticated', t);
  end loop;
end;
$$;

/* La relación con tickets se agrega y se saca (no es historia: es un
   vínculo), y la escribe quien tiene producto. */
alter table interno_roadmap_tickets enable row level security;
create policy interno_roadmap_tickets_ver on interno_roadmap_tickets for select using (es_interno('producto') or es_interno('soporte'));
create policy interno_roadmap_tickets_crear on interno_roadmap_tickets for insert with check (es_interno('producto'));
create policy interno_roadmap_tickets_sacar on interno_roadmap_tickets for delete using (es_interno('producto'));
create or replace function interno_roadmap_tickets_sellar()
returns trigger language plpgsql as $$ begin new.creado_en := now(); new.creado_por := auth.uid(); return new; end; $$;
create trigger interno_roadmap_tickets_sello before insert on interno_roadmap_tickets for each row execute function interno_roadmap_tickets_sellar();
revoke all on interno_roadmap_tickets from anon;
revoke update, truncate, references, trigger on interno_roadmap_tickets from authenticated;

alter table interno_documentos_versiones enable row level security;
create policy interno_documentos_versiones_ver on interno_documentos_versiones for select using (es_interno('docs'));
revoke all on interno_documentos_versiones from anon;
revoke insert, update, delete, truncate, references, trigger on interno_documentos_versiones from authenticated;


/* ---------- Las vistas ---------- */
create or replace view interno_roadmap_vista with (security_invoker = true) as
select r.*, v.nombre as version_nombre, v.estado as version_estado, pr.nombre as proyecto_nombre, pp.nombre as cliente_nombre,
       (select count(*) from interno_roadmap_tickets x where x.roadmap_id = r.id)::int as tickets,
       (select count(distinct t.cliente_id) from interno_roadmap_tickets x join interno_tickets t on t.id = x.ticket_id
         where x.roadmap_id = r.id and t.cliente_id is not null)::int as clientes_que_piden,
       (select count(*) from interno_tareas t where t.roadmap_id = r.id and t.archivado_en is null
         and t.estado in ('pendiente', 'en_curso', 'en_espera'))::int as tareas_abiertas
  from interno_roadmap r
  left join interno_versiones v on v.id = r.version_id
  left join interno_proyectos pr on pr.id = r.proyecto_id
  left join interno_clientes c on c.id = r.cliente_id
  left join interno_prospectos pp on pp.id = c.prospecto_id;

create or replace view interno_proyectos_vista with (security_invoker = true) as
select p.*,
       (select count(*) from interno_tareas t where t.proyecto_id = p.id and t.archivado_en is null and t.estado <> 'cancelada')::int as tareas_total,
       (select count(*) from interno_tareas t where t.proyecto_id = p.id and t.archivado_en is null and t.estado = 'completada')::int as tareas_hechas,
       (select count(*) from interno_roadmap r where r.proyecto_id = p.id and r.archivado_en is null)::int as elementos,
       (select count(*) from interno_roadmap r where r.proyecto_id = p.id and r.archivado_en is null and r.estado in ('lanzado', 'descartado'))::int as elementos_terminados
  from interno_proyectos p;

revoke all on interno_roadmap_vista, interno_proyectos_vista from anon;


/* ---------- Funciones ---------- */
revoke execute on function interno_ticket_a_producto(uuid, text) from public, anon;
grant execute on function interno_ticket_a_producto(uuid, text) to authenticated;
revoke execute on function interno_version_estado(), interno_proyecto_estado(), interno_roadmap_estado(),
  interno_documento_version(), interno_roadmap_tickets_sellar() from public, anon, authenticated;
revoke execute on function interno_etiquetas_texto(text[]) from public, anon;
grant execute on function interno_etiquetas_texto(text[]) to authenticated;
