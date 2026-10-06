/**
 * Proxy hacia la API de Anthropic para el chat del Asistente y la lectura de
 * remitos por foto.
 *
 * Existe por una sola razón: la API key no puede viajar al navegador. Si la
 * pusiéramos en el front, cualquiera que abra el inspector se la lleva. Acá
 * queda del lado del servidor, en las variables de entorno de Vercel.
 *
 * El cliente llama a /api/anthropic/v1/messages en los dos entornos, y en los
 * dos lo atiende ESTE archivo: en producción por el rewrite de vercel.json, en
 * desarrollo por el middleware de vite.config.js. Antes en desarrollo lo
 * atendía un proxy que hablaba derecho con Anthropic y se saltaba todo lo de
 * abajo, así que la validación existía solo en producción y no se probaba
 * nunca. Un camino, no dos.
 *
 * La función siempre habla con un único endpoint de Anthropic, así que no
 * necesita interpretar la ruta pedida: eso la vuelve más simple y evita que
 * se la pueda usar para llegar a otro lado.
 *
 * POR QUÉ PIDE SESIÓN
 * -------------------
 * Hasta acá lo único que la cuidaba era el origen, y eso no cuida nada: el
 * header `Origin` lo pone el navegador, así que un script que no lo manda se
 * saltaba el chequeo entero. Publicada en un dominio, esta función era un
 * proxy abierto a la cuenta de Anthropic: cualquiera que descubriera la URL
 * podía gastar los créditos.
 *
 * Ahora pide el token de Supabase. El Asistente y CargarCompra se usan
 * adentro del sistema, donde siempre hay sesión, así que no cambia nada para
 * quien lo usa.
 */

import { createClient } from "@supabase/supabase-js";
import { origenValido, quienLlama } from "./_comun.js";
import { reglasDe } from "./_planes.js";

/* EL TECHO DE LA RESPUESTA

   Es un freno de gasto: la clave es de la plataforma, así que cada llamada
   la paga Genez y no el comercio. Acota lo que puede costar una sola
   petición, no lo que puede costar el mes.

   Estaba en 2000 y quedó corto por un caso concreto: `CargarCompra` pedía
   exactamente 2000 —o sea, el techo— y una factura de proveedor de más de
   veinticinco renglones no entra en eso. El JSON salía cortado a la mitad,
   `JSON.parse` fallaba, y el usuario veía "No pude leer el remito" sin
   ninguna pista de que el problema era el largo.

   8000 cubre unos ciento cincuenta renglones. A los precios de Sonnet 5
   —10 dólares el millón de tokens de salida— el peor caso de una petición
   pasa de 2 a 8 centavos de dólar, que sigue siendo un techo razonable
   para algo que requiere sesión iniciada. */
const MAX_TOKENS = 8000;

/* EL TOPE DEL MES (0129)

   El techo de arriba acota una petición; esto acota el mes. Los planes
   prometen un número de preguntas y de remitos (api/_planes.js), y sin
   contarlos un comercio podía gastar lo que pagan diez.

   Pregunta o remito se decide por lo que viaja: si hay una imagen es un
   remito. No hace falta que el navegador lo diga, y si lo dijera se podría
   mentir. */
const esRemito = (cuerpo) => (cuerpo.messages || []).some((m) =>
  Array.isArray(m.content) && m.content.some((b) => b && (b.type === "image" || b.type === "document")));

/* El mes de Buenos Aires, no el de UTC: a las 22 del 31 todavía es el mes
   que el comercio está pagando. */
const mesActual = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7);

const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];

function mensajeDeTope(reglas, tipo, tope) {
  const cosa = tipo === "remito" ? "remitos por foto" : "preguntas al asistente";
  if (!tope) return "El asistente con IA y los remitos por foto vienen con el plan Pro.";
  if (reglas.enPrueba) return `Usaste las ${tope} ${cosa} de la prueba gratis. Al contratar Pro tenés más cada mes.`;
  const [a, m] = mesActual().split("-").map(Number);
  const proximo = NOMBRE_MES[m % 12];
  return `Usaste las ${tope} ${cosa} de este mes. Se renuevan el 1 de ${proximo}${m === 12 ? ` de ${a + 1}` : ""}.`;
}

