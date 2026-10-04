/* ============================================================
   LA PANTALLA DE ENTRADA · el marco del login y de "contraseña nueva"
   ============================================================

   El fondo es el diseño de Nehuen (04/10) rearmado en vectores: el panel
   negro, la banda naranja en flecha con su profundidad y una luz naranja
   que la recorre de arriba abajo, y el blanco a la derecha, donde va la
   tarjeta. Encima, el texto del panel: "Tu negocio. Bajo control." y tres
   puntos, sacados de una referencia que pasó después.

   El fondo de esa referencia (la banda como neón y una G de marca de
   agua) se probó y se volvió atrás: Nehuen la había pasado solo por el
   texto y para cambiar el destello, no el fondo.

   Todo en vectores, sin una sola imagen: el fondo en SVG, los íconos en
   SVG y el texto como texto. Nítido en cualquier pantalla.

   - El fondo se estira a la pantalla (preserveAspectRatio="none") y los
     trazos no (vector-effect): la banda queda siempre en el mismo lugar
     proporcional y con el mismo grosor.
   - La tarjeta va centrada en la zona blanca y lleva `.tema-claro`:
     blanca aunque el sistema esté en oscuro, sin colores a mano.
   - En el celular el panel no entra: el texto va arriba y la tarjeta
     abajo, sobre el fondo del tema.

   La versión clara de la pantalla viene después. */

import React from "react";
import { BarChart3, Clock, TrendingUp } from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";

/* La geometría en una caja de 1600x900 (16:9), medida sobre la imagen de
   Nehuen: la banda arranca arriba al 59,8% del ancho, hace la punta en
   (47,8%, 42,5%) y termina abajo al 63,9%. */
const ARRIBA = "957,-20";
const PUNTA = "765,382";
const ABAJO = "1022,920";
const BANDA = `${ARRIBA} ${PUNTA} ${ABAJO}`;

/* Los colores también son los de la imagen: el negro va de #2a2a2c arriba
   a #020202 abajo a la izquierda, el blanco de #fcfbfc a #e3e5e6, y la
   banda es más rojiza en la punta. Son fijos a propósito: el fondo es el
   mismo en los dos temas, como el telón.

   El negro, mucho más oscuro que en la imagen: lo pidió Nehuen el 04/10.

   Tres planos con profundidad: el panel negro adelante (con su canto gris
   y su sombra sobre la banda), la banda en el medio (un solo trazo, con su
   degradé y un reflejo que la recorre) y el blanco atrás (con la sombra de la banda y el
   resplandor naranja).

   Cada capa es la misma línea con otro grosor, recortada al lado que le
   toca (clip-path con el polígono negro o el blanco). Los grosores son en
   píxeles de pantalla (vector-effect), así no se deforman. */
const B = "clamp(8px, 0.85vw, 23px)";             // la banda (la mitad de la anterior, 04/10)
const ancho = (...partes) => `calc(${partes.join(" + ")})`;

