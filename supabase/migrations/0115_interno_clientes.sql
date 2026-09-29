/* ============================================================
   0115 · GENEZ FOUNDER, fase 3a: clientes, implementación y soporte
   ============================================================

   UN CLIENTE ES UN PROSPECTO QUE COMPRÓ
   -------------------------------------
   interno_clientes no copia el negocio: apunta a su prospecto (nombre,
   rubro, teléfonos, contactos y toda la línea de tiempo comercial siguen
   ahí) y agrega lo que nace con la venta: importe mensual, plan, alta,
   renovación, estado y responsable. Un prospecto es cliente una sola vez.

   LOS MÓDULOS SE LEEN DEL COMERCIO
   --------------------------------
   El comercio real (empresas) ya dice qué plan y qué módulos tiene. Si
   Founder guardara su propia lista, se desincronizaría el día que alguien
   active un módulo en un lado y no en el otro. El cliente se vincula por
   empresa_id, y interno_comercio() devuelve solo nombre, rubro, plan,
   módulos y sucursales —nunca ventas, caja ni clientes del comercio— a
   quien tenga el área 'clientes'. Es la única ventana de Founder hacia
   los comercios, y es security definer justamente para que la frontera
   la decida esa función y no la llave de plataforma.

   IMPLEMENTACIÓN A MEDIDA
   -----------------------
   Las etapas son una lista configurable; los pasos de cada etapa salen de
   un modelo (interno_impl_modelo) filtrado por rubro y por módulos. A un
   estudio de pilates no le toca "cargar el stock". Lo que igual no
   corresponde se marca "no aplica", no se borra.

   SOPORTE
   -------
   Tickets numerados con su conversación, que pueden generar tareas sin
   perder al cliente. El soporte de Genez hacia sus clientes, no el que un
   comercio pueda darle a los suyos.

   ADJUNTOS
   --------
   Un bucket privado 'interno' de Storage. La primera carpeta de cada
   archivo es el área, y la política de Storage pide es_interno(esa área):
   un comercio no puede ni listar ni subir, y un miembro sin 'soporte' no
   ve las capturas de los tickets. Tamaño y tipos los limita el bucket, no
   solo la pantalla. No hay política de borrar: se archiva el registro.
   ============================================================ */

/* ---------- Áreas y listas nuevas ---------- */
/* Se reemplazan los checks por unos que incluyen lo anterior: no hay
   ningún dato que deje de valer. */
alter table interno_miembros drop constraint interno_miembros_areas_validas;
alter table interno_miembros add constraint interno_miembros_areas_validas
  check (areas <@ array['*', 'crm', 'agenda', 'tareas', 'clientes', 'soporte', 'producto', 'docs', 'marketing', 'finanzas', 'config']::text[]);

alter table interno_listas drop constraint interno_listas_tipo_valido;
alter table interno_listas add constraint interno_listas_tipo_valido
  check (tipo in ('zona', 'rubro', 'fuente', 'motivo_perdida', 'tipo_actividad', 'tipo_evento', 'categoria_tarea', 'etiqueta',
                  'etapa_implementacion', 'canal_ticket', 'categoria_ticket', 'modulo'));

