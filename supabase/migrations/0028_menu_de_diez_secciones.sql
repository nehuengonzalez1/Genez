/* ============================================================
   0028 · EL MENÚ DEFINITIVO DE DIEZ SECCIONES
   ============================================================

   La arquitectura final de Genez son diez secciones y no quince módulos
   sueltos. Esta migración la deja planteada para el rubro de servicios sin
   tocar una línea de las pantallas que ya andan.

   Dos reglas nuevas en la forma del menú:

   `proximo` marca una sección que va a existir y todavía no. Se dibuja
   apagada, con el motivo al pasar el mouse. Es la misma decisión que las
   acciones rápidas del tablero: preferimos que se vea a dónde va el
   sistema antes que esconderlo, pero sin que nada aparente funcionar.

   `i` es el ícono de la sección, que hace falta justamente para poder
   dibujarla cuando todavía no tiene ningún módulo adentro que le preste
   el suyo.

   Y una convención de dibujo, que vive en el navegador: una sección con un
   solo módulo se dibuja como un renglón con el nombre de la sección, no
   con el del módulo. Así "Clientes y equipo" es una fila y no un rótulo
   con "Clientes" colgando abajo. Cuando una sección junte dos o más
   módulos, ahí sí van a hacer falta las pestañas internas, que es el
   siguiente paso y no este.

   Comercio y gastronomía no se tocan: siguen con su grupo único sin
   rótulo, exactamente como estaban.
   ============================================================ */

update rubros set menu = '[
  {"clave":"inicio", "nombre": null, "i":"panel", "modulos":[
    {"k":"inicio","n":"Inicio","i":"panel","d":"Cómo viene el negocio hoy"}
  ]},

  {"clave":"agenda", "nombre":"Agenda", "i":"agenda", "proximo": true, "modulos":[]},

  {"clave":"gente", "nombre":"Clientes y equipo", "i":"gente", "modulos":[
    {"k":"clientes","n":"Clientes","i":"gente","d":"Ficha, historial y turnos de cada cliente"}
  ]},

  {"clave":"catalogo", "nombre":"Servicios y recursos", "i":"tuerca", "proximo": true, "modulos":[]},

  {"clave":"ventas", "nombre":"Ventas", "i":"bolsa", "proximo": true, "modulos":[]},

  {"clave":"finanzas", "nombre":"Finanzas", "i":"billetera", "modulos":[
    {"k":"caja","n":"Caja","i":"billetera","d":"Ingresos, egresos y arqueo del día"}
  ]},

  {"clave":"crm", "nombre":"CRM y marketing", "i":"corazon", "proximo": true, "modulos":[]},

  {"clave":"comunicaciones", "nombre":"Comunicaciones", "i":"mensaje", "proximo": true, "modulos":[]},

  {"clave":"reportes", "nombre":"Reportes", "i":"barras", "modulos":[
    {"k":"reportes","n":"Informes","i":"barras","d":"Qué se vende, qué deja plata y qué cambió"}
  ]},

  {"clave":"config", "nombre":"Configuración", "i":"tuerca", "modulos":[
    {"k":"ajustes","n":"Ajustes","i":"tuerca","d":"Configuración del negocio y del sistema"}
  ]}
]'::jsonb
where clave = 'servicios';

select
  g ->> 'clave'                              as seccion,
  coalesce(g ->> 'nombre', '(sin rótulo)')   as rotulo,
  jsonb_array_length(g -> 'modulos')         as modulos,
  coalesce(g ->> 'proximo', 'false')         as proximo
from rubros r, jsonb_array_elements(r.menu) with ordinality x(g, orden)
where r.clave = 'servicios'
order by x.orden;
