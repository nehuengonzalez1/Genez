/* ============================================================
   0070 · QUÉ HORARIOS ENTRAN EN TU PLAN
   ============================================================

   Sacando la captura de 0067 apareció esto: a la clienta de prueba, con
   el plan venciéndole el 31/08, la app le ofrecía cinco horarios de los
   cuales cuatro eran de septiembre y ninguno de esos lo cubría su plan.
   Los ofrecía, ella elegía, y recién al confirmar la base contestaba
   "ese abono vence el 31/08".

   Es exactamente lo que 0053 se cuidó de no hacer —"ofrecer algo y
   después rechazarlo es la peor forma de decir que no"— aplicado a un
   caso que no había mirado: las reglas del comercio sí se descuentan
   antes; el plan de la persona no.

   SE MARCAN, NO SE ESCONDEN
   -------------------------
   Decidido con el dueño. Esconderlos sería resolver la mitad mala del
   problema: quien está dispuesta a pagar un turno suelto —fuera de su
   abono— tiene derecho a verlo, y quien no, tiene derecho a enterarse
   antes de elegir y no después.

   Y quiere decir dos cosas distintas según de dónde se venga, así que la
   pantalla hace dos cosas distintas con la misma marca:

     · RESERVANDO  se puede tomar igual, se paga aparte.
     · MOVIENDO    no se puede: el abono del turno es el que es, y
                   cambiarlo por otro en silencio es lo que 0067 se negó
                   a hacer. La marca explica por qué la celda está
                   apagada.

   LA MARCA Y EL RECHAZO SALEN DE LA MISMA FUNCIÓN
   -----------------------------------------------
   Es lo único que importa de esta migración. Si "entra en tu plan" se
   calculara por un lado y el rechazo por otro, en algún momento van a
   decir cosas distintas, y el día que pase la pantalla va a estar
   mintiendo con cara de saber.

   `revisar_abono` ya es la respuesta —vigencia, saldo y tope semanal— y
   tiene que seguir siéndolo porque además dice **cuál** de las tres
   falló, que es el mensaje que lee la persona. Así que no se copia su
   lógica: se la envuelve. `abono_cubre` la llama y contesta si levantó.

   El `exception when others` es a propósito y es la parte honesta del
   asunto: cualquier motivo por el que `revisar_abono` se niegue es un
   motivo por el que ese abono no cubre ese turno. No hay una lista de
   códigos que mantener al día, que sería la otra forma de que las dos
   se desincronicen.
   ============================================================ */


/* ------------------------------------------------------------
   1 · ¿Este abono cubre este turno?
   ------------------------------------------------------------ */

