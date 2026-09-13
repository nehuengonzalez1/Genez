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
   ============================================================ */

export const MODULOS = [
  { k: "cobro", n: "Cobro", d: "Punto de venta, tickets y vuelto", base: true, necesita: ["Impresora térmica de 58 u 80 mm para el ticket", "Lector de códigos de barras (o la cámara del celular)"] },
  { k: "caja", n: "Caja", d: "Arqueo, gastos y cierre", base: true, necesita: [] },
  { k: "ajustes", n: "Ajustes", d: "Configuración del negocio", base: true, necesita: [] },
  { k: "comandas", n: "Salón", d: "Mesas, comandas y cocina", necesita: ["Una impresora en cocina o barra para la comanda"] },
  { k: "productos", n: "Productos", d: "Catálogo, precios y listas", necesita: ["Tu lista de productos con precio y costo (planilla o carga a mano)"] },
  { k: "stock", n: "Stock", d: "Alertas, vencimientos e inventario", necesita: [] },
  { k: "compras", n: "Compras", d: "Remitos, costos y proveedores", necesita: [] },
  { k: "pedidos", n: "Pedidos", d: "Preparación con pistola", necesita: [] },
  { k: "clientes", n: "Clientes", d: "Facturación A, B y C", necesita: ["CUIT y condición frente al IVA si vas a facturar"] },
  { k: "equipo", n: "Equipo", d: "Quién trabaja, qué hace y cuándo", necesita: [] },
  { k: "agenda", n: "Agenda", d: "Turnos, clases y disponibilidad", necesita: ["Los horarios de cada persona y de cada sala"] },
  { k: "ventas", n: "Ventas", d: "Abonos, packs y planes", necesita: [] },
  { k: "finanzas", n: "Finanzas", d: "Caja, ingresos, egresos y sueldos", necesita: [] },
  { k: "servicios", n: "Servicios y recursos", d: "Qué se ofrece y dónde se hace", necesita: ["Tu lista de servicios con duración y precio"] },
  { k: "reportes", n: "Informes", d: "Ventas, márgenes y rubros", necesita: [] },
  /* Dos informes y no uno con un `if` adentro: el del comercio mira
     margen por producto y el del negocio de turnos mira ocupación, que no
     comparten ni una métrica. Misma decisión que Finanzas en 0038. */
  { k: "informes", n: "Informes", d: "Ingresos, ocupación, asistencia y clientes", necesita: [] },
  { k: "crm", n: "Seguimiento", d: "A quién conviene escribirle, y por qué", necesita: ["WhatsApp en el teléfono del local"] },
  { k: "comunicaciones", n: "Avisos", d: "Recordatorios de turno, plantillas e historial", necesita: ["WhatsApp en el teléfono del local"] },
  { k: "permisos", n: "Permisos", d: "Qué puede hacer cada rol, y quién cambió qué", necesita: [] },
  { k: "asistente", n: "Asistente", d: "Diagnóstico y consultas", necesita: [] },
];

export const MODULOS_BASE = MODULOS.filter((m) => m.base).map((m) => m.k);

export const moduloPorClave = (k) => MODULOS.find((m) => m.k === k) || null;
