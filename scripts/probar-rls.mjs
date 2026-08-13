/* ============================================================
   PRUEBA · las reglas de seguridad, no la lógica
   ============================================================

   El resto de las pruebas corre con el usuario administrador de
   Postgres, que saltea RLS por completo: comprueban que las funciones
   hagan la cuenta bien, no que un usuario tenga permiso de hacerlas.

   Esa diferencia dejó pasar un bug real. Las comandas trajeron el estado
   'abierta' y las políticas seguían listando los estados viejos, así que
   anular una línea o moverla en cocina no hacía nada. Sin error:
   Postgres no rechaza un UPDATE que la política excluye, simplemente no
   encuentra filas.

   Acá se toma la identidad de un usuario de verdad —el mismo mecanismo
   que usa Supabase— para que las políticas se apliquen.

     node scripts/probar-rls.mjs
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

/* Así es como Supabase presenta al usuario ante Postgres: el rol
   `authenticated` y el id adentro de los claims del token. Con eso
   auth.uid() devuelve al usuario y las políticas se aplican igual que
   desde el navegador. */
async function comoUsuario(email, hacer) {
  const u = await una("select id from auth.users where email = $1", [email]);
  if (!u) { console.log(`  --   no existe ${email}, se saltea`); return; }

  await c.query("begin");
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u.id, role: "authenticated" })]);
  try {
    await hacer();
  } finally {
    await c.query("rollback");   // nada de lo que prueba queda escrito
  }
}

const MOZO = "mozo@rivadavia.com";
const CAJERO = "axel@super25.com";

/* ------------------------------------------------------------
   1 · Una comanda abierta se puede trabajar
   ------------------------------------------------------------ */
console.log("\nComanda abierta");

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");
  const mesa = await una("select id from recursos where empresa_id = $1 order by orden limit 1", [emp.empresa_id]);
  const item = await una("select id, nombre, precio, costo from items where empresa_id = $1 limit 1", [emp.empresa_id]);

  const cm = await una("select abrir_comanda($1::jsonb) id", [JSON.stringify({ empresa_id: emp.empresa_id, recurso_id: mesa.id })]);
  decir(!!cm.id, "puede abrir una mesa");

  const l = await una(
    `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad, precio_unitario, costo_unitario, total, destino)
     values ($1,$2,$3,$4,1,$5,$6,$5,'cocina') returning id`,
    [cm.id, emp.empresa_id, item.id, item.nombre, item.precio, item.costo]
  );
  decir(!!l.id, "puede cargar un plato");

  const r1 = await c.query("update operacion_lineas set estado = 'preparando' where id = $1", [l.id]);
  decir(r1.rowCount === 1, "la cocina puede mover el plato de estado");

  const r2 = await c.query("update operacion_lineas set estado = 'anulada' where id = $1", [l.id]);
  decir(r2.rowCount === 1, "puede anular un plato");

  const ses = await una(
    "insert into sesiones_caja (empresa_id, monto_inicial) values ($1, 0) returning id", [emp.empresa_id]);
  try {
    await c.query("select cerrar_comanda($1, $2, $3::jsonb)", [cm.id, ses.id, JSON.stringify([{ medio: "efectivo", monto: 0 }])]);
    decir(true, "puede cerrar y cobrar la mesa");
  } catch (e) {
    decir(false, `puede cerrar y cobrar la mesa (${e.message})`);
  }
});

/* ------------------------------------------------------------
   2 · Una venta confirmada no se toca
   ------------------------------------------------------------ */
console.log("\nVenta ya confirmada");

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");
  const op = await una(
    `insert into operaciones (id, empresa_id, tipo, estado, total)
     values (gen_random_uuid(), $1, 'venta', 'confirmada', 100) returning id`, [emp.empresa_id]);

  const r = await c.query("update operaciones set total = 999999 where id = $1", [op.id]);
  decir(r.rowCount === 0, "no puede cambiarle el total a una venta cerrada");

  const d = await c.query("delete from operaciones where id = $1", [op.id]);
  decir(d.rowCount === 0, "no puede borrar una venta cerrada");
});

/* ------------------------------------------------------------
   3 · Un comercio no ve al otro
   ------------------------------------------------------------ */
console.log("\nAislamiento entre comercios");

/* El id del bar se busca antes de tomar la identidad de Axel: desde
   adentro de su sesión la consulta no devuelve nada, porque ni siquiera
   puede ver que ese comercio existe. */
const barId = (await una("select id from empresas where nombre = 'Bar Rivadavia'") || {}).id;

await comoUsuario(CAJERO, async () => {
  const bar = { id: barId };
  const existe = await una("select count(*) n from empresas where id = $1", [bar.id]);
  decir(existe.n === "0", "no ve que el otro comercio exista");

  const mias = await una("select count(*) n from items");
  const suyas = await una("select count(*) n from items where empresa_id = $1", [bar.id]);
  const mesas = await una("select count(*) n from recursos");

  decir(Number(mias.n) > 0, `ve su propio catálogo (${mias.n} items)`);
  decir(suyas.n === "0", "no ve un solo producto del bar");
  decir(mesas.n === "0", "no ve las mesas del bar");

  const emp = await una("select empresa_id from perfiles where id = auth.uid()");
  try {
    await c.query(
      "insert into items (empresa_id, tipo, nombre, precio) values ($1, 'producto', 'INTRUSO', 1)", [bar.id]);
    decir(false, "no puede cargar un producto en el comercio de al lado");
  } catch {
    decir(true, "no puede cargar un producto en el comercio de al lado");
  }
  decir(emp.empresa_id !== bar.id, "su perfil pertenece a otro comercio");
});

/* ------------------------------------------------------------
   4 · La bitácora no se corrige
   ------------------------------------------------------------ */
console.log("\nBitácora");

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");
  const b = await una(
    `insert into bitacora (empresa_id, accion, detalle) values ($1, 'prueba', '{}'::jsonb) returning id`,
    [emp.empresa_id]);

  const u = await c.query("update bitacora set accion = 'otra' where id = $1", [b.id]);
  decir(u.rowCount === 0, "no se puede editar un asiento");

  const d = await c.query("delete from bitacora where id = $1", [b.id]);
  decir(d.rowCount === 0, "no se puede borrar un asiento");
});

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien.");
await c.end();
process.exitCode = fallas ? 1 : 0;
