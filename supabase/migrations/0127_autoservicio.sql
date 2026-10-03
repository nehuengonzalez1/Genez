-- ============================================================
-- 0127 · Autoservicio: el comercio se registra solo y prueba 10 días
-- ============================================================
--
-- Lo acordado el 03/10 (docs/landing-nueva.md, punto 6): la persona se
-- registra desde la landing, confirma el mail y al entrar por primera vez
-- la base le arma el comercio, con ejemplos, y diez días de prueba.
-- Vencida la prueba sin pago, no entra más hasta que Genez la active.
--
-- UNA COLUMNA Y NO UN ESTADO
-- --------------------------
-- La especificación hablaba de un estado prueba / activo / suspendido.
-- `empresas.activa` ya era "suspendido" y el panel ya la prende y la
-- apaga, así que alcanza con `prueba_hasta`:
--   prueba_hasta con fecha  → en prueba hasta ese día, inclusive
--   prueba_hasta vencida    → no entra
--   prueba_hasta null       → contratado (todos los comercios de hoy)
--   activa = false          → suspendido por Genez, como siempre
-- Dos columnas que dicen lo mismo terminan diciendo cosas distintas.
--
-- LA SUSPENSIÓN LA HACE LA BASE
-- -----------------------------
-- Hasta acá `activa = false` solo frenaba la pantalla (sesion.js): la
-- base le seguía devolviendo todo a quien tuviera el token. Ahora vive en
-- `empresa_actual()`, de la que cuelgan `puede_ver`, `permiso` y las
-- políticas de `empresas`: suspendido o vencido, el usuario deja de tener
-- comercio para RLS y no lee ni escribe nada. Una sola función y no las
-- 96 políticas. Para la pantalla de "Tu prueba terminó" queda
-- `mi_cuenta()`, que contesta solo eso.
--
-- Al 03/10 ningún comercio tiene `activa = false`, así que nadie que hoy
-- entra deja de entrar.
--
-- LOS EJEMPLOS
-- ------------
-- Productos, clientes y dos semanas de ventas, marcados con
-- `campos_extra.ejemplo` (todas esas tablas ya tienen la columna). Las
-- ventas se insertan sin caja ni pagos: son historia para que el inicio y
-- los informes tengan algo que mostrar, no plata que tenga que estar en
-- un cajón. "Borrar ejemplos" se lleva todo eso y deja lo que la persona
-- haya cargado.

set local lock_timeout = '5s';
set local idle_in_transaction_session_timeout = '30s';

alter table empresas add column if not exists prueba_hasta date;

comment on column empresas.prueba_hasta is
  'Último día de la prueba gratis (inclusive). Null: contratado. Ver 0127.';

/* Lo comercial no lo cambia el comercio: tampoco su propia prueba. */
create or replace function public.proteger_lo_comercial()
returns trigger
language plpgsql
as $function$
begin
  if public.es_plataforma() then
    return new;
  end if;

  if new.nombre  is distinct from old.nombre
  or new.plan    is distinct from old.plan
  or new.modulos is distinct from old.modulos
  or new.activa  is distinct from old.activa
  or new.rubro   is distinct from old.rubro
  or new.prueba_hasta is distinct from old.prueba_hasta then
    raise exception 'El plan, los módulos y el estado de la cuenta los cambia Genez, no el comercio.'
      using errcode = 'P0004';
  end if;

  return new;
end;
$function$;


/* ---------- El comercio de quien llama, si puede usarlo ---------- */

create or replace function public.empresa_actual()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select p.empresa_id
  from perfiles p
  join empresas e on e.id = p.empresa_id
  where p.id = auth.uid()
    and e.activa
    and (e.prueba_hasta is null
         or e.prueba_hasta >= (now() at time zone coalesce(nullif(e.config ->> 'zona', ''), 'America/Argentina/Buenos_Aires'))::date)
$function$;


/* ---------- Las pruebas, para el panel y los mails ---------- */

create table if not exists pruebas (
  empresa_id           uuid primary key references empresas(id) on delete cascade,
  creada_en            timestamptz not null default now(),
  usuario_id           uuid references perfiles(id) on delete set null,
  email                text,
  nombre               text,
  telefono             text,
  plan                 text,
  negocio              text,
  provincia            text,
  sucursales           text,
  problema             text,
  aviso_por_vencer_en  timestamptz,
  aviso_vencida_en     timestamptz,
  pago_avisado_en      timestamptz,
  ejemplos_borrados_en timestamptz
);

