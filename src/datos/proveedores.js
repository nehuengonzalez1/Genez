/* ============================================================
   PROVEEDORES · la ficha de a quién se le compra
   ============================================================

   La tabla existe desde 0001 e `items.proveedor_id` apunta a ella, pero
   las pantallas seguían usando `PROV_INFO`, una lista inventada por el
   generador que se perdía al refrescar. Ahora la ficha se lee y se
   guarda acá.

   LA FORMA NO CAMBIA
   ------------------
   Compras, Productos y el alta de producto reciben `provs` como un objeto
   por nombre —{ "Distribuidora Sur": { pago, entrega, tel, cuit } }— y lo
   editan entero con `setProvs`. Esa forma se conserva, con el `id` de la
   fila adentro de cada ficha, para que ninguna pantalla cambie. La
   traducción entre las columnas (`condicion_pago`, `dias_entrega`) y los
   nombres de la aplicación (`pago`, `entrega`) vive solo acá.

   GUARDAR ES COMPARAR
   -------------------
   `guardarProveedores` mira qué cambió entre lo que había en la base y
   lo que quedó: una ficha con otros datos se actualiza, una que no
   estaba se inserta, y una que desapareció mientras aparecía otra sin id
   es un cambio de nombre —misma fila, otro nombre, así los productos que
   apuntan a ella no quedan huérfanos—. Lo que desaparece sin reemplazo
   se da de baja (`activo = false`); nunca se borra.
   ============================================================ */

import { supabase } from "./supabase.js";

const CAMPOS = ["pago", "entrega", "tel", "cuit", "email"];

const aFicha = (f) => ({
  id: f.id,
  pago: f.condicion_pago || "",
  entrega: f.dias_entrega || "",
  tel: f.tel || "",
  cuit: f.cuit || "",
  email: f.email || "",
});

const aFila = (nombre, p) => ({
  nombre,
  condicion_pago: p.pago || null,
  dias_entrega: p.entrega || null,
  tel: p.tel || null,
  cuit: p.cuit || null,
  email: p.email || null,
});

const iguales = (a, b) => CAMPOS.every((k) => (a[k] || "") === (b[k] || ""));

export async function cargarProveedores(empresaId) {
  if (!empresaId) throw new Error("cargarProveedores necesita la empresa.");

  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre, cuit, tel, email, condicion_pago, dias_entrega")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre");

  if (error) throw error;
  return Object.fromEntries((data || []).map((f) => [f.nombre, aFicha(f)]));
}

async function actualizar(empresaId, id, nombre, ficha) {
  const { error } = await supabase
    .from("proveedores")
    .update(aFila(nombre, ficha))
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) throw error;
}

async function insertar(empresaId, nombre, ficha) {
  const { data, error } = await supabase
    .from("proveedores")
    .insert({ empresa_id: empresaId, ...aFila(nombre, ficha) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function darDeBaja(empresaId, id) {
  const { error } = await supabase
    .from("proveedores")
    .update({ activo: false })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) throw error;
}

/* Devuelve el objeto con los ids que faltaban, para que la próxima
   comparación sepa qué fila es cada ficha. */
export async function guardarProveedores(empresaId, antes, despues) {
  if (!empresaId) throw new Error("guardarProveedores necesita la empresa.");

  const salida = { ...despues };
  const listos = new Set();

  const idos = Object.keys(antes).filter((n) => !(n in despues) && antes[n].id);
  const sinId = Object.keys(despues).filter((n) => !despues[n].id && !(n in antes));

  if (idos.length === 1 && sinId.length === 1) {
    const [viejo] = idos;
    const [nuevo] = sinId;
    await actualizar(empresaId, antes[viejo].id, nuevo, despues[nuevo]);
    salida[nuevo] = { ...despues[nuevo], id: antes[viejo].id };
    listos.add(nuevo);
    idos.length = 0;
  }

  for (const nombre of idos) await darDeBaja(empresaId, antes[nombre].id);

  for (const [nombre, ficha] of Object.entries(despues)) {
    if (listos.has(nombre)) continue;
    const previa = antes[nombre];
    const id = ficha.id || (previa && previa.id);
    if (id) {
      if (previa && previa.id === id && iguales(previa, ficha)) {
        salida[nombre] = { ...ficha, id };
        continue;
      }
      await actualizar(empresaId, id, nombre, ficha);
      salida[nombre] = { ...ficha, id };
    } else {
      salida[nombre] = { ...ficha, id: await insertar(empresaId, nombre, ficha) };
    }
  }

  return salida;
}
