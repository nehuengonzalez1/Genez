/* ============================================================
   GENEZ FOUNDER · objetivos y plan comercial
   ============================================================

   Cada objetivo compara lo real contra la meta. Lo real lo calcula la
   base con los registros (0117); la única excepción es la métrica
   manual, que se muestra como "carga manual" para que nadie la confunda
   con un dato medido. No hay porcentajes estimados.

   El plan de 30 días se arma en un paso: la meta del período (las
   ventas) y, por semana, los ritmos que la sostienen (prospectos,
   contactos, demos, propuestas). Lo que no se completa no se inventa:
   un ritmo vacío no genera metas.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { cargarObjetivos, guardarObjetivo, tareasDeObjetivo, cargarPlanes, crearPlan30, METRICA, PERIODO } from "../datos/internoMarketing.js";
import { guardarTarea } from "../datos/internoCrm.js";
import { useConfig, hoyAR, relativo, vencido, ESTADO_TAREA } from "./util.js";
import { FormTarea } from "./Formularios.jsx";

const L = ({ t, children, className = "" }) => <label className={className}><span className="block text-xs text-texto-suave">{t}</span>{children}</label>;
const diaCorto = (dia) => (dia ? String(dia).slice(0, 10).split("-").reverse().slice(0, 2).join("/") : "");
const dias = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
const sumar = (dia, n) => { const x = new Date(`${dia}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const cifra = (o, v) => (v == null ? "—" : METRICA[o.metrica] && METRICA[o.metrica].plata ? money(Math.round(v)) : Number(v).toLocaleString("es-AR"));

/* Cómo va: con los datos, sin estimar. */
export function situacion(o, hoy = hoyAR()) {
  const cumplido = o.valorActual != null && o.valorActual >= o.valorObjetivo;
  if (o.estado !== "activo") return { t: o.estado === "pausado" ? "Pausado" : "Cancelado", tono: "text-texto-tenue" };
  if (cumplido) return { t: "Cumplido", tono: "text-bien" };
  if (hoy > o.limite) return { t: "Venció sin cumplirse", tono: "text-mal" };
  if (hoy < o.inicio) return { t: `Empieza ${diaCorto(o.inicio)}`, tono: "text-texto-tenue" };
  const quedan = dias(hoy, o.limite);
  if (quedan <= 3) return { t: quedan === 0 ? "Vence hoy" : `Vence en ${quedan} ${quedan === 1 ? "día" : "días"}`, tono: "text-ojo", alerta: true };
  return { t: `Quedan ${quedan} días`, tono: "text-texto-tenue" };
}

function Barra({ o }) {
  const pct = o.valorActual == null ? 0 : Math.min(100, (o.valorActual / o.valorObjetivo) * 100);
  return (
    <span className="flex items-center gap-2 min-w-[9rem]">
      <span className="flex-1 h-1.5 rounded bg-superficie-2 overflow-hidden"><span className={`block h-full ${pct >= 100 ? "bg-bien" : "bg-acento"}`} style={{ width: `${pct}%` }} /></span>
      <span className="f-m text-[11px] whitespace-nowrap">{cifra(o, o.valorActual)} / {cifra(o, o.valorObjetivo)}</span>
    </span>
  );
}

