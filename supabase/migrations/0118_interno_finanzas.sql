/* ============================================================
   0118 · GENEZ FOUNDER, fase 5: finanzas, ajustes y equipo
   ============================================================

   LAS FINANZAS DE GENEZ, NO LAS DE UN COMERCIO (área 'finanzas')
   -----------------------------------------------------------
   El módulo Finanzas de los comercios mira la caja y los movimientos de
   cada comercio, atados a su empresa_id y a puede_ver(): usarlo para la
   plata de Genez la mezclaría con la de un cliente. Por eso tablas
   propias, con la frontera de siempre (es_interno).

   CUATRO COSAS QUE NO SON LO MISMO
   --------------------------------
   - Contratado: el MRR, la suma de las suscripciones activas. Es lo que
     se acordó cobrar por mes, no plata.
   - Devengado: el ingreso o gasto del mes al que corresponde (periodo).
   - Facturado: marcado a mano, con el número del comprobante. No hay
     facturación electrónica para Genez; cuando la haya, llena esto.
   - Cobrado o pagado: con fecha de pago. Es la única que es plata.

   LAS SUSCRIPCIONES MANDAN SOBRE EL IMPORTE DEL CLIENTE
   -----------------------------------------------------
   Un cliente con suscripciones tiene como importe mensual la suma de las
   activas (disparador), así el número no está dos veces con dos valores.
   Cada cambio de importe queda en interno_suscripciones_cambios: de ahí
   salen la expansión y la contracción del MRR.

   Los cobros de un mes se generan desde las suscripciones con una
   función que no duplica (un cobro por suscripción y mes, índice
   único): se puede apretar dos veces, o todos los meses, sin riesgo.

   AJUSTES Y EQUIPO
   ----------------
   interno_ajustes guarda los datos de Genez y las preferencias (agenda)
   como clave y valor: pocos datos, que no justifican una tabla cada uno.
   interno_buscar_perfil deja al administrador del equipo encontrar una
   cuenta existente por su mail para sumarla, sin darle a nadie la lista
   de todos los usuarios.
   ============================================================ */

/* ---------- Listas ---------- */
alter table interno_listas drop constraint interno_listas_tipo_valido;
alter table interno_listas add constraint interno_listas_tipo_valido
  check (tipo in ('zona', 'rubro', 'fuente', 'motivo_perdida', 'tipo_actividad', 'tipo_evento', 'categoria_tarea', 'etiqueta',
                  'etapa_implementacion', 'canal_ticket', 'categoria_ticket', 'modulo', 'tipo_documento', 'canal_contenido', 'formato_contenido',
                  'categoria_ingreso', 'categoria_gasto', 'medio_pago'));

insert into interno_listas (tipo, clave, nombre, orden) values
  ('categoria_ingreso', 'suscripcion', 'Suscripción', 1), ('categoria_ingreso', 'implementacion', 'Implementación', 2),
  ('categoria_ingreso', 'alta', 'Alta', 3), ('categoria_ingreso', 'capacitacion', 'Capacitación', 4),
  ('categoria_ingreso', 'consultoria', 'Consultoría', 5), ('categoria_ingreso', 'adicional', 'Servicio adicional', 6),
  ('categoria_ingreso', 'otro', 'Otro ingreso', 9),
  ('categoria_gasto', 'hosting', 'Hosting', 1), ('categoria_gasto', 'infraestructura', 'Infraestructura', 2),
  ('categoria_gasto', 'dominios', 'Dominios', 3), ('categoria_gasto', 'software', 'Software', 4),
  ('categoria_gasto', 'publicidad', 'Publicidad', 5), ('categoria_gasto', 'marketing', 'Marketing', 6),
  ('categoria_gasto', 'movilidad', 'Movilidad', 7), ('categoria_gasto', 'honorarios', 'Honorarios', 8),
  ('categoria_gasto', 'servicios', 'Servicios profesionales', 9), ('categoria_gasto', 'equipamiento', 'Equipamiento', 10),
  ('categoria_gasto', 'comisiones', 'Comisiones', 11), ('categoria_gasto', 'impuestos', 'Impuestos', 12),
  ('categoria_gasto', 'otro', 'Otro gasto', 19),
  ('medio_pago', 'transferencia', 'Transferencia', 1), ('medio_pago', 'mercado_pago', 'Mercado Pago', 2),
  ('medio_pago', 'efectivo', 'Efectivo', 3), ('medio_pago', 'tarjeta', 'Tarjeta', 4), ('medio_pago', 'debito_automatico', 'Débito automático', 5),
  ('medio_pago', 'otro', 'Otro', 9)
