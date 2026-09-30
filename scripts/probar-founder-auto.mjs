/* ============================================================
   PRUEBA · automatizaciones de Founder (0122)
   ============================================================

   En una transacción que se deshace. Si 0122 no está aplicada, la aplica
   adentro (incluido el reloj, que se deshace con todo). No habla con
   Meta: las plantillas se "aprueban" a mano y los resultados de envío
   son inventados, con números que no existen (549110000009x).

   Lo que importa: que no se genere dos veces lo mismo, que lo que no se
   puede mandar quede omitido con su motivo, y que los frenos (baja,
   consentimiento, horario, topes, evento que ya no está) los ponga la
   base en el momento de mandar.

     node scripts/probar-founder-auto.mjs
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
const admin = async () => {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', '', true)");
};

try {
  console.log("\nLa API no expone el esquema de pg_net");
  const r0 = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/http_get`, {
    method: "POST",
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, "Content-Profile": "net", "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com" }),
  });
  decir(r0.status === 406, "pedirle net.http_get a la API da 406: nadie hace pedidos HTTP desde la base por el navegador");

  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_envios') t")).t) {
    await c.query(readFileSync("supabase/migrations/0122_interno_automatizaciones.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1")).id;
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'comercial', '{crm}')", [C]);

  console.log("\nLo de arranque");
  decir(!!(await una("select 1 x from cron.job where jobname = 'genez-automatizaciones' and schedule = '*/5 * * * *'")), "el reloj corre cada 5 minutos");
  const reglas = await todas("select tipo, activa, plantilla_id, aprobacion_manual from interno_automatizaciones where archivado_en is null");
  decir(reglas.filter((r) => ["recordatorio_evento", "seguimiento"].includes(r.tipo)).every((r) => !r.activa && !r.plantilla_id && r.aprobacion_manual),
    "las de WhatsApp arrancan apagadas, sin plantilla y con aprobación manual");
  decir(reglas.filter((r) => r.tipo.startsWith("alerta")).every((r) => r.activa), "las alertas internas arrancan prendidas: no le mandan nada a nadie");

  console.log("\nPlantillas");
  await como(A);
  let x = await intentar("insert into interno_wa_plantillas (nombre, cuerpo, variables, ejemplos, estado) values ('prueba_x', 'Hola', '{}', '{}', 'aprobada')");
  decir(x.e && /permission denied/.test(x.e.message), "del navegador no se crea una plantilla ya aprobada");
  x = await intentar("insert into interno_wa_plantillas (nombre, categoria, cuerpo, variables, ejemplos) values ('recordatorio_prueba', 'UTILITY', 'Hola {{1}}, te recordamos la demo del {{2}} a las {{3}}.', '{nombre,dia,hora}', '{Juan,martes,10:00}') returning id, estado");
  decir(!x.e && x.r.rows[0].estado === "borrador", "se crea en borrador");
  const pl = x.r.rows[0].id;
  x = await intentar("insert into interno_wa_plantillas (nombre, cuerpo, variables, ejemplos) values ('mal_armada', 'Hola {{1}}', '{nombre}', '{}')");
  decir(x.e && /interno_wa_plantillas_variables/.test(x.e.message), "cada variable necesita su ejemplo (Meta lo pide)");
  x = await intentar("insert into interno_wa_plantillas (nombre, cuerpo) values ('Con Mayúsculas', 'Hola')");
  decir(x.e && /interno_wa_plantillas_nombre/.test(x.e.message), "el nombre va como lo pide Meta: minúsculas y guiones bajos");
  await admin();
  await c.query("update interno_wa_plantillas set estado = 'aprobada', meta_id = 'meta-prueba' where id = $1", [pl]);
  await como(A);
  x = await intentar("update interno_wa_plantillas set cuerpo = 'Otro texto' where id = $1", [pl]);
  decir(x.e && /no se edita/.test(x.e.message), "una plantilla ya mandada a Meta no se edita");

  console.log("\nRecordatorio de una demo");
  await admin();
  const reg = (await una("select id from interno_automatizaciones where tipo = 'recordatorio_evento'")).id;
  await c.query("update interno_automatizaciones set activa = true, plantilla_id = $1, hora_desde = 0, hora_hasta = 24, dias = '{0,1,2,3,4,5,6}' where id = $2", [pl, reg]);
  const p1 = (await una("insert into interno_prospectos (nombre, whatsapp) values ('Almacén Auto Prueba', '11 0000-0091') returning id")).id;
  await c.query("insert into interno_contactos (prospecto_id, nombre, whatsapp, principal) values ($1, 'Rosario Prueba', '11 0000-0091', true)", [p1]);
  const ev = (await una("insert into interno_eventos (titulo, tipo, prospecto_id, inicio, fin, estado) values ('Demo prueba', 'demo', $1, now() + interval '3 hours', now() + interval '4 hours', 'programado') returning id", [p1])).id;
  const p2 = (await una("insert into interno_prospectos (nombre) values ('Sin teléfono Prueba') returning id")).id;
  await c.query("insert into interno_eventos (titulo, tipo, prospecto_id, inicio, fin, estado) values ('Demo sin tel', 'demo', $1, now() + interval '5 hours', now() + interval '6 hours', 'programado')", [p2]);
  await c.query("insert into interno_eventos (titulo, tipo, prospecto_id, inicio, fin, estado) values ('Demo lejos', 'demo', $1, now() + interval '3 days', now() + interval '3 days 1 hour', 'programado')", [p1]);
  let g = (await una("select interno_auto_generar() r")).r;
  const e1 = await una("select * from interno_envios where evento_id = $1", [ev]);
  decir(e1 && e1.estado === "por_aprobar" && e1.destino_wa === "5491100000091" && e1.destinatario === "Rosario Prueba",
    "genera el recordatorio para el contacto principal, esperando aprobación");
  decir(e1.valores[0] === "Rosario" && ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"].includes(e1.valores[1]) && /^\d\d:\d\d$/.test(e1.valores[2]),
    "con los valores de la plantilla: el nombre de pila, el día y la hora de Buenos Aires");
  const sinTel = await una("select e.estado, e.motivo from interno_envios e join interno_eventos v on v.id = e.evento_id where v.titulo = 'Demo sin tel'");
  decir(sinTel.estado === "omitido" && /no tiene WhatsApp/.test(sinTel.motivo), "sin teléfono queda omitido, con el motivo");
  decir(!(await una("select 1 x from interno_envios e join interno_eventos v on v.id = e.evento_id where v.titulo = 'Demo lejos'")), "una demo de dentro de tres días todavía no");
  g = (await una("select interno_auto_generar() r")).r;
  decir(g.generados === 0 && (await una("select count(*)::int n from interno_envios where evento_id = $1", [ev])).n === 1, "correrlo otra vez no duplica");

  console.log("\nSeguimiento");
  const reg2 = (await una("select id from interno_automatizaciones where tipo = 'seguimiento'")).id;
  await c.query("update interno_automatizaciones set activa = true, plantilla_id = $1, hora_desde = 0, hora_hasta = 24, dias = '{0,1,2,3,4,5,6}' where id = $2", [pl, reg2]);
  await c.query(`insert into interno_wa_conversaciones (wa_id, nombre_perfil, consentimiento, ultimo_entrante_en, ultimo_mensaje_en, ultimo_direccion)
                 values ('5491100000092', 'Acepto Prueba', 'dado', now() - interval '5 days', now() - interval '4 days', 'saliente'),
                        ('5491100000093', 'Sin dato Prueba', 'sin_dato', now() - interval '5 days', now() - interval '4 days', 'saliente'),
                        ('5491100000094', 'Reciente Prueba', 'dado', now() - interval '2 days', now() - interval '1 day', 'saliente')`);
  await una("select interno_auto_generar() r");
  const seg = await todas("select destino_wa, estado, motivo from interno_envios where automatizacion_id = $1 order by destino_wa", [reg2]);
  decir(seg.find((s) => s.destino_wa === "5491100000092")?.estado === "por_aprobar", "a quien aceptó y no contestó hace 4 días, un seguimiento");
  decir(/No aceptó/.test(seg.find((s) => s.destino_wa === "5491100000093")?.motivo || ""), "a quien no aceptó recibir mensajes, no: queda omitido");
  decir(!seg.find((s) => s.destino_wa === "5491100000094"), "a quien le escribimos ayer, todavía no");

  console.log("\nLo que hace el navegador con la cola");
  await como(A);
  x = await intentar("update interno_envios set estado = 'enviado' where id = $1", [e1.id]);
  decir(x.e && /Solo se aprueba o se cancela/.test(x.e.message), "no puede marcar algo como enviado");
  x = await intentar("update interno_envios set destino_wa = '5491100000099' where id = $1", [e1.id]);
  decir(x.e && /permission denied/.test(x.e.message), "ni cambiar el destinatario");
  x = await intentar("update interno_envios set estado = 'aprobado' where id = $1 returning aprobado_por", [e1.id]);
  decir(!x.e && x.r.rows[0].aprobado_por === A, "aprueba, y queda quién");
  await como(C);
  decir((await todas("select id from interno_envios")).length === 0, "alguien del equipo sin 'mensajes' no ve la cola");

  console.log("\nMandar: la única puerta");
  await admin();
  let p = (await una("select interno_auto_preparar($1) r", [e1.id])).r;
  const e1b = await una("select estado, intentos, mensaje_id, conversacion_id from interno_envios where id = $1", [e1.id]);
  decir(p.listo && p.wa_id === "5491100000091" && p.plantilla === "recordatorio_prueba" && p.valores.length === 3, "prepara lo que el servidor le manda a Meta");
  decir(e1b.estado === "enviando" && e1b.intentos === 1 && e1b.mensaje_id && e1b.conversacion_id, "lo pasa a 'enviando', crea la conversación y el mensaje");
  const m1 = await una("select tipo, texto, estado from interno_wa_mensajes where id = $1", [e1b.mensaje_id]);
  decir(m1.tipo === "template" && /^Hola Rosario, te recordamos la demo del \S+ a las \d\d:\d\d\.$/.test(m1.texto), "el hilo muestra el texto tal como le llega");
  await c.query("select interno_auto_resultado($1, null, '{\"code\":130429}', true)", [e1.id]);
  let e1c = await una("select estado, proximo_intento from interno_envios where id = $1", [e1.id]);
  decir(e1c.estado === "aprobado" && e1c.proximo_intento > new Date(), "un error pasajero vuelve a la cola, para más tarde");
  p = (await una("select interno_auto_preparar($1) r", [e1.id])).r;
  await c.query("select interno_auto_resultado($1, 'wamid.prueba-auto-1', null, false)", [e1.id]);
  e1c = await una("select estado, intentos from interno_envios where id = $1", [e1.id]);
  decir(e1c.estado === "enviado" && e1c.intentos === 2, "al segundo intento sale");

  console.log("\nLos frenos");
  const otro = (await una("insert into interno_envios (automatizacion_id, plantilla_id, clave_unica, destino_wa, valores, estado) values ($1, $2, 'prueba:tope', '5491100000091', '{a,b,c}', 'aprobado') returning id", [reg, pl])).id;
  p = (await una("select interno_auto_preparar($1) r", [otro])).r;
  decir(!p.listo && p.omitido && /máximo de mensajes automáticos de hoy/.test(p.motivo), "a quien ya recibió uno hoy no le llega otro (tope por persona)");
  const e3 = (await una("select id from interno_envios where destino_wa = '5491100000092'")).id;
  await c.query("update interno_envios set estado = 'aprobado' where id = $1", [e3]);
  await c.query("update interno_wa_conversaciones set consentimiento = 'baja' where wa_id = '5491100000092'");
  p = (await una("select interno_auto_preparar($1) r", [e3])).r;
  decir(!p.listo && /Pidió que no le escriban/.test(p.motivo), "si pidió la baja después de generarse, no sale");
  const ev2 = (await una("insert into interno_eventos (titulo, tipo, prospecto_id, inicio, fin, estado) values ('Demo cancelada', 'demo', $1, now() + interval '2 hours', now() + interval '3 hours', 'programado') returning id", [p1])).id;
  const e4 = (await una("insert into interno_envios (automatizacion_id, plantilla_id, clave_unica, evento_id, destino_wa, valores, estado) values ($1, $2, 'prueba:cancelada', $3, '5491100000095', '{a,b,c}', 'aprobado') returning id", [reg, pl, ev2])).id;
  await c.query("update interno_eventos set estado = 'cancelado' where id = $1", [ev2]);
  p = (await una("select interno_auto_preparar($1) r", [e4])).r;
  decir(!p.listo && /ya pasó, se canceló/.test(p.motivo), "un recordatorio de una demo cancelada no sale");
  const e5 = (await una("insert into interno_envios (automatizacion_id, plantilla_id, clave_unica, destino_wa, valores, estado) values ($1, $2, 'prueba:horario', '5491100000096', '{a,b,c}', 'aprobado') returning id", [reg, pl])).id;
  const horaAR = Number((await una("select extract(hour from now() at time zone 'America/Argentina/Buenos_Aires')::int h")).h);
  await c.query("update interno_automatizaciones set hora_desde = $1, hora_hasta = $2 where id = $3", [horaAR >= 12 ? 0 : 13, horaAR >= 12 ? 1 : 24, reg]);
  p = (await una("select interno_auto_preparar($1) r", [e5])).r;
  decir(!p.listo && /Fuera del horario/.test(p.motivo) && (await una("select estado from interno_envios where id = $1", [e5])).estado === "aprobado",
    "fuera del horario de la regla no sale, pero queda aprobado para después");
  await c.query("update interno_automatizaciones set hora_desde = 0, hora_hasta = 24 where id = $1", [reg]);
  await c.query("update interno_envios set intentos = 3 where id = $1", [e5]);
  await c.query("update interno_envios set estado = 'enviando' where id = $1", [e5]);
  await c.query("select interno_auto_resultado($1, null, '{\"code\":131000}', true)", [e5]);
  decir((await una("select estado from interno_envios where id = $1", [e5])).estado === "fallido", "después de tres intentos no se reintenta más");

  console.log("\nAlertas internas");
  const p3 = (await una("insert into interno_prospectos (nombre, ultimo_contacto) values ('Quieto Prueba', now() - interval '10 days') returning id")).id;
  await una("select interno_auto_generar() r");
  const al = await una("select * from interno_alertas where enlace_id = $1", [p3]);
  decir(al && al.tipo === "oportunidad_quieta" && /hace 10 días/.test(al.detalle), "una oportunidad sin contacto hace 10 días genera una alerta");
  await una("select interno_auto_generar() r");
  decir((await una("select count(*)::int n from interno_alertas where enlace_id = $1", [p3])).n === 1, "y no se repite");
  await como(A);
  x = await intentar("update interno_alertas set descartada_en = now() where id = $1 returning descartada_por", [al.id]);
  decir(!x.e && x.r.rows[0].descartada_por === A, "se descarta, y queda quién");
  x = await intentar("update interno_alertas set titulo = 'otro' where id = $1", [al.id]);
  decir(x.e && /permission denied/.test(x.e.message), "no se le cambia el texto");

  console.log("\nEl reloj y sus llaves");
  await como(A);
  x = await intentar("select * from interno_auto_llaves");
  decir(x.e && /permission denied/.test(x.e.message), "las llaves no las ve nadie desde el navegador");
  x = await intentar("select interno_auto_disparar()");
  decir(x.e && /permission denied/.test(x.e.message), "ni puede disparar el reloj");
  await admin();
  await c.query("insert into interno_auto_llaves (llave) values ('llave-de-prueba'), ('llave-vieja')");
  await c.query("update interno_auto_llaves set creada_en = now() - interval '6 minutes' where llave = 'llave-vieja'");
  decir((await una("select interno_auto_usar_llave('llave-de-prueba') v")).v === true, "una llave nueva sirve");
  decir((await una("select interno_auto_usar_llave('llave-de-prueba') v")).v === false, "pero una sola vez");
  decir((await una("select interno_auto_usar_llave('llave-vieja') v")).v === false, "y una de hace más de 5 minutos no");
  decir((await una("select interno_auto_usar_llave('inventada') v")).v === false, "una inventada tampoco");
  const antes = (await una("select count(*)::int n from interno_auto_corridas")).n;
  await c.query("update interno_envios set estado = 'aprobado', intentos = 0 where id = $1", [otro]);
  await c.query("select interno_auto_disparar()");
  const corr = await una("select origen, error from interno_auto_corridas order by id desc limit 1");
  decir((await una("select count(*)::int n from interno_auto_corridas")).n === antes + 1 && corr.origen === "reloj" && !corr.error, "cada vuelta del reloj queda registrada");
  decir((await una("select count(*)::int n from interno_auto_llaves where llave <> 'llave-vieja'")).n === 1, "y si hay algo para mandar, deja una llave para el servidor");
} catch (e) {
  fallas++;
  console.error("\nSe cortó:", e.message);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. (Se deshizo todo, también el reloj.)");
process.exit(fallas ? 1 : 0);
