/* ============================================================
   GENEZ FOUNDER · lo que comparten las pantallas
   ============================================================ */

import { useEffect, useState, useCallback } from "react";
import { cargarListas, cargarEtapas } from "../datos/interno.js";

export const ZONA = "America/Argentina/Buenos_Aires";

const f = (d, op) => (d ? new Date(d).toLocaleString("es-AR", { timeZone: ZONA, ...op }) : "");
export const fechaCorta = (d) => f(d, { day: "2-digit", month: "2-digit" });
export const fecha = (d) => f(d, { day: "2-digit", month: "2-digit", year: "2-digit" });
export const hora = (d) => f(d, { hour: "2-digit", minute: "2-digit", hour12: false });
export const fechaHora = (d) => (d ? `${fecha(d)} ${hora(d)}` : "");
export const diaLargo = (d) => f(d, { weekday: "long", day: "numeric", month: "long" });

/* El día (aaaa-mm-dd) en la Argentina, para comparar "hoy" sin que la
   zona del navegador lo corra. */
export const diaAR = (d) => {
  if (!d) return "";
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
  return p;
};
export const hoyAR = () => diaAR(new Date());
const diasEntre = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);

/* "hoy", "ayer", "en 3 días", "hace 5 días". */
export function relativo(d) {
  if (!d) return "";
  const n = diasEntre(diaAR(d), hoyAR());
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return n > 0 ? `en ${n} días` : `hace ${-n} días`;
}
/* Vencido es de un día anterior a hoy: lo de hoy todavía está a tiempo. */
export const vencido = (d) => !!d && diaAR(d) < hoyAR();

/* Para <input type="datetime-local">: la hora argentina, sin zona. */
export function aInput(d) {
  if (!d) return "";
  const x = new Date(d);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(x).map((q) => [q.type, q.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
/* Y de vuelta: lo escrito se entiende en hora argentina (UTC-3, sin
   horario de verano desde 2009). */
export const deInput = (s) => (s ? new Date(`${s}:00-03:00`) : null);

/* Las listas y las etapas, una sola vez por pantalla. */
export function useConfig() {
  const [cfg, setCfg] = useState(null);
  const leer = useCallback(() => Promise.all([cargarListas(), cargarEtapas()])
    .then(([listas, etapas]) => setCfg({ listas, etapas: etapas.filter((e) => e.activa) }))
    .catch(() => setCfg({ listas: [], etapas: [] })), []);
  useEffect(() => { leer(); }, [leer]);
  const de = (tipo) => (cfg ? cfg.listas.filter((l) => l.tipo === tipo && l.activo) : []);
  const nombre = (tipo, clave) => { const i = cfg && cfg.listas.find((l) => l.tipo === tipo && l.clave === clave); return i ? i.nombre : clave || ""; };
  return { cfg, de, nombre, releer: leer };
}

export const INTERES = { frio: "Frío", tibio: "Tibio", caliente: "Caliente" };
export const PRIORIDAD = { baja: "Baja", normal: "Normal", alta: "Alta", urgente: "Urgente" };
export const ESTADO_TAREA = { pendiente: "Pendiente", en_curso: "En curso", en_espera: "En espera", completada: "Completada", cancelada: "Cancelada" };

export const soloDigitos = (s) => String(s || "").replace(/\D/g, "");
/* Un link de WhatsApp desde un teléfono argentino: 54 9 + área + número. */
export function linkWA(tel) {
  let d = soloDigitos(tel);
  if (!d) return null;
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15/, "$1");
  return d.length >= 10 ? `https://wa.me/549${d}` : null;
}
