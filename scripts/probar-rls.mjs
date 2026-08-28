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

/* ------------------------------------------------------------
   10 · Las vistas no pueden ser una puerta de atrás

   Una vista sin `security_invoker` corre con los permisos de quien la
   creó y saltea RLS por completo. Es un error silencioso: la vista
   funciona, devuelve datos, y recién se nota cuando alguien ve lo que no
   tenía que ver. `equipo_vista` nació así y expuso los sueldos de todos
   los comercios hasta que se corrigió.

   Se comprueban todas de una: la próxima que se agregue mal, cae acá.
   ------------------------------------------------------------ */
console.log("\nVistas");

const VISTAS = (await c.query(
  `select c.relname, coalesce(array_to_string(c.reloptions, ','), '') as opciones
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v' order by 1`)).rows;

for (const v of VISTAS) {
  decir(v.opciones.includes("security_invoker=true"), `${v.relname} respeta RLS`);
}

const CON_EQUIPO = (await una("select count(*)::int n from personal")).n;
await comoUsuario(MOZO, async () => {
  const v = await una("select count(*)::int n from equipo_vista");
  decir(v.n === 0, `un comercio no ve el equipo ni los sueldos de otro (${v.n} de ${CON_EQUIPO})`);
});

/* ------------------------------------------------------------
   11 · La agenda

   Dos cosas distintas se prueban acá. Una es el aislamiento: que nadie
   agende adentro de otro comercio ni con la sala o la persona de otro.
   La otra son los choques, que tienen que impedirse en la base y no en la
   pantalla: dos personas agendando desde dos dispositivos al mismo tiempo
   solo se resuelven acá.
   ------------------------------------------------------------ */
console.log("\nAgenda");

const ALMHA = await una("select id from empresas where nombre = 'Almha'");

if (!ALMHA) {
  decir(false, "hace falta Almha para probar la agenda (corré supabase/seed/almha.sql)");
} else {
  const SOFIA = await una(
    "select id from personal where empresa_id = $1 and nombre = 'Sofía González'", [ALMHA.id]);
  const SALA = await una(
    "select id from recursos where empresa_id = $1 order by orden limit 1", [ALMHA.id]);
  const SERVICIO = await una(
    "select id, duracion_min from items where empresa_id = $1 and tipo = 'servicio' limit 1", [ALMHA.id]);
  /* Un lunes a las 9 hora de Buenos Aires, que es cuando Sofía trabaja,
     pero dentro de más de medio año. Cuando esto se escribió, Almha no
     tenía un solo turno cargado y el lunes de esta semana estaba libre;
     al sembrarle historia y agenda, la sala pasó a estar ocupada y la
     prueba empezó a fallar por un choque de verdad. Una prueba de
     permisos no se puede caer porque el negocio de ejemplo tenga trabajo:
     se corre en una semana donde no hay nada. */
  const CUANDO = (await una(
    `select (date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires') + interval '30 weeks')
             + interval '9 hours') at time zone 'America/Argentina/Buenos_Aires' as t`)).t;

  const turno = (extra = {}) => JSON.stringify({
    empresa_id: ALMHA.id, personal_id: SOFIA.id, recurso_id: SALA.id,
    item_id: SERVICIO.id, nombre: "Prueba RLS", desde: CUANDO,
    duracion_min: 60, ...extra,
  });

  await comoUsuario(PLATAFORMA, async () => {
    const t1 = await una("select agendar_turno($1::jsonb) id", [turno()]);
    decir(!!t1.id, "se puede agendar un turno");

    const leido = await una(
      "select servicio, profesional, sala from agenda_vista where id = $1", [t1.id]);
    decir(leido && leido.profesional === "Sofía González" && !!leido.servicio && !!leido.sala,
      `la vista resuelve los nombres (${leido ? leido.servicio + " · " + leido.sala : "nada"})`);

    /* Cada choque va en su savepoint: si no, el primer error aborta la
       transacción entera y las pruebas de abajo no llegan a correr. */
    const choque = async (etiqueta, args, codigo) => {
      await c.query("savepoint ch");
      try {
        await c.query("select agendar_turno($1::jsonb)", [args]);
        await c.query("rollback to savepoint ch");
        decir(false, etiqueta);
      } catch (e) {
        await c.query("rollback to savepoint ch");
        decir(e.code === codigo, `${etiqueta}${e.code === codigo ? "" : ` (dio ${e.code})`}`);
      }
    };

    await choque("no deja pisar la misma sala", turno({ personal_id: null }), "P0034");
    await choque("no deja pisarle el horario a la misma persona", turno({ recurso_id: null }), "P0035");

    const tarde = (await una(
      `select ($1::timestamptz + interval '12 hours') as t`, [CUANDO])).t;
    await choque("no deja agendar fuera del horario de la persona",
      turno({ desde: tarde, recurso_id: null }), "P0036");

    await choque("no deja usar una sala de otro comercio",
      turno({ recurso_id: (await una("select id from recursos where empresa_id <> $1 limit 1", [ALMHA.id])).id, personal_id: null }),
      "P0032");

    /* La persona ajena se crea acá adentro: hoy solo Almha tiene equipo,
       y buscar una que no existe devolvía null, con lo cual la validación
       se salteaba y la prueba pasaba sin probar nada. Se va con el
       rollback junto con todo lo demás. */
    const otraEmpresa = await una("select id from empresas where id <> $1 limit 1", [ALMHA.id]);
    const ajena = await una(
      `insert into personal (empresa_id, nombre, tipo) values ($1, 'Prueba ajena', 'profesional') returning id`,
      [otraEmpresa.id]);
    await choque("no deja usar una persona de otro comercio",
      turno({ personal_id: ajena.id, recurso_id: null }), "P0033");

    /* Reprogramar usa las mismas reglas e ignora al propio turno: moverlo
       media hora no puede chocar contra sí mismo. */
    const media = (await una(`select ($1::timestamptz + interval '30 minutes') as t`, [CUANDO])).t;
    await c.query("select mover_turno($1, $2)", [t1.id, media]);
    decir(true, "se puede reprogramar sin chocar contra sí mismo");

    /* Un bloqueo tapa el horario aunque no haya ningún turno. */
    await c.query(
      `insert into excepciones (empresa_id, personal_id, desde, hasta, motivo)
       values ($1, $2, $3::timestamptz + interval '3 hours', $3::timestamptz + interval '4 hours', 'ausencia')`,
      [ALMHA.id, SOFIA.id, CUANDO]);
    await choque("no deja agendar sobre una ausencia",
      turno({ desde: (await una(`select ($1::timestamptz + interval '3 hours') as t`, [CUANDO])).t, recurso_id: null }),
      "P0037");
  });

  /* Y el aislamiento, desde otro comercio. */
  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from agenda_vista where empresa_id = $1", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve los turnos de otro");

    await c.query("savepoint ag");
    let pudo = false;
    try {
      await c.query("select agendar_turno($1::jsonb)", [turno()]);
      pudo = true;
      await c.query("rollback to savepoint ag");
    } catch {
      await c.query("rollback to savepoint ag");
    }
    decir(!pudo, "un comercio no puede agendar adentro de otro");
  });
}

/* ------------------------------------------------------------
   12 · Clases grupales

   Lo que se prueba acá es el cupo, que es donde esto se rompe feo: dos
   personas apretando "anotar" sobre el último lugar tienen que terminar
   con una adentro y una afuera, no con siete en una clase de seis.

   Y lo otro es que las inscripciones NO ocupen la sala. Si ocuparan, la
   segunda persona de una clase daría "sala ocupada" y nadie podría
   anotarse.
   ------------------------------------------------------------ */
console.log("\nClases grupales");

if (ALMHA) {
  const SOFIA = await una("select id from personal where empresa_id = $1 and nombre = 'Sofía González'", [ALMHA.id]);
  const SALA = await una(
    "select id, capacidad from recursos where empresa_id = $1 and capacidad >= 6 order by orden limit 1", [ALMHA.id]);
  const GRUPAL = await una(
    `select id from items where empresa_id = $1 and tipo = 'servicio'
       and campos_extra ->> 'modalidad' = 'grupal' limit 1`, [ALMHA.id]);
  /* Misma semana lejana que arriba, por la misma razón. */
  const CUANDO = (await una(
    `select (date_trunc('week', (now() at time zone 'America/Argentina/Buenos_Aires') + interval '30 weeks')
             + interval '10 hours') at time zone 'America/Argentina/Buenos_Aires' as t`)).t;

  await comoUsuario(PLATAFORMA, async () => {
    const clase = await una("select crear_clase($1::jsonb) id", [JSON.stringify({
      empresa_id: ALMHA.id, personal_id: SOFIA.id, recurso_id: SALA.id,
      item_id: GRUPAL.id, nombre: "Reformer intermedio", desde: CUANDO,
      duracion_min: 60, cupo: 3,
    })]);
    decir(!!clase.id, "se puede abrir una clase");

    const vacia = await una(
      "select forma, cupo, anotados, lugares from agenda_vista where id = $1", [clase.id]);
    decir(vacia.forma === "clase" && vacia.anotados === "0" && Number(vacia.lugares) === 3,
      `la clase existe sin nadie anotado (${vacia.lugares} lugares)`);

    /* Tres inscripciones entran; la cuarta no. Y ninguna tiene que dar
       "sala ocupada": ahí estaba el error que esta migración corrige. */
    for (let i = 1; i <= 3; i++) {
      try {
        await c.query("select inscribir($1::jsonb)", [JSON.stringify({ clase_id: clase.id, nombre: `Alumna ${i}` })]);
        decir(true, `entra la alumna ${i}`);
      } catch (e) {
        decir(false, `entra la alumna ${i} (${e.message})`);
      }
    }

    await c.query("savepoint cl");
    try {
      await c.query("select inscribir($1::jsonb)", [JSON.stringify({ clase_id: clase.id, nombre: "Alumna 4" })]);
      await c.query("rollback to savepoint cl");
      decir(false, "no deja pasarse del cupo");
    } catch (e) {
      await c.query("rollback to savepoint cl");
      decir(e.code === "P0045", `no deja pasarse del cupo${e.code === "P0045" ? "" : ` (dio ${e.code})`}`);
    }

    /* La misma persona dos veces ocupa un lugar que otro necesitaba. */
    const cli = await una(
      `insert into clientes (empresa_id, razon_social) values ($1, 'Cliente prueba') returning id`, [ALMHA.id]);
    /* Sin sala ni profesor: si los tuviera chocaría con la clase de
       arriba, que ocupa esa sala a esa hora. */
    const clase2 = await una("select crear_clase($1::jsonb) id", [JSON.stringify({
      empresa_id: ALMHA.id, item_id: GRUPAL.id, nombre: "Otra",
      desde: CUANDO, duracion_min: 60, cupo: 4,
    })]);
    await c.query("select inscribir($1::jsonb)", [JSON.stringify({ clase_id: clase2.id, cliente_id: cli.id, nombre: "Cliente prueba" })]);
    await c.query("savepoint dup");
    try {
      await c.query("select inscribir($1::jsonb)", [JSON.stringify({ clase_id: clase2.id, cliente_id: cli.id, nombre: "Cliente prueba" })]);
      await c.query("rollback to savepoint dup");
      decir(false, "no deja anotar dos veces a la misma persona");
    } catch (e) {
      await c.query("rollback to savepoint dup");
      decir(e.code === "P0046", "no deja anotar dos veces a la misma persona");
    }

    /* El cupo no puede pasarse de lo que entra en la sala. */
    await c.query("savepoint cap");
    try {
      await c.query("select crear_clase($1::jsonb)", [JSON.stringify({
        empresa_id: ALMHA.id, recurso_id: SALA.id, nombre: "Imposible",
        desde: CUANDO, duracion_min: 60, cupo: (SALA.capacidad || 6) + 10,
      })]);
      await c.query("rollback to savepoint cap");
      decir(false, "no deja abrir una clase más grande que la sala");
    } catch (e) {
      await c.query("rollback to savepoint cap");
      decir(e.code === "P0041", "no deja abrir una clase más grande que la sala");
    }

    /* Y la clase sí ocupa: un turno individual encima tiene que chocar. */
    await c.query("savepoint enc");
    try {
      await c.query("select agendar_turno($1::jsonb)", [JSON.stringify({
        empresa_id: ALMHA.id, recurso_id: SALA.id, nombre: "Encima",
        desde: CUANDO, duracion_min: 60,
      })]);
      await c.query("rollback to savepoint enc");
      decir(false, "una clase ocupa la sala para un turno individual");
    } catch (e) {
      await c.query("rollback to savepoint enc");
      decir(e.code === "P0034", "una clase ocupa la sala para un turno individual");
    }

    /* La lista de espera. */
    await c.query(
      `insert into espera (empresa_id, clase_id, nombre) values ($1, $2, 'La que espera')`,
      [ALMHA.id, clase.id]);
    const esp = await una("select esperando from agenda_vista where id = $1", [clase.id]);
    decir(Number(esp.esperando) === 1, "la lista de espera cuenta en la vista");
  });

  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from espera where empresa_id = $1", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve la lista de espera de otro");
  });
}

/* ------------------------------------------------------------
   13 · Abonos

   Lo que se prueba es el crédito: que se descuente al reservar, que
   vuelva al cancelar y que el tope semanal no se pueda pasar. Y que el
   saldo salga de los turnos y no de un contador, que es lo que evita que
   se desincronice.
   ------------------------------------------------------------ */
console.log("\nAbonos");

