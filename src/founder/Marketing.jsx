/* ============================================================
   GENEZ FOUNDER · marketing y contenido
   ============================================================

   Un solo recorrido: una idea del banco se planifica, se escribe, se
   graba, se edita, se publica y se mide. El calendario ubica cada
   contenido en su fecha (la de publicación si ya salió, si no la
   objetivo); el tablero muestra en qué paso está cada uno.

   Las métricas se cargan a mano (7 y 30 días): no hay integración con
   ninguna red, y la pantalla lo dice. Lo que sí sale de los registros
   es lo que originó cada contenido: los prospectos que vinieron de ahí,
   sus demos y los que terminaron siendo clientes.
   ============================================================ */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Search, ExternalLink } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarContenidos, cargarContenido, guardarContenido, guardarMetrica, origenDeProspecto, cargarGrabaciones, guardarGrabacion,
  ESTADO_CONTENIDO, ESTADO_GRABACION, METRICAS_CONTENIDO } from "../datos/internoMarketing.js";
import { cargarProspectos, guardarTarea } from "../datos/internoCrm.js";
import { useConfig, hoyAR, diaAR, fechaHora, aInput, deInput, PRIORIDAD, ESTADO_TAREA } from "./util.js";
import { FormTarea } from "./Formularios.jsx";
import { Adjuntos } from "./Adjuntos.jsx";

const L = ({ t, children, className = "" }) => <label className={className}><span className="block text-xs text-texto-suave">{t}</span>{children}</label>;
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const diaCorto = (dia) => (dia ? String(dia).slice(0, 10).split("-").reverse().join("/") : "");
const EN_PRODUCCION = ["planificado", "guion", "grabacion", "edicion", "revision", "programado", "publicado", "medicion"];
const TONO = { idea: "text-texto-tenue", publicado: "text-bien", medicion: "text-bien", descartado: "text-texto-tenue line-through", programado: "text-acento" };
/* El día en que cae en el calendario: el publicado si salió, si no el objetivo. */
const diaDe = (c) => (c.publicadoEn ? diaAR(c.publicadoEn) : c.fechaObjetivo || null);
const Largo = ({ t, valor, onGuardar, filas = 3, className = "", placeholder }) => (
  <L t={t} className={className}>
    <textarea key={valor || ""} defaultValue={valor || ""} rows={filas} placeholder={placeholder} className={inputCls}
      onBlur={(e) => e.target.value !== (valor || "") && onGuardar(e.target.value)} />
  </L>
);

export function Marketing({ abrirContenido, toast }) {
  const { cfg, de, nombre } = useConfig();
  const [pestana, setPestana] = useState("ideas");
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState(null);
  const leer = () => cargarContenidos().then(setLista).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="f-d text-3xl">Marketing</h1>
        {pestana !== "grabaciones" && <Boton onClick={() => setNuevo({ estado: pestana === "ideas" ? "idea" : "planificado" })}><Plus size={14} /> {pestana === "ideas" ? "Idea" : "Contenido"}</Boton>}
      </header>
      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "ideas", n: "Banco de ideas", badge: lista ? lista.filter((c) => c.estado === "idea").length || null : null },
        { k: "calendario", n: "Calendario" }, { k: "tablero", n: "Tablero" }, { k: "metricas", n: "Resultados" }, { k: "grabaciones", n: "Grabaciones" },
      ]} />
      {!lista || !cfg ? <Card><Cargando /></Card> : (
        <>
          {pestana === "ideas" && <Ideas lista={lista} abrir={abrirContenido} nombre={nombre} de={de} toast={toast} leer={leer} />}
          {pestana === "calendario" && <Calendario lista={lista} abrir={abrirContenido} nombre={nombre} />}
          {pestana === "tablero" && <Tablero lista={lista} abrir={abrirContenido} nombre={nombre} toast={toast} leer={leer} setLista={setLista} />}
          {pestana === "metricas" && <Resultados lista={lista} abrir={abrirContenido} nombre={nombre} />}
          {pestana === "grabaciones" && <Grabaciones contenidos={lista} abrir={abrirContenido} toast={toast} />}
        </>
      )}
      {nuevo && <NuevoContenido inicial={nuevo} de={de} toast={toast} onCerrar={() => setNuevo(null)} onListo={(id) => { setNuevo(null); leer(); abrirContenido(id); }} />}
    </div>
  );
}

