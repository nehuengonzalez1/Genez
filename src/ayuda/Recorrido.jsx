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
  /* Para qué lado se iba: una alternativa que no está se saltea en la
     misma dirección, así "Atrás" no rebota contra ella. */
  const haciaAtras = useRef(false);
  const siguiente = () => {
    if (yaAvanzo.current === i) return;
    yaAvanzo.current = i;
    haciaAtras.current = false;
    if (ultimo) onSalir(true); else setI((x) => x + 1);
  };
  const atras = () => { yaAvanzo.current = -1; haciaAtras.current = true; setI((x) => Math.max(0, x - 1)); };

  /* Ir a la pantalla del paso, una vez al entrar al paso. */
  /* Volviendo con "Atrás" a un paso de otra sección, se vuelve también a
     su pantalla: la del paso más cercano que dice a dónde ir. */
  useEffect(() => {
    if (!paso) return;
    const d = paso.donde || (haciaAtras.current ? (r.pasos.slice(0, i).reverse().find((p) => p.donde) || {}).donde : null);
    if (d) navegar(d);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

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
        /* Ningún paso se saltea sin mostrarse (Nehuen, 07/10: "se saltan
           solos, no muestran nada"). El cartel ya está en pantalla, al
           medio. Solo las alternativas se saltean, y rápido: el menú de la
           computadora o el del celular, la caja cerrada o abierta. Lo
           opcional que no está queda explicado al medio, sin aviso; lo
           demás avisa que no se encuentra. */
        if (paso.alternativa && pasaron > 700) {
          if (haciaAtras.current && i > 0) { yaAvanzo.current = -1; setI((x) => Math.max(0, x - 1)); } else siguiente();
          return;
        }
        if (!paso.opcional && !paso.alternativa && pasaron > 3000) setPerdido(true);
      }
    };
    tic();
    const h = setInterval(tic, 200);
    return () => clearInterval(h);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  /* El teclado (Nehuen, 07/10: "que el Enter sea como apretar Seguir, así
     no tengo que andar siguiendo el cartel"): Enter o → sigue, ← vuelve,
     Esc sale. En la fase de captura de la ventana, antes que nadie, y sin
     dejarlo pasar: abajo está la caja, y un Enter que llegara al cobro
     agregaría un producto o cobraría. */
  const accionesRef = useRef({});
  useEffect(() => {
    const h = (e) => {
      const a = accionesRef.current;
      const tecla = e.key;
      if (!["Enter", "ArrowRight", "ArrowLeft", "Escape"].includes(tecla)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      if (tecla === "Enter" || tecla === "ArrowRight") a.seguir && a.seguir();
      else if (tecla === "ArrowLeft") a.atras && a.atras();
      else onSalir(false);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* El alto del cartel, medido: para ubicarlo sin tapar lo resaltado. */
  const cartelRef = useRef(null);
  const [altoCartel, setAltoCartel] = useState(180);
  useLayoutEffect(() => {
    const h = cartelRef.current ? cartelRef.current.offsetHeight : 0;
    if (h && Math.abs(h - altoCartel) > 2) setAltoCartel(h);
  });

  /* Avanzar con el clic en lo resaltado. En captura y sin frenarlo: el
     clic tiene que hacer lo suyo (abrir el modal, cobrar). */
  useEffect(() => {
    if (!paso || paso.avanza !== "clic") return undefined;
    const h = (e) => { const el = elRef.current; if (el && el.contains(e.target)) setTimeout(siguiente, 350); };
    document.addEventListener("click", h, true);
    return () => document.removeEventListener("click", h, true);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r || !paso) return null;

  /* El recorrido general cuenta secciones, no pasos: "Stock · 4 de 10".
     Así una alternativa salteada no hace saltar el número. */
  const secciones = [...new Set(r.pasos.map((p) => p.sec).filter(Boolean))];
  const cabecera = paso.sec ? `${paso.sec} · ${secciones.indexOf(paso.sec) + 1} de ${secciones.length}`
    : secciones.length ? r.titulo : `${r.titulo} · ${i + 1} de ${r.pasos.length}`;
  /* Mientras busca, una alternativa no muestra su cartel: si no está, se
     saltea, y verlo un instante y que desaparezca confunde. */
  const esperandoAlternativa = paso.alternativa && !caja;

  const vw = window.innerWidth, vh = window.innerHeight;
  const hueco = caja && { x: Math.max(0, caja.x - MARGEN), y: Math.max(0, caja.y - MARGEN), w: caja.w + MARGEN * 2, h: caja.h + MARGEN * 2 };
  /* Todo se hace con "Seguir" (07/10): lo de afuera del hueco no se toca. */
  const mascara = "fixed z-[200] bg-black/60 transition-all duration-200 ease-out";
  /* "Seguir" en un paso que abre algo (una pestaña, el formulario) lo
     abre por la persona: el clic llega al botón y el escuchador avanza. */
  const seguir = () => {
    /* Avanza acá mismo y no esperando al escuchador del clic: abrir una
       pestaña que ya estaba abierta no cambia nada, y el recorrido se
       quedaba esperando. */
    if (paso.avanza === "clic" && elRef.current && !perdido) elRef.current.click();
    siguiente();
  };
  accionesRef.current = { seguir, atras: () => { if (i > 0) atras(); } };
  /* Dónde va el cartel, sin tapar lo resaltado: abajo, arriba, a la
     derecha o a la izquierda, lo primero que entre entero. Si no entra en
     ningún lado (lo resaltado ocupa casi toda la pantalla), abajo de todo.
     Sin nada resaltado, al medio. */
  const ancho = Math.min(360, vw - 24);
  const H = altoCartel, M = 12;
  const entre = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  const pos = (() => {
    if (!hueco) return { left: (vw - ancho) / 2, top: Math.max(24, vh / 2 - H / 2) };
    const x = entre(hueco.x, M, vw - ancho - M);
    if (hueco.y + hueco.h + M + H <= vh - M) return { left: x, top: hueco.y + hueco.h + M };
    if (hueco.y - M - H >= M) return { left: x, top: hueco.y - M - H };
    const y = entre(hueco.y, M, vh - H - M);
    if (hueco.x + hueco.w + M + ancho <= vw - M) return { left: hueco.x + hueco.w + M, top: y };
    if (hueco.x - M - ancho >= M) return { left: hueco.x - M - ancho, top: y };
    return { left: (vw - ancho) / 2, top: vh - H - M };
  })();
  const suave = "transition-all duration-200 ease-out";
  const nSeccion = paso.sec ? secciones.indexOf(paso.sec) + 1 : 0;

  return (
    <div data-recorrido>
      {hueco ? (
        <>
          <div className={mascara} style={{ left: 0, top: 0, width: vw, height: hueco.y }} />
          <div className={mascara} style={{ left: 0, top: hueco.y + hueco.h, width: vw, height: Math.max(0, vh - hueco.y - hueco.h) }} />
          <div className={mascara} style={{ left: 0, top: hueco.y, width: hueco.x, height: hueco.h }} />
          <div className={mascara} style={{ left: hueco.x + hueco.w, top: hueco.y, width: Math.max(0, vw - hueco.x - hueco.w), height: hueco.h }} />
          <div className="fixed z-[200] rounded-lg ring-2 ring-acento pointer-events-none transition-all duration-200 ease-out" style={{ left: hueco.x, top: hueco.y, width: hueco.w, height: hueco.h }} />
        </>
      ) : (
        <div className={`${mascara} inset-0`} />
      )}

      <div ref={cartelRef} className={`fixed z-[201] bg-superficie border border-borde rounded-xl shadow-lg p-4 ${suave} ${esperandoAlternativa ? "invisible" : ""}`} style={{ ...pos, width: ancho }}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">{cabecera}</span>
          <button type="button" onClick={() => onSalir(false)} className="text-texto-tenue hover:text-texto -mt-0.5" aria-label="Salir del recorrido"><X size={16} /></button>
        </div>
        {secciones.length > 0 && (
          <div className="mt-2 h-1 bg-superficie-2 rounded-full overflow-hidden">
            <div className={`h-full bg-acento rounded-full ${suave}`} style={{ width: `${(ultimo ? 1 : nSeccion / (secciones.length + 1)) * 100}%` }} />
          </div>
        )}
        <div className="f-d text-base mt-1">{paso.t}</div>
        {paso.d && <p className="text-sm text-texto-suave mt-1">{paso.d}</p>}
        {perdido && (
          <p className="text-xs text-ojo mt-2">
            No encuentro esto en tu pantalla: puede que tu usuario no lo vea, o que esté en otro lado. Seguí con el próximo paso o salí.
          </p>
        )}
        <div className="flex items-center justify-between gap-2 mt-3">
          <button type="button" onClick={atras} disabled={i === 0}
            className="text-xs text-texto-tenue hover:text-texto disabled:opacity-30">Atrás</button>
          <span className="hidden md:inline text-[11px] text-texto-tenue ml-auto">← → para moverte · Esc para salir</span>
          <Boton size="sm" onClick={seguir}>{ultimo ? "Terminar" : "Seguir"} <span className="text-[10px] opacity-70">↵</span></Boton>
        </div>
      </div>
    </div>
  );
}
