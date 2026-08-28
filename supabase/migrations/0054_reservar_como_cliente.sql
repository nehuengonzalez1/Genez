/* ============================================================
   0054 · RESERVAR DESDE LA APP DEL CLIENTE
   ============================================================

   Lo que hace que la app sirva para algo y no solo para mirar.

   NO SE DUPLICA `agendar_turno` NI `inscribir`
   --------------------------------------------
   Las dos existen desde 0032 y 0034, y adentro tienen lo que más caro
   sale rehacer: el control de choques, y sobre todo el bloqueo de la
   clase con `for update` para que dos personas no entren en el mismo
   último lugar. Copiar eso para el cliente es garantizar que un día las
   dos versiones digan cosas distintas.

   Lo que las cerraba a un cliente eran dos líneas, no su lógica:

     · `puede_ver(empresa)` — un cliente no es del comercio
     · `usuario_id = auth.uid()` — esa columna apunta a `perfiles`

   Se abren esas dos y nada más. La autorización pasa a preguntar "¿es
   del comercio, o es esta persona reservando para sí misma?", que son los
   dos casos legítimos y no hay un tercero.

   LAS REGLAS DEL CLIENTE VAN AFUERA
   ---------------------------------
   `reservar_como_cliente` aplica las de 0051 —anticipación, historial,
   dos turnos a la misma hora— y después delega. Adentro de las otras dos
   no van: el mostrador agenda con criterios propios, y meterle las reglas
   del cliente sería impedirle a recepción hacer una excepción, que es
   media razón por la que existe recepción.

   EL AVISO NO ES UN ERROR
   -----------------------
   "Ya tenés otro turno ese día" no impide nada: se devuelve junto con el
   turno creado. La regla vive acá y no en la pantalla, porque el día que
   haya una segunda pantalla que reserve —el mostrador, un widget, lo que
   sea— el aviso tiene que salir igual sin que nadie se acuerde de
   copiarlo.
   ============================================================ */


/* ------------------------------------------------------------
   0 · La bitácora, de una vez

   `bitacora.usuario_id` apunta a `perfiles` y significa "qué persona del
   comercio hizo esto". Ocho funciones escriben ahí, y siete lo llenan con
   `auth.uid()` sin preguntar. Mientras todo el que estaba autenticado era
   personal, eso era cierto sin pensarlo.

   Desde 0050 hay cuentas que no son personal, y apenas un cliente reserva
   revienta la clave foránea. Lo anticipé ahí mismo —"se va a alcanzar
   apenas exista reservar_como_cliente"— y arreglé **una sola** de las
   ocho: `anotar_acceso`. Las otras siete quedaron, y la primera reserva
   de prueba se estrelló contra `anotar_reserva`.

   POR QUÉ ACÁ Y NO EN LAS SIETE
   -----------------------------
   Editarlas una por una arregla las de hoy y no la próxima que alguien
   escriba. La regla no es de cada disparador: es de la columna. Un solo
   `before insert` sobre la tabla la sostiene para siempre, y cualquier
   función nueva la hereda sin saber que existe.

   El acto queda registrado igual, que es lo que la bitácora tiene que
   garantizar. Lo que se pierde es el "quién" cuando el quién no es del
   comercio, y para eso está `entidad_id`: en una reserva, quién la hizo
   está en `cliente_id`.
   ------------------------------------------------------------ */

create or replace function public.bitacora_actor_del_comercio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.usuario_id is not null
     and not exists (select 1 from perfiles where id = new.usuario_id) then
    new.usuario_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bitacora_actor on bitacora;

create trigger bitacora_actor
  before insert on bitacora
  for each row execute function public.bitacora_actor_del_comercio();

comment on function public.bitacora_actor_del_comercio is
  'usuario_id de la bitacora significa "quien del comercio": si el que actua no lo es, queda en null en vez de romper la clave foranea.';


/* ------------------------------------------------------------
   1 · Los dos casos legítimos
   ------------------------------------------------------------ */

