/* ============================================================
   0055 · CANCELAR DESDE LA APP
   ============================================================

   Hasta la hora que diga el comercio, cancelar no cuesta nada y la clase
   vuelve al abono. Después, el lugar se reservó y no se pudo dar a nadie:
   la clase se pierde igual.

   POR QUÉ NO SE MARCA COMO `ausente`
   ----------------------------------
   Era la salida corta: `clases_usadas` ya cuenta las ausencias según lo
   que decida el comercio, así que marcando la cancelación tardía como
   ausencia el número salía solo.

   No se hace, y la razón es que `informe_ocupacion` e `informe_equipo`
   también miran `ausente`. Alguien que avisó tres horas antes —y cuyo
   lugar se le dio a otra persona— aparecería en los informes como que no
   vino. Son dos hechos distintos: uno es una falta y el otro es un aviso
   tarde, y el comercio los mira distinto.

   Además `ausenciaConsume` y `tardeConsume` son dos reglas que un
   comercio puede querer en distinto: perdonar al que se enfermó y no al
   que canceló media hora antes. Con un solo estado se pierde esa
   diferencia para siempre.

   Queda `cancelada` —así el lugar se libera y otro lo puede tomar, que es
   lo que corresponde— con la marca de por qué en `campos_extra`.

   LA DEUDA NO SE FACTURA SOLA
   ---------------------------
   Cuando no hay abono, la clase perdida deja un cargo. Se anota en la
   reserva y **no se emite una venta**.

   `registrar_venta` crea una operación con `numero` y `comprobante`, que
   son campos fiscales, y le pone `estado = 'confirmada'`. Emitir un
   comprobante automático porque alguien canceló tarde desde el teléfono
   es una decisión del circuito de facturación del comercio, no de esta
   función. El mostrador ve el cargo en la ficha y lo cobra cuando la
   persona viene, que es como se hace hoy.
   ============================================================ */


/* ------------------------------------------------------------
   1 · Una cancelación tardía gasta la clase

   `clases_usadas` es la única cuenta de esto —lo unificó 0051 para que
   el mostrador y el cliente no vean números distintos— así que el cambio
   va acá y llega a los dos lados solo.
   ------------------------------------------------------------ */

create or replace function public.clases_usadas(p_abono uuid)
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
     and (
       /* Lo que se usó de verdad. */
       r.estado not in ('cancelada', 'ausente')
       /* Una ausencia, según lo que decida el comercio. */
       or (r.estado = 'ausente' and public.ausencia_consume(a.empresa_id))
       /* Y una cancelación fuera de término, según otra regla suya: el
          lugar quedó reservado y no se pudo dar a nadie. */
       or (r.estado = 'cancelada'
           and (r.campos_extra ->> 'cancelacionTarde')::boolean is true
           and (public.reglas_de(a.empresa_id) ->> 'tardeConsume')::boolean)
     )
$$;


/* ------------------------------------------------------------
   2 · Hasta cuándo se puede cancelar

   Se devuelve con cada turno para que la pantalla no tenga que calcularlo
   —y sobre todo para que no lo calcule distinto—. Un botón que se ve y
   después es rechazado es peor que un botón que no está.
   ------------------------------------------------------------ */

drop function if exists public.mis_turnos(date);

