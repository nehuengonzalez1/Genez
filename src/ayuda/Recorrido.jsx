/* ============================================================
   EL MOTOR DE LOS RECORRIDOS GUIADOS (07/10)
   ============================================================

   Oscurece la pantalla menos el elemento del paso, pone al lado un
   cartel con qué hacer, y avanza cuando se toca (o con "Seguir"). Los
   pasos están en recorridos.js.

   Por qué así:
   - La máscara son cuatro rectángulos alrededor del hueco, no uno con un
     agujero: el hueco no tiene nada encima, así que el clic llega al
     botón de verdad (aunque esté adentro de un modal). Lo de afuera no se
     puede tocar: un clic suelto en otro lado dejaba el recorrido perdido.
   - Se avanza con "Seguir" (Nehuen, 07/10: "que diga seguir, no que te
     haga cargar cosas"). Si el paso abre algo, "Seguir" lo abre; nunca
     se completa ni se guarda nada por la persona.
   - El elemento se busca por lo que se ve (texto, placeholder, rótulo),
     una y otra vez mientras dura el paso: las pantallas cargan de a
     poco, los modales aparecen después del clic, y el hueco sigue al
     botón si la página se mueve.
   - Si un paso no encuentra su elemento, no se traba: si es opcional se
     saltea, y si no, a los pocos segundos el cartel lo dice y deja
     seguir o salir. Una pantalla que cambió no rompe el recorrido.
   - Lo que se hace durante el recorrido es de verdad (la venta queda
     guardada): no es una simulación, y el último paso lo dice.
   ============================================================ */

import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Boton } from "../ui/Base.jsx";
import { recorridoPorId } from "./recorridos.js";

export const RecorridoCtx = createContext({ iniciar: () => {}, disponibles: [] });
export const useRecorridos = () => useContext(RecorridoCtx);

const normal = (s) => String(s || "").replace(/\s+/g, " ").trim();
const visible = (e) => {
  if (!e || !e.isConnected) return false;
  const r = e.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const st = window.getComputedStyle(e);
  return st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
};
const coincide = (patron, texto) => (patron instanceof RegExp ? patron.test(texto) : texto === patron);
/* El texto propio de un elemento, sin el de sus hijos: "Nombre" y no
   "Nombre Juan" para el rótulo de un campo. */
const textoPropio = (e) => normal([...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" "));

/* De todo lo que coincide, el último visible: un modal se dibuja después
   que la pantalla de atrás, así que gana lo que está arriba. */
export function buscar(spec) {
  if (!spec) return null;
  let candidatos = [];
  if (spec.css) {
    /* Para lo que no tiene texto propio: el menú, el botón de ayuda. */
    candidatos = [...document.querySelectorAll(spec.css)];
  } else if (spec.placeholder) {
    candidatos = [...document.querySelectorAll("input, textarea")].filter((i) => (i.placeholder || "").startsWith(spec.placeholder));
  } else if (spec.campo) {
    candidatos = [...document.querySelectorAll("label, span, div, p")]
      .filter((e) => textoPropio(e) === spec.campo)
      .map((e) => e.closest("label") || e.parentElement)
      .filter((c) => c && c.querySelector("input, select, textarea"));
  } else if (spec.texto) {
    const sel = spec.en === "*" ? "button, a, h1, h2, h3, h4, span, div, label, p" : "button, a, [role='tab']";
    candidatos = [...document.querySelectorAll(sel)].filter((e) => coincide(spec.texto, normal(e.innerText)));
    /* Con "cualquier elemento", el más chico: el texto de un botón está
       también en la tarjeta que lo contiene, y se resalta el botón. */
    if (spec.en === "*") candidatos = candidatos.filter((e) => ![...e.children].some((h) => coincide(spec.texto, normal(h.innerText))));
  }
  candidatos = candidatos.filter(visible).filter((e) => !e.closest("[data-recorrido]"));
  return candidatos[candidatos.length - 1] || null;
}

const MARGEN = 6;

/* `datos`: un recorrido armado en el momento (el general, que depende de
   las secciones del comercio). Si no, se busca por `id`. */