alter table pruebas enable row level security;
revoke all on pruebas from anon, authenticated;
grant select, update on pruebas to authenticated;
drop policy if exists pruebas_plataforma on pruebas;
create policy pruebas_plataforma on pruebas for all
  using (es_plataforma()) with check (es_plataforma());


/* ---------- Lo que ve quien no puede entrar ---------- */
/* Vencido o suspendido, RLS no le deja leer su comercio. Esto contesta lo
   justo para la pantalla que lo invita a contratar, y nada más. */

create or replace function public.mi_cuenta()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'id', e.id,
    'nombre', e.nombre,
    'rubro', e.rubro,
    'plan', e.plan,
    'modulos', e.modulos,
    'activa', e.activa,
    'prueba_hasta', e.prueba_hasta,
    'hoy', (now() at time zone zona_de(e.id))::date,
    'pago_avisado_en', pr.pago_avisado_en,
    'ejemplos', exists (select 1 from items i where i.empresa_id = e.id and i.campos_extra ? 'ejemplo')
             or exists (select 1 from operaciones o where o.empresa_id = e.id and o.campos_extra ? 'ejemplo')
  )
  from perfiles p
  join empresas e on e.id = p.empresa_id
  left join pruebas pr on pr.empresa_id = e.id
  where p.id = auth.uid()
$function$;


/* ---------- Los ejemplos ---------- */

