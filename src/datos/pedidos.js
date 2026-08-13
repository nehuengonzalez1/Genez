/* ============================================================
   PEDIDOS · el centro de pedidos
   ============================================================

   Un pedido de take away no es una entidad nueva: es la misma
   `operacion` con la que se cobra en el mostrador y se atiende una mesa
   (ver ARQUITECTURA.md). Lo que este archivo agrega es lo que un centro
   de pedidos necesita y una comanda no tenía: el estado propio del
   pedido, su historial y el aviso en el momento en que algo cambia.

   Casi todo lo pesado vive en la base. `pedidos_vista` arma la tarjeta
   entera —canal, cliente, platos, total, hace cuánto que está donde
   está— y `mover_pedido` valida el flujo del canal, mueve la cocina y
   deja historial en una sola transacción. Este archivo traduce, no
   decide.
   ============================================================ */

import { supabase } from "./supabase.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

/* Las cinco columnas del tablero, en orden. El color es el del estado y
   no el del canal: a un metro de distancia lo que hay que ver es qué
   falta hacer, no de dónde vino. */
/* `verbo` es lo que hay que hacer para que un pedido LLEGUE a ese estado,
   no lo que se hace estando ahí. Va así porque un canal puede saltear
   etapas: la etiqueta del botón tiene que salir de a dónde va el pedido y
   no de dónde está, o dice cualquier cosa apenas alguien arma un flujo
   distinto. */
export const ESTADOS = [
  { k: "pendiente",      n: "Pendientes",         corto: "Pendiente",      verbo: "Volver a pendiente" },
  { k: "en_preparacion", n: "En preparación",     corto: "En preparación", verbo: "Empezar a preparar" },
  { k: "listo",          n: "Listo para retirar", corto: "Listo",          verbo: "Marcar como listo" },
  { k: "en_camino",      n: "En camino",          corto: "En camino",      verbo: "Despachar" },
  { k: "completado",     n: "Completados",        corto: "Completado",     verbo: "Cobrar y completar" },
  { k: "cancelado",      n: "Cancelados",         corto: "Cancelado",      verbo: "Cancelar" },
];

export const estadoPorK = (k) => ESTADOS.find((e) => e.k === k) || ESTADOS[0];

export const ABIERTOS = ["pendiente", "en_preparacion", "listo", "en_camino"];

/* Qué se puede hacer con un pedido según dónde está y por qué flujo pasa
   su canal. Sale del flujo guardado en la base: un canal nuevo con otro
   recorrido no necesita que nadie toque esta función.

   Completar no está: un pedido se completa cobrándolo, y eso pasa por
   cerrar la comanda con su caja, su stock y su numeración. */
export function siguientes(pedido) {
  const flujo = pedido.flujo || [];
  const i = flujo.indexOf(pedido.estado);
  if (pedido.estado === "completado" || pedido.estado === "cancelado") return [];
  return flujo
    .slice(i + 1)
    .filter((e) => e !== "completado")
    .slice(0, 1)
    .map((e) => ({ k: e, n: estadoPorK(e).verbo }));
}

/* Si el que sigue en el flujo es "completado", lo que queda por hacer es
   cobrar. La pantalla lo pregunta así para no ofrecer un botón que la
   base va a rechazar. */
export function toca_cobrar(pedido) {
  const flujo = pedido.flujo || [];
  const i = flujo.indexOf(pedido.estado);
  return i >= 0 && flujo[i + 1] === "completado";
}

export function anterior(pedido) {
  const flujo = pedido.flujo || [];
  const i = flujo.indexOf(pedido.estado);
  return i > 0 ? flujo[i - 1] : null;
}

/* ------------------------------------------------------------
   CANALES
   ------------------------------------------------------------ */

function aCanal(f) {
  return {
    id: f.id,
    clave: f.clave,
    nombre: f.nombre,
    familia: f.familia,
    flujo: f.flujo || [],
    externo: !!f.externo,
    color: f.color || f.familia,
    icono: f.icono,
    orden: f.orden,
    activo: f.activo !== false,
    config: f.config || {},
  };
}

/* El salón queda afuera de todas las listas del centro de pedidos: es
   otra pantalla y otro flujo. Se pide igual porque las operaciones de
   mesa lo usan y hay que saber traducir la clave a un nombre. */
export async function cargarCanales(empresaId, { conSalon = false } = {}) {
  const { data, error } = await supabase
    .from("canales").select("*").eq("empresa_id", empresaId).order("orden");
  if (error) throw error;
  return (data || []).map(aCanal).filter((c) => conSalon || c.familia !== "salon");
}

export async function crearCanal(empresaId, datos) {
  const { data, error } = await supabase
    .from("canales")
    .insert({
      empresa_id: empresaId,
      clave: datos.clave,
      nombre: datos.nombre,
      familia: datos.familia || "mostrador",
      flujo: datos.flujo,
      externo: !!datos.externo,
      color: datos.color || datos.familia || "app",
      icono: datos.icono || "ShoppingBag",
      orden: datos.orden ?? 90,
    })
    .select("*").single();

  if (error) {
    if (error.code === "23505") throw new Error("Ya hay un canal con esa clave.");
    throw error;
  }
  return aCanal(data);
}

