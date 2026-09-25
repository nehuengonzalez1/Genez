/* ============================================================
   0093 · CAMBIO DE TITULAR FISCAL
   ============================================================

   Super 25 pasa a facturar con otro CUIT (septiembre de 2026). Hasta acá
   el sistema suponía que un comercio es siempre el mismo contribuyente, y
   tres cosas se rompían el día que dejaba de serlo.

   1 · UNA FACTURA REIMPRESA CAMBIABA DE DUEÑO
   -------------------------------------------
   El ticket tomaba razón social, CUIT, IIBB, inicio y domicilio de los
   Ajustes del momento en que se imprime. Reimpresa después del cambio, la
   C 00005-00000001 de Alex Gonzalez hubiera salido con el nombre y el CUIT
   del titular nuevo, y el QR —que sale del comprobante— con el viejo.

   Ahora cada comprobante guarda en `emisor` los datos fiscales con que se
   pidió el CAE, y el papel usa esos. Los que ya existen se completan con
   los Ajustes si son del mismo CUIT; los del titular anterior, con sus
   datos escritos acá (ver abajo).

   2 · UNA NOTA SOBRE UNA FACTURA DEL TITULAR ANTERIOR
   ---------------------------------------------------
   Una devolución de una factura queda marcada fiscal y entra en la fila
   de CAE como nota de crédito. Si la factura es de otro CUIT que el de la
   conexión de hoy, esa nota saldría con el CUIT nuevo acreditando una
   factura del viejo: ARCA la rechaza. Y peor: la fila de CAE se pide en
   orden y corta en el primer error, así que esa nota trabaría todas las
   facturas que vinieran después, para siempre.

   Lo mismo con una factura de otro ambiente (homologación, cuando ya se
   factura de verdad), que ya estaba prohibido en `_arca.js` pero igual
   entraba en la fila.

   Ahora la devolución de una factura de otro titular o de otro ambiente
   se hace igual —vuelve el stock, sale la plata— pero NO pide nota de
   crédito: queda anotado que la nota la tiene que hacer quien emitió la
   factura, desde ARCA. La nota de débito sobre una factura así no se
   deja. Y sin conexión con ARCA (en pleno cambio de titular), la
   devolución de una factura espera: no se sabe todavía con qué CUIT va a
   salir la nota.

   3 · EL CAMBIO EN SÍ
   -------------------
   No está acá: es `api/arca/conexion.js`, acción `certificado` con
   `cambiarTitular`, solo para la plataforma. Carga el certificado del CUIT
   nuevo y borra la conexión; el comercio vuelve a probar y activar como
   la primera vez.
   ============================================================ */

alter table comprobantes add column emisor jsonb;
comment on column comprobantes.emisor is
  'Los datos fiscales del emisor cuando se pidió el CAE (razón social, CUIT, IIBB, inicio, domicilio, condición). Es lo que va impreso: los Ajustes pueden cambiar de titular después.';

/* Los que ya existen: con los datos de hoy, que son los del titular que
   los emitió (ver arriba: esto corre antes del cambio).

   Un comprobante autorizado no se modifica (`cuidar_comprobante`, 0082),
   y está bien que así sea. Para completar el emisor, y solo eso, el
   disparador se apaga durante esta actualización. Adentro de la
   transacción de la migración: ninguna otra conexión lo ve apagado —la
   tabla queda bloqueada hasta el commit— y si algo falla, vuelve como
   estaba. */
alter table comprobantes disable trigger cuidar_comprobante;

update comprobantes c
   set emisor = jsonb_strip_nulls(jsonb_build_object(
         'razonSocial',   e.config->'fiscal'->>'razonSocial',
         'nombreFactura', e.config->'fiscal'->>'nombreFactura',
         'cuit',          e.config->'fiscal'->>'cuit',
         'iibb',          e.config->'fiscal'->>'iibb',
         'inicio',        e.config->'fiscal'->>'inicio',
         'domicilio',     e.config->'fiscal'->>'domicilio',
         'condicion',     e.config->'fiscal'->>'condicion'))
  from empresas e
 where e.id = c.empresa_id and c.emisor is null
   and (c.modo = 'homologacion'
        or regexp_replace(coalesce(e.config->'fiscal'->>'cuit', ''), '\D', '', 'g') = c.cuit);

