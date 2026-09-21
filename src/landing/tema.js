/* ============================================================
   EL TEMA DE LA LANDING · claro u oscuro, y se puede fijar
   ============================================================

   La landing existe en las dos versiones (es la misma maqueta en los dos
   temas), así que arranca con lo que diga el teléfono y deja fijarlo con
   el botón de la cabecera; la elección se guarda en el navegador.
   `tema-calido` es el claro crema y `tema-noche` el oscuro cálido de la
   app del cliente: los mismos que ya conoce un comercio (cliente/tema.js).
   ============================================================ */

import { aplicarTema, alCambiarElTema } from "../cliente/tema.js";

const CLAVE = "genez.landing.tema";

export function temaGuardado() {
  try { return window.localStorage.getItem(CLAVE) || "auto"; } catch { return "auto"; }
}

export function fijarTema(tema) {
  try { window.localStorage.setItem(CLAVE, tema); } catch { /* sin almacenamiento: dura la sesión */ }
  aplicarTema({ tema });
}

export function estaOscuro() {
  return typeof document !== "undefined" && document.documentElement.classList.contains("tema-noche");
}

export function iniciarTema() {
  aplicarTema({ tema: temaGuardado() });
  alCambiarElTema({ tema: "auto" }, () => { if (temaGuardado() === "auto") aplicarTema({ tema: "auto" }); });
}
