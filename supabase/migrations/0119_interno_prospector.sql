/* ============================================================
   0119 · GENEZ FOUNDER, prospector: buscar comercios con fuentes autorizadas
   ============================================================

   LOS PROVEEDORES, CON SUS REGLAS ESCRITAS
   ----------------------------------------
   interno_proveedores guarda, para cada fuente, lo que el brief pide
   documentar: licencia, atribución, qué campos se pueden guardar, por
   cuánto tiempo, costo y límites. Hoy son dos: OpenStreetMap (ODbL: se
   puede guardar citando la fuente) y las planillas propias (CSV). Google
   Places no está: sus términos solo dejan guardar el place_id, y se suma
   cuando haya una cuenta y un conector que respete eso.

   UN HALLAZGO NO ES UN PROSPECTO
   ------------------------------
   Lo que trae una búsqueda va a interno_hallazgos, con su proveedor, su
   id en el proveedor y la fecha: la misma tienda encontrada dos veces es
   una fila, que se actualiza (índice único por proveedor e id). Recién
   cuando el fundador lo elige pasa al CRM: como prospecto nuevo, o
   vinculado a uno que ya existe (completando solo lo que falta, sin
   pisar ni duplicar historial).

   El prospecto guarda de dónde vino (origen_proveedor, origen_externo_id)
   y si alguien confirmó los datos (origen_verificado_en): un teléfono de
   OpenStreetMap no está verificado hasta que alguien lo confirma, y la
   ficha lo dice.

   LA BÚSQUEDA LA HACE EL NAVEGADOR
   --------------------------------
   Overpass (la API pública de OpenStreetMap) acepta pedidos del
   navegador. Así no hace falta una función de Vercel (quedan 11 de 12 en
   uso) ni guardar credenciales: no hay ninguna. La base registra cada
   búsqueda, con su resultado o su error.
   ============================================================ */

/* ---------- Las zonas, con su centro ---------- */
/* Coordenadas tomadas de OpenStreetMap el 29/09/2026 (Nominatim y
   Overpass): el nodo de cada localidad o su estación. El radio es el de
   partida para buscar; se cambia en cada búsqueda. */
update interno_listas set datos = datos || jsonb_build_object('lat', -34.6073660, 'lng', -58.5661311, 'radio', 1500) where tipo = 'zona' and clave = 'caseros';
update interno_listas set datos = datos || jsonb_build_object('lat', -34.5771577, 'lng', -58.5377237, 'radio', 1500) where tipo = 'zona' and clave = 'san_martin_centro';
update interno_listas set datos = datos || jsonb_build_object('lat', -34.5509077, 'lng', -58.5559691, 'radio', 1500) where tipo = 'zona' and clave = 'villa_ballester';
update interno_listas set datos = datos || jsonb_build_object('lat', -34.5817375, 'lng', -58.5805124, 'radio', 1500) where tipo = 'zona' and clave = 'villa_bosch';

insert into interno_listas (tipo, clave, nombre, orden) values
  ('fuente', 'openstreetmap', 'OpenStreetMap', 7), ('fuente', 'planilla', 'Planilla importada', 8)
on conflict (tipo, clave) do nothing;


/* ---------- Proveedores ---------- */
create table interno_proveedores (
  clave              text primary key,
  nombre             text not null,
  licencia           text,
  atribucion         text,
  campos_permitidos  text[] not null default '{}',
  retencion_dias     integer,
  costo              text,
  limites            text,
  terminos_url       text,
  activo             boolean not null default true,
  notas              text,
  actualizado_en     timestamptz not null default now(),
  actualizado_por    uuid references perfiles(id) on delete set null,
  constraint interno_proveedores_clave check (clave ~ '^[a-z0-9_]{1,40}$'),
  constraint interno_proveedores_retencion check (retencion_dias is null or retencion_dias > 0),
  constraint interno_proveedores_url check (terminos_url is null or terminos_url ~* '^https://')
);
comment on column interno_proveedores.retencion_dias is 'Cuántos días se puede guardar lo que trae. Null: sin límite impuesto por el proveedor.';

