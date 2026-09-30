/* ============================================================
   PRUEBA · objetivos y marketing de Founder (0117)
   ============================================================

   En una transacción que se deshace, como el fundador y como miembros
   con una sola área. Si 0117 no está aplicada, la aplica adentro. Los
   objetivos se prueban con fechas de 2031, donde no hay nada real: todo
   lo que cuentan es lo que la prueba crea.

     node scripts/probar-founder-marketing.mjs
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
const valor = async (m, a = "2031-03-01", b = "2031-03-31") => Number((await una("select interno_objetivo_valor($1, $2, $3) v", [m, a, b])).v);

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  /* Si la prueba se corta a mitad de camino, el pooler puede dejar la sesión
     abierta y con sus bloqueos: la base la cierra sola (y la deshace). */
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_objetivos') t")).t) {
    await c.query(readFileSync("supabase/migrations/0117_interno_marketing.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1")).id;
  const D = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' limit 1")).id;
  const ganada = (await una("select id from interno_etapas where tipo = 'ganada' order by orden limit 1")).id;
  await como(A);

  console.log("\nEl valor sale de los registros");
  decir(await valor("prospectos") === 0 && await valor("ventas") === 0, "en un mes sin nada, todo da cero");
  /* Creado el 1/3 a las 00:30 de Buenos Aires: en UTC todavía es 28/2, y tiene que contar en marzo. */
  const p = await una("insert into interno_prospectos (nombre) values ('Prospecto de marzo') returning id");
  await c.query("reset role");
  await c.query("update interno_prospectos set creado_en = '2031-03-01 00:30-03' where id = $1", [p.id]);
  await como(A);
  decir(await valor("prospectos") === 1, "un prospecto creado a las 00:30 del 1/3 cuenta en marzo (el día es el de Buenos Aires)");
  decir(await valor("prospectos", "2031-02-01", "2031-02-28") === 0, "y no en febrero, aunque en UTC fuera 28/2");
  await c.query("insert into interno_actividades (prospecto_id, tipo, fecha, resultado) values ($1, 'llamada', '2031-03-05 10:00-03', 'x'), ($1, 'demo', '2031-03-06 10:00-03', 'x'), ($1, 'nota', '2031-03-07 10:00-03', 'x')", [p.id]);
  decir(await valor("contactos") === 2 && await valor("demos") === 1, "contactos cuenta llamadas y demos, no notas; demos, solo demos");
  const op = await una("select id from interno_oportunidades where prospecto_id = $1", [p.id]);
  await c.query("update interno_oportunidades set etapa_id = $1, valor = 40000 where id = $2", [ganada, op.id]);
  await c.query("reset role");
  await c.query("update interno_oportunidades set ganada_en = '2031-03-10 12:00-03' where id = $1", [op.id]);
  await como(A);
  decir(await valor("ventas") === 1, "una venta ganada en el período cuenta");
  await c.query("select interno_convertir_en_cliente($1, jsonb_build_object('alta', '2031-03-10', 'importe_mensual', 40000))", [op.id]);
  decir(await valor("recurrente") === 40000 && await valor("clientes", "2031-01-01", "2031-03-31") >= 1, "el recurrente nuevo y los clientes vigentes con importe");

  console.log("\nObjetivos");
  const o = await una("insert into interno_objetivos (nombre, metrica, valor_objetivo, periodo, inicio, limite) values ('Demos de marzo', 'demos', 4, 'mensual', '2031-03-01', '2031-03-31') returning id");
  const ov = await una("select valor_actual from interno_objetivos_vista where id = $1", [o.id]);
  decir(Number(ov.valor_actual) === 1, "el objetivo muestra el valor real (1 de 4)");
  let x = await intentar("update interno_objetivos set valor_manual = 4 where id = $1", [o.id]);
  decir(x.e && /interno_objetivos_manual/.test(x.e.message), "y no se puede pisar a mano");
  const om = await una("insert into interno_objetivos (nombre, metrica, valor_objetivo, valor_manual, inicio, limite) values ('Seguidores', 'manual', 1000, 350, '2031-03-01', '2031-03-31') returning id");
  decir(Number((await una("select valor_actual from interno_objetivos_vista where id = $1", [om.id])).valor_actual) === 350, "la métrica manual muestra lo cargado");
  x = await intentar("insert into interno_objetivos (nombre, metrica, valor_objetivo, inicio, limite) values ('x', 'demos', 3, '2031-03-10', '2031-03-01')");
  decir(x.e && /interno_objetivos_fechas/.test(x.e.message), "no termina antes de empezar");
  const plan = await una("insert into interno_planes (nombre, inicio, fin) values ('Plan de prueba', '2031-03-01', '2031-03-30') returning id");
  await c.query("insert into interno_objetivos (nombre, metrica, valor_objetivo, periodo, inicio, limite, plan_id, semana) values ('Semana 1', 'contactos', 20, 'semanal', '2031-03-01', '2031-03-07', $1, 1)", [plan.id]);
  await c.query("insert into interno_tareas (titulo, objetivo_id) values ('Recorrer Caseros', (select id from interno_objetivos where plan_id = $1))", [plan.id]);
  const sem = await una("select valor_actual, tareas_total from interno_objetivos_vista where plan_id = $1", [plan.id]);
  decir(Number(sem.valor_actual) === 2 && sem.tareas_total === 1, "la meta de una semana cuenta solo esa semana, y tiene su tarea");

  console.log("\nContenidos");
  const k = await una("insert into interno_contenidos (titulo, canal, formato, gancho, cta) values ('Cómo cerrar la caja en 2 minutos', 'instagram', 'reel', '¿Cerrás la caja a mano?', 'Pedí una demo') returning *");
  decir(k.estado === "idea" && k.publicado_en === null, "nace como idea en el banco");
  x = await intentar("update interno_contenidos set url = 'javascript:alert(1)' where id = $1", [k.id]);
  decir(x.e && /interno_contenidos_url/.test(x.e.message), "el link publicado solo puede ser http o https");
  await c.query("update interno_contenidos set estado = 'publicado', url = 'https://instagram.com/p/x' where id = $1", [k.id]);
  decir((await una("select publicado_en from interno_contenidos where id = $1", [k.id])).publicado_en !== null, "publicado: la fecha la pone la base");
  await c.query("insert into interno_contenido_metricas (contenido_id, momento, visualizaciones, interacciones, consultas) values ($1, '7d', 1200, 80, 3)", [k.id]);
  x = await intentar("insert into interno_contenido_metricas (contenido_id, momento, visualizaciones) values ($1, '7d', 5)", [k.id]);
  decir(x.e && /interno_contenido_metricas_una/.test(x.e.message), "una sola medición de 7 días por contenido");
  x = await intentar("insert into interno_contenido_metricas (contenido_id, momento, visualizaciones) values ($1, '30d', -5)", [k.id]);
  decir(x.e && /positivas/.test(x.e.message), "sin números negativos");
  await c.query("update interno_prospectos set contenido_id = $1 where id = $2", [k.id, p.id]);
  const kv = await una("select vis_semana, prospectos_originados, demos_originadas, clientes_originados from interno_contenidos_vista where id = $1", [k.id]);
  decir(kv.vis_semana === 1200 && kv.prospectos_originados === 1 && kv.demos_originadas === 1 && kv.clientes_originados === 1,
    "el contenido muestra sus métricas cargadas y lo que originó: 1 prospecto, 1 demo, 1 cliente");
  const g = await una("insert into interno_grabaciones (tema, fecha) values ('Grabación de prueba', '2031-03-02 15:00-03') returning id");
  await c.query("update interno_contenidos set grabacion_id = $1 where id = $2", [g.id, k.id]);
  decir((await una("select grabacion_tema from interno_contenidos_vista where id = $1", [k.id])).grabacion_tema === "Grabación de prueba", "una publicación sale de una grabación");
  x = await intentar("insert into storage.objects (bucket_id, name) values ('interno', 'marketing/prueba/guion.pdf')");
  decir(!x.e, "los archivos de marketing van a su carpeta");
  x = await intentar("delete from interno_contenidos where id = $1", [k.id]);
  decir(x.e && /permission denied/.test(x.e.message), "un contenido no se borra");

  console.log("\nLas áreas");
  await c.query("reset role");
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'marketing', array['marketing'])", [D]);
  await como(D);
  decir((await una("select count(*)::int n from interno_contenidos")).n >= 1, "un miembro de marketing ve los contenidos");
  decir((await una("select count(*)::int n from interno_objetivos")).n === 0, "pero no los objetivos comerciales");
  decir((await una("select prospectos_originados from interno_contenidos_vista where id = $1", [k.id])).prospectos_originados === 0,
    "ni los prospectos: lo originado le da cero, no los nombres");
  x = await intentar("insert into storage.objects (bucket_id, name) values ('interno', 'marketing/prueba/otro.png')");
  decir(!x.e, "y sube a la carpeta de marketing");
  x = await intentar("insert into storage.objects (bucket_id, name) values ('interno', 'docs/prueba/otro.png')");
  decir(x.e && /row-level security/.test(x.e.message), "pero no a la de documentos");
  await como(C);
  decir((await una("select count(*)::int n from interno_contenidos")).n === 0 && (await una("select count(*)::int n from interno_objetivos_vista")).n === 0,
    "el dueño de un comercio no ve nada de esto");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
