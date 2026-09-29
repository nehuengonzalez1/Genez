/* ============================================================
   PRUEBA · recalcular las promos de una comanda, sin base
   ============================================================

   aplicarPromosEnComanda (src/datos/comandas.js) decide qué renglones de
   una mesa llevan promo y los actualiza. Acá se compila con esbuild
   cambiando la conexión a Supabase por una de mentira que anota qué se
   actualizaría, para ver qué renglones toca y cuáles no.

     node scripts/probar-promos-comanda.mjs
   ============================================================ */

import { build } from "esbuild";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

const dir = mkdtempSync(join(tmpdir(), "genez-promos-"));
const falso = join(dir, "supabase-falso.js");
/* La lista va en globalThis: esbuild copia este archivo adentro del
   compilado, y sin eso la prueba miraría otra lista que la que llena. */
writeFileSync(falso, `
export const escritos = (globalThis.__escritosPromos ||= []);
const q = { update(d) { this.d = d; return this; }, eq(k, v) { escritos.push({ id: v, ...this.d }); return Promise.resolve({ error: null }); },
  select() { return this; }, order() { return this; }, maybeSingle() { return Promise.resolve({ data: null }); }, single() { return Promise.resolve({ data: null }); } };
export const supabase = { from: () => Object.create(q), rpc: () => Promise.resolve({ data: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }) };
`);
const salida = join(dir, "comandas.mjs");
await build({
  entryPoints: [resolve("src/datos/comandas.js")], bundle: true, platform: "node", format: "esm", outfile: salida, logLevel: "error",
  plugins: [{ name: "falso", setup(b) { b.onResolve({ filter: /\/supabase\.js$/ }, () => ({ path: falso })); } }],
});
const { aplicarPromosEnComanda } = await import(pathToFileURL(salida).href);
const { escritos } = await import(pathToFileURL(falso).href);

const a = (h, m = 0) => new Date(2026, 8, 30, h, m);
const L = (id, itemId, cantidad, precio, extra = {}) => ({
  id, itemId, cantidad, precio, total: Math.round(precio * cantidad), descuento: 0, promo: null, pedidaEn: a(19, 50), extra: {}, ...extra,
});
const hh = { id: "hh", nombre: "Happy hour", tipo: "nxm", parametros: { lleva: 2, paga: 1 }, alcance: { productos: [], rubros: ["Cervezas"] }, dias: [], activa: true, horaDesde: "18:00", horaHasta: "20:00" };
const cat = new Map([["pinta", "Cervezas"], ["papas", "Para compartir"]]);

console.log("\nUna mesa en happy hour");
let comanda = { abiertaEn: a(19), lineas: [L("l1", "pinta", 2, 3000), L("l2", "papas", 1, 5000), L("l3", "pinta", 2, 3000, { pedidaEn: a(20, 30) })] };
escritos.length = 0;
let n = await aplicarPromosEnComanda(comanda, [hh], cat);
const e1 = escritos.find((x) => x.id === "l1");
decir(n === 1 && e1 && e1.descuento === 3000 && e1.total === 3000 && e1.campos_extra.promo === "Happy hour", "las pintas de las 19:50: 2x1, total $3.000");
decir(!escritos.find((x) => x.id === "l2"), "las papas no son del rubro: no se tocan");
decir(!escritos.find((x) => x.id === "l3"), "las de las 20:30 quedan fuera del happy hour: no se tocan");

console.log("\nYa guardada, no vuelve a escribir");
comanda = { abiertaEn: a(19), lineas: [L("l1", "pinta", 2, 3000, { descuento: 3000, total: 3000, promo: "Happy hour", extra: { promo: "Happy hour" } })] };
escritos.length = 0;
n = await aplicarPromosEnComanda(comanda, [hh], cat);
decir(n === 0 && !escritos.length, "nada que cambiar, nada que escribir");

console.log("\nLa promo se apagó");
n = await aplicarPromosEnComanda(comanda, [{ ...hh, activa: false }], cat);
const e2 = escritos.find((x) => x.id === "l1");
decir(n === 1 && e2 && e2.descuento === 0 && e2.total === 6000 && !("promo" in e2.campos_extra), "se le saca la promo y vuelve al total entero");

console.log("\nLo que no es de una promo no se toca");
comanda = { abiertaEn: a(19), lineas: [L("l1", "papas", 1, 5000, { descuento: 500, total: 4500 })] };
escritos.length = 0;
n = await aplicarPromosEnComanda(comanda, [hh], cat);
decir(n === 0 && !escritos.length, "un renglón con descuento pero sin promo queda como está");

console.log("\nCambió la cantidad");
/* cambiarCantidad deja el total entero con el descuento viejo: el
   recálculo lo corrige. */
comanda = { abiertaEn: a(19), lineas: [L("l1", "pinta", 4, 3000, { descuento: 3000, total: 12000, promo: "Happy hour", extra: { promo: "Happy hour" } })] };
escritos.length = 0;
n = await aplicarPromosEnComanda(comanda, [hh], cat);
const e3 = escritos.find((x) => x.id === "l1");
decir(n === 1 && e3.descuento === 6000 && e3.total === 6000, "de 2 a 4 pintas: dos gratis, total $6.000");

console.log("\nRenglones de antes de 0105, sin hora");
comanda = { abiertaEn: a(19), lineas: [L("l1", "pinta", 2, 3000, { pedidaEn: null })] };
escritos.length = 0;
n = await aplicarPromosEnComanda(comanda, [hh], cat);
decir(n === 1, "usan la hora en que se abrió la mesa (19:00, dentro del happy hour)");

rmSync(dir, { recursive: true, force: true });
console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