if (ALMHA) {
  const SOFIA = await una("select id from personal where empresa_id = $1 and nombre = 'Sofía González'", [ALMHA.id]);
  /* Un lunes bastante adelante, por dos razones.

     Una: el abono arranca hoy, así que reservar contra él para un día que
     ya pasó da "el abono arranca el 22/08", que es correcto y no es lo que
     se quiere probar.

     Dos, y más importante: estas pruebas corren contra la base de verdad,
     donde hay turnos que alguien cargó de verdad. Elegir un horario
     cercano hace que la prueba choque contra el trabajo real de alguien y
     falle por un motivo que no tiene nada que ver con lo que prueba. Ya
     pasó: el lunes que viene a las nueve estaba ocupado.

     Sigue dentro de la vigencia de 60 días del plan de prueba. */
  const LUNES = (await una(
    `select (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
             + interval '28 days' + interval '9 hours') at time zone 'America/Argentina/Buenos_Aires' as t`)).t;

  await comoUsuario(PLATAFORMA, async () => {
    /* El plan va al catálogo como cualquier otro item. */
    const plan = await una(
      `insert into items (empresa_id, tipo, nombre, precio, controla_stock, campos_extra)
       values ($1, 'plan', 'Pack 3 clases', 30000, false,
               '{"clases":3,"vigenciaDias":60,"topeSemanal":2}'::jsonb)
       returning id`, [ALMHA.id]);
    decir(!!plan.id, "un plan es un item del catálogo");

    const cli = await una(
      `insert into clientes (empresa_id, razon_social) values ($1, 'Compradora') returning id`, [ALMHA.id]);

    /* Cobrar un abono es cobrar: sin caja abierta la base lo rechaza,
       igual que cualquier venta (regla 4). */
    const ses = await una(
      `insert into sesiones_caja (empresa_id, monto_inicial) values ($1, 0) returning id`, [ALMHA.id]);

    const abono = await una("select vender_abono($1::jsonb) id", [JSON.stringify({
      empresa_id: ALMHA.id, cliente_id: cli.id, item_id: plan.id,
      sesion_id: ses.id,
      pagos: [{ medio: "efectivo", monto: 30000 }],
    })]);
    decir(!!abono.id, "vender el abono crea el crédito");

    /* La venta pasó por el camino de siempre: hay operación, línea y pago. */
    const venta = await una(
      `select o.total::float t, count(l.id)::int lineas,
              (select count(*)::int from pagos where operacion_id = o.id) pagos,
              (select count(*)::int from movimientos_caja where operacion_id = o.id) caja
         from abonos a
         join operaciones o on o.id = a.operacion_id
         left join operacion_lineas l on l.operacion_id = o.id
        where a.id = $1 group by o.id, o.total`, [abono.id]);
    decir(venta && venta.t === 30000 && venta.lineas === 1 && venta.pagos === 1 && venta.caja === 1,
      `la venta entra por el camino de siempre (línea, pago y caja)`);

    const v0 = await una("select clases, usadas, restantes, estado from abonos_vista where id = $1", [abono.id]);
    decir(Number(v0.restantes) === 3 && v0.estado === "activo", `arranca con ${v0.restantes} de ${v0.clases}`);

    const conAbono = (dias, extra = {}) => JSON.stringify({
      empresa_id: ALMHA.id, cliente_id: cli.id, abono_id: abono.id,
      personal_id: SOFIA.id, nombre: "Compradora",
      desde: new Date(new Date(LUNES).getTime() + dias * 86400000).toISOString(),
      duracion_min: 60, ...extra,
    });

    const t1 = await una("select agendar_turno($1::jsonb) id", [conAbono(0)]);
    const v1 = await una("select restantes from abonos_vista where id = $1", [abono.id]);
    decir(Number(v1.restantes) === 2, `reservar descuenta una (${v1.restantes} restantes)`);

    /* El tope es de dos por semana: la tercera del lunes al domingo no entra. */
    await c.query("select agendar_turno($1::jsonb)", [conAbono(2)]);
    await c.query("savepoint tope");
    try {
      await c.query("select agendar_turno($1::jsonb)", [conAbono(4)]);
      await c.query("rollback to savepoint tope");
      decir(false, "no deja pasar el tope semanal");
    } catch (e) {
      await c.query("rollback to savepoint tope");
      decir(e.code === "P0059", `no deja pasar el tope semanal${e.code === "P0059" ? "" : ` (dio ${e.code})`}`);
    }

    /* Cancelar devuelve la clase. */
    await c.query("update reservas set estado = 'cancelada' where id = $1", [t1.id]);
    const v2 = await una("select restantes from abonos_vista where id = $1", [abono.id]);
    decir(Number(v2.restantes) === 2, `cancelar devuelve la clase (${v2.restantes} restantes)`);

    /* Faltar la gasta o no, según el comercio. */
    await c.query("update reservas set estado = 'ausente' where id = $1", [t1.id]);
    const conPolitica = await una("select restantes from abonos_vista where id = $1", [abono.id]);
    decir(Number(conPolitica.restantes) === 1, "por defecto, faltar gasta la clase");

    await c.query(
      `update empresas set config = jsonb_set(config, '{turnos}', '{"ausenciaConsume": false}'::jsonb) where id = $1`,
      [ALMHA.id]);
    const sinCastigo = await una("select restantes from abonos_vista where id = $1", [abono.id]);
    decir(Number(sinCastigo.restantes) === 2, "con la política del comercio en no, la devuelve");

    /* Un abono es de quien lo compró. */
    const otro = await una(
      `insert into clientes (empresa_id, razon_social) values ($1, 'Otro') returning id`, [ALMHA.id]);
    await c.query("savepoint aj");
    try {
      await c.query("select agendar_turno($1::jsonb)", [JSON.stringify({
        empresa_id: ALMHA.id, cliente_id: otro.id, abono_id: abono.id,
        nombre: "Otro", desde: new Date(new Date(LUNES).getTime() + 6 * 86400000).toISOString(), duracion_min: 60,
      })]);
      await c.query("rollback to savepoint aj");
      decir(false, "no deja usar el abono de otra persona");
    } catch (e) {
      await c.query("rollback to savepoint aj");
      decir(e.code === "P0055", "no deja usar el abono de otra persona");
    }
  });

  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from abonos where empresa_id = $1", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve los abonos de otro");
  });
}

/* ------------------------------------------------------------
   14 · Liquidaciones

   Lo que importa acá es que pagarle a alguien deje su egreso: si la
   liquidación no genera el movimiento, los egresos del mes mienten y el
   gasto más grande del negocio no aparece en ningún lado.
   ------------------------------------------------------------ */
console.log("\nLiquidaciones");

if (ALMHA) {
  const SOFIA = await una("select id, valor::float v from personal where empresa_id = $1 and nombre = 'Sofía González'", [ALMHA.id]);

  await comoUsuario(PLATAFORMA, async () => {
    /* Un par de turnos suyos, en un período apartado para no mezclarse
       con los que alguien haya cargado de verdad. */
    const lunes = (await una(
      `select (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
               + interval '35 days' + interval '9 hours') at time zone 'America/Argentina/Buenos_Aires' as t`)).t;

    for (const d of [0, 2]) {
      await c.query("select agendar_turno($1::jsonb)", [JSON.stringify({
        empresa_id: ALMHA.id, personal_id: SOFIA.id, nombre: "Alguien",
        desde: new Date(new Date(lunes).getTime() + d * 86400000).toISOString(),
        duracion_min: 60,
      })]);
    }

    const desde = (await una(`select ($1::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date d`, [lunes])).d;
    const hasta = (await una(`select (($1::timestamptz + interval '6 days') at time zone 'America/Argentina/Buenos_Aires')::date d`, [lunes])).d;

    const liq = await una("select liquidar($1, $2, $3) id", [SOFIA.id, desde, hasta]);
    decir(!!liq.id, "se arma la liquidación del período");

    const v = await una("select horas::float h, total::float t, a_pagar::float p, estado from liquidaciones_vista where id = $1", [liq.id]);
    decir(v.h === 2, `las horas salen de la agenda (${v.h} hs)`);
    decir(v.t === SOFIA.v * 2, `el total usa su valor hora (${v.t})`);

    /* Volver a armarla no duplica ni pisa el ajuste cargado a mano. */
    await c.query("update liquidaciones set ajuste = 5000 where id = $1", [liq.id]);
    await c.query("select liquidar($1, $2, $3)", [SOFIA.id, desde, hasta]);
    const v2 = await una("select ajuste::float a, a_pagar::float p from liquidaciones_vista where id = $1", [liq.id]);
    decir(v2.a === 5000, "recalcular respeta el ajuste cargado a mano");

    /* Y lo que de verdad importa: pagar deja el egreso. */
    const antes = (await una("select count(*)::int n from movimientos_caja where empresa_id = $1 and tipo = 'egreso'", [ALMHA.id])).n;
    await c.query("select pagar_liquidacion($1, 'transferencia')", [liq.id]);
    const despues = (await una("select count(*)::int n from movimientos_caja where empresa_id = $1 and tipo = 'egreso'", [ALMHA.id])).n;
    decir(despues === antes + 1, "pagarla deja el egreso en la caja");

    const mov = await una(
      `select m.monto::float mo, m.categoria, m.sesion_id
         from liquidaciones l join movimientos_caja m on m.id = l.movimiento_id
        where l.id = $1`, [liq.id]);
    decir(mov && mov.mo === v2.p && mov.categoria === "sueldos",
      `el egreso es por lo que se paga y va como sueldo (${mov ? mov.mo : "?"})`);
    decir(mov && mov.sesion_id === null,
      "se puede pagar por transferencia sin caja abierta");

    await c.query("savepoint dos");
    try {
      await c.query("select pagar_liquidacion($1, 'efectivo')", [liq.id]);
      await c.query("rollback to savepoint dos");
      decir(false, "no deja pagar dos veces la misma liquidación");
    } catch (e) {
      await c.query("rollback to savepoint dos");
      decir(e.code === "P0061", "no deja pagar dos veces la misma liquidación");
    }

    await c.query("savepoint rec");
    try {
      await c.query("select liquidar($1, $2, $3)", [SOFIA.id, desde, hasta]);
      await c.query("rollback to savepoint rec");
      decir(false, "no deja recalcular una liquidación ya pagada");
    } catch (e) {
      await c.query("rollback to savepoint rec");
      decir(e.code === "P0061", "no deja recalcular una liquidación ya pagada");
    }
  });

  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from liquidaciones where empresa_id = $1", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve las liquidaciones de otro");
  });
}

/* ------------------------------------------------------------
   15 · La ficha del cliente

   Lo que se prueba son las cuentas: que "vino tantas veces y faltó
   tantas" salga de los turnos y no de un contador, y que la asistencia no
   se hunda por los turnos que todavía no pasaron.
   ------------------------------------------------------------ */
console.log("\nFicha del cliente");

if (ALMHA) {
  await comoUsuario(PLATAFORMA, async () => {
    const cli = await una(
      `insert into clientes (empresa_id, razon_social, tel) values ($1, 'Ficha de prueba', '11 5555 5555') returning id`,
      [ALMHA.id]);

    const vacia = await una(
      "select turnos, asistio, ausencias, asistencia, gastado::float g, alertas from clientes_vista where id = $1", [cli.id]);
    decir(Number(vacia.turnos) === 0 && vacia.asistencia === null,
      "un cliente sin turnos no tiene asistencia que mostrar");

    /* Tres turnos pasados: dos vino y uno faltó. Y uno futuro, que no
       tiene que contar en la asistencia. */
    const cuando = (dias) => new Date(Date.now() + dias * 86400000).toISOString();
    for (const [d, e] of [[-30, "cumplida"], [-20, "cumplida"], [-10, "ausente"], [10, "confirmada"]]) {
      await c.query(
        `insert into reservas (empresa_id, cliente_id, nombre, desde, duracion_min, estado)
         values ($1, $2, 'Ficha de prueba', $3, 60, $4)`,
        [ALMHA.id, cli.id, cuando(d), e]);
    }

    const v = await una(
      "select turnos, asistio, ausencias, asistencia::float a, ultima, proxima from clientes_vista where id = $1", [cli.id]);
    decir(Number(v.turnos) === 4, `cuenta todos los turnos (${v.turnos})`);
    decir(Number(v.asistio) === 2 && Number(v.ausencias) === 1, "separa los que vino de los que faltó");
    decir(Math.abs(v.a - 2 / 3) < 0.01,
      `la asistencia no cuenta los turnos futuros (${Math.round(v.a * 100)}%)`);
    decir(!!v.ultima && !!v.proxima, "sabe cuándo vino la última vez y cuándo vuelve");

    /* Una alerta es lo que hay que ver antes de atenderla. */
    await c.query(
      `insert into cliente_notas (empresa_id, cliente_id, texto, destacada)
       values ($1, $2, 'Alérgica al glicólico', true)`, [ALMHA.id, cli.id]);
    await c.query(
      `insert into cliente_notas (empresa_id, cliente_id, texto) values ($1, $2, 'Prefiere a Carla')`,
      [ALMHA.id, cli.id]);

    const n = await una("select notas, alertas from clientes_vista where id = $1", [cli.id]);
    decir(Number(n.notas) === 2 && Number(n.alertas) === 1,
      "distingue una nota común de una que hay que ver antes");
  });

  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from cliente_notas where empresa_id = $1", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve las notas de los clientes de otro");
  });
}

/* ------------------------------------------------------------
   Ocupación

   El número propio de un negocio de turnos: cuánto de lo que se podía
   vender se vendió. Se prueba sobre una profesional inventada dentro de
   una transacción que se descarta, y en una ventana de fechas donde no
   hay nada cargado: así lo que devuelve la función es solo lo que puso
   esta prueba y no se mezcla con la historia de ejemplo de Almha.
   ------------------------------------------------------------ */
console.log("\nOcupación");

