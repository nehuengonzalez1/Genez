/* ============================================================
   0095 · EL CIERRE CON TODOS LOS MEDIOS, Y LA CAJA GRANDE
   ============================================================

   Hasta acá el cierre guardaba un número: el efectivo contado. Mercado
   Pago y las tarjetas se veían en pantalla pero no se contrastaban con
   nada ni quedaban en el cierre. Y lo que salía del cajón al cerrar no
   iba a ningún lado: Super 25, 25/09, cerró con $419.820 contados, abrió
   tres minutos después con $71.200, y los $348.620 de diferencia
   —la plata del negocio— dejaron de existir para el sistema.

   EL CIERRE
   ---------
   `cerrar_caja` guarda lo declarado de cada medio (`declarado`: el
   efectivo contado, lo que dice Mercado Pago, el cierre del posnet) y el
   fondo que queda en el cajón para mañana (`fondo_siguiente`, que la
   próxima apertura propone). Lo esperado no se guarda: es la suma de los
   movimientos de la sesión y se recalcula al leerlo, como hasta ahora.

   Cerrar pide el permiso `cerrarCaja`, que hasta acá solo apagaba un
   botón que nadie apagaba. Y ya no se puede cerrar actualizando la fila
   desde el navegador: el cierre mueve plata a la caja grande, y tiene
   que pasar entero o no pasar.

   LA CAJA GRANDE
   --------------
   La plata del negocio fuera de la caja del día, en tres cuentas:
   el efectivo guardado, la cuenta de Mercado Pago y el banco. Al cerrar,
   cada medio pasa a su cuenta —el efectivo menos el fondo, Mercado Pago a
   la suya, las tarjetas y las transferencias al banco— y la comisión
   estimada de cada medio sale como egreso, para que el banco no muestre
   plata que el procesador se queda. Después se cargan a mano los pagos,
   los retiros del dueño, los aportes, los pases entre cuentas (depositar
   el efectivo) y los ajustes (el saldo inicial, o corregir contra el
   resumen real).

   Es solo de agregar: una corrección es otro movimiento, nunca editar
   uno. Verla y moverla pide `cajaGrande` (de fábrica, dueño y
   encargado); lo que entra desde el cierre o desde el cajón no, porque
   eso lo hace quien tiene la caja del día.
   ============================================================ */

alter table sesiones_caja add column declarado jsonb;
alter table sesiones_caja add column fondo_siguiente numeric(14,2);
comment on column sesiones_caja.declarado is
  'Lo que se declaró al cerrar, por medio de pago: {"efectivo": 1000, "mp": 500, ...}. Lo esperado no se guarda: sale de los movimientos.';
comment on column sesiones_caja.fondo_siguiente is
  'El efectivo que quedó en el cajón para la próxima apertura. El resto del efectivo pasó a la caja grande.';

/* Cerrar pasa por cerrar_caja. La política de actualización se deja y un
   disparador rechaza lo que venga del navegador: sacarla hubiera sido más
   corto, pero entonces el cierre viejo —una pestaña que no se actualizó
   desde antes de 0095— escribiría cero filas SIN ERROR, y la pantalla
   diría "caja cerrada" con la caja abierta. Así falla, y dice qué hacer.
   `cerrar_caja` es security definer y corre como su dueño, no como
   `authenticated`: a ella no la frena. Los scripts de administración
   tampoco. */
create or replace function cuidar_sesion_caja()
returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'La caja se cierra desde el botón "Cerrar caja del día". Actualizá la página (F5) y cerrala de nuevo.'
      using errcode = 'P0026';
  end if;
  return new;
end;
$$;

create trigger cuidar_sesion_caja before update on sesiones_caja
  for each row execute function cuidar_sesion_caja();


create table caja_grande (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  cuenta      text not null,
  tipo        text not null,
  monto       numeric(14,2) not null,
  categoria   text not null,
  detalle     text,
  sesion_id   uuid references sesiones_caja(id) on delete set null,
  par_id      uuid,
  usuario_id  uuid references perfiles(id) on delete set null,
  fecha       timestamptz not null default now(),
  constraint caja_grande_cuenta_valida    check (cuenta in ('efectivo', 'mp', 'banco')),
  constraint caja_grande_tipo_valido      check (tipo in ('ingreso', 'egreso')),
  constraint caja_grande_monto_positivo   check (monto > 0),
  constraint caja_grande_categoria_valida check (categoria in
    ('cierre', 'desde_caja', 'comision', 'pago', 'retiro', 'aporte', 'transferencia', 'ajuste'))
);

