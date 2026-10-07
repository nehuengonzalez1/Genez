/* ============================================================
   RECORRIDOS GUIADOS · paso a paso sobre la pantalla real (07/10)
   ============================================================

   Lo pidió Nehuen con un video de otro sistema de gestión: que cada
   tarea —la primera venta, cargar un proveedor, una factura, ver los
   informes— se pueda aprender haciéndola, en la pantalla de verdad. El
   motor (Recorrido.jsx) oscurece todo menos el botón del paso, explica
   qué hace y avanza cuando se toca.

   Los pasos apuntan a lo que se ve —el texto del botón, el placeholder
   de un campo, el rótulo de un campo— y no a clases ni ids: es lo mismo
   que lee la persona, y si un botón cambia de nombre se corrige acá, en
   un solo lugar. Los textos salen de leer cada pantalla (07/10).

   Un paso:
     donde     a dónde ir antes: "cobro" o la clave de una sección.
     en        qué resaltar (ver los ayudantes de abajo). Sin `en`, el
               cartel va en el medio.
     t, d      título y explicación.
     avanza    "clic": cuando se toca lo resaltado. Si no, con "Seguir".
     espera    si aparece alguno de estos, se pasa solo al siguiente.
     opcional  si no aparece enseguida, se saltea (la caja ya abierta,
               una pestaña que tu rol no ve).

   Cada recorrido dice de qué sección es (`modulo`) y para qué rubros:
   solo se ofrece si el comercio tiene esa sección.
   ============================================================ */

const B = (texto, extra = {}) => ({ texto, ...extra });
const Campo = (campo) => ({ campo });
const Entrada = (placeholder) => ({ placeholder });
const Algo = (texto) => ({ texto, en: "*" });

