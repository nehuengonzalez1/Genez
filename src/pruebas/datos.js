/* ============================================================
   La pantalla de pruebas · los datos de mentira
   ============================================================

   Un comercio inventado por rubro (?rubro=minimercado, gastronomia o
   servicios), con productos, mesas y una sucursal. Nada sale de un
   comercio real: los productos son inventados y los códigos de barras
   también. Lo de la plataforma (menús y roles) viene de plataforma.json,
   que copia scripts/armar-datos-de-prueba.mjs.

   Se arma de nuevo en cada carga de la página: lo que se haga en la
   pantalla de pruebas dura hasta refrescar, y nunca sale del navegador.
   ============================================================ */

import plataforma from "./plataforma.json";

export const USUARIO = { id: "00000000-0000-4000-8000-000000000001", email: "prueba@genez.test" };
const EMPRESA = "00000000-0000-4000-8000-0000000000e1";
const SUCURSAL = "00000000-0000-4000-8000-0000000000a1";
const CAJA = "00000000-0000-4000-8000-0000000000c1";

let n = 0;
const id = () => `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}`;
const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();

const PRODUCTOS = {
  minimercado: [
    ["Almacén", "Fideos tirabuzón de prueba 500 g", 1200, 800], ["Almacén", "Arroz largo fino de prueba 1 kg", 1900, 1300],
    ["Almacén", "Yerba mate de prueba 1 kg", 4800, 3600], ["Almacén", "Aceite de girasol de prueba 1,5 L", 3900, 2900],
    ["Bebidas", "Gaseosa cola de prueba 2,25 L", 3100, 2100], ["Bebidas", "Agua sin gas de prueba 2 L", 1300, 800],
    ["Bebidas con alcohol", "Cerveza rubia de prueba 473 ml", 1800, 1200], ["Kiosco", "Alfajor triple de prueba", 900, 550],
    ["Kiosco", "Chocolate con leche de prueba 100 g", 2400, 1600], ["Limpieza", "Lavandina de prueba 1 L", 1100, 700],
    ["Limpieza", "Detergente de prueba 750 ml", 1700, 1100], ["Perfumería", "Shampoo de prueba 400 ml", 3800, 2600],
    ["Refrigerados", "Leche entera de prueba 1 L", 1400, 1000], ["Refrigerados", "Yogur de frutilla de prueba 900 g", 2900, 2000],
  ],
  gastronomia: [
    ["Cervezas", "Pinta rubia", 4500, 1500], ["Cervezas", "Pinta negra", 4800, 1600], ["Tragos", "Fernet con cola", 6000, 2000],
    ["Para compartir", "Papas con cheddar", 9000, 3000], ["Para compartir", "Rabas", 14000, 6000], ["Principales", "Hamburguesa completa", 12000, 4500],
    ["Principales", "Milanesa con fritas", 13500, 5000], ["Postres", "Flan con dulce de leche", 5000, 1500],
  ],
  servicios: [
    ["Cortes", "Corte de pelo", 8000, 0], ["Cortes", "Corte y barba", 11000, 0], ["Color", "Tintura completa", 25000, 6000],
  ],
};

/* Founder (0113) de mentira: el fundador como único miembro, las doce
   etapas y algunas listas. Lo mismo que siembra la migración, en chico. */
