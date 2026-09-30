/* ============================================================
   GENEZ FOUNDER · documentos
   ============================================================

   Procedimientos, guiones, actas, decisiones, investigaciones: cómo se
   construye y se administra Genez. Se escriben en markdown y se ven al
   lado (o en una pestaña, en el teléfono). La búsqueda la hace la base
   en castellano, por título, etiquetas y contenido.

   Guardar no pisa: cada cambio de título o contenido deja la versión
   anterior en el historial (la guarda la base), y cualquier versión se
   puede restaurar, lo que a su vez es una versión nueva.
   ============================================================ */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Plus, Search } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarDocumentos, cargarDocumento, guardarDocumento, cargarVersionDocumento, cargarProyectos, cargarRoadmap, ESTADO_DOCUMENTO } from "../datos/internoProducto.js";
import { cargarClientes } from "../datos/internoClientes.js";
import { cargarMiembros } from "../datos/interno.js";
import { textoPlano } from "../utils/markdown.js";
import { useConfig, relativo, fechaHora } from "./util.js";
import { Markdown } from "./Markdown.jsx";
import { Adjuntos } from "./Adjuntos.jsx";

const TONO_ESTADO = { borrador: "text-ojo", vigente: "text-bien", obsoleto: "text-texto-tenue line-through" };
const L = ({ t, children, className = "" }) => <label className={className}><span className="block text-xs text-texto-suave">{t}</span>{children}</label>;