/* Los de un CUIT que ya no es el de los datos fiscales no pueden salir de
   ahí. Es Super 25: cuando se aplicó esto, sus datos fiscales ya eran los
   de Alfredo Daniel Gonzalez, y la única factura de producción que tenía
   —la C 00005-00000001, por $1— es de Alex Gonzalez. Sus datos, como
   estaban en Ajustes cuando se emitió. */
update comprobantes
   set emisor = jsonb_build_object(
         'razonSocial',   'Alex Gonzalez',
         'nombreFactura', 'Super 25',
         'cuit',          '20412574738',
         'iibb',          '20412574738',
         'inicio',        '01/08/2026',
         'domicilio',     'Rio de la Plata 8905, Loma Hermosa',
         'condicion',     'MONOTRIBUTO')
 where emisor is null and modo = 'produccion' and cuit = '20412574738'
   and empresa_id = '125cb871-351a-49f5-b984-a14983b788c4';

/* Y si quedara alguno sin emisor, que se note acá y no en un papel. */
do $$
begin
  if exists (select 1 from comprobantes where emisor is null) then
    raise exception 'Quedaron comprobantes sin emisor: revisar antes de aplicar 0093.';
  end if;
end $$;

alter table comprobantes enable trigger cuidar_comprobante;


/* La vista de facturas, igual a la de 0089 con el emisor al final. */
create or replace view facturas_vista
with (security_invoker = true)
as
select
  o.id                 as operacion_id,
  o.empresa_id,
  o.numero             as numero_interno,
  o.fecha,
  o.total,
  o.cliente_id,
  coalesce(cl.razon_social, o.comprobante->'cliente'->>'nombre') as cliente,
  case c.estado
    when 'autorizado' then 'autorizada'
    when 'pendiente'  then 'pidiendo'
    else 'sin_cae'
  end                  as estado,
  c.id                 as comprobante_id,
  c.modo,
  c.cuit,
  c.letra,
  c.tipo,
  c.punto_venta,
  c.numero,
  c.cae,
  c.cae_vto,
  c.fecha              as fecha_factura,
  c.doc_tipo,
  c.doc_nro,
  (select r.error from comprobantes r
    where r.operacion_id = o.id and r.estado = 'rechazado'
    order by r.creado_en desc limit 1) as ultimo_error,
  o.tipo               as operacion_tipo,
  coalesce(o.comprobante->>'nota', 'factura') as clase,
  c.emisor
from operaciones o
left join comprobantes c on c.operacion_id = o.id and c.estado <> 'rechazado'
left join clientes cl on cl.id = o.cliente_id
where o.tipo in ('venta', 'devolucion')
  and o.estado = 'confirmada'
  and o.comprobante->>'fiscal' = 'true'
  and not (o.comprobante ? 'cae');


/* ------------------------------------------------------------
   ¿Se le puede hacer una nota a esta factura desde la conexión de hoy?
   ------------------------------------------------------------
   'si'         mismo CUIT y mismo ambiente que la conexión.
   'otra'       la emitió otro titular, u otro ambiente: la nota no sale
                de acá.
   'sin_conexion' el comercio no está conectado ahora (en pleno cambio).
   null         la venta no tiene factura autorizada. */
