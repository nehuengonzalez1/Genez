/* ============================================================
   GENEZ FOUNDER · el marco
   ============================================================

   El sistema interno de la empresa Genez, no de un comercio. Se abre
   desde el panel de plataforma, y solo si la sesión es miembro del
   equipo interno (interno_miembros, 0113). Se carga aparte (React.lazy
   en Genezapp): la computadora de un comercio nunca descarga este
   código. Aun así, lo que protege los datos es la base, no esto.

   El naranja de Founder es el de la marca, #F4510B, y vale solo acá
   adentro: .founder redefine el acento (index.css) sin tocar el del
   resto del sistema.

   El menú muestra solo lo que ya funciona. Cada fase suma sus
   secciones; no hay entradas vacías "próximamente".
   ============================================================ */

import React, { useState } from "react";
import { Home, Settings, ArrowLeftRight, LogOut } from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";
import { puedeArea } from "../datos/interno.js";
import { InicioFounder } from "./Inicio.jsx";
import { ConfiguracionFounder } from "./Configuracion.jsx";

const SECCIONES = [
  { k: "inicio", n: "Inicio", i: Home, area: null },
  { k: "config", n: "Configuración", i: Settings, area: "config" },
];

export default function Founder({ sesion, onComercios, onSalir }) {
  const interno = sesion.interno;
  const visibles = SECCIONES.filter((s) => !s.area || puedeArea(interno, s.area));
  const [seccion, setSeccion] = useState("inicio");
  const [avisos, setAvisos] = useState([]);
  const toast = (texto, tono = "bien") => {
    const id = Math.random().toString(36).slice(2);
    setAvisos((a) => [...a, { id, texto, tono }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 3200);
  };
  const actual = visibles.find((s) => s.k === seccion) || visibles[0];

  return (
    <div className="founder min-h-screen bg-fondo text-texto md:flex">
      <aside className="md:w-60 md:shrink-0 md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-borde bg-superficie flex md:flex-col">
        <div className="px-3 md:px-4 py-3 md:py-4 flex items-center gap-2.5 shrink-0">
          <LogoGenez size={28} claro />
          <div className="leading-tight hidden md:block">
            <div className="f-d text-base">Genez</div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-acento">Founder</div>
          </div>
        </div>
        <nav className="flex md:flex-col gap-0.5 px-2 md:py-2 overflow-x-auto md:overflow-visible flex-1">
          {visibles.map((s) => {
            const I = s.i;
            const activa = actual && actual.k === s.k;
            return (
              <button key={s.k} onClick={() => setSeccion(s.k)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${activa ? "bg-acento-suave text-texto font-semibold" : "text-texto-suave hover:bg-superficie-2 hover:text-texto"}`}>
                <I size={16} className={activa ? "text-acento" : ""} /> {s.n}
              </button>
            );
          })}
        </nav>
        <div className="hidden md:block px-2 py-3 border-t border-borde space-y-0.5">
          <div className="px-3 pb-2 text-[11px] text-texto-tenue truncate">{sesion.nombre} · {interno.rol}</div>
          <button onClick={onComercios} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto">
            <ArrowLeftRight size={16} /> Comercios
          </button>
          <button onClick={onSalir} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-texto-suave hover:bg-superficie-2 hover:text-texto">
            <LogOut size={16} /> Salir
          </button>
        </div>
        <div className="md:hidden flex items-center gap-1 px-2">
          <button onClick={onComercios} aria-label="Comercios" className="p-2 text-texto-suave"><ArrowLeftRight size={18} /></button>
          <button onClick={onSalir} aria-label="Salir" className="p-2 text-texto-suave"><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-8 max-w-6xl">
        {actual && actual.k === "inicio" && <InicioFounder sesion={sesion} ir={setSeccion} toast={toast} />}
        {actual && actual.k === "config" && <ConfiguracionFounder interno={interno} toast={toast} />}
      </main>

      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {avisos.map((t) => (
          <div key={t.id} data-aviso={t.tono === "mal" ? "mal" : "bien"}
            className={`text-sm px-3.5 py-2.5 rounded-lg shadow-lg border ${t.tono === "mal" ? "bg-mal-suave text-mal border-mal" : "bg-superficie-3 text-texto border-borde-fuerte"}`}>
            {t.texto}
          </div>
        ))}
      </div>
    </div>
  );
}