function founder(usuario) {
  const ETAPAS = [["Nuevo", 5, "abierta"], ["Para investigar", 5, "abierta"], ["Contacto pendiente", 10, "abierta"], ["Contactado", 15, "abierta"],
    ["Interesado", 30, "abierta"], ["Demo agendada", 45, "abierta"], ["Demo realizada", 60, "abierta"], ["Propuesta enviada", 70, "abierta"],
    ["Negociación", 80, "abierta"], ["Ganado", 100, "ganada"], ["Perdido", 0, "perdida"], ["Pausado", 0, "pausada"]];
  const LISTAS = [["zona", "Caseros", "caseros", { lat: -34.607366, lng: -58.5661311, radio: 1500 }], ["zona", "San Martín Centro"], ["zona", "Villa Ballester"], ["zona", "Villa Bosch"],
    ["rubro", "Gastronomía"], ["rubro", "Almacén, kiosco o supermercado"], ["fuente", "Visita en persona"], ["fuente", "WhatsApp"],
    ["motivo_perdida", "Precio"], ["motivo_perdida", "No le interesa"], ["tipo_actividad", "Llamada"], ["tipo_actividad", "WhatsApp"],
    ["tipo_actividad", "Visita"], ["tipo_actividad", "Demo"], ["tipo_actividad", "Propuesta"], ["tipo_actividad", "Nota"],
    ["tipo_evento", "Demo de Genez", "demo"], ["tipo_evento", "Visita comercial", "visita"], ["categoria_tarea", "Comercial"], ["categoria_tarea", "Producto"],
    ...["venta_confirmada", "relevamiento", "configuracion", "carga_datos", "usuarios", "capacitacion", "pruebas", "puesta_en_marcha", "seguimiento_inicial", "completada"]
      .map((k, i) => ["etapa_implementacion", ["Venta confirmada", "Relevamiento", "Configuración", "Carga de datos", "Usuarios y permisos", "Capacitación", "Pruebas", "Puesta en marcha", "Seguimiento inicial", "Implementación completada"][i], k]),
    ["modulo", "Cobro", "cobro"], ["modulo", "Productos", "productos"], ["modulo", "Stock", "stock"], ["modulo", "Impresión", "impresion"], ["modulo", "Agenda y turnos", "agenda"],
    ["categoria_ticket", "Consulta de uso", "consulta"], ["categoria_ticket", "Error del sistema", "error"], ["categoria_ticket", "Impresión", "impresion"],
    ["canal_ticket", "WhatsApp", "whatsapp"], ["canal_ticket", "Llamada", "llamada"],
    ["tipo_documento", "Procedimiento", "procedimiento"], ["tipo_documento", "Guion de demo", "guion_demo"], ["tipo_documento", "Nota", "nota"], ["tipo_documento", "Decisión de producto", "decision"], ["tipo_documento", "Base del asistente", "base_bot"],
    ["canal_contenido", "Instagram", "instagram"], ["canal_contenido", "TikTok", "tiktok"], ["formato_contenido", "Reel", "reel"], ["formato_contenido", "Carrusel", "carrusel"],
    ["categoria_ingreso", "Suscripción", "suscripcion"], ["categoria_ingreso", "Implementación", "implementacion"],
    ["categoria_gasto", "Hosting", "hosting"], ["categoria_gasto", "Dominios", "dominios"], ["medio_pago", "Transferencia", "transferencia"], ["medio_pago", "Mercado Pago", "mercado_pago"]];
  const etapas = ETAPAS.map(([nombre, probabilidad, tipo], i) => ({ id: id(), nombre, orden: i + 1, probabilidad, tipo, activa: true }));
  /* Tres comercios inventados en etapas distintas, con una tarea de hoy,
     una vencida y una reunión de hoy: lo justo para que Mi día, el
     pipeline y la agenda tengan qué mostrar. Los nombres dicen "de prueba". */
  const ahora = Date.now();
  const hoyA = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  const prospectos = [["Almacén de prueba La Esquina", "Caseros", "almacen_kiosco_o_supermercado", 2, 4],
    ["Bar de prueba El Farol", "Villa Ballester", "gastronomia", 5, 1], ["Kiosco de prueba 24", "Villa Bosch", "almacen_kiosco_o_supermercado", 7, -2]]
    .map(([nombre, localidad, rubro, etapa, prox]) => ({ id: id(), nombre, localidad, zona: localidad.toLowerCase().replace(/ /g, "_"), rubro, fuente: "visita_en_persona",
      telefono: "1100000000", interes: "tibio", creado_en: hace(3), proximo_contacto: new Date(ahora + prox * 86400000).toISOString(), archivado_en: null, _etapa: etapa }));
  const oportunidades = prospectos.map((p) => ({ id: id(), prospecto_id: p.id, nombre: `Genez para ${p.nombre}`, etapa_id: etapas[p._etapa].id,
    valor: 34000, probabilidad: etapas[p._etapa].probabilidad, estado: "abierta", archivado_en: null, creado_en: hace(3), actualizado_en: hace(1), modulos: [] }));
  prospectos.forEach((p) => delete p._etapa);
  return {
    interno_miembros: [{ perfil_id: usuario.id, rol: "fundador", areas: ["*"], activo: true, creado_en: hace(30), perfiles: { nombre: "Persona de prueba", email: usuario.email } }],
    interno_etapas: etapas,
    interno_listas: LISTAS.map(([tipo, nombre, clave, datos], i) => ({ id: id(), tipo, clave: clave || nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_"), nombre, orden: i, activo: true, datos: datos || {} })),
    interno_historial: [],
    /* Un pedido de la landing, para la pestaña del Prospector (0123). */
    solicitudes: [{ id: id(), creado_en: hace(1), estado: "nueva", negocio: "Almacén Web de Prueba", rubro: "minimercado", escala: null, respuestas: [], modulos: ["cobro", "stock"],
      mensual: 45000, puesta_en_marcha: 0, nombre: "Lucía Prueba", telefono: "1100000084", email: "lucia@prueba.test", mensaje: "Quiero ver una demo", origen: "landing", notas: null, prospecto_id: null }],
    interno_prospectos: prospectos, interno_oportunidades: oportunidades, interno_contactos: [],
    interno_actividades: [{ id: id(), prospecto_id: prospectos[1].id, tipo: "visita", fecha: hace(1), resultado: "Le interesa, pidió una demo", datos: {} }],
    interno_tareas: [{ id: id(), titulo: "Llamar al almacén de prueba", prospecto_id: prospectos[0].id, estado: "pendiente", prioridad: "alta", vence: hoyA(18), archivado_en: null, checklist: [] },
      { id: id(), titulo: "Mandar la propuesta de prueba", prospecto_id: prospectos[2].id, estado: "pendiente", prioridad: "normal", vence: hace(2), archivado_en: null, checklist: [] }],
    /* El modelo de implementación de 0115, en chico: uno para todos y dos que dependen de módulos. */
    interno_impl_modelo: [["relevamiento", "Cómo trabajan hoy", []], ["carga_datos", "Catálogo de productos con precio", ["productos"]],
      ["carga_datos", "Profesionales y sus horarios", ["agenda"]], ["usuarios", "Un usuario por persona, con su rol", []]]
      .map(([etapa, titulo, modulos], i) => ({ id: id(), etapa, titulo, modulos, rubros: [], orden: i, activo: true })),
    interno_clientes: [], interno_impl_etapas: [], interno_tickets: [], interno_ticket_mensajes: [], interno_adjuntos: [],
    interno_proveedores: [
      { clave: "osm", nombre: "OpenStreetMap (Overpass)", licencia: "ODbL 1.0", atribucion: "© colaboradores de OpenStreetMap, disponible bajo la licencia ODbL",
        campos_permitidos: ["nombre", "rubro", "direccion", "telefono"], retencion_dias: null, costo: "Gratis", limites: "Uso razonable", terminos_url: "https://wiki.openstreetmap.org/wiki/Overpass_API", activo: true, notas: "Datos de voluntarios, sin verificar." },
      { clave: "planilla", nombre: "Planilla propia (CSV o Excel)", licencia: "Propia", atribucion: null, campos_permitidos: ["nombre"], retencion_dias: null, costo: "Gratis", limites: null, terminos_url: null, activo: true, notas: null },
    ],
    interno_busquedas: [], interno_hallazgos: [],
    interno_cuentas: [], interno_suscripciones: [], interno_suscripciones_cambios: [], interno_movimientos: [],
    interno_ajustes: [{ clave: "empresa", valor: {} }, { clave: "agenda", valor: { hora_inicio: 7, hora_fin: 22 } },
      { clave: "whatsapp", valor: { phone_number_id: "000000000000000", waba_id: "000000000000000", numero: "+54 9 11 0000-0000" } },
      { clave: "bot", valor: { activo: false, modo: "borrador", modelo: "claude-opus-5-5", aviso: "Hola, soy el asistente automático de Genez. Si preferís hablar con una persona, escribí PERSONA.", max_por_hora: 6 } }],
    ...whatsapp(),
    interno_planes: [], interno_objetivos: [], interno_contenidos: [], interno_contenido_metricas: [], interno_grabaciones: [],
    interno_proyectos: [], interno_versiones: [], interno_roadmap: [], interno_roadmap_tickets: [], interno_documentos: [
      { id: id(), titulo: "Qué es Genez", tipo: "base_bot", categoria: "Asistente", estado: "vigente", version: 2, contenido: "Genez es un sistema de gestión para comercios.", etiquetas: [], archivado_en: null, actualizado_en: hace(1), creado_en: hace(2) },
      { id: id(), titulo: "Precios y condiciones", tipo: "base_bot", categoria: "Asistente", estado: "borrador", version: 1, contenido: "Precios a confirmar.", etiquetas: [], archivado_en: null, actualizado_en: hace(1), creado_en: hace(2) }],
    interno_documentos_versiones: [],
    interno_eventos: [{ id: id(), titulo: "Demo en el bar de prueba", tipo: "demo", prospecto_id: prospectos[1].id, inicio: hoyA(16), fin: hoyA(17), estado: "programado", archivado_en: null }],
  };
}

/* WhatsApp (0120): una conversación con la ventana abierta y mensajes sin
   leer, y otra con la ventana cerrada, para ver el cuadro apagado. */
function whatsapp() {
  const hora = (h) => new Date(Date.now() - h * 3600000).toISOString();
  const c1 = { id: id(), wa_id: "5491155550001", nombre_perfil: "Almacén Don Prueba", estado: "abierta", consentimiento: "sin_dato", no_leidos: 2,
    ultimo_entrante_en: hora(2), ultimo_mensaje_en: hora(2), ultimo_texto: "¿Y cuánto sale por mes?", ultimo_direccion: "entrante", prospecto_id: null, asignado_id: null };
  const c2 = { id: id(), wa_id: "5491155550002", nombre_perfil: "Rosa (prueba)", estado: "pendiente", consentimiento: "dado", no_leidos: 0,
    ultimo_entrante_en: hora(30), ultimo_mensaje_en: hora(29), ultimo_texto: "Te paso los precios mañana.", ultimo_direccion: "saliente", prospecto_id: null, asignado_id: null };
  const c3 = { id: id(), wa_id: "5491155550003", nombre_perfil: "Kiosco (prueba)", estado: "abierta", consentimiento: "sin_dato", no_leidos: 1,
    ultimo_entrante_en: hora(1), ultimo_mensaje_en: hora(1), ultimo_texto: "¿Cuánto sale?", ultimo_direccion: "entrante", prospecto_id: null, asignado_id: null,
    bot_pausado: true, derivada_en: hora(1), derivada_motivo: "Pide precios y la base no los tiene." };
  Object.assign(c1, { bot_pausado: false, derivada_en: null, derivada_motivo: null });
  Object.assign(c2, { bot_pausado: false, derivada_en: null, derivada_motivo: null });
  const m = (c, direccion, texto, h, estado) => ({ id: id(), conversacion_id: c.id, direccion, tipo: "text", texto, datos: {}, estado, error: null, momento: hora(h), estado_en: hora(h) });
  return {
    interno_wa_conversaciones: [c1, c2, c3],
    interno_wa_borradores: [{ id: id(), conversacion_id: c1.id, accion: "responder", estado: "pendiente", creado_en: hora(1.9), modelo: "claude-opus-5-5",
      texto: "Depende de los módulos que necesites. ¿Me contás qué vendés y si trabajás con lector de códigos? Así te paso a alguien del equipo con el presupuesto.",
      motivo: "Pregunta el precio; la base no tiene precios.", datos: { rubro: "almacén", necesidad: "", negocio: "Almacén Don Prueba", quiere_demo: false },
      conocimiento: [{ id: "doc", titulo: "Qué es Genez", version: 2 }, { id: "doc2", titulo: "Precios y condiciones", version: 1 }] }],
    interno_wa_mensajes: [
      m(c1, "entrante", "Hola, vi el cartel del sistema para comercios", 3, "recibido"),
      m(c1, "saliente", "¡Hola! Sí, es Genez. ¿Qué tipo de comercio tenés?", 2.9, "leido"),
      m(c1, "entrante", "Un almacén en Caseros", 2.1, "recibido"),
      m(c1, "entrante", "¿Y cuánto sale por mes?", 2, "recibido"),
      m(c2, "entrante", "Hola, quería info", 30, "recibido"),
      m(c2, "saliente", "Te paso los precios mañana.", 29, "entregado"),
      m(c3, "entrante", "¿Cuánto sale?", 1, "recibido"),
    ],
    interno_wa_eventos: [{ id: 1, recibido_en: hora(2), mensajes: 1, estados: 0, error: null }],
    ...automatizaciones(c2, hora),
  };
}

/* Automatizaciones (0122): una plantilla aprobada y otra en borrador,
   las cuatro reglas de arranque (el recordatorio prendido), y una cola
   con algo por aprobar, algo omitido y algo enviado. */
function automatizaciones(conv, hora) {
  const pl = { id: id(), nombre: "recordatorio_demo", idioma: "es_AR", categoria: "UTILITY", estado: "aprobada", archivado_en: null, creado_en: hora(48),
    cuerpo: "Hola {{1}}, te recordamos la demo de Genez del {{2}} a las {{3}}. Si no podés, respondé este mensaje.", variables: ["nombre", "dia", "hora"], ejemplos: ["Juan", "martes", "10:00"] };
  const borr = { id: id(), nombre: "seguimiento_info", idioma: "es_AR", categoria: "MARKETING", estado: "borrador", archivado_en: null, creado_en: hora(2),
    cuerpo: "Hola {{1}}, ¿pudiste ver lo que te mandamos de Genez? Si querés, coordinamos una demo.", variables: ["nombre"], ejemplos: ["Juan"] };
  const base = { parametros: {}, hora_desde: 9, hora_hasta: 20, dias: [1, 2, 3, 4, 5, 6], tope_persona_dia: 1, tope_persona_semana: 2, tope_dia: 30, aprobacion_manual: true, archivado_en: null, plantilla_id: null };
  const r1 = { ...base, id: id(), nombre: "Recordatorio de demo o reunión", tipo: "recordatorio_evento", activa: true, plantilla_id: pl.id, parametros: { horas_antes: 24, tipos: ["demo", "reunion", "visita"] }, consentimiento: "sin_baja", creado_en: hora(90) };
  const r2 = { ...base, id: id(), nombre: "Seguimiento a quien pidió información", tipo: "seguimiento", activa: false, parametros: { dias: 3 }, consentimiento: "dado", creado_en: hora(89) };
  const r3 = { ...base, id: id(), nombre: "Oportunidades sin contacto", tipo: "alerta_oportunidad", activa: true, parametros: { dias: 7 }, consentimiento: "dado", creado_en: hora(88) };
  const r4 = { ...base, id: id(), nombre: "Conversaciones que esperan", tipo: "alerta_conversacion", activa: true, parametros: { minutos: 60 }, consentimiento: "dado", creado_en: hora(87) };
  const env = (o) => ({ id: id(), automatizacion_id: r1.id, plantilla_id: pl.id, intentos: 0, error: null, programado_para: hora(1), creado_en: hora(1), ...o });
  return {
    interno_wa_plantillas: [pl, borr],
    interno_automatizaciones: [r1, r2, r3, r4],
    interno_envios: [
      env({ clave_unica: "a", destinatario: "Almacén de prueba La Esquina", destino_wa: "5491100000000", valores: ["Almacén", "jueves", "16:00"], estado: "por_aprobar" }),
      env({ clave_unica: "b", destinatario: "Kiosco de prueba 24", destino_wa: null, valores: [], estado: "omitido", motivo: "El prospecto no tiene WhatsApp ni teléfono cargado." }),
      env({ clave_unica: "c", destinatario: "Rosa (prueba)", destino_wa: conv.wa_id, valores: ["Rosa", "martes", "10:00"], estado: "enviado", creado_en: hora(26) }),
    ],
    interno_auto_corridas: [
      { id: 2, empezo_en: hora(0.05), termino_en: hora(0.05), origen: "reloj", generados: 1, alertas: 1, enviados: 0, fallidos: 0, error: null },
      { id: 1, empezo_en: hora(26), termino_en: hora(26), origen: "servidor", generados: 0, alertas: 0, enviados: 1, fallidos: 0, error: null },
    ],
    interno_alertas: [
      { id: id(), tipo: "oportunidad_quieta", titulo: "Kiosco de prueba 24", detalle: "Sin contacto desde hace 9 días.", enlace_tipo: "prospecto", enlace_id: null, clave_unica: "q", creada_en: hora(3), descartada_en: null },
      { id: id(), tipo: "conversacion_espera", titulo: "Kiosco (prueba)", detalle: "El asistente te la pasó y nadie la atendió.", enlace_tipo: "conversacion", enlace_id: null, clave_unica: "e", creada_en: hora(0.5), descartada_en: null },
    ],
  };
}

export function armarDatos(rubro, sesion = "comercio") {
  n = 0;
  const r = plataforma.rubros.find((x) => x.clave === rubro) || plataforma.rubros.find((x) => x.clave === "minimercado");
  const lista = PRODUCTOS[r.clave] || PRODUCTOS.minimercado;
  const items = lista.map(([categoria, nombre, precio, costo], i) => {
    const u30 = r.clave === "servicios" ? 0 : [40, 3, 0, 12, 25, 1][i % 6];
    const cargado = i % 4 !== 3;   // uno de cada cuatro nunca se contó (0110)
    return {
      id: id(), empresa_id: EMPRESA, tipo: r.clave === "servicios" ? "servicio" : "producto", nombre, categoria, marca: "Prueba",
      sku: null, barcode: r.clave === "minimercado" ? `779000000${String(1000 + i).padStart(4, "0")}` : null,
      unidad: "un", costo, precio, precios: {}, iva: 21, iva_condicion: "gravado", controla_stock: r.clave === "minimercado",
      stock_min: 0, bulto: 6, duracion_min: r.clave === "servicios" ? 45 : null, campos_extra: {}, activo: true,
      proveedor: null, proveedor_id: null, stock: cargado ? [12, 2, 30, 0, 5, 18][i % 6] : -u30, vence: null,
      costo_prev: costo, precio_prev: precio, u30, u30p: u30, vel: +(u30 / 30).toFixed(4), ultima_venta: u30 ? hace(1) : null,
      descripcion: null, imagen: null, costo_reposicion: null, costo_reposicion_fecha: null, precio_abierto: false,
      stock_cargado: cargado, creado_en: hace(60), actualizado_en: hace(2),
    };
  });

  const empresa = {
    id: EMPRESA, nombre: `Comercio de prueba · ${r.nombre}`, rubro: r.clave, plan: "completo", modulos: r.modulos || [],
    /* ?tope=10: el descuento máximo de los roles que no son dueño (06/10),
       para probarlo con ?rol=encargado, que no entra a Ajustes. */
    config: { negocio: "Comercio de prueba", fiscal: { condicion: "MONOTRIBUTO", razonSocial: "Comercio de prueba" },
      ...((typeof location !== "undefined" && new URLSearchParams(location.search).get("tope"))
        ? { descuentoMax: Object.fromEntries(["encargado", "cajero", "repositor"].map((k) => [k, Number(new URLSearchParams(location.search).get("tope"))])) } : {}) },
    activa: true, creada_en: hace(90), slug: "comercio-de-prueba",
  };
  const perfil = {
    /* ?rol=cajero (encargado, repositor): para ver lo que ve otro rol (06/10). */
    id: USUARIO.id, nombre: "Persona de prueba", rol: (typeof location !== "undefined" && new URLSearchParams(location.search).get("rol")) || "dueno", es_plataforma: false, activo: true, empresa_id: EMPRESA,
    debe_cambiar_clave: false, invitado_en: null, email: USUARIO.email, permisos: {},
  };
  empresa.perfiles = [perfil];
  /* ?sesion=plataforma: la cuenta de plataforma que además es del equipo
     interno, para ver el panel de comercios y Founder. */
  if (sesion === "plataforma") Object.assign(perfil, { es_plataforma: true, empresa_id: null, rol: "dueno" });

  const recursos = r.clave === "gastronomia"
    ? Array.from({ length: 8 }, (_, i) => ({ id: id(), empresa_id: EMPRESA, sucursal_id: SUCURSAL, tipo: "mesa", nombre: `Mesa ${i + 1}`, capacidad: 4, activo: true, unida_a: null, orden: i, qr_token: null }))
    : [];

  return {
    empresa, perfil,
    tablas: {
      perfiles: [perfil],
      empresas: [empresa],
      rubros: plataforma.rubros,
      roles_base: plataforma.roles_base,
      /* Tarifas de ejemplo para ver el presupuesto con precio y el descuento
         de lanzamiento: la lista al doble del esquema del 27/09 y 50% los
         primeros 6 meses. No son las de producción. */
      tarifas: [{ clave: "plan:start", monto: 29900, texto: null }, { clave: "plan:pro", monto: 59900, texto: null }, { clave: "anual_meses", monto: 10, texto: null }, { clave: "congelado_meses", monto: 6, texto: null }, { clave: "sucursales_incluidas", monto: 2, texto: null }, { clave: "sucursal_extra", monto: 14900, texto: null }, { clave: "base", monto: 52000, texto: null }, { clave: "puesta_en_marcha", monto: null, texto: null }, { clave: "descuento", monto: 50, texto: null }, { clave: "descuento_meses", monto: 6, texto: null }, { clave: "modulo:productos", monto: 12000, texto: null }, { clave: "modulo:reportes", monto: 4000, texto: null }, { clave: "modulo:informes", monto: 4000, texto: null }, { clave: "modulo:agenda", monto: 6000, texto: null }, { clave: "modulo:servicios", monto: 2000, texto: null }, { clave: "modulo:stock", monto: 18000, texto: null }, { clave: "modulo:compras", monto: 16000, texto: null }, { clave: "modulo:clientes", monto: 12000, texto: null }, { clave: "modulo:cuentas", monto: 12000, texto: null }, { clave: "modulo:comandas", monto: 10000, texto: null }, { clave: "modulo:pedidos", monto: 10000, texto: null }, { clave: "modulo:ventas", monto: 32000, texto: null }, { clave: "modulo:comunicaciones", monto: 24000, texto: null }, { clave: "modulo:equipo", monto: 14000, texto: null }, { clave: "modulo:finanzas", monto: 14000, texto: null }, { clave: "modulo:crm", monto: 12000, texto: null }, { clave: "modulo:asistente", monto: 12000, texto: null }, { clave: "modulo:permisos", monto: 10000, texto: null }, { clave: "whatsapp", monto: null, texto: "5491100000000" }, { clave: "medida:base", monto: 60000, texto: null }, { clave: "medida:productos", monto: 14000, texto: null }, { clave: "medida:reportes", monto: 5000, texto: null }, { clave: "medida:informes", monto: 5000, texto: null }, { clave: "medida:agenda", monto: 7000, texto: null }, { clave: "medida:servicios", monto: 3000, texto: null }, { clave: "medida:stock", monto: 22000, texto: null }, { clave: "medida:compras", monto: 19000, texto: null }, { clave: "medida:clientes", monto: 14000, texto: null }, { clave: "medida:cuentas", monto: 14000, texto: null }, { clave: "medida:comandas", monto: 12000, texto: null }, { clave: "medida:pedidos", monto: 12000, texto: null }, { clave: "medida:ventas", monto: 38000, texto: null }, { clave: "medida:comunicaciones", monto: 29000, texto: null }, { clave: "medida:equipo", monto: 17000, texto: null }, { clave: "medida:finanzas", monto: 17000, texto: null }, { clave: "medida:crm", monto: 14000, texto: null }, { clave: "medida:asistente", monto: 14000, texto: null }, { clave: "medida:permisos", monto: 12000, texto: null }],
      roles: [],
      sucursales: [{ id: SUCURSAL, empresa_id: EMPRESA, nombre: "Principal", domicilio: "Calle de prueba 123", activa: true, creada_en: hace(90) }],
      cajas: [{ id: CAJA, empresa_id: EMPRESA, sucursal_id: SUCURSAL, nombre: "Caja 1", orden: 0, activa: true, mp_caja: null, creada_en: hace(90) }],
      items: items.map(({ proveedor, stock, vence, costo_prev, precio_prev, u30, u30p, vel, ultima_venta, costo_reposicion, costo_reposicion_fecha, stock_cargado, ...i }) => i),
      items_vista: items,
      recursos,
      salon_vista: recursos.map((m) => ({ ...m, estado: "libre", consumido: 0, comanda_id: null, pedidos_qr: 0 })),
      promociones: [], clientes: [], proveedores: [], operaciones: [], operacion_lineas: [], sesiones_caja: [],
      movimientos_caja: [], movimientos_stock: [], stock_actual: [], caja_grande: [], caja_grande_saldos: [],
      catalogo_base: [],
      ...(sesion === "plataforma" ? founder(USUARIO) : {}),
    },
  };
}
