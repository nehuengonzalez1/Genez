/* ============================================================
   PRUEBA · el conteo de inventario se guarda (0109)
   ============================================================

   ajustar_stock en una transacción que se deshace, sobre "Super 25
   Pruebas": la diferencia la calcula la base contra lo que hay en ese
   momento, un conteo igual no escribe nada, lo negativo no entra, queda
   quién lo hizo, y sin sesión no se puede llamar (ni a transferir_stock).
   Si 0109 no está aplicada, la aplica adentro.

     node scripts/probar-conteo.mjs
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
const falla = async (sql, p) => {
  await c.query("savepoint s");
  try { await c.query(sql, p); await c.query("release savepoint s"); return null; }
  catch (e) { await c.query("rollback to savepoint s"); return e; }
};

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  if (!(await una("select count(*)::int n from pg_proc where proname = 'ajustar_stock'")).n) {
    await c.query(readFileSync("supabase/migrations/0109_conteo_de_inventario.sql", "utf8"));
  }
  const emp = (await una("select id from empresas where nombre = 'Super 25 Pruebas'")).id;
  const suc = (await una("select primera_sucursal($1) id", [emp])).id;
  const item = (await una("select id from items where empresa_id = $1 and activo order by nombre limit 1", [emp])).id;
  const plataforma = (await una("select id from perfiles where es_plataforma limit 1")).id;
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: plataforma, role: "authenticated" })]);

  const hay = async () => Number((await una("select coalesce(sum(cantidad), 0) n from movimientos_stock where item_id = $1 and sucursal_id = $2", [item, suc])).n);
  const base = await hay();

  console.log("\nContar");
  let r = await una("select * from ajustar_stock($1, $2)", [item, base + 10]);
  decir(Number(r.antes) === base && Number(r.diferencia) === 10, `había ${base}, se contaron ${base + 10}: +10`);
  decir(await hay() === base + 10, "y quedó guardado");
  const mov = await una("select tipo, motivo, usuario_id from movimientos_stock where item_id = $1 order by fecha desc, id desc limit 1", [item]);
  decir(mov.tipo === "ajuste" && mov.motivo === "Conteo de inventario" && mov.usuario_id === plataforma, "como ajuste, con el motivo y quién lo hizo");

  const n0 = (await una("select count(*)::int n from movimientos_stock where item_id = $1", [item])).n;
  r = await una("select * from ajustar_stock($1, $2, $3)", [item, base + 10, suc]);
  const n1 = (await una("select count(*)::int n from movimientos_stock where item_id = $1", [item])).n;
  decir(Number(r.diferencia) === 0 && n1 === n0, "contar lo mismo que hay no escribe nada");

  console.log("\nCon ventas en el medio");
  await c.query("insert into movimientos_stock (empresa_id, item_id, cantidad, tipo) values ($1, $2, -3, 'venta')", [emp, item]);
  r = await una("select * from ajustar_stock($1, $2)", [item, base + 5]);
  decir(Number(r.antes) === base + 7 && Number(r.diferencia) === -2, "la diferencia es contra lo que hay ahora (con la venta), no contra lo que tenía la pantalla");

  console.log("\nLo que no");
  let e = await falla("select * from ajustar_stock($1, -1)", [item]);
  decir(e && /cero o más/.test(e.message), "contado negativo: no");
  e = await falla("select * from ajustar_stock($1, 1, primera_sucursal((select id from empresas where nombre = 'Super 25')))", [item]);
  decir(e && /no es de este comercio/.test(e.message), "en la sucursal de otro comercio: no");

  await c.query("reset role");
  await c.query("set local role anon");
  e = await falla("select * from ajustar_stock($1, 1)", [item]);
  decir(e && /permission denied/.test(e.message), "sin sesión no se puede llamar a ajustar_stock");
  e = await falla("select transferir_stock($1, 1, $2, $2)", [item, suc]);
  decir(e && /permission denied/.test(e.message), "ni a transferir_stock (0108 le había dejado ejecutar a public)");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
