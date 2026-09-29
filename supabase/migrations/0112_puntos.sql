/* ============================================================
   0112 · Puntos para los clientes
   ============================================================

   Cada venta con cliente suma puntos, y los puntos se canjean en el
   cobro como un descuento. Apagado de fábrica: lo prende cada comercio
   en Ajustes → Puntos, donde está la regla (empresas.config.puntos):

     activo         prendido o no
     pesosPorPunto  cuántos pesos hacen un punto      (1.000)
     valorPunto     cuántos pesos vale un punto       (10: vuelve el 1%)
     minimo         desde cuántos puntos se canjea    (100)
     vencenMeses    a cuántos meses vence lo ganado   (12)

   LO HACE LA BASE, NO EL MOSTRADOR
   --------------------------------
   Sumar y canjear lo hace un disparador sobre la operación confirmada:
   la venta del mostrador (registrar_venta, que puede llegar una hora
   después si no había internet), la comanda cuando se cierra, y la
   devolución, que resta los puntos que había dado. El mostrador solo
   dice cuántos quiere canjear (campos_extra.puntos.usados); si al llegar
   ya no le alcanzaban, se registra igual —la mercadería ya se llevó— y
   el movimiento queda marcado.

   EL SALDO VENCE POR LOTES
   ------------------------
   Lo ganado vence a los doce meses de ganarlo, no de la última compra.
   saldo_puntos recorre los movimientos en orden: un canje consume lo más
   viejo primero, y lo que llega a su vencimiento sin usarse se pierde.
   Es la cuenta que haría cualquiera con los papelitos en la mano, y la
   única que no le quita a nadie puntos que ya gastó.

   Los movimientos no se escriben desde el navegador: los escriben el
   disparador y, a mano, ajustar_puntos (con el permiso de ajustar
   cuentas, como la cuenta corriente).
   ============================================================ */

create table puntos_movimientos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  cliente_id   uuid not null references clientes(id) on delete cascade,
  operacion_id uuid references operaciones(id) on delete set null,
  puntos       integer not null,
  tipo         text not null,
  vence        date,
  detalle      text,
  sin_saldo    boolean not null default false,
  usuario_id   uuid references perfiles(id) on delete set null,
  fecha        timestamptz not null default now(),
  constraint puntos_tipo_valido check (tipo in ('suma', 'canje', 'devolucion', 'ajuste')),
  constraint puntos_no_cero check (puntos <> 0),
  constraint puntos_suma_vence check (tipo <> 'suma' or vence is not null)
);
create index on puntos_movimientos (cliente_id, fecha);
create index on puntos_movimientos (operacion_id) where operacion_id is not null;

comment on table puntos_movimientos is
  'Lo que ganó y gastó cada cliente en puntos. Lo escriben el disparador de operaciones y ajustar_puntos; el saldo sale de saldo_puntos (0112).';
comment on column puntos_movimientos.sin_saldo is
  'Un canje que llegó a la base cuando ya no le alcanzaban los puntos (una venta sin internet): se registra igual y queda marcado.';

alter table puntos_movimientos enable row level security;
create policy puntos_ver on puntos_movimientos for select using (public.puede_ver(empresa_id));
revoke insert, update, delete on puntos_movimientos from anon, authenticated;