export function Objetivos({ toast }) {
  const { de } = useConfig();
  const [objs, setObjs] = useState(null);
  const [planes, setPlanes] = useState([]);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("activos");
  const [abierto, setAbierto] = useState(null);
  const [modal, setModal] = useState(null);
  const leer = () => Promise.all([cargarObjetivos(), cargarPlanes()]).then(([o, p]) => { setObjs(o); setPlanes(p); }).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);
  const hoy = hoyAR();

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!objs) return <Card><Cargando /></Card>;
  const terminado = (o) => hoy > o.limite || o.estado === "cancelado";
  const visibles = objs.filter((o) => (vista === "activos" ? !terminado(o) : terminado(o)));
  const sueltos = visibles.filter((o) => !o.planId);
  const planesVivos = planes.filter((p) => visibles.some((o) => o.planId === p.id));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-d text-3xl">Objetivos</h1>
          <p className="text-sm text-texto-suave mt-1">Lo real contra la meta. Lo medido sale de los registros; lo manual dice que es manual.</p>
        </div>
        <div className="flex gap-2">
          <Boton variant="ghost" onClick={() => setModal({ tipo: "plan" })}>Plan de 30 días</Boton>
          <Boton onClick={() => setModal({ tipo: "objetivo" })}><Plus size={14} /> Objetivo</Boton>
        </div>
      </header>
      <Tabs value={vista} onChange={setVista} items={[{ k: "activos", n: "En curso" }, { k: "terminados", n: "Terminados" }]} />

      {objs.length === 0 ? (
        <Card><Vacio>Sin objetivos. El plan de 30 días arma la meta de clientes y los ritmos de cada semana; o sumá un objetivo suelto.</Vacio></Card>
      ) : visibles.length === 0 ? <Card><Vacio>{vista === "activos" ? "Nada en curso." : "Nada terminado todavía."}</Vacio></Card> : (
        <>
          {planesVivos.map((p) => {
            const deEste = visibles.filter((o) => o.planId === p.id);
            const principal = deEste.filter((o) => !o.semana);
            const semanas = [...new Set(deEste.filter((o) => o.semana).map((o) => o.semana))].sort();
            const semanaHoy = hoy >= p.inicio && hoy <= p.fin ? Math.floor(dias(p.inicio, hoy) / 7) + 1 : null;
            return (
              <Card key={p.id} className="overflow-hidden">
                <div className="px-4 py-3 border-b border-borde flex flex-wrap items-baseline gap-3">
                  <h2 className="f-d text-lg flex-1">{p.nombre}</h2>
                  <span className="text-[11px] text-texto-tenue">{diaCorto(p.inicio)} al {diaCorto(p.fin)}{semanaHoy ? ` · semana ${semanaHoy}` : ""}</span>
                </div>
                <ul className="divide-y divide-borde">
                  {principal.map((o) => <Fila key={o.id} o={o} hoy={hoy} abierto={abierto} setAbierto={setAbierto} toast={toast} leer={leer} setModal={setModal} />)}
                  {semanas.map((n) => (
                    <React.Fragment key={n}>
                      <li className={`px-4 pt-3 pb-1 text-[11px] uppercase tracking-widest font-bold ${n === semanaHoy ? "text-acento" : "text-texto-tenue"}`}>Semana {n}{n === semanaHoy ? " · esta" : ""}</li>
                      {deEste.filter((o) => o.semana === n).map((o) => <Fila key={o.id} o={o} hoy={hoy} abierto={abierto} setAbierto={setAbierto} toast={toast} leer={leer} setModal={setModal} />)}
                    </React.Fragment>
                  ))}
                </ul>
              </Card>
            );
          })}
          {sueltos.length > 0 && (
            <Card className="overflow-hidden">
              {planesVivos.length > 0 && <h2 className="f-d text-lg px-4 pt-3 pb-1">Otros objetivos</h2>}
              <ul className="divide-y divide-borde">{sueltos.map((o) => <Fila key={o.id} o={o} hoy={hoy} abierto={abierto} setAbierto={setAbierto} toast={toast} leer={leer} setModal={setModal} />)}</ul>
            </Card>
          )}
        </>
      )}

      {modal && modal.tipo === "objetivo" && <FormObjetivo inicial={modal.datos} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />}
      {modal && modal.tipo === "plan" && <FormPlan toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />}
      {modal && modal.tipo === "tarea" && <FormTarea categorias={de("categoria_tarea")} inicial={modal.datos} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); setAbierto(null); leer(); }} />}
    </div>
  );
}

/* Afuera de Objetivos: adentro se volvía a crear en cada render, y el
   detalle abierto (con su campo de carga manual) se reiniciaba. */
function Fila({ o, hoy, abierto, setAbierto, toast, leer, setModal }) {
  const s = situacion(o, hoy);
  return (
    <li>
      <button onClick={() => setAbierto(abierto === o.id ? null : o.id)} className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm hover:bg-superficie-2">
        {abierto === o.id ? <ChevronDown size={14} className="text-texto-tenue" /> : <ChevronRight size={14} className="text-texto-tenue" />}
        <span className="flex-1 min-w-[10rem]">
          <span className="block">{o.nombre}</span>
          <span className="block text-[11px] text-texto-tenue">
            {METRICA[o.metrica].n}{o.metrica === "manual" ? "" : " · medido"} · {diaCorto(o.inicio)} al {diaCorto(o.limite)}
          </span>
        </span>
        <Barra o={o} />
        {o.metrica === "manual" && <span className="text-[10px] uppercase tracking-wider text-ojo">carga manual</span>}
        <span className={`text-[11px] w-32 text-right ${s.tono}`}>{s.t}</span>
      </button>
      {abierto === o.id && <DetalleObjetivo o={o} toast={toast} leer={leer} setModal={setModal} />}
    </li>
  );
}