export const RECORRIDOS = [
  {
    id: "primera-venta", modulo: "cobro", rubros: ["minimercado"],
    titulo: "Hacer una venta",
    d: "De abrir la caja a entregar el ticket.",
    pasos: [
      { donde: "cobro", en: B(/^Abrir caja con/), avanza: "clic", opcional: true, espera: [Entrada("Escaneá o escribí")],
        t: "Abrí la caja", d: "Antes de la primera venta del día, contá el efectivo del cajón y abrí la caja con ese monto." },
      { en: Entrada("Escaneá o escribí"),
        t: "Buscá el producto", d: "Escribí el nombre o escaneá el código de barras y apretá Enter: se suma a la venta. Para cambiar la cantidad del último, escribí el número y Enter. Cuando tengas todo, tocá Seguir." },
      /* El botón dice el total: "Cobrar $4.800 F2". */
      { en: B(/^Cobrar $/), avanza: "clic", espera: [B(/Efectivo/)],
        t: "Cobrá", d: "Tocá Cobrar (o Enter con el campo vacío, o F2)." },
      { en: B(/Efectivo/), espera: [B(/Confirmar cobro/), B(/Nueva venta/)],
        t: "Elegí cómo paga", d: "Tocá el medio de pago o apretá su número. Con 6 combinás dos medios. Mercado Pago muestra el QR; efectivo te pregunta con cuánto paga." },
      { en: B(/Confirmar cobro/), avanza: "clic", opcional: true,
        t: "Confirmá", d: "Si te dice con cuánto paga, el sistema calcula el vuelto. Si paga justo, dejalo vacío y confirmá." },
      { en: B(/Nueva venta/),
        t: "¡Venta hecha!", d: "Quedó guardada y descontó el stock. Desde acá imprimís el ticket (I), lo mandás por WhatsApp (W) o por mail (E). Nueva venta (Enter) empieza la próxima. Si te equivocaste, F3 muestra las últimas ventas." },
    ],
  },
  {
    id: "cargar-producto", modulo: "productos",
    titulo: "Cargar un producto",
    d: "Nombre, costo, precio y stock.",
    pasos: [
      { donde: "productos", en: B(/^(Nuevo producto|Nuevo)$/), avanza: "clic",
        t: "Nuevo producto", d: "Desde acá se carga uno por uno. También se abre solo si escaneás un código que no existe." },
      { en: Campo("Nombre"), t: "El nombre", d: "Como lo vas a buscar en la caja. Si tiene código de barras, escanealo en el campo de abajo." },
      { en: Campo("Costo"), t: "Costo y precio", d: "Cargá lo que te cuesta y el precio de venta: el margen se calcula solo. Si ponés el margen, calcula el precio." },
      { en: Campo("Stock actual"), opcional: true, t: "El stock", d: "Cuántos tenés y el mínimo: cuando baje de ahí, aparece en \"Para reponer\"." },
      { en: B(/^Crear producto$/), avanza: "clic", t: "Guardalo", d: "Listo para vender." },
      { en: B(/^Importar$/), opcional: true,
        t: "¿Tenés muchos?", d: "Con Exportar bajás una planilla con el formato exacto. La completás y la subís con Importar: te muestra qué va a crear y qué va a cambiar antes de aplicar." },
    ],
  },
  {
    id: "cargar-proveedor", modulo: "compras",
    titulo: "Cargar un proveedor",
    d: "Sus datos y cómo te vende.",
    pasos: [
      { donde: "compras", en: B(/^Proveedores$/), avanza: "clic", t: "Proveedores", d: "Los que te venden, con sus datos." },
      { en: B(/Nuevo proveedor/), avanza: "clic", t: "Nuevo proveedor", d: "" },
      { en: Campo("Nombre"), t: "Los datos", d: "El nombre como lo conocés (\"Coca\", \"Maxiconsumo\"), el CUIT, el teléfono, cómo le pagás y qué días entrega." },
      { en: B(/^Guardar$/), avanza: "clic", t: "Guardalo", d: "Ya lo podés elegir al cargar una compra." },
    ],
  },
  {
    id: "cargar-compra", modulo: "compras",
    titulo: "Cargar una compra",
    d: "Lo que llegó del proveedor: suma stock y actualiza costos.",
    pasos: [
      { donde: "compras", en: B(/^Cargar compra$/), avanza: "clic", t: "Cargar compra", d: "Cuando llega la mercadería." },
      { en: Entrada("Nº de remito"), t: "El proveedor y el remito", d: "Elegí a la izquierda de quién es la compra y anotá el número de remito o factura." },
      { en: Algo(/^Con la pistola$/), t: "Los productos", d: "Escaneá cada producto que llegó, o subí una foto del remito y el sistema lo lee. Después ajustás cantidad y costo de cada renglón." },
      /* "Confirmar compra" aparece recién con algún producto cargado: va
         como cartel, no como botón a encontrar. */
      { t: "Confirmá", d: "Con los productos cargados, tocá Confirmar compra: suma el stock, guarda el costo nuevo (y avisa si subió) y, si se pagó en el momento, lo saca de la caja." },
    ],
  },
  {
    id: "factura-a-pagar", modulo: "caja",
    titulo: "Cargar una factura a pagar",
    d: "La factura de un proveedor que vence más adelante.",
    pasos: [
      { donde: "caja", en: B(/^A pagar$/), avanza: "clic", t: "A pagar", d: "Las facturas de los proveedores que te dan plazo." },
      { en: B(/Cargar factura/), avanza: "clic", t: "Cargar factura", d: "" },
      { en: Campo("Proveedor"), t: "De quién", d: "Con el mismo nombre de siempre: así Informes suma todo lo de cada uno." },
      { en: Campo("Monto"), t: "Cuánto y cuándo vence", d: "El monto y la fecha de vencimiento. El número es opcional." },
      { en: B(/^Guardar$/), avanza: "clic", t: "Guardala", d: "" },
      { t: "Y cuando la pagues", d: "Tocá Pagar en la factura: elegís de qué cuenta sale y queda anotada en la caja grande. Arriba ves lo vencido, lo que vence en la semana y si te alcanza la plata." },
    ],
  },
  {
    id: "ver-informes", modulo: "reportes",
    titulo: "Ver los informes",
    d: "Cuánto vendiste, cuánto ganaste y qué cambió.",
    pasos: [
      { donde: "reportes", en: B(/^30 días$/), t: "Elegí el período", d: "Los atajos, o dos fechas a mano. Todo se compara con el período anterior del mismo largo." },
      /* El rótulo se ve en mayúsculas (CSS) y innerText lo devuelve así. */
      { en: Algo(/^Ventas \d+ días/i), opcional: true, t: "Los números", d: "Ventas, ganancia, margen, tickets: la flecha dice si subió o bajó contra el período anterior." },
      { en: B(/^Mi reporte$/), avanza: "clic", t: "Armá tu propio cuadro", d: "Para preguntas puntuales: ventas por rubro y mes, por vendedor, por hora." },
      { en: Algo(/^Agrupar por$/), t: "Por qué agrupar", d: "Elegí hasta tres cosas. Tocá una fila de la tabla para abrirla (rubro → producto → ticket). Guardalo con un nombre para la próxima." },
      { en: B(/^Por mail$/), avanza: "clic", t: "Que te llegue solo", d: "" },
      { en: B(/Mandarme uno ahora/), t: "Por mail", d: "Programá un resumen diario, semanal o mensual. Este botón te manda uno ahora para ver cómo llega." },
    ],
  },
  {
    id: "contar-stock", modulo: "stock",
    titulo: "Contar el stock",
    d: "Cargar cuánto hay de verdad.",
    pasos: [
      { donde: "stock", en: B(/^Conteo de inventario$/), avanza: "clic", t: "Conteo de inventario", d: "" },
      { en: Entrada("Disparale con la pistola"), t: "Buscá el producto", d: "Escanealo o escribí el nombre." },
      { t: "Cargá lo que contaste", d: "Escribí cuántos hay y tocá Ajustar: el sistema guarda la diferencia como ajuste, con quién y cuándo. De ahí sale lo que hay que reponer." },
    ],
  },
  {
    id: "caja-del-dia", modulo: "caja",
    titulo: "Abrir y cerrar la caja",
    d: "Gastos, retiros y el arqueo del día.",
    pasos: [
      { donde: "caja", en: B(/^Caja del día$/), avanza: "clic", opcional: true, t: "La caja del día", d: "" },
      /* Gasto y Cerrar caja aparecen recién con la caja abierta. */
      { en: B(/^Abrir caja con/), avanza: "clic", opcional: true, espera: [B(/^Gasto$/)],
        t: "Abrí la caja", d: "Al empezar el día, con el efectivo que hay en el cajón." },
      { en: B(/^Gasto$/), opcional: true, t: "Gastos y retiros", d: "Si pagás algo con plata del cajón, es un gasto; si sacás plata para guardarla, un retiro. Así el arqueo cierra." },
      { en: B(/Cerrar caja del día/), opcional: true,
        t: "Al terminar el día", d: "Cerrar caja: contás lo que hay en el cajón y el sistema te dice si falta o sobra contra lo que debería haber." },
      { t: "La plata del negocio", d: "En Caja grande van el banco, Mercado Pago y el efectivo guardado: pagos a proveedores, retiros del dueño y pases entre cuentas." },
    ],
  },
  {
    id: "cliente-a-cuenta", modulo: "clientes", rubros: ["minimercado", "gastronomia"],
    titulo: "Cargar un cliente y venderle a cuenta",
    d: "El fiado, ordenado.",
    pasos: [
      { donde: "clientes", en: B(/Nuevo cliente/), avanza: "clic", t: "Nuevo cliente", d: "" },
      { en: Campo("Razón social o nombre"), t: "Sus datos", d: "El nombre alcanza. Para factura A, el CUIT y la condición frente al IVA." },
      { en: B(/^Guardar$/), avanza: "clic", t: "Guardalo", d: "" },
      { t: "Venderle a cuenta", d: "En el cobro, elegí el cliente y pagá con \"Cuenta corriente\": la venta queda como deuda. En Cuenta corriente ves quién debe y le cobrás todo o una parte." },
    ],
  },
  {
    id: "sumar-equipo", modulo: "permisos",
    titulo: "Sumar a alguien del equipo",
    d: "Que entre con su usuario y vea lo suyo.",
    pasos: [
      { donde: "permisos", en: B(/^Personas$/), avanza: "clic", t: "Personas", d: "Quién entra al sistema." },
      { en: B(/^Dar de alta$/), avanza: "clic", t: "Dar de alta", d: "" },
      { en: Campo("Nombre"), t: "Sus datos y su rol", d: "Nombre, el mail con el que va a entrar y el rol: un cajero ve menos que un encargado. Lo que puede cada rol se cambia en Roles." },
      { en: B(/Dar el alta/), t: "Cómo entra", d: "Le llega una invitación al mail, o le das una clave provisional que cambia al entrar." },
    ],
  },
  {
    id: "tomar-pedido", modulo: "comandas", rubros: ["gastronomia"],
    titulo: "Tomar un pedido",
    d: "De la mesa o el mostrador a la cocina y al cobro.",
    pasos: [
      /* "cobro" es la pantalla de vender del rubro: en gastronomía, la de
         comandas (el botón Comanda), que es donde se toma el pedido. */
      { donde: "cobro", en: Algo(/^Tomar un pedido$/i), opcional: true, t: "Tomar un pedido", d: "Por mostrador, delivery o aplicaciones." },
      { en: Algo(/^Salón$/i), opcional: true, t: "O en una mesa", d: "Tocá la mesa en el plano del salón." },
      { t: "Cargá lo que piden", d: "Tocá los platos y bebidas; con una nota para la cocina si hace falta. \"A cocina\" manda lo nuevo a la cocina o la barra." },
      { t: "Cobrar", d: "Desde el pedido: pre cuenta, dividir la cuenta, descuento y el cobro con cualquier medio." },
    ],
  },
  {
    id: "dar-turno", modulo: "agenda", rubros: ["servicios"],
    titulo: "Dar un turno",
    d: "Quién, qué, cuándo y dónde.",
    pasos: [
      { donde: "agenda", en: B(/Nuevo turno/), avanza: "clic", t: "Nuevo turno", d: "O tocá un horario libre del calendario." },
      { en: Campo("Cliente"), t: "El turno", d: "El cliente, el servicio, quién lo da, el día y la hora. Si choca con otro turno o está fuera de horario, te avisa." },
      { en: B(/Guardar turno/), avanza: "clic", t: "Guardalo", d: "Queda en la agenda, y si tiene abono, descuenta la clase." },
    ],
  },
];

/* Los que este comercio puede hacer: su rubro, y la sección en el menú
   (el cobro cuenta si el comercio vende por mostrador). */
export function recorridosDe(rubro, secciones, conCobro) {
  return RECORRIDOS.filter((r) => (!r.rubros || r.rubros.includes(rubro))
    && (r.modulo === "cobro" ? conCobro : secciones.includes(r.modulo)));
}