function Fondo() {
  /* Con "reducir movimiento" activado en el sistema, el reflejo queda
     quieto a la altura de la punta. */
  const quieto = typeof window !== "undefined" && window.matchMedia
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const t = (w, extra = {}) => ({ vectorEffect: "non-scaling-stroke", strokeWidth: w, ...extra });
  const linea = { points: BANDA, fill: "none", strokeLinejoin: "round", strokeLinecap: "butt" };
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"
      className="hidden lg:block absolute inset-0 w-full h-full">
      <defs>
        <linearGradient id="entrada-negro" x1="0.35" y1="0" x2="0.05" y2="1">
          <stop offset="0" stopColor="#151617" />
          <stop offset="0.45" stopColor="#09090a" />
          <stop offset="1" stopColor="#010101" />
        </linearGradient>
        <radialGradient id="entrada-luz" cx="0.36" cy="-0.05" r="0.6">
          <stop offset="0" stopColor="#2e3033" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3d3f42" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="entrada-vineta" cx="0.05" cy="1" r="0.7">
          <stop offset="0" stopColor="#000" stopOpacity="0.55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="entrada-blanco" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor="#fdfcfd" />
          <stop offset="0.5" stopColor="#f5f5f5" />
          <stop offset="1" stopColor="#e1e3e4" />
        </linearGradient>
        <linearGradient id="entrada-banda" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7f0c" />
          <stop offset="0.3" stopColor="#fa6807" />
          <stop offset="0.425" stopColor="#e23c02" />
          <stop offset="0.55" stopColor="#fd5d03" />
          <stop offset="0.76" stopColor="#ff7d05" />
          <stop offset="1" stopColor="#f94801" />
        </linearGradient>
        {/* El reflejo: una franja de luz que recorre la banda de arriba
            abajo y vuelve (Nehuen, 04/10). Es un degradé vertical que se
            desplaza; la banda y su halo lo usan como color. */}
        <linearGradient id="entrada-reflejo" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="240"
          gradientTransform={quieto ? "translate(0 330)" : undefined}>
          {/* Naranja intenso, como una luz (Nehuen, 04/10): antes era casi
              blanco y se leía como un brillo. */}
          <stop offset="0" stopColor="#ff6a00" stopOpacity="0" />
          <stop offset="0.35" stopColor="#ff7a0a" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#ffa733" stopOpacity="1" />
          <stop offset="0.65" stopColor="#ff7a0a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
          {!quieto && (
            <animateTransform attributeName="gradientTransform" type="translate"
              values="0 -260; 0 920; 0 -260" keyTimes="0; 0.5; 1" dur="7s" repeatCount="indefinite"
              calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />
          )}
        </linearGradient>
        <clipPath id="entrada-lado-negro"><polygon points={`-50,-50 ${BANDA} -50,950`} /></clipPath>
        <clipPath id="entrada-lado-blanco"><polygon points={`${ARRIBA} 1650,-50 1650,950 ${ABAJO} ${PUNTA}`} /></clipPath>
        <filter id="entrada-brillo" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="20" /></filter>
        <filter id="entrada-suave" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="1.2" /></filter>
        <filter id="entrada-difuso" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      {/* El panel negro, con su luz arriba y la viñeta abajo. */}
      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-negro)" />
      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-luz)" />
      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-vineta)" />
      <polygon points={`${ARRIBA} 1600,-20 1600,920 ${ABAJO} ${PUNTA}`} fill="url(#entrada-blanco)" />

      {/* Tres planos, de atrás para adelante: el blanco, la banda y el
          panel negro (Nehuen pidió la profundidad entre las tres, 04/10).
          La banda nace en el borde del panel y va toda del lado blanco: es
          un trazo del doble de ancho, centrado en el borde y recortado a ese
          lado. Así el panel queda adelante, apoyado sobre la banda. */}
      <g clipPath="url(#entrada-lado-blanco)">
        {/* Lo que la banda le hace al blanco: el resplandor naranja y, más
            pegada, su sombra. */}
        <polyline {...linea} stroke="#ff7a2a" strokeOpacity="0.16" style={t(ancho(`2 * ${B}`, "clamp(60px, 5.5vw, 150px)"))} filter="url(#entrada-brillo)" />
        <polyline {...linea} stroke="#000" strokeOpacity="0.2" style={t(ancho(`2 * ${B}`, "clamp(10px, 0.9vw, 24px)"))} filter="url(#entrada-difuso)" />
        <polyline {...linea} stroke="url(#entrada-banda)" style={t(`calc(2 * ${B})`)} />
        {/* La sombra del panel sobre la banda, del lado que la toca. */}
        <polyline {...linea} stroke="#000" strokeOpacity="0.45" style={t(`calc(0.6 * ${B})`)} filter="url(#entrada-suave)" />
      </g>

      {/* El canto del panel: gris, muy fino. Naranja se leía como una
          segunda línea. */}
      <g clipPath="url(#entrada-lado-negro)">
        <polyline {...linea} stroke="#4a4b4e" strokeOpacity="0.9" style={t("3px")} />
        <polyline {...linea} stroke="#000" strokeOpacity="0.5" style={t("clamp(14px, 1.2vw, 30px)")} filter="url(#entrada-difuso)" />
      </g>

      {/* El reflejo que sube y baja: sobre la banda y, más tenue, como halo
          sobre el blanco. Reemplaza a los tres destellos fijos. */}
      <g clipPath="url(#entrada-lado-blanco)">
        <polyline {...linea} stroke="url(#entrada-reflejo)" strokeOpacity="0.6" style={t(ancho(`2 * ${B}`, "clamp(50px, 4.5vw, 120px)"))} filter="url(#entrada-brillo)" />
        <polyline {...linea} stroke="url(#entrada-reflejo)" strokeOpacity="0.55" style={t(ancho(`2 * ${B}`, "clamp(12px, 1vw, 28px)"))} filter="url(#entrada-difuso)" />
        <polyline {...linea} stroke="url(#entrada-reflejo)" style={t(`calc(2 * ${B})`)} filter="url(#entrada-suave)" />
      </g>
      {/* La misma luz, tenue, sobre el borde del panel. */}
      <g clipPath="url(#entrada-lado-negro)">
        <polyline {...linea} stroke="url(#entrada-reflejo)" strokeOpacity="0.3" style={t("clamp(30px, 2.6vw, 70px)")} filter="url(#entrada-brillo)" />
      </g>
    </svg>
  );
}

