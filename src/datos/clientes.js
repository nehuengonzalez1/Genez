/* ============================================================
   CLIENTES · leer y guardar
   ============================================================

   La base guarda `razon_social` y `tipo_doc`; la aplicación viene hablando
   de `razonSocial` y `tipoDoc` desde el prototipo. La traducción vive acá y
   en ningún otro lado: los módulos siguen sin saber cómo se llaman las
   columnas.
   ============================================================ */

import { supabase } from "./supabase.js";

const COLUMNA = {
  razonSocial: "razon_social",
  tipoDoc: "tipo_doc",
  doc: "doc",
  condicion: "condicion",
  domicilio: "domicilio",
  email: "email",
  tel: "tel",
  camposExtra: "campos_extra",
  activo: "activo",
};

const SELECT =
  "id, razon_social, tipo_doc, doc, condicion, domicilio, email, tel, campos_extra, activo, creado_en";

function aCliente(f) {
  return {
    id: f.id,
    razonSocial: f.razon_social,
    tipoDoc: f.tipo_doc || "CUIT",
    doc: f.doc || "",
    condicion: f.condicion || "CF",
    domicilio: f.domicilio || "",
    email: f.email || "",
    tel: f.tel || "",
    camposExtra: f.campos_extra || {},
    activo: f.activo,
    alta: f.creado_en ? new Date(f.creado_en) : null,
  };
}

/* Solo viajan a la base los campos que existen como columna. El formulario
   arrastra cosas que no lo son —el id, banderas de la pantalla— y mandarlas
   haría fallar el insert entero. */
function aFila(datos) {
  const fila = {};
  for (const [campo, valor] of Object.entries(datos)) {
    if (COLUMNA[campo] !== undefined) fila[COLUMNA[campo]] = valor;
  }
  return fila;
}

/* Supabase corta en 1.000 filas por consulta. Una cartera de clientes real
   pasa ese número sin ser grande, así que se pagina siempre. */
const PAGINA = 1000;

export async function cargarClientes() {
  const filas = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await supabase
      .from("clientes")
      .select(SELECT)
      .eq("activo", true)
      .order("razon_social")
      .range(desde, desde + PAGINA - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < PAGINA) return filas.map(aCliente);
  }
}

export async function crearCliente(empresaId, datos) {
  const fila = { ...aFila(datos), empresa_id: empresaId };
  if (!fila.razon_social) throw new Error("El cliente necesita un nombre.");

  const { data, error } = await supabase
    .from("clientes")
    .insert(fila)
    .select(SELECT)
    .single();
  if (error) throw error;
  return aCliente(data);
}

export async function guardarCliente(id, cambios) {
  const fila = aFila(cambios);
  if (!Object.keys(fila).length) return null;

  const { data, error } = await supabase
    .from("clientes")
    .update(fila)
    .eq("id", id)
    .select(SELECT)
    .single();
  if (error) throw error;
  return aCliente(data);
}

/* Un cliente no se borra: se desactiva. Puede tener ventas atrás, y
   borrarlo dejaría comprobantes emitidos sin a quién apuntar. */
export async function desactivarCliente(id) {
  const { error } = await supabase.from("clientes").update({ activo: false }).eq("id", id);
  if (error) throw error;
}