on conflict (tipo, clave) do nothing;


/* ---------- Cuentas ---------- */
create table interno_cuentas (
  id                  uuid primary key default gen_random_uuid(),
  nombre              text not null,
  tipo                text not null default 'banco',
  moneda              text not null default 'ARS',
  saldo_inicial       numeric(14,2) not null default 0,
  saldo_inicial_fecha date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  activa              boolean not null default true,
  creado_en           timestamptz not null default now(),
  creado_por          uuid references perfiles(id) on delete set null,
  actualizado_en      timestamptz not null default now(),
  actualizado_por     uuid references perfiles(id) on delete set null,
  constraint interno_cuentas_nombre check (length(btrim(nombre)) between 1 and 80),
  constraint interno_cuentas_tipo check (tipo in ('banco', 'billetera', 'efectivo', 'otra')),
  constraint interno_cuentas_moneda check (moneda in ('ARS', 'USD'))
);
comment on column interno_cuentas.saldo_inicial is
  'El saldo real en saldo_inicial_fecha, cargado a mano. El saldo de hoy suma lo cobrado y resta lo pagado desde ahí: es lo registrado, no una consulta al banco.';


/* ---------- Suscripciones ---------- */
create table interno_suscripciones (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references interno_clientes(id) on delete restrict,
  plan             text,
  importe_mensual  numeric(14,2) not null,
  moneda           text not null default 'ARS',
  inicio           date not null,
  fin              date,
  estado           text not null default 'activa',
  motivo_baja      text,
  dia_cobro        integer not null default 10,
  notas            text,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_suscripciones_importe check (importe_mensual >= 0),
  constraint interno_suscripciones_moneda check (moneda in ('ARS', 'USD')),
  constraint interno_suscripciones_estado check (estado in ('activa', 'pausada', 'baja')),
  constraint interno_suscripciones_fechas check (fin is null or fin >= inicio),
  constraint interno_suscripciones_baja check (estado <> 'baja' or fin is not null),
  constraint interno_suscripciones_dia check (dia_cobro between 1 and 28)
);
create index on interno_suscripciones (cliente_id);

create table interno_suscripciones_cambios (
  id               bigint generated always as identity primary key,
  suscripcion_id   uuid not null references interno_suscripciones(id) on delete restrict,
  fecha            date not null,
  importe_antes    numeric(14,2),
  importe_despues  numeric(14,2),
  estado_antes     text,
  estado_despues   text,
  quien            uuid references perfiles(id) on delete set null,
  creado_en        timestamptz not null default now()
);
create index on interno_suscripciones_cambios (fecha);

/* El historial del MRR lo escribe la base: alta, cambio de importe y
   cambio de estado, con la fecha del día en Buenos Aires. */
create or replace function interno_suscripcion_cambio()
returns trigger language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if tg_op = 'INSERT' then
    insert into interno_suscripciones_cambios (suscripcion_id, fecha, importe_antes, importe_despues, estado_antes, estado_despues, quien)
    values (new.id, new.inicio, null, new.importe_mensual, null, new.estado, auth.uid());
  elsif new.importe_mensual is distinct from old.importe_mensual or new.estado is distinct from old.estado then
    insert into interno_suscripciones_cambios (suscripcion_id, fecha, importe_antes, importe_despues, estado_antes, estado_despues, quien)
    values (new.id, case when new.estado = 'baja' and old.estado <> 'baja' then coalesce(new.fin, hoy) else hoy end,
            old.importe_mensual, new.importe_mensual, old.estado, new.estado, auth.uid());
  end if;
  /* El importe del cliente es la suma de sus suscripciones activas en pesos. */
  update interno_clientes set importe_mensual = coalesce((
    select sum(s.importe_mensual) from interno_suscripciones s where s.cliente_id = new.cliente_id and s.estado = 'activa' and s.moneda = 'ARS'), 0)
   where id = new.cliente_id;
  return new;
