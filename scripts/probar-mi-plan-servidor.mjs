/* ============================================================
   PRUEBA · la lógica de api/_mi_plan.js, sin base ni Mercado Pago
   ============================================================

   La base, Mercado Pago, la serie del IPC y Resend son de mentira, en
   memoria: no sale ningún pedido de esta computadora. Lo que se prueba es
   lo que decide el servidor —qué le pide a MP, qué escribe, qué contesta—
   y no si MP o la base lo aceptan (eso: probar-mp-suscripcion.mjs y
   probar-mi-plan.mjs).

     node scripts/probar-mi-plan-servidor.mjs
   ============================================================ */

process.env.MP_ACCESS_TOKEN = "falso";
process.env.RESEND_API_KEY = "falso";
process.env.MP_WEBHOOK_SECRET = "secreto-falso";

const { cambiarPlan, darDeBaja, pedirArrepentimiento, resolverArrepentimiento, tareasDiarias } = await import("../api/_mi_plan.js");
const { hoy, masDias, webhookMP } = await import("../api/_suscripcion.js");
const crypto = await import("node:crypto");

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

/* ---------- Una base de mentira, lo justo para supabase-js ---------- */
function baseFalsa(tablas) {
  const rpcs = [];
  function consulta(nombre) {
    const filtros = [];
    let modo = "select", valores = null, cuenta = false, unica = null;
    const filas = () => (tablas[nombre] || []).filter((f) => filtros.every((p) => p(f)));
    const q = {
      select(_c, op) { if (op && op.head) cuenta = true; return q; },
      eq(k, v) { filtros.push((f) => f[k] === v); return q; },
      neq(k, v) { filtros.push((f) => f[k] !== v); return q; },
      gte(k, v) { filtros.push((f) => f[k] != null && f[k] >= v); return q; },
      lte(k, v) { filtros.push((f) => f[k] != null && f[k] <= v); return q; },
      in(k, vs) { filtros.push((f) => vs.includes(f[k])); return q; },
      not(k, _op, _v) { filtros.push((f) => f[k] != null); return q; },
      order() { return q; }, limit() { return q; },
      update(v) { modo = "update"; valores = v; return q; },
      insert(v) { modo = "insert"; valores = v; return q; },
      maybeSingle() { unica = "quizas"; return q; },
      single() { unica = "una"; return q; },
      then(ok, mal) {
        try {
          if (modo === "insert") { (tablas[nombre] = tablas[nombre] || []).push({ ...valores }); return Promise.resolve({ error: null }).then(ok, mal); }
          const fs = filas();
          if (modo === "update") fs.forEach((f) => Object.assign(f, valores));
          if (cuenta) return Promise.resolve({ count: fs.length, error: null }).then(ok, mal);
          const data = unica ? (fs[0] || null) : fs;
          return Promise.resolve({ data, error: null }).then(ok, mal);
        } catch (e) { return Promise.reject(e).then(ok, mal); }
      },
    };
    return q;
  }
  return {
    tablas, rpcs,
    from: consulta,
    rpc: async (nombre, args) => {
      rpcs.push({ nombre, args });
      if (nombre === "se_puede_borrar") return { data: args.p_empresa === "vencida", error: null };
      if (nombre === "borrar_comercio") return { data: { nombre: "Vencida", usuarios: 1 }, error: null };
      return { data: null, error: null };
    },
  };
}