create or replace function public.cargar_ejemplos(p_empresa uuid, p_usuario uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rubro text;
  v_zona  text := zona_de(p_empresa);
  v_hoy   date := (now() at time zone zona_de(p_empresa))::date;
  v_dia   int;
  v_tickets int;
  v_op    uuid;
  v_fecha timestamptz;
  v_total numeric;
  v_ids   uuid[];
  v_cli   uuid[];
  r       record;
begin
  select rubro into v_rubro from empresas where id = p_empresa;

  drop table if exists _ejemplos;
  create temp table _ejemplos on commit drop as
  select * from (values
    -- rubro, tipo, nombre, categoría, unidad, costo, precio, controla, mínimo, duración, inicial, vence en (días)
    ('minimercado', 'producto', 'Yerba mate 1 kg',            'Almacén',   'un', 3100, 4500, true,  6, null::int, 14, null::int),
    ('minimercado', 'producto', 'Leche entera 1 L',           'Lácteos',   'un', 1050, 1500, true, 12, null, 30, 4),
    ('minimercado', 'producto', 'Pan lactal grande',          'Panadería', 'un', 1900, 2800, true,  4, null,  8, 3),
    ('minimercado', 'producto', 'Arroz largo fino 1 kg',      'Almacén',   'un', 1150, 1700, true,  6, null, 22, null),
    ('minimercado', 'producto', 'Fideos spaghetti 500 g',     'Almacén',   'un',  800, 1200, true,  8, null,  5, null),
    ('minimercado', 'producto', 'Aceite de girasol 1,5 L',    'Almacén',   'un', 2900, 4200, true,  4, null, 12, null),
    ('minimercado', 'producto', 'Azúcar 1 kg',                'Almacén',   'un',  950, 1400, true,  6, null, 18, null),
    ('minimercado', 'producto', 'Gaseosa cola 2,25 L',        'Bebidas',   'un', 2200, 3300, true,  6, null, 24, null),
    ('minimercado', 'producto', 'Agua mineral 2 L',           'Bebidas',   'un',  700, 1100, true,  8, null,  4, null),
    ('minimercado', 'producto', 'Galletitas de agua',         'Almacén',   'un',  650, 1000, true,  6, null, 20, null),
    ('minimercado', 'producto', 'Queso cremoso',              'Fiambrería','kg', 6500, 9800, true,  2, null,  6, 9),
    ('minimercado', 'producto', 'Detergente 750 ml',          'Limpieza',  'un', 1300, 2000, true,  3, null, 10, null),

    ('gastronomia', 'producto', 'Milanesa con papas fritas',  'Platos',    'un', 4200, 11500, false, 0, null, 0, null),
    ('gastronomia', 'producto', 'Hamburguesa completa',       'Platos',    'un', 3800, 10500, false, 0, null, 0, null),
    ('gastronomia', 'producto', 'Pizza muzzarella',           'Pizzas',    'un', 3000,  9800, false, 0, null, 0, null),
    ('gastronomia', 'producto', 'Empanada de carne',          'Entradas',  'un',  550,  1600, false, 0, null, 0, null),
    ('gastronomia', 'producto', 'Ensalada completa',          'Platos',    'un', 2400,  8200, false, 0, null, 0, null),
    ('gastronomia', 'producto', 'Flan con dulce de leche',    'Postres',   'un',  900,  4200, false, 0, null, 0, null),
    ('gastronomia', 'producto', 'Café',                       'Cafetería', 'un',  350,  2500, false, 0, null, 0, null),
    ('gastronomia', 'producto', 'Cerveza tirada pinta',       'Bebidas',   'un', 1500,  5500, false, 0, null, 0, null),
    ('gastronomia', 'producto', 'Gaseosa línea 500 ml',       'Bebidas',   'un', 1100,  3200, true, 12, null, 30, null),
    ('gastronomia', 'producto', 'Agua sin gas 500 ml',        'Bebidas',   'un',  600,  2600, true, 12, null,  9, null),

    ('servicios',   'servicio', 'Clase de prueba',            'Clases',    'un',    0,  8000, false, 0,   60,  0, null),
    ('servicios',   'servicio', 'Sesión individual',          'Sesiones',  'un',    0, 22000, false, 0,   50,  0, null),
    ('servicios',   'servicio', 'Evaluación inicial',         'Sesiones',  'un',    0, 15000, false, 0,   40,  0, null),
    ('servicios',   'servicio', 'Clase grupal',               'Clases',    'un',    0, 12000, false, 0,   60,  0, null),
    ('servicios',   'servicio', 'Pack de 4 clases',           'Packs',     'un',    0, 40000, false, 0, null,  0, null),
    ('servicios',   'servicio', 'Pase libre mensual',         'Packs',     'un',    0, 65000, false, 0, null,  0, null)
  ) as x(rubro, tipo, nombre, categoria, unidad, costo, precio, controla, minimo, duracion, inicial, vence)
  where x.rubro = v_rubro;

  insert into items (empresa_id, tipo, nombre, categoria, unidad, costo, precio,
                     controla_stock, stock_min, duracion_min, campos_extra)
  select p_empresa, tipo, nombre, categoria, unidad, costo, precio,
         controla, minimo, duracion, '{"ejemplo": true}'::jsonb
  from _ejemplos;

  insert into clientes (empresa_id, razon_social, condicion, tel, campos_extra)
  values
    (p_empresa, 'Laura Méndez (ejemplo)',   'CF', '1155550101', '{"ejemplo": true}'),
    (p_empresa, 'Carlos Ruiz (ejemplo)',    'CF', '1155550102', '{"ejemplo": true}'),
    (p_empresa, 'Distribuidora Sur (ejemplo)', 'RI', null,     '{"ejemplo": true}');

  select array_agg(id) into v_ids from items where empresa_id = p_empresa and campos_extra ? 'ejemplo';
  select array_agg(id) into v_cli from clientes where empresa_id = p_empresa and campos_extra ? 'ejemplo';

  /* Dos semanas de ventas, hasta ayer: hoy queda para la primera venta de
     verdad. Más movimiento los fines de semana. */
  for v_dia in 1..14 loop
    v_tickets := case when extract(isodow from v_hoy - v_dia) >= 5 then 9 else 5 end
                 + floor(random() * 6)::int;
    for t in 1..v_tickets loop
      v_op := gen_random_uuid();
      v_fecha := ((v_hoy - v_dia) + time '09:00' + random() * interval '12 hours') at time zone v_zona;

      insert into operaciones (id, empresa_id, tipo, estado, fecha, cliente_id, usuario_id,
                               campos_extra, cerrada_en, sincronizada_en)
      values (v_op, p_empresa, 'venta', 'confirmada', v_fecha,
              case when random() < 0.15 then v_cli[1 + floor(random() * 2)::int] end,
              p_usuario, '{"ejemplo": true}', v_fecha, now());

      for r in
        select i.id, i.nombre, i.precio, i.costo, i.controla_stock, i.unidad
        from items i
        where i.id = any(v_ids)
        order by random()
        limit 1 + floor(random() * 3)::int
      loop
        insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
                                      precio_unitario, costo_unitario, total, usuario_id)
        values (v_op, p_empresa, r.id, r.nombre,
                case when r.unidad = 'kg' then 0.25 else 1 + floor(random() * 2) end,
                r.precio, r.costo,
                r.precio * case when r.unidad = 'kg' then 0.25 else 1 + floor(random() * 2) end,
                p_usuario);
      end loop;

      /* El total se recalcula de las líneas: la cantidad al azar de arriba
         sale dos veces y no tiene por qué coincidir. */
      update operacion_lineas set total = precio_unitario * cantidad where operacion_id = v_op;
      select coalesce(sum(total), 0) into v_total from operacion_lineas where operacion_id = v_op;
      update operaciones set subtotal = v_total, total = v_total where id = v_op;

      insert into movimientos_stock (empresa_id, item_id, cantidad, tipo, operacion_id, usuario_id, fecha)
      select p_empresa, l.item_id, -l.cantidad, 'venta', v_op, p_usuario, v_fecha
      from operacion_lineas l
      join items i on i.id = l.item_id
      where l.operacion_id = v_op and i.controla_stock;
    end loop;
  end loop;

  /* El stock inicial va al final y cubre lo vendido: así lo que queda es
     la columna "inicial" de arriba, y solo algunos productos quedan bajo
     el mínimo. Cargado antes, las dos semanas de ventas dejaban todo en
     negativo y "Para reponer" eran los doce. */
  insert into movimientos_stock (empresa_id, item_id, cantidad, tipo, usuario_id, motivo, vence, fecha)
  select p_empresa, i.id,
         x.inicial + coalesce((select -sum(m.cantidad) from movimientos_stock m where m.item_id = i.id and m.tipo = 'venta'), 0),
         'inicial', p_usuario, 'Ejemplo',
         case when x.vence is not null then v_hoy + x.vence end,
         ((v_hoy - 15) + time '08:00') at time zone v_zona
  from _ejemplos x
  join items i on i.empresa_id = p_empresa and i.nombre = x.nombre and i.campos_extra ? 'ejemplo'
  where x.controla;
