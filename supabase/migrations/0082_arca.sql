/* ============================================================
   0082 · LA FACTURA ELECTRÓNICA, POR COMERCIO
   ============================================================

   Hasta acá la integración con ARCA era un endpoint suelto que tomaba el
   CUIT de una variable de Vercel —uno solo para toda la plataforma— y el
   total que le mandara el navegador. Servía para ver que Afip SDK
   contestaba; no para que factura cada comercio con lo suyo.

   Dos tablas:

   `arca_conexiones` dice con qué CUIT y qué punto de venta factura cada
   comercio, y contra qué ambiente. La escribe solo la plataforma. No es
   desconfianza del comercio: es que el CUIT con el que se pide un CAE es
   la identidad fiscal de alguien, y un encargado con `configurar` que se
   equivoca de número factura a nombre de otro. La condición frente al IVA
   sí sigue en `empresas.config.fiscal`, que es la declaración del propio
   comercio y lo que va impreso; si miente, ARCA rechaza la letra.

   `comprobantes` es cada pedido de CAE, con su resultado. Va aparte de
   `operaciones` porque la venta es append-only (regla 2): el CAE llega
   después —a veces bastante después, si se cortó internet— y no hay forma
   de escribirlo en la venta sin editarla. Además una venta puede tener
   más de un intento, y el rechazado también tiene que quedar.

   Ninguna de las dos se escribe desde el navegador: no hay política de
   insert ni de update para `authenticated`. Las escribe `api/arca/` con
   la service_role. Un comprobante con un CAE inventado es lo que había
   antes de esta migración —el cobro lo fabricaba con una cuenta— y la
   única forma de que no vuelva a pasar es que nadie más que el servidor,
   con la respuesta de ARCA en la mano, pueda escribir uno.
   ============================================================ */

create table arca_conexiones (
  empresa_id     uuid primary key references empresas(id) on delete cascade,
  modo           text not null default 'homologacion',
  cuit           text,
  punto_venta    int  not null,
  verificada_en  timestamptz,
  ultimo_error   text,
  creada_en      timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  constraint arca_modo_valido check (modo in ('homologacion', 'produccion')),
  /* Un punto de venta de ARCA va de 1 a 99998. El 0 no existe y es
     justo lo que queda si alguien guarda el "0001" de la config sin
     convertirlo. */
  constraint arca_punto_venta_valido check (punto_venta between 1 and 99998),
  /* En homologación se usa el CUIT de pruebas de Afip SDK, así que el
     propio puede faltar. En producción no hay a nombre de quién facturar
     sin él. El coalesce no sobra: con el CUIT en null la comparación da
     null, y un check que da null deja pasar la fila. */
  constraint arca_produccion_con_cuit check (modo = 'homologacion' or coalesce(cuit, '') ~ '^\d{11}$')
);

comment on table arca_conexiones is
  'Con qué CUIT y punto de venta factura cada comercio. Solo la escribe la plataforma.';
comment on column arca_conexiones.verificada_en is
  'Última vez que ARCA contestó con este CUIT y punto de venta. Null: nunca se probó.';

alter table arca_conexiones enable row level security;

create policy arca_conexiones_ver on arca_conexiones
  for select using (public.puede_ver(empresa_id));

create policy arca_conexiones_plataforma on arca_conexiones
  for all using (public.es_plataforma()) with check (public.es_plataforma());


