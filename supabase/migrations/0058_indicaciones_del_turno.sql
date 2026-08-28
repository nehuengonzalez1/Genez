/* ============================================================
   0058 · LO QUE HAY QUE SABER ANTES DE IR
   ============================================================

   "Llegar 10 min antes · Te esperamos en recepción" y "Qué llevar · Ropa
   cómoda, media antideslizante y tu botella de agua". Son las dos cosas
   que la maqueta pone en el detalle del turno y que hoy no están en
   ningún lado: quien reserva por la app se entera de eso cuando llega,
   o no se entera.

   DOS NIVELES, Y EL SERVICIO LE GANA AL COMERCIO
   ----------------------------------------------
   Lo que hay que llevar a una clase de reformer no es lo que hay que
   llevar a una limpieza facial, así que el texto es del servicio. Pero
   "llegá diez minutos antes" suele valer para todo el local, y pedirle al
   comercio que lo repita en cada uno de sus trece servicios es la forma
   de que quede escrito en tres y desactualizado en los otros diez.

   Entonces: `items.campos_extra->'turno'` si está, y si no
   `empresas.config->'turnos'`. Es el mismo criterio con el que el
   proyecto resuelve los roles, las plantillas y las reglas de reserva
   —fábrica arriba, cambios abajo— aplicado adentro de un comercio.

   `config.turnos` ya existía desde 0035, con `ausenciaConsume`: las
   reglas de turnos de un comercio viven ahí y no en un espacio nuevo.

   TRES CLAVES Y LAS TRES OPCIONALES
   ---------------------------------
   `llegarMin` es un número y no un texto porque es una cantidad de
   minutos: así la pantalla la escribe como corresponda y, el día que haya
   recordatorios, el aviso puede salir a esa hora sin volver a
   interpretarla.

   `llegarNota` y `llevar` son del comercio y se muestran tal cual. Sin
   ninguna cargada, el detalle del turno queda como estaba: esto no
   inventa un texto de fábrica que despues nadie sabe de dónde salió.
   ============================================================ */

drop function if exists public.mis_turnos(date);

create or replace function public.mis_turnos(p_desde date default null)
returns table (
  id             uuid,
  empresa        text,
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
    r.desde - ((public.reglas_de(r.empresa_id) ->> 'cancelacionHoras')::integer || ' hours')::interval
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
