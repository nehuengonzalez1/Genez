/* ============================================================
   0001 · NÚCLEO DE GENEZ
   ============================================================

   Un solo esquema para todos los rubros. Lo que cambia entre una
   peluquería y un minimercado son los módulos activos, los campos
   extra y qué tipos de operación se usan, no las tablas.

   Dos reglas que atraviesan todo el diseño y que el POS offline
   necesita para funcionar:

     1. Las ventas son hechos, no ediciones. Una operación se crea
        con el id que genera el dispositivo y no se pisa nunca.
     2. El stock no se guarda: se suma. Un número mutable se corrompe
        apenas dos cajas sincronizan tarde.
   ============================================================ */

create extension if not exists "pgcrypto";

/* ============================================================
   EMPRESAS, SUCURSALES Y GENTE
   ============================================================ */

create table empresas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  rubro         text,
  plan          text not null default 'base',
  modulos       text[] not null default '{}',
  config        jsonb  not null default '{}',
  activa        boolean not null default true,
  creada_en     timestamptz not null default now()
);

comment on column empresas.modulos is 'Módulos contratados. Lo que hoy vive hardcodeado en MODULOS.';
comment on column empresas.config  is 'Datos fiscales, medios de pago, listas de precios y ajustes del negocio.';

create table sucursales (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  nombre        text not null,
  domicilio     text,
  activa        boolean not null default true,
  creada_en     timestamptz not null default now()
);

create index on sucursales (empresa_id);

/* Extiende auth.users con lo que Genez necesita saber de la persona.
   El dueño de plataforma no pertenece a ninguna empresa: su empresa_id
   queda en null y es_plataforma lo habilita a entrar a cualquiera. */
create table perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  empresa_id     uuid references empresas(id) on delete cascade,
  nombre         text not null,
  rol            text not null default 'cajero',
  es_plataforma  boolean not null default false,
  activo         boolean not null default true,
  creado_en      timestamptz not null default now()
);

create index on perfiles (empresa_id);

/* ============================================================
   CATÁLOGO · productos y servicios son la misma cosa
   ============================================================ */

create table items (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  tipo            text not null default 'producto',
  nombre          text not null,
  categoria       text,
  marca           text,
  sku             text,
  barcode         text,
  unidad          text not null default 'un',
  costo           numeric(14,2) not null default 0,
  precio          numeric(14,2) not null default 0,
  precios         jsonb not null default '{}',
  iva             numeric(5,2) not null default 21,
  controla_stock  boolean not null default true,
  stock_min       numeric(14,3) not null default 0,
  bulto           numeric(14,3) not null default 1,
  duracion_min    integer,
  proveedor_id    uuid,
  campos_extra    jsonb not null default '{}',
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint items_tipo_valido check (tipo in ('producto', 'servicio', 'insumo', 'combo'))
);

create index on items (empresa_id);
create index on items (empresa_id, barcode) where barcode is not null;
create index on items (empresa_id, categoria);
create unique index on items (empresa_id, sku) where sku is not null;

comment on column items.tipo         is 'Un corte de pelo y una Coca son la misma entidad: cambia si lleva stock y si tiene duración.';
comment on column items.duracion_min is 'Solo para servicios con turno. Null en productos.';
comment on column items.campos_extra is 'Campos que definió el negocio y que el core no conoce.';

/* El costo pasado no se pierde: el motor de diagnóstico compara contra
   esto para detectar subas y caída de margen. */
create table historial_costos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  item_id     uuid not null references items(id) on delete cascade,
  costo       numeric(14,2) not null,
  fecha       timestamptz not null default now(),
  origen      text
);

create index on historial_costos (item_id, fecha desc);

/* ============================================================
   CLIENTES Y PROVEEDORES
   ============================================================ */

create table clientes (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  razon_social  text not null,
  tipo_doc      text,
  doc           text,
  condicion     text not null default 'CF',
  domicilio     text,
  email         text,
  tel           text,
  campos_extra  jsonb not null default '{}',
  activo        boolean not null default true,
  creado_en     timestamptz not null default now()
);

create index on clientes (empresa_id);

create table proveedores (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  nombre          text not null,
  cuit            text,
  tel             text,
  email           text,
  condicion_pago  text,
  dias_entrega    text,
  campos_extra    jsonb not null default '{}',
  activo          boolean not null default true,
  creado_en       timestamptz not null default now()
);

create index on proveedores (empresa_id);

alter table items
  add constraint items_proveedor_fk
  foreign key (proveedor_id) references proveedores(id) on delete set null;

/* ============================================================
   OPERACIONES · venta, presupuesto, pedido, compra, orden de trabajo
   ============================================================

   Todas comparten estructura y se distinguen por tipo y estado. Es lo
   que permite que un presupuesto se convierta en venta, o que la
   gastronomía use comandas, sin tocar el esquema.

   El id lo genera el dispositivo: una venta hecha sin internet ya nace
   con su identidad y se sube tal cual cuando vuelve la conexión.       */

