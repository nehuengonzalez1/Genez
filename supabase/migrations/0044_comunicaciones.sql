/* ============================================================
   0044 · COMUNICACIONES · lo que hay que avisar hoy
   ============================================================

   CRM contesta "a quién conviene escribirle esta semana". Esto contesta
   otra cosa, todos los días: **a quién hay que avisarle algo ahora**.

   Son dos módulos y no uno porque son dos trabajos distintos, los hace
   gente distinta y se abren en momentos distintos. Recepción manda los
   recordatorios de mañana cada tarde antes de irse; lo de CRM lo mira el
   dueño una vez por semana. Meterlos en la misma pantalla haría que la
   tarea diaria quede sepultada debajo de la semanal.

   Lo que sí comparten es dónde queda anotado: `contactos`, una sola
   tabla. Dos registros de mensajes enviados es la forma más rápida de no
   saber nunca si a alguien ya se le escribió.

   UN RECORDATORIO NO ES MARKETING
   -------------------------------
   Por eso `no contactar` —que sí frena todo lo de CRM— no frena esto.
   Quien pidió que no le manden promociones no pidió que no le avisen que
   mañana tiene turno a las nueve; si además se le deja de avisar, el que
   queda mal es el negocio. Son dos cosas con el mismo medio y distinta
   naturaleza, y el sistema tiene que poder distinguirlas.

   NO SE AVISA DOS VECES
   ---------------------
   `contactos` gana `reserva_id`. Sin eso, la única forma de saber si a
   alguien ya se le recordó su turno del martes sería mirar si se le
   escribió "hace poco", y con dos turnos en la misma semana eso falla
   siempre. La lista de pendientes excluye el turno que ya tiene su aviso,
   no al cliente.

   LAS PLANTILLAS GUARDAN LO QUE SE CAMBIÓ, NO TODO
   ------------------------------------------------
   Los textos de fábrica viven en el código. La tabla guarda únicamente
   los que el comercio reescribió, así un comercio nuevo funciona el
   primer día sin sembrarle nada y "volver al original" es borrar una
   fila. Mismo criterio que `MEDIOS_INICIALES` en los ajustes.
   ============================================================ */

/* ------------------------------------------------------------
   1 · A qué turno correspondía el mensaje
   ------------------------------------------------------------ */

alter table contactos add column reserva_id uuid references reservas(id) on delete set null;

create index on contactos (reserva_id) where reserva_id is not null;

/* Y el cliente pasa a poder ir en null. Un turno se puede tomar con un
   nombre y un teléfono y nada más —alguien que llama por primera vez— y
   a esa persona también hay que recordarle que mañana viene. Con la
   columna obligatoria, el único turno que no se puede avisar es
   justamente el de quien todavía no es cliente de nadie.

   Para CRM no cambia nada: ahí el cliente siempre existe, porque los
   segmentos salen de `clientes_vista`. */
alter table contactos alter column cliente_id drop not null;

comment on column contactos.reserva_id is
  'El turno que se recordó. Es lo que evita avisar dos veces del mismo turno sin bloquear al cliente entero.';


/* ------------------------------------------------------------
   2 · Los textos que el comercio reescribió
   ------------------------------------------------------------ */

create table plantillas (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  clave        text not null,
  texto        text not null,
  actualizada  timestamptz not null default now(),
  usuario_id   uuid references perfiles(id) on delete set null,
  unique (empresa_id, clave)
);

comment on table plantillas is
  'Solo lo que el comercio cambió. Los textos de fábrica están en el código: así un comercio nuevo anda sin semilla y volver al original es borrar la fila.';

alter table plantillas enable row level security;

create policy plantillas_ver on plantillas
  for select using (public.puede_ver(empresa_id));

create policy plantillas_escribir on plantillas
  for insert with check (public.puede_ver(empresa_id));

create policy plantillas_editar on plantillas
  for update using (public.puede_ver(empresa_id));

create policy plantillas_borrar on plantillas
  for delete using (public.puede_ver(empresa_id));


/* ------------------------------------------------------------
   3 · Lo que hay que avisar

   Todos los turnos que empiezan dentro de la ventana y todavía no
   tienen su aviso. Las inscripciones a una clase entran una por una
   —cada persona recibe su mensaje— y la clase en sí no: no tiene a
   quién avisarle.
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
   )
 order by r.desde, coalesce(c.razon_social, r.nombre)
$$;

comment on function comunicaciones_pendientes is
  'Los turnos que empiezan dentro de la ventana y todavía no tienen su aviso. No filtra por "no contactar": un recordatorio de turno no es marketing.';

grant execute on function comunicaciones_pendientes(uuid, int) to authenticated;


/* ------------------------------------------------------------
   4 · La sección en el menú
   ------------------------------------------------------------ */

update rubros set menu = jsonb_set(
  menu, '{7}',
  '{
    "clave":"comunicaciones", "nombre":"Comunicaciones", "i":"mensaje",
    "modulos":[
      {"k":"comunicaciones","n":"Avisos","i":"mensaje","d":"Recordatorios de turno, plantillas y todo lo que se mandó"}
    ]
  }'::jsonb
)
where clave = 'servicios'
  and menu -> 7 ->> 'clave' = 'comunicaciones';

do $$
declare v_plataforma uuid;
begin
  select id into v_plataforma from perfiles where es_plataforma limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_plataforma, 'role', 'authenticated')::text, true);

  update empresas
     set modulos = array(select distinct unnest(modulos || array['comunicaciones']))
   where nombre = 'Almha';

  perform set_config('request.jwt.claims', '', true);
end;
$$;

select count(*) as por_avisar
  from comunicaciones_pendientes((select id from empresas where nombre = 'Almha'), 24);
