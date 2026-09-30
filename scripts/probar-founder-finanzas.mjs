/* ============================================================
   PRUEBA · finanzas, ajustes y equipo de Founder (0118)
   ============================================================

   En una transacción que se deshace, como el fundador y como miembros
   con una sola área. Si 0118 no está aplicada, la aplica adentro. Los
   meses de prueba son de 2031, donde no hay nada real.

     node scripts/probar-founder-finanzas.mjs
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
const intentar = async (sql, p) => {
  await c.query("savepoint s");
  try { const r = await c.query(sql, p); await c.query("release savepoint s"); return { r }; }
  catch (e) { await c.query("rollback to savepoint s"); return { e }; }
};
const como = async (u) => {
  await c.query("reset role");
  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u, role: "authenticated" })]);
};

try {
  await c.query("begin");
  await c.query("set local lock_timeout = '3s'");
  /* Si la prueba se corta a mitad de camino, el pooler puede dejar la sesión
     abierta y con sus bloqueos: la base la cierra sola (y la deshace). */
  await c.query("set local idle_in_transaction_session_timeout = '60s'");
  if (!(await una("select to_regclass('public.interno_movimientos') t")).t) {
    await c.query(readFileSync("supabase/migrations/0118_interno_finanzas.sql", "utf8"));
  }
  const A = (await una("select id from perfiles where es_plataforma limit 1")).id;
  const C = (await una("select p.id, p.email from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Super 25' limit 1"));
  const D = (await una("select p.id, p.email from perfiles p join empresas e on e.id = p.empresa_id where e.nombre = 'Bar Rivadavia' limit 1"));
  const ganada = (await una("select id from interno_etapas where tipo = 'ganada' order by orden limit 1")).id;
  await como(A);

  console.log("\nCuentas y movimientos");
  const k = await una("insert into interno_cuentas (nombre, saldo_inicial, saldo_inicial_fecha) values ('Banco de prueba', 100000, '2031-01-01') returning id");
  await c.query(`insert into interno_movimientos (tipo, concepto, categoria, importe, periodo, estado, fecha_pago, cuenta_id) values
    ('ingreso', 'Implementación de prueba', 'implementacion', 50000, '2031-01-01', 'pagado', '2031-01-15', $1),
    ('gasto', 'Hosting de prueba', 'hosting', 20000, '2031-01-01', 'pagado', '2031-01-20', $1),
    ('gasto', 'Dominio de prueba', 'dominios', 5000, '2031-01-01', 'pendiente', null, $1),
    ('ingreso', 'Cobro viejo', 'otro', 999, '2030-12-01', 'pagado', '2030-12-20', $1)`, [k.id]);
  decir(Number((await una("select saldo from interno_cuentas_vista where id = $1", [k.id])).saldo) === 130000,
    "el saldo es el inicial más lo cobrado menos lo pagado desde esa fecha; lo pendiente y lo anterior no cuentan");
  let x = await intentar("insert into interno_movimientos (tipo, concepto, importe, periodo, estado) values ('ingreso', 'x', 10, '2031-01-01', 'pagado')");
  decir(x.e && /interno_movimientos_pago/.test(x.e.message), "pagado sin fecha de pago: no");
  x = await intentar("insert into interno_movimientos (tipo, concepto, importe, periodo) values ('ingreso', 'x', 10, '2031-01-15')");
  decir(x.e && /interno_movimientos_periodo/.test(x.e.message), "el período es un mes (su primer día)");
  x = await intentar("insert into interno_movimientos (tipo, concepto, importe, periodo) values ('gasto', 'x', 0, '2031-01-01')");
  decir(x.e && /interno_movimientos_importe/.test(x.e.message), "sin importes en cero ni negativos");
  x = await intentar("insert into interno_movimientos (tipo, concepto, importe, periodo, fijo) values ('ingreso', 'x', 10, '2031-01-01', true)");
  decir(x.e && /interno_movimientos_fijo/.test(x.e.message), "solo un gasto puede ser fijo");

  console.log("\nSuscripciones");
  const p = await una("insert into interno_prospectos (nombre) values ('Cliente con suscripción') returning id");
  const op = await una("select id from interno_oportunidades where prospecto_id = $1", [p.id]);
  await c.query("update interno_oportunidades set etapa_id = $1, valor = 30000 where id = $2", [ganada, op.id]);
  const cli = (await una("select interno_convertir_en_cliente($1, jsonb_build_object('alta', '2031-01-05', 'sin_implementacion', true)) id", [op.id])).id;
  const s = await una("insert into interno_suscripciones (cliente_id, plan, importe_mensual, inicio, dia_cobro) values ($1, 'Pro', 40000, '2031-01-05', 10) returning id", [cli]);
  decir(Number((await una("select importe_mensual from interno_clientes where id = $1", [cli])).importe_mensual) === 40000,
    "el importe del cliente pasa a ser el de sus suscripciones activas (40.000, no los 30.000 de la venta)");
  await c.query("update interno_suscripciones set importe_mensual = 52000 where id = $1", [s.id]);
  const cam = await una("select importe_antes, importe_despues from interno_suscripciones_cambios where suscripcion_id = $1 and importe_antes is not null", [s.id]);
  decir(cam && Number(cam.importe_antes) === 40000 && Number(cam.importe_despues) === 52000, "el aumento queda en el historial: de ahí sale la expansión");
  x = await intentar("insert into interno_suscripciones_cambios (suscripcion_id, fecha) values ($1, '2031-01-01')", [s.id]);
  decir(x.e && /permission denied/.test(x.e.message), "el historial no se escribe a mano");

  console.log("\nLos cobros del mes");
  decir((await una("select interno_generar_cobros('2031-02-17') n")).n === 1, "generar los cobros de febrero crea uno");
  const cobro = await una("select * from interno_movimientos where suscripcion_id = $1", [s.id]);
  decir(cobro.periodo.toISOString().slice(0, 10) === "2031-02-01" && Number(cobro.importe) === 52000 && cobro.estado === "pendiente"
    && cobro.vencimiento.toISOString().slice(0, 10) === "2031-02-10", "pendiente, del mes, con el importe de hoy y vence el día de cobro");
  decir((await una("select interno_generar_cobros('2031-02-01') n")).n === 0, "generarlos de nuevo no duplica");
  decir((await una("select interno_generar_cobros('2030-12-01') n")).n === 0, "un mes antes del alta no genera nada");
  await c.query("update interno_movimientos set estado = 'anulado' where id = $1", [cobro.id]);
  decir((await una("select interno_generar_cobros('2031-02-01') n")).n === 1, "si el cobro se anuló, se puede generar otro");

  x = await intentar("update interno_suscripciones set estado = 'baja' where id = $1", [s.id]);
  decir(x.e && /interno_suscripciones_baja/.test(x.e.message), "una baja necesita su fecha");
  await c.query("update interno_suscripciones set estado = 'baja', fin = '2031-03-31', motivo_baja = 'Cerró el local' where id = $1", [s.id]);
  decir(Number((await una("select importe_mensual from interno_clientes where id = $1", [cli])).importe_mensual) === 0, "dada de baja, el cliente queda sin importe");
  decir((await una("select fecha from interno_suscripciones_cambios where suscripcion_id = $1 and estado_despues = 'baja'", [s.id])).fecha.toISOString().slice(0, 10) === "2031-03-31",
    "la baja queda en el historial con su fecha");

  console.log("\nAjustes y equipo");
  await c.query(`update interno_ajustes set valor = '{"hora_inicio": 8, "hora_fin": 21}' where clave = 'agenda'`);
  decir((await una("select count(*)::int n from interno_historial where tabla = 'interno_ajustes' and fila_id = 'agenda'")).n >= 1, "un cambio de ajustes queda en el historial (por su clave)");
  const bus = await una("select * from interno_buscar_perfil($1)", [D.email]);
  decir(bus && bus.id === D.id && bus.es_de_un_comercio === true && bus.ya_es_miembro === false, "el administrador encuentra una cuenta por su mail, y ve que es de un comercio");
  decir((await intentar("select * from interno_buscar_perfil('')")).r.rows.length === 0, "un mail vacío no trae a nadie");

  console.log("\nLas áreas");
  await c.query("reset role");
  await c.query("insert into interno_miembros (perfil_id, rol, areas) values ($1, 'administracion', array['finanzas'])", [D.id]);
  await como(D.id);
  decir((await una("select count(*)::int n from interno_movimientos")).n >= 4, "un miembro de finanzas ve los movimientos");
  decir((await una("select count(*)::int n from interno_clientes")).n === 0, "pero no los clientes");
  decir((await una("select count(*)::int n from interno_suscripciones_vista where id = $1", [s.id])).n === 1, "y sí las suscripciones, aunque sin el nombre del cliente");
  x = await intentar("select interno_buscar_perfil($1)", [C.email]);
  decir(x.e && /administrador/.test(x.e.message), "no puede buscar cuentas: no administra el equipo");
  x = await intentar(`update interno_ajustes set valor = '{}' where clave = 'empresa'`);
  decir(!x.e && x.r.rowCount === 0, "ni cambiar los ajustes: no tiene 'config'");
  await c.query("reset role");
  await c.query("update interno_miembros set areas = array['crm'] where perfil_id = $1", [D.id]);
  await como(D.id);
  decir((await una("select count(*)::int n from interno_movimientos")).n === 0 && (await una("select count(*)::int n from interno_cuentas_vista")).n === 0,
    "con otra área, las finanzas no se ven");
  x = await intentar("select interno_generar_cobros('2031-02-01')");
  decir(x.e && /Sin acceso a finanzas/.test(x.e.message), "ni se generan cobros");
  await como(C.id);
  decir((await una("select count(*)::int n from interno_movimientos")).n === 0 && (await una("select count(*)::int n from interno_suscripciones")).n === 0,
    "el dueño de un comercio no ve nada de esto");
  x = await intentar("select * from interno_buscar_perfil($1)", [D.email]);
  decir(x.e && /administrador/.test(x.e.message), "ni busca cuentas");
} catch (err) {
  decir(false, `se cortó: ${err.message}`);
} finally {
  await c.query("rollback").catch(() => {});
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien. No quedó nada escrito.");
process.exitCode = fallas ? 1 : 0;
