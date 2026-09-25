/* ============================================================
   0094 · LOS NÚMEROS DE TICKET LOS REPARTE LA BASE, POR BLOQUES
   ============================================================

   El número de una venta lo ponía cada equipo con su propio contador
   (src/datos/ventas.js), adelantado al abrir hasta el último que la base
   conocía. Con una sola caja alcanzaba. Con dos cobrando a la vez, cada
   una seguía desde el mismo último número y los repetían: Super 25, 25/09,
   0099-00000102 y 0099-00000103 dos veces cada uno, cuatro ventas reales
   de dos equipos en doce minutos.

   El número no puede pedirse a la base en el momento de cobrar: el ticket
   se imprime al instante y la venta tiene que poder cobrarse sin
   internet. Por eso cada equipo pide un BLOQUE de números por adelantado
   —diez, veinte— y los va usando, con o sin conexión. La base nunca da el
   mismo bloque a dos equipos, así que dos cajas no pueden repetir.

   Lo que cuesta: los números dejan de ir siempre en el orden de la hora
   entre cajas distintas (la caja A usa del 110 al 119 mientras la B usa
   del 120 al 129), y un bloque que un equipo no termina de usar deja un
   hueco. En un ticket, que no es comprobante fiscal, las dos cosas son
   aceptables; que dos tickets distintos digan el mismo número, no. Las
   facturas no cambian: su número fiscal lo pone ARCA.

   Sin conexión y sin números reservados, el equipo sigue con su contador
   como antes —cobrar no se frena nunca por el número— y ese caso sí puede
   repetir. Al volver, el próximo bloque arranca después del mayor número
   que ya llegó a la base, y después del mayor que usó el equipo.
   ============================================================ */

create table numeradores (
  empresa_id  uuid not null references empresas(id) on delete cascade,
  serie       text not null,
  ultimo      integer not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (empresa_id, serie),
  constraint numeradores_serie_valida check (serie ~ '^[0-9]{4}$')
);

comment on table numeradores is
  'El último número de cada serie que se repartió a algún equipo (0094). Se escribe solo con reservar_numeros().';

/* Sin políticas: la tabla se toca solo desde la función. */
alter table numeradores enable row level security;
revoke all on numeradores from anon, authenticated;


/* Reserva `p_cantidad` números seguidos de una serie y devuelve el
   primero. `p_minimo` es el mayor número que ya usó el equipo que pide:
   si cobró sin conexión más allá de su bloque, el siguiente arranca
   después de eso. */
create or replace function reservar_numeros(
  p_empresa  uuid,
  p_serie    text,
  p_cantidad integer default 10,
  p_minimo   integer default 0
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ultimo   integer;
  v_en_base  integer;
begin
  if p_empresa is null or not public.puede_ver(p_empresa)
     or not coalesce((select activo from perfiles where id = auth.uid()), false) then
    raise exception 'No podés numerar ventas de este comercio.' using errcode = 'P0021';
  end if;
  if p_serie is null or p_serie !~ '^[0-9]{4}$' then
    raise exception 'La serie tiene que ser de cuatro números.' using errcode = 'P0020';
  end if;
  if p_cantidad is null or p_cantidad < 1 or p_cantidad > 100 then
    raise exception 'Se reservan de 1 a 100 números.' using errcode = 'P0020';
  end if;

  insert into numeradores (empresa_id, serie) values (p_empresa, p_serie)
  on conflict do nothing;
  /* El candado: dos equipos pidiendo a la vez esperan uno al otro. */
  select ultimo into v_ultimo from numeradores
   where empresa_id = p_empresa and serie = p_serie
   for update;

  /* Lo que ya llegó a la base manda sobre el numerador: la primera vez
     no hay numerador, y un equipo que cobró sin conexión con su contador
     puede haber usado números más allá. Una mesa cobrada queda con tipo
     'comanda' y comparte la serie de los tickets. */
  select coalesce(max(nullif(split_part(numero, '-', 2), '')::int), 0) into v_en_base
    from operaciones
   where empresa_id = p_empresa and tipo in ('venta', 'comanda')
     and numero like p_serie || '-%'
     and split_part(numero, '-', 2) ~ '^[0-9]+$';

  v_ultimo := greatest(v_ultimo, v_en_base, coalesce(p_minimo, 0));

  update numeradores
     set ultimo = v_ultimo + p_cantidad, actualizado_en = now()
   where empresa_id = p_empresa and serie = p_serie;

  return v_ultimo + 1;
end;
$$;

revoke execute on function reservar_numeros(uuid, text, integer, integer) from public, anon;
grant execute on function reservar_numeros(uuid, text, integer, integer) to authenticated;
