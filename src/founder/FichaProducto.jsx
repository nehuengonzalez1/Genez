/* ============================================================
   GENEZ FOUNDER · la ficha de un elemento del roadmap y la de un proyecto
   ============================================================

   Todo se guarda al cambiarlo (los selectores al elegir, los textos al
   salir del campo): son fichas de trabajo, se editan de a poco. Un bug
   muestra además sus campos (entorno, pasos, esperado, actual,
   solución); el resto de los tipos no los ve.

   Los tickets atados son los que dicen quién lo pide. Sin el área de
   soporte se ve cuántos hay, sin el detalle.
   ============================================================ */

import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { Card, Boton, Cargando, ErrorEstado } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarElemento, guardarElemento, atarTicket, desatarTicket, cargarProyecto, guardarProyecto, cargarProyectos, cargarVersiones,
  TIPO_ROADMAP, ESTADO_ROADMAP, ESTADO_PROYECTO, IMPACTO, COMPLEJIDAD } from "../datos/internoProducto.js";
import { cargarTickets, cargarClientes, GRAVEDAD, ESTADO_TICKET } from "../datos/internoClientes.js";
import { guardarTarea } from "../datos/internoCrm.js";
import { useConfig, relativo, vencido, PRIORIDAD, ESTADO_TAREA } from "./util.js";
import { FormTarea } from "./Formularios.jsx";
import { Adjuntos } from "./Adjuntos.jsx";
import { NuevoElemento } from "./Producto.jsx";

const L = ({ t, children, className = "" }) => <label className={className}><span className="block text-xs text-texto-suave">{t}</span>{children}</label>;
/* Un texto largo que se guarda al salir. key con el valor: si se guardó
   y la ficha se releyó, el campo muestra lo guardado. */
