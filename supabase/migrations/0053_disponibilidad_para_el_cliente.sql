/* ============================================================
   0053 · QUÉ HORARIOS HAY LIBRES
   ============================================================

   Lo que la app del cliente necesita para el paso "Horario": qué puede
   reservar esta persona, de este servicio, en estos días.

   LA DISPONIBILIDAD SE CALCULA, NO SE LEE
   ---------------------------------------
   Es la decisión de fondo. Los horarios libres se derivan de los
   ocupados, y los ocupados son los turnos de otras personas. Darle
   lectura de la agenda para que calcule los huecos es darle la agenda.

   Por eso esto devuelve **franjas y no filas**: el cliente nunca ve una
   reserva ajena, ni el nombre de quien la tiene, ni que exista. Solo ve
   que a las 18:00 hay lugar.

   DOS FORMAS DE RESERVAR, UNA SOLA LISTA
   --------------------------------------
   Almha tiene 362 clases publicadas con 1641 inscripciones, y además 652
   turnos individuales. Son dos cosas distintas:

     · CLASE       el comercio publica el horario y el cupo, y la persona
                   entra si queda lugar. Pilates.
     · INDIVIDUAL  no hay horario publicado: se calcula sobre lo que el
                   profesional tiene libre. Masajes, limpieza facial.

   **Quién decide cuál es cuál es el comercio, publicando clases.** Si el
   servicio tiene clases futuras, se eligen esas; si no, se calculan
   huecos. No hace falta marcar el item ni configurar nada: un servicio
   pasa a darse en clase el día que alguien publica la primera, que es
   como funciona en la vida real.

   Las dos vuelven con la misma forma, así que la pantalla dibuja una
   lista y no dos.
   ============================================================ */


/* ------------------------------------------------------------
   0 · La zona horaria del comercio

   Genez no tenía ninguna, y hasta ahora no hizo falta: todo lo que se
   guardaba venía del navegador como `toISOString()`, o sea con el huso ya
   resuelto. La base guarda instantes y nadie tenía que interpretarlos.

   Esta función es la primera que arma un instante **desde la base**:
   `horarios` guarda "08:00" a secas, que significa las ocho de la mañana
   en el comercio. Sin zona, `(fecha + hora)::timestamptz` lo interpreta
   en la de la base —que es UTC— y las ocho de la mañana pasan a ser las
   cinco. Los huecos quedarían tres horas corridos respecto de los turnos
   reales.

   Hardcodear Argentina sería resolverlo para el primer comercio y
   romperlo para el segundo. Va en la configuración, con Buenos Aires de
   fábrica porque es donde está el primero.

   OJO CON LA SEMILLA DE DEMOSTRACIÓN
   ----------------------------------
   `almha_historia.sql` guardó las clases con la hora de pared como si
   fuera UTC, así que se ven tres horas antes de lo que el comercio
   quiso. Eso es un error de los datos de ejemplo, no del código: un turno
   agendado de verdad desde el Business se guarda bien. Se deja anotado
   para no "arreglar" el código copiándole el error a la semilla.
   ------------------------------------------------------------ */

create or replace function public.zona_horaria_de(p_empresa uuid)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(config ->> 'zona', ''),
    'America/Argentina/Buenos_Aires'
  )
  from empresas where id = p_empresa
$$;

comment on function public.zona_horaria_de is
  'En qué huso está el comercio. Hace falta para convertir un horario de agenda —"08:00"— en un instante.';


/* ------------------------------------------------------------
   1 · Los servicios que este cliente puede pedir

   El catálogo ya lo devuelve `catalogo_de` (0050), pero sin decir si se
   dan en clase o individual. La app lo necesita para saber qué preguntar
   después: para una clase no tiene sentido elegir profesional y fecha
   —el horario ya viene armado— y para un turno individual sí.
   ------------------------------------------------------------ */

