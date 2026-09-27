/* ============================================================
   PRUEBA · la alícuota de IVA de cada producto (0097)
   ============================================================

   Lo que la factura A y B van a leer de cada renglón: su alícuota y si
   es gravado, exento o no gravado. Esto prueba que la base no acepte
   alícuotas que ARCA no conoce, y que el renglón vendido tome la de la
   base —no la que manda el navegador— y la devolución la de su renglón
   original.

   Todo adentro de una transacción que se deshace, sobre Bnitori (el
   comercio de QA). Si 0097 todavía no está aplicada, la aplica adentro
   de la misma transacción, así que también se deshace.

     node scripts/probar-alicuotas.mjs
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

/* Un error esperado va en su savepoint: adentro de la transacción, un
   error la invalida entera. */
const falla = async (sql, p) => {
  await c.query("savepoint s");
  try { await c.query(sql, p); await c.query("release savepoint s"); return null; }
  catch (e) { await c.query("rollback to savepoint s"); return e; }
};

try {
  await c.query("begin");

  const yaEsta = await una("select 1 as si from information_schema.columns where table_name = 'items' and column_name = 'iva_condicion'");
  if (!yaEsta) await c.query(readFileSync("supabase/migrations/0097_alicuotas_de_iva.sql", "utf8"));

  const emp = (await una("select id from empresas where nombre = 'Bnitori'")).id;
  const [a, b] = (await c.query("select id from items where empresa_id = $1 and tipo = 'producto' order by nombre limit 2", [emp])).rows.map((r) => r.id);

  console.log("\nLas alícuotas que acepta el producto");
  let e = await falla("update items set iva = 11 where id = $1", [a]);
  decir(e && /items_iva_valida/.test(e.message), "11% no existe en ARCA: no se acepta");
  e = await falla("update items set iva_condicion = 'exento', iva = 21 where id = $1", [a]);
  decir(e && /items_iva_valida/.test(e.message), "exento con 21% no se acepta: exento va en 0");
  e = await falla("update items set iva_condicion = 'medio', iva = 0 where id = $1", [a]);
  decir(!!e, "una condición inventada no se acepta");
  for (const v of [0, 2.5, 5, 10.5, 21, 27]) {
    e = await falla("update items set iva = $2, iva_condicion = 'gravado' where id = $1", [a, v]);
    decir(!e, `gravado al ${v}% se acepta`);
  }
  const vista = await una("select iva_condicion from items_vista where id = $1", [a]);
  decir(vista && vista.iva_condicion === "gravado", "items_vista trae iva_condicion");

  console.log("\nEl renglón vendido toma la alícuota de la base");
  await c.query("update items set iva = 10.5, iva_condicion = 'gravado' where id = $1", [a]);
  await c.query("update items set iva = 0, iva_condicion = 'exento' where id = $1", [b]);

  const venta = randomUUID();
  await c.query("insert into operaciones (id, empresa_id, tipo, total) values ($1, $2, 'venta', 300)", [venta, emp]);
  /* El navegador manda 21 en los tres: es lo que mandaba la comanda
     cuando no venía el dato. */
  const renglon = async (op, item, extra = {}) => una(
    `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, iva, total, origen_linea_id)
     values ($1, $2, $3, 'x', 1, 100, 21, 100, $4) returning id, iva, iva_condicion`,
    [op, emp, item, extra.origen || null]
  );
  const la = await renglon(venta, a);
  decir(Number(la.iva) === 10.5 && la.iva_condicion === "gravado", `producto al 10,5%: el renglón dice ${la.iva}% ${la.iva_condicion}, no el 21 que mandó el navegador`);
  const lb = await renglon(venta, b);
  decir(Number(lb.iva) === 0 && lb.iva_condicion === "exento", `producto exento: el renglón dice ${lb.iva}% ${lb.iva_condicion}`);
  const libre = await renglon(venta, null);
  decir(Number(libre.iva) === 21 && libre.iva_condicion === "gravado", "un renglón sin producto queda como vino, gravado");

  console.log("\nLa devolución, con el IVA con que se vendió");
  await c.query("update items set iva = 21 where id = $1", [a]);
  const dev = randomUUID();
  await c.query("insert into operaciones (id, empresa_id, tipo, total, origen_id) values ($1, $2, 'devolucion', 100, $3)", [dev, emp, venta]);
  const ld = await renglon(dev, a, { origen: la.id });
  decir(Number(ld.iva) === 10.5, `el producto pasó a 21% después de la venta y la devolución sigue en ${ld.iva}%`);
  const ldb = await renglon(dev, b, { origen: lb.id });
  decir(ldb.iva_condicion === "exento", "la devolución de un exento sigue exenta");
} catch (e) {
  decir(false, `se cortó: ${e.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
