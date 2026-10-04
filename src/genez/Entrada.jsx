/* ============================================================
   LA PANTALLA DE ENTRADA · el marco del login y de "contraseña nueva"
   ============================================================

   La maqueta del 03/10: una foto del mostrador con un panel oscuro a la
   izquierda (borde naranja en flecha, texto y tres puntos) y una tarjeta
   blanca a la derecha. Armada en capas, porque la foto
   (public/login/fondo-oscuro.webp) trae el panel y el texto pegados:

   1. La foto, de borde a borde, recortada desde la derecha (object-left):
      en una pantalla angosta se pierden estantes, nunca el panel.
   2. El interior del panel, redibujado en SVG en las coordenadas de la
      foto (viewBox 1672x941) y escalado con ella, así tapa al píxel el
      texto pegado en cualquier pantalla. La banda naranja y su brillo
      quedan los de la foto: el polígono llega justo hasta su borde.
   3. El texto, escrito de verdad y medido contra el ancho de la foto: se
      ve nítido en cualquier resolución y se achica con la pantalla.
   4. La tarjeta, real, con `.tema-claro`: blanca aunque el sistema esté en
      oscuro, sin escribir colores a mano.

   Antes la foto entera iba de borde a borde, con el texto pegado: en un
   monitor de 1920 quedaba enorme, y achicarla dejaba franjas. Nehuen pidió
   pantalla completa, el texto más chico y la tarjeta más grande.

   En el celular la foto no entra: el texto va arriba y la tarjeta abajo.
   La versión clara de la pantalla viene después. */

import React from "react";
import { BarChart3, Settings, Rocket } from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";

const PUNTOS = [
  { icono: BarChart3, texto: "Más control" },
  { icono: Settings, texto: "Más tiempo" },
  { icono: Rocket, texto: "Más crecimiento" },
];

/* El borde izquierdo de la banda naranja, relevado de la foto fila por
   fila: baja hasta la punta de la flecha en (414, 450), vuelve a (515, 630)
   y termina abajo en 302. Pasa un par de píxeles adentro de la banda para
   que no quede una línea del panel viejo entre los dos. */
const PANEL = "0,0 600,0 614,60 605,125 556,200 496,300 434,400 416,450 434,500 503,600 517,630 505,650 471,700 402,800 331,900 304,941 0,941";

/* Los tamaños van contra el ancho de la foto en pantalla (--w), igual que
   el panel: el texto siempre entra en el mismo lugar. */
const T = (k) => `calc(var(--w) * ${k})`;

export function MarcoEntrada({ children }) {
  return (
    <div className="relative min-h-screen bg-fondo text-texto overflow-hidden" style={{ "--w": "max(100vw, calc(100vh * 1.7768))" }}>
      <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-[var(--w)] aspect-[1672/941]" aria-hidden="true">
        <img src="/login/fondo-oscuro.webp" alt="" className="block w-full h-full max-w-none" />
        <svg viewBox="0 0 1672 941" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="entrada-panel" x1="0" y1="0" x2="0.55" y2="1">
              <stop offset="0" stopColor="#1e1e1e" />
              <stop offset="0.5" stopColor="#151515" />
              <stop offset="1" stopColor="#0b0b0b" />
            </linearGradient>
            <linearGradient id="entrada-faceta" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2a2a2a" stopOpacity="0.9" />
              <stop offset="1" stopColor="#2a2a2a" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={PANEL} fill="url(#entrada-panel)" />
          {/* Las facetas de la maqueta: una más clara arriba y el filo
              naranja fino que la cruza. */}
          <polygon points="0,0 398,0 472,100 262,360 0,360" fill="url(#entrada-faceta)" />
          <line x1="400" y1="0" x2="472" y2="100" stroke="#ff6a1a" strokeOpacity="0.55" strokeWidth="4" />
          <polygon points="0,560 300,560 420,941 0,941" fill="#000" fillOpacity="0.18" />
        </svg>
      </div>

      {/* El texto del panel, en la computadora. */}
      <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 text-sobre-foto" style={{ left: T(0.052) }}>
        <h1 className="f-d font-extrabold uppercase leading-[1.03] tracking-[-0.01em]" style={{ fontSize: T(0.0205) }}>
          Herramientas<br />reales para<br /><span className="text-acento">negocios<br />reales.</span>
        </h1>
        <span className="block h-[3px] bg-acento" style={{ width: T(0.034), marginTop: T(0.017) }} aria-hidden="true" />
        <ul style={{ marginTop: T(0.02) }}>
          {PUNTOS.map(({ icono: I, texto }) => (
            <li key={texto} className="flex items-center text-sobre-foto-suave" style={{ gap: T(0.011), marginTop: T(0.012), fontSize: T(0.0118) }}>
              <I className="text-acento shrink-0" strokeWidth={1.75} style={{ width: T(0.017), height: T(0.017) }} />
              {texto}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col lg:block">
        {/* En el celular, el mismo texto arriba de la tarjeta. */}
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

        <div className="flex-1 flex items-start justify-center px-4 pb-8 lg:p-0 lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:right-[5vw]">
          {/* Más grande que la anterior, pedido de Nehuen del 03/10. */}
          <div className="relative tema-claro w-full max-w-[380px] lg:w-[clamp(340px,20vw,390px)] lg:max-w-none bg-superficie text-texto rounded-2xl shadow-2xl px-7 py-9 lg:px-9 lg:py-11">
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
