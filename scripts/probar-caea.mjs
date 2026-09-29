/* ============================================================
   PRUEBA · el CAEA, sin base y sin ARCA (0100)
   ============================================================

   Lo que decide cuándo una factura sale con CAEA y con qué número. Con
   una base de mentira en memoria y un ARCA de mentira que se puede
   "caer". Lo que no prueba: que ARCA acepte el CAEA y los informes; eso
   es homologación (probar-arca-ab.mjs --caea).

   La regla que más importa: solo se pasa al CAEA si ARCA no contestó
   ANTES de pedirle nada. Si contestó que no, o si se cayó después de
   mandar el pedido del CAE, NO: esa venta podría tener CAE en ARCA, y con
   CAEA quedaría facturada dos veces.

     node scripts/probar-caea.mjs
   ============================================================ */

import { facturarVenta, ErrorArca } from "../api/arca/_arca.js";
import { quincenaDe, siguiente, inicioDe, esCaida, ahoraEnArgentina, informarPendientes, cerrarSinMovimiento } from "../api/arca/_caea.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

/* ---------- Una base de mentira con la forma de supabase-js ---------- */
function baseDeMentira(tablas) {
  let secuencia = 0;
  const from = (tabla) => {
    const filtros = [];
    let op = "select", datos = null, orden = null, tope = null, cuenta = false;
    const filas = () => (tablas[tabla] ||= []);
    const pasan = (f) => filtros.every((fn) => fn(f));
    const correr = () => {
      /* El upsert de caea_informes reemplaza por su clave, como Postgres. */
      if (op === "upsert" && tabla === "caea_informes") {
        const ya = filas().find((x) => x.comprobante_id === datos.comprobante_id);
        if (ya) { Object.assign(ya, datos); return [ya]; }
      }
      if (op === "insert" || op === "upsert") {
        const fila = { id: `${tabla}-${++secuencia}`, creado_en: new Date().toISOString(), ...(op === "insert" && tabla === "comprobantes" ? { estado: "pendiente" } : {}), ...datos };
        /* El índice único de autorizados (0082), que es el candado. */
        if (tabla === "comprobantes" && fila.estado === "autorizado" &&
          filas().some((f) => f.estado === "autorizado" && f.modo === fila.modo && f.cuit === fila.cuit && f.punto_venta === fila.punto_venta && f.tipo === fila.tipo && f.numero === fila.numero)) {
          return { error: { code: "23505" } };
        }
        filas().push(fila);
        return [fila];
      }
      let hallados = filas().filter(pasan);
      /* El embed de supabase-js: cada comprobante con sus informes. */
      if (tabla === "comprobantes" && op === "select") {
        hallados = hallados.map((c) => ({ ...c, caea_informes: (tablas.caea_informes || []).filter((i) => i.comprobante_id === c.id) }));
      }
      if (op === "update") hallados.forEach((f) => Object.assign(f, datos));
      if (orden) hallados = [...hallados].sort((a, b) => (orden.asc ? 1 : -1) * (a[orden.k] - b[orden.k]));
      if (tope) hallados = hallados.slice(0, tope);
      return hallados;
    };
    const resultado = () => { const r = correr(); return r.error ? { data: null, error: r.error } : { data: r, error: null, count: r.length }; };
    const q = {
      select: (_c, o) => ((cuenta = !!(o && o.count)), q),
      eq: (k, v) => (filtros.push((f) => f[k] === v), q),
      neq: (k, v) => (filtros.push((f) => f[k] !== v), q),
      is: (k, v) => (filtros.push((f) => (f[k] ?? null) === v), q),
      lt: (k, v) => (filtros.push((f) => f[k] < v), q),
      gte: (k, v) => (filtros.push((f) => f[k] >= v), q),
      not: (k, _op, v) => (filtros.push((f) => (f[k] ?? null) !== v), q),
      match: (o) => (Object.entries(o).forEach(([k, v]) => filtros.push((f) => f[k] === v)), q),
      order: (k, o) => ((orden = { k, asc: !o || o.ascending !== false }), q),
      limit: (n) => ((tope = n), q),
      insert: (d) => ((op = "insert"), (datos = d), q),
      upsert: (d) => ((op = "upsert"), (datos = d), q),
      update: (d) => ((op = "update"), (datos = d), q),
      single: async () => { const r = resultado(); return r.error ? r : r.data.length === 1 ? { data: r.data[0], error: null } : { data: null, error: new Error(`${tabla}: ${r.data.length} filas`) }; },
      maybeSingle: async () => { const r = resultado(); return r.error ? r : { data: r.data[0] || null, error: null }; },
      then: (ok, mal) => Promise.resolve(resultado()).then(ok, mal),
    };
    return q;
  };
  return { from };
}

