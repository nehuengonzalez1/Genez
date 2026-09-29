/* ============================================================
   0108 · Varias sucursales
   ============================================================

   La base ya llevaba sucursal en casi todo desde 0001 —ventas, stock,
   caja, mesas— y confirmar_operacion ya escribía el stock con la
   sucursal de la venta. Pero el sistema de gestión mandaba null en todos
   lados, así que Super 25 tenía 690 movimientos de stock y 314 ventas
   sin sucursal, y un segundo local no hubiera tenido su propio stock.

   LA SUCURSAL SALE DE LA CAJA
   ---------------------------
   Cada caja es de una sucursal (un mostrador está en un local). La
   sesión la toma de su caja y el movimiento de caja de su sesión. La
   venta no guarda su sesión: la conoce por su movimiento de caja, así
   que cuando ese movimiento entra, la venta y su stock pasan a la
   sucursal de la caja donde se cobró. Lo hace la base, en disparadores,
   y no la pantalla (que igual la manda). Así nadie la elige en el mostrador y
   no se puede equivocar, y una venta que esperó una hora sin internet
   llega con la sucursal correcta aunque el navegador no la mande.

   Lo que no tiene de dónde sacarla (un ajuste de stock sin venta, un
   pedido sin sesión) va a la primera sucursal del comercio, o a la que
   diga quien la escribe.

   LO VIEJO
   --------
   Todo lo que quedó sin sucursal pasa a la de su sesión, su venta, o la
   primera del comercio. Hoy cada comercio tiene una sola, así que es la
   única respuesta posible.

   QUIÉN LAS CAMBIA
   ----------------
   La política de antes dejaba a cualquier usuario del comercio crear,
   cambiar y BORRAR sucursales. Ahora es configurar el comercio, como las
   cajas (0101), y no se borran: se desactivan. La plataforma sigue
   pudiendo crearlas (el alta de un comercio crea la "Principal").
   ============================================================ */

