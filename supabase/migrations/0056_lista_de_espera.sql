/* ============================================================
   0056 · ANOTARSE EN LA LISTA DE ESPERA
   ============================================================

   Hasta ahora, una clase llena simplemente no aparecía en la app. Si el
   comercio lo permite, ahora aparece y se puede pedir lugar.

   LO QUE NO SE TOCA
   -----------------
   `espera` existe desde 0034 y su comentario dice algo que conviene
   respetar: *"No se promueve solo: liberar un lugar y meter a alguien sin
   avisarle es peor que el problema."*

   Es cierto. Alguien anotado hace cuatro días puede haber conseguido otro
   horario, estar trabajando, o no querer más ir. Meterla en una clase
   porque se liberó un lugar y que se entere cuando le llegue el
   recordatorio es peor que dejarla afuera.

   Así que esto **no promueve a nadie**. El comercio ve que se liberó un
   lugar, avisa —hay una plantilla en Comunicaciones para eso desde
   0044— y la persona decide. Lo que cambia es que ahora puede anotarse
   sola en vez de llamar, y ver en qué lugar de la fila está.

   UNA CLASE LLENA AHORA SE VE
   ---------------------------
   `horarios_libres` la excluía. Pasa a devolverla con `lugares = 0`
   cuando el comercio habilitó la espera desde la app: es una opción
   distinta —pedir lugar en vez de reservarlo— pero es una opción, y
   esconderla obliga a llamar para saber que existe.

   Si el comercio no la habilitó, se sigue sin ver: ofrecer anotarse en
   una lista que nadie mira es peor que no ofrecer nada.
   ============================================================ */


/* ------------------------------------------------------------
   0 · Un guardián de 0051 que impedía agregar reglas

   0051 sembró las reglas de fábrica del rubro así:

     update rubros set reglas = jsonb_build_object(...)
      where clave = 'servicios' and not (reglas ? 'anticipacionMin');

   La condición decía "si ya sembraste, no toques", y suena bien hasta que
   hace falta una regla nueva: `esperaDesdeApp` y `ausenciaConsume` se
   agregaron a ese mismo archivo un rato después, y la actualización nunca
   corrió porque `anticipacionMin` ya estaba.

   El síntoma es peor que el error: Almha caía en el piso conservador
   —`esperaDesdeApp: false`— o sea que la lista de espera parecía
   deshabilitada por decisión del comercio y no por un bug.

   Se corrige con el orden invertido: los valores de fábrica primero y lo
   que ya había encima. Así una clave nueva se agrega y una que el rubro
   ya tenía —o que alguien corrigió— no se pisa. Es idempotente de verdad
   y admite crecer, que es lo que el guardián anterior no hacía.
   ------------------------------------------------------------ */

update rubros
   set reglas = jsonb_build_object(
     'anticipacionMin',     60,
     'anticipacionMaxDias', null,
     'cancelacionHoras',    3,
     'tardeConsume',        true,
     'permiteCancelar',     true,
     'requiereHistorial',   true,
     'avisarMismoDia',      true,
     'esperaDesdeApp',      true,
     'ausenciaConsume',     true
   ) || reglas
 where clave = 'servicios';


/* ------------------------------------------------------------
   1 · Las clases llenas vuelven a la lista

   Se agregan dos columnas al final para no romper a quien ya lee las
   ocho: `en_espera` dice si esta persona ya está anotada, y `esperando`
   cuántas hay delante.
   ------------------------------------------------------------ */

drop function if exists public.horarios_libres(uuid, uuid, date, date, uuid);

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
  lugares      integer,
  en_espera    boolean,
  esperando    integer
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
begin
  if not exists (
    select 1 from clientes c
     where c.empresa_id = p_empresa and c.usuario_id = auth.uid() and c.activo = true
  ) then
    return;
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
          where e.clase_id = r.id and e.estado = 'esperando')
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
      hu.recurso_id, rec.nombre, 1, false, 0
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

grant execute on function public.horarios_libres(uuid, uuid, date, date, uuid) to authenticated;


/* ------------------------------------------------------------
   2 · Anotarse

   Por función y no por política, como todo lo que hace el cliente:
   `espera` tiene `notas`, que es de recepción, y una política de fila la
   dejaría leer.
   ------------------------------------------------------------ */

