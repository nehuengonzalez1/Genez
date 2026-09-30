/* ============================================================
   0122 — GENEZ FOUNDER: automatizaciones (etapa 5)

   Tres cosas que corren solas cada 5 minutos:
   - recordatorios de demos y reuniones de la Agenda, por WhatsApp;
   - seguimientos a quien pidió información y no volvió a escribir;
   - alertas internas en Founder (oportunidades quietas, conversaciones
     que esperan a alguien).

   FUERA DE LA VENTANA DE 24 HORAS SOLO SALE UNA PLANTILLA
   -------------------------------------------------------
   Meta exige una plantilla aprobada para escribirle a alguien que no
   escribió en las últimas 24 horas, y la cobra. Las plantillas se
   escriben en Founder, se mandan a aprobar a Meta desde el servidor y
   se sincroniza su estado. Una regla sin plantilla aprobada no manda
   nada.

   LA COLA Y LA APROBACIÓN
   -----------------------
   Las reglas no mandan: generan envíos en una cola (interno_envios),
   uno por destinatario y ocasión (clave_unica: el mismo recordatorio no
   se genera dos veces). De fábrica cada envío espera que alguien lo
   apruebe. Lo que no se puede mandar (sin teléfono, sin
   consentimiento, pidió la baja) queda igual en la cola como
   'omitido', con el motivo: así se ve por qué alguien no recibió nada.

   LOS FRENOS ESTÁN EN LA BASE
   ---------------------------
   interno_auto_preparar, la única puerta para mandar un envío, vuelve a
   mirar el consentimiento, la baja, el horario permitido de la regla y
   los topes por persona (por día y por semana) y por día en total. No
   importa qué diga la pantalla ni el servidor. Nunca hay más de tres
   intentos por envío.

   EL RELOJ
   --------
   pg_cron corre interno_auto_disparar() cada 5 minutos: genera lo que
   toque (en SQL, sin salir de la base) y, si hay algo para mandar o
   plantillas por sincronizar, llama a api/founder con pg_net. El
   servidor no confía en quien llama: la llamada lleva una llave de un
   solo uso que la base acaba de escribir en interno_auto_llaves, una
   tabla que solo ve la service_role. Así no hace falta compartir un
   secreto entre Vercel y la base.
   ============================================================ */


create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

/* pg_net hace pedidos HTTP desde la base: en manos de un usuario del
   navegador sería un SSRF. Supabase le da el esquema net a anon y a
   authenticated con su propio usuario (supabase_admin), y esos permisos
   no se pueden sacar desde acá: un REVOKE solo quita lo que dio quien
   lo corre. Lo que lo protege es que la API no expone el esquema net
   (solo public y graphql_public; lo comprueba probar-founder-auto.mjs):
   nadie llega a net.http_post si no es por SQL, y SQL directo solo
   tienen la base y sus dueños. Si algún día se agrega net a los
   esquemas expuestos de la API, esto se rompe. */


