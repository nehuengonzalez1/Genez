/* ============================================================
   0081 · EL CATÁLOGO TAMBIÉN AVISA
   ============================================================

   Hasta acá el tiempo real cubría lo que se mueve durante el turno —
   operaciones, líneas, estados de pedido, reservas, recursos y la lista
   de espera— pero no el catálogo, que se cargaba una vez al entrar y se
   quedaba así hasta refrescar.

   Dejó de alcanzar con la captura con pistola: una computadora escanea y
   da de alta, otra completa precios y costos. Sin esto, la segunda no ve
   lo que la primera acaba de cargar hasta apretar F5, y la persona que
   completa se queda mirando una pantalla que ya está vieja sin ninguna
   señal de que lo está.

   No es solo para eso. Dos cajas con el mismo catálogo, alguien
   corrigiendo un precio desde la oficina mientras se vende, o la carga de
   una factura desde el celular: todos son el mismo caso.

   POR QUÉ `replica identity full`
   -------------------------------
   Sin eso, el aviso de un UPDATE viaja solo con la clave primaria y sin
   el resto de la fila, así que quien escucha no puede saber de qué
   comercio era ni si le corresponde. Cuesta más WAL; es lo que hace que
   el filtro por `empresa_id` funcione. Mismo motivo que en 0022.

   Se puede correr dos veces: `add table` falla si la tabla ya está en la
   publicación, así que se pregunta antes.
   ============================================================ */

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;
end;
$$;

alter table items replica identity full;
