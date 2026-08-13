/* ============================================================
   COMANDAS · salón, pedido y cocina
   ============================================================

   El segundo comportamiento de venta. El cobro directo abre y cierra la
   operación en el mismo acto; acá la mesa queda abierta y va sumando
   consumos durante toda la atención.

   Casi todo lo pesado vive en la base: la vista del salón calcula
   totales y tiempos, y cerrar la comanda es una función que hace el
   mismo trabajo que cobrar en el mostrador. Este archivo traduce, no
   decide.
   ============================================================ */

import { supabase } from "./supabase.js";

const n = (v) => (v === null || v === undefined ? 0 : Number(v));

function aMesa(f) {
  return {
    id: f.id,
    tipo: f.tipo,
    nombre: f.nombre,
    piso: f.piso || "Planta baja",
    sector: f.sector || "",
    capacidad: f.capacidad,
    orden: f.orden,
    activo: f.activo !== false,
    x: n(f.x), y: n(f.y),
    ancho: n(f.ancho) || 2, alto: n(f.alto) || 2,
    forma: f.forma || "rectangulo",
    comandaId: f.comanda_id,
    ocupada: !!f.comanda_id,
    abiertaEn: f.abierta_en ? new Date(f.abierta_en) : null,
    minutos: f.minutos == null ? null : Number(f.minutos),
    consumido: n(f.consumido),
    items: n(f.items),
    enCocina: n(f.en_cocina),
    listos: n(f.listos),
  };
}

function aLinea(f) {
  return {
    id: f.id,
    itemId: f.item_id,
    nombre: f.descripcion,
    cantidad: n(f.cantidad),
    precio: n(f.precio_unitario),
    costo: n(f.costo_unitario),
    total: n(f.total),
    estado: f.estado,
    notas: f.notas || "",
    destino: f.destino || null,
    modificadores: f.modificadores || [],
    enviadaEn: f.enviada_en ? new Date(f.enviada_en) : null,
  };
}

export async function cargarSalon(empresaId) {
  const { data, error } = await supabase
    .from("salon_vista")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("orden");

  if (error) throw error;
  return (data || []).map(aMesa);
}

export async function cargarRecursos(empresaId) {
  const { data, error } = await supabase
    .from("recursos").select("*").eq("empresa_id", empresaId).order("orden");
  if (error) throw error;
  return data || [];
}

/* Si la mesa ya estaba ocupada devuelve la comanda que ya existe: tocar
   dos veces la misma mesa es lo más normal del mundo y no puede terminar
   en dos cuentas paralelas. Eso lo resuelve la base. */
export async function abrirComanda({ empresaId, sucursalId = null, recursoId, clienteId = null }) {
  const { data, error } = await supabase.rpc("abrir_comanda", {
    datos: {
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      recurso_id: recursoId,
      cliente_id: clienteId,
    },
  });
  if (error) throw error;
  return data;
}

/* Un pedido que no ocupa mesa: mostrador, para llevar, o el que entró por
   una aplicación. Es la misma comanda con la misma carta; lo único
   distinto es de dónde vino.

   A diferencia de una mesa, cada llamada abre un pedido nuevo: dos
   personas en el mostrador son dos pedidos aunque lleguen juntas. */
export async function abrirPedido({ empresaId, sucursalId = null, canal = "mostrador", referencia = null, cliente = null }) {
  const { data, error } = await supabase.rpc("abrir_comanda", {
    datos: {
      empresa_id: empresaId,
      sucursal_id: sucursalId,
      recurso_id: null,
      canal,
      referencia,
      campos_extra: cliente ? { cliente } : {},
    },
  });
  if (error) throw error;
  return data;
}

/* El canal se decide al comandar y no antes: quien está parado en el
   mostrador todavía no sabe si le van a pedir para llevar, o si lo que
   suena es un pedido de aplicación. Por eso un pedido nace como
   'mostrador' y se corrige mientras se carga. */