/* ---------- La primera sucursal ---------- */
create or replace function primera_sucursal(p_empresa uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from sucursales where empresa_id = p_empresa
   order by activa desc, creada_en, id limit 1
$$;

create or replace function sucursal_del_comercio(p_sucursal uuid, p_empresa uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if p_sucursal is not null and not exists (select 1 from sucursales where id = p_sucursal and empresa_id = p_empresa) then
    raise exception 'Esa sucursal no es de este comercio.' using errcode = 'P0030';
  end if;
end;
$$;


/* ---------- Quién las cambia ---------- */
drop policy if exists sucursales_escribir on sucursales;

create policy sucursales_crear on sucursales
  for insert with check (public.puede_ver(empresa_id) and (public.permiso('configurar') or public.es_plataforma()));
create policy sucursales_editar on sucursales
  for update using (public.puede_ver(empresa_id) and (public.permiso('configurar') or public.es_plataforma()));
/* Sin política de borrar: una sucursal con ventas es historia. */

alter table sucursales add constraint sucursales_nombre_valido check (length(btrim(nombre)) between 1 and 60);
create unique index sucursales_nombre_unico on sucursales (empresa_id, lower(btrim(nombre)));

/* La última activa no se apaga: sin ninguna, no habría dónde poner una
   caja ni una venta. Y una con cajas activas tampoco: esas cajas
   quedarían cobrando en un local que no existe. */
create or replace function cuidar_sucursal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.activa and not new.activa then
    if not exists (select 1 from sucursales where empresa_id = new.empresa_id and activa and id <> new.id) then
      raise exception 'Es la única sucursal activa: sin ella no habría dónde vender.' using errcode = 'P0031';
    end if;
    if exists (select 1 from cajas where sucursal_id = new.id and activa) then
      raise exception 'Tiene cajas activas: pasalas a otra sucursal o desactivalas primero.' using errcode = 'P0032';
    end if;
  end if;
  return new;
end;
$$;
create trigger cuidar_sucursal before update on sucursales
  for each row execute function cuidar_sucursal();


/* ---------- Cajas ---------- */
create or replace function caja_con_su_sucursal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sucursal_id is null then new.sucursal_id := primera_sucursal(new.empresa_id); end if;
  if new.sucursal_id is null then raise exception 'El comercio no tiene ninguna sucursal.'; end if;
  perform sucursal_del_comercio(new.sucursal_id, new.empresa_id);
  return new;
end;
$$;
create trigger caja_con_su_sucursal before insert or update of sucursal_id on cajas
  for each row execute function caja_con_su_sucursal();

update cajas set sucursal_id = primera_sucursal(empresa_id) where sucursal_id is null;
alter table cajas alter column sucursal_id set not null;


/* ---------- Sesiones: la de su caja ---------- */
create or replace function sesion_con_su_caja()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.caja_id is null then
    select id into new.caja_id from cajas
     where empresa_id = new.empresa_id and activa
     order by orden, creada_en limit 1;
  end if;
  if new.caja_id is null then
    raise exception 'El comercio no tiene ninguna caja activa.';
  end if;
  if not exists (select 1 from cajas where id = new.caja_id and empresa_id = new.empresa_id) then
    raise exception 'Esa caja no es de este comercio.';
  end if;
  /* Siempre la de la caja (0108), aunque venga otra: el mostrador está
     en un solo local. */
  select sucursal_id into new.sucursal_id from cajas where id = new.caja_id;
  return new;
end;
$$;

update sesiones_caja s set sucursal_id = c.sucursal_id
  from cajas c where c.id = s.caja_id and s.sucursal_id is distinct from c.sucursal_id;


/* ---------- Operaciones ---------- */
/* Completar la sucursal de una venta vieja no es tocarla: sin esto,
   tocar_operacion le ponía la fecha de hoy como última modificación a
   cientos de ventas. La bandera vale solo dentro de esta transacción. */
create or replace function tocar_operacion()
returns trigger language plpgsql as $$
begin
  if current_setting('genez.completando', true) = 'si' then return new; end if;
  new.actualizada_en  := now();
  new.actualizada_por := coalesce(auth.uid(), new.actualizada_por);
  return new;
end;
$$;
select set_config('genez.completando', 'si', true);

create or replace function operacion_con_su_sucursal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sucursal_id is null then new.sucursal_id := primera_sucursal(new.empresa_id); end if;
  perform sucursal_del_comercio(new.sucursal_id, new.empresa_id);
  return new;
end;
$$;
create trigger operacion_con_su_sucursal before insert on operaciones
  for each row execute function operacion_con_su_sucursal();

update operaciones o set sucursal_id = s.sucursal_id
  from movimientos_caja m join sesiones_caja s on s.id = m.sesion_id
 where m.operacion_id = o.id and o.sucursal_id is null;
update operaciones set sucursal_id = primera_sucursal(empresa_id) where sucursal_id is null;
select set_config('genez.completando', '', true);


/* ---------- Stock: la de su operación ---------- */
create or replace function stock_con_su_sucursal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sucursal_id is null and new.operacion_id is not null then
    select sucursal_id into new.sucursal_id from operaciones where id = new.operacion_id;
  end if;
  if new.sucursal_id is null then new.sucursal_id := primera_sucursal(new.empresa_id); end if;
  perform sucursal_del_comercio(new.sucursal_id, new.empresa_id);
  return new;
end;
$$;
create trigger stock_con_su_sucursal before insert on movimientos_stock
  for each row execute function stock_con_su_sucursal();

update movimientos_stock m set sucursal_id = o.sucursal_id
  from operaciones o where o.id = m.operacion_id and m.sucursal_id is null;
update movimientos_stock set sucursal_id = primera_sucursal(empresa_id) where sucursal_id is null;


/* ---------- Caja: la de su sesión ---------- */
create or replace function caja_mov_con_su_sucursal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.sesion_id is not null then
    select sucursal_id into new.sucursal_id from sesiones_caja where id = new.sesion_id;
  end if;
  if new.sucursal_id is null then new.sucursal_id := primera_sucursal(new.empresa_id); end if;
  return new;
end;
$$;
create trigger caja_mov_con_su_sucursal before insert on movimientos_caja
  for each row execute function caja_mov_con_su_sucursal();

update movimientos_caja m set sucursal_id = s.sucursal_id
  from sesiones_caja s where s.id = m.sesion_id and m.sucursal_id is distinct from s.sucursal_id;
update movimientos_caja set sucursal_id = primera_sucursal(empresa_id) where sucursal_id is null;

/* La venta, y su stock, a la sucursal de la caja donde se cobró. Va
   después del insert del movimiento de caja porque registrar_venta
   escribe primero la venta y su stock, y recién después la caja. */
create or replace function venta_en_la_sucursal_de_su_caja()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.operacion_id is null or new.sucursal_id is null then return new; end if;
  update operaciones set sucursal_id = new.sucursal_id
   where id = new.operacion_id and sucursal_id is distinct from new.sucursal_id;
  update movimientos_stock set sucursal_id = new.sucursal_id
   where operacion_id = new.operacion_id and sucursal_id is distinct from new.sucursal_id;
  return new;
end;
$$;
create trigger venta_en_la_sucursal_de_su_caja after insert on movimientos_caja
  for each row execute function venta_en_la_sucursal_de_su_caja();


/* ---------- Pasar mercadería de una sucursal a otra ---------- */
/* Sale de una y entra en la otra en la misma transacción: nunca queda
   la mitad. Con los permisos de quien llama (las políticas de siempre
   de movimientos_stock). No controla que haya stock en el origen: el
   stock de un almacén casi nunca está al día, y frenar el pase porque
   el sistema dice 3 cuando en la góndola hay 10 no ayuda a nadie. */
create or replace function transferir_stock(p_item uuid, p_cantidad numeric, p_desde uuid, p_hacia uuid, p_nota text default null)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_empresa uuid;
  v_desde text;
  v_hacia text;
begin
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad tiene que ser mayor que cero.' using errcode = 'P0033'; end if;
  if p_desde = p_hacia then raise exception 'El origen y el destino son la misma sucursal.' using errcode = 'P0034'; end if;
  select empresa_id into v_empresa from items where id = p_item;
  if v_empresa is null then raise exception 'No se encontró el producto.' using errcode = 'P0035'; end if;
  select nombre into v_desde from sucursales where id = p_desde and empresa_id = v_empresa;
  select nombre into v_hacia from sucursales where id = p_hacia and empresa_id = v_empresa and activa;
  if v_desde is null or v_hacia is null then raise exception 'Esa sucursal no es de este comercio o está desactivada.' using errcode = 'P0030'; end if;

  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, usuario_id, motivo)
  values (v_empresa, p_desde, p_item, -p_cantidad, 'transferencia', auth.uid(), trim(concat('A ', v_hacia, ' ', coalesce(p_nota, '')))),
         (v_empresa, p_hacia, p_item,  p_cantidad, 'transferencia', auth.uid(), trim(concat('Desde ', v_desde, ' ', coalesce(p_nota, ''))));
end;
$$;

grant execute on function transferir_stock(uuid, numeric, uuid, uuid, text) to authenticated;
revoke execute on function transferir_stock(uuid, numeric, uuid, uuid, text) from anon;


/* ---------- Los informes de ventas, por sucursal ---------- */
/* Con p_sucursal null dan lo mismo que antes: todas juntas. Se borran y
   se vuelven a crear porque cambia la firma; las pantallas las llaman
   con los parámetros por nombre, así que la vieja forma sigue andando. */
drop function if exists ventas_diarias_rango(uuid, date, date);
create function ventas_diarias_rango(p_empresa uuid, p_desde date, p_hasta date, p_sucursal uuid default null)
 RETURNS TABLE(fecha date, ventas numeric, costo numeric, tickets integer)
 LANGUAGE sql
 STABLE
AS $$
with zona as (
  select zona_de(p_empresa) as z
),
dias as (
  select d::date as fecha
  from generate_series(p_desde, p_hasta, interval '1 day') as d
),
/* signo: 1 para lo que se vendió, -1 para lo que se devolvió (0090). */
confirmadas as (
  select o.id, o.total, (o.fecha at time zone zona.z)::date as fecha,
         case when o.tipo = 'devolucion' then -1 else 1 end as signo
  from operaciones o, zona
  where o.empresa_id = p_empresa
    and o.tipo in ('venta', 'comanda', 'devolucion')
    and o.estado = 'confirmada'
    and (p_sucursal is null or o.sucursal_id = p_sucursal)
    and o.fecha >= (p_desde::timestamp at time zone zona.z)
    and o.fecha < ((p_hasta + 1)::timestamp at time zone zona.z)
),
ventas as (
  select fecha,
         sum(signo * total) as ventas,
         count(*) filter (where signo = 1) as tickets
  from confirmadas
  group by fecha
),
costos as (
  select c.fecha, sum(c.signo * l.cantidad * l.costo_unitario) as costo
  from confirmadas c
  join operacion_lineas l on l.operacion_id = c.id
  group by c.fecha
)
select d.fecha,
       coalesce(v.ventas, 0)           as ventas,
       coalesce(c.costo, 0)            as costo,
       coalesce(v.tickets, 0)::integer as tickets
from dias d
left join ventas v on v.fecha = d.fecha
left join costos c on c.fecha = d.fecha
order by d.fecha;
$$;

drop function if exists ventas_por_item_rango(uuid, date, date);
create function ventas_por_item_rango(p_empresa uuid, p_desde date, p_hasta date, p_sucursal uuid default null)
 RETURNS TABLE(item_id uuid, nombre text, categoria text, unidades numeric, venta numeric, costo numeric)
 LANGUAGE sql
 STABLE
AS $$
with zona as (
  select zona_de(p_empresa) as z
),
confirmadas as (
  select o.id, case when o.tipo = 'devolucion' then -1 else 1 end as signo
  from operaciones o, zona
  where o.empresa_id = p_empresa
    and o.tipo in ('venta', 'comanda', 'devolucion')
    and o.estado = 'confirmada'
    and (p_sucursal is null or o.sucursal_id = p_sucursal)
    and o.fecha >= (p_desde::timestamp at time zone zona.z)
    and o.fecha < ((p_hasta + 1)::timestamp at time zone zona.z)
),
lineas as (
  select
    l.item_id,
    /* El nombre de hoy si el producto existe; el que tenía al venderse si
       ya no. Que el informe diga lo mismo que el catálogo mientras el
       catálogo lo tenga. */
    coalesce(i.nombre, l.descripcion)                     as nombre,
    coalesce(nullif(i.categoria, ''), 'Sin rubro')        as categoria,
    c.signo * l.cantidad                                   as cantidad,
    c.signo * l.total                                      as total,
    c.signo * l.cantidad * l.costo_unitario                as costo
  from operacion_lineas l
  join confirmadas c on c.id = l.operacion_id
  left join items i on i.id = l.item_id
)
select
  /* No hay `min()` para uuid, y tampoco haría falta: alcanza con
     cualquiera de las fichas del grupo, que apuntan todas al mismo
     producto. Se descartan los nulos para que un producto que se borró y
     se volvió a crear conserve la ficha viva. */
  (array_agg(item_id) filter (where item_id is not null))[1] as item_id,
  nombre,
  min(categoria)            as categoria,
  sum(cantidad)::numeric    as unidades,
  sum(total)::numeric       as venta,
  sum(costo)::numeric       as costo
from lineas
/* Por nombre y no por item_id: así las líneas de un producto ya borrado
   —que tienen item_id en null— se juntan entre ellas en vez de caer todas
   en un único renglón sin nombre. */
group by nombre
order by venta desc;
$$;

