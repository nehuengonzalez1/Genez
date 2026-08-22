/* ============================================================
   0022 · TIEMPO REAL
   ============================================================

   Todo el sistema se enteraba de los cambios preguntando cada quince o
   veinte segundos. Para una pantalla de informes está bien. Para un
   centro de pedidos no: entre que la cocina marca un plato listo y que
   el mostrador lo ve pueden pasar veinte segundos, que es exactamente el
   rato en el que alguien va a preguntar por qué tarda.

   Bajar el intervalo no es la salida: sondear cada dos segundos son
   treinta consultas por minuto por pantalla abierta, y el local tiene
   tres pantallas prendidas todo el día.

   Postgres ya publica sus cambios; lo único que faltaba era decirle qué
   tablas. Con esto, quien esté mirando el tablero recibe el aviso en el
   momento. Las políticas de RLS siguen valiendo: Realtime no manda una
   fila a quien no la podría leer con una consulta.

   El sondeo no se saca del navegador, se espacia: si el proyecto no
   tiene Realtime habilitado, o la conexión se cae, la pantalla se sigue
   actualizando sola aunque más lento.
   ============================================================ */

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

/* `add table` falla si la tabla ya está en la publicación, así que se
   pregunta antes: la migración tiene que poder correrse dos veces. */
do $$
declare t text;
begin
  foreach t in array array['operaciones', 'operacion_lineas', 'pedido_estados'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

/* Sin esto, el aviso de un UPDATE viaja solo con la clave primaria y sin
   el resto de la fila, y quien escucha no puede saber de qué comercio
   era ni si le corresponde. Cuesta más WAL; es lo que hace que el filtro
   por empresa funcione. */
alter table operaciones      replica identity full;
alter table operacion_lineas replica identity full;
