/* ============================================================
   GENEZ FOUNDER · Automatizaciones (0122)
   ============================================================

   Cuatro pestañas: la cola (lo que las reglas quieren mandar y espera
   aprobación), las reglas, las plantillas de WhatsApp y las corridas del
   reloj. Nada sale sin plantilla aprobada por Meta, y de fábrica nada
   sale sin que alguien lo apruebe acá.

   Lo que no se mandó (sin teléfono, sin consentimiento, pidió la baja)
   se ve en "Omitidos" con su motivo: una regla que parece no hacer nada
   casi siempre está omitiendo por algo.
   ============================================================ */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Play, Send, RefreshCw, Plus } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Sello, Modal } from "../ui/Base.jsx";
import { inputCls, NumeroDiferido } from "../ui/Campos.jsx";
import {
  cargarReglas, guardarRegla, cargarPlantillas, guardarPlantilla, archivarPlantilla, cargarEnvios, decidirEnvio, cargarCorridas,
  correrAhora, mandarPlantillaAMeta, consultarPlantillas, armarTexto, huecos,
  cargarAlertas as cargarAlertasInicio, descartarAlerta as descartarAlertaInicio,
  TIPOS_REGLA, ESTADO_ENVIO, ESTADO_PLANTILLA, VARIABLES,
} from "../datos/internoAutomatizaciones.js";
import { fechaHora, relativo } from "./util.js";
import { numeroLindo } from "./Conversaciones.jsx";

const FILTROS_COLA = [["por_aprobar", "Por aprobar", ["por_aprobar"]], ["en_curso", "Aprobados", ["aprobado", "enviando"]], ["enviado", "Enviados", ["enviado"]],
  ["fallido", "No salieron", ["fallido"]], ["omitido", "Omitidos", ["omitido", "cancelado"]]];
/* Los números chicos van en línea con el texto: con inputCls (w-full)
   cada uno ocupaba una fila entera. */
const numCls = "border border-borde rounded-lg px-2 py-1 text-sm outline-none focus:border-acento bg-transparent f-m";
const DIAS = [[1, "L"], [2, "M"], [3, "X"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];

export function Automatizaciones({ toast }) {
  const [pestana, setPestana] = useState("cola");
  const [corriendo, setCorriendo] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const correr = async () => {
    setCorriendo(true);
    try {
      const r = await correrAhora();
      toast(r.error ? `La corrida falló: ${r.error}` : `Listo: ${r.generados} nuevos, ${r.enviados} enviados, ${r.alertas} alertas.`, r.error ? "mal" : "bien");
      setVuelta((n) => n + 1);
    } catch (e) { toast(e.message, "mal"); } finally { setCorriendo(false); }
  };
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-d text-3xl">Automatizaciones</h1>
          <p className="text-sm text-texto-suave mt-1">Recordatorios, seguimientos y alertas. Corren solas cada 5 minutos; por WhatsApp solo sale lo que tiene plantilla aprobada por Meta.</p>
        </div>
        <Boton variant="ghost" onClick={correr} disabled={corriendo}><Play size={14} /> {corriendo ? "Corriendo…" : "Correr ahora"}</Boton>
      </header>
      <Tabs value={pestana} onChange={setPestana} items={[{ k: "cola", n: "Cola" }, { k: "reglas", n: "Reglas" }, { k: "plantillas", n: "Plantillas" }, { k: "corridas", n: "Corridas" }]} />
      {pestana === "cola" && <Cola key={vuelta} toast={toast} />}
      {pestana === "reglas" && <Reglas toast={toast} />}
      {pestana === "plantillas" && <Plantillas toast={toast} />}
      {pestana === "corridas" && <Corridas key={vuelta} />}
    </div>
  );
}

