/* ============================================================
   0102 · PROMOCIONES
   ============================================================

   Hasta acá, lo único parecido a una promo eran las listas por cantidad
   ("desde 3 unidades, $X") y el descuento a mano. Lo que un almacén pone
   en la góndola es otra cosa: 2x1, 3x2, "la segunda al 50%", "3 por
   $1.000", "20% en Limpieza los miércoles".

   Cuatro clases, en `parametros`:
     nxm         { lleva: 3, paga: 2 }      llevá 3, pagá 2 (el más barato va gratis)
     segunda     { pct: 50 }                cada segunda unidad, al X% menos
     porcentaje  { pct: 20 }                X% menos en todo lo que abarca
     pack        { cantidad: 3, precio: 1000 }  N unidades por $P

   Qué abarca, en `alcance`: productos sueltos (ids) y/o rubros enteros.
   Con varios productos, se pueden mezclar: un 3x2 de gaseosas vale con
   una Coca, una Sprite y una Fanta.

   Cuándo: `desde`/`hasta` (fechas, opcionales) y `dias` (0 = domingo …
   6 = sábado; vacío = todos).

   La cuenta la hace el mostrador (src/utils/promociones.js), porque se
   cobra sin internet y el ticket sale en el momento. Lo que se cobró va
   en cada renglón como descuento, que es lo que ya leen el IVA y los
   informes, y el detalle de qué promo fue, en operaciones.campos_extra:
   registrar_venta ya lo guarda (0010), así que no se tocó el cobro.
   ============================================================ */

create table promociones (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nombre      text not null check (length(btrim(nombre)) between 1 and 60),
  tipo        text not null check (tipo in ('nxm', 'segunda', 'porcentaje', 'pack')),
  parametros  jsonb not null default '{}',
  alcance     jsonb not null default '{"productos": [], "rubros": []}',
  desde       date,
  hasta       date,
  dias        smallint[] not null default '{}',
  activa      boolean not null default true,
  creada_en   timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  constraint promociones_fechas check (desde is null or hasta is null or desde <= hasta),
  constraint promociones_dias check (dias <@ array[0,1,2,3,4,5,6]::smallint[]),
  /* Los números de cada clase, en la base: una promo mal cargada se
     cobraría mal en todas las cajas a la vez. */
  constraint promociones_parametros check (
    case tipo
      when 'nxm' then (parametros->>'lleva')::int >= 2 and (parametros->>'paga')::int >= 1
                      and (parametros->>'paga')::int < (parametros->>'lleva')::int
      when 'segunda' then (parametros->>'pct')::numeric > 0 and (parametros->>'pct')::numeric <= 100
      when 'porcentaje' then (parametros->>'pct')::numeric > 0 and (parametros->>'pct')::numeric < 100
      when 'pack' then (parametros->>'cantidad')::int >= 2 and (parametros->>'precio')::numeric > 0
    end
  )
);

comment on table promociones is
  'Las promos de cada comercio (2x1, segunda al X%, porcentaje, N por $P). La cuenta la hace el mostrador: src/utils/promociones.js. Ver 0102.';

create index on promociones (empresa_id) where activa;

alter table promociones enable row level security;

create policy promociones_ver on promociones
  for select using (public.puede_ver(empresa_id));
/* Cargarlas es poner precios: el mismo permiso que editar el precio de
   un producto. No se borran desde la aplicación: se apagan, así el
   detalle guardado en las ventas sigue apuntando a algo. */
create policy promociones_crear on promociones
  for insert with check (public.puede_ver(empresa_id) and public.permiso('cambiarPrecios'));
create policy promociones_editar on promociones
  for update using (public.puede_ver(empresa_id) and public.permiso('cambiarPrecios'));
