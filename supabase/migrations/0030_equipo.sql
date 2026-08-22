/* ============================================================
   0030 · EL EQUIPO
   ============================================================

   Quién trabaja, qué sabe hacer y cuándo está. Es lo que le falta a la
   base para poder ofrecer un turno: sin saber que Carla da reformer los
   martes de 8 a 13, no hay agenda posible ni siquiera a mano.

   `personal` no es `perfiles`
   ---------------------------
   `perfiles` son usuarios del sistema: gente que entra con una cuenta.
   `personal` es gente del negocio, que puede no entrar nunca. Hoy en la
   estética ningún profesor usa el sistema, y aun así hay que poder
   agendarlos, pagarles y cubrirlos cuando faltan.

   Por eso `perfil_id` es opcional. El día que un profesor quiera entrar se
   le engancha una cuenta y nada más. Preverlo ahora cuesta una columna;
   agregarlo después cuesta una migración de datos con turnos encima.

   `personal` tampoco es `recursos`
   --------------------------------
   Un recurso es una cosa que se ocupa —una sala, una camilla—. Una persona
   se ocupa también, pero además cobra, falta y tiene especialidad. Meter
   las dos en la misma tabla obligaba a que la mitad de las columnas
   estuvieran siempre en null.

   La modalidad de pago
   --------------------
   Por hora, por clase, por comisión o sueldo fijo, y por persona. El
   primer negocio paga por hora, pero ninguna de las cuatro puede estar
   escrita en el código: es un sistema que se adapta, no que impone.
   ============================================================ */

create table personal (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  sucursal_id  uuid references sucursales(id) on delete set null,
  /* Opcional a propósito: se trabaja acá sin tener cuenta en el sistema. */
  perfil_id    uuid references perfiles(id) on delete set null,

  nombre       text not null,
  tipo         text not null default 'profesional',
  especialidad text,
  tel          text,
  email        text,

  /* Sobre qué se le paga y cuánto. `valor` es el valor hora, el valor por
     clase o el sueldo según la modalidad: un solo número, porque tres
     columnas donde siempre hay dos vacías se desincronizan solas. */
  modalidad    text not null default 'hora',
  valor        numeric(14,2) not null default 0,
  comision     numeric(5,2)  not null default 0,

  orden        integer not null default 0,
  activo       boolean not null default true,
  campos_extra jsonb   not null default '{}',
  creado_en    timestamptz not null default now(),

  constraint personal_tipo_valido check (tipo in ('profesional', 'recepcion', 'otro')),
  constraint personal_modalidad_valida check (modalidad in ('hora', 'clase', 'comision', 'fijo')),
  constraint personal_nombre_unico unique (empresa_id, nombre)
);

create index on personal (empresa_id, activo);
create index on personal (perfil_id) where perfil_id is not null;

comment on column personal.perfil_id is 'Cuenta del sistema, si la tiene. La mayoría del personal no entra nunca.';
comment on column personal.valor     is 'Valor hora, valor por clase o sueldo, según modalidad.';

/* ------------------------------------------------------------
   Qué hace cada uno

   Sin esto la agenda ofrecería a la esteticista para dar reformer. Es lo
   que después filtra qué profesional aparece al elegir un servicio.
   ------------------------------------------------------------ */
create table personal_servicios (
  personal_id uuid not null references personal(id) on delete cascade,
  item_id     uuid not null references items(id)    on delete cascade,
  empresa_id  uuid not null references empresas(id) on delete cascade,
  primary key (personal_id, item_id)
);

create index on personal_servicios (empresa_id);
create index on personal_servicios (item_id);

/* ------------------------------------------------------------
   Cuándo está

   Una franja semanal: "martes de 8 a 13". Se repite todas las semanas, y
   lo que no se repite son las excepciones, que van en la tabla de abajo.

   La misma tabla sirve para una persona y para una sala: un reformer
   también tiene horario, porque la sala puede estar alquilada los sábados.
   Una fila apunta a una cosa o a la otra, nunca a las dos.

   El día va 0 a 6 con el domingo en 0, igual que `getDay()` del navegador
   y que `extract(dow)` de Postgres. Elegir otra numeración garantizaba un
   error de corrimiento el día que alguien cruzara los dos.
   ------------------------------------------------------------ */
