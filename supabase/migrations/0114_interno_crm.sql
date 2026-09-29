/* ============================================================
   0114 · GENEZ FOUNDER, el CRM y la agenda
   ============================================================

   Prospectos, contactos, oportunidades, la línea de tiempo de cada
   relación, tareas y agenda. Todo detrás de la frontera de 0113:
   es_interno('crm') para lo comercial, es_interno('tareas') y
   es_interno('agenda') para lo suyo, nada para anon, sin borrar
   (se archiva), quién y cuándo lo pone la base, y cada cambio al
   historial.

   EL PROSPECTO ES EL NEGOCIO; LA OPORTUNIDAD, LA VENTA
   ----------------------------------------------------
   El prospecto guarda quién es (el comercio, dónde está, cómo se lo
   contacta, qué le duele) y el seguimiento (último contacto, próximo,
   próxima acción). La oportunidad es lo que se le quiere vender, y es
   la que recorre las etapas del pipeline. Al crear un prospecto nace
   su primera oportunidad en la primera etapa: así ningún prospecto
   queda fuera del tablero. Cuando se gane, el mismo prospecto pasa a
   cliente (fase 3) sin copiar nada.

   LA LÍNEA DE TIEMPO SE ESCRIBE SOLA DONDE PUEDE
   ----------------------------------------------
   Cambiar una oportunidad de etapa anota la actividad "cambio de
   etapa" con el antes y el después. Registrar un contacto actualiza el
   último contacto del prospecto y, si trae próxima acción, el próximo.
   Lo hace la base, no la pantalla: si se mueve desde otro lado, igual
   queda.

   DUPLICADOS
   ----------
   Cada prospecto guarda su teléfono, mail y nombre normalizados, con
   índice. interno_posibles_duplicados() devuelve los que coinciden
   antes de crear uno; no fusiona nada solo.

   TAREAS QUE SE REPITEN
   ---------------------
   Al completar una tarea con repetición se crea la siguiente, una sola
   vez (la serie y el vencimiento no se pueden repetir): cargar la
   pantalla no genera nada, y completarla dos veces tampoco.
   ============================================================ */