/* ---------- La cola ---------- */
function Cola({ toast }) {
  const [filtro, setFiltro] = useState("por_aprobar");
  const [envios, setEnvios] = useState(null);
  const [error, setError] = useState("");
  const estados = FILTROS_COLA.find((f) => f[0] === filtro)[2];
  const leer = useCallback(() => cargarEnvios(estados).then((e) => { setEnvios(e); setError(""); }).catch((e) => setError(e.message)), [filtro]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEnvios(null); leer(); }, [leer]);
  const decidir = async (id, estado, ok) => { try { await decidirEnvio(id, estado); toast(ok); leer(); } catch (e) { toast(e.message, "mal"); } };

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-borde flex flex-wrap gap-1">
        {FILTROS_COLA.map(([k, n]) => (
          <button key={k} onClick={() => setFiltro(k)}
            className={`text-[11px] px-2 py-0.5 rounded-md border ${filtro === k ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:text-texto"}`}>{n}</button>
        ))}
      </div>
      {error ? <ErrorEstado onReintentar={leer}>{error}</ErrorEstado> : !envios ? <Cargando /> : envios.length === 0 ? (
        <Vacio>{filtro === "por_aprobar" ? "Nada esperando aprobación." : "Nada acá."}</Vacio>
      ) : (
        <ul className="divide-y divide-borde">
          {envios.map((e) => {
            const [nombre, tono] = ESTADO_ENVIO[e.estado] || [e.estado, "tenue"];
            return (
              <li key={e.id} className="px-4 py-3 space-y-1" data-envio={e.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm">{e.destinatario || "Sin nombre"}</span>
                  <span className="text-xs text-texto-suave f-m">{e.destinoWa ? numeroLindo(e.destinoWa) : "sin número"}</span>
                  <Sello tono={tono}>{nombre}</Sello>
                  <span className="text-[11px] text-texto-tenue ml-auto">{e.regla} · {relativo(new Date(e.creadoEn))}</span>
                </div>
                {e.cuerpo && (e.valores || []).length > 0 && <p className="text-sm text-texto-suave whitespace-pre-wrap">{armarTexto(e.cuerpo, e.valores)}</p>}
                {e.motivo && <p className="text-xs text-texto-suave">{e.motivo}</p>}
                {e.error && <p className="text-xs text-mal">{e.error.message || JSON.stringify(e.error)}</p>}
                {e.estado === "aprobado" && e.proximoIntento && <p className="text-[11px] text-texto-tenue">Se reintenta {fechaHora(new Date(e.proximoIntento))}.</p>}
                {(e.estado === "por_aprobar" || e.estado === "aprobado" || e.estado === "fallido") && (
                  <div className="flex gap-2 pt-1">
                    {e.estado === "por_aprobar" && <Boton size="sm" onClick={() => decidir(e.id, "aprobado", "Aprobado: sale en la próxima corrida, dentro del horario de la regla.")}>Aprobar</Boton>}
                    <Boton size="sm" variant="ghost" onClick={() => decidir(e.id, "cancelado", "Cancelado.")}>Cancelar</Boton>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Las reglas ---------- */
function Reglas({ toast }) {
  const [reglas, setReglas] = useState(null);
  const [plantillas, setPlantillas] = useState([]);
  const [error, setError] = useState("");
  const leer = useCallback(() => Promise.all([cargarReglas(), cargarPlantillas()])
    .then(([r, p]) => { setReglas(r); setPlantillas(p); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);
  const guardar = async (r, cambios, ok) => {
    try { await guardarRegla(r.id, cambios); if (ok) toast(ok); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!reglas) return <Card><Cargando /></Card>;
  const aprobadas = plantillas.filter((p) => p.estado === "aprobada");
  return <div className="space-y-4">{reglas.map((r) => <Regla key={r.id} r={r} aprobadas={aprobadas} guardar={guardar} />)}</div>;
}

function Regla({ r, aprobadas, guardar }) {
  const t = TIPOS_REGLA[r.tipo] || { n: r.tipo, d: "" };
  const par = r.parametros || {};
  const setPar = (k, v) => guardar(r, { parametros: { ...par, [k]: v } });
  const plantilla = aprobadas.find((p) => p.id === r.plantillaId);
  const alternarDia = (d) => {
    const dias = r.dias.includes(d) ? r.dias.filter((x) => x !== d) : [...r.dias, d];
    if (dias.length) guardar(r, { dias });
  };
  const prender = () => {
    if (!r.activa && t.whatsapp && !r.aprobacionManual
      && !window.confirm("Sin aprobación manual, los mensajes salen solos a los clientes. ¿La prendés igual?")) return;
    guardar(r, { activa: !r.activa }, r.activa ? "Regla apagada." : "Regla prendida.");
  };
  return (
    <Card className="p-5 space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">{r.nombre}</h2>
          <p className="text-xs text-texto-suave mt-0.5">{t.d}</p>
        </div>
        <Sello tono={r.activa ? "bien" : "tenue"}>{r.activa ? "prendida" : "apagada"}</Sello>
        <Boton size="sm" variant={r.activa ? "ghost" : "primary"} onClick={prender} disabled={!r.activa && t.whatsapp && !plantilla}>{r.activa ? "Apagar" : "Prender"}</Boton>
      </div>
      {!r.activa && t.whatsapp && !plantilla && <p className="text-xs text-ojo">Para prenderla, elegí una plantilla aprobada por Meta.</p>}

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {r.tipo === "recordatorio_evento" && (
          <label className="flex items-center gap-2">Cuántas horas antes
            <NumeroDiferido valor={par.horas_antes ?? 24} onGuardar={(n) => setPar("horas_antes", Math.max(1, Math.min(72, Number(n) || 24)))} className={`${numCls} w-20`} />
          </label>
        )}
        {r.tipo === "seguimiento" && (
          <label className="flex items-center gap-2">Días sin respuesta
            <NumeroDiferido valor={par.dias ?? 3} onGuardar={(n) => setPar("dias", Math.max(1, Math.min(30, Number(n) || 3)))} className={`${numCls} w-20`} />
          </label>
        )}
        {r.tipo === "alerta_oportunidad" && (
          <label className="flex items-center gap-2">Días sin contacto
            <NumeroDiferido valor={par.dias ?? 7} onGuardar={(n) => setPar("dias", Math.max(1, Math.min(90, Number(n) || 7)))} className={`${numCls} w-20`} />
          </label>
        )}
        {r.tipo === "alerta_conversacion" && (
          <label className="flex items-center gap-2">Minutos esperando
            <NumeroDiferido valor={par.minutos ?? 60} onGuardar={(n) => setPar("minutos", Math.max(5, Math.min(1440, Number(n) || 60)))} className={`${numCls} w-20`} />
          </label>
        )}

        {t.whatsapp && <>
          <label className="block">Plantilla
            <select value={r.plantillaId || ""} onChange={(e) => guardar(r, { plantillaId: e.target.value || null }, "Plantilla elegida.")} className={inputCls}>
              <option value="">Ninguna</option>
              {aprobadas.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.categoria === "UTILITY" ? "utilidad" : "marketing"})</option>)}
            </select>
          </label>
          <label className="block">A quién
            <select value={r.consentimiento} onChange={(e) => guardar(r, { consentimiento: e.target.value })} className={inputCls}>
              <option value="dado">Solo a quien aceptó recibir mensajes</option>
              <option value="sin_baja">A quien no pidió la baja (para algo que la persona agendó)</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">Horario
            <NumeroDiferido valor={r.horaDesde} onGuardar={(n) => guardar(r, { horaDesde: Math.max(0, Math.min(23, Math.round(Number(n)))) })} className={`${numCls} w-16`} /> a
            <NumeroDiferido valor={r.horaHasta} onGuardar={(n) => guardar(r, { horaHasta: Math.max(1, Math.min(24, Math.round(Number(n)))) })} className={`${numCls} w-16`} /> h
            <span className="flex gap-1 ml-1">
              {DIAS.map(([d, n]) => (
                <button key={d} onClick={() => alternarDia(d)} className={`w-6 h-6 text-[11px] rounded border ${r.dias.includes(d) ? "border-acento bg-acento-suave" : "border-borde text-texto-tenue"}`}>{n}</button>
              ))}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">Topes: por persona
            <NumeroDiferido valor={r.topePersonaDia} onGuardar={(n) => guardar(r, { topePersonaDia: Math.max(1, Math.min(5, Math.round(Number(n)) || 1)) })} className={`${numCls} w-14`} /> por día,
            <NumeroDiferido valor={r.topePersonaSemana} onGuardar={(n) => guardar(r, { topePersonaSemana: Math.max(1, Math.min(10, Math.round(Number(n)) || 2)) })} className={`${numCls} w-14`} /> por semana; en total
            <NumeroDiferido valor={r.topeDia} onGuardar={(n) => guardar(r, { topeDia: Math.max(1, Math.min(250, Math.round(Number(n)) || 30)) })} className={`${numCls} w-16`} /> por día
          </div>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={r.aprobacionManual} onChange={(e) => guardar(r, { aprobacionManual: e.target.checked }, e.target.checked ? "Cada envío espera tu aprobación." : "Los envíos salen sin aprobación.")} />
            Cada envío espera aprobación en la cola
          </label>
        </>}
      </div>
    </Card>
  );
}

/* ---------- Plantillas ---------- */
function Plantillas({ toast }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const leer = useCallback(() => cargarPlantillas().then((l) => { setLista(l); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);
  const hacer = async (que, fn, ok) => {
    setOcupado(que);
    try { await fn(); if (ok) toast(ok); leer(); }
    catch (e) { toast((e.respuesta && e.respuesta.error && e.respuesta.error.message) || e.message, "mal"); }
    finally { setOcupado(""); }
  };
  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!lista) return <Card><Cargando /></Card>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Boton onClick={() => setEditando({ nombre: "", idioma: "es_AR", categoria: "UTILITY", cuerpo: "", variables: [], ejemplos: [] })}><Plus size={14} /> Plantilla</Boton>
        <Boton variant="ghost" onClick={() => hacer("sinc", consultarPlantillas, "Estado consultado a Meta.")} disabled={!!ocupado}><RefreshCw size={14} /> Consultar a Meta</Boton>
      </div>
      <p className="text-xs text-texto-suave">
        Meta revisa cada plantilla antes de dejarla usar (suele tardar de minutos a un día). Utilidad es para recordatorios y confirmaciones;
        marketing, para seguimientos y ofertas, y se cobra más caro. Las variables van como {"{{1}}"}, {"{{2}}"} en el texto.
      </p>
      {lista.length === 0 ? <Card><Vacio>Todavía no hay plantillas.</Vacio></Card> : lista.map((p) => {
        const [nombre, tono] = ESTADO_PLANTILLA[p.estado] || [p.estado, "tenue"];
        return (
          <Card key={p.id} className="p-4 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold f-m text-sm">{p.nombre}</span>
              <span className="text-[11px] text-texto-tenue">{p.categoria === "UTILITY" ? "utilidad" : "marketing"} · {p.idioma}</span>
              <Sello tono={tono}>{nombre}</Sello>
            </div>
            <p className="text-sm whitespace-pre-wrap">{armarTexto(p.cuerpo, p.ejemplos)}</p>
            {p.variables.length > 0 && <p className="text-[11px] text-texto-tenue">Variables: {p.variables.map((v, i) => `{{${i + 1}}} ${(VARIABLES.find((x) => x[0] === v) || [v, v])[1].toLowerCase()}`).join(" · ")}</p>}
            {p.motivoRechazo && <p className="text-xs text-mal">Meta la rechazó: {p.motivoRechazo}</p>}
            <div className="flex gap-2 pt-1">
              {p.estado === "borrador" && <>
                <Boton size="sm" onClick={() => hacer(p.id, () => mandarPlantillaAMeta(p.id), "Mandada a Meta para aprobar.")} disabled={!!ocupado}><Send size={13} /> {ocupado === p.id ? "Mandando…" : "Mandar a Meta"}</Boton>
                <Boton size="sm" variant="ghost" onClick={() => setEditando(p)}>Editar</Boton>
              </>}
              <Boton size="sm" variant="ghost" onClick={() => hacer("arch", () => archivarPlantilla(p.id), "Plantilla archivada.")} disabled={!!ocupado}>Archivar</Boton>
            </div>
          </Card>
        );
      })}
      {editando && <EditorPlantilla inicial={editando} onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); leer(); }} toast={toast} />}
    </div>
  );
}

function EditorPlantilla({ inicial, onCerrar, onListo, toast }) {
  const [p, setP] = useState({ ...inicial });
  const [guardando, setGuardando] = useState(false);
  const h = useMemo(() => huecos(p.cuerpo), [p.cuerpo]);
  const set = (k) => (e) => setP((x) => ({ ...x, [k]: e.target.value }));
  const setVar = (i, k, v) => setP((x) => {
    const arr = [...(x[k] || [])];
    arr[i] = v;
    return { ...x, [k]: arr };
  });
  const bienNumerados = h.every((n, i) => n === i + 1);
  const guardar = async () => {
    const variables = h.map((_, i) => p.variables[i] || "nombre");
    const ejemplos = h.map((_, i) => String(p.ejemplos[i] || "").trim());
    if (!/^[a-z0-9_]{1,100}$/.test(p.nombre)) return toast("El nombre va en minúsculas, números y guiones bajos (por ejemplo, recordatorio_demo).", "mal");
    if (!bienNumerados) return toast("Las variables tienen que ir en orden: {{1}}, {{2}}, {{3}}…", "mal");
    if (ejemplos.some((x) => !x)) return toast("Cada variable necesita un ejemplo: Meta lo pide para aprobar.", "mal");
    setGuardando(true);
    try { await guardarPlantilla({ ...p, variables, ejemplos }); toast("Plantilla guardada."); onListo(); }
    catch (e) { toast(e.message, "mal"); setGuardando(false); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-xl">
      <div className="p-5 space-y-3">
        <h2 className="f-d text-xl">{inicial.id ? "Editar plantilla" : "Plantilla nueva"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-texto-suave col-span-2">Nombre (para Meta)
            <input value={p.nombre} onChange={set("nombre")} placeholder="recordatorio_demo" className={`${inputCls} f-m`} /></label>
          <label className="block text-xs text-texto-suave">Categoría
            <select value={p.categoria} onChange={set("categoria")} className={inputCls}>
              <option value="UTILITY">Utilidad (recordatorios)</option><option value="MARKETING">Marketing (seguimientos)</option>
            </select></label>
          <label className="block text-xs text-texto-suave">Idioma
            <select value={p.idioma} onChange={set("idioma")} className={inputCls}><option value="es_AR">Español (Argentina)</option><option value="es">Español</option></select></label>
        </div>
        <label className="block text-xs text-texto-suave">Texto
          <textarea value={p.cuerpo} onChange={set("cuerpo")} rows={4} maxLength={1024} className={inputCls}
            placeholder="Hola {{1}}, te recordamos la demo de Genez del {{2}} a las {{3}}. Si no podés, respondé este mensaje." /></label>
        {h.length > 0 && (
          <div className="space-y-2">
            {!bienNumerados && <p className="text-xs text-mal">Las variables tienen que ir en orden: {"{{1}}"}, {"{{2}}"}, {"{{3}}"}…</p>}
            {h.map((n, i) => (
              <div key={n} className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center text-sm">
                <span className="f-m text-texto-suave">{`{{${n}}}`}</span>
                <select value={p.variables[i] || "nombre"} onChange={(e) => setVar(i, "variables", e.target.value)} className={`${inputCls} mt-0`}>
                  {VARIABLES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
                <input value={p.ejemplos[i] || ""} onChange={(e) => setVar(i, "ejemplos", e.target.value)} placeholder="Ejemplo" className={`${inputCls} mt-0`} />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Las corridas ---------- */
function Corridas() {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const leer = useCallback(() => cargarCorridas().then((l) => { setLista(l); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);
  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!lista) return <Card><Cargando /></Card>;
  const ORIGEN = { reloj: "Reloj", servidor: "Envío", manual: "A mano" };
  return (
    <Card className="overflow-hidden">
      {lista.length === 0 ? <Vacio>Todavía no corrió nunca.</Vacio> : (
        <ul className="divide-y divide-borde">
          {lista.map((c) => (
            <li key={c.id} className="px-4 py-2 text-xs flex flex-wrap gap-x-3">
              <span className="f-m text-texto-suave w-28">{fechaHora(new Date(c.empezoEn))}</span>
              <span className="w-14">{ORIGEN[c.origen] || c.origen}</span>
              {c.error ? <span className="text-mal">{c.error}</span> : (
                <span className="text-texto-suave">{c.generados} nuevos · {c.alertas} alertas · {c.enviados} enviados{c.fallidos ? ` · ${c.fallidos} no salieron` : ""}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Las alertas, en el Inicio ---------- */
/* Lo que las reglas de alerta encontraron. Cada una lleva a lo que la
   causó; descartarla la saca para todo el equipo. Sin alertas, no ocupa
   lugar. */
export function AlertasInicio({ abrir, ir, toast }) {
  const [lista, setLista] = useState([]);
  const leer = useCallback(() => cargarAlertasInicio().then(setLista).catch(() => setLista([])), []);
  useEffect(() => { leer(); }, [leer]);
  if (!lista.length) return null;
  const descartar = async (id) => { try { await descartarAlertaInicio(id); leer(); } catch (e) { toast(e.message, "mal"); } };
  return (
    <Card className="p-5">
      <h2 className="f-d text-lg mb-3">Alertas</h2>
      <ul className="divide-y divide-borde">
        {lista.slice(0, 8).map((a) => (
          <li key={a.id} className="py-2 flex items-center gap-3 text-sm" data-alerta={a.tipo}>
            <Sello tono={a.tipo === "conversacion_espera" ? "ojo" : "tenue"}>{a.tipo === "conversacion_espera" ? "conversación" : "oportunidad"}</Sello>
            <button className="flex-1 min-w-0 text-left hover:text-acento truncate"
              onClick={() => (a.enlaceTipo === "prospecto" ? abrir(a.enlaceId) : ir("conversaciones"))}>
              <b>{a.titulo}</b> <span className="text-texto-suave">· {a.detalle}</span>
            </button>
            <button onClick={() => descartar(a.id)} className="text-[11px] text-texto-suave hover:text-texto">Descartar</button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
