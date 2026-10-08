/* ============================================================
   INSTALAR EL SISTEMA EN LA COMPUTADORA (08/10)
   ============================================================

   Vendi y Ventario se instalan como aplicación: un ícono en el escritorio
   y en la barra de tareas, ventana propia, sin pestañas ni barra de
   direcciones. Para una caja es lo que corresponde: se abre con un clic y
   no se cierra por error con el resto del navegador.

   El navegador decide si se puede: avisa con `beforeinstallprompt`, que
   `index.html` guarda apenas llega. Si no avisó (Firefox, Safari, o ya
   está instalado), el botón no aparece: no se promete lo que no se puede.
   ============================================================ */

import { useEffect, useState } from "react";

/* Abierto como aplicación instalada: no hay nada que ofrecer. */
export const yaInstalado = () =>
  typeof window !== "undefined" && (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true);

export function useInstalar() {
  const [aviso, setAviso] = useState(() => (typeof window !== "undefined" ? window.__avisoInstalar || null : null));

  useEffect(() => {
    const llego = () => setAviso(window.__avisoInstalar || null);
    const instalado = () => { window.__avisoInstalar = null; setAviso(null); };
    window.addEventListener("genez:instalable", llego);
    window.addEventListener("appinstalled", instalado);
    return () => {
      window.removeEventListener("genez:instalable", llego);
      window.removeEventListener("appinstalled", instalado);
    };
  }, []);

  const instalar = async () => {
    if (!aviso) return false;
    aviso.prompt();
    const { outcome } = await aviso.userChoice;
    /* El aviso se usa una sola vez, acepte o no: el navegador vuelve a
       mandar otro más adelante si corresponde. */
    window.__avisoInstalar = null;
    setAviso(null);
    return outcome === "accepted";
  };

  return { puede: !!aviso && !yaInstalado(), instalar };
}
