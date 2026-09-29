/* ============================================================
   PRUEBA · la carta QR (0104)
   ============================================================

   Con el rol anónimo, que es con el que llega la página pública: leer la
   carta, pedir, y todo lo que no se tiene que poder (un QR inventado, un
   producto de otro comercio, poner el precio, pedir sin parar, leer las
   tablas directo). Y que lo pedido quede en BORRADOR, esperando al mozo.

   En una transacción que se deshace, sobre una mesa libre del Bar
   Rivadavia. Si 0104 no está aplicada, la aplica adentro.

     node scripts/probar-carta-qr.mjs
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
  try { const r = await c.query(sql, p); await c.query("release savepoint s"); return { r }; }
  catch (e) { await c.query("rollback to savepoint s"); return { e }; }
};
const comoAnonimo = async (fn) => {
  await c.query("savepoint anon");
  await c.query("set local role anon");
  try { return await fn(); } finally { await c.query("rollback to savepoint anon"); }
};

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  if (!(await una("select to_regclass('pedidos_qr') is not null as si")).si) {
    await c.query(readFileSync("supabase/migrations/0104_carta_qr.sql", "utf8"));
  }
  const bar = (await una("select id from empresas where nombre = 'Bar Rivadavia'")).id;
  const mesa = await una("select id, qr_token from recursos r where empresa_id = $1 and tipo = 'mesa' and activo and unida_a is null and not exists (select 1 from operaciones o where o.recurso_id = r.id and o.estado = 'abierta') limit 1", [bar]);
  const item = await una("select id, nombre, precio from items where empresa_id = $1 and activo and precio > 0 order by nombre limit 1", [bar]);
  const ajeno = await una("select i.id from items i join empresas e on e.id = i.empresa_id where e.nombre = 'Super 25' and i.activo and i.precio > 0 limit 1");

  console.log("\nCada mesa tiene su código");
  const sinCodigo = await una("select count(*)::int n from recursos where qr_token is null or length(qr_token) < 20");
  decir(sinCodigo.n === 0 && mesa && mesa.qr_token, "todas las mesas tienen un código largo");

  await comoAnonimo(async () => {
    console.log("\nLa carta, como la página pública");
    const carta = (await una("select carta_de_la_mesa($1) as c", [mesa.qr_token])).c;
    decir(carta && carta.comercio === "Bar Rivadavia" && carta.items.length > 0, `la carta del bar: ${carta && carta.items.length} cosas`);
    decir(carta && carta.items.every((i) => !("costo" in i)), "sin costos");
    const nada = (await una("select carta_de_la_mesa('inventado') as c")).c;
    decir(nada === null, "con un código inventado, nada");
    /* Sin error pero sin filas: las políticas de RLS no le muestran nada. */
    const directo = await una("select (select count(*) from operacion_lineas)::int l, (select count(*) from pedidos_qr)::int p, (select count(*) from items)::int i");
    decir(directo.l === 0 && directo.p === 0 && directo.i === 0, "leyendo las tablas directo no ve nada (renglones, pedidos, productos)");
  });

  console.log("\nPedir");
  await comoAnonimo(async () => {
    const pedido = [{ item_id: item.id, cantidad: 2, notas: "sin hielo", precio: 1 }];
    const { r, e } = await falla("select pedir_desde_la_mesa($1, $2, 'Juan') as x", [mesa.qr_token, JSON.stringify(pedido)]);
    decir(!e && r.rows[0].x.renglones === 1, `entró (${e ? e.message : "1 renglón"})`);
    await c.query("reset role");
    const l = await una("select l.estado, l.precio_unitario, l.total, l.notas, l.campos_extra, o.recurso_id from operacion_lineas l join operaciones o on o.id = l.operacion_id where o.recurso_id = $1 and o.estado = 'abierta' order by l.id desc limit 1", [mesa.id]);
    decir(l && l.estado === "borrador", "queda en borrador: el mozo lo confirma");
    decir(l && Number(l.precio_unitario) === Number(item.precio) && Number(l.total) === Math.round(Number(item.precio) * 2), `el precio es el de la base ($${item.precio}), no el que mandó el teléfono ($1)`);
    decir(l && l.notas === "sin hielo" && l.campos_extra.origen === "qr" && l.campos_extra.nombre === "Juan", "con la nota, marcado como QR y con el nombre");
    const s = await una("select pedidos_qr, estado from salon_vista where id = $1", [mesa.id]);
    decir(s && Number(s.pedidos_qr) === 1 && s.estado === "ocupada", "el salón muestra la mesa ocupada con 1 pedido del QR");
  });

  console.log("\nLo que no");
  await comoAnonimo(async () => {
    let { e } = await falla("select pedir_desde_la_mesa('inventado', $1)", [JSON.stringify([{ item_id: item.id, cantidad: 1 }])]);
    decir(e && /ya no sirve/.test(e.message), "un QR inventado");
    ({ e } = await falla("select pedir_desde_la_mesa($1, $2)", [mesa.qr_token, JSON.stringify([{ item_id: ajeno.id, cantidad: 1 }])]));
    decir(e && /ya no está en la carta/.test(e.message), "un producto de otro comercio");
    ({ e } = await falla("select pedir_desde_la_mesa($1, $2)", [mesa.qr_token, JSON.stringify([{ item_id: item.id, cantidad: 50 }])]));
    decir(!!e, "50 unidades de algo");
    ({ e } = await falla("select pedir_desde_la_mesa($1, '[]')", [mesa.qr_token]));
    decir(!!e, "un pedido vacío");
    let frenado = null;
    for (let i = 0; i < 8 && !frenado; i++) {
      ({ e } = await falla("select pedir_desde_la_mesa($1, $2)", [mesa.qr_token, JSON.stringify([{ item_id: item.id, cantidad: 1 }])]));
      if (e) frenado = i + 1;
    }
    /* El pedido de arriba se deshizo con su savepoint: acá entran 6 y el
       7.º se frena, que es la regla (6 cada 10 minutos). */
    decir(frenado === 7, `pedir sin parar se frena: entran 6 y el ${frenado}.º no`);
  });

  console.log("\nRenovar el código");
  await c.query("reset role");
  const { e } = await comoAnonimo(() => falla("select renovar_qr($1)", [mesa.id]));
  decir(!!e, "anónimo no lo puede renovar");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
