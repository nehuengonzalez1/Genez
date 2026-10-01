/* ============================================================
   0123 — GENEZ FOUNDER: métricas y una fuente propia (etapa 6)

   Tres informes que cuenta la base, y los pedidos de presupuesto de la
   landing como fuente de prospectos.

   LOS INFORMES SON DE QUIEN LOS PIDE
   ----------------------------------
   Las tres funciones son security invoker: cuentan con los permisos de
   quien pregunta. Alguien sin el área 'mensajes' ve los mensajes en
   cero, no un error ni los números de otro. Así no hace falta repetir
   acá las reglas de cada tabla.

   ENVIADO NO ES ENTREGADO NI LEÍDO
   --------------------------------
   El estado de un mensaje solo avanza (0120): uno 'leido' también se
   entregó y se envió. Por eso cada número cuenta "llegó al menos hasta
   acá": enviados incluye a los entregados y a los leídos, y cada fila
   es un subconjunto de la anterior. "Leído" depende de que la persona
   tenga las confirmaciones de lectura prendidas: es un piso, no el
   total.

   LOS PEDIDOS DE LA WEB
   ---------------------
   solicitudes (0074) era solo de la plataforma. Ahora también la ve
   quien tiene el área crm de Founder, y un pedido se pasa al CRM como
   prospecto (fuente 'landing') con su contacto, sin duplicar: si el
   teléfono o el correo ya están, se vincula al que existe.
   ============================================================ */


/* Va primero: el informe de descubrimiento la cuenta. */
alter table solicitudes add column prospecto_id uuid references interno_prospectos(id) on delete set null;
comment on column solicitudes.prospecto_id is 'El prospecto de Founder que se armó con este pedido (0123).';


