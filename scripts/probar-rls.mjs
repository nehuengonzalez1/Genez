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
  /* Un lunes a las 9 hora de Buenos Aires, que es cuando Sofía trabaja. */
  const CUANDO = (await una(
    `select (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
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
  const CUANDO = (await una(
    `select (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires')
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

console.log(fallas ? `\n${fallas} prueba(s) fallaron.` : "\nTodo bien.");
await c.end();
process.exitCode = fallas ? 1 : 0;
