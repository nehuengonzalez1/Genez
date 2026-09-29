/* ============================================================
   PRUEBA · las planillas para el contador, sin base
   ============================================================

   Las filas que arma src/utils/planillasContador.js con datos
   inventados: que las columnas de alícuota sean las del mes, que las
   notas de crédito resten, que la C vaya aparte y que los totales den.

     node scripts/probar-planillas.mjs
   ============================================================ */

import { hojaComprobantes, hojasVentas, hojaCompras, signoDe, fechaAR } from "../src/utils/planillasContador.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

const det = (alicuotas, exento = 0, noGravado = 0) => ({ alicuotas, exento, noGravado });
const comprobantes = [
  { fecha: "2026-09-01", tipo: 1, puntoVenta: 2, numero: 1, autorizacion: "CAE", cae: "74000000000001", docTipo: 80, docNro: 30712345671, condicionReceptor: 1, comprador: "Distribuidora SA", total: 2315, detalleIva: det([{ alicuota: 21, base: 1000, importe: 210 }, { alicuota: 10.5, base: 1000, importe: 105 }]) },
  { fecha: "2026-09-02", tipo: 6, puntoVenta: 2, numero: 1, autorizacion: "CAEA", cae: "86390928922973", docTipo: 99, docNro: 0, condicionReceptor: 5, comprador: null, total: 1710, detalleIva: det([{ alicuota: 21, base: 1000, importe: 210 }], 500) },
  { fecha: "2026-09-03", tipo: 3, puntoVenta: 2, numero: 1, autorizacion: "CAE", cae: "74000000000002", docTipo: 80, docNro: 30712345671, condicionReceptor: 1, comprador: "Distribuidora SA", total: 1210, detalleIva: det([{ alicuota: 21, base: 1000, importe: 210 }]) },
  { fecha: "2026-09-04", tipo: 11, puntoVenta: 2, numero: 7, autorizacion: "CAE", cae: "74000000000003", docTipo: 99, docNro: 0, condicionReceptor: 5, comprador: null, total: 500, detalleIva: null },
];

console.log("\nComprobantes emitidos");
const h = hojaComprobantes(comprobantes);
const [titulos] = h.filas;
const col = (t) => titulos.indexOf(t);
decir(col("Neto 21%") > 0 && col("IVA 10,5%") > 0 && col("Neto 27%") < 0, "solo las alícuotas que aparecen en el mes: 21% y 10,5%, no 27%");
decir(col("Neto 21%") < col("Neto 10,5%"), "el 21% primero");
decir(col("Exento") > 0 && col("No gravado") < 0, "Exento aparece porque hay; No gravado no");
decir(col("Sin discriminar (C)") > 0, "la C tiene su columna");
const nc = h.filas[3];
decir(nc[1] === "Nota de crédito A" && nc[col("Neto 21%")] === -1000 && nc[col("IVA 21%")] === -210 && nc[col("Total")] === -1210, "la nota de crédito resta");
const c = h.filas[4];
decir(c[col("Sin discriminar (C)")] === 500 && c[col("Neto 21%")] === 0 && c[col("Total")] === 500, "la C va en su columna, sin IVA");
decir(h.filas[2][4] === "CAEA" && h.filas[2][8] === "Consumidor final" && h.filas[2][6] === "Sin identificar", "CAEA, consumidor final sin identificar");
decir(h.filas[1][0] === "01/09/2026" && h.filas[1][7] === "30712345671", "fecha dd/mm/aaaa y el CUIT como texto (sin notación científica)");
const tot = h.filas[h.filas.length - 1];
decir(tot[col("Total")] === 2315 + 1710 - 1210 + 500 && tot[col("IVA 21%")] === 210 + 210 - 210 && tot[col("Exento")] === 500, `los totales: ${tot[col("Total")]}`);
decir(typeof tot[col("Total")] === "number", "los importes son números, no texto");

const dos = hojaComprobantes([{ ...comprobantes[3], cuit: "20412574738" }, { ...comprobantes[3], numero: 8, cuit: "23270861849" }]);
decir(dos.filas[0][1] === "CUIT emisor" && dos.filas[1][1] === "20412574738" && dos.filas[dos.filas.length - 1][dos.filas[0].indexOf("Total")] === 1000,
  "con dos titulares en el mes, la columna CUIT emisor y los totales en su lugar");
decir(!h.filas[0].includes("CUIT emisor"), "con uno solo, sin esa columna");

console.log("\nVentas totales");
const [porDia, doce] = hojasVentas({
  dias: [{ fecha: "2026-09-01", ventas: 5000, tickets: 3 }, { fecha: "2026-09-02", ventas: 1710, tickets: 1 }],
  facturadoPorDia: new Map([["2026-09-01", 2315], ["2026-09-02", 1710]]),
  pagosPorDia: new Map([["2026-09-01", new Map([["efectivo", 3000], ["debito", 2000]])], ["2026-09-02", new Map([["efectivo", 1710], ["cuenta_corriente", 500]])]]),
  nombreMedio: (k) => ({ efectivo: "Efectivo", debito: "Débito" })[k] || k,
  meses: [{ mes: "2026-08", ventas: 100000, facturado: 60000 }, { mes: "2026-09", ventas: 6710, facturado: 4025 }],
});
decir(porDia.filas[0].includes("Cobrado en Débito") && porDia.filas[0].includes("Cobrado en Efectivo"), "una columna por medio de pago, con su nombre");
decir(porDia.filas[0].includes("Fiado (cuenta corriente)"), "la cuenta corriente dice fiado, no cobrado");
decir(porDia.filas[1][3] === 2685, "sin factura = ventas − facturado (5.000 − 2.315)");
const totDia = porDia.filas.find((f) => f[0] === "TOTAL");
decir(totDia[1] === 6710 && totDia[2] === 4025 && totDia[4] === 4, "los totales del mes");
const totDoce = doce.filas.find((f) => f[0] === "TOTAL 12 MESES");
decir(totDoce[1] === 106710 && totDoce[3] === 106710 - 64025 && doce.filas[1][0] === "08/2026", "los 12 meses, con su total");

console.log("\nCompras");
const hc = hojaCompras([{ fecha: "2026-09-05", proveedor: "Mayorista", cuit: "30-1", comprobante: "R 0001-123", renglones: 12, total: 45000.5 }]);
decir(/NO ES UN LIBRO DE COMPRAS FISCAL/.test(hc.filas[0][0]), "arranca avisando que no es fiscal");
decir(hc.filas[hc.filas.length - 1][5] === 45000.5, "el total");

console.log("\nDetalles");
decir(signoDe(8) === -1 && signoDe(53) === -1 && signoDe(2) === 1, "resta la nota de crédito, suma la de débito");
decir(fechaAR("2026-12-31") === "31/12/2026", "la fecha");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