create or replace function public.anotarme_en_espera(p_clase uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clase   reservas%rowtype;
  v_ficha   uuid;
  v_nombre  text;
  v_tel     text;
  v_reglas  jsonb;
  v_tomados integer;
  v_orden   integer;
  v_id      uuid;
begin
  /* Se bloquea la clase por lo mismo que en `inscribir`: entre que se
     mira si está llena y se anota a alguien puede liberarse un lugar, y
     mandar a la lista a quien podía entrar es el peor de los dos
     errores. */
  select * into v_clase from reservas where id = p_clase for update;

  if v_clase.id is null or v_clase.cupo is null then
    raise exception 'No existe esa clase.' using errcode = 'P0042';
  end if;

  select c.id, c.razon_social, c.tel into v_ficha, v_nombre, v_tel
    from clientes c
   where c.empresa_id = v_clase.empresa_id
     and c.usuario_id = auth.uid() and c.activo = true;

  if v_ficha is null then
    raise exception 'No sos cliente de este comercio.' using errcode = 'P0090';
  end if;

  v_reglas := public.reglas_de(v_clase.empresa_id);
  if not (v_reglas ->> 'esperaDesdeApp')::boolean then
    raise exception 'Este comercio maneja la lista de espera desde el local.'
      using errcode = 'P00A0';
  end if;

  if v_clase.estado = 'cancelada' then
    raise exception 'Esa clase está cancelada.' using errcode = 'P0044';
  end if;
  if v_clase.desde <= now() then
    raise exception 'Esa clase ya pasó.' using errcode = 'P0098';
  end if;

  select count(*) into v_tomados
    from reservas where clase_id = p_clase and estado not in ('cancelada', 'ausente');

  /* Si hay lugar no se anota: se reserva. Dejarla esperando un lugar que
     está libre es la forma más tonta de perderlo. */
  if v_tomados < v_clase.cupo then
    raise exception 'Esa clase tiene lugar: podés reservarla directamente.'
      using errcode = 'P00A1';
  end if;

  if exists (
    select 1 from reservas
     where clase_id = p_clase and cliente_id = v_ficha
       and estado not in ('cancelada', 'ausente')
  ) then
    raise exception 'Ya tenés lugar en esa clase.' using errcode = 'P0046';
  end if;

  if exists (
    select 1 from espera
     where clase_id = p_clase and cliente_id = v_ficha
       and estado in ('esperando', 'avisado')
  ) then
    raise exception 'Ya estás en la lista de esa clase.' using errcode = 'P00A2';
  end if;

  select coalesce(max(orden), 0) + 1 into v_orden
    from espera where clase_id = p_clase;

  insert into espera (empresa_id, clase_id, cliente_id, nombre, telefono, estado, orden, usuario_id)
  values (v_clase.empresa_id, p_clase, v_ficha, v_nombre, v_tel, 'esperando', v_orden,
          public.actor_del_comercio())
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    /* En qué lugar quedó, contando solo a los que siguen esperando: si
       tres de los de adelante se dieron de baja, decir "sos la cuarta" es
       mentir. */
    'lugar', (select count(*) from espera
               where clase_id = p_clase and estado = 'esperando' and orden <= v_orden)
  );
end;
$$;

comment on function public.anotarme_en_espera is
  'Pide lugar en una clase llena. No promueve a nadie: cuando se libere, el comercio avisa.';


create or replace function public.salir_de_espera(p_clase uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update espera
     set estado = 'baja'
   where clase_id = p_clase
     and cliente_id in (select public.mis_fichas())
     and estado in ('esperando', 'avisado');
end;
$$;


/* ------------------------------------------------------------
   3 · Dónde estoy esperando

   Va aparte de `mis_turnos` a propósito: estar en una lista no es tener
   un turno, y mezclarlos en la misma pantalla haría que alguien cuente
   como propia una clase que todavía no tiene.
   ------------------------------------------------------------ */

create or replace function public.mis_esperas()
returns table (
  clase_id    uuid,
  empresa     text,
  servicio    text,
  profesional text,
  desde       timestamptz,
  lugar       integer,
  esperando   integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    emp.nombre,
    i.nombre,
    per.nombre,
    r.desde,
    (select count(*)::integer from espera x
      where x.clase_id = r.id and x.estado = 'esperando' and x.orden <= e.orden),
    (select count(*)::integer from espera x
      where x.clase_id = r.id and x.estado = 'esperando')
  from espera e
  join reservas r  on r.id = e.clase_id
  join empresas emp on emp.id = e.empresa_id
  left join items    i   on i.id   = r.item_id
  left join personal per on per.id = r.personal_id
 where e.cliente_id in (select public.mis_fichas())
   and e.estado in ('esperando', 'avisado')
   and r.desde >= now()
   and r.estado <> 'cancelada'
 order by r.desde
$$;

grant execute on function public.anotarme_en_espera(uuid) to authenticated;
grant execute on function public.salir_de_espera(uuid)    to authenticated;
grant execute on function public.mis_esperas()            to authenticated;
