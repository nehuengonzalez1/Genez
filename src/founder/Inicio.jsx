/* ============================================================
   GENEZ FOUNDER · Inicio
   ============================================================

   En esta fase todavía no hay prospectos, tareas ni agenda: el inicio
   muestra lo que ya existe y es real —el equipo, cómo está armado el
   pipeline, las listas y los pedidos que llegan desde la web— sin
   números inventados ni tarjetas de relleno. "Mi día" llega con el CRM.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Card, Cargando, ErrorEstado, Boton } from "../ui/Base.jsx";
import { cargarEtapas, cargarListas, cargarMiembros, contarSolicitudes, TIPOS_DE_LISTA, puedeArea } from "../datos/interno.js";

const hoy = () => new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

export function InicioFounder({ sesion, ir }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const leer = () => Promise.all([cargarEtapas(), cargarListas(), cargarMiembros(), contarSolicitudes()])
    .then(([etapas, listas, miembros, solicitudes]) => setD({ etapas, listas, miembros, solicitudes }))
    .catch((e) => setError(e.message || "No se pudo leer Founder."));
  useEffect(() => { leer(); }, []);

  const nombre = String(sesion.nombre || "").split(" ")[0];
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-texto-tenue first-letter:uppercase">{hoy()}</p>
        <h1 className="f-d text-3xl mt-1">Hola, {nombre}</h1>
      </header>

      {error ? <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>
        : !d ? <Card><Cargando /></Card> : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="f-d text-lg">El pipeline</h2>
              {puedeArea(sesion.interno, "config") && <Boton size="sm" variant="ghost" onClick={() => ir("config")}>Configurar</Boton>}
            </div>
            <p className="text-sm text-texto-suave mt-1">Las etapas por las que va a pasar cada oportunidad, con la probabilidad que usa el valor ponderado.</p>
            <ol className="mt-4 flex flex-wrap gap-1.5">
              {d.etapas.filter((e) => e.activa).map((e) => (
                <li key={e.id} className={`text-xs px-2.5 py-1 rounded-md border ${e.tipo === "ganada" ? "border-bien text-bien" : e.tipo === "perdida" ? "border-mal text-mal" : e.tipo === "pausada" ? "border-borde text-texto-tenue" : "border-borde text-texto-suave"}`}>
                  {e.nombre} <span className="f-m text-texto-tenue">{e.probabilidad}%</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <h2 className="f-d text-lg">Pedidos desde la web</h2>
            <p className="f-d f-m text-4xl mt-3">{d.solicitudes == null ? "—" : d.solicitudes}</p>
            <p className="text-sm text-texto-suave mt-1">
              {d.solicitudes ? "Llegaron por el formulario de la landing. Con el CRM se convierten en prospectos." : "Todavía no llegó ninguno por el formulario de la landing."}
            </p>
          </Card>

          <Card className="p-5 lg:col-span-2">
            <h2 className="f-d text-lg">Lo que ya está cargado</h2>
            <ul className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {TIPOS_DE_LISTA.map((t) => {
                const items = d.listas.filter((l) => l.tipo === t.k && l.activo);
                return (
                  <li key={t.k} className="flex items-baseline justify-between gap-3 text-sm border-b border-borde py-1.5">
                    <span className="text-texto-suave">{t.n}</span>
                    <span className="f-m">{items.length}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="f-d text-lg">El equipo</h2>
            <ul className="mt-3 space-y-2">
              {d.miembros.map((m) => (
                <li key={m.perfil_id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{m.nombre || m.email}</span>
                  <span className={`text-[11px] uppercase tracking-wider ${m.activo ? "text-texto-suave" : "text-texto-tenue line-through"}`}>{m.rol}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
