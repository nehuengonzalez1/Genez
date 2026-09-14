/* ============================================================
   PRUEBA · el presupuesto del alta guiada
   ============================================================

   La cabeza del alta guiada (src/datos/presupuesto.js) es pura: recibe
   el rubro, las respuestas y las tarifas, y devuelve módulos y precio.
   Acá se la llama con casos concretos y se mira que haga lo que dice.

   Lo que se protege:
   - los módulos salen de las respuestas, no del rubro entero;
   - la base no se puede sacar, lo demás sí, y se puede sumar del rubro;
   - un módulo que el catálogo no conoce no se propone;
   - sin una tarifa, no hay total: se dice qué falta.

   No hay base ni red.

     node scripts/probar-presupuesto.mjs
   ============================================================ */

import { armarModulos, presupuestar, textoDelPresupuesto } from "../src/datos/presupuesto.js";
import { RUBROS_DE_FABRICA } from "../src/datos/landing.js";
import { MODULOS_BASE } from "../src/datos/modulos.js";

let fallas = 0;
let total = 0;
const decir = (ok, texto) => { total++; if (!ok) fallas++; console.log(`  ${ok ? "ok " : "MAL"}  ${texto}`); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const rubro = (clave) => RUBROS_DE_FABRICA.find((r) => r.clave === clave);
const mini = rubro("minimercado");
const gastro = rubro("gastronomia");
const turnos = rubro("servicios");

console.log("\nLos módulos salen de las respuestas\n");

{
  const { elegidos, motivos, sumables } = armarModulos({ rubro: mini });
  decir(MODULOS_BASE.every((k) => elegidos.includes(k)), "sin responder nada, van los base");
  decir(mini.presentacion.nucleo.every((k) => elegidos.includes(k)), "y el núcleo del rubro");
  decir(elegidos.length === MODULOS_BASE.length + mini.presentacion.nucleo.length, `y nada más (${elegidos.length} módulos, no los ${mini.modulos.length} del rubro)`);
  decir(!elegidos.includes("clientes") && sumables.includes("clientes"), "Clientes no entra solo, pero se puede sumar");
  decir(motivos.cobro === "Siempre incluido" && motivos.productos === "Viene con tu rubro", "cada módulo sabe por qué está");
}

{
  const { elegidos, motivos, necesita } = armarModulos({ rubro: mini, respuestas: { factura: true, cajas: true } });
  decir(elegidos.includes("clientes"), "marcar 'Facturo A y B' enciende Clientes");
  decir(/Facturo A y B/.test(motivos.clientes), "y el motivo lo dice con la pregunta");
  decir(necesita.includes("Una computadora o tablet por caja"), "'más de una caja' suma lo que hay que tener");
  decir(necesita.some((n) => /CUIT/.test(n)), "y facturar pide el CUIT (viene del módulo)");
}

console.log("\nSacar y sumar a mano\n");

{
  const { elegidos } = armarModulos({ rubro: mini, respuestas: { pedidos: true }, sacados: ["pedidos", "cobro"] });
  decir(!elegidos.includes("pedidos"), "lo que entró por una respuesta se puede sacar");
  decir(elegidos.includes("cobro"), "la base no se puede sacar aunque se pida");
}

{
  const { elegidos, motivos, sumables } = armarModulos({ rubro: mini, sumados: ["compras", "agenda"] });
  decir(elegidos.includes("compras") && motivos.compras === "Lo sumaste vos", "se puede sumar un módulo del rubro");
  decir(!elegidos.includes("agenda"), "pero no uno que el rubro no ofrece");
  decir(!sumables.includes("compras"), "y lo sumado deja de estar entre los sumables");
}

{
  const otro = { clave: "otro", nombre: "Otro", modulos: [], presentacion: { nucleo: ["productos"], preguntas: [{ k: "turnos", n: "Doy turnos", modulos: ["agenda"], necesita: [] }] } };
  const { elegidos, sumables } = armarModulos({ rubro: otro, respuestas: { turnos: true } });
  decir(elegidos.includes("agenda"), "un rubro sin lista propia acepta lo que encienden sus preguntas");
  decir(sumables.includes("crm"), "y puede sumar cualquiera del catálogo");
}

{
  const { elegidos, sumables } = armarModulos({ rubro: gastro, respuestas: { mesas: true } });
  decir(elegidos.includes("comandas"), "en gastronomía, 'tengo salón' enciende Salón");
  decir(!elegidos.includes("cocina") && !sumables.includes("cocina"), "'cocina' está en el rubro pero no en el catálogo: no se propone");
}

{
  const { elegidos } = armarModulos({ rubro: turnos, respuestas: { equipo: true } });
  decir(elegidos.includes("agenda") && elegidos.includes("servicios"), "turnos: agenda y servicios son el núcleo");
  decir(elegidos.includes("equipo") && elegidos.includes("permisos"), "'trabajan otras personas' enciende Equipo y Permisos");
}

console.log("\nEl precio\n");

const tarifas = { base: 20000, puestaEnMarcha: 50000, modulos: { productos: 5000, reportes: 4000, clientes: 8000, stock: 6000 }, whatsapp: "5491100000000" };

{
  const { elegidos } = armarModulos({ rubro: mini, respuestas: { factura: true } });
  const p = presupuestar(tarifas, elegidos);
  decir(p.cantidad === elegidos.length, `cuenta los módulos (${p.cantidad})`);
  decir(p.mensual === 20000 + 5000 + 4000 + 8000, `suma base más módulos: ${p.mensual}`);
  decir(p.lineas.find((l) => l.k === "cobro").base && p.lineas.find((l) => l.k === "cobro").monto === 0, "los base van a cero, incluidos en la base");
  decir(p.puestaEnMarcha === 50000 && p.faltan.length === 0, "trae la puesta en marcha y no falta nada");
  const texto = textoDelPresupuesto({ rubro: mini, presupuesto: p, pesos: (n) => `$${n}` });
  decir(/Rubro: Comercio y minimercado/.test(texto) && /\$37000 por mes/.test(texto) && /\$50000 de puesta/.test(texto), "el texto para WhatsApp dice rubro, módulos y precio");
}

{
  const { elegidos } = armarModulos({ rubro: mini, respuestas: { stock: true, pedidos: true } });
  const p = presupuestar(tarifas, elegidos);
  decir(p.mensual === null && igual(p.faltan, ["pedidos"]), "sin la tarifa de un módulo no hay total y dice cuál falta");
}

{
  const p = presupuestar({ base: null, modulos: {} }, ["cobro", "caja", "ajustes"]);
  decir(p.mensual === null && p.faltan[0] === "base", "sin base tampoco, y lo dice primero");
  decir(p.puestaEnMarcha === 0, "sin puesta en marcha cargada, es cero");
}

{
  const p = presupuestar(null, ["cobro", "caja", "ajustes"]);
  decir(p.mensual === null && p.cantidad === 3, "sin tarifas (base sin contestar) no explota");
}

console.log(`\n${total} verificaciones · ${fallas ? `${fallas} en rojo` : "todo en verde"}\n`);
process.exit(fallas ? 1 : 0);