if (ALMHA) {
  await comoUsuario(PLATAFORMA, async () => {
    /* Bien lejos de la agenda sembrada, que llega hasta dos semanas. */
    const { dia } = await una("select (current_date + 200)::date as dia");
    const leer = async () => await una(
      `select ofrecidos::float o, ocupados::float u, lugares::float l, tomados::float t
         from informe_ocupacion($1, $2, $2) where nombre = 'Profe de prueba'`,
      [ALMHA.id, dia]);

    const per = await una(
      `insert into personal (empresa_id, nombre, tipo, especialidad, modalidad, valor)
       values ($1, 'Profe de prueba', 'profesional', 'Pilates', 'hora', 1000) returning id`,
      [ALMHA.id]);

    await c.query(
      `insert into horarios (empresa_id, personal_id, dia, desde, hasta)
       values ($1, $2, extract(dow from $3::date)::smallint, '09:00', '13:00')`,
      [ALMHA.id, per.id, dia]);

    const a = await leer();
    decir(a.o === 240, `las horas ofrecidas salen del horario cargado (${a.o / 60} hs)`);
    decir(a.u === 0, "sin nada agendado no hay nada ocupado");

    /* Una clase de seis con tres anotados. La clase ocupa la sala una
       hora, no tres: si se contaran las inscripciones, la ocupación de
       una profesora y las horas que se le liquidan contarían cosas
       distintas del mismo día de trabajo. */
    const clase = await una(
      `insert into reservas (empresa_id, personal_id, nombre, personas, desde, duracion_min, estado, cupo)
       values ($1, $2, 'Clase de prueba', 0, $3::date + time '10:00', 60, 'confirmada', 6) returning id`,
      [ALMHA.id, per.id, dia]);

    for (let i = 0; i < 3; i++) {
      await c.query(
        `insert into reservas (empresa_id, personal_id, clase_id, nombre, personas, desde, duracion_min, estado)
         values ($1, $2, $3, 'Anotada', 1, $4::date + time '10:00', 60, 'confirmada')`,
        [ALMHA.id, per.id, clase.id, dia]);
    }

    const b = await leer();
    decir(b.u === 60, `una clase ocupa una vez y no una por alumno (${b.u} min)`);
    decir(b.l === 6 && b.t === 3, "los lugares de la clase se cuentan aparte de las horas (3 de 6)");

    /* Un turno cancelado dejó el lugar libre: no ocupa. */
    await c.query(
      `insert into reservas (empresa_id, personal_id, nombre, personas, desde, duracion_min, estado)
       values ($1, $2, 'Se canceló', 1, $3::date + time '12:00', 60, 'cancelada')`,
      [ALMHA.id, per.id, dia]);

    const d = await leer();
    decir(d.u === 60, "lo cancelado no ocupa");

    /* Media jornada de ausencia tiene que restar media jornada, no el
       día entero: por eso la resta es una intersección de intervalos. */
    await c.query(
      `insert into excepciones (empresa_id, personal_id, desde, hasta, motivo)
       values ($1, $2, $3::date + time '09:00', $3::date + time '11:00', 'ausencia')`,
      [ALMHA.id, per.id, dia]);

    const e = await leer();
    decir(e.o === 120, `una ausencia resta solo las horas que pisa (${e.o / 60} hs)`);
  });

  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from informe_ocupacion($1, current_date - 30, current_date)", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve la ocupación de otro");
  });
}

/* ------------------------------------------------------------
   CRM

   Lo que se prueba no es que la lista salga: es que se vacíe. Un segmento
   que devuelve siempre a la misma gente es una pantalla que se deja de
   abrir a la semana.
   ------------------------------------------------------------ */
console.log("\nCRM");

if (ALMHA) {
  await comoUsuario(PLATAFORMA, async () => {
    const cuando = (dias) => new Date(Date.now() + dias * 86400000).toISOString();
    const enSegmento = async (k, cli) => (await una(
      "select count(*)::int n from crm_segmentos($1) where segmento = $2 and cliente_id = $3",
      [ALMHA.id, k, cli])).n;

    /* Alguien que vino cinco veces y hace tres meses que no aparece. */
    const cli = await una(
      `insert into clientes (empresa_id, razon_social, tel) values ($1, 'Se fue', '11 4444 4444') returning id`,
      [ALMHA.id]);
    for (const d of [-140, -130, -120, -110, -100]) {
      await c.query(
        `insert into reservas (empresa_id, cliente_id, nombre, desde, duracion_min, estado)
         values ($1, $2, 'Se fue', $3, 60, 'cumplida')`, [ALMHA.id, cli.id, cuando(d)]);
    }

    decir(await enSegmento("se_van", cli.id) === 1, "el que dejó de venir aparece en la lista");

    /* Un turno futuro lo saca: ya volvió, no hay nada que recuperar. */
    const proximo = await una(
      `insert into reservas (empresa_id, cliente_id, nombre, desde, duracion_min, estado)
       values ($1, $2, 'Se fue', $3, 60, 'confirmada') returning id`,
      [ALMHA.id, cli.id, cuando(5)]);
    decir(await enSegmento("se_van", cli.id) === 0, "con un turno agendado deja de aparecer");
    await c.query("delete from reservas where id = $1", [proximo.id]);

    /* Escribirle lo saca por tres semanas: es lo que hace que la lista se
       vacíe a medida que se trabaja. */
    await c.query(
      `insert into contactos (empresa_id, cliente_id, motivo, texto)
       values ($1, $2, 'se_van', 'Hola!')`, [ALMHA.id, cli.id]);
    decir(await enSegmento("se_van", cli.id) === 0, "después de escribirle sale de la lista");

    /* Pero solo por ese motivo: que se le haya avisado de un abono no
       significa que no haya que decirle que hace rato no viene. */
    await c.query("update contactos set fecha = now() - interval '30 days' where cliente_id = $1", [cli.id]);
    decir(await enSegmento("se_van", cli.id) === 1, "al mes vuelve a aparecer");

    await c.query(
      `insert into contactos (empresa_id, cliente_id, motivo) values ($1, $2, 'abono_vencido')`,
      [ALMHA.id, cli.id]);
    decir(await enSegmento("se_van", cli.id) === 1,
      "un mensaje por otro motivo no lo silencia");

    /* No molestar gana sobre todo lo demás. */
    await c.query(
      `update clientes set campos_extra = '{"noContactar": true}'::jsonb where id = $1`, [cli.id]);
    decir(await enSegmento("se_van", cli.id) === 0, "quien pidió no ser molestado no aparece en ningún segmento");

    /* Dos abonos vencidos son un mensaje, no dos. */
    const dos = await una(
      `insert into clientes (empresa_id, razon_social) values ($1, 'Dos abonos') returning id`, [ALMHA.id]);
    for (const d of [-25, -10]) {
      await c.query(
        `insert into abonos (empresa_id, cliente_id, nombre, clases, desde, vence)
         values ($1, $2, 'Pack 8 clases', 8, current_date - 60, current_date + $3::int)`,
        [ALMHA.id, dos.id, d]);
    }
    decir(await enSegmento("abono_vencido", dos.id) === 1,
      "dos abonos vencidos del mismo cliente son una sola fila");
  });

  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from crm_segmentos($1)", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve a los clientes de otro en el CRM");
    const k = await una("select count(*)::int n from contactos where empresa_id = $1", [ALMHA.id]);
    decir(k.n === 0, "un comercio no ve los contactos de otro");
  });
}

/* ------------------------------------------------------------
   Comunicaciones

   Lo que importa acá es la unidad: se avisa por turno y no por persona.
   Confundir las dos cosas hace que alguien con dos turnos en la semana
   reciba un solo recordatorio, y falte al otro.
   ------------------------------------------------------------ */
console.log("\nComunicaciones");

if (ALMHA) {
  await comoUsuario(PLATAFORMA, async () => {
    const cuando = (horas) => new Date(Date.now() + horas * 3600000).toISOString();
    const cli = await una(
      `insert into clientes (empresa_id, razon_social, tel) values ($1, 'Por avisar', '11 3333 3333') returning id`,
      [ALMHA.id]);

    const nuevo = async (horas, estado) => (await una(
      `insert into reservas (empresa_id, cliente_id, nombre, desde, duracion_min, estado)
       values ($1, $2, 'Por avisar', $3, 60, $4) returning id`,
      [ALMHA.id, cli.id, cuando(horas), estado])).id;

    const mios = async (horas) => (await una(
      "select count(*)::int n from comunicaciones_pendientes($1, $2) where cliente_id = $3",
      [ALMHA.id, horas, cli.id])).n;

    const martes = await nuevo(20, "confirmada");
    const jueves = await nuevo(60, "pendiente");

    decir(await mios(24) === 1, "en la ventana de 24 horas entra solo el turno de mañana");
    decir(await mios(72) === 2, "con la ventana más ancha entran los dos");

    /* Un turno pasado no se recuerda, y uno cancelado tampoco. */
    await nuevo(-5, "confirmada");
    const cancelado = await nuevo(10, "confirmada");
    await c.query("update reservas set estado = 'cancelada' where id = $1", [cancelado]);
    decir(await mios(72) === 2, "ni lo que ya pasó ni lo cancelado se avisa");

    /* Avisado el del martes, sigue apareciendo el del jueves: la unidad
       es el turno y no el cliente. */
    await c.query(
      `insert into contactos (empresa_id, cliente_id, reserva_id, motivo, texto)
       values ($1, $2, $3, 'recordatorio', 'Hola!')`, [ALMHA.id, cli.id, martes]);

    decir(await mios(72) === 1, "el turno avisado sale de la lista");
    const queda = await una(
      "select reserva_id from comunicaciones_pendientes($1, 72) where cliente_id = $2",
      [ALMHA.id, cli.id]);
    decir(queda.reserva_id === jueves, "el otro turno del mismo cliente sigue esperando su aviso");

    /* "No contactar" frena el marketing, no un recordatorio de turno. */
    await c.query(
      `update clientes set campos_extra = '{"noContactar": true}'::jsonb where id = $1`, [cli.id]);
    decir(await mios(72) === 1, "no contactar no frena el recordatorio de un turno");

    /* Una clase manda un mensaje por anotado, no uno solo. */
    const clase = (await una(
      `insert into reservas (empresa_id, nombre, personas, desde, duracion_min, estado, cupo)
       values ($1, 'Clase de aviso', 0, $2, 60, 'confirmada', 4) returning id`,
      [ALMHA.id, cuando(30)])).id;
    for (let i = 1; i <= 2; i++) {
      await c.query(
        `insert into reservas (empresa_id, clase_id, cliente_id, nombre, personas, desde, duracion_min, estado)
         values ($1, $2, $3, 'Anotada', 1, $4, 60, 'confirmada')`,
        [ALMHA.id, clase, cli.id, cuando(30)]);
    }
    const deLaClase = await una(
      "select count(*)::int n from comunicaciones_pendientes($1, 72) where reserva_id in (select id from reservas where clase_id = $2)",
      [ALMHA.id, clase]);
    decir(deLaClase.n === 2, "una clase avisa a cada anotado, no una sola vez");
    const contenedor = await una(
      "select count(*)::int n from comunicaciones_pendientes($1, 72) where reserva_id = $2",
      [ALMHA.id, clase]);
    decir(contenedor.n === 0, "la clase en sí no se avisa: no tiene a quién");

    /* Una plantilla propia pisa la de fábrica y se puede volver atrás. */
    await c.query(
      `insert into plantillas (empresa_id, clave, texto) values ($1, 'recordatorio', 'Texto propio')`,
      [ALMHA.id]);
    const p = await una(
      "select texto from plantillas where empresa_id = $1 and clave = 'recordatorio'", [ALMHA.id]);
    decir(p.texto === "Texto propio", "el comercio puede reescribir una plantilla");
  });

  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from comunicaciones_pendientes($1, 72)", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve los turnos por avisar de otro");
    const p = await una("select count(*)::int n from plantillas where empresa_id = $1", [ALMHA.id]);
    decir(p.n === 0, "un comercio no ve las plantillas de otro");
  });
}

/* ------------------------------------------------------------
   Permisos configurables

   Lo primero que hay que probar no es lo nuevo: es que lo viejo siga
   dando lo mismo. Dos políticas dejaron de nombrar roles a mano y
   pasaron a preguntar por un permiso, y si los valores de fábrica no
   reprodujeran exactamente lo de antes, tres comercios en producción
   cambiarían de comportamiento sin que nadie lo pidiera.
   ------------------------------------------------------------ */
console.log("\nPermisos configurables");