/* ---------- MP, IPC y Resend de mentira ---------- */
const pedidos = [];
const mails = [];
let ipc = { mes: "2026-08-01", valor: 12276.766 };
globalThis.fetch = async (url, op = {}) => {
  const u = String(url);
  const cuerpo = op.body ? JSON.parse(op.body) : null;
  const responder = (datos, status = 200) => new Response(JSON.stringify(datos), { status, headers: { "content-type": "application/json" } });
  if (u.includes("apis.datos.gob.ar")) return responder({ data: [[ipc.mes, ipc.valor]] });
  if (u.includes("api.resend.com")) { mails.push(cuerpo); return responder({ id: "m" }); }
  if (u.includes("api.mercadopago.com")) {
    pedidos.push({ metodo: op.method || "GET", ruta: u.replace("https://api.mercadopago.com", ""), cuerpo, clave: op.headers && op.headers["X-Idempotency-Key"] });
    if (u.endsWith("/preapproval") && op.method === "POST") return responder({ id: "nueva-1", init_point: "https://mp/autorizar", next_payment_date: null });
    const lectura = u.match(/\/preapproval\/([^/?]+)$/);
    if (lectura && (op.method || "GET") === "GET") return responder({ id: lectura[1], status: "authorized", next_payment_date: "2026-10-25T12:00:00.000-03:00" });
    if (u.includes("/authorized_payments/search")) return responder({ results: [
      { transaction_amount: 59900, payment: { id: 111, status: "approved" } },
      { transaction_amount: 59900, payment: { id: 112, status: "rejected" } },
    ] });
    return responder({ ok: true });
  }
  throw new Error(`Pedido inesperado a ${u}`);
};

function respuesta() {
  const r = { codigo: null, cuerpo: null };
  r.status = (c) => { r.codigo = c; return r; };
  r.json = (b) => { r.cuerpo = b; return r; };
  return r;
}
const req = { headers: { host: "genez.com.ar" } };
const dueno = { id: "u1", email: "duena@genez.test" };

function escenario({ estado = "activa", plan = "pro", periodo = "mensual", sucursales = 1, proximo = masDias(hoy(), 20) } = {}) {
  return baseFalsa({
    perfiles: [
      { id: "u1", empresa_id: "e1", rol: "dueno", email: "duena@genez.test", activo: true, creado_en: "1" },
      { id: "u2", empresa_id: "e1", rol: "cajero", email: "cajero@genez.test", activo: true, creado_en: "2" },
    ],
    empresas: [{ id: "e1", nombre: "Almacén Prueba", rubro: "minimercado", plan, prueba_hasta: null }],
    sucursales: Array.from({ length: sucursales }, (_, i) => ({ id: `s${i}`, empresa_id: "e1", activa: true })),
    suscripciones: [{ empresa_id: "e1", mp_id: "vieja-1", plan, periodo, monto: 59900, estado, payer_email: "mp@genez.test", proximo_cobro: proximo, cambio_mp_id: null }],
    tarifas: [
      { clave: "plan:start", monto: 29900 }, { clave: "plan:pro", monto: 59900 }, { clave: "anual_meses", monto: 10 },
      { clave: "sucursales_incluidas", monto: 2 }, { clave: "sucursal_extra", monto: 14900 },
    ],
    rubros: [{ clave: "minimercado", nombre: "Minimercado", modulos: [], presentacion: {} }],
    pruebas: [],
    arrepentimientos: [],
  });
}

