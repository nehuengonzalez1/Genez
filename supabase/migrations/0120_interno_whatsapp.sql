/* ============================================================
   0120 — GENEZ FOUNDER: WhatsApp (etapa 3 de la extensión)

   Recibir y contestar mensajes de WhatsApp desde Founder, por la API
   oficial de Meta (Cloud API). No hay envíos masivos ni plantillas acá:
   solo lo que entra por el webhook y las respuestas dentro de la ventana
   de 24 horas que abre cada mensaje entrante, que es lo único que Meta
   deja mandar sin una plantilla aprobada (y además no se cobra).

   QUIÉN ESCRIBE
   -------------
   El navegador no inserta ni un mensaje. Todo lo escribe
   `api/founder.js` con la service_role, por tres funciones que solo
   puede ejecutar esa llave:

   - interno_wa_procesar: lo que manda Meta al webhook, ya con la firma
     verificada. Guarda el evento crudo y lo traduce a conversaciones,
     mensajes y estados de entrega.
   - interno_wa_preparar_envio: antes de llamar a Meta. Comprueba que
     quien manda sea del equipo con el área 'mensajes', que la ventana
     esté abierta y que la persona no haya pedido la baja, y deja el
     mensaje en 'enviando'.
   - interno_wa_resultado_envio: lo que contestó Meta.

   ¿Por qué no con el token del usuario, como el resto de Founder? Porque
   si el navegador pudiera escribir un mensaje, podría escribir uno
   "entregado" que nunca salió, o uno entrante que nadie mandó. El estado
   de un mensaje tiene que venir de Meta o de nadie. El servidor sí
   pregunta con el perfil de quien llama si es del equipo: esa respuesta
   sale de interno_miembros, la misma frontera de 0113.

   LOS REINTENTOS DE META
   ----------------------
   Meta reintenta un webhook hasta 7 días si no recibe un 200, y a veces
   manda el mismo dos veces aunque lo haya recibido. Por eso el wamid
   (el id del mensaje en Meta) es único: el segundo se ignora y no suma
   un no leído más. Y un estado nunca retrocede: si llega "entregado"
   después de "leído" —pasa, no vienen en orden— queda "leído".

   LO QUE NO SE HACE SOLO
   ----------------------
   Una conversación nueva no se engancha sola a un prospecto (y por él,
   a un cliente: todo cliente tiene su prospecto) aunque el
   teléfono coincida: la vista sugiere, y alguien lo confirma. Dos locales
   pueden compartir el celular del dueño.
   ============================================================ */


/* ---------- El área nueva ---------- */
alter table interno_miembros drop constraint interno_miembros_areas_validas;
alter table interno_miembros add constraint interno_miembros_areas_validas
  check (areas <@ array['*', 'crm', 'agenda', 'tareas', 'clientes', 'soporte', 'producto', 'docs', 'marketing', 'finanzas', 'config', 'mensajes']::text[]);

/* es_interno() pregunta por auth.uid(), y las funciones de abajo las
   llama la service_role, que no tiene uid. El servidor sabe quién pidió
   (validó su token) y se lo pasa. Misma regla, otro origen del id. */
create or replace function interno_es_miembro(p_perfil uuid, p_area text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select m.activo and ('*' = any(m.areas) or p_area = any(m.areas))
      from interno_miembros m where m.perfil_id = p_perfil
  ), false)
$$;
revoke execute on function interno_es_miembro(uuid, text) from public, anon, authenticated;


/* ---------- Ajustes: los ids de Meta ---------- */
/* No son secretos (salen en la pantalla de Meta y no sirven sin el
   token); el token, el app secret, el verify token y el PIN viven solo
   en las variables de Vercel. */
alter table interno_ajustes drop constraint interno_ajustes_clave;
alter table interno_ajustes add constraint interno_ajustes_clave check (clave in ('empresa', 'agenda', 'whatsapp'));
insert into interno_ajustes (clave, valor) values
  ('whatsapp', '{"phone_number_id": "1354663697730352", "waba_id": "1030672680024968", "numero": "+54 9 11 2485 9144"}')
on conflict (clave) do nothing;