create table horarios (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  personal_id uuid references personal(id) on delete cascade,
  recurso_id  uuid references recursos(id) on delete cascade,

  dia         smallint not null,
  desde       time not null,
  hasta       time not null,
  activo      boolean not null default true,

  constraint horarios_dia_valido   check (dia between 0 and 6),
  constraint horarios_rango_valido check (hasta > desde),
  constraint horarios_dueno_unico  check (num_nonnulls(personal_id, recurso_id) = 1)
);

create index on horarios (empresa_id, dia);
create index on horarios (personal_id) where personal_id is not null;
create index on horarios (recurso_id)  where recurso_id  is not null;

comment on column horarios.dia is '0 domingo a 6 sábado, igual que getDay() y extract(dow).';

/* ------------------------------------------------------------
   Cuándo no está

   Vacaciones, una ausencia, un feriado. Con `personal_id` en null vale
   para todo el comercio, que es lo que hace a un feriado.
   ------------------------------------------------------------ */
create table excepciones (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  personal_id uuid references personal(id) on delete cascade,

  desde       date not null,
  hasta       date not null,
  motivo      text not null default 'ausencia',
  nota        text,
  creado_en   timestamptz not null default now(),

  constraint excepciones_rango_valido check (hasta >= desde),
  constraint excepciones_motivo_valido check (motivo in ('ausencia', 'vacaciones', 'feriado', 'licencia'))
);

create index on excepciones (empresa_id, desde, hasta);

comment on table excepciones is 'Con personal_id en null aplica a todo el comercio: eso es un feriado.';

/* ------------------------------------------------------------
   Quién ve qué

   Lo mismo que el resto: cada comercio lo suyo. Vale recordar que la
   política contesta si podés ver algo, no de qué comercio es — filtrar por
   empresa_id sigue siendo obligación de cada consulta (regla 6).
   ------------------------------------------------------------ */
alter table personal           enable row level security;
alter table personal_servicios enable row level security;
alter table horarios           enable row level security;
alter table excepciones        enable row level security;

create policy personal_todo on personal
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

create policy personal_servicios_todo on personal_servicios
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

create policy horarios_todo on horarios
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

create policy excepciones_todo on excepciones
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ------------------------------------------------------------
   El equipo, ya resuelto

   Las horas semanales y la cantidad de servicios se calculan acá y no en
   la pantalla, por lo mismo que el estado de una mesa: si cada lugar los
   dedujera por su cuenta, un día dejan de coincidir.
   ------------------------------------------------------------ */
/* `security_invoker` no es opcional: sin esa opción una vista corre con
   los permisos de quien la creó y saltea RLS por completo. Acá eso
   significaba que cualquiera con sesión leía el equipo de los otros
   comercios, con los sueldos adentro. Las otras vistas del sistema la
   tienen por lo mismo. */
create or replace view equipo_vista
with (security_invoker = true) as
select
  p.*,
  coalesce(h.horas, 0)     as horas_semana,
  coalesce(h.dias, 0)      as dias_semana,
  coalesce(s.servicios, 0) as servicios,
  (p.perfil_id is not null) as tiene_cuenta
from personal p
left join (
  select personal_id,
         sum(extract(epoch from (hasta - desde)) / 3600)::numeric(6,2) as horas,
         count(distinct dia)                                           as dias
  from horarios where personal_id is not null and activo
  group by personal_id
) h on h.personal_id = p.id
left join (
  select personal_id, count(*) as servicios
  from personal_servicios group by personal_id
) s on s.personal_id = p.id;

comment on view equipo_vista is 'Personal con sus horas semanales y cuántos servicios da, calculado en la base.';