{
  /* La matriz de fábrica es la que estaba escrita en el código: dueño y
     encargado leen la bitácora y configuran; cajero y repositor no. */
  const base = await una(`
    select
      bool_and((permisos ->> 'verBitacora')::boolean) filter (where clave in ('dueno','encargado')) as mandan_ven,
      bool_or((permisos ->> 'verBitacora')::boolean)  filter (where clave in ('cajero','repositor')) as otros_ven,
      bool_and((permisos ->> 'configurar')::boolean)  filter (where clave in ('dueno','encargado')) as mandan_config,
      bool_or((permisos ->> 'configurar')::boolean)   filter (where clave in ('cajero','repositor')) as otros_config
    from roles_base`);
  decir(base.mandan_ven === true && base.otros_ven === false,
    "los valores de fábrica dan la misma respuesta que el viejo rol in ('dueno','encargado')");
  decir(base.mandan_config === true && base.otros_config === false,
    "y lo mismo para configurar el comercio");

  await comoUsuario(MOZO, async () => {
    const yo = await una("select public.permiso('verBitacora') v, public.permiso('configurar') c");
    decir(yo.v === true && yo.c === true, "un dueño sigue viendo la bitácora y configurando");

    const antes = await una("select count(*)::int n from bitacora where empresa_id = $1", [barId]);
    decir(antes.n >= 0, `lee la bitácora de su comercio (${antes.n} registros)`);

    /* Ahora se le apaga a su propio rol el permiso de ver la bitácora.
       Es lo que el módulo permite hacer, y la política tiene que
       enterarse sin que nadie toque una línea de SQL. */
    await c.query(
      `insert into roles (empresa_id, clave, permisos) values ($1, 'dueno', '{"verBitacora": false}'::jsonb)`,
      [barId]);

    const despues = await una("select count(*)::int n from bitacora where empresa_id = $1", [barId]);
    decir(despues.n === 0, "apagando el permiso, la bitácora deja de verse");
    decir((await una("select public.permiso('verBitacora') v")).v === false,
      "y el permiso da falso, no solo la lista vacía");

    /* Volver al original es borrar la fila, no copiar el texto de
       fábrica: así una corrección futura llega sola. */
    await c.query("delete from roles where empresa_id = $1 and clave = 'dueno'", [barId]);
    const vuelta = await una("select count(*)::int n from bitacora where empresa_id = $1", [barId]);
    /* Vuelve a verse, y con dos registros más: el cambio y la vuelta
       atrás. Que el propio módulo de permisos deje rastro de las dos
       cosas es la mitad de para qué existe. */
    decir(vuelta.n === antes.n + 2,
      `borrando el cambio vuelve a verse, con los dos actos anotados (${antes.n} → ${vuelta.n})`);

    /* El accidente que este módulo habilita, y que la base impide. */
    /* Con savepoint: el rechazo aborta la transacción, y sin volver a un
       punto guardado todo lo que sigue falla con "transaction is
       aborted" y la prueba miente diciendo que hay diez errores. */
    let rechazado = false;
    await c.query("savepoint intento");
    try {
      await c.query(
        `insert into roles (empresa_id, clave, permisos) values ($1, 'dueno', '{"configurar": false}'::jsonb)`,
        [barId]);
      await c.query("release savepoint intento");
    } catch (e) {
      rechazado = e.code === "P0070";
      await c.query("rollback to savepoint intento");
    }
    decir(rechazado, "no se puede uno sacar el permiso de configurar a sí mismo");

    /* A otro rol sí: es el punto del módulo. */
    await c.query(
      `insert into roles (empresa_id, clave, permisos) values ($1, 'cajero', '{"descuentos": true}'::jsonb)`,
      [barId]);
    const cajero = await una(
      `select ((select permisos from roles_base where clave = 'cajero')
               || (select permisos from roles where empresa_id = $1 and clave = 'cajero')) ->> 'descuentos' as d`,
      [barId]);
    decir(cajero.d === "true", "a otro rol sí se le puede cambiar una bandera");

    /* Y queda escrito quién lo hizo. Un módulo de permisos sin rastro es
       el único que no se puede auditar. */
    /* Se busca el acto concreto y no "el último": adentro de una
       transacción `now()` es el mismo para todas las filas, así que
       ordenar por fecha entre tres registros hermanos devuelve
       cualquiera de los tres. */
    const anotado = await una(
      `select count(*)::int n, max(detalle -> 'despues' ->> 'descuentos') as valor
         from bitacora
        where empresa_id = $1 and accion = 'permisos.cambiar' and detalle ->> 'rol' = 'cajero'`,
      [barId]);
    decir(anotado.n === 1 && anotado.valor === "true",
      "el cambio de permisos queda en la bitácora, con qué se cambió");
  });

  await comoUsuario(CAJERO, async () => {
    const v = await una("select count(*)::int n from roles where empresa_id = $1", [barId]);
    decir(v.n === 0, "un comercio no ve los roles de otro");
  });
}

/* ------------------------------------------------------------
   El informe del equipo

   Lo que se prueba es el reparto del abono, que es la única cuenta del
   informe que no se puede verificar mirando: si un pack de ocho clases
   se dividiera mal, el número seguiría pareciendo razonable.
   ------------------------------------------------------------ */
console.log("\nInforme del equipo");

if (ALMHA) {
  await comoUsuario(PLATAFORMA, async () => {
    const dia = (n) => new Date(Date.now() + n * 86400000).toISOString();

    const per = await una(
      `insert into personal (empresa_id, nombre, tipo, especialidad, modalidad, valor)
       values ($1, 'Profe del informe', 'profesional', 'Pilates', 'hora', 1000) returning id`,
      [ALMHA.id]);
    const otro = await una(
      `insert into personal (empresa_id, nombre, tipo, modalidad, valor)
       values ($1, 'Otro profe', 'profesional', 'hora', 1000) returning id`, [ALMHA.id]);
    const cli = await una(
      `insert into clientes (empresa_id, razon_social) values ($1, 'Del informe') returning id`, [ALMHA.id]);

    /* Un pack de $8.000 por dos clases. Se usan las dos: $4.000 cada una. */
    const op = await una(
      `insert into operaciones (id, empresa_id, tipo, estado, total, subtotal, fecha)
       values (gen_random_uuid(), $1, 'venta', 'confirmada', 8000, 8000, now()) returning id`,
      [ALMHA.id]);
    const ab = await una(
      `insert into abonos (empresa_id, cliente_id, operacion_id, nombre, clases, desde)
       values ($1, $2, $3, 'Pack de prueba', 2, current_date - 1) returning id`,
      [ALMHA.id, cli.id, op.id]);

    const clase = (await una(
      `insert into reservas (empresa_id, personal_id, nombre, personas, desde, duracion_min, estado, cupo)
       values ($1, $2, 'Clase del informe', 0, $3, 60, 'cumplida', 6) returning id`,
      [ALMHA.id, per.id, dia(-1)])).id;

    for (let i = 0; i < 2; i++) {
      await c.query(
        `insert into reservas (empresa_id, personal_id, clase_id, cliente_id, abono_id, nombre, personas, desde, duracion_min, estado)
         values ($1, $2, $3, $4, $5, 'Del informe', 1, $6, 60, 'cumplida')`,
        [ALMHA.id, per.id, clase, cli.id, ab.id, dia(-1)]);
    }

    const leer = async (filtros) => await una(
      `select turnos, cumplidos, clases, directo::float d, por_abono::float a
         from informe_equipo($1, current_date - 2, current_date, $2::jsonb)
        where personal_id = $3`,
      [ALMHA.id, JSON.stringify(filtros || {}), per.id]);

    const r = await leer();
    decir(Number(r.a) === 8000, `el abono se reparte entre las clases que se usaron (${r.a})`);
    decir(Number(r.d) === 0, "sin cobro directo, no inventa ingreso");
    decir(Number(r.turnos) === 2 && Number(r.clases) === 1,
      "cuenta dos personas atendidas en una sola clase dictada");

    /* Un turno suelto cobrado sí suma derecho. */
    const op2 = await una(
      `insert into operaciones (id, empresa_id, tipo, estado, total, subtotal, fecha)
       values (gen_random_uuid(), $1, 'venta', 'confirmada', 5000, 5000, now()) returning id`,
      [ALMHA.id]);
    await c.query(
      `insert into reservas (empresa_id, personal_id, cliente_id, operacion_id, nombre, personas, desde, duracion_min, estado)
       values ($1, $2, $3, $4, 'Del informe', 1, $5, 60, 'cumplida')`,
      [ALMHA.id, per.id, cli.id, op2.id, dia(-1)]);

    const r2 = await leer();
    decir(Number(r2.d) === 5000, "el turno cobrado suma su venta al profesional que lo dio");

    /* Y filtrando por otra persona, este no aparece. */
    const filtrado = await una(
      `select count(*)::int n from informe_equipo($1, current_date - 2, current_date, $2::jsonb)`,
      [ALMHA.id, JSON.stringify({ personal: otro.id })]);
    decir(filtrado.n === 1, "el filtro por profesional deja solo a esa persona");

    const ocu = await una(
      `select count(*)::int n from informe_ocupacion($1, current_date - 2, current_date, $2::jsonb)
        where ambito = 'profesional'`,
      [ALMHA.id, JSON.stringify({ personal: per.id })]);
    decir(ocu.n === 1, "la ocupación acepta el mismo filtro");
  });

  await comoUsuario(MOZO, async () => {
    const v = await una("select count(*)::int n from informe_equipo($1, current_date - 30, current_date)", [ALMHA.id]);
    decir(v.n === 0, "un comercio no ve el equipo de otro");
  });
}

/* ------------------------------------------------------------
   Los accesos

   Esto es lo que antes se "validaba en la aplicación", que es como decir
   que no se validaba: la política de `perfiles` era un `for all` con
   `puede_ver`, así que cualquier miembro del comercio podía correr un
   update sobre su propia fila y ponerse `rol = 'dueno'`. Nunca se notó
   porque cada comercio tenía un usuario.

   La primera prueba de acá es exactamente ese ataque. Si algún día
   alguien vuelve a poner un `for all` sobre `perfiles`, esta prueba se
   pone en rojo y no hay que darse cuenta leyendo.

   Los usuarios de prueba se crean y se tiran adentro de una sola
   transacción: no queda nada, ni en `auth.users` ni en `perfiles`.
   ------------------------------------------------------------ */
console.log("\nAccesos");

{
  const claims = (id) =>
    c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: id, role: "authenticated" })]);

  /* Un rechazo aborta la transacción: sin savepoint, todo lo que sigue
     falla con "transaction is aborted" y la prueba miente. Es la misma
     precaución que en Permisos configurables. */
  const intentar = async (sql, args = []) => {
    await c.query("savepoint i");
    try {
      const r = await c.query(sql, args);
      await c.query("release savepoint i");
      return { codigo: null, filas: r.rowCount };
    } catch (e) {
      await c.query("rollback to savepoint i");
      return { codigo: e.code, filas: 0 };
    }
  };

  await c.query("begin");
  try {
    /* Como administrador: dos personas en el bar, una que manda y otra
       que no. `auth.uid()` es null acá, que es el caso de las semillas y
       el que el disparador deja pasar. */
    const nuevo = async (email, nombre, rol) => {
      const u = await una(
        "insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email]);
      await c.query(
        "insert into perfiles (id, empresa_id, nombre, rol, email) values ($1, $2, $3, $4, $5)",
        [u.id, barId, nombre, rol, email]);
      return u.id;
    };

    const idCajero = await nuevo("cajero.prueba@genez.test", "Cajero de prueba", "cajero");
    const idDueno  = await nuevo("dueno.prueba@genez.test",  "Dueño de prueba",  "dueno");

    await c.query("set local role authenticated");

    /* ---- El ataque de antes ---- */
    await claims(idCajero);

    const ascenso = await intentar(
      "update perfiles set rol = 'dueno' where id = $1", [idCajero]);
    decir(ascenso.codigo === "P0073",
      "un cajero no puede ascenderse a dueño (era el agujero de 0002)");

    const plataforma = await intentar(
      "update perfiles set es_plataforma = true where id = $1", [idCajero]);
    decir(plataforma.codigo === "P0071",
      "ni marcarse como plataforma, que le abriría todos los comercios");

    const excepcion = await intentar(
      `update perfiles set permisos = '{"configurar": true}'::jsonb where id = $1`, [idCajero]);
    decir(excepcion.codigo === "P0073",
      "ni darse una excepción a sí mismo por la puerta de al lado");

    /* Sobre otro no hay error: la política simplemente no encuentra la
       fila. Es la trampa que este archivo explica arriba de todo. */
    const aOtro = await intentar(
      "update perfiles set rol = 'cajero' where id = $1", [idDueno]);
    decir(aOtro.codigo === null && aOtro.filas === 0,
      "no puede tocarle el rol a otro: la política no le encuentra la fila");

    const alta = await intentar(
      `insert into perfiles (id, empresa_id, nombre, rol)
       values (gen_random_uuid(), $1, 'Colado', 'dueno')`, [barId]);
    decir(alta.codigo === "42501", "ni dar de alta a nadie");

    /* Lo que sí puede: su propio nombre. Sin esto, alguien sin
       `configurar` no puede corregirse una falta de ortografía. */
    const nombre = await intentar(
      "update perfiles set nombre = 'Cajero corregido' where id = $1", [idCajero]);
    decir(nombre.codigo === null && nombre.filas === 1,
      "pero sí corregirse el propio nombre");

    /* ---- Lo que puede el que administra ---- */
    await claims(idDueno);

    const propio = await intentar(
      "update perfiles set rol = 'cajero' where id = $1", [idDueno]);
    decir(propio.codigo === "P0073",
      "el dueño tampoco se cambia el rol a sí mismo: se quedaría afuera");

    const propiaBaja = await intentar(
      "update perfiles set activo = false where id = $1", [idDueno]);
    decir(propiaBaja.codigo === "P0073", "ni se da de baja solo");

    const ajeno = await intentar(
      "update perfiles set rol = 'encargado' where id = $1", [idCajero]);
    decir(ajeno.codigo === null && ajeno.filas === 1,
      "a otro sí le cambia el rol, que es el punto del módulo");

    /* ---- La tercera capa ---- */
    await c.query("update perfiles set rol = 'cajero' where id = $1", [idCajero]);

    const deFabrica = await una(
      "select (permisos ->> 'cerrarCaja')::boolean b from roles_base where clave = 'cajero'");
    decir(deFabrica.b === false, "de fábrica un cajero no cierra la caja");

    await c.query(
      `update perfiles set permisos = '{"cerrarCaja": true}'::jsonb where id = $1`, [idCajero]);
    const conExcepcion = await una(
      "select (public.permisos_de($1) ->> 'cerrarCaja')::boolean b", [idCajero]);
    decir(conExcepcion.b === true,
      "una excepción por persona le gana al rol, sin inventar un rol nuevo");

    /* Y la excepción es la diferencia, no la foto: lo que no se tocó
       sigue saliendo del rol. Es lo que hace que una corrección futura
       del rol llegue igual a quien tiene una excepción sobre otra cosa. */
    const loDemas = await una(
      "select (public.permisos_de($1) ->> 'verCostos')::boolean b", [idCajero]);
    const rolDice = await una(
      "select (permisos ->> 'verCostos')::boolean b from roles_base where clave = 'cajero'");
    decir(loDemas.b === rolDice.b,
      "y lo que no se tocó lo sigue diciendo el rol");

    /* ---- La baja ---- */
    await c.query("update perfiles set activo = false where id = $1", [idCajero]);
    await claims(idCajero);
    const bajaCierra = await una("select public.permiso('cerrarCaja') b");
    decir(bajaCierra.b === false,
      "dado de baja no le queda ningún permiso, ni el de su excepción");

    /* ---- El rastro ---- */
    await c.query("reset role");
    const anotado = await una(
      `select count(*)::int n from bitacora
        where empresa_id = $1 and accion in ('acceso.crear','acceso.permisos','acceso.baja')`,
      [barId]);
    decir(anotado.n >= 3, `las altas, los cambios y la baja quedan en la bitácora (${anotado.n})`);
  } finally {
    await c.query("rollback");   // no queda ni el usuario ni el perfil
  }

  /* El aislamiento de la vista. Va aparte porque los usuarios de arriba
     ya no existen: acá se mira con los reales. */
  await comoUsuario(CAJERO, async () => {
    const v = await una("select count(*)::int n from accesos where empresa_id = $1", [barId]);
    decir(v.n === 0, "un comercio no ve los accesos de otro");
  });
}