insert into interno_proveedores (clave, nombre, licencia, atribucion, campos_permitidos, retencion_dias, costo, limites, terminos_url, notas) values
  ('osm', 'OpenStreetMap (Overpass)', 'ODbL 1.0',
   '© colaboradores de OpenStreetMap, disponible bajo la licencia ODbL',
   array['nombre', 'rubro', 'direccion', 'localidad', 'ubicacion', 'telefono', 'web', 'email', 'instagram', 'horario'],
   null, 'Gratis',
   'Servidor público con uso razonable: búsquedas a pedido, no barridos automáticos. Pocos comercios cargan teléfono (en Caseros, 25 de 525 con nombre).',
   'https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances',
   'Los datos los cargan voluntarios: pueden estar incompletos o viejos. Se guardan como "sin verificar".'),
  ('planilla', 'Planilla propia (CSV o Excel)', 'Propia', null,
   array['nombre', 'contacto', 'rubro', 'zona', 'localidad', 'direccion', 'telefono', 'whatsapp', 'email', 'instagram', 'fuente', 'interes', 'notas'],
   null, 'Gratis', null, null,
   'Listados propios. Que un teléfono esté en una planilla no es permiso para escribirle con fines comerciales.')
on conflict (clave) do nothing;


/* ---------- Búsquedas ---------- */
create table interno_busquedas (
  id               uuid primary key default gen_random_uuid(),
  proveedor        text not null references interno_proveedores(clave),
  parametros       jsonb not null default '{}',
  resultados       integer,
  nuevos           integer,
  error            text,
  duracion_ms      integer,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null
);
create index on interno_busquedas (creado_en desc);


/* ---------- Hallazgos ---------- */
create table interno_hallazgos (
  id                uuid primary key default gen_random_uuid(),
  proveedor         text not null references interno_proveedores(clave),
  externo_id        text not null,
  busqueda_id       uuid references interno_busquedas(id) on delete set null,
  nombre            text not null,
  rubro             text,
  subrubro          text,
  direccion         text,
  localidad         text,
  zona              text,
  lat               double precision,
  lng               double precision,
  telefono          text,
  whatsapp          text,
  web               text,
  email             text,
  instagram         text,
  horario           text,
  datos             jsonb not null default '{}',
  obtenido_en       timestamptz not null default now(),
  visto_en          timestamptz not null default now(),
  prospecto_id      uuid references interno_prospectos(id) on delete set null,
  descartado_en     timestamptz,
  motivo_descarte   text,
  creado_en         timestamptz not null default now(),
  creado_por        uuid references perfiles(id) on delete set null,
  actualizado_en    timestamptz not null default now(),
  actualizado_por   uuid references perfiles(id) on delete set null,
  constraint interno_hallazgos_nombre check (length(btrim(nombre)) between 1 and 200),
  constraint interno_hallazgos_web check (web is null or web ~* '^https?://'),
  unique (proveedor, externo_id)
);
comment on column interno_hallazgos.obtenido_en is 'Cuándo se trajo por primera vez. visto_en: la última búsqueda que lo volvió a encontrar.';
create index on interno_hallazgos (zona, rubro) where prospecto_id is null and descartado_en is null;


/* ---------- El origen en el prospecto ---------- */
alter table interno_prospectos add column origen_proveedor text references interno_proveedores(clave);
alter table interno_prospectos add column origen_externo_id text;
alter table interno_prospectos add column origen_obtenido_en timestamptz;
alter table interno_prospectos add column origen_verificado_en timestamptz;
create unique index interno_prospectos_origen_uno on interno_prospectos (origen_proveedor, origen_externo_id)
  where origen_proveedor is not null and origen_externo_id is not null;
comment on column interno_prospectos.origen_verificado_en is
  'Cuándo alguien confirmó los datos que vinieron del proveedor. Null: siguen siendo los del proveedor, sin verificar.';


