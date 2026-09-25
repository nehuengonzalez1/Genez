/* ============================================================
   0091 · MERCADO PAGO, UNA CUENTA POR COMERCIO
   ============================================================

   Hasta acá había un solo token de Mercado Pago para toda la plataforma
   (MP_ACCESS_TOKEN en Vercel). Cualquier usuario con sesión, de cualquier
   comercio, veía los cobros de esa cuenta: quién pagó, cuánto y cuándo.
   Con un solo comercio real daba igual; con el segundo, uno vería la
   plata del otro.

   Ahora cada comercio carga el token de SU cuenta desde Ajustes →
   Mercado Pago, y `api/mp/pagos` pregunta con el token del comercio de
   quien llama.

   El token se guarda cifrado (AES-256-GCM, la misma llave maestra que la
   clave privada de ARCA, ver api/arca/_cifrado.js): con él se puede leer
   la cuenta de alguien. La tabla no tiene ninguna política para el
   navegador; la lee y la escribe solo el servidor con la service_role,
   igual que arca_credenciales (0084).

   `cuenta_id` es el id de la cuenta de Mercado Pago, que se pregunta al
   guardar (/users/me). Con él se distingue un cobro que entra de un pago
   que sale, sin preguntarlo en cada sondeo.
   ============================================================ */

create table mp_credenciales (
  empresa_id     uuid primary key references empresas(id) on delete cascade,
  token_cifrado  text not null,
  cuenta_id      text not null,
  cuenta_nombre  text,
  cuenta_email   text,
  verificada_en  timestamptz not null default now(),
  cargada_por    uuid references perfiles(id) on delete set null,
  actualizada_en timestamptz not null default now()
);

comment on table mp_credenciales is
  'El token de Mercado Pago de cada comercio, cifrado. Solo lo toca el servidor (api/mp/).';

alter table mp_credenciales enable row level security;
revoke all on mp_credenciales from anon, authenticated;
