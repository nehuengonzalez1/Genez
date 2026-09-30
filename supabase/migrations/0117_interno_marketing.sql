/* ============================================================
   0117 · GENEZ FOUNDER, fase 4: objetivos y marketing
   ============================================================

   OBJETIVOS (área 'crm')
   ----------------------
   Un objetivo dice qué se mide, cuánto y entre qué fechas. El valor
   actual NO se guarda: lo calcula interno_objetivo_valor() contando los
   registros reales (prospectos creados, contactos, demos, propuestas,
   ventas, recurrente nuevo, clientes con importe). La única excepción es
   la métrica 'manual', que se carga a mano y la pantalla la muestra como
   carga manual. Así no hay porcentajes inventados.

   Un plan comercial (interno_planes) agrupa objetivos: el del período
   entero y los de cada semana (semana 1 a 5). Sus actividades son tareas
   comunes atadas al objetivo.

   MARKETING (área 'marketing')
   ----------------------------
   El banco de ideas y el calendario editorial son la misma tabla
   (interno_contenidos): una idea es un contenido en estado 'idea'. Las
   métricas se cargan a mano, a los 7 y a los 30 días: no hay integración
   con redes y la pantalla no dice que la haya. Lo que sí es real es lo
   que originó cada contenido: un prospecto puede decir de qué contenido
   vino (interno_prospectos.contenido_id), y de ahí salen las demos y los
   clientes que generó.

   Las grabaciones (interno_grabaciones) planifican la producción; los
   contenidos que salen de una grabación la nombran.
   ============================================================ */

/* ---------- Listas ---------- */
alter table interno_listas drop constraint interno_listas_tipo_valido;
alter table interno_listas add constraint interno_listas_tipo_valido
  check (tipo in ('zona', 'rubro', 'fuente', 'motivo_perdida', 'tipo_actividad', 'tipo_evento', 'categoria_tarea', 'etiqueta',
                  'etapa_implementacion', 'canal_ticket', 'categoria_ticket', 'modulo', 'tipo_documento', 'canal_contenido', 'formato_contenido'));

insert into interno_listas (tipo, clave, nombre, orden) values
  ('canal_contenido', 'instagram', 'Instagram', 1), ('canal_contenido', 'tiktok', 'TikTok', 2), ('canal_contenido', 'youtube', 'YouTube', 3),
  ('canal_contenido', 'linkedin', 'LinkedIn', 4), ('canal_contenido', 'web', 'Sitio web', 5), ('canal_contenido', 'whatsapp', 'WhatsApp', 6),
  ('canal_contenido', 'otro', 'Otro', 9),
  ('formato_contenido', 'reel', 'Reel', 1), ('formato_contenido', 'historia', 'Historia', 2), ('formato_contenido', 'carrusel', 'Carrusel', 3),
  ('formato_contenido', 'post', 'Post', 4), ('formato_contenido', 'video_largo', 'Video largo', 5), ('formato_contenido', 'caso_exito', 'Caso de éxito', 6),
  ('formato_contenido', 'testimonio', 'Testimonio', 7), ('formato_contenido', 'tutorial', 'Tutorial', 8), ('formato_contenido', 'demo', 'Demo', 9),
  ('formato_contenido', 'anuncio', 'Anuncio', 10), ('formato_contenido', 'articulo', 'Artículo', 11), ('formato_contenido', 'email', 'Email', 12)
on conflict (tipo, clave) do nothing;


/* ---------- Planes y objetivos ---------- */
create table interno_planes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  descripcion      text,
  inicio           date not null,
  fin              date not null,
  estado           text not null default 'activo',
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_planes_nombre check (length(btrim(nombre)) between 1 and 120),
  constraint interno_planes_fechas check (fin >= inicio),
  constraint interno_planes_estado check (estado in ('activo', 'terminado', 'cancelado'))
);

create table interno_objetivos (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  descripcion      text,
  metrica          text not null,
  valor_objetivo   numeric(14,2) not null,
  valor_manual     numeric(14,2),
  periodo          text not null default 'mensual',
  inicio           date not null,
  limite           date not null,
  responsable_id   uuid references perfiles(id) on delete set null,
  estado           text not null default 'activo',
  plan_id          uuid references interno_planes(id) on delete set null,
  semana           integer,
  proyecto_id      uuid references interno_proyectos(id) on delete set null,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_objetivos_nombre check (length(btrim(nombre)) between 1 and 120),
  constraint interno_objetivos_metrica check (metrica in ('prospectos', 'contactos', 'demos', 'propuestas', 'ventas', 'recurrente', 'clientes', 'manual')),
  constraint interno_objetivos_valor check (valor_objetivo > 0),
  /* La carga manual solo existe en la métrica manual: en las demás el
     valor sale de los registros y no se puede pisar. */
  constraint interno_objetivos_manual check (metrica = 'manual' or valor_manual is null),
  constraint interno_objetivos_periodo check (periodo in ('diario', 'semanal', 'mensual', 'trimestral', 'anual', 'otro')),
  constraint interno_objetivos_fechas check (limite >= inicio),
  constraint interno_objetivos_estado check (estado in ('activo', 'pausado', 'cancelado')),
  constraint interno_objetivos_semana check (semana is null or semana between 1 and 6)
);
comment on column interno_objetivos.metrica is
  'Qué se cuenta entre inicio y límite (hora de Buenos Aires): prospectos creados, contactos registrados, demos, propuestas, ventas ganadas, recurrente de clientes dados de alta, clientes vigentes con importe al límite, o manual.';

