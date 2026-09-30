/* ============================================================
   PRUEBA · el CRM y la agenda de Founder (0114)
   ============================================================

   En una transacción que se deshace, como el fundador (las políticas de
   verdad, no como administrador). Si 0114 no está aplicada, la aplica
   adentro. La frontera (quién ve qué) la prueba
   probar-founder-seguridad.mjs, que recorre también estas tablas.

     node scripts/probar-founder-crm.mjs
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

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  /* Si la prueba se corta a mitad de camino, el pooler puede dejar la sesión
     abierta y con sus bloqueos: la base la cierra sola (y la deshace). */
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_prospectos') t")).t) {
    await c.query(readFileSync("supabase/migrations/0114_interno_crm.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  await como(A);

  console.log("\nTeléfonos: el número nacional de diez");
  const tels = (await una(`select interno_norm_tel('011 15-4444-5555') a, interno_norm_tel('+54 9 11 4444-5555') b, interno_norm_tel('11 4444 5555') c,
    interno_norm_tel('0221 15 444-5555') d, interno_norm_tel('+54 221 444 5555') e, interno_norm_tel('4750-1234') f, interno_norm_tel('12') g`));
  decir(tels.a === "1144445555" && tels.b === "1144445555" && tels.c === "1144445555", "011 15, +54 9 y sin prefijos: el mismo celular");
  decir(tels.d === "2214445555" && tels.e === "2214445555", "con característica de tres cifras, también");
  decir(tels.f === "47501234" && tels.g === null, "sin característica quedan los ocho; con dos dígitos no es un teléfono");

  console.log("\nUn prospecto nuevo");
  const p = await una(`insert into interno_prospectos (nombre, localidad, zona, rubro, telefono, email, fuente)
    values ('Almacén Don Pepe', 'Caseros', 'caseros', 'almacen', '+54 9 11 5555-1234', 'Pepe@Mail.com ', 'visita') returning *`);
  decir(p.tel_norm === "1155551234" && p.email_norm === "pepe@mail.com" && p.nombre_norm === "almacendonpepe", "guarda teléfono, mail y nombre normalizados");
  decir(p.responsable_id === A && p.creado_por === A, "el responsable y el autor los pone la base");
  const op = await una("select o.*, e.nombre etapa from interno_oportunidades o join interno_etapas e on e.id = o.etapa_id where prospecto_id = $1", [p.id]);
  decir(op && op.etapa === "Nuevo" && op.estado === "abierta" && op.probabilidad === 5, "nace con su oportunidad, en la primera etapa");
  const v = await una("select etapa_nombre, oportunidad_id from interno_prospectos_vista where id = $1", [p.id]);
  decir(v.etapa_nombre === "Nuevo" && v.oportunidad_id === op.id, "la vista lo muestra con su etapa");

  console.log("\nDuplicados");
  const d1 = (await c.query("select * from interno_posibles_duplicados('Otro nombre', null, '11 5555 1234', null)")).rows;
  decir(d1.length === 1 && d1[0].motivo === "teléfono", "el mismo teléfono escrito distinto: lo encuentra");
  const d2 = (await c.query("select * from interno_posibles_duplicados('x', null, null, 'pepe@mail.com')")).rows;
  decir(d2.length === 1 && d2[0].motivo === "email", "el mismo mail: lo encuentra");
  const d3 = (await c.query("select * from interno_posibles_duplicados('almacén don pepe', 'CASEROS', null, null)")).rows;
  decir(d3.length === 1 && d3[0].motivo === "nombre y localidad", "el mismo nombre en la misma localidad, con otras mayúsculas y tildes: lo encuentra");
  const d4 = (await c.query("select * from interno_posibles_duplicados('Almacén Don Pepe', 'Villa Bosch', null, null)")).rows;
  decir(d4.length === 0, "el mismo nombre en otra localidad: no es duplicado");
  const d5 = (await c.query("select * from interno_posibles_duplicados('Almacén Don Pepe', 'Caseros', null, null, $1)", [p.id])).rows;
  decir(d5.length === 0, "al editarlo, no se encuentra a sí mismo");

  console.log("\nLa línea de tiempo");
  await c.query(`insert into interno_actividades (prospecto_id, oportunidad_id, tipo, fecha, resultado, proxima_accion, proxima_fecha)
    values ($1, $2, 'visita', now() - interval '1 hour', 'Lo atendió el dueño, interesado', 'Mandar demo', now() + interval '2 days')`, [p.id, op.id]);
  const p2 = await una("select ultimo_contacto, proximo_contacto, proxima_accion from interno_prospectos where id = $1", [p.id]);
  decir(p2.ultimo_contacto && p2.proxima_accion === "Mandar demo" && p2.proximo_contacto > new Date(), "una visita actualiza el último contacto y el próximo paso");
  decir((await una("select proxima_accion from interno_oportunidades where id = $1", [op.id])).proxima_accion === "Mandar demo", "y el de la oportunidad");
  await c.query("insert into interno_actividades (prospecto_id, tipo, notas) values ($1, 'nota', 'Cierra los lunes')", [p.id]);
  decir((await una("select proxima_accion from interno_prospectos where id = $1", [p.id])).proxima_accion === "Mandar demo", "una nota interna no pisa el seguimiento");

  console.log("\nEl pipeline");
  const demo = (await una("select id from interno_etapas where nombre = 'Demo agendada'")).id;
  await c.query("update interno_oportunidades set etapa_id = $2, valor = 34000 where id = $1", [op.id, demo]);
  const op2 = await una("select probabilidad, estado from interno_oportunidades where id = $1", [op.id]);
  decir(op2.probabilidad === 45 && op2.estado === "abierta", "moverla a Demo agendada toma su probabilidad (45%)");
  const cam = await una("select resultado, datos from interno_actividades where oportunidad_id = $1 and tipo = 'cambio_etapa'", [op.id]);
  decir(cam && cam.resultado === "Nuevo → Demo agendada", "y el cambio queda en la línea de tiempo: Nuevo → Demo agendada");
  const perdido = (await una("select id from interno_etapas where tipo = 'perdida'")).id;
  await c.query("update interno_oportunidades set etapa_id = $2, motivo_perdida = 'precio' where id = $1", [op.id, perdido]);
  const op3 = await una("select estado, cerrada_en, motivo_perdida from interno_oportunidades where id = $1", [op.id]);
  decir(op3.estado === "perdida" && op3.cerrada_en && op3.motivo_perdida === "precio", "perdida: se cierra con su motivo");
  const ganado = (await una("select id from interno_etapas where tipo = 'ganada'")).id;
  await c.query("update interno_oportunidades set etapa_id = $2 where id = $1", [op.id, ganado]);
  const op4 = await una("select estado, ganada_en, motivo_perdida from interno_oportunidades where id = $1", [op.id]);
  decir(op4.estado === "ganada" && op4.ganada_en && op4.motivo_perdida === null, "reabierta y ganada: queda ganada y sin el motivo de pérdida");
  decir((await una("select count(*)::int n from interno_actividades where oportunidad_id = $1 and tipo = 'cambio_etapa'", [op.id])).n === 3, "tres cambios, tres entradas");
  const h = await una("select count(*)::int n from interno_historial where tabla = 'interno_oportunidades' and fila_id = $1", [op.id]);
  decir(h.n >= 4, "y el historial tiene el alta y cada cambio");

  console.log("\nTareas");
  const t = await una(`insert into interno_tareas (titulo, prioridad, vence, prospecto_id, repeticion, checklist)
    values ('Llamar a Don Pepe', 'alta', '2026-10-01 10:00-03', $1, '{"cada":"semana","intervalo":1}', '[{"texto":"Preparar precios","hecho":true}]') returning *`, [p.id]);
  decir(t.serie_id === t.id && t.responsable_id === A, "una tarea que se repite arranca su serie");
  await c.query("update interno_tareas set estado = 'completada' where id = $1", [t.id]);
  const serie = (await c.query("select vence, estado, checklist from interno_tareas where serie_id = $1 order by vence", [t.id])).rows;
  decir(serie.length === 2 && serie[1].estado === "pendiente" && new Date(serie[1].vence) - new Date(serie[0].vence) === 7 * 86400000,
    "completarla crea la de la semana siguiente");
  decir(serie[1].checklist[0].hecho === false, "con el checklist sin tildar");
  await c.query("update interno_tareas set estado = 'pendiente' where id = $1", [t.id]);
  await c.query("update interno_tareas set estado = 'completada' where id = $1", [t.id]);
  decir((await una("select count(*)::int n from interno_tareas where serie_id = $1", [t.id])).n === 2, "completarla de nuevo no crea otra copia");
  decir((await una("select completada_en from interno_tareas where id = $1", [t.id])).completada_en !== null, "y queda con su fecha de completada");
  let x = await intentar("insert into interno_tareas (titulo, estado) values ('x', 'hecha')");
  decir(x.e && /interno_tareas_estado/.test(x.e.message), "un estado que no existe: no");

  console.log("\nAgenda");
  x = await intentar("insert into interno_eventos (titulo, inicio, fin) values ('Demo', now(), now() - interval '1 hour')");
  decir(x.e && /interno_eventos_fechas/.test(x.e.message), "un evento que termina antes de empezar: no");
  x = await intentar("insert into interno_eventos (titulo, inicio, fin, link) values ('Demo', now(), now(), 'javascript:alert(1)')");
  decir(x.e && /interno_eventos_link/.test(x.e.message), "un link que no es http: no");
  const ev = await una("insert into interno_eventos (titulo, tipo, inicio, fin, prospecto_id) values ('Demo Don Pepe', 'demo', now() - interval '2 hours', now() - interval '1 hour', $1) returning estado, responsable_id", [p.id]);
  decir(ev.estado === "programado" && ev.responsable_id === A, "un evento que ya pasó sigue programado: realizado es cuando se registra el resultado");

  console.log("\nLas áreas");
  x = await intentar("delete from interno_prospectos where id = $1", [p.id]);
  decir(x.e && /permission denied/.test(x.e.message), "un prospecto no se borra: se archiva");
  await c.query("reset role");
  const D = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' limit 1")).id;
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'comercial', array['crm'])", [D]);
  await como(D);
  decir(Number((await una("select count(*) n from interno_prospectos")).n) >= 1, "un miembro de crm ve los prospectos");
  decir(Number((await una("select count(*) n from interno_tareas")).n) === 0 && Number((await una("select count(*) n from interno_eventos")).n) === 0,
    "pero no las tareas ni la agenda, que son otras áreas");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
