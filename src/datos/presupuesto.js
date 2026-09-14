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

/* Cuántos puestos de venta o atención. No es una pregunta del rubro sino
   de cualquier negocio, por eso es fija y no vive en `presentacion`. Lo
   que cambia es lo que hay que tener: un equipo por puesto. */
export const ESCALAS = [
  { k: "1", n: "1 puesto", d: "Una caja o una persona atendiendo" },
  { k: "2-3", n: "2 a 3", d: "Varias cajas o varias personas" },
  { k: "4+", n: "4 o más", d: "Varios locales o un salón grande" },
];

export function armarModulos({ rubro, respuestas = {}, sacados = [], sumados = [], escala = "1" }) {
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
    ...(escala && escala !== "1" ? ["Una computadora o tablet por puesto"] : []),
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
   Los dolores

   Lo que le complica a un comerciante, en sus palabras. Cada dolor
   enciende módulos igual que una pregunta del rubro: entra al alta
   guiada como una pregunta más, con su motivo ("Porque marcaste…") y
   viaja en el pedido como cualquier respuesta. No es dato de la base
   porque no depende del rubro: son los dolores de cualquiera.
   ------------------------------------------------------------ */

export const DOLORES = [
  { k: "d_stock", n: "No tengo un control claro del stock", d: "No sé qué tengo, qué falta o cuándo reponer.", modulos: ["stock"], necesita: [] },
  { k: "d_faltantes", n: "Pierdo ventas por falta de stock", d: "Se me van productos y pierdo plata.", modulos: ["stock", "compras"], necesita: [] },
  { k: "d_precios", n: "Los precios y vencimientos se me desordenan", d: "Se me pasan fechas o cambio mal los precios.", modulos: ["productos", "stock"], necesita: [] },
  { k: "d_caja", n: "Me lleva mucho tiempo hacer la caja", d: "Cierro el día y no tengo un resumen claro.", modulos: ["reportes"], necesita: [] },
  { k: "d_atencion", n: "La atención es lenta", d: "Se forman filas y pierdo clientes.", modulos: ["productos"], necesita: ["Lector de códigos de barras (o la cámara del celular)"] },
  { k: "d_proveedores", n: "No tengo un registro ordenado de proveedores", d: "Remitos, facturas y pagos dispersos.", modulos: ["compras"], necesita: [] },
  { k: "d_sucursales", n: "Necesito manejar varias sucursales", d: "Quiero ver todo en un solo lugar.", modulos: ["permisos"], necesita: ["Una computadora o tablet por sucursal"] },
  { k: "d_clientes", n: "No tengo información clara de mis clientes", d: "No sé quién compra, ni con qué frecuencia.", modulos: ["crm"], necesita: [] },
  { k: "d_otro", n: "Otro problema", d: "Contanos cuál.", modulos: [], necesita: [], otro: true },
  { k: "d_ganancia", n: "Me resulta difícil entender cuánto gano", d: "Vendo, pero no veo reportes claros.", modulos: ["reportes"], necesita: [] },
];

/* Dos preguntas que no son del rubro ni un dolor: por dónde vende y si
   tiene sucursales. Van como preguntas generales para que enciendan
   módulos con su motivo y viajen en el pedido como las demás. */
export const GENERALES = [
  { k: "g_online", n: "Vendo online, además del local", modulos: ["pedidos"], necesita: [] },
  { k: "g_sucursales", n: "Tengo varias sucursales", modulos: ["permisos"], necesita: ["Una computadora o tablet por sucursal"] },
];

/* El rubro con los dolores y las preguntas generales como preguntas más,
   después de las suyas. */
export function conDolores(rubro) {
  const p = (rubro && rubro.presentacion) || {};
  return { ...rubro, presentacion: { ...p, preguntas: [...(p.preguntas || []), ...DOLORES, ...GENERALES] } };
}

/* ------------------------------------------------------------
   Las tres variantes

   Al final se eligen entre tres presupuestos: lo mínimo del rubro
   ("Start"), lo que salió de las respuestas ("Pro", que es el
   recomendado) y todo lo que el rubro puede usar ("Empresa").
   Las tres salen de la misma cabeza con distintos sacados/sumados, así
   que comparten motivos, necesidades y precio por módulo.
   ------------------------------------------------------------ */

export function variantes({ rubro, respuestas = {}, sacados = [], sumados = [], escala = "1" }) {
  const medida = armarModulos({ rubro, respuestas, sacados, sumados, escala });
  const nucleo = (rubro && rubro.presentacion && rubro.presentacion.nucleo) || [];
  const arrancar = armarModulos({
    rubro, respuestas, escala, sumados: [],
    sacados: medida.propuestos.filter((k) => !MODULOS_BASE.includes(k) && !nucleo.includes(k)),
  });
  const completo = armarModulos({
    rubro, respuestas, escala, sacados: [],
    sumados: [...medida.elegidos, ...medida.sumables],
  });
  /* Se llaman Start, Pro y Empresa (y no "base", que acá ya es otra
     cosa: los tres módulos que van siempre). */
  return [
    { k: "arrancar", n: "Start", d: "Lo esencial para empezar.", lema: "Ideal para negocios que recién empiezan.", armado: arrancar },
    { k: "medida", n: "Pro", d: "Más control, más posibilidades.", lema: "El plan ideal para hacer crecer tu negocio.", armado: medida, recomendado: true },
    { k: "completo", n: "Empresa", d: "Todo lo que tu negocio necesita.", lema: "La solución completa, sin límites.", armado: completo },
  ];
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
export function textoDelPresupuesto({ rubro, negocio, escala, opcion, presupuesto, pesos }) {
  const titulo = (rubro && rubro.presentacion && rubro.presentacion.titulo) || (rubro && rubro.nombre) || "";
  const que = negocio && negocio !== titulo ? `${negocio} (${titulo})` : titulo;
  const puestos = (ESCALAS.find((e) => e.k === escala) || {}).n;
  const modulos = presupuesto.lineas.map((l) => l.n).join(", ");
  const precio = presupuesto.mensual == null
    ? "Precio: a confirmar"
    : `Precio: ${pesos(presupuesto.mensual)} por mes${presupuesto.puestaEnMarcha > 0 ? ` + ${pesos(presupuesto.puestaEnMarcha)} de puesta en marcha` : ""}`;
  return [
    "Hola, quiero empezar con Genez.",
    `Negocio: ${que}`,
    puestos ? `Puestos: ${puestos}` : null,
    opcion ? `Presupuesto: ${opcion}` : null,
    `Módulos (${presupuesto.cantidad}): ${modulos}`,
    precio,
  ].filter(Boolean).join("\n");
}
