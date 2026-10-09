/**
 * El subdominio de cada comercio en Vercel (0142).
 *
 * Que `slug.genez.com.ar` resuelva lo hace el comodín del DNS
 * (Cloudflare, una vez para todos). Que Vercel lo sirva y le saque el
 * certificado HTTPS hay que pedirlo por subdominio: Vercel solo acepta un
 * comodín si maneja el DNS entero, y el de genez.com.ar se queda en
 * Cloudflare por el mail. Esto lo pide solo, para que ningún comercio
 * dependa de que alguien de Genez entre a Vercel.
 *
 *   registrar(db, empresa)    agrega el subdominio al proyecto y anota el
 *                             estado en `subdominios`.
 *   pedidoDelComercio(...)    la acción "subdominio": la manda el
 *                             navegador de cualquiera del comercio al
 *                             entrar, si el suyo no está listo.
 *   revisar(db)               el cron: los comercios cuyo subdominio
 *                             falta o no quedó listo.
 *
 * LAS VARIABLES (en Vercel, nunca en el repositorio)
 * --------------------------------------------------
 *   VERCEL_TOKEN        un token de la cuenta (Account Settings → Tokens).
 *   VERCEL_PROJECT_ID   el id del proyecto (Settings → General).
 *   VERCEL_TEAM_ID      solo si el proyecto es de un equipo.
 * Sin las dos primeras no se hace nada y el estado queda "pendiente" con
 * el motivo: el sistema anda igual, solo que el sitio no tiene dirección.
 *
 * EL TOPE
 * -------
 * Hobby deja 50 dominios por proyecto. Cuando Vercel lo rechaza, queda
 * "error" con lo que dijo Vercel, y el panel de la plataforma lo muestra.
 */

const RAIZ = "genez.com.ar";
const RESERVADOS = new Set(["www", "app", "api", "admin"]);
const API = "https://api.vercel.com";

const configurado = () => !!(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);

async function vercel(ruta, { metodo = "GET", cuerpo } = {}) {
  const equipo = process.env.VERCEL_TEAM_ID ? `${ruta.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
  const r = await fetch(`${API}${ruta}${equipo}`, {
    method: metodo,
    headers: { authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "content-type": "application/json" },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  return { ok: r.ok, codigo: r.status, datos };
}

export const hostDe = (slug) => (slug && /^[a-z0-9-]+$/.test(slug) && !RESERVADOS.has(slug) ? `${slug}.${RAIZ}` : null);

async function anotar(db, empresaId, host, estado, detalle) {
  const { data: antes } = await db.from("subdominios").select("intentos").eq("empresa_id", empresaId).maybeSingle();
  await db.from("subdominios").upsert({
    empresa_id: empresaId, host, estado, detalle: detalle ? String(detalle).slice(0, 300) : null,
    intentos: ((antes && antes.intentos) || 0) + 1, actualizado_en: new Date().toISOString(),
  }, { onConflict: "empresa_id" });
  return { host, estado, detalle };
}

/* Agrega el subdominio al proyecto (o confirma que ya está) y anota cómo
   quedó. "listo" es que Vercel lo tiene y verificado; el certificado sale
   solo en uno o dos minutos después de eso. */
export async function registrar(db, empresa) {
  const host = hostDe(empresa.slug);
  if (!host) return { host: null, estado: "error", detalle: "El comercio no tiene una dirección válida." };
  if (!configurado()) return anotar(db, empresa.id, host, "pendiente", "Faltan VERCEL_TOKEN y VERCEL_PROJECT_ID en el servidor.");

  const proyecto = encodeURIComponent(process.env.VERCEL_PROJECT_ID);
  let r = await vercel(`/v10/projects/${proyecto}/domains`, { metodo: "POST", cuerpo: { name: host } });
  /* Si ya estaba en el proyecto, Vercel contesta 400: se consulta cómo
     está en vez de darlo por error. */
  if (!r.ok) {
    const g = await vercel(`/v9/projects/${proyecto}/domains/${encodeURIComponent(host)}`);
    if (g.ok) r = g;
  }
  if (!r.ok) {
    const msj = (r.datos && r.datos.error && (r.datos.error.message || r.datos.error.code)) || `Vercel contestó ${r.codigo}.`;
    return anotar(db, empresa.id, host, "error", msj);
  }
  return anotar(db, empresa.id, host, r.datos && r.datos.verified === false ? "pendiente" : "listo",
    r.datos && r.datos.verified === false ? "Vercel lo está verificando." : null);
}

/* La acción "subdominio": la pide el navegador de cualquiera del comercio
   (no hace falta ser dueño: es la dirección de su comercio, y pedirla de
   nuevo no rompe nada). */
export async function pedidoDelComercio(res, db, quien) {
  const { data: perfil } = await db.from("perfiles").select("empresa_id").eq("id", quien.id).maybeSingle();
  if (!perfil || !perfil.empresa_id) return res.status(403).json({ error: { message: "Tu usuario no tiene un comercio." } });
  const { data: e } = await db.from("empresas").select("id, slug, activa").eq("id", perfil.empresa_id).maybeSingle();
  if (!e || !e.activa) return res.status(404).json({ error: { message: "No encontré el comercio." } });
  const { data: ya } = await db.from("subdominios").select("host, estado, detalle, actualizado_en").eq("empresa_id", e.id).maybeSingle();
  /* Listo no se vuelve a pedir; uno que falló hace menos de 10 minutos
     tampoco, para no golpear a Vercel cada vez que alguien entra. */
  if (ya && ya.estado === "listo") return res.status(200).json(ya);
  if (ya && ya.estado === "error" && Date.now() - new Date(ya.actualizado_en).getTime() < 10 * 60000) return res.status(200).json(ya);
  try {
    return res.status(200).json(await registrar(db, e));
  } catch (err) {
    return res.status(200).json(await anotar(db, e.id, hostDe(e.slug), "error", err.message));
  }
}

/* El cron: hasta 25 por vuelta, los que nunca se pidieron o no quedaron
   listos. Cuenta cuántos hay listos, para el tope de 50 de Hobby. */
export async function revisar(db) {
  if (!configurado()) return { omitido: "Faltan VERCEL_TOKEN y VERCEL_PROJECT_ID." };
  const [{ data: empresas }, { data: filas }] = await Promise.all([
    db.from("empresas").select("id, slug").eq("activa", true).not("slug", "is", null),
    db.from("subdominios").select("empresa_id, estado"),
  ]);
  const estado = Object.fromEntries((filas || []).map((f) => [f.empresa_id, f.estado]));
  const faltan = (empresas || []).filter((e) => hostDe(e.slug) && estado[e.id] !== "listo").slice(0, 25);
  const hechos = { listos: 0, pendientes: 0, errores: 0 };
  for (const e of faltan) {
    try {
      const r = await registrar(db, e);
      hechos[r.estado === "listo" ? "listos" : r.estado === "error" ? "errores" : "pendientes"]++;
    } catch { hechos.errores++; }
  }
  const { count } = await db.from("subdominios").select("empresa_id", { count: "exact", head: true }).eq("estado", "listo");
  return { revisados: faltan.length, ...hechos, totalListos: count || 0 };
}
