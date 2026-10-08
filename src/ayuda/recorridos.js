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

/* LA VENTA, como se muestra en los recorridos (07/10). Con la caja
   cerrada, Sistema monta el cobro en modo muestra con un producto de
   ejemplo: se ve todo y no se guarda nada. "Seguir" en Cobrar abre los
   medios de pago, que tampoco guardan nada hasta confirmar. */
const PASOS_VENTA = [
  { t: "Primero, la caja", d: "Cada día empieza abriendo la caja con el efectivo que hay en el cajón. Para este recorrido te mostramos la venta como si estuviera abierta: nada de lo que veas acá se guarda." },
  { en: Entrada("Escaneá o escribí"), t: "Buscá el producto", d: "Escribí el nombre o escaneá el código de barras y apretá Enter: se suma a la venta. Para cambiar la cantidad del último, escribí el número y Enter." },
  { en: { css: "[data-guia='venta']" }, opcional: true, t: "La venta", d: "Lo que vas cargando aparece acá, con cantidad y precio. Te cargamos un producto de ejemplo." },
  { en: B(/^Cobrar \$/), avanza: "clic", opcional: true, t: "Cobrar", d: "Con todo cargado, Cobrar (o Enter con el campo vacío, o F2). Tocá Seguir y te mostramos cómo se elige el pago." },
  /* La lista entera, no un medio: el cartel tapaba los de abajo. */
  { en: { css: "[data-guia='medios']" }, opcional: true, t: "Cómo paga", d: "Cada medio tiene su número (1 efectivo, 2 débito…). Efectivo te pregunta con cuánto paga y calcula el vuelto; Mercado Pago muestra el QR; Cuenta corriente lo deja como deuda del cliente." },
  { en: B(/Pago combinado/), opcional: true, t: "Parte y parte", d: "Para cobrar una parte en efectivo y otra con tarjeta." },
  { t: "El ticket", d: "Al confirmar, la venta queda guardada y el stock baja solo. Imprimís el ticket (I), lo mandás por WhatsApp (W) o por mail (E), y Nueva venta (Enter) empieza la próxima." },
  { t: "Todo con el teclado", d: "F1 muestra los atajos: F2 cobrar, F3 últimas ventas, F7 quitar el último, F8 anular, F10 ir al panel." },
];

