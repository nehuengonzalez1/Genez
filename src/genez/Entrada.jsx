/* ============================================================
   LA PANTALLA DE ENTRADA · el marco del login y de "contraseña nueva"
   ============================================================

   La maqueta del 03/10: una foto del local, un panel oscuro a la
   izquierda con el borde naranja en flecha, el texto y tres puntos, y la
   tarjeta blanca a la derecha. Armada en capas:

   1. La foto del local, de borde a borde. La sube Genez desde su panel
      (src/datos/imagenLogin.js, 0128); si no hay, la de la maqueta.
   2. El panel, dibujado entero en SVG: el fondo oscuro, las facetas, la
      banda naranja y su brillo. No depende de la foto, así que cualquier
      foto del local queda bien.
   3. El texto, escrito de verdad.
   4. La tarjeta, real, con `.tema-claro`: blanca aunque el sistema esté en
      oscuro, sin escribir colores a mano.

   El panel, el texto y la foto se miden contra una caja de 16:9 que cubre
   la pantalla (--w). La foto de la maqueta es 16:9 y trae su propio panel
   pegado: así el dibujado cae justo encima y lo tapa, banda incluida (la
   del dibujo es más ancha a propósito; ver BANDA).

   Por qué así (pedidos de Nehuen del 03/10): la foto sola de borde a
   borde dejaba el texto enorme; achicada, quedaban franjas; y tiene que
   parecerse a la maqueta y poder cambiarse la foto por una mejor.

   En el celular el panel no entra: el texto va arriba y la tarjeta abajo.
   La versión clara de la pantalla viene después. */

import React, { useState } from "react";
import { BarChart3, Settings, Rocket } from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";
import { urlFotoLogin, FOTO_DE_FABRICA } from "../datos/imagenLogin.js";

const PUNTOS = [
  { icono: BarChart3, texto: "Más control" },
  { icono: Settings, texto: "Más tiempo" },
  { icono: Rocket, texto: "Más crecimiento" },
];

/* El centro de la banda naranja, en las coordenadas de la caja (1672x941).
   Sale de relevar la de la foto de la maqueta fila por fila: arranca
   arriba en 668, llega a la punta de la flecha en (424, 450), vuelve a
   (530, 630) y termina abajo en 327. Con 52 de ancho cubre la de la foto
   en todas las filas, así no se ven dos bandas. */
const BANDA = "668,0 620,125 571,200 508,300 445,400 424,450 448,500 516,600 530,630 520,650 488,700 430,800 358,900 329,941";
const PANEL = `0,0 ${BANDA} 0,941`;

/* Los tamaños van contra el ancho de la caja: el texto siempre cae en el
   mismo lugar del panel. */
const T = (k) => `calc(var(--w) * ${k})`;

function Panel() {
  return (
    <svg viewBox="0 0 1672 941" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id="entrada-fondo" x1="0" y1="0" x2="0.55" y2="1">
          <stop offset="0" stopColor="#1f1f1f" />
          <stop offset="0.5" stopColor="#151515" />
          <stop offset="1" stopColor="#0b0b0b" />
        </linearGradient>
        <linearGradient id="entrada-faceta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2c2c2c" stopOpacity="0.95" />
          <stop offset="1" stopColor="#2c2c2c" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="entrada-banda" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a2a" />
          <stop offset="0.48" stopColor="#ff6a10" />
          <stop offset="1" stopColor="#f24e00" />
        </linearGradient>
        <filter id="entrada-brillo" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
      </defs>

      {/* El brillo va primero: se derrama sobre la foto, detrás de todo. */}
      <polyline points={BANDA} fill="none" stroke="#ff5a00" strokeOpacity="0.55" strokeWidth="96" strokeLinejoin="miter" filter="url(#entrada-brillo)" />

      <polygon points={PANEL} fill="url(#entrada-fondo)" />
      <polygon points="0,0 398,0 472,100 262,360 0,360" fill="url(#entrada-faceta)" />
      <polygon points="0,560 300,560 420,941 0,941" fill="#000" fillOpacity="0.2" />
      <line x1="400" y1="0" x2="472" y2="100" stroke="#ff6a1a" strokeOpacity="0.55" strokeWidth="4" />

      <polyline points={BANDA} fill="none" stroke="url(#entrada-banda)" strokeWidth="52" strokeLinejoin="miter" strokeMiterlimit="8" />
      {/* El filo claro del lado de adentro, que le da el relieve. */}
      <polyline points={BANDA} fill="none" stroke="#ffc08a" strokeOpacity="0.7" strokeWidth="3" strokeLinejoin="miter" strokeMiterlimit="8" transform="translate(-24 0)" />
    </svg>
  );
}

/* La foto subida, y si no hay o no carga, la de la maqueta. Arranca
   invisible y aparece al cargar, así no se ve una foto y después otra. */
function Foto() {
  const [src, setSrc] = useState(() => urlFotoLogin() || FOTO_DE_FABRICA);
  const [lista, setLista] = useState(false);
  return (
    <img src={src} alt="" aria-hidden="true"
      onLoad={() => setLista(true)}
      onError={() => { if (src !== FOTO_DE_FABRICA) setSrc(FOTO_DE_FABRICA); }}
      className={`absolute inset-0 w-full h-full max-w-none object-cover transition-opacity duration-500 ${lista ? "opacity-100" : "opacity-0"}`} />
  );
}

export function MarcoEntrada({ children }) {
  return (
    <div className="relative min-h-screen bg-fondo text-texto overflow-hidden" style={{ "--w": "max(100vw, calc(100vh * 1.7768))" }}>
      <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-[var(--w)] aspect-[1672/941]">
        <Foto />
        <Panel />
      </div>

      {/* El texto del panel, en la computadora. */}
      <div className="hidden lg:block absolute top-1/2 -translate-y-1/2 text-sobre-foto" style={{ left: T(0.052) }}>
        <h1 className="f-d font-extrabold uppercase leading-[1.03] tracking-[-0.01em]" style={{ fontSize: T(0.024) }}>
          Herramientas<br />reales para<br /><span className="text-acento">negocios<br />reales.</span>
        </h1>
        <span className="block h-[3px] bg-acento" style={{ width: T(0.04), marginTop: T(0.02) }} aria-hidden="true" />
        <ul style={{ marginTop: T(0.022) }}>
          {PUNTOS.map(({ icono: I, texto }) => (
            <li key={texto} className="flex items-center text-sobre-foto-suave" style={{ gap: T(0.013), marginTop: T(0.014), fontSize: T(0.0138) }}>
              <I className="text-acento shrink-0" strokeWidth={1.6} style={{ width: T(0.02), height: T(0.02) }} />
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

        <div className="flex-1 flex items-start justify-center px-4 pb-8 lg:p-0 lg:absolute lg:top-1/2 lg:-translate-y-1/2 lg:right-[9vw]">
          {/* Más grande que la anterior y más hacia el centro: lo más
              importante de la pantalla (Nehuen, 03/10). */}
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