console.log("Cambiar de plan, mismo período");
{
  const db = escenario();
  pedidos.length = 0;
  const r = respuesta();
  await cambiarPlan(r, db, dueno, { plan: "start", periodo: "mensual" }, req);
  const put = pedidos.find((p) => p.metodo === "PUT" && p.ruta === "/preapproval/vieja-1");
  const s = db.tablas.suscripciones[0];
  decir(r.codigo === 200 && put && put.cuerpo.auto_recurring.transaction_amount === 29900, `cambia el monto en MP a 29.900 (${r.codigo})`);
  decir(s.plan === "start" && s.monto === 29900 && db.tablas.empresas[0].plan === "start", "la suscripción y el comercio quedan en Simple");
  decir(db.tablas.perfiles.find((p) => p.id === "u2").activo === false && db.tablas.perfiles[0].activo === true, "y queda solo la dueña");
  decir(s.precio_desde === hoy() && !!s.proximo_ajuste, `el precio arranca hoy, ajuste el ${s.proximo_ajuste}`);
}
{
  const db = escenario({ plan: "pro", sucursales: 3 });
  const r = respuesta();
  await cambiarPlan(r, db, dueno, { plan: "start", periodo: "mensual" }, req);
  decir(r.codigo === 400 && /un solo local/.test(r.cuerpo.error.message), "con 3 sucursales no deja pasar a Simple");
  const r2 = respuesta();
  await cambiarPlan(r2, escenario({ sucursales: 3 }), dueno, { plan: "pro", periodo: "anual" }, req);
  decir(r2.cuerpo && r2.cuerpo.monto === (59900 + 14900) * 10, `Pro anual con 3 sucursales: ${r2.cuerpo && r2.cuerpo.monto}`);
}
{
  const r = respuesta();
  await cambiarPlan(r, escenario(), { id: "u2", email: "c@x" }, { plan: "start", periodo: "mensual" }, req);
  decir(r.codigo === 403, "un cajero no cambia el plan");
  const r2 = respuesta();
  await cambiarPlan(r2, escenario({ estado: "cancelada" }), dueno, { plan: "start", periodo: "mensual" }, req);
  decir(r2.codigo === 409, "sin suscripción activa, no");
}

console.log("\nCambiar de período");
{
  const db = escenario();
  pedidos.length = 0;
  const r = respuesta();
  await cambiarPlan(r, db, dueno, { plan: "pro", periodo: "anual" }, req);
  const post = pedidos.find((p) => p.metodo === "POST" && p.ruta === "/preapproval");
  const s = db.tablas.suscripciones[0];
  decir(r.cuerpo.link === "https://mp/autorizar", "devuelve el link para autorizar la nueva");
  decir(post && post.cuerpo.auto_recurring.frequency === 12 && post.cuerpo.auto_recurring.transaction_amount === 599000
    && post.cuerpo.auto_recurring.start_date.startsWith(s.proximo_cobro), `anual a 599.000, arranca el próximo cobro (${post && post.cuerpo.auto_recurring.start_date})`);
  decir(s.mp_id === "vieja-1" && s.cambio_mp_id === "nueva-1" && s.plan === "pro" && s.periodo === "mensual", "la vieja sigue hasta que se autorice la nueva");
  decir(!pedidos.some((p) => p.metodo === "PUT" && p.ruta === "/preapproval/vieja-1"), "no toca la vieja todavía");
}

console.log("\nMP autoriza la nueva del cambio de período");
{
  const db = escenario();
  Object.assign(db.tablas.suscripciones[0], { cambio_mp_id: "nueva-1", cambio_plan: "pro", cambio_periodo: "anual", cambio_monto: 599000, autorizada_en: "2026-09-01" });
  pedidos.length = 0;
  const ts = "1700000000";
  const firma = crypto.createHmac("sha256", "secreto-falso").update(`id:nueva-1;request-id:r1;ts:${ts};`).digest("hex");
  const r = respuesta();
  await webhookMP({ headers: { "x-signature": `ts=${ts},v1=${firma}`, "x-request-id": "r1" } }, r, db,
    { type: "subscription_preapproval", data: { id: "nueva-1" } }, {});
  const s = db.tablas.suscripciones[0];
  decir(r.codigo === 200, `acepta el aviso firmado (${r.codigo} ${JSON.stringify(r.cuerpo)})`);
  decir(pedidos.some((p) => p.metodo === "PUT" && p.ruta === "/preapproval/vieja-1" && p.cuerpo.status === "cancelled"), "cancela la vieja en MP");
  decir(s.mp_id === "nueva-1" && s.periodo === "anual" && s.monto === 599000 && s.cambio_mp_id === null && s.estado === "activa",
    "la fila pasa a ser la nueva, anual a 599.000");
  decir(s.precio_desde === hoy(), "y el precio arranca de nuevo hoy");
}

