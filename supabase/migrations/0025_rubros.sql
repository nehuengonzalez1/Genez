/* ============================================================
   0025 · EL MENÚ ES DATO
   ============================================================

   Hasta acá el menú era una lista fija escrita en el código, pensada para
   un minimercado. Reemplazarla por otra lista fija pensada para una
   estética dejaba el mismo problema para el rubro siguiente: cada negocio
   nuevo obligaba a tocar componentes.

   Ahora los grupos, qué módulos caen en cada uno, en qué orden y cómo se
   llaman salen de una fila. Agregar "Genez para gimnasios" pasa a ser un
   insert.

   Es la misma decisión que `canales` en el centro de pedidos: el flujo de
   un pedido vive en una fila y por eso mostrador no tiene "en camino" y
   delivery sí, sin un solo `if`.

   El ícono va como nombre y no como componente, obviamente: la base no
   sabe de React. El navegador traduce nombre → ícono, y si no lo conoce
   usa uno neutro en vez de romper la pantalla.
   ============================================================ */

create table rubros (
  clave    text primary key,
  nombre   text not null,
  /* [{ clave, nombre, modulos: [{ k, n, d, i }] }]
     `nombre` en null es un grupo sin rótulo: se dibuja la lista pelada,
     que es como se ve hoy. */
  menu     jsonb   not null default '[]',
  /* Cómo llama cada rubro a las mismas cosas: turno, clase, sesión, cita.
     Mismo mecanismo que VOZ_MESA y VOZ_CANAL en la comanda. */
  voces    jsonb   not null default '{}',
  /* Con qué módulos arranca un comercio de este rubro. Sugerencia para el
     alta, no una restricción: después se contrata lo que se quiera. */
  modulos  text[]  not null default '{}',
  orden    integer not null default 0,
  activo   boolean not null default true
);

comment on column rubros.menu is
  'Grupos del menú y sus módulos. Un módulo listado acá igual no se ve si el comercio no lo contrató o el rol no lo habilita.';

alter table rubros enable row level security;

/* La forma del producto no es dato de nadie: cualquiera con sesión la lee.
   Escribirla es de plataforma. */
create policy rubros_leer on rubros
  for select to authenticated using (true);

create policy rubros_escribir on rubros
  for all to authenticated using (public.es_plataforma()) with check (public.es_plataforma());

/* ------------------------------------------------------------
   Los rubros que ya existen

   Estos dos reproducen el menú actual **exactamente**: un solo grupo sin
   rótulo y el mismo orden. Super 25 y el Bar Rivadavia no tienen que notar
   que algo cambió. La agrupación de verdad la estrena el rubro nuevo.
   ------------------------------------------------------------ */

