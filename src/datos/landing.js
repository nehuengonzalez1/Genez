/* ============================================================
   LANDING · cómo se presenta cada rubro
   ============================================================

   La landing es pública y no tiene sesión, así que no puede leer `rubros`
   —`rubros_leer` es para `authenticated`—. Lee `rubros_publicos()`, que
   devuelve solo lo que sirve para presentarse: clave, nombre y
   `presentacion`. Ni el menú, ni los módulos, ni las reglas.

   EL RESPALDO DE FÁBRICA
   ----------------------
   Hasta que la función esté aplicada en la base —o si la base no
   contesta— la landing tiene que verse igual: son los mismos tres rubros
   que hoy existen, con el mismo texto que siembra la migración que crea
   `presentacion`. Si se cambia uno, se cambia el otro. Un rubro nuevo
   aparece solo cuando su fila lo tenga; acá no se inventa ninguno.
   ============================================================ */

/* El cliente de Supabase se importa recién al consultar, y no arriba:
   `supabase.js` lanza si faltan las variables de entorno, y una página
   pública no puede morirse por eso. Sin variables, sin función o sin
   red, quedan las cards de fábrica. */

export const RUBROS_DE_FABRICA = [
  {
    clave: "minimercado",
    nombre: "Comercio",
    modulos: ["cobro", "caja", "ajustes", "productos", "stock", "compras", "pedidos", "clientes", "reportes", "asistente", "permisos"],
    presentacion: {
      titulo: "Comercio y minimercado",
      bajada: "Cobrá con lector, controlá el stock y sabé qué deja plata.",
      para: "Almacenes, minimercados, kioscos, dietéticas",
      icono: "carrito",
      destacados: ["Cobro con lector de códigos", "Stock y vencimientos", "Compras y remitos por foto", "Caja e informes"],
      preguntas: [
        { k: "peso", n: "Vendo por peso (fiambre, verdura, pan)", modulos: [], necesita: ["Balanza que imprima etiquetas con código de barras"] },
        { k: "cajas", n: "Tengo más de una caja", modulos: [], necesita: ["Una computadora o tablet por caja"] },
        { k: "factura", n: "Facturo A y B", modulos: ["clientes"], necesita: [] },
        { k: "pedidos", n: "Tomo pedidos para preparar o enviar", modulos: ["pedidos"], necesita: [] },
      ],
    },
  },
  {
    clave: "gastronomia",
    nombre: "Gastronomía",
    modulos: ["cobro", "caja", "ajustes", "comandas", "cocina", "productos", "stock", "compras", "clientes", "reportes", "permisos"],
    presentacion: {
      titulo: "Bar, café y restaurante",
      bajada: "Mesas, comandas y cocina en la misma pantalla.",
      para: "Bares, cafés, restaurantes, take away",
      icono: "cubiertos",
      destacados: ["Salón con plano de mesas", "Comandas y cocina", "Centro de pedidos y delivery", "Caja e informes"],
      preguntas: [
        { k: "mesas", n: "Tengo salón con mesas", modulos: ["comandas"], necesita: [] },
        { k: "delivery", n: "Hago delivery o take away", modulos: ["comandas"], necesita: ["Un teléfono con WhatsApp para los pedidos"] },
        { k: "cocina", n: "Tengo cocina aparte de la barra", modulos: ["comandas"], necesita: ["Una impresora de comandas en la cocina"] },
        { k: "factura", n: "Facturo A y B", modulos: ["clientes"], necesita: [] },
      ],
    },
  },
  {
    clave: "servicios",
    nombre: "Servicios y turnos",
    modulos: ["cobro", "caja", "ajustes", "clientes", "reportes", "agenda", "equipo", "ventas", "finanzas", "servicios", "informes", "crm", "comunicaciones", "permisos"],
    presentacion: {
      titulo: "Turnos, clases y planes",
      bajada: "Agenda, abonos y una app para que tus clientes reserven solos.",
      para: "Estéticas, pilates, gimnasios, peluquerías, consultorios",
      icono: "agenda",
      destacados: ["Agenda con turnos y clases", "Abonos y packs", "Equipo y liquidaciones", "App del cliente con reservas", "Avisos por WhatsApp"],
      preguntas: [
        { k: "clases", n: "Doy clases grupales con cupo", modulos: ["agenda"], necesita: [] },
        { k: "abonos", n: "Vendo packs o abonos", modulos: ["ventas"], necesita: [] },
        { k: "equipo", n: "Trabajan otras personas conmigo", modulos: ["equipo", "finanzas"], necesita: [] },
        { k: "app", n: "Quiero que reserven solos desde el celular", modulos: ["agenda", "comunicaciones"], necesita: ["Un nombre para tu dirección: <nombre>.genez.com.ar"] },
      ],
    },
  },
];

export async function cargarRubrosPublicos() {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.rpc("rubros_publicos");
  if (error) throw error;
  return (data || [])
    .filter((r) => r.presentacion && r.presentacion.titulo)
    .map((r) => ({ clave: r.clave, nombre: r.nombre, modulos: r.modulos || [], presentacion: r.presentacion }));
}