end;
$$;
create trigger interno_suscripciones_cambio after insert or update on interno_suscripciones
  for each row execute function interno_suscripcion_cambio();


/* ---------- Ingresos y gastos ---------- */
create table interno_movimientos (
  id               uuid primary key default gen_random_uuid(),
  tipo             text not null,
  concepto         text not null,
  categoria        text,
  importe          numeric(14,2) not null,
  moneda           text not null default 'ARS',
  periodo          date not null,
  emision          date,
  vencimiento      date,
  fecha_pago       date,
  estado           text not null default 'pendiente',
  facturado        boolean not null default false,
  comprobante      text,
  medio_pago       text,
  cuenta_id        uuid references interno_cuentas(id) on delete set null,
  referencia       text,
  cliente_id       uuid references interno_clientes(id) on delete set null,
  oportunidad_id   uuid references interno_oportunidades(id) on delete set null,
  suscripcion_id   uuid references interno_suscripciones(id) on delete set null,
  proveedor        text,
  proyecto_id      uuid references interno_proyectos(id) on delete set null,
  area             text,
  fijo             boolean not null default false,
  notas            text,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_movimientos_tipo check (tipo in ('ingreso', 'gasto')),
  constraint interno_movimientos_concepto check (length(btrim(concepto)) between 1 and 200),
  constraint interno_movimientos_importe check (importe > 0),
  constraint interno_movimientos_moneda check (moneda in ('ARS', 'USD')),
  constraint interno_movimientos_estado check (estado in ('pendiente', 'pagado', 'anulado')),
  /* Pagado sin fecha de pago no dice cuándo entró la plata; con fecha y
     pendiente, tampoco se sabe cuál de las dos vale. */
  constraint interno_movimientos_pago check ((estado = 'pagado') = (fecha_pago is not null) or estado = 'anulado'),
  constraint interno_movimientos_periodo check (extract(day from periodo) = 1),
  constraint interno_movimientos_cliente check (tipo = 'ingreso' or (cliente_id is null and suscripcion_id is null)),
  constraint interno_movimientos_fijo check (tipo = 'gasto' or not fijo)
);
comment on column interno_movimientos.periodo is 'El primer día del mes al que corresponde (devengado), aunque se cobre o pague en otro.';
create index on interno_movimientos (tipo, periodo);
create index on interno_movimientos (estado, vencimiento) where estado = 'pendiente';
/* Un cobro por suscripción y mes: generar los cobros dos veces no duplica. */
create unique index interno_movimientos_un_cobro on interno_movimientos (suscripcion_id, periodo) where suscripcion_id is not null and estado <> 'anulado';

/* Los cobros pendientes de un mes, desde las suscripciones activas ese
   mes. Security definer porque el concepto lleva el nombre del cliente,
   que alguien solo de 'finanzas' no ve; por eso verifica 'finanzas' a
   mano, primero. Devuelve cuántos creó (cero si ya estaban). */