create or replace function public.abono_cubre(
  p_abono   uuid,
  p_cliente uuid,
  p_desde   timestamptz,
  p_salvo   uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.revisar_abono(p_abono, p_cliente, p_desde, p_salvo);
  return true;
exception
  /* Ver el encabezado: la lista de motivos no se mantiene acá. */
  when others then
    return false;
end;
$$;

comment on function public.abono_cubre is
  'Si un abono cubre un turno en esa fecha. Envuelve a revisar_abono para que la marca de la pantalla y el rechazo de la base no puedan discrepar.';

revoke execute on function public.abono_cubre(uuid, uuid, timestamptz, uuid)
  from public, anon, authenticated;


/* ------------------------------------------------------------
   2 · ¿Con cuál de sus planes?

   El que vence primero, que es lo que menos plata le hace perder si
   tiene dos. Era una consulta escrita adentro de `reservar_como_cliente`
   y sale para que la use también la disponibilidad.

   Y de paso se le arregla algo: miraba la vigencia contra `current_date`
   —o sea contra hoy— y no contra la fecha del turno. Un abono que vence
   el viernes quedaba elegido para un turno del lunes siguiente, y
   `revisar_abono` lo rechazaba dos pasos después. La reserva fallaba
   entera cuando lo que correspondía era tomarla fuera del plan.
   ------------------------------------------------------------ */

create or replace function public.abono_para(
  p_ficha uuid,
  p_desde timestamptz,
  p_salvo uuid default null
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.id
    from abonos a
   where a.cliente_id = p_ficha
     and a.anulado = false
     and public.abono_cubre(a.id, p_ficha, p_desde, p_salvo)
   order by a.vence nulls last
   limit 1
$$;

comment on function public.abono_para is
  'El plan de la persona que cubre un turno en esa fecha, o null si ninguno. El que vence primero.';

revoke execute on function public.abono_para(uuid, timestamptz, uuid)
  from public, anon, authenticated;


/* ------------------------------------------------------------
   3 · Cada horario dice si entra

   `p_moviendo` es el turno que se está moviendo, y cambia la pregunta:
   reservando es "¿alguno de sus planes cubre esto?" y moviendo es "¿el
   plan de ESTE turno lo sigue cubriendo?", porque mover no cambia de
   plan. También sirve para el saldo y el tope semanal, que no tienen que
   contar el turno que se está corriendo de lugar.

   Se valida que sea suyo. La función es `security definer`, así que con
   un id ajeno contestaría sobre el plan de otra persona: es el mismo
   cuidado con el que devuelve huecos y no filas.
   ------------------------------------------------------------ */

drop function if exists public.horarios_libres(uuid, uuid, date, date, uuid);

create or replace function public.horarios_libres(
  p_empresa  uuid,
  p_item     uuid,
  p_desde    date,
  p_hasta    date,
  p_personal uuid default null,
  p_moviendo uuid default null
)
returns table (
  clase_id     uuid,
  desde        timestamptz,
  duracion_min integer,
  personal_id  uuid,
  profesional  text,
  recurso_id   uuid,
  recurso      text,
  lugares      integer,
  en_espera    boolean,
  esperando    integer,
  en_plan      boolean
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
  v_espera   boolean;
  v_ficha    uuid;
  v_abono    uuid;
  v_mueve    boolean := false;
begin
  /* Que sea cliente de este comercio. Sin esto, cualquiera con sesión
     mira la agenda de cualquier comercio: la función es `security
     definer`, así que la puerta la pone ella. */
  select c.id into v_ficha
    from clientes c
   where c.empresa_id = p_empresa and c.usuario_id = auth.uid() and c.activo = true;

  if v_ficha is null then
    return;
  end if;

  /* El turno que se mueve, solo si es suyo. */
  if p_moviendo is not null then
    select r.abono_id, true into v_abono, v_mueve
      from reservas r
     where r.id = p_moviendo and r.cliente_id = v_ficha;
  end if;

  v_reglas := public.reglas_de(p_empresa);
  v_zona   := public.zona_horaria_de(p_empresa);
  v_espera := (v_reglas ->> 'esperaDesdeApp')::boolean;

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

  /* ---------- A · Clases ---------- */
  if v_en_clase then
    return query
      with tomados as (
        select r.id,
               (select count(*)::integer from reservas x
                 where x.clase_id = r.id and x.estado not in ('cancelada', 'ausente')) as n
          from reservas r
         where r.empresa_id = p_empresa and r.item_id = p_item and r.cupo is not null
      )
      select
        r.id,
        r.desde,
        r.duracion_min,
        r.personal_id,
        per.nombre,
        r.recurso_id,
        rec.nombre,
        greatest(r.cupo - t.n, 0),
        exists (
          select 1 from espera e
           where e.clase_id = r.id
             and e.cliente_id in (select public.mis_fichas())
             and e.estado in ('esperando', 'avisado')
        ),
        (select count(*)::integer from espera e
          where e.clase_id = r.id and e.estado = 'esperando'),
        /* Moviendo, el plan es el del turno y no se cambia; un turno sin
           plan no tiene nada que violar. Reservando, cualquiera de los
           suyos que cubra. */
        case
          when v_mueve then v_abono is null
            or public.abono_cubre(v_abono, v_ficha, r.desde, p_moviendo)
          else public.abono_para(v_ficha, r.desde) is not null
        end
      from reservas r
      join tomados t on t.id = r.id
      left join personal per on per.id = r.personal_id
      left join recursos rec on rec.id = r.recurso_id
     where r.empresa_id = p_empresa
       and r.item_id = p_item
       and r.cupo is not null
       and r.estado <> 'cancelada'
       and r.desde >= v_minimo
       and r.desde <  v_maximo
       and (p_personal is null or r.personal_id = p_personal)
       /* Con lugar, o llena pero con espera habilitada. Antes las llenas
          quedaban afuera y no había forma de saber que existían. */
       and (r.cupo > t.n or v_espera)
       and not exists (
         select 1 from reservas y
          where y.clase_id = r.id
            and y.cliente_id in (select public.mis_fichas())
            and y.estado not in ('cancelada', 'ausente')
       )
     order by r.desde;
    return;
  end if;

  /* ---------- B · Huecos calculados ---------- */
  return query
    with dias as (
      select generate_series(p_desde, p_hasta, interval '1 day')::date as d
    ),
    franjas as (
      select
        h.personal_id,
        h.recurso_id,
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
      null::uuid, hu.arranca, v_dur, hu.personal_id, per.nombre,
      hu.recurso_id, rec.nombre, 1, false, 0,
      case
        when v_mueve then v_abono is null
          or public.abono_cubre(v_abono, v_ficha, hu.arranca, p_moviendo)
        else public.abono_para(v_ficha, hu.arranca) is not null
      end
    from huecos hu
    left join personal per on per.id = hu.personal_id
    left join recursos rec on rec.id = hu.recurso_id
   where hu.arranca >= v_minimo
     and hu.arranca <  v_maximo
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

grant execute on function public.horarios_libres(uuid, uuid, date, date, uuid, uuid) to authenticated;


/* ------------------------------------------------------------
   4 · Y reservar elige el plan con la misma función

   Lo que hace que la marca sea cierta: si la pantalla dijera "entra en
   tu plan" con un criterio y la reserva eligiera el abono con otro, la
   marca sería una opinión.

   Se rehace entera porque plpgsql no admite parchear una función. Lo
   único que cambia es la elección del abono.
   ------------------------------------------------------------ */

create or replace function public.reservar_como_cliente(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp     uuid := (p ->> 'empresa_id')::uuid;
  v_clase   uuid := nullif(p ->> 'clase_id', '')::uuid;
  v_item    uuid := nullif(p ->> 'item_id', '')::uuid;
  v_desde   timestamptz := (p ->> 'desde')::timestamptz;
  v_reglas  jsonb;
  v_ficha   uuid;
  v_nombre  text;
  v_tel     text;
  v_dur     integer;
  v_abono   uuid;
  v_id      uuid;
  v_aviso   text := null;
begin
  /* Su ficha en ESTE comercio. No se recibe por parámetro: si viniera del
     cliente, alguien reservaría a nombre de otra persona. */
  select c.id, c.razon_social, c.tel into v_ficha, v_nombre, v_tel
    from clientes c
   where c.empresa_id = v_emp and c.usuario_id = auth.uid() and c.activo = true;

  if v_ficha is null then
    raise exception 'No sos cliente de este comercio.' using errcode = 'P0090';
  end if;

  v_reglas := public.reglas_de(v_emp);

  /* Si es una clase, la hora sale de la clase y no del cliente: mandarla
     por parámetro deja que alguien reserve una clase "a otra hora". */
  if v_clase is not null then
    select r.desde, r.duracion_min, r.item_id into v_desde, v_dur, v_item
      from reservas r where r.id = v_clase;
    if v_desde is null then
      raise exception 'No existe esa clase.' using errcode = 'P0042';
    end if;
  else
    select coalesce(i.duracion_min, 60) into v_dur from items i where i.id = v_item;
    v_dur := coalesce(v_dur, 60);
  end if;

  /* Anticipación, choque contra sus propios turnos y el aviso del mismo
     día. Sin `p_salvo`: acá no hay ningún turno que ignorar. */
  v_aviso := public.revisar_reglas_del_cliente(v_emp, v_ficha, v_desde, v_dur);

  /* El plan que cubre ESTE turno, en su fecha. Null quiere decir que
     queda fuera del plan y se paga aparte, que es lo que la pantalla ya
     le dijo antes de que eligiera. */
  v_abono := public.abono_para(v_ficha, v_desde);

  /* Quien nunca vino no toma un lugar sin pagar. Es la regla contra el
     turno fantasma, y se saltea si tiene abono: ya pagó.

     Se queda acá y no en `revisar_reglas_del_cliente` porque es la regla
     del PRIMER turno. Quien está moviendo uno ya lo tenía. */
  if v_abono is null and (v_reglas ->> 'requiereHistorial')::boolean then
    if not exists (
      select 1 from reservas r
       where r.cliente_id = v_ficha and r.desde < now()
         and r.estado not in ('cancelada', 'ausente')
      union all
      select 1 from operaciones o
       where o.cliente_id = v_ficha and o.tipo = 'venta' and o.estado <> 'anulada'
    ) then
      raise exception 'Para reservar por primera vez, pasá por el local o comprá un plan.'
        using errcode = 'P0094';
    end if;
  end if;

  /* ---- Y delega ---- */

  if v_clase is not null then
    v_id := public.inscribir(jsonb_build_object(
      'clase_id', v_clase,
      'cliente_id', v_ficha,
      'nombre', v_nombre,
      'telefono', v_tel,
      'abono_id', v_abono,
      'estado', 'confirmada'
    ));
  else
    v_id := public.agendar_turno(jsonb_build_object(
      'empresa_id', v_emp,
      'desde', v_desde,
      'duracion_min', v_dur,
      'item_id', v_item,
      'personal_id', nullif(p ->> 'personal_id', ''),
      'recurso_id', nullif(p ->> 'recurso_id', ''),
      'cliente_id', v_ficha,
      'abono_id', v_abono,
      'nombre', v_nombre,
      'telefono', v_tel,
      'estado', 'pendiente'
    ));
  end if;

  return jsonb_build_object('id', v_id, 'aviso', v_aviso);
end;
$$;
