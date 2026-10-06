/* ============================================================
   PRUEBA · la suscripción contra Mercado Pago, con cuentas de prueba
   ============================================================

   No toca la base ni ningún comercio: habla solo con Mercado Pago, con el
   token del VENDEDOR de prueba y el mail del COMPRADOR de prueba del
   `.env` (MP_PRUEBA_ACCESS_TOKEN, MP_PRUEBA_COMPRADOR_EMAIL). Ninguna
   plata es real.

     node scripts/probar-mp-suscripcion.mjs crear [mensual|anual]
         Crea la suscripción igual que api/_suscripcion.js (Pro, pendiente)
         y muestra el link. Se abre, se entra con el COMPRADOR de prueba y
         se autoriza con una tarjeta de prueba (eso lo hace una persona).
     node scripts/probar-mp-suscripcion.mjs ver <id>
         Cómo la ve Mercado Pago y cómo la interpretaría el sistema: el
         estado de la suscripción y el de cada cobro.
     node scripts/probar-mp-suscripcion.mjs cancelar <id>
     node scripts/probar-mp-suscripcion.mjs monto <id> <monto>
         Cambia el monto como lo hacen el cambio de plan y el ajuste por
         IPC (0130) y muestra cómo quedó.

   Lo que se quiere saber (05/10): si MP acepta el pedido tal cual lo arma
   el sistema, si el pagador tiene que entrar con el mismo mail, qué
   devuelve cada estado y si los cobros traen payment.status.
   ============================================================ */

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const token = env.MP_PRUEBA_ACCESS_TOKEN;
const comprador = env.MP_PRUEBA_COMPRADOR_EMAIL;
if (!token || !comprador) {
  console.log("Faltan MP_PRUEBA_ACCESS_TOKEN o MP_PRUEBA_COMPRADOR_EMAIL en el .env.");
  process.exit(1);
}

async function mp(ruta, { metodo = "GET", cuerpo } = {}) {
  const r = await fetch(`https://api.mercadopago.com${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  let datos = null;
  try { datos = await r.json(); } catch { /* sin cuerpo */ }
  return { ok: r.ok, estado: r.status, datos };
}

/* Lo mismo que hace el sistema con lo que devuelve MP. */
const ESTADO_MP = { pending: "pendiente", authorized: "activa", paused: "pausada", cancelled: "cancelada" };
const interpretarCobro = (a) => {
  const estadoPago = a.payment && a.payment.status;
  if (estadoPago === "approved") return "aprobado → limpia la gracia";
  if (estadoPago === "rejected" || a.status === "recycling") return "rechazado → abre 5 días de gracia";
  return "en proceso → espera el próximo aviso";
};

const [accion, arg, arg2] = process.argv.slice(2);

if (accion === "crear") {
  const periodo = arg === "anual" ? "anual" : "mensual";
  const pedido = {
    reason: `Genez Pro (${periodo}) · prueba`,
    external_reference: `prueba-${Date.now()}`,
    payer_email: comprador,
    back_url: "https://genez.com.ar/?suscripcion=volvio",
    status: "pending",
    auto_recurring: {
      frequency: periodo === "anual" ? 12 : 1,
      frequency_type: "months",
      transaction_amount: periodo === "anual" ? 599000 : 59900,
      currency_id: "ARS",
    },
  };
  const r = await mp("/preapproval", { metodo: "POST", cuerpo: pedido });
  if (!r.ok) {
    console.log(`MP no aceptó el pedido (HTTP ${r.estado}):`);
    console.log(JSON.stringify(r.datos, null, 2));
    process.exit(1);
  }
  console.log("Creada.");
  console.log(`  id:      ${r.datos.id}`);
  console.log(`  estado:  ${r.datos.status} → ${ESTADO_MP[r.datos.status] || "?"}`);
  console.log(`  pagador: ${r.datos.payer_email || comprador}`);
  console.log(`  link:    ${r.datos.init_point}`);
  console.log(`\nAbrí el link, entrá con el COMPRADOR de prueba y autorizá con una tarjeta de prueba.`);
  console.log(`Después: node scripts/probar-mp-suscripcion.mjs ver ${r.datos.id}`);
} else if (accion === "ver" && arg) {
  const s = await mp(`/preapproval/${arg}`);
  if (!s.ok) { console.log(`HTTP ${s.estado}`, JSON.stringify(s.datos, null, 2)); process.exit(1); }
  const p = s.datos;
  console.log("La suscripción");
  console.log(`  estado MP:      ${p.status} → para el sistema: ${ESTADO_MP[p.status] || "?"}`);
  console.log(`  pagador:        ${p.payer_email || "(sin mail)"} · payer_id ${p.payer_id || "-"}`);
  console.log(`  monto:          ${p.auto_recurring && p.auto_recurring.transaction_amount}`);
  console.log(`  próximo cobro:  ${p.next_payment_date || "-"}`);
  const c = await mp(`/authorized_payments/search?preapproval_id=${arg}`);
  const cobros = (c.datos && c.datos.results) || [];
  console.log(`\nLos cobros (${cobros.length})`);
  for (const a of cobros) {
    console.log(`  ${a.id} · ${a.date_created || ""} · estado ${a.status} · pago ${a.payment ? `${a.payment.status} (${a.payment.status_detail || ""})` : "-"}`);
    console.log(`     → ${interpretarCobro(a)}`);
  }
  if (!c.ok) console.log(`  (la búsqueda de cobros contestó HTTP ${c.estado}: ${JSON.stringify(c.datos)})`);
} else if (accion === "cancelar" && arg) {
  const r = await mp(`/preapproval/${arg}`, { metodo: "PUT", cuerpo: { status: "cancelled" } });
  console.log(r.ok ? `Cancelada: ${r.datos.status}` : `HTTP ${r.estado} ${JSON.stringify(r.datos)}`);
} else if (accion === "monto" && arg && Number(arg2) > 0) {
  const r = await mp(`/preapproval/${arg}`, { metodo: "PUT", cuerpo: {
    reason: "Genez Simple (mensual) · prueba de cambio", auto_recurring: { transaction_amount: Number(arg2), currency_id: "ARS" },
  } });
  if (!r.ok) { console.log(`MP no aceptó (HTTP ${r.estado}):`, JSON.stringify(r.datos, null, 2)); process.exit(1); }
  const v = await mp(`/preapproval/${arg}`);
  console.log(`Aceptado. Ahora: ${v.datos.auto_recurring.transaction_amount} · "${v.datos.reason}" · estado ${v.datos.status}`);
} else {
  console.log("Uso: crear [mensual|anual] · ver <id> · cancelar <id> · monto <id> <monto>");
}
