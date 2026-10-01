/* ============================================================
   PRUEBA · métricas de Founder y los pedidos de la web (0123)
   ============================================================

   En una transacción que se deshace. Si 0123 no está aplicada, la aplica
   adentro. Los informes se piden para la ventana [now(), now() + 1 h):
   adentro de una transacción now() es la hora en que empezó, así que
   solo entra lo que crea esta prueba y no los datos reales.

     node scripts/probar-founder-metricas.mjs
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
const admin = async () => { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true)"); };
const VENTANA = "now(), now() + interval '1 hour'";

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select 1 x from information_schema.columns where table_name = 'solicitudes' and column_name = 'prospecto_id'"))) {
    await c.query(readFileSync("supabase/migrations/0123_interno_metricas.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1")).id;
  const D = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' limit 1")).id;
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'comercial', '{crm}')", [C]);

  /* ---------- Datos de la prueba ---------- */
  const pr = (await una("insert into interno_prospectos (nombre) values ('Métricas Prueba') returning id")).id;
  await c.query("update interno_oportunidades set estado = 'ganada', ganada_en = now() where prospecto_id = $1", [pr]);
  const c1 = (await una("insert into interno_wa_conversaciones (wa_id, nombre_perfil, prospecto_id) values ('5491100000081', 'Uno', $1) returning id", [pr])).id;
  const c2 = (await una("insert into interno_wa_conversaciones (wa_id, nombre_perfil, consentimiento) values ('5491100000082', 'Dos', 'baja') returning id")).id;
  const msg = (conv, dir, estado, o = {}) => una(
    `insert into interno_wa_mensajes (conversacion_id, direccion, tipo, texto, estado, del_bot, error, momento)
     values ($1, $2, $3, 'x', $4, $5, $6, now() + make_interval(mins => $7)) returning id`,
    [conv, dir, o.tipo || "text", estado, !!o.bot, o.error ? JSON.stringify(o.error) : null, o.min || 1]);
  await msg(c1, "entrante", "recibido", { min: 1 });
  await msg(c1, "saliente", "enviado", { min: 2 });
  await msg(c1, "saliente", "entregado", { min: 3 });
  await msg(c1, "saliente", "leido", { min: 4 });
  await msg(c1, "saliente", "fallido", { min: 5, error: [{ code: 131026, title: "Undeliverable" }] });
  await msg(c1, "saliente", "leido", { min: 6, bot: true });
  const tpl = (await msg(c2, "saliente", "entregado", { min: 7, tipo: "template" })).id;
  await msg(c2, "entrante", "recibido", { min: 20 });
  const pl = (await una("insert into interno_wa_plantillas (nombre, categoria, cuerpo, estado) values ('metricas_prueba', 'UTILITY', 'Hola', 'aprobada') returning id")).id;
  const regla = (await una("select id from interno_automatizaciones where tipo = 'recordatorio_evento'")).id;
  await c.query("insert into interno_envios (automatizacion_id, plantilla_id, clave_unica, destino_wa, estado, mensaje_id) values ($1, $2, 'metricas:1', '5491100000082', 'enviado', $3), ($1, $2, 'metricas:2', null, 'omitido', null)", [regla, pl, tpl]);
  await c.query(`insert into interno_wa_borradores (conversacion_id, accion, texto, estado, modelo, uso) values
                 ($1, 'responder', 'hola', 'enviado', 'claude-opus-5-5', '{"entrada": 1200, "salida": 80, "cache_leido": 900, "cache_escrito": 0}'),
                 ($1, 'derivar', null, 'derivada', 'claude-opus-5-5', '{"entrada": 1000, "salida": 40}')`, [c1]);
  await c.query("insert into interno_hallazgos (proveedor, externo_id, nombre, telefono) values ('osm', 'node/metricas-1', 'Hallazgo 1', '1100000083'), ('osm', 'node/metricas-2', 'Hallazgo 2', null)");
  await c.query("insert into interno_eventos (titulo, tipo, prospecto_id, inicio, fin, estado) values ('Demo métricas', 'demo', $1, now() + interval '10 minutes', now() + interval '40 minutes', 'realizado')", [pr]);

  console.log("\nWhatsApp: enviado, entregado y leído no se confunden");
  await como(A);
  let w = (await una(`select interno_informe_whatsapp(${VENTANA}) r`)).r;
  const eq = w.salientes.equipo;
  decir(eq.enviados === 3 && eq.entregados === 2 && eq.leidos === 1, "del equipo: 3 llegaron a enviados, 2 a entregados, 1 a leídos (cada uno incluye al siguiente)");
  decir(eq.fallidos === 1 && w.errores["131026"] === 1, "el que no salió cuenta aparte, con su código de error");
  decir(w.salientes.asistente.leidos === 1 && w.salientes.automatico.entregados === 1, "los del asistente y los automáticos se cuentan por separado");
  decir(w.entrantes === 2 && w.conversaciones_nuevas === 2 && w.conversaciones_con_respuesta === 2, "mensajes y conversaciones que escribieron");
  decir(w.calificadas === 1 && w.calificadas_ganadas === 1, "calificada = vinculada a un prospecto, y cuántas terminaron en venta");
  decir(w.bajas === 1, "las bajas del período");
  decir(w.automatizaciones.enviados === 1 && w.automatizaciones.respondidos === 1 && w.automatizaciones.omitidos === 1 && w.automatizaciones.utilidad === 1,
    "automáticos: enviados, omitidos, de qué categoría, y cuántos tuvieron respuesta en 72 h");
  decir(w.asistente.respuestas === 1 && w.asistente.derivadas === 1 && w.asistente.usados === 1, "el asistente: respuestas, derivaciones y cuántas se usaron");
  const u = w.uso_modelos.find((x) => x.modelo === "claude-opus-5-5");
  decir(u && Number(u.entrada) === 2200 && Number(u.salida) === 120 && Number(u.cache_leido) === 900 && Number(u.pedidos) === 2, "los tokens reales por modelo, para estimar el costo");

  console.log("\nCada uno ve lo de sus áreas");
  await como(C);
  w = (await una(`select interno_informe_whatsapp(${VENTANA}) r`)).r;
  decir(Object.keys(w.salientes).length === 0 && w.entrantes === 0 && w.asistente.respuestas === 0, "con solo 'crm', los números de WhatsApp dan cero, no los de otro");
  await c.query("reset role");
  await c.query("set local role anon");
  let x = await intentar(`select interno_informe_whatsapp(${VENTANA})`);
  decir(x.e && /permission denied/.test(x.e.message), "anon no puede pedir informes");

  console.log("\nDescubrimiento y demos");
  await como(A);
  let dsc = (await una(`select interno_informe_descubrimiento(${VENTANA}) r`)).r;
  const osm = dsc.por_proveedor.find((p) => p.proveedor === "osm");
  decir(osm && osm.descubiertos === 2 && osm.con_telefono === 1 && osm.al_crm === 0, "comercios descubiertos por proveedor, con teléfono y pasados al CRM");
  decir(dsc.demos_agendadas === 1 && dsc.demos_realizadas === 1, "demos agendadas y realizadas");

  console.log("\nLos pedidos de la web, al CRM");
  await admin();
  const s1 = (await una("insert into solicitudes (negocio, rubro, modulos, mensual, nombre, telefono, email, mensaje) values ('Almacén Web Prueba', 'minimercado', '{cobro,stock}', 45000, 'Lucía Prueba', '1100000084', 'lucia@prueba.test', 'Quiero probar') returning id")).id;
  const s2 = (await una("insert into solicitudes (negocio, nombre, telefono) values ('Otro local', 'Lucía Prueba', '11 0000-0084') returning id")).id;
  await como(C);
  decir((await c.query("select id from solicitudes where id in ($1, $2)", [s1, s2])).rowCount === 2, "con el área crm de Founder se ven los pedidos de la web");
  const p1 = (await una("select interno_solicitud_a_prospecto($1) id", [s1])).id;
  await admin();
  const pp = await una("select nombre, fuente, email, modulos from interno_prospectos where id = $1", [p1]);
  decir(pp.nombre === "Almacén Web Prueba" && pp.fuente === "landing" && pp.email === "lucia@prueba.test", "arma el prospecto con el negocio, la fuente 'landing' y el correo");
  decir((await una("select nombre from interno_contactos where prospecto_id = $1 and principal", [p1])).nombre === "Lucía Prueba", "con la persona como contacto principal");
  const op = await una("select valor, modulos from interno_oportunidades where prospecto_id = $1", [p1]);
  decir(Number(op.valor) === 45000 && op.modulos.join(",") === "cobro,stock", "y la oportunidad con los módulos y el presupuesto que eligió");
  decir(/Pidió un presupuesto en la web/.test((await una("select resultado from interno_actividades where prospecto_id = $1 and tipo = 'nota'", [p1])).resultado), "queda una nota en su historia");
  const st = await una("select prospecto_id, estado from solicitudes where id = $1", [s1]);
  decir(st.prospecto_id === p1 && st.estado === "nueva", "el pedido queda vinculado, y su estado no cambia: pasarlo al CRM no es haberle escrito");
  await como(C);
  x = await intentar("select interno_solicitud_a_prospecto($1)", [s1]);
  decir(x.e && /ya está en el CRM/.test(x.e.message), "no se pasa dos veces");
  const p2 = (await una("select interno_solicitud_a_prospecto($1) id", [s2])).id;
  decir(p2 === p1, "otro pedido con el mismo teléfono se vincula al prospecto que ya estaba, no crea otro");
  await como(D);
  decir((await c.query("select id from solicitudes where id = $1", [s1])).rowCount === 0, "alguien que no es del equipo no ve los pedidos");
  x = await intentar("select interno_solicitud_a_prospecto($1)", [s2]);
  decir(x.e && /Sin acceso/.test(x.e.message), "ni los puede pasar al CRM");
  await como(A);
  dsc = (await una(`select interno_informe_descubrimiento(${VENTANA}) r`)).r;
  decir(dsc.pedidos_web === 2 && dsc.pedidos_web_al_crm === 2, "el informe cuenta los pedidos y cuántos pasaron al CRM");
} catch (e) {
  fallas++;
  console.error("\nSe cortó:", e.message);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. (Se deshizo todo.)");
process.exit(fallas ? 1 : 0);