create or replace function public.servicios_del_cliente(p_empresa uuid)
returns table (
  id           uuid,
  nombre       text,
  categoria    text,
  precio       numeric,
  duracion_min integer,
  en_clase     boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id, i.nombre, i.categoria, i.precio, i.duracion_min,
    exists (
      select 1 from reservas r
       where r.item_id = i.id
         and r.cupo is not null
         and r.estado <> 'cancelada'
         and r.desde >= now()
    )
  from items i
 where i.empresa_id = p_empresa
   and i.activo = true
   and i.tipo = 'servicio'
   and exists (
     select 1 from clientes c
      where c.empresa_id = p_empresa
        and c.usuario_id = auth.uid()
        and c.activo = true
   )
 order by i.categoria nulls last, i.nombre
$$;

grant execute on function public.servicios_del_cliente(uuid) to authenticated;


/* ------------------------------------------------------------
   2 · Los horarios libres

   `clase_id` distingue las dos formas: con valor es una clase publicada
   y se entra con `inscribir`; en null es un hueco calculado y se agenda.

   `lugares` es cuántos quedan. Para un turno individual siempre es 1: no
   es que sobre información, es que la pantalla dibuja lo mismo en los dos
   casos y no tiene que saber cuál está mirando.
   ------------------------------------------------------------ */

create or replace function public.horarios_libres(
  p_empresa  uuid,
  p_item     uuid,
  p_desde    date,
  p_hasta    date,
  p_personal uuid default null
)
returns table (
  clase_id     uuid,
  desde        timestamptz,
  duracion_min integer,
  personal_id  uuid,
  profesional  text,
  recurso_id   uuid,
  recurso      text,
  lugares      integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reglas   jsonb;
  v_minimo   timestamptz;
  v_maximo   timestamptz;
  v_dur      integer;
  v_en_clase boolean;
  v_zona     text;
begin
  /* Que sea cliente de este comercio. Sin esto, cualquiera con sesión
     mira la agenda de cualquier comercio: la función es `security
     definer`, así que la puerta la pone ella. */
  if not exists (
    select 1 from clientes c
     where c.empresa_id = p_empresa and c.usuario_id = auth.uid() and c.activo = true
  ) then
    return;
  end if;

  v_reglas := public.reglas_de(p_empresa);
  v_zona   := public.zona_horaria_de(p_empresa);

  /* Las reglas de 0051 se aplican acá y no en la pantalla. Un horario que
     ya no se puede reservar no se muestra: ofrecer algo y después
     rechazarlo es la peor forma de decir que no. */
  v_minimo := greatest(
    now() + ((v_reglas ->> 'anticipacionMin')::integer || ' minutes')::interval,
    p_desde::timestamptz
  );

  v_maximo := (p_hasta + 1)::timestamptz;
  if (v_reglas ->> 'anticipacionMaxDias') is not null then
    v_maximo := least(
      v_maximo,
      now() + ((v_reglas ->> 'anticipacionMaxDias')::integer || ' days')::interval
    );
  end if;

  select i.duracion_min into v_dur
    from items i where i.id = p_item and i.empresa_id = p_empresa;
  if v_dur is null then v_dur := 60; end if;

  select exists (
    select 1 from reservas r
     where r.item_id = p_item and r.cupo is not null
       and r.estado <> 'cancelada' and r.desde >= now()
  ) into v_en_clase;

  /* ---------- A · Clases publicadas con lugar ---------- */
  if v_en_clase then
    return query
      select
        r.id,
        r.desde,
        r.duracion_min,
        r.personal_id,
        per.nombre,
        r.recurso_id,
        rec.nombre,
        (r.cupo - (
          select count(*)::integer from reservas x
           where x.clase_id = r.id and x.estado not in ('cancelada', 'ausente')
        ))
      from reservas r
      left join personal per on per.id = r.personal_id
      left join recursos rec on rec.id = r.recurso_id
     where r.empresa_id = p_empresa
       and r.item_id = p_item
       and r.cupo is not null
       and r.estado <> 'cancelada'
       and r.desde >= v_minimo
       and r.desde <  v_maximo
       and (p_personal is null or r.personal_id = p_personal)
       /* Con lugar, y donde no esté ya anotada: una clase en la que ya
          está no es una opción, es una confusión. */
       and r.cupo > (
         select count(*) from reservas x
          where x.clase_id = r.id and x.estado not in ('cancelada', 'ausente')
       )
       and not exists (
         select 1 from reservas y
          where y.clase_id = r.id
            and y.cliente_id in (select public.mis_fichas())
            and y.estado not in ('cancelada', 'ausente')
       )
     order by r.desde;
    return;
  end if;

  /* ---------- B · Huecos calculados ----------

     El horario del profesional, cortado en franjas del largo del
     servicio, menos lo que ya está tomado y menos sus ausencias.

     Solo profesionales que hacen este servicio: `personal_servicios`
     existe justamente para eso, y sin ese filtro la app ofrecería un
     masaje con la profesora de pilates. */
  return query
    with dias as (
      select generate_series(p_desde, p_hasta, interval '1 day')::date as d
    ),
    franjas as (
      select
        h.personal_id,
        h.recurso_id,
        /* Interpretado en el huso del comercio y no en el de la base.
           Sin el El comando AT est  desusado. Use en su lugar schtasks.exe.

El comando no es v lido.

El comando AT programa la ejecuci¢n de comandos y programas en un equipo a
una hora y fecha especificadas. El servicio de programaci¢n debe estar en
ejecuci¢n para utilizar el comando AT.
                                 
AT [\equipo] [ [id] [/DELETE] | /DELETE [/YES]]                    
AT [\equipo] hora [/INTERACTIVE]
    [ /EVERY:fecha[,...] | /NEXT:fecha[,...]] "comando"

\equipo           Especifica un equipo remoto. Si se omite este
                   par metro, los comandos se programan en el equipo
                   local.             
id                 Es un n£mero de identificaci¢n asignado al comando
                   programado.                                                
/delete            Cancela un comando programado. Si se omite id, se
                   cancelar n todos los comandos programados en el equipo.
/yes               Se usa con el comando de cancelaci¢n de todos los
                   trabajos cuando no se desea ninguna confirmaci¢n.
/interactive       Permite a la tarea interactuar con el escritorio del
                   usuario cuya sesi¢n coincide con el momento de
                   ejecuci¢n de la tarea.
/every:fecha[,...] Ejecuta el comando cada d¡a de la semana o mes
                   especificado. Si se omite la fecha, se asume que es el
                   d¡a actual del mes.                                        
/next:fecha[,...]  Ejecuta el comando especificado la pr¢xima vez que
                   aparezca ese d¡a (por ejemplo, el pr¢ximo jueves). Si
                   se omite la fecha, se asume que es el d¡a actual del
                   mes.
"comando"          Es el comando de Windows NT o programa por lotes que se
                   va a ejecutar., las ocho de la mañana de una agenda se
           convierten en las cinco. */
        ((d.d + h.desde) at time zone v_zona) as arranca,
        ((d.d + h.hasta) at time zone v_zona) as termina
      from dias d
      join horarios h
        on h.empresa_id = p_empresa
       and h.activo = true
       and h.dia = extract(dow from d.d)
      where exists (
        select 1 from personal_servicios ps
         where ps.personal_id = h.personal_id and ps.item_id = p_item
      )
        and (p_personal is null or h.personal_id = p_personal)
    ),
    huecos as (
      select
        f.personal_id,
        f.recurso_id,
        generate_series(f.arranca, f.termina - (v_dur || ' minutes')::interval,
                        (v_dur || ' minutes')::interval) as arranca
      from franjas f
    )
    select
      null::uuid,
      hu.arranca,
      v_dur,
      hu.personal_id,
      per.nombre,
      hu.recurso_id,
      rec.nombre,
      1
    from huecos hu
    left join personal per on per.id = hu.personal_id
    left join recursos rec on rec.id = hu.recurso_id
   where hu.arranca >= v_minimo
     and hu.arranca <  v_maximo
     /* Lo que ya está tomado. Se mira el profesional y la sala por
        separado: la misma persona no puede estar en dos lados, y la misma
        camilla tampoco. Una clase ocupa; una inscripción no, porque la
        sala ya la ocupó la clase (es la decisión de 0034). */
     and not exists (
       select 1 from reservas r
        where r.empresa_id = p_empresa
          and r.estado not in ('cancelada', 'ausente')
          and r.clase_id is null
          and (r.personal_id = hu.personal_id or
               (hu.recurso_id is not null and r.recurso_id = hu.recurso_id))
          and r.desde < hu.arranca + (v_dur || ' minutes')::interval
          and hu.arranca < r.desde + (r.duracion_min || ' minutes')::interval
     )
     /* Y las ausencias del profesional. */
     and not exists (
       select 1 from excepciones e
        where e.empresa_id = p_empresa
          and e.personal_id = hu.personal_id
          and e.desde < hu.arranca + (v_dur || ' minutes')::interval
          and hu.arranca < e.hasta
     )
   order by hu.arranca, per.nombre;
end;
$$;

comment on function public.horarios_libres is
  'Qué puede reservar un cliente: clases publicadas con lugar, o huecos calculados. Devuelve franjas, nunca reservas ajenas.';

grant execute on function public.horarios_libres(uuid, uuid, date, date, uuid) to authenticated;
