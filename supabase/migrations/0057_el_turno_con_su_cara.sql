/* ============================================================
   0057 · EL TURNO CON SU CARA
   ============================================================

   `mis_turnos` devolvía qué, cuándo y con quién. La maqueta de la app del
   cliente muestra además dónde —"Reformer 2"—, una foto de la clase y la
   cara de quien atiende.

   DÓNDE YA ERA UN DATO Y NO SE MOSTRABA
   -------------------------------------
   `reservas.recurso_id` existe desde la agenda, y las 2655 reservas de
   Almha lo tienen cargado. O sea que la sala se sabía y la persona que
   iba a la clase no la veía. No hay nada que crear: solo proyectarlo.

   LAS DOS FOTOS SON UN LUGAR VACÍO, A PROPÓSITO
   ---------------------------------------------
   Hoy no hay ninguna cargada: 0 de 13 items de Almha tienen `imagen` y
   ninguno de los 5 del personal tiene foto. Esto no las inventa —bajar
   una foto de archivo para que la pantalla se vea llena es exactamente
   lo que este proyecto no hace— sino que deja el camino hecho para que
   el día que el comercio suba la suya aparezca sola.

   La del servicio sale de `items.imagen`, que ya existía para la carta
   del bar. La de quien atiende sale de `personal.campos_extra->>'foto'`,
   y va ahí y no en una columna nueva porque es exactamente para lo que
   `campos_extra` existe: un dato de una persona que no todos los rubros
   usan. Un peluquero tiene foto en la app; un cajero de minimercado no
   aparece en ninguna pantalla de cliente.

   Y NADA DE ESTO ABRE UNA PUERTA
   ------------------------------
   Se agregan tres columnas a una función que ya proyecta columna por
   columna, que es justamente lo que permite agregarlas de a una y
   mirando. El nombre de una sala y la foto de quien atiende son lo mismo
   que el nombre del servicio: lo que el comercio le muestra a quien
   reservó. Las notas de recepción y el costo siguen sin salir.
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
    /* Para una clase, la sala es la de la clase y no la de la
       inscripción, igual que el servicio y el profesional. */
    coalesce(rec.nombre, recc.nombre),
    coalesce(i.imagen, ic.imagen),
    coalesce(per.campos_extra ->> 'foto', perc.campos_extra ->> 'foto'),
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
