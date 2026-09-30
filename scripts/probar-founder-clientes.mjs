/* ============================================================
   PRUEBA · clientes, implementación y soporte de Founder (0115)
   ============================================================

   En una transacción que se deshace, como el fundador y como otros
   perfiles (las políticas de verdad, no como administrador). Si 0115 no
   está aplicada, la aplica adentro. El comercio que se usa para "cliente
   desde un comercio" es Super 25 Pruebas, la réplica: nunca Super 25.

     node scripts/probar-founder-clientes.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

const REPLICA = "770464ba-4eaa-4062-a317-d36830d28049";   // Super 25 Pruebas
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
  if (!u) { await c.query("set local role anon"); await c.query("select set_config('request.jwt.claims', '{\"role\":\"anon\"}', true)"); return; }
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u, role: "authenticated" })]);
};

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  /* Si la prueba se corta a mitad de camino, el pooler puede dejar la sesión
     abierta y con sus bloqueos: la base la cierra sola (y la deshace). */
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_clientes') t")).t) {
    await c.query(readFileSync("supabase/migrations/0115_interno_clientes.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1")).id;
  const D = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' limit 1")).id;
  const ganada = (await una("select id from interno_etapas where tipo = 'ganada' order by orden limit 1")).id;
  await como(A);

  console.log("\nPasar a cliente una oportunidad ganada");
  const p = await una("insert into interno_prospectos (nombre, localidad, rubro) values ('Pilates de prueba', 'Caseros', 'pilates_gimnasio') returning id");
  const op = await una("select id from interno_oportunidades where prospecto_id = $1", [p.id]);
  let x = await intentar("select interno_convertir_en_cliente($1, '{}')", [op.id]);
  decir(x.e && /ganada/.test(x.e.message), "una oportunidad abierta no pasa a cliente");
  await c.query("update interno_oportunidades set etapa_id = $1, valor = 50000 where id = $2", [ganada, op.id]);
  const cid = (await una(`select interno_convertir_en_cliente($1, jsonb_build_object('plan', 'Pro', 'alta', '2026-10-01', 'renovacion', '2027-10-01')) id`, [op.id])).id;
  const cl = await una("select * from interno_clientes where id = $1", [cid]);
  decir(cl.estado === "implementacion" && Number(cl.importe_mensual) === 50000 && cl.plan === "Pro" && cl.responsable_id === A,
    "nace en implementación, con el valor de la oportunidad como importe y quien convierte como responsable");
  decir((await una("select cliente_desde from interno_prospectos where id = $1", [p.id])).cliente_desde !== null, "el prospecto queda marcado como cliente, sin copiar sus datos");
  const etapas = await todas("select etapa, estado, pasos from interno_impl_etapas where cliente_id = $1 order by orden", [cid]);
  decir(etapas.length === 10 && etapas[0].etapa === "venta_confirmada" && etapas[0].estado === "hecha", "diez etapas, y la venta confirmada ya hecha");
  const titulos = etapas.flatMap((e) => e.pasos.map((s) => s.titulo));
  decir(!titulos.includes("Stock inicial") && !titulos.includes("Catálogo de productos con precio") && titulos.includes("Un usuario por persona, con su rol"),
    "sin comercio vinculado no se le piden pasos de módulos: a un pilates no le toca el stock");
  const tareas = await todas("select titulo, vence from interno_tareas where prospecto_id = $1 order by vence", [p.id]);
  decir(tareas.length === 4 && tareas[0].titulo === "Primer seguimiento después del alta" && tareas[3].titulo.startsWith("Renovación"),
    `los recordatorios de seguimiento: ${tareas.map((t) => t.titulo).join(" / ")}`);
  x = await intentar("select interno_convertir_en_cliente($1, '{}')", [op.id]);
  decir(x.e && /Ya es cliente/.test(x.e.message), "no se convierte dos veces");

  console.log("\nUn comercio que ya era cliente");
  const libres0 = await todas("select id from interno_comercios_libres()");
  decir(libres0.some((r) => r.id === REPLICA), "Super 25 Pruebas aparece entre los comercios sin cliente");
  const cid2 = (await una("select interno_cliente_desde_comercio($1, jsonb_build_object('importe_mensual', 34000)) id", [REPLICA])).id;
  const cl2 = await una("select c.*, p.nombre, p.rubro from interno_clientes c join interno_prospectos p on p.id = c.prospecto_id where c.id = $1", [cid2]);
  decir(cl2.empresa_id === REPLICA && cl2.nombre === "Super 25 Pruebas" && cl2.rubro === "almacen" && Number(cl2.importe_mensual) === 34000, "se crea con el nombre y el rubro del comercio");
  const cam = await una("select resultado from interno_actividades where prospecto_id = $1 and tipo = 'cambio_etapa'", [cl2.prospecto_id]);
  decir(cam && /Ganado/.test(cam.resultado), `y su oportunidad ganada queda en la línea de tiempo: ${cam && cam.resultado}`);
  const t2 = (await todas("select pasos from interno_impl_etapas where cliente_id = $1", [cid2])).flatMap((e) => e.pasos.map((s) => s.titulo));
  /* Los módulos de la réplica cambian cuando Nehuen prueba: lo esperado se
     arma con los que tiene hoy, no con una lista fija. */
  const modulosReplica = (await una("select modulos from empresas where id = $1", [REPLICA])).modulos;
  const conModulos = await todas("select titulo, modulos from interno_impl_modelo where activo and cardinality(modulos) > 0 and cardinality(rubros) = 0");
  const bien = conModulos.every((m) => t2.includes(m.titulo) === m.modulos.some((x) => modulosReplica.includes(x)));
  decir(bien && conModulos.some((m) => !m.modulos.some((x) => modulosReplica.includes(x))),
    `sus pasos salen de los módulos del comercio (${modulosReplica.join(", ")}): cada paso con módulos está si y solo si tiene alguno`);
  x = await intentar("select interno_cliente_desde_comercio($1, '{}')", [REPLICA]);
  decir(x.e && /ya es cliente/.test(x.e.message), "un comercio tiene un solo cliente");
  decir(!(await todas("select id from interno_comercios_libres()")).some((r) => r.id === REPLICA), "y ya no aparece entre los libres");
  const com = (await una("select interno_comercio($1) j", [REPLICA])).j;
  decir(com && Array.isArray(com.modulos) && JSON.stringify(com.modulos) === JSON.stringify(modulosReplica) && Array.isArray(com.sucursales) && !("config" in com),
    "la ficha lee del comercio los módulos y las sucursales, y nada más (ni la configuración)");

  console.log("\nEl modelo de implementación");
  decir((await una("select interno_impl_armar($1) n", [cid2])).n === 0, "volver a armar no duplica pasos");
  await c.query("insert into interno_impl_modelo (etapa, titulo, modulos) values ('capacitacion', 'Paso nuevo de prueba', $1)", [[modulosReplica[0]]]);
  decir((await una("select interno_impl_armar($1) n", [cid2])).n === 1, "un paso nuevo del modelo se suma a quien le corresponde");
  decir((await una("select interno_impl_armar($1) n", [cid])).n === 0, "y no a quien no tiene ese módulo");

  x = await intentar("update interno_impl_etapas set estado = 'bloqueada' where cliente_id = $1 and etapa = 'pruebas'", [cid]);
  decir(x.e && /bloqueo/.test(x.e.message), "una etapa bloqueada tiene que decir qué la bloquea");
  await c.query("update interno_impl_etapas set estado = 'no_aplica' where cliente_id = $1 and etapa = 'carga_datos'", [cid]);
  await c.query("update interno_impl_etapas set estado = 'hecha' where cliente_id = $1 and estado = 'pendiente' and etapa <> 'completada'", [cid]);
  decir((await una("select estado from interno_clientes where id = $1", [cid])).estado === "implementacion", "con una etapa pendiente sigue en implementación");
  await c.query("update interno_impl_etapas set estado = 'hecha' where cliente_id = $1 and etapa = 'completada'", [cid]);
  decir((await una("select estado from interno_clientes where id = $1", [cid])).estado === "activo", "con todo hecho o sin aplicar, pasa a activo solo");

  console.log("\nSoporte");
  const t = await una(`insert into interno_tickets (cliente_id, titulo, descripcion, modulo, prioridad) values ($1, 'La impresora no saca el ticket', 'Sale en blanco desde ayer', 'impresion', 'alta') returning *`, [cid]);
  decir(Number(t.numero) > 0 && t.estado === "nuevo" && t.creado_por === A, `numerado (#${t.numero}), nuevo y con su autor`);
  const v = await una("select tickets_abiertos, tickets_urgentes from interno_clientes_vista where id = $1", [cid]);
  decir(v.tickets_abiertos === 1 && v.tickets_urgentes === 1, "la ficha del cliente lo cuenta como abierto y urgente");
  x = await intentar("update interno_tickets set estado = 'resuelto' where id = $1", [t.id]);
  decir(x.e && /interno_tickets_solucion/.test(x.e.message), "no se resuelve sin decir cómo");
  await c.query("update interno_tickets set estado = 'resuelto', solucion = 'Papel térmico al revés' where id = $1", [t.id]);
  decir((await una("select resuelto_en from interno_tickets where id = $1", [t.id])).resuelto_en !== null, "resuelto: la fecha la pone la base");
  await c.query("update interno_tickets set estado = 'en_curso' where id = $1", [t.id]);
  decir((await una("select resuelto_en from interno_tickets where id = $1", [t.id])).resuelto_en === null, "reabierto: la fecha de resolución se borra");
  await c.query("update interno_tickets set estado = 'cerrado' where id = $1", [t.id]);
  const tc = await una("select resuelto_en, cerrado_en, horas_resolucion from interno_tickets_vista where id = $1", [t.id]);
  decir(tc.resuelto_en && tc.cerrado_en && tc.horas_resolucion !== null, "cerrado: con fecha de cierre y horas de resolución");
  await c.query("insert into interno_ticket_mensajes (ticket_id, tipo, texto) values ($1, 'del_cliente', 'Ya anda, gracias')", [t.id]);
  decir((await una("select count(*)::int n from interno_ticket_mensajes where ticket_id = $1", [t.id])).n === 1, "la conversación queda en el ticket");
  const par = await todas("select numero, coincidencias from interno_tickets_parecidos('no imprime el ticket, la impresora está en blanco', 'impresion')");
  decir(par.length === 1 && Number(par[0].numero) === Number(t.numero) && par[0].coincidencias >= 3, `encuentra el parecido aunque esté escrito distinto (${par.length && par[0].coincidencias} coincidencias)`);
  decir((await todas("select 1 from interno_tickets_parecidos('cambiar el precio de la yerba')")).length === 0, "y no inventa parecidos");
  await c.query("insert into interno_tareas (titulo, ticket_id, prospecto_id, categoria) values ('Revisar el ancho del ticket', $1, $2, 'desarrollo')", [t.id, p.id]);
  decir((await una("select count(*)::int n from interno_tareas where ticket_id = $1 and prospecto_id = $2", [t.id, p.id])).n === 1, "un ticket genera una tarea sin perder al cliente");
  x = await intentar("delete from interno_tickets where id = $1", [t.id]);
  decir(x.e && /permission denied/.test(x.e.message), "un ticket no se borra");

  console.log("\nAdjuntos en Storage");
  x = await intentar("insert into storage.objects (bucket_id, name) values ('interno', 'soporte/prueba/captura.png')");
  decir(!x.e, "el fundador sube a la carpeta de soporte");
  x = await intentar("insert into storage.objects (bucket_id, name) values ('interno', 'cualquiercosa/prueba/a.png')");
  decir(x.e && /row-level security/.test(x.e.message), "ni el fundador escribe fuera de las carpetas de las áreas");
  await c.query("reset role");
  const b = await una("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'interno'");
  decir(b.public === false && Number(b.file_size_limit) === 10485760 && !b.allowed_mime_types.includes("text/html"),
    "el bucket es privado, con límite de 10 MB y sin tipos que un navegador ejecute (ni html ni svg)");
  decir(!b.allowed_mime_types.includes("image/svg+xml"), "un svg puede traer código: no se acepta");

  console.log("\nLas áreas");
  await c.query("reset role");
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'soporte', array['soporte'])", [D]);
  await como(D);
  decir((await una("select count(*)::int n from interno_tickets")).n >= 1, "un miembro de soporte ve los tickets");
  decir((await una("select count(*)::int n from interno_clientes")).n === 0 && (await una("select count(*)::int n from interno_impl_etapas")).n === 0,
    "pero no los clientes ni su implementación");
  x = await intentar("select interno_comercio($1)", [REPLICA]);
  decir(x.e && /Sin acceso/.test(x.e.message), "ni puede leer un comercio");
  x = await intentar("insert into storage.objects (bucket_id, name) values ('interno', 'clientes/prueba/a.pdf')");
  decir(x.e && /row-level security/.test(x.e.message), "ni subir a la carpeta de clientes");
  decir((await una("select count(*)::int n from storage.objects where bucket_id = 'interno' and name like 'soporte/%'")).n === 1, "y sí ve lo de soporte");
  await como(C);
  x = await intentar("select interno_comercio($1)", [REPLICA]);
  decir(x.e && /Sin acceso/.test(x.e.message), "el dueño de un comercio no lee comercios desde Founder");
  x = await intentar("select * from interno_comercios_libres()");
  decir(x.e && /Sin acceso/.test(x.e.message), "ni la lista de comercios");
  x = await intentar("select interno_cliente_desde_comercio($1, '{}')", [REPLICA]);
  decir(x.e && /Sin acceso/.test(x.e.message), "ni se da de alta como cliente");
  decir((await una("select count(*)::int n from storage.objects where bucket_id = 'interno'")).n === 0, "ni ve los archivos internos");
  await como(null);
  x = await intentar("select count(*) from storage.objects where bucket_id = 'interno'");
  decir(x.e || Number(x.r.rows[0].count) === 0, "anon, tampoco");
  x = await intentar("select interno_comercio($1)", [REPLICA]);
  decir(x.e && /permission denied/.test(x.e.message), "y anon ni siquiera puede llamar a las funciones");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
