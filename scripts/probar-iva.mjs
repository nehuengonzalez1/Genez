/* ============================================================
   PRUEBA · el IVA de un comprobante, por alícuota
   ============================================================

   `desglosarIva` es lo que va a decirle a ARCA cuánto IVA tiene cada
   factura A y B. No toca la base ni la red: son cuentas, y se prueban
   con cuentas hechas a mano y con diez mil ventas al azar.

   Lo que ARCA no perdona, y por eso se prueba en cada una de las diez
   mil: que el total sea exactamente la suma de las partes, que cada
   neto más su IVA sea exactamente su importe, y que el IVA de cada
   alícuota no se aleje un centavo de neto × alícuota.

     node scripts/probar-iva.mjs
   ============================================================ */

import { desglosarIva, importesParaArca, ErrorIva, ID_ALICUOTA } from "../src/utils/iva.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };
const c = (x) => Math.round(x * 100);
const r = (total, iva = 21, ivaCondicion = "gravado") => ({ total, iva, ivaCondicion });

console.log("\nCuentas a mano");
let d = desglosarIva([r(1210)], 1210);
decir(d.neto === 1000 && d.iva === 210 && d.alicuotas.length === 1 && d.alicuotas[0].id === 5,
  `$1.210 al 21%: neto 1.000, IVA 210, alícuota 5 de ARCA (${d.neto} / ${d.iva})`);

d = desglosarIva([r(1105, 10.5)], 1105);
decir(d.neto === 1000 && d.iva === 105 && d.alicuotas[0].id === 4, "$1.105 al 10,5%: neto 1.000, IVA 105, alícuota 4");

d = desglosarIva([r(1210), r(1105, 10.5)], 2315);
decir(d.neto === 2000 && d.iva === 315 && d.alicuotas.map((a) => a.alicuota).join() === "10.5,21",
  "21% y 10,5% en la misma venta: dos alícuotas, de menor a mayor");

/* 10% de descuento sobre toda la compra: cada alícuota paga su parte. */
d = desglosarIva([r(1210), r(1105, 10.5)], 2083.5);
const a21 = d.alicuotas.find((a) => a.alicuota === 21), a105 = d.alicuotas.find((a) => a.alicuota === 10.5);
decir(a21.base === 900 && a21.importe === 189 && a105.base === 900 && a105.importe === 94.5,
  `descuento del 10%: 900 + 189 al 21% y 900 + 94,50 al 10,5% (${a21.base}+${a21.importe}, ${a105.base}+${a105.importe})`);

/* Recargo de la tarjeta: también se reparte. */
d = desglosarIva([r(1000), r(1000, 10.5)], 2200);
decir(c(d.total) === c(d.neto + d.iva) && d.alicuotas.every((a) => c(a.base + a.importe) === 110000),
  "recargo del 10%: cada alícuota sube lo suyo, $1.100 cada una");

d = desglosarIva([r(500, 0, "exento"), r(300, 0, "no_gravado"), r(200, 0), r(1210)], 2210);
decir(d.exento === 500 && d.noGravado === 300 && d.alicuotas.some((a) => a.id === 3 && a.base === 200 && a.importe === 0),
  "exento, no gravado y gravado al 0% van cada uno por su lado");
decir(d.neto === 1200 && d.iva === 210, "el neto gravado incluye la base del 0%, sin IVA");

d = desglosarIva([r(333.33), r(333.33), r(333.34)], 1000);
decir(d.alicuotas.length === 1 && c(d.neto + d.iva) === 100000, "tres renglones de la misma alícuota se agrupan en una");

d = desglosarIva([r(0)], 0);
decir(d.total === 0 && d.iva === 0, "un comprobante en cero no rompe");

console.log("\nLo que tiene que rechazar");
const rechaza = (f) => { try { f(); return false; } catch (e) { return e instanceof ErrorIva; } };
decir(rechaza(() => desglosarIva([r(100, 11)], 100)), "una alícuota que ARCA no conoce (11%)");
decir(rechaza(() => desglosarIva([r(100, 21, "medio")], 100)), "una condición inventada");
decir(rechaza(() => desglosarIva([], 100)), "un total sin renglones");
decir(rechaza(() => desglosarIva([r(-5)], 0)), "un renglón negativo");

