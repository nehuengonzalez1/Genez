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
   - sin una tarifa, no hay total: se dice qué falta;
   - el pedido de presupuesto no sale sin nombre ni sin un WhatsApp que
     parezca un WhatsApp, y viaja limpio.

   No hay base ni red.

     node scripts/probar-presupuesto.mjs
   ============================================================ */

import { armarModulos, presupuestar, textoDelPresupuesto, DOLORES, GENERALES, conDolores, variantes } from "../src/datos/presupuesto.js";
import { RUBROS_DE_FABRICA } from "../src/datos/landing.js";
import { MODULOS_BASE } from "../src/datos/modulos.js";
import { validarPedido, armarPedido, normalizarTelefono } from "../src/datos/solicitudes.js";

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
  const { elegidos, motivos, necesita } = armarModulos({ rubro: mini, respuestas: { factura: true }, escala: "2-3" });
  decir(elegidos.includes("clientes"), "marcar 'Facturo A y B' enciende Clientes");
  decir(/Facturo A y B/.test(motivos.clientes), "y el motivo lo dice con la pregunta");
  decir(necesita.includes("Una computadora o tablet por puesto"), "con 2 a 3 puestos hace falta un equipo por puesto");
  decir(!armarModulos({ rubro: mini, escala: "1" }).necesita.includes("Una computadora o tablet por puesto"), "con un puesto, no");
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

console.log("\nLos dolores y las tres variantes\n");

{
  const r = conDolores(mini);
  decir(r.presentacion.preguntas.length === mini.presentacion.preguntas.length + DOLORES.length + GENERALES.length, "los dolores y las preguntas generales entran como preguntas más del rubro");
  decir(DOLORES.every((d) => d.modulos.every((k) => armarModulos({ rubro: r, respuestas: { [d.k]: true } }).elegidos.includes(k))), "cada dolor enciende módulos que el catálogo conoce");
  const { elegidos, motivos, necesita } = armarModulos({ rubro: r, respuestas: { d_clientes: true, g_sucursales: true } });
  decir(elegidos.includes("crm") && /información clara de mis clientes/.test(motivos.crm), "'No tengo información clara de mis clientes' enciende Seguimiento con su motivo");
  decir(elegidos.includes("permisos") && necesita.includes("Una computadora o tablet por sucursal"), "'Tengo varias sucursales' enciende Permisos y pide un equipo por sucursal");
}

{
  const r = conDolores(mini);
  const [arrancar, medida, completo] = variantes({ rubro: r, respuestas: { d_stock: true, factura: true }, sumados: ["pedidos"] });
  decir(igual(arrancar.armado.elegidos, [...MODULOS_BASE, ...mini.presentacion.nucleo].sort((a, b) => arrancar.armado.elegidos.indexOf(a) - arrancar.armado.elegidos.indexOf(b))), "'Para arrancar' es base más núcleo, nada más");
  decir(medida.armado.elegidos.includes("stock") && medida.armado.elegidos.includes("clientes") && medida.armado.elegidos.includes("pedidos"), "'A tu medida' es lo que salió de las respuestas y lo sumado");
  decir(medida.armado.elegidos.every((k) => completo.armado.elegidos.includes(k)) && completo.armado.elegidos.length > medida.armado.elegidos.length, "'Completo' contiene a la medida y suma el resto del rubro");
  decir(!completo.armado.elegidos.includes("cocina"), "y tampoco propone lo que el catálogo no conoce");
  decir(medida.recomendado === true, "la recomendada es la de las respuestas");
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
  const texto = textoDelPresupuesto({ rubro: mini, negocio: "Almacén", escala: "2-3", presupuesto: p, pesos: (n) => `$${n}` });
  decir(/Negocio: Almacén \(Comercio y minimercado\)/.test(texto) && /Puestos: 2 a 3/.test(texto), "el texto para WhatsApp dice el negocio concreto y los puestos");
  decir(/\$37000 por mes/.test(texto) && /\$50000 de puesta/.test(texto) && /Módulos \(6\)/.test(texto), "y los módulos y el precio");
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

console.log("\nEl pedido\n");

decir(validarPedido({ nombre: "", telefono: "1122334455" }) !== null, "sin nombre no se manda");
decir(validarPedido({ nombre: "Ana", telefono: "12" }) !== null, "un teléfono de dos dígitos no es un WhatsApp");
decir(validarPedido({ nombre: "Ana", telefono: "11 2233-4455", email: "ana@" }) !== null, "un email a medias tampoco");
decir(validarPedido({ nombre: "Ana", telefono: "11 2233-4455", email: "" }) === null, "nombre y WhatsApp alcanzan");
decir(normalizarTelefono("+54 9 11 2233-4455") === "5491122334455", "el teléfono se guarda solo con dígitos");

{
  const pedido = armarPedido({
    negocio: "Almacén", rubro: "minimercado", escala: "2-3",
    respuestas: [{ k: "factura", n: "Facturo A y B", modulos: ["clientes"] }],
    modulos: ["cobro", "caja", "ajustes", "clientes"], mensual: null, puesta_en_marcha: 0,
    nombre: " Ana ", telefono: "11 2233-4455", email: " ", mensaje: "",
  });
  decir(pedido.nombre === "Ana" && pedido.telefono === "1122334455", "el pedido va sin espacios de más");
  decir(pedido.email === null && pedido.mensaje === null, "y sin vacíos disfrazados de texto");
  decir(igual(pedido.respuestas, [{ k: "factura", n: "Facturo A y B" }]), "las respuestas guardan clave y texto, nada más");
}

console.log(`\n${total} verificaciones · ${fallas ? `${fallas} en rojo` : "todo en verde"}\n`);
process.exit(fallas ? 1 : 0);
