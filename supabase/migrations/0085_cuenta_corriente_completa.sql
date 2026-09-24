/* ============================================================
   0085 · LA CUENTA CORRIENTE, ENTERA
   ============================================================

   0075 dejó el fiado andando de punta a punta —vender, ver el saldo,
   cobrar— pero sin vuelta atrás: un pago mal cargado no se podía anular,
   una deuda no se podía corregir, y no había dónde ver quién debe. Super
   25 da fiado a mucha gente y lo necesita registrado, cancelable y
   corregible. Esto completa lo que faltaba sin cambiar el modelo:

   - El saldo se sigue calculando, no se guarda (misma regla que el
     stock). Ahora es: lo vendido a cuenta corriente, más los cargos
     manuales, menos los descuentos manuales, menos los pagos. Lo anulado
     no cuenta.
   - Nada se borra. Anular un pago o un ajuste lo marca, con quién, cuándo
     y por qué, y deja su rastro en la bitácora. Si el pago había entrado
     a la caja, la anulación la saca con un egreso: la caja tiene que
     explicar el cierre.
   - Anular y ajustar lo pueden hacer quienes tengan `ajustarCuentas`:
     de fábrica, dueño y encargado. Lo verifica la base, no la pantalla.

   LO QUE QUEDA EN LA PANTALLA, A PROPÓSITO
   ----------------------------------------
   El permiso de fiar (`fiar`) y el límite de crédito se controlan al
   cobrar y no acá. La venta puede haberse hecho sin internet y llegar a
   la base una hora después: si la base la rechazara por el límite, la
   mercadería ya salió del local y la venta quedaría trabada en la cola
   del equipo. El límite existe para que el cajero no fíe de más en el
   momento, y es en ese momento donde se lo muestra.
   ============================================================ */


/* ------------------------------------------------------------
   1 · El límite de crédito
   ------------------------------------------------------------ */

alter table clientes
  add column limite_credito numeric(14,2)
    check (limite_credito is null or limite_credito >= 0);

comment on column clientes.limite_credito is
  'Hasta cuánto se le puede fiar. Null: sin límite. Lo cambia solo quien tiene ajustarCuentas.';

/* La política de clientes deja que cualquiera del comercio edite la
   ficha —el teléfono, el domicilio— y está bien. El límite no: un cajero
   que se lo sube a un conocido se saltea el único control que tiene el
   fiado. Se mira el cambio, no la fila: por eso es un disparador y no
   una política. Sin sesión (scripts, service_role) pasa. */
create or replace function public.cuidar_limite_credito()
returns trigger
language plpgsql
as $$
begin
  if new.limite_credito is distinct from old.limite_credito
     and auth.uid() is not null
     and not public.permiso('ajustarCuentas') then
    raise exception 'Cambiar el límite de crédito necesita el permiso de ajustar cuentas corrientes.'
      using errcode = 'P0040';
  end if;
  return new;
end;
$$;

create trigger cuidar_limite_credito
  before update of limite_credito on clientes
  for each row execute function public.cuidar_limite_credito();

/* Al dar de alta un cliente con límite, la misma regla. */
create or replace function public.cuidar_limite_credito_alta()
returns trigger
language plpgsql
as $$
begin
  if new.limite_credito is not null
     and auth.uid() is not null
     and not public.permiso('ajustarCuentas') then
    raise exception 'Poner un límite de crédito necesita el permiso de ajustar cuentas corrientes.'
      using errcode = 'P0040';
  end if;
  return new;
end;
$$;

create trigger cuidar_limite_credito_alta
  before insert on clientes
  for each row execute function public.cuidar_limite_credito_alta();


/* ------------------------------------------------------------
   2 · Un fiado siempre tiene a quién
   ------------------------------------------------------------
   El cobro ya lo exigía, pero no era el único camino: un presupuesto
   convertido en venta o una comanda podían dejar una deuda sin cliente,
   que no aparece en ningún saldo y nadie cobra nunca.

   Y en una comanda abierta, el pago parcial (`registrar_pago`) mete en la
   caja lo que se le pase, así que un "fiado" de media cuenta entraba como
   plata cobrada. El fiado de una comanda se carga al cerrarla, con el
   cliente elegido: `cerrar_comanda` confirma la operación antes de
   escribir los pagos, así que acá se distingue de un pago parcial. */
