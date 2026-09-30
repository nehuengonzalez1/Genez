/* ============================================================
   GENEZ FOUNDER · Agenda
   ============================================================

   Día, semana, mes y la lista de lo que viene. Todo en hora argentina,
   aunque la computadora esté en otra zona. Tocar un horario vacío crea
   un evento ahí; tocar uno existente lo abre. Un evento que ya pasó y
   sigue "programado" queda marcado: pasar la hora no es haberlo hecho,
   y "¿Cómo salió?" registra el resultado y el próximo paso.

   Google Calendar no está conectado. Cuando se conecte, esto no cambia:
   los eventos siguen siendo estos.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio } from "../ui/Base.jsx";
import { cargarEventos } from "../datos/internoCrm.js";
import { useConfig, hora, fechaHora, diaAR, hoyAR, ZONA, deInput } from "./util.js";
import { cargarAjustes } from "../datos/internoFinanzas.js";
import { FormEvento } from "./Formularios.jsx";

const ALTO_HORA = 48;
/* El mediodía del día en la Argentina, para moverse de día en día sin
   que el horario de la computadora corra la fecha. */
const mediodia = (iso) => new Date(`${iso}T12:00:00-03:00`);
const sumarDias = (iso, n) => diaAR(new Date(mediodia(iso).getTime() + n * 86400000));
const lunesDe = (iso) => { const d = mediodia(iso).getUTCDay(); return sumarDias(iso, -((d + 6) % 7)); };
const nombreDia = (iso, op) => mediodia(iso).toLocaleDateString("es-AR", { timeZone: ZONA, ...op });
const minutosAR = (d) => { const [h, m] = hora(d).split(":").map(Number); return h * 60 + m; };