create or replace function nota_posible(p_venta uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when c.id is null then null
    when a.empresa_id is null then 'sin_conexion'
    when c.modo <> a.modo then 'otra'
    when a.modo = 'produccion' and c.cuit <> a.cuit then 'otra'
    else 'si'
  end
  from (select 1) uno
  left join comprobantes c on c.operacion_id = p_venta and c.estado = 'autorizado'
  left join arca_conexiones a on a.empresa_id = c.empresa_id
$$;

revoke execute on function nota_posible(uuid) from public, anon, authenticated;


/* ------------------------------------------------------------
   Registrar una devolución: igual a 0089, salvo qué pasa con la nota
   ------------------------------------------------------------ */
create or replace function registrar_devolucion(
  p_venta  uuid,
  p_lineas jsonb,
  p_sesion uuid,
  p_medio  text,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta    operaciones%rowtype;
  v_fiscal   boolean;
  v_nota     text;
  v_sin_nota boolean := false;
  v_id       uuid := gen_random_uuid();
  v_numero   text;
  v_sub      numeric := 0;
  v_total    numeric;
  v_factor   numeric;
  v_devuelto numeric;
  v_pedida   record;
  v_linea    operacion_lineas%rowtype;
begin
  select * into v_venta from operaciones where id = p_venta;
  if v_venta.id is null or not public.puede_ver(v_venta.empresa_id) then
    raise exception 'La venta no existe.' using errcode = 'P0020';
  end if;
  if not public.permiso('anular') then
    raise exception 'Tu usuario no puede hacer devoluciones.' using errcode = 'P0021';
  end if;
  if v_venta.tipo not in ('venta', 'comanda') or v_venta.estado <> 'confirmada' then
    raise exception 'Solo se devuelve una venta cobrada.' using errcode = 'P0020';
  end if;
  if coalesce(p_medio, '') = '' then
    raise exception 'Falta con qué se reintegra.' using errcode = 'P0020';
  end if;
  if p_medio = 'cuenta_corriente' and v_venta.cliente_id is null then
    raise exception 'Una venta sin cliente no se reintegra a cuenta corriente.' using errcode = 'P0020';
  end if;
  if p_medio <> 'cuenta_corriente' and not exists (
    select 1 from sesiones_caja where id = p_sesion and empresa_id = v_venta.empresa_id and cerrada_en is null
  ) then
    raise exception 'Abrí la caja para hacer la devolución: el reintegro sale de ahí.' using errcode = 'P0001';
  end if;

  v_fiscal := coalesce(v_venta.comprobante->>'fiscal', '') = 'true' and not (v_venta.comprobante ? 'cae');
  if v_fiscal then
    v_nota := nota_posible(v_venta.id);
    if v_nota is null then
      raise exception 'La factura todavía no tiene CAE: la devolución se hace cuando ARCA la autorice.' using errcode = 'P0022';
    end if;
    if v_nota = 'sin_conexion' then
      raise exception 'El comercio no está conectado con ARCA en este momento: la devolución de una factura espera a que se conecte.'
        using errcode = 'P0022';
    end if;
    /* De otro titular o de otro ambiente: se devuelve igual, sin nota
       de Genez (ver el encabezado). */
    if v_nota = 'otra' then
      v_fiscal := false;
      v_sin_nota := true;
    end if;
  end if;

  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Elegí qué se devuelve.' using errcode = 'P0020';
  end if;

  v_numero := siguiente_numero_interno(v_venta.empresa_id, 'DEV');

  insert into operaciones (id, empresa_id, sucursal_id, tipo, estado, numero, fecha, cliente_id, usuario_id,
                           subtotal, descuento, recargo, total, comprobante, campos_extra, origen_id)
  values (v_id, v_venta.empresa_id, v_venta.sucursal_id, 'devolucion', 'confirmada', v_numero, now(),
          v_venta.cliente_id, auth.uid(), 0, 0, 0, 0,
          case when v_fiscal then jsonb_build_object('fiscal', true, 'nota', 'credito') else '{}'::jsonb end,
          jsonb_strip_nulls(jsonb_build_object(
            'medio', p_medio,
            'motivo', nullif(btrim(coalesce(p_motivo, '')), ''),
            'nota_fuera', case when v_sin_nota then 'La factura es de otro titular o de otro ambiente de ARCA: la nota de crédito la hace quien la emitió, desde ARCA.' end)),
          v_venta.id);

  for v_pedida in
    select (x->>'linea_id')::uuid linea_id, (x->>'cantidad')::numeric cantidad
    from jsonb_array_elements(p_lineas) x
  loop
    select * into v_linea from operacion_lineas
     where id = v_pedida.linea_id and operacion_id = v_venta.id and estado <> 'anulada';
    if v_linea.id is null then
      raise exception 'Ese renglón no es de esta venta.' using errcode = 'P0020';
    end if;
    if not (v_pedida.cantidad > 0) then
      raise exception 'La cantidad a devolver tiene que ser mayor que cero.' using errcode = 'P0020';
    end if;

    select coalesce(sum(l.cantidad), 0) into v_devuelto
    from operacion_lineas l join operaciones o on o.id = l.operacion_id
    where l.origen_linea_id = v_linea.id and o.estado = 'confirmada';
    if v_pedida.cantidad > v_linea.cantidad - v_devuelto then
      raise exception 'De "%" quedan % para devolver.', v_linea.descripcion, v_linea.cantidad - v_devuelto
        using errcode = 'P0023';
    end if;

    /* Lo cobrado por unidad es total/cantidad, no precio_unitario: un
       precio bajado a mano guarda ahí el de lista. */
    insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
                                  precio_unitario, costo_unitario, iva, total, origen_linea_id)
    values (v_id, v_venta.empresa_id, v_linea.item_id, v_linea.descripcion, v_pedida.cantidad,
            round(v_linea.total / nullif(v_linea.cantidad, 0), 2), v_linea.costo_unitario, v_linea.iva,
            round(v_linea.total / nullif(v_linea.cantidad, 0) * v_pedida.cantidad),
            v_linea.id);
  end loop;

  select coalesce(sum(total), 0) into v_sub from operacion_lineas where operacion_id = v_id;

  /* El descuento y el recargo de la venta, repartidos en proporción. */
  v_factor := case when coalesce(v_venta.subtotal, 0) > 0 then v_venta.total / v_venta.subtotal else 1 end;
  v_total := round(v_sub * v_factor);
  /* Y nunca más de lo que se cobró, sumando las devoluciones anteriores. */
  v_total := least(v_total, v_venta.total - coalesce((
    select sum(o.total) from operaciones o
    where o.origen_id = v_venta.id and o.tipo = 'devolucion' and o.estado = 'confirmada' and o.id <> v_id
  ), 0));
  if not (v_total > 0) then
    raise exception 'No queda nada por reintegrar de esta venta.' using errcode = 'P0023';
  end if;

  update operaciones
     set subtotal = v_sub, descuento = greatest(v_sub - v_total, 0),
         recargo = greatest(v_total - v_sub, 0), total = v_total
   where id = v_id;

  insert into movimientos_stock (empresa_id, sucursal_id, item_id, cantidad, tipo, operacion_id, usuario_id, fecha)
  select v_venta.empresa_id, v_venta.sucursal_id, i.id, l.cantidad, 'devolucion', v_id, auth.uid(), now()
  from operacion_lineas l join items i on i.id = l.item_id
  where l.operacion_id = v_id and i.controla_stock;

  if p_medio = 'cuenta_corriente' then
    insert into cuenta_corriente_ajustes (empresa_id, cliente_id, tipo, monto, motivo, usuario_id)
    values (v_venta.empresa_id, v_venta.cliente_id, 'descuento', v_total,
            'Devolución ' || v_numero || ' de la venta ' || coalesce(v_venta.numero, ''), auth.uid());
  else
    insert into movimientos_caja (empresa_id, sucursal_id, sesion_id, tipo, medio, monto, detalle, operacion_id, usuario_id, fecha)
    values (v_venta.empresa_id, v_venta.sucursal_id, p_sesion, 'egreso', p_medio, v_total,
            'Devolución ' || v_numero || ' · venta ' || coalesce(v_venta.numero, ''), v_id, auth.uid(), now());
  end if;

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_venta.empresa_id, auth.uid(), 'venta.devolucion', 'operaciones', v_id,
          jsonb_build_object('numero', v_numero, 'venta', v_venta.numero, 'total', v_total,
                             'medio', p_medio, 'motivo', p_motivo, 'nota_credito', v_fiscal,
                             'factura_de_otro_titular', v_sin_nota));

  return v_id;