create or replace function public.cuidar_pago_fiado()
returns trigger
language plpgsql
as $$
declare
  v_op operaciones%rowtype;
begin
  if new.medio <> 'cuenta_corriente' then
    return new;
  end if;
  select * into v_op from operaciones where id = new.operacion_id;
  if v_op.cliente_id is null then
    raise exception 'Para fiar hay que elegir a quién: la venta a cuenta corriente necesita un cliente.'
      using errcode = 'P0041';
  end if;
  if v_op.tipo = 'comanda' and v_op.estado = 'abierta' then
    raise exception 'El fiado de una comanda se carga al cerrar la cuenta, no como pago parcial.'
      using errcode = 'P0041';
  end if;
  return new;
end;
$$;

create trigger cuidar_pago_fiado
  before insert on pagos
  for each row execute function public.cuidar_pago_fiado();


/* ------------------------------------------------------------
   3 · Los pagos se anulan, no se borran
   ------------------------------------------------------------ */

alter table cuenta_corriente_pagos
  add column sesion_id        uuid references sesiones_caja(id) on delete set null,
  add column movimiento_id    uuid references movimientos_caja(id) on delete set null,
  add column anulado_en       timestamptz,
  add column anulado_por      uuid references perfiles(id) on delete set null,
  add column motivo_anulacion text;

/* La política de 0075 era `for all`: cualquiera del comercio podía
   borrar un pago con un delete y la deuda volvía a aparecer sin rastro.
   Ahora se lee con la política y se escribe solo por las funciones. */
drop policy cuenta_corriente_pagos_todo on cuenta_corriente_pagos;
create policy cuenta_corriente_pagos_ver on cuenta_corriente_pagos
  for select using (public.puede_ver(empresa_id));


/* ------------------------------------------------------------
   4 · Los ajustes manuales
   ------------------------------------------------------------
   Un cargo es deuda que no nace de una venta en el sistema: lo que el
   cliente debía en el cuaderno antes de Genez, un envase, un error de
   cobro a favor del local. Un descuento es deuda que se perdona, entera o
   en parte. Los dos llevan motivo, porque es lo único que explica dentro
   de seis meses por qué el saldo es el que es. */
create table cuenta_corriente_ajustes (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  cliente_id       uuid not null references clientes(id) on delete cascade,
  tipo             text not null check (tipo in ('cargo', 'descuento')),
  monto            numeric(14,2) not null check (monto > 0),
  motivo           text not null check (length(btrim(motivo)) > 0),
  usuario_id       uuid references perfiles(id) on delete set null,
  fecha            timestamptz not null default now(),
  anulado_en       timestamptz,
  anulado_por      uuid references perfiles(id) on delete set null,
  motivo_anulacion text
);

create index on cuenta_corriente_ajustes (empresa_id, cliente_id, fecha desc);

comment on table cuenta_corriente_ajustes is
  'Cargos y descuentos manuales de una cuenta corriente, con su motivo. Se anulan, no se borran.';

alter table cuenta_corriente_ajustes enable row level security;
create policy cuenta_corriente_ajustes_ver on cuenta_corriente_ajustes
  for select using (public.puede_ver(empresa_id));


/* ------------------------------------------------------------
   5 · El saldo
   ------------------------------------------------------------ */

create or replace function saldo_cliente(p_cliente uuid)
returns numeric
language sql
stable
as $$
  select
    coalesce((
      select sum(pg.monto)
      from pagos pg
      join operaciones o on o.id = pg.operacion_id
      where o.cliente_id = p_cliente
        and pg.medio = 'cuenta_corriente'
        and o.estado = 'confirmada'
    ), 0)
    + coalesce((
      select sum(a.monto) from cuenta_corriente_ajustes a
      where a.cliente_id = p_cliente and a.tipo = 'cargo' and a.anulado_en is null
    ), 0)
    - coalesce((
      select sum(a.monto) from cuenta_corriente_ajustes a
      where a.cliente_id = p_cliente and a.tipo = 'descuento' and a.anulado_en is null
    ), 0)
    - coalesce((
      select sum(cc.monto) from cuenta_corriente_pagos cc
      where cc.cliente_id = p_cliente and cc.anulado_en is null
    ), 0)
