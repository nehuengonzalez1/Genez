/**
 * Consulta los cobros recibidos en Mercado Pago.
 *
 * No usa webhooks ni base de datos a propósito. Un webhook obliga a guardar
 * los avisos en algún lado hasta que el navegador los pida, y eso significa
 * otro servicio más. Acá el navegador pregunta cada pocos segundos y esta
 * función le consulta a Mercado Pago los pagos aprobados desde la última vez.
 * Sin estado, sin costo y sin nada que se pueda desincronizar.
 *
 * El token vive solo del lado del servidor: MP_ACCESS_TOKEN en Vercel.
 */

const MINUTOS_MAXIMO = 30;

export default async function handler(req, res) {
  const origen = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (origen && host && !origen.endsWith(host)) {
    return res.status(403).json({ error: { message: "Origen no autorizado." } });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return res.status(200).json({
      configurado: false,
      pagos: [],
      mensaje: "Falta MP_ACCESS_TOKEN. Podés probar el aviso con el botón de simulación en Ajustes.",
    });
  }

  // Nunca se piden más de 30 minutos hacia atrás: si la caja estuvo cerrada,
  // no tiene sentido que al abrir suene una catarata de avisos viejos.
  const ahora = new Date();
  const limite = new Date(ahora.getTime() - MINUTOS_MAXIMO * 60000);
  let desde = req.query.desde ? new Date(String(req.query.desde)) : limite;
  if (isNaN(desde.getTime()) || desde < limite) desde = limite;

  const params = new URLSearchParams({
    sort: "date_approved",
    criteria: "desc",
    range: "date_approved",
    begin_date: desde.toISOString(),
    end_date: ahora.toISOString(),
    status: "approved",
    limit: "20",
  });

  try {
    const r = await fetch(`https://api.mercadopago.com/v1/payments/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      const detalle = await r.text();
      return res.status(r.status).json({ configurado: true, pagos: [], error: { message: detalle.slice(0, 300) } });
    }
    const data = await r.json();
    const pagos = (data.results || []).map((p) => ({
      id: String(p.id),
      monto: Number(p.transaction_amount) || 0,
      fecha: p.date_approved || p.date_created,
      pagador: [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ") || p.payer?.email || "",
      medio: p.payment_method_id || "",
      detalle: p.description || "",
    }));
    return res.status(200).json({ configurado: true, pagos, consultadoHasta: ahora.toISOString() });
  } catch (e) {
    return res.status(502).json({ configurado: true, pagos: [], error: { message: `No se pudo consultar Mercado Pago: ${e.message}` } });
  }
}
