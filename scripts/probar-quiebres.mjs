/* ============================================================
   PRUEBA · quiebres de stock (0134), sin dejar nada
   ============================================================

   Una transacción que termina en rollback. Si se le pasa el archivo,
   aplica la migración adentro.

     node scripts/probar-quiebres.mjs
     node scripts/probar-quiebres.mjs supabase/migrations/0134_quiebres_de_stock.sql

   Arma en Bnitori (semilla de QA) un producto con una historia conocida,
   contada en días hacia atrás desde hoy:

     -20  carga inicial de 10
     -20 a -16  vende 2 por día → se agota el -16
     -15 a -11  cinco días en falta, sin ventas
     -10  vende 1 con el stock en cero (el número estaba mal)
     -9   entra una compra de 20
     -9 a hoy  vende 1 por día → queda 20 - 10 - 1 = 9

   Y otro que se agotó hace 3 días y sigue en falta. Mira que la función
   cuente los días en falta, aparte los días vendiendo en cero, saque la
   venta normal de los días con stock, y que otro comercio no vea nada.

   Después lee los quiebres de Super 25 de los últimos 30 días, como su
   dueño, solo para mostrar qué daría.
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

  const emp = (await c.query("select id from empresas where nombre = 'Bnitori'")).rows[0];
  const dueno = (await c.query("select id from perfiles where empresa_id = $1 and rol = 'dueno' and activo limit 1", [emp.id])).rows[0];
  const otroDueno = (await c.query("select p.id from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Almha' and p.activo limit 1")).rows[0];

  const nuevo = async (nombre) => (await c.query(
    "insert into items (empresa_id, tipo, nombre, precio, costo, controla_stock, activo) values ($1, 'producto', $2, 1000, 600, true, true) returning id",
    [emp.id, nombre])).rows[0].id;
  /* A las 15 de Buenos Aires del día pedido: lejos de la medianoche. */
  const mover = (item, dia, cantidad, tipo) => c.query(
    `insert into movimientos_stock (empresa_id, item_id, cantidad, tipo, fecha)
     values ($1, $2, $3, $4, ((now() at time zone 'America/Argentina/Buenos_Aires')::date + $5::int + time '15:00') at time zone 'America/Argentina/Buenos_Aires')`,
    [emp.id, item, cantidad, tipo, dia]);

  const a = await nuevo("Quiebre de prueba A");
  await mover(a, -20, 10, "inicial");
  for (let d = -20; d <= -16; d++) await mover(a, d, -2, "venta");
  await mover(a, -10, -1, "venta");
  await mover(a, -9, 20, "compra");
  for (let d = -9; d <= 0; d++) await mover(a, d, -1, "venta");

  const b = await nuevo("Quiebre de prueba B");
  await mover(b, -12, 6, "inicial");
  for (let d = -12; d <= -3; d++) if (d % 2 === 0 || d === -3) await mover(b, d, -1, "venta");
  /* -12, -10, -8, -6, -4 y -3: seis unidades, se agota el -3. */

  const sinCargar = await nuevo("Quiebre de prueba sin cargar");
  for (let d = -5; d <= 0; d++) await mover(sinCargar, d, -1, "venta");

  const q = `select * from quiebres_de_stock($1, (now() at time zone 'America/Argentina/Buenos_Aires')::date - 29, (now() at time zone 'America/Argentina/Buenos_Aires')::date)`;
  const r = await como(dueno.id, q, [emp.id]);
  decir(!r.e, `el dueño la consulta (${r.e || "ok"})`);
  const fila = (id) => r.r && r.r.rows.find((x) => x.item_id === id);
  const fa = fila(a), fb = fila(b);
  console.log("  A:", JSON.stringify(fa));
  console.log("  B:", JSON.stringify(fb));

  console.log("\nProducto A");
  decir(fa && fa.dias_sin_stock === 5, `cinco días en falta (${fa && fa.dias_sin_stock})`);
  decir(fa && fa.dias_vendiendo_en_cero === 1, `un día vendiendo con el stock en cero, aparte (${fa && fa.dias_vendiendo_en_cero})`);
  /* Días con stock: -20 a -16 (10 u, 5 días) y -9 a 0 (10 u, 10 días): 20 / 15. */
  decir(fa && Math.abs(Number(fa.venta_diaria) - 20 / 15) < 0.01, `venta normal 20 u / 15 días = 1,33 (${fa && fa.venta_diaria})`);
  decir(fa && Math.abs(Number(fa.unidades_perdidas) - 6.7) < 0.05, `perdidas 5 × 1,33 = 6,7 (${fa && fa.unidades_perdidas})`);
  decir(fa && Number(fa.stock) === 9 && fa.sin_stock_desde === null, `hoy tiene 9 y no está en falta (${fa && fa.stock})`);

  console.log("\nProducto B");
  decir(fb && fb.dias_sin_stock === 3, `en falta -2, -1 y hoy (${fb && fb.dias_sin_stock})`);
  decir(fb && fb.sin_stock_desde !== null, `sigue en falta, desde ${fb && fb.sin_stock_desde && fb.sin_stock_desde.toISOString().slice(0, 10)}`);

  console.log("\nLo que no tiene que salir");
  decir(r.r && !fila(sinCargar), "un producto que nunca se cargó no aparece");
  const otro = await como(otroDueno.id, q, [emp.id]);
  decir(!otro.e && otro.r.rows.length === 0, "otro comercio no ve nada");
  const anon = await c.query("select has_function_privilege('anon', 'quiebres_de_stock(uuid, date, date)', 'execute') p");
  decir(!anon.rows[0].p, "anon no la puede llamar");

  console.log("\nSuper 25, últimos 30 días (solo lectura)");
  const s25 = (await c.query("select id from empresas where nombre = 'Super 25'")).rows[0];
  const d25 = (await c.query("select id from perfiles where empresa_id = $1 and rol = 'dueno' and activo limit 1", [s25.id])).rows[0];
  const t0 = Date.now();
  const r25 = await como(d25.id, `select q.*, i.nombre, i.precio from quiebres_de_stock($1, (now() at time zone 'America/Argentina/Buenos_Aires')::date - 29, (now() at time zone 'America/Argentina/Buenos_Aires')::date) q join items i on i.id = q.item_id order by q.unidades_perdidas desc nulls last`, [s25.id]);
  decir(!r25.e, `consulta en ${Date.now() - t0} ms (${r25.e || `${r25.r.rows.length} productos`})`);
  for (const x of (r25.r ? r25.r.rows : []).slice(0, 15)) {
    console.log(`     ${x.nombre.slice(0, 32).padEnd(32)} falta ${x.dias_sin_stock}/${x.dias_contados} d · en cero vendiendo ${x.dias_vendiendo_en_cero} · ${x.venta_diaria ?? "—"} u/d · pierde ${x.unidades_perdidas ?? "—"} u · stock ${x.stock}`);
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