create or replace function interno_generar_cobros(p_mes date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_mes date := date_trunc('month', p_mes)::date; v_n integer;
begin
  if not es_interno('finanzas') then raise exception 'Sin acceso a finanzas' using errcode = '42501'; end if;
  insert into interno_movimientos (tipo, concepto, categoria, importe, moneda, periodo, emision, vencimiento, cliente_id, suscripcion_id)
  select 'ingreso', 'Suscripción ' || coalesce(s.plan || ' · ', '') || p.nombre || ' · ' || to_char(v_mes, 'MM/YYYY'), 'suscripcion',
         s.importe_mensual, s.moneda, v_mes, v_mes, v_mes + (s.dia_cobro - 1), s.cliente_id, s.id
    from interno_suscripciones s
    join interno_clientes c on c.id = s.cliente_id
    join interno_prospectos p on p.id = c.prospecto_id
   where s.estado = 'activa' and s.importe_mensual > 0
     and s.inicio <= (v_mes + interval '1 month - 1 day')::date
     and (s.fin is null or s.fin >= v_mes)
     and not exists (select 1 from interno_movimientos m where m.suscripcion_id = s.id and m.periodo = v_mes and m.estado <> 'anulado');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;


/* ---------- Ajustes ---------- */
/* interno_ajustes no tiene id: su clave es "clave". El historial (0113)
   buscaba id o perfil_id y habría fallado; ahora también toma la clave. */
create or replace function interno_anotar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id text;
  v_cambios jsonb := '{}';
  k text;
begin
  if tg_op = 'DELETE' then
    v_id := coalesce(to_jsonb(old) ->> 'id', to_jsonb(old) ->> 'perfil_id', to_jsonb(old) ->> 'clave');
    insert into interno_historial (tabla, fila_id, accion, cambios, quien) values (tg_table_name, v_id, 'borrado', to_jsonb(old), auth.uid());
    return old;
  end if;
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(new) ->> 'perfil_id', to_jsonb(new) ->> 'clave');
  if tg_op = 'INSERT' then
    insert into interno_historial (tabla, fila_id, accion, cambios, quien) values (tg_table_name, v_id, 'alta', to_jsonb(new), auth.uid());
  else
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if k not in ('actualizado_en', 'actualizado_por') and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
        v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_object('antes', to_jsonb(old) -> k, 'despues', to_jsonb(new) -> k));
      end if;
    end loop;
    if v_cambios <> '{}' then
      insert into interno_historial (tabla, fila_id, accion, cambios, quien) values (tg_table_name, v_id, 'cambio', v_cambios, auth.uid());
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function interno_anotar() from public, anon, authenticated;

create table interno_ajustes (
  clave            text primary key,
  valor            jsonb not null default '{}',
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_ajustes_clave check (clave in ('empresa', 'agenda'))
);
insert into interno_ajustes (clave, valor) values
  ('empresa', '{}'), ('agenda', '{"hora_inicio": 7, "hora_fin": 22}')
on conflict (clave) do nothing;

create or replace function interno_ajustes_sellar()
returns trigger language plpgsql as $$ begin new.actualizado_en := now(); new.actualizado_por := auth.uid(); return new; end; $$;
create trigger interno_ajustes_sello before insert or update on interno_ajustes for each row execute function interno_ajustes_sellar();
create trigger interno_ajustes_historial after insert or update or delete on interno_ajustes for each row execute function interno_anotar();


/* ---------- Encontrar una cuenta para sumarla al equipo ---------- */
/* Solo el administrador del equipo, y solo por mail exacto: no hay forma
   de listar a todos los usuarios de Genez desde acá. */
create or replace function interno_buscar_perfil(p_email text)
returns table (id uuid, nombre text, email text, es_de_un_comercio boolean, ya_es_miembro boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_interno_admin() then raise exception 'Solo el administrador del equipo' using errcode = '42501'; end if;
  return query select p.id, p.nombre, p.email, p.empresa_id is not null,
                      exists (select 1 from interno_miembros m where m.perfil_id = p.id)
                 from perfiles p where lower(p.email) = lower(btrim(p_email)) limit 1;
end;
$$;


/* ---------- Adjuntos: el comprobante de un movimiento ---------- */
alter table interno_adjuntos drop constraint interno_adjuntos_area;
alter table interno_adjuntos add constraint interno_adjuntos_area check (area in ('clientes', 'soporte', 'producto', 'docs', 'marketing', 'finanzas'));
alter table interno_adjuntos drop constraint interno_adjuntos_tabla;
alter table interno_adjuntos add constraint interno_adjuntos_tabla
  check (tabla in ('interno_clientes', 'interno_impl_etapas', 'interno_tickets', 'interno_proyectos', 'interno_roadmap', 'interno_documentos',
                   'interno_contenidos', 'interno_grabaciones', 'interno_movimientos'));
drop policy interno_archivos_ver on storage.objects;
drop policy interno_archivos_subir on storage.objects;
create policy interno_archivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'interno' and (storage.foldername(name))[1] in ('clientes', 'soporte', 'producto', 'docs', 'marketing', 'finanzas')
         and es_interno((storage.foldername(name))[1]));
