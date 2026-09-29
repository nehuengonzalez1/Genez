/* ============================================================
   0100 · EL CAEA: FACTURAR CUANDO ARCA NO CONTESTA
   ============================================================

   Hasta acá, con ARCA caído la venta se cobraba y la factura quedaba
   esperando el CAE: no salía ningún papel hasta que ARCA volviera. Desde
   el 01/08/2026 (RG 5782/2025, corrida por la RG 5852/2026) el CAEA es
   la primera opción de contingencia para quien factura por web service.

   Cómo funciona, en corto:
   - ARCA da un CAEA por CUIT y por quincena (1–15, 16–fin). Se pide ANTES
     de necesitarlo: con ARCA caído no se puede pedir. Lo pide una tarea
     diaria (api/arca/caea.js), desde 5 días antes del inicio.
   - Se emite desde un punto de venta PROPIO de tipo CAEA (art. 5), que
     el titular crea en ARCA. Tenerlo cargado es lo que activa el CAEA en
     un comercio: `arca_conexiones.punto_venta_caea`. Sin él, todo sigue
     como antes.
   - Lo emitido se informa después (FECAEARegInformativo), y si en la
     quincena no se usó, se informa "sin movimiento". Las dos cosas hasta
     8 días después de cerrada la quincena. Si no se hacen, es un
     incumplimiento: por eso lo hace la tarea diaria y no una persona.
   - No sirve para la M (art. 3): un comercio en clase M sigue esperando
     el CAE.

   El análisis normativo está en el doc "Genez: consulta fiscal sobre
   facturas A y B" y en la memoria del proyecto (caea).
   ============================================================ */

/* ------------------------------------------------------------
   La conexión: el punto de venta CAEA y cómo le fue a la tarea
   ------------------------------------------------------------ */

alter table arca_conexiones
  add column punto_venta_caea integer
    check (punto_venta_caea between 1 and 99998),
  add column caea_estado jsonb;

comment on column arca_conexiones.punto_venta_caea is
  'El punto de venta de tipo CAEA que el titular creó en ARCA. Null = el comercio no usa CAEA. Ver 0100.';
comment on column arca_conexiones.caea_estado is
  'La última vuelta de la tarea diaria del CAEA: cuándo corrió y qué quedó sin hacer. Lo lee Ajustes para avisar.';

/* Un punto de venta CAEA no puede ser el mismo del CAE: ARCA los separa y
   los numera aparte. */
alter table arca_conexiones
  add constraint arca_caea_otro_punto check (punto_venta_caea is null or punto_venta_caea <> punto_venta);


/* ------------------------------------------------------------
   Los CAEA otorgados, uno por comercio, CUIT y quincena
   ------------------------------------------------------------ */

create table arca_caea (
  id                   uuid primary key default gen_random_uuid(),
  empresa_id           uuid not null references empresas(id) on delete cascade,
  modo                 text not null check (modo in ('homologacion', 'produccion')),
  cuit                 text not null,
  periodo              integer not null,            -- aaaamm
  orden                smallint not null check (orden in (1, 2)),
  caea                 text not null check (caea ~ '^\d{14}$'),
  vig_desde            date not null,
  vig_hasta            date not null,
  tope_informar        date not null,
  /* "Sin movimiento": si en la quincena no se emitió nada con este CAEA,
     se le informa a ARCA. Cuándo se hizo, o por qué no se pudo. */
  sin_movimiento_en    timestamptz,
  sin_movimiento_error text,
  creado_en            timestamptz not null default now(),
  unique (empresa_id, modo, cuit, periodo, orden)
);

comment on table arca_caea is
  'Los CAEA que dio ARCA, por quincena. Los pide y los cierra la tarea diaria (api/arca/caea.js). Ver 0100.';

alter table arca_caea enable row level security;
revoke insert, update, delete on arca_caea from anon, authenticated;

create policy arca_caea_ver on arca_caea
  for select using (public.puede_ver(empresa_id));


/* ------------------------------------------------------------
   El comprobante dice con qué se autorizó
   ------------------------------------------------------------
   Un comprobante con CAEA nace autorizado: el código ya lo dio ARCA para
   la quincena. `cae` guarda el CAEA y `cae_vto` el fin de la quincena,
   así el candado "autorizado con CAE" (0082) sigue valiendo. */

alter table comprobantes
  add column autorizacion text not null default 'CAE'
    check (autorizacion in ('CAE', 'CAEA'));

comment on column comprobantes.autorizacion is
  'CAE (pedido en el momento) o CAEA (anticipado, en contingencia). Con CAEA, cae guarda el CAEA. Ver 0100.';


/* ------------------------------------------------------------
   Lo que se le informó a ARCA de cada comprobante con CAEA
   ------------------------------------------------------------
   Aparte y no en `comprobantes`, porque lo autorizado no se toca
   (`cuidar_comprobante`, 0082): informarlo es algo que le pasa después,
   no un cambio del comprobante. */

create table caea_informes (
  comprobante_id  uuid primary key references comprobantes(id),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  informado_en    timestamptz,
  error           text,
  intentos        integer not null default 0,
  respuesta       jsonb,
  actualizado_en  timestamptz not null default now()
);

comment on table caea_informes is
  'Si cada comprobante con CAEA ya se informó a ARCA (FECAEARegInformativo), o por qué no. Ver 0100.';

alter table caea_informes enable row level security;
revoke insert, update, delete on caea_informes from anon, authenticated;

create policy caea_informes_ver on caea_informes
  for select using (public.puede_ver(empresa_id));


/* La vista de facturas, con la autorización al final (una vista solo
   admite columnas nuevas al final): el papel dice "CAEA" y el QR lleva
   otro tipo de código. El resto, igual que en 0098. */
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
  c.emisor,
  c.neto,
  c.iva,
  c.detalle_iva,
  c.autorizacion
from operaciones o
left join comprobantes c on c.operacion_id = o.id and c.estado <> 'rechazado'
left join clientes cl on cl.id = o.cliente_id
where o.tipo in ('venta', 'devolucion')
  and o.estado = 'confirmada'
  and o.comprobante->>'fiscal' = 'true'
  and not (o.comprobante ? 'cae');
