/* ============================================================
   GENEZ FOUNDER · producto
   ============================================================

   Qué construir, por qué y para quién. El roadmap junta ideas,
   funcionalidades, mejoras, bugs, pedidos de clientes, deuda técnica e
   integraciones: se ve como tablero por estado o como lista agrupada por
   módulo, prioridad, versión, estado o tipo. "Lo piden N clientes" sale
   de los tickets atados, no de un número que alguien escribe.

   Los bugs tienen su pestaña porque se miran distinto (por gravedad, lo
   abierto primero). Proyectos agrupan tareas y elementos; las versiones
   dicen qué sale cuándo.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarRoadmap, guardarElemento, cargarProyectos, guardarProyecto, cargarVersiones, guardarVersion,
  TIPO_ROADMAP, ESTADO_ROADMAP, ESTADO_PROYECTO, ESTADO_VERSION } from "../datos/internoProducto.js";
import { GRAVEDAD } from "../datos/internoClientes.js";
import { useConfig, PRIORIDAD } from "./util.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const TONO_PRIORIDAD = { urgente: "text-mal", alta: "text-ojo", normal: "text-texto-tenue", baja: "text-texto-tenue" };
const TONO_GRAVEDAD = { critica: "text-mal", grave: "text-mal", moderada: "text-ojo", menor: "text-texto-tenue" };
const PESO = { urgente: 0, alta: 1, normal: 2, baja: 3 };
const CERRADO = ["lanzado", "descartado"];
const L = ({ t, children, className = "" }) => <label className={className}><span className="block text-xs text-texto-suave">{t}</span>{children}</label>;
export const diaCorto = (dia) => (dia ? String(dia).slice(0, 10).split("-").reverse().join("/") : "");

export function Producto({ abrirElemento, abrirProyecto, toast }) {
  const [pestana, setPestana] = useState("roadmap");
  return (
    <div className="space-y-4">
      <h1 className="f-d text-3xl">Producto</h1>
      <Tabs value={pestana} onChange={setPestana} items={[{ k: "roadmap", n: "Roadmap" }, { k: "bugs", n: "Bugs" }, { k: "proyectos", n: "Proyectos" }, { k: "versiones", n: "Versiones" }]} />
      {pestana === "roadmap" && <Roadmap abrirElemento={abrirElemento} toast={toast} />}
      {pestana === "bugs" && <Bugs abrirElemento={abrirElemento} toast={toast} />}
      {pestana === "proyectos" && <Proyectos abrirProyecto={abrirProyecto} toast={toast} />}
      {pestana === "versiones" && <Versiones abrirElemento={abrirElemento} toast={toast} />}
    </div>
  );
}

/* ---------- Roadmap ---------- */
function Roadmap({ abrirElemento, toast }) {
  const { cfg, nombre } = useConfig();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("tablero");
  const [agrupar, setAgrupar] = useState("modulo");
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("");
  const [cerrados, setCerrados] = useState(false);
  const [arrastrando, setArrastrando] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const leer = () => cargarRoadmap().then(setItems).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);

  const visibles = useMemo(() => (items || []).filter((r) => (!tipo || r.tipo === tipo) && (cerrados || !CERRADO.includes(r.estado))
    && (!q.trim() || norm(r.titulo).includes(norm(q)) || norm(r.descripcion).includes(norm(q)))), [items, tipo, cerrados, q]);

  const mover = async (r, estado) => {
    if (r.estado === estado) return;
    const antes = items;
    setItems(items.map((x) => (x.id === r.id ? { ...x, estado } : x)));
    try { await guardarElemento({ id: r.id, estado }); toast(`${r.titulo} → ${ESTADO_ROADMAP[estado]}`); leer(); }
    catch (e) { setItems(antes); toast(e.message, "mal"); }
  };

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!items || !cfg) return <Card><Cargando /></Card>;

  const Tarjeta = ({ r }) => (
    <article draggable onDragStart={() => setArrastrando(r)} onDragEnd={() => setArrastrando(null)}
      className={`rounded-md border border-borde bg-superficie-2 p-2.5 cursor-grab ${arrastrando && arrastrando.id === r.id ? "opacity-50" : ""}`}>
      <button onClick={() => abrirElemento(r.id)} className="text-left w-full">
        <span className={`text-[10px] uppercase tracking-wider ${r.tipo === "bug" ? "text-mal" : "text-texto-tenue"}`}>{TIPO_ROADMAP[r.tipo]}</span>
        <span className="block text-sm font-medium leading-snug">{r.titulo}</span>
      </button>
      <div className="flex flex-wrap gap-x-2 text-[11px] text-texto-tenue mt-1">
        {r.modulo && <span>{nombre("modulo", r.modulo)}</span>}
        {r.prioridad !== "normal" && <span className={TONO_PRIORIDAD[r.prioridad]}>{PRIORIDAD[r.prioridad]}</span>}
        {r.versionNombre && <span className="f-m">v{r.versionNombre}</span>}
        {r.clientesQuePiden > 0 && <span className="text-acento">{r.clientesQuePiden} {r.clientesQuePiden === 1 ? "cliente" : "clientes"}</span>}
      </div>
      <select value={r.estado} onChange={(e) => mover(r, e.target.value)} aria-label="Mover a otro estado"
        className="mt-2 w-full text-[11px] bg-transparent border border-borde rounded px-1.5 py-1 text-texto-suave md:hidden">
        {Object.entries(ESTADO_ROADMAP).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
      </select>
    </article>
  );

  const clave = (r) => ({ modulo: r.modulo || "", prioridad: r.prioridad, version: r.versionNombre || "", estado: r.estado, tipo: r.tipo }[agrupar]);
  const titulo = (k) => ({ modulo: k ? nombre("modulo", k) : "Sin módulo", prioridad: PRIORIDAD[k], version: k ? `Versión ${k}` : "Sin versión", estado: ESTADO_ROADMAP[k], tipo: TIPO_ROADMAP[k] }[agrupar]);
  const grupos = Object.entries(visibles.reduce((g, r) => { (g[clave(r)] = g[clave(r)] || []).push(r); return g; }, {}))
    .sort(([a], [b]) => (agrupar === "prioridad" ? PESO[a] - PESO[b] : agrupar === "estado" ? Object.keys(ESTADO_ROADMAP).indexOf(a) - Object.keys(ESTADO_ROADMAP).indexOf(b) : (a || "~").localeCompare(b || "~")));
  const columnas = Object.keys(ESTADO_ROADMAP).filter((e) => cerrados || !CERRADO.includes(e));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={vista} onChange={setVista} items={[{ k: "tablero", n: "Tablero" }, { k: "lista", n: "Lista" }]} />
        <div className="relative flex-1 min-w-[10rem]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={`${inputCls} pl-9 mt-0`} />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${inputCls} mt-0 w-auto`}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_ROADMAP).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        {vista === "lista" && (
          <select value={agrupar} onChange={(e) => setAgrupar(e.target.value)} className={`${inputCls} mt-0 w-auto`} aria-label="Agrupar por">
            <option value="modulo">Por módulo</option><option value="prioridad">Por prioridad</option><option value="version">Por versión</option>
            <option value="estado">Por estado</option><option value="tipo">Por tipo</option>
          </select>
        )}
        <label className="flex items-center gap-1.5 text-sm text-texto-suave cursor-pointer">
          <input type="checkbox" checked={cerrados} onChange={(e) => setCerrados(e.target.checked)} className="accent-acento" /> Lanzados y descartados
        </label>
        <Boton onClick={() => setNuevo(true)}><Plus size={14} /> Nuevo</Boton>
      </div>

      {items.length === 0 ? <Card><Vacio>El roadmap está vacío. Sumá ideas, mejoras o pedidos; los tickets de soporte pasan acá con "Pasar a producto".</Vacio></Card>
        : vista === "tablero" ? (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0">
          {columnas.map((col) => {
            const tarjetas = visibles.filter((r) => r.estado === col);
            return (
              <section key={col} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (arrastrando) mover(arrastrando, col); setArrastrando(null); }}
                className={`w-60 shrink-0 rounded-lg border border-borde bg-superficie flex-col max-h-[70vh] ${tarjetas.length ? "flex" : "hidden md:flex"}`}>
                <div className="px-3 py-2.5 border-b border-borde flex justify-between"><h2 className="text-sm font-semibold">{ESTADO_ROADMAP[col]}</h2><span className="f-m text-xs text-texto-tenue">{tarjetas.length}</span></div>
                <div className="p-2 space-y-2 overflow-y-auto">
                  {tarjetas.map((r) => <Tarjeta key={r.id} r={r} />)}
                  {tarjetas.length === 0 && <p className="text-[11px] text-texto-tenue text-center py-4">Soltá una acá</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : visibles.length === 0 ? <Card><Vacio>Ninguno coincide.</Vacio></Card> : (
        grupos.map(([k, rs]) => (
          <Card key={k || "sin"} className="overflow-hidden">
            <h3 className="px-4 py-2.5 text-sm font-semibold border-b border-borde">{titulo(k)} <span className="f-m text-xs text-texto-tenue">{rs.length}</span></h3>
            <ul className="divide-y divide-borde">
              {[...rs].sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad]).map((r) => (
                <li key={r.id}>
                  <button onClick={() => abrirElemento(r.id)} className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-sm hover:bg-superficie-2">
                    <span className={`text-[10px] uppercase tracking-wider w-24 ${r.tipo === "bug" ? "text-mal" : "text-texto-tenue"}`}>{TIPO_ROADMAP[r.tipo]}</span>
                    <span className="flex-1 min-w-[10rem]">{r.titulo}</span>
                    {r.clientesQuePiden > 0 && <span className="text-[11px] text-acento">{r.clientesQuePiden} {r.clientesQuePiden === 1 ? "cliente" : "clientes"}</span>}
                    <span className={`text-[11px] ${TONO_PRIORIDAD[r.prioridad]}`}>{r.prioridad !== "normal" ? PRIORIDAD[r.prioridad] : ""}</span>
                    <span className="text-[11px] text-texto-suave w-24 text-right">{ESTADO_ROADMAP[r.estado]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
      {nuevo && <NuevoElemento toast={toast} onCerrar={() => setNuevo(false)} onListo={(id) => { setNuevo(false); abrirElemento(id); }} />}
    </div>
  );
}

/* Lo mínimo para crearlo; el resto se completa en su ficha. */
export function NuevoElemento({ tipoInicial = "mejora", extra = {}, onCerrar, onListo, toast }) {
  const { de } = useConfig();
  const [d, setD] = useState({ tipo: tipoInicial, titulo: "", modulo: "", prioridad: "normal", gravedad: tipoInicial === "bug" ? "moderada" : "", descripcion: "" });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    if (!d.titulo.trim()) return toast("Poné un título.", "mal");
    try {
      const r = await guardarElemento({ ...d, ...extra, titulo: d.titulo.trim(), gravedad: d.tipo === "bug" ? d.gravedad || null : null });
      toast(d.tipo === "bug" ? "Bug reportado." : "Agregado al roadmap.");
      onListo(r.id);
    } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">{d.tipo === "bug" ? "Reportar un bug" : "Nuevo en el roadmap"}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <L t="Tipo"><select value={d.tipo} onChange={set("tipo")} className={inputCls}>{Object.entries(TIPO_ROADMAP).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
          <L t="Módulo"><select value={d.modulo} onChange={set("modulo")} className={inputCls}><option value="">—</option>{de("modulo").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select></L>
          <L t="Título *" className="sm:col-span-2"><input value={d.titulo} onChange={set("titulo")} autoFocus className={inputCls} /></L>
          <L t="Descripción" className="sm:col-span-2"><textarea value={d.descripcion} onChange={set("descripcion")} rows={3} className={inputCls} /></L>
          <L t="Prioridad"><select value={d.prioridad} onChange={set("prioridad")} className={inputCls}>{Object.entries(PRIORIDAD).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
          {d.tipo === "bug" && <L t="Gravedad"><select value={d.gravedad} onChange={set("gravedad")} className={inputCls}>{Object.entries(GRAVEDAD).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>}
        </div>
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Crear</Boton></div>
      </div>
    </Modal>
  );
}

/* ---------- Bugs ---------- */
function Bugs({ abrirElemento, toast }) {
  const { cfg, nombre } = useConfig();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [todos, setTodos] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const leer = () => cargarRoadmap().then((r) => setItems(r.filter((x) => x.tipo === "bug"))).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);
  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!items || !cfg) return <Card><Cargando /></Card>;
  const GRAV = { critica: 0, grave: 1, moderada: 2, menor: 3 };
  const lista = items.filter((b) => todos || !CERRADO.includes(b.estado))
    .sort((a, b) => (CERRADO.includes(a.estado) - CERRADO.includes(b.estado)) || (GRAV[a.gravedad] ?? 9) - (GRAV[b.gravedad] ?? 9));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-suave"><span className="f-m">{items.filter((b) => !CERRADO.includes(b.estado)).length}</span> abiertos · los más graves primero</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-texto-suave cursor-pointer"><input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="accent-acento" /> Corregidos y descartados</label>
          <Boton onClick={() => setNuevo(true)}><Plus size={14} /> Reportar bug</Boton>
        </div>
      </div>
      {lista.length === 0 ? <Card><Vacio>{items.length ? "Nada abierto." : "Sin bugs reportados. Los tickets de error pasan acá con \"Pasar a producto\"."}</Vacio></Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-borde">
            {lista.map((b) => (
              <li key={b.id}>
                <button onClick={() => abrirElemento(b.id)} className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm hover:bg-superficie-2">
                  <span className={`text-[11px] w-16 ${TONO_GRAVEDAD[b.gravedad] || "text-texto-tenue"}`}>{GRAVEDAD[b.gravedad] || "—"}</span>
                  <span className="flex-1 min-w-[10rem]">
                    <span className="block">{b.titulo}</span>
                    <span className="block text-[11px] text-texto-tenue">{[b.modulo && nombre("modulo", b.modulo), b.clienteNombre, b.tickets ? `${b.tickets} ticket${b.tickets > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-[11px] text-texto-suave">{b.estado === "lanzado" ? `Corregido${b.versionNombre ? ` en ${b.versionNombre}` : ""}` : ESTADO_ROADMAP[b.estado]}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {nuevo && <NuevoElemento tipoInicial="bug" toast={toast} onCerrar={() => setNuevo(false)} onListo={(id) => { setNuevo(false); abrirElemento(id); }} />}
    </div>
  );
}

/* ---------- Proyectos ---------- */
function Proyectos({ abrirProyecto, toast }) {
  const { cfg, de, nombre } = useConfig();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState(null);
  const [terminados, setTerminados] = useState(false);
  const leer = () => cargarProyectos().then(setLista).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);
  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!lista || !cfg) return <Card><Cargando /></Card>;
  const visibles = lista.filter((p) => terminados || !["completado", "cancelado"].includes(p.estado));
  const crear = async () => {
    if (!nuevo.nombre.trim()) return toast("Poné el nombre.", "mal");
    try { const r = await guardarProyecto({ ...nuevo, nombre: nuevo.nombre.trim() }); setNuevo(null); abrirProyecto(r.id); } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="flex items-center gap-1.5 text-sm text-texto-suave cursor-pointer"><input type="checkbox" checked={terminados} onChange={(e) => setTerminados(e.target.checked)} className="accent-acento" /> Completados y cancelados</label>
        <Boton onClick={() => setNuevo({ nombre: "", objetivo: "", categoria: "producto" })}><Plus size={14} /> Proyecto</Boton>
      </div>
      {visibles.length === 0 ? <Card><Vacio>{lista.length ? "Ninguno en curso." : "Sin proyectos. Un proyecto junta tareas y elementos del roadmap con un objetivo y fechas."}</Vacio></Card> : (
        <div className="grid md:grid-cols-2 gap-3">
          {visibles.map((p) => (
            <button key={p.id} onClick={() => abrirProyecto(p.id)} className="text-left rounded-lg border border-borde bg-superficie p-4 hover:bg-superficie-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{p.nombre}</span>
                <span className="text-[11px] text-texto-suave shrink-0">{ESTADO_PROYECTO[p.estado]}</span>
              </div>
              {p.objetivo && <p className="text-sm text-texto-suave mt-1 line-clamp-2">{p.objetivo}</p>}
              <div className="flex items-center gap-2 mt-3">
                <span className="flex-1 h-1.5 rounded bg-superficie-2 overflow-hidden"><span className="block h-full bg-acento" style={{ width: `${p.tareasTotal ? (p.tareasHechas / p.tareasTotal) * 100 : 0}%` }} /></span>
                <span className="f-m text-[11px] text-texto-tenue">{p.tareasHechas}/{p.tareasTotal} tareas</span>
              </div>
              <p className="text-[11px] text-texto-tenue mt-1.5">
                {[p.categoria && nombre("categoria_tarea", p.categoria), p.elementos ? `${p.elementos} en el roadmap` : null, p.finEstimado && `termina ${diaCorto(p.finEstimado)}`].filter(Boolean).join(" · ")}
              </p>
            </button>
          ))}
        </div>
      )}
      {nuevo && (
        <Modal open onClose={() => setNuevo(null)} ancho="max-w-md">
          <div className="p-5 space-y-3">
            <h3 className="f-d text-xl">Nuevo proyecto</h3>
            <L t="Nombre *"><input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} autoFocus className={inputCls} /></L>
            <L t="Objetivo"><textarea value={nuevo.objetivo} onChange={(e) => setNuevo({ ...nuevo, objetivo: e.target.value })} rows={2} className={inputCls} /></L>
            <L t="Área"><select value={nuevo.categoria} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} className={inputCls}>{de("categoria_tarea").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select></L>
            <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={() => setNuevo(null)}>Cancelar</Boton><Boton onClick={crear}>Crear</Boton></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Versiones ---------- */
function Versiones({ abrirElemento, toast }) {
  const [versiones, setVersiones] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [nueva, setNueva] = useState(null);
  const leer = () => Promise.all([cargarVersiones(), cargarRoadmap()]).then(([v, r]) => { setVersiones(v); setItems(r); }).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);
  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!versiones) return <Card><Cargando /></Card>;
  const cambiar = async (v, cambios) => { try { await guardarVersion({ id: v.id, ...cambios }); leer(); } catch (e) { toast(e.message, "mal"); } };
  const crear = async () => {
    if (!nueva.nombre.trim()) return toast("Poné el nombre, por ejemplo 1.4.", "mal");
    try { await guardarVersion({ ...nueva, nombre: nueva.nombre.trim(), fechaObjetivo: nueva.fechaObjetivo || null }); setNueva(null); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Boton onClick={() => setNueva({ nombre: "", objetivo: "", fechaObjetivo: "" })}><Plus size={14} /> Versión</Boton></div>
      {versiones.length === 0 ? <Card><Vacio>Sin versiones. Una versión junta lo que sale junto, y en un bug dice en cuál se corrigió.</Vacio></Card> : versiones.map((v) => {
        const de = items.filter((r) => r.versionId === v.id);
        const listos = de.filter((r) => r.estado === "lanzado").length;
        return (
          <Card key={v.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-borde">
              <span className="f-d f-m text-lg">{v.nombre}</span>
              <span className="text-sm text-texto-suave flex-1 min-w-0 truncate">{v.objetivo}</span>
              <span className="text-[11px] text-texto-tenue">{v.lanzadaEn ? `lanzada ${diaCorto(v.lanzadaEn.toISOString())}` : v.fechaObjetivo ? `para el ${diaCorto(v.fechaObjetivo)}` : ""}</span>
              <span className="f-m text-[11px] text-texto-tenue">{listos}/{de.length} listos</span>
              <select value={v.estado} onChange={(e) => cambiar(v, { estado: e.target.value })} className="text-xs bg-transparent border border-borde rounded-md px-1.5 py-0.5" aria-label="Estado de la versión">
                {Object.entries(ESTADO_VERSION).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
            {de.length === 0 ? <p className="px-4 py-3 text-sm text-texto-tenue">Nada asignado todavía. Se asigna desde cada elemento.</p> : (
              <ul className="divide-y divide-borde">
                {de.map((r) => (
                  <li key={r.id}><button onClick={() => abrirElemento(r.id)} className="w-full text-left flex gap-3 px-4 py-2 text-sm hover:bg-superficie-2">
                    <span className={`text-[10px] uppercase tracking-wider w-24 ${r.tipo === "bug" ? "text-mal" : "text-texto-tenue"}`}>{TIPO_ROADMAP[r.tipo]}</span>
                    <span className="flex-1">{r.titulo}</span><span className="text-[11px] text-texto-suave">{ESTADO_ROADMAP[r.estado]}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
      {nueva && (
        <Modal open onClose={() => setNueva(null)} ancho="max-w-sm">
          <div className="p-5 space-y-3">
            <h3 className="f-d text-xl">Nueva versión</h3>
            <L t="Nombre *"><input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="1.4" autoFocus className={`${inputCls} f-m`} /></L>
            <L t="Qué trae"><input value={nueva.objetivo} onChange={(e) => setNueva({ ...nueva, objetivo: e.target.value })} className={inputCls} /></L>
            <L t="Para cuándo"><input type="date" value={nueva.fechaObjetivo} onChange={(e) => setNueva({ ...nueva, fechaObjetivo: e.target.value })} className={inputCls} /></L>
            <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={() => setNueva(null)}>Cancelar</Boton><Boton onClick={crear}>Crear</Boton></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
