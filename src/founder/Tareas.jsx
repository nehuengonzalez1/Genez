/* ============================================================
   GENEZ FOUNDER · Tareas
   ============================================================

   Todas las tareas, de cualquier área. Hoy (lo que vence hoy y lo
   vencido, que también es de hoy), próximas, vencidas, por prioridad,
   por categoría y completadas. Una tarea que se repite crea la
   siguiente cuando se completa, y eso lo hace la base una sola vez: ni
   abrir esta pantalla ni tildarla dos veces genera copias.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Copy, CalendarClock, CalendarPlus } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarTareas, guardarTarea } from "../datos/internoCrm.js";
import { useConfig, relativo, vencido, diaAR, hoyAR, PRIORIDAD, ESTADO_TAREA, deInput, fechaHora } from "./util.js";
import { FormTarea, FormEvento } from "./Formularios.jsx";

const PESO = { urgente: 0, alta: 1, normal: 2, baja: 3 };
const TONO_PRIORIDAD = { urgente: "text-mal", alta: "text-ojo", normal: "text-texto-tenue", baja: "text-texto-tenue" };

export function Tareas({ abrir, toast, nuevaAlAbrir = false }) {
  const { cfg, de, nombre } = useConfig();
  const [vista, setVista] = useState("hoy");
  const [tareas, setTareas] = useState(null);
  const [error, setError] = useState("");
  const [rapida, setRapida] = useState("");
  const [modal, setModal] = useState(nuevaAlAbrir ? { tipo: "tarea", datos: {} } : null);
  const completadas = vista === "completadas";
  const leer = () => cargarTareas({ completadas }).then(setTareas).catch((e) => setError(e.message));
  useEffect(() => { setTareas(null); leer(); }, [completadas]);
  const listo = () => { setModal(null); leer(); };

  const hoy = hoyAR();
  const filtradas = useMemo(() => {
    if (!tareas) return [];
    const t = tareas;
    if (vista === "hoy") return t.filter((x) => x.vence && diaAR(x.vence) <= hoy);
    if (vista === "proximas") return t.filter((x) => !x.vence || diaAR(x.vence) > hoy);
    if (vista === "vencidas") return t.filter((x) => x.vence && diaAR(x.vence) < hoy);
    if (vista === "prioridad") return [...t].sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad] || (a.vence ? a.vence.getTime() : Infinity) - (b.vence ? b.vence.getTime() : Infinity) || 0);
    return t;
  }, [tareas, vista, hoy]);

  const cambiar = async (t, cambios, aviso) => {
    try { await guardarTarea({ id: t.id, ...cambios }); if (aviso) toast(aviso); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  const crearRapida = async () => {
    if (!rapida.trim()) return;
    const fin = new Date(); fin.setHours(20, 0, 0, 0);
    try { await guardarTarea({ titulo: rapida.trim(), vence: vista === "proximas" ? null : fin, prioridad: "normal" }); setRapida(""); leer(); }
    catch (e) { toast(e.message, "mal"); }
  };

  const Fila = ({ t }) => (
    <li className="flex items-center gap-3 px-4 py-2.5 text-sm group">
      <input type="checkbox" aria-label="Completar" className="accent-acento w-4 h-4" checked={t.estado === "completada"}
        onChange={() => cambiar(t, { estado: t.estado === "completada" ? "pendiente" : "completada" }, t.estado === "completada" ? null : t.repeticion ? "Completada. La próxima ya está en la lista." : "Completada.")} />
      <button onClick={() => setModal({ tipo: "tarea", datos: t })} className="flex-1 min-w-0 text-left">
        <span className={t.estado === "completada" ? "line-through text-texto-tenue" : ""}>{t.titulo}</span>
        <span className="block text-[11px] text-texto-tenue truncate">
          {[t.prospectoNombre, t.categoria && nombre("categoria_tarea", t.categoria), t.estado !== "pendiente" && ESTADO_TAREA[t.estado], t.bloqueo && `frena: ${t.bloqueo}`,
            t.checklist && t.checklist.length ? `${t.checklist.filter((c) => c.hecho).length}/${t.checklist.length}` : null, t.repeticion && "se repite"].filter(Boolean).join(" · ")}
        </span>
      </button>
      {t.prospectoId && <button onClick={() => abrir(t.prospectoId)} className="hidden md:inline text-[11px] text-texto-suave hover:text-texto">ficha</button>}
      <span className={`text-[11px] ${TONO_PRIORIDAD[t.prioridad]}`}>{t.prioridad !== "normal" ? PRIORIDAD[t.prioridad] : ""}</span>
      <span className={`text-[11px] w-20 text-right ${t.estado !== "completada" && vencido(t.vence) ? "text-mal font-medium" : "text-texto-tenue"}`}>
        {completadas ? fechaHora(t.completadaEn) : t.vence ? relativo(t.vence) : "sin fecha"}
      </span>
      {!completadas && (
        <span className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
          <button title="Mañana" aria-label="Pasar a mañana" onClick={() => { const d = new Date(t.vence || Date.now()); d.setDate(d.getDate() + 1); cambiar(t, { vence: d }, "Pasada a mañana."); }} className="p-1 text-texto-tenue hover:text-texto"><CalendarClock size={14} /></button>
          <button title="Duplicar" aria-label="Duplicar" onClick={() => setModal({ tipo: "tarea", datos: { ...t, id: undefined, titulo: `${t.titulo} (copia)`, serieId: null, repeticion: t.repeticion, estado: "pendiente" } })} className="p-1 text-texto-tenue hover:text-texto"><Copy size={14} /></button>
          <button title="Agendar" aria-label="Convertir en evento" onClick={() => setModal({ tipo: "evento", datos: { titulo: t.titulo, tareaId: t.id, prospectoId: t.prospectoId, prospectoNombre: t.prospectoNombre, inicio: t.vence && t.vence > new Date() ? t.vence : undefined } })} className="p-1 text-texto-tenue hover:text-texto"><CalendarPlus size={14} /></button>
        </span>
      )}
    </li>
  );

  const porCategoria = vista === "categoria" && cfg
    ? [...de("categoria_tarea").map((c) => ({ k: c.clave, n: c.nombre })), { k: "", n: "Sin categoría" }]
        .map((c) => ({ ...c, items: filtradas.filter((t) => (t.categoria || "") === c.k) })).filter((c) => c.items.length)
    : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="f-d text-3xl">Tareas</h1>
        <Boton onClick={() => setModal({ tipo: "tarea", datos: {} })}>Nueva tarea</Boton>
      </header>
      <Tabs value={vista} onChange={setVista} items={[
        { k: "hoy", n: "Hoy" }, { k: "proximas", n: "Próximas" },
        { k: "vencidas", n: "Vencidas", badge: tareas && !completadas ? tareas.filter((x) => x.vence && diaAR(x.vence) < hoy).length || null : null },
        { k: "prioridad", n: "Por prioridad" }, { k: "categoria", n: "Por categoría" }, { k: "completadas", n: "Completadas" },
      ]} />
      {!completadas && (
        <input value={rapida} onChange={(e) => setRapida(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") crearRapida(); }}
          placeholder={vista === "proximas" ? "Agregar una tarea sin fecha y Enter" : "Agregar una tarea para hoy y Enter"} className={inputCls} />
      )}
      {error ? <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>
        : !tareas ? <Card><Cargando /></Card>
        : filtradas.length === 0 ? <Card><Vacio>{vista === "hoy" ? "Nada para hoy. Buen momento para prospectar." : vista === "vencidas" ? "Nada vencido." : "No hay tareas acá."}</Vacio></Card>
        : porCategoria ? porCategoria.map((c) => (
            <Card key={c.k || "sin"} className="overflow-hidden">
              <h3 className="px-4 py-2.5 text-sm font-semibold border-b border-borde">{c.n} <span className="f-m text-xs text-texto-tenue">{c.items.length}</span></h3>
              <ul className="divide-y divide-borde">{c.items.map((t) => <Fila key={t.id} t={t} />)}</ul>
            </Card>
          ))
        : <Card className="overflow-hidden"><ul className="divide-y divide-borde">{filtradas.map((t) => <Fila key={t.id} t={t} />)}</ul></Card>}

      {modal && modal.tipo === "tarea" && cfg && <FormTarea inicial={modal.datos} categorias={de("categoria_tarea")} toast={toast} onCerrar={() => setModal(null)} onListo={listo} />}
      {modal && modal.tipo === "evento" && cfg && <FormEvento inicial={modal.datos} tipos={de("tipo_evento")} toast={toast} onCerrar={() => setModal(null)} onListo={listo} />}
    </div>
  );
}
