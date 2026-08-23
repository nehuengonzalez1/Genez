/* ============================================================
   0043 · CRM · a quién hay que llamar hoy, y por qué
   ============================================================

   Un CRM de estos negocios no es una base de contactos: eso ya es
   `clientes`. Es una respuesta a una pregunta que hoy nadie puede
   contestar mirando el sistema —a quién conviene escribirle esta
   semana— y que en la práctica se contesta de memoria, o no se contesta.

   LOS SEGMENTOS NO SE GUARDAN, SE DERIVAN
   ---------------------------------------
   Misma regla que el stock y que el estado de una mesa. Una columna
   `es_cliente_dormido` se corrompe el día que la persona vuelve y nadie
   corre el proceso que la limpia; y sobre todo, el criterio cambia —hoy
   son 45 días, mañana el comercio decide que son 30— y con la marca
   guardada habría que recalcular el pasado entero.

   Son cinco, y cada uno existe porque tiene una acción distinta detrás:

     se_van             vino seguido y dejó de venir. Llamar antes de que
                        se acostumbre a no venir.
     sin_segunda        vino una sola vez. Es el momento exacto en que un
                        cliente se pierde y el más barato de recuperar.
     abono_por_vencer   se le termina el crédito. Renovar es más fácil
                        antes de que se corte la rutina que después.
     abono_vencido      se le venció y no renovó. Todavía se acuerda.
     falta_seguido      viene pero no aparece. Acá no hay nada que
                        vender: hay algo que preguntar, y si nadie
                        pregunta el que se va es él.

   LO QUE SE HIZO QUEDA ESCRITO
   ----------------------------
   `contactos` no es un registro burocrático: es lo que hace que la lista
   se vacíe a medida que se trabaja. Sin él, el lunes aparecen los mismos
   veinte nombres que el viernes y nadie sabe a cuáles ya les escribió.
   Por eso el segmento excluye a quien recibió un mensaje **por ese mismo
   motivo** en las últimas tres semanas: que a alguien se le haya avisado
   que su abono vence no significa que no haya que decirle, dos meses
   después, que hace rato no viene.

   NO MOLESTAR NO ES UNA TABLA
   ---------------------------
   Va en `clientes.campos_extra`, que es exactamente para esto. Una tabla
   de una columna booleana para algo que se marca cinco veces por año es
   una tabla que después hay que acordarse de consultar.

   FUERA DE ALCANCE, A PROPÓSITO
   -----------------------------
   Nada se manda solo. El encargo lo dice: la única integración de
   mensajería es abrir WhatsApp con el mensaje ya escrito. Las plantillas
   guardadas y el envío en tanda son de Comunicaciones, que va después.
   ============================================================ */

/* ------------------------------------------------------------
   1 · Lo que se le dijo a cada uno
   ------------------------------------------------------------ */

create table contactos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  cliente_id  uuid not null references clientes(id) on delete cascade,
  /* La clave del segmento por el que se lo contactó. Es texto y no una
     tabla de motivos: los segmentos son código, y un catálogo que hay
     que mantener en paralelo se desincroniza el primer día. */
  motivo      text not null,
  canal       text not null default 'whatsapp',
  texto       text,
  resultado   text not null default 'enviado',
  usuario_id  uuid references perfiles(id) on delete set null,
  fecha       timestamptz not null default now()
);

alter table contactos add constraint contactos_canal_valido check (
  canal in ('whatsapp', 'telefono', 'email', 'presencial')
);

/* `volvio` se marca a mano y es el único que dice si esto sirvió para
   algo. Sin él, el módulo no se puede evaluar: se sabe a cuántos se les
   escribió y a nadie cuántos volvieron. */
alter table contactos add constraint contactos_resultado_valido check (
  resultado in ('enviado', 'respondio', 'sin_respuesta', 'volvio')
);

create index on contactos (empresa_id, cliente_id, fecha desc);
create index on contactos (empresa_id, motivo, fecha desc);