export function Agenda({ abrir, toast, nuevoAlAbrir = false }) {
  const { cfg, de, nombre } = useConfig();
  const [vista, setVista] = useState("semana");
  const [dia, setDia] = useState(hoyAR());
  const [eventos, setEventos] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(nuevoAlAbrir ? { datos: {} } : null);
  /* El horario de la grilla sale de Configuración (interno_ajustes, 0118);
     mientras llega, o si no se puede leer, el de siempre: de 7 a 22. */
  const [horas, setHoras] = useState([7, 22]);
  useEffect(() => {
    cargarAjustes().then((a) => { const g = a.agenda || {}; if (g.hora_fin > g.hora_inicio) setHoras([Number(g.hora_inicio), Number(g.hora_fin)]); }).catch(() => {});
  }, []);
  const [HORA_INICIO, HORA_FIN] = horas;

  const rango = useMemo(() => {
    if (vista === "dia") return [dia, dia];
    if (vista === "semana") { const l = lunesDe(dia); return [l, sumarDias(l, 6)]; }
    if (vista === "mes") { const primero = `${dia.slice(0, 8)}01`; const l = lunesDe(primero); return [l, sumarDias(l, 41)]; }
    return [hoyAR(), sumarDias(hoyAR(), 60)];
  }, [vista, dia]);

  const leer = () => cargarEventos(new Date(`${rango[0]}T00:00:00-03:00`), new Date(`${rango[1]}T23:59:59-03:00`))
    .then(setEventos).catch((e) => setError(e.message));
  useEffect(() => { setEventos(null); leer(); }, [rango[0], rango[1]]);
  const listo = () => { setModal(null); leer(); };

  const mover = (n) => setDia(vista === "dia" ? sumarDias(dia, n) : vista === "semana" ? sumarDias(dia, 7 * n) : (() => {
    const [y, m] = dia.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1, 12)); return d.toISOString().slice(0, 10);
  })());
  const titulo = vista === "dia" ? nombreDia(dia, { weekday: "long", day: "numeric", month: "long" })
    : vista === "semana" ? `Semana del ${nombreDia(rango[0], { day: "numeric", month: "long" })}`
    : vista === "mes" ? nombreDia(dia, { month: "long", year: "numeric" }) : "Lo que viene";

  const pendiente = (e) => e.estado === "programado" && e.fin < new Date();
  const abrirEvento = (e) => setModal({ datos: e, registrar: pendiente(e) });
  const nuevoEn = (iso, minutos) => {
    const h = String(Math.floor(minutos / 60)).padStart(2, "0"), m = String(minutos % 60).padStart(2, "0");
    setModal({ datos: { inicio: deInput(`${iso}T${h}:${m}`) } });
  };

  const Bloque = ({ e }) => (
    <button onClick={() => abrirEvento(e)} className={`w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight border overflow-hidden ${
      e.estado === "cancelado" ? "border-borde text-texto-tenue line-through" : pendiente(e) ? "border-ojo bg-ojo-suave text-texto" : ["demo", "visita"].includes(e.tipo) ? "border-acento bg-acento-suave text-texto" : "border-borde-fuerte bg-superficie-3 text-texto"}`}>
      <span className="f-m">{hora(e.inicio)}</span> {e.titulo}
    </button>
  );

  const Columna = ({ iso }) => {
    const del = (eventos || []).filter((e) => diaAR(e.inicio) === iso);
    return (
      <div className="relative border-l border-borde" style={{ height: (HORA_FIN - HORA_INICIO) * ALTO_HORA }}
        onClick={(ev) => { if (ev.target !== ev.currentTarget) return; const y = ev.nativeEvent.offsetY; nuevoEn(iso, HORA_INICIO * 60 + Math.floor(y / ALTO_HORA * 2) * 30); }}>
        {Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => <div key={i} className="absolute left-0 right-0 border-t border-borde/60 pointer-events-none" style={{ top: i * ALTO_HORA }} />)}
        {diaAR(new Date()) === iso && (() => { const m = minutosAR(new Date()) - HORA_INICIO * 60; return m > 0 && m < (HORA_FIN - HORA_INICIO) * 60 ? <div className="absolute left-0 right-0 border-t-2 border-acento pointer-events-none" style={{ top: m / 60 * ALTO_HORA }} /> : null; })()}
        {del.map((e) => {
          const ini = Math.max(minutosAR(e.inicio), HORA_INICIO * 60), fin = Math.min(Math.max(minutosAR(e.fin), ini + 20), HORA_FIN * 60);
          return <div key={e.id} className="absolute left-0.5 right-0.5" style={{ top: (ini - HORA_INICIO * 60) / 60 * ALTO_HORA, height: Math.max(20, (fin - ini) / 60 * ALTO_HORA - 2) }}><Bloque e={e} /></div>;
        })}
      </div>
    );
  };

  const dias = vista === "dia" ? [dia] : vista === "semana" ? Array.from({ length: 7 }, (_, i) => sumarDias(rango[0], i)) : [];
  const fueraDeHorario = (eventos || []).filter((e) => dias.includes(diaAR(e.inicio)) && (minutosAR(e.inicio) < HORA_INICIO * 60 || minutosAR(e.inicio) >= HORA_FIN * 60));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-d text-3xl">Agenda</h1>
          <p className="text-sm text-texto-suave mt-1 first-letter:uppercase">{titulo}</p>
        </div>
        <div className="flex items-center gap-2">
          {vista !== "lista" && <>
            <button aria-label="Anterior" onClick={() => mover(-1)} className="p-2 rounded-md border border-borde hover:bg-superficie-2"><ChevronLeft size={16} /></button>
            <Boton variant="ghost" onClick={() => setDia(hoyAR())}>Hoy</Boton>
            <button aria-label="Siguiente" onClick={() => mover(1)} className="p-2 rounded-md border border-borde hover:bg-superficie-2"><ChevronRight size={16} /></button>
          </>}
          <Boton onClick={() => setModal({ datos: {} })}>Agendar</Boton>
        </div>
      </header>
      <Tabs value={vista} onChange={setVista} items={[{ k: "dia", n: "Día" }, { k: "semana", n: "Semana" }, { k: "mes", n: "Mes" }, { k: "lista", n: "Lista" }]} />

      {error ? <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>
        : !eventos ? <Card><Cargando /></Card>
        : (vista === "dia" || vista === "semana") ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid border-b border-borde" style={{ gridTemplateColumns: `3rem repeat(${dias.length}, 1fr)` }}>
                  <div />
                  {dias.map((iso) => (
                    <button key={iso} onClick={() => { setDia(iso); setVista("dia"); }} className={`py-2 text-center text-xs ${iso === hoyAR() ? "text-acento font-semibold" : "text-texto-suave"}`}>
                      {nombreDia(iso, { weekday: "short", day: "numeric" })}
                    </button>
                  ))}
                </div>
                <div className="grid max-h-[65vh] overflow-y-auto" style={{ gridTemplateColumns: `3rem repeat(${dias.length}, 1fr)` }}>
                  <div className="relative" style={{ height: (HORA_FIN - HORA_INICIO) * ALTO_HORA }}>
                    {Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => <div key={i} className="absolute right-1.5 text-[10px] text-texto-tenue f-m" style={{ top: i * ALTO_HORA - 6 }}>{String(HORA_INICIO + i).padStart(2, "0")}</div>)}
                  </div>
                  {dias.map((iso) => <Columna key={iso} iso={iso} />)}
                </div>
              </div>
            </div>
            {fueraDeHorario.length > 0 && (
              <div className="px-4 py-2 border-t border-borde text-xs text-texto-suave">
                Fuera de 7 a 22: {fueraDeHorario.map((e) => <button key={e.id} onClick={() => abrirEvento(e)} className="underline mr-2">{fechaHora(e.inicio)} {e.titulo}</button>)}
              </div>
            )}
          </Card>
        ) : vista === "mes" ? (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-7 text-[11px] text-texto-tenue border-b border-borde">
              {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: 42 }, (_, i) => sumarDias(rango[0], i)).map((iso) => {
                const del = eventos.filter((e) => diaAR(e.inicio) === iso);
                const otroMes = iso.slice(0, 7) !== dia.slice(0, 7);
                return (
                  <div key={iso} onClick={(ev) => { if (ev.target === ev.currentTarget) nuevoEn(iso, 10 * 60); }}
                    className={`min-h-[5.5rem] border-b border-r border-borde p-1 space-y-0.5 cursor-pointer ${otroMes ? "opacity-40" : ""}`}>
                    <div className={`text-[11px] ${iso === hoyAR() ? "text-acento font-bold" : "text-texto-suave"}`}>{Number(iso.slice(8))}</div>
                    {del.slice(0, 3).map((e) => <Bloque key={e.id} e={e} />)}
                    {del.length > 3 && <button onClick={() => { setDia(iso); setVista("dia"); }} className="text-[10px] text-texto-tenue">+{del.length - 3} más</button>}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : (
          eventos.filter((e) => e.estado !== "cancelado").length === 0 ? <Card><Vacio>Nada agendado en los próximos 60 días.</Vacio></Card> : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-borde">
                {eventos.filter((e) => e.estado !== "cancelado").map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="f-m text-xs text-texto-tenue w-32">{fechaHora(e.inicio)}</span>
                    <button onClick={() => abrirEvento(e)} className="flex-1 min-w-0 text-left">
                      {e.titulo} <span className="text-[11px] text-texto-tenue">· {nombre("tipo_evento", e.tipo)}{e.lugar ? ` · ${e.lugar}` : ""}</span>
                    </button>
                    {e.prospectoId && <button onClick={() => abrir(e.prospectoId)} className="text-[11px] text-texto-suave hover:text-texto">{e.prospectoNombre || "ficha"}</button>}
                    {e.link && <a href={e.link} target="_blank" rel="noreferrer" className="text-[11px] text-acento">link</a>}
                  </li>
                ))}
              </ul>
            </Card>
          )
        )}

      {modal && cfg && (
        <FormEvento inicial={modal.datos} registrar={!!modal.registrar} tipos={de("tipo_evento")} toast={toast} onCerrar={() => setModal(null)} onListo={listo} />
      )}
    </div>
  );
}