/* ---------- Plantillas de WhatsApp ---------- */
create table interno_wa_plantillas (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null unique,
  idioma           text not null default 'es_AR',
  categoria        text not null default 'UTILITY',
  cuerpo           text not null,
  variables        text[] not null default '{}',
  ejemplos         text[] not null default '{}',
  estado           text not null default 'borrador',
  meta_id          text,
  motivo_rechazo   text,
  sincronizada_en  timestamptz,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_wa_plantillas_nombre check (nombre ~ '^[a-z0-9_]{1,100}$'),
  constraint interno_wa_plantillas_categoria check (categoria in ('UTILITY', 'MARKETING')),
  constraint interno_wa_plantillas_idioma check (idioma ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  constraint interno_wa_plantillas_cuerpo check (length(btrim(cuerpo)) between 1 and 1024),
  constraint interno_wa_plantillas_estado check (estado in ('borrador', 'enviada', 'aprobada', 'rechazada', 'pausada', 'desactivada')),
  /* Cada {{n}} del cuerpo tiene su variable y su ejemplo (Meta pide
     ejemplos para aprobar). */
  constraint interno_wa_plantillas_variables check (
    cardinality(variables) = cardinality(ejemplos)
    and variables <@ array['nombre', 'negocio', 'dia', 'fecha', 'hora', 'lugar']::text[])
);
comment on column interno_wa_plantillas.variables is
  'Qué dato va en cada {{n}} del cuerpo, en orden: nombre, negocio, dia, fecha, hora, lugar.';

/* Del navegador se escribe el borrador; el estado lo cambia el servidor
   (lo que contesta Meta). Una plantilla ya mandada no se edita: Meta
   aprobó ese texto, no otro. */
create or replace function interno_wa_plantillas_cuidar()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.estado := 'borrador'; new.meta_id := null; new.motivo_rechazo := null; new.sincronizada_en := null;
    elsif old.estado <> 'borrador' and (new.cuerpo, new.nombre, new.idioma, new.categoria, new.variables, new.ejemplos)
          is distinct from (old.cuerpo, old.nombre, old.idioma, old.categoria, old.variables, old.ejemplos) then
      raise exception 'Una plantilla que ya se mandó a Meta no se edita: hacé otra.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function interno_wa_plantillas_cuidar() from public, anon, authenticated;
create trigger interno_wa_plantillas_cuidado before insert or update on interno_wa_plantillas
  for each row execute function interno_wa_plantillas_cuidar();


/* ---------- Las reglas ---------- */
create table interno_automatizaciones (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  tipo                text not null,
  activa              boolean not null default false,
  plantilla_id        uuid references interno_wa_plantillas(id) on delete set null,
  parametros          jsonb not null default '{}',
  hora_desde          integer not null default 9,
  hora_hasta          integer not null default 20,
  dias                integer[] not null default '{1,2,3,4,5,6}',
  tope_persona_dia    integer not null default 1,
  tope_persona_semana integer not null default 2,
  tope_dia            integer not null default 30,
  consentimiento      text not null default 'dado',
  aprobacion_manual   boolean not null default true,
  archivado_en        timestamptz,
  creado_en           timestamptz not null default now(),
  creado_por          uuid references perfiles(id) on delete set null,
  actualizado_en      timestamptz not null default now(),
  actualizado_por     uuid references perfiles(id) on delete set null,
  constraint interno_automatizaciones_nombre check (length(btrim(nombre)) between 1 and 120),
  constraint interno_automatizaciones_tipo check (tipo in ('recordatorio_evento', 'seguimiento', 'alerta_oportunidad', 'alerta_conversacion')),
  constraint interno_automatizaciones_horas check (hora_desde between 0 and 23 and hora_hasta between 1 and 24 and hora_desde < hora_hasta),
  constraint interno_automatizaciones_dias check (dias <@ array[0, 1, 2, 3, 4, 5, 6] and cardinality(dias) >= 1),
  constraint interno_automatizaciones_topes check (tope_persona_dia between 1 and 5 and tope_persona_semana between 1 and 10 and tope_dia between 1 and 250),
  constraint interno_automatizaciones_consentimiento check (consentimiento in ('dado', 'sin_baja'))
);
comment on column interno_automatizaciones.consentimiento is
  'dado: solo a quien aceptó expresamente recibir mensajes. sin_baja: a quien no pidió la baja (para recordar algo que la persona agendó).';
comment on column interno_automatizaciones.dias is 'Días de la semana permitidos, 0 = domingo.';


/* ---------- La cola ---------- */
create table interno_envios (
  id                uuid primary key default gen_random_uuid(),
  automatizacion_id uuid not null references interno_automatizaciones(id) on delete restrict,
  plantilla_id      uuid references interno_wa_plantillas(id) on delete set null,
  clave_unica       text not null unique,
  prospecto_id      uuid references interno_prospectos(id) on delete set null,
  evento_id         uuid references interno_eventos(id) on delete set null,
  conversacion_id   uuid references interno_wa_conversaciones(id) on delete set null,
  destino_wa        text,
  destinatario      text,
  valores           text[] not null default '{}',
  estado            text not null,
  motivo            text,
  programado_para   timestamptz not null default now(),
  intentos          integer not null default 0,
  proximo_intento   timestamptz,
  error             jsonb,
  mensaje_id        uuid references interno_wa_mensajes(id) on delete set null,
  aprobado_por      uuid references perfiles(id) on delete set null,
  aprobado_en       timestamptz,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  constraint interno_envios_estado check (estado in ('por_aprobar', 'aprobado', 'enviando', 'enviado', 'fallido', 'cancelado', 'omitido')),
  constraint interno_envios_intentos check (intentos between 0 and 3),
  constraint interno_envios_destino check (destino_wa is null or destino_wa ~ '^[0-9]{8,16}$')
);
create index on interno_envios (estado, programado_para);
create index on interno_envios (destino_wa, creado_en) where estado in ('enviando', 'enviado');

/* Del navegador: aprobar o cancelar lo que espera, y nada más. */
create or replace function interno_envios_cuidar()
returns trigger language plpgsql as $$
begin
  new.actualizado_en := now();
  if auth.uid() is not null then
    if not ((old.estado = 'por_aprobar' and new.estado in ('aprobado', 'cancelado'))
         or (old.estado = 'aprobado' and new.estado = 'cancelado')
         or (old.estado = 'fallido' and new.estado = 'cancelado')) then
      raise exception 'Solo se aprueba o se cancela un envío que espera.' using errcode = '42501';
    end if;
    if new.estado = 'aprobado' then new.aprobado_por := auth.uid(); new.aprobado_en := now(); end if;
  end if;
  return new;
end;
$$;
revoke execute on function interno_envios_cuidar() from public, anon, authenticated;
create trigger interno_envios_cuidado before update on interno_envios for each row execute function interno_envios_cuidar();


/* ---------- Alertas internas ---------- */
create table interno_alertas (
  id               uuid primary key default gen_random_uuid(),
  automatizacion_id uuid references interno_automatizaciones(id) on delete set null,
  tipo             text not null,
  titulo           text not null,
  detalle          text,
  enlace_tipo      text,
  enlace_id        uuid,
  clave_unica      text not null unique,
  creada_en        timestamptz not null default now(),
  descartada_en    timestamptz,
  descartada_por   uuid references perfiles(id) on delete set null,
  constraint interno_alertas_tipo check (tipo in ('oportunidad_quieta', 'conversacion_espera')),
  constraint interno_alertas_enlace check (enlace_tipo is null or enlace_tipo in ('prospecto', 'conversacion'))
);
create index on interno_alertas (creada_en desc) where descartada_en is null;

create or replace function interno_alertas_cuidar()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then new.descartada_por := auth.uid(); end if;
  return new;
end;
$$;
revoke execute on function interno_alertas_cuidar() from public, anon, authenticated;
create trigger interno_alertas_cuidado before update on interno_alertas for each row execute function interno_alertas_cuidar();


/* ---------- Registro de cada corrida ---------- */
create table interno_auto_corridas (
  id          bigint generated always as identity primary key,
  empezo_en   timestamptz not null default now(),
  termino_en  timestamptz,
  origen      text not null,
  generados   integer not null default 0,
  alertas     integer not null default 0,
  enviados    integer not null default 0,
  fallidos    integer not null default 0,
  error       text,
  constraint interno_auto_corridas_origen check (origen in ('reloj', 'servidor', 'manual'))
);
create index on interno_auto_corridas (empezo_en desc);

/* Las llaves de un solo uso con que la base le avisa al servidor. */
create table interno_auto_llaves (
  llave      text primary key,
  creada_en  timestamptz not null default now()
);


/* ---------- Ajustes ---------- */
alter table interno_ajustes drop constraint interno_ajustes_clave;
alter table interno_ajustes add constraint interno_ajustes_clave check (clave in ('empresa', 'agenda', 'whatsapp', 'bot', 'automatizaciones'));
insert into interno_ajustes (clave, valor) values
  ('automatizaciones', '{"url": "https://genez.com.ar/api/founder"}')
on conflict (clave) do nothing;


/* ---------- Helpers ---------- */
/* Un teléfono argentino como lo quiere WhatsApp: 549 + los 10 dígitos
   nacionales. Si ya hay una conversación con ese número, se usa el wa_id
   que mandó Meta, que es el que seguro funciona. */
create or replace function interno_wa_destino(p_tel text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select c.wa_id from interno_wa_conversaciones c where c.tel_norm = interno_norm_tel(p_tel) order by c.ultimo_mensaje_en desc nulls last limit 1),
    case when interno_norm_tel(p_tel) ~ '^[0-9]{10}$' then '549' || interno_norm_tel(p_tel) end)
