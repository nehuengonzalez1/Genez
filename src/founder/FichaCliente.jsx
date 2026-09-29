/* ============================================================
   GENEZ FOUNDER · la ficha del cliente
   ============================================================

   Lo que nació con la venta (importe, plan, renovación, estado), el
   comercio en vivo (módulos y sucursales, leídos de su cuenta en Genez,
   no copiados), la implementación etapa por etapa, sus tickets, sus
   tareas y sus archivos. El historial comercial no se repite acá: es el
   del prospecto, a un botón.
   ============================================================ */

import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { cargarCliente, guardarCliente, guardarEtapa, armarImplementacion, comerciosLibres, ESTADO_CLIENTE, ESTADO_ETAPA, ESTADO_TICKET, abierto } from "../datos/internoClientes.js";
import { guardarTarea } from "../datos/internoCrm.js";
import { useConfig, relativo, vencido, fechaHora, ESTADO_TAREA } from "./util.js";
import { FormTarea } from "./Formularios.jsx";
import { Adjuntos } from "./Adjuntos.jsx";
import { motivosDeAtencion, diaCorto, TONO_CLIENTE } from "./Clientes.jsx";

const TONO_ETAPA = { pendiente: "text-texto-tenue", en_curso: "text-ojo", hecha: "text-bien", bloqueada: "text-mal", no_aplica: "text-texto-tenue line-through" };

