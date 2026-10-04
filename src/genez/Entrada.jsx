/* ============================================================
   LA PANTALLA DE ENTRADA · el marco del login y de "contraseña nueva"
   ============================================================

   El diseño de referencia de Nehuen (04/10): un panel negro a la
   izquierda con el texto "Tu negocio. Bajo control.", tres puntos y una G
   gigante de marca de agua; una banda naranja encendida como un neón, en
   flecha; y el blanco a la derecha, donde va la tarjeta.

   Todo en vectores, sin una sola imagen: el fondo, la banda y la G en
   SVG, los íconos en SVG y el texto como texto. Nítido en cualquier
   pantalla. Las medidas y los colores salen de medir la referencia.

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

/* ---------- La banda ---------- */

/* En una caja de 1600x900, medida sobre la referencia: arriba al 58,9%
   del ancho, la punta en (44,4%, 43,9%) y abajo al 62,2%. */
const ARRIBA = "942,-20";
const PUNTA = "710,395";
const ABAJO = "995,920";
const BANDA = `${ARRIBA} ${PUNTA} ${ABAJO}`;

/* El grosor, en píxeles de pantalla. */
const B = "clamp(12px, 1.4vw, 38px)";
const ancho = (...partes) => `calc(${partes.join(" + ")})`;

/* Los colores son los de la referencia y fijos a propósito: el fondo es el
   mismo en los dos temas, como el telón. La banda es un neón: bordes
   rojizos (#e13500), cuerpo naranja (#ff6d02, más amarillento arriba) y un
   núcleo claro; irradia hacia los dos lados, durazno sobre el blanco y
   tibio sobre el negro. */
function Fondo() {
  const t = (w) => ({ vectorEffect: "non-scaling-stroke", strokeWidth: w });
  const linea = { points: BANDA, fill: "none", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"
      className="hidden lg:block absolute inset-0 w-full h-full">
      <defs>
        <linearGradient id="entrada-negro" x1="0.2" y1="0" x2="0.1" y2="1">
          <stop offset="0" stopColor="#202322" />
          <stop offset="0.5" stopColor="#111212" />
          <stop offset="1" stopColor="#060606" />
        </linearGradient>
        <linearGradient id="entrada-blanco" x1="0" y1="0" x2="0.1" y2="1">
          <stop offset="0" stopColor="#fdfdfd" />
          <stop offset="1" stopColor="#ececee" />
        </linearGradient>
        <linearGradient id="entrada-cuerpo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9416" />
          <stop offset="0.25" stopColor="#ff7e05" />
          <stop offset="0.44" stopColor="#ff6402" />
          <stop offset="0.75" stopColor="#ff7004" />
          <stop offset="1" stopColor="#ff3c00" />
        </linearGradient>
        <linearGradient id="entrada-nucleo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd08a" />
          <stop offset="0.44" stopColor="#ffb055" />
          <stop offset="1" stopColor="#ff9a3c" />
        </linearGradient>
        <filter id="entrada-halo-ancho" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="30" /></filter>
        <filter id="entrada-halo" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="9" /></filter>
        <filter id="entrada-suave" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="1.4" /></filter>
      </defs>

      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-negro)" />
      <polygon points={`${ARRIBA} 1600,-20 1600,920 ${ABAJO} ${PUNTA}`} fill="url(#entrada-blanco)" />

      {/* La luz que irradia, ancha y cerca. */}
      <polyline {...linea} stroke="#ff5a0a" strokeOpacity="0.26" style={t(ancho(B, "clamp(70px, 6vw, 170px)"))} filter="url(#entrada-halo-ancho)" />
      <polyline {...linea} stroke="#ff6a12" strokeOpacity="0.6" style={t(ancho(B, "clamp(18px, 1.6vw, 44px)"))} filter="url(#entrada-halo)" />

      {/* El tubo: bordes rojizos, cuerpo naranja y núcleo claro. */}
      <polyline {...linea} stroke="#e13500" style={t(B)} />
      <polyline {...linea} stroke="url(#entrada-cuerpo)" style={t(`calc(0.74 * ${B})`)} filter="url(#entrada-suave)" />
      <polyline {...linea} stroke="url(#entrada-nucleo)" strokeOpacity="0.9" style={t(`calc(0.26 * ${B})`)} filter="url(#entrada-suave)" />
    </svg>
  );
}

/* ---------- La G de marca de agua ---------- */

/* La G del logo redibujada (el logo es un PNG de 114 px y acá va enorme):
   un anillo partido en cuatro piezas, en un círculo de radio 1. Los
   ángulos van en grados, 0 a las tres y en el sentido del reloj. */
const R = 1, r = 0.76;
const punto = (a, rad) => [Math.cos((a * Math.PI) / 180) * rad, Math.sin((a * Math.PI) / 180) * rad];
const p = ([x, y]) => `${x.toFixed(4)} ${y.toFixed(4)}`;
function arco(desde, hasta) {
  const grande = Math.abs(hasta - desde) > 180 ? 1 : 0;
  return `M ${p(punto(desde, R))} A ${R} ${R} 0 ${grande} 1 ${p(punto(hasta, R))} L ${p(punto(hasta, r))} A ${r} ${r} 0 ${grande} 0 ${p(punto(desde, r))} Z`;
}
const G_IZQUIERDA = arco(96, 264);
const G_ARRIBA = arco(-84, -21);
const G_ABAJO = arco(56, 84);
/* La barra que entra desde la derecha, con su corte en diagonal, unida al
   tramo del anillo que baja hasta los 48°. */
const yBarra = -0.05, yBase = 0.22;
const aBarra = (Math.asin(yBarra / R) * 180) / Math.PI;
const aBase = (Math.asin(yBase / r) * 180) / Math.PI;
const G_BARRA = `M 0.06 ${yBarra} L ${p(punto(aBarra, R))} A ${R} ${R} 0 0 1 ${p(punto(48, R))} L ${p(punto(48, r))} A ${r} ${r} 0 0 0 ${p(punto(aBase, r))} L 0.27 ${yBase} Z`;

function MarcaG() {
  return (
    <svg viewBox="-1.05 -1.05 2.1 2.1" aria-hidden="true"
      className="hidden lg:block absolute pointer-events-none"
      style={{ width: "52vh", height: "52vh", left: "calc(13.5vw - 26vh)", top: "calc(92vh - 26vh)" }}>
      <g fill="#1a1a1a">
        <path d={G_IZQUIERDA} />
        <path d={G_BARRA} />
        <path d={G_ABAJO} />
      </g>
      {/* En el logo esta pieza es la naranja: acá, apenas más clara. */}
      <path d={G_ARRIBA} fill="#222222" />
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
      <MarcaG />
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
        <div className="flex-1 flex items-start justify-center px-4 pb-8 lg:p-0 lg:absolute lg:top-1/2 lg:left-[77vw] lg:-translate-x-1/2 lg:-translate-y-1/2">
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