/* ---------- Guardar lo que trajo una búsqueda ---------- */
/* Recibe los resultados ya normalizados por el conector (JSON), los
   guarda sin duplicar (actualiza lo ya encontrado, sin tocar lo que el
   fundador decidió: prospecto o descarte) y cierra la búsqueda con sus
   números. Security invoker: escribe quien tiene 'crm'. */
create or replace function interno_guardar_hallazgos(p_busqueda uuid, p_items jsonb)
returns table (hallazgo_id uuid, nuevo boolean)
language plpgsql security invoker set search_path = public as $$
declare v_prov text; it jsonb; v_id uuid; v_nuevo boolean; n_total int := 0; n_nuevos int := 0;
begin
  select proveedor into v_prov from interno_busquedas where id = p_busqueda;
  if v_prov is null then raise exception 'No existe la búsqueda'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Se esperaba una lista'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    continue when coalesce(btrim(it ->> 'nombre'), '') = '' or coalesce(it ->> 'externo_id', '') = '';
    insert into interno_hallazgos (proveedor, externo_id, busqueda_id, nombre, rubro, subrubro, direccion, localidad, zona, lat, lng,
                                   telefono, whatsapp, web, email, instagram, horario, datos)
    values (v_prov, it ->> 'externo_id', p_busqueda, left(btrim(it ->> 'nombre'), 200), it ->> 'rubro', it ->> 'subrubro', it ->> 'direccion',
            it ->> 'localidad', it ->> 'zona', (it ->> 'lat')::double precision, (it ->> 'lng')::double precision,
            it ->> 'telefono', it ->> 'whatsapp', case when it ->> 'web' ~* '^https?://' then it ->> 'web' end, it ->> 'email',
            it ->> 'instagram', it ->> 'horario', coalesce(it -> 'datos', '{}'))
    on conflict (proveedor, externo_id) do update set
      busqueda_id = excluded.busqueda_id, nombre = excluded.nombre, rubro = coalesce(excluded.rubro, interno_hallazgos.rubro),
      subrubro = excluded.subrubro, direccion = excluded.direccion, localidad = excluded.localidad,
      zona = coalesce(interno_hallazgos.zona, excluded.zona), lat = excluded.lat, lng = excluded.lng,
      telefono = excluded.telefono, whatsapp = excluded.whatsapp, web = excluded.web, email = excluded.email,
      instagram = excluded.instagram, horario = excluded.horario, datos = excluded.datos, visto_en = now()
    returning id, (xmax = 0) into v_id, v_nuevo;
    n_total := n_total + 1;
    if v_nuevo then n_nuevos := n_nuevos + 1; end if;
    hallazgo_id := v_id; nuevo := v_nuevo;
    return next;
  end loop;
  update interno_busquedas set resultados = n_total, nuevos = n_nuevos where id = p_busqueda;
end;
$$;

/* Pasar un hallazgo al CRM. Sin p_prospecto, crea uno; con p_prospecto,
   lo vincula a ese y completa solo los campos vacíos (nunca pisa lo que
   el fundador ya cargó). El cambio queda en el historial del prospecto,
   y una nota en su línea de tiempo dice de dónde salió. */
