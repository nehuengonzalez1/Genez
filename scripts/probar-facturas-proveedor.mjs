/* ============================================================
   PRUEBA · facturas de proveedores a pagar (0133), sin dejar nada
   ============================================================

   Una transacción que termina en rollback, sobre Bnitori (semilla de QA).
   Si se le pasa el archivo, aplica la migración adentro.

     node scripts/probar-facturas-proveedor.mjs
     node scripts/probar-facturas-proveedor.mjs supabase/migrations/0133_facturas_proveedor.sql

   Lo que mira:
   - El dueño carga una factura y la ve; un cajero (sin caja grande) no
     la ve ni la carga; otro comercio tampoco.
   - Pagarla deja un pago en la caja grande con el proveedor y el número,
     baja el saldo de la cuenta y marca la factura, todo junto.
   - Una pagada no se paga dos veces ni se corrige; una anulada no se paga.

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
  const cajeroId = randomUUID();
  await c.query(`insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, '', '{}', '{}', now(), now(), now())`, [cajeroId, `cajero-${cajeroId.slice(0, 8)}@genez.test`]);
  await c.query("insert into perfiles (id, empresa_id, nombre, rol) values ($1, $2, 'Cajero de prueba', 'cajero')", [cajeroId, emp.id]);

  console.log("Cargar y ver");
  const alta = await como(dueno.id, `insert into facturas_proveedor (empresa_id, proveedor, numero, monto, vence)
    values ($1, 'Coca', '0001-123', 65000, current_date + 10) returning id`, [emp.id]);
  decir(!alta.e, `el dueño la carga (${alta.e || "ok"})`);
  const id = alta.r && alta.r.rows[0].id;
  const veDueno = await como(dueno.id, "select count(*)::int n from facturas_proveedor where id = $1", [id]);
  const veCajero = await como(cajeroId, "select count(*)::int n from facturas_proveedor where id = $1", [id]);
  const veOtro = await como(otroDueno.id, "select count(*)::int n from facturas_proveedor where id = $1", [id]);
  decir(veDueno.r.rows[0].n === 1 && veCajero.r.rows[0].n === 0 && veOtro.r.rows[0].n === 0, "la ve el dueño; no el cajero ni otro comercio");
  const cargaCajero = await como(cajeroId, "insert into facturas_proveedor (empresa_id, proveedor, monto, vence) values ($1, 'X', 1, current_date)", [emp.id]);
  decir(!!cargaCajero.e, "el cajero no la carga");

  console.log("\nPagar");
  const saldoAntes = Number((await c.query("select coalesce(sum(case when tipo='ingreso' then monto else -monto end),0) s from caja_grande where empresa_id=$1 and cuenta='efectivo'", [emp.id])).rows[0].s);
  const pagoCajero = await como(cajeroId, "select pagar_factura_proveedor($1, 'efectivo')", [id]);
  decir(!!pagoCajero.e, `el cajero no la paga (${pagoCajero.e})`);
  const pago = await como(dueno.id, "select pagar_factura_proveedor($1, 'efectivo') as cg", [id]);
  decir(!pago.e, `el dueño la paga (${pago.e || "ok"})`);
  const f = (await c.query("select pagada_en is not null pagada, cuenta, caja_grande_id from facturas_proveedor where id=$1", [id])).rows[0];
  const cg = f.caja_grande_id ? (await c.query("select tipo, categoria, monto::int, detalle from caja_grande where id=$1", [f.caja_grande_id])).rows[0] : null;
  const saldoDespues = Number((await c.query("select coalesce(sum(case when tipo='ingreso' then monto else -monto end),0) s from caja_grande where empresa_id=$1 and cuenta='efectivo'", [emp.id])).rows[0].s);
  decir(f.pagada && f.cuenta === "efectivo" && cg && cg.categoria === "pago" && cg.monto === 65000 && cg.detalle === "Coca · factura 0001-123",
    `queda pagada y en la caja grande: ${JSON.stringify(cg)}`);
  decir(saldoAntes - saldoDespues === 65000, `el efectivo baja $65.000 (${saldoAntes} → ${saldoDespues})`);
  const deNuevo = await como(dueno.id, "select pagar_factura_proveedor($1, 'efectivo')", [id]);
  decir(/ya está pagada/.test(deNuevo.e || ""), "no se paga dos veces");
  const corregir = await como(dueno.id, "update facturas_proveedor set monto = 1 where id = $1", [id]);
  decir(!corregir.e && corregir.r.rowCount === 0, "una pagada no se corrige");

  console.log("\nAnular");
  const otra = (await como(dueno.id, "insert into facturas_proveedor (empresa_id, proveedor, monto, vence) values ($1, 'Serenisima', 30000, current_date + 5) returning id", [emp.id])).r.rows[0].id;
  const anular = await como(dueno.id, "update facturas_proveedor set anulada = true where id = $1", [otra]);
  decir(!anular.e && anular.r.rowCount === 1, "una sin pagar se anula");
  const pagarAnulada = await como(dueno.id, "select pagar_factura_proveedor($1, 'efectivo')", [otra]);
  decir(/anulada/.test(pagarAnulada.e || ""), "una anulada no se paga");
} catch (e) {
  fallas++;
  console.log(`\nMAL  se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}
console.log(fallas ? `\n${fallas} cosas no dieron. Nada quedó escrito.` : "\nTodo dio. Nada quedó escrito.");
process.exit(fallas ? 1 : 0);
