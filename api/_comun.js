/**
 * Lo que comparten las funciones de api/.
 *
 * El guión bajo del nombre no es decorativo: Vercel no publica como ruta los
 * archivos que empiezan así, y el middleware de desarrollo hace lo mismo. Es
 * un módulo, no un endpoint.
 *
 * QUÉ PROTEGE QUÉ
 * ---------------
 * El chequeo de origen frena a un navegador ajeno y nada más. No es una
 * credencial: un script sin `Origin` no lo pisa siquiera, porque ese header
 * lo pone el navegador y no el que llama. Sirve como segunda línea y jamás
 * como única.
 *
 * Lo que protege de verdad es el token: quien llama tiene que ser un usuario
 * de un comercio de Genez. Eso es lo que separa "cualquiera que descubrió la
 * URL" de "alguien que entró al sistema".
 */

import { createClient } from "@supabase/supabase-js";

/* Antes era `origen.endsWith(host)`, y eso no valida un dominio: si el host
   es `genez.com.ar`, entonces `https://malicioso-genez.com.ar` termina con
   esa cadena y pasaba. Se compara el host del origen, entero y exacto. */
export function origenValido(req) {
  const origen = req.headers.origin;
  if (!origen) return true;   // sin header no hay nada que comparar; decide el token

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) return true;

  try {
    return new URL(origen).host === host;
  } catch {
    return false;             // un Origin que no es una URL no es de nadie
  }
}

/**
 * Quién llama, según Supabase. Devuelve el perfil de Genez o null.
 *
 * Se pregunta por el perfil y no solo por el usuario de Auth: alguien puede
 * existir en Auth y no pertenecer a ningún comercio —queda así si un alta
 * falla a la mitad— y ese no es usuario de Genez.
 */
export async function quienLlama(req) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const token = (req.headers.authorization || "").replace(/^Bearer /i, "").trim();
  if (!token) return null;

  /* Con la clave pública y el token del que llama, no con la maestra: acá
     solo hace falta saber quién es, y RLS ya deja que cada uno lea su
     propio perfil. Pedir la service_role para esto sería usar la llave de
     toda la base para mirar una fila que el interesado ya puede ver. */
  const suyo = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: sesion, error } = await suyo.auth.getUser(token);
  if (error || !sesion || !sesion.user) return null;

  const { data: perfil } = await suyo
    .from("perfiles")
    .select("id, nombre, empresa_id, es_plataforma, activo")
    .eq("id", sesion.user.id)
    .maybeSingle();

  if (!perfil || !perfil.activo) return null;

  return { ...perfil, email: sesion.user.email, token, suyo };
}