end;
$$;

grant execute on function registrar_devolucion(uuid, jsonb, uuid, text, text) to authenticated;


/* ------------------------------------------------------------
   Nota de débito: igual a 0089, y solo sobre una factura propia
   ------------------------------------------------------------ */
create or replace function registrar_nota_debito(
  p_venta    uuid,
  p_concepto text,
  p_monto    numeric,
  p_sesion   uuid,
  p_medio    text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta  operaciones%rowtype;
  v_id     uuid := gen_random_uuid();
  v_numero text;
  v_monto  numeric := round(coalesce(p_monto, 0));
  v_nota   text;
begin
  select * into v_venta from operaciones where id = p_venta;
  if v_venta.id is null or not public.puede_ver(v_venta.empresa_id) then
    raise exception 'La venta no existe.' using errcode = 'P0020';
  end if;
  if not public.permiso('anular') then
    raise exception 'Tu usuario no puede hacer notas de débito.' using errcode = 'P0021';
  end if;
  v_nota := nota_posible(v_venta.id);
  if v_nota is null then
    raise exception 'La nota de débito va sobre una factura con CAE.' using errcode = 'P0022';
  end if;
  if v_nota = 'sin_conexion' then
    raise exception 'El comercio no está conectado con ARCA en este momento.' using errcode = 'P0022';
  end if;
  if v_nota = 'otra' then
    raise exception 'La factura es de otro titular o de otro ambiente de ARCA: la nota de débito la hace quien la emitió.'
      using errcode = 'P0022';
  end if;
  if not (v_monto > 0) then
    raise exception 'El importe tiene que ser mayor que cero.' using errcode = 'P0020';
  end if;
  if length(btrim(coalesce(p_concepto, ''))) = 0 then
    raise exception 'Falta el concepto de la nota de débito.' using errcode = 'P0020';
  end if;
  if p_medio = 'cuenta_corriente' and v_venta.cliente_id is null then
    raise exception 'Una venta sin cliente no se carga a cuenta corriente.' using errcode = 'P0020';
  end if;

  v_numero := siguiente_numero_interno(v_venta.empresa_id, 'ND');

  insert into operaciones (id, empresa_id, sucursal_id, tipo, estado, numero, fecha, cliente_id, usuario_id,
                           subtotal, descuento, recargo, total, comprobante, origen_id)
  values (v_id, v_venta.empresa_id, v_venta.sucursal_id, 'venta', 'confirmada', v_numero, now(),
          v_venta.cliente_id, auth.uid(), v_monto, 0, 0, v_monto,
          jsonb_build_object('fiscal', true, 'nota', 'debito'), v_venta.id);

  insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, costo_unitario, iva, total)
  values (v_id, v_venta.empresa_id, null, btrim(p_concepto), 1, v_monto, 0, 21, v_monto);

  /* Se cobra como cualquier venta: pago, caja (o cuenta corriente, que así
     suma a la deuda) y la sesión obligatoria. */
  perform confirmar_operacion(v_id, p_sesion, jsonb_build_array(jsonb_build_object('medio', p_medio, 'monto', v_monto)));

  insert into bitacora (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
  values (v_venta.empresa_id, auth.uid(), 'venta.nota_debito', 'operaciones', v_id,
          jsonb_build_object('numero', v_numero, 'factura', v_venta.numero, 'total', v_monto,
                             'concepto', btrim(p_concepto), 'medio', p_medio));

  return v_id;
end;
$$;

grant execute on function registrar_nota_debito(uuid, text, numeric, uuid, text) to authenticated;
