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
    activo: f.activo !== false,
    historial: historial || [],
  };
}

export async function cargarProductos() {
  const [filas, costos] = await Promise.all([
    traerTodo("items_vista", "*", (q) => q.eq("tipo", "producto").order("nombre")),
    traerTodo("historial_costos", "item_id, costo, fecha", (q) => q.order("fecha")),
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
