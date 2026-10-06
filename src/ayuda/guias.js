/* ============================================================
   AYUDA · las guías de cada sección (06/10)
   ============================================================

   Lo que se lee en "¿Cómo se usa?" arriba de cada pantalla y en el
   Centro de ayuda. Una guía por clave del menú (la misma `k` de
   MODULOS y del menú del rubro), más unas generales que no son de una
   sección.

   Escritas leyendo cada pantalla, con los nombres de los botones tal
   como aparecen. Si un botón cambia de nombre, se cambia acá: una guía
   que nombra un botón que no existe es peor que no tener guía.

   `porRubro` pisa lo que cambia en gastronomía o servicios (la misma
   sección se usa distinto en un bar que en un almacén).

   Forma: { titulo, para, pasos: [{ t, d }], consejos: [] }.
   ============================================================ */

export const GUIAS = {
  inicio: {
    titulo: "Inicio",
    para: "El resumen del día: cuánto vendiste, cómo viene contra otros días y qué conviene mirar. Es lo primero que ves al entrar al panel.",
    pasos: [
      { t: "Mirá los números de hoy", d: "Arriba están las ventas y los tickets del día. Se actualizan solos con cada venta." },
      { t: "Leé \"Lo que tenés que saber\"", d: "El sistema revisa tus datos y avisa lo que importa: productos por agotarse, costos que subieron, márgenes que bajaron. Tocá un aviso para ir directo a resolverlo." },
      { t: "Seguí los primeros pasos", d: "Mientras estás arrancando, en Inicio aparece la lista de lo que conviene dejar listo. Se tilda sola a medida que lo hacés." },
    ],
    consejos: ["Si cargás objetivos del mes en Ajustes → Negocio, Inicio te muestra cómo venís contra ellos."],
  },

  cobro: {
    titulo: "Cobrar",
    para: "La pantalla de la caja: cargar productos, elegir cómo paga el cliente e imprimir el ticket. Se puede usar entera con el teclado y con el lector de códigos de barras.",
    pasos: [
      { t: "Abrí la caja", d: "Antes de la primera venta del día, abrí la caja con el efectivo que hay en el cajón. Sin caja abierta no se puede cobrar." },
      { t: "Cargá los productos", d: "Escribí el nombre o escaneá el código. Enter agrega el marcado. Para cambiar la cantidad del último, escribí el número y Enter." },
      { t: "Cobrá", d: "Con el campo vacío, Enter (o F2) pasa a cobrar. Elegí el medio de pago con los números 1 a 5; con 6 se combinan dos medios." },
      { t: "Entregá el ticket", d: "Al confirmar podés imprimir (I), verlo (T), mandarlo por WhatsApp (W) o por mail (E)." },
      { t: "Si te equivocaste", d: "F7 quita el último renglón, F8 anula la venta entera y F3 muestra las últimas ventas para reimprimir." },
    ],
    consejos: [
      "F1 muestra todos los atajos de teclado.",
      "El lector de códigos funciona en cualquier pantalla: si escaneás un producto fuera del cobro, se abre su ficha; si no existe, el alta.",
      "Si se corta internet, la venta se guarda en la computadora y se manda sola cuando vuelve.",
    ],
  },

  productos: {
    titulo: "Productos",
    para: "Tu catálogo: nombre, código, costo, precio y margen de todo lo que vendés. De acá salen los precios del cobro.",
    pasos: [
      { t: "Cargá tu catálogo de una vez", d: "Tocá Exportar: baja una planilla con el formato exacto. Completala con tus productos (nombre, código, costo, precio, stock) y subila con Importar. Antes de aplicar te muestra qué va a crear y qué va a cambiar." },
      { t: "O de a uno", d: "Con el botón de alta, o escaneando un código que no existe: se abre la ficha para completarlo." },
      { t: "Cambiá precios en tabla", d: "\"Editar en tabla\" deja tocar costo y precio de muchos productos a la vez, viendo el margen debajo de cada precio. Se guarda todo al final." },
      { t: "Promociones y etiquetas", d: "En las pestañas de arriba están las promociones (2x1, 3x2…), los códigos de barras para los productos que no traen y las etiquetas de góndola para imprimir." },
    ],
    consejos: [
      "Cargá el costo: sin costo no hay margen, y los informes y el resumen por mail no pueden decirte cuánto ganás.",
      "Mientras estás probando, los productos de ejemplo se borran desde el aviso de arriba (\"Borrar ejemplos\").",
    ],
  },

  stock: {
    titulo: "Stock",
    para: "Qué hay, qué reponer, qué vence y qué no se mueve. El stock baja solo con cada venta y sube con cada compra.",
    pasos: [
      { t: "Cargá lo que tenés", d: "En \"Conteo de inventario\" escribí cuánto hay de cada producto. La diferencia queda guardada como ajuste, con quién y cuándo." },
      { t: "Mirá qué reponer", d: "\"Reponer\" lista lo que está por debajo del mínimo o se va a terminar según lo que vendés por día." },
      { t: "Controlá vencimientos", d: "\"Vencimientos\" muestra lo que vence pronto, si lo cargaste al recibir la mercadería." },
      { t: "Anotá las mermas", d: "Lo que se rompe, se vence o se pierde va en \"Mermas\", con el motivo: así el stock no miente y sabés cuánta plata se va por ahí." },
    ],
    consejos: ["Un producto al que nunca le cargaste stock no aparece en \"Reponer\" ni en los quiebres de stock de Informes: primero hay que contarlo una vez."],
  },

  compras: {
    titulo: "Compras",
    para: "Lo que le comprás a tus proveedores: cargar la mercadería que entra, armar pedidos y saber qué te conviene pedir.",
    pasos: [
      { t: "Cargá una compra", d: "En \"Cargar compra\" sumá lo que llegó con su costo: el stock sube y, si el costo cambió, queda registrado. También podés sacarle una foto al remito y el sistema lo lee; lo revisás antes de confirmar." },
      { t: "Usá el pedido sugerido", d: "Calcula cuánto pedir de cada producto según lo que vendés y lo que tenés." },
      { t: "Armá órdenes de compra", d: "Mandá el pedido al proveedor y, cuando llega, marcá qué se recibió (aunque llegue en partes)." },
      { t: "Cargá tus proveedores", d: "En \"Proveedores\": datos de contacto y qué te vende cada uno." },
    ],
    consejos: [],
  },

  caja: {
    titulo: "Caja",
    para: "La plata: lo que entra y sale en el día (la caja del cajón) y la plata del negocio (la caja grande: banco, Mercado Pago, efectivo guardado).",
    pasos: [
      { t: "Abrí y cerrá el día", d: "En \"Caja del día\", la apertura con el efectivo inicial y el cierre con el arqueo: contás lo que hay y el sistema te dice si falta o sobra." },
      { t: "Anotá gastos y retiros", d: "Un pago chico desde el cajón es un gasto; sacar plata para guardarla, un retiro. Así el arqueo cierra." },
      { t: "Usá la caja grande", d: "Pagos a proveedores, retiros del dueño, aportes y pases entre cuentas. En un pago, poné siempre a quién con el mismo nombre: Informes suma lo que le pagás a cada uno." },
      { t: "Anotá lo que tenés que pagar", d: "En \"A pagar\" cargá las facturas de proveedores con su vencimiento: te dice qué vence esta semana y si te alcanza la plata." },
    ],
    consejos: ["El cobro con Mercado Pago entra a la caja con la venta, no con el aviso del celular: así no se cuenta dos veces."],
  },

  clientes: {
    titulo: "Clientes",
    para: "Las fichas de tus clientes: datos para facturar, historial de compras y en qué grupo está cada uno (los que más compran, los que dejaron de venir).",
    pasos: [
      { t: "Cargá un cliente", d: "Con el alta, o desde el cobro al elegir a quién le vendés. Para factura A hace falta el CUIT." },
      { t: "Mirá los segmentos", d: "Arriba de la lista, los grupos: los mejores, los que están por perderse, los nuevos. Tocá uno para ver quiénes son." },
      { t: "Asigná una lista de precios", d: "Si un cliente compra a precio mayorista, ponele la lista en su ficha y el cobro la usa sola." },
    ],
    consejos: [],
    porRubro: {
      servicios: {
        para: "La ficha de cada cliente: datos, historial de turnos, abonos que tiene y notas.",
        pasos: [
          { t: "Cargá un cliente", d: "Con el alta, o desde la agenda al dar un turno a alguien nuevo." },
          { t: "Abrí la ficha", d: "Ahí están sus turnos (los que vinieron y los que faltaron), sus abonos con las clases que le quedan y las notas." },
        ],
      },
    },
  },

  cuentas: {
    titulo: "Cuenta corriente",
    para: "Quién te debe, cuánto y desde cuándo. Las ventas \"a cuenta\" del cobro se suman solas acá.",
    pasos: [
      { t: "Vendé a cuenta", d: "En el cobro, elegí el cliente y el medio \"cuenta corriente\": la venta queda como deuda." },
      { t: "Cobrá una deuda", d: "Elegí el cliente y tocá Cobrar: puede ser todo o una parte, en cualquier medio de pago." },
      { t: "Corregí", d: "\"Cargar deuda\" suma algo que no pasó por el cobro; \"Descuento\" la baja sin cobrarla. Queda todo registrado." },
    ],
    consejos: [],
  },

  pedidos: {
    titulo: "Pedidos",
    para: "Para preparar pedidos de clientes: armarlos con la pistola, controlar lo que falta y cobrarlos cuando están listos.",
    pasos: [
      { t: "Cargá el pedido", d: "Con los productos y las cantidades que pidió el cliente." },
      { t: "Preparalo", d: "Escaneá cada producto al juntarlo: la pantalla marca lo que está y lo que falta. Si algo no hay, marcalo como faltante." },
      { t: "Cobralo", d: "Cuando está listo, se cobra como cualquier venta y baja el stock." },
    ],
    consejos: ["Los pedidos en preparación se pierden si se refresca la página: cobralos antes de cerrar."],
  },

  presupuestos: {
    titulo: "Presupuestos",
    para: "Cotizar sin vender: armás el presupuesto, se lo mandás al cliente, y si confirma lo convertís en venta.",
    pasos: [
      { t: "Armá un presupuesto", d: "Con el cliente y los productos. No toca el stock ni la caja." },
      { t: "Mandalo", d: "Por WhatsApp, con el detalle y el total." },
      { t: "Convertilo", d: "Cuando el cliente confirma, se convierte en venta con los mismos productos y precios." },
    ],
    consejos: [],
  },

  equipo: {
    titulo: "Equipo",
    para: "Quién trabaja, qué hace cada uno y cuándo está.",
    pasos: [
      { t: "Cargá a cada persona", d: "En \"Datos\": nombre, puesto y contacto. Lo que se le paga solo lo ve quien puede ver costos." },
      { t: "Cargá los horarios", d: "En \"Horarios\", los días y horas de cada uno." },
      { t: "Qué hace cada uno", d: "En \"Qué hace\", los servicios o tareas de cada persona." },
    ],
    consejos: ["Esto es el equipo de trabajo. Para que alguien pueda entrar al sistema con su usuario, se da de alta en Permisos → Personas."],
    porRubro: {
      servicios: {
        para: "Quién atiende, qué servicios da cada uno y en qué horarios. La agenda solo ofrece turnos en los horarios cargados acá.",
        consejos: ["Sin horarios cargados no se puede dar un turno: es lo primero que conviene completar."],
      },
    },
  },

  permisos: {
    titulo: "Permisos",
    para: "Quién puede entrar al sistema y qué puede hacer cada uno.",
    pasos: [
      { t: "Dale acceso a alguien", d: "En \"Personas\", el alta con su nombre, mail y rol: le mandás una invitación por mail, o le das una clave provisional que cambia al entrar." },
      { t: "Ajustá los roles", d: "En \"Roles\", qué secciones ve y qué puede hacer cada rol (cajero, encargado…): ver costos, hacer descuentos, anular, cerrar caja." },
      { t: "Revisá quién hizo qué", d: "\"Auditoría\" muestra los cambios importantes: quién, qué y cuándo." },
    ],
    consejos: ["Nadie puede cambiarse sus propios permisos ni dar uno que no tiene."],
  },

  reportes: {
    titulo: "Informes",
    para: "Qué se vende, qué deja plata y qué cambió. Elegí el período arriba; todo se compara con el período anterior del mismo largo.",
    pasos: [
      { t: "Leé el resumen", d: "Ventas, ganancia, margen, tickets y ticket promedio, con la flecha contra el período anterior. Debajo, de lo vendido a lo que queda: descuentos, comisiones y mermas." },
      { t: "Mirá tus productos", d: "Cuáles venden mucho y dejan mucho, cuáles venden pero dejan poco, cuáles se quedaron sin stock y cuánto se dejó de vender." },
      { t: "Armá tu propio cuadro", d: "En \"Mi reporte\" elegís por qué agrupar (rubro, mes, vendedor…) y qué ver. Tocá una fila para abrirla hasta el ticket. Guardalo con un nombre." },
      { t: "Recibilo por mail", d: "En \"Por mail\" programás un resumen diario, semanal o mensual que llega solo." },
    ],
    consejos: ["Exportar a Excel baja todo lo que ves, con una hoja por cuadro."],
  },

  asistente: {
    titulo: "Asistente",
    para: "Preguntale a tus datos en palabras: \"¿qué me conviene reponer?\", \"¿por qué bajó el margen?\". Responde mirando tus ventas, stock y costos.",
    pasos: [
      { t: "Preguntá", d: "Escribí la pregunta como se la harías a alguien que conoce el negocio." },
      { t: "Pedí que te explique", d: "Si un número no te cierra, preguntale de dónde sale." },
    ],
    consejos: ["Cada plan tiene un tope de preguntas por mes."],
  },

  ajustes: {
    titulo: "Ajustes",
    para: "La configuración del negocio y del sistema, repartida en pestañas: Negocio, Cobros y facturas, Equipos, Precios y stock, Clientes y Mi cuenta.",
    pasos: [
      { t: "Los datos del negocio", d: "Nombre, logo, contacto, horarios, los datos fiscales y los objetivos del mes. Lo que cargues sale en el ticket." },
      { t: "Cómo te pagan", d: "Los medios de pago con su comisión, Mercado Pago (pegando tu Access Token) y la factura electrónica de ARCA." },
      { t: "La impresora y el ticket", d: "El ancho del papel (58 u 80 mm), qué dice el ticket, la comandera y los sonidos." },
      { t: "Precios y descuentos", d: "Listas de precios, redondeo y hasta cuánto puede descontar cada rol." },
      { t: "Tu cuenta", d: "En Mi cuenta: tu contraseña, tu plan y la descarga de todos tus datos." },
    ],
    consejos: ["Después de elegir el ancho del papel, imprimí un ticket de prueba desde el cobro."],
  },

  /* ---------- Gastronomía ---------- */

  comandas: {
    titulo: "Salón",
    para: "La pantalla del día de un bar o restaurante: mesas, mostrador y delivery. Un pedido se abre, va sumando consumos y se cobra al final.",
    pasos: [
      { t: "Abrí un pedido", d: "Por canal (mostrador, delivery, aplicaciones) o tocando una mesa del plano." },
      { t: "Cargá lo que piden", d: "Los platos y bebidas, con notas para la cocina. Al enviar, la comanda sale en la cocina o la barra que corresponde." },
      { t: "Seguilo", d: "Cada pedido pasa por Pedido → Preparando → Listo. El tablero muestra cuánto hace que espera cada uno." },
      { t: "Cobrá", d: "Desde el pedido: pre cuenta, dividir la cuenta, descuentos y el cobro con cualquier medio." },
    ],
    consejos: [
      "El plano del salón se dibuja una vez: mesas, barra, paredes, y se pueden juntar y separar mesas.",
      "Cada mesa puede tener su QR para que el cliente vea la carta.",
    ],
  },

  cocina: {
    titulo: "Cocina",
    para: "La pantalla para colgar en la cocina: lo que hay que preparar, en el orden en que se pidió. No hace falta tocarla más que para marcar lo que sale.",
    pasos: [
      { t: "Mirá lo que entra", d: "Cada comanda aparece sola, con la mesa o el canal, la hora y las notas." },
      { t: "Marcá lo que sale", d: "Al terminar un plato o un pedido, marcalo listo: el salón lo ve enseguida." },
    ],
    consejos: [],
  },

  /* ---------- Servicios ---------- */

  agenda: {
    titulo: "Agenda",
    para: "Los turnos del día: quién atiende, en qué sala y a quién. El sistema no deja dar dos turnos que choquen.",
    pasos: [
      { t: "Dá un turno", d: "Elegí el día y el horario libre, el servicio, quién lo da y el cliente. Si choca con otro turno, una ausencia o fuera de horario, te avisa." },
      { t: "Clases grupales", d: "Una clase tiene cupo y lista de espera; cada inscripción descuenta del abono del cliente." },
      { t: "Marcá cómo terminó", d: "Si vino, si faltó o si canceló: es lo que alimenta la asistencia en Informes." },
    ],
    consejos: ["Antes del primer turno: cargá los servicios en \"Servicios y recursos\" y los horarios del equipo en \"Equipo\"."],
  },

  servicios: {
    titulo: "Servicios y recursos",
    para: "Qué ofrecés, cuánto dura, cuánto sale y dónde se hace.",
    pasos: [
      { t: "Cargá tus servicios", d: "En \"Servicios\": nombre, duración y precio. Indicá quién de tu equipo lo puede dar." },
      { t: "Cargá salas y recursos", d: "En \"Salas y recursos\": los lugares o equipos que se usan, para que la agenda no los superponga." },
    ],
    consejos: [],
  },

  ventas: {
    titulo: "Ventas",
    para: "Abonos, packs y planes: cobrar hoy clases que se usan durante semanas.",
    pasos: [
      { t: "Armá tus planes", d: "En \"Planes\": cuántas clases, cuántos días de vigencia y el tope por semana." },
      { t: "Vendé un abono", d: "En \"Abonos\", elegí el cliente y el plan y cobralo. El crédito se descuenta al reservar en la agenda." },
    ],
    consejos: [],
  },

  finanzas: {
    titulo: "Finanzas",
    para: "Donde cierra todo: ingresos, egresos, lo que se le paga al equipo y el mes completo.",
    pasos: [
      { t: "Mirá el mes", d: "\"Resumen\": cuánto entró y cuánto salió." },
      { t: "Anotá movimientos", d: "En \"Movimientos\", ingresos y egresos que no pasaron por la caja (alquiler, servicios)." },
      { t: "Liquidá al equipo", d: "En \"Liquidaciones\", lo que se le paga a cada uno según sus horas o sus servicios." },
    ],
    consejos: [],
  },

  crm: {
    titulo: "Seguimiento",
    para: "A quién conviene escribirle esta semana y por qué: los que dejaron de venir, los que se les vence el abono.",
    pasos: [
      { t: "Trabajá la lista", d: "En \"Para hacer\", cada persona con el motivo y un mensaje ya escrito, que podés cambiar." },
      { t: "Mandá", d: "Se abre WhatsApp con el mensaje cargado; vos apretás enviar. Esa persona sale de la lista por tres semanas." },
      { t: "Marcá si volvió", d: "En \"Lo que se mandó\": es lo que dice si los mensajes sirven." },
    ],
    consejos: [],
  },

  comunicaciones: {
    titulo: "Avisos",
    para: "Los recordatorios de turno de mañana, para mandar en un rato.",
    pasos: [
      { t: "Mandá los de mañana", d: "\"Por avisar\" es una cola por hora: cada mensaje se ve tal como le llega a la persona. Mandás y desaparece." },
      { t: "Ajustá el texto", d: "En \"Plantillas\", cómo se escribe cada aviso." },
    ],
    consejos: [],
  },

  informes: {
    titulo: "Informes",
    para: "Ingresos, ocupación, asistencia y clientes, por día, semana o mes.",
    pasos: [
      { t: "Elegí el período", d: "Diario, semanal o mensual, arriba." },
      { t: "Mirá cada tema", d: "Turnos, finanzas, servicios, profesionales, salas y clientes, en sus pestañas." },
    ],
    consejos: [],
  },
};