console.log("\nEl pedido a ARCA");
d = desglosarIva([r(1210), r(500, 0, "exento")], 1710);
let p = importesParaArca(d, "A");
decir(p.ImpNeto === 1000 && p.ImpIVA === 210 && p.ImpOpEx === 500 && p.ImpTotConc === 0 && p.ImpTotal === 1710,
  "A: neto, IVA, exento y total en sus campos");
decir(p.Iva && p.Iva.length === 1 && p.Iva[0].Id === 5 && p.Iva[0].BaseImp === 1000 && p.Iva[0].Importe === 210,
  "A: el detalle por alícuota va en Iva");
decir(JSON.stringify(importesParaArca(d, "B")) === JSON.stringify(p), "B: lo mismo que la A (ARCA pide el detalle igual)");
p = importesParaArca(d, "C");
decir(p.ImpNeto === 1710 && p.ImpIVA === 0 && !p.Iva, "C: todo es neto y sin Iva, como hasta ahora");
p = importesParaArca(desglosarIva([r(500, 0, "exento")], 500), "B");
decir(!("Iva" in p) && p.ImpOpEx === 500, "todo exento: sin arreglo Iva vacío, que ARCA rechaza");

console.log("\nDiez mil ventas al azar");
/* PRNG con semilla, como el generador: si algo falla, falla igual la
   próxima vez y se puede mirar. */
let semilla = 20260927;
const azar = () => { semilla = (semilla + 0x6d2b79f5) | 0; let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const tasas = Object.keys(ID_ALICUOTA).map(Number);
let malas = 0, primera = null;
for (let n = 0; n < 10000; n++) {
  const renglones = Array.from({ length: 1 + Math.floor(azar() * 12) }, () => {
    const u = azar();
    const cond = u < 0.08 ? "exento" : u < 0.12 ? "no_gravado" : "gravado";
    /* Precios con centavos a veces (los de balanza), enteros casi siempre. */
    const total = azar() < 0.3 ? Math.round(azar() * 5000000) / 100 : Math.round(azar() * 80000);
    return r(total, cond === "gravado" ? tasas[Math.floor(azar() * tasas.length)] : 0, cond);
  });
  const sub = renglones.reduce((s, x) => s + c(x.total), 0);
  /* Entre 30% de descuento y 15% de recargo. */
  const total = Math.round(sub * (0.7 + azar() * 0.45)) / 100;
  if (!sub) continue;
  const x = desglosarIva(renglones, total);
  const partes = x.alicuotas.reduce((s, a) => s + c(a.base) + c(a.importe), 0) + c(x.exento) + c(x.noGravado);
  const problemas = [];
  if (partes !== c(x.total) || c(x.total) !== c(total)) problemas.push(`las partes suman ${partes} y el total es ${c(total)}`);
  if (c(x.neto) !== x.alicuotas.reduce((s, a) => s + c(a.base), 0)) problemas.push("el neto no es la suma de las bases");
  if (c(x.iva) !== x.alicuotas.reduce((s, a) => s + c(a.importe), 0)) problemas.push("el IVA no es la suma por alícuota");
  for (const a of x.alicuotas) {
    if (Math.abs(c(a.importe) - c(a.base) * a.alicuota / 100) > 1) problemas.push(`al ${a.alicuota}%: ${a.importe} sobre ${a.base}`);
    if (c(a.base) < 0 || c(a.importe) < 0) problemas.push("un importe negativo");
  }
  if (problemas.length) { malas++; primera = primera || { renglones, total, problemas }; }
}
decir(!malas, malas ? `${malas} no cierran. La primera: ${JSON.stringify(primera)}` : "todas cierran al centavo, y el IVA a menos de un centavo de neto × alícuota");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