create or replace function interno_incorporar_hallazgo(p_hallazgo uuid, p_prospecto uuid default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare h record; v_id uuid; v_prov text;
begin
  select * into h from interno_hallazgos where id = p_hallazgo;
  if not found then raise exception 'No existe el hallazgo'; end if;
  if h.prospecto_id is not null then raise exception 'Ya está en el CRM' using errcode = '23505'; end if;
  select nombre into v_prov from interno_proveedores where clave = h.proveedor;
  if p_prospecto is null then
    insert into interno_prospectos (nombre, rubro, zona, localidad, direccion, telefono, whatsapp, email, instagram, fuente,
                                    origen_proveedor, origen_externo_id, origen_obtenido_en)
    values (h.nombre, h.rubro, h.zona, h.localidad, h.direccion, h.telefono, h.whatsapp, h.email, h.instagram,
            case h.proveedor when 'osm' then 'openstreetmap' when 'planilla' then 'planilla' end,
            h.proveedor, h.externo_id, h.obtenido_en)
    returning id into v_id;
  else
    update interno_prospectos p set
      rubro = coalesce(p.rubro, h.rubro), zona = coalesce(p.zona, h.zona), localidad = coalesce(p.localidad, h.localidad),
      direccion = coalesce(p.direccion, h.direccion), telefono = coalesce(p.telefono, h.telefono), whatsapp = coalesce(p.whatsapp, h.whatsapp),
      email = coalesce(p.email, h.email), instagram = coalesce(p.instagram, h.instagram),
      origen_proveedor = coalesce(p.origen_proveedor, h.proveedor), origen_externo_id = coalesce(p.origen_externo_id, h.externo_id),
      origen_obtenido_en = coalesce(p.origen_obtenido_en, h.obtenido_en)
     where p.id = p_prospecto
    returning p.id into v_id;
    if v_id is null then raise exception 'No existe el prospecto'; end if;
  end if;
  update interno_hallazgos set prospecto_id = v_id, descartado_en = null where id = p_hallazgo;
  insert into interno_actividades (prospecto_id, tipo, resultado, datos)
  values (v_id, 'nota', case when p_prospecto is null then 'Encontrado en ' else 'Vinculado con lo encontrado en ' end || coalesce(v_prov, h.proveedor)
          || ' (' || to_char(h.obtenido_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY') || '). Datos sin verificar.',
          jsonb_build_object('hallazgo', h.id, 'proveedor', h.proveedor, 'externo_id', h.externo_id));
  return v_id;
end;
$$;


/* ---------- Sellos, historial y permisos ---------- */
do $$
declare t text;
begin
  foreach t in array array['interno_busquedas', 'interno_hallazgos'] loop
    execute format('create trigger %I before insert or update on %I for each row execute function interno_sellar()', t || '_sello', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function interno_anotar()', t || '_historial', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (es_interno(%L))', t || '_ver', t, 'crm');
    execute format('create policy %I on %I for insert with check (es_interno(%L))', t || '_crear', t, 'crm');
    execute format('create policy %I on %I for update using (es_interno(%L)) with check (es_interno(%L))', t || '_editar', t, 'crm', 'crm');
    execute format('revoke all on %I from anon', t);
    execute format('revoke delete, truncate, references, trigger on %I from authenticated', t);
  end loop;
end;
$$;

/* Los proveedores: los lee el crm, los edita config. Su clave es "clave"
   (interno_anotar la reconoce desde 0118); el sello es propio porque no
   tiene creado_en. */
create or replace function interno_proveedores_sellar()
returns trigger language plpgsql as $$ begin new.actualizado_en := now(); new.actualizado_por := auth.uid(); return new; end; $$;
create trigger interno_proveedores_sello before insert or update on interno_proveedores for each row execute function interno_proveedores_sellar();
create trigger interno_proveedores_historial after insert or update or delete on interno_proveedores for each row execute function interno_anotar();
alter table interno_proveedores enable row level security;
create policy interno_proveedores_ver on interno_proveedores for select using (es_interno('crm') or es_interno('config'));
create policy interno_proveedores_editar on interno_proveedores for update using (es_interno('config')) with check (es_interno('config'));
revoke all on interno_proveedores from anon;
revoke insert, delete, truncate, references, trigger on interno_proveedores from authenticated;

revoke execute on function interno_guardar_hallazgos(uuid, jsonb), interno_incorporar_hallazgo(uuid, uuid) from public, anon;
grant execute on function interno_guardar_hallazgos(uuid, jsonb), interno_incorporar_hallazgo(uuid, uuid) to authenticated;
revoke execute on function interno_proveedores_sellar() from public, anon, authenticated;