/* Lo que contesta Anthropic cuando el problema es de Genez y no del
   comercio. En inglés y con detalles de la cuenta, no le sirve a nadie
   adelante de la caja. */
function errorDeAnthropic(estado, data) {
  const texto = String((data && data.error && data.error.message) || "");
  if (/credit balance/i.test(texto)) return "El asistente no está disponible en este momento. Ya le avisamos a Genez.";
  if (estado === 429 || estado === 529 || /overloaded/i.test(texto)) return "El asistente está saturado. Probá de nuevo en un minuto.";
  return "El asistente no pudo contestar. Probá de nuevo en un rato.";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: { message: "Solo se aceptan peticiones POST." } });
  }

  if (!origenValido(req)) {
    return res.status(403).json({ error: { message: "Origen no autorizado." } });
  }

  const yo = await quienLlama(req);
  if (!yo) {
    return res.status(401).json({
      error: { message: "Necesitás una sesión abierta para usar el asistente." },
    });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    /* Sin diagnóstico. Estuvo un tiempo devolviendo nombres de variables de
       entorno y su longitud para distinguir "no se desplegó" de "está mal
       cargada"; sirvió para eso y no tiene por qué seguir contándole la
       infraestructura a quien pregunte. Si vuelve a hacer falta, se mira en
       los logs de Vercel, que es donde se miran esas cosas. */
    return res.status(503).json({
      error: {
        message: "Falta la variable ANTHROPIC_API_KEY en el servidor. El resto del " +
          "sistema funciona igual: los diagnósticos se calculan en el navegador.",
      },
    });
  }

  let cuenta = null;   // lo que se consumió, para devolverlo si Anthropic falla
  let admin = null;
  try {
    const cuerpo = typeof req.body === "string" ? JSON.parse(req.body) : { ...(req.body || {}) };
    cuerpo.max_tokens = Math.min(Number(cuerpo.max_tokens) || 1000, MAX_TOKENS);

    /* La plataforma no tiene comercio y no tiene tope: es Genez probando. */
    if (!yo.es_plataforma) {
      const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const maestra = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!maestra) {
        return res.status(503).json({ error: { message: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." } });
      }
      admin = createClient(url, maestra, { auth: { persistSession: false, autoRefreshToken: false } });
      const reglas = await reglasDe(admin, yo.empresa_id);
      const tipo = esRemito(cuerpo) ? "remito" : "pregunta";
      const tope = reglas.topesIA[tipo];
      const periodo = reglas.enPrueba ? "prueba" : mesActual();
      const { data: quedan, error: eUso } = await admin.rpc("consumir_ia", {
        p_empresa: yo.empresa_id, p_periodo: periodo, p_tipo: tipo, p_tope: tope,
      });
      if (eUso) {
        /* Sin la 0129 aplicada la función no existe: se deja pasar en vez
           de apagarle el asistente a todos. Cualquier otro error, no. */
        if (eUso.code !== "PGRST202") throw eUso;
        console.error("consumir_ia no existe: falta aplicar 0129");
      } else if (quedan === null) {
        return res.status(429).json({ error: { message: mensajeDeTope(reglas, tipo, tope) } });
      } else {
        cuenta = { p_empresa: yo.empresa_id, p_periodo: periodo, p_tipo: tipo };
      }
    }

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
    if (!r.ok) {
      console.error("Anthropic contestó", r.status, data && data.error);
      if (cuenta) await admin.rpc("devolver_ia", cuenta);
      return res.status(502).json({ error: { message: errorDeAnthropic(r.status, data) } });
    }
    return res.status(r.status).json(data);
  } catch (e) {
    if (cuenta) await admin.rpc("devolver_ia", cuenta).catch(() => {});
    return res.status(502).json({ error: { message: `No se pudo contactar a la API: ${e.message}` } });
  }
}
