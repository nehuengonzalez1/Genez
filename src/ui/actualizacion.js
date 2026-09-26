/* ============================================================
   ACTUALIZARSE SOLO
   ============================================================

   Cada despliegue deja publicado `/version.json` con un número de versión
   que es el mismo que viaja dentro del bundle (`__GENEZ_VERSION__`, ver
   vite.config.js). La página pregunta cada cinco minutos, y cada vez que
   se vuelve a la pestaña, si el de afuera cambió.

   El problema que resuelve: la gestión no guarda nada en caché —el
   servidor le dice al navegador que revalide el HTML cada vez—, así que
   un F5 común ya trae lo nuevo. Pero en un local la pestaña queda abierta
   días enteros, y una página que nunca se recarga nunca se entera. Y a
   veces el código viejo contra la base nueva no anda: el 26/09 el cierre
   de caja cambió de forma, y una pestaña vieja ya no podía cerrar.

   CUÁNDO SE RECARGA SOLA
   ----------------------
   Nunca en medio de algo. Recargar pierde lo que está en pantalla: un
   carrito a medio cargar, un cuadro con datos escritos. Se recarga cuando
   las tres cosas son ciertas a la vez:
     - nadie tocó nada (teclado, mouse, lector, pantalla) hace dos minutos;
     - nadie se marcó ocupado (`useOcupado`: el cobro con productos);
     - no hay nada abierto encima: ningún cuadro, panel o velo
       (`.fixed.inset-0`, que es como están hechos todos), y ningún campo
       con texto a medio escribir.
   Lo segundo es explícito y lo tercero es genérico a propósito: una
   pantalla nueva con un cuadro no tiene que acordarse de avisar.

   Con la pestaña en segundo plano alcanza con no estar ocupado: no hay
   nadie mirando.

   Lo que no se pierde nunca es una venta cobrada: la cola la escribe en
   el equipo antes de mandarla (src/datos/cola.js), y la manda al volver.
   ============================================================ */

import { useEffect, useState, useCallback } from "react";

/* eslint-disable no-undef */
export const VERSION = typeof __GENEZ_VERSION__ !== "undefined" ? __GENEZ_VERSION__ : "dev";

const CADA_MS = 5 * 60 * 1000;
const QUIETO_MS = 2 * 60 * 1000;

const ocupados = new Set();

/* Mientras `activo` sea cierto, la página no se recarga sola. */
export function useOcupado(activo) {
  useEffect(() => {
    if (!activo) return undefined;
    const clave = {};
    ocupados.add(clave);
    return () => { ocupados.delete(clave); };
  }, [activo]);
}

let ultimoToque = Date.now();
if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "keydown", "touchstart", "wheel"]) {
    window.addEventListener(ev, () => { ultimoToque = Date.now(); }, { capture: true, passive: true });
  }
}

function hayAlgoAbierto() {
  if (document.querySelector(".fixed.inset-0")) return true;
  const a = document.activeElement;
  return !!(a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA") && a.value);
}

export function sePuedeRecargar() {
  if (ocupados.size > 0) return false;
  if (document.hidden) return true;
  return Date.now() - ultimoToque >= QUIETO_MS && !hayAlgoAbierto();
}

export const estaOcupado = () => ocupados.size > 0;

async function versionPublicada() {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.version ? String(d.version) : null;
  } catch {
    return null;   // sin conexión: se vuelve a preguntar en la próxima vuelta
  }
}

/* { nueva, actualizar }. En desarrollo no hace nada: Vite ya recarga. */
export function useVersionNueva() {
  const [nueva, setNueva] = useState(false);

  useEffect(() => {
    if (VERSION === "dev") return undefined;
    let vivo = true;
    const mirar = async () => {
      const v = await versionPublicada();
      if (vivo && v && v !== VERSION) setNueva(true);
    };
    mirar();
    const id = setInterval(mirar, CADA_MS);
    const alVolver = () => { if (document.visibilityState === "visible") mirar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, []);

  /* Con versión nueva, se mira cada quince segundos si ya se puede. */
  useEffect(() => {
    if (!nueva) return undefined;
    const probar = () => { if (sePuedeRecargar()) window.location.reload(); };
    const id = setInterval(probar, 15000);
    document.addEventListener("visibilitychange", probar);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", probar); };
  }, [nueva]);

  const actualizar = useCallback(() => window.location.reload(), []);
  return { nueva, actualizar };
}
