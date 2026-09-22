/* ============================================================
   CATÁLOGO · leer y guardar productos
   ============================================================

   La base devuelve columnas con nombres de base (stock_min, costo_prev).
   La aplicación viene hablando de stockMin y costoPrev desde antes.
   La traducción vive acá y en ningún otro lado: así los módulos siguen
   sin saber que atrás hay una base de datos.
   ============================================================ */

import { supabase } from "./supabase.js";

/* Supabase corta en 1.000 filas por consulta. Con 972 productos hoy no
   se nota, pero el historial ya son casi 3.000 y un catálogo real de
   varios miles llegaría igual. Se pagina siempre. */
const PAGINA = 1000;

async function traerTodo(tabla, columnas, filtros = (q) => q) {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await filtros(
      supabase.from(tabla).select(columnas).range(desde, desde + PAGINA - 1)
    );
    if (error) throw error;
    filas.push(...data);
    if (data.length < PAGINA) return filas;
  }
}

const n = (v) => (v === null || v === undefined ? 0 : Number(v));
const fecha = (v) => (v ? new Date(v) : null);

function aProducto(f, historial) {
  return {
    id: f.id,
    nombre: f.nombre,
    categoria: f.categoria || "",
    marca: f.marca || "",
    sku: f.sku || "",
    barcode: f.barcode || "",
    unidad: f.unidad || "un",
    costo: n(f.costo),
    costoPrev: n(f.costo_prev),
    costoReposicion: n(f.costo_reposicion) || n(f.costo),
    costoReposicionFecha: fecha(f.costo_reposicion_fecha),
    precio: n(f.precio),
    precioPrev: n(f.precio_prev),
    precios: f.precios || {},
    iva: n(f.iva),
    stock: n(f.stock),
    stockMin: n(f.stock_min),
    bulto: n(f.bulto),
    proveedor: f.proveedor || "",
    proveedorId: f.proveedor_id,
    vence: fecha(f.vence),
    u30: n(f.u30),
    u30p: n(f.u30p),
    vel: n(f.vel),
    ultimaVenta: fecha(f.ultima_venta),
    descripcion: f.descripcion || "",
    /* La foto es del producto y no de la pantalla que lo muestra: la
       carta de la comanda y el catálogo leen la misma. */
    imagen: f.imagen || "",
    /* Su precio lo escribe el cajero al vender. Distinto de `precio: 0`,
       que es un producto al que le falta cargarle el precio. */
    precioAbierto: f.precio_abierto === true,
    activo: f.activo !== false,
    historial: historial || [],
  };
}

/* El filtro por empresa va explícito y no se delega en RLS.

   RLS contesta "¿podés ver esto?", no "¿de qué comercio es esto?". Para un
   usuario de comercio las dos respuestas coinciden y por eso esto anduvo
   mucho tiempo. Pero el dueño de plataforma puede ver todo, así que
   entrando como Almha se cargaba también el catálogo de Super 25 y el del
   bar: 990 productos en un comercio que tiene nueve servicios y ninguno.

   Sin empresa no se consulta. Un id olvidado tiene que reventar acá y no
   aparecer como una Coca-Cola en el informe de una estética. */
export async function cargarProductos(empresaId) {
  if (!empresaId) throw new Error("cargarProductos necesita saber de qué comercio.");

  const [filas, costos] = await Promise.all([
    traerTodo("items_vista", "*", (q) => q.eq("empresa_id", empresaId).eq("tipo", "producto").order("nombre")),
    traerTodo("historial_costos", "item_id, costo, fecha", (q) => q.eq("empresa_id", empresaId).order("fecha")),
  ]);

  const porItem = new Map();
  for (const c of costos) {
    if (!porItem.has(c.item_id)) porItem.set(c.item_id, []);
    porItem.get(c.item_id).push({ fecha: new Date(c.fecha), costo: n(c.costo) });
  }

  return filas.map((f) => aProducto(f, porItem.get(f.id)));
}

/* Los nombres van al revés que en aProducto: de la aplicación a la base.
   Solo se listan los campos que se pueden editar; el stock no está
   porque no se escribe, se mueve. */
const COLUMNA = {
  nombre: "nombre",
  categoria: "categoria",
  marca: "marca",
  sku: "sku",
  barcode: "barcode",
  unidad: "unidad",
  costo: "costo",
  precio: "precio",
  precios: "precios",
  iva: "iva",
  stockMin: "stock_min",
  bulto: "bulto",
  proveedorId: "proveedor_id",
  descripcion: "descripcion",
  imagen: "imagen",
  precioAbierto: "precio_abierto",
  activo: "activo",
};

/* El historial de costos y precios no se manda: lo escribe un disparador
   de la base cuando detecta el cambio. Si lo mandáramos desde acá, cada
   pantalla tendría que acordarse y alguna se iba a olvidar. */
export async function guardarProducto(id, cambios) {
  const fila = {};
  for (const [campo, valor] of Object.entries(cambios)) {
    if (COLUMNA[campo] !== undefined) fila[COLUMNA[campo]] = valor;
  }
  if (!Object.keys(fila).length) return null;

  const { error } = await supabase.from("items").update(fila).eq("id", id);
  if (error) throw error;

  /* Se relee de la vista porque el costo anterior y el margen los
     recalcula la base, no el navegador. */
  const { data, error: e2 } = await supabase
    .from("items_vista").select("*").eq("id", id).single();
  if (e2) throw e2;

  return aProducto(data, null);
}