$$;


/* ------------------------------------------------------------
   6 · El estado de cuenta
   ------------------------------------------------------------
   Todo lo que movió la cuenta de un cliente, en orden: ventas fiadas,
   pagos y ajustes, anulados incluidos —marcados— porque un estado de
   cuenta que esconde lo anulado no explica nada. El saldo acumulado lo
   arma la pantalla, sumando solo lo que no está anulado.

   Sin security definer: lo que devuelve lo filtra RLS, igual que si la
   pantalla leyera las tablas. */
create or replace function estado_de_cuenta(p_cliente uuid)
returns table (
  id        uuid,
  fecha     timestamptz,
  tipo      text,
  detalle   text,
  debe      numeric,
  haber     numeric,
  medio     text,
  anulado   boolean,
  motivo    text,
  usuario   text
)
language sql
stable
as $$
  select o.id, o.fecha, 'venta'::text,
         'Venta ' || coalesce(o.numero, ''),
         pg.monto, 0::numeric, null::text, false, null::text,
         (select nombre from perfiles where id = o.usuario_id)
  from pagos pg
  join operaciones o on o.id = pg.operacion_id
  where o.cliente_id = p_cliente and pg.medio = 'cuenta_corriente' and o.estado = 'confirmada'

  union all
  select cc.id, cc.fecha, 'pago',
         coalesce(nullif(btrim(cc.notas), ''), 'Pago'),
         0, cc.monto, cc.medio, cc.anulado_en is not null, cc.motivo_anulacion,
         (select nombre from perfiles where id = cc.usuario_id)
  from cuenta_corriente_pagos cc
  where cc.cliente_id = p_cliente

  union all
  select a.id, a.fecha, a.tipo, a.motivo,
         case when a.tipo = 'cargo' then a.monto else 0 end,
         case when a.tipo = 'descuento' then a.monto else 0 end,
         null, a.anulado_en is not null, a.motivo_anulacion,
         (select nombre from perfiles where id = a.usuario_id)
  from cuenta_corriente_ajustes a
  where a.cliente_id = p_cliente

  order by 2, 3
$$;


/* ------------------------------------------------------------
   7 · Quién debe
   ------------------------------------------------------------
   Los clientes con saldo distinto de cero —también los que tienen saldo
   a favor, que es plata del cliente que el local tiene— con lo que hace
   falta para decidir a quién llamar: cuánto, desde cuándo compra fiado y
   cuándo pagó por última vez. Filtra por comercio explícito (regla 6):
   la plataforma ve todos los clientes de todos los comercios. */
create or replace function deudores(p_empresa uuid)
returns table (
  cliente_id     uuid,
  razon_social   text,
  tel            text,
  saldo          numeric,
  limite         numeric,
  ultima_compra  timestamptz,
  ultimo_pago    timestamptz
)
language sql
stable
as $$
  select * from (
    select c.id, c.razon_social, c.tel,
           saldo_cliente(c.id) as saldo,
           c.limite_credito,
           (select max(o.fecha) from pagos pg join operaciones o on o.id = pg.operacion_id
             where o.cliente_id = c.id and pg.medio = 'cuenta_corriente' and o.estado = 'confirmada'),
           (select max(cc.fecha) from cuenta_corriente_pagos cc
             where cc.cliente_id = c.id and cc.anulado_en is null)
    from clientes c
    where c.empresa_id = p_empresa
  ) x
  where x.saldo <> 0
  order by x.saldo desc
$$;


/* ------------------------------------------------------------
   8 · Cuánto se fió y cuánto se cobró
   ------------------------------------------------------------
   Para la caja del día y para el informe del mes. "En la calle" es lo que
   se debe hoy, sin importar el período: la foto, no la película. */