function NuevoContenido({ inicial, de, onCerrar, onListo, toast }) {
  const [d, setD] = useState({ titulo: "", canal: "", formato: "", gancho: "", cta: "", fechaObjetivo: "", prioridad: "normal", ...inicial });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    if (!d.titulo.trim()) return toast("Poné de qué se trata.", "mal");
    try { const r = await guardarContenido({ ...d, titulo: d.titulo.trim(), fechaObjetivo: d.fechaObjetivo || null }); onListo(r.id); } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">{d.estado === "idea" ? "Una idea" : "Un contenido"}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <L t="De qué se trata *" className="sm:col-span-2"><input value={d.titulo} onChange={set("titulo")} autoFocus placeholder="Ej: cerrar la caja en dos minutos" className={inputCls} /></L>
          <L t="Canal"><select value={d.canal} onChange={set("canal")} className={inputCls}><option value="">—</option>{de("canal_contenido").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select></L>
          <L t="Formato"><select value={d.formato} onChange={set("formato")} className={inputCls}><option value="">—</option>{de("formato_contenido").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select></L>
          <L t="Gancho" className="sm:col-span-2"><input value={d.gancho} onChange={set("gancho")} placeholder="La primera frase, la que hace que se quede" className={inputCls} /></L>
          <L t="Llamado a la acción"><input value={d.cta} onChange={set("cta")} placeholder="Ej: pedí una demo" className={inputCls} /></L>
          {d.estado !== "idea" && <L t="Para cuándo"><input type="date" value={d.fechaObjetivo} onChange={set("fechaObjetivo")} className={inputCls} /></L>}
        </div>
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Crear</Boton></div>
      </div>
    </Modal>
  );
}

/* ---------- Banco de ideas ---------- */
function Ideas({ lista, abrir, nombre, de, toast, leer }) {
  const [q, setQ] = useState("");
  const [canal, setCanal] = useState("");
  const PESO = { urgente: 0, alta: 1, normal: 2, baja: 3 };
  const ideas = lista.filter((c) => c.estado === "idea" && (!canal || c.canal === canal)
    && (!q.trim() || norm(`${c.titulo} ${c.gancho} ${c.problema}`).includes(norm(q)))).sort((a, b) => PESO[a.prioridad] - PESO[b.prioridad]);
  const planificar = async (c) => { try { await guardarContenido({ id: c.id, estado: "planificado" }); toast("Pasó al calendario."); leer(); } catch (e) { toast(e.message, "mal"); } };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[12rem]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ideas" className={`${inputCls} pl-9 mt-0`} /></div>
        <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`${inputCls} mt-0 w-auto`}><option value="">Todos los canales</option>{de("canal_contenido").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select>
      </div>
      {ideas.length === 0 ? <Card><Vacio>{lista.some((c) => c.estado === "idea") ? "Ninguna coincide." : "El banco está vacío. Anotá acá cada idea apenas aparece: un problema que viste en un comercio, una pregunta de un cliente."}</Vacio></Card> : (
        <div className="grid md:grid-cols-2 gap-3">
          {ideas.map((c) => (
            <Card key={c.id} className="p-4 space-y-1.5">
              <button onClick={() => abrir(c.id)} className="text-left w-full">
                <span className="font-medium">{c.titulo}</span>
                {c.gancho && <span className="block text-sm text-texto-suave mt-0.5">“{c.gancho}”</span>}
              </button>
              <p className="text-[11px] text-texto-tenue">
                {[c.canal && nombre("canal_contenido", c.canal), c.formato && nombre("formato_contenido", c.formato), c.rubro && nombre("rubro", c.rubro), c.prioridad !== "normal" && PRIORIDAD[c.prioridad]].filter(Boolean).join(" · ")}
              </p>
              <div className="flex gap-2 pt-1"><Boton size="sm" variant="ghost" onClick={() => planificar(c)}>Planificar</Boton></div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Calendario ---------- */
function Calendario({ lista, abrir, nombre }) {
  const [mes, setMes] = useState(hoyAR().slice(0, 7));
  const [a, m] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const offset = (primero.getUTCDay() + 6) % 7;
  const diasMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  const porDia = useMemo(() => lista.filter((c) => c.estado !== "idea" && c.estado !== "descartado" && diaDe(c))
    .reduce((g, c) => { (g[diaDe(c)] = g[diaDe(c)] || []).push(c); return g; }, {}), [lista]);
  const sinFecha = lista.filter((c) => EN_PRODUCCION.includes(c.estado) && !diaDe(c));
  const mover = (n) => { const d = new Date(Date.UTC(a, m - 1 + n, 1)); setMes(d.toISOString().slice(0, 7)); };
  const hoy = hoyAR();
  const nombreMes = primero.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => mover(-1)} aria-label="Mes anterior" className="p-1.5 rounded-md border border-borde hover:bg-superficie-2"><ChevronLeft size={16} /></button>
        <button onClick={() => mover(1)} aria-label="Mes siguiente" className="p-1.5 rounded-md border border-borde hover:bg-superficie-2"><ChevronRight size={16} /></button>
        <h2 className="f-d text-lg first-letter:uppercase">{nombreMes}</h2>
      </div>
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 text-[11px] text-texto-tenue border-b border-borde">
          {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map((dia, i) => (
            <div key={i} className={`min-h-[5.5rem] border-b border-r border-borde p-1 ${dia === hoy ? "bg-acento-suave/40" : ""}`}>
              {dia && <div className={`text-[11px] f-m ${dia === hoy ? "text-acento font-bold" : "text-texto-tenue"}`}>{Number(dia.slice(8))}</div>}
              {dia && (porDia[dia] || []).map((c) => (
                <button key={c.id} onClick={() => abrir(c.id)} title={c.titulo}
                  className={`block w-full text-left truncate text-[11px] px-1 py-0.5 rounded mt-0.5 ${c.publicadoEn ? "bg-bien-suave text-bien" : "bg-superficie-2"}`}>
                  {c.canal ? `${nombre("canal_contenido", c.canal)} · ` : ""}{c.titulo}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Card>
      {sinFecha.length > 0 && (
        <p className="text-sm text-texto-suave">Sin fecha: {sinFecha.map((c) => <button key={c.id} onClick={() => abrir(c.id)} className="underline hover:text-acento mr-2">{c.titulo}</button>)}</p>
      )}
    </div>
  );
}

/* ---------- Tablero ---------- */
function Tablero({ lista, abrir, nombre, toast, leer, setLista }) {
  const [arrastrando, setArrastrando] = useState(null);
  const mover = async (c, estado) => {
    if (c.estado === estado) return;
    const antes = lista;
    setLista(lista.map((x) => (x.id === c.id ? { ...x, estado } : x)));
    try { await guardarContenido({ id: c.id, estado }); leer(); } catch (e) { setLista(antes); toast(e.message, "mal"); }
  };
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0">
      {EN_PRODUCCION.map((col) => {
        const tarjetas = lista.filter((c) => c.estado === col);
        return (
          <section key={col} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (arrastrando) mover(arrastrando, col); setArrastrando(null); }}
            className={`w-56 shrink-0 rounded-lg border border-borde bg-superficie flex-col max-h-[70vh] ${tarjetas.length ? "flex" : "hidden md:flex"}`}>
            <div className="px-3 py-2.5 border-b border-borde flex justify-between"><h2 className="text-sm font-semibold">{ESTADO_CONTENIDO[col]}</h2><span className="f-m text-xs text-texto-tenue">{tarjetas.length}</span></div>
            <div className="p-2 space-y-2 overflow-y-auto">
              {tarjetas.map((c) => (
                <article key={c.id} draggable onDragStart={() => setArrastrando(c)} onDragEnd={() => setArrastrando(null)} className="rounded-md border border-borde bg-superficie-2 p-2.5 cursor-grab">
                  <button onClick={() => abrir(c.id)} className="text-left w-full text-sm font-medium leading-snug">{c.titulo}</button>
                  <p className="text-[11px] text-texto-tenue mt-1">{[c.canal && nombre("canal_contenido", c.canal), c.formato && nombre("formato_contenido", c.formato), c.fechaObjetivo && diaCorto(c.fechaObjetivo)].filter(Boolean).join(" · ")}</p>
                  <select value={c.estado} onChange={(e) => mover(c, e.target.value)} aria-label="Mover a otro paso" className="mt-2 w-full text-[11px] bg-transparent border border-borde rounded px-1.5 py-1 text-texto-suave md:hidden">
                    {Object.entries(ESTADO_CONTENIDO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                </article>
              ))}
              {tarjetas.length === 0 && <p className="text-[11px] text-texto-tenue text-center py-4">Soltá uno acá</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ---------- Resultados ---------- */
function Resultados({ lista, abrir, nombre }) {
  const publicados = lista.filter((c) => c.publicadoEn).sort((a, b) => b.publicadoEn - a.publicadoEn);
  const n = (v) => (v == null ? "—" : Number(v).toLocaleString("es-AR"));
  const total = (k) => publicados.reduce((s, c) => s + (c[k] || 0), 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-texto-suave">
        Las métricas se cargan a mano en cada contenido, a los 7 y a los 30 días: Founder no está conectado a ninguna red. Prospectos, demos y clientes salen de los registros: son los que dicen que vinieron de ese contenido.
      </p>
      {publicados.length === 0 ? <Card><Vacio>Nada publicado todavía.</Vacio></Card> : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
              <tr><th className="text-left p-3">Contenido</th><th className="p-3 text-right">Vis. 7 d</th><th className="p-3 text-right">Vis. 30 d</th><th className="p-3 text-right">Consultas</th>
                <th className="p-3 text-right">Prospectos</th><th className="p-3 text-right">Demos</th><th className="p-3 text-right">Clientes</th></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {publicados.map((c) => (
                <tr key={c.id} onClick={() => abrir(c.id)} className="cursor-pointer hover:bg-superficie-2">
                  <td className="p-3"><span className="block">{c.titulo}</span><span className="text-[11px] text-texto-tenue">{[c.canal && nombre("canal_contenido", c.canal), fechaHora(c.publicadoEn)].filter(Boolean).join(" · ")}</span></td>
                  <td className="p-3 text-right f-m">{n(c.visSemana)}</td><td className="p-3 text-right f-m">{n(c.visMes)}</td>
                  <td className="p-3 text-right f-m">{c.consultasMes != null ? n(c.consultasMes) : n(c.consultasSemana)}</td>
                  <td className="p-3 text-right f-m">{c.prospectosOriginados || "—"}</td><td className="p-3 text-right f-m">{c.demosOriginadas || "—"}</td>
                  <td className={`p-3 text-right f-m ${c.clientesOriginados ? "text-bien" : ""}`}>{c.clientesOriginados || "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-borde text-texto-suave"><tr>
              <td className="p-3 text-[11px] uppercase tracking-wider">{publicados.length} publicados</td><td /><td /><td />
              <td className="p-3 text-right f-m">{total("prospectosOriginados")}</td><td className="p-3 text-right f-m">{total("demosOriginadas")}</td><td className="p-3 text-right f-m">{total("clientesOriginados")}</td>
            </tr></tfoot>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ---------- Grabaciones ---------- */
function Grabaciones({ contenidos, abrir, toast }) {
  const [lista, setLista] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [error, setError] = useState("");
  const leer = () => cargarGrabaciones().then(setLista).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);
  if (error) return <Card><ErrorEstado>{error}</ErrorEstado></Card>;
  if (!lista) return <Card><Cargando /></Card>;
  const cambiar = async (g, c) => { try { await guardarGrabacion({ id: g.id, ...c }); leer(); } catch (e) { toast(e.message, "mal"); } };
  const nueva = async () => {
    const tema = window.prompt("¿Qué se graba?");
    if (!tema || !tema.trim()) return;
    try { const r = await guardarGrabacion({ tema: tema.trim() }); await leer(); setAbierta(r.id); } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Boton onClick={nueva}><Plus size={14} /> Grabación</Boton></div>
      {lista.length === 0 ? <Card><Vacio>Sin grabaciones planificadas. Una grabación junta varios contenidos: se arma el guion, las escenas y lo que hay que llevar.</Vacio></Card> : lista.map((g) => {
        const salen = contenidos.filter((c) => c.grabacionId === g.id);
        return (
          <Card key={g.id} className="overflow-hidden">
            <button onClick={() => setAbierta(abierta === g.id ? null : g.id)} className="w-full text-left flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-superficie-2">
              <span className="flex-1 font-medium">{g.tema}</span>
              <span className="text-[11px] text-texto-tenue">{g.fecha ? fechaHora(g.fecha) : "sin fecha"}</span>
              <span className="text-[11px] text-texto-tenue">{salen.length} {salen.length === 1 ? "publicación" : "publicaciones"}</span>
              <span className="text-[11px] text-texto-suave">{ESTADO_GRABACION[g.estado]}</span>
            </button>
            {abierta === g.id && (
              <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3 border-t border-borde pt-3">
                <L t="Cuándo"><input type="datetime-local" defaultValue={g.fecha ? aInput(g.fecha) : ""} onBlur={(e) => cambiar(g, { fecha: deInput(e.target.value) })} className={inputCls} /></L>
                <L t="Estado"><select value={g.estado} onChange={(e) => cambiar(g, { estado: e.target.value })} className={inputCls}>{Object.entries(ESTADO_GRABACION).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
                <Largo t="Guion" valor={g.guion} filas={4} onGuardar={(v) => cambiar(g, { guion: v })} className="sm:col-span-2" />
                <Largo t="Escenas" valor={g.escenas} onGuardar={(v) => cambiar(g, { escenas: v })} />
                <Largo t="Recursos necesarios" valor={g.recursos} onGuardar={(v) => cambiar(g, { recursos: v })} />
                <Largo t="Equipamiento" valor={g.equipamiento} filas={2} onGuardar={(v) => cambiar(g, { equipamiento: v })} />
                <Largo t="Notas" valor={g.notas} filas={2} onGuardar={(v) => cambiar(g, { notas: v })} />
                <div className="sm:col-span-2 text-sm">
                  <span className="text-xs text-texto-suave">Publicaciones que salen de acá: </span>
                  {salen.length === 0 ? <span className="text-texto-tenue">ninguna todavía (se elige la grabación desde cada contenido)</span>
                    : salen.map((c) => <button key={c.id} onClick={() => abrir(c.id)} className="underline hover:text-acento mr-2">{c.titulo}</button>)}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- La ficha de un contenido ---------- */
export function FichaContenido({ id, volver, abrirProspecto, toast }) {
  const { cfg, de } = useConfig();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [grabaciones, setGrabaciones] = useState([]);
  const [prospectos, setProspectos] = useState(null);
  const [modal, setModal] = useState(null);
  const leer = useCallback(() => cargarContenido(id).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => {
    leer();
    cargarGrabaciones().then(setGrabaciones).catch(() => {});
    /* Sin el área de crm no hay prospectos para atar: la sección no aparece. */
    cargarProspectos().then(setProspectos).catch(() => setProspectos(null));
  }, [leer]);
  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!d || !cfg) return <Card><Cargando /></Card>;
  const c = d.contenido;
  const cambiar = async (cambios, aviso) => { try { await guardarContenido({ id: c.id, ...cambios }); if (aviso) toast(aviso); leer(); } catch (e) { toast(e.message, "mal"); } };
  const sel = (k, t, ops) => (
    <L t={t}><select value={c[k] || ""} onChange={(e) => cambiar({ [k]: e.target.value || null })} className={inputCls}><option value="">—</option>{ops.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></L>
  );

  return (
    <div className="space-y-4">
      <button onClick={volver} className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto"><ChevronLeft size={16} /> Volver</button>
      <Card className="p-5 space-y-4">
        <div>
          <span className={`text-[11px] uppercase tracking-wider ${TONO[c.estado] || "text-texto-tenue"}`}>{ESTADO_CONTENIDO[c.estado]}{c.publicadoEn ? ` · ${fechaHora(c.publicadoEn)}` : ""}</span>
          <input key={c.titulo} defaultValue={c.titulo} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.titulo && cambiar({ titulo: e.target.value.trim() })}
            className="block w-full f-d text-2xl bg-transparent outline-none border-b border-transparent focus:border-acento" aria-label="Título" />
          {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-acento mt-1">Ver publicado <ExternalLink size={12} /></a>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <L t="Estado"><select value={c.estado} onChange={(e) => cambiar({ estado: e.target.value })} className={inputCls}>{Object.entries(ESTADO_CONTENIDO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
          {sel("canal", "Canal", de("canal_contenido").map((x) => [x.clave, x.nombre]))}
          {sel("formato", "Formato", de("formato_contenido").map((x) => [x.clave, x.nombre]))}
          <L t="Prioridad"><select value={c.prioridad} onChange={(e) => cambiar({ prioridad: e.target.value })} className={inputCls}>{Object.entries(PRIORIDAD).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
          <L t="Para cuándo"><input type="date" value={c.fechaObjetivo || ""} onChange={(e) => cambiar({ fechaObjetivo: e.target.value || null })} className={inputCls} /></L>
          {sel("rubro", "Rubro", de("rubro").map((x) => [x.clave, x.nombre]))}
          {sel("grabacionId", "Sale de la grabación", grabaciones.map((g) => [g.id, g.tema]))}
          <L t="Link publicado"><input key={c.url || ""} defaultValue={c.url || ""} placeholder="https://…" onBlur={(e) => e.target.value.trim() !== (c.url || "") && cambiar({ url: e.target.value.trim() || null })} className={inputCls} /></L>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 grid sm:grid-cols-2 gap-3">
            <Largo t="Gancho" valor={c.gancho} filas={2} onGuardar={(v) => cambiar({ gancho: v })} />
            <Largo t="Llamado a la acción" valor={c.cta} filas={2} onGuardar={(v) => cambiar({ cta: v })} />
            <Largo t="Problema que aborda" valor={c.problema} filas={2} onGuardar={(v) => cambiar({ problema: v })} />
            <Largo t="Qué parte de Genez lo resuelve" valor={c.solucion} filas={2} onGuardar={(v) => cambiar({ solucion: v })} />
            <Largo t="Para quién" valor={c.publico} filas={2} onGuardar={(v) => cambiar({ publico: v })} />
            <Largo t="Recursos" valor={c.recursos} filas={2} onGuardar={(v) => cambiar({ recursos: v })} />
            <Largo t="Guion" valor={c.guion} filas={6} onGuardar={(v) => cambiar({ guion: v })} className="sm:col-span-2" />
            <Largo t="Copy" valor={c.copy} filas={4} onGuardar={(v) => cambiar({ copy: v })} className="sm:col-span-2" />
          </Card>
          <Metricas c={c} metricas={d.metricas} toast={toast} leer={leer} />
        </div>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="f-d text-lg">Lo que originó</h2>
            <p className="text-[11px] text-texto-tenue mb-2">Los prospectos que dicen que vinieron de acá. Sale de los registros, no se carga.</p>
            <p className="text-sm"><span className="f-m">{c.prospectosOriginados}</span> prospectos · <span className="f-m">{c.demosOriginadas}</span> con demo · <span className={`f-m ${c.clientesOriginados ? "text-bien" : ""}`}>{c.clientesOriginados}</span> clientes</p>
            {d.prospectos.length > 0 && (
              <ul className="mt-2 space-y-1">
                {d.prospectos.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <button onClick={() => abrirProspecto(p.id)} className="flex-1 text-left hover:text-acento">{p.nombre}</button>
                    <span className="text-[11px] text-texto-tenue">{p.clienteDesde ? "cliente" : p.etapaNombre}</span>
                    <button onClick={async () => { try { await origenDeProspecto(p.id, null); leer(); } catch (e) { toast(e.message, "mal"); } }} className="text-[11px] text-texto-suave hover:text-texto">Sacar</button>
                  </li>
                ))}
              </ul>
            )}
            {prospectos && (
              <select value="" onChange={async (e) => { if (!e.target.value) return; try { await origenDeProspecto(e.target.value, c.id); toast("Prospecto atado."); leer(); } catch (err) { toast(err.message, "mal"); } }}
                className={`${inputCls} mt-3`} aria-label="Atar un prospecto">
                <option value="">Vino de acá…</option>
                {prospectos.filter((p) => !p.contenidoId).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
          </Card>
          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Tareas</h2>
            {d.tareas.length === 0 ? <p className="px-5 pb-3 text-sm text-texto-tenue">Ninguna.</p> : (
              <ul className="divide-y divide-borde">
                {d.tareas.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-5 py-2 text-sm">
                    <input type="checkbox" aria-label="Completar" className="accent-acento" checked={t.estado === "completada"} onChange={async () => {
                      try { await guardarTarea({ id: t.id, estado: t.estado === "completada" ? "pendiente" : "completada" }); leer(); } catch (e) { toast(e.message, "mal"); }
                    }} />
                    <span className={`flex-1 ${t.estado === "completada" ? "line-through text-texto-tenue" : ""}`}>{t.titulo}</span>
                    <span className="text-[11px] text-texto-tenue">{ESTADO_TAREA[t.estado]}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-2.5 border-t border-borde"><Boton size="sm" variant="ghost" onClick={() => setModal({ contenidoId: c.id, grabacionId: c.grabacionId || null, categoria: "marketing", titulo: "" })}><Plus size={13} /> Tarea</Boton></div>
          </Card>
          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Archivos</h2>
            <Adjuntos area="marketing" tabla="interno_contenidos" filaId={c.id} lista={d.adjuntos} onCambio={leer} toast={toast} />
          </Card>
          <button onClick={() => { if (window.confirm("¿Archivarlo? No se borra.")) cambiar({ archivadoEn: new Date() }, "Archivado.").then(volver); }} className="text-xs text-texto-suave hover:text-texto px-1">Archivar</button>
        </div>
      </div>
      {modal && <FormTarea categorias={de("categoria_tarea")} inicial={modal} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />}
    </div>
  );
}

/* Las dos mediciones, a mano. Vacío es "no se midió", distinto de cero. */
function Metricas({ c, metricas, toast, leer }) {
  const de = (m) => metricas.find((x) => x.momento === m) || { momento: m };
  const [vals, setVals] = useState(() => ({ "7d": de("7d"), "30d": de("30d") }));
  useEffect(() => { setVals({ "7d": de("7d"), "30d": de("30d") }); }, [metricas]);
  const guardar = async (m) => {
    const v = vals[m];
    for (const [k] of METRICAS_CONTENIDO) if (v[k] !== undefined && v[k] !== null && v[k] !== "" && !(Number(v[k]) >= 0)) return toast("Tienen que ser números.", "mal");
    const limpio = { ...v };
    for (const [k] of METRICAS_CONTENIDO) limpio[k] = v[k] === "" || v[k] == null ? null : Number(v[k]);
    try { await guardarMetrica(c.id, limpio); toast("Métricas guardadas."); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  if (!c.publicadoEn) return <Card className="p-5"><h2 className="f-d text-lg">Métricas</h2><p className="text-sm text-texto-tenue mt-1">Se cargan cuando esté publicado.</p></Card>;
  const dias = Math.floor((Date.now() - c.publicadoEn.getTime()) / 86400000);
  return (
    <Card className="p-5 space-y-3">
      <div>
        <h2 className="f-d text-lg">Métricas</h2>
        <p className="text-[11px] text-texto-tenue">Cargadas a mano, mirando cada red: Founder no está conectado a ninguna. Publicado hace {dias} {dias === 1 ? "día" : "días"}.</p>
      </div>
      {["7d", "30d"].map((m) => (
        <div key={m} className="space-y-2">
          <h3 className="text-[11px] uppercase tracking-widest font-bold text-texto-tenue">A los {m === "7d" ? "7" : "30"} días{(m === "7d" ? dias < 7 : dias < 30) ? " · todavía no" : ""}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {METRICAS_CONTENIDO.map(([k, n]) => (
              <L key={k} t={n}><input value={vals[m][k] ?? ""} onChange={(e) => setVals({ ...vals, [m]: { ...vals[m], [k]: e.target.value } })} inputMode="numeric" className={`${inputCls} f-m`} /></L>
            ))}
          </div>
          <Boton size="sm" variant="ghost" onClick={() => guardar(m)}>Guardar los {m === "7d" ? "7" : "30"} días</Boton>
        </div>
      ))}
    </Card>
  );
}