const Largo = ({ t, valor, onGuardar, filas = 3, className = "", placeholder }) => (
  <L t={t} className={className}>
    <textarea key={valor || ""} defaultValue={valor || ""} rows={filas} placeholder={placeholder} className={inputCls}
      onBlur={(e) => e.target.value !== (valor || "") && onGuardar(e.target.value)} />
  </L>
);
const Sel = ({ t, valor, opciones, onCambio, vacio = true }) => (
  <L t={t}>
    <select value={valor || ""} onChange={(e) => onCambio(e.target.value || null)} className={inputCls}>
      {vacio && <option value="">—</option>}
      {opciones.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
    </select>
  </L>
);

function ListaTareas({ tareas, toast, leer, onNueva, onAbrir }) {
  return (
    <Card className="overflow-hidden">
      <h2 className="f-d text-lg px-5 pt-4 pb-2">Tareas</h2>
      {tareas.length === 0 ? <p className="px-5 pb-3 text-sm text-texto-tenue">Ninguna.</p> : (
        <ul className="divide-y divide-borde">
          {tareas.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-2 text-sm">
              <input type="checkbox" aria-label="Completar" className="accent-acento" checked={t.estado === "completada"} onChange={async () => {
                try { await guardarTarea({ id: t.id, estado: t.estado === "completada" ? "pendiente" : "completada" }); leer(); } catch (e) { toast(e.message, "mal"); }
              }} />
              <button onClick={() => onAbrir(t)} className={`flex-1 text-left ${t.estado === "completada" ? "line-through text-texto-tenue" : ""}`}>{t.titulo}</button>
              <span className="text-[11px] text-texto-tenue">{ESTADO_TAREA[t.estado]}</span>
              {t.vence && <span className={`text-[11px] ${t.estado !== "completada" && vencido(t.vence) ? "text-mal" : "text-texto-tenue"}`}>{relativo(t.vence)}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-2.5 border-t border-borde"><Boton size="sm" variant="ghost" onClick={onNueva}><Plus size={13} /> Tarea</Boton></div>
    </Card>
  );
}

function ListaDocumentos({ documentos, abrirDocumento, onNuevo }) {
  return (
    <Card className="overflow-hidden">
      <h2 className="f-d text-lg px-5 pt-4 pb-2">Documentos</h2>
      {documentos.length === 0 ? <p className="px-5 pb-3 text-sm text-texto-tenue">Ninguno.</p> : (
        <ul className="divide-y divide-borde">
          {documentos.map((d) => <li key={d.id}><button onClick={() => abrirDocumento(d.id)} className="w-full text-left px-5 py-2 text-sm hover:bg-superficie-2">{d.titulo}</button></li>)}
        </ul>
      )}
      {onNuevo && <div className="px-5 py-2.5 border-t border-borde"><Boton size="sm" variant="ghost" onClick={onNuevo}><Plus size={13} /> Documento</Boton></div>}
    </Card>
  );
}

/* ---------- Un elemento del roadmap ---------- */
export function FichaElemento({ id, volver, abrirTicket, abrirProyecto, abrirDocumento, nuevoDocumento, toast }) {
  const { cfg, de } = useConfig();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [aux, setAux] = useState({ versiones: [], proyectos: [], clientes: [], tickets: null });
  const [modal, setModal] = useState(null);
  const leer = useCallback(() => cargarElemento(id).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    leer();
    Promise.all([cargarVersiones().catch(() => []), cargarProyectos().catch(() => []), cargarClientes().catch(() => []), cargarTickets().catch(() => null)])
      .then(([versiones, proyectos, clientes, tickets]) => setAux({ versiones, proyectos, clientes, tickets }));
  }, [leer]);

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!d || !cfg) return <Card><Cargando /></Card>;
  const r = d.elemento;
  const esBug = r.tipo === "bug";
  const cambiar = async (cambios, aviso) => {
    try { await guardarElemento({ id: r.id, ...cambios }); if (aviso) toast(aviso); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  const atados = new Set(d.tickets.map((t) => t.id));

  return (
    <div className="space-y-4">
      <button onClick={volver} className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto"><ChevronLeft size={16} /> Volver</button>
      <Card className="p-5 space-y-4">
        <div>
          <span className={`text-[11px] uppercase tracking-wider ${esBug ? "text-mal" : "text-texto-tenue"}`}>{TIPO_ROADMAP[r.tipo]}</span>
          <input key={r.titulo} defaultValue={r.titulo} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== r.titulo && cambiar({ titulo: e.target.value.trim() })}
            className="block w-full f-d text-2xl bg-transparent outline-none border-b border-transparent focus:border-acento" aria-label="Título" />
          <p className="text-sm text-texto-suave mt-1">
            {r.clientesQuePiden > 0 ? <span className="text-acento">Lo piden {r.clientesQuePiden} {r.clientesQuePiden === 1 ? "cliente" : "clientes"}</span> : "Ningún cliente atado todavía"}
            {r.proyectoNombre && <> · <button onClick={() => abrirProyecto(r.proyectoId)} className="hover:text-acento">{r.proyectoNombre}</button></>}
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Sel t="Tipo" valor={r.tipo} vacio={false} opciones={Object.entries(TIPO_ROADMAP)} onCambio={(v) => cambiar({ tipo: v })} />
          <Sel t="Estado" valor={r.estado} vacio={false} opciones={Object.entries(ESTADO_ROADMAP).map(([k, n]) => [k, esBug && k === "lanzado" ? "Corregido" : n])} onCambio={(v) => cambiar({ estado: v })} />
          <Sel t="Prioridad" valor={r.prioridad} vacio={false} opciones={Object.entries(PRIORIDAD)} onCambio={(v) => cambiar({ prioridad: v })} />
          <Sel t="Módulo" valor={r.modulo} opciones={de("modulo").map((x) => [x.clave, x.nombre])} onCambio={(v) => cambiar({ modulo: v })} />
          <Sel t="Impacto esperado" valor={r.impacto} opciones={Object.entries(IMPACTO)} onCambio={(v) => cambiar({ impacto: v })} />
          <Sel t="Complejidad" valor={r.complejidad} opciones={Object.entries(COMPLEJIDAD)} onCambio={(v) => cambiar({ complejidad: v })} />
          <Sel t={esBug ? "Corregido en la versión" : "Versión"} valor={r.versionId} opciones={aux.versiones.map((v) => [v.id, v.nombre])} onCambio={(v) => cambiar({ versionId: v })} />
          <Sel t="Proyecto" valor={r.proyectoId} opciones={aux.proyectos.map((p) => [p.id, p.nombre])} onCambio={(v) => cambiar({ proyectoId: v })} />
          {esBug && <Sel t="Gravedad" valor={r.gravedad} opciones={Object.entries(GRAVEDAD)} onCambio={(v) => cambiar({ gravedad: v })} />}
          {aux.clientes.length > 0 && <Sel t={esBug ? "Cliente que lo reportó" : "Cliente"} valor={r.clienteId} opciones={aux.clientes.map((c) => [c.id, c.nombre])} onCambio={(v) => cambiar({ clienteId: v })} />}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 grid sm:grid-cols-2 gap-3">
            <Largo t="Descripción" valor={r.descripcion} onGuardar={(v) => cambiar({ descripcion: v })} className="sm:col-span-2" />
            {esBug ? (
              <>
                <Largo t="Entorno" valor={r.entorno} filas={2} placeholder="Navegador, equipo, impresora, comercio…" onGuardar={(v) => cambiar({ entorno: v })} />
                <Largo t="Pasos para reproducirlo" valor={r.pasos} filas={2} onGuardar={(v) => cambiar({ pasos: v })} />
                <Largo t="Resultado esperado" valor={r.esperado} filas={2} onGuardar={(v) => cambiar({ esperado: v })} />
                <Largo t="Resultado actual" valor={r.actual} filas={2} onGuardar={(v) => cambiar({ actual: v })} />
                <Largo t="Solución" valor={r.solucion} filas={2} onGuardar={(v) => cambiar({ solucion: v })} className="sm:col-span-2" />
              </>
            ) : (
              <>
                <Largo t="Problema que resuelve" valor={r.problema} filas={2} onGuardar={(v) => cambiar({ problema: v })} />
                <Largo t="A quién afecta (usuario o rubro)" valor={r.afectados} filas={2} onGuardar={(v) => cambiar({ afectados: v })} />
              </>
            )}
            <Largo t="Criterios de aceptación" valor={r.criterios} filas={2} onGuardar={(v) => cambiar({ criterios: v })} />
            <Largo t="Pruebas necesarias" valor={r.pruebas} filas={2} onGuardar={(v) => cambiar({ pruebas: v })} />
          </Card>
          <ListaTareas tareas={d.tareas} toast={toast} leer={leer}
            onNueva={() => setModal({ tipo: "tarea", datos: { titulo: r.titulo, roadmapId: r.id, proyectoId: r.proyectoId || null, categoria: "desarrollo" } })}
            onAbrir={(t) => setModal({ tipo: "tarea", datos: t })} />
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Tickets <span className="f-m text-sm text-texto-tenue">{d.tickets.length}</span></h2>
            {d.tickets.length === 0 ? <p className="px-5 pb-3 text-sm text-texto-tenue">Ninguno atado.</p> : (
              <ul className="divide-y divide-borde">
                {d.tickets.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-5 py-2 text-sm">
                    {t.oculto ? <span className="flex-1 text-texto-tenue">Un ticket (sin acceso a soporte)</span> : (
                      <button onClick={() => abrirTicket(t.id)} className="flex-1 text-left truncate hover:text-acento">
                        <span className="f-m text-xs text-texto-tenue">#{t.numero}</span> {t.titulo} <span className="text-[11px] text-texto-tenue">· {ESTADO_TICKET[t.estado]}</span>
                      </button>
                    )}
                    <button aria-label="Desatar" title="Desatar" onClick={async () => { try { await desatarTicket(r.id, t.id); leer(); } catch (e) { toast(e.message, "mal"); } }}
                      className="p-1 text-texto-tenue hover:text-texto"><X size={13} /></button>
                  </li>
                ))}
              </ul>
            )}
            {aux.tickets && (
              <div className="px-5 py-2.5 border-t border-borde">
                <select value="" onChange={async (e) => { if (!e.target.value) return; try { await atarTicket(r.id, e.target.value); toast("Ticket atado."); leer(); } catch (err) { toast(err.message, "mal"); } }}
                  className={`${inputCls} mt-0`} aria-label="Atar un ticket">
                  <option value="">Atar un ticket…</option>
                  {aux.tickets.filter((t) => !atados.has(t.id)).map((t) => <option key={t.id} value={t.id}>#{t.numero} {t.titulo}{t.clienteNombre ? ` · ${t.clienteNombre}` : ""}</option>)}
                </select>
              </div>
            )}
          </Card>
          <ListaDocumentos documentos={d.documentos} abrirDocumento={abrirDocumento} onNuevo={nuevoDocumento && (() => nuevoDocumento({ roadmapId: r.id, modulo: r.modulo, titulo: r.titulo, tipo: "decision" }))} />
          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Archivos</h2>
            <Adjuntos area="producto" tabla="interno_roadmap" filaId={r.id} lista={d.adjuntos} onCambio={leer} toast={toast} />
          </Card>
          <button onClick={async () => {
            if (!window.confirm("¿Archivarlo? Sale del roadmap; no se borra.")) return;
            try { await guardarElemento({ id: r.id, archivadoEn: new Date() }); toast("Archivado."); volver(); } catch (e) { toast(e.message, "mal"); }
          }} className="text-xs text-texto-suave hover:text-texto px-1">Archivar</button>
        </div>
      </div>

      {modal && modal.tipo === "tarea" && (
        <FormTarea categorias={de("categoria_tarea")} toast={toast} inicial={modal.datos} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />
      )}
    </div>
  );
}

/* ---------- Un proyecto ---------- */
export function FichaProyecto({ id, volver, abrirElemento, abrirDocumento, nuevoDocumento, toast }) {
  const { cfg, de } = useConfig();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const leer = useCallback(() => cargarProyecto(id).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { leer(); }, [leer]);
  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!d || !cfg) return <Card><Cargando /></Card>;
  const p = d.proyecto;
  const cambiar = async (cambios, aviso) => {
    try { await guardarProyecto({ id: p.id, ...cambios }); if (aviso) toast(aviso); leer(); } catch (e) { toast(e.message, "mal"); }
  };

  return (
    <div className="space-y-4">
      <button onClick={volver} className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto"><ChevronLeft size={16} /> Volver</button>
      <Card className="p-5 space-y-4">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-texto-tenue">Proyecto</span>
          <input key={p.nombre} defaultValue={p.nombre} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== p.nombre && cambiar({ nombre: e.target.value.trim() })}
            className="block w-full f-d text-2xl bg-transparent outline-none border-b border-transparent focus:border-acento" aria-label="Nombre" />
          <div className="flex items-center gap-2 mt-2 max-w-sm">
            <span className="flex-1 h-1.5 rounded bg-superficie-2 overflow-hidden"><span className="block h-full bg-acento" style={{ width: `${p.tareasTotal ? (p.tareasHechas / p.tareasTotal) * 100 : 0}%` }} /></span>
            <span className="f-m text-[11px] text-texto-tenue">{p.tareasHechas}/{p.tareasTotal} tareas · {p.elementosTerminados}/{p.elementos} del roadmap</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Sel t="Estado" valor={p.estado} vacio={false} opciones={Object.entries(ESTADO_PROYECTO)} onCambio={(v) => cambiar({ estado: v })} />
          <Sel t="Prioridad" valor={p.prioridad} vacio={false} opciones={Object.entries(PRIORIDAD)} onCambio={(v) => cambiar({ prioridad: v })} />
          <Sel t="Área" valor={p.categoria} opciones={de("categoria_tarea").map((x) => [x.clave, x.nombre])} onCambio={(v) => cambiar({ categoria: v })} />
          <L t="Inicio"><input type="date" value={p.inicio || ""} onChange={(e) => cambiar({ inicio: e.target.value || null })} className={inputCls} /></L>
          <L t="Fin estimado"><input type="date" value={p.finEstimado || ""} onChange={(e) => cambiar({ finEstimado: e.target.value || null })} className={inputCls} /></L>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 grid sm:grid-cols-2 gap-3">
            <Largo t="Objetivo" valor={p.objetivo} filas={2} onGuardar={(v) => cambiar({ objetivo: v })} />
            <Largo t="Resultado esperado" valor={p.resultadoEsperado} filas={2} onGuardar={(v) => cambiar({ resultadoEsperado: v })} />
            <Largo t="Descripción" valor={p.descripcion} onGuardar={(v) => cambiar({ descripcion: v })} className="sm:col-span-2" />
            <Largo t="Riesgos" valor={p.riesgos} filas={2} onGuardar={(v) => cambiar({ riesgos: v })} />
            <Largo t="Dependencias" valor={p.dependencias} filas={2} onGuardar={(v) => cambiar({ dependencias: v })} />
          </Card>
          <ListaTareas tareas={d.tareas} toast={toast} leer={leer}
            onNueva={() => setModal({ tipo: "tarea", datos: { proyectoId: p.id, categoria: p.categoria || "producto" } })}
            onAbrir={(t) => setModal({ tipo: "tarea", datos: t })} />
        </div>
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Del roadmap</h2>
            {d.elementos.length === 0 ? <p className="px-5 pb-3 text-sm text-texto-tenue">Nada todavía.</p> : (
              <ul className="divide-y divide-borde">
                {d.elementos.map((r) => (
                  <li key={r.id}><button onClick={() => abrirElemento(r.id)} className="w-full text-left flex gap-2 px-5 py-2 text-sm hover:bg-superficie-2">
                    <span className="flex-1">{r.titulo}</span><span className="text-[11px] text-texto-tenue">{ESTADO_ROADMAP[r.estado]}</span>
                  </button></li>
                ))}
              </ul>
            )}
            <div className="px-5 py-2.5 border-t border-borde"><Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "elemento" })}><Plus size={13} /> Elemento</Boton></div>
          </Card>
          <ListaDocumentos documentos={d.documentos} abrirDocumento={abrirDocumento} onNuevo={nuevoDocumento && (() => nuevoDocumento({ proyectoId: p.id, titulo: p.nombre, tipo: "nota" }))} />
          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Archivos</h2>
            <Adjuntos area="producto" tabla="interno_proyectos" filaId={p.id} lista={d.adjuntos} onCambio={leer} toast={toast} />
          </Card>
        </div>
      </div>

      {modal && modal.tipo === "tarea" && (
        <FormTarea categorias={de("categoria_tarea")} toast={toast} inicial={modal.datos} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />
      )}
      {modal && modal.tipo === "elemento" && (
        <NuevoElemento extra={{ proyectoId: p.id }} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />
      )}
    </div>
  );
}
