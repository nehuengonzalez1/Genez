/* ============================================================
   GENEZ FOUNDER · Conversaciones de WhatsApp (0120)
   ============================================================

   La bandeja del número de Genez. Entra lo que llega al webhook; sale
   solo texto, y solo dentro de la ventana de 24 horas que abre cada
   mensaje de la persona. Fuera de esa ventana Meta exige una plantilla
   aprobada, y las plantillas todavía no están: el cuadro de respuesta se
   apaga y dice por qué, en vez de dejar escribir algo que Meta va a
   rechazar.

   No hay tiempo real: se vuelve a leer cada pocos segundos mientras la
   pantalla está a la vista. Para un número con pocas conversaciones
   alcanza, y no suma otra pieza que mantener.

   Vincular a un prospecto es siempre una decisión de alguien: la base
   sugiere si hay uno solo con ese teléfono, y nada más.
   ============================================================ */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Search, Send, Link2, UserPlus, Check, CheckCheck, AlertCircle, Clock, Sparkles } from "lucide-react";
import { Card, Boton, Cargando, ErrorEstado, Vacio, Modal, Sello } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import {
  cargarConversaciones, cargarConversacion, cargarMensajes, editarConversacion, enviarMensaje, claveDeEnvio, ventanaRestante,
  ESTADOS_CONVERSACION, CONSENTIMIENTOS, cargarUltimoBorrador, descartarBorrador, pedirBorrador,
} from "../datos/internoWhatsapp.js";
import { cargarProspectos, crearProspecto } from "../datos/internoCrm.js";
import { relativo, fechaHora, hora } from "./util.js";

const FILTROS = [["todas", "Todas"], ["te_necesita", "Te necesitan"], ["sin_leer", "Sin leer"], ["abierta", "Abiertas"], ["pendiente", "Pendientes"], ["cerrada", "Cerradas"], ["baja", "Pidieron la baja"]];

/* +54 9 11 2485-9144 a partir de 5491124859144. Si no tiene la forma
   argentina, se muestra con el + y nada más. */
