/* ============================================================
   EL MODELO · la única puerta hacia Anthropic
   ============================================================

   Dos pantallas consultan el modelo: el chat del Asistente y la lectura del
   remito por foto en Compras. Las dos armaban el `fetch` a mano, con los
   mismos headers repetidos.

   Ahora pasan por acá, y no por prolijidad: `api/anthropic.js` pide sesión
   —antes era un proxy abierto a la cuenta de Anthropic para cualquiera que
   descubriera la URL— y el token hay que mandarlo en cada llamada. Con dos
   copias del `fetch`, la próxima pantalla que consulte el modelo se olvida
   de mandarlo y da 401 sin que se entienda por qué.

   La API key nunca está de este lado. Vive en el servidor, que es de lo que
   se trata todo esto.
   ============================================================ */

import { supabase } from "./supabase.js";
import { API_BASE, API_MODELO } from "../utils/helpers.js";

/**
 * Le pregunta al modelo y devuelve el texto de la respuesta.
 *
 * `mensajes` va tal cual lo espera la API de Anthropic, así que quien llama
 * puede mandar texto o imágenes sin que esta función tenga que saber de qué
 * se trata.
 */
export async function preguntarAlModelo({ system, mensajes, maxTokens = 1000 }) {
  const { data } = await supabase.auth.getSession();
  const token = data && data.session ? data.session.access_token : null;
  if (!token) throw new Error("Se venció la sesión. Volvé a entrar.");

  const r = await fetch(`${API_BASE}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: API_MODELO,
      max_tokens: maxTokens,
      system,
      messages: mensajes,
    }),
  });

  const respuesta = await r.json().catch(() => null);

  if (!r.ok) {
    /* El mensaje del servidor cuando lo hay: distingue "falta la API key"
       de "se vencio la sesión", y las dos se arreglan distinto. */
    throw new Error(
      (respuesta && respuesta.error && respuesta.error.message) ||
      "No se pudo consultar al modelo."
    );
  }

  return ((respuesta && respuesta.content) || []).map((c) => c.text || "").join("\n").trim();
}

/* ------------------------------------------------------------
   UNA FOTO LISTA PARA MANDAR

   La foto de un remito salía de la cámara y se mandaba tal cual: doce
   megapíxeles convertidos a base64 son varios megas de cuerpo de petición,
   y las funciones de Vercel tienen un límite de tamaño. Una foto sacada de
   cerca con un teléfono nuevo podía fallar antes de llegar al modelo, con
   un error de red que no explicaba nada.

   Encogerla no pierde nada: Anthropic reduce toda imagen a 1568 px de lado
   mayor antes de leerla, así que mandar más grande es subir bytes que el
   modelo descarta. Mandar más chico sí costaría, porque la letra de un
   remito es lo que hay que leer, y por eso el tope es exactamente ése y no
   un número redondo más cómodo.

   El costo en tokens no cambia —lo fija el tamaño con el que lee el
   modelo, no el que subimos—; lo que cambia es que la subida entre y que
   el usuario espere menos.

   Sale siempre en JPEG: el PNG de una captura de pantalla de un remito
   pesa varias veces más sin verse mejor, porque es una foto y no un
   dibujo. Calidad 0.85 es donde el texto todavía se lee limpio.
   ------------------------------------------------------------ */
const LADO_MAYOR = 1568;

export async function fotoParaElModelo(file) {
  const imagen = await new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo abrir la foto.")); };
    img.src = url;
  });

  const mayor = Math.max(imagen.width, imagen.height);
  const escala = mayor > LADO_MAYOR ? LADO_MAYOR / mayor : 1;

  /* Ya entra: se manda como vino. Volver a codificarla solo le sacaría
     calidad a cambio de nada. */
  if (escala === 1 && ["image/jpeg", "image/webp"].includes(file.type)) {
    const b64 = await aBase64(file);
    return { b64, mediaType: file.type };
  }

  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext("2d");
  /* Un remito es texto fino: sin suavizado de calidad, encoger lo deja
     dentado y el modelo lee peor. */
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

  const datos = lienzo.toDataURL("image/jpeg", 0.85);
  return { b64: datos.split(",")[1], mediaType: "image/jpeg" };
}

function aBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1]);
    r.onerror = () => rej(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });
}