export function Recorrido({ id, datos, navegar, onSalir, titulo }) {
  const encontrado = datos || recorridoPorId(id);
  const r = encontrado && titulo ? { ...encontrado, titulo } : encontrado;
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState(null);       // el rectángulo del hueco
  const [perdido, setPerdido] = useState(false);
  const elRef = useRef(null);
  const paso = r && r.pasos[i];
  const ultimo = r && i === r.pasos.length - 1;
  /* Un paso avanza una sola vez: el clic y la espera pueden llegar juntos
     (tocar "Abrir caja" hace aparecer el buscador), y avanzar dos veces
     salteaba el paso del medio. */
  const yaAvanzo = useRef(-1);
  const siguiente = () => {
    if (yaAvanzo.current === i) return;
    yaAvanzo.current = i;
    if (ultimo) onSalir(true); else setI((x) => x + 1);
  };

  /* Ir a la pantalla del paso, una vez al entrar al paso. */
  useEffect(() => { if (paso && paso.donde) navegar(paso.donde); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Buscar el elemento sin parar mientras dura el paso. */
  useLayoutEffect(() => {
    if (!paso) return undefined;
    setPerdido(false); setCaja(null); elRef.current = null;
    if (!paso.en) return undefined;
    const arranque = Date.now();
    let ultimoScroll = 0;
    const tic = () => {
      if (paso.espera && paso.espera.some((s) => buscar(s))) { siguiente(); return; }
      const el = buscar(paso.en);
      elRef.current = el;
      if (el) {
        /* Traerlo a la vista si no está: el botón de guardar de un formulario
           largo queda abajo de todo. Instantáneo y no suave (el suave no
           terminaba antes de medir), y de nuevo si se vuelve a ir. */
        let b = el.getBoundingClientRect();
        if ((b.top < 0 || b.bottom > window.innerHeight) && Date.now() - ultimoScroll > 600) {
          el.scrollIntoView({ block: "center" }); ultimoScroll = Date.now(); b = el.getBoundingClientRect();
        }
        setCaja((c) => (c && c.x === b.left && c.y === b.top && c.w === b.width && c.h === b.height ? c : { x: b.left, y: b.top, w: b.width, h: b.height }));
        setPerdido(false);
      } else {
        setCaja(null);
        const pasaron = Date.now() - arranque;
        if (paso.opcional && pasaron > 1800) { siguiente(); return; }
        if (pasaron > 5000) setPerdido(true);
      }
    };
    tic();
    const h = setInterval(tic, 200);
    return () => clearInterval(h);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Avanzar con el clic en lo resaltado. En captura y sin frenarlo: el
     clic tiene que hacer lo suyo (abrir el modal, cobrar). */
  useEffect(() => {
    if (!paso || paso.avanza !== "clic") return undefined;
    const h = (e) => { const el = elRef.current; if (el && el.contains(e.target)) setTimeout(siguiente, 350); };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r || !paso) return null;

  const vw = window.innerWidth, vh = window.innerHeight;
  const hueco = caja && { x: Math.max(0, caja.x - MARGEN), y: Math.max(0, caja.y - MARGEN), w: caja.w + MARGEN * 2, h: caja.h + MARGEN * 2 };
  /* Todo se hace con "Seguir" (07/10): lo de afuera del hueco no se toca. */
  const mascara = "fixed z-[200] bg-black/60";
  /* "Seguir" en un paso que abre algo (una pestaña, el formulario) lo
     abre por la persona: el clic llega al botón y el escuchador avanza. */
  const seguir = () => { if (paso.avanza === "clic" && elRef.current && !perdido) elRef.current.click(); else siguiente(); };
  /* El cartel abajo del hueco si entra, si no arriba; sin hueco, al medio. */
  const ancho = Math.min(340, vw - 24);
  const pos = hueco
    ? (() => {
      const left = Math.min(Math.max(12, hueco.x), vw - ancho - 12);
      return hueco.y + hueco.h + 190 < vh ? { left, top: hueco.y + hueco.h + 10 } : { left, top: Math.max(12, hueco.y - 200) };
    })()
    : { left: (vw - ancho) / 2, top: Math.max(24, vh / 2 - 120) };

  return (
    <div data-recorrido>
      {hueco ? (
        <>
          <div className={mascara} style={{ left: 0, top: 0, width: vw, height: hueco.y }} />
          <div className={mascara} style={{ left: 0, top: hueco.y + hueco.h, width: vw, height: Math.max(0, vh - hueco.y - hueco.h) }} />
          <div className={mascara} style={{ left: 0, top: hueco.y, width: hueco.x, height: hueco.h }} />
          <div className={mascara} style={{ left: hueco.x + hueco.w, top: hueco.y, width: Math.max(0, vw - hueco.x - hueco.w), height: hueco.h }} />
          <div className="fixed z-[200] rounded-lg ring-2 ring-acento pointer-events-none" style={{ left: hueco.x, top: hueco.y, width: hueco.w, height: hueco.h }} />
        </>
      ) : (
        <div className={`${mascara} inset-0`} />
      )}

      <div className="fixed z-[201] bg-superficie border border-borde rounded-xl shadow-lg p-4" style={{ ...pos, width: ancho }}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">{paso.sec || r.titulo} · {i + 1} de {r.pasos.length}</span>
          <button type="button" onClick={() => onSalir(false)} className="text-texto-tenue hover:text-texto -mt-0.5" aria-label="Salir del recorrido"><X size={16} /></button>
        </div>
        <div className="f-d text-base mt-1">{paso.t}</div>
        {paso.d && <p className="text-sm text-texto-suave mt-1">{paso.d}</p>}
        {perdido && (
          <p className="text-xs text-ojo mt-2">
            No encuentro esto en tu pantalla: puede que tu usuario no lo vea, o que esté en otro lado. Seguí con el próximo paso o salí.
          </p>
        )}
        {paso.en && !perdido && !caja && <p className="text-xs text-texto-tenue mt-2">Buscando…</p>}
        <div className="flex items-center justify-between gap-2 mt-3">
          <button type="button" onClick={() => { yaAvanzo.current = -1; setI((x) => Math.max(0, x - 1)); }} disabled={i === 0}
            className="text-xs text-texto-tenue hover:text-texto disabled:opacity-30">Atrás</button>
          <Boton size="sm" onClick={seguir}>{ultimo ? "Terminar" : "Seguir"}</Boton>
        </div>
      </div>
    </div>
  );
}
