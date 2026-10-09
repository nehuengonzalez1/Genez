/* ============================================================
   0142 · EL SUBDOMINIO DE CADA COMERCIO, SOLO
   ============================================================

   Cada comercio tiene su sitio en `slug.genez.com.ar` (0052, 0141). Para
   que un subdominio ande hacen falta dos cosas:

     1. que resuelva: un comodín `*` en el DNS de genez.com.ar (Cloudflare)
        que apunta a Vercel. Se carga una vez y vale para todos.
     2. que Vercel sepa que es de este proyecto, y le saque el certificado
        HTTPS. Eso es por subdominio: Vercel solo acepta un comodín si el
        DNS entero es suyo, y el de genez.com.ar está en Cloudflare porque
        el mail pasa por Cloudflare Email Routing.

   Nehuen (09/10): "quiero que sea automático, no que yo ande colocando
   cosas en Vercel ni dependa de mí". Así que el punto 2 lo hace el
   servidor (api/_subdominios.js) con la API de Vercel:
     - cuando alguien del comercio entra al sistema y su subdominio no
       está listo;
     - todos los días, en el cron, para los que falten (también los que
       crea la plataforma).

   Esta tabla guarda cómo quedó cada uno, para mostrarlo en Tienda online
   ("Lista", "Preparando", "Hubo un problema") y en el panel de la
   plataforma, que tiene que ver cuántos van: el plan Hobby de Vercel deja
   50 dominios por proyecto.

   Escribe solo el servidor (service_role). El comercio lee la suya; la
   plataforma, todas.
   ============================================================ */

create table subdominios (
  empresa_id     uuid primary key references empresas(id) on delete cascade,
  host           text not null unique,
  estado         text not null default 'pendiente',
  detalle        text,
  intentos       integer not null default 0,
  actualizado_en timestamptz not null default now(),
  constraint subdominios_estado check (estado in ('pendiente', 'listo', 'error'))
);

alter table subdominios enable row level security;
revoke all on subdominios from anon;
revoke insert, update, delete on subdominios from authenticated;
create policy subdominios_ver on subdominios
  for select using (public.puede_ver(empresa_id) or public.es_plataforma());

comment on table subdominios is
  'Si Vercel ya tiene el subdominio de cada comercio (0142). Lo escribe api/_subdominios.js.';