/* ---------- El texto del panel ---------- */

/* Los íconos de la referencia, en SVG: blancos con un detalle naranja. */
const ICONO = "w-full h-full";
const IconoEficiencia = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinejoin="round" className={ICONO}>
    <rect x="3" y="13" width="4.2" height="8" rx="0.6" className="stroke-sobre-panel" />
    <rect x="9.9" y="9" width="4.2" height="12" rx="0.6" className="stroke-acento" />
    <rect x="16.8" y="4" width="4.2" height="17" rx="0.6" className="stroke-sobre-panel" />
  </svg>
);
const IconoTiempo = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICONO}>
    <circle cx="12" cy="12" r="9" className="stroke-sobre-panel" />
    <polyline points="12,7 12,12 15.5,14" className="stroke-acento" />
  </svg>
);
const IconoResultados = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={ICONO}>
    <polyline points="3,17 8,12 12,15 17.5,9.5" className="stroke-sobre-panel" />
    <polyline points="3,20.5 8,15.5 12,18.5 20.5,10" className="stroke-acento" />
    <polyline points="15,6 20.5,6 20.5,11.5" className="stroke-acento" />
    <line x1="20.5" y1="6" x2="14" y2="12.5" className="stroke-acento" />
  </svg>
);

const PUNTOS = [
  { icono: IconoEficiencia, iconoChico: BarChart3, texto: "Más eficiencia" },
  { icono: IconoTiempo, iconoChico: Clock, texto: "Más tiempo" },
  { icono: IconoResultados, iconoChico: TrendingUp, texto: "Más resultados" },
];

/* Medidas de la referencia: el título arranca al 28% del alto y al 5,8%
   del ancho; las letras son de unos 58 px en una de 1337. Contra el ancho
   y el alto a la vez, así en pantallas muy anchas no crece de más. */
const tam = (vw, vh) => `min(${vw}vw, ${vh}vh)`;

