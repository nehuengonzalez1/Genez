/* ============================================================
   EL PRESUPUESTO · qué módulos necesita alguien y cuánto le sale
   ============================================================

   Es la cabeza del alta guiada, separada de la pantalla para que se
   pueda probar sin navegador ni base (scripts/probar-presupuesto.mjs).
   No importa Supabase ni React: recibe datos y devuelve datos.

   DE DÓNDE SALEN LOS MÓDULOS
   --------------------------
   No del rubro entero. Un rubro trae once módulos posibles y un
   almacén de barrio usa cinco: proponerle los once es cobrarle de más
   y esconderle cuáles le sirven. Entonces:

     base        cobro, caja y ajustes. Siempre: sin eso no hay sistema.
     núcleo      lo que un comercio del rubro usa sí o sí (la carta en
                 un bar, la agenda en un consultorio). Lo dice
                 `presentacion.nucleo` del rubro.
     respuestas  cada tilde del paso 2 enciende módulos y suma cosas que
                 hay que tener (`preguntas[].modulos` y `.necesita`).
     a mano      lo que la persona sacó o sumó en el paso 3. Se puede
                 sacar todo menos la base; se puede sumar cualquiera
                 del rubro que no haya entrado por otro lado.

   Cada módulo sabe por qué está: se muestra al lado, así el que mira
   entiende que "Clientes" entró porque marcó "Facturo A y B".

   Un módulo que el rubro nombra pero el catálogo no conoce (hoy,
   `cocina`) no se propone: no se puede cobrar ni explicar algo que no
   tiene nombre.
   ============================================================ */

import { MODULOS, MODULOS_BASE, moduloPorClave } from "./modulos.js";

const unicos = (xs) => Array.from(new Set(xs));
const conocido = (k) => !!moduloPorClave(k);

export function armarModulos({ rubro, respuestas = {}, sacados = [], sumados = [] }) {
  const p = (rubro && rubro.presentacion) || {};
  const preguntas = (p.preguntas || []).filter((q) => respuestas[q.k]);
  const nucleo = (p.nucleo || []).filter(conocido);

  /* El universo del rubro: lo que se le puede ofrecer. Un rubro sin
     lista ("Otro tipo de negocio") puede sumar cualquiera del catálogo. */
  const universo = unicos([
    ...MODULOS_BASE,
    ...nucleo,
    ...((rubro && rubro.modulos && rubro.modulos.length) ? rubro.modulos : MODULOS.map((m) => m.k)),
    ...preguntas.flatMap((q) => q.modulos || []),
  ]).filter(conocido);

  const motivos = {};
  for (const k of MODULOS_BASE) motivos[k] = "Siempre incluido";
  for (const k of nucleo) if (!motivos[k]) motivos[k] = "Viene con tu rubro";
  for (const q of preguntas) {
    for (const k of (q.modulos || []).filter(conocido)) {
      if (!motivos[k]) motivos[k] = `Porque marcaste "${q.n}"`;
    }
  }

  const propuestos = Object.keys(motivos);
  const elegidos = unicos([
    ...propuestos.filter((k) => MODULOS_BASE.includes(k) || !sacados.includes(k)),
    ...sumados.filter((k) => universo.includes(k) && !propuestos.includes(k)),
  ]);
  for (const k of elegidos) if (!motivos[k]) motivos[k] = "Lo sumaste vos";

  /* En el orden del catálogo, que es el orden en que el sistema los
     muestra: base primero, después el resto. */
  const orden = (k) => MODULOS.findIndex((m) => m.k === k);
  elegidos.sort((a, b) => orden(a) - orden(b));

  const necesita = unicos([
    ...elegidos.flatMap((k) => moduloPorClave(k).necesita || []),
    ...preguntas.flatMap((q) => q.necesita || []),
  ]);

  /* Dos módulos del catálogo se llaman "Informes" (uno mira márgenes,
     el otro ocupación). Si ya está uno, ofrecer el otro para sumar se
     ve como el mismo módulo dos veces. */
  const nombresElegidos = new Set(elegidos.map((k) => moduloPorClave(k).n));
  const sumables = universo
    .filter((k) => !propuestos.includes(k) && !elegidos.includes(k) && !nombresElegidos.has(moduloPorClave(k).n))
    .sort((a, b) => orden(a) - orden(b));

  return { elegidos, motivos, propuestos, sumables, necesita };
}

/* ------------------------------------------------------------
   El presupuesto

   Base más un precio por cada módulo que no es base. Si falta algún
   precio —la base o el de un módulo elegido— no hay total: se devuelve
   `mensual` en null y `faltan` dice cuáles, para que la pantalla diga
   "a confirmar" con todas las letras en vez de mostrar una suma
   incompleta como si fuera el precio.
   ------------------------------------------------------------ */

export function presupuestar(tarifas, elegidos) {
  const t = tarifas || {};
  const precios = t.modulos || {};

  const lineas = elegidos.map((k) => {
    const m = moduloPorClave(k) || { k, n: k, d: "" };
    const base = MODULOS_BASE.includes(k);
    return { k, n: m.n, d: m.d, base, monto: base ? 0 : (precios[k] == null ? null : Number(precios[k])) };
  });

  const faltan = [
    ...(t.base == null ? ["base"] : []),
    ...lineas.filter((l) => !l.base && l.monto == null).map((l) => l.k),
  ];

  const mensual = faltan.length
    ? null
    : Number(t.base) + lineas.reduce((s, l) => s + (l.base ? 0 : l.monto), 0);

  return {
    lineas,
    base: t.base == null ? null : Number(t.base),
    mensual,
    puestaEnMarcha: t.puestaEnMarcha == null ? 0 : Number(t.puestaEnMarcha),
    faltan,
    cantidad: elegidos.length,
  };
}

/* El texto que viaja por WhatsApp cuando la persona toca "Quiero
   empezar": lo que eligió, con números si los hay. Es texto plano a
   propósito: se lee en un teléfono y se contesta a mano. */
export function textoDelPresupuesto({ rubro, presupuesto, pesos }) {
  const titulo = (rubro && rubro.presentacion && rubro.presentacion.titulo) || (rubro && rubro.nombre) || "";
  const modulos = presupuesto.lineas.map((l) => l.n).join(", ");
  const precio = presupuesto.mensual == null
    ? "Precio: a confirmar"
    : `Precio: ${pesos(presupuesto.mensual)} por mes${presupuesto.puestaEnMarcha > 0 ? ` + ${pesos(presupuesto.puestaEnMarcha)} de puesta en marcha` : ""}`;
  return `Hola, quiero empezar con Genez.\nRubro: ${titulo}\nMódulos (${presupuesto.cantidad}): ${modulos}\n${precio}`;
}