/* ------------------------------------------------------------
   Nadie otorga lo que no tiene

   La regla que hacía falta para que `darAccesos` signifique algo. El
   encargado tiene `configurar`, o sea que edita roles, y podía editar el
   suyo: `no_dejarse_afuera` solo miraba que nadie se sacara `configurar`
   y nunca miró lo que alguien se agrega.

   Con eso vivo, apagarle una bandera al encargado era decorativo: se la
   prendía solo. Estas pruebas son ese ataque por las dos capas editables,
   porque si valiera solo para una la otra es el camino de al lado.
   ------------------------------------------------------------ */
console.log("\nEscalar permisos");

{
  const claims = (id) =>
    c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: id, role: "authenticated" })]);

  const intentar = async (sql, args = []) => {
    await c.query("savepoint i");
    try {
      const r = await c.query(sql, args);
      await c.query("release savepoint i");
      return { codigo: null, filas: r.rowCount };
    } catch (e) {
      await c.query("rollback to savepoint i");
      return { codigo: e.code, filas: 0 };
    }
  };

  /* De fábrica, y es lo que hace falta que siga siendo cierto para que la
     separación de 0049 tenga sentido. */
  const base = await una(`
    select
      (select (permisos ->> 'darAccesos')::boolean from roles_base where clave = 'dueno')     as dueno,
      (select (permisos ->> 'darAccesos')::boolean from roles_base where clave = 'encargado') as encargado,
      (select (permisos ->> 'configurar')::boolean from roles_base where clave = 'encargado') as enc_config`);
  decir(base.dueno === true && base.encargado === false,
    "de fábrica solo el dueño da accesos");
  decir(base.enc_config === true,
    "y el encargado conserva configurar, que es lo que hacía porosa la separación");

  await c.query("begin");
  try {
    const nuevo = async (email, nombre, rol) => {
      const u = await una(
        "insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email]);
      await c.query(
        "insert into perfiles (id, empresa_id, nombre, rol, email) values ($1, $2, $3, $4, $5)",
        [u.id, barId, nombre, rol, email]);
      return u.id;
    };

    const idEnc = await nuevo("enc.prueba@genez.test", "Encargado de prueba", "encargado");
    const idCaj = await nuevo("caj.prueba@genez.test", "Cajero de prueba", "cajero");

    await c.query("set local role authenticated");
    await claims(idEnc);

    decir((await una("select public.permiso('darAccesos') p")).p === false,
      "un encargado no puede dar accesos");
    decir((await una("select public.permiso('configurar') p")).p === true,
      "pero sí configurar, así que puede editar roles");

    /* El ataque: editarse el propio rol para prenderse la bandera. */
    const propio = await intentar(
      `insert into roles (empresa_id, clave, permisos) values ($1, 'encargado', '{"darAccesos": true}'::jsonb)`,
      [barId]);
    decir(propio.codigo === "P0075",
      "no puede prendérsela editando su propio rol");

    /* Y por la otra puerta: prendérsela a otro, que después se la
       devuelve. Da igual a quién: lo que no se puede es repartir lo que
       uno no tiene. */
    const aOtro = await intentar(
      `insert into roles (empresa_id, clave, permisos) values ($1, 'cajero', '{"darAccesos": true}'::jsonb)`,
      [barId]);
    decir(aOtro.codigo === "P0075",
      "ni prendérsela a otro rol para que se la devuelva");

    /* La capa de al lado: la excepción de una persona. Acá al encargado lo
       frena la política antes de llegar al disparador, porque escribir en
       `perfiles` ahora pide `darAccesos`. No da error: da cero filas, que
       es la trampa que este archivo explica arriba de todo. */
    const excepcion = await intentar(
      `update perfiles set permisos = '{"darAccesos": true}'::jsonb where id = $1`, [idCaj]);
    decir(excepcion.codigo === null && excepcion.filas === 0,
      "ni por la excepción de una persona: sin darAccesos no toca perfiles");

    /* Lo que sí puede: repartir lo que tiene. Si esto se rompiera, la
       regla sería demasiado estricta y el módulo quedaría inservible. */
    const suyo = await intentar(
      `insert into roles (empresa_id, clave, permisos) values ($1, 'cajero', '{"verCostos": true}'::jsonb)`,
      [barId]);
    decir(suyo.codigo === null,
      "sí puede dar una bandera que él tiene (verCostos)");

    /* Y revocar nunca se toca: sacar no escala. */
    const sacar = await intentar(
      `insert into roles (empresa_id, clave, permisos) values ($1, 'repositor', '{"anular": false}'::jsonb)`,
      [barId]);
    decir(sacar.codigo === null, "y revocar no lo frena nadie: sacar no escala");

    /* El dueño reparte todo, que es el punto de tener un dueño. */
    const idDue = await (async () => {
      await c.query("reset role");
      const id = await nuevo("due.prueba@genez.test", "Dueño de prueba", "dueno");
      await c.query("set local role authenticated");
      return id;
    })();
    await claims(idDue);

    decir((await una("select public.permiso('darAccesos') p")).p === true,
      "el dueño sí da accesos");
    const reparte = await intentar(
      `insert into roles (empresa_id, clave, permisos) values ($1, 'encargado', '{"darAccesos": true}'::jsonb)`,
      [barId]);
    decir(reparte.codigo === null,
      "y puede dárselo al encargado si quiere: lo que cambia es de qué lado arranca");

    /* Falta el caso que de verdad ejercita la regla sobre `perfiles`:
       alguien que SÍ pasa la política —tiene darAccesos— y aun así no
       puede repartir una bandera que no tiene. Se arma con un dueño al
       que una excepción le sacó `ajustes`: puede escribir en perfiles y
       no puede dar eso. Sin este caso, la regla en la capa de las
       excepciones queda sin probar y solo se estaría viendo la política. */
    await c.query("reset role");
    const idMocho = await nuevo("mocho.prueba@genez.test", "Dueño sin ajustes", "dueno");
    await c.query(
      `update perfiles set permisos = '{"ajustes": false}'::jsonb where id = $1`, [idMocho]);
    await c.query("set local role authenticated");
    await claims(idMocho);

    decir((await una("select public.permiso('darAccesos') p")).p === true
       && (await una("select public.permiso('ajustes') p")).p === false,
      "un dueño con una excepción encima puede dar accesos y no tiene ajustes");

    const reparteLoQueNoTiene = await intentar(
      `update perfiles set permisos = '{"ajustes": true}'::jsonb where id = $1`, [idCaj]);
    decir(reparteLoQueNoTiene.codigo === "P0075",
      "y aun pasando la política, no puede regalar por excepción lo que no tiene");

    const reparteLoQueSi = await intentar(
      `update perfiles set permisos = '{"cerrarCaja": true}'::jsonb where id = $1`, [idCaj]);
    decir(reparteLoQueSi.codigo === null && reparteLoQueSi.filas === 1,
      "pero sí lo que tiene");
  } finally {
    await c.query("rollback");
  }
}

/* ------------------------------------------------------------
   La identidad del cliente

   Lo único de este sistema que va a mirar gente de afuera del comercio.
   Ver 0050 y docs/modelo-identidad-del-cliente.md.

   Lo que se prueba acá no es que el cliente vea lo suyo —eso es la parte
   fácil— sino que NO vea lo ajeno, y sobre todo que no vea columnas que no
   le corresponden aunque la fila sí. Por eso el cliente lee funciones y no
   tablas: una política decide sobre la fila y deja pasar todas sus
   columnas, incluidas las que se agreguen mañana.
   ------------------------------------------------------------ */
console.log("\nLa identidad del cliente");

{
  const claims = (id) =>
    c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: id, role: "authenticated" })]);

  const intentar = async (sql, args = []) => {
    await c.query("savepoint i");
    try {
      const r = await c.query(sql, args);
      await c.query("release savepoint i");
      return { codigo: null, filas: r.rowCount };
    } catch (e) {
      await c.query("rollback to savepoint i");
      return { codigo: e.code, filas: 0 };
    }
  };

  await c.query("begin");
  try {
    const almha = (await una("select id from empresas where nombre = 'Almha'")).id;
    /* El del bar se toma acá y no más abajo: más abajo ya somos la
       clienta, y una clienta no ve ninguna empresa —que es justamente lo
       que se está probando—. */
    const barAjeno = (await una("select id from empresas where nombre = 'Bar Rivadavia'")).id;

    /* Una persona con ficha en Almha y cuenta enlazada. */
    const uCli = (await una(
      "insert into auth.users (id, email) values (gen_random_uuid(), 'clienta@genez.test') returning id")).id;
    const ficha = (await una(
      `insert into clientes (empresa_id, razon_social, usuario_id, enlazado_en)
       values ($1, 'Clienta de prueba', $2, now()) returning id`, [almha, uCli])).id;

    /* Otra clienta del mismo comercio, sin cuenta: es la que no se tiene
       que ver. Que sea del mismo comercio es el punto: aislar entre
       comercios ya estaba probado, lo nuevo es aislar adentro de uno. */
    const ajena = (await una(
      `insert into clientes (empresa_id, razon_social) values ($1, 'Otra clienta') returning id`,
      [almha])).id;

    const prof = (await una("select id from personal where empresa_id = $1 limit 1", [almha])).id;
    const serv = (await una(
      "select id from items where empresa_id = $1 and tipo = 'servicio' limit 1", [almha])).id;

    await c.query(
      `insert into reservas (empresa_id, cliente_id, nombre, desde, duracion_min, estado, personal_id, item_id, notas)
       values ($1, $2, 'Clienta de prueba', now() + interval '2 days', 60, 'pendiente', $3, $4, 'NOTA INTERNA')`,
      [almha, ficha, prof, serv]);
    await c.query(
      `insert into reservas (empresa_id, cliente_id, nombre, desde, duracion_min, estado, personal_id, item_id, notas)
       values ($1, $2, 'Otra clienta', now() + interval '3 days', 60, 'pendiente', $3, $4, 'NOTA AJENA')`,
      [almha, ajena, prof, serv]);

    await c.query("set local role authenticated");
    await claims(uCli);

    /* ---- Lo que no ve ---- */
    for (const t of ["empresas", "clientes", "reservas", "items", "operaciones", "perfiles", "personal", "abonos"]) {
      const n = (await una(`select count(*)::int n from ${t}`)).n;
      decir(n === 0, `no lee ${t} directamente (${n} filas)`);
    }

    /* ---- Lo que sí ---- */
    const mias = await c.query("select * from public.mis_fichas()");
    decir(mias.rowCount === 1 && mias.rows[0].mis_fichas === ficha,
      "mis_fichas devuelve su ficha y solo la suya");

    const com = await c.query("select * from public.mis_comercios()");
    decir(com.rowCount === 1 && com.rows[0].nombre === "Almha",
      "mis_comercios devuelve Almha y ningún otro");

    const turnos = await c.query("select * from public.mis_turnos()");
    decir(turnos.rowCount === 1, `ve su turno y no el de la otra clienta (${turnos.rowCount})`);
    decir(turnos.rows[0] && turnos.rows[0].servicio !== null,
      "el turno viene con el nombre del servicio, no en null");
    decir(turnos.rows[0] && turnos.rows[0].profesional !== null,
      "y con el profesional");

    /* La razón por la que esto son funciones y no políticas. */
    const columnas = Object.keys(turnos.rows[0] || {});
    decir(!columnas.includes("notas"),
      "el turno NO trae `notas`: eso lo escribe recepción para adentro");

    /* Las clases usadas se cuentan por `abono_id`, no por el rango de
       fechas del abono. Contar los turnos que caen entre `desde` y `vence`
       cuenta también los que se pagaron sueltos o con otro abono
       solapado: con datos reales, a una clienta de Almha le daba
       "Pack 4 clases: 24 de 4". */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    const abono = (await una(
      `insert into abonos (empresa_id, cliente_id, nombre, clases, desde, vence)
       values ($1, $2, 'Pack de prueba', 4, current_date - 10, current_date + 20) returning id`,
      [almha, ficha])).id;
    /* Dos con el abono y una suelta, las tres adentro de la ventana. */
    for (const [dias, conAbono] of [[-3, true], [-2, true], [-1, false]]) {
      await c.query(
        `insert into reservas (empresa_id, cliente_id, nombre, desde, duracion_min, estado, abono_id)
         values ($1, $2, 'Clienta de prueba', now() + ($3 || ' days')::interval, 60, 'confirmada', $4)`,
        [almha, ficha, dias, conAbono ? abono : null]);
    }
    await c.query("set local role authenticated");
    await claims(uCli);

    const abo = await c.query("select * from public.mis_abonos()");
    const pack = abo.rows.find((x) => x.nombre === "Pack de prueba");
    decir(pack && Number(pack.usadas) === 2,
      `las clases usadas se cuentan por abono, no por fecha (${pack && pack.usadas} de 3 turnos en la ventana)`);

    const cat = await c.query("select * from public.catalogo_de($1)", [almha]);
    decir(cat.rowCount > 0, `ve el catálogo de servicios de Almha (${cat.rowCount})`);
    decir(!Object.keys(cat.rows[0] || {}).includes("costo"),
      "y el catálogo NO trae el costo");

    const catAjeno = await c.query("select * from public.catalogo_de($1)", [barAjeno]);
    decir(catAjeno.rowCount === 0,
      "no ve el catálogo de un comercio del que no es cliente");

    /* ---- Que no escriba nada ---- */
    const escribir = await intentar(
      `insert into reservas (empresa_id, cliente_id, nombre, desde) values ($1, $2, 'Colada', now())`,
      [almha, ficha]);
    decir(escribir.codigo === "42501", "no puede insertar un turno por su cuenta");

    const robar = await intentar(
      "update clientes set usuario_id = $1 where id = $2", [uCli, ajena]);
    decir(robar.codigo === null && robar.filas === 0,
      "ni enlazarse la ficha de otra persona");

    /* ---- Las dos categorías no se mezclan ---- */
    /* Se vuelve a administrador Y se limpian los claims. Solo con `reset
       role` la sesión sigue diciendo que auth.uid() es la clienta, y el
       insert de abajo termina anotando en la bitácora un usuario que no
       está en `perfiles`. Eso destapó un problema real de 0048, arreglado
       en 0050: la bitácora daba por sentado que todo autenticado es
       personal, y desde que hay clientes eso dejó de ser cierto. */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");

    const comoPersonal = await intentar(
      `insert into perfiles (id, empresa_id, nombre, rol) values ($1, $2, 'Colada', 'dueno')`,
      [uCli, almha]);
    decir(comoPersonal.codigo === "P0080",
      "una cuenta de cliente no puede recibir un perfil de personal");

    const uPer = (await una(
      "insert into auth.users (id, email) values (gen_random_uuid(), 'moza@genez.test') returning id")).id;
    await c.query(
      "insert into perfiles (id, empresa_id, nombre, rol) values ($1, $2, 'Moza', 'cajero')", [uPer, almha]);
    const alReves = await intentar(
      "update clientes set usuario_id = $1 where id = $2", [uPer, ajena]);
    decir(alReves.codigo === "P0080",
      "y una cuenta de personal no puede enlazarse como cliente");

    const dosVeces = await intentar(
      `insert into clientes (empresa_id, razon_social, usuario_id) values ($1, 'Duplicada', $2)`,
      [almha, uCli]);
    decir(dosVeces.codigo === "P0081",
      "una cuenta no puede tener dos fichas en el mismo comercio");
  } finally {
    await c.query("rollback");
  }
}