/* ---------- Conversaciones ---------- */
create table interno_wa_conversaciones (
  id                  uuid primary key default gen_random_uuid(),
  wa_id               text not null unique,
  tel_norm            text,
  nombre_perfil       text,
  prospecto_id        uuid references interno_prospectos(id) on delete set null,
  estado              text not null default 'abierta',
  asignado_id         uuid references perfiles(id) on delete set null,
  ultimo_entrante_en  timestamptz,
  ultimo_mensaje_en   timestamptz,
  ultimo_texto        text,
  ultimo_direccion    text,
  no_leidos           integer not null default 0,
  consentimiento      text not null default 'sin_dato',
  consentimiento_en   timestamptz,
  consentimiento_nota text,
  notas               text,
  creado_en           timestamptz not null default now(),
  creado_por          uuid references perfiles(id) on delete set null,
  actualizado_en      timestamptz not null default now(),
  actualizado_por     uuid references perfiles(id) on delete set null,
  constraint interno_wa_conversaciones_wa_id check (wa_id ~ '^[0-9]{8,16}$'),
  constraint interno_wa_conversaciones_estado check (estado in ('abierta', 'pendiente', 'cerrada')),
  constraint interno_wa_conversaciones_no_leidos check (no_leidos >= 0),
  constraint interno_wa_conversaciones_consentimiento check (consentimiento in ('sin_dato', 'dado', 'baja'))
);
comment on column interno_wa_conversaciones.consentimiento is
  'sin_dato: escribió él (se le puede contestar en la ventana de 24 h). dado: aceptó expresamente recibir mensajes. baja: pidió que no le escriban; no sale nada más.';
comment on column interno_wa_conversaciones.ultimo_entrante_en is
  'Abre la ventana de 24 h de Meta: fuera de ella solo se puede mandar una plantilla aprobada.';
create index on interno_wa_conversaciones (ultimo_mensaje_en desc);
create index on interno_wa_conversaciones (tel_norm) where tel_norm is not null;

create or replace function interno_wa_conversaciones_normalizar()
returns trigger language plpgsql as $$
begin
  new.tel_norm := interno_norm_tel(new.wa_id);
  if new.consentimiento is distinct from (case when tg_op = 'UPDATE' then old.consentimiento end) then
    new.consentimiento_en := now();
  end if;
  return new;
end;
$$;
create trigger interno_wa_conversaciones_norm before insert or update on interno_wa_conversaciones
  for each row execute function interno_wa_conversaciones_normalizar();
revoke execute on function interno_wa_conversaciones_normalizar() from public, anon, authenticated;


/* ---------- Mensajes ---------- */
create table interno_wa_mensajes (
  id               uuid primary key default gen_random_uuid(),
  conversacion_id  uuid not null references interno_wa_conversaciones(id) on delete restrict,
  direccion        text not null,
  wamid            text unique,
  tipo             text not null default 'text',
  texto            text,
  datos            jsonb not null default '{}',
  estado           text not null,
  error            jsonb,
  enviado_por      uuid references perfiles(id) on delete set null,
  idempotencia     text unique,
  momento          timestamptz not null default now(),
  estado_en        timestamptz not null default now(),
  creado_en        timestamptz not null default now(),
  constraint interno_wa_mensajes_direccion check (direccion in ('entrante', 'saliente')),
  constraint interno_wa_mensajes_estado check (estado in ('recibido', 'enviando', 'enviado', 'entregado', 'leido', 'fallido')),
  constraint interno_wa_mensajes_estado_dir check ((direccion = 'entrante') = (estado = 'recibido')),
  constraint interno_wa_mensajes_tipo check (tipo ~ '^[a-z_]{1,30}$'),
  constraint interno_wa_mensajes_texto check (texto is null or length(texto) <= 4096)
);
comment on column interno_wa_mensajes.momento is
  'Cuándo pasó según Meta (el timestamp del mensaje), no cuándo llegó el webhook: los reintentos llegan tarde.';
create index on interno_wa_mensajes (conversacion_id, momento);

/* El orden de un estado: uno menor nunca pisa a uno mayor. 'fallido' le
   gana a todo menos a 'leido' (si lo leyó, salió). */
create or replace function interno_wa_rango(p_estado text)
returns integer language sql immutable as $$
  select case p_estado when 'enviando' then 0 when 'enviado' then 1 when 'entregado' then 2
                       when 'fallido' then 3 when 'leido' then 4 else -1 end
$$;
/* Solo la usan las funciones de abajo, que corren como dueñas. */
revoke execute on function interno_wa_rango(text) from public, anon, authenticated;


/* ---------- Lo que llegó al webhook, crudo ---------- */
/* Para poder mirar qué mandó Meta cuando algo no aparece. Solo entra lo
   que pasó la firma: un POST sin firma válida no se guarda, porque sería
   dejarle a cualquiera escribir en la base. */