export async function cambiarCanal(comandaId, { canal, referencia = null, cliente = null }) {
  const fila = { canal, referencia };
  if (cliente !== undefined) fila.campos_extra = cliente ? { cliente } : {};

  const { error } = await supabase
    .from("operaciones").update(fila).eq("id", comandaId).eq("estado", "abierta");
  if (error) throw error;
}

export const CANALES = [
  { k: "mostrador", n: "Mostrador", d: "Come acá o espera en la barra" },
  { k: "takeaway", n: "Para llevar", d: "Pasa a buscar" },
  { k: "delivery", n: "Delivery propio", d: "Lo lleva el local" },
  { k: "app", n: "Aplicación", d: "PedidosYa, Rappi, Uber Eats" },
];

/* Los pedidos que no son de mesa, para el tablero de mostrador. El estado
   de cada uno sale de sus líneas: si todas están listas el pedido está
   listo, si alguna sigue en cocina el pedido está en preparación. */
export async function cargarPedidos(empresaId) {
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("operaciones")
    .select(`
      id, canal, referencia, estado, fecha, abierta_en, cerrada_en, total, campos_extra,
      operacion_lineas ( id, descripcion, cantidad, estado, total )
    `)
    .eq("empresa_id", empresaId)
    .eq("tipo", "comanda")
    .neq("canal", "salon")
    .gte("fecha", desde.toISOString())
    .order("abierta_en", { ascending: true });

  if (error) throw error;

  return (data || []).map((o) => {
    const lineas = (o.operacion_lineas || []).filter((l) => l.estado !== "anulada");
    const listas = lineas.filter((l) => l.estado === "listo" || l.estado === "entregado").length;

    let etapa = "pendiente";
    if (o.estado === "confirmada") etapa = "cerrado";
    else if (lineas.length && listas === lineas.length) etapa = "listo";
    else if (lineas.some((l) => l.estado === "preparando")) etapa = "preparando";

    const abierta = o.abierta_en ? new Date(o.abierta_en) : null;
    return {
      id: o.id,
      canal: o.canal,
      referencia: o.referencia,
      etapa,
      cerrado: o.estado === "confirmada",
      cliente: (o.campos_extra && o.campos_extra.cliente) || null,
      abiertaEn: abierta,
      minutos: abierta ? Math.floor((Date.now() - abierta.getTime()) / 60000) : null,
      lineas: lineas.map((l) => ({ id: l.id, nombre: l.descripcion, cantidad: n(l.cantidad), estado: l.estado })),
      total: n(o.total) || lineas.reduce((s, l) => s + n(l.total), 0),
    };
  });
}

/* ------------------------------------------------------------
   EL PLANO
   ------------------------------------------------------------ */

export async function cargarElementosPlano(empresaId) {
  const { data, error } = await supabase
    .from("plano_elementos").select("*").eq("empresa_id", empresaId);
  if (error) throw error;
  return data || [];
}

/* Guarda el plano entero de una sola vez. No se usa un upsert desde acá
   porque un upsert intenta insertar primero, y entonces Postgres exige
   las columnas obligatorias aunque la fila ya exista: fallaba por
   empresa_id nulo. Además, acomodar diez mesas de a una deja el plano
   mitad viejo y mitad nuevo si algo se corta en el medio. */
export async function guardarPlano(recursos) {
  const cambios = (recursos || []).map((r) => ({
    id: r.id,
    x: Math.round(r.x), y: Math.round(r.y),
    ancho: Math.round(r.ancho), alto: Math.round(r.alto),
    forma: r.forma,
    piso: r.piso,
    sector: r.sector || null,
    nombre: r.nombre,
    capacidad: r.capacidad == null ? null : Math.round(r.capacidad),
  }));
  if (!cambios.length) return 0;

  const { data, error } = await supabase.rpc("guardar_plano", { datos: { recursos: cambios } });
  if (error) throw error;
  return data;
}

export async function borrarElemento(id) {
  const { error } = await supabase.from("plano_elementos").delete().eq("id", id);
  if (error) throw error;
}

export async function guardarElementos(empresaId, elementos) {
  const { error } = await supabase.from("plano_elementos").upsert(
    elementos.map((e) => ({ ...e, empresa_id: empresaId })), { onConflict: "id" });
  if (error) throw error;
}

