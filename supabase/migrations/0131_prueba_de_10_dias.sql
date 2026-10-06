-- ============================================================
-- 0131 · La prueba dura 10 días, no 11
-- ============================================================
--
-- crear_comercio_de_prueba (0127) ponía prueba_hasta = hoy + 10, y
-- prueba_hasta es el último día con acceso, inclusive: quien se registraba
-- el 06/10 usaba hasta el 16/10, once días, y la pantalla decía "te
-- quedan 11 días". Lo vio Nehuen el 06/10 en el alta real de punta a
-- punta. Ahora es hoy + 9: el día del registro es el primero.
--
-- Lo demás ya contaba así: diasDePrueba() cuenta hoy como un día, el
-- primer cobro de quien contrata en la prueba es prueba_hasta + 1 (el día
-- 11), y los mails avisan contra prueba_hasta. Las pruebas que ya existen
-- no se tocan.
--
-- La función es la que estaba en la base (pg_get_functiondef) con ese
-- único cambio; create or replace conserva los permisos.
-- ============================================================

CREATE OR REPLACE FUNCTION public.crear_comercio_de_prueba(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  values (v_nombre, v_rubro.clave, v_modulos, v_plan, v_slug, v_hoy + 9)
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
