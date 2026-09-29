/* ============================================================
   GENEZ FOUNDER · clientes
   ============================================================

   Los que compraron. Arriba, los que requieren atención y por qué: el
   motivo es lo que hace falta para decidir qué hacer, un número rojo
   solo no alcanza. Un cliente nace de una oportunidad ganada (en el
   pipeline o en la ficha del prospecto) o, si ya usaba Genez antes de
   Founder, desde su comercio.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Search, Store } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { cargarClientes, convertirEnCliente, clienteDesdeComercio, comerciosLibres, ESTADO_CLIENTE } from "../datos/internoClientes.js";
import { useConfig, hoyAR, relativo } from "./util.js";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const diasHasta = (dia) => (dia ? Math.round((new Date(`${dia}T12:00:00-03:00`) - new Date(`${hoyAR()}T12:00:00-03:00`)) / 86400000) : null);
export const diaCorto = (dia) => (dia ? dia.split("-").reverse().join("/") : "");
export const TONO_CLIENTE = { implementacion: "text-ojo", activo: "text-bien", en_riesgo: "text-mal", pausado: "text-texto-tenue", cancelado: "text-texto-tenue" };

/* Por qué un cliente requiere atención. Vacío = está bien. */
export function motivosDeAtencion(c) {
  if (c.estado === "cancelado") return [];
  const m = [];
  if (c.estado === "en_riesgo") m.push("Está en riesgo");
  if (c.implBloqueadas) m.push(`Implementación bloqueada (${c.implBloqueadas})`);
  if (c.ticketsUrgentes) m.push(`${c.ticketsUrgentes} ticket${c.ticketsUrgentes > 1 ? "s" : ""} urgente${c.ticketsUrgentes > 1 ? "s" : ""}`);
  if (c.tareasVencidas) m.push(`${c.tareasVencidas} tarea${c.tareasVencidas > 1 ? "s" : ""} vencida${c.tareasVencidas > 1 ? "s" : ""}`);
  const r = diasHasta(c.renovacion);
  if (r !== null && r <= 30) m.push(r < 0 ? "Renovación vencida" : `Renueva en ${r} días`);
  const alta = diasHasta(c.alta);
  if (c.estado === "implementacion" && alta !== null && alta < -30) m.push(`En implementación hace ${-alta} días`);
  /* Sin ningún contacto registrado, se cuenta desde el alta: un cliente
     cargado hoy no lleva un mes sin hablar con nadie. */
  const desde = c.ultimoContacto || (c.alta ? new Date(`${c.alta}T12:00:00-03:00`) : null);
  if (c.estado === "activo" && desde && Date.now() - desde.getTime() > 30 * 86400000) m.push("Más de 30 días sin contacto");
  return m;
}

