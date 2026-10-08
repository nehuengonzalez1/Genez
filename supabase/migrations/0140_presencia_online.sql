/* ============================================================
   0140 · PRESENCIA ONLINE: LO QUE EL COMERCIO MUESTRA AFUERA
   ============================================================

   Nehuen (08/10), mirando Vendi y Ventario: "info pública, presencia
   online". La página del comercio ya existía —su subdominio,
   `slug.genez.com.ar`, con la marca de `marca_de`—, pero mostraba solo
   el nombre, el logo y un botón para entrar. Para un súper o un bar, que
   no tienen nada del lado del cliente detrás de ese botón, era una
   página vacía.

   Ahora la página puede mostrar lo que pregunta cualquiera antes de ir:
     - si está abierto, y los horarios de cada día;
     - dónde queda, con el mapa;
     - cómo escribirle (WhatsApp, teléfono, mail, redes, web);
     - cómo se paga, y si hace envíos o se retira;
     - un aviso del momento ("Cerramos por vacaciones hasta el 20").

   DÓNDE VIVE
   ----------
   En la config del comercio, que ya guarda el contacto (`contacto`) y la
   marca (`marca`: lema, bajada, portada, tema, que lee `marca_de`). Lo
   nuevo va en `config.publico`: si está publicada, los horarios, qué
   datos de contacto se muestran, los medios de pago, la entrega y el
   aviso. No hace falta una tabla: es un dato por comercio, se edita con
   el resto de los ajustes, y el navegador del comercio ya lo puede
   escribir (empresas_actualizar_config).

   POR QUÉ UNA FUNCIÓN Y NO UNA POLÍTICA
   -------------------------------------
   Por lo mismo que `marca_de` (0052): una política deja pasar la fila
   entera, y `config` tiene datos que no son de nadie de afuera (el fondo
   de caja, los descuentos por rol, los datos fiscales). Esta función
   arma la respuesta campo por campo: lo que no está nombrado acá no
   sale, ni hoy ni cuando se agregue algo a la config mañana.

   Y del contacto sale solo lo que el comercio marcó para mostrar. Cargar
   un teléfono para el ticket no lo publica.

   Si la página no está publicada devuelve null, y la página muestra lo
   de siempre (la marca y el botón para entrar). De fábrica no está
   publicada: nadie aparece con sus datos en internet sin decidirlo.
   ============================================================ */

create or replace function public.presencia_de(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with e as (
    select coalesce(config -> 'publico', '{}'::jsonb) as p,
           coalesce(config -> 'contacto', '{}'::jsonb) as c
      from empresas
     where slug = p_slug
       and activa = true
  )
  select case when (e.p ->> 'publicada')::boolean is true then
    jsonb_build_object(
      'aviso',    nullif(left(coalesce(e.p ->> 'aviso', ''), 200), ''),
      'horarios', case when jsonb_typeof(e.p -> 'horarios') = 'object' then e.p -> 'horarios' end,
      'pagos',    case when jsonb_typeof(e.p -> 'pagos') = 'array' then e.p -> 'pagos' end,
      'entrega',  case when jsonb_typeof(e.p -> 'entrega') = 'object' then
                    jsonb_build_object(
                      'retiro', coalesce((e.p -> 'entrega' ->> 'retiro')::boolean, false),
                      'envio',  coalesce((e.p -> 'entrega' ->> 'envio')::boolean, false),
                      'zona',   nullif(left(coalesce(e.p -> 'entrega' ->> 'zona', ''), 120), ''))
                  end,
      /* El contacto, dato por dato: solo lo marcado y no vacío. */
      'contacto', (
        select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
          from (
            select k, nullif(left(trim(coalesce(
                     case when k = 'mapa' then e.p ->> 'mapa' else e.c ->> k end, '')), 200), '') as v
              from unnest(array['direccion', 'mapa', 'telefono', 'whatsapp', 'email',
                                'instagram', 'facebook', 'tiktok', 'web']) as k
             where coalesce((e.p -> 'mostrar' ->> k)::boolean, false)
          ) x
         where v is not null
      )
    )
  end
  from e
$$;

comment on function public.presencia_de is
  'Lo que un comercio publicó en su página (0140): horarios, contacto marcado, pagos, entrega y aviso. Null si no la publicó.';

grant execute on function public.presencia_de(text) to anon, authenticated;
