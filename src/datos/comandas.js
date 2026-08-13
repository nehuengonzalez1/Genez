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
    sector: f.sector || "",
    capacidad: f.capacidad,
    orden: f.orden,
    activo: f.activo !== false,
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
      operaciones!inner ( id, estado, abierta_en, recursos ( nombre, sector ) )
    `)
    .eq("empresa_id", empresaId)
    .in("estado", ["pedido", "preparando", "listo"])
    .eq("operaciones.estado", "abierta");

  if (destino) q = q.eq("destino", destino);

  const { data, error } = await q;
  if (error) throw error;

  return (data || [])
    .map((f) => ({
      ...aLinea(f),
      comandaId: f.operaciones.id,
      mesa: f.operaciones.recursos ? f.operaciones.recursos.nombre : "",
      sector: f.operaciones.recursos ? f.operaciones.recursos.sector : "",
      desde: f.operaciones.abierta_en ? new Date(f.operaciones.abierta_en) : null,
    }))
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
    .select("id, nombre, categoria, precio, costo, iva, campos_extra, controla_stock")
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