create table operaciones (
  id             uuid primary key,
  empresa_id     uuid not null references empresas(id) on delete cascade,
  sucursal_id    uuid references sucursales(id) on delete set null,
  tipo           text not null,
  estado         text not null default 'confirmada',
  numero         text,
  fecha          timestamptz not null default now(),
  cliente_id     uuid references clientes(id) on delete set null,
  proveedor_id   uuid references proveedores(id) on delete set null,
  usuario_id     uuid references perfiles(id) on delete set null,
  subtotal       numeric(14,2) not null default 0,
  descuento      numeric(14,2) not null default 0,
  recargo        numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  comprobante    jsonb not null default '{}',
  campos_extra   jsonb not null default '{}',
  creada_en      timestamptz not null default now(),
  sincronizada_en timestamptz,
  constraint operaciones_tipo_valido check (
    tipo in ('venta', 'presupuesto', 'pedido', 'compra', 'orden_trabajo', 'devolucion')
  )
);

create index on operaciones (empresa_id, fecha desc);
create index on operaciones (empresa_id, tipo, estado);
create index on operaciones (cliente_id) where cliente_id is not null;

comment on column operaciones.id          is 'Generado en el dispositivo (crypto.randomUUID) para que el POS funcione sin conexión.';
comment on column operaciones.comprobante is 'Datos fiscales cuando se factura: tipo, punto de venta, CAE, vencimiento.';

create table operacion_lineas (
  id               uuid primary key default gen_random_uuid(),
  operacion_id     uuid not null references operaciones(id) on delete cascade,
  empresa_id       uuid not null references empresas(id) on delete cascade,
  item_id          uuid references items(id) on delete set null,
  descripcion      text not null,
  cantidad         numeric(14,3) not null,
  precio_unitario  numeric(14,2) not null default 0,
  costo_unitario   numeric(14,2) not null default 0,
  iva              numeric(5,2) not null default 21,
  descuento        numeric(14,2) not null default 0,
  total            numeric(14,2) not null default 0,
  campos_extra     jsonb not null default '{}'
);

create index on operacion_lineas (operacion_id);
create index on operacion_lineas (empresa_id, item_id);

comment on column operacion_lineas.descripcion    is 'Se copia al vender: si después renombran el item, el ticket viejo no cambia.';
comment on column operacion_lineas.costo_unitario is 'Costo al momento de la venta. Sin esto el margen histórico se recalcula mal.';

/* Una venta puede cobrarse con más de un medio. */
create table pagos (
  id            uuid primary key default gen_random_uuid(),
  operacion_id  uuid not null references operaciones(id) on delete cascade,
  empresa_id    uuid not null references empresas(id) on delete cascade,
  medio         text not null,
  monto         numeric(14,2) not null,
  recargo       numeric(14,2) not null default 0,
  referencia    text,
  fecha         timestamptz not null default now()
);

create index on pagos (operacion_id);
create index on pagos (empresa_id, fecha desc);

/* ============================================================
   STOCK · un libro de movimientos, no un número
   ============================================================ */

create table movimientos_stock (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  sucursal_id   uuid references sucursales(id) on delete set null,
  item_id       uuid not null references items(id) on delete cascade,
  cantidad      numeric(14,3) not null,
  tipo          text not null,
  operacion_id  uuid references operaciones(id) on delete set null,
  usuario_id    uuid references perfiles(id) on delete set null,
  motivo        text,
  vence         date,
  fecha         timestamptz not null default now(),
  constraint movimientos_stock_tipo_valido check (
    tipo in ('venta', 'compra', 'ajuste', 'merma', 'devolucion', 'transferencia', 'inicial')
  )
);

create index on movimientos_stock (empresa_id, item_id);
create index on movimientos_stock (empresa_id, fecha desc);
create index on movimientos_stock (operacion_id) where operacion_id is not null;

comment on column movimientos_stock.cantidad is 'Con signo: negativo sale, positivo entra.';

create view stock_actual
with (security_invoker = true) as
  select
    empresa_id,
    sucursal_id,
    item_id,
    sum(cantidad) as stock,
    max(fecha)    as ultimo_movimiento
  from movimientos_stock
  group by empresa_id, sucursal_id, item_id;

/* ============================================================
   CAJA
   ============================================================ */

create table sesiones_caja (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references empresas(id) on delete cascade,
  sucursal_id       uuid references sucursales(id) on delete set null,
  abierta_en        timestamptz not null default now(),
  cerrada_en        timestamptz,
  monto_inicial     numeric(14,2) not null default 0,
  monto_declarado   numeric(14,2),
  abierta_por       uuid references perfiles(id) on delete set null,
  cerrada_por       uuid references perfiles(id) on delete set null,
  notas             text
);

create index on sesiones_caja (empresa_id, abierta_en desc);

create table movimientos_caja (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  sucursal_id   uuid references sucursales(id) on delete set null,
  sesion_id     uuid references sesiones_caja(id) on delete set null,
  tipo          text not null,
  medio         text not null default 'efectivo',
  monto         numeric(14,2) not null,
  detalle       text,
  categoria     text,
  operacion_id  uuid references operaciones(id) on delete set null,
  usuario_id    uuid references perfiles(id) on delete set null,
  fecha         timestamptz not null default now(),
  constraint movimientos_caja_tipo_valido check (tipo in ('ingreso', 'egreso'))
);

create index on movimientos_caja (empresa_id, fecha desc);
create index on movimientos_caja (sesion_id) where sesion_id is not null;

/* ============================================================
   ACTUALIZACIÓN AUTOMÁTICA DE actualizado_en
   ============================================================ */

create or replace function tocar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

create trigger items_actualizado_en
  before update on items
  for each row execute function tocar_actualizado_en();
