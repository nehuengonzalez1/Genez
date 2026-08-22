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
   4 · El comercio configura lo suyo, no lo que paga
   ------------------------------------------------------------ */
console.log("\nConfiguración del comercio");

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");

  const r = await c.query(
    `update empresas set config = jsonb_set(config, '{ancho}', '80') where id = $1`, [emp.empresa_id]);
  decir(r.rowCount === 1, "puede guardar su propia configuración");

  /* Cada intento va entre puntos de guardado. Sin eso, la primera
     excepción aborta la transacción y las que siguen fallan con otro
     error: parecería que la regla no funciona cuando en realidad ni
     llegaron a evaluarse. */
  /* El valor tiene que ser distinto del que ya tiene: poner `activa` en
     true sobre una cuenta activa no es un cambio, y la regla no tendría
     nada que bloquear. La prueba pasaría sin probar nada. */
  for (const [columna, valor] of [["modulos", `array['cobro']`], ["plan", `'gratis'`], ["activa", "false"], ["nombre", `'Otro nombre'`]]) {
    await c.query("savepoint intento");
    try {
      await c.query(`update empresas set ${columna} = ${valor} where id = $1`, [emp.empresa_id]);
      await c.query("release savepoint intento");
      decir(false, `no puede cambiarse ${columna}`);
    } catch (e) {
      await c.query("rollback to savepoint intento");
      decir(e.code === "P0004", `no puede cambiarse ${columna}`);
    }
  }
});

/* ------------------------------------------------------------
   4 bis · Lo cargado no sale solo a la cocina
   ------------------------------------------------------------ */
console.log("\nDespachar a cocina");

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");
  const platos = (await c.query(
    "select id, nombre, precio, costo from items where empresa_id = $1 limit 3", [emp.empresa_id])).rows;

  const cm = await una("select abrir_comanda($1::jsonb) id",
    [JSON.stringify({ empresa_id: emp.empresa_id, canal: "mostrador" })]);

  const cargar = (p) => c.query(
    `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
       precio_unitario, costo_unitario, total, destino)
     values ($1,$2,$3,$4,1,$5,$6,$5,'cocina')`,
    [cm.id, emp.empresa_id, p.id, p.nombre, p.precio, p.costo]);

  await cargar(platos[0]);
  await cargar(platos[1]);

  const enCocina = async () => Number((await una(
    "select count(*) n from operacion_lineas where operacion_id = $1 and estado <> 'borrador'", [cm.id])).n);

  decir(await enCocina() === 0, "cargar dos platos no manda nada a la cocina");

  const a = await una("select enviar_a_cocina($1) n", [cm.id]);
  decir(Number(a.n) === 2, `despachar manda los dos (${a.n})`);

  /* El caso que importa: se agrega algo a la media hora y la cocina no
     tiene que volver a recibir lo de antes. */
  await cargar(platos[2]);
  const b = await una("select enviar_a_cocina($1) n", [cm.id]);
  decir(Number(b.n) === 1, `agregar uno mas manda solo ese, no los tres (${b.n})`);

  const c2 = await una("select enviar_a_cocina($1) n", [cm.id]);
  decir(Number(c2.n) === 0, "despachar de nuevo sin cargar nada no manda nada");
});

/* ------------------------------------------------------------
   4 ter · El centro de pedidos

   Mover un pedido es un UPDATE sobre una operación abierta, que es
   exactamente la clase de cosa que la migración 0012 tuvo que venir a
   arreglar. Se prueba con un usuario de verdad para que no vuelva a
   pasar que "funciona" sin tocar una sola fila.
   ------------------------------------------------------------ */
