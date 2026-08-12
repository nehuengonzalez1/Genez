/* ============================================================
   0007 · BITÁCORA Y CAJA OBLIGATORIA
   ============================================================

   Un sistema que va a manejar la plata de una empresa con sucursales y
   empleados tiene que poder contestar quién hizo qué. Hoy queda el
   efecto de cada acto —el precio nuevo, la caja cerrada— pero no el acto.

   La bitácora la escriben disparadores y no las pantallas. Si dependiera
   de que cada pantalla se acuerde de registrar, alcanzaría con una que se
   olvide para que el registro deje de servir como registro. Y el que
   quiera esconder algo va a usar justamente esa.

   Solo se puede insertar y leer: no hay política de modificación ni de
   borrado. Una bitácora que se puede editar no prueba nada.
   ============================================================ */

create table bitacora (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  usuario_id  uuid references perfiles(id) on delete set null,
  accion      text not null,
  entidad     text,
  entidad_id  uuid,
  detalle     jsonb not null default '{}'::jsonb,
  fecha       timestamptz not null default now()
);

create index on bitacora (empresa_id, fecha desc);
create index on bitacora (empresa_id, accion, fecha desc);

alter table bitacora enable row level security;

/* Leer la bitácora es ver lo que hicieron los demás: queda para quien
   maneja el negocio, no para cualquier usuario del comercio. */
create policy bitacora_leer on bitacora
  for select using (
    public.puede_ver(empresa_id)
    and (
      public.es_plataforma()
      or exists (
        select 1 from perfiles p
        where p.id = auth.uid() and p.rol in ('dueno', 'encargado')
      )
    )
  );

create policy bitacora_escribir on bitacora
  for insert with check (public.puede_ver(empresa_id));

comment on table bitacora is
  'Qué se hizo, quién y cuándo. Solo admite inserción y lectura: no se corrige ni se borra.';

/* ------------------------------------------------------------
   Los actos que se registran
   ------------------------------------------------------------ */

create or replace function anotar_en_bitacora()
returns trigger
language plpgsql
as $$
declare
  v_accion  text;
  v_detalle jsonb := '{}'::jsonb;
  v_empresa uuid;
  v_id      uuid;
begin
  if tg_table_name = 'sesiones_caja' then
    v_empresa := new.empresa_id;
    v_id := new.id;
    if tg_op = 'INSERT' then
      v_accion := 'caja.abrir';
      v_detalle := jsonb_build_object('monto_inicial', new.monto_inicial);
    elsif old.cerrada_en is null and new.cerrada_en is not null then
      v_accion := 'caja.cerrar';
      v_detalle := jsonb_build_object(
        'monto_inicial',   new.monto_inicial,
        'monto_declarado', new.monto_declarado,
        'notas',           new.notas
      );
    else
      return new;
    end if;

  elsif tg_table_name = 'items' then
    v_empresa := new.empresa_id;
    v_id := new.id;
    if new.precio is distinct from old.precio and new.costo is distinct from old.costo then
      v_accion := 'item.precio_y_costo';
    elsif new.precio is distinct from old.precio then
      v_accion := 'item.precio';
    elsif new.costo is distinct from old.costo then
      v_accion := 'item.costo';
    elsif new.activo is distinct from old.activo then
      v_accion := case when new.activo then 'item.activar' else 'item.desactivar' end;
    else
      return new;
    end if;
    v_detalle := jsonb_build_object(
      'nombre',      new.nombre,
      'precio_antes', old.precio, 'precio_ahora', new.precio,
      'costo_antes',  old.costo,  'costo_ahora',  new.costo
    );

  elsif tg_table_name = 'movimientos_caja' then
    /* Las ventas ya quedan registradas como operaciones: anotarlas de
       nuevo llenaría la bitácora de ruido y taparía lo que importa.
       Lo que se anota es la plata que alguien movió a mano. */
    if new.operacion_id is not null then return new; end if;
    v_empresa := new.empresa_id;
    v_id := new.id;
    v_accion := 'caja.' || new.tipo;
    v_detalle := jsonb_build_object(
      'monto', new.monto, 'medio', new.medio,
      'detalle', new.detalle, 'categoria', new.categoria
    );

  else
    return new;
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
    values (v_empresa, auth.uid(), v_accion, tg_table_name, v_id, v_detalle);

  return new;
end;
$$;

create trigger sesiones_caja_bitacora
  after insert or update on sesiones_caja
  for each row execute function anotar_en_bitacora();

create trigger items_bitacora
  after update on items
  for each row execute function anotar_en_bitacora();

