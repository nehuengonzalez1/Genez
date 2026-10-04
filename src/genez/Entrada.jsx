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
   mismo en los dos temas, como el telón. */
function Fondo() {
  const trazo = { vectorEffect: "non-scaling-stroke" };
  return (
    <svg viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"
      className="hidden lg:block absolute inset-0 w-full h-full">
      <defs>
        <linearGradient id="entrada-negro" x1="0.35" y1="0" x2="0.05" y2="1">
          <stop offset="0" stopColor="#2b2c2e" />
          <stop offset="0.45" stopColor="#131416" />
          <stop offset="1" stopColor="#030304" />
        </linearGradient>
        <radialGradient id="entrada-luz" cx="0.33" cy="0" r="0.55">
          <stop offset="0" stopColor="#3a3b3e" stopOpacity="0.55" />
          <stop offset="1" stopColor="#3a3b3e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="entrada-blanco" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0" stopColor="#fdfcfd" />
          <stop offset="0.5" stopColor="#f5f5f5" />
          <stop offset="1" stopColor="#e1e3e4" />
        </linearGradient>
        <linearGradient id="entrada-banda" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff800c" />
          <stop offset="0.3" stopColor="#f7600a" />
          <stop offset="0.43" stopColor="#ec4302" />
          <stop offset="0.6" stopColor="#ff6703" />
          <stop offset="0.78" stopColor="#ff8506" />
          <stop offset="1" stopColor="#fc4601" />
        </linearGradient>
        <filter id="entrada-brillo" x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id="entrada-sombra" x="-50%" y="-10%" width="200%" height="120%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-negro)" />
      <polygon points={`0,0 ${BANDA} 0,900`} fill="url(#entrada-luz)" />
      <polygon points={`${ARRIBA} 1600,-20 1600,920 ${ABAJO} ${PUNTA}`} fill="url(#entrada-blanco)" />

      {/* El resplandor se derrama sobre el blanco; del lado negro, el filo
          oscuro que despega la banda del panel. */}
      <polyline points={BANDA} transform="translate(16 0)" fill="none" stroke="#ff7a1a" strokeOpacity="0.22"
        strokeLinejoin="round" style={{ ...trazo, strokeWidth: "clamp(36px, 3vw, 90px)" }} filter="url(#entrada-brillo)" />
      <polyline points={BANDA} transform="translate(-11 0)" fill="none" stroke="#000" strokeOpacity="0.85"
        strokeLinejoin="round" style={{ ...trazo, strokeWidth: "clamp(6px, 0.5vw, 14px)" }} filter="url(#entrada-sombra)" />

      <polyline points={BANDA} fill="none" stroke="url(#entrada-banda)" strokeLinejoin="round"
        style={{ ...trazo, strokeWidth: "clamp(22px, 2.3vw, 64px)" }} />
      {/* El centro apenas más claro, que le da el volumen sin leerse como
          una segunda línea. */}
      <polyline points={BANDA} fill="none" stroke="#ffa24d" strokeOpacity="0.45" strokeLinejoin="round"
        style={{ ...trazo, strokeWidth: "clamp(6px, 0.55vw, 16px)" }} filter="url(#entrada-sombra)" />
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
