/* ============================================================
   0014 · GUARDAR EL PLANO DE UNA SOLA VEZ
   ============================================================

   El editor guardaba las posiciones con un upsert desde el navegador, y
   eso no podía funcionar: un upsert intenta primero insertar, así que
   Postgres exige las columnas obligatorias aunque la fila ya exista.
   Como el navegador solo mandaba la posición, fallaba por empresa_id
   nulo. El botón Guardar no habría andado nunca.

   Se resuelve acá y no mandando más columnas desde el navegador por dos
   razones. Una: acomodar diez mesas son diez consultas, y si se corta en
   el medio el plano queda mitad viejo y mitad nuevo. Dos: la empresa la
   decide el servidor a partir de quién está autenticado, no un dato que
   viaja en el pedido.
   ============================================================ */

create or replace function guardar_plano(datos jsonb)
returns integer
language plpgsql
as $$
declare
  v_tocadas integer;
begin
  update recursos r
     set x         = coalesce((m->>'x')::int, r.x),
         y         = coalesce((m->>'y')::int, r.y),
         ancho     = coalesce((m->>'ancho')::int, r.ancho),
         alto      = coalesce((m->>'alto')::int, r.alto),
         forma     = coalesce(nullif(m->>'forma', ''), r.forma),
         piso      = coalesce(nullif(m->>'piso', ''), r.piso),
         sector    = nullif(m->>'sector', ''),
         nombre    = coalesce(nullif(m->>'nombre', ''), r.nombre),
         capacidad = coalesce((m->>'capacidad')::int, r.capacidad)
    from jsonb_array_elements(coalesce(datos->'recursos', '[]'::jsonb)) as m
   where r.id = (m->>'id')::uuid;

  get diagnostics v_tocadas = row_count;
  return v_tocadas;
end;
$$;

comment on function guardar_plano is
  'Acomoda el plano entero en una sola transacción. Qué mesas puede tocar lo decide RLS, no el pedido.';
