/* ============================================================
   LA FOTO DEL LOGIN · la que Genez sube desde su panel (0128)
   ============================================================

   Vive en Storage, en el bucket público `publico`, siempre en la misma
   ruta. El login la lee sin sesión por su URL pública; subirla o sacarla
   lo puede solo la plataforma (políticas de 0128).

   Va con un cache corto (5 minutos) y no con una ruta nueva por versión:
   el login no tiene sesión para preguntar cuál es la última, y una URL
   fija es lo único que puede conocer de antemano.

   Sin foto subida, o si no carga, queda la de la maqueta
   (public/login/fondo-oscuro.webp).
   ============================================================ */

const BUCKET = "publico";
const RUTA = "login/fondo";
export const FOTO_DE_FABRICA = "/login/fondo-oscuro.webp";

/* La URL pública, sin importar el cliente de Supabase: el login no puede
   morirse si faltan las variables (la pantalla de pruebas no las tiene). */
export function urlFotoLogin() {
  const base = import.meta.env.VITE_SUPABASE_URL;
  if (!base || import.meta.env.MODE === "pruebas") return null;
  return `${base}/storage/v1/object/public/${BUCKET}/${RUTA}`;
}

export async function subirFotoLogin(archivo) {
  const { supabase } = await import("./supabase.js");
  const { error } = await supabase.storage.from(BUCKET).upload(RUTA, archivo, {
    upsert: true, contentType: archivo.type, cacheControl: "300",
  });
  if (error) throw new Error(error.message || "No se pudo subir la foto.");
}

export async function sacarFotoLogin() {
  const { supabase } = await import("./supabase.js");
  const { error } = await supabase.storage.from(BUCKET).remove([RUTA]);
  if (error) throw new Error(error.message || "No se pudo sacar la foto.");
}
