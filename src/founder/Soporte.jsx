/* ============================================================
   GENEZ FOUNDER · soporte
   ============================================================

   Los tickets de los clientes de Genez. Al escribir uno nuevo aparecen
   los parecidos, para no resolver dos veces lo mismo ni abrir un ticket
   por algo que ya está en curso. Arriba, lo que sirve para decidir en
   qué trabajar: qué está abierto, cuánto se tarda en resolver y qué
   módulos generan más consultas.

   Resolver pide escribir la solución (lo exige la base): es lo que se
   lee la próxima vez que pasa.
   ============================================================ */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, Search, Plus } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { cargarTickets, cargarTicket, guardarTicket, agregarMensaje, ticketsParecidos, cargarClientes, ESTADO_TICKET, GRAVEDAD, abierto } from "../datos/internoClientes.js";
import { guardarTarea } from "../datos/internoCrm.js";
import { useConfig, relativo, fechaHora, PRIORIDAD, ESTADO_TAREA } from "./util.js";
import { Adjuntos } from "./Adjuntos.jsx";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const TONO_PRIORIDAD = { urgente: "text-mal", alta: "text-ojo", normal: "text-texto-tenue", baja: "text-texto-tenue" };
const duracion = (h) => (h == null ? "" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} días`);
const L = ({ t, children, className = "" }) => <label className={className}><span className="block text-xs text-texto-suave">{t}</span>{children}</label>;

export function Soporte({ abrirTicket, toast, nuevoPara }) {
  const { cfg, de, nombre } = useConfig();
  const [tickets, setTickets] = useState(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("abiertos");
  const [q, setQ] = useState("");
  const [modulo, setModulo] = useState("");
  const [nuevo, setNuevo] = useState(nuevoPara !== undefined ? { clienteId: nuevoPara || "" } : null);
  const leer = () => cargarTickets().then(setTickets).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);

  const visibles = useMemo(() => (tickets || []).filter((t) => {
    if (vista === "abiertos" && !abierto(t)) return false;
    if (vista === "esperando" && t.estado !== "esperando_info") return false;
    if (vista === "resueltos" && abierto(t)) return false;
    if (modulo && t.modulo !== modulo) return false;
    const x = norm(q.trim());
    return !x || String(t.numero) === x.replace("#", "") || norm(t.titulo).includes(x) || norm(t.descripcion).includes(x) || norm(t.clienteNombre).includes(x) || norm(t.solucion).includes(x);
  }), [tickets, vista, q, modulo]);

  /* Los números de los últimos 90 días: lo viejo no dice cómo está hoy. */
  const est = useMemo(() => {
    const t90 = (tickets || []).filter((t) => Date.now() - t.creadoEn.getTime() < 90 * 86400000);
    const resueltos = t90.filter((t) => t.horasResolucion != null);
    const porModulo = {};
    for (const t of t90) porModulo[t.modulo || "sin"] = (porModulo[t.modulo || "sin"] || 0) + 1;
    const grupos = {};
    for (const t of t90) { const k = `${t.modulo || "sin"}|${t.categoria || "sin"}`; grupos[k] = (grupos[k] || 0) + 1; }
    return {
      abiertos: (tickets || []).filter(abierto).length,
      promedio: resueltos.length ? resueltos.reduce((s, t) => s + Number(t.horasResolucion), 0) / resueltos.length : null,
      porModulo: Object.entries(porModulo).sort((a, b) => b[1] - a[1]).slice(0, 5),
      repetidos: Object.entries(grupos).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]),
      total: t90.length,
    };
  }, [tickets]);

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!tickets || !cfg) return <Card><Cargando /></Card>;
  const nomModulo = (m) => (m === "sin" ? "Sin módulo" : nombre("modulo", m));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="f-d text-3xl">Soporte</h1>
        <Boton onClick={() => setNuevo({ clienteId: "" })}><Plus size={14} /> Nuevo ticket</Boton>
      </header>

      {tickets.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-3">
          <Card className="p-4"><div className="text-[11px] text-texto-tenue">Abiertos</div><div className="f-d f-m text-2xl mt-1">{est.abiertos}</div></Card>
          <Card className="p-4">
            <div className="text-[11px] text-texto-tenue">Tiempo promedio de resolución</div>
            <div className="f-d f-m text-2xl mt-1">{est.promedio == null ? "—" : duracion(est.promedio)}</div>
            <div className="text-[10px] text-texto-tenue">de lo resuelto en 90 días</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] text-texto-tenue mb-1">Por módulo, 90 días ({est.total})</div>
            {est.porModulo.map(([m, n]) => (
              <button key={m} onClick={() => { setModulo(m === "sin" ? "" : m); setVista("todos"); }} className="w-full flex justify-between text-xs py-0.5 hover:text-acento">
                <span className="truncate">{nomModulo(m)}</span><span className="f-m">{n}</span>
              </button>
            ))}
          </Card>
        </div>
      )}
      {est.repetidos.length > 0 && (
        <p className="text-sm text-ojo">
          Se repite: {est.repetidos.map(([k, n]) => { const [m, c] = k.split("|"); return `${nomModulo(m)} · ${c === "sin" ? "sin categoría" : nombre("categoria_ticket", c)} (${n})`; }).join(" — ")}. Puede valer una mejora en vez de otro ticket.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={vista} onChange={setVista} items={[
          { k: "abiertos", n: "Abiertos", badge: est.abiertos || null }, { k: "esperando", n: "Esperando información" },
          { k: "resueltos", n: "Resueltos y cerrados" }, { k: "todos", n: "Todos" },
        ]} />
        <div className="flex gap-2">
          <select value={modulo} onChange={(e) => setModulo(e.target.value)} className={`${inputCls} mt-0 w-auto`}>
            <option value="">Todos los módulos</option>
            {de("modulo").map((m) => <option key={m.clave} value={m.clave}>{m.nombre}</option>)}
          </select>
          <div className="relative w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar, o #número" className={`${inputCls} pl-9 mt-0`} />
          </div>
        </div>
      </div>

      {tickets.length === 0 ? <Card><Vacio>Todavía no hay tickets. Cada consulta o problema de un cliente, acá, así queda cómo se resolvió.</Vacio></Card>
        : visibles.length === 0 ? <Card><Vacio>Ninguno coincide.</Vacio></Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-borde">
            {visibles.map((t) => (
              <li key={t.id}>
                <button onClick={() => abrirTicket(t.id)} className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-0.5 px-5 py-2.5 text-sm hover:bg-superficie-2">
                  <span className="f-m text-xs text-texto-tenue w-12">#{t.numero}</span>
                  <span className="flex-1 min-w-[12rem]">
                    <span className="block truncate">{t.titulo}</span>
                    <span className="block text-[11px] text-texto-tenue">{[t.clienteNombre, t.modulo && nombre("modulo", t.modulo), t.categoria && nombre("categoria_ticket", t.categoria)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={`text-[11px] ${TONO_PRIORIDAD[t.prioridad]}`}>{t.prioridad !== "normal" ? PRIORIDAD[t.prioridad] : ""}</span>
                  <span className={`text-[11px] w-32 text-right ${abierto(t) ? "text-ojo" : "text-texto-tenue"}`}>{ESTADO_TICKET[t.estado]}</span>
                  <span className="text-[11px] text-texto-tenue w-20 text-right">{abierto(t) ? relativo(t.creadoEn) : duracion(t.horasResolucion)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {nuevo && <NuevoTicket inicial={nuevo} toast={toast} onCerrar={() => setNuevo(null)} abrirTicket={abrirTicket} onListo={(id) => { setNuevo(null); leer(); abrirTicket(id); }} />}
    </div>
  );
}

/* ---------- Un ticket nuevo ---------- */
function NuevoTicket({ inicial, onCerrar, onListo, abrirTicket, toast }) {
  const { de } = useConfig();
  const [d, setD] = useState({ clienteId: inicial.clienteId || "", titulo: "", descripcion: "", pasos: "", canal: "whatsapp", modulo: "", categoria: "", prioridad: "normal", gravedad: "moderada", sucursal: "" });
  const [clientes, setClientes] = useState(null);
  const [parecidos, setParecidos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  /* Sin el área de clientes, la lista viene vacía y el ticket queda sin cliente. */
  useEffect(() => { cargarClientes().then(setClientes).catch(() => setClientes([])); }, []);
  useEffect(() => {
    const texto = `${d.titulo} ${d.descripcion}`;
    const h = setTimeout(() => ticketsParecidos(texto, d.modulo).then(setParecidos), 500);
    return () => clearTimeout(h);
  }, [d.titulo, d.descripcion, d.modulo]);

  const guardar = async () => {
    if (!d.titulo.trim()) return toast("Poné en una línea qué pasa.", "mal");
    setGuardando(true);
    try {
      const r = await guardarTicket({ ...d, titulo: d.titulo.trim(), clienteId: d.clienteId || null });
      toast(`Ticket #${r.numero} creado.`);
      onListo(r.id);
    } catch (e) { toast(e.message, "mal"); setGuardando(false); }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="p-5 space-y-4">
        <h3 className="f-d text-xl">Nuevo ticket</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <L t="Cliente">
            <select value={d.clienteId} onChange={set("clienteId")} className={inputCls} disabled={!clientes}>
              <option value="">{clientes ? "Sin cliente" : "Cargando…"}</option>
              {(clientes || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </L>
          <L t="Sucursal"><input value={d.sucursal} onChange={set("sucursal")} className={inputCls} /></L>
          <L t="Qué pasa *" className="sm:col-span-2"><input value={d.titulo} onChange={set("titulo")} autoFocus placeholder="Ej: la impresora no saca el ticket" className={inputCls} /></L>
          <L t="Descripción" className="sm:col-span-2"><textarea value={d.descripcion} onChange={set("descripcion")} rows={3} className={inputCls} /></L>
          <L t="Pasos para reproducirlo" className="sm:col-span-2"><textarea value={d.pasos} onChange={set("pasos")} rows={2} placeholder="1. Abrir Cobro  2. …" className={inputCls} /></L>
          <L t="Módulo">
            <select value={d.modulo} onChange={set("modulo")} className={inputCls}><option value="">—</option>{de("modulo").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select>
          </L>
          <L t="Categoría">
            <select value={d.categoria} onChange={set("categoria")} className={inputCls}><option value="">—</option>{de("categoria_ticket").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select>
          </L>
          <L t="Por dónde llegó">
            <select value={d.canal} onChange={set("canal")} className={inputCls}>{de("canal_ticket").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select>
          </L>
          <div className="grid grid-cols-2 gap-3">
            <L t="Prioridad"><select value={d.prioridad} onChange={set("prioridad")} className={inputCls}>{Object.entries(PRIORIDAD).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
            <L t="Gravedad"><select value={d.gravedad} onChange={set("gravedad")} className={inputCls}>{Object.entries(GRAVEDAD).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
          </div>
        </div>
        {parecidos.length > 0 && (
          <div className="rounded-lg border border-ojo/60 p-3">
            <p className="text-sm text-ojo mb-1.5">¿Es alguno de estos?</p>
            <ul className="space-y-1">
              {parecidos.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="f-m text-xs text-texto-tenue">#{p.numero}</span>
                  <span className="flex-1 truncate">{p.titulo}</span>
                  <span className="text-[11px] text-texto-tenue">{ESTADO_TICKET[p.estado]}</span>
                  <button onClick={() => { onCerrar(); abrirTicket(p.id); }} className="text-[11px] text-acento hover:underline">Abrir</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={guardando}>{guardando ? "Creando…" : "Crear ticket"}</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- El ticket ---------- */
export function Ticket({ id, volver, abrirCliente, abrirTicket, toast }) {
  const { cfg, de, nombre } = useConfig();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState({ tipo: "nota", texto: "" });
  const [resolviendo, setResolviendo] = useState(null);   // el estado al que se quería pasar
  const [parecidos, setParecidos] = useState([]);
  const leer = useCallback(() => cargarTicket(id).then((x) => {
    setD(x);
    ticketsParecidos(`${x.ticket.titulo} ${x.ticket.descripcion || ""}`, x.ticket.modulo, id).then(setParecidos);
  }).catch((e) => setError(e.message)), [id]);
  useEffect(() => { leer(); }, [leer]);

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!d || !cfg) return <Card><Cargando /></Card>;
  const t = d.ticket;
  const cambiar = async (cambios, aviso) => {
    if (cambios.estado && ["resuelto", "cerrado"].includes(cambios.estado) && !String(t.solucion || "").trim() && !cambios.solucion) {
      return setResolviendo(cambios.estado);
    }
    try { await guardarTicket({ id: t.id, ...cambios }); if (aviso) toast(aviso); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  const enviar = async () => {
    if (!mensaje.texto.trim()) return;
    try { await agregarMensaje(t.id, { tipo: mensaje.tipo, texto: mensaje.texto.trim() }); setMensaje({ ...mensaje, texto: "" }); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  const crearTarea = async () => {
    try {
      await guardarTarea({ titulo: `#${t.numero} ${t.titulo}`.slice(0, 200), ticketId: t.id, prospectoId: t.prospectoId || null, categoria: "desarrollo",
        prioridad: t.prioridad, descripcion: [t.descripcion, t.pasos && `Pasos: ${t.pasos}`].filter(Boolean).join("\n\n") || null });
      toast("Tarea de desarrollo creada, atada al ticket y al cliente.");
      leer();
    } catch (e) { toast(e.message, "mal"); }
  };
  const sel = (k, opciones, etiqueta) => (
    <L t={etiqueta}>
      <select value={t[k] || ""} onChange={(e) => cambiar({ [k]: e.target.value || null })} className={inputCls}>
        {!["estado", "prioridad", "gravedad"].includes(k) && <option value="">—</option>}
        {opciones.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
    </L>
  );
  const TIPO_MENSAJE = { nota: "Nota interna", al_cliente: "Le dijimos", del_cliente: "Nos dijo" };

  return (
    <div className="space-y-4">
      <button onClick={volver} className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto"><ChevronLeft size={16} /> Volver</button>
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="f-m text-xs text-texto-tenue">#{t.numero} · {fechaHora(t.creadoEn)}{t.resueltoEn ? ` · resuelto en ${duracion(t.horasResolucion)}` : ""}</p>
            <h1 className="f-d text-2xl mt-1">{t.titulo}</h1>
            {t.clienteNombre && <button onClick={() => abrirCliente(t.clienteId)} className="text-sm text-texto-suave hover:text-acento mt-1">{t.clienteNombre}{t.sucursal ? ` · ${t.sucursal}` : ""}</button>}
          </div>
          <div className="flex gap-2">
            <Boton variant="ghost" onClick={crearTarea}>Crear tarea de desarrollo</Boton>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
          {sel("estado", Object.entries(ESTADO_TICKET), "Estado")}
          {sel("prioridad", Object.entries(PRIORIDAD), "Prioridad")}
          {sel("gravedad", Object.entries(GRAVEDAD), "Gravedad")}
          {sel("modulo", de("modulo").map((x) => [x.clave, x.nombre]), "Módulo")}
          {sel("categoria", de("categoria_ticket").map((x) => [x.clave, x.nombre]), "Categoría")}
          {sel("canal", de("canal_ticket").map((x) => [x.clave, x.nombre]), "Canal")}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5 space-y-3">
            {t.descripcion && <div><h3 className="text-[11px] uppercase tracking-widest font-bold text-texto-tenue mb-1">Descripción</h3><p className="text-sm whitespace-pre-line">{t.descripcion}</p></div>}
            {t.pasos && <div><h3 className="text-[11px] uppercase tracking-widest font-bold text-texto-tenue mb-1">Pasos para reproducirlo</h3><p className="text-sm whitespace-pre-line">{t.pasos}</p></div>}
            <div>
              <h3 className="text-[11px] uppercase tracking-widest font-bold text-texto-tenue mb-1">Solución</h3>
              <textarea key={t.solucion || ""} defaultValue={t.solucion || ""} rows={2} placeholder="Qué se hizo, para la próxima vez que pase"
                onBlur={(e) => e.target.value !== (t.solucion || "") && cambiar({ solucion: e.target.value }, "Solución guardada.")} className={inputCls} />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Conversación</h2>
            {d.mensajes.length === 0 ? <p className="px-5 pb-3 text-sm text-texto-tenue">Todavía nada.</p> : (
              <ul className="divide-y divide-borde">
                {d.mensajes.map((m) => (
                  <li key={m.id} className="px-5 py-2.5">
                    <div className="flex justify-between gap-3 text-[11px]">
                      <span className={m.tipo === "del_cliente" ? "text-acento font-semibold" : m.tipo === "al_cliente" ? "text-texto-suave font-semibold" : "text-texto-tenue"}>{TIPO_MENSAJE[m.tipo]}</span>
                      <span className="f-m text-texto-tenue">{fechaHora(m.fecha)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-line mt-0.5">{m.texto}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-3 border-t border-borde space-y-2">
              <div className="flex gap-1.5">
                {Object.entries(TIPO_MENSAJE).map(([k, n]) => (
                  <button key={k} onClick={() => setMensaje({ ...mensaje, tipo: k })}
                    className={`text-xs px-2.5 py-1 rounded-md border ${mensaje.tipo === k ? "border-acento bg-acento-suave" : "border-borde text-texto-suave"}`}>{n}</button>
                ))}
              </div>
              <textarea value={mensaje.texto} onChange={(e) => setMensaje({ ...mensaje, texto: e.target.value })} rows={2} className={inputCls}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar(); }} placeholder="Ctrl+Enter para agregar" />
              <div className="flex justify-end"><Boton size="sm" onClick={enviar} disabled={!mensaje.texto.trim()}>Agregar</Boton></div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Tareas</h2>
            {d.tareas.length === 0 ? <p className="px-5 pb-4 text-sm text-texto-tenue">Ninguna todavía.</p> : (
              <ul className="divide-y divide-borde">
                {d.tareas.map((x) => <li key={x.id} className="px-5 py-2 text-sm flex justify-between gap-2"><span className={x.estado === "completada" ? "line-through text-texto-tenue" : ""}>{x.titulo}</span><span className="text-[11px] text-texto-tenue shrink-0">{ESTADO_TAREA[x.estado]}</span></li>)}
              </ul>
            )}
          </Card>
          <Card className="overflow-hidden">
            <h2 className="f-d text-lg px-5 pt-4 pb-2">Archivos</h2>
            <Adjuntos area="soporte" tabla="interno_tickets" filaId={t.id} lista={d.adjuntos} onCambio={leer} toast={toast} />
          </Card>
          {parecidos.length > 0 && (
            <Card className="p-5">
              <h2 className="f-d text-lg mb-2">Parecidos</h2>
              <ul className="space-y-1.5">
                {parecidos.map((p) => (
                  <li key={p.id}><button onClick={() => abrirTicket(p.id)} className="text-left text-sm hover:text-acento">
                    <span className="f-m text-xs text-texto-tenue">#{p.numero}</span> {p.titulo} <span className="text-[11px] text-texto-tenue">· {ESTADO_TICKET[p.estado]}</span>
                  </button></li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {resolviendo && <Resolver estado={resolviendo} onCerrar={() => setResolviendo(null)} toast={toast}
        onGuardar={(solucion) => { const e = resolviendo; setResolviendo(null); cambiar({ estado: e, solucion }, e === "cerrado" ? "Cerrado." : "Resuelto."); }} />}
    </div>
  );
}

function Resolver({ estado, onCerrar, onGuardar, toast }) {
  const [s, setS] = useState("");
  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-lg">¿Cómo se resolvió?</h3>
        <p className="text-sm text-texto-suave">Para {estado === "cerrado" ? "cerrarlo" : "resolverlo"} hace falta la solución: es lo que se lee la próxima vez que pase.</p>
        <textarea value={s} onChange={(e) => setS(e.target.value)} rows={3} autoFocus className={inputCls} />
        <div className="flex justify-end gap-2">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => (s.trim() ? onGuardar(s.trim()) : toast("Escribí la solución.", "mal"))}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}
