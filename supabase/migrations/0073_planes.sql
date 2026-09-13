/* ============================================================
   0073 · LOS PLANES Y LOS PRECIOS SON DATO
   ============================================================

   El alta guiada termina en "lo que vas a pagar para empezar", y hasta
   acá el sistema no tenía ninguna noción de precio: `empresas.plan` es un
   texto suelto y los módulos se contratan sin costo asociado.

   Misma regla que el menú, los roles y las reglas de reserva: el precio
   vive en una fila y lo edita la plataforma desde su panel, no desde el
   código. Sin filas, el alta guiada dice "precio a confirmar" y nunca un
   número inventado; por eso esta migración no siembra nada.

   QUÉ ES UN PLAN
   --------------
   Un nombre, un precio mensual, los módulos que incluye y —si aplica—
   a qué rubros se ofrece (vacío es todos). El alta guiada elige el plan
   más barato que cubra los módulos que la persona necesita; si ninguno
   los cubre, muestra el que más se acerca y qué le falta.

   `puesta_en_marcha` es lo que se cobra una sola vez al arrancar (carga
   del catálogo, capacitación). Cero si no se cobra.

   QUIÉN LEE Y QUIÉN ESCRIBE
   -------------------------
   Escribe la plataforma (`es_plataforma()`). Lee cualquiera con sesión,
   y sin sesión `planes_publicos()`: security definer y angosta, mismo
   criterio que `rubros_publicos` y `marca_de`.
   ============================================================ */

create table planes (
  clave             text primary key,
  nombre            text not null,
  bajada            text,
  precio_mensual    numeric(14,2),
  moneda            text not null default 'ARS',
  puesta_en_marcha  numeric(14,2) not null default 0,
  modulos           text[] not null default '{}',
  rubros            text[] not null default '{}',
  orden             integer not null default 0,
  activo            boolean not null default true,
  actualizado_en    timestamptz not null default now()
);

comment on table planes is
  'Lo que se ofrece y cuánto cuesta. precio_mensual en null = a confirmar. rubros vacío = se ofrece a todos.';

alter table planes enable row level security;

create policy planes_leer on planes
  for select to authenticated using (true);

create policy planes_escribir on planes
  for all to authenticated
  using (public.es_plataforma()) with check (public.es_plataforma());

create or replace function planes_publicos()
returns table (
  clave text, nombre text, bajada text, precio_mensual numeric, moneda text,
  puesta_en_marcha numeric, modulos text[], rubros text[], orden integer
)
language sql
stable
security definer
set search_path = public
as $$
  select p.clave, p.nombre, p.bajada, p.precio_mensual, p.moneda,
         p.puesta_en_marcha, p.modulos, p.rubros, p.orden
  from planes p
  where p.activo
  order by p.orden, p.precio_mensual nulls last;
$$;

grant execute on function planes_publicos() to anon, authenticated;

comment on function planes_publicos() is
  'Los planes activos, sin sesión, para el alta guiada. Solo lo que se muestra.';