console.log("\nCentro de pedidos");

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");
  const item = await una("select id, nombre, precio, costo from items where empresa_id = $1 limit 1", [emp.empresa_id]);

  const canales = await una("select count(*) n from canales where empresa_id = $1", [emp.empresa_id]);
  decir(Number(canales.n) >= 6, `ve los canales de su comercio (${canales.n})`);

  const p = await una("select abrir_comanda($1::jsonb) id",
    [JSON.stringify({ empresa_id: emp.empresa_id, canal: "delivery" })]);
  await c.query(
    `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
       precio_unitario, costo_unitario, total, destino)
     values ($1,$2,$3,$4,1,$5,$6,$5,'cocina')`,
    [p.id, emp.empresa_id, item.id, item.nombre, item.precio, item.costo]);

  await c.query("select mover_pedido($1, 'en_preparacion')", [p.id]);
  const v = await una("select estado_pedido, en_cocina from pedidos_vista where id = $1", [p.id]);
  decir(v.estado_pedido === "en_preparacion", "puede mover un pedido de estado de verdad");
  decir(Number(v.en_cocina) === 1, "y la cocina lo recibe en el mismo acto");

  const h = await una("select count(*) n from pedido_estados where operacion_id = $1", [p.id]);
  decir(Number(h.n) === 2, `el historial queda escrito (${h.n} etapas)`);

  const u = await c.query("update pedido_estados set estado = 'listo' where operacion_id = $1", [p.id]);
  decir(u.rowCount === 0, "y no se puede retocar para tapar una demora");

  await c.query("select mover_pedido($1, 'cancelado', 'prueba')", [p.id]);
  const cerrado = await una("select estado, estado_pedido from operaciones where id = $1", [p.id]);
  decir(cerrado.estado === "cancelada" && cerrado.estado_pedido === "cancelado", "puede cancelarlo");

  const r = await c.query("update operaciones set estado_pedido = 'listo' where id = $1", [p.id]);
  decir(r.rowCount === 0, "un pedido cancelado ya no admite cambios");
});

await comoUsuario(CAJERO, async () => {
  const ajenos = await una("select count(*) n from pedidos_vista where empresa_id = $1", [barId]);
  decir(ajenos.n === "0", "el comercio de al lado no ve un solo pedido del bar");
});

/* ------------------------------------------------------------
   4 quater · Dividir la cuenta con un usuario de verdad

   Un pago parcial es un INSERT en pagos y otro en movimientos_caja desde
   una función que corre con los permisos de quien llama. Si alguna
   política no lo contempla, no falla: no escribe.
   ------------------------------------------------------------ */
console.log("\nDividir la cuenta");

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");
  const item = await una("select id, nombre, precio, costo from items where empresa_id = $1 limit 1", [emp.empresa_id]);

  const cm = await una("select abrir_comanda($1::jsonb) id",
    [JSON.stringify({ empresa_id: emp.empresa_id, canal: "mostrador" })]);
  await c.query(
    `insert into operacion_lineas (operacion_id, empresa_id, item_id, descripcion, cantidad,
       precio_unitario, costo_unitario, total)
     values ($1,$2,$3,$4,2,$5::numeric,$6::numeric,$5::numeric * 2)`,
    [cm.id, emp.empresa_id, item.id, item.nombre, item.precio, item.costo]);

  const r = await c.query("update operaciones set observacion = 'sin sal' where id = $1", [cm.id]);
  decir(r.rowCount === 1, "puede dejar una observación en la comanda");

  const ses = await una(
    "insert into sesiones_caja (empresa_id, monto_inicial) values ($1, 0) returning id", [emp.empresa_id]);

  const mitad = Math.round(Number(item.precio));
  await c.query("select registrar_pago($1, $2, 'efectivo', $3::numeric, null, 'mitad')", [cm.id, ses.id, mitad]);

  const cuenta = await una("select pagado::int, saldo::int from cuenta_vista where id = $1", [cm.id]);
  decir(cuenta.pagado === mitad, `el pago parcial queda escrito (${cuenta.pagado})`);

  const enCaja = await una("select count(*) n from movimientos_caja where operacion_id = $1", [cm.id]);
  decir(enCaja.n === "1", "y entra a la caja, que es lo que la política tiene que permitir");
});

/* ------------------------------------------------------------
   5 · Juntar y separar mesas
   ------------------------------------------------------------ */
