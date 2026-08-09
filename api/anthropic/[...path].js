/**
 * Proxy hacia la API de Anthropic para el chat del Asistente.
 *
 * Existe por una sola razón: la API key no puede viajar al navegador. Si la
 * pusiéramos en el front, cualquiera que abra el inspector se la lleva. Acá
 * queda del lado del servidor, en las variables de entorno de Vercel.
 *
 * En desarrollo esta ruta la atiende el proxy de Vite (ver vite.config.js).
 * En producción la atiende esta función. El cliente llama igual en los dos
 * casos: /api/anthropic/v1/messages
 */

const RUTAS_PERMITIDAS = ["v1/messages"];
const MAX_TOKENS = 2000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Solo se aceptan peticiones POST." } });
  }

  const ruta = Array.isArray(req.query.path) ? req.query.path.join("/") : String(req.query.path || "");
  if (!RUTAS_PERMITIDAS.includes(ruta)) {
    return res.status(404).json({ error: { message: `Ruta no habilitada: ${ruta}` } });
  }

  // Solo desde el propio sitio: evita que el endpoint quede abierto a terceros.
  const origen = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (origen && host && !origen.endsWith(host)) {
    return res.status(403).json({ error: { message: "Origen no autorizado." } });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: { message: "Falta la variable ANTHROPIC_API_KEY en Vercel. El resto del sistema funciona igual: los diagnósticos se calculan en el navegador." },
    });
  }

  try {
    const cuerpo = { ...(req.body || {}) };
    cuerpo.max_tokens = Math.min(Number(cuerpo.max_tokens) || 1000, MAX_TOKENS);

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(cuerpo),
    });

    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: { message: `No se pudo contactar a la API: ${e.message}` } });
  }
}