/* ---------- Un ARCA que se puede caer ---------- */
function arcaDeMentira({ cae = "caido" } = {}) {
  const pedidos = [], informados = [], sinMov = [];
  const caida = () => Object.assign(new Error("ARCA no contestó a tiempo."), { code: "ETIMEDOUT" });
  return {
    pedidos, informados, sinMov,
    ElectronicBilling: {
      getLastVoucher: async () => {
        if (cae === "caido") throw caida();
        if (cae === "rechaza") throw Object.assign(new Error("(10015) algo mal cargado"), { code: 10015 });
        return 0;
      },
      createVoucher: async (p) => {
        pedidos.push(p);
        if (cae === "cae-despues") throw caida();
        return { CAE: "74000000000001", CAEFchVto: "2026-10-09" };
      },
      getVoucherInfo: async () => { if (cae === "cae-despues") throw caida(); return null; },
      informarCAEA: async (p) => { informados.push(p); return { Resultado: "A" }; },
      sinMovimientoCAEA: async (pv, caea) => { sinMov.push({ pv, caea }); return {}; },
    },
  };
}

const EMP = "emp";
const HOY = ahoraEnArgentina().slice(0, 8);
const Q = quincenaDe(HOY);
const f = (x) => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}`;

function escenario({ condicion = "RI", clase, pvCaea = 90, conCaeaHoy = true, lineas = [{ total: 1210, iva: 21, iva_condicion: "gravado" }], total = 1210, ventas = ["v1"] } = {}) {
  const tablas = {
    empresas: [{ id: EMP, config: { fiscal: { condicion, claseInscripto: clase, cuit: "20409378472" } } }],
    arca_conexiones: [{ empresa_id: EMP, modo: "homologacion", punto_venta: 6, punto_venta_caea: pvCaea }],
    clientes: [],
    operaciones: ventas.map((id) => ({ id, empresa_id: EMP, tipo: "venta", estado: "confirmada", total, cliente_id: null, comprobante: { fiscal: true }, origen_id: null })),
    operacion_lineas: ventas.flatMap((id) => lineas.map((l) => ({ operacion_id: id, empresa_id: EMP, ...l }))),
    comprobantes: [],
    caea_informes: [],
    arca_caea: conCaeaHoy ? [{ id: "q1", empresa_id: EMP, modo: "homologacion", cuit: "20409378472", periodo: Q.periodo, orden: Q.orden, caea: "86390928922973", vig_desde: f(HOY), vig_hasta: f(HOY), tope_informar: f(HOY) }] : [],
  };
  return { tablas, admin: baseDeMentira(tablas) };
}
const pedir = async (s, afip, operacionId = "v1") => {
  try { return { c: await facturarVenta({ admin: s.admin, empresaId: EMP, operacionId, afip }) }; }
  catch (e) { return { e }; }
};

console.log("\nLa quincena");
decir(JSON.stringify(quincenaDe("20260915")) === '{"periodo":202609,"orden":1}' && JSON.stringify(quincenaDe("20260916")) === '{"periodo":202609,"orden":2}', "el 15 es de la primera y el 16 de la segunda");
decir(JSON.stringify(siguiente({ periodo: 202612, orden: 2 })) === '{"periodo":202701,"orden":1}', "después de la segunda de diciembre viene la primera de enero");
decir(inicioDe({ periodo: 202610, orden: 2 }) === "20261016", "la segunda empieza el 16");
decir(/^\d{14}$/.test(ahoraEnArgentina()) && ahoraEnArgentina(new Date("2026-09-30T02:30:00Z")) === "20260929233000", "la hora de generación es la de Argentina: 23:30 del 29, no 02:30 del 30");

console.log("\nQué es una caída");
decir(esCaida(Object.assign(new Error("x"), { code: "ECONNRESET" })), "se cortó la conexión: sí");
decir(esCaida(new Error("ARCA no contestó a tiempo.")), "no contestó a tiempo: sí");
decir(!esCaida(Object.assign(new Error("x"), { code: 10015 })), "ARCA contestó que no: no");
decir(!esCaida(Object.assign(new Error("x"), { codigoArca: "cms.cert.expired" })), "el certificado venció: no");
decir(!esCaida(new ErrorArca("Falta AFIP_ACCESS_TOKEN", 501)), "falta configuración de Genez: no");

console.log("\nARCA caído, con CAEA");
let s = escenario({ ventas: ["v1", "v2"] });
let afip = arcaDeMentira({ cae: "caido" });
let r = await pedir(s, afip);
decir(!r.e && r.c.autorizacion === "CAEA" && r.c.estado === "autorizado" && r.c.cae === "86390928922973", `sale con el CAEA de la quincena (${r.e ? r.e.message : r.c.autorizacion})`);
decir(!r.e && r.c.punto_venta === 90 && r.c.numero === 1 && r.c.letra === "B", "en el punto de venta CAEA, número 1");
decir(!r.e && r.c.pedido.CAEA === "86390928922973" && /^\d{14}$/.test(r.c.pedido.CbteFchHsGen) && r.c.pedido.Iva && r.c.pedido.Iva.length === 1, "el pedido guarda lo que hay que informar: CAEA, hora de generación y el IVA");
decir(!afip.pedidos.length, "no se le pidió CAE a ARCA");
decir(s.tablas.caea_informes.length === 1 && !s.tablas.caea_informes[0].informado_en, "queda anotado para informar");
r = await pedir(s, afip, "v2");
decir(!r.e && r.c.numero === 2, "la siguiente toma el 2");
r = await pedir(s, afip, "v1");
decir(!r.e && r.c.numero === 1 && s.tablas.comprobantes.length === 2, "reintentar la primera devuelve la misma, no emite otra");

console.log("\nCuándo NO pasa al CAEA");
s = escenario();
afip = arcaDeMentira({ cae: "rechaza" });
r = await pedir(s, afip);
decir(r.e && r.e.code === 10015 && !s.tablas.comprobantes.length, "ARCA contestó que no: el error sigue, sin CAEA");
s = escenario();
afip = arcaDeMentira({ cae: "cae-despues" });
r = await pedir(s, afip);
decir(r.e && !s.tablas.comprobantes.some((c) => c.autorizacion === "CAEA") && s.tablas.comprobantes[0].estado === "pendiente",
  "se cayó después de mandar el pedido del CAE: queda pendiente, nunca CAEA");
s = escenario({ pvCaea: null });
r = await pedir(s, arcaDeMentira());
decir(r.e && !s.tablas.comprobantes.length, "sin punto de venta CAEA: espera, como antes");
s = escenario({ conCaeaHoy: false });
r = await pedir(s, arcaDeMentira());
decir(r.e && !s.tablas.comprobantes.length, "sin el CAEA de esta quincena: espera");
s = escenario({ clase: "M" });
s.tablas.clientes.push({ id: "cli", empresa_id: EMP, condicion: "RI", tipo_doc: "CUIT", doc: "30712345671" });
s.tablas.operaciones[0].cliente_id = "cli";
r = await pedir(s, arcaDeMentira());
decir(r.e && !s.tablas.comprobantes.length, "la M no admite CAEA (RG 5782, art. 3): espera");

console.log("\nInformar y cerrar la quincena");
s = escenario({ ventas: ["v1", "v2"] });
afip = arcaDeMentira({ cae: "caido" });
await pedir(s, afip); await pedir(s, afip, "v2");
s.tablas.caea_informes = [];   // como si se hubiera cortado antes de anotarlos
let inf = await informarPendientes({ admin: s.admin, afip, empresaId: EMP });
decir(inf.informados === 2 && afip.informados.map((p) => p.CbteDesde).join() === "1,2", "informa las dos, en orden, aunque no estuvieran anotadas");
decir(s.tablas.caea_informes.every((i) => i.informado_en), "quedan marcadas como informadas");
inf = await informarPendientes({ admin: s.admin, afip, empresaId: EMP });
decir(inf.informados === 0, "no las vuelve a informar");

const ayer = "20000101";
s = escenario({ conCaeaHoy: false });
s.tablas.arca_caea.push({ id: "q0", empresa_id: EMP, modo: "homologacion", cuit: "20409378472", periodo: 200001, orden: 1, caea: "11111111111111", vig_desde: f(ayer), vig_hasta: f(ayer), tope_informar: f(ayer) });
afip = arcaDeMentira();
const con = s.tablas.arca_conexiones[0];
let cierre = await cerrarSinMovimiento({ admin: s.admin, afip, conexion: con, cuit: "20409378472" });
decir(cierre.hechos.length === 1 && afip.sinMov[0].pv === 90 && afip.sinMov[0].caea === "11111111111111", "una quincena vencida sin uso se informa sin movimiento, en el punto CAEA");
cierre = await cerrarSinMovimiento({ admin: s.admin, afip, conexion: con, cuit: "20409378472" });
decir(cierre.hechos.length === 0 && afip.sinMov.length === 1, "no la informa dos veces");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
