/* ============================================================
   LA PANTALLA DE ENTRADA · el marco del login y de "contraseña nueva"
   ============================================================

   El fondo es el diseño de Nehuen del 04/10 (negro a la izquierda, blanco
   a la derecha y una banda naranja en flecha entre los dos), rearmado en
   vectores: SVG, sin una sola imagen. Se ve nítido en cualquier pantalla,
   de una notebook a un 4K. Los colores y la forma salen de medir su
   imagen; ver FONDO.

   - El SVG se estira a la pantalla (preserveAspectRatio="none") y los
     trazos no (vector-effect): la banda queda siempre en el mismo lugar
     proporcional y con el mismo grosor, sin recortar ni deformar. Con
     una imagen fija, en una pantalla 4:3 la banda caía debajo de la
     tarjeta.
   - La tarjeta va centrada en la zona blanca (79% del ancho): a la altura
     de la tarjeta la banda no pasa del 58%.
   - La tarjeta lleva `.tema-claro`: blanca aunque el sistema esté en
     oscuro, sin escribir colores a mano. Sobre el blanco la despegan la
     sombra y un borde fino.
   - En el celular, el texto arriba y la tarjeta abajo, sobre el fondo
     del tema.

   La versión clara de la pantalla viene después. */

import React from "react";
import { BarChart3, Settings, Rocket } from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";

const PUNTOS = [
  { icono: BarChart3, texto: "Más control" },
  { icono: Settings, texto: "Más tiempo" },
  { icono: Rocket, texto: "Más crecimiento" },
];

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

   La banda no es una línea: es una barra con volumen. De izquierda a
   derecha, como en el diseño: una canaleta negra, la banda (con un brillo en su tercio izquierdo, el lado
   derecho más oscuro y destellos arriba y abajo), un borde fino brillante
   y el resplandor durazno sobre el blanco.

   Cada capa es la misma línea con otro grosor, recortada al lado que le
   toca (clip-path con el polígono negro o el blanco). Los grosores son en
   píxeles de pantalla (vector-effect), así no se deforman. */
const B = "clamp(16px, 1.7vw, 46px)";            // la banda
const G = "clamp(6px, 0.55vw, 15px)";            // la canaleta negra
const ancho = (...partes) => `calc(${partes.join(" + ")})`;

function Fondo() {
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
        <linearGradient id="entrada-arista" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="0.3" stopColor="#ff9a2e" />
          <stop offset="0.425" stopColor="#ff7a1f" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#ff9a2e" />
          <stop offset="0.85" stopColor="#ffc35a" />
          <stop offset="1" stopColor="#ff9a2e" />
        </linearGradient>
        <radialGradient id="entrada-destello">
          <stop offset="0" stopColor="#fff1b8" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#ffc457" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ff9a2e" stopOpacity="0" />
        </radialGradient>
        <clipPath id="entrada-lado-negro"><polygon points={`-50,-50 ${BANDA} -50,950`} /></clipPath>
        <clipPath id="entrada-lado-blanco"><polygon points={`${ARRIBA} 1650,-50 1650,950 ${ABAJO} ${PUNTA}`} /></clipPath>
        <filter id="entrada-brillo" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="20" /></filter>
        <filter id="entrada-suave" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="1.2" /></filter>
        <filter id="entrada-funde" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="3.5" /></filter>
        <filter id="entrada-difuso" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      {/* El panel negro, con su luz arriba y la viñeta abajo. */}
      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-negro)" />
      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-luz)" />
      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-vineta)" />
      <polygon points={`${ARRIBA} 1600,-20 1600,920 ${ABAJO} ${PUNTA}`} fill="url(#entrada-blanco)" />

      {/* Lado negro: la canaleta. Tenía también un filo naranja en el borde
          del panel y se leía como una segunda línea: se sacó (Nehuen, 04/10). */}
      <g clipPath="url(#entrada-lado-negro)">
        <polyline {...linea} stroke="#050505" style={t(ancho(B, `2 * ${G}`))} />
        <polyline {...linea} stroke="#000" strokeOpacity="0.6" style={t(ancho(B, `1.2 * ${G}`))} filter="url(#entrada-suave)" />
      </g>

      {/* Lado blanco: el resplandor durazno y el borde fino brillante. */}
      <g clipPath="url(#entrada-lado-blanco)">
        <polyline {...linea} stroke="#ff7a2a" strokeOpacity="0.13" style={t(ancho(B, "clamp(36px, 3.4vw, 96px)"))} filter="url(#entrada-brillo)" />
        <polyline {...linea} stroke="#ffcfae" strokeOpacity="0.3" style={t(ancho(B, "clamp(10px, 0.8vw, 24px)"))} filter="url(#entrada-difuso)" />
        <polyline {...linea} stroke="#ff9d52" style={t(ancho(B, "2.5px"))} />
      </g>

      {/* La banda, con volumen: el lado derecho más oscuro y la arista
          iluminada en el tercio izquierdo. */}
      <polyline {...linea} stroke="url(#entrada-banda)" style={t(B)} />
      {/* Solo el borde de afuera se oscurece: se oscurece la mitad derecha
          y se vuelve a pintar el centro, así no queda en dos tonos. */}
      <g clipPath="url(#entrada-lado-blanco)">
        <polyline {...linea} stroke="#8a2400" strokeOpacity="0.3" style={t(B)} filter="url(#entrada-suave)" />
      </g>
      <polyline {...linea} stroke="url(#entrada-banda)" style={t(`calc(${B} * 0.55)`)} filter="url(#entrada-funde)" />
      <g clipPath="url(#entrada-lado-negro)">
        <polyline {...linea} stroke="url(#entrada-arista)" strokeOpacity="0.8" style={t(`calc(${B} * 0.7)`)} filter="url(#entrada-funde)" />
      </g>

      {/* Los destellos: arriba, abajo y uno chico antes de la punta. */}
      <ellipse cx="921" cy="70" rx="16" ry="70" transform="rotate(27 921 70)" fill="url(#entrada-destello)" filter="url(#entrada-difuso)" />
      <ellipse cx="948" cy="760" rx="16" ry="78" transform="rotate(-26 948 760)" fill="url(#entrada-destello)" filter="url(#entrada-difuso)" />
      <ellipse cx="800" cy="300" rx="10" ry="34" transform="rotate(27 800 300)" fill="url(#entrada-destello)" fillOpacity="0.6" filter="url(#entrada-difuso)" />
    </svg>
  );
}

export function MarcoEntrada({ children }) {
  return (
    <div className="relative min-h-screen bg-fondo text-texto overflow-hidden">
      <Fondo />

      <div className="relative z-10 min-h-screen flex flex-col lg:block">
        {/* En el celular, el texto arriba de la tarjeta. */}
        <div className="lg:hidden px-6 pt-10 pb-6">
          <h1 className="f-d text-[28px] leading-[1.05] font-extrabold uppercase">
            Herramientas reales para <span className="text-acento">negocios reales.</span>
          </h1>
          <span className="block w-12 h-0.5 bg-acento mt-5" aria-hidden="true" />
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-texto-suave">
            {PUNTOS.map(({ icono: I, texto }) => (
              <li key={texto} className="flex items-center gap-2"><I size={16} className="text-acento" /> {texto}</li>
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
