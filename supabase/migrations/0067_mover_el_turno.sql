/* ============================================================
   0067 · CAMBIAR EL HORARIO DE UN TURNO, DESDE LA APP
   ============================================================

   Hasta acá el detalle de un turno solo sabía cancelar, y cancelar es lo
   que menos le conviene a las dos partes: la persona quería venir y el
   comercio quería que viniera. Lo que falta es el caso del medio —"no
   llego el martes, ¿el jueves?"— que hoy se resuelve por WhatsApp y a
   mano.

   NO SE INVENTA UN CAMINO NUEVO: YA EXISTE `mover_turno`
   -----------------------------------------------------
   Es de 0032 y la usa el mostrador. **Mueve la fila** —`update reservas
   set desde`— en vez de cancelar una y crear otra, y eso no es un
   detalle de implementación:

     · El recordatorio ya enviado apunta a esta reserva
       (`contactos.reserva_id`, de Comunicaciones). Con una reserva nueva
       el sistema creería que nunca se le avisó y mandaría otro.
     · El enlace con el abono no se toca, así que no hay ventana en la
       que la clase esté contada dos veces o ninguna.
     · `revisar_turno` ya se ignora a sí misma con `p_id`: mover de 10:00
       a 10:30 un turno de una hora no choca contra el propio turno.

   Lo que esta migración agrega no es la mecánica, que ya estaba: son las
   reglas del cliente alrededor.

   UNA CLASE NO SE MUEVE, SE CAMBIA POR OTRA
   -----------------------------------------
   Y ahí `mover_turno` no sirve, porque no hay una fila que corra de hora:
   hay una inscripción que apunta a una clase publicada. Cambiarla es
   salir de una y entrar en otra, y el cupo, su bloqueo `for update` y el
   "ya está anotada" viven adentro de `inscribir`. Copiarlos acá sería
   garantizar que un día digan cosas distintas —el mismo argumento con el
   que 0054 se negó a duplicar `agendar_turno`—.

   Así que son dos brazos, igual que en `reservar_como_cliente`:

     · turno individual → `mover_turno`, la fila cambia de hora
     · inscripción      → se cancela una y se entra en la otra,
                          en la misma transacción

   La asimetría es real y se deja a la vista: en el primer caso el turno
   conserva su id y en el segundo no. La alternativa era cancelar y crear
   también en el primero, que es peor por las tres razones de arriba.

   HASTA CUÁNDO SE PUEDE, Y POR QUÉ NO HAY UN NÚMERO NUEVO
   ------------------------------------------------------
   Se reusa `cancelacionHoras`, el mismo que decide hasta cuándo cancelar
   sale gratis. Pasada esa hora **no se mueve**, y no es por comodidad:

   Cobrar la movida tarde como se cobra la cancelación tarde sería
   descontarle la clase *y además* darle otro lugar. Dos por una. Y
   dejarla gratis sería que el que quiere zafar del costo de cancelar
   mueva el turno a la semana que viene y lo cancele allá, que es el
   mismo agujero por otra puerta.

   Con la ventana compartida el turno se lee de una sola forma: hasta esa
   hora es suyo para moverlo o soltarlo sin costo, y después es del
   comercio. Un comercio que pase de 3 a 6 horas cambia las dos cosas a
   la vez, que es lo que iba a querer decir.

   LO QUE ENCONTRÉ POR EL CAMINO: EL SALDO CONTABA EL TURNO QUE SE MUEVE
   --------------------------------------------------------------------
   `revisar_abono` recibe un `p_id` desde 0035 que quiere decir "esta
   reserva ya está contada, ignorala". Solo lo hacía en el tope semanal;
   el saldo lo seguía contando, porque salía de `abonos_vista.restantes`,
   que no sabe nada de excepciones.

   Con eso, alguien que tiene un pack de 4 y los 4 turnos ya reservados
   —que en Almha es lo normal, no un borde— no podía mover ninguno: le
   contestaba "ese abono ya no tiene clases" por un turno que ya era
   suyo. No se notaba porque nadie llamaba a `revisar_abono` con `p_id`.
   ============================================================ */


