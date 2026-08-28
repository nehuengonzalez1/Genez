/* ============================================================
   0064 · LOS AVISOS QUE EL COMERCIO YA LE MANDA
   ============================================================

   La campana de la pantalla 5 y la lista de la 15.

   NO SE INVENTA UN CANAL NUEVO
   ----------------------------
   La decisión fue reusar lo que Comunicaciones ya hace, y eso resulta ser
   lo correcto por más de una razón.

   `contactos` guarda cada mensaje que el comercio le mandó a alguien —el
   recordatorio del turno de mañana, el "hace rato que no venís" del CRM—
   con su texto tal cual salió. Existe desde 0044 y su comentario dice por
   qué es una sola tabla: *"Dos registros de mensajes enviados es la forma
   más rápida de no saber nunca si a alguien ya se le escribió"*.

   Una tabla de notificaciones de la app sería exactamente ese segundo
   registro. La misma frase estaría escrita en dos lados y algún día no
   coincidirían.

   Y hay algo mejor que evitar el problema: quien abre la app ve **lo
   mismo que le llegó al teléfono**, no una versión paralela. Si el
   comercio le escribió, está; si no le escribió, no hay nada, y eso
   también es cierto.

   SOLO LO QUE SALIÓ
   -----------------
   `resultado = 'enviado'`. Un mensaje que falló es un problema del
   comercio, no una novedad de la clienta: mostrárselo sería contarle un
   intento que nunca le llegó.

   Y no sale `usuario_id` —quién lo mandó— que es asunto interno.

   LO NUEVO SE MIDE CON UNA MARCA, NO CON UN LEÍDO POR MENSAJE
   -----------------------------------------------------------
   La campana necesita saber cuántos no vio. Se podría guardar un "leído"
   por mensaje; para una campana alcanza con **desde cuándo miró**, que es
   una sola fecha y no una fila por aviso.

   Va en `campos_extra` de su ficha y no en una columna: es un dato de la
   app del cliente y no del negocio, y un comercio que nunca abra esto no
   tiene por qué cargar con la columna.

   Por comercio, además: mirar los avisos de la estética no marca como
   vistos los del gimnasio.
   ============================================================ */

create or replace function public.mis_avisos(p_desde date default null)
returns table (
  id         uuid,
  empresa    text,
  empresa_id uuid,
  fecha      timestamptz,
  motivo     text,
  texto      text,
  reserva_id uuid,
  nuevo      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    k.id,
    e.nombre,
    e.id,
    k.fecha,
    k.motivo,
    k.texto,
    k.reserva_id,
    /* Nuevo es "después de la última vez que miró". Sin marca, todos:
       quien abre la app por primera vez tiene que ver que hay algo. */
    k.fecha > coalesce(
      nullif(c.campos_extra ->> 'avisosVistos', '')::timestamptz,
      '-infinity'::timestamptz
    )
  from contactos k
  join clientes c on c.id = k.cliente_id
  join empresas e on e.id = k.empresa_id
 where k.cliente_id in (select public.mis_fichas())
   and k.resultado = 'enviado'
   and k.texto is not null
   and k.fecha >= coalesce(p_desde, '-infinity'::date)
 order by k.fecha desc
$$;

grant execute on function public.mis_avisos(date) to authenticated;


/* La marca de "hasta acá miré". Se escribe con `now()` y no con una fecha
   que venga del cliente: si viniera de afuera, mandar una del futuro
   apagaría la campana para siempre. */
create or replace function public.marcar_avisos_vistos(p_empresa uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update clientes
     set campos_extra = coalesce(campos_extra, '{}'::jsonb)
                        || jsonb_build_object('avisosVistos', now())
   where id in (select public.mis_fichas())
     and empresa_id = p_empresa
$$;

grant execute on function public.marcar_avisos_vistos(uuid) to authenticated;