export function Documentos({ abrirDocumento, nuevoDocumento }) {
  const { cfg, de, nombre } = useConfig();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [archivados, setArchivados] = useState(false);
  /* La búsqueda va a la base, medio segundo después de dejar de escribir. */
  useEffect(() => {
    const h = setTimeout(() => cargarDocumentos({ buscar: q, archivados }).then(setLista).catch((e) => setError(e.message)), q ? 400 : 0);
    return () => clearTimeout(h);
  }, [q, archivados]);
  const visibles = useMemo(() => (lista || []).filter((d) => (!tipo || d.tipo === tipo) && (!estado || d.estado === estado)), [lista, tipo, estado]);

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); setQ(q + " "); }}>{error}</ErrorEstado></Card>;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="f-d text-3xl">Documentos</h1>
        <Boton onClick={() => nuevoDocumento({})}><Plus size={14} /> Documento</Boton>
      </header>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en títulos, etiquetas y contenido" className={`${inputCls} pl-9 mt-0`} />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${inputCls} mt-0 w-auto`}>
          <option value="">Todos los tipos</option>{de("tipo_documento").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className={`${inputCls} mt-0 w-auto`}>
          <option value="">Cualquier estado</option>{Object.entries(ESTADO_DOCUMENTO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-texto-suave cursor-pointer"><input type="checkbox" checked={archivados} onChange={(e) => setArchivados(e.target.checked)} className="accent-acento" /> Archivados</label>
      </div>
      {!lista || !cfg ? <Card><Cargando /></Card>
        : visibles.length === 0 ? <Card><Vacio>{q || tipo || estado ? "Ninguno coincide." : "Todavía no hay documentos. Empezá por lo que repetís seguido: el guion de la demo, cómo dar de alta un comercio, cómo calibrar una impresora."}</Vacio></Card>
        : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-borde">
            {visibles.map((d) => (
              <li key={d.id}>
                <button onClick={() => abrirDocumento(d.id)} className="w-full text-left px-5 py-3 hover:bg-superficie-2">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium flex-1 min-w-0">{d.titulo}</span>
                    <span className={`text-[11px] ${TONO_ESTADO[d.estado]}`}>{ESTADO_DOCUMENTO[d.estado]}</span>
                    <span className="text-[11px] text-texto-tenue">{relativo(d.actualizadoEn)}</span>
                  </div>
                  <p className="text-[12px] text-texto-suave mt-0.5 line-clamp-2">{textoPlano(d.contenido) || "Sin contenido."}</p>
                  <p className="text-[11px] text-texto-tenue mt-0.5">{[nombre("tipo_documento", d.tipo), d.categoria, ...(d.etiquetas || []).map((e) => `#${e}`), d.version > 1 ? `v${d.version}` : null].filter(Boolean).join(" · ")}</p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/* ---------- El documento ---------- */
const VACIO = { titulo: "", tipo: "nota", categoria: "", contenido: "", etiquetas: [], estado: "borrador", modulo: "", proyectoId: "", clienteId: "", roadmapId: "" };

export function Documento({ id, inicial, volver, abrirDocumento, toast }) {
  const { cfg, de } = useConfig();
  const [docId, setDocId] = useState(id);
  const [d, setD] = useState(id ? null : { ...VACIO, ...(inicial || {}) });
  const [guardado, setGuardado] = useState(id ? null : { ...VACIO });
  const [meta, setMeta] = useState({ versiones: [], adjuntos: [], version: 1 });
  const [aux, setAux] = useState({ proyectos: [], clientes: [], roadmap: [], miembros: [] });
  const [error, setError] = useState("");
  const [modo, setModo] = useState(id ? "ver" : "escribir");
  const [viendo, setViendo] = useState(null);     // una versión anterior
  const [guardando, setGuardando] = useState(false);

  const leer = useCallback((cual = docId) => cargarDocumento(cual).then((x) => {
    const doc = { ...VACIO, ...x.documento, etiquetas: x.documento.etiquetas || [] };
    setD(doc); setGuardado(doc); setMeta({ versiones: x.versiones, adjuntos: x.adjuntos, version: x.documento.version, creadoPor: x.documento.creadoPor, creadoEn: x.documento.creadoEn, actualizadoEn: x.documento.actualizadoEn });
  }).catch((e) => setError(e.message)), [docId]);
  useEffect(() => {
    if (docId) leer();
    Promise.all([cargarProyectos().catch(() => []), cargarClientes().catch(() => []), cargarRoadmap().catch(() => []), cargarMiembros().catch(() => [])])
      .then(([proyectos, clientes, roadmap, miembros]) => setAux({ proyectos, clientes, roadmap, miembros }));
  }, []);

  const cambios = d && guardado && JSON.stringify(d) !== JSON.stringify(guardado);
  const guardar = async () => {
    if (!d.titulo.trim()) return toast("Poné un título.", "mal");
    setGuardando(true);
    try {
      const datos = { ...d, titulo: d.titulo.trim(), proyectoId: d.proyectoId || null, clienteId: d.clienteId || null, roadmapId: d.roadmapId || null, modulo: d.modulo || null };
      if (docId) { await guardarDocumento({ ...datos, id: docId }); await leer(); toast("Guardado."); }
      else { const r = await guardarDocumento(datos); setDocId(r.id); await leer(r.id); toast("Documento creado."); }
    } catch (e) { toast(e.message, "mal"); }
    setGuardando(false);
  };
  /* Ctrl+S guarda, como en cualquier editor. */
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (cambios && !guardando) guardar(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
  const salir = () => { if (cambios && !window.confirm("Hay cambios sin guardar. ¿Salir igual?")) return; volver(); };

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!d || !cfg) return <Card><Cargando /></Card>;
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const autor = aux.miembros.find((m) => m.perfil_id === meta.creadoPor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={salir} className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto"><ChevronLeft size={16} /> Volver</button>
        <div className="flex items-center gap-2">
          {cambios && <span className="text-[11px] text-ojo">Sin guardar</span>}
          <Boton onClick={guardar} disabled={!cambios || guardando}>{guardando ? "Guardando…" : docId ? "Guardar" : "Crear"}</Boton>
        </div>
      </div>

      <Card className="p-5 space-y-3">
        <input value={d.titulo} onChange={set("titulo")} placeholder="Título" autoFocus={!docId}
          className="block w-full f-d text-2xl bg-transparent outline-none border-b border-transparent focus:border-acento" aria-label="Título" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <L t="Tipo"><select value={d.tipo} onChange={set("tipo")} className={inputCls}>{de("tipo_documento").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select></L>
          <L t="Estado"><select value={d.estado} onChange={set("estado")} className={inputCls}>{Object.entries(ESTADO_DOCUMENTO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
          <L t="Categoría"><input value={d.categoria || ""} onChange={set("categoria")} className={inputCls} /></L>
          <L t="Etiquetas (con comas)">
            <input value={(d.etiquetas || []).join(", ")} onChange={(e) => setD({ ...d, etiquetas: e.target.value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).slice(0, 20) })} className={inputCls} />
          </L>
          <L t="Módulo"><select value={d.modulo || ""} onChange={set("modulo")} className={inputCls}><option value="">—</option>{de("modulo").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select></L>
          <L t="Proyecto"><select value={d.proyectoId || ""} onChange={set("proyectoId")} className={inputCls}><option value="">—</option>{aux.proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></L>
          <L t="Cliente"><select value={d.clienteId || ""} onChange={set("clienteId")} className={inputCls}><option value="">—</option>{aux.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></L>
          <L t="Del roadmap"><select value={d.roadmapId || ""} onChange={set("roadmapId")} className={inputCls}><option value="">—</option>{aux.roadmap.map((r) => <option key={r.id} value={r.id}>{r.titulo}</option>)}</select></L>
        </div>
        {docId && (
          <p className="text-[11px] text-texto-tenue">
            Versión {meta.version} · {autor ? `escrito por ${autor.nombre || autor.email}` : ""}{meta.creadoEn ? ` el ${fechaHora(meta.creadoEn)}` : ""}{meta.actualizadoEn ? ` · actualizado ${relativo(meta.actualizadoEn)}` : ""}
          </p>
        )}
      </Card>

      <Tabs value={modo} onChange={setModo} items={[
        { k: "escribir", n: "Escribir" }, { k: "ver", n: "Vista previa" }, { k: "lado", n: "Las dos" },
        ...(docId ? [{ k: "historial", n: "Historial", badge: meta.versiones.length || null }, { k: "archivos", n: "Archivos", badge: meta.adjuntos.length || null }] : []),
      ]} />

      {["escribir", "ver", "lado"].includes(modo) && (
        <div className={modo === "lado" ? "grid lg:grid-cols-2 gap-4" : ""}>
          {modo !== "ver" && (
            <Card className="p-0 overflow-hidden">
              <textarea value={d.contenido} onChange={set("contenido")} rows={22} spellCheck
                placeholder={"# Título\n\nTexto con **negrita**, *cursiva* y [links](https://genez.com.ar).\n\n- una lista\n- [ ] una casilla"}
                className="w-full bg-transparent p-4 f-m text-[13px] leading-relaxed outline-none resize-y min-h-[18rem]" aria-label="Contenido" />
            </Card>
          )}
          {modo !== "escribir" && <Card className="p-5"><Markdown texto={d.contenido} /></Card>}
        </div>
      )}
      {modo === "escribir" && <p className="text-[11px] text-texto-tenue">Markdown: # títulos, **negrita**, *cursiva*, `código`, - listas, - [ ] casillas, &gt; citas, [texto](https://…). Ctrl+S guarda.</p>}

      {modo === "historial" && (
        <Card className="overflow-hidden">
          {meta.versiones.length === 0 ? <Vacio>Todavía no se editó: esta es la primera versión.</Vacio> : (
            <ul className="divide-y divide-borde">
              {meta.versiones.map((v) => (
                <li key={v.id}><button onClick={() => cargarVersionDocumento(v.id).then(setViendo).catch((e) => toast(e.message, "mal"))}
                  className="w-full text-left flex gap-3 px-5 py-2.5 text-sm hover:bg-superficie-2">
                  <span className="f-m text-xs text-texto-tenue w-10">v{v.version}</span><span className="flex-1">{v.titulo}</span>
                  <span className="text-[11px] text-texto-tenue">{fechaHora(v.fecha)}</span>
                </button></li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {modo === "archivos" && docId && (
        <Card className="overflow-hidden"><Adjuntos area="docs" tabla="interno_documentos" filaId={docId} lista={meta.adjuntos} onCambio={() => leer()} toast={toast} /></Card>
      )}
      {docId && !d.archivadoEn && (
        <button onClick={async () => {
          if (!window.confirm("¿Archivar este documento? Sale de la lista; no se borra.")) return;
          try { await guardarDocumento({ id: docId, archivadoEn: new Date() }); toast("Archivado."); volver(); } catch (e) { toast(e.message, "mal"); }
        }} className="text-xs text-texto-suave hover:text-texto px-1">Archivar</button>
      )}

      {viendo && (
        <Modal open onClose={() => setViendo(null)} ancho="max-w-3xl">
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="f-d text-xl">v{viendo.version} · {viendo.titulo}</h3>
              <span className="text-[11px] text-texto-tenue">{fechaHora(viendo.fecha)}</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto border border-borde rounded-lg p-4"><Markdown texto={viendo.contenido} /></div>
            <div className="flex justify-end gap-2">
              <Boton variant="ghost" onClick={() => setViendo(null)}>Cerrar</Boton>
              <Boton onClick={() => { setD({ ...d, titulo: viendo.titulo, contenido: viendo.contenido }); setViendo(null); setModo("lado"); toast("Restaurada en el editor: guardá para que quede como versión nueva."); }}>Restaurar esta</Boton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
