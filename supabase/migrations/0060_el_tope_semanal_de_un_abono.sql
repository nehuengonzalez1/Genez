/* ============================================================
   0060 · UN PLAN CON TOPE SEMANAL NO ES UN PLAN LIBRE
   ============================================================

   `mis_abonos` devolvía `clases` y nada más, así que la app del cliente
   tenía una sola pregunta: ¿tiene tope de sesiones o no? Y contestaba que
   no cada vez que `clases` era nulo.

   `abonos.tope_semanal` existe desde la agenda y **37 de los 146 abonos
   de la base lo usan**. El de Victoria es uno: se llama "Plan 2 por
   semana", tiene `clases` en nulo y `tope_semanal` en 2.

   O sea que la app le venía diciendo que su plan no tiene límite, y el
   plan tiene un límite que además está escrito en su nombre. No es que
   faltara una pantalla: la que había decía lo contrario de lo que pasa.

   Se encontró construyendo la pantalla de sesiones de la maqueta, cuando
   el texto "es un plan libre" quedó abajo del título "Plan 2 por semana".

   TRES CLASES DE ABONO Y NO DOS
   -----------------------------
     `clases`         un pack: N sesiones y cuando se acaban, se acaban
     `tope_semanal`   un plan: N por semana, todas las semanas
     ninguno de los dos   libre de verdad

   Con las dos preguntas juntas la pantalla puede decir lo que
   corresponda, y el día que un comercio venda un pack con tope semanal
   —doce clases, máximo dos por semana— las dos son ciertas a la vez y no
   hay que elegir.

   Y CUÁNTAS VAN ESTA SEMANA
   -------------------------
   Un tope semanal sin decir cuántas se usaron es un número que no sirve:
   "dos por semana" ya está en el nombre del plan. Lo que la persona
   necesita saber es si le queda una para el jueves.

   La semana arranca el lunes, que es como se cuenta una semana acá y como
   la cuenta el resto del sistema. Y cuenta lo mismo que `clases_usadas`
   —lo que se dio, la ausencia si el comercio la cobra, la cancelación
   tardía si la cobra— porque si contaran distinto, el mismo turno sumaría
   en un lado y no en el otro.
   ============================================================ */

/* Cambia lo que devuelve, así que no alcanza con `create or replace`:
   Postgres no deja cambiarle el tipo de retorno a una función existente. */
drop function if exists public.mis_abonos();

create or replace function public.mis_abonos()
returns table (
  id            uuid,
  empresa       text,
  nombre        text,
  clases        integer,
  usadas        bigint,
  tope_semanal  integer,
  usadas_semana bigint,
  desde         date,
  vence         date,
  vigente       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    e.nombre,
    a.nombre,
    a.clases,
    public.clases_usadas(a.id)::bigint,
    a.tope_semanal,
    /* Solo tiene sentido si hay tope: sin él, "van 3 esta semana" es un
       dato sobre nada. Se devuelve nulo y la pantalla no lo dibuja. */
    case when a.tope_semanal is null then null else (
      select count(*)
        from reservas r
        join abonos ab on ab.id = r.abono_id
       where r.abono_id = a.id
         and r.desde >= date_trunc('week', now())
         and r.desde <  date_trunc('week', now()) + interval '1 week'
         and (
           r.estado not in ('cancelada', 'ausente')
           or (r.estado = 'ausente' and public.ausencia_consume(ab.empresa_id))
           or (r.estado = 'cancelada'
               and (r.campos_extra ->> 'cancelacionTarde')::boolean is true
               and (public.reglas_de(ab.empresa_id) ->> 'tardeConsume')::boolean)
         )
    ) end,
    a.desde,
    a.vence,
    (not a.anulado and (a.vence is null or a.vence >= current_date))
  from abonos a
  join empresas e on e.id = a.empresa_id
 where a.cliente_id in (select public.mis_fichas())
   and a.anulado = false
 /* El vigente primero: es el único que la persona viene a mirar. Los
    vencidos quedan abajo como historia. */
 order by (not a.anulado and (a.vence is null or a.vence >= current_date)) desc,
          a.desde desc
$$;

grant execute on function public.mis_abonos() to authenticated;
