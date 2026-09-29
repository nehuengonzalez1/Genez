/* ============================================================
   PRUEBA · indicadores de stock con lo que de verdad pasó (0110)
   ============================================================

   En una transacción que se deshace; si 0110 no está aplicada, la aplica
   adentro y compara contra la vista de antes.

   - La vista sigue teniendo las mismas columnas, más stock_cargado.
   - Las comandas cerradas cuentan como venta (el bar deja de estar
     "sin movimiento"), y una devolución resta.
   - Un producto que solo tuvo ventas no tiene el stock cargado; con un
     conteo, sí.
   - ajustar_stock_lote carga muchos de una vez, como conteos.

   Escribe solo sobre "Super 25 Pruebas".

     node scripts/probar-indicadores.mjs
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
const columnas = async () => (await c.query("select column_name from information_schema.columns where table_name = 'items_vista' order by ordinal_position")).rows.map((r) => r.column_name);

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  const antes = await columnas();
  const aplicada = antes.includes("stock_cargado");
  const bar = (await una("select id from empresas where nombre = 'Bar Rivadavia'")).id;
  const u30BarAntes = aplicada ? null : Number((await una("select coalesce(sum(u30), 0) n from items_vista where empresa_id = $1", [bar])).n);
  if (!aplicada) await c.query(readFileSync("supabase/migrations/0110_indicadores_de_stock.sql", "utf8"));
  const despues = await columnas();

  console.log("\nLa vista");
  decir(despues[despues.length - 1] === "stock_cargado" && despues.slice(0, -1).join() === (aplicada ? despues.slice(0, -1) : antes).join(),
    "las mismas columnas en el mismo orden, más stock_cargado al final");

  console.log("\nLa venta de cada producto");
  const comandas = Number((await una(`select coalesce(sum(l.cantidad), 0) n from operacion_lineas l join operaciones o on o.id = l.operacion_id
    where o.empresa_id = $1 and o.tipo = 'comanda' and o.estado = 'confirmada' and o.fecha > now() - interval '30 days' and l.item_id is not null`, [bar])).n);
  const u30Bar = Number((await una("select coalesce(sum(u30), 0) n from items_vista where empresa_id = $1", [bar])).n);
  if (u30BarAntes !== null) decir(u30Bar === u30BarAntes + comandas, `el bar: ${u30BarAntes} → ${u30Bar} unidades en 30 días (las ${comandas} de sus comandas cerradas)`);
  else decir(u30Bar >= comandas, `el bar cuenta sus comandas cerradas (${u30Bar} unidades en 30 días)`);

  const emp = (await una("select id from empresas where nombre = 'Super 25 Pruebas'")).id;
  const [a, b] = (await c.query("select id from items where empresa_id = $1 and activo order by nombre limit 2", [emp])).rows.map((r) => r.id);
  const venta = (await una("insert into operaciones (id, empresa_id, tipo, estado, total, fecha) values (gen_random_uuid(), $1, 'venta', 'confirmada', 0, now()) returning id", [emp])).id;
  await c.query("insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, total) values ($1, $2, $3, 'x', 5, 0, 0)", [venta, emp, a]);
  const dev = (await una("insert into operaciones (id, empresa_id, tipo, estado, total, fecha) values (gen_random_uuid(), $1, 'devolucion', 'confirmada', 0, now()) returning id", [emp])).id;
  await c.query("insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, total) values ($1, $2, $3, 'x', 2, 0, 0)", [dev, emp, a]);
  const va = await una("select u30, ultima_venta from items_vista where id = $1", [a]);
  decir(Number(va.u30) === 3, "vendió 5 y devolvieron 2: u30 = 3");
  const borrador = (await una("insert into operaciones (id, empresa_id, tipo, estado, total, fecha) values (gen_random_uuid(), $1, 'comanda', 'abierta', 0, now()) returning id", [emp])).id;
  await c.query("insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, total) values ($1, $2, $3, 'x', 9, 0, 0)", [borrador, emp, a]);
  decir(Number((await una("select u30 from items_vista where id = $1", [a])).u30) === 3, "una comanda abierta todavía no cuenta");
  await c.query("update operaciones set estado = 'confirmada' where id = $1", [borrador]);
  decir(Number((await una("select u30 from items_vista where id = $1", [a])).u30) === 12, "cerrada, sí: 5 - 2 + 9 = 12 (antes las comandas no contaban nunca)");

  console.log("\nStock cargado");
  await c.query("insert into movimientos_stock (empresa_id, item_id, cantidad, tipo, operacion_id) values ($1, $2, -5, 'venta', $3)", [emp, a, venta]);
  decir((await una("select stock_cargado from items_vista where id = $1", [a])).stock_cargado === false, "con solo ventas: sin stock cargado");
  const nuncaNada = await una("select count(*) filter (where stock_cargado)::int si, count(*)::int n from items_vista v where v.empresa_id = (select id from empresas where nombre = 'Super 25')");
  decir(nuncaNada.si === 0, `Super 25: ninguno de sus ${nuncaNada.n} productos tiene el stock cargado (arrancó en cero)`);

  console.log("\nCargar de una vez");
  const plataforma = (await una("select id from perfiles where es_plataforma limit 1")).id;
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: plataforma, role: "authenticated" })]);
  const r = (await c.query("select * from ajustar_stock_lote($1::jsonb)", [JSON.stringify([{ item_id: a, real: 20 }, { item_id: b, real: 7 }])])).rows;
  const ra = r.find((x) => x.item_id === a), rb = r.find((x) => x.item_id === b);
  decir(r.length === 2 && Number(ra.antes) === -5 && Number(ra.diferencia) === 25 && Number(rb.diferencia) === 7, "dos productos: -5 → 20 (+25) y 0 → 7");
  const v2 = await una("select stock, stock_cargado from items_vista where id = $1", [a]);
  decir(Number(v2.stock) === 20 && v2.stock_cargado === true, "quedan con su stock, y ya cargado");
  const mot = await una("select motivo from movimientos_stock where item_id = $1 and tipo = 'ajuste' order by fecha desc limit 1", [a]);
  decir(mot.motivo === "Stock inicial por planilla", "con el motivo de la planilla");
  let e = await falla("select * from ajustar_stock_lote('{}'::jsonb)");
  decir(e && /lista/.test(e.message), "algo que no es una lista: no");
  e = await falla("select * from ajustar_stock_lote($1::jsonb)", [JSON.stringify([{ item_id: a, real: 1 }, { item_id: b, real: -3 }])]);
  decir(e && /cero o más/.test(e.message), "una fila mala frena todo el lote (nada a medias)");
  decir(Number((await una("select stock from items_vista where id = $1", [a])).stock) === 20, "y la buena de ese lote tampoco quedó");
  await c.query("reset role");
  await c.query("set local role anon");
  e = await falla("select * from ajustar_stock_lote('[]'::jsonb)");
  decir(e && /permission denied/.test(e.message), "sin sesión no se llama");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

/* ---------- Sin base: la planilla y los indicadores ---------- */
const { cruzarStock, columnaCantidad } = await import("../src/utils/stockInicial.js");
const { calcular } = await import("../src/utils/diagnostico.js").catch(() => ({ calcular: null }));