/* ------------------------------------------------------------
   Las reglas de reserva

   Tres capas, como los permisos: un piso conservador, lo de fábrica del
   rubro, y lo que el comercio cambió. Lo que se prueba es que las tres se
   apilen en ese orden y que un comercio que no tocó nada se lleve las
   correcciones del rubro.

   Y sobre todo que ninguna vuelva null: esta función la va a llamar la
   que reserva, y una regla en null se lee como "sin restricción", que es
   lo peor que puede pasar cuando lo que falta es justamente el límite.
   ------------------------------------------------------------ */
console.log("\nReglas de reserva");

{
  const CLAVES = ["anticipacionMin", "cancelacionHoras", "tardeConsume",
                  "permiteCancelar", "requiereHistorial", "avisarMismoDia"];

  const almhaId = (await una("select id from empresas where nombre = 'Almha'")).id;
  const barId2  = (await una("select id from empresas where nombre = 'Bar Rivadavia'")).id;

  const rAlmha = (await una("select public.reglas_de($1) r", [almhaId])).r;
  const rBar   = (await una("select public.reglas_de($1) r", [barId2])).r;

  decir(CLAVES.every((k) => rAlmha[k] !== null && rAlmha[k] !== undefined),
    "ninguna regla vuelve null: sin límite sería peor que un límite equivocado");

  decir(rAlmha.anticipacionMin === 60 && rAlmha.cancelacionHoras === 3,
    "servicios trae las de fábrica de su rubro (60 min, 3 h)");

  decir(rBar.cancelacionHoras === 24 && rBar.permiteCancelar === false,
    "un rubro que no definió reglas cae en el piso conservador, no en las de otro");

  await c.query("begin");
  try {
    await c.query(
      `update empresas set config = config || '{"turnos":{"cancelacionHoras":6}}'::jsonb where id = $1`,
      [almhaId]);
    const cambiado = (await una("select public.reglas_de($1) r", [almhaId])).r;
    decir(cambiado.cancelacionHoras === 6,
      "lo que el comercio cambia le gana al rubro");
    decir(cambiado.anticipacionMin === 60,
      "y lo que no tocó sigue saliendo del rubro, no se congela");

    /* La razón de guardar la diferencia y no la foto: si mañana el rubro
       corrige un valor, al comercio que nunca lo tocó le llega solo. */
    await c.query(
      `update rubros set reglas = reglas || '{"anticipacionMin":30}'::jsonb where clave = 'servicios'`);
    const conCorreccion = (await una("select public.reglas_de($1) r", [almhaId])).r;
    decir(conCorreccion.anticipacionMin === 30,
      "una corrección del rubro llega sola al comercio que no la tocó");
    decir(conCorreccion.cancelacionHoras === 6,
      "y no le pisa lo que sí había cambiado");
  } finally {
    await c.query("rollback");
  }

  /* Cambiarlas es configurar el comercio: no hay permiso nuevo, es el que
     ya protege la ficha de la empresa desde 0045. */
  await comoUsuario(CAJERO, async () => {
    const v = await c.query(
      `update empresas set config = config || '{"turnos":{"cancelacionHoras":99}}'::jsonb where id = $1`,
      [almhaId]);
    decir(v.rowCount === 0, "un comercio no puede cambiarle las reglas a otro");
  });
}

/* ------------------------------------------------------------
   La marca y los módulos del cliente

   `marca_de` es la única función del sistema que puede llamar alguien sin
   sesión, así que es la que más cuidado pide: lo que devuelva es público
   para siempre. Se prueba que devuelva la marca y nada más, y que ser
   anónimo no abra ninguna otra puerta.

   Y que la navegación se calcule. Es lo que hace que el motor sea uno
   solo: un comercio sin `agenda` no muestra Turnos sin que nadie escriba
   un `if`.
   ------------------------------------------------------------ */
console.log("\nMarca y módulos del cliente");

{
  const almhaM = (await una("select id, slug from empresas where nombre = 'Almha'"));
  const barM   = (await una("select id, slug from empresas where nombre = 'Bar Rivadavia'"));

  decir(almhaM.slug === "almha", `el slug sale del nombre (${almhaM.slug})`);
  decir(barM.slug === "bar-rivadavia", `y limpia los espacios (${barM.slug})`);

  /* ---- Lo público, siendo nadie ---- */
  await c.query("begin");
  try {
    await c.query("set local role anon");

    const marca = await c.query("select * from public.marca_de('almha')");
    decir(marca.rowCount === 1, "sin sesión se puede leer la marca de un comercio");

    const campos = Object.keys(marca.rows[0] || {});
    decir(!campos.includes("id") && !campos.includes("modulos") && !campos.includes("config"),
      "y devuelve solo marca: ni el id, ni los módulos, ni la configuración");

    decir((await c.query("select * from public.marca_de('no-existe')")).rowCount === 0,
      "un slug que no existe devuelve vacío, no un error que confirme nada");

    for (const t of ["empresas", "clientes", "reservas", "items", "abonos"]) {
      const n = (await una(`select count(*)::int n from ${t}`)).n;
      decir(n === 0, `ser anónimo no abre ${t} (${n} filas)`);
    }
  } finally {
    await c.query("rollback");
  }

  /* ---- La navegación se calcula ---- */
  const navDe = async (id) =>
    (await c.query("select * from public.modulos_del_cliente($1)", [id])).rows.map((x) => x.clave);

  const navAlmha = await navDe(almhaM.id);
  const navBar   = await navDe(barM.id);

  decir(navAlmha.includes("turnos") && navAlmha.includes("plan"),
    `Almha ve Turnos y Mi plan: tiene agenda y ventas (${navAlmha.join(", ")})`);
  decir(!navBar.includes("turnos"),
    `el bar no ve Turnos porque no tiene agenda (${navBar.join(", ")})`);
  decir(navBar.includes("inicio") && navBar.includes("cuenta"),
    "pero Inicio y Cuenta están siempre: son el piso");

  decir(!navAlmha.includes("beneficios"),
    "Beneficios no le aparece a nadie: pide un módulo de gestión que no existe");

  await c.query("begin");
  try {
    /* Lo que el comercio decide: apagar y renombrar. */
    await c.query(
      `update empresas set config = config ||
         '{"cliente":{"apagados":{"plan":true},"nombres":{"turnos":"Clases"}}}'::jsonb
        where id = $1`, [almhaM.id]);

    const nav = await c.query("select * from public.modulos_del_cliente($1)", [almhaM.id]);
    decir(!nav.rows.some((x) => x.clave === "plan"),
      "el comercio puede apagar un módulo que sí contrató");
    decir(nav.rows.find((x) => x.clave === "turnos")?.nombre === "Clases",
      "y renombrarlo: un gimnasio le dice Clases a lo que una estética le dice Turnos");

    /* Y lo que decide la plataforma: si la pantalla existe. */
    await c.query("update modulos_cliente set activo = true where clave = 'pagos'");
    decir((await navDe(almhaM.id)).includes("pagos"),
      "construir una pantalla la hace aparecer sola, sin tocar el front");
    decir(!(await navDe(barM.id)).includes("pagos"),
      "y solo a quien tenga el módulo de gestión que la alimenta");

    /* Descontratar el módulo de gestión se lleva puesta la pantalla del
       cliente: es la relación que hace que no haya pantallas sin datos.

       Va con la identidad de la plataforma porque `proteger_lo_comercial`
       impide que un comercio se cambie sus propios módulos —"los cambia
       Genez, no el comercio"—, que es exactamente lo que tiene que hacer.
       La primera versión de esta prueba lo hacía como administrador sin
       sesión y el disparador la frenó, con razón. */
    const plataforma = await una(
      "select id from perfiles where es_plataforma = true limit 1");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: plataforma.id, role: "authenticated" })]);

    await c.query(
      "update empresas set modulos = array_remove(modulos, 'agenda') where id = $1", [almhaM.id]);
    decir(!(await navDe(almhaM.id)).includes("turnos"),
      "y descontratar agenda le saca Turnos: no queda una pantalla sin datos detrás");

    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
  } finally {
    await c.query("rollback");
  }
}

/* ------------------------------------------------------------
   Los horarios libres

   Lo que la app le ofrece al cliente para reservar. Dos formas —clases
   publicadas con lugar, y huecos calculados— con la misma forma de
   salida, para que la pantalla dibuje una lista y no dos.

   Lo que más importa probar no es que ofrezca: es que **no ofrezca lo que
   no corresponde**. Un horario mostrado y después rechazado es la peor
   manera de decir que no.
   ------------------------------------------------------------ */
console.log("\nHorarios libres");