$$;
revoke execute on function interno_wa_destino(text) from public, anon, authenticated;

/* El valor de cada variable de una plantilla, en castellano y en hora
   de Buenos Aires. */
create or replace function interno_auto_valor(p_var text, p_nombre text, p_negocio text, p_momento timestamptz, p_lugar text)
returns text language sql stable set search_path = public as $$
  select coalesce(nullif(btrim(case p_var
    when 'nombre' then split_part(btrim(coalesce(p_nombre, '')), ' ', 1)
    when 'negocio' then p_negocio
    when 'dia' then (array['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'])[extract(dow from p_momento at time zone 'America/Argentina/Buenos_Aires')::int + 1]
    when 'fecha' then to_char(p_momento at time zone 'America/Argentina/Buenos_Aires', 'DD/MM')
    when 'hora' then to_char(p_momento at time zone 'America/Argentina/Buenos_Aires', 'HH24:MI')
    when 'lugar' then p_lugar
  end), ''), case p_var when 'nombre' then 'hola' else '-' end)
$$;
revoke execute on function interno_auto_valor(text, text, text, timestamptz, text) from public, anon, authenticated;


/* ---------- Generar: lo que corresponde según cada regla ---------- */
/* En SQL, sin red. Devuelve cuántos envíos y alertas nuevos hubo. Es
   idempotente: la clave_unica hace que correrlo dos veces no duplique. */
