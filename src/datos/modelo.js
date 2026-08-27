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
