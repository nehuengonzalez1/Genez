/* ============================================================
   0009 · COMANDAS Y RECURSOS
   ============================================================

   El segundo comportamiento de venta. El primero —cobro directo— abre y
   cierra la operación en el mostrador en segundos. Este la deja abierta:
   se ocupa una mesa, se van sumando cosas durante una hora, pasan por
   cocina, y recién al final se cobra.

   Dos decisiones que valen más que el resto:

   Una comanda NO es una tabla nueva. Es una `operacion` con tipo
   'comanda' y estado 'abierta'. Así hereda todo lo que ya funciona:
   caja obligatoria, bitácora, cola sin conexión, numeración, descuento
   de stock. Un arreglo en el cobro arregla también la gastronomía.

   La mesa NO es una tabla de mesas. Lo que gastronomía llama mesa,
   hotelería llama habitación, una peluquería sillón y un taller bahía:
   todos son un recurso que se ocupa, acumula consumos mientras está
   ocupado y se libera al cobrar. Modelarlo como `mesas` obligaría a
   escribir `habitaciones` de nuevo dentro de seis meses.
   ============================================================ */

create table recursos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  sucursal_id  uuid references sucursales(id) on delete set null,
  tipo         text not null default 'mesa',
  nombre       text not null,
  sector       text,
  capacidad    integer,
  orden        integer not null default 0,
  activo       boolean not null default true,
  campos_extra jsonb not null default '{}'::jsonb,
  creado_en    timestamptz not null default now(),

  constraint recursos_tipo_valido check (
    tipo in ('mesa', 'habitacion', 'sillon', 'bahia', 'cancha', 'otro')
  ),
  constraint recursos_nombre_unico unique (empresa_id, sucursal_id, nombre)
);

create index on recursos (empresa_id, tipo, orden);

alter table recursos enable row level security;

create policy recursos_todo on recursos
  for all using (public.puede_ver(empresa_id)) with check (public.puede_ver(empresa_id));

comment on table recursos is
  'Lo que se ocupa mientras se consume: mesa, habitación, sillón, bahía. Un solo modelo para todos los rubros.';

/* ------------------------------------------------------------
   La operación abierta
   ------------------------------------------------------------ */

alter table operaciones drop constraint operaciones_tipo_valido;

alter table operaciones add constraint operaciones_tipo_valido check (
  tipo in ('venta', 'comanda', 'presupuesto', 'pedido', 'compra', 'orden_trabajo', 'devolucion')
);

alter table operaciones add column recurso_id uuid references recursos(id) on delete set null;
alter table operaciones add column abierta_en timestamptz;
alter table operaciones add column cerrada_en timestamptz;

/* Un recurso no puede estar ocupado por dos comandas a la vez: si pasara,
   los consumos de una mesa terminarían en la cuenta de la otra. */
create unique index operaciones_recurso_ocupado
  on operaciones (recurso_id)
  where recurso_id is not null and estado = 'abierta';

create index on operaciones (empresa_id, estado, tipo);

/* ------------------------------------------------------------
   La línea que pasa por cocina

   Los estados existen siempre, pero solo se usan si el comercio activó
   la pantalla de cocina. Sin ella la comanda se imprime y el mozo se
   maneja con el papel: la línea nace y muere en 'pedido', y nada de esto
   estorba.
   ------------------------------------------------------------ */

alter table operacion_lineas add column estado text not null default 'pedido';
alter table operacion_lineas add column notas text;
alter table operacion_lineas add column modificadores jsonb not null default '[]'::jsonb;
alter table operacion_lineas add column enviada_en timestamptz;
alter table operacion_lineas add column lista_en timestamptz;
alter table operacion_lineas add column destino text;

alter table operacion_lineas add constraint lineas_estado_valido check (
  estado in ('pedido', 'preparando', 'listo', 'entregado', 'anulada')
);

create index on operacion_lineas (empresa_id, estado) where estado <> 'entregado';

comment on column operacion_lineas.modificadores is
  'Cómo se pidió esta vez: sin cebolla, extra queso. Van en la línea y no en el item porque el mismo plato se pide distinto cada vez.';

comment on column operacion_lineas.destino is
  'A qué sector va: cocina, barra, plancha. Permite separar la pantalla de cocina de la de tragos.';

/* ------------------------------------------------------------
   Abrir y cerrar la comanda
   ------------------------------------------------------------ */

create or replace function abrir_comanda(datos jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id      uuid := coalesce(nullif(datos->>'id', '')::uuid, gen_random_uuid());
  v_empresa uuid := (datos->>'empresa_id')::uuid;
  v_recurso uuid := nullif(datos->>'recurso_id', '')::uuid;
  v_abierta uuid;
begin
  if v_empresa is null then
    raise exception 'La comanda necesita empresa_id.';
  end if;

  /* Si el recurso ya tiene una comanda abierta se devuelve esa. Tocar dos
     veces la misma mesa es lo más normal del mundo y no puede terminar en
     dos cuentas paralelas. */
  if v_recurso is not null then
    select id into v_abierta from operaciones
    where recurso_id = v_recurso and estado = 'abierta' and empresa_id = v_empresa;
    if v_abierta is not null then return v_abierta; end if;
  end if;

  insert into operaciones (
    id, empresa_id, sucursal_id, tipo, estado, fecha, recurso_id,
    abierta_en, usuario_id, cliente_id, campos_extra
  ) values (
    v_id, v_empresa,
    nullif(datos->>'sucursal_id', '')::uuid,
    'comanda', 'abierta', now(), v_recurso,
    now(), auth.uid(),
    nullif(datos->>'cliente_id', '')::uuid,
    coalesce(datos->'campos_extra', '{}'::jsonb)
  )
  on conflict (id) do nothing;

  return v_id;
end;
$$;

comment on function abrir_comanda is
  'Ocupa un recurso. Si ya estaba ocupado devuelve la comanda existente en vez de abrir otra.';

/* La comanda no se cobra por su cuenta: se convierte en venta y entra por
   registrar_venta, que es donde ya viven el descuento de stock, los
   movimientos de caja y la exigencia de caja abierta. Duplicar eso acá
   seria tener dos caminos que se van a ir separando con el tiempo. */
create or replace function cerrar_comanda(comanda_id uuid)
returns void
language plpgsql
as $$
begin
  update operaciones
     set estado = 'confirmada', cerrada_en = now()
   where id = comanda_id and tipo = 'comanda' and estado = 'abierta';

  if not found then
    raise exception 'Esa comanda no está abierta.' using errcode = 'P0003';
  end if;
end;
$$;