export async function guardarCanal(id, cambios) {
  const { data, error } = await supabase
    .from("canales").update(cambios).eq("id", id).select("*").single();
  if (error) throw error;
  return aCanal(data);
}

/* Un canal no se borra: se apaga. Los pedidos que entraron por ahí lo
   siguen apuntando, y sin la fila el informe del año pasado no sabría
   cómo se llamaba. */
export const apagarCanal = (id, activo) => guardarCanal(id, { activo });

/* ------------------------------------------------------------
   LOS PEDIDOS
   ------------------------------------------------------------ */

function aPedido(f) {
  const abierta = f.abierta_en ? new Date(f.abierta_en) : (f.fecha ? new Date(f.fecha) : null);
  const cli = (f.campos_extra && f.campos_extra.cliente) || {};
  return {
    id: f.id,
    numero: f.numero,
    referencia: f.referencia,
    estado: f.estado_pedido,
    cerrada: f.estado === "confirmada",
    cancelada: f.estado === "cancelada",

    canal: f.canal,
    canalNombre: f.canal_nombre,
    familia: f.familia,
    color: f.color || f.familia,
    icono: f.icono,
    flujo: f.flujo || [],
    externo: !!f.externo,

    cliente: {
      nombre: f.cliente_nombre || cli.nombre || "",
      telefono: f.cliente_tel || cli.telefono || "",
      domicilio: f.cliente_domicilio || cli.domicilio || "",
      notas: cli.notas || "",
    },
    clienteId: f.cliente_id,
    mesa: f.mesa || null,
    sector: f.sector || null,

    usuario: f.usuario_nombre || "",
    abiertaEn: abierta,
    cerradaEn: f.cerrada_en ? new Date(f.cerrada_en) : null,
    estadoDesde: f.estado_desde ? new Date(f.estado_desde) : abierta,
    minutos: n(f.minutos),
    minutosEstado: n(f.minutos_estado),

    lineas: (f.detalle || []).map((l) => ({
      id: l.id,
      nombre: l.nombre,
      cantidad: n(l.cantidad),
      estado: l.estado,
      total: n(l.total),
      notas: l.notas || "",
      modificadores: l.modificadores || [],
    })),
    items: n(f.items),
    renglones: n(f.renglones),
    sinEnviar: n(f.sin_enviar),
    enCocina: n(f.en_cocina),
    listos: n(f.listos),

    subtotal: n(f.subtotal),
    descuento: n(f.descuento),
    descuentoPct: f.descuento_pct == null ? null : Number(f.descuento_pct),
    recargo: n(f.recargo),
    total: n(f.total),
    comensales: f.comensales,
  };
}

const COLUMNAS = `
  id, numero, referencia, estado, estado_pedido, canal, canal_nombre, familia, color, icono,
  flujo, externo, fecha, abierta_en, cerrada_en, recurso_id, mesa, sector,
  cliente_id, cliente_nombre, cliente_tel, cliente_domicilio, usuario_nombre,
  comensales, descuento, descuento_pct, recargo, campos_extra,
  subtotal, items, renglones, sin_enviar, en_cocina, listos, detalle, total,
  estado_desde, minutos, minutos_estado
`;

const arranqueDelDia = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

/* Lo que tiene que ver el tablero: todo lo que está en curso, sin
   importar de qué día sea, más lo que se cerró hoy.

   El corte por fecha va solo en lo cerrado a propósito. Un pedido que
   quedó abierto de anoche es justamente el que hay que resolver: si se
   filtrara por fecha desaparecería del tablero y nadie se enteraría de
   que existe. */
export async function cargarPedidos(empresaId, { desde = null } = {}) {
  const base = () => supabase
    .from("pedidos_vista").select(COLUMNAS)
    .eq("empresa_id", empresaId)
    .neq("familia", "salon");

  const [activos, cerrados] = await Promise.all([
    base().in("estado_pedido", ABIERTOS).order("abierta_en", { ascending: true }),
    base().in("estado_pedido", ["completado", "cancelado"])
      .gte("fecha", desde || arranqueDelDia())
      .order("cerrada_en", { ascending: false }),
  ]);

  if (activos.error) throw activos.error;
  if (cerrados.error) throw cerrados.error;

  return [...(activos.data || []), ...(cerrados.data || [])].map(aPedido);
}

/* El historial, con filtros. Es la misma vista: un pedido de hace tres
   meses se mira igual que uno de hace tres minutos. */
