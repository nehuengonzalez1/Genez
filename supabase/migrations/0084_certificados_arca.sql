/* ============================================================
   0084 · EL CERTIFICADO DE CADA COMERCIO
   ============================================================

   Para facturar de verdad, cada comercio le habla a ARCA con su propio
   certificado. Genez genera la clave privada y el pedido (CSR), el dueño
   lo sube a ARCA con su Clave Fiscal, y trae el certificado de vuelta.
   Ver `api/arca/_certificados.js`.

   NADIE LO LEE MÁS QUE EL SERVIDOR
   --------------------------------
   Esta tabla no tiene políticas: con RLS prendido y ninguna política,
   `authenticated` y `anon` no ven ni una fila. Además se les sacan los
   permisos de la tabla, porque Supabase se los da a todo lo que se crea
   y una política agregada por error mañana los volvería a abrir. La lee
   y la escribe `api/arca/` con la service_role.

   Y aun así la clave y el pase de ARCA van cifrados (`_cifrado.js`):
   quien se lleve un backup de la base no se lleva la firma fiscal de
   ningún comercio.

   EL PEDIDO VA APARTE DEL CERTIFICADO QUE ESTÁ ANDANDO
   ----------------------------------------------------
   Un certificado de ARCA vence a los dos años. Para renovarlo hay que
   generar un pedido nuevo, y mientras el dueño hace el trámite el
   comercio tiene que seguir facturando con el viejo. Por eso el pedido
   en curso (`pedido_*`) vive al lado del que está en uso, y recién pasa
   a reemplazarlo cuando llega el certificado que le corresponde.
   ============================================================ */

create table arca_credenciales (
  empresa_id            uuid primary key references empresas(id) on delete cascade,

  -- El certificado en uso y su clave.
  clave_cifrada         text,
  certificado           text,
  cert_cuit             text,
  cert_alias            text,
  cert_emisor           text,
  cert_desde            timestamptz,
  cert_vence            timestamptz,
  certificado_en        timestamptz,

  -- El pedido en curso, esperando que ARCA emita su certificado.
  pedido_clave_cifrada  text,
  pedido_csr            text,
  pedido_cuit           text,
  pedido_alias          text,
  pedido_en             timestamptz,

  -- El pase de WSAA: dura 12 horas y ARCA no da otro mientras esté
  -- vigente, así que se comparte entre todas las funciones.
  ta_cifrado            text,
  ta_vence              timestamptz,

  -- El resultado de la última prueba de conexión.
  prueba                jsonb,

  actualizada_en        timestamptz not null default now(),

  constraint arca_cert_con_clave check (certificado is null or (clave_cifrada is not null and cert_cuit ~ '^\d{11}$' and cert_vence is not null)),
  constraint arca_pedido_completo check (pedido_csr is null or (pedido_clave_cifrada is not null and pedido_cuit ~ '^\d{11}$'))
);

comment on table arca_credenciales is
  'Clave privada (cifrada) y certificado de ARCA de cada comercio. Solo la toca el servidor.';

alter table arca_credenciales enable row level security;
revoke all on arca_credenciales from anon, authenticated;