create or replace function public.mis_turnos(p_desde date default null)
returns table (
  id             uuid,
  empresa        text,
  servicio       text,
  profesional    text,
  desde          timestamptz,
  duracion_min   integer,
  estado         text,
  es_clase       boolean,
  puede_cancelar boolean,
  cancelar_hasta timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    e.nombre,
    coalesce(i.nombre, ic.nombre),
    coalesce(per.nombre, perc.nombre),
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
    r.desde - ((public.reglas_de(r.empresa_id) ->> 'cancelacionHoras')::integer || ' hours')::interval
  from reservas r
  join empresas e on e.id = r.empresa_id
  left join items    i    on i.id    = r.item_id
  left join personal per  on per.id  = r.personal_id
  left join reservas cl   on cl.id   = r.clase_id
  left join items    ic   on ic.id   = cl.item_id
  left join personal perc on perc.id = cl.personal_id
 where r.cliente_id in (select public.mis_fichas())
   and r.desde >= coalesce(p_desde, current_date - 90)
 order by r.desde desc
$$;

grant execute on function public.mis_turnos(date) to authenticated;


/* ------------------------------------------------------------
   3 · Cancelar

   Devuelve qué pasó: si fue a tiempo, si gastó la clase y si quedó un
   cargo. La pantalla lo dice; no lo deduce.
   ------------------------------------------------------------ */

create or replace function public.cancelar_como_cliente(p_reserva uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_r       reservas%rowtype;
  v_reglas  jsonb;
  v_tarde   boolean;
  v_consume boolean := false;
  v_cargo   numeric := 0;
begin
  select * into v_r from reservas where id = p_reserva for update;

  /* El `is null` no sobra: sin él, un turno sin ficha asignada —los que
     toma el mostrador sin cargar a la persona— se podía cancelar desde
     cualquier cuenta.

     `NULL not in (...)` no da verdadero: da NULL, y un `if NULL` no
     entra. La condición se leía bien y dejaba pasar todo lo que tuviera
     `cliente_id` vacío. Lo encontró la prueba de "ni el turno de otra
     persona", que justamente usaba una reserva sin cliente. */
  if v_r.id is null
     or v_r.cliente_id is null
     or v_r.cliente_id not in (select public.mis_fichas()) then
    raise exception 'Ese turno no es tuyo.' using errcode = 'P0095';
  end if;

  v_reglas := public.reglas_de(v_r.empresa_id);

  if not (v_reglas ->> 'permiteCancelar')::boolean then
    raise exception 'Este comercio pide que las cancelaciones se hagan por el local.'
      using errcode = 'P0096';
  end if;

  if v_r.estado in ('cancelada', 'ausente') then
    raise exception 'Ese turno ya estaba cancelado.' using errcode = 'P0097';
  end if;

  if v_r.desde <= now() then
    raise exception 'Ese turno ya pasó.' using errcode = 'P0098';
  end if;

  v_tarde := v_r.desde < now()
    + ((v_reglas ->> 'cancelacionHoras')::integer || ' hours')::interval;

  if v_tarde and (v_reglas ->> 'tardeConsume')::boolean then
    if v_r.abono_id is not null then
      /* Con abono, la clase se descuenta igual: `clases_usadas` mira esta
         marca. */
      v_consume := true;
    else
      /* Sin abono queda un cargo. Se anota en la reserva y no se emite un
         comprobante: eso lo decide el comercio, no esta función. */
      select coalesce(i.precio, 0) into v_cargo
        from items i where i.id = coalesce(v_r.item_id, (
          select item_id from reservas where id = v_r.clase_id
        ));
      v_cargo := coalesce(v_cargo, 0);
    end if;
  end if;

  update reservas
     set estado = 'cancelada',
         campos_extra = campos_extra
           || jsonb_build_object(
                'canceladaPor', 'cliente',
                'canceladaEn', now()
              )
           || case when v_tarde
                then jsonb_build_object('cancelacionTarde', true)
                else '{}'::jsonb end
           || case when v_cargo > 0
                then jsonb_build_object('adeuda', v_cargo)
                else '{}'::jsonb end
   where id = p_reserva;

  return jsonb_build_object(
    'tarde',   v_tarde,
    'consumio', v_consume,
    'adeuda',  v_cargo
  );
end;
$$;

comment on function public.cancelar_como_cliente is
  'Cancela un turno propio aplicando las reglas del comercio. Devuelve si fue tarde, si gastó la clase y si quedó un cargo.';

grant execute on function public.cancelar_como_cliente(uuid) to authenticated;