create policy interno_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'interno' and (storage.foldername(name))[1] in ('clientes', 'soporte', 'producto', 'docs', 'marketing', 'finanzas')
              and es_interno((storage.foldername(name))[1]));


/* ---------- Sellos, historial y permisos ---------- */
do $$
declare t text;
begin
  foreach t in array array['interno_cuentas', 'interno_suscripciones', 'interno_movimientos'] loop
    execute format('create trigger %I before insert or update on %I for each row execute function interno_sellar()', t || '_sello', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function interno_anotar()', t || '_historial', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (es_interno(%L))', t || '_ver', t, 'finanzas');
    execute format('create policy %I on %I for insert with check (es_interno(%L))', t || '_crear', t, 'finanzas');
    execute format('create policy %I on %I for update using (es_interno(%L)) with check (es_interno(%L))', t || '_editar', t, 'finanzas', 'finanzas');
    execute format('revoke all on %I from anon', t);
    execute format('revoke delete, truncate, references, trigger on %I from authenticated', t);
  end loop;
end;
$$;

alter table interno_suscripciones_cambios enable row level security;
create policy interno_suscripciones_cambios_ver on interno_suscripciones_cambios for select using (es_interno('finanzas'));
revoke all on interno_suscripciones_cambios from anon;
revoke insert, update, delete, truncate, references, trigger on interno_suscripciones_cambios from authenticated;

/* Los datos de Genez y la agenda los lee todo el equipo; los cambia 'config'. */
alter table interno_ajustes enable row level security;
create policy interno_ajustes_ver on interno_ajustes for select using (es_interno());
create policy interno_ajustes_editar on interno_ajustes for update using (es_interno('config')) with check (es_interno('config'));
revoke all on interno_ajustes from anon;
revoke insert, delete, truncate, references, trigger on interno_ajustes from authenticated;


/* ---------- Las vistas ---------- */
create or replace view interno_suscripciones_vista with (security_invoker = true) as
select s.*, p.nombre as cliente_nombre, c.estado as cliente_estado
  from interno_suscripciones s
  left join interno_clientes c on c.id = s.cliente_id
  left join interno_prospectos p on p.id = c.prospecto_id;

create or replace view interno_movimientos_vista with (security_invoker = true) as
select m.*, p.nombre as cliente_nombre, k.nombre as cuenta_nombre
  from interno_movimientos m
  left join interno_clientes c on c.id = m.cliente_id
  left join interno_prospectos p on p.id = c.prospecto_id
  left join interno_cuentas k on k.id = m.cuenta_id;

/* El saldo de cada cuenta: el inicial más lo cobrado y menos lo pagado
   desde esa fecha. Es lo registrado, no lo que dice el banco. */
create or replace view interno_cuentas_vista with (security_invoker = true) as
select k.*,
       k.saldo_inicial
         + coalesce((select sum(m.importe) from interno_movimientos m where m.cuenta_id = k.id and m.tipo = 'ingreso' and m.estado = 'pagado' and m.fecha_pago >= k.saldo_inicial_fecha), 0)
         - coalesce((select sum(m.importe) from interno_movimientos m where m.cuenta_id = k.id and m.tipo = 'gasto' and m.estado = 'pagado' and m.fecha_pago >= k.saldo_inicial_fecha), 0)
         as saldo
  from interno_cuentas k;

revoke all on interno_suscripciones_vista, interno_movimientos_vista, interno_cuentas_vista from anon;

revoke execute on function interno_generar_cobros(date), interno_buscar_perfil(text) from public, anon;
grant execute on function interno_generar_cobros(date), interno_buscar_perfil(text) to authenticated;
revoke execute on function interno_suscripcion_cambio(), interno_ajustes_sellar() from public, anon, authenticated;