function DetalleObjetivo({ o, toast, leer, setModal }) {
  const [tareas, setTareas] = useState(null);
  const [manual, setManual] = useState(o.valorManual == null ? "" : String(Number(o.valorManual)));
  const cargar = () => tareasDeObjetivo(o.id).then(setTareas).catch(() => setTareas([]));
  useEffect(() => { cargar(); }, [o.id]);
  const cambiar = async (c, aviso) => { try { await guardarObjetivo({ id: o.id, ...c }); if (aviso) toast(aviso); leer(); } catch (e) { toast(e.message, "mal"); } };
  return (
    <div className="px-4 pb-4 pl-10 space-y-3 bg-superficie-2/40">
      {o.descripcion && <p className="text-sm text-texto-suave pt-2">{o.descripcion}</p>}
      <div className="flex flex-wrap items-end gap-3 pt-2">
        {o.metrica === "manual" && (
          <L t="Valor actual (carga manual)">
            <span className="flex gap-2">
              <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="decimal" className={`${inputCls} f-m w-32`} />
              <Boton size="sm" onClick={() => (manual === "" || Number(manual) >= 0 ? cambiar({ valorManual: manual === "" ? null : Number(manual) }, "Actualizado.") : toast("Tiene que ser un número.", "mal"))}>Guardar</Boton>
            </span>
          </L>
        )}
        <L t="Estado">
          <select value={o.estado} onChange={(e) => cambiar({ estado: e.target.value })} className={inputCls}>
            <option value="activo">Activo</option><option value="pausado">Pausado</option><option value="cancelado">Cancelado</option>
          </select>
        </L>
        <Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "objetivo", datos: o })}>Editar</Boton>
        <Boton size="sm" variant="quiet" onClick={() => { if (window.confirm("¿Archivarlo? Sale de la lista; no se borra.")) cambiar({ archivadoEn: new Date() }, "Archivado."); }}>Archivar</Boton>
      </div>
      <div>
        <h3 className="text-[11px] uppercase tracking-widest font-bold text-texto-tenue mb-1">Tareas para llegar</h3>
        {!tareas ? <p className="text-sm text-texto-tenue">…</p> : tareas.length === 0 ? <p className="text-sm text-texto-tenue">Ninguna.</p> : (
          <ul className="space-y-1">
            {tareas.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="Completar" className="accent-acento" checked={t.estado === "completada"} onChange={async () => {
                  try { await guardarTarea({ id: t.id, estado: t.estado === "completada" ? "pendiente" : "completada" }); cargar(); leer(); } catch (e) { toast(e.message, "mal"); }
                }} />
                <span className={`flex-1 ${t.estado === "completada" ? "line-through text-texto-tenue" : ""}`}>{t.titulo}</span>
                <span className="text-[11px] text-texto-tenue">{ESTADO_TAREA[t.estado]}</span>
                {t.vence && <span className={`text-[11px] ${t.estado !== "completada" && vencido(t.vence) ? "text-mal" : "text-texto-tenue"}`}>{relativo(t.vence)}</span>}
              </li>
            ))}
          </ul>
        )}
        <Boton size="sm" variant="ghost" className="mt-2" onClick={() => setModal({ tipo: "tarea", datos: { objetivoId: o.id, categoria: "comercial", titulo: "" } })}><Plus size={13} /> Tarea</Boton>
      </div>
    </div>
  );
}