export function FichaCliente({ id, volver, abrirProspecto, abrirTicket, nuevoTicket, toast }) {
  const { cfg, de, nombre } = useConfig();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [pestana, setPestana] = useState("resumen");
  const [modal, setModal] = useState(null);
  const leer = useCallback(() => cargarCliente(id).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { leer(); }, [leer]);

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!d || !cfg) return <Card><Cargando /></Card>;
  const c = d.cliente;
  const motivos = motivosDeAtencion(c);
  const cambiar = async (cambios, aviso) => {
    try { await guardarCliente(c.id, cambios); if (aviso) toast(aviso); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  const ticketsAbiertos = d.tickets.filter(abierto);

  return (
    <div className="space-y-4">
      <button onClick={volver} className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto">
        <ChevronLeft size={16} /> Volver
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="f-d text-2xl">{c.nombre}</h1>
              <select value={c.estado} aria-label="Estado del cliente" onChange={(e) => cambiar({ estado: e.target.value }, "Estado cambiado.")}
                className={`text-xs bg-transparent border border-borde rounded-md px-1.5 py-0.5 ${TONO_CLIENTE[c.estado]}`}>
                {Object.entries(ESTADO_CLIENTE).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            </div>
            <p className="text-sm text-texto-suave mt-1">
              {[nombre("rubro", c.rubro), c.localidad, c.plan && `plan ${c.plan}`].filter(Boolean).join(" · ")}
            </p>
            <p className="text-sm mt-2">
              <span className="f-m">{money(Number(c.importeMensual || 0))}</span>/mes · alta {diaCorto(c.alta)}
              {c.renovacion && <> · renueva {diaCorto(c.renovacion)}</>}
            </p>
            {motivos.length > 0 && <p className="text-sm text-mal mt-1">{motivos.join(" · ")}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Boton variant="ghost" onClick={() => abrirProspecto(c.prospectoId)}>Historial comercial</Boton>
            <Boton variant="ghost" onClick={() => setModal({ tipo: "editar" })}>Editar</Boton>
            <Boton onClick={() => nuevoTicket(c.id)}>Nuevo ticket</Boton>
          </div>
        </div>
      </Card>

      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "resumen", n: "Resumen" },
        { k: "implementacion", n: "Implementación", badge: d.etapas.length ? `${d.etapas.filter((e) => ["hecha", "no_aplica"].includes(e.estado)).length}/${d.etapas.length}` : null },
        { k: "tickets", n: "Tickets", badge: ticketsAbiertos.length || null },
        { k: "tareas", n: "Tareas", badge: d.tareas.filter((t) => !["completada", "cancelada"].includes(t.estado)).length || null },
        { k: "archivos", n: "Archivos", badge: d.adjuntos.length || null },
      ]} />

      {pestana === "resumen" && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h2 className="f-d text-lg mb-3">Lo acordado</h2>
            <dl className="text-sm space-y-1.5">
              {[["Importe mensual", `${money(Number(c.importeMensual || 0))}/mes`], ["Plan", c.plan], ["Alta", diaCorto(c.alta)], ["Renovación", diaCorto(c.renovacion)],
                ["Último contacto", c.ultimoContacto ? relativo(c.ultimoContacto) : "nunca"], ["Próximo paso", c.proximaAccion ? `${c.proximaAccion}${c.proximoContacto ? ` · ${fechaHora(c.proximoContacto)}` : ""}` : ""],
                ["Teléfono", c.telefono], ["Email", c.email]]
                .filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-borde pb-1.5"><dt className="text-texto-suave">{k}</dt><dd className="text-right">{v}</dd></div>)}
            </dl>
            {c.notas && <p className="text-sm text-texto-suave whitespace-pre-line mt-3">{c.notas}</p>}
            {c.motivoBaja && <p className="text-sm text-mal mt-2">Motivo de baja: {c.motivoBaja}</p>}
          </Card>
          <Card className="p-5">
            <h2 className="f-d text-lg mb-1">Su cuenta en Genez</h2>
            {d.comercio ? (
              <>
                <p className="text-[11px] text-texto-tenue mb-3">Leído en vivo del comercio: lo que se active allá se ve acá.</p>
                <dl className="text-sm space-y-1.5">
                  {[["Comercio", d.comercio.nombre], ["Rubro", d.comercio.rubro], ["Plan en el sistema", d.comercio.plan], ["Estado", d.comercio.activa ? "Activa" : "Desactivada"],
                    ["Dirección de su app", d.comercio.slug ? `${d.comercio.slug}.genez.com.ar` : ""], ["Sucursales", (d.comercio.sucursales || []).join(", ")]]
                    .filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-borde pb-1.5"><dt className="text-texto-suave">{k}</dt><dd className="text-right">{v}</dd></div>)}
                </dl>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(d.comercio.modulos || []).map((m) => <span key={m} className="text-[11px] px-2 py-0.5 rounded-md border border-borde text-texto-suave">{nombre("modulo", m)}</span>)}
                </div>
              </>
            ) : (
              <div className="text-sm text-texto-suave space-y-3">
                <p>{c.empresaId ? "No se pudo leer el comercio." : "Todavía no está vinculado a un comercio de Genez. Al vincularlo, la ficha muestra sus módulos y sucursales, y la implementación suma los pasos de sus módulos."}</p>
                {!c.empresaId && <Boton size="sm" onClick={() => setModal({ tipo: "vincular" })}>Vincular comercio</Boton>}
              </div>
            )}
          </Card>
        </div>
      )}

      {pestana === "implementacion" && <Implementacion d={d} toast={toast} leer={leer} de={de} nombre={nombre} setModal={setModal} />}

      {pestana === "tickets" && (
        <Card className="overflow-hidden">
          {d.tickets.length === 0 ? <Vacio>Sin tickets.</Vacio> : (
            <ul className="divide-y divide-borde">
              {d.tickets.map((t) => (
                <li key={t.id}>
                  <button onClick={() => abrirTicket(t.id)} className="w-full text-left flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-superficie-2">
                    <span className="f-m text-xs text-texto-tenue w-12">#{t.numero}</span>
                    <span className="flex-1 min-w-0 truncate">{t.titulo}</span>
                    <span className={`text-[11px] ${abierto(t) ? "text-ojo" : "text-texto-tenue"}`}>{ESTADO_TICKET[t.estado]}</span>
                    <span className="text-[11px] text-texto-tenue w-20 text-right">{relativo(t.creadoEn)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-3 border-t border-borde"><Boton size="sm" variant="ghost" onClick={() => nuevoTicket(c.id)}><Plus size={14} /> Ticket</Boton></div>
        </Card>
      )}

      {pestana === "tareas" && (
        <Card className="overflow-hidden">
          {d.tareas.length === 0 ? <Vacio>Sin tareas.</Vacio> : (
            <ul className="divide-y divide-borde">
              {d.tareas.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <input type="checkbox" aria-label="Completar" className="accent-acento" checked={t.estado === "completada"} onChange={async () => {
                    try { await guardarTarea({ id: t.id, estado: t.estado === "completada" ? "pendiente" : "completada" }); leer(); } catch (e) { toast(e.message, "mal"); }
                  }} />
                  <button onClick={() => setModal({ tipo: "tarea", datos: t })} className={`flex-1 text-left ${t.estado === "completada" ? "line-through text-texto-tenue" : ""}`}>{t.titulo}</button>
                  <span className="text-[11px] text-texto-tenue">{ESTADO_TAREA[t.estado]}</span>
                  {t.vence && <span className={`text-[11px] ${t.estado !== "completada" && vencido(t.vence) ? "text-mal" : "text-texto-tenue"}`}>{relativo(t.vence)}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-3 border-t border-borde"><Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "tarea", datos: {} })}><Plus size={14} /> Tarea</Boton></div>
        </Card>
      )}

      {pestana === "archivos" && (
        <Card className="overflow-hidden">
          <Adjuntos area="clientes" tabla="interno_clientes" filaId={c.id} lista={d.adjuntos} onCambio={leer} toast={toast} />
        </Card>
      )}

      {modal && modal.tipo === "tarea" && (
        <FormTarea categorias={de("categoria_tarea")} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }}
          inicial={{ prospectoId: c.prospectoId, prospectoNombre: c.nombre, categoria: "comercial", ...modal.datos }} />
      )}
      {modal && modal.tipo === "editar" && <EditarCliente c={c} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />}
      {modal && modal.tipo === "vincular" && <Vincular c={c} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />}
    </div>
  );
}

/* ---------- La implementación ---------- */
function Implementacion({ d, toast, leer, nombre, setModal }) {
  const [abierta, setAbierta] = useState(() => (d.etapas.find((e) => !["hecha", "no_aplica"].includes(e.estado)) || {}).id);
  const [bloqueando, setBloqueando] = useState(null);
  if (!d.etapas.length) {
    return <Card><Vacio>Entró como un cliente que ya estaba funcionando, sin implementación.</Vacio></Card>;
  }
  const guardar = async (e, cambios, aviso) => {
    try { await guardarEtapa(e.id, cambios); if (aviso) toast(aviso); leer(); } catch (err) { toast(err.message, "mal"); }
  };
  const tildar = (e, i) => {
    const pasos = e.pasos.map((p, j) => (j === i ? { ...p, hecho: !p.hecho } : p));
    guardar(e, { pasos, ...(e.estado === "pendiente" ? { estado: "en_curso" } : {}) });
  };
  const sumarPaso = (e) => {
    const t = window.prompt(`Paso nuevo en "${nombre("etapa_implementacion", e.etapa)}":`);
    if (t && t.trim()) guardar(e, { pasos: [...e.pasos, { titulo: t.trim().slice(0, 200), hecho: false }] });
  };

  return (
    <div className="space-y-2">
      {d.etapas.map((e) => {
        const hechos = e.pasos.filter((p) => p.hecho).length;
        const abiertaEsta = abierta === e.id;
        return (
          <Card key={e.id} className="overflow-hidden">
            <button onClick={() => setAbierta(abiertaEsta ? null : e.id)} className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-superficie-2">
              {abiertaEsta ? <ChevronDown size={16} className="text-texto-tenue" /> : <ChevronRight size={16} className="text-texto-tenue" />}
              <span className={`flex-1 font-medium ${e.estado === "no_aplica" ? "text-texto-tenue" : ""}`}>{nombre("etapa_implementacion", e.etapa)}</span>
              {e.pasos.length > 0 && <span className="f-m text-[11px] text-texto-tenue">{hechos}/{e.pasos.length}</span>}
              <span className={`text-xs w-24 text-right ${TONO_ETAPA[e.estado]}`}>{ESTADO_ETAPA[e.estado]}</span>
            </button>
            {abiertaEsta && (
              <div className="px-5 pb-4 space-y-3 border-t border-borde pt-3">
                {e.bloqueo && e.estado === "bloqueada" && <p className="text-sm text-mal">Bloqueada: {e.bloqueo}</p>}
                {e.pasos.length > 0 && (
                  <ul className="space-y-1">
                    {e.pasos.map((p, i) => (
                      <li key={i}>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="accent-acento" checked={!!p.hecho} onChange={() => tildar(e, i)} />
                          <span className={p.hecho ? "line-through text-texto-tenue" : ""}>{p.titulo}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid sm:grid-cols-2 gap-3">
                  <label><span className="block text-xs text-texto-suave">Fecha</span>
                    <input type="date" value={e.fecha || ""} onChange={(ev) => guardar(e, { fecha: ev.target.value || null })} className={inputCls} />
                  </label>
                  <label><span className="block text-xs text-texto-suave">Notas</span>
                    <textarea defaultValue={e.notas || ""} rows={1} onBlur={(ev) => ev.target.value !== (e.notas || "") && guardar(e, { notas: ev.target.value })} className={inputCls} />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.estado !== "hecha" && <Boton size="sm" onClick={() => guardar(e, { estado: "hecha", bloqueo: null, fecha: e.fecha || new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) }, "Etapa hecha.")}>Marcar hecha</Boton>}
                  {e.estado === "hecha" && <Boton size="sm" variant="ghost" onClick={() => guardar(e, { estado: "en_curso" })}>Reabrir</Boton>}
                  {e.estado !== "bloqueada" && e.estado !== "hecha" && <Boton size="sm" variant="ghost" onClick={() => setBloqueando(e)}>Bloqueada</Boton>}
                  {e.estado === "bloqueada" && <Boton size="sm" variant="ghost" onClick={() => guardar(e, { estado: "en_curso", bloqueo: null }, "Desbloqueada.")}>Desbloquear</Boton>}
                  {e.estado !== "no_aplica" ? <Boton size="sm" variant="quiet" onClick={() => guardar(e, { estado: "no_aplica" })}>No aplica</Boton>
                    : <Boton size="sm" variant="quiet" onClick={() => guardar(e, { estado: "pendiente" })}>Sí aplica</Boton>}
                  <Boton size="sm" variant="quiet" onClick={() => sumarPaso(e)}><Plus size={13} /> Paso</Boton>
                  <Boton size="sm" variant="quiet" onClick={() => setModal({ tipo: "tarea", datos: { titulo: nombre("etapa_implementacion", e.etapa), implEtapaId: e.id, categoria: "comercial" } })}>Tarea</Boton>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      <p className="text-[11px] text-texto-tenue px-1">
        Los pasos salen del modelo de Configuración según el rubro y los módulos. Con todas las etapas hechas o sin aplicar, el cliente pasa a activo solo.{" "}
        <button className="underline hover:text-texto" onClick={async () => {
          try { const n = await armarImplementacion(d.cliente.id); toast(n ? `Se sumaron ${n} pasos.` : "No faltaba ningún paso."); leer(); } catch (err) { toast(err.message, "mal"); }
        }}>Sumar los pasos que falten</button>
      </p>
      {bloqueando && <Bloqueo onCerrar={() => setBloqueando(null)} toast={toast}
        onGuardar={(b) => { const e = bloqueando; setBloqueando(null); guardar(e, { estado: "bloqueada", bloqueo: b }, "Marcada como bloqueada."); }} />}
    </div>
  );
}

/* Sin <form>: Boton no tiene type, y adentro de un form "Cancelar"
   también lo mandaba. */
function Bloqueo({ onCerrar, onGuardar, toast }) {
  const [b, setB] = useState("");
  const listo = () => (b.trim() ? onGuardar(b.trim()) : toast("Contá qué la bloquea.", "mal"));
  return (
    <Modal open onClose={onCerrar} ancho="max-w-sm">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-lg">¿Qué la bloquea?</h3>
        <input value={b} onChange={(e) => setB(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") listo(); }} autoFocus
          placeholder="Ej: esperando la lista de precios del dueño" className={inputCls} />
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton><Boton onClick={listo}>Guardar</Boton></div>
      </div>
    </Modal>
  );
}

/* ---------- Editar lo acordado ---------- */
function EditarCliente({ c, onCerrar, onListo, toast }) {
  const [d, setD] = useState({ importeMensual: String(Number(c.importeMensual || 0)), plan: c.plan || "", alta: c.alta || "", renovacion: c.renovacion || "", notas: c.notas || "", motivoBaja: c.motivoBaja || "" });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    if (!(Number(d.importeMensual) >= 0)) return toast("El importe tiene que ser un número.", "mal");
    try { await guardarCliente(c.id, { ...d, importeMensual: Number(d.importeMensual), renovacion: d.renovacion || null }); toast("Guardado."); onListo(); }
    catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">Editar {c.nombre}</h3>
        <p className="text-[11px] text-texto-tenue">Nombre, teléfonos y contactos son del negocio: se editan en su historial comercial.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className="block text-xs text-texto-suave">Importe mensual</span><input value={d.importeMensual} onChange={set("importeMensual")} inputMode="numeric" className={`${inputCls} f-m`} /></label>
          <label><span className="block text-xs text-texto-suave">Plan</span><input value={d.plan} onChange={set("plan")} className={inputCls} /></label>
          <label><span className="block text-xs text-texto-suave">Alta</span><input type="date" value={d.alta} onChange={set("alta")} className={inputCls} /></label>
          <label><span className="block text-xs text-texto-suave">Renovación</span><input type="date" value={d.renovacion} onChange={set("renovacion")} className={inputCls} /></label>
          <label className="sm:col-span-2"><span className="block text-xs text-texto-suave">Notas</span><textarea value={d.notas} onChange={set("notas")} rows={3} className={inputCls} /></label>
          {["cancelado", "pausado"].includes(c.estado) && (
            <label className="sm:col-span-2"><span className="block text-xs text-texto-suave">Motivo de la baja o la pausa</span><input value={d.motivoBaja} onChange={set("motivoBaja")} className={inputCls} /></label>
          )}
        </div>
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></div>
      </div>
    </Modal>
  );
}

/* ---------- Vincular el comercio ---------- */
function Vincular({ c, onCerrar, onListo, toast }) {
  const [lista, setLista] = useState(null);
  const [elegido, setElegido] = useState("");
  useEffect(() => { comerciosLibres().then(setLista).catch((e) => { setLista([]); toast(e.message, "mal"); }); }, []);
  const guardar = async () => {
    if (!elegido) return toast("Elegí el comercio.", "mal");
    try {
      await guardarCliente(c.id, { empresaId: elegido });
      const n = await armarImplementacion(c.id).catch(() => 0);
      toast(n ? `Vinculado. La implementación sumó ${n} pasos de sus módulos.` : "Vinculado.");
      onListo();
    } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-sm">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-lg">Vincular con su comercio</h3>
        <select value={elegido} onChange={(e) => setElegido(e.target.value)} className={inputCls} disabled={!lista}>
          <option value="">{lista ? (lista.length ? "Elegí uno" : "No hay comercios sin vincular") : "Cargando…"}</option>
          {(lista || []).map((x) => <option key={x.id} value={x.id}>{x.nombre}{x.rubro ? ` · ${x.rubro}` : ""}</option>)}
        </select>
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Vincular</Boton></div>
      </div>
    </Modal>
  );
}
