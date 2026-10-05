/* ============================================================
   TARIFAS · cuánto cuesta cada cosa
   ============================================================

   La plataforma las edita desde su panel (con sesión, RLS decide) y el
   alta guiada las lee sin sesión por `tarifas_publicas()`. La tabla es
   una fila por concepto (0073); acá se traduce a un objeto con forma,
   que es lo que el resto de la aplicación quiere usar:

     { base, puestaEnMarcha, modulos: { [clave]: monto }, whatsapp,
       descuento: { porcentaje, meses } }

   Un monto en null es "a confirmar". Sin filas, todo es null y el
   presupuesto lo dice; nunca se inventa un número.

   El descuento (02/10) es el de lanzamiento: un porcentaje sobre el
   precio de lista durante los primeros meses de cada cliente. Son dos
   filas más (`descuento` y `descuento_meses`), no una migración: la
   tabla ya es un concepto por fila. Sin porcentaje, no hay descuento;
   sin meses, el descuento no tiene fin.

   A medida (02/10): el que no toma el plan de su negocio y se queda solo
   con los módulos que eligió paga con otra lista, `medida:base` y
   `medida:<clave>`. Sin la base a medida, esa opción no se ofrece.

   Planes con precio fijo (05/10): Simple y Pro cuestan lo mismo en todos
   los rubros, sin sumar módulos. `plan:start` y `plan:pro` son el precio
   por mes; `anual_meses` cuántos meses paga el que paga el año (10: dos
   gratis); `congelado_meses` cuánto dura el precio del lanzamiento antes
   de ajustarse por inflación; `sucursales_incluidas` y `sucursal_extra`,
   las sucursales que trae Pro y lo que cuesta cada una más. Empresa no
   tiene precio: es a medida. Siguen siendo filas, no una migración.
   ============================================================ */

/* El WhatsApp al que llega el presupuesto mientras la plataforma no cargue
   uno desde su panel. Es lo único de acá que no es un precio: sin un
   número, el que llega al final no tiene con quién hablar. Vacío = no se
   ofrece el botón. Lo que se cargue en `tarifas` lo pisa. */
export const CONTACTO_DE_FABRICA = Object.freeze({ whatsapp: "" });

export const TARIFAS_VACIAS = Object.freeze({
  base: null,
  puestaEnMarcha: null,
  modulos: {},
  whatsapp: CONTACTO_DE_FABRICA.whatsapp,
  descuento: Object.freeze({ porcentaje: null, meses: null }),
  medida: Object.freeze({ base: null, modulos: Object.freeze({}) }),
  planes: Object.freeze({ start: null, pro: null }),
  anualMeses: null,
  congeladoMeses: null,
  sucursalesIncluidas: null,
  sucursalExtra: null,
});

/* Las claves de las filas sueltas de los planes con precio fijo, y el
   nombre que tienen en el objeto. */
const SUELTAS = {
  anual_meses: "anualMeses",
  congelado_meses: "congeladoMeses",
  sucursales_incluidas: "sucursalesIncluidas",
  sucursal_extra: "sucursalExtra",
};

const numero = (v) => (v == null || v === "" ? null : Number(v));

export function armarTarifas(filas) {
  const t = { ...TARIFAS_VACIAS, modulos: {}, descuento: { porcentaje: null, meses: null }, medida: { base: null, modulos: {} }, planes: { start: null, pro: null } };
  for (const f of filas || []) {
    if (f.clave.startsWith("plan:")) t.planes[f.clave.slice("plan:".length)] = numero(f.monto);
    else if (SUELTAS[f.clave]) t[SUELTAS[f.clave]] = numero(f.monto);
    else if (f.clave === "base") t.base = numero(f.monto);
    else if (f.clave === "puesta_en_marcha") t.puestaEnMarcha = numero(f.monto);
    else if (f.clave === "whatsapp") t.whatsapp = (f.texto || "").trim() || CONTACTO_DE_FABRICA.whatsapp;
    else if (f.clave === "descuento") t.descuento.porcentaje = numero(f.monto);
    else if (f.clave === "descuento_meses") t.descuento.meses = numero(f.monto);
    else if (f.clave.startsWith("modulo:")) t.modulos[f.clave.slice("modulo:".length)] = numero(f.monto);
    else if (f.clave === "medida:base") t.medida.base = numero(f.monto);
    else if (f.clave.startsWith("medida:")) t.medida.modulos[f.clave.slice("medida:".length)] = numero(f.monto);
  }
  return t;
}

/* De vuelta a filas, para guardar. Se guarda todo lo que tiene valor y
   también lo que se vació: una tarifa borrada vuelve a "a confirmar",
   que es distinto de no haber existido nunca solo para el que mira la
   tabla. */
export function filasDeTarifas(t) {
  const filas = [
    { clave: "base", monto: numero(t.base), texto: null },
    { clave: "puesta_en_marcha", monto: numero(t.puestaEnMarcha), texto: null },
    { clave: "whatsapp", monto: null, texto: (t.whatsapp || "").trim() || null },
    { clave: "descuento", monto: numero((t.descuento || {}).porcentaje), texto: null },
    { clave: "descuento_meses", monto: numero((t.descuento || {}).meses), texto: null },
  ];
  for (const [k, monto] of Object.entries(t.modulos || {})) {
    filas.push({ clave: `modulo:${k}`, monto: numero(monto), texto: null });
  }
  for (const [k, monto] of Object.entries(t.planes || {})) {
    filas.push({ clave: `plan:${k}`, monto: numero(monto), texto: null });
  }
  for (const [clave, campo] of Object.entries(SUELTAS)) {
    filas.push({ clave, monto: numero(t[campo]), texto: null });
  }
  const medida = t.medida || {};
  filas.push({ clave: "medida:base", monto: numero(medida.base), texto: null });
  for (const [k, monto] of Object.entries(medida.modulos || {})) {
    filas.push({ clave: `medida:${k}`, monto: numero(monto), texto: null });
  }
  const ahora = new Date().toISOString();
  return filas.map((f) => ({ ...f, actualizado_en: ahora }));
}

/* Las tarifas con la lista a medida en lugar de la de los planes, para
   pasárselas a presupuestar(). El descuento y la puesta en marcha son los
   mismos. */
export function tarifasAMedida(t) {
  const m = (t && t.medida) || {};
  return { ...(t || TARIFAS_VACIAS), base: m.base ?? null, modulos: m.modulos || {} };
}

/* Se ofrece "a medida" solo si la plataforma cargó su base. */
export const hayAMedida = (t) => !!(t && t.medida && t.medida.base != null);

/* Con sesión: lo que edita la plataforma. */
export async function cargarTarifas() {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.from("tarifas").select("clave, monto, texto");
  if (error) throw error;
  return armarTarifas(data);
}

export async function guardarTarifas(tarifas) {
  const { supabase } = await import("./supabase.js");
  const { error } = await supabase.from("tarifas").upsert(filasDeTarifas(tarifas), { onConflict: "clave" });
  if (error) throw error;
  return tarifas;
}

/* Sin sesión, para el alta guiada. El cliente de Supabase se importa
   recién acá por lo mismo que en landing.js: sin variables de entorno la
   página pública no puede morirse. */
export async function cargarTarifasPublicas() {
  const { supabase } = await import("./supabase.js");
  const { data, error } = await supabase.rpc("tarifas_publicas");
  if (error) throw error;
  return armarTarifas(data);
}
