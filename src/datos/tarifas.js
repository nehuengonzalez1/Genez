/* ============================================================
   TARIFAS · cuánto cuesta cada cosa
   ============================================================

   La plataforma las edita desde su panel (con sesión, RLS decide) y el
   alta guiada las lee sin sesión por `tarifas_publicas()`. La tabla es
   una fila por concepto (0073); acá se traduce a un objeto con forma,
   que es lo que el resto de la aplicación quiere usar:

     { base, puestaEnMarcha, modulos: { [clave]: monto }, whatsapp }

   Un monto en null es "a confirmar". Sin filas, todo es null y el
   presupuesto lo dice; nunca se inventa un número.
   ============================================================ */

export const TARIFAS_VACIAS = Object.freeze({
  base: null,
  puestaEnMarcha: null,
  modulos: {},
  whatsapp: "",
});

const numero = (v) => (v == null || v === "" ? null : Number(v));

export function armarTarifas(filas) {
  const t = { ...TARIFAS_VACIAS, modulos: {} };
  for (const f of filas || []) {
    if (f.clave === "base") t.base = numero(f.monto);
    else if (f.clave === "puesta_en_marcha") t.puestaEnMarcha = numero(f.monto);
    else if (f.clave === "whatsapp") t.whatsapp = (f.texto || "").trim();
    else if (f.clave.startsWith("modulo:")) t.modulos[f.clave.slice("modulo:".length)] = numero(f.monto);
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
  ];
  for (const [k, monto] of Object.entries(t.modulos || {})) {
    filas.push({ clave: `modulo:${k}`, monto: numero(monto), texto: null });
  }
  const ahora = new Date().toISOString();
  return filas.map((f) => ({ ...f, actualizado_en: ahora }));
}

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
