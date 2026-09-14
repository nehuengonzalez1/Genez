/* ============================================================
   0072 · CADA RUBRO SE PRESENTA SOLO
   ============================================================

   La landing pública muestra una card por rubro y el alta guiada
   arranca eligiendo una. Ese texto —título comercial, bajada, para
   quién es, qué módulos destaca y qué preguntas hacerle a quien
   llega— no puede vivir en el componente: agregar un rubro a la
   landing tiene que ser un insert, igual que agregarlo al sistema
   (0025).

   POR QUÉ UNA FUNCIÓN Y NO LA TABLA
   ---------------------------------
   `rubros_leer` es para `authenticated` y la landing no tiene sesión.
   Abrir la tabla al público expondría el menú y las reglas de cada
   rubro, que no son de nadie de afuera. La función es `security
   definer` a propósito —salta RLS— y devuelve solo lo que sirve para
   presentarse, más `modulos`: con qué arranca un comercio del rubro, que
   es lo que el alta guiada propone en su paso 3 y lo que la landing ya
   muestra con otras palabras. Mismo criterio que `marca_de`: pública
   por diseño, y por eso angosta.

   Cada pregunta del paso 2 dice qué módulos enciende y qué necesita el
   comercio de su lado para que eso sirva: es dato, así un rubro nuevo
   trae sus preguntas sin tocar el stepper. `nucleo` son los módulos que
   un comercio del rubro usa sí o sí (la carta en un bar, la agenda en
   un consultorio): van siempre, además de los base del catálogo. Lo
   demás entra solo si una pregunta lo enciende o la persona lo suma a
   mano de entre `modulos`. Por eso las preguntas cubren cada módulo
   opcional del rubro: nada entra por defecto ni queda sin forma de
   pedirlo. Así el presupuesto sale de lo que respondió y no del rubro
   entero.

   EL RESPALDO DE FÁBRICA
   ----------------------
   `src/datos/landing.js` tiene estos mismos tres rubros escritos para
   dibujar la landing aunque la base no conteste. Si se cambia un texto
   acá, se cambia allá.
   ============================================================ */

alter table rubros
  add column if not exists presentacion jsonb not null default '{}'::jsonb;

comment on column rubros.presentacion is
  'Cómo se presenta el rubro en la landing y en el alta guiada: titulo, bajada, para, icono, destacados[], nucleo[] (módulos que van siempre), preguntas[{k, n, modulos[], necesita[]}]. Vacío = no se muestra.';

update rubros set presentacion = $json$
{
  "titulo": "Comercio y minimercado",
  "bajada": "Cobrá con lector, controlá el stock y sabé qué deja plata.",
  "para": "Almacenes, minimercados, kioscos, dietéticas",
  "icono": "carrito",
  "destacados": ["Cobro con lector de códigos", "Stock y vencimientos", "Compras y remitos por foto", "Caja e informes"],
  "nucleo": ["productos", "reportes"],
  "preguntas": [
    { "k": "stock", "n": "Controlo el stock y los vencimientos", "modulos": ["stock"], "necesita": [] },
    { "k": "compras", "n": "Compro a proveedores con remito o factura", "modulos": ["compras"], "necesita": [] },
    { "k": "peso", "n": "Vendo por peso (fiambre, verdura, pan)", "modulos": [], "necesita": ["Balanza que imprima etiquetas con código de barras"] },
    { "k": "cajas", "n": "Tengo más de una caja", "modulos": [], "necesita": ["Una computadora o tablet por caja"] },
    { "k": "factura", "n": "Facturo A y B", "modulos": ["clientes"], "necesita": [] },
    { "k": "pedidos", "n": "Tomo pedidos para preparar o enviar", "modulos": ["pedidos"], "necesita": [] },
    { "k": "equipo", "n": "Trabajan otras personas conmigo", "modulos": ["permisos"], "necesita": [] },
    { "k": "asistente", "n": "Quiero que el sistema me diga qué mirar cada día", "modulos": ["asistente"], "necesita": [] }
  ]
}
$json$::jsonb where clave = 'minimercado';

