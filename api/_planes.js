/**
 * Lo que el plan de un comercio le deja hacer, contestado en el servidor.
 *
 * Hasta el 05/10 el plan era un texto en `empresas.plan` que no frenaba
 * nada: la landing decía "factura electrónica en Pro" y un comercio en
 * Simple, o en los diez días de prueba, podía conectar ARCA igual. Esconder
 * el botón en la pantalla no alcanza —la pantalla no protege nada, ver
 * CLAUDE.md— así que la regla vive acá y la consultan las funciones que
 * hacen la cosa: api/arca/*, api/usuarios.js y api/anthropic.js.
 *
 * Las reglas (acordadas el 05/10):
 *   - Prueba: es Pro sin ARCA. Una prueba que factura con el CUIT del
 *     comercio deja comprobantes reales a nombre de alguien que todavía no
 *     pagó, y no se pueden borrar.
 *   - Simple: un solo usuario, sin ARCA, sin asistente con IA.
 *   - Pro: multiusuario, ARCA, IA con tope.
 *   - Empresa, a medida y `completo` (los comercios de antes de los planes:
 *     Super 25, Bar Rivadavia, Almha…): todo. `completo` no se toca porque
 *     son clientes que ya tienen lo que tienen.
 *
 * "En prueba" no es solo `prueba_hasta`: la misma columna marca la gracia
 * de un cobro rechazado y el último día de una baja (0128). Lo que separa
 * una cosa de la otra es que haya suscripción en MP.
 */

/* Los topes de la IA por mes. La prueba no es por mes: es el total de los
   diez días, y alcanza para ver que funciona sin regalar el mes de Pro. */
export const TOPES_IA = {
  prueba:  { pregunta: 20,   remito: 5 },
  start:   { pregunta: 0,    remito: 0 },
  pro:     { pregunta: 150,  remito: 30 },
  todo:    { pregunta: 1000, remito: 200 },
};

const SUSCRIPCION_VIGENTE = ["activa", "pausada", "cancelada"];

export async function reglasDe(admin, empresaId) {
  const [emp, sus] = await Promise.all([
    admin.from("empresas").select("plan, prueba_hasta").eq("id", empresaId).single(),
    admin.from("suscripciones").select("estado").eq("empresa_id", empresaId).maybeSingle(),
  ]);
  if (emp.error || !emp.data) throw new Error("No se encontró el comercio.");

  const plan = emp.data.plan || "start";
  const pagando = !!(sus.data && SUSCRIPCION_VIGENTE.includes(sus.data.estado));
  const enPrueba = !!emp.data.prueba_hasta && !pagando;
  const completo = !["start", "pro"].includes(plan);

  return {
    plan,
    enPrueba,
    arca: !enPrueba && (plan === "pro" || completo),
    /* En la prueba se prueba Pro, multiusuario incluido. */
    unSoloUsuario: !enPrueba && plan === "start",
    topesIA: enPrueba ? TOPES_IA.prueba : completo ? TOPES_IA.todo : TOPES_IA[plan],
  };
}

export const MENSAJE_ARCA = {
  prueba: "Durante la prueba gratis no se conecta ARCA: los comprobantes serían reales. " +
    "Se habilita cuando contratás el plan Pro.",
  plan: "La factura electrónica viene con el plan Pro.",
};
