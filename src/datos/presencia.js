/* ============================================================
   LAS FOTOS DE LA PÁGINA DEL COMERCIO (0140)
   ============================================================

   La galería de Presencia online. Las fotos van al bucket público
   `publico`, en la carpeta del comercio (`<empresa_id>/galeria/...`): la
   base deja escribir solo ahí y solo con el permiso de configurar. En la
   config queda la dirección de cada una, que es lo que lee la página.

   Se achican antes de subir —1600 px del lado largo, JPEG— porque una
   foto de celular pesa 4 o 5 MB y la página la tiene que bajar entera en
   el teléfono de quien la mira.
   ============================================================ */

import { supabase } from "./supabase.js";

const BUCKET = "publico";
const LADO = 1600;

function achicar(archivo) {
  return new Promise((resolver, fallar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); fallar(new Error("Esa imagen no se puede usar.")); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, LADO / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * escala);
      c.height = Math.round(img.naturalHeight * escala);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolver(b) : fallar(new Error("No se pudo preparar la imagen."))), "image/jpeg", 0.82);
    };
    img.src = url;
  });
}

/* Devuelve { url, ruta }: la dirección pública y dónde quedó, para
   poder borrarla después. */
/* `carpeta`: "galeria" para la página, "productos" para la tienda (0141). */
export async function subirFotoPublica(empresaId, archivo, carpeta = "galeria") {
  if (!empresaId) throw new Error("No se sabe de qué comercio es la foto.");
  if (!/^image\//.test(archivo.type || "")) throw new Error("Tiene que ser una imagen.");
  const foto = await achicar(archivo);
  const ruta = `${empresaId}/${carpeta}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, foto, { contentType: "image/jpeg", upsert: false });
  if (error) {
    throw new Error(/row-level|policy|Unauthorized|403/i.test(error.message || "")
      ? "Tu usuario no puede cambiar la página del comercio."
      : error.message || "No se pudo subir la foto.");
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return { url: data.publicUrl, ruta };
}

/* Si falla no se corta nada: la foto ya salió de la galería, y un
   archivo huérfano en el bucket no se ve en ningún lado. */
export async function borrarFotoPublica(ruta) {
  if (!ruta) return;
  await supabase.storage.from(BUCKET).remove([ruta]).catch(() => {});
}
