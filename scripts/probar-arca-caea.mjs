/* ============================================================
   PRUEBA · el CAEA contra el ARCA de pruebas (homologación)
   ============================================================

   probar-caea.mjs prueba la lógica con un ARCA de mentira; esta habla con
   el de homologación para saber si ARCA acepta lo que Genez manda:
   pedir (o consultar) el CAEA de la quincena, emitir con él "con ARCA
   caído" (la caída se simula: ARCA de pruebas está en pie) e informar el
   comprobante con FECAEARegInformativo.

   ESCRIBE DE VERDAD EN LA BASE, Y SE LIMPIA POR ID
   ------------------------------------------------
   Como probar-arca-ab.mjs: un comercio temporal que se borra por su id
   pase lo que pase, y al final se verifica tabla por tabla que no quedó
   nada. Los CAEA y los comprobantes son de homologación: sin validez.

   El punto de venta CAEA se elige entre los del CUIT compartido que ARCA
   tiene sin usar (último número 0), porque Genez numera desde el 1 y
   otro usuario de Afip SDK pudo haber informado en el que elijamos.

     node scripts/probar-arca-caea.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
if (!env.AFIP_ACCESS_TOKEN || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Falta AFIP_ACCESS_TOKEN o SUPABASE_SERVICE_ROLE_KEY en el .env.");
  process.exit(1);
}
process.env.AFIP_ACCESS_TOKEN = env.AFIP_ACCESS_TOKEN;
const { facturarVenta, clienteArca, CUIT_PRUEBAS } = await import("../api/arca/_arca.js");
const { ponerAlDia, informarPendientes } = await import("../api/arca/_caea.js");

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();
const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };

const restos = async (id) => (await una(`select
  (select count(*) from empresas where id = $1)::int as empresas,
  (select count(*) from operaciones where empresa_id = $1)::int as operaciones,
  (select count(*) from comprobantes where empresa_id = $1)::int as comprobantes,
  (select count(*) from caea_informes where empresa_id = $1)::int as informes,
  (select count(*) from arca_caea where empresa_id = $1)::int as caeas,
  (select count(*) from arca_conexiones where empresa_id = $1)::int as conexiones`, [id]));

const { id: emp } = await una(
  `insert into empresas (nombre, config) values ('Prueba CAEA (se borra sola)', $1) returning id`,
  [JSON.stringify({ fiscal: { condicion: "RI", razonSocial: "Prueba CAEA", cuit: CUIT_PRUEBAS } })]
);

try {
  const conexion = { empresa_id: emp, modo: "homologacion", punto_venta: 6 };
  const afip = await clienteArca(admin, conexion);

  /* Un punto sin usar en ningún tipo: si otro usuario lo usó con CAE
     aunque sea para la C, ARCA lo toma como punto de CAE y rechaza el
     informe (error 1444, visto el 29/09). Con --pv=N se fuerza uno. */
  const forzado = Number((process.argv.find((a) => a.startsWith("--pv=")) || "").slice(5)) || null;
  let pvCaea = forzado;
  for (let pv = 700; pv < 760 && !pvCaea; pv++) {
    let libre = true;
    for (const t of [1, 6, 11]) if (Number(await afip.ElectronicBilling.getLastVoucher(pv, t)) !== 0) { libre = false; break; }
    if (libre) pvCaea = pv;
  }
  decir(!!pvCaea, `punto de venta CAEA sin usar en homologación: ${pvCaea}`);
  if (!pvCaea) throw new Error("no hay punto libre entre 700 y 759");

  await c.query("insert into arca_conexiones (empresa_id, punto_venta, punto_venta_caea) values ($1, 6, $2)", [emp, pvCaea]);
  const con = { ...conexion, punto_venta_caea: pvCaea };

  console.log("\nPedir el CAEA de la quincena");
  const estado = await ponerAlDia({ admin, afip, conexion: con, cuit: CUIT_PRUEBAS });
  decir(estado.caeas.length >= 1 && !estado.errores.filter((e) => /pedir/.test(e)).length, `CAEA de ${estado.caeas.join(" y ")} (${estado.errores.join("; ") || "sin errores"})`);

  console.log("\nEmitir con ARCA \"caído\"");
  const venta = randomUUID();
  await c.query("insert into operaciones (id, empresa_id, tipo, total, subtotal, comprobante) values ($1, $2, 'venta', 2315, 2315, $3)", [venta, emp, JSON.stringify({ fiscal: true })]);
  await c.query("insert into operacion_lineas (operacion_id, empresa_id, descripcion, cantidad, precio_unitario, iva, total) values ($1, $2, 'x', 1, 1210, 21, 1210), ($1, $2, 'y', 1, 1105, 10.5, 1105)", [venta, emp]);
  /* La caída: el primer contacto con ARCA no vuelve. El resto del
     cliente es el de verdad. */
  const eb = Object.create(afip.ElectronicBilling);
  eb.getLastVoucher = async () => { throw Object.assign(new Error("simulada: ARCA no contestó a tiempo"), { code: "ETIMEDOUT" }); };
  let f = null;
  try {
    f = await facturarVenta({ admin, empresaId: emp, operacionId: venta, afip: { ElectronicBilling: eb } });
    decir(f.autorizacion === "CAEA" && f.letra === "B" && f.punto_venta === pvCaea && f.numero === 1, `salió con CAEA: B ${f.punto_venta}-${f.numero}, CAEA ${f.cae}`);
  } catch (e) { decir(false, `emitir con CAEA: ${e.message}`); }

  console.log("\nInformarlo a ARCA (FECAEARegInformativo)");
  if (f) {
    const r = await informarPendientes({ admin, afip, empresaId: emp });
    /* LO QUE HOMOLOGACIÓN NO DEJA PROBAR (29/09/2026): ARCA exige que el
       punto de venta esté registrado como CAEA para ese CUIT, y el CUIT
       compartido de Afip SDK no tiene ningún punto registrado
       (FEParamGetPtosVenta da 602). Contesta 1444 "tipo de comprobante no
       habilitado con el punto de venta" en cualquier punto que se pruebe.
       Que llegue a ese error dice que el pedido se leyó bien (cabecera,
       detalle, CAEA); que se acepte, solo se va a ver con un CUIT propio. */
    if (r.errores.length && r.errores.every((e) => /(1444)/.test(e))) {
      console.log(`  --   el informe no se puede probar con el CUIT compartido: ARCA lo leyó y contestó 1444 (punto no registrado como CAEA)`);
    } else {
      decir(r.informados === 1 && !r.errores.length, `ARCA aceptó el informe (${r.errores.join("; ") || "sin errores"})`);
      const ultimo = await afip.ElectronicBilling.getLastVoucher(pvCaea, 6);
      decir(Number(ultimo) === 1, `ARCA ahora tiene el 1 en el punto ${pvCaea}`);
    }
  }
} catch (e) {
  decir(false, `se cortó: ${e.message}`);
} finally {
  await c.query("delete from caea_informes where empresa_id = $1", [emp]);
  await c.query("delete from comprobantes where empresa_id = $1", [emp]);
  await c.query("delete from empresas where id = $1", [emp]);
  const quedan = await restos(emp);
  decir(Object.values(quedan).every((n) => n === 0), `no quedó nada del comercio temporal: ${JSON.stringify(quedan)}`);
  await c.end();
}

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
