/* ============================================================
   0101 · VARIAS CAJAS ABIERTAS A LA VEZ
   ============================================================

   Hasta acá un comercio tenía una sola caja: abrirla desde otra
   computadora devolvía la sesión que ya estaba abierta, y las dos cajas
   cobraban sobre el mismo arqueo. Con dos mostradores, al cerrar nadie
   sabía qué plata era de qué cajón.

   La regla nunca estuvo en la base: la aplicaba `sesionAbierta` en
   src/datos/caja.js. Las funciones que cobran, devuelven, fían y cierran
   ya reciben la sesión como dato (0007, 0023, 0085, 0089, 0092, 0095),
   así que el cambio es darle a cada sesión su caja:

   - `cajas`: las de cada comercio, con nombre ("Caja 1", "Mostrador").
   - `sesiones_caja.caja_id`, y un índice que deja UNA sesión abierta por
     caja. Dos cajas distintas sí pueden estar abiertas a la vez.
   - Cada computadora elige una vez qué caja es y lo guarda en su
     navegador (src/datos/caja.js). Con una sola caja no se pregunta.

   Lo que ya existía no cambia: cada comercio arranca con su "Caja 1" y
   todas sus sesiones pasan a ser de ella.

   Sin límite de cajas por ahora: se decide con los precios.
   ============================================================ */

create table cajas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  sucursal_id uuid references sucursales(id) on delete set null,
  nombre      text not null check (length(btrim(nombre)) between 1 and 40),
  orden       integer not null default 0,
  activa      boolean not null default true,
  creada_en   timestamptz not null default now(),
  unique (empresa_id, nombre)
);

comment on table cajas is
  'Las cajas (mostradores) de cada comercio. Cada sesión de caja es de una. Ver 0101.';

create index on cajas (empresa_id, orden);

alter table cajas enable row level security;

create policy cajas_ver on cajas
  for select using (public.puede_ver(empresa_id));
/* Crearlas y renombrarlas es configurar el comercio, como los roles. No
   se borran: una caja con sesiones es historia; se desactiva. */
create policy cajas_crear on cajas
  for insert with check (public.puede_ver(empresa_id) and public.permiso('configurar'));
create policy cajas_editar on cajas
  for update using (public.puede_ver(empresa_id) and public.permiso('configurar'));


/* Cada comercio arranca con la suya, y lo que ya había es de ella. */
insert into cajas (empresa_id, nombre)
select id, 'Caja 1' from empresas;

alter table sesiones_caja add column caja_id uuid references cajas(id);

update sesiones_caja s
   set caja_id = c.id
  from cajas c
 where c.empresa_id = s.empresa_id and c.nombre = 'Caja 1';

/* Un comercio nuevo también arranca con su "Caja 1". */
create or replace function crear_primera_caja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into cajas (empresa_id, nombre) values (new.id, 'Caja 1');
  return new;
end;
$$;

create trigger crear_primera_caja
  after insert on empresas
  for each row execute function crear_primera_caja();

/* Una sesión sin caja va a la primera del comercio. Es lo que hace que
   esta migración se pueda aplicar ANTES de desplegar la aplicación nueva:
   la de hoy abre la caja sin decir cuál, y tiene que seguir andando. */
create or replace function sesion_con_su_caja()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.caja_id is null then
    select id into new.caja_id from cajas
     where empresa_id = new.empresa_id and activa
     order by orden, creada_en limit 1;
  end if;
  if new.caja_id is null then
    raise exception 'El comercio no tiene ninguna caja activa.';
  end if;
  if not exists (select 1 from cajas where id = new.caja_id and empresa_id = new.empresa_id) then
    raise exception 'Esa caja no es de este comercio.';
  end if;
  return new;
end;
$$;

create trigger sesion_con_su_caja
  before insert on sesiones_caja
  for each row execute function sesion_con_su_caja();

alter table sesiones_caja alter column caja_id set not null;

/* El candado: una sesión abierta por caja. Antes no había ninguno, y dos
   equipos que abrían a la vez podían crear dos sesiones. */
create unique index sesiones_caja_una_abierta_por_caja
  on sesiones_caja (caja_id) where cerrada_en is null;

create index on sesiones_caja (caja_id, cerrada_en desc);