comment on table caja_grande is
  'La plata del negocio fuera de la caja del día (0095): efectivo guardado, cuenta de Mercado Pago y banco. Solo de agregar.';
comment on column caja_grande.par_id is
  'Un pase entre cuentas son dos movimientos, el egreso de una y el ingreso de la otra, con el mismo par_id.';

create index on caja_grande (empresa_id, fecha desc);
create index on caja_grande (sesion_id) where sesion_id is not null;

alter table caja_grande enable row level security;
revoke insert, update, delete on caja_grande from anon, authenticated;

create policy caja_grande_ver on caja_grande
  for select using (public.puede_ver(empresa_id) and public.permiso('cajaGrande'));

/* Solo de agregar. Borrar no tiene política para el navegador, y
   cambiar uno no lo puede nadie: se corrige con un ajuste. */
create or replace function cuidar_caja_grande()
returns trigger language plpgsql as $$
begin
  raise exception 'Un movimiento de la caja grande no se modifica: se corrige con otro movimiento.';
end;
$$;

create trigger cuidar_caja_grande before update on caja_grande
  for each row execute function cuidar_caja_grande();


/* Los saldos. Con security_invoker, quien no tiene `cajaGrande` no ve
   ninguna fila, y la vista le da vacío. */
create or replace view caja_grande_saldos
with (security_invoker = true)
as
select empresa_id, cuenta,
       sum(case when tipo = 'ingreso' then monto else -monto end) as saldo,
       max(fecha) as ultimo
from caja_grande
group by empresa_id, cuenta;


/* La cuenta de la caja grande a la que va cada medio de pago. */
create or replace function cuenta_de_medio(p_medio text)
returns text language sql immutable as $$
  select case p_medio when 'efectivo' then 'efectivo' when 'mp' then 'mp' else 'banco' end
$$;


/* ------------------------------------------------------------
   Cerrar la caja del día
   ------------------------------------------------------------
   p_declarado: {"efectivo": 419820, "mp": 241600, "debito": 2900}
   p_fondo:     el efectivo que queda en el cajón para mañana */
create or replace function cerrar_caja(
  p_sesion    uuid,
  p_declarado jsonb,
  p_fondo     numeric,
  p_notas     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ses     sesiones_caja%rowtype;
  v_efect   numeric;
  v_fondo   numeric := round(coalesce(p_fondo, 0));
  v_medios  jsonb;
  v_fecha   text;
  v_medio   record;
  v_monto   numeric;
  v_tasa    numeric;
  v_nombre  text;
begin
  select * into v_ses from sesiones_caja where id = p_sesion for update;
  if v_ses.id is null or not public.puede_ver(v_ses.empresa_id) then
    raise exception 'La caja no existe.' using errcode = 'P0020';
  end if;
  if not public.permiso('cerrarCaja') then
    raise exception 'Tu usuario no puede cerrar la caja.' using errcode = 'P0021';
  end if;
  if v_ses.cerrada_en is not null then
    raise exception 'Esta caja ya se cerró.' using errcode = 'P0025';
  end if;
  if coalesce(jsonb_typeof(p_declarado), '') <> 'object' or coalesce(jsonb_typeof(p_declarado->'efectivo'), '') <> 'number' then
    raise exception 'Falta el efectivo contado.' using errcode = 'P0020';
  end if;
  if exists (select 1 from jsonb_each(p_declarado) d
             where jsonb_typeof(d.value) <> 'number' or (d.value)::numeric < 0) then
    raise exception 'Lo declarado de cada medio tiene que ser un número, cero o más.' using errcode = 'P0020';
  end if;

  v_efect := round((p_declarado->>'efectivo')::numeric);
  if v_fondo < 0 or v_fondo > v_efect then
    raise exception 'El fondo para mañana tiene que ser de cero al efectivo contado (%).', v_efect using errcode = 'P0020';
  end if;

  update sesiones_caja
     set cerrada_en = now(), cerrada_por = auth.uid(),
         monto_declarado = v_efect, declarado = p_declarado,
         fondo_siguiente = v_fondo, notas = nullif(btrim(coalesce(p_notas, '')), '')
   where id = v_ses.id;

  select config->'medios' into v_medios from empresas where id = v_ses.empresa_id;
  v_fecha := to_char(v_ses.abierta_en at time zone 'America/Argentina/Buenos_Aires', 'DD/MM');

  /* El efectivo que no queda de fondo. */
  if v_efect - v_fondo > 0 then
    insert into caja_grande (empresa_id, cuenta, tipo, monto, categoria, detalle, sesion_id, usuario_id)
    values (v_ses.empresa_id, 'efectivo', 'ingreso', v_efect - v_fondo, 'cierre',
            'Cierre de caja del ' || v_fecha || ' · efectivo', v_ses.id, auth.uid());
  end if;

  /* Cada medio que no es efectivo ni fiado: lo declarado a su cuenta, y
     su comisión estimada afuera. */
  for v_medio in
    select d.key as k, (d.value)::numeric as monto
    from jsonb_each(p_declarado) d
    where d.key not in ('efectivo', 'cuenta_corriente') and (d.value)::numeric > 0
  loop
    v_monto := round(v_medio.monto);
    select coalesce((m->>'tasa')::numeric, 0), coalesce(m->>'n', v_medio.k) into v_tasa, v_nombre
      from jsonb_array_elements(coalesce(v_medios, '[]'::jsonb)) m where m->>'k' = v_medio.k limit 1;
    v_nombre := coalesce(v_nombre, v_medio.k);

    insert into caja_grande (empresa_id, cuenta, tipo, monto, categoria, detalle, sesion_id, usuario_id)
    values (v_ses.empresa_id, cuenta_de_medio(v_medio.k), 'ingreso', v_monto, 'cierre',
            'Cierre de caja del ' || v_fecha || ' · ' || v_nombre, v_ses.id, auth.uid());

    if coalesce(v_tasa, 0) > 0 and round(v_monto * v_tasa / 100) > 0 then
      insert into caja_grande (empresa_id, cuenta, tipo, monto, categoria, detalle, sesion_id, usuario_id)
      values (v_ses.empresa_id, cuenta_de_medio(v_medio.k), 'egreso', round(v_monto * v_tasa / 100), 'comision',
              'Comisión estimada ' || v_nombre || ' ' || v_tasa || ' % · cierre del ' || v_fecha, v_ses.id, auth.uid());
    end if;
  end loop;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_ses.empresa_id, auth.uid(), 'caja.cierre', 'sesiones_caja', v_ses.id,
          jsonb_build_object('declarado', p_declarado, 'fondo', v_fondo));