export function numeroLindo(wa) {
  const d = String(wa || "");
  const m = d.match(/^549(11|[2-9]\d{1,3})(\d{6,8})$/);
  if (!m) return d ? `+${d}` : "";
  const resto = m[2];
  return `+54 9 ${m[1]} ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
}

/* Recargar cada `ms` mientras la pestaña está a la vista. */
function useCada(fn, ms, activo = true) {
  useEffect(() => {
    if (!activo) return undefined;
    const t = setInterval(() => { if (document.visibilityState === "visible") fn(); }, ms);
    return () => clearInterval(t);
  }, [fn, ms, activo]);
}

export function Conversaciones({ interno, abrir, toast }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [busca, setBusca] = useState("");
  const [abierta, setAbierta] = useState(null);
  const leer = useCallback(() => cargarConversaciones().then((l) => { setLista(l); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);
  useCada(leer, 8000);

  const visibles = useMemo(() => {
    if (!lista) return [];
    const q = busca.trim().toLowerCase();
    const digitos = q.replace(/\D/g, "");
    return lista.filter((c) => {
      if (filtro === "sin_leer" && !(c.noLeidos > 0)) return false;
      if (filtro === "te_necesita" && !c.derivadaEn) return false;
      if (["abierta", "pendiente", "cerrada"].includes(filtro) && c.estado !== filtro) return false;
      if (filtro === "baja" && c.consentimiento !== "baja") return false;
      if (!q) return true;
      return [c.nombrePerfil, c.prospectoNombre].some((x) => x && x.toLowerCase().includes(q)) || (digitos.length >= 3 && c.waId.includes(digitos));
    });
  }, [lista, filtro, busca]);

  const sinLeer = lista ? lista.filter((c) => c.noLeidos > 0).length : 0;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="f-d text-3xl">Conversaciones</h1>
        <p className="text-sm text-texto-suave mt-1">
          El WhatsApp de Genez. Se contesta dentro de las 24 horas del último mensaje de la persona; después, Meta solo deja mandar una plantilla aprobada.
        </p>
      </header>

      <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-[20rem_1fr] lg:gap-4 lg:items-start">
        <Card className={`overflow-hidden ${abierta ? "hidden lg:block" : ""}`}>
          <div className="p-3 border-b border-borde space-y-2">
            <label className="relative block">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nombre o número" className={`${inputCls} mt-0 pl-8`} />
            </label>
            <div className="flex flex-wrap gap-1">
              {FILTROS.map(([k, n]) => (
                <button key={k} onClick={() => setFiltro(k)}
                  className={`text-[11px] px-2 py-0.5 rounded-md border ${filtro === k ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:text-texto"}`}>
                  {n}{k === "sin_leer" && sinLeer ? ` · ${sinLeer}` : ""}
                </button>
              ))}
            </div>
          </div>
          {error && <ErrorEstado onReintentar={leer}>{error}</ErrorEstado>}
          {!error && !lista && <Cargando />}
          {!error && lista && lista.length === 0 && (
            <Vacio>Todavía no llegó ningún mensaje. Cuando el número esté conectado (Configuración → WhatsApp), aparecen acá.</Vacio>
          )}
          {!error && lista && lista.length > 0 && visibles.length === 0 && <Vacio>Nada con ese filtro.</Vacio>}
          {visibles.length > 0 && (
            <ul className="divide-y divide-borde max-h-[70vh] overflow-y-auto">
              {visibles.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setAbierta(c.id)} data-conversacion={c.id}
                    className={`w-full text-left px-3 py-2.5 hover:bg-superficie-2 ${abierta === c.id ? "bg-superficie-2" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className={`flex-1 truncate text-sm ${c.noLeidos > 0 ? "font-semibold" : ""}`}>
                        {c.prospectoNombre || c.nombrePerfil || numeroLindo(c.waId)}
                      </span>
                      <span className="text-[11px] text-texto-tenue f-m whitespace-nowrap">{c.ultimoMensajeEn ? relativo(new Date(c.ultimoMensajeEn)) : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex-1 truncate text-xs text-texto-suave">
                        {c.ultimoDireccion === "saliente" ? "Vos: " : ""}{c.ultimoTexto || ""}
                      </span>
                      {c.derivadaEn && <Sello tono="ojo">te necesita</Sello>}
                      {c.conBorrador && !c.derivadaEn && <Sello tono="info">borrador</Sello>}
                      {c.consentimiento === "baja" && <Sello tono="mal">baja</Sello>}
                      {c.noLeidos > 0 && <span className="f-m text-[11px] min-w-[1.25rem] text-center px-1 rounded-full bg-acento text-sobre-acento font-semibold">{c.noLeidos}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {abierta
          ? <Hilo key={abierta} id={abierta} interno={interno} volver={() => setAbierta(null)} alCambiar={leer} abrir={abrir} toast={toast} />
          : <Card className="hidden lg:block"><Vacio>Elegí una conversación.</Vacio></Card>}
      </div>
    </div>
  );
}

/* ---------- Una conversación ---------- */
function Hilo({ id, interno, volver, alCambiar, abrir, toast }) {
  const [c, setC] = useState(null);
  const [mensajes, setMensajes] = useState(null);
  const [error, setError] = useState("");
  const [vincular, setVincular] = useState(false);
  const [borrador, setBorrador] = useState(null);
  const fondo = useRef(null);
  const cuantos = useRef(0);

  const leer = useCallback(() => Promise.all([cargarConversacion(id), cargarMensajes(id), cargarUltimoBorrador(id).catch(() => null)])
    .then(([conv, ms, b]) => { setC(conv); setMensajes(ms); setBorrador(b); setError(""); })
    .catch((e) => setError(e.message)), [id]);
  useEffect(() => { leer(); }, [leer]);
  useCada(leer, 5000);

  /* Abrirla la deja leída. Se hace una vez por mensaje nuevo, no en cada
     vuelta del sondeo. */
  useEffect(() => {
    if (c && c.noLeidos > 0) editarConversacion(id, { noLeidos: 0 }).then(alCambiar).catch(() => {});
  }, [c && c.noLeidos, id, alCambiar]);
  /* Al fondo cuando llega algo, no en cada relectura: si alguien subió a
     leer algo viejo, que no lo arranquen de ahí cada cinco segundos. */
  useEffect(() => {
    if (mensajes && mensajes.length !== cuantos.current) {
      cuantos.current = mensajes.length;
      if (fondo.current) fondo.current.scrollTop = fondo.current.scrollHeight;
    }
  }, [mensajes]);

  const cambiar = async (cambios, ok) => {
    try { await editarConversacion(id, cambios); await leer(); alCambiar(); if (ok) toast(ok); } catch (e) { toast(e.message, "mal"); }
  };

  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!c || !mensajes) return <Card><Cargando /></Card>;

  const restante = ventanaRestante(c.ultimoEntranteEn);
  const miId = interno && interno.perfilId;

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-borde space-y-2">
        <div className="flex items-center gap-2">
          <button onClick={volver} className="lg:hidden p-1 -ml-1 text-texto-suave" aria-label="Volver"><ChevronLeft size={18} /></button>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{c.prospectoNombre || c.nombrePerfil || numeroLindo(c.waId)}</div>
            <div className="text-xs text-texto-suave f-m">{numeroLindo(c.waId)}{c.nombrePerfil && c.prospectoNombre ? ` · ${c.nombrePerfil}` : ""}</div>
          </div>
          <select value={c.estado} onChange={(e) => cambiar({ estado: e.target.value })} className="shrink-0 bg-superficie text-sm border border-borde rounded-lg px-2 py-1 outline-none focus:border-acento" aria-label="Estado">
            {Object.entries(ESTADOS_CONVERSACION).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {c.prospectoId ? (
            <button onClick={() => abrir(c.prospectoId)} className="inline-flex items-center gap-1 text-acento hover:underline">
              <Link2 size={12} /> {c.prospectoNombre}{c.clienteId ? " · cliente" : ""}
            </button>
          ) : c.prospectoSugeridoId ? (
            <span className="inline-flex items-center gap-1.5 text-texto-suave">
              ¿Es <b className="text-texto">{c.prospectoSugeridoNombre}</b>?
              <button onClick={() => cambiar({ prospectoId: c.prospectoSugeridoId }, "Vinculada al prospecto.")} className="text-acento font-semibold hover:underline">Vincular</button>
              <button onClick={() => setVincular(true)} className="hover:underline">Otro</button>
            </span>
          ) : (
            <button onClick={() => setVincular(true)} className="inline-flex items-center gap-1 text-texto-suave hover:text-texto"><Link2 size={12} /> Vincular a un prospecto</button>
          )}
          <span className="text-texto-tenue">·</span>
          {c.asignadoId === miId
            ? <span className="text-texto-suave">La atendés vos · <button onClick={() => cambiar({ asignadoId: null })} className="hover:underline">soltar</button></span>
            : <button onClick={() => cambiar({ asignadoId: miId }, "Te la asignaste.")} className="text-texto-suave hover:text-texto">
                {c.asignadoId ? "La atiende otra persona · tomarla" : "Tomarla"}
              </button>}
          <span className="text-texto-tenue">·</span>
          <select value={c.consentimiento} onChange={(e) => cambiar({ consentimiento: e.target.value })} aria-label="Consentimiento"
            className="bg-transparent text-xs text-texto-suave border border-borde rounded-md px-1.5 py-0.5">
            {Object.entries(CONSENTIMIENTOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <span className="text-texto-tenue">·</span>
          {c.botPausado
            ? <span className="text-texto-suave">Asistente pausado · <button onClick={() => cambiar({ botPausado: false }, "El asistente vuelve a atenderla.")} className="hover:underline">reanudar</button></span>
            : <span className="text-texto-suave">Asistente activo · <button onClick={() => cambiar({ botPausado: true }, "El asistente no la atiende más.")} className="hover:underline">pausar</button></span>}
        </div>
        {c.derivadaEn && (
          <div className="flex flex-wrap items-center gap-2 text-xs rounded-md border border-ojo bg-ojo-suave px-3 py-2">
            <span className="flex-1 min-w-0">El asistente te pasó esta conversación{c.derivadaMotivo ? `: ${c.derivadaMotivo}` : "."}</span>
            <button onClick={() => cambiar({ derivadaEn: null, derivadaMotivo: null })} className="font-semibold hover:underline">Ya la atiendo</button>
          </div>
        )}
      </div>

      <div ref={fondo} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 max-h-[55vh] min-h-[16rem] bg-fondo">
        {mensajes.length === 0 && <Vacio>Sin mensajes.</Vacio>}
        {mensajes.map((m) => <Burbuja key={m.id} m={m} />)}
      </div>

      <Respuesta key={c.id} conversacion={c} restante={restante} borrador={borrador} alCambiar={() => { leer(); alCambiar(); }} toast={toast} />

      {vincular && <Vincular conversacion={c} onCerrar={() => setVincular(false)}
        onElegir={async (prospectoId) => { setVincular(false); await cambiar({ prospectoId }, "Vinculada al prospecto."); }} toast={toast} />}
    </Card>
  );
}

const MARCA = {
  enviando: [Clock, "text-texto-tenue", "Enviando"],
  enviado: [Check, "text-texto-tenue", "Enviado"],
  entregado: [CheckCheck, "text-texto-tenue", "Entregado"],
  leido: [CheckCheck, "text-acento", "Leído"],
  fallido: [AlertCircle, "text-mal", "No salió"],
};

function Burbuja({ m }) {
  const sale = m.direccion === "saliente";
  const [Icono, color, nombre] = MARCA[m.estado] || [];
  const falla = m.estado === "fallido" && m.error;
  const textoFalla = falla && (Array.isArray(m.error)
    ? m.error.map((e) => (e.error_data && e.error_data.details) || e.title || e.message || e.code).join(" · ")
    : m.error.message || "");
  return (
    <div className={`flex ${sale ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm ${sale ? "bg-acento-suave border-borde" : "bg-superficie border-borde"}`}>
        {m.texto
          ? <div className="whitespace-pre-wrap break-words">{m.texto}</div>
          : <div className="italic text-texto-suave">[{m.tipo === "unsupported" ? "mensaje que WhatsApp no deja leer por la API" : m.tipo}]</div>}
        {m.texto && m.tipo !== "text" && <div className="text-[10px] text-texto-tenue mt-0.5">{m.tipo}</div>}
        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-texto-tenue f-m" title={fechaHora(new Date(m.momento))}>
          {hora(new Date(m.momento))}
          {sale && Icono && <Icono size={12} className={color} aria-label={nombre} />}
        </div>
        {textoFalla && <div className="text-[11px] text-mal mt-1">{textoFalla}</div>}
      </div>
    </div>
  );
}

/* El cuadro de respuesta. Aparte del hilo para que el sondeo, que vuelve
   a dibujar el hilo cada cinco segundos, no le robe el foco a quien está
   escribiendo. */
function Respuesta({ conversacion: c, restante, borrador, alCambiar, toast }) {
  const [texto, setTexto] = useState("");
  const [mandando, setMandando] = useState(false);
  /* El borrador que se está usando: si el texto sale de ahí, el envío lo
     marca como enviado (aunque se haya corregido antes). */
  const [enUso, setEnUso] = useState(null);
  const [pidiendo, setPidiendo] = useState(false);
  const alMandar = alCambiar;
  /* Una clave por mensaje escrito: si el primer intento se corta y se
     reintenta, es el mismo mensaje y la base no lo manda dos veces. Se
     renueva recién cuando salió. */
  const clave = useRef(claveDeEnvio());

  const motivo = c.consentimiento === "baja"
    ? "Pidió que no le escriban. Si vuelve a escribir y quiere seguir, cambiá el consentimiento."
    : !restante
      ? "Pasaron más de 24 horas desde su último mensaje. Meta solo deja mandar una plantilla aprobada, y las plantillas todavía no están en Founder."
      : null;

  const mandar = async () => {
    const t = texto.trim();
    if (!t || mandando || motivo) return;
    setMandando(true);
    try {
      await enviarMensaje(c.id, t, clave.current, enUso);
      setTexto("");
      setEnUso(null);
      clave.current = claveDeEnvio();
    } catch (e) {
      /* Si Meta lo rechazó, el mensaje ya quedó guardado como "No salió"
         con su motivo: se limpia igual, para no mandarlo dos veces con
         otra clave. Si ni llegó al servidor, queda escrito para reintentar. */
      if (e.respuesta && e.respuesta.mensaje) { setTexto(""); setEnUso(null); clave.current = claveDeEnvio(); }
      toast(e.message, "mal");
    } finally {
      setMandando(false);
      alMandar();
    }
  };

  const usar = () => { setTexto(borrador.texto); setEnUso(borrador.id); };
  const descartar = async () => {
    try { await descartarBorrador(borrador.id); if (enUso === borrador.id) setEnUso(null); alCambiar(); } catch (e) { toast(e.message, "mal"); }
  };
  const pedir = async () => {
    setPidiendo(true);
    try { await pedirBorrador(c.id); alCambiar(); } catch (e) { toast(e.message, "mal"); } finally { setPidiendo(false); }
  };

  return (
    <div className="border-t border-borde px-4 py-3 space-y-1.5">
      {!motivo && borrador && borrador.estado === "pendiente" && borrador.id !== enUso && (
        <Borrador b={borrador} onUsar={usar} onDescartar={descartar} />
      )}
      {!motivo && borrador && borrador.estado === "error" && (
        <p className="text-xs text-mal flex flex-wrap gap-x-2">
          <span>El asistente no pudo armar una respuesta: {borrador.error}</span>
          <button onClick={pedir} disabled={pidiendo} className="font-semibold hover:underline disabled:opacity-50">{pidiendo ? "Pidiendo…" : "Reintentar"}</button>
        </p>
      )}
      {motivo
        ? <p className="text-xs text-texto-suave">{motivo}</p>
        : (
          <p className="text-[11px] text-texto-tenue flex flex-wrap gap-x-3">
            <span>Podés contestar durante {restante} más.</span>
            {!(borrador && borrador.estado === "pendiente") && (
              <button onClick={pedir} disabled={pidiendo} className="inline-flex items-center gap-1 text-texto-suave hover:text-texto disabled:opacity-50">
                <Sparkles size={11} /> {pidiendo ? "El asistente está escribiendo…" : "Pedirle un borrador al asistente"}
              </button>
            )}
          </p>
        )}
      <div className="flex items-end gap-2">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!!motivo || mandando} rows={2} maxLength={4096}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); mandar(); } }}
          placeholder={motivo ? "" : "Escribí la respuesta (Ctrl+Enter manda)"} className={`${inputCls} mt-0 flex-1 resize-y disabled:opacity-50`} />
        <Boton onClick={mandar} disabled={!!motivo || mandando || !texto.trim()}><Send size={14} /> {mandando ? "Mandando…" : "Mandar"}</Boton>
      </div>
    </div>
  );
}

/* Lo que propone el asistente. Se ve con qué lo armó (qué documentos,
   qué versión) y lo que cree haber entendido, marcado como suposición:
   nada de eso se carga en el CRM solo. */
function Borrador({ b, onUsar, onDescartar }) {
  const d = b.datos || {};
  const entendio = [d.negocio, d.rubro, d.necesidad, d.quiere_demo ? "quiere una demo" : null].filter(Boolean);
  return (
    <div className="rounded-lg border border-borde bg-superficie-2 px-3 py-2.5 space-y-1.5" data-borrador={b.id}>
      <div className="flex items-center gap-1.5 text-[11px] text-texto-suave"><Sparkles size={12} className="text-acento" /> Borrador del asistente</div>
      <div className="text-sm whitespace-pre-wrap break-words">{b.texto}</div>
      {entendio.length > 0 && <div className="text-[11px] text-texto-tenue">Supone: {entendio.join(" · ")}</div>}
      {(b.conocimiento || []).length > 0 && (
        <div className="text-[11px] text-texto-tenue">Con: {b.conocimiento.map((k) => `${k.titulo} v${k.version}`).join(", ")}</div>
      )}
      <div className="flex gap-2 pt-0.5">
        <Boton size="sm" onClick={onUsar}>Usar y revisar</Boton>
        <Boton size="sm" variant="ghost" onClick={onDescartar}>Descartar</Boton>
      </div>
    </div>
  );
}

/* ---------- Vincular a un prospecto ---------- */
function Vincular({ conversacion: c, onCerrar, onElegir, toast }) {
  const [prospectos, setProspectos] = useState(null);
  const [busca, setBusca] = useState(c.nombrePerfil || "");
  const [creando, setCreando] = useState(false);
  useEffect(() => { cargarProspectos().then(setProspectos).catch((e) => { toast(e.message, "mal"); setProspectos([]); }); }, [toast]);
  const q = busca.trim().toLowerCase();
  const encontrados = (prospectos || []).filter((p) => !q || (p.nombre || "").toLowerCase().includes(q)).slice(0, 30);
  const crear = async () => {
    setCreando(true);
    try {
      const nuevo = await crearProspecto({ nombre: (c.nombrePerfil || numeroLindo(c.waId)).slice(0, 200), whatsapp: numeroLindo(c.waId) });
      toast("Prospecto creado.");
      onElegir(nuevo);
    } catch (e) { toast(e.message, "mal"); setCreando(false); }
  };
  return (
    <Modal open onClose={onCerrar}>
      <div className="p-5 space-y-3">
        <h2 className="f-d text-xl">Vincular a un prospecto</h2>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre" className={inputCls} autoFocus />
        {!prospectos ? <Cargando /> : (
          <ul className="max-h-72 overflow-y-auto divide-y divide-borde border border-borde rounded-lg">
            {encontrados.length === 0 && <li className="px-3 py-3 text-sm text-texto-tenue">Ninguno con ese nombre.</li>}
            {encontrados.map((p) => (
              <li key={p.id}>
                <button onClick={() => onElegir(p.id)} className="w-full text-left px-3 py-2 hover:bg-superficie-2 text-sm">
                  {p.nombre} <span className="text-xs text-texto-tenue">{[p.localidad, p.whatsapp || p.telefono].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between gap-2">
          <Boton variant="ghost" onClick={crear} disabled={creando}><UserPlus size={14} /> Crear uno nuevo con este número</Boton>
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
        </div>
      </div>
    </Modal>
  );
}
