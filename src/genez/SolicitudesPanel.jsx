/* ============================================================
   SOLICITUDES DE PRESUPUESTO · quién pidió y qué eligió
   ============================================================

   Vive en el panel de plataforma y lee `solicitudes` (0074). Cada
   fila es una persona que llegó al final del alta guiada y dejó su
   WhatsApp: es lo más parecido a una venta que tiene la landing, y
   por eso va arriba de los precios.

   Se trabaja desde acá: escribirle (abre WhatsApp), marcar el estado y
   anotar. Nada más, porque el resto pasa por teléfono.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { cargarSolicitudes, guardarSolicitud, ESTADOS } from "../datos/solicitudes.js";
import { ESCALAS } from "../datos/presupuesto.js";
import { MODULOS } from "../datos/modulos.js";
import { money } from "../utils/helpers.js";
import { inputCls } from "../ui/Campos.jsx";

const ROTULO = "text-[11px] uppercase tracking-widest text-texto-suave font-bold";

const TONO = {
  nueva: "border-acento text-acento bg-acento-suave/40",
  contactada: "border-info text-info bg-info-suave",
  cerrada: "border-borde-fuerte text-texto-suave",
};

const cuando = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) + " " +
    d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const nombreModulo = (k) => (MODULOS.find((m) => m.k === k) || { n: k }).n;
const nombreEscala = (k) => (ESCALAS.find((e) => e.k === k) || { n: k || "" }).n;

export function SolicitudesPanel() {
  const [lista, setLista] = useState([]);
  const [estado, setEstado] = useState("cargando");   // cargando | listo | error
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    let vigente = true;
    cargarSolicitudes()
      .then((xs) => { if (vigente) { setLista(xs); setEstado("listo"); } })
      .catch(() => { if (vigente) setEstado("error"); });
    return () => { vigente = false; };
  }, []);

  const cambiar = async (id, cambios) => {
    setAviso(null);
    try {
      const s = await guardarSolicitud(id, cambios);
      setLista((xs) => xs.map((x) => (x.id === id ? s : x)));
    } catch (e) {
      setAviso(e.message || "No se pudo guardar.");
    }
  };

  const nuevas = lista.filter((s) => s.estado === "nueva").length;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <h2 className={ROTULO}>Solicitudes de presupuesto</h2>
          <p className="text-sm text-texto-tenue">Lo que pidieron desde la landing: quién, qué eligió y cuánto vio.</p>
        </div>
        {estado === "listo" && nuevas > 0 && (
          <span className="text-xs font-bold rounded-md border border-acento text-acento bg-acento-suave/40 px-2 py-1">{nuevas} sin contestar</span>
        )}
      </div>

      <div className="bg-superficie-3 border border-borde-fuerte rounded-2xl divide-y divide-borde-fuerte">
        {estado === "cargando" && <p className="p-4 text-sm text-texto-suave">Cargando…</p>}
        {estado === "error" && (
          <p className="p-4 text-sm text-texto-suave">
            No se pudieron leer las solicitudes. Si la tabla todavía no existe en esta base, hay que aplicar la migración 0074.
          </p>
        )}
        {estado === "listo" && lista.length === 0 && (
          <p className="p-4 text-sm text-texto-suave">Todavía no pidió nadie. Cuando alguien toque "Pedir este presupuesto" en la landing, aparece acá.</p>
        )}
        {aviso && <p className="p-4 text-sm text-mal">{aviso}</p>}

        {lista.map((s) => (
          <div key={s.id} className={`p-4 ${s.estado === "cerrada" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.nombre}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${TONO[s.estado] || TONO.cerrada}`}>{s.estado}</span>
                  <span className="text-[11px] text-texto-tenue">{cuando(s.creado_en)}</span>
                </div>
                <div className="text-sm text-texto-suave mt-0.5">
                  {s.negocio || s.rubro || "Sin rubro"}{s.escala ? ` · ${nombreEscala(s.escala)}` : ""} · {s.modulos.length} módulos ·{" "}
                  {s.mensual != null ? `${money(s.mensual)} por mes` : "precio a confirmar"}
                  {s.puesta_en_marcha > 0 ? ` · puesta en marcha ${money(s.puesta_en_marcha)}` : ""}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {s.modulos.map((k) => (
                    <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-superficie text-texto-tenue">{nombreModulo(k)}</span>
                  ))}
                </div>
                {s.respuestas.length > 0 && (
                  <div className="text-[11px] text-texto-tenue mt-1.5">Marcó: {s.respuestas.map((r) => r.n).join(" · ")}</div>
                )}
                {s.mensaje && <p className="text-sm mt-2 italic text-texto-suave">“{s.mensaje}”</p>}
              </div>

              <div className="shrink-0 flex flex-col items-end gap-2">
                <a href={`https://wa.me/${s.telefono}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl px-2.5 py-2 border border-borde text-texto-suave hover:text-texto hover:bg-superficie-2">
                  <MessageCircle size={14} /> Escribir por WhatsApp
                </a>
                <span className="f-m text-xs text-texto-suave">{s.telefono}{s.email ? ` · ${s.email}` : ""}</span>
                <select value={s.estado} onChange={(e) => cambiar(s.id, { estado: e.target.value })} className={`${inputCls} !mt-0 w-auto`}>
                  {ESTADOS.map((e) => <option key={e.k} value={e.k}>{e.n}</option>)}
                </select>
              </div>
            </div>
            <input placeholder="Notas (se guardan al salir del campo)" defaultValue={s.notas || ""}
              onBlur={(e) => { if (e.target.value !== (s.notas || "")) cambiar(s.id, { notas: e.target.value || null }); }}
              className={`${inputCls} mt-3`} />
          </div>
        ))}
      </div>
    </section>
  );
}
