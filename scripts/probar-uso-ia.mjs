/* ============================================================
   PRUEBA · el tope de la IA (0129), sin dejar nada
   ============================================================

   Una transacción que termina en rollback, sobre "Super 25 Pruebas" (nunca
   sobre Super 25). Si se le pasa el archivo, aplica la migración adentro.

     node scripts/probar-uso-ia.mjs
     node scripts/probar-uso-ia.mjs supabase/migrations/0129_uso_ia.sql

   Lo que mira:
   - consumir_ia cuenta hasta el tope y el que llega después no suma.
   - Un tope 0 (Simple) no deja ninguna y no escribe nada.
   - devolver_ia descuenta una.
   - Cada período y cada tipo cuentan por separado.
   - Un usuario del comercio no puede llamar a las funciones ni escribir la
     tabla; no ve la tabla tampoco.

   Pone `idle_in_transaction_session_timeout`: una prueba cortada dejó una
   vez una sesión abierta en producción, con bloqueos.
   ============================================================ */

import { readFileSync } from "node:fs";
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
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];

async function como(rol, claims, hacer) {
  await c.query("savepoint como");
  await c.query(`set local role ${rol}`);
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  try { return await hacer(); }
  finally {
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    await c.query("release savepoint como");
  }
}
const comoServidor = (hacer) => como("service_role", { role: "service_role" }, hacer);

async function fallaComo(uid, sql, args = []) {
  await c.query("savepoint f");
  try {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await c.query(sql, args);
    await c.query("rollback to savepoint f");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint f");
    return e.message;
  } finally {
    await c.query("reset role");
  }
}

try {
  await c.query("set idle_in_transaction_session_timeout = '60s'");
  await c.query("begin");
  await c.query("set local lock_timeout = '5s'");

  if (archivo) {
    console.log(`Aplicando ${archivo} adentro de la transacción…`);
    await c.query(readFileSync(archivo, "utf8"));
  }

  const emp = await una("select id from empresas where nombre = 'Super 25 Pruebas'");
  if (!emp) throw new Error("no está Super 25 Pruebas");
  const empresa = emp.id;
  /* Cualquier usuario de un comercio sirve: lo que se prueba es que la
     identidad de un comercio no llega. Super 25 Pruebas no tiene usuarios. */
  const usuario = await una("select p.id from perfiles p join empresas e on e.id = p.empresa_id where p.activo and not p.es_plataforma order by (e.nombre = 'Bnitori') desc limit 1");
  await c.query("delete from uso_ia where empresa_id = $1", [empresa]);

  const consumir = (periodo, tipo, tope) => comoServidor(() =>
    una("select consumir_ia($1, $2, $3, $4) as quedan", [empresa, periodo, tipo, tope]));

  console.log("El tope");
  const vueltas = [];
  for (let i = 0; i < 4; i++) vueltas.push((await consumir("2026-10", "pregunta", 3)).quedan);
  decir(JSON.stringify(vueltas) === "[2,1,0,null]", `con tope 3: quedan 2, 1, 0 y la cuarta no pasa (${JSON.stringify(vueltas)})`);
  const contado = await una("select cantidad from uso_ia where empresa_id = $1 and periodo = '2026-10' and tipo = 'pregunta'", [empresa]);
  decir(contado.cantidad === 3, `la que no pasó no sumó (cantidad ${contado.cantidad})`);

  const cero = await consumir("2026-10", "remito", 0);
  const filaCero = await una("select count(*)::int as n from uso_ia where empresa_id = $1 and tipo = 'remito'", [empresa]);
  decir(cero.quedan === null && filaCero.n === 0, "tope 0 (Simple): no deja y no escribe");

  await comoServidor(() => c.query("select devolver_ia($1, '2026-10', 'pregunta')", [empresa]));
  const devuelta = await consumir("2026-10", "pregunta", 3);
  decir(devuelta.quedan === 0, `devolver_ia libera una (quedan ${devuelta.quedan})`);

  const otroMes = await consumir("2026-11", "pregunta", 3);
  const otroTipo = await consumir("2026-10", "remito", 2);
  const prueba = await consumir("prueba", "pregunta", 20);
  decir(otroMes.quedan === 2 && otroTipo.quedan === 1 && prueba.quedan === 19, "cada mes, cada tipo y la prueba cuentan aparte");

  console.log("\nEl comercio no lo toca");
  if (!usuario) {
    decir(false, "no hay ningún usuario de comercio para probar");
  } else {
    const e1 = await fallaComo(usuario.id, "select consumir_ia($1, '2026-10', 'pregunta', 1000)", [empresa]);
    const e2 = await fallaComo(usuario.id, "select devolver_ia($1, '2026-10', 'pregunta')", [empresa]);
    const e3 = await fallaComo(usuario.id, "insert into uso_ia (empresa_id, periodo, tipo, cantidad) values ($1, '2026-12', 'pregunta', 0)", [empresa]);
    decir(!!e1 && !!e2, "no puede llamar consumir_ia ni devolver_ia");
    decir(!!e3, "no puede escribir la tabla");
    await c.query("savepoint v");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: usuario.id, role: "authenticated" })]);
    const visto = (await c.query("select count(*)::int as n from uso_ia")).rows[0].n;
    await c.query("reset role");
    await c.query("release savepoint v");
    decir(visto === 0, `no ve la tabla (ve ${visto} filas)`);
  }
} catch (e) {
  fallas++;
  console.log(`\nMAL  se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} cosas no dieron. Nada quedó escrito.` : "\nTodo dio. Nada quedó escrito.");
process.exit(fallas ? 1 : 0);
