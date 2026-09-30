/* ============================================================
   PRUEBA · producto y documentación de Founder (0116)
   ============================================================

   En una transacción que se deshace, como el fundador y como miembros
   con una sola área (las políticas de verdad). Si 0116 no está
   aplicada, la aplica adentro.

     node scripts/probar-founder-producto.mjs
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

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  /* Si la prueba se corta a mitad de camino, el pooler puede dejar la sesión
     abierta y con sus bloqueos: la base la cierra sola (y la deshace). */
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_roadmap') t")).t) {
    await c.query(readFileSync("supabase/migrations/0116_interno_producto.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1")).id;
  const D = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' limit 1")).id;
  await como(A);

  console.log("\nProyectos y versiones");
  const pr = await una("insert into interno_proyectos (nombre, objetivo, categoria, inicio, fin_estimado) values ('App del cliente 2', 'Reservas online', 'producto', '2026-10-01', '2026-11-15') returning *");
  decir(pr.estado === "idea" && pr.creado_por === A, "un proyecto nace como idea, con su autor");
  let x = await intentar("update interno_proyectos set fin_estimado = '2026-09-01' where id = $1", [pr.id]);
  decir(x.e && /interno_proyectos_fechas/.test(x.e.message), "no termina antes de empezar");
  await c.query("update interno_proyectos set estado = 'completado' where id = $1", [pr.id]);
  decir((await una("select completado_en from interno_proyectos where id = $1", [pr.id])).completado_en !== null, "completado: la fecha la pone la base");
  await c.query("update interno_proyectos set estado = 'en_curso' where id = $1", [pr.id]);
  decir((await una("select completado_en from interno_proyectos where id = $1", [pr.id])).completado_en === null, "reabierto: la fecha se borra");
  const v = await una("insert into interno_versiones (nombre, fecha_objetivo) values ('prueba-1.0', '2026-10-15') returning *");
  await c.query("update interno_versiones set estado = 'lanzada' where id = $1", [v.id]);
  decir((await una("select lanzada_en from interno_versiones where id = $1", [v.id])).lanzada_en !== null, "una versión lanzada queda con su fecha");

  console.log("\nEl roadmap");
  const r = await una("insert into interno_roadmap (tipo, titulo, modulo, proyecto_id, version_id, impacto, complejidad) values ('funcionalidad', 'Reservar mesa desde la app', 'comandas', $1, $2, 'alto', 'grande') returning *", [pr.id, v.id]);
  decir(r.estado === "idea" && r.terminado_en === null, "un elemento nace como idea");
  x = await intentar("insert into interno_roadmap (tipo, titulo) values ('tarea', 'x')");
  decir(x.e && /interno_roadmap_tipo/.test(x.e.message), "un tipo que no existe: no");
  await c.query("update interno_roadmap set estado = 'lanzado' where id = $1", [r.id]);
  decir((await una("select terminado_en from interno_roadmap where id = $1", [r.id])).terminado_en !== null, "lanzado: queda con fecha");
  await c.query("insert into interno_tareas (titulo, proyecto_id, roadmap_id) values ('Diseñar la pantalla', $1, $2)", [pr.id, r.id]);
  const pv = await una("select tareas_total, elementos, elementos_terminados from interno_proyectos_vista where id = $1", [pr.id]);
  decir(pv.tareas_total === 1 && pv.elementos === 1 && pv.elementos_terminados === 1, "el proyecto cuenta sus tareas y sus elementos");
  const rv = await una("select version_nombre, proyecto_nombre, tareas_abiertas from interno_roadmap_vista where id = $1", [r.id]);
  decir(rv.version_nombre === "prueba-1.0" && rv.proyecto_nombre === "App del cliente 2" && rv.tareas_abiertas === 1, "la vista trae versión, proyecto y tareas");

  console.log("\nDe un ticket a producto");
  const t1 = await una("insert into interno_tickets (titulo, descripcion, pasos, modulo, categoria, gravedad) values ('No imprime la comanda', 'Desde ayer', '1. Abrir mesa', 'comandas', 'error', 'grave') returning id");
  const bug = (await una("select interno_ticket_a_producto($1) id", [t1.id])).id;
  const b = await una("select * from interno_roadmap_vista where id = $1", [bug]);
  decir(b.tipo === "bug" && b.pasos === "1. Abrir mesa" && b.gravedad === "grave" && b.tickets === 1, "un ticket de error pasa como bug, con sus pasos y su gravedad, y atado al ticket");
  const t2 = await una("insert into interno_tickets (titulo, categoria) values ('Quieren poder reservar', 'pedido') returning id");
  const sol = (await una("select interno_ticket_a_producto($1) id", [t2.id])).id;
  decir((await una("select tipo, gravedad from interno_roadmap where id = $1", [sol])).tipo === "solicitud", "un pedido pasa como solicitud");
  await c.query("insert into interno_roadmap_tickets (roadmap_id, ticket_id) values ($1, $2)", [r.id, t2.id]);
  decir((await una("select tickets from interno_roadmap_vista where id = $1", [r.id])).tickets === 1, "un ticket se suma a un elemento que ya existía");
  x = await intentar("delete from interno_roadmap_tickets where roadmap_id = $1 and ticket_id = $2", [r.id, t2.id]);
  decir(!x.e && x.r.rowCount === 1, "y se puede desatar (es un vínculo, no historia)");
  x = await intentar("delete from interno_roadmap where id = $1", [r.id]);
  decir(x.e && /permission denied/.test(x.e.message), "un elemento del roadmap no se borra");

  console.log("\nDocumentos");
  const d = await una("insert into interno_documentos (titulo, tipo, contenido, etiquetas) values ('Cómo calibrar la térmica', 'procedimiento', 'Abrir **Ajustes** y elegir 58 mm. La impresora imprime de a 32 caracteres.', array['impresion','soporte']) returning *");
  decir(d.version === 1 && d.estado === "borrador" && d.creado_por === A, "nace en la versión 1, como borrador, con su autor");
  decir((await todas("select id from interno_documentos where busqueda @@ websearch_to_tsquery('spanish', 'impresoras')")).some((z) => z.id === d.id), "se encuentra por el contenido, aunque se busque en plural");
  decir((await todas("select id from interno_documentos where busqueda @@ websearch_to_tsquery('spanish', 'soporte')")).some((z) => z.id === d.id), "y por las etiquetas");
  await c.query("update interno_documentos set contenido = contenido || ' Probar con un ticket.' where id = $1", [d.id]);
  await c.query("update interno_documentos set estado = 'vigente' where id = $1", [d.id]);
  const d2 = await una("select version from interno_documentos where id = $1", [d.id]);
  const vs = await todas("select version, contenido from interno_documentos_versiones where documento_id = $1 order by version", [d.id]);
  decir(d2.version === 2 && vs.length === 1 && vs[0].version === 1 && !vs[0].contenido.includes("Probar"), "cambiar el contenido guarda la versión anterior; cambiar el estado no crea otra");
  x = await intentar("insert into interno_documentos_versiones (documento_id, version, titulo, contenido) values ($1, 9, 'falso', 'x')", [d.id]);
  decir(x.e && /permission denied/.test(x.e.message), "nadie escribe versiones a mano");
  x = await intentar("insert into interno_documentos (titulo, contenido) values ('grande', repeat('x', 200001))");
  decir(x.e && /interno_documentos_largo/.test(x.e.message), "un documento gigante no entra: lo pesado va a Storage");
  decir(!(await todas("select column_name from information_schema.columns where table_name = 'interno_documentos'")).some((z) => /publi/.test(z.column_name)),
    "no hay ninguna columna que lo vuelva público");

  console.log("\nLas áreas");
  await c.query("reset role");
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'desarrollo', array['producto'])", [D]);
  await como(D);
  decir((await una("select count(*)::int n from interno_roadmap")).n >= 1, "un miembro de producto ve el roadmap");
  decir((await una("select count(*)::int n from interno_documentos")).n === 0, "pero no los documentos");
  decir((await una("select count(*)::int n from interno_tickets")).n === 0, "ni los tickets");
  x = await intentar("select interno_ticket_a_producto($1)", [t1.id]);
  decir(x.e && /No existe el ticket/.test(x.e.message), "y sin soporte no puede pasar un ticket a producto");
  await como(C);
  decir((await una("select count(*)::int n from interno_roadmap")).n === 0 && (await una("select count(*)::int n from interno_documentos")).n === 0
    && (await una("select count(*)::int n from interno_documentos_versiones")).n === 0, "el dueño de un comercio no ve nada de esto");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