insert into interno_listas (tipo, clave, nombre, orden) values
  ('etapa_implementacion', 'venta_confirmada', 'Venta confirmada', 1), ('etapa_implementacion', 'relevamiento', 'Relevamiento', 2),
  ('etapa_implementacion', 'configuracion', 'Configuración', 3), ('etapa_implementacion', 'carga_datos', 'Carga de datos', 4),
  ('etapa_implementacion', 'usuarios', 'Usuarios y permisos', 5), ('etapa_implementacion', 'capacitacion', 'Capacitación', 6),
  ('etapa_implementacion', 'pruebas', 'Pruebas', 7), ('etapa_implementacion', 'puesta_en_marcha', 'Puesta en marcha', 8),
  ('etapa_implementacion', 'seguimiento_inicial', 'Seguimiento inicial', 9), ('etapa_implementacion', 'completada', 'Implementación completada', 10),
  ('canal_ticket', 'whatsapp', 'WhatsApp', 1), ('canal_ticket', 'llamada', 'Llamada', 2), ('canal_ticket', 'email', 'Email', 3),
  ('canal_ticket', 'en_persona', 'En persona', 4), ('canal_ticket', 'lo_vimos', 'Lo detectamos nosotros', 5), ('canal_ticket', 'otro', 'Otro', 9),
  ('categoria_ticket', 'consulta', 'Consulta de uso', 1), ('categoria_ticket', 'error', 'Error del sistema', 2),
  ('categoria_ticket', 'pedido', 'Pedido de cambio', 3), ('categoria_ticket', 'datos', 'Datos mal cargados', 4),
  ('categoria_ticket', 'impresion', 'Impresión', 5), ('categoria_ticket', 'facturacion', 'Factura electrónica', 6),
  ('categoria_ticket', 'pagos', 'Cobros y Mercado Pago', 7), ('categoria_ticket', 'acceso', 'Acceso y usuarios', 8),
  ('categoria_ticket', 'otro', 'Otro', 9),
  ('modulo', 'cobro', 'Cobro', 1), ('modulo', 'caja', 'Caja', 2), ('modulo', 'productos', 'Productos', 3),
  ('modulo', 'stock', 'Stock', 4), ('modulo', 'compras', 'Compras', 5), ('modulo', 'comandas', 'Salón y comandas', 6),
  ('modulo', 'pedidos', 'Pedidos', 7), ('modulo', 'clientes', 'Clientes y facturación', 8), ('modulo', 'cuentas', 'Cuenta corriente', 9),
  ('modulo', 'agenda', 'Agenda y turnos', 10), ('modulo', 'servicios', 'Servicios y recursos', 11), ('modulo', 'ventas', 'Ventas y abonos', 12),
  ('modulo', 'informes', 'Informes', 13), ('modulo', 'finanzas', 'Finanzas', 14), ('modulo', 'equipo', 'Equipo', 15),
  ('modulo', 'comunicaciones', 'Avisos', 16), ('modulo', 'permisos', 'Permisos', 17), ('modulo', 'ajustes', 'Ajustes', 18),
  ('modulo', 'app_cliente', 'App del cliente', 19), ('modulo', 'arca', 'Factura electrónica (ARCA)', 20),
  ('modulo', 'mercado_pago', 'Mercado Pago', 21), ('modulo', 'impresion', 'Impresión', 22),
  ('modulo', 'reportes', 'Informes del comercio', 23), ('modulo', 'presupuestos', 'Presupuestos', 24),
  ('modulo', 'crm', 'Seguimiento de clientes', 25), ('modulo', 'asistente', 'Asistente con IA', 26), ('modulo', 'otro', 'Otro', 99)
on conflict (tipo, clave) do nothing;


/* ---------- Clientes ---------- */
create table interno_clientes (
  id               uuid primary key default gen_random_uuid(),
  prospecto_id     uuid not null unique references interno_prospectos(id) on delete restrict,
  oportunidad_id   uuid references interno_oportunidades(id) on delete set null,
  empresa_id       uuid unique references empresas(id) on delete set null,
  plan             text,
  importe_mensual  numeric(14,2) not null default 0,
  alta             date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  renovacion       date,
  estado           text not null default 'implementacion',
  responsable_id   uuid references perfiles(id) on delete set null,
  notas            text,
  motivo_baja      text,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_clientes_estado check (estado in ('implementacion', 'activo', 'en_riesgo', 'pausado', 'cancelado')),
  constraint interno_clientes_importe check (importe_mensual >= 0),
  constraint interno_clientes_renovacion check (renovacion is null or renovacion >= alta)
);
comment on table interno_clientes is
  'Un prospecto que compró (0115). No copia el negocio: lo lee del prospecto. Los módulos, del comercio vinculado (interno_comercio).';

/* Lo que el prospecto tiene que saber de su cliente: desde cuándo, y a
   qué comercio corresponde (lo usa el duplicado y el alta desde un comercio). */
create or replace function interno_cliente_al_prospecto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update interno_prospectos set cliente_desde = coalesce(cliente_desde, new.alta::timestamptz), empresa_id = new.empresa_id
   where id = new.prospecto_id and (cliente_desde is null or empresa_id is distinct from new.empresa_id);
  return new;
