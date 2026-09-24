/* ============================================================
   MÓDULOS · el catálogo de lo que Genez ofrece
   ============================================================

   Vivía adentro de PanelGenez.jsx. Sale a su propio archivo porque ahora
   lo leen tres lugares que no comparten nada más: el panel de plataforma
   (qué contrató cada comercio, qué incluye cada plan), el sistema (qué
   pestañas dibujar) y el alta guiada, que no tiene sesión y no puede
   cargar el sistema entero para saber cómo se llama "cobro".

   `base` son los que no se pueden desactivar. `necesita` es lo que el
   comercio tiene que tener de su lado para que el módulo sirva: es lo que
   el alta guiada le dice a la persona antes de que empiece.

   `nivel` es el plan más chico en el que entra el módulo: start (lo
   esencial), pro (control y crecimiento) o empresa (personas, análisis e
   IA). Los planes son fijos y cada uno contiene al anterior: así nadie
   puede armarse "Empresa" pagando "Pro".
   ============================================================ */

export const MODULOS = [
  { k: "cobro", n: "Cobro", d: "Punto de venta, tickets y vuelto", nivel: "start", base: true, necesita: ["Impresora térmica de 58 u 80 mm para el ticket", "Lector de códigos de barras (o la cámara del celular)"] },
  { k: "caja", n: "Caja", d: "Arqueo, gastos y cierre", nivel: "start", base: true, necesita: [] },
  { k: "ajustes", n: "Ajustes", d: "Configuración del negocio", nivel: "start", base: true, necesita: [] },
  { k: "comandas", n: "Salón", d: "Mesas, comandas y cocina", nivel: "pro", necesita: ["Una impresora en cocina o barra para la comanda"] },
  { k: "productos", n: "Productos", d: "Catálogo, precios y listas", nivel: "start", necesita: ["Tu lista de productos con precio y costo (planilla o carga a mano)"] },
  { k: "stock", n: "Stock", d: "Alertas, vencimientos e inventario", nivel: "pro", necesita: [] },
  { k: "compras", n: "Compras", d: "Remitos, costos y proveedores", nivel: "pro", necesita: [] },
  { k: "pedidos", n: "Pedidos", d: "Preparación con pistola", nivel: "pro", necesita: [] },
  { k: "clientes", n: "Clientes", d: "Facturación A, B y C", nivel: "pro", necesita: ["CUIT y condición frente al IVA si vas a facturar"] },
  { k: "cuentas", n: "Cuenta corriente", d: "Fiado: quién debe, cobrar, anular y ajustar", nivel: "pro", necesita: [] },
  { k: "equipo", n: "Equipo y RR. HH.", d: "Quién trabaja, horarios y liquidaciones", nivel: "empresa", necesita: [] },
  { k: "agenda", n: "Agenda", d: "Turnos, clases y disponibilidad", nivel: "start", necesita: ["Los horarios de cada persona y de cada sala"] },
  { k: "ventas", n: "Ventas", d: "Abonos, packs y planes", nivel: "pro", necesita: [] },
  { k: "finanzas", n: "Finanzas", d: "Caja, ingresos, egresos y sueldos", nivel: "empresa", necesita: [] },
  { k: "servicios", n: "Servicios y recursos", d: "Qué se ofrece y dónde se hace", nivel: "start", necesita: ["Tu lista de servicios con duración y precio"] },
  { k: "reportes", n: "Informes", d: "Ventas, márgenes y rubros", nivel: "start", necesita: [] },
  /* Dos informes y no uno con un `if` adentro: el del comercio mira
     margen por producto y el del negocio de turnos mira ocupación, que no
     comparten ni una métrica. Misma decisión que Finanzas en 0038. */
  { k: "informes", n: "Informes", d: "Ingresos, ocupación, asistencia y clientes", nivel: "start", necesita: [] },
  { k: "crm", n: "Seguimiento de clientes", d: "A quién conviene escribirle, y por qué", nivel: "empresa", necesita: ["WhatsApp en el teléfono del local"] },
  { k: "comunicaciones", n: "Avisos", d: "Recordatorios de turno, plantillas e historial", nivel: "pro", necesita: ["WhatsApp en el teléfono del local"] },
  { k: "permisos", n: "Permisos", d: "Qué puede hacer cada rol, y quién cambió qué", nivel: "empresa", necesita: [] },
  { k: "asistente", n: "Asistente con IA", d: "Diagnóstico y consultas", nivel: "empresa", necesita: [] },
];

export const MODULOS_BASE = MODULOS.filter((m) => m.base).map((m) => m.k);

export const moduloPorClave = (k) => MODULOS.find((m) => m.k === k) || null;

/* Los tres planes, de menor a mayor. Cada uno contiene al anterior. */
export const NIVELES = [
  { k: "start", n: "Start", d: "Lo esencial para empezar.", lema: "Ideal para negocios que recién empiezan." },
  { k: "pro", n: "Pro", d: "Más control, más posibilidades.", lema: "El plan ideal para hacer crecer tu negocio." },
  { k: "empresa", n: "Empresa", d: "Todo lo que tu negocio necesita.", lema: "La solución completa, sin límites." },
];

export const nivelDe = (k) => NIVELES.find((n) => n.k === ((moduloPorClave(k) || {}).nivel || "empresa")) || NIVELES[2];