/* Las fechas del período que se elige, para no escribirlas a mano. */
function fechasDe(periodo, hoy = hoyAR()) {
  const d = new Date(`${hoy}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  const [a, m] = hoy.split("-").map(Number);
  const finDeMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  if (periodo === "diario") return [hoy, hoy];
  if (periodo === "semanal") return [sumar(hoy, -dow), sumar(hoy, 6 - dow)];
  if (periodo === "mensual") return [`${hoy.slice(0, 8)}01`, finDeMes(a, m)];
  if (periodo === "trimestral") { const q = Math.floor((m - 1) / 3) * 3 + 1; return [`${a}-${String(q).padStart(2, "0")}-01`, finDeMes(a, q + 2)]; }
  if (periodo === "anual") return [`${a}-01-01`, `${a}-12-31`];
  return null;
}

function FormObjetivo({ inicial, onCerrar, onListo, toast }) {
  const [a, b] = fechasDe("mensual");
  const [d, setD] = useState(inicial ? { ...inicial, valorObjetivo: String(inicial.valorObjetivo), valorManual: inicial.valorManual == null ? "" : String(Number(inicial.valorManual)) }
    : { nombre: "", descripcion: "", metrica: "ventas", valorObjetivo: "", valorManual: "", periodo: "mensual", inicio: a, limite: b });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const periodo = (p) => { const f = fechasDe(p); setD({ ...d, periodo: p, ...(f ? { inicio: f[0], limite: f[1] } : {}) }); };
  const guardar = async () => {
    if (!d.nombre.trim()) return toast("Poné el nombre.", "mal");
    if (!(Number(d.valorObjetivo) > 0)) return toast("La meta tiene que ser un número mayor que cero.", "mal");
    if (d.limite < d.inicio) return toast("La fecha límite no puede ser antes del inicio.", "mal");
    try {
      await guardarObjetivo({ ...d, nombre: d.nombre.trim(), valorObjetivo: Number(d.valorObjetivo),
        valorManual: d.metrica === "manual" && d.valorManual !== "" ? Number(d.valorManual) : null });
      toast(inicial ? "Guardado." : "Objetivo creado.");
      onListo();
    } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">{inicial ? "Editar objetivo" : "Nuevo objetivo"}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <L t="Nombre *" className="sm:col-span-2"><input value={d.nombre} onChange={set("nombre")} autoFocus placeholder="Ej: 10 clientes pagos" className={inputCls} /></L>
          <L t="Qué se mide">
            <select value={d.metrica} onChange={set("metrica")} className={inputCls}>{Object.entries(METRICA).map(([k, x]) => <option key={k} value={k}>{x.n}</option>)}</select>
          </L>
          <L t={`Meta${METRICA[d.metrica].u ? ` (${METRICA[d.metrica].u})` : ""} *`}><input value={d.valorObjetivo} onChange={set("valorObjetivo")} inputMode="decimal" className={`${inputCls} f-m`} /></L>
          {d.metrica === "manual" && <L t="Valor actual (carga manual)"><input value={d.valorManual} onChange={set("valorManual")} inputMode="decimal" className={`${inputCls} f-m`} /></L>}
          <L t="Período"><select value={d.periodo} onChange={(e) => periodo(e.target.value)} className={inputCls}>{Object.entries(PERIODO).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
          <L t="Desde"><input type="date" value={d.inicio} onChange={set("inicio")} className={inputCls} /></L>
          <L t="Hasta"><input type="date" value={d.limite} onChange={set("limite")} className={inputCls} /></L>
          <L t="Descripción" className="sm:col-span-2"><textarea value={d.descripcion || ""} onChange={set("descripcion")} rows={2} className={inputCls} /></L>
        </div>
        {d.metrica !== "manual" && <p className="text-[11px] text-texto-tenue">El avance lo calcula la base con los registros de esas fechas; no se carga a mano.</p>}
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></div>
      </div>
    </Modal>
  );
}

function FormPlan({ onCerrar, onListo, toast }) {
  const [d, setD] = useState({ nombre: "Plan de 30 días", inicio: hoyAR(), ventas: "10", prospectos: "", contactos: "", demos: "", propuestas: "", descripcion: "" });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    if (!d.nombre.trim()) return toast("Poné un nombre.", "mal");
    if (!(Number(d.ventas) > 0)) return toast("¿Cuántos clientes en 30 días?", "mal");
    for (const k of ["prospectos", "contactos", "demos", "propuestas"]) if (d[k] !== "" && !(Number(d[k]) >= 0)) return toast("Los ritmos tienen que ser números.", "mal");
    setGuardando(true);
    try { await crearPlan30({ ...d, nombre: d.nombre.trim() }); toast("Plan creado, con sus metas por semana."); onListo(); }
    catch (e) { toast(e.message, "mal"); setGuardando(false); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">Plan de 30 días</h3>
        <p className="text-sm text-texto-suave">La meta del período son las ventas. Los ritmos son por semana: lo que hay que hacer cada semana para llegar. Uno que dejes vacío no se mide.</p>
        <div className="grid grid-cols-2 gap-3">
          <L t="Nombre" className="col-span-2"><input value={d.nombre} onChange={set("nombre")} className={inputCls} /></L>
          <L t="Empieza"><input type="date" value={d.inicio} onChange={set("inicio")} className={inputCls} /></L>
          <L t="Clientes en 30 días *"><input value={d.ventas} onChange={set("ventas")} inputMode="numeric" className={`${inputCls} f-m`} /></L>
          <L t="Prospectos nuevos por semana"><input value={d.prospectos} onChange={set("prospectos")} inputMode="numeric" className={`${inputCls} f-m`} /></L>
          <L t="Contactos por semana"><input value={d.contactos} onChange={set("contactos")} inputMode="numeric" className={`${inputCls} f-m`} /></L>
          <L t="Demos por semana"><input value={d.demos} onChange={set("demos")} inputMode="numeric" className={`${inputCls} f-m`} /></L>
          <L t="Propuestas por semana"><input value={d.propuestas} onChange={set("propuestas")} inputMode="numeric" className={`${inputCls} f-m`} /></L>
        </div>
        <p className="text-[11px] text-texto-tenue">Termina el {diaCorto(sumar(d.inicio, 29))}. Las actividades de cada semana se suman como tareas desde cada meta.</p>
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar} disabled={guardando}>{guardando ? "Creando…" : "Crear el plan"}</Boton></div>
      </div>
    </Modal>
  );
}