function TextoPanel() {
  return (
    <div className="hidden lg:block absolute text-sobre-panel" style={{ left: "5.8vw", top: "28vh" }}>
      <h1 className="f-d font-black uppercase leading-[1.08] tracking-[-0.005em]" style={{ fontSize: tam(4.15, 7.4) }}>
        Tu negocio<span className="text-acento">.</span><br />
        <span className="text-acento">Bajo control.</span>
      </h1>
      <span className="block bg-acento" style={{ width: tam(6, 10.6), height: "max(2px, 0.22vw)", marginTop: tam(2.6, 4.6) }} aria-hidden="true" />
      <ul className="flex items-stretch" style={{ marginTop: tam(3, 5.3) }}>
        {PUNTOS.map(({ icono: I, texto }, i) => (
          <li key={texto} className="flex items-stretch">
            {i > 0 && <span className="w-px bg-sobre-panel/15 self-center" style={{ height: tam(4, 7), margin: `0 ${tam(2.2, 3.9)}` }} aria-hidden="true" />}
            <div className="flex flex-col items-center" style={{ gap: tam(1, 1.8) }}>
              <span style={{ width: tam(2.5, 4.4), height: tam(2.5, 4.4) }}><I /></span>
              <span className="uppercase text-sobre-panel-suave font-medium whitespace-nowrap" style={{ fontSize: tam(0.72, 1.28), letterSpacing: "0.28em" }}>{texto}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MarcoEntrada({ children }) {
  return (
    <div className="relative min-h-screen bg-fondo text-texto overflow-hidden">
      <Fondo />
      <TextoPanel />

      <div className="relative z-10 min-h-screen flex flex-col lg:block">
        {/* En el celular, el texto arriba de la tarjeta. */}
        <div className="lg:hidden px-6 pt-10 pb-6">
          <h1 className="f-d text-[30px] leading-[1.08] font-black uppercase">
            Tu negocio<span className="text-acento">.</span><br /><span className="text-acento">Bajo control.</span>
          </h1>
          <span className="block w-12 h-0.5 bg-acento mt-5" aria-hidden="true" />
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs uppercase tracking-[0.18em] text-texto-suave">
            {PUNTOS.map(({ iconoChico: I, texto }) => (
              <li key={texto} className="flex items-center gap-2"><I size={15} className="text-acento" /> {texto}</li>
            ))}
          </ul>
        </div>

        {/* En la computadora, centrada en la zona blanca. */}
        <div className="flex-1 flex items-start justify-center px-4 pb-8 lg:p-0 lg:absolute lg:top-1/2 lg:left-[79vw] lg:-translate-x-1/2 lg:-translate-y-1/2">
          <div className="relative tema-claro w-full max-w-[380px] lg:w-[clamp(340px,20vw,390px)] lg:max-w-none bg-superficie text-texto rounded-2xl shadow-2xl ring-1 ring-borde px-7 py-9 lg:px-9 lg:py-11">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* El encabezado de la tarjeta: el logo y la bajada de la maqueta. */
export function CabezaEntrada() {
  return (
    <div className="flex flex-col items-center text-center">
      {/* 56 px: el ícono mide 114, así que en una pantalla de alta
          densidad casi no se estira. */}
      <LogoGenez size={56} conNombre />
      <p className="mt-4 font-mono text-[11px] leading-relaxed tracking-[0.28em] uppercase text-texto-tenue">
        Sistemas de gestión<br />para comercios
      </p>
    </div>
  );
}

/* El pie de la tarjeta: la rayita naranja y la firma. */
export function PieEntrada() {
  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <span className="block w-9 h-0.5 bg-acento" aria-hidden="true" />
      <span className="text-xs text-texto-tenue">Genez - Sistemas de gestión para comercios</span>
    </div>
  );
}

/* Un campo con su ícono a la izquierda, como en la maqueta. `extra` es lo
   que va a la derecha (el ojo de la contraseña). */
export function CampoEntrada({ icono: I, extra = null, ...props }) {
  return (
    <label className="relative block">
      <I size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-texto-suave pointer-events-none" aria-hidden="true" />
      <input {...props}
        className="w-full h-12 rounded-lg border border-borde-fuerte bg-superficie pl-11 pr-11 text-[15px] text-texto placeholder:text-texto-tenue outline-none focus:border-acento transition-colors disabled:opacity-60" />
      {extra && <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{extra}</span>}
    </label>
  );
}