console.log("\nLa baja");
{
  const db = escenario();
  pedidos.length = 0; mails.length = 0;
  const r = respuesta();
  await darDeBaja(r, db, dueno);
  const s = db.tablas.suscripciones[0];
  decir(pedidos.some((p) => p.ruta === "/preapproval/vieja-1" && p.cuerpo && p.cuerpo.status === "cancelled"), "cancela en MP");
  decir(r.codigo === 200 && /^B-[A-Z2-9]{8}$/.test(r.cuerpo.codigo) && s.baja_codigo === r.cuerpo.codigo, `devuelve y guarda el código (${r.cuerpo && r.cuerpo.codigo})`);
  decir(db.tablas.empresas[0].prueba_hasta === masDias(s.proximo_cobro, -1), `usa hasta el día antes del próximo cobro (${db.tablas.empresas[0].prueba_hasta})`);
  decir(mails.length === 2 && mails.every((m) => m.subject.includes(r.cuerpo.codigo)), `manda el código a la dueña y al mail de MP (${mails.length})`);
}
{
  const db = escenario({ estado: "pendiente" });
  db.tablas.empresas[0].prueba_hasta = masDias(hoy(), 4);
  const r = respuesta();
  await darDeBaja(r, db, dueno);
  decir(db.tablas.empresas[0].prueba_hasta === masDias(hoy(), 4), "una pendiente en la prueba: la prueba sigue hasta su día");
}

console.log("\nEl arrepentimiento");
{
  const db = escenario();
  mails.length = 0;
  const r = respuesta();
  await pedirArrepentimiento(r, db, { nombre: "Ana Duena", email: "DUENA@genez.test", comercio: "Almacén" });
  const a = db.tablas.arrepentimientos[0];
  decir(r.codigo === 200 && /^A-/.test(r.cuerpo.codigo) && a && a.empresa_id === "e1", "lo anota con el comercio de la dueña y da el código");
  decir(mails.length === 1 && mails[0].to[0] === "duena@genez.test", "le manda el código por mail");
  const r2 = respuesta();
  await pedirArrepentimiento(r2, db, { nombre: "Robot", email: "r@x.com", sitio: "http://spam" });
  decir(r2.codigo === 200 && db.tablas.arrepentimientos.length === 1, "el robot recibe un código y no se anota nada");
  for (let i = 0; i < 2; i++) await pedirArrepentimiento(respuesta(), db, { nombre: "Ana", email: "duena@genez.test" });
  const r3 = respuesta();
  db.tablas.arrepentimientos.forEach((x) => { x.creado_en = new Date().toISOString(); });
  await pedirArrepentimiento(r3, db, { nombre: "Ana", email: "duena@genez.test" });
  decir(r3.codigo === 429, "el cuarto del día, no");

  a.id = "a1"; a.estado = "recibido";
  pedidos.length = 0;
  const r4 = respuesta();
  await resolverArrepentimiento(r4, db, { id: "u1", es_plataforma: false }, { id: "a1" });
  decir(r4.codigo === 403, "solo la plataforma lo resuelve");
  const r5 = respuesta();
  await resolverArrepentimiento(r5, db, { id: "p", es_plataforma: true }, { id: "a1" });
  const devoluciones = pedidos.filter((p) => p.ruta.includes("/refunds"));
  decir(devoluciones.length === 1 && devoluciones[0].ruta === "/v1/payments/111/refunds" && devoluciones[0].clave === "arrepentimiento-a1-111",
    "devuelve solo el cobro aprobado, con clave de idempotencia");
  decir(a.estado === "resuelto" && db.tablas.suscripciones[0].estado === "cancelada" && db.tablas.empresas[0].prueba_hasta === hoy(),
    `cancela y corta el acceso hoy (${a.nota})`);
}