comment on table contactos is
  'Lo que se le dijo a cada cliente y por qué. Es lo que hace que la lista de CRM se vacíe a medida que se trabaja en vez de repetir los mismos nombres.';

alter table contactos enable row level security;

create policy contactos_ver on contactos
  for select using (public.puede_ver(empresa_id));

create policy contactos_anotar on contactos
  for insert with check (public.puede_ver(empresa_id));

/* Se puede corregir el resultado —"respondió", "volvió"— pero no se
   puede reescribir qué se dijo ni cuándo. Mismo criterio que la
   bitácora: lo que pasó, pasó. */
create policy contactos_corregir on contactos
  for update using (public.puede_ver(empresa_id));


/* ------------------------------------------------------------
   2 · Los segmentos
   ------------------------------------------------------------ */

create or replace function crm_segmentos(p_empresa uuid)
returns table (
  segmento        text,
  cliente_id      uuid,
  cliente         text,
  tel             text,
  motivo          text,
  dias            int,
  valor           numeric,
  ultimo_contacto timestamptz
)
language sql
stable
as $$
  with base as (
    select cv.*
      from clientes_vista cv
     where cv.empresa_id = p_empresa
       and cv.activo
       /* Quien pidió que no lo molesten no aparece en ninguna lista. Es
          una sola condición y va acá arriba para que no haya forma de
          agregar un segmento que se la saltee. */
       and coalesce(cv.campos_extra ->> 'noContactar', 'false') <> 'true'
  ),

  /* El último mensaje por cliente y motivo. Tres semanas: menos es
     insistir y más es dejarlo enfriar. */
  ultimo as (
    select k.cliente_id, k.motivo, max(k.fecha) as fecha
      from contactos k
     where k.empresa_id = p_empresa
     group by k.cliente_id, k.motivo
  ),

  credito as (
    select av.cliente_id, av.estado, av.vence, av.restantes, av.nombre
      from abonos_vista av
     where av.empresa_id = p_empresa and not av.anulado
  )

  /* 1 · Venía seguido y dejó de venir. */
  select
    'se_van'::text, b.id, b.razon_social, b.tel,
    'Vino ' || b.asistio || ' veces y hace ' ||
      (current_date - b.ultima::date) || ' días que no aparece',
    (current_date - b.ultima::date)::int,
    b.gastado,
    u.fecha
  from base b
  left join ultimo u on u.cliente_id = b.id and u.motivo = 'se_van'
 where b.asistio >= 3
   and b.ultima is not null
   and b.ultima < now() - interval '45 days'
   and b.ultima > now() - interval '180 days'
   and b.proxima is null
   and (u.fecha is null or u.fecha < now() - interval '21 days')

  union all

  /* 2 · Vino una sola vez y no volvió. Se le da un margen de quince días
     antes de darlo por perdido: mucha gente saca el segundo turno en la
     misma semana y ahí no hay nada que hacer. */
  select
    'sin_segunda'::text, b.id, b.razon_social, b.tel,
    'Vino una sola vez, hace ' || (current_date - b.ultima::date) || ' días',
    (current_date - b.ultima::date)::int,
    b.gastado,
    u.fecha
  from base b
  left join ultimo u on u.cliente_id = b.id and u.motivo = 'sin_segunda'
 where b.asistio = 1
   and b.ultima is not null
   and b.ultima < now() - interval '15 days'
   and b.ultima > now() - interval '120 days'
   and b.proxima is null
   and (u.fecha is null or u.fecha < now() - interval '21 days')

  union all

  /* 3 · Se le está por terminar el crédito. Vale igual el que se queda
     sin clases que el que se queda sin días: para el cliente son la
     misma cosa —se le acabó— y para el negocio también.

     `distinct on` porque alguien puede tener dos abonos abiertos y en la
     lista tiene que aparecer una vez: son un mensaje, no dos. Gana el que
     se le termina primero, que es el que da la conversación. */
  select * from (
  select distinct on (b.id)
    'abono_por_vencer'::text, b.id, b.razon_social, b.tel,
    cr.nombre || (case
      when cr.restantes is not null and cr.restantes <= 2
        then ' · le quedan ' || cr.restantes || ' clases'
      else ' · vence en ' || (cr.vence - current_date) || ' días' end),
    coalesce((cr.vence - current_date), 0)::int,
    b.gastado,
    u.fecha
  from base b
  join credito cr on cr.cliente_id = b.id and cr.estado = 'activo'
  left join ultimo u on u.cliente_id = b.id and u.motivo = 'abono_por_vencer'
 where ((cr.vence is not null and cr.vence <= current_date + 10)
        or (cr.restantes is not null and cr.restantes <= 2))
   and (u.fecha is null or u.fecha < now() - interval '21 days')
 order by b.id, cr.vence
  ) por_vencer

  union all

  /* 4 · Se le venció y no renovó. Se corta a los 30 días porque después
     el mensaje ya no es "renovalo" sino "hace rato que no venís", que es
     el segmento 1 y tiene otro texto. */
  select * from (
  select distinct on (b.id)
    'abono_vencido'::text, b.id, b.razon_social, b.tel,
    cr.nombre || ' · venció hace ' || (current_date - cr.vence) || ' días',
    (current_date - cr.vence)::int,
    b.gastado,
    u.fecha
  from base b
  join credito cr on cr.cliente_id = b.id and cr.estado = 'vencido'
  left join ultimo u on u.cliente_id = b.id and u.motivo = 'abono_vencido'
 where cr.vence >= current_date - 30
   and not exists (select 1 from credito a2 where a2.cliente_id = b.id and a2.estado = 'activo')
   and (u.fecha is null or u.fecha < now() - interval '21 days')
 /* El más reciente: es el que la persona tiene fresco. */
 order by b.id, cr.vence desc
  ) vencidos

  union all

  /* 5 · Reserva y no viene. Este no es para venderle nada: es el que se
     va a ir en dos meses y todavía se puede preguntar por qué. */
  select
    'falta_seguido'::text, b.id, b.razon_social, b.tel,
    'Faltó ' || b.ausencias || ' de ' || (b.asistio + b.ausencias) || ' turnos',
    b.ausencias::int,
    b.gastado,
    u.fecha
  from base b
  left join ultimo u on u.cliente_id = b.id and u.motivo = 'falta_seguido'
 where b.asistio + b.ausencias >= 4
   and b.asistencia < 0.7
   and (u.fecha is null or u.fecha < now() - interval '21 days')
$$;

comment on function crm_segmentos is
  'A quién conviene escribirle y por qué. Los segmentos se derivan, no se guardan: el criterio cambia y una marca guardada obligaría a recalcular el pasado.';

grant execute on function crm_segmentos(uuid) to authenticated;


/* ------------------------------------------------------------
   3 · La sección en el menú

   Dejaba de estar "próxima" y pasa a tener su módulo. Una fila, no un
   componente: el menú sale de `rubros`.
   ------------------------------------------------------------ */

update rubros set menu = jsonb_set(
  menu, '{6}',
  '{
    "clave":"crm", "nombre":"CRM y marketing", "i":"corazon",
    "modulos":[
      {"k":"crm","n":"Seguimiento","i":"corazon","d":"A quién conviene escribirle esta semana, y por qué"}
    ]
  }'::jsonb
)
where clave = 'servicios'
  and menu -> 6 ->> 'clave' = 'crm';

do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  update empresas
     set modulos = array(select distinct unnest(modulos || array['crm']))
   where nombre = 'Almha';

  perform set_config('request.jwt.claims', '', true);
end;
$$;

select segmento, count(*) as gente
  from crm_segmentos((select id from empresas where nombre = 'Almha'))
 group by segmento order by 2 desc;