/* El valor real de una métrica entre dos días. Security invoker: cuenta
   lo que quien mira puede ver, con las mismas políticas de siempre. */
create or replace function interno_objetivo_valor(p_metrica text, p_inicio date, p_limite date)
returns numeric language plpgsql stable security invoker set search_path = public as $$
declare
  desde timestamptz := (p_inicio::timestamp) at time zone 'America/Argentina/Buenos_Aires';
  hasta timestamptz := ((p_limite + 1)::timestamp) at time zone 'America/Argentina/Buenos_Aires';
begin
  return case p_metrica
    when 'prospectos' then (select count(*) from interno_prospectos where creado_en >= desde and creado_en < hasta)
    when 'contactos' then (select count(*) from interno_actividades where fecha >= desde and fecha < hasta
                            and tipo in ('llamada', 'whatsapp', 'email', 'visita', 'reunion', 'demo', 'propuesta'))
    when 'demos' then (select count(*) from interno_actividades where fecha >= desde and fecha < hasta and tipo = 'demo')
    when 'propuestas' then (select count(*) from interno_actividades where fecha >= desde and fecha < hasta
                             and (tipo = 'propuesta' or (tipo = 'cambio_etapa' and datos ->> 'a_nombre' ilike '%propuesta%')))
    when 'ventas' then (select count(*) from interno_oportunidades where estado = 'ganada' and ganada_en >= desde and ganada_en < hasta)
    when 'recurrente' then (select coalesce(sum(importe_mensual), 0) from interno_clientes
                             where alta between p_inicio and p_limite and estado <> 'cancelado')
    when 'clientes' then (select count(*) from interno_clientes
                           where alta <= p_limite and estado in ('implementacion', 'activo', 'en_riesgo') and importe_mensual > 0)
    else null end;
end;
$$;

alter table interno_tareas add column objetivo_id uuid references interno_objetivos(id) on delete set null;
create index on interno_tareas (objetivo_id) where objetivo_id is not null;


/* ---------- Marketing ---------- */
create table interno_grabaciones (
  id               uuid primary key default gen_random_uuid(),
  fecha            timestamptz,
  tema             text not null,
  guion            text,
  escenas          text,
  recursos         text,
  equipamiento     text,
  notas            text,
  estado           text not null default 'planificada',
  evento_id        uuid references interno_eventos(id) on delete set null,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_grabaciones_tema check (length(btrim(tema)) between 1 and 200),
  constraint interno_grabaciones_estado check (estado in ('planificada', 'grabada', 'editada', 'cancelada'))
);

create table interno_contenidos (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  descripcion      text,
  rubro            text,
  problema         text,
  solucion         text,
  publico          text,
  canal            text,
  formato          text,
  gancho           text,
  cta              text,
  prioridad        text not null default 'normal',
  estado           text not null default 'idea',
  fecha_objetivo   date,
  publicado_en     timestamptz,
  guion            text,
  copy             text,
  recursos         text,
  url              text,
  responsable_id   uuid references perfiles(id) on delete set null,
  grabacion_id     uuid references interno_grabaciones(id) on delete set null,
  orden            integer not null default 0,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_contenidos_titulo check (length(btrim(titulo)) between 1 and 200),
  constraint interno_contenidos_prioridad check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  constraint interno_contenidos_estado check (estado in ('idea', 'planificado', 'guion', 'grabacion', 'edicion', 'revision', 'programado', 'publicado', 'medicion', 'descartado')),
  /* El link publicado se abre con un clic: solo http o https, nunca un javascript:. */
  constraint interno_contenidos_url check (url is null or url ~* '^https?://')
);
create index on interno_contenidos (estado, fecha_objetivo) where archivado_en is null;

/* Publicado: la fecha la pone la base si nadie la escribió, y medir
   también es haber publicado. */
create or replace function interno_contenido_estado()
returns trigger language plpgsql as $$
begin
  if new.estado in ('publicado', 'medicion') then new.publicado_en := coalesce(new.publicado_en, now()); end if;
  return new;
end;
$$;
create trigger interno_contenidos_estado before insert or update of estado on interno_contenidos
  for each row execute function interno_contenido_estado();

