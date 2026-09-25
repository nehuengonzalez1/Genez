/* ============================================================
   PRUEBA · cambio de titular fiscal (0093)
   ============================================================

   Dos partes:

   1. La base, en una transacción que se deshace. Si 0093 no está
      aplicada, la carga adentro: sirve de ensayo de la migración. Que
      los comprobantes que ya existen queden con su emisor, y qué pasa con
      una devolución o una nota de débito sobre una factura del mismo
      titular, de otro, de otro ambiente, o sin conexión.

   2. El servidor (`_arca.js` y `conexion.js`), con un comercio temporal
      que se borra al final pase lo que pase: supabase-js va por otra
      conexión y no ve lo que una transacción no confirmó. No habla con
      ARCA: `facturarVenta` recibe un ARCA de mentira, y el certificado lo
      "emite" una autoridad de prueba, como en probar-arca.mjs. El
      comprobante que se autoriza acá es del comercio temporal y se borra.
      Lo que necesita la columna `emisor` se saltea si 0093 no está
      aplicada.

     node scripts/probar-cambio-titular.mjs
   ============================================================ */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env", "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const c = new pg.Client({ connectionString: env.SUPABASE_DB_URL });
await c.connect();

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };
const una = async (sql, args = []) => (await c.query(sql, args)).rows[0];

const aplicada = (await una("select count(*) n from information_schema.columns where table_name = 'comprobantes' and column_name = 'emisor'")).n !== "0";

/* ------------------------------------------------------------
   1 · La base
   ------------------------------------------------------------ */
