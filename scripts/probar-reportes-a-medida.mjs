/* ============================================================
   PRUEBA · reportes a medida (0135), sin dejar nada
   ============================================================

   Una transacción que termina en rollback. Si se le pasa el archivo,
   aplica la migración adentro.

     node scripts/probar-reportes-a-medida.mjs
     node scripts/probar-reportes-a-medida.mjs supabase/migrations/0135_reportes_a_medida.sql

   Lo que mira, leyendo Super 25 como su dueño (solo lectura):
   - Por rubro suma lo mismo que ventas_por_item_rango, el "por producto"
     de Informes; por producto da los mismos renglones.
   - Agrupar por dos cosas suma lo mismo que por una.
   - Un filtro deja solo lo filtrado, y el drill-down llega al ticket.
   - Un nombre de dimensión o de filtro que no está en la lista no pasa,
     y un valor con comillas no rompe nada.
   - Otro comercio no ve nada; anon no la llama.
   Y en Bnitori, los reportes guardados: cualquiera del comercio guarda y
   ve; un cajero no borra el del dueño; otro comercio no los ve.

   Pone `idle_in_transaction_session_timeout`: una prueba cortada dejó una
   vez una sesión abierta en producción, con bloqueos.
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const archivo = process.argv[2];
const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };
const suma = (filas, k) => Math.round(filas.reduce((s, f) => s + Number(f[k] || 0), 0));

async function como(uid, sql, args = []) {
  await c.query("savepoint s");
  try {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    const r = await c.query(sql, args);
    await c.query("reset role"); await c.query("release savepoint s");
    return { r };
  } catch (e) { await c.query("rollback to savepoint s"); await c.query("reset role"); return { e: e.message }; }
}

try {
  await c.query("set idle_in_transaction_session_timeout = '60s'");
  await c.query("begin");
  await c.query("set local lock_timeout = '5s'");
  if (archivo) { console.log(`Aplicando ${archivo} adentro de la transacción…`); await c.query(readFileSync(archivo, "utf8")); }

  const s25 = (await c.query("select id from empresas where nombre = 'Super 25'")).rows[0].id;
  const d25 = (await c.query("select id from perfiles where empresa_id = $1 and rol = 'dueno' and activo limit 1", [s25])).rows[0].id;
  const otro = (await c.query("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Almha' and p.activo limit 1")).rows[0].id;
  const per = ["(now() at time zone 'America/Argentina/Buenos_Aires')::date - 29", "(now() at time zone 'America/Argentina/Buenos_Aires')::date"];
  const rep = (dims, filtros = {}) => `select * from reporte_a_medida($1, ${per[0]}, ${per[1]}, array[${dims.map((d) => `'${d}'`).join(",")}]::text[], '${JSON.stringify(filtros).replace(/'/g, "''")}'::jsonb)`;

  console.log("Super 25, últimos 30 días");
  const t0 = Date.now();
  const porRubro = await como(d25, rep(["categoria"]), [s25]);
  decir(!porRubro.e, `por rubro (${porRubro.e || `${porRubro.r.rows.length} rubros, ${Date.now() - t0} ms`})`);
  const ref = (await como(d25, `select * from ventas_por_item_rango($1, ${per[0]}, ${per[1]})`, [s25])).r.rows;
  decir(suma(porRubro.r.rows, "ventas") === suma(ref, "venta"), `suma igual que "por producto" de Informes (${suma(porRubro.r.rows, "ventas")} y ${suma(ref, "venta")})`);
  decir(suma(porRubro.r.rows, "costo") === suma(ref, "costo"), `costo igual (${suma(porRubro.r.rows, "costo")} y ${suma(ref, "costo")})`);
  const porProd = (await como(d25, rep(["producto"]), [s25])).r.rows;
  decir(porProd.length === ref.length, `por producto, los mismos renglones (${porProd.length} y ${ref.length})`);

  const t1 = Date.now();
  const dos = await como(d25, rep(["dia", "categoria"]), [s25]);
  decir(!dos.e && suma(dos.r.rows, "ventas") === suma(porRubro.r.rows, "ventas"), `por día y rubro suma lo mismo (${Date.now() - t1} ms, ${dos.r ? dos.r.rows.length : dos.e} filas)`);
  const porDia = (await como(d25, rep(["dia"]), [s25])).r.rows;
  console.log(`     tickets por día: ${porDia.slice(0, 3).map((f) => `${f.d1} ${f.tickets}`).join(" · ")}`);

  const rubro = porRubro.r.rows[0].d1;
  const filtrado = await como(d25, rep(["producto"], { categoria: [rubro] }), [s25]);
  decir(!filtrado.e && suma(filtrado.r.rows, "ventas") === Math.round(Number(porRubro.r.rows[0].ventas)), `filtrar "${rubro}" deja solo ese rubro`);
  const prod = filtrado.r.rows[0].d1;
  const tickets = await como(d25, rep(["ticket"], { categoria: [rubro], producto: [prod] }), [s25]);
  decir(!tickets.e && tickets.r.rows.length > 0 && / · \d\d\/\d\d \d\d:\d\d$/.test(tickets.r.rows[0].d1), `drill-down hasta el ticket: "${tickets.r && tickets.r.rows[0] && tickets.r.rows[0].d1}" (${prod})`);

  console.log("\nLo que no tiene que pasar");
  const mala = await como(d25, "select * from reporte_a_medida($1, current_date - 5, current_date, array['dia; drop table items']::text[])", [s25]);
  decir(/No conozco/.test(mala.e || ""), `una dimensión inventada no pasa (${mala.e})`);
  const malFiltro = await como(d25, `select * from reporte_a_medida($1, current_date - 5, current_date, array['dia']::text[], '{"1=1) or (true": ["x"]}'::jsonb)`, [s25]);
  decir(/No conozco/.test(malFiltro.e || ""), "un filtro inventado no pasa");
  const comillas = await como(d25, rep(["categoria"], { categoria: ["x' or '1'='1"] }), [s25]);
  decir(!comillas.e && comillas.r.rows.length === 0, "un valor con comillas no rompe nada y no trae nada");
  const cuatro = await como(d25, "select * from reporte_a_medida($1, current_date - 5, current_date, array['dia','mes','hora','canal']::text[])", [s25]);
  decir(/de una a tres/.test(cuatro.e || ""), "más de tres dimensiones no pasa");
  const ajeno = await como(otro, rep(["categoria"]), [s25]);
  decir(!ajeno.e && ajeno.r.rows.length === 0, "otro comercio no ve nada");
  const anon = await c.query("select has_function_privilege('anon', 'reporte_a_medida(uuid, date, date, text[], jsonb)', 'execute') p");
  decir(!anon.rows[0].p, "anon no la puede llamar");

  console.log("\nReportes guardados (Bnitori)");
  const bn = (await c.query("select id from empresas where nombre = 'Bnitori'")).rows[0].id;
  const dueno = (await c.query("select id from perfiles where empresa_id = $1 and rol = 'dueno' and activo limit 1", [bn])).rows[0].id;
  const cajero = randomUUID();
  await c.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now(), now(), now())`, [cajero, `cajero-${cajero.slice(0, 8)}@genez.test`]);
  await c.query("insert into perfiles (id, empresa_id, nombre, rol) values ($1, $2, 'Cajero de prueba', 'cajero')", [cajero, bn]);
  const g = await como(dueno, "insert into reportes_guardados (empresa_id, nombre, definicion) values ($1, 'Por rubro', '{\"dims\":[\"categoria\"]}') returning id", [bn]);
  decir(!g.e, `el dueño guarda uno (${g.e || "ok"})`);
  const id = g.r && g.r.rows[0].id;
  const veCajero = await como(cajero, "select count(*)::int n from reportes_guardados where id = $1", [id]);
  decir(veCajero.r && veCajero.r.rows[0].n === 1, "el cajero lo ve");
  const borraCajero = await como(cajero, "delete from reportes_guardados where id = $1", [id]);
  decir(!borraCajero.e && borraCajero.r.rowCount === 0, "el cajero no borra el del dueño");
  const propio = await como(cajero, "insert into reportes_guardados (empresa_id, nombre) values ($1, 'El mío') returning id", [bn]);
  decir(!propio.e, "el cajero guarda el suyo");
  const borraPropio = await como(cajero, "delete from reportes_guardados where id = $1", [propio.r && propio.r.rows[0].id]);
  decir(!borraPropio.e && borraPropio.r.rowCount === 1, "y lo borra");
  const ajenoG = await como(otro, "select count(*)::int n from reportes_guardados where empresa_id = $1", [bn]);
  decir(ajenoG.r && ajenoG.r.rows[0].n === 0, "otro comercio no los ve");
  const comoOtro = await como(cajero, "insert into reportes_guardados (empresa_id, nombre, usuario_id) values ($1, 'Trucho', $2)", [bn, dueno]);
  decir(!!comoOtro.e, "no se guarda a nombre de otro");
} catch (e) {
  fallas++;
  console.log(`\nMAL  se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
console.log(fallas ? `\n${fallas} cosas no dieron. Nada quedó escrito.` : "\nTodo dio. Nada quedó escrito.");
process.exit(fallas ? 1 : 0);
