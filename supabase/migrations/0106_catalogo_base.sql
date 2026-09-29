/* ============================================================
   0106 · El catálogo base
   ============================================================

   Un comercio nuevo empieza con la góndola llena y el sistema vacío: cada
   producto se da de alta escribiendo el nombre a mano, con la pistola en
   la otra mano. Pero la mayoría de lo que vende un almacén lo venden
   también las cadenas grandes, y esas publican por obligación qué venden
   (SEPA, Precios Claros, Res. 678/2020), con licencia CC-BY 4.0.

   Medido el 29/09 contra Super 25: el 79% de sus códigos está en un solo
   día de SEPA. Esta tabla guarda esa lista para que el alta aparezca con
   el nombre, la marca y la presentación ya puestos, y solo haya que
   escribir el precio.

   Qué NO guarda, a propósito:
   - Precios ni costos. Son de cada comercio; el de una cadena grande no
     le sirve a un almacén de barrio y confundiría más de lo que ayuda.
   - Nada de ningún comercio. Sale solo de SEPA: que crezca con las altas
     de los comercios sería pasar datos de uno a otro, y eso se piensa
     aparte.

   Es dato de plataforma, como roles_base: la leen todos los que tienen
   sesión y no la escribe nadie desde el navegador. La carga
   scripts/cargar-catalogo-base.mjs, a mano, cada tanto.
   ============================================================ */

create table catalogo_base (
  ean            text primary key,
  nombre         text not null,
  marca          text,
  presentacion   text,
  rubro          text,
  cadenas        integer not null default 1,
  fuente         text not null default 'SEPA',
  actualizado_en timestamptz not null default now(),
  constraint catalogo_base_ean_valido check (ean ~ '^[1-9][0-9]{5,13}$')
);

comment on table catalogo_base is
  'Productos con código de barras publicados por SEPA (Precios Claros, CC-BY 4.0). Dato de plataforma: sugiere el alta, nunca pisa lo que el comercio cargó.';
comment on column catalogo_base.ean is
  'Sin ceros adelante: la pistola lee un UPC de 12 dígitos como 13 con un cero, y SEPA lo publica de las dos formas.';
comment on column catalogo_base.rubro is
  'Asignado por palabras clave al cargar (src/utils/catalogo.js). SEPA no trae rubro.';
comment on column catalogo_base.cadenas is
  'En cuántas cadenas apareció. Más cadenas, más confiable la descripción.';

alter table catalogo_base enable row level security;

create policy catalogo_base_ver on catalogo_base
  for select to authenticated using (true);

/* Sin políticas de escritura: con RLS prendido, authenticated no puede
   insertar, cambiar ni borrar. El grant se revoca igual para que el error
   sea "permiso denegado" y no cero filas sin aviso. */
revoke insert, update, delete, truncate on catalogo_base from anon, authenticated;
revoke select on catalogo_base from anon;