end;
$function$;

revoke all on function public.cargar_ejemplos(uuid, uuid) from public, anon, authenticated;


create or replace function public.borrar_ejemplos()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa uuid := empresa_actual();
begin
  if v_empresa is null then
    raise exception 'No tenés un comercio activo.' using errcode = 'P0127';
  end if;
  if not permiso('configurar') then
    raise exception 'Borrar los ejemplos lo hace quien configura el comercio.' using errcode = 'P0127';
  end if;

  /* Las ventas de ejemplo con sus líneas, pagos y movimientos (las líneas
     y los pagos caen en cascada; los movimientos de stock quedarían
     huérfanos con operacion_id null y seguirían restando). */
  delete from movimientos_stock
   where empresa_id = v_empresa
     and operacion_id in (select id from operaciones where empresa_id = v_empresa and campos_extra ? 'ejemplo');
  delete from operaciones
   where empresa_id = v_empresa and campos_extra ? 'ejemplo'
     and not exists (select 1 from comprobantes c where c.operacion_id = operaciones.id)
     and not exists (select 1 from operaciones d where d.origen_id = operaciones.id);

  /* Los productos de ejemplo se van con su stock. Si alguno ya se usó en
     una venta de verdad, la línea queda con su descripción (item_id pasa a
     null) y la venta no cambia. */
  delete from items
   where empresa_id = v_empresa and campos_extra ? 'ejemplo'
     and not exists (select 1 from receta_insumos ri where ri.item_id = items.id);

  delete from clientes
   where empresa_id = v_empresa and campos_extra ? 'ejemplo'
     and not exists (select 1 from operaciones o where o.cliente_id = clientes.id and not o.campos_extra ? 'ejemplo');

  update pruebas set ejemplos_borrados_en = now() where empresa_id = v_empresa;
end;
$function$;

revoke all on function public.borrar_ejemplos() from public, anon;
grant execute on function public.borrar_ejemplos() to authenticated;


/* ---------- El alta ---------- */