create or replace function resumen_cuenta_corriente(p_empresa uuid, p_desde timestamptz, p_hasta timestamptz)
returns table (fiado numeric, cobrado numeric, cargos numeric, descuentos numeric, en_la_calle numeric, deudores int)
language sql
stable
as $$
  select
    coalesce((select sum(pg.monto) from pagos pg join operaciones o on o.id = pg.operacion_id
      where o.empresa_id = p_empresa and pg.medio = 'cuenta_corriente' and o.estado = 'confirmada'
        and o.fecha >= p_desde and o.fecha < p_hasta), 0),
    coalesce((select sum(cc.monto) from cuenta_corriente_pagos cc
      where cc.empresa_id = p_empresa and cc.anulado_en is null and cc.fecha >= p_desde and cc.fecha < p_hasta), 0),
    coalesce((select sum(a.monto) from cuenta_corriente_ajustes a
      where a.empresa_id = p_empresa and a.tipo = 'cargo' and a.anulado_en is null and a.fecha >= p_desde and a.fecha < p_hasta), 0),
    coalesce((select sum(a.monto) from cuenta_corriente_ajustes a
      where a.empresa_id = p_empresa and a.tipo = 'descuento' and a.anulado_en is null and a.fecha >= p_desde and a.fecha < p_hasta), 0),
    coalesce((select sum(d.saldo) from deudores(p_empresa) d where d.saldo > 0), 0),
    (select count(*)::int from deudores(p_empresa) d where d.saldo > 0)
$$;


/* ------------------------------------------------------------
   9 · Las escrituras, por funciones
   ------------------------------------------------------------
   security definer porque las tablas ya no se dejan escribir desde el
   navegador. Por eso mismo cada una verifica a mano lo que antes hacía
   la política: que quien llama vea ese comercio. */