create table interno_wa_eventos (
  id            bigint generated always as identity primary key,
  recibido_en   timestamptz not null default now(),
  cuerpo        jsonb not null,
  mensajes      integer not null default 0,
  estados       integer not null default 0,
  error         text
);
create index on interno_wa_eventos (recibido_en desc);


/* ---------- Procesar un webhook ---------- */
create or replace function interno_wa_procesar(p_cuerpo jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_evento bigint;
  v_entry jsonb; v_change jsonb; v_valor jsonb; v_m jsonb; v_s jsonb;
  v_nombres jsonb;
  v_conv uuid;
  v_texto text;
  v_momento timestamptz;
  v_filas integer;
  v_mensajes integer := 0;
  v_estados integer := 0;
begin
  insert into interno_wa_eventos (cuerpo) values (p_cuerpo) returning id into v_evento;

  begin
    if p_cuerpo ->> 'object' is distinct from 'whatsapp_business_account' then
      raise exception 'No es un evento de WhatsApp: %', coalesce(p_cuerpo ->> 'object', 'sin object');
    end if;

    for v_entry in select * from jsonb_array_elements(coalesce(p_cuerpo -> 'entry', '[]')) loop
      for v_change in select * from jsonb_array_elements(coalesce(v_entry -> 'changes', '[]')) loop
        continue when v_change ->> 'field' is distinct from 'messages';
        v_valor := v_change -> 'value';

        /* El nombre de perfil viene aparte, en contacts, por wa_id. */
        select coalesce(jsonb_object_agg(c ->> 'wa_id', c -> 'profile' ->> 'name'), '{}')
          into v_nombres from jsonb_array_elements(coalesce(v_valor -> 'contacts', '[]')) c;

        for v_m in select * from jsonb_array_elements(coalesce(v_valor -> 'messages', '[]')) loop
          v_momento := coalesce(to_timestamp((v_m ->> 'timestamp')::bigint), now());
          v_texto := case v_m ->> 'type'
            when 'text' then v_m -> 'text' ->> 'body'
            when 'button' then v_m -> 'button' ->> 'text'
            when 'interactive' then coalesce(v_m -> 'interactive' -> 'button_reply' ->> 'title', v_m -> 'interactive' -> 'list_reply' ->> 'title')
            when 'image' then v_m -> 'image' ->> 'caption'
            when 'video' then v_m -> 'video' ->> 'caption'
            when 'document' then coalesce(v_m -> 'document' ->> 'caption', v_m -> 'document' ->> 'filename')
            when 'reaction' then v_m -> 'reaction' ->> 'emoji'
            else null end;

          insert into interno_wa_conversaciones (wa_id, nombre_perfil)
            values (v_m ->> 'from', v_nombres ->> (v_m ->> 'from'))
            on conflict (wa_id) do update set nombre_perfil = coalesce(excluded.nombre_perfil, interno_wa_conversaciones.nombre_perfil)
            returning id into v_conv;

          insert into interno_wa_mensajes (conversacion_id, direccion, wamid, tipo, texto, datos, estado, momento)
            values (v_conv, 'entrante', v_m ->> 'id', coalesce(v_m ->> 'type', 'unknown'), left(v_texto, 4096), v_m, 'recibido', v_momento)
            on conflict (wamid) do nothing;
          get diagnostics v_filas = row_count;
          continue when v_filas = 0;   -- un reintento de Meta: ya estaba
          v_mensajes := v_mensajes + 1;

          update interno_wa_conversaciones set
            ultimo_entrante_en = greatest(coalesce(ultimo_entrante_en, v_momento), v_momento),
            ultimo_mensaje_en  = greatest(coalesce(ultimo_mensaje_en, v_momento), v_momento),
            ultimo_texto       = case when ultimo_mensaje_en is null or v_momento >= ultimo_mensaje_en
                                      then coalesce(left(v_texto, 200), '[' || coalesce(v_m ->> 'type', 'mensaje') || ']') else ultimo_texto end,
            ultimo_direccion   = case when ultimo_mensaje_en is null or v_momento >= ultimo_mensaje_en then 'entrante' else ultimo_direccion end,
            no_leidos          = no_leidos + 1,
            estado             = case when estado = 'cerrada' then 'abierta' else estado end,
            /* "BAJA" o "STOP", solos: es lo que dice el aviso de baja. Una
               frase que los contenga no cuenta, para no dar de baja a
               quien escribió "no me doy de baja". */
            consentimiento     = case when upper(btrim(coalesce(v_texto, ''))) in ('BAJA', 'STOP') then 'baja' else consentimiento end
          where id = v_conv;
        end loop;

        for v_s in select * from jsonb_array_elements(coalesce(v_valor -> 'statuses', '[]')) loop
          v_momento := coalesce(to_timestamp((v_s ->> 'timestamp')::bigint), now());
          update interno_wa_mensajes set
              estado    = case when v_s ->> 'status' = 'read' then 'leido'
                               when v_s ->> 'status' = 'delivered' then 'entregado'
                               when v_s ->> 'status' = 'sent' then 'enviado'
                               when v_s ->> 'status' = 'failed' then 'fallido' end,
              error     = case when v_s ->> 'status' = 'failed' then coalesce(v_s -> 'errors', error) else error end,
              estado_en = v_momento
            where wamid = v_s ->> 'id'
              and direccion = 'saliente'
              and v_s ->> 'status' in ('sent', 'delivered', 'read', 'failed')
              and interno_wa_rango(case v_s ->> 'status' when 'read' then 'leido' when 'delivered' then 'entregado'
                                        when 'sent' then 'enviado' else 'fallido' end) > interno_wa_rango(estado);
          get diagnostics v_filas = row_count;
          v_estados := v_estados + v_filas;
        end loop;
      end loop;
    end loop;

    update interno_wa_eventos set mensajes = v_mensajes, estados = v_estados where id = v_evento;
  exception when others then
    /* Se guarda el error y se devuelve bien: si Meta recibiera un error,
       reintentaría durante 7 días un cuerpo que va a fallar igual. Lo que
       no se pudo leer queda en interno_wa_eventos para mirarlo. */
    update interno_wa_eventos set error = sqlerrm where id = v_evento;
    return jsonb_build_object('evento', v_evento, 'error', sqlerrm);
  end;

  return jsonb_build_object('evento', v_evento, 'mensajes', v_mensajes, 'estados', v_estados);
end;
$$;
revoke execute on function interno_wa_procesar(jsonb) from public, anon, authenticated;
grant execute on function interno_wa_procesar(jsonb) to service_role;


/* ---------- Preparar un envío ---------- */
/* Devuelve el mensaje (nuevo, o el mismo si la clave de idempotencia se
   repite: un doble clic o un reintento del navegador no manda dos) y el
   wa_id a quien mandarlo. Las negativas son excepciones con un texto que
   se puede mostrar tal cual. */
create or replace function interno_wa_preparar_envio(p_perfil uuid, p_conversacion uuid, p_texto text, p_idempotencia text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c interno_wa_conversaciones;
  v_m interno_wa_mensajes;
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if not interno_es_miembro(p_perfil, 'mensajes') then
    raise exception 'No tenés acceso a los mensajes de WhatsApp.' using errcode = '42501';
  end if;
  if p_idempotencia is null or length(p_idempotencia) not between 8 and 100 then
    raise exception 'Falta la clave del envío.' using errcode = '22023';
  end if;

  select * into v_m from interno_wa_mensajes where idempotencia = p_idempotencia;
  if found then
    if v_m.conversacion_id <> p_conversacion then
      raise exception 'Esa clave ya se usó en otra conversación.' using errcode = '22023';
    end if;
    return jsonb_build_object('mensaje', v_m.id, 'repetido', true, 'estado', v_m.estado,
                              'wa_id', (select wa_id from interno_wa_conversaciones where id = v_m.conversacion_id));
  end if;

  if length(v_texto) = 0 then raise exception 'El mensaje está vacío.' using errcode = '22023'; end if;
  if length(v_texto) > 4096 then raise exception 'WhatsApp no deja mandar más de 4096 caracteres.' using errcode = '22023'; end if;

  select * into v_c from interno_wa_conversaciones where id = p_conversacion for update;
  if not found then raise exception 'No existe esa conversación.' using errcode = 'P0002'; end if;
  if v_c.consentimiento = 'baja' then
    raise exception 'Esta persona pidió que no le escriban.' using errcode = '42501';
  end if;
  if v_c.ultimo_entrante_en is null or v_c.ultimo_entrante_en < now() - interval '24 hours' then
    raise exception 'Pasaron más de 24 horas desde su último mensaje: Meta solo deja mandar una plantilla aprobada.' using errcode = '42501';
  end if;

  insert into interno_wa_mensajes (conversacion_id, direccion, tipo, texto, estado, enviado_por, idempotencia)
    values (p_conversacion, 'saliente', 'text', v_texto, 'enviando', p_perfil, p_idempotencia)
    returning * into v_m;

  update interno_wa_conversaciones set
    ultimo_mensaje_en = now(), ultimo_texto = left(v_texto, 200), ultimo_direccion = 'saliente',
    no_leidos = 0, actualizado_por = p_perfil
  where id = p_conversacion;

  return jsonb_build_object('mensaje', v_m.id, 'repetido', false, 'estado', v_m.estado, 'wa_id', v_c.wa_id);
end;
$$;
revoke execute on function interno_wa_preparar_envio(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function interno_wa_preparar_envio(uuid, uuid, text, text) to service_role;

create or replace function interno_wa_resultado_envio(p_mensaje uuid, p_wamid text, p_error jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update interno_wa_mensajes set
      wamid     = coalesce(p_wamid, wamid),
      estado    = case when p_error is not null then 'fallido'
                       when interno_wa_rango(estado) < 1 then 'enviado' else estado end,
      error     = p_error,
      estado_en = now()
    where id = p_mensaje and direccion = 'saliente';
end;
$$;
revoke execute on function interno_wa_resultado_envio(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function interno_wa_resultado_envio(uuid, text, jsonb) to service_role;


/* ---------- Permisos ---------- */
create trigger interno_wa_conversaciones_sello before insert or update on interno_wa_conversaciones for each row execute function interno_sellar();
create trigger interno_wa_conversaciones_historial after insert or update or delete on interno_wa_conversaciones for each row execute function interno_anotar();

alter table interno_wa_conversaciones enable row level security;
create policy interno_wa_conversaciones_ver on interno_wa_conversaciones for select using (es_interno('mensajes'));
create policy interno_wa_conversaciones_editar on interno_wa_conversaciones for update
  using (es_interno('mensajes')) with check (es_interno('mensajes'));
revoke all on interno_wa_conversaciones from anon;
/* Del navegador se cambia la gestión de la conversación y nada de lo que
   viene de Meta: ni el wa_id, ni los últimos mensajes, ni la ventana. */
revoke insert, update, delete, truncate, references, trigger on interno_wa_conversaciones from authenticated;
grant update (prospecto_id, estado, asignado_id, no_leidos, consentimiento, consentimiento_nota, notas)
  on interno_wa_conversaciones to authenticated;

alter table interno_wa_mensajes enable row level security;
create policy interno_wa_mensajes_ver on interno_wa_mensajes for select using (es_interno('mensajes'));
revoke all on interno_wa_mensajes from anon;
revoke insert, update, delete, truncate, references, trigger on interno_wa_mensajes from authenticated;

/* Los eventos crudos traen teléfonos y textos de todos: los ve quien
   configura, para diagnosticar. */
alter table interno_wa_eventos enable row level security;
create policy interno_wa_eventos_ver on interno_wa_eventos for select using (es_interno('config'));
revoke all on interno_wa_eventos from anon;
revoke insert, update, delete, truncate, references, trigger on interno_wa_eventos from authenticated;


/* ---------- La vista ---------- */
/* La sugerencia de prospecto: solo si hay uno y solo uno con ese
   teléfono. Con dos, no se sugiere nada: sería adivinar. */
create or replace view interno_wa_conversaciones_vista with (security_invoker = true) as
select c.*,
       (c.ultimo_entrante_en is not null and c.ultimo_entrante_en > now() - interval '24 hours') as ventana_abierta,
       c.ultimo_entrante_en + interval '24 hours' as ventana_cierra_en,
       p.nombre as prospecto_nombre,
       cl.id as cliente_id,
       cl.estado as cliente_estado,
       case when c.prospecto_id is null and c.tel_norm is not null then (
         select (array_agg(x.id))[1] from interno_prospectos x where x.tel_norm = c.tel_norm having count(*) = 1
       ) end as prospecto_sugerido_id,
       case when c.prospecto_id is null and c.tel_norm is not null then (
         select (array_agg(x.nombre))[1] from interno_prospectos x where x.tel_norm = c.tel_norm having count(*) = 1
       ) end as prospecto_sugerido_nombre
  from interno_wa_conversaciones c
  left join interno_prospectos p on p.id = c.prospecto_id
  left join interno_clientes cl on cl.prospecto_id = c.prospecto_id;
revoke all on interno_wa_conversaciones_vista from anon;
