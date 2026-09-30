/* ============================================================
   PRUEBA · los indicadores financieros de Genez, sin base
   ============================================================

   Un trimestre inventado de 2031 con una suscripción que sube, otra que
   se da de baja, una nueva, cobros atrasados, un gasto fijo y uno en
   dólares, y los números que tienen que dar según las definiciones de
   src/utils/finanzasGenez.js.

     node scripts/probar-indicadores-genez.mjs
   ============================================================ */

import { indicadoresDelMes, mrrAl, puntoDeEquilibrio, proyeccion, ultimoDia, mesMas } from "../src/utils/finanzasGenez.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

const suscripciones = [
  { id: "a", estado: "activa", moneda: "ARS", importeMensual: 50000, inicio: "2031-01-01" },
  { id: "b", estado: "baja", moneda: "ARS", importeMensual: 30000, inicio: "2031-01-10", fin: "2031-02-20" },
  { id: "c", estado: "activa", moneda: "ARS", importeMensual: 40000, inicio: "2031-02-05" },
  { id: "d", estado: "activa", moneda: "USD", importeMensual: 100, inicio: "2031-01-01" },
];
const cambios = [
  { id: 1, suscripcionId: "a", fecha: "2031-01-01", estadoAntes: null, estadoDespues: "activa", importeAntes: null, importeDespues: 40000 },
  { id: 2, suscripcionId: "b", fecha: "2031-01-10", estadoAntes: null, estadoDespues: "activa", importeAntes: null, importeDespues: 30000 },
  { id: 3, suscripcionId: "d", fecha: "2031-01-01", estadoAntes: null, estadoDespues: "activa", importeAntes: null, importeDespues: 100 },
  { id: 4, suscripcionId: "c", fecha: "2031-02-05", estadoAntes: null, estadoDespues: "activa", importeAntes: null, importeDespues: 40000 },
  { id: 5, suscripcionId: "a", fecha: "2031-02-15", estadoAntes: "activa", estadoDespues: "activa", importeAntes: 40000, importeDespues: 50000 },
  { id: 6, suscripcionId: "b", fecha: "2031-02-20", estadoAntes: "activa", estadoDespues: "baja", importeAntes: 30000, importeDespues: 30000 },
];
const m = (o) => ({ moneda: "ARS", estado: "pendiente", fijo: false, ...o });
const movimientos = [
  m({ tipo: "ingreso", importe: 40000, periodo: "2031-02-01", estado: "pagado", fechaPago: "2031-02-10", suscripcionId: "a" }),
  m({ tipo: "ingreso", importe: 30000, periodo: "2031-02-01", vencimiento: "2031-02-10", suscripcionId: "b" }),              // no pagó
  m({ tipo: "ingreso", importe: 40000, periodo: "2031-01-01", estado: "pagado", fechaPago: "2031-02-03", suscripcionId: "a" }), // enero, cobrado en febrero
  m({ tipo: "ingreso", importe: 80000, periodo: "2031-02-01", estado: "anulado" }),
  m({ tipo: "ingreso", importe: 60000, periodo: "2031-04-01", vencimiento: "2031-04-15" }),                                     // implementación futura
  m({ tipo: "gasto", importe: 20000, periodo: "2031-02-01", estado: "pagado", fechaPago: "2031-02-05", fijo: true }),
  m({ tipo: "gasto", importe: 15000, periodo: "2031-02-01", vencimiento: "2031-02-28", fijo: true }),
  m({ tipo: "gasto", importe: 5000, periodo: "2031-02-01", estado: "pagado", fechaPago: "2031-02-12" }),
  m({ tipo: "gasto", importe: 50, periodo: "2031-02-01", moneda: "USD", estado: "pagado", fechaPago: "2031-02-12" }),
];
const cuentas = [{ activa: true, moneda: "ARS", saldo: 250000 }, { activa: true, moneda: "USD", saldo: 900 }, { activa: false, moneda: "ARS", saldo: 1 }];

console.log("\nFechas");
decir(ultimoDia("2031-02") === "2031-02-28" && ultimoDia("2032-02") === "2032-02-29", "el último día de febrero, con bisiesto");
decir(mesMas("2031-11", 3) === "2032-02", "sumar meses cruza el año");

console.log("\nFebrero de 2031");
const f = indicadoresDelMes("2031-02", { movimientos, cambios, suscripciones, cuentas, hoy: "2031-03-15" });
decir(f.ingresos === 70000, `ingresos devengados: 40.000 + 30.000, sin el anulado ni lo de enero (${f.ingresos})`);
decir(f.cobrado === 80000, `cobrado: lo de febrero y lo de enero cobrado en febrero (${f.cobrado})`);
decir(f.gastos === 40000 && f.pagado === 25000, `gastos devengados 40.000, pagados 25.000; los dólares aparte (${f.gastos}, ${f.pagado})`);
decir(f.flujo === 55000 && f.resultado === 30000, `flujo de caja 55.000; resultado 30.000 (${f.flujo}, ${f.resultado})`);
decir(f.porCobrar === 90000 && f.porCobrarVencido === 30000, `por cobrar 90.000, de los que 30.000 vencieron (${f.porCobrar}, ${f.porCobrarVencido})`);
decir(f.porPagar === 15000 && f.porPagarVencido === 15000, `por pagar 15.000, vencido (${f.porPagar})`);
decir(f.mrrInicio === 70000 && f.mrrFin === 90000, `MRR 70.000 al empezar el mes y 90.000 al terminarlo, sin los dólares (${f.mrrInicio} → ${f.mrrFin})`);
decir(f.nuevas === 1 && f.mrrNuevo === 40000, "una nueva, 40.000");
decir(f.bajas === 1 && f.mrrPerdido === 30000, "una baja, 30.000 perdidos");
decir(f.expansion === 10000 && f.contraccion === 0, "expansión 10.000 (la que subió de 40 a 50 mil)");
decir(f.mrrInicio + f.mrrNuevo - f.mrrPerdido + f.expansion - f.contraccion === f.mrrFin, "y las cuentas cierran: inicio + nuevas − bajas + expansión − contracción = fin");
decir(f.costosFijos === 35000 && f.saldo === 250000 && f.enDolares === 1, "costos fijos 35.000; saldo solo en pesos y de cuentas activas; un movimiento en dólares aparte");

console.log("\nMRR, equilibrio y proyección");
decir(mrrAl("2030-12-31", cambios, suscripciones) === 0 && mrrAl("2031-01-15", cambios, suscripciones) === 70000, "antes de empezar no hay MRR; a mediados de enero, 70.000");
const pe = puntoDeEquilibrio(35000, suscripciones);
decir(pe.promedio === 45000 && pe.necesarias === 1 && pe.activas === 2, `al promedio de 45.000, con una suscripción se pagan 35.000 de fijos (${pe.necesarias})`);
decir(puntoDeEquilibrio(35000, []).necesarias === null, "sin suscripciones activas no se puede calcular: null, no un número");
const p = proyeccion("2031-02", 3, { movimientos, suscripciones });
decir(p.map((x) => x.mes).join() === "2031-03,2031-04,2031-05" && p[0].recurrente === 90000 && p[1].total === 150000,
  `marzo 90.000 recurrente; abril suma los 60.000 de la implementación (${p.map((x) => x.total).join(" / ")})`);

console.log(fallas ? `\n${fallas} MAL\n` : "\nTodo bien\n");
process.exit(fallas ? 1 : 0);