console.log("\nLa planilla");
const catalogo = [{ id: "a", barcode: "7790070322074" }, { id: "b", barcode: "7791234567890" }];
const hoja = [
  ["Stock de Super 25", "", ""],
  ["Código", "Producto", "Cantidad contada"],
  ["7790070322074", "Fideos", "12"],
  ["07791234567890", "Otro", "3,5"],
  ["7790070322074", "Fideos (otra góndola)", 4],
  ["7799999999999", "No existe", 1],
  ["", "Sin código", 2],
  ["7791234567890", "Negativo", -1],
];
decir(columnaCantidad(hoja[1]) === 2, "encuentra la columna de la cantidad por el título");
const cr = cruzarStock(hoja, 2, { codigo: 0, cantidad: 2 }, catalogo);
const fa = cr.cruzan.find((x) => x.p.id === "a"), fb = cr.cruzan.find((x) => x.p.id === "b");
decir(fa && fa.real === 16, "el mismo código en dos filas suma (dos góndolas): 12 + 4");
decir(fb && fb.real === 3.5, "con cero adelante y coma decimal: 3,5");
decir(cr.noEstan.length === 1 && cr.malas === 2, "uno que no está en el catálogo; sin código y negativo, afuera");

if (calcular) {
  console.log("\nLos indicadores");
  const P = (id, extra) => ({ id, activo: true, precio: 100, costo: 50, precioPrev: 100, costoPrev: 50, u30: 30, u30p: 30, vel: 1, stock: -5, stockMin: 0, bulto: 1, camposExtra: {}, ...extra });
  const k = calcular([P("nunca", { stockCargado: false }), P("contado", { stockCargado: true, stock: 2 }), P("viejo", {})], [], 14);
  decir(k.criticos.map((x) => x.p.id).sort().join() === "contado,viejo", "lo que nunca se contó no está 'para reponer' (sin la columna, como antes)");
  decir(k.sinCargar.map((p) => p.id).join() === "nunca", "va aparte, en sinCargar");
  decir(k.valorStock === 100, "el valor del inventario no resta el stock negativo ni cuenta lo no cargado: 2 × $50");
  decir(!k.sugeridos.some((s) => s.p.id === "nunca"), "ni entra en el pedido sugerido");
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
