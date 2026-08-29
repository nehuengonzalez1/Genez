/* ============================================================
   0068 · UN AVISO DEL HORARIO VIEJO NO CUENTA COMO AVISO
   ============================================================

   Defecto abierto por 0067, encontrado mirando qué más toca mover un
   turno. No es del cliente: le pasa igual al mostrador desde 0032, solo
   que nadie movía tantos turnos.

   QUÉ PASA
   --------
   `comunicaciones_pendientes` excluye un turno apenas existe **cualquier**
   contacto suyo con motivo `recordatorio`. Eso era cierto mientras un
   turno tenía una sola hora en toda su vida.

   Los números se cruzan solos: el recordatorio sale dentro de las
   `recordatorioHoras` —24 de fábrica— y mover se puede hasta
   `cancelacionHoras` antes —3 en Almha—. Entre esas dos hay veintiuna
   horas en las que el aviso ya salió y el turno todavía se mueve.

   Adentro de esa ventana pasa lo peor de las dos: se le avisó "mañana
   martes a las 15" de un turno que ya no existe a esa hora, y del jueves
   —el que sí tiene— no le avisa nadie. Recepción tampoco lo ve: para
   ella ese turno está avisado.

   Y ES LA TERCERA VEZ QUE LOS DOS BRAZOS SE PORTAN DISTINTO
   --------------------------------------------------------
   Cambiar de clase crea una reserva nueva, sin contactos, así que entra
   sola en la lista de pendientes. Correr un turno individual conserva la
   fila —que es lo que se quiso, para no mandar dos recordatorios— y con
   ella se queda el aviso viejo.

   Es el mismo patrón que ya apareció con el saldo del abono y con la
   bitácora: lo que se apoya en el id de la reserva se rompe cuando la
   reserva es la misma y su hora no. Vale la pena tenerlo escrito, porque
   la próxima cosa que se cuelgue de `reserva_id` va a tener que
   preguntárselo.

   NO SE BORRA EL CONTACTO
   -----------------------
   Era la salida corta y está mal: `contactos` es el registro de lo que se
   mandó, y ese mensaje se mandó. Borrarlo deja a recepción sin saber que
   le dijo una hora equivocada a alguien, que es justo lo que conviene que
   sepa. Se guarda cuándo se movió el turno y se compara.
   ============================================================ */


/* ------------------------------------------------------------
   1 · Cuándo se movió, como columna

   En `reservas` y puesta por un disparador, no por quien mueve.

   `reprogramar_como_cliente` ya escribe `campos_extra.movidaEn`, así que
   la tentación era leer eso. No sirve: lo escribe **la función del
   cliente**, y por la puerta del mostrador —`mover_turno`, que es la que
   viene fallando desde 0032— no lo escribe nadie. Un recordatorio que se
   reemite o no según desde qué pantalla se movió el turno es peor que el
   error que vino a arreglar.

   Es el mismo argumento con el que 0067 puso el asiento de bitácora en el
   disparador: la regla no es de quien mueve, es de la tabla.

   `campos_extra.movidaPor` y `movidaDe` se quedan donde están: dicen
   quién lo movió y desde qué hora, que es otra cosa y sigue siendo del
   cliente.
   ------------------------------------------------------------ */

alter table reservas add column if not exists movida_en timestamptz;

comment on column reservas.movida_en is
  'Cuándo cambió de horario por última vez. La pone un disparador: lo que se avisó antes de esa marca hablaba de otra hora.';


create or replace function public.marcar_movida()
returns trigger
language plpgsql
as $$
begin
  if new.desde is distinct from old.desde then
    /* `clock_timestamp()` y no `now()`. `now()` es la hora en que arrancó
       la transacción, y acá lo que se guarda se compara después contra la
       hora de un mensaje: hace falta el instante del cambio, no el del
       comienzo de lo que lo contenía. Con `now()`, un aviso mandado
       adentro de la misma transacción que la movida empata, y un empate
       se lee como "avisado". */
    new.movida_en := clock_timestamp();
  end if;
  return new;
end;
$$;

drop trigger if exists reservas_movida on reservas;

create trigger reservas_movida
  before update on reservas
  for each row execute function public.marcar_movida();


/* ------------------------------------------------------------
   2 · Y el aviso viejo deja de contar

   Una línea. El resto de la función es igual a 0044 a propósito: si algo
   más cambia acá, se pierde de vista qué arregló esta migración.
   ------------------------------------------------------------ */

create or replace function comunicaciones_pendientes(
  p_empresa uuid,
  p_horas   int default 24
)
returns table (
  reserva_id  uuid,
  cliente_id  uuid,
  cliente     text,
  tel         text,
  desde       timestamptz,
  estado      text,
  servicio    text,
  profesional text,
  sala        text,
  es_clase    boolean
)
language sql
stable
as $$
  select
    r.id, r.cliente_id,
    coalesce(c.razon_social, r.nombre),
    coalesce(c.tel, r.telefono),
    r.desde, r.estado,
    coalesce(i.nombre, r.nombre),
    p.nombre,
    re.nombre,
    r.clase_id is not null
  from reservas r
  left join clientes c  on c.id  = r.cliente_id
  left join items    i  on i.id  = r.item_id
  left join personal p  on p.id  = r.personal_id
  left join recursos re on re.id = r.recurso_id
 where r.empresa_id = p_empresa
   /* La clase con cupo es el contenedor: los avisos van a los anotados. */
   and r.cupo is null
   and r.estado in ('pendiente', 'confirmada')
   and r.desde >= now()
   and r.desde < now() + make_interval(hours => p_horas)
   /* Ya avisado: se excluye el turno, no la persona. Alguien con dos
      turnos esta semana tiene que recibir los dos recordatorios. */
   and not exists (
     select 1 from contactos k
      where k.reserva_id = r.id and k.motivo = 'recordatorio'
        /* Y avisado de ESTA hora. Un mensaje mandado antes de que el
           turno se moviera decía una hora que ya no existe, así que el
           turno vuelve a la lista. Sin esto, quien mueve su turno el
           mismo día se queda sin recordatorio del horario que sí tiene. */
        and k.fecha > coalesce(r.movida_en, '-infinity'::timestamptz)
   )
 order by r.desde, coalesce(c.razon_social, r.nombre)
$$;

comment on function comunicaciones_pendientes is
  'Los turnos que empiezan dentro de la ventana y todavía no tienen su aviso de esa hora. No filtra por "no contactar": un recordatorio de turno no es marketing.';
