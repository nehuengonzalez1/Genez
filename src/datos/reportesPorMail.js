/* ============================================================
   REPORTES POR MAIL (0136)
   ============================================================

   Las programaciones del comercio: qué frecuencia, a quién, y si suma un
   reporte guardado de "Mi reporte". Los manda el cron diario del
   servidor (api/_reportes.js); acá solo se eligen. Crear, cambiar y
   borrar pide el permiso de configurar: sin él, RLS no deja.

   Cuándo se mandó por última vez lo escribe el servidor: desde acá no se
   puede marcar como enviado algo que no salió.
   ============================================================ */

import { supabase } from "./supabase.js";
import { alServidor } from "./autoservicio.js";

export const FRECUENCIAS = [
  { k: "diario", n: "Todos los días", d: "Cada mañana, lo de ayer." },
  { k: "semanal", n: "Los lunes", d: "La semana de lunes a domingo." },
  { k: "mensual", n: "El 1 de cada mes", d: "El mes que terminó." },
];
export const nombreFrecuencia = (k) => (FRECUENCIAS.find((f) => f.k === k) || { n: k }).n;

const MAIL = /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/;
/* "a@x.com, b@y.com" o uno por renglón: se separa, se limpia y se valida
   igual que la base, para avisar antes de mandar. */
export function leerDirecciones(texto) {
  const lista = [...new Set(String(texto || "").split(/[,;\n]+/).map((x) => x.trim().toLowerCase()).filter(Boolean))];
  const malas = lista.filter((x) => !MAIL.test(x));
  if (!lista.length) return { error: "Poné al menos un mail." };
  if (malas.length) return { error: `No parece un mail: ${malas.join(", ")}.` };
  if (lista.length > 5) return { error: "Hasta cinco direcciones." };
  return { lista };
}

const aProgramado = (f) => ({
  id: f.id, frecuencia: f.frecuencia, para: f.para || [], reporteId: f.reporte_id || "", activo: !!f.activo,
  ultimoEnvio: f.ultimo_envio ? new Date(f.ultimo_envio) : null, ultimoError: f.ultimo_error || null,
});

export async function cargarProgramados(empresaId) {
  const { data, error } = await supabase.from("reportes_programados")
    .select("id, frecuencia, para, reporte_id, activo, ultimo_envio, ultimo_error").eq("empresa_id", empresaId).order("creado_en");
  if (error) throw error;
  return (data || []).map(aProgramado);
}

const traducir = (error, siFalla) => new Error(/row-level|permission/i.test(error.message || "")
  ? "Programar reportes necesita el permiso de configurar el comercio." : error.message || siFalla);

export async function crearProgramado(empresaId, { frecuencia, para, reporteId }) {
  const { error } = await supabase.from("reportes_programados").insert({ empresa_id: empresaId, frecuencia, para, reporte_id: reporteId || null, activo: true });
  if (error) throw traducir(error, "No se pudo programar.");
}

export async function cambiarProgramado(id, cambios) {
  const fila = {};
  if (cambios.frecuencia !== undefined) fila.frecuencia = cambios.frecuencia;
  if (cambios.para !== undefined) fila.para = cambios.para;
  if (cambios.reporteId !== undefined) fila.reporte_id = cambios.reporteId || null;
  if (cambios.activo !== undefined) fila.activo = !!cambios.activo;
  const { data, error } = await supabase.from("reportes_programados").update(fila).eq("id", id).select("id");
  if (error) throw traducir(error, "No se pudo guardar.");
  if (!data || !data.length) throw new Error("Programar reportes necesita el permiso de configurar el comercio.");
}

export async function borrarProgramado(id) {
  const { data, error } = await supabase.from("reportes_programados").delete().eq("id", id).select("id");
  if (error) throw traducir(error, "No se pudo borrar.");
  if (!data || !data.length) throw new Error("Programar reportes necesita el permiso de configurar el comercio.");
}

/* Uno ahora, solo a tu mail, con tus permisos: para ver cómo llega. */
export const mandarmeUno = ({ frecuencia, reporteId }) =>
  alServidor({ accion: "reportePrueba", frecuencia, reporteId: reporteId || null }, "No se pudo mandar el mail de prueba.");

/* El mail de quien entró: la primera dirección que se propone. */
export async function miMail() {
  const { data } = await supabase.auth.getUser();
  return (data && data.user && data.user.email) || "";
}