console.log("\nEl ajuste por IPC");
{
  const base = () => escenario({ proximo: masDias(hoy(), 11) });
  const db = base();
  Object.assign(db.tablas.suscripciones[0], { proximo_ajuste: masDias(hoy(), 5), ipc_ref_mes: "2026-05-01", ipc_ref: 11607.3937 });
  pedidos.length = 0; mails.length = 0;
  const r = await tareasDiarias(db);
  const s = db.tablas.suscripciones[0];
  const esperado = Math.round((59900 * 12276.766 / 11607.3937) / 100) * 100;
  decir(s.monto === esperado && s.monto_anterior === 59900, `59.900 → ${s.monto} (esperado ${esperado}, IPC mayo→agosto)`);
  decir(pedidos.some((p) => p.metodo === "PUT" && p.cuerpo.auto_recurring.transaction_amount === esperado), "cambia el monto en MP");
  decir(s.proximo_ajuste === (() => { const d = new Date(`${masDias(hoy(), 11)}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 3); return d.toISOString().slice(0, 10); })(),
    `el próximo, tres meses después del cobro (${s.proximo_ajuste})`);
  decir(mails.length === 2, `avisa a la dueña y al mail de MP (${mails.length})`);
  decir(r.errores.length === 0, `sin errores (${JSON.stringify(r.errores)})`);
}
{
  const db = escenario({ proximo: masDias(hoy(), 5) });
  Object.assign(db.tablas.suscripciones[0], { proximo_ajuste: masDias(hoy(), -1), ipc_ref_mes: "2026-05-01", ipc_ref: 11607.3937 });
  await tareasDiarias(db);
  decir(db.tablas.suscripciones[0].monto === 59900, "a 5 días del cobro ya no ajusta: no llega el aviso de 10 días");
}
{
  const db = escenario({ proximo: masDias(hoy(), 11) });
  Object.assign(db.tablas.suscripciones[0], { proximo_ajuste: masDias(hoy(), 60), ipc_ref_mes: "2026-05-01", ipc_ref: 11607.3937 });
  await tareasDiarias(db);
  decir(db.tablas.suscripciones[0].monto === 59900, "dentro de los seis meses congelados, no");
}
{
  const db = escenario({ proximo: masDias(hoy(), 11) });
  Object.assign(db.tablas.suscripciones[0], { proximo_ajuste: masDias(hoy(), 5), ipc_ref_mes: "2026-08-01", ipc_ref: 12276.766 });
  pedidos.length = 0;
  await tareasDiarias(db);
  decir(db.tablas.suscripciones[0].monto === 59900 && !pedidos.some((p) => p.metodo === "PUT"), "sin IPC nuevo publicado, no cambia nada en MP");
}

console.log("\nEl borrado");
{
  const db = baseFalsa({
    suscripciones: [],
    empresas: [
      { id: "vencida", nombre: "Vencida", plan: "start", prueba_hasta: masDias(hoy(), -95), pruebas: { empresa_id: "vencida" } },
      { id: "otra", nombre: "Otra", plan: "pro", prueba_hasta: masDias(hoy(), -91), pruebas: { empresa_id: "otra" } },
      { id: "reciente", nombre: "Reciente", plan: "pro", prueba_hasta: masDias(hoy(), -10), pruebas: { empresa_id: "reciente" } },
    ],
  });
  const r = await tareasDiarias(db);
  const borrar = db.rpcs.filter((x) => x.nombre === "borrar_comercio").map((x) => x.args.p_empresa);
  const preguntados = db.rpcs.filter((x) => x.nombre === "se_puede_borrar").map((x) => x.args.p_empresa);
  decir(JSON.stringify(borrar) === '["vencida"]' && r.borrados.length === 1, `borra solo la que la base dice que se puede (${borrar})`);
  decir(!preguntados.includes("reciente"), "a la de hace 10 días ni le pregunta");
}

console.log(fallas ? `\n${fallas} cosas no dieron.` : "\nTodo dio. No salió ningún pedido de verdad.");
process.exit(fallas ? 1 : 0);
