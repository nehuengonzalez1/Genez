/* ============================================================
   EL PROGRAMA DE IMPRESIÓN DE LA CAJA
   ============================================================

   Un navegador no puede imprimir sin abrir su ventana: es una regla de
   seguridad, y sin ella cualquier página llenaría de papel la impresora
   de cualquiera. Por eso la impresión directa necesita algo instalado en
   la computadora de la caja: public/impresora/genez-impresora.ps1, que
   escucha en 127.0.0.1:9197 y le pasa a la impresora lo que le mandamos.

   La impresora elegida se guarda en este navegador (localStorage) y no en
   la configuración del comercio: el nombre de una impresora es de una
   computadora. En la caja 1 se llama "POS-58" y en la oficina no existe.
   ============================================================ */

const AGENTE = "http://127.0.0.1:9197";
const CLAVE = "genez.impresora.directa";

export function impresoraElegida() {
  try { return localStorage.getItem(CLAVE) || null; } catch { return null; }
}

export function elegirImpresora(nombre) {
  try {
    if (nombre) localStorage.setItem(CLAVE, nombre);
    else localStorage.removeItem(CLAVE);
  } catch { /* sin almacenamiento, se imprime con la ventana */ }
}

async function pedir(ruta, opciones = {}, ms = 4000) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ms);
  try {
    const r = await fetch(AGENTE + ruta, {
      ...opciones,
      signal: corte.signal,
      /* El encabezado propio obliga al navegador a preguntarle antes al
         programa si esta página le puede hablar. Es lo que evita que otra
         página abierta en la misma computadora mande a imprimir. */
      headers: { "x-genez": "1", ...(opciones.body ? { "content-type": "application/json" } : {}) },
    });
    const cuerpo = await r.json().catch(() => null);
    if (!r.ok) throw new Error((cuerpo && cuerpo.error) || `El programa de impresión contestó ${r.status}.`);
    return cuerpo;
  } finally {
    clearTimeout(reloj);
  }
}

/** { version, impresoras, predeterminada }, o null si no está instalado o no anda. */
export async function estadoAgente() {
  try { return await pedir("/estado", {}, 1500); } catch { return null; }
}

export async function imprimirDirecto(impresora, bytes) {
  let binario = "";
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  await pedir("/imprimir", { method: "POST", body: JSON.stringify({ impresora, datos: btoa(binario) }) }, 15000);
}