end;
$$;
create trigger interno_clientes_prospecto after insert or update of empresa_id, alta on interno_clientes
  for each row execute function interno_cliente_al_prospecto();


/* ---------- Implementación ---------- */
create table interno_impl_modelo (
  id               uuid primary key default gen_random_uuid(),
  etapa            text not null,
  titulo           text not null,
  rubros           text[] not null default '{}',
  modulos          text[] not null default '{}',
  orden            integer not null default 0,
  activo           boolean not null default true,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_impl_modelo_titulo check (length(btrim(titulo)) between 1 and 200)
);
comment on table interno_impl_modelo is
  'Los pasos de cada etapa de implementación. rubros y modulos vacíos = para todos; si no, el paso toca solo si el cliente tiene ese rubro o alguno de esos módulos.';

create table interno_impl_etapas (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references interno_clientes(id) on delete restrict,
  etapa            text not null,
  orden            integer not null default 0,
  estado           text not null default 'pendiente',
  responsable_id   uuid references perfiles(id) on delete set null,
  fecha            date,
  notas            text,
  bloqueo          text,
  pasos            jsonb not null default '[]',
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_impl_etapas_estado check (estado in ('pendiente', 'en_curso', 'hecha', 'bloqueada', 'no_aplica')),
  constraint interno_impl_etapas_pasos check (jsonb_typeof(pasos) = 'array'),
  constraint interno_impl_etapas_bloqueo check (estado <> 'bloqueada' or length(btrim(coalesce(bloqueo, ''))) > 0),
  unique (cliente_id, etapa)
);

/* Cuando no queda nada pendiente, la implementación terminó y el cliente
   pasa a activo. Solo desde "implementación": un cliente en riesgo o
   pausado no se reactiva porque alguien tildó un paso. */
create or replace function interno_impl_terminada()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from interno_impl_etapas where cliente_id = new.cliente_id and estado not in ('hecha', 'no_aplica')) then
    update interno_clientes set estado = 'activo' where id = new.cliente_id and estado = 'implementacion';
  end if;
  return new;
end;
$$;
create trigger interno_impl_etapas_terminada after update of estado on interno_impl_etapas
  for each row execute function interno_impl_terminada();

/* Los pasos que le tocan a un cliente según su rubro y sus módulos. Se
   suman los que falten (por título), sin tocar los que ya están ni su
   tilde: sirve al convertir, al vincular el comercio y después de cambiar
   el modelo. Devuelve cuántos pasos sumó. */