{
  const almhaH = (await una("select id from empresas where nombre = 'Almha'")).id;
  const barH   = (await una("select id from empresas where nombre = 'Bar Rivadavia'")).id;

  await c.query("begin");
  try {
    /* El usuario va ADENTRO de la transacción. Afuera queda commiteado, y
       la segunda corrida falla por correo duplicado —además de dejar un
       usuario de prueba en una base real—. Es lo mismo que ya había
       pasado con la bitácora: una prueba que escribe fuera de su
       transacción no es una prueba, es un alta. */
    const uCli = (await una(
      "insert into auth.users (id, email) values (gen_random_uuid(), 'reserva@genez.test') returning id")).id;

    const ficha = (await una(
      `insert into clientes (empresa_id, razon_social, usuario_id, enlazado_en)
       values ($1, 'Clienta que reserva', $2, now()) returning id`, [almhaH, uCli])).id;

    const enClase = await una(
      `select id, nombre from items where empresa_id = $1 and nombre = 'Pilates Reformer'`, [almhaH]);
    const individual = await una(
      `select id, nombre from items where empresa_id = $1 and nombre = 'Masaje Relajante'`, [almhaH]);

    /* La zona del comercio: sin esto, un horario de agenda de las 10 se
       arma como las 10 UTC y los huecos salen tres horas corridos
       respecto de los turnos reales. */
    decir((await una("select public.zona_horaria_de($1) z", [almhaH])).z ===
          "America/Argentina/Buenos_Aires",
      "un comercio sin zona configurada cae en una de fábrica, no en UTC");

    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: uCli, role: "authenticated" })]);

    const servicios = await c.query("select * from public.servicios_del_cliente($1)", [almhaH]);
    decir(servicios.rowCount > 0, `ve los servicios del comercio (${servicios.rowCount})`);
    decir(!Object.keys(servicios.rows[0] || {}).includes("costo"),
      "y siguen sin traer el costo");
    decir(servicios.rows.find((s) => s.nombre === "Pilates Reformer")?.en_clase === true,
      "sabe que Pilates Reformer se da en clase, porque el comercio publicó clases");
    decir(servicios.rows.find((s) => s.nombre === "Masaje Relajante")?.en_clase === false,
      "y que un masaje no: nadie publicó clases de eso");

    /* ---- Las dos formas ---- */
    const clases = await c.query(
      "select * from public.horarios_libres($1, $2, current_date, current_date + 14)",
      [almhaH, enClase.id]);
    decir(clases.rows.every((r) => r.clase_id !== null),
      "un servicio con clases devuelve clases, no huecos inventados");
    /* Cambió en 0056: una clase llena ahora se muestra con `lugares` en
       cero, para poder anotarse en la lista de espera. Lo que sigue sin
       poder pasar —que se muestre llena Y sin espera habilitada— lo cubre
       la sección "Lista de espera". Acá alcanza con que ninguna venga con
       lugares negativos, que sería una cuenta rota. */
    decir(clases.rows.every((r) => r.lugares >= 0),
      "las clases vienen con sus lugares, y una llena viene en cero");

    const huecos = await c.query(
      "select * from public.horarios_libres($1, $2, current_date, current_date + 7)",
      [almhaH, individual.id]);
    decir(huecos.rows.every((r) => r.clase_id === null),
      "un servicio sin clases devuelve huecos calculados");
    decir(huecos.rows.every((r) => r.profesional !== null),
      "y cada hueco dice con quién: sale de personal_servicios, no de cualquiera");

    /* ---- Lo que no tiene que ofrecer ---- */
    const reglas = (await una("select public.reglas_de($1) r", [almhaH])).r;
    const minimo = new Date(Date.now() + reglas.anticipacionMin * 60000);
    const todos = [...clases.rows, ...huecos.rows];
    decir(todos.every((r) => new Date(r.desde) >= minimo),
      `nada dentro de los ${reglas.anticipacionMin} minutos de anticipación mínima`);

    decir((await c.query(
      "select * from public.horarios_libres($1, $2, current_date, current_date + 7)",
      [barH, enClase.id])).rowCount === 0,
      "y nada de un comercio del que no es cliente");

    /* La clase en la que ya está anotada no se ofrece: no es una opción,
       es una confusión. */
    if (clases.rowCount > 0) {
      const laClase = clases.rows[0].clase_id;
      await c.query("reset role");
      await c.query("select set_config('request.jwt.claims', '', true)");
      await c.query(
        `insert into reservas (empresa_id, cliente_id, clase_id, nombre, desde, duracion_min, estado)
         select $1, $2, $3, 'Clienta que reserva', desde, duracion_min, 'confirmada'
           from reservas where id = $3`, [almhaH, ficha, laClase]);
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub: uCli, role: "authenticated" })]);

      const despues = await c.query(
        "select * from public.horarios_libres($1, $2, current_date, current_date + 14)",
        [almhaH, enClase.id]);
      decir(!despues.rows.some((r) => r.clase_id === laClase),
        "la clase en la que ya está anotada deja de ofrecerse");
    }
  } finally {
    await c.query("rollback");
  }
}

/* ------------------------------------------------------------
   Reservar desde la app

   Se tocaron `agendar_turno` e `inscribir`, que usa el mostrador desde
   0032 y 0034. Lo primero que se prueba es que sigan siendo las mismas
   para él: abrirle la puerta al cliente no puede cambiarle nada a quien
   ya las usaba.

   Y después las reglas de 0051, que es lo que hace que el sistema diga
   que no cuando corresponde.
   ------------------------------------------------------------ */
console.log("\nReservar desde la app");

{
  const almhaR = (await una("select id from empresas where nombre = 'Almha'")).id;
  const enClaseR = await una(
    "select id from items where empresa_id = $1 and nombre = 'Pilates Reformer'", [almhaR]);

  const intentar = async (sql, args = []) => {
    await c.query("savepoint i");
    try {
      const r = await c.query(sql, args);
      await c.query("release savepoint i");
      return { codigo: null, fila: r.rows[0] || null };
    } catch (e) {
      await c.query("rollback to savepoint i");
      return { codigo: e.code, mensaje: e.message };
    }
  };

  await c.query("begin");
  try {
    const u = (await una(
      "insert into auth.users (id, email) values (gen_random_uuid(), 'reservante@genez.test') returning id")).id;
    const ficha = (await una(
      `insert into clientes (empresa_id, razon_social, usuario_id, enlazado_en)
       values ($1, 'Clienta nueva', $2, now()) returning id`, [almhaR, u])).id;

    /* Una clase futura con lugar, creada acá para no depender de que la
       semilla tenga una: una prueba que depende de datos que alguien
       puede borrar no es una prueba. */
    const clase = (await una(
      `insert into reservas (empresa_id, nombre, desde, duracion_min, estado, cupo, item_id, personas)
       values ($1, 'Clase de prueba', now() + interval '3 days', 60, 'confirmada', 2, $2, 0)
       returning id`, [almhaR, enClaseR.id])).id;

    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    const reservar = (extra) =>
      intentar("select public.reservar_como_cliente($1) r",
        [JSON.stringify({ empresa_id: almhaR, ...extra })]);

    /* ---- La regla contra el turno fantasma ---- */
    const primeraVez = await reservar({ clase_id: clase });
    decir(primeraVez.codigo === "P0094",
      "quien nunca vino no puede tomar un lugar sin pagar");

    /* Con abono ya pagó, así que puede. */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    const abono = (await una(
      `insert into abonos (empresa_id, cliente_id, nombre, clases, desde, vence)
       values ($1, $2, 'Pack de prueba', 4, current_date - 1, current_date + 30)
       returning id`, [almhaR, ficha])).id;
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    const conAbono = await reservar({ clase_id: clase });
    decir(conAbono.codigo === null && conAbono.fila.r.id,
      "con un abono vigente sí puede: ya pagó");

    /* ---- Y el abono se gasta ---- */
    const usadas = await c.query("select * from public.mis_abonos()");
    decir(Number(usadas.rows.find((a) => a.nombre === "Pack de prueba")?.usadas) === 1,
      "la clase se descuenta del abono, sin que nadie lo haga a mano");

    /* ---- Dos veces en la misma clase ---- */
    const repetida = await reservar({ clase_id: clase });
    decir(repetida.codigo === "P0093" || repetida.codigo === "P0046",
      "no se puede anotar dos veces en la misma clase");

    /* ---- Dos turnos a la misma hora ---- */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    const otraClase = (await una(
      `insert into reservas (empresa_id, nombre, desde, duracion_min, estado, cupo, item_id, personas)
       select $1, 'Otra a la misma hora', desde, duracion_min, 'confirmada', 3, item_id, 0
         from reservas where id = $2 returning id`, [almhaR, clase])).id;
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    const choque = await reservar({ clase_id: otraClase });
    decir(choque.codigo === "P0093",
      "ni tener dos turnos a la misma hora: no puede estar en dos lados");

    /* ---- La anticipación mínima ---- */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    const yaMismo = (await una(
      `insert into reservas (empresa_id, nombre, desde, duracion_min, estado, cupo, item_id, personas)
       values ($1, 'Ya empieza', now() + interval '10 minutes', 60, 'confirmada', 5, $2, 0)
       returning id`, [almhaR, enClaseR.id])).id;
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    decir((await reservar({ clase_id: yaMismo })).codigo === "P0091",
      "nada dentro de la anticipación mínima del comercio");

    /* ---- El aviso, que no impide ---- */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    const mismoDia = (await una(
      `insert into reservas (empresa_id, nombre, desde, duracion_min, estado, cupo, item_id, personas)
       select $1, 'Mas tarde el mismo dia', desde + interval '4 hours', duracion_min,
              'confirmada', 5, item_id, 0
         from reservas where id = $2 returning id`, [almhaR, clase])).id;
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    const conAviso = await reservar({ clase_id: mismoDia });
    decir(conAviso.codigo === null, "dos turnos el mismo día sí se puede");
    decir(conAviso.fila && conAviso.fila.r.aviso !== null,
      "pero avisa, y el aviso viene de la base y no de la pantalla");

    /* ---- Otro comercio ---- */
    decir((await intentar("select public.reservar_como_cliente($1) r",
      [JSON.stringify({ empresa_id: barId, clase_id: clase })])).codigo === "P0090",
      "no puede reservar en un comercio del que no es cliente");
  } finally {
    await c.query("rollback");
  }
}

/* ------------------------------------------------------------
   Cancelar desde la app

   Lo que se prueba de fondo es la decisión de modelo: una cancelación
   tardía queda como `cancelada` y no como `ausente`, para que el lugar se
   libere pero los informes no cuenten como falta a alguien que avisó.
   ------------------------------------------------------------ */
console.log("\nCancelar desde la app");

{
  const almhaC = (await una("select id from empresas where nombre = 'Almha'")).id;
  const itemC = (await una(
    "select id from items where empresa_id = $1 and nombre = 'Pilates Reformer'", [almhaC])).id;

  const intentar = async (sql, args = []) => {
    await c.query("savepoint i");
    try {
      const r = await c.query(sql, args);
      await c.query("release savepoint i");
      return { codigo: null, fila: r.rows[0] || null };
    } catch (e) {
      await c.query("rollback to savepoint i");
      return { codigo: e.code };
    }
  };

  await c.query("begin");
  try {
    const u = (await una(
      "insert into auth.users (id, email) values (gen_random_uuid(), 'cancela@genez.test') returning id")).id;
    const ficha = (await una(
      `insert into clientes (empresa_id, razon_social, usuario_id, enlazado_en)
       values ($1, 'Clienta que cancela', $2, now()) returning id`, [almhaC, u])).id;
    const abono = (await una(
      `insert into abonos (empresa_id, cliente_id, nombre, clases, desde, vence)
       values ($1, $2, 'Pack cancelar', 4, current_date - 1, current_date + 30) returning id`,
      [almhaC, ficha])).id;

    /* Uno cómodo (dentro de dos días) y uno sobre la hora. Las reglas de
       Almha son 3 horas para cancelar sin costo. */
    const aTiempo = (await una(
      `insert into reservas (empresa_id, cliente_id, item_id, abono_id, nombre, desde, duracion_min, estado)
       values ($1, $2, $3, $4, 'x', now() + interval '2 days', 60, 'confirmada') returning id`,
      [almhaC, ficha, itemC, abono])).id;
    const sobreLaHora = (await una(
      `insert into reservas (empresa_id, cliente_id, item_id, abono_id, nombre, desde, duracion_min, estado)
       values ($1, $2, $3, $4, 'x', now() + interval '90 minutes', 60, 'confirmada') returning id`,
      [almhaC, ficha, itemC, abono])).id;
    const sinAbono = (await una(
      `insert into reservas (empresa_id, cliente_id, item_id, nombre, desde, duracion_min, estado)
       values ($1, $2, $3, 'x', now() + interval '90 minutes', 60, 'confirmada') returning id`,
      [almhaC, ficha, itemC])).id;

    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    decir(Number((await c.query("select * from public.mis_abonos()")).rows
      .find((a) => a.nombre === "Pack cancelar")?.usadas) === 2,
      "arranca con dos clases tomadas del pack");

    /* ---- A tiempo ---- */
    const t = await intentar("select public.cancelar_como_cliente($1) r", [aTiempo]);
    decir(t.codigo === null && t.fila.r.tarde === false,
      "cancelar con anticipación no es tarde");
    decir(Number((await c.query("select * from public.mis_abonos()")).rows
      .find((a) => a.nombre === "Pack cancelar")?.usadas) === 1,
      "y devuelve la clase al abono");

    /* ---- Sobre la hora, con abono ---- */
    const tar = await intentar("select public.cancelar_como_cliente($1) r", [sobreLaHora]);
    decir(tar.codigo === null && tar.fila.r.tarde === true && tar.fila.r.consumio === true,
      "cancelar dentro de las 3 horas es tarde y gasta la clase");
    decir(Number((await c.query("select * from public.mis_abonos()")).rows
      .find((a) => a.nombre === "Pack cancelar")?.usadas) === 1,
      "la clase sigue contada aunque el turno esté cancelado");

    /* ---- Sobre la hora, sin abono ---- */
    const deuda = await intentar("select public.cancelar_como_cliente($1) r", [sinAbono]);
    decir(deuda.codigo === null && Number(deuda.fila.r.adeuda) > 0,
      `sin abono queda un cargo anotado ($${deuda.fila?.r?.adeuda})`);

    /* ---- La decisión de modelo ---- */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    const como = await una(
      "select estado, campos_extra ->> 'cancelacionTarde' tarde from reservas where id = $1",
      [sobreLaHora]);
    decir(como.estado === "cancelada",
      "una cancelación tardía queda como cancelada, no como ausente: el lugar se libera");
    decir(como.tarde === "true",
      "y por qué se cobró queda escrito en la reserva, no deducido de la hora");

    /* Que no ensucie los informes es la razón de todo esto. */
    decir((await una(
      "select count(*)::int n from reservas where cliente_id = $1 and estado = 'ausente'",
      [ficha])).n === 0,
      "y no aparece como ausencia: avisó, no faltó");

    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    /* ---- Lo que no se puede ---- */
    decir((await intentar("select public.cancelar_como_cliente($1) r", [aTiempo])).codigo === "P0097",
      "no se cancela dos veces");

    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    const ajeno = (await una(
      `insert into reservas (empresa_id, nombre, desde, duracion_min, estado)
       values ($1, 'De otra persona', now() + interval '2 days', 60, 'confirmada') returning id`,
      [almhaC])).id;
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    decir((await intentar("select public.cancelar_como_cliente($1) r", [ajeno])).codigo === "P0095",
      "ni el turno de otra persona");

    /* ---- Y la pantalla sabe cuándo puede ---- */
    const turnos = await c.query("select * from public.mis_turnos()");
    decir(turnos.rows.every((t) => t.puede_cancelar !== null),
      "cada turno dice si se puede cancelar, para que la pantalla no lo calcule aparte");
    const cancelado = turnos.rows.find((t) => t.id === aTiempo);
    decir(cancelado && cancelado.puede_cancelar === false,
      "y uno ya cancelado dice que no");
  } finally {
    await c.query("rollback");
  }
}