/* ------------------------------------------------------------
   1 · La cuenta de clases, ignorando una

   `clases_usadas` no puede recibir un parámetro más: `abonos_vista` la
   tiene adentro, así que cambiarle la firma obliga a bajar la vista, y
   una función con un argumento opcional convive con la de un argumento
   como dos funciones distintas y deja la llamada ambigua.

   Va como una función aparte con la cuenta de verdad, y `clases_usadas`
   queda como lo que siempre fue —"cuántas gastó este abono"— pasándole
   null. Una sola condición, en un solo lugar, que es lo que 0051 vino a
   arreglar y no se puede perder ahora.
   ------------------------------------------------------------ */

create or replace function public.clases_usadas_salvo(p_abono uuid, p_salvo uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from reservas r
    join abonos a on a.id = r.abono_id
   where r.abono_id = p_abono
     /* La que se está moviendo. Ya estaba contada antes de moverse: si se
        cuenta de nuevo, cambiar de horario cuesta una clase. */
     and (p_salvo is null or r.id <> p_salvo)
     and (
       r.estado not in ('cancelada', 'ausente')
       or (r.estado = 'ausente' and public.ausencia_consume(a.empresa_id))
       or (r.estado = 'cancelada'
           and (r.campos_extra ->> 'cancelacionTarde')::boolean is true
           and (public.reglas_de(a.empresa_id) ->> 'tardeConsume')::boolean)
     )
$$;

comment on function public.clases_usadas_salvo is
  'Las clases que gastó un abono, sin contar una reserva: la que se está moviendo de horario.';

grant execute on function public.clases_usadas_salvo(uuid, uuid) to authenticated;


create or replace function public.clases_usadas(p_abono uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.clases_usadas_salvo(p_abono, null)
$$;


/* ------------------------------------------------------------
   2 · `revisar_abono` cumple lo que su `p_id` prometía

   Dos cambios, y el segundo es de arrastre: el saldo pasa a ignorar la
   reserva excluida, y para eso deja de leer `abonos_vista`.

   Lo segundo importa aparte: la vista es `security_invoker`, o sea que
   corre con los permisos de quien pregunta, y un cliente no tiene
   ninguno sobre `abonos`. Hoy funciona porque quien llega hasta acá
   viene de una función `security definer` y la lectura la hace el dueño
   de las tablas. Es un equilibrio que se rompe solo el día que alguien
   llame a `revisar_abono` desde un camino que no sea definer: la vista
   devolvería vacío y el saldo se leería como cero, o sea "ese abono ya
   no tiene clases" sobre un abono entero.

   El número que devuelve es el mismo —`restantes` era exactamente
   `clases - clases_usadas`— así que el mostrador no ve ningún cambio.
   ------------------------------------------------------------ */

create or replace function public.revisar_abono(
  p_abono uuid, p_cliente uuid, p_desde timestamptz, p_id uuid default null
)
returns void
language plpgsql
as $$
declare
  v_a    abonos%rowtype;
  v_zona text;
  v_sem  integer;
begin
  select * into v_a from abonos where id = p_abono;
  if v_a.id is null then
    raise exception 'No existe ese abono.' using errcode = 'P0053';
  end if;
  if v_a.anulado then
    raise exception 'Ese abono está anulado.' using errcode = 'P0054';
  end if;
  if p_cliente is null or v_a.cliente_id <> p_cliente then
    raise exception 'Ese abono es de otra persona.' using errcode = 'P0055';
  end if;

  v_zona := zona_de(v_a.empresa_id);

  if v_a.vence is not null and (p_desde at time zone v_zona)::date > v_a.vence then
    raise exception 'Ese abono vence el %.', to_char(v_a.vence, 'DD/MM') using errcode = 'P0056';
  end if;
  if (p_desde at time zone v_zona)::date < v_a.desde then
    raise exception 'Ese abono arranca el %.', to_char(v_a.desde, 'DD/MM') using errcode = 'P0057';
  end if;

  if v_a.clases is not null
     and v_a.clases - public.clases_usadas_salvo(p_abono, p_id) <= 0 then
    raise exception 'Ese abono ya no tiene clases.' using errcode = 'P0058';
  end if;

  /* El tope es por semana del calendario, de lunes a domingo, que es como
     lo cuenta la gente. */
  if v_a.tope_semanal is not null then
    select count(*) into v_sem
      from reservas r
     where r.abono_id = p_abono
       and (p_id is null or r.id <> p_id)
       and r.estado <> 'cancelada'
       and date_trunc('week', r.desde at time zone v_zona)
           = date_trunc('week', p_desde at time zone v_zona);

    if v_sem >= v_a.tope_semanal then
      raise exception 'Ese plan permite % por semana.', v_a.tope_semanal using errcode = 'P0059';
    end if;
  end if;
end;
$$;

comment on function revisar_abono is
  'Vigencia, saldo y tope semanal, en el momento de reservar. Después es tarde. Con p_id ignora una reserva: la que se está moviendo.';


/* ------------------------------------------------------------
   3 · Si el comercio deja mover el turno

   Una regla propia y no `permiteCancelar`, porque las dos combinaciones
   tienen sentido y son opuestas:

     · dejar mover y no dejar cancelar — el comercio prefiere que el
       lugar se reacomode antes que se pierda, que es lo que más le
       conviene y hoy no puede pedir.
     · dejar cancelar y no dejar mover — recepción quiere ver la agenda
       antes de correr un turno, y prefiere que la llamen.

   Y prender una no abre la otra: mover siempre deja a la persona con un
   turno. No hay forma de usarlo para cancelar.
   ------------------------------------------------------------ */

update rubros
   set reglas = reglas || jsonb_build_object('permiteReprogramar', true)
 where clave = 'servicios'
   and not (reglas ? 'permiteReprogramar');


/* El piso conservador, para el rubro que no dijo nada. Lo mismo que hace
   `permiteCancelar`: si falta el dato, no se toca la agenda desde el
   teléfono. */
create or replace function public.reglas_de(p_empresa uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select
      jsonb_build_object(
        'anticipacionMin',     60,
        'anticipacionMaxDias', null,
        'cancelacionHoras',    24,
        'tardeConsume',        true,
        'permiteCancelar',     false,
        'permiteReprogramar',  false,
        'requiereHistorial',   true,
        'avisarMismoDia',      true,
        'esperaDesdeApp',      false,
        'ausenciaConsume',     true
      )
   || coalesce(r.reglas, '{}'::jsonb)
   || coalesce(e.config -> 'turnos', '{}'::jsonb)
  from empresas e
  left join rubros r on r.clave = e.rubro
 where e.id = p_empresa
$$;


/* ------------------------------------------------------------
   4 · Las reglas que valen para cualquier horario que elija el cliente

   Estaban adentro de `reservar_como_cliente` y ahora las necesitan dos
   funciones. Se extraen en vez de copiarse por lo de siempre: la que se
   copia es la que un día queda vieja.

   `p_salvo` es el turno que se está moviendo. Sin él, cambiar un turno
   de las 10:00 a las 10:30 chocaría contra sí mismo, y moverlo dentro
   del mismo día avisaría "ya tenés otro turno ese día" hablando del
   mismo que se está moviendo.

   `requiereHistorial` NO está acá, y es a propósito: es la regla del
   primer turno —"quien nunca vino no toma un lugar sin pagar"— y quien
   mueve uno ya lo tenía. Vive donde se saca el primero.

   NO SE LE DA A NADIE, Y CERRARLA NO ES UNA SOLA LÍNEA
   ----------------------------------------------------
   Con esta función abierta, cualquiera con sesión pasa la ficha de otra
   persona y un horario, y por si levanta P0093 o no se entera de si esa
   persona tiene turno el martes a las nueve. Es exactamente lo que 0053
   se cuidó de no filtrar devolviendo huecos en vez de filas.

   `revoke ... from public` es el reflejo, y acá **no alcanza**. Esta base
   tiene `alter default privileges ... grant execute on functions to anon,
   authenticated, service_role` —lo pone Supabase, no este proyecto— así
   que toda función nueva nace con esos tres adentro, y sacarle `public`
   no les toca nada. Verificado contra `pg_proc.proacl` después de que la
   prueba de abajo se pusiera en rojo: con el revoke a secas,
   `authenticated` seguía pudiendo ejecutarla.

   Vale para cualquier función interna que se escriba de acá en adelante:
   una función sin `grant` no es una función cerrada.
   ------------------------------------------------------------ */

create or replace function public.revisar_reglas_del_cliente(
  p_empresa uuid,
  p_ficha   uuid,
  p_desde   timestamptz,
  p_dur     integer,
  p_salvo   uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_reglas jsonb := public.reglas_de(p_empresa);
  v_zona   text  := public.zona_horaria_de(p_empresa);
begin
  if p_desde < now() + ((v_reglas ->> 'anticipacionMin')::integer || ' minutes')::interval then
    raise exception 'Ese horario ya está muy cerca. Se puede reservar hasta % minutos antes.',
      (v_reglas ->> 'anticipacionMin')
      using errcode = 'P0091';
  end if;

  if (v_reglas ->> 'anticipacionMaxDias') is not null
     and p_desde > now() + ((v_reglas ->> 'anticipacionMaxDias')::integer || ' days')::interval then
    raise exception 'Todavía no se puede reservar tan adelante.' using errcode = 'P0092';
  end if;

  /* Dos reservas a la misma hora es siempre un error, y no depende del
     comercio: la persona no puede estar en dos lados. */
  if exists (
    select 1 from reservas r
     where r.cliente_id = p_ficha
       and (p_salvo is null or r.id <> p_salvo)
       and r.estado not in ('cancelada', 'ausente')
       and r.desde < p_desde + (p_dur || ' minutes')::interval
       and p_desde < r.desde + (r.duracion_min || ' minutes')::interval
  ) then
    raise exception 'Ya tenés un turno a esa hora.' using errcode = 'P0093';
  end if;

  /* Un aviso, no un impedimento. Dos turnos en un día a veces es un error
     de dedo y a veces es alguien que quiere doble clase; lo que
     corresponde es decirlo, no decidir por ella. */
  if (v_reglas ->> 'avisarMismoDia')::boolean and exists (
    select 1 from reservas r
     where r.cliente_id = p_ficha
       and (p_salvo is null or r.id <> p_salvo)
       and r.estado not in ('cancelada', 'ausente')
       and (r.desde at time zone v_zona)::date = (p_desde at time zone v_zona)::date
  ) then
    return 'Ojo: ya tenés otro turno ese mismo día.';
  end if;

  return null;
end;
$$;

comment on function public.revisar_reglas_del_cliente is
  'Las reglas de 0051 que valen para cualquier horario que elija el cliente. Devuelve el aviso, si hay. Interna: contesta sobre la agenda de una ficha.';

revoke execute on function public.revisar_reglas_del_cliente(uuid, uuid, timestamptz, integer, uuid)
  from public, anon, authenticated;


/* ------------------------------------------------------------
   5 · `reservar_como_cliente` pasa a usarlas

   Idéntica salvo los cuatro controles que se fueron arriba. Se rehace
   entera porque plpgsql no admite parchear una función.
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

  /* El abono vigente con clases disponibles, y el que vence primero: si
     tiene dos, gastar el que se termina antes es lo que menos plata le
     hace perder. `revisar_abono` lo valida de nuevo adentro. */
  select a.id into v_abono
    from abonos a
   where a.cliente_id = v_ficha
     and a.anulado = false
     and (a.vence is null or a.vence >= current_date)
     and a.desde <= current_date
     and (a.clases is null or public.clases_usadas(a.id) < a.clases)
   order by a.vence nulls last
   limit 1;

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


/* ------------------------------------------------------------
   6 · El turno dice si se puede mover, y con qué

   Tres columnas más. `puede_mover` la decide la base por lo mismo que
   `puede_cancelar`: un botón que se ve y después es rechazado es peor
   que un botón que no está.

   `empresa_id` e `item_id` no son de adorno. Para ofrecer otros horarios
   hay que preguntarle a `horarios_libres` por ese servicio en ese
   comercio, y hasta ahora el turno solo traía los dos nombres escritos.
   El comercio importa porque `mis_turnos` devuelve los de todos juntos:
   la misma persona puede ir a la estética y al gimnasio.

   No se agrega un `mover_hasta`: sería la misma hora que `cancelar_hasta`
   en otra columna, y dos nombres para el mismo dato es la forma más
   rápida de que un día dejen de coincidir. Es el mismo plazo a propósito
   —ver el encabezado— y la pantalla usa el que ya tenía.
   ------------------------------------------------------------ */

drop function if exists public.mis_turnos(date);

create or replace function public.mis_turnos(p_desde date default null)
returns table (
  id             uuid,
  empresa        text,
  empresa_id     uuid,
  item_id        uuid,
  servicio       text,
  profesional    text,
  recurso        text,
  imagen         text,
  foto           text,
  llegar_min     integer,
  llegar_nota    text,
  llevar         text,
  desde          timestamptz,
  duracion_min   integer,
  estado         text,
  es_clase       boolean,
  puede_cancelar boolean,
  cancelar_hasta timestamptz,
  puede_mover    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    e.nombre,
    r.empresa_id,
    /* El del turno, y si es una inscripción el de su clase: es el
       servicio del que hay que buscar otros horarios. */
    coalesce(i.id, ic.id),
    coalesce(i.nombre, ic.nombre),
    coalesce(per.nombre, perc.nombre),
    coalesce(rec.nombre, recc.nombre),
    coalesce(i.imagen, ic.imagen),
    coalesce(per.campos_extra ->> 'foto', perc.campos_extra ->> 'foto'),
    /* El del servicio, y si no el del comercio. Clave por clave y no el
       objeto entero: un servicio que solo dice qué llevar tiene que
       seguir heredando a qué hora llegar. */
    coalesce(
      nullif(coalesce(i.campos_extra, ic.campos_extra) -> 'turno' ->> 'llegarMin', '')::integer,
      nullif(e.config -> 'turnos' ->> 'llegarMin', '')::integer
    ),
    coalesce(
      nullif(coalesce(i.campos_extra, ic.campos_extra) -> 'turno' ->> 'llegarNota', ''),
      nullif(e.config -> 'turnos' ->> 'llegarNota', '')
    ),
    coalesce(
      nullif(coalesce(i.campos_extra, ic.campos_extra) -> 'turno' ->> 'llevar', ''),
      nullif(e.config -> 'turnos' ->> 'llevar', '')
    ),
    r.desde,
    r.duracion_min,
    r.estado,
    r.clase_id is not null,
    /* Cancelable si el comercio lo permite, el turno no pasó y no está ya
       cancelado. Que sea tarde no lo impide: cancelar tarde se puede, lo
       que cambia es que cuesta. */
    (
      (public.reglas_de(r.empresa_id) ->> 'permiteCancelar')::boolean
      and r.desde > now()
      and r.estado not in ('cancelada', 'ausente')
    ),
    /* Hasta cuándo sale gratis. */
    r.desde - ((public.reglas_de(r.empresa_id) ->> 'cancelacionHoras')::integer || ' hours')::interval,
    /* Movible mientras siga siendo suyo: hasta esa misma hora. Después no
       cuesta, no se puede, que es la diferencia con cancelar. */
    (
      (public.reglas_de(r.empresa_id) ->> 'permiteReprogramar')::boolean
      and r.desde > now()
        + ((public.reglas_de(r.empresa_id) ->> 'cancelacionHoras')::integer || ' hours')::interval
      and r.estado not in ('cancelada', 'ausente')
    )
  from reservas r
  join empresas e on e.id = r.empresa_id
  left join items    i    on i.id    = r.item_id
  left join personal per  on per.id  = r.personal_id
  left join recursos rec  on rec.id  = r.recurso_id
  left join reservas cl   on cl.id   = r.clase_id
  left join items    ic   on ic.id   = cl.item_id
  left join personal perc on perc.id = cl.personal_id
  left join recursos recc on recc.id = cl.recurso_id
 where r.cliente_id in (select public.mis_fichas())
   and r.desde >= coalesce(p_desde, current_date - 90)
 order by r.desde desc
$$;

grant execute on function public.mis_turnos(date) to authenticated;


/* ------------------------------------------------------------
   7 · Correr un turno de hora también queda asentado

   `anotar_reserva` es de 0024 y escribe en la bitácora al crear y al
   cambiar de estado. Un turno que solo cambia de hora no entraba por
   ninguna de las dos, así que **mover no dejaba rastro**.

   Se notaba poco mientras mover era cosa del mostrador, con alguien
   mirando la agenda. Deja de ser aceptable cuando lo hace el cliente
   desde el teléfono, y sobre todo porque los dos brazos de
   `reprogramar_como_cliente` quedarían asentados distinto: cambiar de
   clase escribe `reserva.cancelada` y `reserva.crear` —pasa por el
   estado— y correr un turno individual no escribía nada. La misma acción
   de la misma persona, y en la auditoría una se ve y la otra no.

   Va en el disparador y no en la función del cliente por la razón de
   siempre: la regla es de la tabla. `mover_turno` desde el mostrador se
   lleva el asiento sin que nadie lo agregue.

   Y lleva la hora vieja adentro. "Se movió al jueves" sin decir de dónde
   obliga a mirar el asiento anterior, que es justo el que no existía.
   ------------------------------------------------------------ */

create or replace function public.anotar_reserva()
returns trigger
language plpgsql
as $$
declare
  v_accion  text;
  v_detalle jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_accion := 'reserva.crear';
  elsif new.estado is distinct from old.estado then
    v_accion := 'reserva.' || new.estado;
  elsif new.desde is distinct from old.desde then
    v_accion  := 'reserva.movida';
    v_detalle := jsonb_build_object('antes', old.desde);
  else
    return new;
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
    values (new.empresa_id, auth.uid(), v_accion, 'reservas', new.id,
            jsonb_build_object('nombre', new.nombre, 'personas', new.personas,
                               'desde', new.desde, 'mesa', new.recurso_id)
            || v_detalle);

  return new;
end;
$$;

comment on function public.anotar_reserva is
  'Crear, cambiar de estado y correr de hora. Las tres a la bitácora: si mover no se asienta, la mitad de los cambios de la agenda no se pueden auditar.';


/* ------------------------------------------------------------
   8 · Mover el turno

   Devuelve `{ id, antes, aviso }`. El `id` puede ser el mismo que entró
   —cuando la fila se movió— o uno nuevo —cuando se cambió de clase—, y
   la pantalla no tiene que saber cuál de los dos pasó: relee sus turnos
   igual.
   ------------------------------------------------------------ */

create or replace function public.reprogramar_como_cliente(p_reserva uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r      reservas%rowtype;
  v_reglas jsonb;
  v_clase  uuid := nullif(p ->> 'clase_id', '')::uuid;
  v_desde  timestamptz := nullif(p ->> 'desde', '')::timestamptz;
  v_dur    integer;
  v_antes  timestamptz;
  v_aviso  text;
  v_nueva  uuid;
begin
  select * into v_r from reservas where id = p_reserva for update;

  /* El `is null` de `cliente_id` no sobra: sin él, un turno que el
     mostrador tomó sin cargar la ficha se podía mover desde cualquier
     cuenta. `NULL not in (...)` no da falso, da NULL, y un `if NULL` no
     entra. Es el mismo agujero que encontró la prueba de 0055, escrito
     acá antes de que lo encuentre de nuevo. */
  if v_r.id is null
     or v_r.cliente_id is null
     or v_r.cliente_id not in (select public.mis_fichas()) then
    raise exception 'Ese turno no es tuyo.' using errcode = 'P0095';
  end if;

  v_reglas := public.reglas_de(v_r.empresa_id);

  if not (v_reglas ->> 'permiteReprogramar')::boolean then
    raise exception 'Este comercio pide que los cambios de horario se arreglen por el local.'
      using errcode = 'P00D0';
  end if;

  if v_r.estado in ('cancelada', 'ausente') then
    raise exception 'Ese turno está cancelado.' using errcode = 'P00D1';
  end if;

  /* La misma ventana que para cancelar sin costo, y con eso queda dicho
     que el turno pasó a ser del comercio. Cubre también el turno que ya
     pasó: con `cancelacionHoras` en cero, `desde <= now()`. */
  if v_r.desde <= now() + ((v_reglas ->> 'cancelacionHoras')::integer || ' hours')::interval then
    raise exception 'Ya es tarde para cambiar este turno de horario.'
      using errcode = 'P00D2';
  end if;

  /* ---- A dónde va ---- */

  if v_clase is not null then
    /* La hora sale de la clase, igual que al reservar: mandarla por
       parámetro deja entrar a una clase "a otra hora". */
    select r.desde, r.duracion_min into v_desde, v_dur
      from reservas r
     where r.id = v_clase and r.empresa_id = v_r.empresa_id and r.cupo is not null;
    if v_desde is null then
      raise exception 'No existe esa clase.' using errcode = 'P0042';
    end if;
  else
    if v_desde is null then
      raise exception 'Falta el horario nuevo.' using errcode = 'P00D3';
    end if;
    /* La duración es la del turno: mover no es cambiar de servicio. */
    v_dur := v_r.duracion_min;
  end if;

  /* Las cuatro combinaciones son en realidad dos. Cruzarlas —salir de una
     clase hacia un hueco individual, o al revés— no es mover un turno:
     es cancelar uno y sacar otro, con otro precio y otra disponibilidad.
     No puede llegar desde la app, porque `horarios_libres` ofrece clases
     o huecos según el servicio y nunca los dos, así que acá se rechaza y
     no se resuelve. */
  if (v_r.clase_id is not null) <> (v_clase is not null) then
    raise exception 'Ese cambio no es mover el turno: cancelalo y sacá el nuevo.'
      using errcode = 'P00D4';
  end if;

  /* Mover al mismo lugar no es mover. Se corta acá y no más adelante
     porque en el brazo de las clases sí tendría efecto: cancelaría la
     inscripción y crearía otra idéntica, dejando en el historial del
     comercio un cambio que nadie hizo. */
  if coalesce(v_clase = v_r.clase_id, v_desde = v_r.desde) then
    raise exception 'Ese es el horario que ya tenías.' using errcode = 'P00D5';
  end if;

  /* ---- Las reglas del horario nuevo ---- */

  v_aviso := public.revisar_reglas_del_cliente(
    v_r.empresa_id, v_r.cliente_id, v_desde, v_dur, v_r.id);

  /* El plan tiene que seguir cubriendo el turno en su fecha nueva:
     vigencia, saldo y tope semanal. Los tres los mira `revisar_abono`, y
     con `p_id` se ignora a sí misma —que es lo que 0067 vino a arreglar,
     ver el encabezado—.

     No se busca otro plan si este ya no sirve. Cambiar de pack en
     silencio es mover plata de un lado al otro: quien compró dos eligió
     con cuál venía. Lo que corresponde es el mensaje que `revisar_abono`
     ya escribe —"Ese abono vence el 12/09"— y que decida ella. */
  if v_r.abono_id is not null then
    perform public.revisar_abono(v_r.abono_id, v_r.cliente_id, v_desde, v_r.id);
  end if;

  v_antes := v_r.desde;

  /* ---- Y se mueve ---- */

  if v_clase is null then
    /* `mover_turno` ya valida lo del comercio —choque de sala, de
       persona, horario de trabajo, bloqueos y feriados— e ignora al
       propio turno. Es la misma que usa el mostrador. */
    perform public.mover_turno(p_reserva, v_desde, v_dur);

    update reservas
       set campos_extra = campos_extra || jsonb_build_object(
             'movidaPor', 'cliente',
             'movidaEn',  now(),
             'movidaDe',  v_antes)
     where id = p_reserva;

    v_nueva := p_reserva;
  else
    /* Se sale de una clase y se entra en la otra, en la misma
       transacción. El orden importa: cancelando primero, el lugar y la
       clase del abono quedan libres antes de que `inscribir` los pida, y
       si la clase nueva se llenó recién, `inscribir` levanta y se
       deshace todo —la vieja no se pierde—.

       Sin `cancelacionTarde`, que es lo que hace que `clases_usadas` no
       la cuente: mover dentro de la ventana no gasta nada. */
    update reservas
       set estado = 'cancelada',
           campos_extra = campos_extra || jsonb_build_object(
             'canceladaPor', 'cliente',
             'canceladaEn',  now(),
             'reprogramada', true)
     where id = p_reserva;

    v_nueva := public.inscribir(jsonb_build_object(
      'clase_id',   v_clase,
      'cliente_id', v_r.cliente_id,
      'nombre',     v_r.nombre,
      'telefono',   v_r.telefono,
      'abono_id',   v_r.abono_id,
      'estado',     'confirmada'
    ));

    /* Las dos puntas del cambio quedan escritas, para que el mostrador
       pueda leer la historia sin adivinarla por las horas. */
    update reservas
       set campos_extra = campos_extra || jsonb_build_object(
             'movidaPor', 'cliente',
             'movidaEn',  now(),
             'movidaDe',  v_antes,
             'vieneDe',   p_reserva)
     where id = v_nueva;

    update reservas
       set campos_extra = campos_extra || jsonb_build_object('reprogramadaA', v_nueva)
     where id = p_reserva;
  end if;

  return jsonb_build_object('id', v_nueva, 'antes', v_antes, 'aviso', v_aviso);
end;
$$;

comment on function public.reprogramar_como_cliente is
  'Mueve un turno propio a otro horario aplicando las reglas del comercio. Un turno individual cambia de hora; una inscripción se cambia por otra clase.';

grant execute on function public.reprogramar_como_cliente(uuid, jsonb) to authenticated;