create or replace function interno_impl_armar(p_cliente uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_rubro text; v_modulos text[]; v_sumados integer := 0; e record; nuevos jsonb;
begin
  if not es_interno('clientes') then raise exception 'Sin acceso a clientes' using errcode = '42501'; end if;
  select p.rubro, coalesce(em.modulos, '{}') into v_rubro, v_modulos
    from interno_clientes c join interno_prospectos p on p.id = c.prospecto_id left join empresas em on em.id = c.empresa_id
   where c.id = p_cliente;
  if not found then raise exception 'No existe el cliente'; end if;

  insert into interno_impl_etapas (cliente_id, etapa, orden)
  select p_cliente, l.clave, l.orden from interno_listas l
   where l.tipo = 'etapa_implementacion' and l.activo
  on conflict (cliente_id, etapa) do nothing;

  for e in select * from interno_impl_etapas where cliente_id = p_cliente loop
    select coalesce(jsonb_agg(jsonb_build_object('titulo', m.titulo, 'hecho', false) order by m.orden), '[]') into nuevos
      from interno_impl_modelo m
     where m.activo and m.etapa = e.etapa
       and (cardinality(m.rubros) = 0 or v_rubro = any(m.rubros))
       and (cardinality(m.modulos) = 0 or m.modulos && v_modulos)
       and not exists (select 1 from jsonb_array_elements(e.pasos) x where x ->> 'titulo' = m.titulo);
    if jsonb_array_length(nuevos) > 0 then
      update interno_impl_etapas set pasos = pasos || nuevos where id = e.id;
      v_sumados := v_sumados + jsonb_array_length(nuevos);
    end if;
  end loop;
  return v_sumados;
end;
$$;

insert into interno_impl_modelo (etapa, titulo, modulos, orden) values
  ('venta_confirmada', 'Plan, importe y fecha de alta acordados', '{}', 1),
  ('venta_confirmada', 'Datos de contacto del dueño y de quien va a usar el sistema', '{}', 2),
  ('relevamiento', 'Cómo trabajan hoy: qué anotan, dónde y quién', '{}', 1),
  ('relevamiento', 'Qué equipos hay: computadora, impresora, lector, celular', '{cobro}', 2),
  ('relevamiento', 'Cómo se organizan los turnos, las clases y las salas', '{agenda}', 3),
  ('configuracion', 'Crear el comercio con sus módulos', '{}', 1),
  ('configuracion', 'Datos del negocio y del ticket', '{cobro}', 2),
  ('configuracion', 'Medios de cobro y cuenta de Mercado Pago', '{cobro}', 3),
  ('configuracion', 'Factura electrónica (si factura)', '{clientes}', 4),
  ('configuracion', 'Impresora térmica calibrada', '{cobro,comandas}', 5),
  ('configuracion', 'Mesas y salón', '{comandas}', 6),
  ('configuracion', 'App del cliente y su dirección', '{agenda}', 7),
  ('carga_datos', 'Catálogo de productos con precio', '{productos}', 1),
  ('carga_datos', 'Stock inicial', '{stock}', 2),
  ('carga_datos', 'Proveedores', '{compras}', 3),
  ('carga_datos', 'Servicios con duración y precio', '{servicios}', 4),
  ('carga_datos', 'Profesionales y sus horarios', '{agenda}', 5),
  ('carga_datos', 'Clientes y saldos de cuenta corriente', '{cuentas}', 6),
  ('usuarios', 'Un usuario por persona, con su rol', '{}', 1),
  ('capacitacion', 'Cobrar, anular y cerrar la caja', '{cobro,caja}', 1),
  ('capacitacion', 'Tomar comandas y cobrar la mesa', '{comandas}', 2),
  ('capacitacion', 'Dar turnos y registrar la asistencia', '{agenda}', 3),
  ('capacitacion', 'Reponer, contar el stock y cargar compras', '{stock,compras}', 4),
  ('pruebas', 'Una venta de prueba con el ticket impreso', '{cobro}', 1),
  ('pruebas', 'Un turno de prueba desde la app del cliente', '{agenda}', 2),
  ('puesta_en_marcha', 'Primer día con el sistema, acompañado', '{}', 1),
  ('seguimiento_inicial', 'Revisar la primera semana de uso', '{}', 1),
  ('seguimiento_inicial', 'Preguntar qué les falta o les molesta', '{}', 2),
  ('completada', 'Pedir un testimonio o una recomendación', '{}', 1);


/* ---------- Pasar a cliente ---------- */
/* Desde una oportunidad ganada. En una sola transacción: el cliente, su
   implementación armada y los recordatorios de seguimiento. Security
   definer porque crea tareas aunque quien convierte no tenga el área de
   tareas; por eso verifica 'clientes' primero, a mano.
   p_datos: { importe_mensual, plan, alta, renovacion, empresa_id,
   responsable_id, notas, sin_implementacion }. sin_implementacion es
   para los clientes que ya estaban funcionando antes de Founder. */
create or replace function interno_convertir_en_cliente(p_oportunidad uuid, p_datos jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o record; v_id uuid; v_alta date; v_renov date; v_sin boolean;
begin
  if not es_interno('clientes') then raise exception 'Sin acceso a clientes' using errcode = '42501'; end if;
  select * into o from interno_oportunidades where id = p_oportunidad;
  if not found then raise exception 'No existe la oportunidad'; end if;
  if o.estado <> 'ganada' then raise exception 'Solo una oportunidad ganada pasa a cliente' using errcode = '22023'; end if;
  if exists (select 1 from interno_clientes where prospecto_id = o.prospecto_id) then
    raise exception 'Ya es cliente' using errcode = '23505';
  end if;

  v_alta := coalesce((p_datos ->> 'alta')::date, (now() at time zone 'America/Argentina/Buenos_Aires')::date);
  v_renov := (p_datos ->> 'renovacion')::date;
  v_sin := coalesce((p_datos ->> 'sin_implementacion')::boolean, false);

  insert into interno_clientes (prospecto_id, oportunidad_id, empresa_id, plan, importe_mensual, alta, renovacion, estado, responsable_id, notas)
  values (o.prospecto_id, o.id, nullif(p_datos ->> 'empresa_id', '')::uuid, nullif(btrim(p_datos ->> 'plan'), ''),
          coalesce((p_datos ->> 'importe_mensual')::numeric, o.valor, 0), v_alta, v_renov,
          case when v_sin then 'activo' else 'implementacion' end,
          coalesce(nullif(p_datos ->> 'responsable_id', '')::uuid, auth.uid()), nullif(btrim(p_datos ->> 'notas'), ''))
  returning id into v_id;

  if not v_sin then
    perform interno_impl_armar(v_id);
    update interno_impl_etapas set estado = 'hecha', fecha = v_alta where cliente_id = v_id and etapa = 'venta_confirmada';
  end if;

  /* Los recordatorios de 10.2 son tareas comunes: aparecen en Mi día y
     en Tareas sin una pantalla aparte. La renovación, quince días antes. */
  insert into interno_tareas (titulo, categoria, prioridad, vence, prospecto_id, responsable_id)
  select t.titulo, 'comercial', 'normal', (t.dia::timestamp + time '10:00') at time zone 'America/Argentina/Buenos_Aires', o.prospecto_id,
         coalesce(nullif(p_datos ->> 'responsable_id', '')::uuid, auth.uid())
    from (values ('Primer seguimiento después del alta', v_alta + 7),
                 ('Revisar cómo lo están usando', v_alta + 30),
                 ('Pedir un testimonio o una recomendación', v_alta + 60),
                 ('Renovación: confirmar que sigue', v_renov - 15)) t(titulo, dia)
   where t.dia is not null and (not v_sin or t.titulo like 'Renovación%');
  return v_id;
end;
$$;

/* Un cliente que ya existía como comercio, antes de Founder (Super 25, el
   bar): se crea su prospecto con el nombre del comercio, su oportunidad
   pasa a la primera etapa ganada —queda en la línea de tiempo— y se
   convierte. Un comercio tiene un solo cliente. */
create or replace function interno_cliente_desde_comercio(p_empresa uuid, p_datos jsonb default '{}')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  em record; v_prospecto uuid; v_op uuid; v_ganada uuid;
begin
  if not es_interno('clientes') then raise exception 'Sin acceso a clientes' using errcode = '42501'; end if;
  select * into em from empresas where id = p_empresa;
  if not found then raise exception 'No existe el comercio'; end if;
  if exists (select 1 from interno_clientes where empresa_id = p_empresa) then raise exception 'Ese comercio ya es cliente' using errcode = '23505'; end if;
  select id into v_ganada from interno_etapas where tipo = 'ganada' and activa order by orden limit 1;
  if v_ganada is null then raise exception 'No hay una etapa ganada activa en el pipeline'; end if;

  insert into interno_prospectos (nombre, rubro, empresa_id, notas)
  values (em.nombre,
          case em.rubro when 'minimercado' then 'almacen' when 'gastronomia' then 'gastronomia' when 'servicios' then 'servicios' else null end,
          em.id, 'Cargado desde el comercio, ya era cliente antes de Founder.')
  returning id into v_prospecto;
  select id into v_op from interno_oportunidades where prospecto_id = v_prospecto order by creado_en limit 1;
  update interno_oportunidades set etapa_id = v_ganada, valor = coalesce((p_datos ->> 'importe_mensual')::numeric, valor) where id = v_op;
  return interno_convertir_en_cliente(v_op, p_datos || jsonb_build_object('empresa_id', p_empresa));
end;
$$;

/* La ventana hacia el comercio: solo lo que hace falta para la ficha. */
create or replace function interno_comercio(p_empresa uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not es_interno('clientes') then raise exception 'Sin acceso a clientes' using errcode = '42501'; end if;
  select jsonb_build_object('id', e.id, 'nombre', e.nombre, 'rubro', e.rubro, 'plan', e.plan, 'modulos', e.modulos,
           'activa', e.activa, 'slug', e.slug, 'creada_en', e.creada_en,
           'sucursales', coalesce((select jsonb_agg(s.nombre order by s.creada_en) from sucursales s where s.empresa_id = e.id and s.activa), '[]'))
    into r from empresas e where e.id = p_empresa;
  return r;
end;
$$;

/* Los comercios que todavía no son clientes en Founder, para vincular. */
create or replace function interno_comercios_libres()
returns table (id uuid, nombre text, rubro text, creada_en timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_interno('clientes') then raise exception 'Sin acceso a clientes' using errcode = '42501'; end if;
  return query select e.id, e.nombre, e.rubro, e.creada_en from empresas e
    where not exists (select 1 from interno_clientes c where c.empresa_id = e.id) order by e.nombre;
end;
$$;


/* ---------- Soporte ---------- */
create table interno_tickets (
  id               uuid primary key default gen_random_uuid(),
  numero           bigint generated always as identity unique,
  cliente_id       uuid references interno_clientes(id) on delete restrict,
  sucursal         text,
  contacto_id      uuid references interno_contactos(id) on delete set null,
  canal            text,
  modulo           text,
  categoria        text,
  titulo           text not null,
  descripcion      text,
  pasos            text,
  prioridad        text not null default 'normal',
  gravedad         text not null default 'moderada',
  estado           text not null default 'nuevo',
  responsable_id   uuid references perfiles(id) on delete set null,
  resuelto_en      timestamptz,
  cerrado_en       timestamptz,
  solucion         text,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_tickets_titulo check (length(btrim(titulo)) between 1 and 200),
  constraint interno_tickets_prioridad check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  constraint interno_tickets_gravedad check (gravedad in ('menor', 'moderada', 'grave', 'critica')),
  constraint interno_tickets_estado check (estado in ('nuevo', 'en_analisis', 'esperando_info', 'en_curso', 'resuelto', 'cerrado')),
  /* Resolver sin decir cómo no deja nada para la próxima vez que pase. */
  constraint interno_tickets_solucion check (estado not in ('resuelto', 'cerrado') or length(btrim(coalesce(solucion, ''))) > 0)
);
comment on table interno_tickets is
  'El soporte de Genez a sus clientes (0115). No es el soporte que un comercio da a los suyos.';
create index on interno_tickets (estado) where archivado_en is null;
create index on interno_tickets (cliente_id);

/* Las fechas de resolución las pone la base: medir tiempos con fechas
   que escribe la pantalla es medir lo que alguien se acordó de poner. */
create or replace function interno_ticket_estado()
returns trigger language plpgsql as $$
begin
  if new.estado in ('resuelto', 'cerrado') and (tg_op = 'INSERT' or old.estado not in ('resuelto', 'cerrado')) then
    new.resuelto_en := coalesce(new.resuelto_en, now());
  elsif new.estado not in ('resuelto', 'cerrado') then
    new.resuelto_en := null;
  end if;
  new.cerrado_en := case when new.estado = 'cerrado' then coalesce(case when tg_op = 'UPDATE' then old.cerrado_en end, now()) end;
  return new;
end;
$$;
create trigger interno_tickets_estado before insert or update of estado on interno_tickets
  for each row execute function interno_ticket_estado();

create table interno_ticket_mensajes (
  id               uuid primary key default gen_random_uuid(),
  ticket_id        uuid not null references interno_tickets(id) on delete restrict,
  tipo             text not null default 'nota',
  canal            text,
  texto            text not null,
  fecha            timestamptz not null default now(),
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_ticket_mensajes_tipo check (tipo in ('nota', 'al_cliente', 'del_cliente')),
  constraint interno_ticket_mensajes_texto check (length(btrim(texto)) between 1 and 8000)
);
create index on interno_ticket_mensajes (ticket_id, fecha);

/* Palabras de cuatro letras o más, sin tildes ni las que no dicen nada:
   con eso alcanza para encontrar "no imprime el ticket" cuando alguien
   escribe "la impresora no saca el ticket". Sin pg_trgm, para no sumar
   una extensión a la base de producción por esto. */
create or replace function interno_palabras(t text)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct w), '{}') from regexp_split_to_table(
    translate(lower(coalesce(t, '')), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+') w
   where length(w) >= 4 and w not in ('para', 'como', 'cuando', 'esta', 'este', 'esto', 'pero', 'porque', 'tiene', 'hace', 'donde',
                                       'sale', 'queda', 'algo', 'todo', 'todos', 'desde', 'hasta', 'otra', 'otro', 'solo', 'sistema')
$$;

create or replace function interno_tickets_parecidos(p_texto text, p_modulo text default null, p_excluir uuid default null)
returns table (id uuid, numero bigint, titulo text, estado text, modulo text, coincidencias integer, creado_en timestamptz)
language sql stable security invoker set search_path = public as $$
  select t.id, t.numero, t.titulo, t.estado, t.modulo,
         cardinality(array(select unnest(interno_palabras(t.titulo || ' ' || coalesce(t.descripcion, ''))) intersect select unnest(interno_palabras(p_texto))))
           + case when p_modulo is not null and t.modulo = p_modulo then 1 else 0 end,
         t.creado_en
    from interno_tickets t
   where t.archivado_en is null and (p_excluir is null or t.id <> p_excluir)
     and interno_palabras(t.titulo || ' ' || coalesce(t.descripcion, '')) && interno_palabras(p_texto)
   order by 6 desc, t.creado_en desc
   limit 5
$$;


/* ---------- Adjuntos ---------- */
create table interno_adjuntos (
  id               uuid primary key default gen_random_uuid(),
  area             text not null,
  tabla            text not null,
  fila_id          uuid not null,
  ruta             text not null unique,
  nombre           text not null,
  tipo_mime        text,
  tamano           integer,
  archivado_en     timestamptz,
  creado_en        timestamptz not null default now(),
  creado_por       uuid references perfiles(id) on delete set null,
  actualizado_en   timestamptz not null default now(),
  actualizado_por  uuid references perfiles(id) on delete set null,
  constraint interno_adjuntos_area check (area in ('clientes', 'soporte', 'producto', 'docs')),
  constraint interno_adjuntos_ruta check (ruta like area || '/%'),
  constraint interno_adjuntos_tabla check (tabla in ('interno_clientes', 'interno_impl_etapas', 'interno_tickets'))
);
create index on interno_adjuntos (tabla, fila_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('interno', 'interno', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'text/csv',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

/* La primera carpeta es el área, y tiene que ser una de las que existen:
   con '*' un fundador podría escribir en "cualquiercosa/", y eso no lo
   vería después ninguna política. */
create policy interno_archivos_ver on storage.objects for select to authenticated
  using (bucket_id = 'interno' and (storage.foldername(name))[1] in ('clientes', 'soporte', 'producto', 'docs')
         and es_interno((storage.foldername(name))[1]));
create policy interno_archivos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'interno' and (storage.foldername(name))[1] in ('clientes', 'soporte', 'producto', 'docs')
              and es_interno((storage.foldername(name))[1]));


/* ---------- Tareas que vienen de un ticket o de una etapa ---------- */
alter table interno_tareas add column ticket_id uuid references interno_tickets(id) on delete set null;
alter table interno_tareas add column impl_etapa_id uuid references interno_impl_etapas(id) on delete set null;
create index on interno_tareas (ticket_id) where ticket_id is not null;


/* ---------- Sellos, historial y permisos ---------- */
do $$
declare t text; area text;
begin
  foreach t in array array['interno_clientes', 'interno_impl_etapas', 'interno_tickets', 'interno_ticket_mensajes'] loop
    area := case when t like 'interno_ticket%' then 'soporte' else 'clientes' end;
    execute format('create trigger %I before insert or update on %I for each row execute function interno_sellar()', t || '_sello', t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function interno_anotar()', t || '_historial', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (es_interno(%L))', t || '_ver', t, area);
    execute format('create policy %I on %I for insert with check (es_interno(%L))', t || '_crear', t, area);
    execute format('create policy %I on %I for update using (es_interno(%L)) with check (es_interno(%L))', t || '_editar', t, area, area);
    execute format('revoke all on %I from anon', t);
    execute format('revoke delete, truncate, references, trigger on %I from authenticated', t);
  end loop;
end;
$$;

/* El modelo es configuración: lo lee cualquiera del equipo, lo cambia 'config'. */
create trigger interno_impl_modelo_sello before insert or update on interno_impl_modelo for each row execute function interno_sellar();
create trigger interno_impl_modelo_historial after insert or update or delete on interno_impl_modelo for each row execute function interno_anotar();
alter table interno_impl_modelo enable row level security;
create policy interno_impl_modelo_ver on interno_impl_modelo for select using (es_interno());
create policy interno_impl_modelo_crear on interno_impl_modelo for insert with check (es_interno('config'));
create policy interno_impl_modelo_editar on interno_impl_modelo for update using (es_interno('config')) with check (es_interno('config'));
revoke all on interno_impl_modelo from anon;
revoke delete, truncate, references, trigger on interno_impl_modelo from authenticated;

/* Un adjunto se ve con el área de su carpeta. */
create trigger interno_adjuntos_sello before insert or update on interno_adjuntos for each row execute function interno_sellar();
create trigger interno_adjuntos_historial after insert or update or delete on interno_adjuntos for each row execute function interno_anotar();
alter table interno_adjuntos enable row level security;
create policy interno_adjuntos_ver on interno_adjuntos for select using (es_interno(area));
create policy interno_adjuntos_crear on interno_adjuntos for insert with check (es_interno(area));
create policy interno_adjuntos_editar on interno_adjuntos for update using (es_interno(area)) with check (es_interno(area));
revoke all on interno_adjuntos from anon;
revoke delete, truncate, references, trigger on interno_adjuntos from authenticated;


/* ---------- Las vistas ---------- */
/* El cliente con su negocio y lo que hace falta para decir si requiere
   atención. Cada conteo pasa por las políticas de quien mira: sin
   'soporte', los tickets abiertos dan cero. */
create or replace view interno_clientes_vista with (security_invoker = true) as
select c.*, p.nombre, p.rubro, p.zona, p.localidad, p.telefono, p.whatsapp, p.email,
       p.ultimo_contacto, p.proximo_contacto, p.proxima_accion,
       (select count(*) from interno_impl_etapas e where e.cliente_id = c.id)::int as impl_total,
       (select count(*) from interno_impl_etapas e where e.cliente_id = c.id and e.estado in ('hecha', 'no_aplica'))::int as impl_hechas,
       (select count(*) from interno_impl_etapas e where e.cliente_id = c.id and e.estado = 'bloqueada')::int as impl_bloqueadas,
       (select count(*) from interno_tickets t where t.cliente_id = c.id and t.archivado_en is null and t.estado not in ('resuelto', 'cerrado'))::int as tickets_abiertos,
       (select count(*) from interno_tickets t where t.cliente_id = c.id and t.archivado_en is null and t.estado not in ('resuelto', 'cerrado')
          and (t.prioridad in ('alta', 'urgente') or t.gravedad in ('grave', 'critica')))::int as tickets_urgentes,
       (select count(*) from interno_tareas t where t.prospecto_id = c.prospecto_id and t.archivado_en is null
          and t.estado in ('pendiente', 'en_curso', 'en_espera') and t.vence < now())::int as tareas_vencidas
  from interno_clientes c join interno_prospectos p on p.id = c.prospecto_id;

create or replace view interno_tickets_vista with (security_invoker = true) as
select t.*, p.nombre as cliente_nombre, c.prospecto_id,
       extract(epoch from (t.resuelto_en - t.creado_en)) / 3600.0 as horas_resolucion
  from interno_tickets t
  left join interno_clientes c on c.id = t.cliente_id
  left join interno_prospectos p on p.id = c.prospecto_id;

revoke all on interno_clientes_vista, interno_tickets_vista from anon;


/* ---------- Funciones: solo para el equipo ---------- */
revoke execute on function interno_convertir_en_cliente(uuid, jsonb), interno_cliente_desde_comercio(uuid, jsonb),
  interno_comercio(uuid), interno_comercios_libres(), interno_impl_armar(uuid),
  interno_tickets_parecidos(text, text, uuid), interno_palabras(text) from public, anon;
grant execute on function interno_convertir_en_cliente(uuid, jsonb), interno_cliente_desde_comercio(uuid, jsonb),
  interno_comercio(uuid), interno_comercios_libres(), interno_impl_armar(uuid),
  interno_tickets_parecidos(text, text, uuid), interno_palabras(text) to authenticated;
revoke execute on function interno_cliente_al_prospecto(), interno_impl_terminada(), interno_ticket_estado() from public, anon, authenticated;