/* El alta trae stock inicial como asiento aparte: el producto se crea sin
   stock y después entra la mercadería, que es lo que realmente pasó. */
export async function crearProducto(empresaId, datos) {
  const fila = { empresa_id: empresaId, tipo: "producto" };
  for (const [campo, valor] of Object.entries(datos)) {
    if (COLUMNA[campo] !== undefined) fila[COLUMNA[campo]] = valor;
  }
  if (!fila.nombre) throw new Error("El producto necesita un nombre.");

  const { data, error } = await supabase.from("items").insert(fila).select("id").single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un producto con ese código.");
    throw error;
  }

  const stock = Number(datos.stock) || 0;
  if (stock > 0) {
    await ajustarStock({
      empresaId, itemId: data.id, cantidad: stock,
      tipo: "inicial", motivo: "Alta del producto",
      vence: datos.vence || null,
    });
  }

  const { data: fresco, error: e2 } = await supabase
    .from("items_vista").select("*").eq("id", data.id).single();
  if (e2) throw e2;

  return aProducto(fresco, null);
}

/* Un ajuste de inventario es un asiento más, nunca un stock nuevo. */
export async function ajustarStock({ empresaId, itemId, cantidad, tipo = "ajuste", motivo, operacionId = null, vence = null }) {
  const { error } = await supabase.from("movimientos_stock").insert({
    empresa_id: empresaId,
    item_id: itemId,
    cantidad,
    tipo,
    motivo,
    operacion_id: operacionId,
    vence,
  });
  if (error) throw error;
}

/* Un solo producto, ya calculado por la vista. Lo usa quien recibe un
   aviso de tiempo real: el evento trae la fila cruda de `items`, sin el
   stock, el costo anterior ni la rotación, que los arma `items_vista`. */
export async function cargarProducto(id) {
  const { data, error } = await supabase
    .from("items_vista").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? aProducto(data, null) : null;
}

/* ------------------------------------------------------------
   EL CATÁLOGO AVISA CUANDO CAMBIA (migración 0081)

   Hace falta porque el catálogo se carga una vez al entrar. Con la captura
   con pistola son dos computadoras sobre los mismos datos —una escanea y
   da de alta, otra completa precios— y sin esto la segunda mira una
   pantalla vieja sin ninguna señal de que lo está.

   Se avisa el id y no la fila: el evento trae `items` crudo y a la
   pantalla le sirve lo que devuelve la vista. Quien escucha decide si
   vale la pena ir a buscarlo.

   Con espera: dar de alta con pistola son muchos INSERT seguidos, y
   redibujar el catálogo en cada uno traba la pantalla justo cuando se está
   escaneando rápido.
   ------------------------------------------------------------ */
export function escucharItems(empresaId, alCambiar, { esperaMs = 400 } = {}) {
  if (!empresaId) return () => {};

  let tarea = null;
  const pendientes = new Map();

  const avisar = (tipo, id) => {
    if (!id) return;
    /* El último gana: si un producto se creó y se editó en la misma
       ráfaga, alcanza con leerlo una vez al final. */
    pendientes.set(id, tipo);
    if (tarea) clearTimeout(tarea);
    tarea = setTimeout(() => {
      tarea = null;
      const lote = [...pendientes.entries()].map(([id, tipo]) => ({ id, tipo }));
      pendientes.clear();
      alCambiar(lote);
    }, esperaMs);
  };

  const canal = supabase
    .channel(`items:${empresaId}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "items", filter: `empresa_id=eq.${empresaId}` },
      (e) => avisar(e.eventType, (e.new && e.new.id) || (e.old && e.old.id)))
    .subscribe();

  return () => {
    if (tarea) clearTimeout(tarea);
    supabase.removeChannel(canal);
  };
}

/* ------------------------------------------------------------
   DAR DE BAJA Y ELIMINAR NO SON LO MISMO

   Un producto que se vendió tiene historia colgando: movimientos de
   stock, historial de costos y de precios. Borrarlo se los lleva puestos
   —las claves foráneas son en cascada— y eso no se recupera. Las ventas
   sobreviven porque la línea guarda el nombre con el que se vendió, pero
   el resto no.

   Por eso son dos operaciones distintas y no un botón con un cartel:
   eliminar es para el error —lo que se escaneó de más, lo que se cargó
   dos veces— y dar de baja es para lo que dejó de venderse pero pasó por
   la caja.

   `usoDelProducto` es lo que permite ofrecer la correcta: la pantalla
   pregunta antes de mostrar el botón, en vez de intentar el borrado y
   traducir un error de la base.
   ------------------------------------------------------------ */
export async function usoDelProducto(id) {
  const contar = async (tabla) => {
    const { count, error } = await supabase
      .from(tabla).select("id", { count: "exact", head: true }).eq("item_id", id);
    if (error) throw error;
    return count || 0;
  };
  const [vendido, movimientos, enRecetas] = await Promise.all([
    contar("operacion_lineas"),
    contar("movimientos_stock"),
    contar("receta_insumos"),
  ]);
  return { vendido, movimientos, enRecetas };
}

export async function eliminarProducto(id) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) {
    /* `receta_insumos` es la única foránea que restringe en vez de
       cascadear: un insumo no se puede borrar mientras una receta lo use,
       porque el costo del producto terminado sale de él. */
    if (error.code === "23503") {
      throw new Error("Es insumo de una receta. Sacalo de la receta antes de eliminarlo.");
    }
    throw error;
  }
}
