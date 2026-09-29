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
  const LISTAS = [["zona", "Caseros"], ["zona", "San Martín Centro"], ["zona", "Villa Ballester"], ["zona", "Villa Bosch"],
    ["rubro", "Gastronomía"], ["rubro", "Almacén, kiosco o supermercado"], ["fuente", "Visita en persona"], ["fuente", "WhatsApp"],
    ["motivo_perdida", "Precio"], ["motivo_perdida", "No le interesa"], ["tipo_actividad", "Llamada"], ["tipo_actividad", "WhatsApp"],
    ["tipo_actividad", "Visita"], ["tipo_actividad", "Demo"], ["tipo_actividad", "Propuesta"], ["tipo_actividad", "Nota"],
    ["tipo_evento", "Demo de Genez", "demo"], ["tipo_evento", "Visita comercial", "visita"], ["categoria_tarea", "Comercial"], ["categoria_tarea", "Producto"]];
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
    interno_listas: LISTAS.map(([tipo, nombre, clave], i) => ({ id: id(), tipo, clave: clave || nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_"), nombre, orden: i, activo: true, datos: {} })),
    interno_historial: [], solicitudes: [],
    interno_prospectos: prospectos, interno_oportunidades: oportunidades, interno_contactos: [],
    interno_actividades: [{ id: id(), prospecto_id: prospectos[1].id, tipo: "visita", fecha: hace(1), resultado: "Le interesa, pidió una demo", datos: {} }],
    interno_tareas: [{ id: id(), titulo: "Llamar al almacén de prueba", prospecto_id: prospectos[0].id, estado: "pendiente", prioridad: "alta", vence: hoyA(18), archivado_en: null, checklist: [] },
      { id: id(), titulo: "Mandar la propuesta de prueba", prospecto_id: prospectos[2].id, estado: "pendiente", prioridad: "normal", vence: hace(2), archivado_en: null, checklist: [] }],
    interno_eventos: [{ id: id(), titulo: "Demo en el bar de prueba", tipo: "demo", prospecto_id: prospectos[1].id, inicio: hoyA(16), fin: hoyA(17), estado: "programado", archivado_en: null }],
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
    config: { negocio: "Comercio de prueba", fiscal: { condicion: "MONOTRIBUTO", razonSocial: "Comercio de prueba" } },
    activa: true, creada_en: hace(90), slug: "comercio-de-prueba",
  };
  const perfil = {
    id: USUARIO.id, nombre: "Persona de prueba", rol: "dueno", es_plataforma: false, activo: true, empresa_id: EMPRESA,
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
