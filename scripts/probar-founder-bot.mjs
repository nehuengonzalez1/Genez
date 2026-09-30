/* ============================================================
   PRUEBA · el asistente de WhatsApp en la base (0121)
   ============================================================

   En una transacción que se deshace. Si 0121 no está aplicada, la aplica
   adentro. No habla con Meta ni con Anthropic: los webhooks y las
   decisiones del modelo son inventados, con números que no existen.

   Lo que importa: un solo borrador pendiente por conversación, derivar
   pausa el asistente, del navegador solo se descarta, y el envío del bot
   (sin perfil) pasa por sus tres frenos.

     node scripts/probar-founder-bot.mjs
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
const WA = "5491100000071";
const entrante = (id, texto) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "WABA", changes: [{ field: "messages", value: {
    messaging_product: "whatsapp",
    contacts: [{ wa_id: WA, profile: { name: "Prueba bot" } }],
    messages: [{ from: WA, id: `wamid.prueba-bot-${id}`, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: texto } }],
  } }] }],
});
const guardar = (conv, accion, texto, motivo = null, error = null) => una(
  "select interno_bot_guardar($1, null, $2, $3, $4, '{\"rubro\":\"almacén\"}', '[{\"id\":\"x\",\"titulo\":\"Qué es Genez\",\"version\":1}]', 'modelo-de-prueba', '{\"entrada\":1}', $5) id",
  [conv, accion, texto, motivo, error]);
const bot = (valor) => c.query("update interno_ajustes set valor = valor || $1::jsonb where clave = 'bot'", [JSON.stringify(valor)]);

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_wa_borradores') t")).t) {
    await c.query(readFileSync("supabase/migrations/0121_interno_bot.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1")).id;
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'comercial', '{crm}')", [C]);

  console.log("\nLo de arranque");
  const base = await todas("select titulo, estado from interno_documentos where tipo = 'base_bot'");
  decir(base.length >= 3 && base.every((d) => d.estado === "borrador"), "la base de arranque entra en borrador: el asistente no la lee hasta que alguien la apruebe");
  const aj = (await una("select valor from interno_ajustes where clave = 'bot'")).valor;
  decir(aj.activo === false && aj.modo === "borrador", "el asistente arranca apagado y en modo borrador");

  console.log("\nEl webhook dice qué conversaciones tienen algo nuevo");
  await comoServidor();
  let r = (await una("select interno_wa_procesar($1) r", [JSON.stringify(entrante(1, "Hola, ¿qué es Genez?"))])).r;
  const conv = (await una("select id from interno_wa_conversaciones where wa_id = $1", [WA])).id;
  decir(r.conversaciones.length === 1 && r.conversaciones[0] === conv, "devuelve la conversación del mensaje nuevo");
  r = (await una("select interno_wa_procesar($1) r", [JSON.stringify(entrante(1, "Hola, ¿qué es Genez?"))])).r;
  decir(r.conversaciones.length === 0, "un reintento de Meta no la devuelve: el asistente no contesta dos veces lo mismo");

  console.log("\nLos borradores");
  const b1 = (await guardar(conv, "responder", "¡Hola! Genez es un sistema de gestión.", "saludo")).id;
  const b2 = (await guardar(conv, "responder", "Otra versión.", "segundo intento")).id;
  const est = await todas("select id, estado from interno_wa_borradores where conversacion_id = $1", [conv]);
  decir(est.find((b) => b.id === b1).estado === "reemplazado" && est.find((b) => b.id === b2).estado === "pendiente", "uno nuevo reemplaza al pendiente: nunca hay dos");
  const guardado = await una("select datos, conocimiento, modelo, uso from interno_wa_borradores where id = $1", [b2]);
  decir(guardado.datos.rubro === "almacén" && guardado.conocimiento[0].version === 1 && guardado.modelo === "modelo-de-prueba", "guarda lo que entendió, qué documentos y versión usó, y con qué modelo");
  let x = await intentar("select interno_bot_guardar($1, null, 'responder', '   ', null, null, null, null, null, null)", [conv]);
  decir(x.e && /interno_wa_borradores_texto/.test(x.e.message), "una respuesta vacía no se guarda");
  const be = (await guardar(conv, "error", null, null, "No hay crédito")).id;
  decir((await una("select estado from interno_wa_borradores where id = $1", [be])).estado === "error", "un error queda registrado como error");

  console.log("\nDerivar");
  await guardar(conv, "derivar", null, "Pide precios y la base no los tiene");
  const cv = await una("select derivada_en, derivada_motivo, bot_pausado from interno_wa_conversaciones where id = $1", [conv]);
  decir(cv.derivada_en && cv.derivada_motivo === "Pide precios y la base no los tiene" && cv.bot_pausado, "marca la conversación para una persona y pausa el asistente ahí");

  console.log("\nLo que hace el navegador");
  const b3 = (await guardar(conv, "responder", "Tercera versión.", "x")).id;
  await como(A);
  decir((await todas("select id from interno_wa_borradores where conversacion_id = $1", [conv])).length >= 4, "con 'mensajes' ve los borradores");
  decir((await una("select con_borrador from interno_wa_conversaciones_vista where id = $1", [conv])).con_borrador === true, "la vista avisa que hay uno esperando");
  x = await intentar("update interno_wa_borradores set texto = 'cambiado' where id = $1", [b3]);
  decir(x.e && /permission denied/.test(x.e.message), "no puede cambiarle el texto");
  x = await intentar("update interno_wa_borradores set estado = 'enviado' where id = $1", [b3]);
  decir(x.e && /Solo se puede descartar/.test(x.e.message), "no puede marcarlo como enviado");
  x = await intentar("update interno_wa_borradores set estado = 'descartado' where id = $1 returning resuelto_por", [b3]);
  decir(!x.e && x.r.rows[0].resuelto_por === A, "puede descartarlo, y queda quién");
  x = await intentar("update interno_wa_borradores set estado = 'descartado' where id = $1", [b1]);
  decir(x.e && /Solo se puede descartar/.test(x.e.message), "uno que no está pendiente no se toca");
  x = await intentar("insert into interno_wa_borradores (conversacion_id, accion, texto) values ($1, 'responder', 'inventado')", [conv]);
  decir(x.e && /permission denied/.test(x.e.message), "no puede inventar un borrador");
  x = await intentar("update interno_wa_conversaciones set derivada_en = null, bot_pausado = false where id = $1", [conv]);
  decir(!x.e && x.r.rowCount === 1, "\"ya la atiendo\" y reanudar el asistente se hacen desde la pantalla");
  await como(C);
  decir((await todas("select id from interno_wa_borradores")).length === 0, "alguien del equipo sin 'mensajes' no ve ninguno");

  console.log("\nMandar un borrador");
  await comoServidor();
  const b4 = (await guardar(conv, "responder", "Cuarta.", "x")).id;
  let p = (await una("select interno_wa_preparar_envio($1, $2, 'Cuarta, corregida.', 'envio-bot-prueba-1', $3) r", [A, conv, b4])).r;
  const b4d = await una("select estado, mensaje_id, resuelto_por from interno_wa_borradores where id = $1", [b4]);
  decir(b4d.estado === "enviado" && b4d.mensaje_id === p.mensaje && b4d.resuelto_por === A, "usarlo lo marca enviado, con el mensaje que salió y quién lo mandó");
  decir((await una("select del_bot from interno_wa_mensajes where id = $1", [p.mensaje])).del_bot === false, "si lo manda una persona, el mensaje es de ella, no del bot");

  console.log("\nEl envío del bot y sus frenos");
  const b5 = (await guardar(conv, "responder", "Quinta.", "x")).id;
  x = await intentar("select interno_wa_preparar_envio(null, $1, 'Quinta.', 'envio-bot-prueba-2', $2)", [conv, b5]);
  decir(x.e && /modo automático/.test(x.e.message), "con el asistente apagado, el bot no manda");
  await c.query("reset role");
  await bot({ activo: true, modo: "automatico", max_por_hora: 2 });
  await c.query("update interno_wa_conversaciones set bot_pausado = true where id = $1", [conv]);
  await comoServidor();
  x = await intentar("select interno_wa_preparar_envio(null, $1, 'Quinta.', 'envio-bot-prueba-2', $2)", [conv, b5]);
  decir(x.e && /pausado/.test(x.e.message), "en una conversación pausada, tampoco");
  await c.query("reset role");
  await c.query("update interno_wa_conversaciones set bot_pausado = false, no_leidos = 1 where id = $1", [conv]);
  await comoServidor();
  p = (await una("select interno_wa_preparar_envio(null, $1, 'Quinta.', 'envio-bot-prueba-2', $2) r", [conv, b5])).r;
  const m = await una("select del_bot, enviado_por from interno_wa_mensajes where id = $1", [p.mensaje]);
  decir(m.del_bot === true && m.enviado_por === null, "prendido y en automático, manda: el mensaje queda como del bot");
  decir((await una("select no_leidos from interno_wa_conversaciones where id = $1", [conv])).no_leidos > 0, "y no marca la conversación como leída: nadie la leyó");
  await una("select interno_wa_preparar_envio(null, $1, 'Sexta.', 'envio-bot-prueba-3', null) r", [conv]);
  x = await intentar("select interno_wa_preparar_envio(null, $1, 'Séptima.', 'envio-bot-prueba-4', null)", [conv]);
  decir(x.e && /tope de mensajes por hora/.test(x.e.message), "al tope por hora frena: dos bots no se contestan sin fin");
  await c.query("reset role");
  await c.query("update interno_wa_conversaciones set consentimiento = 'baja' where id = $1", [conv]);
  await comoServidor();
  x = await intentar("select interno_wa_preparar_envio(null, $1, 'Octava.', 'envio-bot-prueba-5', null)", [conv]);
  decir(x.e && /pidió que no le escriban/.test(x.e.message), "y a quien pidió la baja no le manda nada");

  await como(A);
  x = await intentar("select interno_bot_guardar($1, null, 'responder', 'hola', null, null, null, null, null, null)", [conv]);
  decir(x.e && /permission denied/.test(x.e.message), "desde el navegador no se puede guardar un borrador ni llamar al bot");
} catch (e) {
  fallas++;
  console.error("\nSe cortó:", e.message);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. (Se deshizo todo.)");
process.exit(fallas ? 1 : 0);