create trigger movimientos_caja_bitacora
  after insert on movimientos_caja
  for each row execute function anotar_en_bitacora();

/* ============================================================
   NO SE COBRA SIN CAJA ABIERTA

   Sin sesión, los movimientos de una venta quedan fuera de todo arqueo:
   plata que entró y que ningún cierre ve. Se exige acá y no solo en la
   pantalla porque la regla tiene que valer también para lo que llegue
   desde la cola de ventas pendientes, o desde cualquier equipo que se
   conecte más adelante.
   ============================================================ */

create or replace function registrar_venta(venta jsonb)
returns uuid
language plpgsql
as $$
declare
  v_id        uuid := (venta->>'id')::uuid;
  v_empresa   uuid := (venta->>'empresa_id')::uuid;
  v_sucursal  uuid := nullif(venta->>'sucursal_id', '')::uuid;
  v_sesion    uuid := nullif(venta->>'sesion_id', '')::uuid;
  v_numero    text := venta->>'numero';
  v_fecha     timestamptz := coalesce((venta->>'fecha')::timestamptz, now());
  v_nueva     boolean;
begin
  if v_id is null or v_empresa is null then
    raise exception 'La venta necesita id y empresa_id.';
  end if;

  if v_sesion is null then
    raise exception 'No hay una caja abierta para registrar esta venta.'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from sesiones_caja
    where id = v_sesion and empresa_id = v_empresa and cerrada_en is null
  ) then
    raise exception 'La caja de esta venta ya fue cerrada.'
      using errcode = 'P0002';
  end if;

  insert into operaciones (
    id, empresa_id, sucursal_id, tipo, estado, numero, fecha,
    cliente_id, usuario_id, subtotal, descuento, recargo, total,
    comprobante, campos_extra, sincronizada_en
  ) values (
    v_id, v_empresa, v_sucursal, 'venta', 'confirmada', v_numero, v_fecha,
    nullif(venta->>'cliente_id', '')::uuid,
    auth.uid(),
    coalesce((venta->>'subtotal')::numeric, 0),
    coalesce((venta->>'descuento')::numeric, 0),
    coalesce((venta->>'recargo')::numeric, 0),
    coalesce((venta->>'total')::numeric, 0),
    coalesce(venta->'comprobante', '{}'::jsonb),
    coalesce(venta->'campos_extra', '{}'::jsonb),
    now()
  )
  on conflict (id) do nothing
  returning true into v_nueva;

  if v_nueva is null then
    return v_id;
  end if;

  insert into operacion_lineas (
    operacion_id, empresa_id, item_id, descripcion, cantidad,
    precio_unitario, costo_unitario, iva, descuento, total
  )
  select
    v_id, v_empresa,
    nullif(l->>'item_id', '')::uuid,
    l->>'descripcion',
    (l->>'cantidad')::numeric,
    coalesce((l->>'precio_unitario')::numeric, 0),
    coalesce((l->>'costo_unitario')::numeric, 0),
    coalesce((l->>'iva')::numeric, 21),
    coalesce((l->>'descuento')::numeric, 0),
    coalesce((l->>'total')::numeric, 0)
  from jsonb_array_elements(coalesce(venta->'lineas', '[]'::jsonb)) as l;

  insert into pagos (operacion_id, empresa_id, medio, monto, recargo, referencia, fecha)
  select
    v_id, v_empresa,
    p->>'medio',
    (p->>'monto')::numeric,
    coalesce((p->>'recargo')::numeric, 0),
    nullif(p->>'referencia', ''),
    v_fecha
  from jsonb_array_elements(coalesce(venta->'pagos', '[]'::jsonb)) as p;

  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, operacion_id, usuario_id, fecha)
  select
    v_empresa, v_sucursal, i.id,
    -(l->>'cantidad')::numeric,
    'venta', v_id, auth.uid(), v_fecha
  from jsonb_array_elements(coalesce(venta->'lineas', '[]'::jsonb)) as l
  join items i on i.id = nullif(l->>'item_id', '')::uuid
  where i.controla_stock;

  insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, operacion_id, usuario_id, fecha)
  select
    v_empresa, v_sucursal, v_sesion,
    'ingreso',
    p->>'medio',
    (p->>'monto')::numeric,
    'Venta ' || coalesce(v_numero, ''),
    v_id, auth.uid(), v_fecha
  from jsonb_array_elements(coalesce(venta->'pagos', '[]'::jsonb)) as p;

  return v_id;
end;
$$;