export async function buscarPedidos(empresaId, {
  desde = null, hasta = null, canal = null, estado = null, texto = "", tope = 200,
} = {}) {
  let q = supabase
    .from("pedidos_vista").select(COLUMNAS)
    .eq("empresa_id", empresaId)
    .neq("familia", "salon")
    .order("fecha", { ascending: false })
    .limit(tope);

  if (desde) q = q.gte("fecha", desde);
  if (hasta) q = q.lt("fecha", hasta);
  if (canal) q = q.eq("canal", canal);
  if (estado) q = q.eq("estado_pedido", estado);

  const t = (texto || "").trim();
  if (t) {
    /* El escape importa: una coma adentro del texto partiría la
       condición en dos y la consulta buscaría cualquier cosa. */
    const v = `%${t.replace(/[,()]/g, " ")}%`;
    q = q.or([
      `referencia.ilike.${v}`,
      `numero.ilike.${v}`,
      `cliente_nombre.ilike.${v}`,
      `canal_nombre.ilike.${v}`,
    ].join(","));
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(aPedido);
}

export async function cargarPedido(id) {
  const { data, error } = await supabase
    .from("pedidos_vista").select(COLUMNAS).eq("id", id).single();
  if (error) throw error;
  return aPedido(data);
}

/* Por dónde pasó y cuándo. Es lo que contesta "¿por qué este pedido
   tardó cuarenta minutos?" sin que nadie tenga que acordarse. */
export async function historialDe(pedidoId) {
  const { data, error } = await supabase
    .from("pedido_estados")
    .select("id, estado, anterior, motivo, fecha, perfiles ( nombre )")
    .eq("operacion_id", pedidoId)
    .order("fecha", { ascending: true });
  if (error) throw error;
  return (data || []).map((h) => ({
    id: h.id,
    estado: h.estado,
    anterior: h.anterior,
    motivo: h.motivo || "",
    fecha: new Date(h.fecha),
    quien: h.perfiles ? h.perfiles.nombre : "",
  }));
}

export async function pagosDe(pedidoId) {
  const { data, error } = await supabase
    .from("pagos").select("id, medio, monto, recargo, referencia").eq("operacion_id", pedidoId);
  if (error) throw error;
  return (data || []).map((p) => ({ ...p, monto: n(p.monto), recargo: n(p.recargo) }));
}

/* ------------------------------------------------------------
   MOVER

   Una sola llamada. La base valida contra el flujo del canal, mueve las
   líneas que correspondan y escribe el historial; si algo de eso falla,
   no pasa nada de lo otro.
   ------------------------------------------------------------ */

const DICHO = {
  P0010: "Ese pedido ya no existe.",
  P0011: "Ese pedido ya está cerrado.",
  P0012: "Para completar el pedido hay que cobrarlo.",
  P0013: "Ese canal no pasa por ese estado.",
};

export async function moverPedido(id, estado, motivo = null) {
  const { data, error } = await supabase.rpc("mover_pedido", {
    p_pedido: id, p_estado: estado, p_motivo: motivo,
  });
  if (error) throw new Error(DICHO[error.code] || error.message);
  return data;
}

export const cancelarPedido = (id, motivo) => moverPedido(id, "cancelado", motivo);

/* ------------------------------------------------------------
   ESTADÍSTICAS
   ------------------------------------------------------------ */

export async function estadisticas(empresaId, desde, hasta) {
  const { data, error } = await supabase.rpc("estadisticas_pedidos", {
    p_empresa: empresaId,
    p_desde: desde instanceof Date ? desde.toISOString() : desde,
    p_hasta: hasta instanceof Date ? hasta.toISOString() : hasta,
  });
  if (error) throw error;
  return data || {};
}

/* ------------------------------------------------------------
   TIEMPO REAL

   Postgres avisa; acá se traduce ese aviso a "volvé a leer". No se
   intenta parchear la fila que cambió con lo que trae el evento: un
   pedido en pantalla es el cruce de una operación, sus líneas y su
   historial, y reconstruir eso a mano en el navegador es la clase de
   código que queda desincronizado sin que nadie se dé cuenta. Releer una
   vista que ya está armada cuesta una consulta y no puede mentir.

   El aviso se junta durante un instante antes de releer: cuando entra un
   pedido con seis platos llegan siete eventos seguidos, y son una sola
   lectura.
   ------------------------------------------------------------ */

export function escucharPedidos(empresaId, alCambiar, { esperaMs = 350, alEstado = null } = {}) {
  let tarea = null;
  const avisar = (novedad) => {
    if (tarea) clearTimeout(tarea);
    tarea = setTimeout(() => { tarea = null; alCambiar(novedad); }, esperaMs);
  };

  const canal = supabase
    .channel(`pedidos:${empresaId}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "operaciones", filter: `empresa_id=eq.${empresaId}` },
      (e) => avisar({
        tipo: e.eventType,
        /* Un pedido nuevo es el único evento que la pantalla anuncia con
           sonido: lo demás ya se está mirando. */
        nuevo: e.eventType === "INSERT" && e.new && e.new.tipo === "comanda" && e.new.canal !== "salon",
        fila: e.new || null,
      }))
    .on("postgres_changes",
      { event: "*", schema: "public", table: "operacion_lineas", filter: `empresa_id=eq.${empresaId}` },
      () => avisar({ tipo: "lineas" }))
    /* La pantalla muestra si está escuchando o si se quedó con el reloj:
       "última actualización 12:45" quiere decir cosas muy distintas si
       el aviso llega solo o si hay que esperar al próximo sondeo. */
    .subscribe((estado) => alEstado && alEstado(estado === "SUBSCRIBED"));

  return () => {
    if (tarea) clearTimeout(tarea);
    supabase.removeChannel(canal);
  };
}
