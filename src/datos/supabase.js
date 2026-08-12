/* ============================================================
   CONEXIÓN A SUPABASE
   ============================================================

   Las dos variables son públicas: viajan dentro del bundle que corre
   en el navegador de cualquier cliente. Lo que protege los datos no es
   esconder la clave, son las políticas de RLS de la base.

   La clave que sí es secreta (service_role) no se usa desde el front
   nunca. Si alguna vez hace falta, va en una función de api/.
   ============================================================ */

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const clave = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !clave) {
  throw new Error(
    "Faltan las variables de Supabase. Copiá .env.example a .env y completá " +
    "VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(url, clave, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    /* El link que llega por mail para recuperar la contraseña trae la
       sesión en la dirección. Si no se lee de ahí, el link no sirve. */
    detectSessionInUrl: true,
  },
});
