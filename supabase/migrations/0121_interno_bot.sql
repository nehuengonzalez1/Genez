/* ============================================================
   0121 — GENEZ FOUNDER: el asistente de WhatsApp (etapa 4)

   Un modelo de IA lee cada mensaje que entra al WhatsApp de Genez y
   prepara una respuesta con lo que dice la base de conocimiento, o
   decide pasarle la conversación a una persona. De fábrica NO manda
   nada: deja un borrador que alguien del equipo usa, corrige o
   descarta. El modo automático existe, apagado, para cuando la base
   esté probada.

   LA BASE DE CONOCIMIENTO SON DOCUMENTOS DE FOUNDER
   -------------------------------------------------
   Los del tipo 'base_bot' en estado 'vigente'. Ya tienen editor,
   versiones e historial (0116): no hacía falta otra tabla. Cada
   borrador guarda qué documentos y qué versión usó, así una respuesta
   rara se puede rastrear hasta el texto que la produjo. Los de esta
   migración entran en 'borrador': el bot no los lee hasta que alguien
   los revisa y los pasa a 'vigente'.

   QUIÉN ESCRIBE
   -------------
   Igual que 0120: los borradores los escribe api/founder.js con la
   service_role. Del navegador solo se puede descartar uno pendiente, y
   manejar la conversación (pausar el asistente, "ya la atiendo").

   EL MODO AUTOMÁTICO TIENE TRES FRENOS EN LA BASE
   -----------------------------------------------
   interno_wa_preparar_envio sin perfil es el bot, y la base le exige
   que el asistente esté prendido y en automático, que esa conversación
   no esté pausada, y un tope de mensajes por hora por conversación. El
   tope es contra el caso de dos bots contestándose sin fin.
   ============================================================ */


/* ---------- El tipo de documento ---------- */
insert into interno_listas (tipo, clave, nombre, orden)
  values ('tipo_documento', 'base_bot', 'Base del asistente', 20)
on conflict do nothing;


/* ---------- Los ajustes del asistente ---------- */
alter table interno_ajustes drop constraint interno_ajustes_clave;
alter table interno_ajustes add constraint interno_ajustes_clave check (clave in ('empresa', 'agenda', 'whatsapp', 'bot'));
insert into interno_ajustes (clave, valor) values
  ('bot', jsonb_build_object(
    'activo', false,
    'modo', 'borrador',
    'modelo', 'claude-opus-5-5',
    'aviso', 'Hola, soy el asistente automático de Genez. Si preferís hablar con una persona, escribí PERSONA.',
    'max_por_hora', 6))
on conflict (clave) do nothing;


/* ---------- La conversación: pausa y derivación ---------- */
alter table interno_wa_conversaciones
  add column bot_pausado     boolean not null default false,
  add column derivada_en     timestamptz,
  add column derivada_motivo text;
comment on column interno_wa_conversaciones.derivada_en is
  'El asistente la pasó a una persona (no supo, o la pidieron). Se limpia con "ya la atiendo".';
grant update (bot_pausado, derivada_en, derivada_motivo) on interno_wa_conversaciones to authenticated;

/* Un mensaje saliente puede ser del bot: sin perfil y con esta marca. */
alter table interno_wa_mensajes add column del_bot boolean not null default false;


/* ---------- Los borradores ---------- */
create table interno_wa_borradores (
  id               uuid primary key default gen_random_uuid(),
  conversacion_id  uuid not null references interno_wa_conversaciones(id) on delete restrict,
  origen_id        uuid references interno_wa_mensajes(id) on delete set null,
  accion           text not null,
  texto            text,
  motivo           text,
  datos            jsonb not null default '{}',
  conocimiento     jsonb not null default '[]',
  modelo           text,
  uso              jsonb,
  estado           text not null default 'pendiente',
  error            text,
  mensaje_id       uuid references interno_wa_mensajes(id) on delete set null,
  creado_en        timestamptz not null default now(),
  resuelto_en      timestamptz,
  resuelto_por     uuid references perfiles(id) on delete set null,
  constraint interno_wa_borradores_accion check (accion in ('responder', 'derivar', 'error')),
  constraint interno_wa_borradores_estado check (estado in ('pendiente', 'enviado', 'descartado', 'reemplazado', 'derivada', 'error')),
  constraint interno_wa_borradores_texto check (accion <> 'responder' or length(btrim(coalesce(texto, ''))) between 1 and 4096),
  constraint interno_wa_borradores_error check ((accion = 'error') = (estado = 'error'))
);
comment on column interno_wa_borradores.conocimiento is
  'Los documentos de la base que vio el modelo: [{id, titulo, version}].';