update rubros set presentacion = $json$
{
  "titulo": "Bar, café y restaurante",
  "bajada": "Mesas, comandas y cocina en la misma pantalla.",
  "para": "Bares, cafés, restaurantes, take away",
  "icono": "cubiertos",
  "destacados": ["Salón con plano de mesas", "Comandas y cocina", "Centro de pedidos y delivery", "Caja e informes"],
  "nucleo": ["productos", "reportes"],
  "preguntas": [
    { "k": "mesas", "n": "Tengo salón con mesas", "modulos": ["comandas"], "necesita": [] },
    { "k": "cocina", "n": "Tengo cocina aparte de la barra", "modulos": ["comandas"], "necesita": ["Una impresora de comandas en la cocina"] },
    { "k": "delivery", "n": "Hago delivery o take away", "modulos": ["comandas"], "necesita": ["Un teléfono con WhatsApp para los pedidos"] },
    { "k": "stock", "n": "Controlo el stock de insumos", "modulos": ["stock"], "necesita": [] },
    { "k": "compras", "n": "Compro a proveedores con remito o factura", "modulos": ["compras"], "necesita": [] },
    { "k": "factura", "n": "Facturo A y B", "modulos": ["clientes"], "necesita": [] },
    { "k": "equipo", "n": "Trabajan otras personas conmigo", "modulos": ["permisos"], "necesita": [] }
  ]
}
$json$::jsonb where clave = 'gastronomia';

update rubros set presentacion = $json$
{
  "titulo": "Turnos, clases y planes",
  "bajada": "Agenda, abonos y una app para que tus clientes reserven solos.",
  "para": "Estéticas, pilates, gimnasios, peluquerías, consultorios",
  "icono": "agenda",
  "destacados": ["Agenda con turnos y clases", "Abonos y packs", "Equipo y liquidaciones", "App del cliente con reservas", "Avisos por WhatsApp"],
  "nucleo": ["servicios", "agenda", "informes"],
  "preguntas": [
    { "k": "clases", "n": "Doy clases grupales con cupo", "modulos": [], "necesita": ["Los horarios y el cupo de cada clase"] },
    { "k": "abonos", "n": "Vendo packs o abonos", "modulos": ["ventas"], "necesita": [] },
    { "k": "equipo", "n": "Trabajan otras personas conmigo", "modulos": ["equipo", "permisos"], "necesita": [] },
    { "k": "sueldos", "n": "Liquido sueldos o comisiones al equipo", "modulos": ["finanzas"], "necesita": [] },
    { "k": "app", "n": "Quiero que reserven solos desde el celular", "modulos": ["comunicaciones"], "necesita": ["Un nombre para tu dirección: <nombre>.genez.com.ar"] },
    { "k": "avisos", "n": "Quiero recordatorios de turno por WhatsApp", "modulos": ["comunicaciones"], "necesita": [] },
    { "k": "volver", "n": "Quiero saber a quién escribirle para que vuelva", "modulos": ["crm"], "necesita": [] },
    { "k": "factura", "n": "Facturo A y B", "modulos": ["clientes"], "necesita": [] }
  ]
}
$json$::jsonb where clave = 'servicios';

/* Solo los rubros activos y con presentación cargada: uno sin texto
   no aparece, en vez de aparecer vacío. */
create or replace function rubros_publicos()
returns table (clave text, nombre text, orden integer, modulos text[], presentacion jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select r.clave, r.nombre, r.orden, r.modulos, r.presentacion
  from rubros r
  where r.activo
    and r.presentacion ->> 'titulo' is not null
  order by r.orden;
$$;

grant execute on function rubros_publicos() to anon, authenticated;

comment on function rubros_publicos() is
  'Lo que la landing y el alta guiada necesitan de cada rubro, sin sesión. Solo presentación: ni menú, ni módulos, ni reglas.';

select clave, presentacion ->> 'titulo' as titulo from rubros order by orden;
