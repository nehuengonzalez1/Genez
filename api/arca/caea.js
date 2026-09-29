/**
 * La tarea diaria del CAEA (0100). La llama el cron de Vercel una vez por
 * día (vercel.json → crons), y nadie más.
 *
 * Por cada comercio con punto de venta CAEA cargado:
 *   - tener el CAEA de esta quincena, y desde 5 días antes el de la
 *     siguiente (con ARCA caído no se puede pedir: hay que tenerlo antes);
 *   - informarle a ARCA lo emitido con CAEA (FECAEARegInformativo);
 *   - cerrar las quincenas vencidas sin uso ("sin movimiento").
 * Las tres son obligaciones de la RG 5782/2025, con plazo de 8 días
 * después de la quincena. Por eso las hace una tarea y no una persona, y
 * lo que falla queda en `arca_conexiones.caea_estado`, que Ajustes muestra.
 *
 * Nada de esto emite comprobantes.
 *
 * LA LLAVE
 * --------
 * Vercel manda `Authorization: Bearer <CRON_SECRET>` si esa variable
 * existe en el proyecto. Sin ella esto no corre: si no, cualquiera podría
 * dispararlo desde afuera. No es peligroso (no emite), pero sí ruidoso.
 */

import { createClient } from "@supabase/supabase-js";
import { clienteArca, cuitDe } from "./_arca.js";
import { ponerAlDia } from "./_caea.js";

/* Un comercio son varias idas a ARCA; con varios comercios los 10 s de
   fábrica no alcanzan. */
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return res.status(503).json({ error: { message: "Falta CRON_SECRET en el servidor." } });
  if (req.headers.authorization !== `Bearer ${secreto}`) return res.status(401).json({ error: { message: "No autorizado." } });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const maestra = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!maestra) return res.status(503).json({ error: { message: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." } });
  const admin = createClient(url, maestra, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: conexiones, error } = await admin.from("arca_conexiones").select("*").not("punto_venta_caea", "is", null);
  if (error) return res.status(500).json({ error: { message: error.message } });

  /* De a uno y sin cortar: que un comercio con el certificado vencido no
     deje sin CAEA a los demás. */
  const resultado = [];
  for (const conexion of conexiones || []) {
    try {
      const afip = await clienteArca(admin, conexion);
      const estado = await ponerAlDia({ admin, afip, conexion, cuit: cuitDe(conexion) });
      resultado.push({ empresa: conexion.empresa_id, ...estado });
    } catch (e) {
      const estado = { corrio: new Date().toISOString(), errores: [e.message || String(e)] };
      await admin.from("arca_conexiones").update({ caea_estado: estado }).eq("empresa_id", conexion.empresa_id);
      resultado.push({ empresa: conexion.empresa_id, ...estado });
    }
  }
  return res.status(200).json({ comercios: resultado.length, resultado });
}