/* Las que no son de una sección: se leen en el Centro de ayuda. */
export const GENERALES = [
  {
    k: "organizacion", titulo: "Cómo está organizado Genez",
    para: "El menú de la izquierda tiene las secciones; cada una hace una cosa. En el celular, las primeras están abajo y el resto en \"Más\".",
    pasos: [
      { t: "Cobrar", d: "El botón naranja arriba del menú (o F10 para volver al panel). Es la pantalla de la caja." },
      { t: "Cada sección", d: "Arriba de cada pantalla, \"¿Cómo se usa?\" explica qué se hace ahí, paso a paso." },
      { t: "Lo que ves depende de tu rol", d: "Un cajero ve menos que el dueño. Si te falta una sección, pedile acceso a quien configura el comercio." },
    ],
    consejos: [],
  },
  {
    k: "ejemplos", titulo: "Los datos de ejemplo",
    para: "Al registrarte, el sistema se carga con productos, clientes y ventas de ejemplo para que veas cómo se ve con datos.",
    pasos: [
      { t: "Probá todo", d: "Cobrá, cargá, borrá: nada de eso es real." },
      { t: "Borralos cuando quieras", d: "Con \"Borrar ejemplos\" en el aviso de arriba. Lo que cargaste vos queda." },
    ],
    consejos: [],
  },
  {
    k: "lector", titulo: "Lector de códigos de barras",
    para: "Funciona en cualquier pantalla, sin hacer clic en ningún lado.",
    pasos: [
      { t: "En el cobro", d: "Escaneás y el producto se suma a la venta." },
      { t: "Fuera del cobro", d: "Se abre la ficha del producto; si no existe, el alta con el código ya cargado." },
      { t: "Productos sin código", d: "En Productos → Códigos de barras, el sistema les genera uno y los imprimís." },
    ],
    consejos: [],
  },
  {
    k: "impresora", titulo: "Impresora de tickets",
    para: "Funciona con impresoras térmicas de 58 y 80 mm conectadas a la computadora.",
    pasos: [
      { t: "Elegí el ancho", d: "En Ajustes → Equipos, 58 u 80 mm según tu papel." },
      { t: "Probá", d: "Hacé una venta de prueba e imprimí el ticket." },
      { t: "Si sale con fecha y dirección", d: "Es el navegador: en la ventana de imprimir, desmarcá \"Encabezados y pies de página\" una vez." },
    ],
    consejos: [],
  },
  {
    k: "sin-internet", titulo: "Si se corta internet",
    para: "Las ventas se guardan en la computadora antes de mandarse. Si se corta, se mandan solas cuando vuelve.",
    pasos: [{ t: "No cierres la página", d: "Hasta que vuelva la conexión, para que se terminen de mandar." }],
    consejos: [],
  },
];

/* La guía de una sección para el rubro: la general con lo que pisa el rubro. */
export function guiaDe(k, rubro) {
  const g = GUIAS[k];
  if (!g) return null;
  const extra = (g.porRubro && g.porRubro[rubro]) || {};
  return { k, ...g, ...extra };
}