create table comprobantes (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references empresas(id) on delete cascade,
  /* restrict y no cascade: una venta con factura no se borra, y si algo
     intenta borrarla tiene que fallar acá y no llevarse el CAE puesto. */
  operacion_id       uuid not null references operaciones(id) on delete restrict,
  /* La factura que corrige una nota de crédito. */
  asociado_id        uuid references comprobantes(id) on delete restrict,
  modo               text not null,
  cuit               text not null,
  punto_venta        int  not null,
  tipo               int  not null,
  letra              text not null,
  numero             int  not null,
  estado             text not null default 'pendiente',
  cae                text,
  cae_vto            date,
  fecha              date not null,
  total              numeric(14,2) not null,
  neto               numeric(14,2) not null,
  iva                numeric(14,2) not null default 0,
  doc_tipo           int  not null,
  doc_nro            bigint not null default 0,
  condicion_receptor int  not null,
  /* Lo que se mandó y lo que ARCA contestó, tal cual. Es lo único que
     sirve el día que haya que explicarle a un contador por qué un número
     salió rechazado. */
  pedido             jsonb not null default '{}',
  respuesta          jsonb,
  error              text,
  usuario_id         uuid references perfiles(id) on delete set null,
  creado_en          timestamptz not null default now(),
  resuelto_en        timestamptz,
  constraint comprobantes_modo_valido   check (modo in ('homologacion', 'produccion')),
  constraint comprobantes_estado_valido check (estado in ('pendiente', 'autorizado', 'rechazado')),
  /* Factura y nota de crédito A, B y C. Nada más hasta que haga falta. */
  constraint comprobantes_tipo_valido   check (tipo in (1, 3, 6, 8, 11, 13)),
  constraint comprobantes_autorizado_con_cae check (estado <> 'autorizado' or (cae is not null and cae_vto is not null))
);

/* EL NÚMERO LO PONE ARCA, Y DOS CAJAS LO PIDEN A LA VEZ
   ------------------------------------------------------
   El número que sigue se sabe preguntándole a ARCA cuál fue el último.
   Si dos cajas preguntan al mismo tiempo, las dos oyen "el 41" y las dos
   mandan el 42: una sale autorizada y la otra rechazada, en el mejor caso.

   El candado es este índice: un solo comprobante pendiente por serie. El
   que llega segundo choca contra la fila del primero y espera su turno.
   No hace falta sostener una transacción abierta mientras ARCA contesta
   —que es lo que haría un advisory lock, y supabase-js no puede— y si el
   servidor se cae a la mitad, la fila pendiente queda como evidencia de
   que hay un número que averiguar antes de seguir. */
create unique index comprobantes_un_pendiente_por_serie
  on comprobantes (modo, cuit, punto_venta, tipo)
  where estado = 'pendiente';

create unique index comprobantes_numero_autorizado
  on comprobantes (modo, cuit, punto_venta, tipo, numero)
  where estado = 'autorizado';

/* Una venta, una factura. Los rechazados no cuentan: se reintenta. */
create unique index comprobantes_una_por_operacion
  on comprobantes (operacion_id)
  where estado <> 'rechazado';

create index on comprobantes (empresa_id, creado_en desc);

comment on table comprobantes is
  'Cada pedido de CAE a ARCA y lo que contestó. Solo lo escribe el servidor.';

alter table comprobantes enable row level security;

create policy comprobantes_ver on comprobantes
  for select using (public.puede_ver(empresa_id));


/* LO AUTORIZADO NO SE TOCA
   ------------------------
   Ni con la service_role. Un comprobante pendiente se resuelve una vez
   —autorizado o rechazado— y de ahí no se mueve: anular una factura es
   emitir una nota de crédito, igual que anular una venta es una
   devolución.

   Borrar se permite solo en homologación, que no tiene validez fiscal y
   es lo que las pruebas necesitan limpiar. */
create or replace function public.cuidar_comprobante()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.modo = 'produccion' then
      raise exception 'Un comprobante de producción no se borra: se anula con una nota de crédito.';
    end if;
    return old;
  end if;

  if old.estado <> 'pendiente' then
    raise exception 'El comprobante ya está %, no se modifica.', old.estado;
  end if;

  if new.modo <> old.modo or new.cuit <> old.cuit or new.punto_venta <> old.punto_venta
     or new.tipo <> old.tipo or new.numero <> old.numero or new.operacion_id <> old.operacion_id
     or new.total <> old.total then
    raise exception 'De un comprobante pendiente solo cambia el resultado.';
  end if;

  new.resuelto_en := coalesce(new.resuelto_en, case when new.estado <> 'pendiente' then now() end);
  return new;
end;
$$;

create trigger cuidar_comprobante
  before update or delete on comprobantes
  for each row execute function public.cuidar_comprobante();
