/**
 * Los mails de la prueba gratis (0127): tres días antes de vencer y el día
 * después, invitando a contratar. Una vez por día, desde el cron de Vercel
 * que entra por founder.js (`?tarea=pruebas`): el plan Hobby deja 12
 * funciones y ya están todas, así que esto no tiene archivo propio.
 *
 * Cada mail se manda una sola vez: la fila de `pruebas` anota cuándo, y
 * se anota recién después de que Resend lo aceptó. Si el cron no corre un
 * día, al siguiente igual sale (se mira "faltan 3 o menos", no "faltan
 * exactamente 3").
 *
 * Sin RESEND_API_KEY no manda nada y no anota nada: el día que esté, salen
 * los que correspondan. La clave vive solo en Vercel. El mail de
 * confirmación de la cuenta no sale de acá: lo manda Supabase Auth, con
 * Resend configurado como SMTP en su panel.
 */

const DESDE = () => process.env.RESEND_FROM || "Genez <no-responder@genez.com.ar>";
const SITIO = () => process.env.SITIO_URL || "https://genez.com.ar";

function hoyEnBuenosAires() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function sumarDias(fecha, dias) {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

const escapar = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function armarMail({ tipo, nombre, comercio, vence }) {
  const quien = (nombre || "").trim().split(" ")[0] || "Hola";
  const entrar = `${SITIO()}/login`;
  const dia = vence.split("-").reverse().join("/");
  const asunto = tipo === "por_vencer"
    ? `Tu prueba de Genez termina el ${dia}`
    : `Tu prueba de Genez terminó`;
  const cuerpo = tipo === "por_vencer"
    ? [
      `${quien}, tu prueba de ${comercio} termina el ${dia}.`,
      `Si te sirvió, contratá desde el sistema (botón Contratar, arriba del panel) y seguís sin perder nada de lo que cargaste.`,
    ]
    : [
      `${quien}, terminó la prueba de ${comercio}.`,
      `Lo que cargaste sigue guardado. Entrá, tocá Contratar y seguís desde donde lo dejaste.`,
    ];
  const texto = `${cuerpo.join("\n\n")}\n\nEntrar: ${entrar}\n\nGenez`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1c1917;max-width:520px">
${cuerpo.map((p) => `<p>${escapar(p)}</p>`).join("\n")}
<p><a href="${entrar}" style="display:inline-block;background:#fd5204;color:#1c1917;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">Entrar a Genez</a></p>
<p style="color:#78716c;font-size:13px">Genez · Sistema de gestión para comercios</p>
</div>`;
  return { asunto, texto, html };
}

async function mandar({ para, asunto, texto, html }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: DESDE(), to: [para], subject: asunto, text: texto, html }),
  });
  if (!r.ok) {
    let detalle = "";
    try { detalle = (await r.json()).message || ""; } catch { /* sin cuerpo */ }
    throw new Error(`Resend contestó ${r.status}${detalle ? `: ${detalle}` : ""}`);
  }
}

export async function avisosDePrueba(admin) {
  if (!process.env.RESEND_API_KEY) return { omitido: "Falta RESEND_API_KEY: no se mandó nada." };

  const hoy = hoyEnBuenosAires();
  const { data, error } = await admin
    .from("pruebas")
    .select("empresa_id, email, nombre, aviso_por_vencer_en, aviso_vencida_en, empresas!inner ( nombre, activa, prueba_hasta )")
    .not("empresas.prueba_hasta", "is", null)
    .eq("empresas.activa", true);
  if (error) throw error;

  const resultado = { enviados: [], errores: [] };
  for (const p of data || []) {
    const vence = p.empresas.prueba_hasta;
    let tipo = null;
    if (vence < hoy && !p.aviso_vencida_en) tipo = "vencida";
    else if (vence >= hoy && vence <= sumarDias(hoy, 3) && !p.aviso_por_vencer_en) tipo = "por_vencer";
    if (!tipo || !p.email) continue;

    try {
      const m = armarMail({ tipo, nombre: p.nombre, comercio: p.empresas.nombre, vence });
      await mandar({ para: p.email, ...m });
      const columna = tipo === "vencida" ? "aviso_vencida_en" : "aviso_por_vencer_en";
      await admin.from("pruebas").update({ [columna]: new Date().toISOString() }).eq("empresa_id", p.empresa_id);
      resultado.enviados.push({ comercio: p.empresas.nombre, tipo });
    } catch (e) {
      /* De a uno y sin cortar: un mail rebotado no deja sin aviso al resto. */
      resultado.errores.push({ comercio: p.empresas.nombre, tipo, error: e.message });
    }
  }
  return resultado;
}