export async function crearRecurso({ empresaId, sucursalId = null, nombre, tipo = "mesa", piso = "Planta baja", sector = null, capacidad = 4, x = 0, y = 0, forma = "rectangulo" }) {
  const { data, error } = await supabase
    .from("recursos")
    .insert({ empresa_id: empresaId, sucursal_id: sucursalId, nombre, tipo, piso, sector, capacidad, x, y, forma })
    .select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya hay un lugar con ese nombre.");
    throw error;
  }
  return data;
}

export async function borrarRecurso(id) {
  const { error } = await supabase.from("recursos").delete().eq("id", id);
  if (error) throw error;
}

export async function cargarComanda(comandaId) {
  const { data, error } = await supabase
    .from("operaciones")
    .select(`
      id, numero, estado, fecha, abierta_en, recurso_id, cliente_id,
      recursos ( nombre, sector ),
      operacion_lineas (
        id, item_id, descripcion, cantidad, precio_unitario, costo_unitario,
        total, estado, notas, destino, modificadores, enviada_en
      )
    `)
    .eq("id", comandaId)
    .single();

  if (error) throw error;

  const todas = (data.operacion_lineas || []).map(aLinea);
  /* Las anuladas viajan aparte. En la comanda no van: quien está tomando
     el pedido necesita ver lo que la mesa va a pagar, no un historial
     tachado. Pero no se pierden, porque alguien las pidió y capaz se
     cocinaron. */
  const lineas = todas.filter((l) => l.estado !== "anulada");

  return {
    id: data.id,
    numero: data.numero,
    estado: data.estado,
    recursoId: data.recurso_id,
    mesa: data.recursos ? data.recursos.nombre : "",
    sector: data.recursos ? data.recursos.sector : "",
    clienteId: data.cliente_id,
    abiertaEn: data.abierta_en ? new Date(data.abierta_en) : null,
    lineas,
    anuladas: todas.filter((l) => l.estado === "anulada"),
    total: lineas.reduce((s, l) => s + l.total, 0),
  };
}

/* Los modificadores con precio suman al total de la línea: "extra queso"
   no es una aclaración, es plata. */
export async function agregarLinea({ comandaId, empresaId, item, cantidad = 1, modificadores = [], notas = "", destino = null }) {
  const extra = (modificadores || []).reduce((s, m) => s + n(m.precio), 0);
  const unitario = n(item.precio) + extra;

  const { data, error } = await supabase
    .from("operacion_lineas")
    .insert({
      operacion_id: comandaId,
      empresa_id: empresaId,
      item_id: item.id,
      descripcion: item.nombre,
      cantidad,
      precio_unitario: unitario,
      costo_unitario: n(item.costo),
      iva: n(item.iva) || 21,
      total: Math.round(unitario * cantidad),
      modificadores,
      notas,
      destino: destino || (item.campos_extra && item.campos_extra.destino) || null,
    })
    .select("id, item_id, descripcion, cantidad, precio_unitario, costo_unitario, total, estado, notas, destino, modificadores, enviada_en")
    .single();

  if (error) throw error;
  return aLinea(data);
}

/* Anular no borra. Una línea que se pidió y se dio de baja es información
   del servicio: alguien la cargó, quizá se cocinó, y el encargado tiene
   derecho a verla. Los totales y el stock ya la ignoran. */
export async function anularLinea(lineaId) {
  const { error } = await supabase
    .from("operacion_lineas").update({ estado: "anulada" }).eq("id", lineaId);
  if (error) throw error;
}

/* Manda a la cocina lo que todavía no salió, y solo eso. Si a las nueve
   se pidieron dos hamburguesas y a las diez una porción de papas, la
   cocina recibe las papas: repetir las hamburguesas es cómo se arruina
   un servicio. Devuelve cuántas salieron. */
export async function enviarACocina(comandaId) {
  const { data, error } = await supabase.rpc("enviar_a_cocina", { comanda: comandaId });
  if (error) throw error;
  return data || 0;
}