export function Clientes({ abrirCliente, toast }) {
  const { cfg, nombre } = useConfig();
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [vista, setVista] = useState("atencion");
  const [q, setQ] = useState("");
  const [desdeComercio, setDesdeComercio] = useState(false);
  const leer = () => cargarClientes().then(setLista).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);

  const conMotivos = useMemo(() => (lista || []).map((c) => ({ ...c, motivos: motivosDeAtencion(c) })), [lista]);
  const visibles = conMotivos.filter((c) => (!q.trim() || norm(c.nombre).includes(norm(q)) || norm(c.localidad).includes(norm(q)))
    && (vista === "todos" || (vista === "atencion" ? c.motivos.length > 0 : c.estado === vista)));
  const vigentes = conMotivos.filter((c) => ["implementacion", "activo", "en_riesgo"].includes(c.estado));
  const recurrente = vigentes.reduce((s, c) => s + Number(c.importeMensual || 0), 0);
  const atencion = conMotivos.filter((c) => c.motivos.length).length;

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!lista || !cfg) return <Card><Cargando /></Card>;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-d text-3xl">Clientes</h1>
          <p className="text-sm text-texto-suave mt-1">
            <span className="f-m">{vigentes.length}</span> {vigentes.length === 1 ? "vigente" : "vigentes"} · <span className="f-m">{money(Math.round(recurrente))}</span>/mes acordado
            <span className="text-texto-tenue"> (lo pactado, no lo cobrado: los cobros llegan con Finanzas)</span>
          </p>
        </div>
        <Boton variant="ghost" onClick={() => setDesdeComercio(true)}><Store size={14} /> Ya era cliente</Boton>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={vista} onChange={setVista} items={[
          { k: "atencion", n: "Requieren atención", badge: atencion || null },
          { k: "implementacion", n: "En implementación" }, { k: "activo", n: "Activos" }, { k: "en_riesgo", n: "En riesgo" },
          { k: "todos", n: "Todos" },
        ]} />
        <div className="relative w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={`${inputCls} pl-9 mt-0`} />
        </div>
      </div>

      {lista.length === 0 ? (
        <Card><Vacio>
          Todavía no hay clientes. Nacen de una oportunidad ganada, en el pipeline o en la ficha del prospecto. Los comercios que ya usaban Genez se suman con "Ya era cliente".
        </Vacio></Card>
      ) : visibles.length === 0 ? (
        <Card><Vacio>{vista === "atencion" ? "Ningún cliente requiere atención ahora." : "Ninguno acá."}</Vacio></Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-borde">
            {visibles.map((c) => (
              <li key={c.id}>
                <button onClick={() => abrirCliente(c.id)} className="w-full text-left flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-superficie-2">
                  <span className="flex-1 min-w-[12rem]">
                    <span className="font-medium">{c.nombre}</span>
                    <span className="block text-[11px] text-texto-tenue">{[nombre("rubro", c.rubro), c.localidad, c.plan].filter(Boolean).join(" · ")}</span>
                    {c.motivos.length > 0 && <span className="block text-[12px] text-mal mt-0.5">{c.motivos.join(" · ")}</span>}
                  </span>
                  <span className={`text-xs ${TONO_CLIENTE[c.estado]}`}>{ESTADO_CLIENTE[c.estado]}</span>
                  {c.estado === "implementacion" && c.implTotal > 0 && (
                    <span className="flex items-center gap-2 w-28">
                      <span className="flex-1 h-1.5 rounded bg-superficie-2 overflow-hidden"><span className="block h-full bg-acento" style={{ width: `${(c.implHechas / c.implTotal) * 100}%` }} /></span>
                      <span className="f-m text-[11px] text-texto-tenue">{c.implHechas}/{c.implTotal}</span>
                    </span>
                  )}
                  <span className="f-m text-sm w-28 text-right">{money(Number(c.importeMensual || 0))}/mes</span>
                  <span className="hidden sm:inline text-[11px] text-texto-tenue w-24 text-right">{c.ultimoContacto ? relativo(c.ultimoContacto) : "sin contacto"}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {desdeComercio && <AltaCliente modo="comercio" toast={toast} onCerrar={() => setDesdeComercio(false)} onListo={(id) => { setDesdeComercio(false); leer(); abrirCliente(id); }} />}
    </div>
  );
}

/* Afuera del componente: definida adentro, cada tecla la volvía a crear
   y el campo perdía el foco. */
const L = ({ t, children, className = "" }) => <label className={className}><span className="block text-xs text-texto-suave">{t}</span>{children}</label>;

/* El alta: desde una oportunidad ganada (modo "oportunidad") o desde un
   comercio que ya usaba Genez (modo "comercio"). En los dos casos se
   puede vincular el comercio, que es de donde salen módulos y sucursales. */
export function AltaCliente({ modo, oportunidad, nombreNegocio, onCerrar, onListo, toast }) {
  const hoy = hoyAR();
  const [d, setD] = useState({
    importeMensual: oportunidad && Number(oportunidad.valor) ? String(Number(oportunidad.valor)) : "", plan: (oportunidad && oportunidad.plan) || "",
    alta: hoy, renovacion: "", empresaId: "", notas: "", sinImplementacion: modo === "comercio",
  });
  const [comercios, setComercios] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  useEffect(() => { comerciosLibres().then(setComercios).catch((e) => { setComercios([]); toast(e.message, "mal"); }); }, []);

  const guardar = async () => {
    if (modo === "comercio" && !d.empresaId) return toast("Elegí el comercio.", "mal");
    if (d.importeMensual !== "" && !(Number(d.importeMensual) >= 0)) return toast("El importe tiene que ser un número.", "mal");
    if (d.renovacion && d.renovacion < d.alta) return toast("La renovación no puede ser antes del alta.", "mal");
    setGuardando(true);
    try {
      const id = modo === "comercio" ? await clienteDesdeComercio(d.empresaId, d) : await convertirEnCliente(oportunidad.id, d);
      toast(d.sinImplementacion ? "Cliente dado de alta." : "Cliente dado de alta, con su implementación y sus recordatorios.");
      onListo(id);
    } catch (e) { toast(e.message, "mal"); setGuardando(false); }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5 space-y-4">
        <div>
          <h3 className="f-d text-xl">{modo === "comercio" ? "Un comercio que ya era cliente" : "Pasar a cliente"}</h3>
          <p className="text-sm text-texto-suave">
            {modo === "comercio" ? "Se crea su ficha con el nombre y el rubro del comercio, y su oportunidad queda ganada en el historial." : nombreNegocio}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <L t={modo === "comercio" ? "Comercio *" : "Su comercio en Genez"} className="sm:col-span-2">
            <select value={d.empresaId} onChange={set("empresaId")} className={inputCls} disabled={!comercios}>
              <option value="">{!comercios ? "Cargando…" : modo === "comercio" ? "Elegí uno" : "Todavía no tiene (se vincula después)"}</option>
              {(comercios || []).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.rubro ? ` · ${c.rubro}` : ""}</option>)}
            </select>
          </L>
          <L t="Importe mensual"><input value={d.importeMensual} onChange={set("importeMensual")} inputMode="numeric" placeholder="0" className={`${inputCls} f-m`} /></L>
          <L t="Plan"><input value={d.plan} onChange={set("plan")} placeholder="Ej: Pro" className={inputCls} /></L>
          <L t="Alta"><input type="date" value={d.alta} onChange={set("alta")} className={inputCls} /></L>
          <L t="Renovación"><input type="date" value={d.renovacion} onChange={set("renovacion")} className={inputCls} /></L>
          <L t="Notas" className="sm:col-span-2"><textarea value={d.notas} onChange={set("notas")} rows={2} className={inputCls} /></L>
        </div>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={d.sinImplementacion} onChange={set("sinImplementacion")} className="accent-acento mt-0.5" />
          <span>Ya está funcionando <span className="block text-[11px] text-texto-tenue">Sin implementación: entra como activo, y solo con el recordatorio de la renovación.</span></span>
        </label>
        <div className="flex justify-end gap-2">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : "Dar de alta"}</Boton>
        </div>
      </div>
    </Modal>
  );
}