/* ---------- WhatsApp, asistente y automatizaciones ---------- */
create or replace function interno_informe_whatsapp(p_desde timestamptz, p_hasta timestamptz)
returns jsonb language sql stable security invoker set search_path = public as $$
with m as (
  select m.*,
         case when m.tipo = 'template' then 'automatico' when m.del_bot then 'asistente' else 'equipo' end as origen
    from interno_wa_mensajes m
   where m.momento >= p_desde and m.momento < p_hasta
),
sal as (
  select origen,
         count(*) filter (where estado in ('enviado', 'entregado', 'leido')) as enviados,
         count(*) filter (where estado in ('entregado', 'leido')) as entregados,
         count(*) filter (where estado = 'leido') as leidos,
         count(*) filter (where estado = 'fallido') as fallidos,
         count(*) filter (where estado = 'enviando') as enviando
    from m where direccion = 'saliente' group by origen
),
conv as (
  select c.*,
         exists (select 1 from interno_wa_mensajes x where x.conversacion_id = c.id and x.direccion = 'entrante' and x.momento >= p_desde and x.momento < p_hasta) as escribio
    from interno_wa_conversaciones c
),
errores as (
  select coalesce(e ->> 'code', 'sin código') as codigo, count(*) as n
    from m
    cross join lateral jsonb_array_elements(case jsonb_typeof(m.error) when 'array' then m.error when 'object' then jsonb_build_array(m.error) else '[]'::jsonb end) e
   where m.direccion = 'saliente' and m.estado = 'fallido'
   group by 1
),
aut as (
  /* Una respuesta a un automático: la persona escribió en las 72 horas
     siguientes a que le llegó. */
  select count(*) filter (where x.estado = 'enviado') as enviados,
         count(*) filter (where x.estado = 'fallido') as fallidos,
         count(*) filter (where x.estado = 'omitido') as omitidos,
         count(*) filter (where x.estado = 'cancelado') as cancelados,
         count(*) filter (where x.estado = 'enviado' and exists (
           select 1 from interno_wa_mensajes r join interno_wa_mensajes s on s.id = x.mensaje_id
            where r.conversacion_id = s.conversacion_id and r.direccion = 'entrante'
              and r.momento > s.momento and r.momento < s.momento + interval '72 hours')) as respondidos,
         count(*) filter (where x.estado = 'enviado' and p.categoria = 'UTILITY') as utilidad,
         count(*) filter (where x.estado = 'enviado' and p.categoria = 'MARKETING') as marketing
    from interno_envios x left join interno_wa_plantillas p on p.id = x.plantilla_id
   where x.creado_en >= p_desde and x.creado_en < p_hasta
),
bot as (
  select count(*) filter (where accion = 'responder') as respuestas,
         count(*) filter (where accion = 'derivar') as derivadas,
         count(*) filter (where accion = 'error') as errores,
         count(*) filter (where estado = 'enviado') as usados,
         count(*) filter (where estado = 'descartado') as descartados
    from interno_wa_borradores where creado_en >= p_desde and creado_en < p_hasta
),
uso as (
  select modelo, count(*) as pedidos,
         sum(coalesce((uso ->> 'entrada')::bigint, 0)) as entrada, sum(coalesce((uso ->> 'salida')::bigint, 0)) as salida,
         sum(coalesce((uso ->> 'cache_leido')::bigint, 0)) as cache_leido, sum(coalesce((uso ->> 'cache_escrito')::bigint, 0)) as cache_escrito
    from interno_wa_borradores
   where creado_en >= p_desde and creado_en < p_hasta and uso is not null and modelo is not null
   group by modelo
)
select jsonb_build_object(
  'salientes', coalesce((select jsonb_object_agg(origen, to_jsonb(sal) - 'origen') from sal), '{}'),
  'entrantes', (select count(*) from m where direccion = 'entrante'),
  'conversaciones_nuevas', (select count(*) from conv where creado_en >= p_desde and creado_en < p_hasta),
  'conversaciones_con_respuesta', (select count(*) from conv where escribio),
  'calificadas', (select count(*) from conv where creado_en >= p_desde and creado_en < p_hasta and prospecto_id is not null),
  'calificadas_ganadas', (select count(*) from conv c where c.creado_en >= p_desde and c.creado_en < p_hasta and c.prospecto_id is not null
                            and exists (select 1 from interno_oportunidades o where o.prospecto_id = c.prospecto_id and o.estado = 'ganada')),
  'bajas', (select count(*) from conv where consentimiento = 'baja' and consentimiento_en >= p_desde and consentimiento_en < p_hasta),
  'consentimientos', (select count(*) from conv where consentimiento = 'dado' and consentimiento_en >= p_desde and consentimiento_en < p_hasta),
  'errores', coalesce((select jsonb_object_agg(codigo, n) from errores), '{}'),
  'automatizaciones', (select to_jsonb(aut) from aut),
  'asistente', (select to_jsonb(bot) from bot),
  'uso_modelos', coalesce((select jsonb_agg(to_jsonb(uso)) from uso), '[]')
)
$$;
revoke execute on function interno_informe_whatsapp(timestamptz, timestamptz) from public, anon;


/* ---------- Descubrimiento y demos ---------- */
create or replace function interno_informe_descubrimiento(p_desde timestamptz, p_hasta timestamptz)
returns jsonb language sql stable security invoker set search_path = public as $$
select jsonb_build_object(
  'por_proveedor', coalesce((
    select jsonb_agg(jsonb_build_object('proveedor', proveedor, 'descubiertos', n, 'con_telefono', tel, 'al_crm', crm, 'descartados', desc_)) from (
      select proveedor, count(*) as n,
             count(*) filter (where coalesce(telefono, whatsapp) is not null) as tel,
             count(*) filter (where prospecto_id is not null) as crm,
             count(*) filter (where descartado_en is not null) as desc_
        from interno_hallazgos where obtenido_en >= p_desde and obtenido_en < p_hasta group by proveedor) t), '[]'),
  'busquedas', (select count(*) from interno_busquedas where creado_en >= p_desde and creado_en < p_hasta),
  'busquedas_con_error', (select count(*) from interno_busquedas where creado_en >= p_desde and creado_en < p_hasta and error is not null),
  'pedidos_web', (select count(*) from solicitudes where creado_en >= p_desde and creado_en < p_hasta),
  'pedidos_web_al_crm', (select count(*) from solicitudes where creado_en >= p_desde and creado_en < p_hasta and prospecto_id is not null),
  /* Agendadas: las que se cargaron en el período. Realizadas y
     canceladas: las que eran para el período. No es la misma cohorte, y
     la pantalla lo dice. */
  'demos_agendadas', (select count(*) from interno_eventos where tipo = 'demo' and archivado_en is null and creado_en >= p_desde and creado_en < p_hasta),
  'demos_realizadas', (select count(*) from interno_eventos where tipo = 'demo' and archivado_en is null and estado = 'realizado' and inicio >= p_desde and inicio < p_hasta),
  'demos_canceladas', (select count(*) from interno_eventos where tipo = 'demo' and archivado_en is null and estado = 'cancelado' and inicio >= p_desde and inicio < p_hasta),
  'demos_vencidas', (select count(*) from interno_eventos where tipo = 'demo' and archivado_en is null and estado = 'programado' and inicio >= p_desde and inicio < least(p_hasta, now()))
)
$$;
revoke execute on function interno_informe_descubrimiento(timestamptz, timestamptz) from public, anon;