create or replace function public.crear_comercio_de_prueba(p jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_email   text;
  v_confirm timestamptz;
  v_rubro   rubros%rowtype;
  v_nombre  text := left(regexp_replace(trim(coalesce(p ->> 'comercio', '')), '\s+', ' ', 'g'), 80);
  v_persona text := left(trim(coalesce(p ->> 'nombre', '')), 80);
  v_plan    text := coalesce(nullif(p ->> 'plan', ''), 'start');
  v_modulos text[];
  v_base    text;
  v_slug    text;
  v_empresa uuid;
  v_hoy     date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if v_uid is null then
    raise exception 'Entrá con tu cuenta para crear el comercio.' using errcode = 'P0127';
  end if;

  select email, email_confirmed_at into v_email, v_confirm from auth.users where id = v_uid;
  if v_confirm is null then
    raise exception 'Confirmá tu mail antes de crear el comercio.' using errcode = 'P0127';
  end if;

  /* Un comercio por cuenta. */
  if exists (select 1 from perfiles where id = v_uid) then
    raise exception 'Tu cuenta ya tiene un comercio.' using errcode = 'P0128';
  end if;
  if exists (select 1 from clientes where usuario_id = v_uid) then
    raise exception 'Esa cuenta es la de un cliente. Para tu comercio registrate con otro mail.' using errcode = 'P0127';
  end if;

  if length(v_nombre) < 2 then
    raise exception 'Falta el nombre del comercio.' using errcode = 'P0127';
  end if;
  if length(v_persona) < 2 then
    raise exception 'Falta tu nombre.' using errcode = 'P0127';
  end if;

  select * into v_rubro from rubros where clave = p ->> 'rubro' and activo;
  if not found then
    raise exception 'Ese rubro no existe.' using errcode = 'P0127';
  end if;
  if v_plan not in ('start', 'pro', 'empresa', 'medida') then
    raise exception 'Ese plan no existe.' using errcode = 'P0127';
  end if;

  /* Los módulos que pidió, recortados a los que el rubro ofrece, más los
     de base. Probar un módulo de más no le cuesta nada a nadie; al
     contratar, el plan lo pone Genez. */
  select array_agg(distinct k order by k) into v_modulos
  from (
    select jsonb_array_elements_text(case when jsonb_typeof(p -> 'modulos') = 'array' then p -> 'modulos' else '[]' end) as k
    union select unnest(array['cobro', 'caja', 'ajustes'])
  ) x
  where k = any(v_rubro.modulos) or k in ('cobro', 'caja', 'ajustes');

  /* Un freno contra altas en masa: Auth ya limita por IP, esto limita el
     total. */
  if (select count(*) from pruebas where creada_en > now() - interval '1 hour') >= 30 then
    raise exception 'Hay muchas altas en este momento. Probá de nuevo en un rato.' using errcode = 'P0127';
  end if;

  /* El subdominio de la app del cliente sale del nombre. Si está tomado o
     es de la plataforma, se le agrega un número. */
  v_base := nullif(slug_de(v_nombre), '');
  v_slug := coalesce(v_base, 'comercio');
  while v_slug in ('www', 'app', 'api', 'admin') or exists (select 1 from empresas where slug = v_slug) loop
    v_slug := coalesce(v_base, 'comercio') || '-' || (2 + floor(random() * 998))::int;
  end loop;

  insert into empresas (nombre, rubro, modulos, plan, slug, prueba_hasta)
  values (v_nombre, v_rubro.clave, v_modulos, v_plan, v_slug, v_hoy + 10)
  returning id into v_empresa;

  insert into perfiles (id, empresa_id, nombre, rol, email)
  values (v_uid, v_empresa, v_persona, 'dueno', v_email);

  insert into pruebas (empresa_id, usuario_id, email, nombre, telefono, plan, negocio, provincia, sucursales, problema)
  values (v_empresa, v_uid, v_email, v_persona,
          left(regexp_replace(coalesce(p ->> 'telefono', ''), '[^0-9]', '', 'g'), 15),
          v_plan,
          left(p ->> 'negocio', 80), left(p ->> 'provincia', 60),
          left(p ->> 'sucursales', 10), left(p ->> 'problema', 500));

  perform cargar_ejemplos(v_empresa, v_uid);

  return v_empresa;
end;
$function$;

revoke all on function public.crear_comercio_de_prueba(jsonb) from public, anon;
grant execute on function public.crear_comercio_de_prueba(jsonb) to authenticated;


/* ---------- "Ya pagué" ---------- */
/* Anda también con la prueba vencida: es justo cuando más hace falta. */

create or replace function public.avisar_pago()
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update pruebas set pago_avisado_en = now()
  where empresa_id = (select empresa_id from perfiles where id = auth.uid())
$function$;

revoke all on function public.avisar_pago() from public, anon;
grant execute on function public.avisar_pago() to authenticated;
revoke all on function public.mi_cuenta() from public, anon;
grant execute on function public.mi_cuenta() to authenticated;


/* ---------- Control ---------- */

do $$
declare n int;
begin
  select count(*) into n from empresas where activa and prueba_hasta is null;
  if n <> (select count(*) from empresas) then
    raise exception 'Algún comercio de hoy quedaría sin entrar (%).', n;
  end if;
  raise notice 'comercios que siguen entrando: %', n;
end $$;