console.log("\nLa base");
await c.query("begin");
try {
  if (!aplicada) {
    console.log("  (0093 no está aplicada: se carga adentro de la transacción, como ensayo)");
    await c.query(readFileSync("supabase/migrations/0093_cambio_de_titular.sql", "utf8"));
  }

  const vieja = await una(`select c.cuit, c.emisor from comprobantes c join empresas e on e.id = c.empresa_id
                           where e.nombre = 'Super 25' and c.estado = 'autorizado' and c.modo = 'produccion' order by c.creado_en limit 1`);
  if (vieja) {
    decir(vieja.emisor && String(vieja.emisor.cuit || "").replace(/\D/g, "") === vieja.cuit && vieja.emisor.razonSocial,
      `la factura que ya existe queda con su emisor (${vieja.emisor && vieja.emisor.razonSocial}, CUIT ${vieja.emisor && vieja.emisor.cuit})`);
  }
  decir((await una("select count(*) n from information_schema.columns where table_name = 'facturas_vista' and column_name = 'emisor'")).n === "1",
    "la vista de facturas trae el emisor");

  const emp = await una("select id from empresas where nombre = 'Bnitori'");
  const suc = await una("select id from sucursales where empresa_id = $1 limit 1", [emp.id]);
  const dueno = await una("select id from perfiles where empresa_id = $1 and rol = 'dueno' limit 1", [emp.id]);
  const ses = await una("insert into sesiones_caja (empresa_id, sucursal_id, monto_inicial) values ($1, $2, 0) returning id", [emp.id, suc.id]);

  const comoDueno = async () => {
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: dueno.id, role: "authenticated" })]);
  };
  const comoAdmin = async () => {
    await c.query("reset role");
    await c.query("select set_config('request.jwt.claims', '', true)");
  };
  const falla = async (sql, args, codigo, texto) => {
    await c.query("savepoint s");
    try { await c.query(sql, args); decir(false, texto); }
    catch (e) { decir(e.code === codigo, `${texto}${e.code === codigo ? "" : ` (dio ${e.code}: ${e.message})`}`); }
    await c.query("rollback to savepoint s");
  };

  /* La conexión de Bnitori, la que sea que tenga, pasa a ser de producción
     con el CUIT "A" mientras dura la transacción. */
  const A = "20409378472", B = "20111111112";
  await c.query("delete from arca_conexiones where empresa_id = $1", [emp.id]);
  await c.query("insert into arca_conexiones (empresa_id, modo, cuit, punto_venta) values ($1, 'produccion', $2, 7)", [emp.id, A]);

  let nro = 0;
  /* Una factura cobrada y autorizada por ARCA, con el CUIT y el ambiente
     que se digan. */
  const factura = async ({ cuit = A, modo = "produccion" } = {}) => {
    const id = randomUUID();
    await c.query("select registrar_venta($1::jsonb)", [JSON.stringify({
      id, empresa_id: emp.id, sucursal_id: suc.id, sesion_id: ses.id, numero: `PRUEBA-${id.slice(0, 6)}`,
      subtotal: 1000, descuento: 0, recargo: 0, total: 1000, comprobante: { fiscal: true },
      lineas: [{ item_id: null, descripcion: "Renglón de prueba", cantidad: 1, precio_unitario: 1000, costo_unitario: 0, iva: 21, total: 1000 }],
      pagos: [{ medio: "efectivo", monto: 1000 }],
    })]);
    nro++;
    await c.query(`insert into comprobantes (empresa_id, operacion_id, modo, cuit, punto_venta, tipo, letra, numero, estado, cae, cae_vto,
                     fecha, total, neto, doc_tipo, condicion_receptor)
                   values ($1, $2, $3, $4, 7, 11, 'C', $5, 'autorizado', '12345678901234', current_date + 10, current_date, 1000, 1000, 99, 5)`,
      [emp.id, id, modo, cuit, 900000 + nro]);
    const linea = await una("select id from operacion_lineas where operacion_id = $1", [id]);
    return { id, linea: linea.id };
  };
  const devolver = (v) => una("select registrar_devolucion($1, $2::jsonb, $3, 'efectivo', 'prueba') id",
    [v.id, JSON.stringify([{ linea_id: v.linea, cantidad: 1 }]), ses.id]);
  const debitar = "select registrar_nota_debito($1, 'Diferencia', 100, $2, 'efectivo')";
  const posible = async (v) => (await una("select nota_posible($1) n", [v.id])).n;

  const propia = await factura();
  const ajena = await factura({ cuit: "20222222223" });
  const deOtroAmbiente = await factura({ modo: "homologacion", cuit: "20409378472" });
  decir(await posible(propia) === "si" && await posible(ajena) === "otra" && await posible(deOtroAmbiente) === "otra",
    "reconoce la factura propia, la de otro CUIT y la de otro ambiente");

  await comoDueno();
  const d1 = await devolver(propia);
  await comoAdmin();
  const op1 = await una("select comprobante from operaciones where id = $1", [d1.id]);
  decir(op1.comprobante.fiscal === true && op1.comprobante.nota === "credito", "la devolución de una factura propia pide nota de crédito, como antes");

  await comoDueno();
  const d2 = await devolver(ajena);
  await comoAdmin();
  const op2 = await una("select comprobante, campos_extra from operaciones where id = $1", [d2.id]);
  decir(!op2.comprobante.fiscal && /otro titular/.test(op2.campos_extra.nota_fuera || ""),
    "la de una factura de otro titular se hace, sin nota y diciendo por qué");
  const en_fila = await una("select count(*) n from facturas_vista where operacion_id = $1", [d2.id]);
  decir(en_fila.n === "0", "y no entra en la fila de CAE, que no se traba");
  const mov2 = await una("select tipo, monto from movimientos_caja where operacion_id = $1", [d2.id]);
  decir(mov2 && mov2.tipo === "egreso" && Number(mov2.monto) === 1000, "el reintegro sale de la caja igual");
  const bit2 = await una("select detalle from bitacora where accion = 'venta.devolucion' and entidad_id = $1", [d2.id]);
  decir(bit2 && bit2.detalle.factura_de_otro_titular === true && bit2.detalle.nota_credito === false, "la bitácora dice que fue sin nota, y por qué");

  await comoDueno();
  const d3 = await devolver(deOtroAmbiente);
  await comoAdmin();
  decir(!(await una("select comprobante from operaciones where id = $1", [d3.id])).comprobante.fiscal,
    "la de una factura de pruebas, facturando ya de verdad, tampoco pide nota");

  await comoDueno();
  await falla(debitar, [ajena.id, ses.id], "P0022", "no deja nota de débito sobre la factura de otro titular");
  const nd = await una("select registrar_nota_debito($1, 'Diferencia', 100, $2, 'efectivo') id", [propia.id, ses.id]);
  decir(!!nd.id, "sobre una propia sí, como antes");
  await comoAdmin();

  /* En pleno cambio: sin conexión. */
  const otraPropia = await factura();
  await c.query("delete from arca_conexiones where empresa_id = $1", [emp.id]);
  await comoDueno();
  await falla("select registrar_devolucion($1, $2::jsonb, $3, 'efectivo', null)",
    [otraPropia.id, JSON.stringify([{ linea_id: otraPropia.linea, cantidad: 1 }]), ses.id], "P0022",
    "sin conexión con ARCA, la devolución de una factura espera");
  await comoAdmin();

  /* Con la conexión nueva (CUIT B), las facturas del A son "de otro". */
  await c.query("insert into arca_conexiones (empresa_id, modo, cuit, punto_venta) values ($1, 'produccion', $2, 1)", [emp.id, B]);
  decir(await posible(otraPropia) === "otra", "después del cambio, las facturas del titular anterior son de otro");
} catch (e) {
  decir(false, `base: ${e.message}`);
} finally {
  await c.query("rollback");
}

