/* ============================================================
   PRUEBA · el prospector de Founder (0119)
   ============================================================

   En una transacción que se deshace, como el fundador y como miembros
   con otra área. Si 0119 no está aplicada, la aplica adentro. No habla
   con OpenStreetMap: los resultados son inventados, con ids que no
   existen ("node/prueba-…").

     node scripts/probar-founder-prospector.mjs
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
const item = (id, o = {}) => ({ externo_id: `node/prueba-${id}`, nombre: `Comercio de prueba ${id}`, rubro: "almacen", subrubro: "convenience", zona: "caseros", lat: -34.6, lng: -58.56, datos: { shop: "convenience" }, ...o });

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  /* Si la prueba se corta a mitad de camino, el pooler puede dejar la sesión
     abierta y con sus bloqueos: la base la cierra sola (y la deshace). */
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_hallazgos') t")).t) {
    await c.query(readFileSync("supabase/migrations/0119_interno_prospector.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1")).id;
  const D = (await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' limit 1")).id;
  await como(A);

  console.log("\nLos proveedores y las zonas");
  const prov = await todas("select clave, licencia, atribucion, retencion_dias from interno_proveedores order by clave");
  decir(prov.some((p) => p.clave === "osm" && p.licencia === "ODbL 1.0" && /OpenStreetMap/.test(p.atribucion)) && !prov.some((p) => p.clave === "google"),
    "OpenStreetMap con su licencia y su atribución; Google no está (sus términos no dejan guardar los datos)");
  const zonas = await todas("select clave, datos from interno_listas where tipo = 'zona' and datos ? 'lat'");
  decir(zonas.length === 4 && zonas.every((z) => z.datos.lat < -34.5 && z.datos.lat > -34.65 && z.datos.lng < -58.5 && z.datos.lng > -58.6),
    "las cuatro zonas tienen su centro, todas en el oeste del conurbano");

  console.log("\nGuardar lo que trae una búsqueda");
  const b = await una("insert into interno_busquedas (proveedor, parametros) values ('osm', '{\"zona\":\"caseros\",\"rubros\":[\"almacen\"]}') returning id");
  const r1 = await todas("select * from interno_guardar_hallazgos($1, $2)", [b.id, JSON.stringify([item(1, { telefono: "011 4444-1111" }), item(2), item(3, { nombre: "   " }), item(4, { web: "javascript:alert(1)" })])]);
  decir(r1.length === 3 && r1.every((x) => x.nuevo), "tres nuevos: el que no tiene nombre no se guarda");
  decir((await una("select web from interno_hallazgos where externo_id = 'node/prueba-4'")).web === null, "un link que no es http no se guarda");
  const bb = await una("select resultados, nuevos, creado_por from interno_busquedas where id = $1", [b.id]);
  decir(bb.resultados === 3 && bb.nuevos === 3 && bb.creado_por === A, "la búsqueda queda registrada con sus números y su autor");
  const b2 = await una("insert into interno_busquedas (proveedor, parametros) values ('osm', '{}') returning id");
  const r2 = await todas("select * from interno_guardar_hallazgos($1, $2)", [b2.id, JSON.stringify([item(1, { telefono: "011 4444-2222" }), item(5)])]);
  decir(r2.filter((x) => x.nuevo).length === 1 && (await una("select count(*)::int n from interno_hallazgos where externo_id = 'node/prueba-1'")).n === 1,
    "encontrar de nuevo el mismo comercio lo actualiza, no lo duplica");
  decir((await una("select telefono from interno_hallazgos where externo_id = 'node/prueba-1'")).telefono === "011 4444-2222", "y trae el dato más nuevo");

  console.log("\nPasar al CRM");
  const h1 = (await una("select id from interno_hallazgos where externo_id = 'node/prueba-1'")).id;
  const p1 = (await una("select interno_incorporar_hallazgo($1) id", [h1])).id;
  const pr = await una("select * from interno_prospectos where id = $1", [p1]);
  decir(pr.nombre === "Comercio de prueba 1" && pr.fuente === "openstreetmap" && pr.origen_proveedor === "osm" && pr.origen_externo_id === "node/prueba-1" && pr.origen_verificado_en === null,
    "crea el prospecto con su origen, y sin verificar");
  decir((await una("select count(*)::int n from interno_oportunidades where prospecto_id = $1", [p1])).n === 1, "con su oportunidad, como cualquier prospecto");
  decir(/OpenStreetMap/.test((await una("select resultado from interno_actividades where prospecto_id = $1 and tipo = 'nota'", [p1])).resultado), "y una nota que dice de dónde salió");
  let x = await intentar("select interno_incorporar_hallazgo($1)", [h1]);
  decir(x.e && /Ya está en el CRM/.test(x.e.message), "no se pasa dos veces");
  const existente = await una("insert into interno_prospectos (nombre, telefono, notas) values ('Almacén que ya tenía', '011 5555-0000', 'Lo conozco') returning id");
  const h2 = (await una("select id from interno_hallazgos where externo_id = 'node/prueba-2'")).id;
  await c.query("update interno_hallazgos set direccion = 'Calle de prueba 123', telefono = '011 9999-9999' where id = $1", [h2]);
  await c.query("select interno_incorporar_hallazgo($1, $2)", [h2, existente.id]);
  const ex = await una("select telefono, direccion, notas, origen_proveedor from interno_prospectos where id = $1", [existente.id]);
  decir(ex.telefono === "011 5555-0000" && ex.direccion === "Calle de prueba 123" && ex.notas === "Lo conozco" && ex.origen_proveedor === "osm",
    "vincular a uno existente completa lo que faltaba y no pisa lo que ya estaba");
  decir((await una("select count(*)::int n from interno_oportunidades where prospecto_id = $1", [existente.id])).n === 1, "y no le crea otra oportunidad ni otro prospecto");
  x = await intentar("insert into interno_prospectos (nombre, origen_proveedor, origen_externo_id) values ('Copia', 'osm', 'node/prueba-1')");
  decir(x.e && /interno_prospectos_origen_uno/.test(x.e.message), "dos prospectos no pueden venir del mismo comercio del proveedor");
  x = await intentar("delete from interno_hallazgos where id = $1", [h1]);
  decir(x.e && /permission denied/.test(x.e.message), "un hallazgo no se borra: se descarta");

  console.log("\nLas áreas");
  await c.query("reset role");
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'marketing', array['marketing'])", [D]);
  await como(D);
  decir((await una("select count(*)::int n from interno_hallazgos")).n === 0 && (await una("select count(*)::int n from interno_busquedas")).n === 0,
    "sin crm no se ven búsquedas ni hallazgos");
  x = await intentar("select * from interno_guardar_hallazgos($1, '[]')", [b.id]);
  decir(x.e && /No existe la búsqueda/.test(x.e.message), "ni se guardan resultados");
  x = await intentar("update interno_proveedores set activo = false where clave = 'osm'");
  decir(!x.e && x.r.rowCount === 0, "ni se tocan los proveedores");
  await como(C);
  decir((await una("select count(*)::int n from interno_hallazgos")).n === 0 && (await una("select count(*)::int n from interno_proveedores")).n === 0,
    "el dueño de un comercio no ve nada de esto");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
