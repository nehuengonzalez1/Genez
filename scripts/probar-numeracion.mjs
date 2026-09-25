/* ============================================================
   PRUEBA · los números de ticket por bloques (0094)
   ============================================================

   Corre en una transacción que se deshace; si 0094 no está aplicada, la
   carga adentro, como ensayo. Usa Bnitori con la identidad de su dueño.

   El candado entre dos cajas se prueba con una segunda conexión que
   intenta reservar mientras la primera tiene el numerador tomado: tiene
   que esperar. Las dos se deshacen.

     node scripts/probar-numeracion.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
const otra = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
await otra.connect();

let fallas = 0;
let aplicada = true;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];

await c.query("begin");
try {
  const hay = await una("select count(*) n from pg_proc where proname = 'reservar_numeros'");
  aplicada = hay.n !== "0";
  if (hay.n === "0") {
    console.log("\n(0094 no está aplicada: se carga adentro de la transacción, como ensayo)");
    await c.query(readFileSync("supabase/migrations/0094_numeros_por_bloques.sql", "utf8"));
  }

  const emp = await una("select id from empresas where nombre = 'Bnitori'");
  const ajena = await una("select id from empresas where nombre = 'Super 25'");
  const dueno = await una("select id from perfiles where empresa_id = $1 and rol = 'dueno' limit 1", [emp.id]);
  const identidad = (conexion, id) => conexion.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, role: "authenticated" })]);
  const comoDueno = async () => { await c.query("set local role authenticated"); await identidad(c, dueno.id); };
  const comoAdmin = async () => { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true)"); };
  const falla = async (sql, args, codigo, texto) => {
    await c.query("savepoint s");
    try { await c.query(sql, args); decir(false, texto); }
    catch (e) { decir(e.code === codigo, `${texto}${e.code === codigo ? "" : ` (dio ${e.code}: ${e.message})`}`); }
    await c.query("rollback to savepoint s");
  };
  const reservar = async (serie, cantidad, minimo = 0) =>
    (await una("select reservar_numeros($1, $2, $3, $4) n", [emp.id, serie, cantidad, minimo])).n;

  /* Una serie propia de la prueba, con dos ventas ya en la base. */
  const S = "0777";
  await c.query("delete from numeradores where empresa_id = $1 and serie = $2", [emp.id, S]);
  for (const n of ["0777-00000041", "0777-00000045"]) {
    await c.query("insert into operaciones (id, empresa_id, tipo, estado, numero, total) values (gen_random_uuid(), $1, 'venta', 'confirmada', $2, 1)", [emp.id, n]);
  }

  console.log("\nReservar");
  await comoDueno();
  const a = await reservar(S, 10);
  decir(a === 46, `el primer bloque arranca después de lo que ya está en la base (${a}, la última era la 45)`);
  const b = await reservar(S, 10);
  decir(b === 56, `el segundo no se pisa con el primero (${b})`);
  const m = await reservar(S, 5, 200);
  decir(m === 201, `si el equipo ya usó números más allá, arranca después (${m})`);
  await comoAdmin();
  await c.query("insert into operaciones (id, empresa_id, tipo, estado, numero, total) values (gen_random_uuid(), $1, 'comanda', 'confirmada', '0777-00000300', 1)", [emp.id]);
  await comoDueno();
  const k = await reservar(S, 10);
  decir(k === 301, `una mesa cobrada con un número más alto también cuenta (${k})`);
  const t = await reservar("0778", 10);
  decir(t >= 1, `cada serie tiene su numerador (${t})`);

  console.log("\nLo que no se deja");
  await falla("select reservar_numeros($1, $2, 10, 0)", [ajena.id, S], "P0021", "numerar ventas de otro comercio");
  await falla("select reservar_numeros($1, 'x1', 10, 0)", [emp.id], "P0020", "una serie que no son cuatro números");
  await falla("select reservar_numeros($1, $2, 0, 0)", [emp.id, S], "P0020", "reservar cero");
  await falla("select reservar_numeros($1, $2, 500, 0)", [emp.id, S], "P0020", "reservar de a quinientos");
  await falla("select * from numeradores", [], "42501", "el navegador no lee la tabla");
  await comoAdmin();

  console.log("\nDos cajas a la vez");
  /* La primera conexión tiene el numerador de S tomado (reservó y no
     terminó su transacción). La segunda, otra caja del mismo comercio,
     tiene que esperar: con un límite de medio segundo, falla por el
     candado en vez de repartir el mismo bloque. Con 0094 sin aplicar la
     otra conexión no ve la función, y esto queda para después. */
  if (!aplicada) console.log("  --   0094 no está aplicada: se prueba después de aplicarla");
  else await otra.query("begin");
  if (aplicada) try {
    await otra.query("set local role authenticated");
    await identidad(otra, dueno.id);
    await otra.query("set local lock_timeout = '500ms'");
    let espero = false;
    try { await otra.query("select reservar_numeros($1, $2, 10, 0)", [emp.id, S]); }
    catch (e) { espero = e.code === "55P03" || e.code === "40P01" || /lock/i.test(e.message); }
    decir(espero, "la segunda caja espera a la primera, no recibe el mismo bloque");
  } finally {
    await otra.query("rollback");
  }
} catch (e) {
  decir(false, `numeración: ${e.message}`);
} finally {
  await c.query("rollback");
}

await c.end();
await otra.end();
console.log(fallas ? `\n${fallas} fallaron.` : "\nTodo bien. Nada quedó en la base.");
process.exitCode = fallas ? 1 : 0;
