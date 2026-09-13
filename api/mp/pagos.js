/**
 * Consulta los cobros recibidos en Mercado Pago.
 *
 * No usa webhooks ni base de datos a propósito. Un webhook obliga a guardar
 * los avisos en algún lado hasta que el navegador los pida, y eso significa
 * otro servicio más. Acá el navegador pregunta cada pocos segundos y esta
 * función le consulta a Mercado Pago las operaciones desde la última vez.
 *
 * Sobre las transferencias al alias: Mercado Pago las modela como
 * operation_type "money_transfer", distinto de un cobro por QR o link. No
 * está documentado si aparecen en /v1/payments/search para la cuenta que las
 * recibe, así que la búsqueda NO filtra por tipo de operación: trae todo lo
 * aprobado y deja que el cliente decida. Con ?debug=1 se ve en crudo qué
 * devolvió Mercado Pago, para poder comprobarlo con una transferencia real.
 *
 * El token vive solo del lado del servidor: MP_ACCESS_TOKEN en Vercel.
 *
 * POR QUÉ PIDE SESIÓN
 * -------------------
 * Hasta acá lo único que la cuidaba era el origen, y con el chequeo por
 * `endsWith` que `_comun.js` ya había corregido para las demás funciones:
 * un dominio que terminara en el host pasaba, y un script sin `Origin` ni
 * se miraba. Publicada, le contestaba a cualquiera nombre, monto y medio
 * de pago de los cobros de la última media hora.
 *
 * Ahora pide el token de Supabase, igual que el resto de `api/`. Quien
 * sondea es alguien con la caja abierta en el sistema, así que para el
 * uso real no cambia nada. No se pide un permiso puntual: ver los cobros
 * que entran es parte de cobrar, y cobrar ya lo decide el rol.
 */

import { origenValido, quienLlama } from "../_comun.js";

const MINUTOS_MAXIMO = 30;

/* Id de la cuenta, para distinguir lo que entra de lo que sale.
   /v1/payments/search devuelve todas las operaciones de la cuenta, así que una
   transferencia enviada figura igual que una recibida. La diferencia está en
   quién cobra: si collector_id es esta cuenta, entró plata. Se cachea entre
   invocaciones para no pedirlo en cada sondeo. */
let _idCuenta = null;

async function idCuenta(token) {
  if (_idCuenta) return _idCuenta;
  const r = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const d = await r.json();
  _idCuenta = d.id != null ? String(d.id) : null;
  return _idCuenta;
}

function normalizar(p) {
  return {
    id: String(p.id),
    monto: Number(p.transaction_amount) || 0,
    fecha: p.date_approved || p.date_created,
    pagador: [p.payer?.first_name, p.payer?.last_name].filter(Boolean).join(" ") || p.payer?.email || "",
    medio: p.payment_method_id || "",
    tipo: p.operation_type || "",
    detalle: p.description || "",
  };
}

async function buscar(token, campo, desde, hasta) {
  const params = new URLSearchParams({
    sort: campo, criteria: "desc", range: campo,
    begin_date: desde.toISOString(), end_date: hasta.toISOString(),
    limit: "30",
  });
  const r = await fetch(`https://api.mercadopago.com/v1/payments/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return { error: (await r.text()).slice(0, 300), results: [] };
  const d = await r.json();
  return { results: d.results || [] };
}

export default async function handler(req, res) {
  if (!origenValido(req)) {
    return res.status(403).json({ error: { message: "Origen no autorizado." } });
  }

  const yo = await quienLlama(req);
  if (!yo) {
    return res.status(401).json({ error: { message: "Necesitás una sesión abierta para ver los cobros." } });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return res.status(200).json({
      configurado: false, pagos: [],
      mensaje: "Falta MP_ACCESS_TOKEN. Podés probar el aviso con el botón de simulación en Ajustes.",
    });
  }

  // Nunca más de 30 minutos hacia atrás: si la caja estuvo cerrada, no tiene
  // sentido que al abrir suene una catarata de avisos viejos.
  const ahora = new Date();
  const limite = new Date(ahora.getTime() - MINUTOS_MAXIMO * 60000);
  let desde = req.query.desde ? new Date(String(req.query.desde)) : limite;
  if (isNaN(desde.getTime()) || desde < limite) desde = limite;

  try {
    // Las transferencias podrían no tener date_approved; si por esa vía no
    // aparece nada, se reintenta por fecha de creación.
    let { results, error } = await buscar(token, "date_approved", desde, ahora);
    let campoUsado = "date_approved";
    if (!error && results.length === 0) {
      const segundo = await buscar(token, "date_created", desde, ahora);
      if (!segundo.error && segundo.results.length) { results = segundo.results; campoUsado = "date_created"; }
    }
    if (error) return res.status(502).json({ configurado: true, pagos: [], error: { message: error } });

    const yo = await idCuenta(token);
    const entrante = (p) => {
      if (p.status !== "approved") return false;
      if (!yo) return true;                                  // sin id, no se filtra
      if (String(p.collector_id) !== yo) return false;       // no soy quien cobra: es un pago mío
      if (p.payer && String(p.payer.id) === yo) return false; // movimiento entre mis propias cuentas
      return true;
    };
    const aprobados = results.filter(entrante);
    const respuesta = {
      configurado: true,
      pagos: aprobados.map(normalizar),
      consultadoHasta: ahora.toISOString(),
    };

    if (req.query.debug) {
      respuesta.debug = {
        campoUsado,
        totalDevuelto: results.length,
        cuenta: yo,
        operaciones: results.map((p) => ({
          id: String(p.id), status: p.status, operation_type: p.operation_type,
          collector_id: p.collector_id != null ? String(p.collector_id) : null,
          payer_id: p.payer && p.payer.id != null ? String(p.payer.id) : null,
          entrante: entrante(p),
          monto: p.transaction_amount, fecha: p.date_approved || p.date_created,
        })),
      };
    }
    return res.status(200).json(respuesta);
  } catch (e) {
    return res.status(502).json({ configurado: true, pagos: [], error: { message: `No se pudo consultar Mercado Pago: ${e.message}` } });
  }
}