console.log("\nJuntar mesas");

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");
  const m = (await c.query(
    "select id, nombre, capacidad from recursos where empresa_id = $1 and tipo = 'mesa' order by orden limit 3",
    [emp.empresa_id])).rows;

  await c.query("select unir_mesas($1, $2)", [m[0].id, m[1].id]);
  const v = await una("select unidas, capacidad, capacidad_total from salon_vista where id = $1", [m[0].id]);
  decir(Number(v.unidas) === 1, `${m[0].nombre} queda con una mesa unida`);
  decir(Number(v.capacidad_total) === Number(m[0].capacidad) + Number(m[1].capacidad),
    `la capacidad se suma (${v.capacidad} + ${m[1].capacidad} = ${v.capacidad_total})`);

  const abrir = (recurso) => una("select abrir_comanda($1::jsonb) id",
    [JSON.stringify({ empresa_id: emp.empresa_id, recurso_id: recurso })]);
  const a = await abrir(m[1].id);
  const b = await abrir(m[0].id);
  decir(a.id === b.id, "tocar la mesa unida abre la cuenta de la principal");

  await c.query("savepoint u");
  try {
    await c.query("select unir_mesas($1, $2)", [m[1].id, m[2].id]);
    await c.query("release savepoint u");
    decir(false, "no deja encadenar uniones");
  } catch (e) {
    await c.query("rollback to savepoint u");
    decir(e.code === "P0006" || e.code === "P0007", "no deja encadenar uniones");
  }

  await c.query("select separar_mesa($1)", [m[0].id]);
  const s = await una("select unidas, capacidad_total from salon_vista where id = $1", [m[0].id]);
  decir(Number(s.unidas) === 0 && Number(s.capacidad_total) === Number(m[0].capacidad), "separarlas devuelve todo como estaba");

  /* Va después de separar a propósito: mientras m[0] tenía otra mesa
     colgando, el disparador la rechazaba por eso y nunca llegaba a mirar
     la cuenta abierta. La prueba pasaba sin probar lo que dice probar. */
  await c.query("savepoint o");
  try {
    await c.query("select unir_mesas($1, $2)", [m[2].id, m[0].id]);
    await c.query("release savepoint o");
    decir(false, "no deja unir una mesa que tiene cuenta abierta");
  } catch (e) {
    await c.query("rollback to savepoint o");
    decir(e.code === "P0008", "no deja unir una mesa que tiene cuenta abierta");
  }
});

/* ------------------------------------------------------------
   6 · La bitácora no se corrige
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

/* ------------------------------------------------------------
   7 · Los clientes son de cada comercio

   Dejaron de vivir en memoria, así que ahora lo que separa la cartera
   de un comercio de la del otro es una política y nada más.
   ------------------------------------------------------------ */
console.log("\nClientes");

/* La empresa ajena se busca ACÁ, como administrador, y no adentro de la
   sesión del mozo: ahí RLS también le tapa `empresas`, la consulta volvía
   vacía y las dos pruebas que importan se salteaban sin decir nada. */
const OTRA = await una(
  "select e.id from empresas e where e.id <> (select empresa_id from perfiles p join auth.users u on u.id = p.id where u.email = $1) limit 1",
  [MOZO]);

await comoUsuario(MOZO, async () => {
  const emp = await una("select empresa_id from perfiles where id = auth.uid()");

  const nuevo = await una(
    `insert into clientes (empresa_id, razon_social, tipo_doc, doc, condicion)
     values ($1, 'Prueba RLS', 'DNI', '12345678', 'CF') returning id`,
    [emp.empresa_id]);
  decir(!!nuevo.id, "puede dar de alta un cliente propio");

  const leido = await una("select razon_social from clientes where id = $1", [nuevo.id]);
  decir(leido && leido.razon_social === "Prueba RLS", "lo vuelve a leer");

  const u = await c.query("update clientes set tel = '11 0000 0000' where id = $1", [nuevo.id]);
  decir(u.rowCount === 1, "puede editarlo");

  /* Desactivar y no borrar: un cliente con ventas atrás dejaría
     comprobantes emitidos sin a quién apuntar. */
  const b = await c.query("update clientes set activo = false where id = $1", [nuevo.id]);
  decir(b.rowCount === 1, "puede desactivarlo");

  /* Lo que de verdad importa: la cartera del comercio de al lado. */
  if (!OTRA) { decir(false, "hace falta una segunda empresa para probar el aislamiento"); return; }

  const cuantos = await una(
    "select count(*)::int n from clientes where empresa_id = $1", [OTRA.id]);
  decir(cuantos.n === 0, "no ve los clientes de otro comercio");

  let colado = false;
  await c.query("savepoint cl");
  try {
    await c.query(
      `insert into clientes (empresa_id, razon_social) values ($1, 'Colado')`, [OTRA.id]);
    colado = true;
    await c.query("rollback to savepoint cl");
  } catch {
    await c.query("rollback to savepoint cl");
  }
  decir(!colado, "no puede crear un cliente en otro comercio");
});

