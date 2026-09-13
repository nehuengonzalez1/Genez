/* ============================================================
   PLANES · qué se ofrece y cuánto cuesta
   ============================================================

   La plataforma los edita desde su panel (con sesión, RLS decide) y el
   alta guiada los lee sin sesión por `planes_publicos()`. La traducción
   entre columnas y nombres de la aplicación vive solo acá.
   ============================================================ */

const aPlan = (f) => ({
  clave: f.clave,
  nombre: f.nombre,
  bajada: f.bajada || "",
  precioMensual: f.precio_mensual == null ? null : Number(f.precio_mensual),
  moneda: f.moneda || "ARS",
  puestaEnMarcha: Number(f.puesta_en_marcha) || 0,
  modulos: f.modulos || [],
  rubros: f.rubros || [],
  orden: Number(f.orden) || 0,
  activo: f.activo !== false,
});

const aFila = (p) => ({
  clave: p.clave,
  nombre: p.nombre,
  bajada: p.bajada || null,
  precio_mensual: p.precioMensual == null || p.precioMensual === "" ? null : Number(p.precioMensual),
  moneda: p.moneda || "ARS",
  puesta_en_marcha: Number(p.puestaEnMarcha) || 0,
  modulos: p.modulos || [],
  rubros: p.rubros || [],
  orden: Number(p.orden) || 0,
  activo: p.activo !== false,
  actualizado_en: new Date().toISOString(),
});

/* Con sesión: todos, activos o no. Es lo que edita la plataforma. */
export async function cargarPlanes() {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.from("planes").select("*").order("orden");
  if (error) throw error;
  return (data || []).map(aPlan);
}

export async function guardarPlan(plan) {
  if (!plan.clave) throw new Error("El plan necesita una clave.");
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase
    .from("planes")
    .upsert(aFila(plan), { onConflict: "clave" })
    .select("*")
    .single();
  if (error) throw error;
  return aPlan(data);
}

/* Sin sesión: solo los activos, para el alta guiada. El cliente de
   Supabase se importa recién acá por lo mismo que en landing.js: sin
   variables de entorno la página pública no puede morirse. */
export async function cargarPlanesPublicos() {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.rpc("planes_publicos");
  if (error) throw error;
  return (data || []).map(aPlan);
}

/* El plan más barato que cubre lo que la persona necesita, o el que más
   se acerca con lo que le falta. `rubros` vacío en el plan es "para
   todos". Sin planes, o sin ninguno con precio, no se inventa nada:
   quien llama muestra "a confirmar". */
export function planParaModulos(planes, modulos, rubro) {
  const candidatos = (planes || [])
    .filter((p) => p.activo !== false)
    .filter((p) => !p.rubros.length || !rubro || p.rubros.includes(rubro));
  if (!candidatos.length) return null;

  const cubre = (p) => modulos.filter((k) => !p.modulos.includes(k));
  const conPrecio = (p) => (p.precioMensual == null ? Infinity : p.precioMensual);

  const completos = candidatos.filter((p) => cubre(p).length === 0).sort((a, b) => conPrecio(a) - conPrecio(b));
  if (completos.length) return { plan: completos[0], faltan: [] };

  const cercano = candidatos
    .map((p) => ({ plan: p, faltan: cubre(p) }))
    .sort((a, b) => a.faltan.length - b.faltan.length || conPrecio(a.plan) - conPrecio(b.plan))[0];
  return cercano;
}
