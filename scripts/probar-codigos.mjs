/* ============================================================
   PRUEBA · los códigos de barras propios (0086)
   ============================================================

   Corre como Axel (dueño de Super 25), con permisos reales, dentro de una
   transacción que se deshace: nada queda escrito.

     node scripts/probar-codigos.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];
let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

const axel = await una("select id from auth.users where email = 'axel@super25.com'");
const SUPER = await una("select id from empresas where nombre = 'Super 25'");
const OTRO = await una("select id from empresas where nombre = 'Bnitori'");

console.log("\nEl dígito verificador");
const v = await una(`select count(*)::int total,
  count(*) filter (where right(barcode, 1)::int = digito_ean(left(barcode, length(barcode) - 1)))::int validos
  from items where barcode ~ '^[0-9]{8}$'`);
decir(v.total > 0 && v.total === v.validos, `coincide con los ${v.total} códigos de 8 dígitos reales del catálogo`);

await c.query("begin");
try {
  const nuevo = async (empresa, nombre, barcode = "") =>
    (await una("insert into items (empresa_id, nombre, barcode) values ($1, $2, $3) returning id", [empresa, nombre, barcode])).id;

  const a = await nuevo(SUPER.id, "Prueba A sin código");
  const b = await nuevo(SUPER.id, "Prueba B sin código");
  const conCodigo = await nuevo(SUPER.id, "Prueba con código de fábrica", "7790070507273");
  const ajeno = await nuevo(OTRO.id, "Producto de otro comercio");

  const { max } = await una(`select coalesce(max(substr(barcode, 2, 6)::int), 0) max from items
    where empresa_id = $1 and barcode ~ '^2[0-9]{7}$' and right(barcode, 1)::int = digito_ean(left(barcode, 7))`, [SUPER.id]);
  /* Un producto que ya tiene "a mano" el número que tocaría: se saltea. */
  const siguiente = "2" + String(Number(max) + 1).padStart(6, "0");
  const ocupado = siguiente + (await una("select digito_ean($1) d", [siguiente])).d;
  await nuevo(SUPER.id, "Prueba con el siguiente ocupado", ocupado);

  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: axel.id, role: "authenticated" })]);

  const r = (await c.query("select * from asignar_codigos_internos($1, $2)", [SUPER.id, [a, b, conCodigo, ajeno]])).rows;
  decir(r.length === 2 && r.every((x) => [a, b].includes(x.item_id)), "da código solo a los que no tienen, y no toca el de otro comercio");
  decir(r.every((x) => /^2\d{7}$/.test(x.barcode)), `EAN-8 que empieza con 2: ${r.map((x) => x.barcode).join(", ")}`);
  decir(!r.some((x) => x.barcode === ocupado), `saltea el número que ya tenía otro producto (${ocupado})`);
  decir(new Set(r.map((x) => x.barcode)).size === 2, "no repite");
  const fabrica = await una("select barcode from items where id = $1", [conCodigo]);
  decir(fabrica.barcode === "7790070507273", "no pisa un código de fábrica");
  const guardados = (await c.query("select barcode from items where id = any($1)", [[a, b]])).rows.map((x) => x.barcode);
  decir(guardados.every((g) => r.some((x) => x.barcode === g)), "quedan guardados en el producto");
  decir((await c.query("select * from asignar_codigos_internos($1, $2)", [SUPER.id, [a, b]])).rows.length === 0,
    "pedirlo de nuevo no cambia nada");

  /* 0087: quedan registrados y se ven en la sección. */
  const vista = (await c.query("select item_id, codigo, generado_en, generado_por from codigos_propios_vista where item_id = any($1)", [[a, b]])).rows;
  decir(vista.length === 2 && vista.every((x) => x.generado_en && x.generado_por),
    "aparecen en la sección de códigos, con cuándo y quién los generó");
  await c.query("reset role");
  await c.query("update items set barcode = '7790070507273' where id = $1", [a]);
  const tras = (await c.query("select item_id from codigos_propios_vista where item_id = any($1)", [[a, b]])).rows;
  decir(tras.length === 1 && tras[0].item_id === b, "si a un producto le cambian el código a mano, deja de figurar como propio");
} catch (e) {
  decir(false, `error inesperado: ${e.message}`);
} finally {
  await c.query("rollback");
}

await c.end();
console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exit(fallas ? 1 : 0);