/* Una caja abierta de ese comercio, o error. */
create or replace function public._caja_abierta(p_sesion uuid, p_empresa uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sucursal uuid;
begin
  if p_sesion is null then
    raise exception 'No hay una caja abierta.' using errcode = 'P0001';
  end if;
  select sucursal_id into v_sucursal
  from sesiones_caja where id = p_sesion and empresa_id = p_empresa and cerrada_en is null;
  if not found then
    raise exception 'La caja ya fue cerrada, o no es de este comercio. Abrí la caja y probá de nuevo.' using errcode = 'P0002';
  end if;
  return v_sucursal;
end;
$$;

revoke execute on function public._caja_abierta(uuid, uuid) from anon, authenticated;

/* Cobrar. Cambia respecto de 0078 en tres cosas: exige que la caja siga
   abierta (antes bastaba con que existiera), no deja cobrar más de lo que
   se debe (eso es plata del cliente que después nadie sabe explicar), y
   guarda qué movimiento de caja generó, para poder sacarlo si se anula. */
create or replace function registrar_pago_cuenta_corriente(
  p_cliente uuid,
  p_sesion  uuid,
  p_monto   numeric,
  p_medio   text default 'efectivo',
  p_notas   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente  clientes%rowtype;
  v_sucursal uuid;
  v_saldo    numeric;
  v_mov      uuid;
  v_id       uuid;
begin
  select * into v_cliente from clientes where id = p_cliente;
  if v_cliente.id is null or not public.puede_ver(v_cliente.empresa_id) then
    raise exception 'No existe ese cliente.';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El pago tiene que ser mayor a cero.';
  end if;
  if coalesce(p_medio, '') in ('', 'cuenta_corriente') then
    raise exception 'Una deuda se paga con plata: elegí efectivo, transferencia u otro medio.';
  end if;

  v_sucursal := public._caja_abierta(p_sesion, v_cliente.empresa_id);

  v_saldo := saldo_cliente(p_cliente);
  if p_monto > v_saldo then
    raise exception 'El pago (%) es más de lo que debe (%).', p_monto, greatest(v_saldo, 0) using errcode = 'P0042';
  end if;

  insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, usuario_id, fecha)
  values (v_cliente.empresa_id, v_sucursal, p_sesion, 'ingreso', p_medio, p_monto,
          'Pago de cuenta corriente · ' || v_cliente.razon_social, auth.uid(), now())
  returning id into v_mov;

  insert into cuenta_corriente_pagos (empresa_id, cliente_id, monto, medio, usuario_id, notas, sesion_id, movimiento_id)
  values (v_cliente.empresa_id, p_cliente, p_monto, p_medio, auth.uid(), nullif(btrim(coalesce(p_notas, '')), ''), p_sesion, v_mov)
  returning id into v_id;

  return v_id;
end;
$$;

/* Anular un pago. La plata que entró sale de la caja abierta, con el
   mismo medio: si el pago fue en efectivo, el cajón tiene que tener eso
   de menos al cerrar. */
create or replace function anular_pago_cuenta_corriente(p_pago uuid, p_sesion uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago     cuenta_corriente_pagos%rowtype;
  v_cliente  text;
  v_sucursal uuid;
begin
  select * into v_pago from cuenta_corriente_pagos where id = p_pago for update;
  if v_pago.id is null or not public.puede_ver(v_pago.empresa_id) then
    raise exception 'No existe ese pago.';
  end if;
  if not public.permiso('ajustarCuentas') then
    raise exception 'Anular un pago de cuenta corriente necesita el permiso de ajustar cuentas.' using errcode = 'P0040';
  end if;
  if v_pago.anulado_en is not null then
    raise exception 'Ese pago ya está anulado.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Escribí por qué se anula.';
  end if;

  v_sucursal := public._caja_abierta(p_sesion, v_pago.empresa_id);
  select razon_social into v_cliente from clientes where id = v_pago.cliente_id;

  update cuenta_corriente_pagos
     set anulado_en = now(), anulado_por = auth.uid(), motivo_anulacion = btrim(p_motivo)
   where id = p_pago;

  insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, usuario_id, fecha)
  values (v_pago.empresa_id, v_sucursal, p_sesion, 'egreso', v_pago.medio, v_pago.monto,
          'Anulación de pago de cuenta corriente · ' || coalesce(v_cliente, ''), auth.uid(), now());

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_pago.empresa_id, auth.uid(), 'anular_pago_cuenta_corriente', 'cuenta_corriente_pagos', p_pago,
          jsonb_build_object('cliente', v_cliente, 'monto', v_pago.monto, 'medio', v_pago.medio,
                             'fecha_pago', v_pago.fecha, 'motivo', btrim(p_motivo)));
end;
$$;

/* Cargar o perdonar deuda a mano. No toca la caja: no se mueve plata. */
create or replace function ajustar_cuenta_corriente(p_cliente uuid, p_tipo text, p_monto numeric, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente clientes%rowtype;
  v_id      uuid;
begin
  select * into v_cliente from clientes where id = p_cliente;
  if v_cliente.id is null or not public.puede_ver(v_cliente.empresa_id) then
    raise exception 'No existe ese cliente.';
  end if;
  if not public.permiso('ajustarCuentas') then
    raise exception 'Ajustar una cuenta corriente necesita el permiso de ajustar cuentas.' using errcode = 'P0040';
  end if;
  if p_tipo not in ('cargo', 'descuento') then
    raise exception 'El ajuste es un cargo o un descuento.';
  end if;
  if p_monto is null or p_monto <= 0 then
    raise exception 'El importe tiene que ser mayor a cero.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Escribí el motivo del ajuste.';
  end if;

  insert into cuenta_corriente_ajustes (empresa_id, cliente_id, tipo, monto, motivo, usuario_id)
  values (v_cliente.empresa_id, p_cliente, p_tipo, p_monto, btrim(p_motivo), auth.uid())
  returning id into v_id;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_cliente.empresa_id, auth.uid(), 'ajustar_cuenta_corriente', 'cuenta_corriente_ajustes', v_id,
          jsonb_build_object('cliente', v_cliente.razon_social, 'tipo', p_tipo, 'monto', p_monto, 'motivo', btrim(p_motivo)));
  return v_id;
end;
$$;

