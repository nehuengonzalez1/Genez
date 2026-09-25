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

/* Una venta que el servidor rechaza no se tira. Se aparta de la cola para
   que no trabe a las que vienen atrás, pero queda guardada: alguien cobró
   esa plata en el mostrador y tiene que poder recuperarse el dato aunque
   el sistema no haya sabido qué hacer con él. */
const CLAVE_TRABADAS = "genez.ventas.trabadas";

/* Un localStorage corrupto o lleno no puede tumbar la caja. Si no se
   puede leer, se arranca vacío y se sigue vendiendo. */
function leer(clave = CLAVE) {
  try {
    const crudo = localStorage.getItem(clave);
    const lista = crudo ? JSON.parse(crudo) : [];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

function escribir(lista, clave = CLAVE) {
  try {
    localStorage.setItem(clave, JSON.stringify(lista));
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

export function trabadas() {
  return leer(CLAVE_TRABADAS);
}

export function cuantasTrabadas() {
  return leer(CLAVE_TRABADAS).length;
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

/* ------------------------------------------------------------
   Reenviar a mano
   ------------------------------------------------------------
   Todo lo que este equipo cobró y la base no tiene: lo que espera
   internet y lo que la base rechazó. Se muestra en Caja: cada una es
   plata que está en el cajón y que el arqueo no ve. */
export function sinGuardar() {
  return [
    ...leer(CLAVE_TRABADAS).map((x) => ({ venta: x.venta, motivo: x.motivo, rechazada: true, cuando: x.cuando })),
    ...leer().map((v) => ({ venta: v, motivo: null, rechazada: false, cuando: null })),
  ].sort((a, b) => String(a.venta.fecha).localeCompare(String(b.venta.fecha)));
}

/* Sacar de la lista una que no se va a guardar nunca —se fió a un
   cliente que ya no existe y se cobró de nuevo a mano—. No se borra: se
   archiva aparte, con cuándo, por si alguien la tiene que buscar. */
const CLAVE_DESCARTADAS = "genez.ventas.descartadas";
export function descartar(id) {
  const x = leer(CLAVE_TRABADAS).find((t) => t.venta.id === id) || (leer().find((v) => v.id === id) && { venta: leer().find((v) => v.id === id) });
  if (!x) return;
  const archivo = leer(CLAVE_DESCARTADAS);
  archivo.push({ ...x, descartada: new Date().toISOString() });
  escribir(archivo, CLAVE_DESCARTADAS);
  escribir(leer(CLAVE_TRABADAS).filter((t) => t.venta.id !== id), CLAVE_TRABADAS);
  quitar(id);
}

/* Manda una venta que quedó en el equipo, tal cual o reparada (ver
   `repararVenta` en ventas.js). Si entra, sale de las dos listas; si la
   base la vuelve a rechazar, queda apartada con el motivo nuevo. La
   función de la base es idempotente: si en realidad ya había entrado, no
   se duplica. */
export async function reenviar(venta) {
  try {
    await registrarVenta(venta);
  } catch (e) {
    const motivo = e.message || "La base rechazó la venta.";
    if (!esDeRed(e)) {
      const lista = leer(CLAVE_TRABADAS);
      const i = lista.findIndex((x) => x.venta.id === venta.id);
      if (i >= 0) lista[i] = { ...lista[i], venta, motivo, cuando: new Date().toISOString() };
      else lista.push({ venta, motivo, cuando: new Date().toISOString() });
      escribir(lista, CLAVE_TRABADAS);
      quitar(venta.id);
    }
    throw new Error(esDeRed(e) ? "No hay conexión con el servidor. Probá de nuevo en un rato." : motivo);
  }
  escribir(leer(CLAVE_TRABADAS).filter((x) => x.venta.id !== venta.id), CLAVE_TRABADAS);
  quitar(venta.id);
}

/* Sale de la cola pero no del equipo: se archiva con el motivo para poder
   revisarla o reintentarla a mano una vez corregido el problema. */
function trabar(venta, motivo) {
  const lista = leer(CLAVE_TRABADAS);
  if (!lista.some((x) => x.venta.id === venta.id)) {
    lista.push({ venta, motivo, cuando: new Date().toISOString() });
    escribir(lista, CLAVE_TRABADAS);
  }
  quitar(venta.id);
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
      const motivo = e.message || "La base rechazó la venta.";
      trabar(venta, motivo);
      rechazadas.push({ venta, motivo });
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