create or replace function interno_auto_generar()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r interno_automatizaciones;
  p interno_wa_plantillas;
  v_generados integer := 0;
  v_alertas integer := 0;
  v_filas integer;
  v_horas numeric;
  v_dias numeric;
  v_min numeric;
begin
  for r in select * from interno_automatizaciones where activa and archivado_en is null loop
    select * into p from interno_wa_plantillas where id = r.plantilla_id;

    if r.tipo = 'recordatorio_evento' then
      /* Los eventos que empiezan dentro de las próximas `horas_antes`
         horas y todavía no empezaron. */
      v_horas := coalesce((r.parametros ->> 'horas_antes')::numeric, 24);
      insert into interno_envios (automatizacion_id, plantilla_id, clave_unica, prospecto_id, evento_id, conversacion_id,
                                  destino_wa, destinatario, valores, estado, motivo)
      select r.id, r.plantilla_id, 'recordatorio:' || r.id || ':' || e.id || ':' || to_char(e.inicio, 'YYYYMMDDHH24MI'),
             pr.id, e.id, cv.id, d.wa, coalesce(ct.nombre, pr.nombre),
             coalesce((select array_agg(interno_auto_valor(v, coalesce(ct.nombre, pr.nombre), pr.nombre, e.inicio, e.lugar) order by o)
                         from unnest(p.variables) with ordinality as x(v, o)), '{}'),
             case when d.wa is null then 'omitido'
                  when cv.consentimiento = 'baja' then 'omitido'
                  when r.consentimiento = 'dado' and coalesce(cv.consentimiento, 'sin_dato') <> 'dado' then 'omitido'
                  when p.id is null or p.estado <> 'aprobada' then 'omitido'
                  when r.aprobacion_manual then 'por_aprobar' else 'aprobado' end,
             case when d.wa is null then 'El prospecto no tiene WhatsApp ni teléfono cargado.'
                  when cv.consentimiento = 'baja' then 'Pidió que no le escriban.'
                  when r.consentimiento = 'dado' and coalesce(cv.consentimiento, 'sin_dato') <> 'dado' then 'No aceptó recibir mensajes.'
                  when p.id is null or p.estado <> 'aprobada' then 'La regla no tiene una plantilla aprobada por Meta.' end
        from interno_eventos e
        join interno_prospectos pr on pr.id = e.prospecto_id
        left join lateral (select * from interno_contactos c where c.prospecto_id = pr.id and c.archivado_en is null
                           order by c.principal desc, c.creado_en limit 1) ct on true
        cross join lateral (select interno_wa_destino(coalesce(ct.whatsapp, pr.whatsapp, ct.telefono, pr.telefono)) as wa) d
        left join interno_wa_conversaciones cv on cv.wa_id = d.wa
       where e.archivado_en is null and e.estado = 'programado'
         and e.tipo = any(coalesce(array(select jsonb_array_elements_text(r.parametros -> 'tipos')), array['demo', 'reunion', 'visita']))
         and e.inicio > now() and e.inicio <= now() + make_interval(mins => (v_horas * 60)::int)
      on conflict (clave_unica) do nothing;
      get diagnostics v_filas = row_count; v_generados := v_generados + v_filas;

    elsif r.tipo = 'seguimiento' then
      /* Conversaciones donde lo último lo dijo Genez hace más de `dias`
         días y la persona no contestó. Una vez por cada último mensaje:
         si contesta y se vuelve a quedar, es otra ocasión. */
      v_dias := coalesce((r.parametros ->> 'dias')::numeric, 3);
      insert into interno_envios (automatizacion_id, plantilla_id, clave_unica, prospecto_id, conversacion_id,
                                  destino_wa, destinatario, valores, estado, motivo)
      select r.id, r.plantilla_id, 'seguimiento:' || r.id || ':' || c.id || ':' || to_char(c.ultimo_mensaje_en, 'YYYYMMDDHH24MISS'),
             c.prospecto_id, c.id, c.wa_id, coalesce(pr.nombre, c.nombre_perfil),
             coalesce((select array_agg(interno_auto_valor(v, c.nombre_perfil, pr.nombre, null, null) order by o)
                         from unnest(p.variables) with ordinality as x(v, o)), '{}'),
             case when c.consentimiento = 'baja' then 'omitido'
                  when r.consentimiento = 'dado' and c.consentimiento <> 'dado' then 'omitido'
                  when p.id is null or p.estado <> 'aprobada' then 'omitido'
                  when r.aprobacion_manual then 'por_aprobar' else 'aprobado' end,
             case when c.consentimiento = 'baja' then 'Pidió que no le escriban.'
                  when r.consentimiento = 'dado' and c.consentimiento <> 'dado' then 'No aceptó recibir mensajes.'
                  when p.id is null or p.estado <> 'aprobada' then 'La regla no tiene una plantilla aprobada por Meta.' end
        from interno_wa_conversaciones c
        left join interno_prospectos pr on pr.id = c.prospecto_id
       where c.ultimo_direccion = 'saliente'
         and c.estado <> 'cerrada'
         and c.ultimo_mensaje_en < now() - make_interval(mins => (v_dias * 1440)::int)
         /* Un seguimiento es para quien alguna vez escribió; y no se
            persigue: si ya hubo un seguimiento de esta regla sin
            respuesta, no se manda otro. */
         and c.ultimo_entrante_en is not null
         and not exists (select 1 from interno_envios x where x.conversacion_id = c.id and x.automatizacion_id = r.id
                           and x.estado in ('enviado', 'enviando') and x.creado_en > c.ultimo_entrante_en)
      on conflict (clave_unica) do nothing;
      get diagnostics v_filas = row_count; v_generados := v_generados + v_filas;

    elsif r.tipo = 'alerta_oportunidad' then
      v_dias := coalesce((r.parametros ->> 'dias')::numeric, 7);
      insert into interno_alertas (automatizacion_id, tipo, titulo, detalle, enlace_tipo, enlace_id, clave_unica)
      select r.id, 'oportunidad_quieta', pr.nombre,
             'Sin contacto desde hace ' || floor(extract(epoch from now() - coalesce(pr.ultimo_contacto, o.creado_en)) / 86400)::int || ' días.',
             'prospecto', pr.id, 'quieta:' || o.id || ':' || to_char(coalesce(pr.ultimo_contacto, o.creado_en), 'YYYYMMDD')
        from interno_oportunidades o
        join interno_prospectos pr on pr.id = o.prospecto_id
       where o.estado = 'abierta' and o.archivado_en is null and pr.archivado_en is null
         and coalesce(pr.ultimo_contacto, o.creado_en) < now() - make_interval(days => v_dias::int)
      on conflict (clave_unica) do nothing;
      get diagnostics v_filas = row_count; v_alertas := v_alertas + v_filas;

    elsif r.tipo = 'alerta_conversacion' then
      /* Una conversación con mensajes sin leer, o que el asistente pasó
         a una persona, y nadie la tocó en `minutos`. */
      v_min := coalesce((r.parametros ->> 'minutos')::numeric, 60);
      insert into interno_alertas (automatizacion_id, tipo, titulo, detalle, enlace_tipo, enlace_id, clave_unica)
      select r.id, 'conversacion_espera', coalesce(c.nombre_perfil, '+' || c.wa_id),
             case when c.derivada_en is not null then 'El asistente te la pasó y nadie la atendió.'
                  else c.no_leidos || ' mensaje' || case when c.no_leidos = 1 then '' else 's' end || ' sin leer.' end,
             'conversacion', c.id,
             'espera:' || c.id || ':' || to_char(coalesce(c.derivada_en, c.ultimo_entrante_en), 'YYYYMMDDHH24MISS')
        from interno_wa_conversaciones c
       where c.consentimiento <> 'baja'
         and ((c.derivada_en is not null and c.derivada_en < now() - make_interval(mins => v_min::int))
           or (c.no_leidos > 0 and c.ultimo_entrante_en < now() - make_interval(mins => v_min::int)))
      on conflict (clave_unica) do nothing;
      get diagnostics v_filas = row_count; v_alertas := v_alertas + v_filas;
    end if;
  end loop;

  return jsonb_build_object('generados', v_generados, 'alertas', v_alertas);