/* ---------- Normalizar para comparar ---------- */
create or replace function interno_norm_texto(t text)
returns text language sql immutable as $$
  select nullif(regexp_replace(lower(translate(coalesce(t, ''),
    'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', '', 'g'), '')
$$;
/* Los últimos 10 dígitos: +54 9 11 5555-1234 y 11 5555 1234 son el mismo. */
create or replace function interno_norm_tel(t text)
returns text language sql immutable as $$
  select nullif(right(regexp_replace(coalesce(t, ''), '\D', '', 'g'), 10), '')
$$;


/* ---------- Prospectos ---------- */
create table interno_prospectos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  razon_social    text,
  rubro           text,
  subrubro        text,
  descripcion     text,
  sucursales      integer,
  direccion       text,
  localidad       text,
  zona            text,
  lat             numeric(9,6),
  lng             numeric(9,6),
  telefono        text,
  whatsapp        text,
  email           text,
  instagram       text,
  web             text,
  otros_canales   text,
  fuente          text,
  campania        text,
  sistema_actual  text,
  problemas       text,
  necesidades     text,
  modulos         text[] not null default '{}',
  usuarios        integer,
  tamano          text,
  interes         text,
  presupuesto     numeric(14,2),
  objeciones      text,
  competidor      text,
  notas           text,
  ultimo_contacto timestamptz,
  proximo_contacto timestamptz,
  proxima_accion  text,
  motivo_pausa    text,
  etiquetas       text[] not null default '{}',
  campos_extra    jsonb not null default '{}',
  responsable_id  uuid references perfiles(id) on delete set null,
  solicitud_id    uuid references solicitudes(id) on delete set null,
  empresa_id      uuid references empresas(id) on delete set null,
  cliente_desde   timestamptz,
  tel_norm        text,
  email_norm      text,
  nombre_norm     text,
  localidad_norm  text,
  archivado_en    timestamptz,
  creado_en       timestamptz not null default now(),
  creado_por      uuid references perfiles(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references perfiles(id) on delete set null,
  constraint interno_prospectos_nombre check (length(btrim(nombre)) between 1 and 120),
  constraint interno_prospectos_tamano check (tamano is null or tamano in ('chico', 'mediano', 'grande')),
  constraint interno_prospectos_interes check (interes is null or interes in ('frio', 'tibio', 'caliente')),
  constraint interno_prospectos_sucursales check (sucursales is null or sucursales between 1 and 999)
);
comment on column interno_prospectos.empresa_id is
  'El comercio de Genez en el que se convirtió, cuando se gana (fase 3). Enlaza, no copia.';
create index on interno_prospectos (tel_norm) where tel_norm is not null;
create index on interno_prospectos (email_norm) where email_norm is not null;
create index on interno_prospectos (nombre_norm, localidad_norm);
create index on interno_prospectos (proximo_contacto) where archivado_en is null;
create index on interno_prospectos (zona, rubro) where archivado_en is null;

create or replace function interno_prospecto_normalizar()
returns trigger language plpgsql as $$
begin
  new.tel_norm := coalesce(interno_norm_tel(new.telefono), interno_norm_tel(new.whatsapp));
  new.email_norm := nullif(lower(btrim(coalesce(new.email, ''))), '');
  new.nombre_norm := interno_norm_texto(new.nombre);
  new.localidad_norm := interno_norm_texto(coalesce(new.localidad, new.zona));
  if tg_op = 'INSERT' and new.responsable_id is null then new.responsable_id := auth.uid(); end if;
  return new;
end;
$$;
create trigger interno_prospectos_normalizar before insert or update on interno_prospectos for each row execute function interno_prospecto_normalizar();


/* ---------- Contactos ---------- */
create table interno_contactos (
  id              uuid primary key default gen_random_uuid(),
  prospecto_id    uuid not null references interno_prospectos(id) on delete restrict,
  nombre          text not null,
  cargo           text,
  telefono        text,
  whatsapp        text,
  email           text,
  principal       boolean not null default false,
  notas           text,
  archivado_en    timestamptz,
  creado_en       timestamptz not null default now(),
  creado_por      uuid references perfiles(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references perfiles(id) on delete set null,
  constraint interno_contactos_nombre check (length(btrim(nombre)) between 1 and 120)
);
create index on interno_contactos (prospecto_id);


/* ---------- Oportunidades ---------- */
create table interno_oportunidades (
  id               uuid primary key default gen_random_uuid(),
  prospecto_id     uuid not null references interno_prospectos(id) on delete restrict,
  nombre           text not null,
  etapa_id         uuid not null references interno_etapas(id),
  valor            numeric(14,2) not null default 0,
  plan             text,
  modulos          text[] not null default '{}',
  cierre_estimado  date,
  probabilidad     integer not null default 0,
  proxima_accion   text,
  fecha_seguimiento timestamptz,
  estado           text not null default 'abierta',
  responsable_id   uuid references perfiles(id) on delete set null,
  motivo_perdida   text,
  ganada_en        timestamptz,
  cerrada_en       timestamptz,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_oportunidades_nombre check (length(btrim(nombre)) between 1 and 120),
  constraint interno_oportunidades_valor check (valor >= 0),
  constraint interno_oportunidades_prob check (probabilidad between 0 and 100),
  constraint interno_oportunidades_estado check (estado in ('abierta', 'ganada', 'perdida', 'pausada'))
);
comment on column interno_oportunidades.valor is
  'Lo que se espera cobrar por mes si se gana. El pipeline ponderado es valor × probabilidad: una estimación, nunca plata cobrada.';
create index on interno_oportunidades (etapa_id) where archivado_en is null;
create index on interno_oportunidades (prospecto_id);
create index on interno_oportunidades (fecha_seguimiento) where estado = 'abierta';


/* ---------- La línea de tiempo ---------- */
create table interno_actividades (
  id              uuid primary key default gen_random_uuid(),
  prospecto_id    uuid not null references interno_prospectos(id) on delete restrict,
  oportunidad_id  uuid references interno_oportunidades(id) on delete set null,
  tipo            text not null,
  fecha           timestamptz not null default now(),
  resultado       text,
  notas           text,
  proxima_accion  text,
  proxima_fecha   timestamptz,
  evento_id       uuid,
  datos           jsonb not null default '{}',
  creado_en       timestamptz not null default now(),
  creado_por      uuid references perfiles(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references perfiles(id) on delete set null,
  constraint interno_actividades_tipo check (tipo ~ '^[a-z0-9_]{1,40}$')
);
comment on column interno_actividades.tipo is
  'Una clave de interno_listas tipo_actividad (llamada, whatsapp, visita, demo, nota…) o cambio_etapa, que escribe la base.';
create index on interno_actividades (prospecto_id, fecha desc);
create index on interno_actividades (fecha desc);


/* ---------- Tareas ---------- */
create table interno_tareas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descripcion     text,
  estado          text not null default 'pendiente',
  prioridad       text not null default 'normal',
  inicio          date,
  vence           timestamptz,
  completada_en   timestamptz,
  responsable_id  uuid references perfiles(id) on delete set null,
  categoria       text,
  prospecto_id    uuid references interno_prospectos(id) on delete set null,
  oportunidad_id  uuid references interno_oportunidades(id) on delete set null,
  evento_id       uuid,
  repeticion      jsonb,
  serie_id        uuid,
  etiquetas       text[] not null default '{}',
  checklist       jsonb not null default '[]',
  bloqueo         text,
  archivado_en    timestamptz,
  creado_en       timestamptz not null default now(),
  creado_por      uuid references perfiles(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references perfiles(id) on delete set null,
  constraint interno_tareas_titulo check (length(btrim(titulo)) between 1 and 200),
  constraint interno_tareas_estado check (estado in ('pendiente', 'en_curso', 'en_espera', 'completada', 'cancelada')),
  constraint interno_tareas_prioridad check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  constraint interno_tareas_repeticion check (repeticion is null or (repeticion ->> 'cada') in ('dia', 'semana', 'mes')),
  constraint interno_tareas_checklist check (jsonb_typeof(checklist) = 'array')
);
comment on column interno_tareas.repeticion is
  '{ cada: dia|semana|mes, intervalo: n, hasta?: fecha }. Al completarla se crea la siguiente de la misma serie, una sola vez.';
create index on interno_tareas (vence) where estado in ('pendiente', 'en_curso', 'en_espera');
create index on interno_tareas (prospecto_id) where prospecto_id is not null;
create unique index interno_tareas_serie_una on interno_tareas (serie_id, vence) where serie_id is not null;


/* ---------- Agenda ---------- */
create table interno_eventos (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  tipo            text not null default 'reunion',
  inicio          timestamptz not null,
  fin             timestamptz not null,
  zona_horaria    text not null default 'America/Argentina/Buenos_Aires',
  descripcion     text,
  lugar           text,
  link            text,
  prospecto_id    uuid references interno_prospectos(id) on delete set null,
  oportunidad_id  uuid references interno_oportunidades(id) on delete set null,
  tarea_id        uuid references interno_tareas(id) on delete set null,
  recordatorio_min integer,
  estado          text not null default 'programado',
  resultado       text,
  notas_post      text,
  responsable_id  uuid references perfiles(id) on delete set null,
  archivado_en    timestamptz,
  creado_en       timestamptz not null default now(),
  creado_por      uuid references perfiles(id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references perfiles(id) on delete set null,
  constraint interno_eventos_titulo check (length(btrim(titulo)) between 1 and 200),
  constraint interno_eventos_tipo check (tipo ~ '^[a-z0-9_]{1,40}$'),
  constraint interno_eventos_fechas check (fin >= inicio),
  constraint interno_eventos_estado check (estado in ('programado', 'realizado', 'cancelado')),
  constraint interno_eventos_link check (link is null or link ~* '^https?://')
);
comment on column interno_eventos.estado is
  'Pasar el horario no lo marca realizado: realizado es cuando alguien registra el resultado.';
create index on interno_eventos (inicio);
create index on interno_eventos (prospecto_id) where prospecto_id is not null;

alter table interno_actividades add constraint interno_actividades_evento foreign key (evento_id) references interno_eventos(id) on delete set null;
alter table interno_tareas add constraint interno_tareas_evento foreign key (evento_id) references interno_eventos(id) on delete set null;


/* ---------- Lo que escribe la base ---------- */

/* La primera oportunidad de cada prospecto, en la primera etapa. */
create or replace function interno_prospecto_primera_oportunidad()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_etapa uuid; v_prob integer;
begin
  select id, probabilidad into v_etapa, v_prob from interno_etapas where activa and tipo = 'abierta' order by orden limit 1;
  if v_etapa is not null then
    insert into interno_oportunidades (prospecto_id, nombre, etapa_id, probabilidad, responsable_id, creado_por, actualizado_por)
    values (new.id, 'Genez para ' || new.nombre, v_etapa, coalesce(v_prob, 0), new.responsable_id, auth.uid(), auth.uid());
  end if;
  return new;
end;
$$;
create trigger interno_prospectos_oportunidad after insert on interno_prospectos for each row execute function interno_prospecto_primera_oportunidad();

/* Etapa → estado y probabilidad, y el cambio a la línea de tiempo. */
create or replace function interno_oportunidad_etapa()
returns trigger language plpgsql security definer set search_path = public as $$
declare e record; antes text;
begin
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then return new; end if;
  select nombre, tipo, probabilidad into e from interno_etapas where id = new.etapa_id;
  new.estado := e.tipo;
  new.probabilidad := e.probabilidad;
  if e.tipo = 'ganada' then new.ganada_en := coalesce(new.ganada_en, now()); end if;
  if e.tipo in ('ganada', 'perdida') then new.cerrada_en := now(); else new.cerrada_en := null; end if;
  if e.tipo <> 'perdida' then new.motivo_perdida := null; end if;
  if tg_op = 'UPDATE' then
    select nombre into antes from interno_etapas where id = old.etapa_id;
    insert into interno_actividades (prospecto_id, oportunidad_id, tipo, resultado, datos, creado_por, actualizado_por)
    values (new.prospecto_id, new.id, 'cambio_etapa', antes || ' → ' || e.nombre,
            jsonb_build_object('de', old.etapa_id, 'a', new.etapa_id, 'de_nombre', antes, 'a_nombre', e.nombre, 'motivo', new.motivo_perdida),
            auth.uid(), auth.uid());
  end if;
  return new;
end;
$$;
create trigger interno_oportunidades_etapa before insert or update of etapa_id on interno_oportunidades for each row execute function interno_oportunidad_etapa();

/* Un contacto actualiza el seguimiento del prospecto. */
create or replace function interno_actividad_seguimiento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tipo in ('cambio_etapa', 'nota') then return new; end if;
  update interno_prospectos set
    ultimo_contacto = greatest(coalesce(ultimo_contacto, new.fecha), new.fecha),
    proximo_contacto = case when new.proxima_fecha is not null then new.proxima_fecha else proximo_contacto end,
    proxima_accion = case when new.proxima_fecha is not null or new.proxima_accion is not null then new.proxima_accion else proxima_accion end
  where id = new.prospecto_id;
  if new.oportunidad_id is not null and (new.proxima_fecha is not null or new.proxima_accion is not null) then
    update interno_oportunidades set proxima_accion = new.proxima_accion, fecha_seguimiento = new.proxima_fecha where id = new.oportunidad_id;
  end if;
  return new;
end;
$$;
create trigger interno_actividades_seguimiento after insert on interno_actividades for each row execute function interno_actividad_seguimiento();

/* Tareas: completarla sella la fecha y, si se repite, crea la siguiente. */
create or replace function interno_tarea_estado()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  paso interval;
  siguiente timestamptz;
begin
  if new.estado = 'completada' and (tg_op = 'INSERT' or old.estado <> 'completada') then
    new.completada_en := now();
  elsif new.estado <> 'completada' then
    new.completada_en := null;
  end if;
  if new.repeticion is not null and new.serie_id is null then new.serie_id := new.id; end if;
  if tg_op = 'UPDATE' and new.estado = 'completada' and old.estado <> 'completada' and new.repeticion is not null then
    paso := case new.repeticion ->> 'cada' when 'dia' then interval '1 day' when 'semana' then interval '7 days' else interval '1 month' end
            * greatest(1, coalesce((new.repeticion ->> 'intervalo')::int, 1));
    siguiente := coalesce(new.vence, now()) + paso;
    if (new.repeticion ->> 'hasta') is null or siguiente::date <= (new.repeticion ->> 'hasta')::date then
      insert into interno_tareas (titulo, descripcion, prioridad, vence, responsable_id, categoria, prospecto_id, oportunidad_id,
                                  repeticion, serie_id, etiquetas, checklist, creado_por, actualizado_por)
      values (new.titulo, new.descripcion, new.prioridad, siguiente, new.responsable_id, new.categoria, new.prospecto_id, new.oportunidad_id,
              new.repeticion, new.serie_id, new.etiquetas,
              coalesce((select jsonb_agg(x || jsonb_build_object('hecho', false)) from jsonb_array_elements(new.checklist) x), '[]'::jsonb),
              auth.uid(), auth.uid())
      on conflict (serie_id, vence) where serie_id is not null do nothing;
    end if;
  end if;
  if tg_op = 'INSERT' and new.responsable_id is null then new.responsable_id := auth.uid(); end if;
  return new;
end;
$$;
create trigger interno_tareas_estado before insert or update on interno_tareas for each row execute function interno_tarea_estado();

create or replace function interno_evento_responsable()
returns trigger language plpgsql as $$
begin
  if new.responsable_id is null then new.responsable_id := auth.uid(); end if;
  return new;
end;
$$;
create trigger interno_eventos_responsable before insert on interno_eventos for each row execute function interno_evento_responsable();


/* ---------- Sellos, historial y permisos ---------- */
do $$
declare t text; area text;
begin
  foreach t in array array['interno_prospectos', 'interno_contactos', 'interno_oportunidades', 'interno_actividades', 'interno_tareas', 'interno_eventos'] loop
    area := case t when 'interno_tareas' then 'tareas' when 'interno_eventos' then 'agenda' else 'crm' end;
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


/* ---------- Duplicados, antes de crear ---------- */
create or replace function interno_posibles_duplicados(p_nombre text, p_localidad text, p_telefono text, p_email text, p_excluir uuid default null)
returns table (id uuid, nombre text, localidad text, telefono text, email text, motivo text)
language sql stable security invoker set search_path = public as $$
  select p.id, p.nombre, p.localidad, coalesce(p.telefono, p.whatsapp), p.email,
         case when interno_norm_tel(p_telefono) is not null and p.tel_norm = interno_norm_tel(p_telefono) then 'teléfono'
              when nullif(lower(btrim(coalesce(p_email, ''))), '') is not null and p.email_norm = lower(btrim(p_email)) then 'email'
              else 'nombre y localidad' end
    from interno_prospectos p
   where p.archivado_en is null
     and (p_excluir is null or p.id <> p_excluir)
     and ((interno_norm_tel(p_telefono) is not null and p.tel_norm = interno_norm_tel(p_telefono))
       or (nullif(lower(btrim(coalesce(p_email, ''))), '') is not null and p.email_norm = lower(btrim(p_email)))
       or (interno_norm_texto(p_nombre) is not null and p.nombre_norm = interno_norm_texto(p_nombre)
           and (interno_norm_texto(p_localidad) is null or p.localidad_norm is null or p.localidad_norm = interno_norm_texto(p_localidad))))
   limit 10
$$;

/* ---------- La vista del prospecto con su oportunidad abierta ---------- */
create or replace view interno_prospectos_vista with (security_invoker = true) as
select p.*,
       o.id as oportunidad_id, o.nombre as oportunidad_nombre, o.etapa_id, e.nombre as etapa_nombre, e.orden as etapa_orden,
       o.valor, o.probabilidad, o.estado as oportunidad_estado
  from interno_prospectos p
  left join lateral (
    select * from interno_oportunidades x where x.prospecto_id = p.id and x.archivado_en is null
     order by (x.estado = 'abierta') desc, x.creado_en desc limit 1
  ) o on true
  left join interno_etapas e on e.id = o.etapa_id;

revoke all on interno_prospectos_vista from anon;

revoke execute on function interno_norm_texto(text) from public, anon;
revoke execute on function interno_norm_tel(text) from public, anon;
grant execute on function interno_norm_texto(text), interno_norm_tel(text) to authenticated;
revoke execute on function interno_posibles_duplicados(text, text, text, text, uuid) from public, anon;
grant execute on function interno_posibles_duplicados(text, text, text, text, uuid) to authenticated;
revoke execute on function interno_prospecto_normalizar(), interno_prospecto_primera_oportunidad(), interno_oportunidad_etapa(),
  interno_actividad_seguimiento(), interno_tarea_estado(), interno_evento_responsable() from public, anon, authenticated;