create table interno_contenido_metricas (
  id               uuid primary key default gen_random_uuid(),
  contenido_id     uuid not null references interno_contenidos(id) on delete restrict,
  momento          text not null default '7d',
  fecha            date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  visualizaciones  integer, alcance integer, interacciones integer, comentarios integer, guardados integer,
  compartidos      integer, clics integer, consultas integer,
  nota             text,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_contenido_metricas_momento check (momento in ('7d', '30d', 'otro')),
  constraint interno_contenido_metricas_positivas check (
    coalesce(visualizaciones, 0) >= 0 and coalesce(alcance, 0) >= 0 and coalesce(interacciones, 0) >= 0 and coalesce(comentarios, 0) >= 0
    and coalesce(guardados, 0) >= 0 and coalesce(compartidos, 0) >= 0 and coalesce(clics, 0) >= 0 and coalesce(consultas, 0) >= 0)
);
create unique index interno_contenido_metricas_una on interno_contenido_metricas (contenido_id, momento) where momento <> 'otro';
comment on table interno_contenido_metricas is
  'Métricas cargadas a mano (0117): no hay integración con redes. Una de 7 días y una de 30 por contenido; "otro" para lo que haga falta.';

/* De qué contenido vino un prospecto: de ahí salen las demos y los
   clientes que originó cada publicación. */
alter table interno_prospectos add column contenido_id uuid references interno_contenidos(id) on delete set null;
create index on interno_prospectos (contenido_id) where contenido_id is not null;
alter table interno_tareas add column grabacion_id uuid references interno_grabaciones(id) on delete set null;
alter table interno_tareas add column contenido_id uuid references interno_contenidos(id) on delete set null;


/* ---------- Adjuntos de marketing ---------- */
alter table interno_adjuntos drop constraint interno_adjuntos_area;
alter table interno_adjuntos add constraint interno_adjuntos_area check (area in ('clientes', 'soporte', 'producto', 'docs', 'marketing'));
alter table interno_adjuntos drop constraint interno_adjuntos_tabla;
alter table interno_adjuntos add constraint interno_adjuntos_tabla
  check (tabla in ('interno_clientes', 'interno_impl_etapas', 'interno_tickets', 'interno_proyectos', 'interno_roadmap', 'interno_documentos',
                   'interno_contenidos', 'interno_grabaciones'));
/* Las políticas de Storage se reemplazan por otras iguales que suman la
   carpeta de marketing. */
drop policy interno_archivos_ver on storage.objects;
drop policy interno_archivos_subir on storage.objects;
create policy interno_archivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'interno' and (storage.foldername(name))[1] in ('clientes', 'soporte', 'producto', 'docs', 'marketing')
         and es_interno((storage.foldername(name))[1]));
create policy interno_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'interno' and (storage.foldername(name))[1] in ('clientes', 'soporte', 'producto', 'docs', 'marketing')
              and es_interno((storage.foldername(name))[1]));


/* ---------- Sellos, historial y permisos ---------- */
do $$
declare t text; area text;
begin
  foreach t in array array['interno_planes', 'interno_objetivos', 'interno_grabaciones', 'interno_contenidos', 'interno_contenido_metricas'] loop
    area := case when t in ('interno_planes', 'interno_objetivos') then 'crm' else 'marketing' end;
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


/* ---------- Las vistas ---------- */
create or replace view interno_objetivos_vista with (security_invoker = true) as
select o.*,
       case when o.metrica = 'manual' then o.valor_manual else interno_objetivo_valor(o.metrica, o.inicio, o.limite) end as valor_actual,
       (select count(*) from interno_tareas t where t.objetivo_id = o.id and t.archivado_en is null and t.estado <> 'cancelada')::int as tareas_total,
       (select count(*) from interno_tareas t where t.objetivo_id = o.id and t.archivado_en is null and t.estado = 'completada')::int as tareas_hechas
  from interno_objetivos o;

/* El contenido con su última medición y lo que originó. Los conteos
   pasan por las políticas: sin 'crm', lo originado da cero. */
create or replace view interno_contenidos_vista with (security_invoker = true) as
select c.*, g.tema as grabacion_tema,
       m7.visualizaciones as vis_7d, m7.interacciones as int_7d, m7.consultas as consultas_7d,
       m30.visualizaciones as vis_30d, m30.interacciones as int_30d, m30.consultas as consultas_30d,
       (select count(*) from interno_prospectos p where p.contenido_id = c.id)::int as prospectos_originados,
       (select count(distinct a.prospecto_id) from interno_actividades a join interno_prospectos p on p.id = a.prospecto_id
         where p.contenido_id = c.id and a.tipo = 'demo')::int as demos_originadas,
       (select count(*) from interno_clientes k join interno_prospectos p on p.id = k.prospecto_id where p.contenido_id = c.id)::int as clientes_originados
  from interno_contenidos c
  left join interno_grabaciones g on g.id = c.grabacion_id
  left join interno_contenido_metricas m7 on m7.contenido_id = c.id and m7.momento = '7d'
  left join interno_contenido_metricas m30 on m30.contenido_id = c.id and m30.momento = '30d';

revoke all on interno_objetivos_vista, interno_contenidos_vista from anon;

revoke execute on function interno_objetivo_valor(text, date, date) from public, anon;
grant execute on function interno_objetivo_valor(text, date, date) to authenticated;
revoke execute on function interno_contenido_estado() from public, anon, authenticated;
