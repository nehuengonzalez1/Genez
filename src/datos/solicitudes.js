/* ============================================================
   SOLICITUDES · el pedido de presupuesto
   ============================================================

   Lo que la persona pide al final del alta guiada queda en `solicitudes`
   (0074) por `pedir_presupuesto()`, sin sesión. La plataforma lo lee y
   lo trabaja (estado, notas) desde su panel, con sesión.

   La validación de acá es la que ve la persona antes de mandar; la de
   la base es la que manda. Las dos dicen lo mismo a propósito.
   ============================================================ */

export const ESTADOS = [
  { k: "nueva", n: "Nueva" },
  { k: "contactada", n: "Contactada" },
  { k: "cerrada", n: "Cerrada" },
];

export const normalizarTelefono = (v) => String(v || "").replace(/[^\d]/g, "");

export function validarPedido({ nombre, telefono, email }) {
  if (!nombre || nombre.trim().length < 2) return "Decinos tu nombre.";
  const tel = normalizarTelefono(telefono);
  if (tel.length < 8 || tel.length > 15) return "El WhatsApp no parece un número: escribilo con código de área, sin el 0 ni el 15.";
  if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "El email no parece un email.";
  return null;
}

/* Lo que viaja a la base, limpio: sin espacios de más y sin vacíos
   disfrazados de texto. */
export function armarPedido(d) {
  const limpio = (v) => { const t = String(v || "").trim(); return t || null; };
  return {
    negocio: limpio(d.negocio),
    rubro: limpio(d.rubro),
    escala: limpio(d.escala),
    respuestas: (d.respuestas || []).map((r) => ({ k: r.k, n: r.n })),
    modulos: d.modulos || [],
    mensual: d.mensual == null ? null : Number(d.mensual),
    puesta_en_marcha: d.puesta_en_marcha == null ? null : Number(d.puesta_en_marcha),
    nombre: String(d.nombre || "").trim(),
    telefono: normalizarTelefono(d.telefono),
    email: limpio(d.email),
    mensaje: limpio(d.mensaje),
    origen: limpio(d.origen),
  };
}

/* El cliente de Supabase se importa recién acá por lo mismo que en
   landing.js: sin variables de entorno la página pública no puede
   morirse. */
export async function pedirPresupuesto(datos) {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.rpc("pedir_presupuesto", { p: armarPedido(datos) });
  if (error) throw error;
  return data;
}

const aSolicitud = (f) => ({
  ...f,
  respuestas: Array.isArray(f.respuestas) ? f.respuestas : [],
  modulos: f.modulos || [],
  mensual: f.mensual == null ? null : Number(f.mensual),
});

export async function cargarSolicitudes() {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.from("solicitudes").select("*").order("creado_en", { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).map(aSolicitud);
}

export async function guardarSolicitud(id, cambios) {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.from("solicitudes").update(cambios).eq("id", id).select("*").single();
  if (error) throw error;
  return aSolicitud(data);
}
