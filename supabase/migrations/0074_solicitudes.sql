/* ============================================================
   0074 · EL PEDIDO DE PRESUPUESTO QUEDA GUARDADO
   ============================================================

   El alta guiada termina en un presupuesto, y hasta acá lo único que
   podía pasar después era abrir WhatsApp. Si la persona cerraba la
   pestaña, no quedaba nada de ningún lado: ni quién era, ni qué había
   elegido. Ahora "Pedir este presupuesto" deja una fila acá, con lo que
   eligió y cómo contactarla, y la plataforma la ve en su panel.

   QUÉ SE GUARDA
   -------------
   Lo que la persona vio, tal cual lo vio: el negocio que tocó, el
   rubro, los puestos, lo que marcó (con el texto de cada tilde, porque
   las preguntas pueden cambiar mañana y el pedido tiene que seguir
   diciendo lo que dijo), los módulos y el precio si había tarifas.
   Más nombre, WhatsApp, email opcional y un mensaje.

   QUIÉN ESCRIBE Y QUIÉN LEE
   -------------------------
   Escribe cualquiera, sin sesión, pero solo por `pedir_presupuesto()`:
   la tabla no tiene política de insert, la función es security definer
   y valida lo mínimo (nombre, un teléfono que parezca teléfono, tamaños
   acotados). Y frena ráfagas: si en diez minutos entraron treinta
   pedidos, algo raro pasa y se rechaza hasta que afloje. No es un
   antispam serio —eso es del Firewall de Vercel (#18)—, es el piso para
   que un script tonto no llene la tabla en una noche.

   Lee y actualiza (estado, notas) solo la plataforma (`es_plataforma()`).
   ============================================================ */

create table solicitudes (
  id                uuid primary key default gen_random_uuid(),
  creado_en         timestamptz not null default now(),
  estado            text not null default 'nueva'
                    check (estado in ('nueva', 'contactada', 'cerrada')),
  negocio           text,
  rubro             text,
  escala            text,
  respuestas        jsonb not null default '[]'::jsonb,
  modulos           text[] not null default '{}',
  mensual           numeric(14,2),
  puesta_en_marcha  numeric(14,2),
  nombre            text not null,
  telefono          text not null,
  email             text,
  mensaje           text,
  origen            text,
  notas             text
);

comment on table solicitudes is
  'Pedidos de presupuesto del alta guiada: lo que la persona eligió y cómo contactarla. Los escribe pedir_presupuesto(); los ve la plataforma.';

create index solicitudes_creado_en on solicitudes (creado_en desc);

alter table solicitudes enable row level security;

create policy solicitudes_plataforma on solicitudes
  for all to authenticated
  using (public.es_plataforma()) with check (public.es_plataforma());

create or replace function pedir_presupuesto(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre    text := left(trim(coalesce(p ->> 'nombre', '')), 120);
  v_telefono  text := regexp_replace(coalesce(p ->> 'telefono', ''), '[^0-9]', '', 'g');
  v_respuestas jsonb := coalesce(p -> 'respuestas', '[]'::jsonb);
  v_modulos   text[];
  v_id        uuid;
begin
  if length(v_nombre) < 2 then
    raise exception 'Falta el nombre';
  end if;
  if length(v_telefono) < 8 or length(v_telefono) > 15 then
    raise exception 'El WhatsApp no parece un número';
  end if;
  if jsonb_typeof(v_respuestas) <> 'array' or jsonb_array_length(v_respuestas) > 40 then
    raise exception 'Respuestas inválidas';
  end if;

  select coalesce(array_agg(left(x, 40)), '{}')
    into v_modulos
    from jsonb_array_elements_text(coalesce(p -> 'modulos', '[]'::jsonb)) as x
   limit 40;

  if (select count(*) from solicitudes where creado_en > now() - interval '10 minutes') >= 30 then
    raise exception 'Demasiados pedidos seguidos; probá en un rato';
  end if;

  insert into solicitudes
    (negocio, rubro, escala, respuestas, modulos, mensual, puesta_en_marcha,
     nombre, telefono, email, mensaje, origen)
  values
    (left(p ->> 'negocio', 80), left(p ->> 'rubro', 40), left(p ->> 'escala', 10),
     v_respuestas, v_modulos,
     nullif(p ->> 'mensual', '')::numeric, nullif(p ->> 'puesta_en_marcha', '')::numeric,
     v_nombre, v_telefono,
     left(nullif(trim(coalesce(p ->> 'email', '')), ''), 120),
     left(nullif(trim(coalesce(p ->> 'mensaje', '')), ''), 1000),
     left(p ->> 'origen', 300))
  returning id into v_id;

  return v_id;
end
$$;

grant execute on function pedir_presupuesto(jsonb) to anon, authenticated;

comment on function pedir_presupuesto(jsonb) is
  'Guarda un pedido de presupuesto del alta guiada, sin sesión. Valida lo mínimo y frena ráfagas.';