end;
$$;

revoke execute on function cerrar_caja(uuid, jsonb, numeric, text) from public, anon;
grant execute on function cerrar_caja(uuid, jsonb, numeric, text) to authenticated;


/* ------------------------------------------------------------
   Pasar efectivo del cajón a la caja grande, en el día
   ------------------------------------------------------------
   Sale del cajón (egreso de la caja del día) y entra al efectivo de la
   caja grande, en la misma transacción. Lo puede hacer quien tiene la
   caja del día, como un retiro: la plata sigue siendo del negocio, y
   queda anotada de los dos lados. */
create or replace function pasar_a_caja_grande(
  p_sesion  uuid,
  p_monto   numeric,
  p_detalle text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ses   sesiones_caja%rowtype;
  v_monto numeric := round(coalesce(p_monto, 0));
  v_det   text := coalesce(nullif(btrim(coalesce(p_detalle, '')), ''), 'Del cajón a la caja grande');
begin
  select * into v_ses from sesiones_caja where id = p_sesion;
  if v_ses.id is null or not public.puede_ver(v_ses.empresa_id) then
    raise exception 'La caja no existe.' using errcode = 'P0020';
  end if;
  if v_ses.cerrada_en is not null then
    raise exception 'Esa caja ya se cerró.' using errcode = 'P0025';
  end if;
  if not (v_monto > 0) then
    raise exception 'El monto tiene que ser mayor que cero.' using errcode = 'P0020';
  end if;

  insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, categoria, usuario_id)
  values (v_ses.empresa_id, v_ses.sucursal_id, v_ses.id, 'egreso', 'efectivo', v_monto, v_det, 'caja_grande', auth.uid());

  insert into caja_grande (empresa_id, cuenta, tipo, monto, categoria, detalle, sesion_id, usuario_id)
  values (v_ses.empresa_id, 'efectivo', 'ingreso', v_monto, 'desde_caja', v_det, v_ses.id, auth.uid());
end;
$$;

revoke execute on function pasar_a_caja_grande(uuid, numeric, text) from public, anon;
grant execute on function pasar_a_caja_grande(uuid, numeric, text) to authenticated;


/* ------------------------------------------------------------
   Un movimiento a mano: pago, retiro del dueño, aporte o ajuste
   ------------------------------------------------------------ */