/* ---------- La regla del comercio ---------- */
create or replace function regla_de_puntos(p_empresa uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when coalesce((e.config -> 'puntos' ->> 'activo')::boolean, false) then
    jsonb_build_object(
      'pesosPorPunto', greatest(1, coalesce((e.config -> 'puntos' ->> 'pesosPorPunto')::numeric, 1000)),
      'valorPunto',    greatest(0, coalesce((e.config -> 'puntos' ->> 'valorPunto')::numeric, 10)),
      'minimo',        greatest(0, coalesce((e.config -> 'puntos' ->> 'minimo')::int, 100)),
      'vencenMeses',   greatest(1, coalesce((e.config -> 'puntos' ->> 'vencenMeses')::int, 12)))
  end
  from empresas e where e.id = p_empresa
$$;


/* ---------- El saldo, por lotes ---------- */
create or replace function saldo_puntos(p_cliente uuid, p_al timestamptz default now())
returns table (saldo integer, por_vencer integer, proximo_vencimiento date)
language plpgsql stable security invoker set search_path = public as $$
declare
  m record;
  lotes jsonb := '[]'::jsonb;   -- [{ quedan, vence }], del más viejo al más nuevo
  falta integer;
  i integer;
  l jsonb;
  total integer := 0;
  pronto integer := 0;
  cuando date;
begin
  for m in select puntos, vence, fecha from puntos_movimientos
            where cliente_id = p_cliente and fecha <= p_al order by fecha, id loop
    /* Lo que venció antes de este movimiento ya no está. */
    lotes := coalesce((select jsonb_agg(x) from jsonb_array_elements(lotes) x where (x ->> 'vence')::date > m.fecha::date), '[]'::jsonb);
    if m.puntos > 0 then
      lotes := lotes || jsonb_build_object('quedan', m.puntos, 'vence', coalesce(m.vence, (m.fecha + interval '100 years')::date));
    else
      falta := -m.puntos;
      i := 0;
      while falta > 0 and i < jsonb_array_length(lotes) loop
        l := lotes -> i;
        if (l ->> 'quedan')::int > falta then
          lotes := jsonb_set(lotes, array[i::text, 'quedan'], to_jsonb((l ->> 'quedan')::int - falta));
          falta := 0;
        else
          falta := falta - (l ->> 'quedan')::int;
          lotes := jsonb_set(lotes, array[i::text, 'quedan'], '0'::jsonb);
        end if;
        i := i + 1;
      end loop;
      /* Un canje de más (sin_saldo) deja el saldo en negativo: se debe. */
      if falta > 0 then lotes := lotes || jsonb_build_object('quedan', -falta, 'vence', (p_al + interval '100 years')::date); end if;
    end if;
  end loop;

  for l in select x from jsonb_array_elements(lotes) x where (x ->> 'vence')::date > p_al::date loop
    total := total + (l ->> 'quedan')::int;
    if (l ->> 'quedan')::int > 0 and (l ->> 'vence')::date <= (p_al + interval '30 days')::date then
      pronto := pronto + (l ->> 'quedan')::int;
      cuando := least(coalesce(cuando, (l ->> 'vence')::date), (l ->> 'vence')::date);
    end if;
  end loop;
  return query select total, pronto, cuando;
end;
$$;


/* ---------- Sumar, canjear y devolver ---------- */
create or replace function puntos_de_la_operacion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  usados integer;
  ganados integer;
  saldo integer;
  origen record;
begin
  if new.estado <> 'confirmada' or new.cliente_id is null then return new; end if;
  if new.tipo not in ('venta', 'comanda', 'devolucion') then return new; end if;
  /* Una sola vez por operación, aunque el disparador corra de nuevo. */
  if exists (select 1 from puntos_movimientos where operacion_id = new.id) then return new; end if;

  if new.tipo = 'devolucion' then
    /* registrar_devolucion la crea con total 0 y recién después le pone
       el total: se espera a que lo tenga. */
    if coalesce(new.total, 0) = 0 then return new; end if;
    /* Se devuelve lo que la venta de origen dio, en proporción a lo que
       se devuelve. Con la regla apagada también: los puntos ya se dieron. */
    select o.total, (select sum(p.puntos) from puntos_movimientos p where p.operacion_id = o.id and p.tipo = 'suma') as dio
      into origen from operaciones o where o.id = new.origen_id;
    if origen.dio > 0 and origen.total > 0 then
      ganados := least(origen.dio, floor(origen.dio * abs(new.total) / origen.total)::int);
      if ganados > 0 then
        insert into puntos_movimientos (empresa_id, cliente_id, operacion_id, puntos, tipo, detalle, usuario_id)
        values (new.empresa_id, new.cliente_id, new.id, -ganados, 'devolucion', 'Devolución', auth.uid());
      end if;
    end if;
    return new;
  end if;

  /* Una venta o comanda: al confirmarse, no cada vez que se la toca. */
  if tg_op = 'UPDATE' and old.estado = 'confirmada' then return new; end if;
  r := regla_de_puntos(new.empresa_id);

  /* El canje se registra aunque la regla se haya apagado después: el
     cliente ya se llevó el descuento. */
  usados := coalesce((new.campos_extra -> 'puntos' ->> 'usados')::int, 0);
  if usados > 0 then
    select s.saldo into saldo from saldo_puntos(new.cliente_id, new.fecha) s;
    insert into puntos_movimientos (empresa_id, cliente_id, operacion_id, puntos, tipo, detalle, sin_saldo, usuario_id)
    values (new.empresa_id, new.cliente_id, new.id, -usados, 'canje', 'Canje en el cobro', coalesce(saldo, 0) < usados, auth.uid());
  end if;

  if r is null then return new; end if;
  ganados := floor(greatest(new.total, 0) / (r ->> 'pesosPorPunto')::numeric)::int;
  if ganados > 0 then
    insert into puntos_movimientos (empresa_id, cliente_id, operacion_id, puntos, tipo, vence, detalle, usuario_id)
    values (new.empresa_id, new.cliente_id, new.id, ganados, 'suma',
            (new.fecha + make_interval(months => (r ->> 'vencenMeses')::int))::date, 'Compra', auth.uid());
  end if;
  return new;
end;
$$;

create trigger puntos_de_la_operacion after insert or update of estado, total on operaciones
  for each row execute function puntos_de_la_operacion();


/* ---------- Corregir a mano ---------- */
create or replace function ajustar_puntos(p_cliente uuid, p_puntos integer, p_detalle text)
returns void language plpgsql security definer set search_path = public as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa from clientes where id = p_cliente;
  if v_empresa is null or not public.puede_ver(v_empresa) then raise exception 'No se encontró el cliente.' using errcode = 'P0040'; end if;
  if not public.permiso('ajustarCuentas') then raise exception 'Corregir puntos necesita el permiso de ajustar cuentas.' using errcode = 'P0041'; end if;
  if coalesce(p_puntos, 0) = 0 then raise exception 'La corrección no puede ser cero.' using errcode = 'P0042'; end if;
  if coalesce(trim(p_detalle), '') = '' then raise exception 'Decí por qué se corrige.' using errcode = 'P0043'; end if;
  insert into puntos_movimientos (empresa_id, cliente_id, puntos, tipo, vence, detalle, usuario_id)
  values (v_empresa, p_cliente, p_puntos, 'ajuste',
          case when p_puntos > 0 then (now() + interval '12 months')::date end, trim(p_detalle), auth.uid());
end;
$$;

revoke execute on function saldo_puntos(uuid, timestamptz) from public, anon;
grant execute on function saldo_puntos(uuid, timestamptz) to authenticated;
revoke execute on function ajustar_puntos(uuid, integer, text) from public, anon;
grant execute on function ajustar_puntos(uuid, integer, text) to authenticated;
revoke execute on function regla_de_puntos(uuid) from public, anon;
grant execute on function regla_de_puntos(uuid) to authenticated;
