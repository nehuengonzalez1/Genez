/* ============================================================
   PRUEBA · puntos para los clientes (0112)
   ============================================================

   En una transacción que se deshace, sobre "Super 25 Pruebas", con la
   regla prendida adentro (1 punto cada $1.000, vale $10, vence a los 12
   meses). Las ventas pasan por registrar_venta, como las del mostrador.

   - Suma: una venta con cliente suma; sin cliente o con la regla
     apagada, no; reintentarla no suma dos veces.
   - Canje: resta lo usado; si no alcanzaba, se registra y queda marcado.
   - Vence por lotes: lo más viejo se gasta primero, y lo vencido se
     pierde sin quitar lo ya gastado.
   - Devolución: resta en proporción lo que dio la venta.
   - Corregir a mano pide el permiso de ajustar cuentas; nadie escribe
     movimientos desde el navegador.
   Si 0112 no está aplicada, la aplica adentro.

     node scripts/probar-puntos.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
  if (!(await una("select to_regclass('public.puntos_movimientos') t")).t) {
    await c.query(readFileSync("supabase/migrations/0112_puntos.sql", "utf8"));
  }
  const emp = (await una("select id from empresas where nombre = 'Super 25 Pruebas'")).id;
  const suc = (await una("select primera_sucursal($1) id", [emp])).id;
  const regla = { activo: true, pesosPorPunto: 1000, valorPunto: 10, minimo: 100, vencenMeses: 12 };
  await c.query("update empresas set config = config || jsonb_build_object('puntos', $2::jsonb) where id = $1", [emp, JSON.stringify(regla)]);
  const cli = (await una("insert into clientes (empresa_id, razon_social, condicion, doc, tipo_doc) values ($1, 'Cliente de puntos', 'CF', '30111222', 'DNI') returning id", [emp])).id;
  const caja = (await una("insert into cajas (empresa_id, nombre) values ($1, 'Prueba puntos') returning id", [emp])).id;
  const ses = (await una("insert into sesiones_caja (empresa_id, caja_id, sucursal_id, monto_inicial) values ($1, $2, $3, 0) returning id", [emp, caja, suc])).id;
  const prod = await una("select id, nombre from items where empresa_id = $1 and activo limit 1", [emp]);

  const vender = async (total, extra = {}) => {
    const id = randomUUID();
    await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({
      id, empresa_id: emp, sucursal_id: suc, sesion_id: ses, numero: `P-${id.slice(0, 6)}`, subtotal: total, total,
      cliente_id: cli, lineas: [{ item_id: prod.id, descripcion: prod.nombre, cantidad: 1, precio_unitario: total, costo_unitario: 0, iva: 21, total }],
      pagos: [{ medio: "efectivo", monto: total }], ...extra,
    })]);
    return id;
  };
  const saldo = async (al = null) => (await una(al ? "select * from saldo_puntos($1, $2)" : "select * from saldo_puntos($1)", al ? [cli, al] : [cli]));

  console.log("\nSumar");
  const v1 = await vender(25500);
  decir((await saldo()).saldo === 25, "$25.500 con cliente: 25 puntos");
  const m1 = await una("select vence, tipo from puntos_movimientos where operacion_id = $1", [v1]);
  decir(m1.tipo === "suma" && new Date(m1.vence).getFullYear() === new Date().getFullYear() + 1, "vencen en 12 meses");
  await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({ id: v1, empresa_id: emp, sucursal_id: suc, sesion_id: ses, numero: "x", subtotal: 25500, total: 25500, cliente_id: cli, lineas: [], pagos: [] })]);
  decir((await saldo()).saldo === 25, "reintentar la misma venta no suma dos veces");
  const sinCliente = randomUUID();
  await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({ id: sinCliente, empresa_id: emp, sucursal_id: suc, sesion_id: ses, numero: "SC", subtotal: 50000, total: 50000, lineas: [], pagos: [{ medio: "efectivo", monto: 50000 }] })]);
  decir(!(await una("select count(*)::int n from puntos_movimientos where operacion_id = $1", [sinCliente])).n, "sin cliente no suma a nadie");

  console.log("\nCanjear");
  await vender(100000);                       // 125 en total
  const v3 = await vender(9000, { campos_extra: { puntos: { usados: 100, monto: 1000 } } });
  const canje = await una("select puntos, sin_saldo from puntos_movimientos where operacion_id = $1 and tipo = 'canje'", [v3]);
  decir(canje && canje.puntos === -100 && canje.sin_saldo === false, "usar 100: se restan, con saldo");
  decir((await saldo()).saldo === 125 - 100 + 9, "y la misma compra suma lo suyo: 125 - 100 + 9 = 34");
  const v4 = await vender(1000, { campos_extra: { puntos: { usados: 500, monto: 5000 } } });
  const sin = await una("select sin_saldo from puntos_movimientos where operacion_id = $1 and tipo = 'canje'", [v4]);
  decir(sin.sin_saldo === true && (await saldo()).saldo < 0, "canjear más de lo que tiene (una venta sin internet): se registra, marcado, y el saldo queda debiendo");

  console.log("\nVence por lotes");
  const cli2 = (await una("insert into clientes (empresa_id, razon_social, condicion) values ($1, 'Cliente viejo', 'CF') returning id", [emp])).id;
  const mov = (p, tipo, fecha, vence = null) => c.query(
    "insert into puntos_movimientos (empresa_id, cliente_id, puntos, tipo, fecha, vence) values ($1, $2, $3, $4, $5, $6)", [emp, cli2, p, tipo, fecha, vence]);
  await mov(100, "suma", "2025-01-10", "2026-01-10");
  await mov(50, "suma", "2025-11-01", "2026-11-01");
  await mov(-80, "canje", "2025-06-01");       // gasta 80 del lote viejo
  const s2 = await una("select * from saldo_puntos($1, '2026-09-29')", [cli2]);
  decir(s2.saldo === 50, "100 ganados en ene-25 (80 gastados, 20 vencidos) + 50 de nov-25: quedan 50, no 70 ni -30");
  decir(s2.por_vencer === 0, "nada vence en los próximos 30 días");
  const s3 = await una("select * from saldo_puntos($1, '2026-10-15')", [cli2]);
  decir(s3.por_vencer === 50 && String(s3.proximo_vencimiento).includes("2026") , "a mediados de octubre-26, los 50 vencen en menos de 30 días");

  console.log("\nDevolución");
  /* Por registrar_devolucion, como el mostrador: crea la devolución con
     total 0 y después se lo pone, y el disparador tiene que esperarlo. */
  const v5 = randomUUID();
  await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({
    id: v5, empresa_id: emp, sucursal_id: suc, sesion_id: ses, numero: "P-DEV", subtotal: 40000, total: 40000, cliente_id: cli,
    lineas: [{ item_id: prod.id, descripcion: prod.nombre, cantidad: 4, precio_unitario: 10000, costo_unitario: 0, iva: 21, total: 40000 }],
    pagos: [{ medio: "efectivo", monto: 40000 }],
  })]);
  const antes = (await saldo()).saldo;
  const linea = (await una("select id from operacion_lineas where operacion_id = $1", [v5])).id;
  /* Con la sesión de un usuario, como la pantalla: pide el permiso de devolver. */
  const quien = (await una("select id from perfiles where es_plataforma limit 1")).id;
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: quien, role: "authenticated" })]);
  const dev = (await una("select registrar_devolucion($1, $2::jsonb, $3, 'efectivo', 'prueba') id",
    [v5, JSON.stringify([{ linea_id: linea, cantidad: 1 }]), ses])).id;
  await c.query("reset role");
  const d = await una("select puntos from puntos_movimientos where operacion_id = $1", [dev]);
  decir(d && d.puntos === -10 && (await saldo()).saldo === antes - 10, "devolver 1 de 4 (una devolución de verdad) resta 10 de los 40 que dio");

  console.log("\nLa regla apagada");
  await c.query("update empresas set config = config || jsonb_build_object('puntos', $2::jsonb) where id = $1", [emp, JSON.stringify({ ...regla, activo: false })]);
  const v6 = await vender(30000);
  decir(!(await una("select count(*)::int n from puntos_movimientos where operacion_id = $1", [v6])).n, "apagada: no suma");

  console.log("\nQuién");
  const plataforma = (await una("select id from perfiles where es_plataforma limit 1")).id;
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: plataforma, role: "authenticated" })]);
  const leidos = (await c.query("select count(*)::int n from puntos_movimientos where cliente_id = $1", [cli])).rows[0].n;
  decir(leidos > 0, "con sesión se leen");
  let e = await falla("insert into puntos_movimientos (empresa_id, cliente_id, puntos, tipo) values ($1, $2, 1000, 'ajuste')", [emp, cli]);
  decir(e && /permission denied|row-level/.test(e.message), "nadie escribe puntos desde el navegador");
  e = await falla("select ajustar_puntos($1, 0, 'x')", [cli]);
  decir(e && /(cero|permiso)/.test(e.message), "corregir en cero, no");
  await c.query("reset role");
  await c.query("set local role anon");
  e = await falla("select * from saldo_puntos($1)", [cli]);
  decir(e && /permission denied/.test(e.message), "sin sesión no se consulta el saldo");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

/* ---------- Sin base: las cuentas del mostrador ---------- */
const { reglaDePuntos, puntosGanados, canjeMaximo, valorDePuntos } = await import("../src/utils/puntos.js");
console.log("\nEl mostrador");
const r = reglaDePuntos({ puntos: { activo: true } });
decir(r.pesosPorPunto === 1000 && r.valorPunto === 10 && r.minimo === 100 && r.vencenMeses === 12, "los valores de fábrica: 1 cada $1.000, vale $10, desde 100, 12 meses");
decir(!reglaDePuntos({}).activo, "apagado de fábrica");
decir(puntosGanados(25500, r) === 25 && puntosGanados(999, r) === 0, "$25.500 suma 25; $999, nada (lo mismo que la base)");
decir(canjeMaximo(530, 100000, r) === 530, "con 530 y una compra grande, usa los 530");
decir(canjeMaximo(530, 3400, r) === 340, "con una compra de $3.400, no pasa del total: 340 puntos");
decir(canjeMaximo(99, 100000, r) === 0, "por debajo del mínimo, ninguno");
decir(canjeMaximo(530, 100000, { ...r, activo: false }) === 0, "apagado, ninguno");
decir(valorDePuntos(530, r) === 5300, "530 puntos valen $5.300");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