create or replace function anular_ajuste_cuenta_corriente(p_ajuste uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aj      cuenta_corriente_ajustes%rowtype;
  v_cliente text;
begin
  select * into v_aj from cuenta_corriente_ajustes where id = p_ajuste for update;
  if v_aj.id is null or not public.puede_ver(v_aj.empresa_id) then
    raise exception 'No existe ese ajuste.';
  end if;
  if not public.permiso('ajustarCuentas') then
    raise exception 'Anular un ajuste necesita el permiso de ajustar cuentas.' using errcode = 'P0040';
  end if;
  if v_aj.anulado_en is not null then
    raise exception 'Ese ajuste ya está anulado.';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) = 0 then
    raise exception 'Escribí por qué se anula.';
  end if;

  update cuenta_corriente_ajustes
     set anulado_en = now(), anulado_por = auth.uid(), motivo_anulacion = btrim(p_motivo)
   where id = p_ajuste;

  select razon_social into v_cliente from clientes where id = v_aj.cliente_id;
  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_aj.empresa_id, auth.uid(), 'anular_ajuste_cuenta_corriente', 'cuenta_corriente_ajustes', p_ajuste,
          jsonb_build_object('cliente', v_cliente, 'tipo', v_aj.tipo, 'monto', v_aj.monto,
                             'motivo_ajuste', v_aj.motivo, 'motivo', btrim(p_motivo)));
end;
$$;


/* ------------------------------------------------------------
   10 · Los permisos y el módulo
   ------------------------------------------------------------
   `fiar`: vender a cuenta corriente. De fábrica, todos los que cobran.
   `ajustarCuentas`: anular pagos, cargar o perdonar deuda y fijar el
   límite. De fábrica, dueño y encargado.

   El módulo `cuentas` es la pantalla nueva. Lo ven los que cobran,
   porque cobrarle a quien viene a pagar su deuda es tarea de mostrador;
   lo que no ven es el botón de anular. Se agrega al menú del minimercado
   y del bar, y a Super 25, que es quien lo pidió. Un comercio que no lo
   contrató no lo ve, como cualquier otro módulo. */
update roles_base set permisos = permisos
  || jsonb_build_object('fiar', clave in ('dueno', 'encargado', 'cajero'))
  || jsonb_build_object('ajustarCuentas', clave in ('dueno', 'encargado'));

update roles_base set modulos = array_append(modulos, 'cuentas')
 where clave in ('encargado', 'cajero') and modulos is not null and not ('cuentas' = any(modulos));

update rubros set
  modulos = case when 'cuentas' = any(modulos) then modulos else array_append(modulos, 'cuentas') end,
  menu = (
    select jsonb_agg(
      case when g->'modulos' @> '[{"k":"clientes"}]' and not g->'modulos' @> '[{"k":"cuentas"}]'
        then jsonb_set(g, '{modulos}', (
          select jsonb_agg(m order by ord)
          from (
            select m, ord from jsonb_array_elements(g->'modulos') with ordinality as t(m, ord)
            union all
            select jsonb_build_object('k', 'cuentas', 'n', 'Cuenta corriente', 'i', 'cuaderno',
                                      'd', 'Quién debe, cuánto y desde cuándo; cobrar y corregir'),
                   (select ord from jsonb_array_elements(g->'modulos') with ordinality as t2(m2, ord) where m2->>'k' = 'clientes') + 0.5
          ) z
        ))
        else g end
      order by gi)
    from jsonb_array_elements(menu) with ordinality as gg(g, gi)
  )
 where clave in ('minimercado', 'gastronomia');

/* Los módulos de un comercio los cambia Genez (proteger_lo_comercial,
   0015), y esto es Genez habilitándole a Super 25 lo que pidió: se hace
   con la identidad de la plataforma, solo para esta transacción, en vez
   de apagar la regla. */
select set_config('request.jwt.claims',
  (select json_build_object('sub', id, 'role', 'authenticated')::text from perfiles where es_plataforma order by id limit 1),
  true);

update empresas set modulos = array_append(modulos, 'cuentas')
 where nombre = 'Super 25' and not ('cuentas' = any(modulos));

select set_config('request.jwt.claims', '', true);