create or replace function public.puede_reservar_en(p_empresa uuid, p_cliente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.puede_ver(p_empresa)
    or (
      p_cliente is not null
      and exists (
        select 1 from clientes c
         where c.id = p_cliente
           and c.empresa_id = p_empresa
           and c.usuario_id = auth.uid()
           and c.activo = true
      )
    )
$$;

comment on function public.puede_reservar_en is
  'Si quien llama puede reservar acá: alguien del comercio, o el propio cliente para su ficha.';


/* ------------------------------------------------------------
   2 · Las dos funciones que ya existían, con la puerta abierta

   Cambian dos líneas cada una. El resto es idéntico a 0032 y 0034 a
   propósito: si algo más cambia acá, se pierde el motivo de no haberlas
   duplicado.
   ------------------------------------------------------------ */

create or replace function public.agendar_turno(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_emp      uuid := (p ->> 'empresa_id')::uuid;
  v_desde    timestamptz := (p ->> 'desde')::timestamptz;
  v_duracion integer := coalesce((p ->> 'duracion_min')::integer, 60);
  v_personal uuid := nullif(p ->> 'personal_id', '')::uuid;
  v_recurso  uuid := nullif(p ->> 'recurso_id', '')::uuid;
  v_cliente  uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_abono    uuid := nullif(p ->> 'abono_id', '')::uuid;
  v_id       uuid;
begin
  /* Antes era `puede_ver(v_emp)` a secas. */
  if not public.puede_reservar_en(v_emp, v_cliente) then
    raise exception 'No podés agendar en ese comercio.' using errcode = 'P0038';
  end if;

  perform revisar_turno(null, v_emp, v_desde, v_duracion, v_personal, v_recurso);
  if v_abono is not null then
    perform revisar_abono(v_abono, v_cliente, v_desde);
  end if;

  insert into reservas (
    empresa_id, sucursal_id, recurso_id, cliente_id, personal_id, item_id, abono_id,
    nombre, telefono, personas, desde, duracion_min, estado, notas, usuario_id
  ) values (
    v_emp,
    nullif(p ->> 'sucursal_id', '')::uuid,
    v_recurso, v_cliente, v_personal,
    nullif(p ->> 'item_id', '')::uuid,
    v_abono,
    coalesce(nullif(p ->> 'nombre', ''), 'Sin nombre'),
    nullif(p ->> 'telefono', ''),
    coalesce((p ->> 'personas')::integer, 1),
    v_desde, v_duracion,
    coalesce(nullif(p ->> 'estado', ''), 'pendiente'),
    nullif(p ->> 'notas', ''),
    /* Antes era `auth.uid()`. Esa columna apunta a `perfiles`, así que
       con un cliente reservando reventaba la clave foránea. Null cuando
       no lo hizo alguien del comercio: quién reservó, si fue el propio
       cliente, ya está en `cliente_id`. */
    public.actor_del_comercio()
  )
  returning id into v_id;

  return v_id;
end;
$$;


create or replace function public.inscribir(p jsonb)
returns uuid
language plpgsql
as $$
declare
  v_clase   reservas%rowtype;
  v_tomados integer;
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_id      uuid;
begin
  select * into v_clase from reservas where id = (p ->> 'clase_id')::uuid for update;

  if v_clase.id is null then
    raise exception 'No existe esa clase.' using errcode = 'P0042';
  end if;
  if v_clase.cupo is null then
    raise exception 'Eso no es una clase: no tiene cupo.' using errcode = 'P0043';
  end if;
  /* Antes era `puede_ver(v_clase.empresa_id)`. */
  if not public.puede_reservar_en(v_clase.empresa_id, v_cliente) then
    raise exception 'No podés anotar en ese comercio.' using errcode = 'P0038';
  end if;
  if v_clase.estado = 'cancelada' then
    raise exception 'Esa clase está cancelada.' using errcode = 'P0044';
  end if;

  select count(*) into v_tomados
    from reservas
   where clase_id = v_clase.id and estado not in ('cancelada', 'ausente');

  if v_tomados >= v_clase.cupo then
    raise exception 'Esa clase ya está completa.' using errcode = 'P0045';
  end if;

  if v_cliente is not null and exists (
    select 1 from reservas
     where clase_id = v_clase.id and cliente_id = v_cliente
       and estado not in ('cancelada', 'ausente')
  ) then
    raise exception 'Esa persona ya está anotada en esta clase.' using errcode = 'P0046';
  end if;

  insert into reservas (
    empresa_id, sucursal_id, recurso_id, personal_id, item_id, clase_id,
    cliente_id, nombre, telefono, personas, desde, duracion_min, estado, notas,
    abono_id, usuario_id
  ) values (
    v_clase.empresa_id, v_clase.sucursal_id, v_clase.recurso_id,
    v_clase.personal_id, v_clase.item_id, v_clase.id,
    v_cliente,
    coalesce(nullif(p ->> 'nombre', ''), 'Sin nombre'),
    nullif(p ->> 'telefono', ''),
    1,
    v_clase.desde, v_clase.duracion_min,
    coalesce(nullif(p ->> 'estado', ''), 'confirmada'),
    nullif(p ->> 'notas', ''),
    /* Nuevo: la inscripción puede descontar de un abono. Antes no lo
       tomaba, así que anotarse a una clase con un pack no gastaba la
       clase y el pack no se terminaba nunca. */
    nullif(p ->> 'abono_id', '')::uuid,
    public.actor_del_comercio()
  )
  returning id into v_id;

  return v_id;
end;
$$;


/* ------------------------------------------------------------
   3 · Reservar, con las reglas del comercio

   Devuelve `{ id, aviso }`. El aviso no es un error: es lo que la
   pantalla tiene que mostrar sin frenar nada.
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

  /* ---- Las reglas de 0051 ---- */

  if v_desde < now() + ((v_reglas ->> 'anticipacionMin')::integer || ' minutes')::interval then
    raise exception 'Ese horario ya está muy cerca. Se puede reservar hasta % minutos antes.',
      (v_reglas ->> 'anticipacionMin')
      using errcode = 'P0091';
  end if;

  if (v_reglas ->> 'anticipacionMaxDias') is not null
     and v_desde > now() + ((v_reglas ->> 'anticipacionMaxDias')::integer || ' days')::interval then
    raise exception 'Todavía no se puede reservar tan adelante.' using errcode = 'P0092';
  end if;

  /* Dos reservas a la misma hora es siempre un error, y no depende del
     comercio: la persona no puede estar en dos lados. */
  if exists (
    select 1 from reservas r
     where r.cliente_id = v_ficha
       and r.estado not in ('cancelada', 'ausente')
       and r.desde < v_desde + (v_dur || ' minutes')::interval
       and v_desde < r.desde + (r.duracion_min || ' minutes')::interval
  ) then
    raise exception 'Ya tenés un turno a esa hora.' using errcode = 'P0093';
  end if;

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
     turno fantasma, y se saltea si tiene abono: ya pagó. */
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

  /* Un aviso, no un impedimento. Dos turnos en un día a veces es un error
     de dedo y a veces es alguien que quiere doble clase; lo que
     corresponde es decirlo, no decidir por ella. */
  if (v_reglas ->> 'avisarMismoDia')::boolean and exists (
    select 1 from reservas r
     where r.cliente_id = v_ficha
       and r.estado not in ('cancelada', 'ausente')
       and (r.desde at time zone public.zona_horaria_de(v_emp))::date
         = (v_desde at time zone public.zona_horaria_de(v_emp))::date
  ) then
    v_aviso := 'Ojo: ya tenés otro turno ese mismo día.';
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

comment on function public.reservar_como_cliente is
  'Reserva desde la app aplicando las reglas del comercio. Devuelve el turno y, si corresponde, un aviso que no impide nada.';

grant execute on function public.reservar_como_cliente(jsonb) to authenticated;
