/* ============================================================
   GENEZ FOUNDER · el pipeline
   ============================================================

   Las oportunidades por etapa. Se arrastran de una columna a otra (y en
   el teléfono, donde arrastrar no anda, con el selector de cada
   tarjeta). Mover lo guarda la base, que además anota el cambio en la
   línea de tiempo y ajusta estado y probabilidad. Pasar a una etapa
   perdida pide el motivo antes de moverla.

   Arriba, lo abierto: cuántas, cuánto por mes si se ganaran todas, y el
   ponderado (valor × probabilidad). El ponderado es una estimación para
   priorizar, no plata: la plata es lo que se cobra.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, Cargando, ErrorEstado, Vacio, Modal, Boton } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { cargarOportunidadesAbiertas, moverOportunidad } from "../datos/internoCrm.js";
import { useConfig, relativo, vencido } from "./util.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Pipeline({ abrir, toast }) {
  const { cfg, de } = useConfig();
  const [ops, setOps] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [arrastrando, setArrastrando] = useState(null);
  const [sobre, setSobre] = useState(null);
  const [perdiendo, setPerdiendo] = useState(null);   // { op, etapaId }
  const [cerradas, setCerradas] = useState(false);
  const leer = () => cargarOportunidadesAbiertas().then(setOps).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);

  const visibles = useMemo(() => (ops || []).filter((o) => !q.trim() || norm(o.nombre).includes(norm(q)) || norm(o.prospecto && o.prospecto.nombre).includes(norm(q))), [ops, q]);
  const columnas = cfg ? cfg.etapas.filter((e) => cerradas || e.tipo === "abierta") : [];
  const abiertas = visibles.filter((o) => o.estado === "abierta");
  const total = abiertas.reduce((s, o) => s + Number(o.valor || 0), 0);
  const ponderado = abiertas.reduce((s, o) => s + Number(o.valor || 0) * (o.probabilidad || 0) / 100, 0);

  const mover = async (op, etapaId, motivo = null) => {
    const etapa = cfg.etapas.find((e) => e.id === etapaId);
    if (!etapa || op.etapaId === etapaId) return;
    if (etapa.tipo === "perdida" && !motivo) return setPerdiendo({ op, etapaId });
    const antes = ops;
    setOps(ops.map((o) => (o.id === op.id ? { ...o, etapaId, estado: etapa.tipo, probabilidad: etapa.probabilidad } : o)));
    try {
      await moverOportunidad(op.id, etapaId, motivo);
      toast(`${op.prospecto ? op.prospecto.nombre : op.nombre} → ${etapa.nombre}`);
      leer();
    } catch (e) {
      setOps(antes);
      toast(e.message, "mal");
    }
  };

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!ops || !cfg) return <Card><Cargando /></Card>;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-d text-3xl">Pipeline</h1>
          <p className="text-sm text-texto-suave mt-1">
            <span className="f-m">{abiertas.length}</span> {abiertas.length === 1 ? "abierta" : "abiertas"}{" · "}<span className="f-m">{money(Math.round(total))}</span>/mes si se ganan todas{" · "}
            ponderado <span className="f-m">{money(Math.round(ponderado))}</span>/mes <span className="text-texto-tenue">(estimación, no plata cobrada)</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={`${inputCls} pl-9 w-48`} />
          </div>
          <label className="flex items-center gap-1.5 text-sm text-texto-suave cursor-pointer">
            <input type="checkbox" checked={cerradas} onChange={(e) => setCerradas(e.target.checked)} className="accent-acento" /> Ganadas, perdidas y pausadas
          </label>
        </div>
      </header>

      {ops.length === 0 ? <Card><Vacio>Todavía no hay oportunidades. Nacen solas al cargar un prospecto.</Vacio></Card> : (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0">
          {columnas.map((col) => {
            const tarjetas = visibles.filter((o) => o.etapaId === col.id);
            const suma = tarjetas.reduce((s, o) => s + Number(o.valor || 0), 0);
            return (
              <section key={col.id}
                onDragOver={(e) => { e.preventDefault(); setSobre(col.id); }}
                onDragLeave={() => setSobre((s) => (s === col.id ? null : s))}
                onDrop={(e) => { e.preventDefault(); setSobre(null); if (arrastrando) mover(arrastrando, col.id); setArrastrando(null); }}
                className={`w-64 shrink-0 rounded-lg border ${tarjetas.length ? "flex" : "hidden md:flex"} ${sobre === col.id ? "border-acento bg-acento-suave/40" : "border-borde bg-superficie"} flex-col max-h-[70vh]`}>
                <div className="px-3 py-2.5 border-b border-borde">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className={`text-sm font-semibold ${col.tipo === "ganada" ? "text-bien" : col.tipo === "perdida" ? "text-mal" : ""}`}>{col.nombre}</h2>
                    <span className="f-m text-xs text-texto-tenue">{tarjetas.length}</span>
                  </div>
                  <div className="text-[11px] text-texto-tenue f-m">{suma ? `${money(Math.round(suma))}/mes · ${col.probabilidad}%` : `${col.probabilidad}%`}</div>
                </div>
                <div className="p-2 space-y-2 overflow-y-auto">
                  {tarjetas.map((o) => (
                    <article key={o.id} draggable onDragStart={() => setArrastrando(o)} onDragEnd={() => setArrastrando(null)}
                      className={`rounded-md border border-borde bg-superficie-2 p-2.5 cursor-grab active:cursor-grabbing ${arrastrando && arrastrando.id === o.id ? "opacity-50" : ""}`}>
                      <button onClick={() => abrir(o.prospectoId)} className="text-left w-full">
                        <div className="text-sm font-medium leading-snug">{o.prospecto ? o.prospecto.nombre : o.nombre}</div>
                        {o.prospecto && o.prospecto.localidad && <div className="text-[11px] text-texto-tenue">{o.prospecto.localidad}</div>}
                      </button>
                      <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]">
                        <span className="f-m">{Number(o.valor) ? money(Number(o.valor)) : "sin valor"}</span>
                        {o.fechaSeguimiento && <span className={vencido(o.fechaSeguimiento) ? "text-mal" : "text-texto-tenue"}>{relativo(o.fechaSeguimiento)}</span>}
                      </div>
                      {o.proximaAccion && <div className="text-[11px] text-texto-suave mt-1 line-clamp-2">{o.proximaAccion}</div>}
                      <select value={o.etapaId} onChange={(e) => mover(o, e.target.value)} aria-label="Mover a otra etapa"
                        className="mt-2 w-full text-[11px] bg-transparent border border-borde rounded px-1.5 py-1 text-texto-suave md:hidden">
                        {cfg.etapas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                      </select>
                    </article>
                  ))}
                  {tarjetas.length === 0 && <p className="text-[11px] text-texto-tenue text-center py-4">Soltá una acá</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {perdiendo && (
        <Modal open onClose={() => setPerdiendo(null)} ancho="max-w-sm">
          <div className="p-5 space-y-3">
            <h3 className="f-d text-lg">¿Por qué se perdió?</h3>
            <p className="text-sm text-texto-suave">{perdiendo.op.prospecto ? perdiendo.op.prospecto.nombre : perdiendo.op.nombre}</p>
            <div className="space-y-1.5">
              {de("motivo_perdida").map((m) => (
                <button key={m.clave} onClick={() => { const p = perdiendo; setPerdiendo(null); mover(p.op, p.etapaId, m.clave); }}
                  className="w-full text-left text-sm px-3 py-2 rounded-md border border-borde hover:bg-superficie-2">{m.nombre}</button>
              ))}
            </div>
            <div className="flex justify-end"><Boton variant="quiet" onClick={() => setPerdiendo(null)}>Cancelar</Boton></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