create or replace function mover_caja_grande(
  p_empresa   uuid,
  p_cuenta    text,
  p_tipo      text,
  p_monto     numeric,
  p_categoria text,
  p_detalle   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_monto numeric := round(coalesce(p_monto, 0));
begin
  if p_empresa is null or not public.puede_ver(p_empresa) or not public.permiso('cajaGrande') then
    raise exception 'Tu usuario no puede mover la caja grande.' using errcode = 'P0021';
  end if;
  if p_cuenta not in ('efectivo', 'mp', 'banco') then
    raise exception 'La cuenta tiene que ser efectivo, Mercado Pago o banco.' using errcode = 'P0020';
  end if;
  /* Qué categoría va con qué sentido: un pago o un retiro siempre salen,
     un aporte siempre entra; un ajuste, para donde haga falta. */
  if not ((p_categoria in ('pago', 'retiro') and p_tipo = 'egreso')
       or (p_categoria = 'aporte' and p_tipo = 'ingreso')
       or (p_categoria = 'ajuste' and p_tipo in ('ingreso', 'egreso'))) then
    raise exception 'Ese tipo de movimiento no va así.' using errcode = 'P0020';
  end if;
  if not (v_monto > 0) then
    raise exception 'El monto tiene que ser mayor que cero.' using errcode = 'P0020';
  end if;
  if length(btrim(coalesce(p_detalle, ''))) = 0 then
    raise exception 'Falta el detalle: en la caja grande todo dice qué fue.' using errcode = 'P0020';
  end if;

  insert into caja_grande (empresa_id, cuenta, tipo, monto, categoria, detalle, usuario_id)
  values (p_empresa, p_cuenta, p_tipo, v_monto, p_categoria, btrim(p_detalle), auth.uid())
  returning id into v_id;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (p_empresa, auth.uid(), 'caja_grande.' || p_categoria, 'caja_grande', v_id,
          jsonb_build_object('cuenta', p_cuenta, 'tipo', p_tipo, 'monto', v_monto, 'detalle', btrim(p_detalle)));
  return v_id;
end;
$$;

revoke execute on function mover_caja_grande(uuid, text, text, numeric, text, text) from public, anon;
grant execute on function mover_caja_grande(uuid, text, text, numeric, text, text) to authenticated;


/* ------------------------------------------------------------
   Pasar plata entre cuentas: depositar el efectivo, retirar del banco
   ------------------------------------------------------------ */
create or replace function transferir_caja_grande(
  p_empresa uuid,
  p_desde   text,
  p_hacia   text,
  p_monto   numeric,
  p_detalle text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_par   uuid := gen_random_uuid();
  v_monto numeric := round(coalesce(p_monto, 0));
  v_det   text;
begin
  if p_empresa is null or not public.puede_ver(p_empresa) or not public.permiso('cajaGrande') then
    raise exception 'Tu usuario no puede mover la caja grande.' using errcode = 'P0021';
  end if;
  if p_desde not in ('efectivo', 'mp', 'banco') or p_hacia not in ('efectivo', 'mp', 'banco') or p_desde = p_hacia then
    raise exception 'Elegí dos cuentas distintas.' using errcode = 'P0020';
  end if;
  if not (v_monto > 0) then
    raise exception 'El monto tiene que ser mayor que cero.' using errcode = 'P0020';
  end if;
  v_det := coalesce(nullif(btrim(coalesce(p_detalle, '')), ''), 'Pase entre cuentas');

  insert into caja_grande (empresa_id, cuenta, tipo, monto, categoria, detalle, par_id, usuario_id)
  values (p_empresa, p_desde, 'egreso', v_monto, 'transferencia', v_det, v_par, auth.uid()),
         (p_empresa, p_hacia, 'ingreso', v_monto, 'transferencia', v_det, v_par, auth.uid());

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (p_empresa, auth.uid(), 'caja_grande.transferencia', 'caja_grande', v_par,
          jsonb_build_object('desde', p_desde, 'hacia', p_hacia, 'monto', v_monto, 'detalle', v_det));
  return v_par;
end;
$$;

revoke execute on function transferir_caja_grande(uuid, text, text, numeric, text) from public, anon;
grant execute on function transferir_caja_grande(uuid, text, text, numeric, text) to authenticated;


/* ------------------------------------------------------------
   El permiso
   ------------------------------------------------------------
   De fábrica, dueño y encargado (Nehuen, 26/09). Un comercio se lo puede
   dar o sacar a otro rol, o a una persona, desde Permisos. */
update roles_base set permisos = permisos
  || jsonb_build_object('cajaGrande', clave in ('dueno', 'encargado'));