insert into rubros (clave, nombre, orden, modulos, voces, menu) values
(
  'minimercado', 'Comercio', 10,
  array['cobro','caja','ajustes','productos','stock','compras','pedidos','clientes','reportes','asistente'],
  '{"cliente": "Cliente", "clientes": "Clientes"}'::jsonb,
  '[{
    "clave": "todo", "nombre": null,
    "modulos": [
      {"k":"inicio",   "n":"Inicio",    "i":"panel",    "d":"Cómo viene el negocio hoy"},
      {"k":"pedidos",  "n":"Pedidos",   "i":"planilla", "d":"Preparación con pistola y control de faltantes"},
      {"k":"clientes", "n":"Clientes",  "i":"gente",    "d":"Para emitir facturas A, B o C según corresponda"},
      {"k":"productos","n":"Productos", "i":"caja",     "d":"Costos, precios y margen de todo tu catálogo"},
      {"k":"stock",    "n":"Stock",     "i":"cajas",    "d":"Qué reponer, qué vence y qué no se mueve"},
      {"k":"compras",  "n":"Compras",   "i":"camion",   "d":"Cargar remitos, pedidos sugeridos y proveedores"},
      {"k":"caja",     "n":"Caja",      "i":"billetera","d":"Ingresos, egresos y arqueo del día"},
      {"k":"reportes", "n":"Informes",  "i":"barras",   "d":"Qué se vende, qué deja plata y qué cambió"},
      {"k":"asistente","n":"Asistente", "i":"chispas",  "d":"Tus datos explicados y qué conviene hacer"},
      {"k":"ajustes",  "n":"Ajustes",   "i":"tuerca",   "d":"Configuración del negocio y del sistema"}
    ]
  }]'::jsonb
),
(
  'gastronomia', 'Gastronomía', 20,
  array['cobro','caja','ajustes','comandas','cocina','productos','stock','compras','clientes','reportes'],
  '{"cliente": "Cliente", "clientes": "Clientes"}'::jsonb,
  '[{
    "clave": "todo", "nombre": null,
    "modulos": [
      {"k":"inicio",   "n":"Inicio",    "i":"panel",    "d":"Cómo viene el negocio hoy"},
      {"k":"comandas", "n":"Salón",     "i":"cubiertos","d":"Qué mesa está ocupada, qué lleva y cuánto hace que espera"},
      {"k":"cocina",   "n":"Cocina",    "i":"cocina",   "d":"Lo que hay que preparar, en el orden en que se pidió"},
      {"k":"clientes", "n":"Clientes",  "i":"gente",    "d":"Para emitir facturas A, B o C según corresponda"},
      {"k":"productos","n":"Productos", "i":"caja",     "d":"Costos, precios y margen de todo tu catálogo"},
      {"k":"stock",    "n":"Stock",     "i":"cajas",    "d":"Qué reponer, qué vence y qué no se mueve"},
      {"k":"compras",  "n":"Compras",   "i":"camion",   "d":"Cargar remitos, pedidos sugeridos y proveedores"},
      {"k":"caja",     "n":"Caja",      "i":"billetera","d":"Ingresos, egresos y arqueo del día"},
      {"k":"reportes", "n":"Informes",  "i":"barras",   "d":"Qué se vende, qué deja plata y qué cambió"},
      {"k":"asistente","n":"Asistente", "i":"chispas",  "d":"Tus datos explicados y qué conviene hacer"},
      {"k":"ajustes",  "n":"Ajustes",   "i":"tuerca",   "d":"Configuración del negocio y del sistema"}
    ]
  }]'::jsonb
),
/* ------------------------------------------------------------
   El rubro nuevo

   Solo se listan módulos que existen hoy. A medida que se construyan la
   agenda, el equipo, los abonos y las finanzas, se agregan filas acá y
   aparecen solas en el menú: eso es lo que estamos comprando con este
   cambio.
   ------------------------------------------------------------ */
(
  'servicios', 'Servicios y turnos', 30,
  array['cobro','caja','ajustes','clientes','reportes'],
  '{"cliente": "Cliente", "clientes": "Clientes", "turno": "Turno", "turnos": "Turnos", "profesional": "Profesional", "profesionales": "Profesionales"}'::jsonb,
  '[
    {"clave":"inicio", "nombre": null, "modulos":[
      {"k":"inicio","n":"Inicio","i":"panel","d":"Cómo viene el negocio hoy"}
    ]},
    {"clave":"gente", "nombre":"Clientes y equipo", "modulos":[
      {"k":"clientes","n":"Clientes","i":"gente","d":"Ficha, historial y turnos de cada cliente"}
    ]},
    {"clave":"finanzas", "nombre":"Finanzas", "modulos":[
      {"k":"caja","n":"Caja","i":"billetera","d":"Ingresos, egresos y arqueo del día"},
      {"k":"reportes","n":"Informes","i":"barras","d":"Qué se vende, qué deja plata y qué cambió"}
    ]},
    {"clave":"config", "nombre":"Configuración", "modulos":[
      {"k":"ajustes","n":"Ajustes","i":"tuerca","d":"Configuración del negocio y del sistema"}
    ]}
  ]'::jsonb
)
on conflict (clave) do update
  set nombre = excluded.nombre, menu = excluded.menu,
      voces = excluded.voces, modulos = excluded.modulos, orden = excluded.orden;

/* ------------------------------------------------------------
   Qué quedó
   ------------------------------------------------------------ */

select
  r.clave, r.nombre,
  jsonb_array_length(r.menu) as grupos,
  (select count(*) from jsonb_array_elements(r.menu) g,
          jsonb_array_elements(g -> 'modulos')) as modulos_en_el_menu,
  (select count(*) from empresas e where e.rubro = r.clave) as comercios
from rubros r
order by r.orden;
