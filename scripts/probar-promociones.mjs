/* ============================================================
   PRUEBA · la cuenta de las promociones, sin base
   ============================================================

   src/utils/promociones.js con carritos armados a mano: cada clase de
   promo, las mezclas dentro de un grupo, lo que no entra (precio a mano,
   precio por cantidad, por peso), cuándo vale y el orden entre promos.

     node scripts/probar-promociones.mjs
   ============================================================ */

import { aplicarPromociones, vigente, describir } from "../src/utils/promociones.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };

const L = (lid, pid, qty, unit, extra = {}) => ({ lid, pid, qty, unit, categoria: extra.categoria || "Bebidas", unidad: extra.unidad || "un", elegible: extra.elegible !== false });
const P = (id, tipo, parametros, alcance, extra = {}) => ({ id, nombre: extra.nombre || id, tipo, parametros, alcance, activa: true, dias: [], ...extra });
const miercoles = new Date(2026, 8, 30, 12);   // 30/09/2026, miércoles

console.log("\n2x1 y 3x2");
let r = aplicarPromociones([L("a", "coca", 2, 2000)], [P("2x1", "nxm", { lleva: 2, paga: 1 }, { productos: ["coca"] })], miercoles);
decir(r.porLinea.a && r.porLinea.a.descuento === 2000, "dos Coca de $2.000 en 2x1: se descuenta una");
r = aplicarPromociones([L("a", "coca", 3, 2000)], [P("2x1", "nxm", { lleva: 2, paga: 1 }, { productos: ["coca"] })], miercoles);
decir(r.porLinea.a.descuento === 2000, "con tres, solo un par: la tercera se paga");
r = aplicarPromociones([L("a", "coca", 1, 2000), L("b", "sprite", 1, 1800)], [P("2x1", "nxm", { lleva: 2, paga: 1 }, { rubros: ["Bebidas"] })], miercoles);
decir(!r.porLinea.a && r.porLinea.b.descuento === 1800, "mezclando: va gratis la más barata (la Sprite)");
r = aplicarPromociones([L("a", "coca", 4, 2000)], [P("3x2", "nxm", { lleva: 3, paga: 2 }, { productos: ["coca"] })], miercoles);
decir(r.porLinea.a.descuento === 2000 && r.total === 2000, "3x2 con cuatro: una gratis, la cuarta se paga");

console.log("\nSegunda unidad");
r = aplicarPromociones([L("a", "yerba", 2, 4000)], [P("2da", "segunda", { pct: 50 }, { productos: ["yerba"] })], miercoles);
decir(r.porLinea.a.descuento === 2000, "dos yerbas de $4.000, la segunda al 50%: $2.000 menos");
r = aplicarPromociones([L("a", "yerba", 1, 4000), L("b", "yerba2", 1, 3000)], [P("2da", "segunda", { pct: 50 }, { productos: ["yerba", "yerba2"] })], miercoles);
decir(!r.porLinea.a && r.porLinea.b.descuento === 1500, "la rebajada es la más barata");

console.log("\nPack y porcentaje");
r = aplicarPromociones([L("a", "alfajor", 3, 400)], [P("3x1000", "pack", { cantidad: 3, precio: 1000 }, { productos: ["alfajor"] })], miercoles);
decir(r.porLinea.a.descuento === 200, "3 alfajores de $400 por $1.000: $200 menos");
r = aplicarPromociones([L("a", "alfajor", 3, 300)], [P("3x1000", "pack", { cantidad: 3, precio: 1000 }, { productos: ["alfajor"] })], miercoles);
decir(!r.porLinea.a && r.total === 0, "un pack más caro que comprar suelto no se aplica");
r = aplicarPromociones([L("a", "lavandina", 2, 1000, { categoria: "Limpieza" })], [P("20", "porcentaje", { pct: 20 }, { rubros: ["Limpieza"] })], miercoles);
decir(r.porLinea.a.descuento === 400, "20% en Limpieza: $400 sobre $2.000");
r = aplicarPromociones([L("a", "queso", 0.35, 12000, { categoria: "Fiambres", unidad: "kg" })], [P("10", "porcentaje", { pct: 10 }, { rubros: ["Fiambres"] }), P("2x1", "nxm", { lleva: 2, paga: 1 }, { rubros: ["Fiambres"] })], miercoles);
decir(r.porLinea.a.descuento === 420, "por peso: el porcentaje sí (10% de 350 g a $12.000 = $420), el 2x1 no");

console.log("\nLo que no entra");
r = aplicarPromociones([L("a", "coca", 2, 2000, { elegible: false })], [P("2x1", "nxm", { lleva: 2, paga: 1 }, { productos: ["coca"] })], miercoles);
decir(r.total === 0, "precio a mano o por cantidad: sin promo");
r = aplicarPromociones([L("a", "pepsi", 2, 2000)], [P("2x1", "nxm", { lleva: 2, paga: 1 }, { productos: ["coca"] })], miercoles);
decir(r.total === 0, "un producto que la promo no abarca");

console.log("\nCada unidad en una sola promo");
r = aplicarPromociones([L("a", "coca", 3, 2000)], [P("20", "porcentaje", { pct: 20 }, { productos: ["coca"] }, { nombre: "20%" }), P("2x1", "nxm", { lleva: 2, paga: 1 }, { productos: ["coca"] }, { nombre: "2x1" })], miercoles);
decir(r.porLinea.a.descuento === 2000 + 400 && r.porLinea.a.promos.join() === "2x1,20%", "el 2x1 va primero y la tercera se lleva el 20%: $2.400");

console.log("\nCuándo vale");
decir(vigente(P("x", "porcentaje", { pct: 10 }, {}, { dias: [3] }), miercoles), "los miércoles, un miércoles: sí");
decir(!vigente(P("x", "porcentaje", { pct: 10 }, {}, { dias: [4] }), miercoles), "los jueves, un miércoles: no");
decir(!vigente(P("x", "porcentaje", { pct: 10 }, {}, { hasta: "2026-09-29" }), miercoles), "vencida el 29: no");
decir(vigente(P("x", "porcentaje", { pct: 10 }, {}, { desde: "2026-09-30", hasta: "2026-09-30" }), miercoles), "solo el 30, el 30: sí");
decir(!vigente(P("x", "porcentaje", { pct: 10 }, {}, { activa: false }), miercoles), "apagada: no");

console.log("\nCómo se dice");
decir(describir(P("x", "nxm", { lleva: 3, paga: 2 }, {})) === "3x2" && describir(P("x", "segunda", { pct: 50 }, {})) === "2da al 50%", "3x2 y 2da al 50%");

console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien.");
process.exitCode = fallas ? 1 : 0;
