/* ============================================================
   PRUEBA · WhatsApp en Founder (0120)
   ============================================================

   En una transacción que se deshace. Si 0120 no está aplicada, la aplica
   adentro. No habla con Meta: los webhooks son inventados, con números
   que no existen (549110000000x) y wamids "wamid.prueba-…".

   Lo que se prueba es la parte de la base: que Meta pueda reintentar sin
   duplicar, que un estado no retroceda, que no salga nada fuera de la
   ventana ni a quien pidió la baja, y que el navegador no pueda escribir
   un mensaje ni cambiar lo que vino de Meta.

     node scripts/probar-founder-whatsapp.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };
const una = async (sql, p) => (await c.query(sql, p)).rows[0];
const todas = async (sql, p) => (await c.query(sql, p)).rows;
const intentar = async (sql, p) => {
  await c.query("savepoint s");
  try { const r = await c.query(sql, p); await c.query("release savepoint s"); return { r }; }
  catch (e) { await c.query("rollback to savepoint s"); return { e }; }
};
const como = async (u) => {
  await c.query("reset role");
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u, role: "authenticated" })]);
};
const comoServidor = async () => {
  await c.query("reset role");
  await c.query("set local role service_role");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "service_role" })]);
};

const ahora = () => Math.floor(Date.now() / 1000);
const WA1 = "5491100000001";
const WA2 = "5491100000002";
/* Lo que manda Meta, con la forma de su documentación. */
const entrante = (wa, id, texto, o = {}) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    metadata: { display_phone_number: "5491124859144", phone_number_id: "1354663697730352" },
    contacts: [{ wa_id: wa, profile: { name: o.nombre || "Cliente de prueba" } }],
    messages: [{ from: wa, id: `wamid.prueba-${id}`, timestamp: String(o.ts || ahora()), type: "text", text: { body: texto } }],
  } }] }],
});
const estado = (id, status, o = {}) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    statuses: [{ id: `wamid.prueba-${id}`, status, timestamp: String(ahora()), recipient_id: WA1, ...(o.errors ? { errors: o.errors } : {}) }],
  } }] }],
});
const procesar = async (cuerpo) => (await una("select interno_wa_procesar($1) r", [JSON.stringify(cuerpo)])).r;

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_wa_mensajes') t")).t) {
    await c.query(readFileSync("supabase/migrations/0120_interno_whatsapp.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1")).id;
  const D = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' limit 1")).id;
  /* C es del equipo sin mensajes; D solo con mensajes. Son perfiles de
     comercios prestados para la prueba: se deshace con todo lo demás. */
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'comercial', '{crm}'), ($2, 'soporte', '{mensajes}')", [C, D]);

  console.log("\nQuién puede procesar un webhook");
  await como(A);
  let x = await intentar("select interno_wa_procesar($1)", [JSON.stringify(entrante(WA1, "x", "hola"))]);
  decir(x.e && /permission denied/.test(x.e.message), "ni el fundador desde el navegador: solo el servidor");
  x = await intentar("select interno_wa_preparar_envio($1, gen_random_uuid(), 'hola', 'clave-de-prueba')", [A]);
  decir(x.e && /permission denied/.test(x.e.message), "y tampoco preparar un envío");

  console.log("\nLo que entra");
  await comoServidor();
  const t0 = ahora() - 60;
  let r = await procesar(entrante(WA1, "1", "Hola, quiero saber del sistema", { ts: t0, nombre: "Almacén Prueba" }));
  decir(r.mensajes === 1 && !r.error, "un mensaje nuevo se guarda");
  const conv = await una("select * from interno_wa_conversaciones where wa_id = $1", [WA1]);
  decir(conv && conv.nombre_perfil === "Almacén Prueba" && conv.no_leidos === 1 && conv.ultimo_direccion === "entrante"
    && conv.tel_norm === "1100000001" && conv.consentimiento === "sin_dato",
    "crea la conversación con el nombre del perfil, el teléfono normalizado y un no leído");
  decir(Math.abs(new Date(conv.ultimo_entrante_en).getTime() / 1000 - t0) < 1, "la ventana se abre con la hora de Meta, no la del webhook");
  r = await procesar(entrante(WA1, "1", "Hola, quiero saber del sistema", { ts: t0 }));
  decir(r.mensajes === 0 && (await una("select count(*)::int n from interno_wa_mensajes where conversacion_id = $1", [conv.id])).n === 1,
    "un reintento de Meta no duplica el mensaje");
  decir((await una("select no_leidos from interno_wa_conversaciones where id = $1", [conv.id])).no_leidos === 1, "ni suma otro no leído");
  r = await procesar(entrante(WA1, "0", "mensaje viejo que llegó tarde", { ts: t0 - 3600 }));
  const tras = await una("select ultimo_texto, ultimo_entrante_en from interno_wa_conversaciones where id = $1", [conv.id]);
  decir(r.mensajes === 1 && tras.ultimo_texto === "Hola, quiero saber del sistema" && Math.abs(new Date(tras.ultimo_entrante_en).getTime() / 1000 - t0) < 1,
    "uno viejo que llega tarde se guarda, pero no pisa el último ni achica la ventana");

  r = await procesar({ object: "page", entry: [] });
  const ev = await una("select error from interno_wa_eventos where id = $1", [r.evento]);
  decir(r.error && ev.error && /No es un evento de WhatsApp/.test(ev.error), "un cuerpo que no es de WhatsApp queda registrado con su error, sin romper");
  const nEv = (await una("select count(*)::int n from interno_wa_eventos where id >= $1", [r.evento - 3])).n;
  decir(nEv >= 4, "cada webhook queda en interno_wa_eventos, también los repetidos");

  console.log("\nLo que sale");
  x = await intentar("select interno_wa_preparar_envio($1, $2, 'Hola!', 'envio-prueba-1')", [C, conv.id]);
  decir(x.e && /No tenés acceso/.test(x.e.message), "alguien del equipo sin 'mensajes' no puede mandar");
  x = await intentar("select interno_wa_preparar_envio($1, $2, '   ', 'envio-prueba-1')", [D, conv.id]);
  decir(x.e && /vacío/.test(x.e.message), "un mensaje vacío no sale");
  const p1 = (await una("select interno_wa_preparar_envio($1, $2, 'Hola! Te cuento', 'envio-prueba-1') r", [D, conv.id])).r;
  decir(!p1.repetido && p1.wa_id === WA1 && p1.estado === "enviando", "con 'mensajes' y la ventana abierta, queda en 'enviando' y devuelve a quién mandarlo");
  const p1b = (await una("select interno_wa_preparar_envio($1, $2, 'Hola! Te cuento', 'envio-prueba-1') r", [D, conv.id])).r;
  decir(p1b.repetido && p1b.mensaje === p1.mensaje, "la misma clave no crea otro: un doble clic no manda dos");
  const cv = await una("select no_leidos, ultimo_direccion, ultimo_texto from interno_wa_conversaciones where id = $1", [conv.id]);
  decir(cv.no_leidos === 0 && cv.ultimo_direccion === "saliente" && cv.ultimo_texto === "Hola! Te cuento", "contestar la deja leída y actualiza el último mensaje");

  await c.query("select interno_wa_resultado_envio($1, 'wamid.prueba-s1', null)", [p1.mensaje]);
  let m = await una("select estado, wamid from interno_wa_mensajes where id = $1", [p1.mensaje]);
  decir(m.estado === "enviado" && m.wamid === "wamid.prueba-s1", "lo que contesta Meta lo pasa a 'enviado' con su wamid");
  await procesar(estado("s1", "delivered"));
  await procesar(estado("s1", "read"));
  await procesar(estado("s1", "delivered"));
  await procesar(estado("s1", "failed", { errors: [{ code: 131047 }] }));
  m = await una("select estado, error from interno_wa_mensajes where id = $1", [p1.mensaje]);
  decir(m.estado === "leido" && m.error === null, "un estado no retrocede: 'entregado' o 'fallido' después de 'leído' no lo pisan");

  const p2 = (await una("select interno_wa_preparar_envio($1, $2, 'otro', 'envio-prueba-2') r", [D, conv.id])).r;
  await c.query("select interno_wa_resultado_envio($1, 'wamid.prueba-s2', null)", [p2.mensaje]);
  await procesar(estado("s2", "failed", { errors: [{ code: 131047, title: "Re-engagement message" }] }));
  m = await una("select estado, error from interno_wa_mensajes where id = $1", [p2.mensaje]);
  decir(m.estado === "fallido" && m.error[0].code === 131047, "uno que falla guarda el error de Meta");
  const p3 = (await una("select interno_wa_preparar_envio($1, $2, 'tercero', 'envio-prueba-3') r", [D, conv.id])).r;
  await c.query("select interno_wa_resultado_envio($1, null, $2)", [p3.mensaje, JSON.stringify({ message: "Token vencido" })]);
  decir((await una("select estado from interno_wa_mensajes where id = $1", [p3.mensaje])).estado === "fallido", "si Meta lo rechaza de entrada, queda 'fallido'");

  console.log("\nLa ventana y la baja");
  await c.query("reset role");
  await c.query("update interno_wa_conversaciones set ultimo_entrante_en = now() - interval '25 hours' where id = $1", [conv.id]);
  await comoServidor();
  x = await intentar("select interno_wa_preparar_envio($1, $2, 'fuera', 'envio-prueba-4')", [D, conv.id]);
  decir(x.e && /24 horas/.test(x.e.message), "pasadas 24 horas de su último mensaje no se puede mandar texto libre");
  await procesar(entrante(WA1, "2", "  baja  "));
  const cb = await una("select consentimiento, consentimiento_en from interno_wa_conversaciones where id = $1", [conv.id]);
  decir(cb.consentimiento === "baja" && cb.consentimiento_en, "escribir BAJA da de baja, con la fecha");
  x = await intentar("select interno_wa_preparar_envio($1, $2, 'hola?', 'envio-prueba-5')", [D, conv.id]);
  decir(x.e && /pidió que no le escriban/.test(x.e.message), "y después de la baja no sale nada, aunque la ventana esté abierta");
  await procesar(entrante(WA2, "3", "no me doy de baja, quiero info"));
  decir((await una("select consentimiento from interno_wa_conversaciones where wa_id = $1", [WA2])).consentimiento === "sin_dato",
    "una frase que contiene 'baja' no da de baja");

  console.log("\nLo que ve y cambia el navegador");
  await como(D);
  const vistas = await todas("select * from interno_wa_conversaciones_vista where wa_id in ($1, $2)", [WA1, WA2]);
  decir(vistas.length === 2 && vistas.every((v) => v.ventana_abierta), "con 'mensajes' ve las conversaciones y si la ventana está abierta");
  decir((await todas("select id from interno_wa_mensajes where conversacion_id = $1", [conv.id])).length >= 4, "y los mensajes");
  decir((await todas("select id from interno_wa_eventos")).length === 0, "los eventos crudos no: son de 'config'");
  x = await intentar("update interno_wa_conversaciones set estado = 'cerrada', notas = 'probando' where id = $1", [conv.id]);
  decir(!x.e && x.r.rowCount === 1, "puede cerrar una conversación y anotar");
  x = await intentar("update interno_wa_conversaciones set ultimo_entrante_en = now() where id = $1", [conv.id]);
  decir(x.e && /permission denied/.test(x.e.message), "no puede abrir la ventana a mano");
  x = await intentar("update interno_wa_conversaciones set wa_id = '5491100000009' where id = $1", [conv.id]);
  decir(x.e && /permission denied/.test(x.e.message), "ni cambiar el número");
  x = await intentar("insert into interno_wa_mensajes (conversacion_id, direccion, texto, estado) values ($1, 'entrante', 'inventado', 'recibido')", [conv.id]);
  decir(x.e && /permission denied/.test(x.e.message), "ni inventar un mensaje");
  x = await intentar("update interno_wa_mensajes set estado = 'leido' where id = $1", [p2.mensaje]);
  decir(x.e && /permission denied/.test(x.e.message), "ni cambiar un estado de entrega");
  x = await intentar("insert into interno_wa_conversaciones (wa_id) values ('5491100000008')");
  decir(x.e && /permission denied/.test(x.e.message), "ni crear una conversación");

  await como(C);
  decir((await todas("select id from interno_wa_conversaciones_vista")).length === 0, "alguien del equipo sin 'mensajes' no ve ninguna");
  x = await intentar("update interno_wa_conversaciones set estado = 'abierta' where id = $1", [conv.id]);
  decir(!x.e && x.r.rowCount === 0, "ni puede cambiarlas");
  await c.query("reset role");
  await c.query("set local role anon");
  x = await intentar("select id from interno_wa_mensajes");
  decir(x.e && /permission denied/.test(x.e.message), "anon no llega ni a preguntar");

  console.log("\nEl prospecto: se sugiere, no se engancha");
  await como(A);
  const pr = await una("insert into interno_prospectos (nombre, whatsapp) values ('Almacén Prueba WA', '11 0000-0002') returning id");
  let v2 = await una("select prospecto_id, prospecto_sugerido_id, prospecto_sugerido_nombre from interno_wa_conversaciones_vista where wa_id = $1", [WA2]);
  decir(v2.prospecto_id === null && v2.prospecto_sugerido_id === pr.id && v2.prospecto_sugerido_nombre === "Almacén Prueba WA",
    "con un prospecto de ese teléfono lo sugiere, sin engancharlo");
  await c.query("insert into interno_prospectos (nombre, telefono) values ('Otro local, mismo dueño', '011 0000-0002')");
  v2 = await una("select prospecto_sugerido_id from interno_wa_conversaciones_vista where wa_id = $1", [WA2]);
  decir(v2.prospecto_sugerido_id === null, "con dos del mismo teléfono no sugiere ninguno");
  await c.query("update interno_wa_conversaciones set prospecto_id = $1 where wa_id = $2", [pr.id, WA2]);
  v2 = await una("select prospecto_nombre, prospecto_sugerido_id from interno_wa_conversaciones_vista where wa_id = $1", [WA2]);
  decir(v2.prospecto_nombre === "Almacén Prueba WA" && v2.prospecto_sugerido_id === null, "engancharlo es una decisión de alguien, y queda");
  const h = await una("select count(*)::int n from interno_historial where tabla = 'interno_wa_conversaciones' and accion = 'cambio' and quien = $1", [A]);
  decir(h.n >= 1, "y queda en el historial quién lo hizo");
} catch (e) {
  fallas++;
  console.error("\nSe cortó:", e.message);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. (Se deshizo todo.)");
process.exit(fallas ? 1 : 0);