/* ------------------------------------------------------------
   8 · El menú lo lee cualquiera, lo escribe la plataforma

   Los rubros no son datos de un comercio sino la forma del producto, así
   que la política es al revés que en todo lo demás: leer, todos; escribir,
   solo plataforma. Si esto se invirtiera, un comercio podría reacomodarle
   el menú a los otros.
   ------------------------------------------------------------ */
console.log("\nRubros");

const PLATAFORMA = "nehuengonzalez1@gmail.com";

await comoUsuario(MOZO, async () => {
  const mio = await una(
    `select r.clave, jsonb_array_length(r.menu) grupos
     from rubros r join empresas e on e.rubro = r.clave
     where e.id = (select empresa_id from perfiles where id = auth.uid())`);
  decir(!!mio && mio.grupos > 0, `lee el menú de su rubro (${mio ? mio.clave : "ninguno"})`);

  const otros = await una("select count(*)::int n from rubros");
  decir(otros.n >= 3, `ve los demás rubros, que no son secreto (${otros.n})`);

  const u = await c.query("update rubros set nombre = 'Pirateado' where clave = 'servicios'");
  decir(u.rowCount === 0, "no puede reacomodarle el menú a otro rubro");

  await c.query("savepoint ru");
  let creo = false;
  try {
    await c.query("insert into rubros (clave, nombre) values ('trucho', 'Trucho')");
    creo = true;
    await c.query("rollback to savepoint ru");
  } catch {
    await c.query("rollback to savepoint ru");
  }
  decir(!creo, "no puede inventar un rubro");
});

await comoUsuario(PLATAFORMA, async () => {
  const u = await c.query("update rubros set orden = orden where clave = 'servicios'");
  decir(u.rowCount === 1, "la plataforma sí puede editar un rubro");
});

/* ------------------------------------------------------------
   9 · La plataforma ve todo, y por eso la aplicación tiene que filtrar

   Esto NO es un agujero: es lo que hace que el panel de plataforma pueda
   existir. Lo que sí fue un error es haberse apoyado en RLS para saber de
   qué comercio era cada fila.

   RLS contesta "¿podés ver esto?". No contesta "¿de qué comercio es?".
   Para un usuario de comercio las dos respuestas coinciden y por eso el
   problema no aparecía nunca... hasta que el dueño de plataforma entró
   como Almha y se le cargaron los 972 productos de Super 25, con la
   Coca-Cola apareciendo en el informe de una estética.

   Esta prueba deja escrito el comportamiento para que nadie lo "arregle"
   apretando la política: si alguien la cambia, el panel de plataforma deja
   de funcionar. Lo que tiene que filtrar es cada consulta de `src/datos/`,
   con su `empresa_id` explícito.
   ------------------------------------------------------------ */
console.log("\nAlcance de la plataforma");

const TOTAL_ITEMS = (await una("select count(*)::int n from items where tipo = 'producto'")).n;

await comoUsuario(PLATAFORMA, async () => {
  const v = await una("select count(*)::int n from items_vista where tipo = 'producto'");
  decir(v.n === TOTAL_ITEMS, `sin filtro ve el catálogo de todos los comercios (${v.n} de ${TOTAL_ITEMS})`);

  const emp = await una("select empresa_id from empresas e join items i on i.empresa_id = e.id where e.nombre = 'Almha' limit 1");
  if (emp) {
    const propio = await una("select count(*)::int n from items_vista where tipo = 'producto' and empresa_id = $1", [emp.empresa_id]);
    decir(propio.n < TOTAL_ITEMS, `filtrando por empresa ve solo lo de ese comercio (${propio.n})`);
  }
});

await comoUsuario(MOZO, async () => {
  const v = await una("select count(*)::int n from items_vista where tipo = 'producto'");
  decir(v.n > 0 && v.n < TOTAL_ITEMS, `un comercio, en cambio, nunca ve el catálogo de otro (${v.n} de ${TOTAL_ITEMS})`);
});

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien.");
await c.end();
process.exitCode = fallas ? 1 : 0;