/* ------------------------------------------------------------
   La lista de espera

   Lo que más importa probar es lo que NO hace: no promueve a nadie. Es
   una decisión de 0034 —"liberar un lugar y meter a alguien sin avisarle
   es peor que el problema"— y una prueba es la única forma de que siga
   siendo cierta cuando alguien la quiera "mejorar".
   ------------------------------------------------------------ */
console.log("\nLista de espera");

{
  const almhaE = (await una("select id from empresas where nombre = 'Almha'")).id;
  const itemE = (await una(
    "select id from items where empresa_id = $1 and nombre = 'Pilates Reformer'", [almhaE])).id;

  const intentar = async (sql, args = []) => {
    await c.query("savepoint i");
    try {
      const r = await c.query(sql, args);
      await c.query("release savepoint i");
      return { codigo: null, fila: r.rows[0] || null };
    } catch (e) {
      await c.query("rollback to savepoint i");
      return { codigo: e.code };
    }
  };

  await c.query("begin");
  try {
    const u = (await una(
      "insert into auth.users (id, email) values (gen_random_uuid(), 'espera@genez.test') returning id")).id;
    const ficha = (await una(
      `insert into clientes (empresa_id, razon_social, usuario_id, enlazado_en)
       values ($1, 'Clienta en espera', $2, now()) returning id`, [almhaE, u])).id;
    await c.query(
      `insert into abonos (empresa_id, cliente_id, nombre, clases, desde, vence)
       values ($1, $2, 'Pack espera', 4, current_date - 1, current_date + 30)`, [almhaE, ficha]);

    /* Una clase de un lugar, y ese lugar ocupado por otra persona. */
    const otra = (await una(
      `insert into clientes (empresa_id, razon_social) values ($1, 'La que llegó primero') returning id`,
      [almhaE])).id;
    const llena = (await una(
      `insert into reservas (empresa_id, nombre, desde, duracion_min, estado, cupo, item_id, personas)
       values ($1, 'Clase llena', now() + interval '3 days', 60, 'confirmada', 1, $2, 0)
       returning id`, [almhaE, itemE])).id;
    await c.query(
      `insert into reservas (empresa_id, cliente_id, clase_id, nombre, desde, duracion_min, estado)
       select $1, $2, $3, 'La que llegó primero', desde, duracion_min, 'confirmada'
         from reservas where id = $3`, [almhaE, otra, llena]);

    const conLugar = (await una(
      `insert into reservas (empresa_id, nombre, desde, duracion_min, estado, cupo, item_id, personas)
       values ($1, 'Clase con lugar', now() + interval '4 days', 60, 'confirmada', 3, $2, 0)
       returning id`, [almhaE, itemE])).id;

    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    /* ---- Una clase llena ahora se ve ---- */
    const antes = await c.query(
      "select * from public.horarios_libres($1, $2, current_date, current_date + 7)",
      [almhaE, itemE]);
    const laLlena = antes.rows.find((r) => r.clase_id === llena);
    decir(!!laLlena, "una clase llena se ve, en vez de desaparecer sin explicación");
    decir(laLlena && laLlena.lugares === 0, "y dice que no tiene lugar");
    decir(laLlena && laLlena.en_espera === false, "y que todavía no está anotada");

    /* ---- Anotarse ---- */
    const anotada = await intentar("select public.anotarme_en_espera($1) r", [llena]);
    decir(anotada.codigo === null && Number(anotada.fila.r.lugar) === 1,
      "se anota y queda primera en la fila");

    decir((await intentar("select public.anotarme_en_espera($1) r", [llena])).codigo === "P00A2",
      "no se anota dos veces en la misma clase");

    /* Si hay lugar, se reserva y no se espera. */
    decir((await intentar("select public.anotarme_en_espera($1) r", [conLugar])).codigo === "P00A1",
      "en una clase con lugar no se espera: se reserva");

    const esperas = await c.query("select * from public.mis_esperas()");
    decir(esperas.rowCount === 1 && esperas.rows[0].clase_id === llena,
      "ve dónde está esperando");
    decir(esperas.rows[0].servicio !== null,
      "con el nombre del servicio, no un identificador");

    /* ---- Lo que NO hace ---- */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    await c.query(
      "update reservas set estado = 'cancelada' where clase_id = $1 and cliente_id = $2",
      [llena, otra]);
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    decir((await c.query("select * from public.mis_turnos()")).rows
      .every((t) => t.id !== llena),
      "cuando se libera un lugar NO la mete sola: eso lo avisa el comercio");
    decir((await c.query("select * from public.mis_esperas()")).rowCount === 1,
      "sigue esperando hasta que alguien le avise");

    /* Y ahora que hay lugar, la puede reservar. */
    const reserva = await intentar("select public.reservar_como_cliente($1) r",
      [JSON.stringify({ empresa_id: almhaE, clase_id: llena })]);
    decir(reserva.codigo === null, "y cuando le avisan, la reserva como cualquier otra");

    /* ---- Bajarse ---- */
    await c.query("select public.salir_de_espera($1)", [llena]);
    decir((await c.query("select * from public.mis_esperas()")).rowCount === 0,
      "puede bajarse de la lista");

    /* ---- Si el comercio no la habilita ---- */
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
    await c.query(
      `update empresas set config = config || '{"turnos":{"esperaDesdeApp":false}}'::jsonb where id = $1`,
      [almhaE]);
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: u, role: "authenticated" })]);

    /* Esto tenía un `|| true` que la hacía pasar pase lo que pase. Una
       prueba que no puede fallar es peor que no tenerla: ocupa un renglón
       en verde y no verifica nada. */
    decir((await intentar("select public.anotarme_en_espera($1) r", [llena])).codigo === "P00A0",
      "con la espera apagada, el comercio la maneja desde el local");
    const sinEspera = await c.query(
      "select * from public.horarios_libres($1, $2, current_date, current_date + 7)",
      [almhaE, itemE]);
    decir(sinEspera.rows.every((r) => r.lugares > 0),
      "y las clases llenas vuelven a no mostrarse: no se ofrece una lista que nadie mira");
  } finally {
    await c.query("rollback");
  }
}

/* ------------------------------------------------------------
   El alta de una clienta en la app

   Lo que 0061 vino a habilitar: que el comercio enlace una ficha con una
   cuenta, en vez de que alguien corra SQL a mano.

   El enlace en sí no tiene función propia —es un `update` sobre
   `clientes` con el token de quien llama— así que lo que hay que
   verificar es que RLS y los tres disparadores de 0050 sigan siendo lo
   que decide qué enlace es posible. Y que el permiso nuevo llegue por
   las tres capas.

   Todos los usuarios se crean adentro de la transacción y se van con el
   rollback.
   ------------------------------------------------------------ */
console.log("\nEl alta de una clienta en la app");

await c.query("begin");
try {
  const intentar = async (sql, args = []) => {
    await c.query("savepoint i");
    try {
      const r = await c.query(sql, args);
      await c.query("release savepoint i");
      return { codigo: null, filas: r.rowCount };
    } catch (e) {
      await c.query("rollback to savepoint i");
      return { codigo: e.code, mensaje: e.message, filas: 0 };
    }
  };
  const claims = (id) => c.query("select set_config('request.jwt.claims', $1, true)",
    [JSON.stringify({ sub: id, role: "authenticated" })]);

  const almha = await una("select id from empresas where nombre = 'Almha'");
  const bar   = await una("select id from empresas where nombre = 'Bar Rivadavia'");

  /* Como administrador: una dueña de Almha, dos fichas sin enlazar, dos
     cuentas sueltas y una cuenta que además trabaja en el bar. */
  const cuenta = async (email) => (await una(
    "insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [email])).id;

  const ficha = async (empresa, nombre) => (await una(
    `insert into clientes (empresa_id, razon_social, condicion)
     values ($1, $2, 'CF') returning id`, [empresa, nombre])).id;

  const idDuena = await cuenta("duena.alta@genez.test");
  await c.query(
    "insert into perfiles (id, empresa_id, nombre, rol, email) values ($1, $2, 'Dueña de prueba', 'dueno', $3)",
    [idDuena, almha.id, "duena.alta@genez.test"]);

  const idCajera = await cuenta("cajera.alta@genez.test");
  await c.query(
    "insert into perfiles (id, empresa_id, nombre, rol, email) values ($1, $2, 'Cajera de prueba', 'cajero', $3)",
    [idCajera, almha.id, "cajera.alta@genez.test"]);

  const idClienta = await cuenta("clienta.alta@genez.test");
  const idOtra    = await cuenta("otra.alta@genez.test");

  const fAlmha  = await ficha(almha.id, "Clienta de prueba");
  const fAlmha2 = await ficha(almha.id, "Otra clienta de prueba");
  const fBar    = await ficha(bar.id,   "Clienta del bar");

  await c.query("set local role authenticated");
  await claims(idDuena);

  /* ---- El permiso, por las tres capas ---- */

  decir((await una("select public.permiso('darAppClientes') p")).p === true,
    "la dueña puede invitar clientas a la app");

  await claims(idCajera);
  decir((await una("select public.permiso('darAppClientes') p")).p === false,
    "la cajera no, de fábrica");

  /* Y que sea un permiso aparte y no un alias de darAccesos: si fueran lo
     mismo, prenderle uno a recepción le daría el alta de empleados. */
  await claims(idDuena);
  const p = await una(
    "select (public.permisos_de($1) ->> 'darAppClientes')::boolean a, (public.permisos_de($1) ->> 'darAccesos')::boolean b",
    [idCajera]);
  decir(p.a === false && p.b === false, "los dos apagados en la cajera");
  await c.query(
    `update perfiles set permisos = '{"darAppClientes": true}'::jsonb where id = $1`, [idCajera]);
  const p2 = await una(
    "select (public.permisos_de($1) ->> 'darAppClientes')::boolean a, (public.permisos_de($1) ->> 'darAccesos')::boolean b",
    [idCajera]);
  decir(p2.a === true && p2.b === false,
    "prenderle invitar clientas no le da el alta de empleados: son dos permisos");

  /* ---- El enlace ---- */

  await claims(idDuena);

  const ok = await intentar(
    "update clientes set usuario_id = $1, enlazado_en = now() where id = $2 and empresa_id = $3",
    [idClienta, fAlmha, almha.id]);
  decir(ok.codigo === null && ok.filas === 1, "enlaza una ficha propia con una cuenta");

  decir((await una("select usuario_id from clientes where id = $1", [fAlmha])).usuario_id === idClienta,
    "y la ficha queda apuntando a esa cuenta");

  /* ---- Lo que la base impide, y no depende de ningún permiso ---- */

  const dosVeces = await intentar(
    "update clientes set usuario_id = $1 where id = $2 and empresa_id = $3",
    [idClienta, fAlmha2, almha.id]);
  decir(dosVeces.codigo === "P0081",
    "la misma cuenta no puede tener dos fichas del mismo comercio");

  const esPersonal = await intentar(
    "update clientes set usuario_id = $1 where id = $2 and empresa_id = $3",
    [idCajera, fAlmha2, almha.id]);
  decir(esPersonal.codigo === "P0080",
    "no se puede enlazar la cuenta de alguien que trabaja en el comercio");

  const ajena = await intentar(
    "update clientes set usuario_id = $1 where id = $2", [idOtra, fBar]);
  decir(ajena.filas === 0,
    "y no puede tocar una ficha de otro comercio: RLS no la ve siquiera");

  /* La otra dirección: darle acceso al sistema a quien ya es clienta. */
  const alReves = await intentar(
    "insert into perfiles (id, empresa_id, nombre, rol) values ($1, $2, 'No', 'cajero')",
    [idClienta, almha.id]);
  decir(alReves.codigo === "P0080",
    "y una clienta no puede pasar a ser personal sin una cuenta aparte");

  /* ---- Lo que sí tiene que poder ---- */

  await c.query("set local role postgres");
  const enElBar = await c.query(
    "update clientes set usuario_id = $1 where id = $2", [idClienta, fBar]);
  decir(enElBar.rowCount === 1,
    "la misma cuenta sí puede ser clienta de otro comercio: es el diseño de mis_fichas");

  /* ---- Buscar por correo es solo del servidor ---- */

  await c.query("set local role authenticated");
  await claims(idDuena);
  const oraculo = await intentar("select public.usuario_por_correo('clienta.alta@genez.test')");
  decir(oraculo.codigo === "42501",
    "nadie del comercio puede averiguar si un correo tiene cuenta: eso lo hace el servidor");

  /* ---- Y quitarle el acceso no borra nada ---- */

  const quitar = await intentar(
    "update clientes set usuario_id = null, enlazado_en = null where id = $1 and empresa_id = $2",
    [fAlmha, almha.id]);
  decir(quitar.filas === 1, "se le puede quitar el acceso");
  const queda = await una("select razon_social, usuario_id from clientes where id = $1", [fAlmha]);
  decir(queda.usuario_id === null && queda.razon_social === "Clienta de prueba",
    "y la ficha queda entera: el comercio la atendió y eso no desaparece");
} finally {
  await c.query("rollback");
}

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien.");
await c.end();
process.exitCode = fallas ? 1 : 0;