/* ------------------------------------------------------------
   2 · El servidor
   ------------------------------------------------------------ */
console.log("\nEl servidor");
if (!env.ARCA_CLAVE_MAESTRA || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("  --   falta ARCA_CLAVE_MAESTRA o SUPABASE_SERVICE_ROLE_KEY en el .env, se saltea");
} else {
  process.env.ARCA_CLAVE_MAESTRA = env.ARCA_CLAVE_MAESTRA;
  const { facturarVenta, ErrorArca } = await import("../api/arca/_arca.js");
  const conexion = await import("../api/arca/conexion.js");
  const forge = (await import("node-forge")).default;
  const admin = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const ca = forge.pki.rsa.generateKeyPair(2048);
  const emitir = (csrPem) => {
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    const cert = forge.pki.createCertificate();
    cert.publicKey = csr.publicKey;
    cert.serialNumber = "0" + Date.now().toString(16);
    cert.validity.notBefore = new Date(Date.now() - 864e5);
    cert.validity.notAfter = new Date(Date.now() + 730 * 864e5);
    cert.setSubject(csr.subject.attributes.map((a) => ({ shortName: a.shortName, name: a.name, value: a.value })));
    cert.setIssuer([{ shortName: "CN", value: "Autoridad de prueba de Genez" }]);
    cert.sign(ca.privateKey, forge.md.sha256.create());
    return forge.pki.certificateToPem(cert);
  };
  /* Un ARCA que contesta sin salir a la red. */
  let ultimo = 0;
  const arcaFalso = {
    ElectronicBilling: {
      getLastVoucher: async () => ultimo,
      createVoucher: async () => { ultimo++; return { CAE: "70000000000001", CAEFchVto: "2026-12-31" }; },
      getVoucherInfo: async () => null,
    },
  };
  const falla = async (hacer) => { try { await hacer(); return null; } catch (e) { return e; } };

  const A = "20409378472", B = "20111111112";
  const fiscalDe = (cuit, razonSocial) => ({ condicion: "MONOTRIBUTO", cuit, razonSocial, iibb: cuit, inicio: "01/08/2026", domicilio: "Calle de prueba 1" });
  const { id: empresaId } = await una("insert into empresas (nombre, config) values ('Prueba cambio de titular (se borra sola)', $1) returning id",
    [JSON.stringify({ fiscal: fiscalDe("20-40937847-2", "Titular Viejo") })]);
  const plataforma = { id: null, plataforma: true };

  try {
    /* El comercio conectado con el CUIT A, como Super 25 hoy. */
    let est = await conexion.generar({ admin, empresaId, cuerpo: {} });
    est = await conexion.certificado({ admin, empresaId, cuerpo: { pem: emitir(est.pedido.csr) } });
    await c.query("insert into arca_conexiones (empresa_id, modo, cuit, punto_venta) values ($1, 'produccion', $2, 5)", [empresaId, A]);

    const venta = async () => {
      const id = randomUUID();
      await c.query("insert into operaciones (id, empresa_id, tipo, total, comprobante) values ($1, $2, 'venta', 100, $3)", [id, empresaId, JSON.stringify({ fiscal: true })]);
      return id;
    };

    /* Los datos fiscales cambian antes que la conexión: no se factura. */
    await c.query("update empresas set config = jsonb_set(config, '{fiscal}', $2::jsonb) where id = $1", [empresaId, JSON.stringify(fiscalDe("20-11111111-2", "Titular Nuevo"))]);
    const f2 = await venta();
    let e = await falla(() => facturarVenta({ admin, empresaId, operacionId: f2, afip: arcaFalso }));
    decir(e instanceof ErrorArca && e.estado === 409 && /va impreso/.test(e.message), "con los datos fiscales de otro CUIT que la conexión, no factura");
    decir(!(await una("select 1 x from comprobantes where operacion_id = $1", [f2])), "y no deja un comprobante a medias");
    await c.query("delete from operaciones where id = $1", [f2]);

    /* El pase. */
    est = await conexion.generar({ admin, empresaId, cuerpo: { cuit: B } });
    decir(est.certificado.cuit === A && est.pedido.cuit === B, "el pedido del CUIT nuevo vive al lado del certificado en uso");
    const pem = emitir(est.pedido.csr);
    e = await falla(() => conexion.certificado({ admin, empresaId, cuerpo: { pem } }));
    decir(e && e.estado === 409 && /a propósito/.test(e.message), "subir el certificado de otro CUIT, sin más, no cambia el titular");
    e = await falla(() => conexion.certificado({ admin, empresaId, cuerpo: { pem, cambiarTitular: true }, quien: { id: null, plataforma: false } }));
    decir(e && e.estado === 403, "el comercio solo no puede cambiar de titular");

    const esperando = await venta();
    e = await falla(() => conexion.certificado({ admin, empresaId, cuerpo: { pem, cambiarTitular: true }, quien: plataforma }));
    decir(e && /esperando CAE/.test(e.message), "con facturas esperando CAE del titular anterior, no");
    await c.query("delete from operaciones where id = $1", [esperando]);

    est = await conexion.certificado({ admin, empresaId, cuerpo: { pem, cambiarTitular: true }, quien: plataforma });
    decir(!est.conexion && est.certificado.cuit === B && !est.pedido, "cambiado: certificado del CUIT nuevo y sin conexión, no factura");
    const bit = await una("select detalle from bitacora where empresa_id = $1 and accion = 'arca.cambio_titular'", [empresaId]);
    decir(bit && bit.detalle.de === A && bit.detalle.a === B, "queda en la bitácora, de qué CUIT a cuál");

    /* Y se activa como la primera vez, con los datos fiscales nuevos. */
    await c.query("update arca_credenciales set prueba = jsonb_build_object('ok', true, 'puntoVenta', 1, 'en', now(), 'pasos', '[]'::jsonb) where empresa_id = $1", [empresaId]);
    est = await conexion.activar({ admin, empresaId, cuerpo: { puntoVenta: 1 } });
    decir(est.conexion && est.conexion.cuit === B && est.conexion.puntoVenta === 1, "activado con el CUIT nuevo y su punto de venta");

    /* El emisor que se guarda con el CAE. Un comprobante de producción no
       se puede borrar nunca (0082), y este comercio se borra al final: por
       eso lo que se autoriza acá es de homologación, con el ARCA de
       mentira. Guardar el emisor no depende del ambiente. */
    if (aplicada) {
      await c.query("update arca_conexiones set modo = 'homologacion' where empresa_id = $1", [empresaId]);
      const f3 = await venta();
      const cmp = await facturarVenta({ admin, empresaId, operacionId: f3, afip: arcaFalso });
      decir(cmp.estado === "autorizado" && cmp.modo === "homologacion" && cmp.emisor
        && cmp.emisor.razonSocial === "Titular Nuevo" && cmp.emisor.cuit === "20-11111111-2" && cmp.emisor.iibb === "20-11111111-2",
        "el comprobante guarda el emisor con que se pidió el CAE");
      await c.query("update empresas set config = jsonb_set(config, '{fiscal,razonSocial}', '\"Otro después\"') where id = $1", [empresaId]);
      const guardado = await una("select emisor from comprobantes where operacion_id = $1", [f3]);
      decir(guardado.emisor.razonSocial === "Titular Nuevo", "y no cambia si después cambian los datos fiscales");
    } else {
      console.log("  --   0093 no está aplicada: el emisor guardado se prueba después de aplicarla");
    }
  } catch (e) {
    decir(false, `servidor: ${e.message}`);
  } finally {
    /* Si algo hubiera autorizado uno de producción, el comercio no se
       podría borrar: mejor que se note acá que encontrarlo después. */
    const prod = await una("select count(*) n from comprobantes where empresa_id = $1 and modo = 'produccion'", [empresaId]);
    if (prod.n !== "0") decir(false, `quedaron ${prod.n} comprobantes de producción en el comercio temporal ${empresaId}: borralo a mano`);
    await c.query("delete from comprobantes where empresa_id = $1", [empresaId]);
    await c.query("delete from empresas where id = $1", [empresaId]);
  }
}

await c.end();
console.log(fallas ? `\n${fallas} fallaron.` : "\nTodo bien. Nada quedó en la base.");
process.exitCode = fallas ? 1 : 0;
