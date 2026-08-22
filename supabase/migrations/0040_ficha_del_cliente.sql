/* ============================================================
   0040 · LA FICHA DEL CLIENTE
   ============================================================

   En una estética la ficha es la mitad del valor del sistema: importa qué
   se le hizo, cuándo, con qué, y si hay algo que no se le puede hacer.

   Casi todo estaba: los turnos, los abonos y las ventas ya apuntan al
   cliente. Faltaban dos cosas.

   EL CUADERNO
   -----------
   Una nota fechada y firmada, no un campo de texto que se pisa. "Alérgica
   al ácido glicólico" y "prefiere a Carla" son dos cosas distintas de una
   misma persona, escritas en momentos distintos por gente distinta, y
   aplastarlas en un solo campo pierde las dos.

   Una nota puede ir **destacada**: eso la saca de la ficha y la pone
   delante de quien esté por atenderla. Es para lo que no se puede
   descubrir tarde —una alergia, una contraindicación— y por eso no es un
   tipo más de nota sino una marca aparte.

   LAS CUENTAS
   -----------
   Cuántas veces vino, cuántas faltó, cuándo fue la última y cuánto gastó.
   Se calculan en la vista y no en la pantalla, por lo mismo que el estado
   de una mesa: si cada lugar las dedujera por su cuenta, un día dejan de
   coincidir.
   ============================================================ */

create table cliente_notas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  cliente_id  uuid not null references clientes(id) on delete cascade,

  texto       text not null,
  /* Delante de los ojos de quien la atienda, no adentro de una pestaña. */
  destacada   boolean not null default false,

  creada_en   timestamptz not null default now(),
  usuario_id  uuid references perfiles(id) on delete set null
);

create index on cliente_notas (cliente_id, creada_en desc);
create index on cliente_notas (empresa_id) where destacada;

comment on column cliente_notas.destacada is
  'Lo que no se puede descubrir tarde: una alergia, una contraindicación. Se muestra al agendar, no adentro de la ficha.';

alter table cliente_notas enable row level security;

create policy cliente_notas_todo on cliente_notas
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

/* ------------------------------------------------------------
   El cliente, con sus cuentas hechas

   Los turnos se cuentan sin las clases: una clase no tiene cliente, y sus
   inscripciones sí, así que contar las dos duplicaría.
   ------------------------------------------------------------ */

create or replace view clientes_vista
with (security_invoker = true) as
select
  c.*,
  coalesce(t.turnos, 0)     as turnos,
  coalesce(t.asistio, 0)    as asistio,
  coalesce(t.ausencias, 0)  as ausencias,
  coalesce(t.cancelados, 0) as cancelados,
  t.ultima,
  t.proxima,
  /* Sobre los turnos que ya pasaron: contra los futuros no hay asistencia
     que medir todavía, y meterlos hunde el porcentaje sin motivo. */
  case when coalesce(t.asistio, 0) + coalesce(t.ausencias, 0) = 0 then null
       else t.asistio::numeric / (t.asistio + t.ausencias)
  end as asistencia,

  coalesce(v.gastado, 0)  as gastado,
  coalesce(v.compras, 0)  as compras,
  coalesce(a.abonos, 0)   as abonos_activos,
  coalesce(n.notas, 0)    as notas,
  coalesce(n.alertas, 0)  as alertas
from clientes c
left join lateral (
  select
    count(*)                                            as turnos,
    count(*) filter (where r.estado = 'cumplida')       as asistio,
    count(*) filter (where r.estado = 'ausente')        as ausencias,
    count(*) filter (where r.estado = 'cancelada')      as cancelados,
    max(r.desde) filter (where r.desde < now() and r.estado <> 'cancelada') as ultima,
    min(r.desde) filter (where r.desde >= now() and r.estado not in ('cancelada', 'ausente')) as proxima
  from reservas r
  where r.cliente_id = c.id and r.cupo is null
) t on true
left join lateral (
  select sum(o.total) as gastado, count(*) as compras
  from operaciones o
  where o.cliente_id = c.id and o.estado = 'confirmada'
) v on true
left join lateral (
  select count(*) as abonos
  from abonos_vista av
  where av.cliente_id = c.id and av.estado = 'activo'
) a on true
left join lateral (
  select count(*) as notas, count(*) filter (where destacada) as alertas
  from cliente_notas cn
  where cn.cliente_id = c.id
) n on true;

comment on view clientes_vista is
  'El cliente con sus cuentas hechas: cuántas veces vino, cuántas faltó, cuándo fue la última y cuánto gastó. Se calculan acá y no en la pantalla para que la lista y la ficha no puedan discrepar.';