end;
$$;
revoke execute on function interno_auto_generar() from public, anon, authenticated;
grant execute on function interno_auto_generar() to service_role;


/* ---------- Preparar un envío: la única puerta ---------- */
/* Devuelve lo que el servidor necesita para mandar la plantilla, o
   {listo: false, motivo} si todavía no corresponde (fuera de horario:
   queda para después) o no corresponde nunca (queda omitido). */
create or replace function interno_auto_preparar(p_envio uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  x interno_envios;
  r interno_automatizaciones;
  p interno_wa_plantillas;
  c interno_wa_conversaciones;
  v_local timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_n integer;
  v_texto text;
  i integer;
  m interno_wa_mensajes;
  v_omitir text;
begin
  select * into x from interno_envios where id = p_envio for update;
  if not found or x.estado <> 'aprobado' then
    return jsonb_build_object('listo', false, 'motivo', 'No está aprobado.');
  end if;
  select * into r from interno_automatizaciones where id = x.automatizacion_id;
  select * into p from interno_wa_plantillas where id = x.plantilla_id;
  select * into c from interno_wa_conversaciones where wa_id = x.destino_wa;

  /* Horario y día permitidos: no es un rechazo, es "todavía no". */
  if not (extract(dow from v_local)::int = any(r.dias)) or extract(hour from v_local)::int < r.hora_desde or extract(hour from v_local)::int >= r.hora_hasta then
    return jsonb_build_object('listo', false, 'motivo', 'Fuera del horario de la regla.');
  end if;

  v_omitir := case
    when not r.activa or r.archivado_en is not null then 'La regla se apagó.'
    when p.id is null or p.estado <> 'aprobada' then 'La plantilla no está aprobada por Meta.'
    when x.destino_wa is null then 'Sin número de WhatsApp.'
    when c.consentimiento = 'baja' then 'Pidió que no le escriban.'
    when r.consentimiento = 'dado' and coalesce(c.consentimiento, 'sin_dato') <> 'dado' then 'No aceptó recibir mensajes.'
    when x.evento_id is not null and not exists (select 1 from interno_eventos e where e.id = x.evento_id and e.estado = 'programado' and e.archivado_en is null and e.inicio > now())
      then 'El evento ya pasó, se canceló o se reprogramó.'
  end;
  if v_omitir is null then
    select count(*) into v_n from interno_envios where destino_wa = x.destino_wa and estado in ('enviando', 'enviado') and creado_en > now() - interval '24 hours';
    if v_n >= r.tope_persona_dia then v_omitir := 'Ya recibió el máximo de mensajes automáticos de hoy.'; end if;
  end if;
  if v_omitir is null then
    select count(*) into v_n from interno_envios where destino_wa = x.destino_wa and estado in ('enviando', 'enviado') and creado_en > now() - interval '7 days';
    if v_n >= r.tope_persona_semana then v_omitir := 'Ya recibió el máximo de mensajes automáticos de la semana.'; end if;
  end if;
  if v_omitir is null then
    select count(*) into v_n from interno_envios where automatizacion_id = r.id and estado in ('enviando', 'enviado') and actualizado_en > now() - interval '24 hours';
    if v_n >= r.tope_dia then
      /* El tope del día no descarta: se corre para mañana. */
      update interno_envios set programado_para = now() + interval '12 hours' where id = x.id;
      return jsonb_build_object('listo', false, 'motivo', 'La regla llegó a su tope del día.');
    end if;
  end if;

  if v_omitir is not null then
    update interno_envios set estado = 'omitido', motivo = v_omitir where id = x.id;
    return jsonb_build_object('listo', false, 'motivo', v_omitir, 'omitido', true);
  end if;

  /* El texto tal como le llega a la persona, para el hilo. */
  v_texto := p.cuerpo;
  for i in 1 .. coalesce(array_length(x.valores, 1), 0) loop
    v_texto := replace(v_texto, '{{' || i || '}}', x.valores[i]);
  end loop;

  if c.id is null then
    insert into interno_wa_conversaciones (wa_id, nombre_perfil, prospecto_id) values (x.destino_wa, x.destinatario, x.prospecto_id)
      returning * into c;
  end if;
  insert into interno_wa_mensajes (conversacion_id, direccion, tipo, texto, datos, estado, idempotencia)
    values (c.id, 'saliente', 'template', left(v_texto, 4096), jsonb_build_object('plantilla', p.nombre, 'envio', x.id), 'enviando', 'envio-' || x.id || '-' || x.intentos)
    returning * into m;
  update interno_wa_conversaciones set ultimo_mensaje_en = now(), ultimo_texto = left(v_texto, 200), ultimo_direccion = 'saliente' where id = c.id;
  update interno_envios set estado = 'enviando', mensaje_id = m.id, conversacion_id = c.id, intentos = intentos + 1 where id = x.id;

  return jsonb_build_object('listo', true, 'mensaje', m.id, 'wa_id', x.destino_wa, 'plantilla', p.nombre, 'idioma', p.idioma, 'valores', to_jsonb(x.valores));
end;
$$;
revoke execute on function interno_auto_preparar(uuid) from public, anon, authenticated;
grant execute on function interno_auto_preparar(uuid) to service_role;

/* Lo que contestó Meta. Un error de pago o de plantilla no se reintenta;
   uno de red, hasta tres veces, cada vez más espaciado. */
create or replace function interno_auto_resultado(p_envio uuid, p_wamid text, p_error jsonb, p_reintentar boolean)
returns void language plpgsql security definer set search_path = public as $$
declare x interno_envios;
begin
  select * into x from interno_envios where id = p_envio for update;
  if x.mensaje_id is not null then
    perform interno_wa_resultado_envio(x.mensaje_id, p_wamid, p_error);
  end if;
  if p_error is null then
    update interno_envios set estado = 'enviado', error = null where id = p_envio;
  elsif p_reintentar and x.intentos < 3 then
    update interno_envios set estado = 'aprobado', error = p_error, proximo_intento = now() + make_interval(mins => 15 * x.intentos * x.intentos) where id = p_envio;
  else
    update interno_envios set estado = 'fallido', error = p_error where id = p_envio;
  end if;
end;
$$;
revoke execute on function interno_auto_resultado(uuid, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function interno_auto_resultado(uuid, text, jsonb, boolean) to service_role;


/* ---------- El reloj ---------- */
/* Corre cada 5 minutos. Genera en SQL; si hay algo que necesite al
   servidor (mandar, o preguntarle a Meta por una plantilla), le avisa
   con una llave de un solo uso. */
create or replace function interno_auto_disparar()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_res jsonb;
  v_corrida bigint;
  v_llave text;
  v_url text;
begin
  insert into interno_auto_corridas (origen) values ('reloj') returning id into v_corrida;
  begin
    v_res := interno_auto_generar();
    update interno_auto_corridas set generados = (v_res ->> 'generados')::int, alertas = (v_res ->> 'alertas')::int, termino_en = now()
      where id = v_corrida;
  exception when others then
    update interno_auto_corridas set error = sqlerrm, termino_en = now() where id = v_corrida;
    return;
  end;

  delete from interno_auto_llaves where creada_en < now() - interval '1 hour';
  delete from interno_auto_corridas where empezo_en < now() - interval '30 days';

  if exists (select 1 from interno_envios where estado = 'aprobado' and programado_para <= now() and (proximo_intento is null or proximo_intento <= now()))
     or exists (select 1 from interno_wa_plantillas where estado = 'enviada' and archivado_en is null) then
    v_llave := encode(gen_random_bytes(24), 'hex');
    insert into interno_auto_llaves (llave) values (v_llave);
    select valor ->> 'url' into v_url from interno_ajustes where clave = 'automatizaciones';
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('accion', 'automatizaciones'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Genez-Llave', v_llave),
      timeout_milliseconds := 30000);
  end if;
end;
$$;
revoke execute on function interno_auto_disparar() from public, anon, authenticated;

/* El servidor gasta la llave: existe, es reciente, y no sirve dos veces. */
create or replace function interno_auto_usar_llave(p_llave text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  delete from interno_auto_llaves where llave = p_llave and creada_en > now() - interval '5 minutes' returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
revoke execute on function interno_auto_usar_llave(text) from public, anon, authenticated;
grant execute on function interno_auto_usar_llave(text) to service_role;

select cron.schedule('genez-automatizaciones', '*/5 * * * *', 'select public.interno_auto_disparar()');


/* ---------- Permisos ---------- */
do $$
declare t text;
begin
  foreach t in array array['interno_wa_plantillas', 'interno_automatizaciones'] loop
    execute format('create trigger %I before insert or update on %I for each row execute function interno_sellar()', t || '_sello', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function interno_anotar()', t || '_historial', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (es_interno(%L))', t || '_ver', t, 'mensajes');
    execute format('create policy %I on %I for insert with check (es_interno(%L))', t || '_crear', t, 'mensajes');
    execute format('create policy %I on %I for update using (es_interno(%L)) with check (es_interno(%L))', t || '_editar', t, 'mensajes', 'mensajes');
    execute format('revoke all on %I from anon', t);
    execute format('revoke delete, truncate, references, trigger on %I from authenticated', t);
  end loop;
end;
$$;
/* El estado, el id de Meta y el rechazo los escribe el servidor. */
revoke insert, update on interno_wa_plantillas from authenticated;
grant insert (nombre, idioma, categoria, cuerpo, variables, ejemplos) on interno_wa_plantillas to authenticated;
grant update (nombre, idioma, categoria, cuerpo, variables, ejemplos, archivado_en) on interno_wa_plantillas to authenticated;

alter table interno_envios enable row level security;
create policy interno_envios_ver on interno_envios for select using (es_interno('mensajes'));
create policy interno_envios_decidir on interno_envios for update using (es_interno('mensajes')) with check (es_interno('mensajes'));
revoke all on interno_envios from anon;
revoke insert, update, delete, truncate, references, trigger on interno_envios from authenticated;
grant update (estado) on interno_envios to authenticated;
create trigger interno_envios_historial after update on interno_envios for each row execute function interno_anotar();

/* Las alertas son de todo el equipo: cada una lleva a algo que se ve
   con su propia área (el prospecto con crm, la conversación con
   mensajes). */
alter table interno_alertas enable row level security;
create policy interno_alertas_ver on interno_alertas for select using (es_interno());
create policy interno_alertas_descartar on interno_alertas for update using (es_interno()) with check (es_interno());
revoke all on interno_alertas from anon;
revoke insert, update, delete, truncate, references, trigger on interno_alertas from authenticated;
grant update (descartada_en) on interno_alertas to authenticated;

alter table interno_auto_corridas enable row level security;
create policy interno_auto_corridas_ver on interno_auto_corridas for select using (es_interno('mensajes'));
revoke all on interno_auto_corridas from anon;
revoke insert, update, delete, truncate, references, trigger on interno_auto_corridas from authenticated;

alter table interno_auto_llaves enable row level security;
revoke all on interno_auto_llaves from anon, authenticated;


/* ---------- Las reglas de arranque ---------- */
/* Las de WhatsApp, apagadas y sin plantilla: hay que escribirla, que
   Meta la apruebe y elegirla. Las alertas internas no mandan nada a
   nadie: arrancan prendidas. */
insert into interno_automatizaciones (nombre, tipo, activa, parametros, consentimiento, aprobacion_manual) values
  ('Recordatorio de demo o reunión', 'recordatorio_evento', false, '{"horas_antes": 24, "tipos": ["demo", "reunion", "visita"]}', 'sin_baja', true),
  ('Seguimiento a quien pidió información', 'seguimiento', false, '{"dias": 3}', 'dado', true),
  ('Oportunidades sin contacto', 'alerta_oportunidad', true, '{"dias": 7}', 'dado', true),
  ('Conversaciones que esperan', 'alerta_conversacion', true, '{"minutos": 60}', 'dado', true);
