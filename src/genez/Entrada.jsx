/* ============================================================
   LA PANTALLA DE ENTRADA · el marco del login y de "contraseña nueva"
   ============================================================

   La maqueta del 03/10: una foto del mostrador con el panel oscuro y el
   texto ya dibujados (public/login/fondo-oscuro.jpg) y, a la derecha, una
   tarjeta blanca. La tarjeta es de verdad y no está en la foto: con la
   tarjeta dibujada solo coincidían en pantallas 16:9.

   - La foto es el WebP original de la maqueta, sin recomprimir: pasarla a
     JPG le sumaba pérdida a una imagen que ya venía comprimida.
   - La foto se recorta desde la derecha (object-left): en una pantalla
     más angosta que la foto se pierden estantes, nunca el texto.
   - La tarjeta lleva `.tema-claro`: es blanca aunque el sistema esté en
     oscuro, y adentro los colores son los del tema claro sin escribir
     ninguno a mano.
   - En el celular la foto no entra: el texto va escrito arriba y la
     tarjeta abajo, sobre el fondo del tema.

   La versión clara de la pantalla viene después (pedido de Nehuen). */

import React from "react";
import { BarChart3, Settings, Rocket } from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";

const PUNTOS = [
  { icono: BarChart3, texto: "Más control" },
  { icono: Settings, texto: "Más tiempo" },
  { icono: Rocket, texto: "Más crecimiento" },
];

export function MarcoEntrada({ children }) {
  return (
    <div className="relative min-h-screen bg-fondo text-texto overflow-hidden">
      <img src="/login/fondo-oscuro.webp" alt="" aria-hidden="true"
        className="hidden lg:block absolute inset-0 w-full h-full object-cover object-left" />

      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row lg:items-center lg:justify-end">
        {/* Lo que en la computadora ya está en la foto. */}
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

        <div className="flex-1 lg:flex-none flex items-start lg:items-center justify-center px-4 pb-8 lg:p-0 lg:mr-[3vw]">
          {/* Más chica que en la maqueta (27% del ancho): Nehuen la pidió
              bastante más chica el 03/10. */}
          <div className="tema-claro w-full max-w-[360px] lg:w-[clamp(300px,21vw,350px)] lg:max-w-none bg-superficie text-texto rounded-2xl shadow-2xl px-6 py-7 lg:px-7 lg:py-8">
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
      {/* 46 px: el ícono mide 114, así que en una pantalla de alta
          densidad no se estira y queda nítido. */}
      <LogoGenez size={46} conNombre />
      <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.28em] uppercase text-texto-tenue">
        Sistemas de gestión<br />para comercios
      </p>
    </div>
  );
}

/* El pie de la tarjeta: la rayita naranja y la firma. */
export function PieEntrada() {
  return (
    <div className="mt-5 flex flex-col items-center gap-4">
      <span className="block w-8 h-0.5 bg-acento" aria-hidden="true" />
      <span className="text-[11px] text-texto-tenue">Genez - Sistemas de gestión para comercios</span>
    </div>
  );
}

/* Un campo con su ícono a la izquierda, como en la maqueta. `extra` es lo
   que va a la derecha (el ojo de la contraseña). */
export function CampoEntrada({ icono: I, extra = null, ...props }) {
  return (
    <label className="relative block">
      <I size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-suave pointer-events-none" aria-hidden="true" />
      <input {...props}
        className="w-full h-11 rounded-lg border border-borde-fuerte bg-superficie pl-10 pr-10 text-sm text-texto placeholder:text-texto-tenue outline-none focus:border-acento transition-colors disabled:opacity-60" />
      {extra && <span className="absolute right-2 top-1/2 -translate-y-1/2">{extra}</span>}
    </label>
  );
}