/* ---------- Los pedidos de la web, al CRM ---------- */

create policy solicitudes_founder_ver on solicitudes for select to authenticated using (public.es_interno('crm'));

create or replace function interno_solicitud_a_prospecto(p_solicitud uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s solicitudes;
  v_prospecto uuid;
  v_nuevo boolean := false;
  v_detalle text;
begin
  if not es_interno('crm') then raise exception 'Sin acceso al CRM' using errcode = '42501'; end if;
  select * into s from solicitudes where id = p_solicitud for update;
  if not found then raise exception 'No existe ese pedido.' using errcode = 'P0002'; end if;
  if s.prospecto_id is not null then raise exception 'Ese pedido ya está en el CRM.' using errcode = '23505'; end if;

  /* El mismo teléfono o el mismo correo: es alguien que ya está. */
  select id into v_prospecto from interno_prospectos
   where archivado_en is null
     and ((interno_norm_tel(s.telefono) is not null and tel_norm = interno_norm_tel(s.telefono))
       or (nullif(lower(btrim(coalesce(s.email, ''))), '') is not null and email_norm = lower(btrim(s.email))))
   order by creado_en limit 1;

  v_detalle := concat_ws(' · ',
    nullif(s.negocio, ''), nullif(s.rubro, ''),
    case when cardinality(s.modulos) > 0 then 'módulos: ' || array_to_string(s.modulos, ', ') end,
    case when s.mensual is not null then 'presupuesto: $' || to_char(s.mensual, 'FM999G999G999') || '/mes' end);

  if v_prospecto is null then
    insert into interno_prospectos (nombre, telefono, whatsapp, email, fuente, descripcion, notas, modulos)
      values (coalesce(nullif(btrim(s.negocio), ''), s.nombre), s.telefono, s.telefono, nullif(btrim(s.email), ''), 'landing',
              v_detalle, nullif(btrim(s.mensaje), ''), coalesce(s.modulos, '{}'))
      returning id into v_prospecto;
    insert into interno_contactos (prospecto_id, nombre, telefono, whatsapp, email, principal)
      values (v_prospecto, s.nombre, s.telefono, s.telefono, nullif(btrim(s.email), ''), true);
    /* La oportunidad la crea el disparador de 0114; acá se le pone lo
       que pidió. */
    update interno_oportunidades set modulos = coalesce(s.modulos, '{}'), valor = coalesce(s.mensual, valor)
      where prospecto_id = v_prospecto and estado = 'abierta';
    v_nuevo := true;
  end if;

  insert into interno_actividades (prospecto_id, tipo, resultado, datos)
    values (v_prospecto, 'nota', 'Pidió un presupuesto en la web' || case when v_detalle <> '' then ': ' || v_detalle else '' end,
            jsonb_build_object('solicitud', s.id, 'nuevo', v_nuevo));
  /* El estado del pedido no cambia: pasarlo al CRM no es haberle escrito. */
  update solicitudes set prospecto_id = v_prospecto where id = s.id;
  return v_prospecto;
end;
$$;
revoke execute on function interno_solicitud_a_prospecto(uuid) from public, anon;