comment on column interno_wa_borradores.datos is
  'Lo que el modelo cree haber entendido (rubro, necesidad, negocio, quiere_demo). Son inferencias: nada se escribe en el CRM sin que alguien lo confirme.';
/* Un solo borrador pendiente por conversación: el nuevo reemplaza al viejo. */
create unique index interno_wa_borradores_uno on interno_wa_borradores (conversacion_id) where estado = 'pendiente';
create index on interno_wa_borradores (creado_en desc);

/* Del navegador, lo único que se hace con un borrador es descartarlo. */
create or replace function interno_wa_borradores_cuidar()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null then
    if old.estado <> 'pendiente' or new.estado <> 'descartado' then
      raise exception 'Solo se puede descartar un borrador pendiente.' using errcode = '42501';
    end if;
    new.resuelto_en := now();
    new.resuelto_por := auth.uid();
  end if;
  return new;
end;
$$;
revoke execute on function interno_wa_borradores_cuidar() from public, anon, authenticated;
create trigger interno_wa_borradores_cuidado before update on interno_wa_borradores
  for each row execute function interno_wa_borradores_cuidar();


/* ---------- Guardar lo que decidió el modelo ---------- */
create or replace function interno_bot_guardar(p_conversacion uuid, p_origen uuid, p_accion text, p_texto text, p_motivo text,
                                               p_datos jsonb, p_conocimiento jsonb, p_modelo text, p_uso jsonb, p_error text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update interno_wa_borradores set estado = 'reemplazado', resuelto_en = now()
    where conversacion_id = p_conversacion and estado = 'pendiente';

  insert into interno_wa_borradores (conversacion_id, origen_id, accion, texto, motivo, datos, conocimiento, modelo, uso, estado, error)
    values (p_conversacion, p_origen, p_accion, nullif(btrim(coalesce(p_texto, '')), ''), p_motivo, coalesce(p_datos, '{}'),
            coalesce(p_conocimiento, '[]'), p_modelo, p_uso,
            case when p_accion = 'error' then 'error' when p_accion = 'derivar' then 'derivada' else 'pendiente' end, p_error)
    returning id into v_id;

  /* Derivar pausa el asistente en esa conversación: si no, al próximo
     mensaje volvería a contestar lo que acaba de decir que no sabe. */
  if p_accion = 'derivar' then
    update interno_wa_conversaciones set derivada_en = now(), derivada_motivo = left(p_motivo, 300), bot_pausado = true
      where id = p_conversacion;
  end if;
  return v_id;
end;
$$;
revoke execute on function interno_bot_guardar(uuid, uuid, text, text, text, jsonb, jsonb, text, jsonb, text) from public, anon, authenticated;
grant execute on function interno_bot_guardar(uuid, uuid, text, text, text, jsonb, jsonb, text, jsonb, text) to service_role;


/* ---------- Preparar un envío: ahora también el del bot ---------- */
/* Cambia la firma (el borrador), así que se reemplaza entera. Sin
   perfil es el bot, con sus tres frenos. */
drop function interno_wa_preparar_envio(uuid, uuid, text, text);
create or replace function interno_wa_preparar_envio(p_perfil uuid, p_conversacion uuid, p_texto text, p_idempotencia text, p_borrador uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c interno_wa_conversaciones;
  v_m interno_wa_mensajes;
  v_texto text := btrim(coalesce(p_texto, ''));
  v_bot jsonb;
  v_recientes integer;
begin
  if p_perfil is not null and not interno_es_miembro(p_perfil, 'mensajes') then
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

  if p_perfil is null then
    select valor into v_bot from interno_ajustes where clave = 'bot';
    if not coalesce((v_bot ->> 'activo')::boolean, false) or v_bot ->> 'modo' is distinct from 'automatico' then
      raise exception 'El asistente no está en modo automático.' using errcode = '42501';
    end if;
    if v_c.bot_pausado then
      raise exception 'El asistente está pausado en esta conversación.' using errcode = '42501';
    end if;
    select count(*) into v_recientes from interno_wa_mensajes
      where conversacion_id = p_conversacion and del_bot and creado_en > now() - interval '1 hour';
    if v_recientes >= coalesce((v_bot ->> 'max_por_hora')::integer, 6) then
      raise exception 'El asistente llegó al tope de mensajes por hora en esta conversación.' using errcode = '42501';
    end if;
  end if;

  insert into interno_wa_mensajes (conversacion_id, direccion, tipo, texto, estado, enviado_por, idempotencia, del_bot)
    values (p_conversacion, 'saliente', 'text', v_texto, 'enviando', p_perfil, p_idempotencia, p_perfil is null)
    returning * into v_m;

  update interno_wa_conversaciones set
    ultimo_mensaje_en = now(), ultimo_texto = left(v_texto, 200), ultimo_direccion = 'saliente',
    no_leidos = case when p_perfil is null then no_leidos else 0 end, actualizado_por = p_perfil
  where id = p_conversacion;

  if p_borrador is not null then
    update interno_wa_borradores set estado = 'enviado', mensaje_id = v_m.id, resuelto_en = now(), resuelto_por = p_perfil
      where id = p_borrador and conversacion_id = p_conversacion and estado = 'pendiente';
  end if;

  return jsonb_build_object('mensaje', v_m.id, 'repetido', false, 'estado', v_m.estado, 'wa_id', v_c.wa_id);
end;
$$;
revoke execute on function interno_wa_preparar_envio(uuid, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function interno_wa_preparar_envio(uuid, uuid, text, text, uuid) to service_role;


/* ---------- Procesar un webhook: ahora dice qué conversaciones tienen algo nuevo ---------- */
/* Igual que en 0120, más la lista de conversaciones con mensajes nuevos,
   que es lo que el servidor le pasa al asistente. */
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
  v_convs uuid[] := '{}';
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
          continue when v_filas = 0;
          v_mensajes := v_mensajes + 1;
          if not v_conv = any(v_convs) then v_convs := v_convs || v_conv; end if;

          update interno_wa_conversaciones set
            ultimo_entrante_en = greatest(coalesce(ultimo_entrante_en, v_momento), v_momento),
            ultimo_mensaje_en  = greatest(coalesce(ultimo_mensaje_en, v_momento), v_momento),
            ultimo_texto       = case when ultimo_mensaje_en is null or v_momento >= ultimo_mensaje_en
                                      then coalesce(left(v_texto, 200), '[' || coalesce(v_m ->> 'type', 'mensaje') || ']') else ultimo_texto end,
            ultimo_direccion   = case when ultimo_mensaje_en is null or v_momento >= ultimo_mensaje_en then 'entrante' else ultimo_direccion end,
            no_leidos          = no_leidos + 1,
            estado             = case when estado = 'cerrada' then 'abierta' else estado end,
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
    update interno_wa_eventos set error = sqlerrm where id = v_evento;
    return jsonb_build_object('evento', v_evento, 'error', sqlerrm, 'conversaciones', '[]'::jsonb);
  end;

  return jsonb_build_object('evento', v_evento, 'mensajes', v_mensajes, 'estados', v_estados, 'conversaciones', to_jsonb(v_convs));
end;
$$;
revoke execute on function interno_wa_procesar(jsonb) from public, anon, authenticated;
grant execute on function interno_wa_procesar(jsonb) to service_role;


/* ---------- Permisos ---------- */
alter table interno_wa_borradores enable row level security;
create policy interno_wa_borradores_ver on interno_wa_borradores for select using (es_interno('mensajes'));
create policy interno_wa_borradores_descartar on interno_wa_borradores for update
  using (es_interno('mensajes')) with check (es_interno('mensajes'));
revoke all on interno_wa_borradores from anon;
revoke insert, update, delete, truncate, references, trigger on interno_wa_borradores from authenticated;
grant update (estado) on interno_wa_borradores to authenticated;


/* ---------- La vista ---------- */
/* Suma a la de 0120 si hay un borrador esperando. Se recrea entera
   porque cambian las columnas de la tabla (c.*). */
drop view interno_wa_conversaciones_vista;
create view interno_wa_conversaciones_vista with (security_invoker = true) as
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
       ) end as prospecto_sugerido_nombre,
       exists (select 1 from interno_wa_borradores b where b.conversacion_id = c.id and b.estado = 'pendiente') as con_borrador
  from interno_wa_conversaciones c
  left join interno_prospectos p on p.id = c.prospecto_id
  left join interno_clientes cl on cl.prospecto_id = c.prospecto_id;
revoke all on interno_wa_conversaciones_vista from anon;


/* ---------- La base de conocimiento de arranque ---------- */
/* En 'borrador': el asistente no los lee hasta que alguien los revisa
   y los pasa a 'vigente'. Están escritos con lo que el sistema hace hoy
   (src/datos/modulos.js); los precios quedan a confirmar a propósito. */
insert into interno_documentos (titulo, tipo, categoria, estado, contenido) values
('Qué es Genez', 'base_bot', 'Asistente', 'borrador',
'Genez es un sistema de gestión para comercios de Argentina: se usa en la computadora del local y desde el celular. Se arma según el negocio: cada comercio contrata los módulos que necesita.

Rubros que atiende hoy: minimercados y almacenes, gastronomía (bares y restaurantes) y negocios de servicios con turnos (estética, gimnasios, profesionales).

Módulos que existen hoy:
- Cobro: punto de venta, tickets y vuelto (incluido siempre).
- Caja: arqueo, gastos y cierre (incluido siempre).
- Productos: catálogo, precios y listas.
- Stock: alertas, vencimientos e inventario.
- Compras: remitos, costos y proveedores.
- Salón: mesas, comandas y cocina.
- Pedidos: preparación de pedidos.
- Clientes: facturación electrónica A, B y C ante ARCA.
- Cuenta corriente: fiado, quién debe y cobros.
- Agenda: turnos, clases y disponibilidad.
- Servicios y recursos: qué se ofrece y dónde se hace.
- Ventas: abonos, packs y planes.
- Equipo: quién trabaja, horarios y liquidaciones.
- Finanzas: ingresos, egresos y sueldos.
- Informes: ventas, márgenes y rubros.
- Permisos: qué puede hacer cada persona del equipo.
- Asistente con IA: diagnóstico y consultas sobre el negocio.

Cada comercio puede tener su propia app para sus clientes (por ejemplo, para sacar turno).

Se puede ver una demo o pedir un presupuesto en genez.com.ar.'),
('Precios y condiciones', 'base_bot', 'Asistente', 'borrador',
'Los precios están A CONFIRMAR. Hasta que este documento diga los precios vigentes, el asistente no da ningún número: le dice a la persona que un asesor le pasa el presupuesto según los módulos que necesite, y deriva la conversación.

Lo que sí se puede decir:
- No hay permanencia: se cancela cuando se quiera.
- No hace falta tarjeta para pedir el presupuesto.
- El presupuesto se arma en genez.com.ar eligiendo el rubro y los módulos.'),
('Lo que el asistente no puede hacer ni prometer', 'base_bot', 'Asistente', 'borrador',
'- No inventar precios, descuentos, plazos de instalación ni fechas.
- No prometer funciones, integraciones o módulos que no estén en "Qué es Genez".
- No decir que Genez se integra con un sistema, banco o plataforma si no está escrito acá.
- No pedir contraseñas, datos de tarjeta, CBU ni documentos.
- No dar asesoramiento contable, impositivo ni legal (por ejemplo, qué categoría de monotributo corresponde).
- Si la persona pide hablar con alguien, o está enojada, o pregunta algo que no está en esta base: derivar a una persona.
- Si pide que no le escriban más: responder que no se le va a escribir más y derivar.');