export const RECORRIDOS = [
  {
    id: "primera-venta", modulo: "cobro", rubros: ["minimercado"],
    titulo: "Hacer una venta",
    d: "De abrir la caja a entregar el ticket.",
    /* Los mismos pasos que el recorrido general. */
    pasos: PASOS_VENTA.map((p, i) => (i === 0 ? { ...p, donde: "cobro" } : p)),
  },
  {
    id: "cargar-producto", modulo: "productos",
    titulo: "Cargar un producto",
    d: "Nombre, costo, precio y stock.",
    pasos: [
      /* Antes de abrir el formulario: después queda tapado. */
      { donde: "productos", en: B(/^Importar$/), opcional: true,
        t: "¿Tenés muchos?", d: "Con Exportar bajás una planilla con el formato exacto. La completás y la subís con Importar: te muestra qué va a crear y qué va a cambiar antes de aplicar." },
      { en: B(/^(Nuevo producto|Nuevo)$/), avanza: "clic",
        t: "O de a uno", d: "Desde acá se carga uno por uno. También se abre solo si escaneás un código que no existe." },
      { en: Campo("Nombre"), t: "El nombre", d: "Como lo vas a buscar en la caja. Si tiene código de barras, escanealo en el campo de abajo." },
      { en: Campo("Costo"), t: "Costo y precio", d: "Cargá lo que te cuesta y el precio de venta: el margen se calcula solo. Si ponés el margen, calcula el precio." },
      { en: Campo("Stock actual"), opcional: true, t: "El stock", d: "Cuántos tenés y el mínimo: cuando baje de ahí, aparece en \"Para reponer\"." },
      { en: B(/^Crear producto$/), t: "Guardalo", d: "Con Crear producto queda listo para vender. Si no querés cargarlo ahora, cerrá el formulario." },
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
      { en: B(/^Guardar$/), t: "Guardalo", d: "Ya lo podés elegir al cargar una compra." },
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
      { en: B(/^Guardar$/), t: "Guardala", d: "" },
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
      { en: B(/^Abrir caja con/), alternativa: true,
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
      { en: B(/^Guardar$/), t: "Guardalo", d: "" },
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
      { en: B(/Guardar turno/), t: "Guardalo", d: "Queda en la agenda, y si tiene abono, descuenta la clase." },
    ],
  },
];

/* Los que este comercio puede hacer: su rubro, y la sección en el menú
   (el cobro cuenta si el comercio vende por mostrador). */
export function recorridosDe(rubro, secciones, conCobro) {
  return RECORRIDOS.filter((r) => (!r.rubros || r.rubros.includes(rubro))
    && (r.modulo === "cobro" ? conCobro : secciones.includes(r.modulo)));
}

/* ============================================================
   LOS RECORRIDOS DE CADA PANTALLA (07/10)
   ============================================================

   Nehuen: "a cada pantalla que entrás por primera vez, hacerlo". Uno por
   sección del menú, que arranca solo la primera vez que la persona entra
   (Sistema, con perfiles.onboarding.pantallas_vistas). No hacen nada:
   muestran las partes de la pantalla con "Seguir", y terminan en "¿Cómo
   se usa?", que es donde queda la ayuda para después.

   La clave es la sección (`k` del menú); "cobro" y "comanda" son las
   pantallas de vender, que no son secciones. Un paso que no aparece en
   esta pantalla (otro rubro, otro rol) es opcional y se saltea.
   ============================================================ */

/* Algunas pestañas llevan un contador pegado: "Reponer1", "Auditoría0". */
const Pestana = (n) => B(new RegExp(`^${n}\\s*\\d*$`));
const Css = (css) => ({ css });
const AYUDA_ACA = { en: B(/¿Cómo se usa\?/), opcional: true,
  t: "Cuando quieras repasar", d: "Acá está la ayuda de esta pantalla, con el paso a paso de cada cosa que se hace en ella." };

export const PANTALLAS = {
  /* `alternativa`: uno de dos que dicen lo mismo según la pantalla (el
     menú de la computadora o el del celular; la caja cerrada o abierta).
     El que no está se saltea sin mostrarse. */
  inicio: [
    { en: Css("aside nav"), alternativa: true, t: "El menú", d: "Está agrupado por tema: lo que vendés, la mercadería y los números. Abajo de todo, Administración: tus datos, tu gente, tu plan y la configuración, en un solo lugar. Ahora te mostramos las principales." },
    /* En el celular el menú está abajo: las primeras secciones y "Más". */
    { en: B(/^Más$/), alternativa: true, t: "El menú", d: "Abajo están las secciones, y en Más, el resto. Ahora te mostramos las principales." },
    { en: Algo(/^Lo que tenés que saber$/i), opcional: true, t: "Lo que tenés que saber", d: "El sistema mira tus datos y te avisa lo importante: lo que se está por acabar, los costos que subieron, los márgenes que bajaron." },
    { en: Css("button[aria-label='Ayuda']"), opcional: true, t: "La ayuda", d: "Todas las guías y los paso a paso, con un buscador y nuestro WhatsApp." },
  ],
  /* El inicio de un negocio de servicios es otro tablero: el día de la
     agenda y las acciones rápidas. */
  inicioServicios: [
    { en: Css("aside nav"), alternativa: true, t: "El menú", d: "Cada sección hace una cosa: agenda, clientes, servicios, finanzas. Abajo de todo, Administración: tus datos, tu gente, tu plan y la configuración, en un solo lugar. Ahora te mostramos las principales." },
    { en: B(/^Más$/), alternativa: true, t: "El menú", d: "Abajo están las secciones, y en Más, el resto. Ahora te mostramos las principales." },
    { en: Algo(/^Acciones rápidas$/i), opcional: true, t: "Tu día", d: "Los turnos de hoy, lo que falta confirmar y las acciones rápidas: un turno nuevo sin entrar a la agenda." },
    { en: Css("button[aria-label='Ayuda']"), opcional: true, t: "La ayuda", d: "Todas las guías y los paso a paso, con un buscador y nuestro WhatsApp." },
  ],
  cobro: PASOS_VENTA,
  comanda: [
    { en: Algo(/^Tomar un pedido$/i), opcional: true, t: "Tomar un pedido", d: "Por mostrador, delivery o aplicaciones: cada canal abre un pedido." },
    { en: Algo(/^Salón$/i), opcional: true, t: "El salón", d: "Las mesas en el plano. Tocá una para abrir o seguir su pedido." },
    { t: "De la mesa a la cocina", d: "En el pedido cargás platos y bebidas, y \"A cocina\" los manda a la cocina o la barra. Al final se cobra desde el mismo pedido." },
  ],
  productos: [
    { en: Pestana("Catálogo"), opcional: true, t: "Tu catálogo", d: "Todo lo que vendés, con costo, precio y margen." },
    { en: B(/^(Nuevo producto|Nuevo)$/), opcional: true, t: "Cargar productos", d: "De a uno desde acá, o escaneando un código que no existe." },
    { en: B(/^Importar$/), opcional: true, t: "O muchos de una vez", d: "Exportar baja la planilla con el formato; la completás y la subís con Importar." },
    { en: B(/Editar en tabla/), opcional: true, t: "Cambiar precios rápido", d: "Costo y precio de muchos productos a la vez, viendo el margen." },
    { en: Pestana("Promociones"), opcional: true, t: "Promociones, códigos y etiquetas", d: "2x1, 3x2; códigos de barras para lo que no trae; etiquetas de góndola para imprimir." },
    AYUDA_ACA,
  ],
  stock: [
    { en: Pestana("Reponer"), opcional: true, t: "Qué reponer", d: "Lo que está por debajo del mínimo o se va a terminar según lo que vendés." },
    { en: Pestana("Vencimientos"), opcional: true, t: "Vencimientos y lo que no se mueve", d: "Lo que vence pronto, y lo que hace mucho que no se vende." },
    { en: Pestana("Conteo de inventario"), opcional: true, t: "Contar", d: "Cargás lo que hay de verdad y el sistema guarda la diferencia." },
    { en: Pestana("Mermas"), opcional: true, t: "Mermas", d: "Lo roto, vencido o perdido, con su motivo: así el stock no miente." },
    AYUDA_ACA,
  ],
  compras: [
    { en: Pestana("Cargar compra"), opcional: true, t: "Cargar lo que llega", d: "Escaneando o con una foto del remito: suma stock y actualiza costos." },
    { en: Pestana("Pedido sugerido"), opcional: true, t: "Qué pedir", d: "Calcula cuánto pedir de cada cosa según lo que vendés." },
    { en: Pestana("Órdenes de compra"), opcional: true, t: "Órdenes de compra", d: "El pedido al proveedor, y lo que fue llegando." },
    { en: Pestana("Proveedores"), opcional: true, t: "Proveedores", d: "Sus datos y qué te vende cada uno." },
    AYUDA_ACA,
  ],
  caja: [
    { en: Pestana("Caja del día"), opcional: true, t: "La caja del día", d: "Apertura, ventas, gastos, retiros y el cierre con arqueo." },
    { en: Pestana("Caja grande"), opcional: true, t: "La caja grande", d: "La plata del negocio: banco, Mercado Pago, efectivo guardado. Pagos a proveedores y retiros del dueño." },
    { en: Pestana("A pagar"), opcional: true, t: "A pagar", d: "Las facturas de proveedores que vencen, y si te alcanza la plata." },
    AYUDA_ACA,
  ],
  clientes: [
    { en: B(/Nuevo cliente/), opcional: true, t: "Tus clientes", d: "Cargá a los que te compran seguido o a los que les facturás." },
    { t: "Los segmentos", d: "Arriba de la lista, los grupos: los mejores, los que están por perderse, los nuevos. Tocá uno para ver quiénes son." },
    AYUDA_ACA,
  ],
  cuentas: [
    { en: Algo(/^Quién debe$/i), opcional: true, t: "Quién debe", d: "Cada cliente con cuenta, cuánto debe y desde cuándo." },
    { en: B(/Abrir la cuenta de un cliente/), opcional: true, t: "Abrir una cuenta", d: "Para venderle a cuenta; también podés ponerle un límite." },
    { t: "Cobrar y corregir", d: "En cada cuenta: Cobrar (todo o una parte), Cargar deuda y Descontar deuda. Las ventas a cuenta del cobro se suman solas." },
    AYUDA_ACA,
  ],
  pedidos: [
    { t: "Pedidos de clientes", d: "Para preparar pedidos con la pistola: cargás lo que pidió, escaneás al juntarlo, marcás lo que falta y lo cobrás." },
    AYUDA_ACA,
  ],
  presupuestos: [
    { en: B(/Nuevo presupuesto/), opcional: true, t: "Presupuestos", d: "Cotizar sin vender: no toca stock ni caja." },
    { t: "Mandarlo y convertirlo", d: "Se manda por WhatsApp y, cuando el cliente confirma, se convierte en venta." },
    AYUDA_ACA,
  ],
  equipo: [
    { en: B(/Sumar a alguien/), opcional: true, t: "Tu equipo", d: "Quién trabaja con vos: datos, horarios y qué hace cada uno." },
    { t: "Equipo no es acceso", d: "Para que alguien entre al sistema con su usuario, se da de alta en Permisos → Personas." },
    AYUDA_ACA,
  ],
  permisos: [
    { en: Pestana("Roles"), opcional: true, t: "Roles", d: "Qué ve y qué puede hacer cada rol: cajero, encargado…" },
    { en: Pestana("Personas"), opcional: true, t: "Personas", d: "Quién entra al sistema, con qué rol." },
    { en: Pestana("Auditoría"), opcional: true, t: "Auditoría", d: "Quién cambió qué y cuándo." },
    AYUDA_ACA,
  ],
  reportes: [
    { en: B(/^30 días$/), opcional: true, t: "El período", d: "Elegí de cuándo a cuándo. Todo se compara con el período anterior." },
    { en: Pestana("Resumen"), opcional: true, t: "El resumen", d: "Ventas, ganancia, margen y tickets; tus productos; los quiebres de stock." },
    { en: Pestana("Mi reporte"), opcional: true, t: "Mi reporte", d: "Tu propio cuadro: por rubro, mes, vendedor… y tocando una fila llegás al ticket." },
    { en: Pestana("Por mail"), opcional: true, t: "Por mail", d: "Un resumen que te llega solo, cada día, semana o mes." },
    AYUDA_ACA,
  ],
  asistente: [
    { en: Entrada("Escribí tu pregunta"), opcional: true, t: "Preguntale a tu negocio", d: "\"¿Qué me conviene reponer?\", \"¿por qué bajó el margen?\": responde mirando tus datos." },
    AYUDA_ACA,
  ],
  /* Ajustes, Equipo, Permisos y Mi plan viven adentro de Administración
     (0139), con su propio menú: los pasos señalan las secciones de ese
     menú, que existen en la computadora y en el celular. */
  ajustes: [
    { en: Css("[data-seccion='negocio']"), opcional: true, t: "Tu negocio", d: "Nombre, logo, contacto, datos fiscales y objetivos del mes." },
    { en: Css("[data-seccion='cobros']"), opcional: true, t: "Cobros y facturas", d: "Medios de pago y comisiones, la caja, Mercado Pago y factura electrónica." },
    { en: Css("[data-seccion='precios']"), opcional: true, t: "Precios y stock", d: "Listas de precios, redondeo y descuentos por rol." },
    { en: Css("[data-seccion='equipos']"), opcional: true, t: "Equipos", d: "La impresora, el ticket, la comandera y los sonidos." },
    { en: Css("[data-seccion='cuenta']"), opcional: true, t: "Mi cuenta", d: "Tu contraseña y la descarga de tus datos." },
  ],
  administracion: [
    { en: Css("[data-seccion='resumen']"), opcional: true, t: "Todo en un lugar", d: "Tu negocio, cómo se vende, tu gente y tu cuenta: cada cosa en su sección de este menú." },
    { en: Algo(/^Estado de la configuración$/i), opcional: true, t: "Qué falta", d: "Lo que falta para que el ticket y la factura salgan con tus datos. Tocando cada uno vas a donde se completa." },
    { en: Css("[data-seccion='presencia']"), opcional: true, t: "Tu página", d: "Lo que ve la gente en internet: si estás abierto, cómo llegar, cómo escribirte y cómo se paga." },
    { en: Css("[data-seccion='cobros']"), opcional: true, t: "Cómo se vende", d: "Cobros y facturas, precios y stock, los puntos de los clientes y la impresora." },
    { en: Css("[data-seccion='equipo']"), opcional: true, t: "Tu gente", d: "Quién trabaja con vos, con qué acceso, y qué puede hacer cada rol." },
    { en: Css("[data-seccion='plan']"), opcional: true, t: "Tu plan", d: "Lo que pagás, cambiarlo o darlo de baja." },
  ],
  comandas: [
    { t: "El salón", d: "El plano con las mesas: libres, ocupadas y cuánto hace que esperan. Tocá una para abrir o seguir su pedido." },
    AYUDA_ACA,
  ],
  cocina: [
    { t: "La pantalla de la cocina", d: "Para colgar en la pared: lo que hay que preparar en el orden en que se pidió. Se marca lo que sale y el salón lo ve enseguida." },
    AYUDA_ACA,
  ],
  agenda: [
    { en: B(/Nuevo turno/), opcional: true, t: "La agenda", d: "Los turnos del día: quién atiende, en qué sala y a quién." },
    { en: Pestana("Lista"), opcional: true, t: "Calendario o lista", d: "Como te quede más cómodo." },
    AYUDA_ACA,
  ],
  servicios: [
    { en: Pestana("Servicios"), opcional: true, t: "Lo que ofrecés", d: "Cada servicio con su duración, precio y quién lo da." },
    { en: Pestana("Salas y recursos"), opcional: true, t: "Salas y recursos", d: "Los lugares y equipos que se usan, para que la agenda no los superponga." },
    AYUDA_ACA,
  ],
  ventas: [
    { en: Pestana("Abonos"), opcional: true, t: "Abonos", d: "Los que compró cada cliente y cuántas clases le quedan." },
    { en: Pestana("Planes"), opcional: true, t: "Planes", d: "Cuántas clases, cuántos días y el tope por semana." },
    AYUDA_ACA,
  ],
  finanzas: [
    { en: Pestana("Resumen"), opcional: true, t: "El mes", d: "Cuánto entró y cuánto salió." },
    { en: Pestana("Liquidaciones"), opcional: true, t: "Lo que se le paga al equipo", d: "Según sus horas o sus servicios." },
    AYUDA_ACA,
  ],
  crm: [
    { en: Pestana("Para hacer"), opcional: true, t: "A quién escribirle", d: "Los que dejaron de venir o se les vence el abono, con el mensaje ya escrito." },
    AYUDA_ACA,
  ],
  comunicaciones: [
    { en: Pestana("Por avisar"), opcional: true, t: "Los avisos de mañana", d: "Una cola por hora: mandás cada recordatorio y desaparece." },
    AYUDA_ACA,
  ],
  informes: [
    { en: Pestana("Resumen general"), opcional: true, t: "Cómo viene el negocio", d: "Ingresos, ocupación, asistencia y clientes, contra el período anterior." },
    { en: Pestana("Turnos"), opcional: true, t: "Cada tema por separado", d: "Turnos, finanzas, servicios, profesionales, salas y clientes: cada uno con su detalle." },
    AYUDA_ACA,
  ],
};

const NOMBRE_PANTALLA = { cobro: "La caja", comanda: "Tomar pedidos" };
/* El recorrido de una pantalla, con la forma de los otros. */
export function pantallaDe(k, titulo) {
  const pasos = PANTALLAS[k];
  return pasos ? { id: `pantalla-${k}`, modulo: k, titulo: titulo || NOMBRE_PANTALLA[k] || "Esta pantalla", pasos } : null;
}
export const recorridoPorId = (id) => (id && id.startsWith("pantalla-") ? pantallaDe(id.slice(9)) : RECORRIDOS.find((r) => r.id === id));


/* ============================================================
   EL RECORRIDO GENERAL (07/10)
   ============================================================

   Nehuen: "el recorrido tiene que ser de corrido, no entrando a cada
   módulo la persona; que diga seguir, no que te haga cargar cosas; que
   vaya mostrando los módulos primordiales". Uno solo, que arranca al
   terminar la bienvenida y va pasando él por las secciones principales
   del rubro, en el orden en que se usan, con lo que muestra cada
   pantalla (PANTALLAS). Solo las que el comercio tiene.
   ============================================================ */

const ORDEN = {
  minimercado: ["inicio", "cobro", "productos", "stock", "compras", "caja", "clientes", "cuentas", "reportes", "administracion", "ajustes"],
  gastronomia: ["inicio", "comanda", "cocina", "productos", "stock", "caja", "reportes", "administracion", "ajustes"],
  servicios: ["inicio", "agenda", "clientes", "servicios", "ventas", "finanzas", "informes", "administracion", "ajustes"],
};

/* `menu`: las secciones del comercio, [{ k, n }]. `vende`: "cobro",
   "comandas" o nada (las pantallas de vender no están en el menú). */
export function recorridoGeneral(rubro, menu, vende) {
  const nombre = Object.fromEntries(menu.map((m) => [m.k, m.n]));
  const hay = (k) => (k === "cobro" ? vende === "cobro" : k === "comanda" ? vende === "comandas" : !!nombre[k]);
  const secciones = (ORDEN[rubro] || ORDEN.minimercado).filter((k) => hay(k) && PANTALLAS[k]);
  const pasos = [
    { t: "Te mostramos Genez", d: "Vamos a pasar por las secciones principales y ver qué se hace en cada una. Solo tocá Seguir: no se carga nada." },
  ];
  for (const k of secciones) {
    const sec = k === "cobro" ? "Cobrar" : k === "comanda" ? "Tomar pedidos" : nombre[k];
    const pantalla = k === "inicio" && rubro === "servicios" ? PANTALLAS.inicioServicios : PANTALLAS[k];
    pantalla.filter((p) => p !== AYUDA_ACA).forEach((p, i) => {
      pasos.push({ ...p, sec, ...(i === 0 ? { donde: k === "cobro" || k === "comanda" ? "cobro" : k } : {}) });
    });
  }
  pasos.push(
    { donde: "inicio", en: Css("button[aria-label='Ayuda']"), opcional: true, sec: "La ayuda",
      t: "Cuando lo necesites", d: "Acá están todas las guías y los paso a paso de cada tarea (cargar un producto, un proveedor, una factura…), con un buscador y nuestro WhatsApp." },
    { en: B(/¿Cómo se usa\?/), opcional: true, sec: "La ayuda",
      t: "Y en cada pantalla", d: "\"¿Cómo se usa?\" te explica la pantalla en la que estás y te la vuelve a mostrar." },
    { t: "¡Listo!", d: "Ya viste todo. Te recomendamos arrancar por los primeros pasos de Inicio: tus datos, tus productos y tu primera venta." },
  );
  return { id: "general", titulo: "Recorrido general", d: "Todo el sistema, de punta a punta.", pasos };
}