export async function cambiarEstadoLinea(lineaId, estado) {
  const campos = { estado };
  if (estado === "preparando") campos.enviada_en = new Date().toISOString();
  if (estado === "listo") campos.lista_en = new Date().toISOString();

  const { error } = await supabase
    .from("operacion_lineas").update(campos).eq("id", lineaId);
  if (error) throw error;
}

/* Lo que está esperando en cocina, de todas las mesas a la vez. El
   destino separa la pantalla de la cocina de la de la barra: al que hace
   los tragos no le sirve ver las hamburguesas. */
export async function cargarPendientes(empresaId, destino = null) {
  let q = supabase
    .from("operacion_lineas")
    .select(`
      id, descripcion, cantidad, estado, notas, destino, modificadores, enviada_en,
      operaciones!inner ( id, estado, abierta_en, canal, referencia, campos_extra, recursos ( nombre, sector ) )
    `)
    .eq("empresa_id", empresaId)
    .in("estado", ["pedido", "preparando", "listo"])
    .eq("operaciones.estado", "abierta");

  if (destino) q = q.eq("destino", destino);

  const { data, error } = await q;
  if (error) throw error;

  return (data || [])
    .map((f) => {
      const o = f.operaciones;
      const app = o.campos_extra && o.campos_extra.cliente && o.campos_extra.cliente.app;
      /* La cocina necesita saber para dónde va el plato, no solo qué es.
         Un pedido sin mesa llegaba con el título vacío y el que cocina no
         podía distinguir un delivery de una mesa del salón. */
      const nombreCanal = { mostrador: "Mostrador", takeaway: "Para llevar", delivery: "Delivery", app: app || "Aplicación" };
      return {
        ...aLinea(f),
        comandaId: o.id,
        canal: o.canal || "salon",
        referencia: o.referencia || null,
        mesa: o.recursos ? o.recursos.nombre : (nombreCanal[o.canal] || "Pedido"),
        sector: o.recursos ? o.recursos.sector : (o.referencia ? `#${o.referencia}` : ""),
        desde: o.abierta_en ? new Date(o.abierta_en) : null,
      };
    })
    /* Lo que espera hace más tiempo va primero: es el orden en que la
       cocina tiene que resolverlo. */
    .sort((a, b) => (a.desde || 0) - (b.desde || 0));
}

/* Cobrar la mesa. Los totales los calcula la base a partir de las líneas
   guardadas y no de lo que informe esta pantalla, que puede estar
   mirando una comanda de hace media hora. */
export async function cerrarComanda({ comandaId, sesionId, pagos, numero = null, descuento = 0, recargo = 0 }) {
  const { data, error } = await supabase.rpc("cerrar_comanda", {
    p_comanda: comandaId,
    p_sesion: sesionId,
    p_pagos: pagos,
    p_numero: numero,
    p_descuento: Math.round(descuento || 0),
    p_recargo: Math.round(recargo || 0),
  });

  if (error) {
    if (error.code === "P0001") throw new Error("Abrí la caja antes de cobrar la mesa.");
    if (error.code === "P0003") throw new Error("Esa mesa ya fue cobrada.");
    throw error;
  }
  return data;
}

/* La carta agrupada por categoría, que es como se busca un plato cuando
   hay gente esperando. */
export async function cargarCarta(empresaId) {
  const { data, error } = await supabase
    .from("items")
    .select("id, nombre, descripcion, categoria, precio, costo, iva, campos_extra, controla_stock")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("categoria")
    .order("nombre");

  if (error) throw error;

  const porCategoria = new Map();
  for (const i of data || []) {
    const cat = i.categoria || "Sin categoría";
    if (!porCategoria.has(cat)) porCategoria.set(cat, []);
    porCategoria.get(cat).push({
      ...i,
      precio: n(i.precio),
      costo: n(i.costo),
      destino: (i.campos_extra && i.campos_extra.destino) || null,
    });
  }
  return [...porCategoria.entries()].map(([categoria, items]) => ({ categoria, items }));
}
