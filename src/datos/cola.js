/* ============================================================
   COLA DE VENTAS PENDIENTES
   ============================================================

   Si se cae internet, el minimercado no puede dejar de vender. La venta
   se guarda en el navegador antes de intentar mandarla, y se reintenta
   sola hasta que entra.

   Se guarda en localStorage y no en memoria a propósito: el caso que
   importa no es "falló la request", es "se cortó la luz", "se cerró el
   navegador" o "se reinició la máquina". Una cola en memoria se pierde
   justo cuando hace falta.

   Escribir es sincrónico. Eso acá es una ventaja: cuando `encolar`
   termina, la venta ya está en disco. No hay una ventana en la que el
   ticket salió impreso y la venta todavía no existe en ningún lado.

   La función de la base es idempotente, así que reintentar de más es
   inofensivo. El riesgo real es al revés: reintentar de menos.
   ============================================================ */

import { registrarVenta } from "./ventas.js";

const CLAVE = "genez.ventas.pendientes";

/* Un localStorage corrupto o lleno no puede tumbar la caja. Si no se
   puede leer, se arranca vacío y se sigue vendiendo. */
function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function escribir(lista) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lista));
    return true;
  } catch {
    /* Cuota llena o modo privado: no hay dónde guardar. Quien llama
       decide si avisa; lo que no se puede es fingir que se guardó. */
    return false;
  }
}

export function pendientes() {
  return leer();
}

export function cuantasPendientes() {
  return leer().length;
}

export function encolar(venta) {
  const lista = leer();
  if (lista.some((v) => v.id === venta.id)) return true;
  lista.push(venta);
  return escribir(lista);
}

export function quitar(id) {
  escribir(leer().filter((v) => v.id !== id));
}

/* Recorre la cola en orden y para al primer fallo de red. Seguir
   intentando con la conexión caída solo suma esperas: si la primera no
   entró, las que siguen tampoco van a entrar.

   Un rechazo del servidor es distinto de una caída: si la base contesta
   que la venta está mal formada, reintentarla eternamente la deja
   trabada adelante de todas las demás. Esa se aparta.

   Devuelve { enviadas, quedan, rechazadas }.                          */
export async function sincronizar() {
  const lista = leer();
  if (!lista.length) return { enviadas: 0, quedan: 0, rechazadas: [] };

  let enviadas = 0;
  const rechazadas = [];

  for (const venta of lista) {
    try {
      await registrarVenta(venta);
      quitar(venta.id);
      enviadas++;
    } catch (e) {
      if (esDeRed(e)) break;
      quitar(venta.id);
      rechazadas.push({ venta, motivo: e.message || "La base rechazó la venta." });
    }
  }

  return { enviadas, quedan: cuantasPendientes(), rechazadas };
}

/* Distinguir "no llegó" de "llegó y lo rechazaron" decide si la venta se
   conserva o se descarta, así que ante la duda se conserva: una cola que
   reintenta de más molesta, una que descarta de más pierde plata.

   Solo se da por rechazada cuando el servidor efectivamente contestó, y
   eso se reconoce porque el error trae código o estado. Un fallo de red
   no trae ninguno de los dos: la request nunca salió. */
function esDeRed(e) {
  if (!navigator.onLine) return true;
  return !(e && (e.code || e.status));
}

/* Reintenta cuando conviene: al abrir, cuando el navegador avisa que
   volvió la conexión, y cada tanto por si el aviso no llega (pasa con
   wifi que sigue conectado pero sin salida a internet).

   Devuelve la función para desregistrar todo.                          */
export function vigilarCola(alCambiar, cadaMs = 30000) {
  let corriendo = false;

  const intentar = async () => {
    if (corriendo || !cuantasPendientes()) return;
    corriendo = true;
    try {
      const r = await sincronizar();
      if (r.enviadas || r.rechazadas.length) alCambiar(r);
    } finally {
      corriendo = false;
    }
  };

  window.addEventListener("online", intentar);
  const reloj = setInterval(intentar, cadaMs);
  intentar();

  return () => {
    window.removeEventListener("online", intentar);
    clearInterval(reloj);
  };
}
