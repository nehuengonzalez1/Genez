/* ============================================================
   GENEZ FOUNDER · la ficha del prospecto
   ============================================================

   El historial de la relación comercial, de arriba abajo: quién es,
   qué pasó (la línea de tiempo, que incluye los cambios de etapa que
   anota la base), con quién se habla, qué se le quiere vender, qué hay
   que hacer y qué está agendado. "Registrar seguimiento" es el botón
   de todos los días: lo que pasó y lo que sigue, en un solo paso.

   Archivos llega con Storage (fase 3): no hay pestaña vacía.
   ============================================================ */

import React, { useEffect, useState, useCallback } from "react";
import { ChevronLeft, MessageCircle, Phone, Mail, Plus, CalendarPlus, ListPlus, Archive } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { cargarProspecto, editarProspecto, archivarProspecto, guardarOportunidad, guardarTarea, posiblesDuplicados, archivarContacto } from "../datos/internoCrm.js";
import { useConfig, fechaHora, fecha, relativo, vencido, INTERES, PRIORIDAD, ESTADO_TAREA, linkWA, aInput } from "./util.js";
import { SeguimientoRapido, FormTarea, FormEvento, FormContacto } from "./Formularios.jsx";

export function Ficha({ id, volver, toast }) {
  const { cfg, de, nombre } = useConfig();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [pestana, setPestana] = useState("actividad");
  const [modal, setModal] = useState(null);       // { tipo, datos }
  const leer = useCallback(() => cargarProspecto(id).then(setD).catch((e) => setError(e.message)), [id]);
  useEffect(() => { leer(); }, [leer]);
  const listo = () => { setModal(null); leer(); };

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!d || !cfg) return <Card><Cargando /></Card>;
  const p = d.prospecto;
  const abierta = d.oportunidades.find((o) => o.estado === "abierta") || d.oportunidades[d.oportunidades.length - 1] || null;
  const notas = d.actividades.filter((a) => a.tipo === "nota");
  const wa = linkWA(p.whatsapp || p.telefono);
  const tipoActividad = (t) => (t === "cambio_etapa" ? "Cambio de etapa" : nombre("tipo_actividad", t));

  return (
    <div className="space-y-4">
      <button onClick={volver} className="inline-flex items-center gap-1.5 text-sm font-semibold text-texto-suave hover:text-texto">
        <ChevronLeft size={16} /> Prospectos
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="f-d text-2xl">{p.nombre}</h1>
              {p.etapaNombre && <span className="text-xs px-2 py-0.5 rounded-md border border-acento text-acento">{p.etapaNombre}</span>}
              {p.interes && <span className="text-xs text-texto-tenue">{INTERES[p.interes]}</span>}
              {p.archivadoEn && <span className="text-xs text-texto-tenue">archivado</span>}
            </div>
            <p className="text-sm text-texto-suave mt-1">
              {[nombre("rubro", p.rubro), p.direccion, p.localidad || nombre("zona", p.zona)].filter(Boolean).join(" · ") || "Sin rubro ni dirección"}
            </p>
            <p className="text-sm mt-2">
              {p.proximoContacto
                ? <><span className={vencido(p.proximoContacto) ? "text-mal font-semibold" : "text-texto"}>Próximo: {relativo(p.proximoContacto)}</span>
                    <span className="text-texto-suave"> · {fechaHora(p.proximoContacto)}{p.proximaAccion ? ` · ${p.proximaAccion}` : ""}</span></>
                : <span className="text-ojo">Sin próximo paso</span>}
              {p.ultimoContacto && <span className="text-texto-tenue"> · último contacto {relativo(p.ultimoContacto)}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-borde hover:bg-superficie-2"><MessageCircle size={14} /> WhatsApp</a>}
            {p.telefono && <a href={`tel:${p.telefono}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-borde hover:bg-superficie-2"><Phone size={14} /> Llamar</a>}
            {p.email && <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-borde hover:bg-superficie-2"><Mail size={14} /> Mail</a>}
            <Boton onClick={() => setModal({ tipo: "seguimiento" })}>Registrar seguimiento</Boton>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-borde">
          <Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "tarea" })}><ListPlus size={14} /> Tarea</Boton>
          <Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "evento" })}><CalendarPlus size={14} /> Agendar</Boton>
          <Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "editar" })}>Editar datos</Boton>
          <Boton size="sm" variant="ghost" onClick={async () => {
            if (!p.archivadoEn && !window.confirm(`¿Archivar ${p.nombre}? Sale de las listas de seguimiento; no se borra nada y se puede volver a traer.`)) return;
            try { await archivarProspecto(p.id, !p.archivadoEn); toast(p.archivadoEn ? "Vuelve al seguimiento." : "Archivado."); leer(); } catch (e) { toast(e.message, "mal"); }
          }}><Archive size={14} /> {p.archivadoEn ? "Desarchivar" : "Archivar"}</Boton>
        </div>
      </Card>

      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "actividad", n: "Actividad", badge: d.actividades.length || null },
        { k: "resumen", n: "Resumen" },
        { k: "contactos", n: "Contactos", badge: d.contactos.length || null },
        { k: "oportunidades", n: "Oportunidades", badge: d.oportunidades.length || null },
        { k: "tareas", n: "Tareas", badge: d.tareas.filter((t) => !["completada", "cancelada"].includes(t.estado)).length || null },
        { k: "reuniones", n: "Reuniones", badge: d.eventos.length || null },
        { k: "notas", n: "Notas", badge: notas.length || null },
        { k: "historial", n: "Historial" },
      ]} />

      <Card className="overflow-hidden">
        {pestana === "actividad" && (d.actividades.length === 0
          ? <Vacio>Todavía no hay contactos registrados. "Registrar seguimiento" deja lo que pasó y lo que sigue.</Vacio>
          : <ul className="divide-y divide-borde">
              {d.actividades.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`text-sm font-semibold ${a.tipo === "cambio_etapa" ? "text-texto-suave" : ""}`}>{tipoActividad(a.tipo)}</span>
                    <span className="f-m text-[11px] text-texto-tenue shrink-0">{fechaHora(a.fecha)}</span>
                  </div>
                  {a.resultado && <p className="text-sm mt-0.5">{a.resultado}</p>}
                  {a.notas && <p className="text-sm text-texto-suave mt-0.5 whitespace-pre-line">{a.notas}</p>}
                  {a.proximaAccion && <p className="text-xs text-texto-tenue mt-1">Próximo: {a.proximaAccion}{a.proximaFecha ? ` · ${fechaHora(a.proximaFecha)}` : ""}</p>}
                  {a.tipo === "cambio_etapa" && a.datos && a.datos.motivo && <p className="text-xs text-texto-tenue mt-1">Motivo: {nombre("motivo_perdida", a.datos.motivo)}</p>}
                </li>
              ))}
            </ul>)}

        {pestana === "resumen" && (
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 p-5 text-sm">
            {[["Razón social", p.razonSocial], ["Rubro", nombre("rubro", p.rubro)], ["Subrubro", p.subrubro], ["Zona", nombre("zona", p.zona)], ["Localidad", p.localidad],
              ["Dirección", p.direccion], ["Sucursales", p.sucursales], ["Teléfono", p.telefono], ["WhatsApp", p.whatsapp], ["Email", p.email], ["Instagram", p.instagram],
              ["Web", p.web], ["Fuente", nombre("fuente", p.fuente)], ["Campaña", p.campania], ["Sistema actual", p.sistemaActual], ["Competidor", p.competidor],
              ["Usuarios", p.usuarios], ["Tamaño", p.tamano], ["Presupuesto", p.presupuesto ? money(Number(p.presupuesto)) : ""], ["Módulos de interés", (p.modulos || []).join(", ")],
              ["Etiquetas", (p.etiquetas || []).join(", ")], ["Alta", fecha(p.creadoEn)]]
              .filter(([, v]) => v !== null && v !== undefined && v !== "")
              .map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-borde py-1.5"><dt className="text-texto-suave">{k}</dt><dd className="text-right">{v}</dd></div>)}
            {[["Problemas", p.problemas], ["Necesidades", p.necesidades], ["Objeciones", p.objeciones], ["Descripción", p.descripcion], ["Notas", p.notas]]
              .filter(([, v]) => v).map(([k, v]) => <div key={k} className="sm:col-span-2 py-1.5"><dt className="text-texto-suave">{k}</dt><dd className="whitespace-pre-line mt-0.5">{v}</dd></div>)}
          </dl>
        )}

        {pestana === "contactos" && (
          <div>
            {d.contactos.length === 0 ? <Vacio>Sin contactos cargados.</Vacio> : (
              <ul className="divide-y divide-borde">
                {d.contactos.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="flex-1 min-w-0">
                      <span className="font-medium">{c.nombre}</span>{c.principal && <span className="text-[11px] text-acento ml-2">principal</span>}
                      <span className="block text-[11px] text-texto-tenue">{[c.cargo, c.telefono, c.whatsapp, c.email].filter(Boolean).join(" · ")}</span>
                    </span>
                    {linkWA(c.whatsapp || c.telefono) && <a href={linkWA(c.whatsapp || c.telefono)} target="_blank" rel="noreferrer" className="text-xs text-texto-suave hover:text-texto">WhatsApp</a>}
                    <Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "contacto", datos: c })}>Editar</Boton>
                    <Boton size="sm" variant="quiet" onClick={async () => {
                      if (!window.confirm(`¿Sacar a ${c.nombre} de los contactos?`)) return;
                      try { await archivarContacto(c.id); leer(); } catch (e) { toast(e.message, "mal"); }
                    }}>Sacar</Boton>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-3 border-t border-borde"><Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "contacto", datos: {} })}><Plus size={14} /> Contacto</Boton></div>
          </div>
        )}

        {pestana === "oportunidades" && (
          <div>
            <ul className="divide-y divide-borde">
              {d.oportunidades.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="flex-1 min-w-0">
                    <span className="font-medium">{o.nombre}</span>
                    <span className="block text-[11px] text-texto-tenue">
                      {[o.etapa && o.etapa.nombre, `${o.probabilidad}%`, o.plan, o.cierreEstimado && `cierre ${fecha(o.cierreEstimado)}`, o.motivoPerdida && `perdida: ${nombre("motivo_perdida", o.motivoPerdida)}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="f-m">{Number(o.valor) ? `${money(Number(o.valor))}/mes` : "sin valor"}</span>
                  <Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "oportunidad", datos: o })}>Editar</Boton>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 border-t border-borde">
              <Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "oportunidad", datos: { prospectoId: p.id, nombre: `Genez para ${p.nombre}`, etapaId: cfg.etapas[0] && cfg.etapas[0].id } })}>
                <Plus size={14} /> Oportunidad
              </Boton>
            </div>
          </div>
        )}

        {pestana === "tareas" && (
          <div>
            {d.tareas.length === 0 ? <Vacio>Sin tareas para este prospecto.</Vacio> : (
              <ul className="divide-y divide-borde">
                {d.tareas.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <input type="checkbox" className="accent-acento" checked={t.estado === "completada"} onChange={async () => {
                      try { await guardarTarea({ id: t.id, estado: t.estado === "completada" ? "pendiente" : "completada" }); leer(); } catch (e) { toast(e.message, "mal"); }
                    }} />
                    <button onClick={() => setModal({ tipo: "tarea", datos: t })} className={`flex-1 text-left ${t.estado === "completada" ? "line-through text-texto-tenue" : ""}`}>{t.titulo}</button>
                    <span className="text-[11px] text-texto-tenue">{ESTADO_TAREA[t.estado]} · {PRIORIDAD[t.prioridad]}</span>
                    {t.vence && <span className={`text-[11px] ${t.estado !== "completada" && vencido(t.vence) ? "text-mal" : "text-texto-tenue"}`}>{relativo(t.vence)}</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-3 border-t border-borde"><Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "tarea" })}><Plus size={14} /> Tarea</Boton></div>
          </div>
        )}

        {pestana === "reuniones" && (
          <div>
            {d.eventos.length === 0 ? <Vacio>Nada agendado con este prospecto.</Vacio> : (
              <ul className="divide-y divide-borde">
                {d.eventos.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="f-m text-xs text-texto-tenue w-28">{fechaHora(e.inicio)}</span>
                    <button onClick={() => setModal({ tipo: "evento", datos: e })} className="flex-1 text-left">
                      {e.titulo} <span className="text-[11px] text-texto-tenue">· {nombre("tipo_evento", e.tipo)}</span>
                    </button>
                    <span className={`text-[11px] ${e.estado === "realizado" ? "text-bien" : e.estado === "cancelado" ? "text-texto-tenue line-through" : "text-texto-suave"}`}>{e.estado}</span>
                    {e.estado === "programado" && e.inicio < new Date() && <Boton size="sm" onClick={() => setModal({ tipo: "resultado", datos: e })}>¿Cómo salió?</Boton>}
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-3 border-t border-borde"><Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "evento" })}><Plus size={14} /> Agendar</Boton></div>
          </div>
        )}

        {pestana === "notas" && (
          <div>
            {notas.length === 0 ? <Vacio>Sin notas internas.</Vacio> : (
              <ul className="divide-y divide-borde">
                {notas.map((n) => (
                  <li key={n.id} className="px-5 py-3 text-sm">
                    <div className="f-m text-[11px] text-texto-tenue">{fechaHora(n.fecha)}</div>
                    <p className="whitespace-pre-line mt-0.5">{[n.resultado, n.notas].filter(Boolean).join("\n")}</p>
                    <button className="text-xs text-texto-suave hover:text-texto mt-1" onClick={() => setModal({ tipo: "tarea", datos: { titulo: n.resultado || String(n.notas || "").slice(0, 120) } })}>Convertir en tarea</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="px-5 py-3 border-t border-borde"><Boton size="sm" variant="ghost" onClick={() => setModal({ tipo: "seguimiento", nota: true })}><Plus size={14} /> Nota</Boton></div>
          </div>
        )}

        {pestana === "historial" && (d.historial.length === 0 ? <Vacio>Sin cambios registrados.</Vacio> : (
          <ul className="divide-y divide-borde">
            {d.historial.map((h) => (
              <li key={h.id} className="px-5 py-2.5 text-sm">
                <div className="flex justify-between gap-3"><span className="font-medium">{h.accion === "alta" ? "Alta" : h.accion === "cambio" ? "Cambio" : h.accion}</span><span className="f-m text-[11px] text-texto-tenue">{fechaHora(h.fecha)}</span></div>
                {h.accion === "cambio" && <p className="text-xs text-texto-suave mt-0.5">{Object.keys(h.cambios || {}).filter((k) => !k.endsWith("_norm")).join(", ")}</p>}
              </li>
            ))}
          </ul>
        ))}
      </Card>

      {modal && modal.tipo === "seguimiento" && (
        <SeguimientoRapido prospecto={p} oportunidad={abierta} etapas={cfg.etapas} motivos={de("motivo_perdida")}
          tipos={modal.nota ? de("tipo_actividad").filter((t) => t.clave === "nota") : de("tipo_actividad")}
          onCerrar={() => setModal(null)} onListo={listo} toast={toast} />
      )}
      {modal && modal.tipo === "tarea" && (
        <FormTarea categorias={de("categoria_tarea")} toast={toast} onCerrar={() => setModal(null)} onListo={listo}
          inicial={{ prospectoId: p.id, oportunidadId: abierta && abierta.id, categoria: "comercial", prospectoNombre: p.nombre, ...(modal.datos || {}) }} />
      )}
      {modal && (modal.tipo === "evento" || modal.tipo === "resultado") && (
        <FormEvento tipos={de("tipo_evento")} toast={toast} registrar={modal.tipo === "resultado"} onCerrar={() => setModal(null)} onListo={listo}
          inicial={{ prospectoId: p.id, oportunidadId: abierta && abierta.id, titulo: `Reunión · ${p.nombre}`, prospectoNombre: p.nombre, ...(modal.datos || {}) }} />
      )}
      {modal && modal.tipo === "contacto" && <FormContacto prospectoId={p.id} inicial={modal.datos} toast={toast} onCerrar={() => setModal(null)} onListo={listo} />}
      {modal && modal.tipo === "oportunidad" && <FormOportunidad inicial={modal.datos} etapas={cfg.etapas} motivos={de("motivo_perdida")} toast={toast} onCerrar={() => setModal(null)} onListo={listo} />}
      {modal && modal.tipo === "editar" && <EditarProspecto p={p} de={de} toast={toast} onCerrar={() => setModal(null)} onListo={listo} />}
    </div>
  );
}

/* ---------- La oportunidad ---------- */
function FormOportunidad({ inicial, etapas, motivos, onCerrar, onListo, toast }) {
  const [d, setD] = useState({ valor: "", plan: "", probabilidad: "", proximaAccion: "", motivoPerdida: "", ...inicial,
    cierreEstimado: inicial.cierreEstimado ? String(inicial.cierreEstimado).slice(0, 10) : "",
    modulos: (inicial.modulos || []).join(", "), fechaSeguimiento: aInput(inicial.fechaSeguimiento) });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const etapa = etapas.find((e) => e.id === d.etapaId);
  const guardar = async () => {
    if (!String(d.nombre || "").trim()) return toast("Poné un nombre.", "mal");
    if (etapa && etapa.tipo === "perdida" && !d.motivoPerdida) return toast("Elegí por qué se perdió.", "mal");
    try {
      await guardarOportunidad({
        id: d.id, prospectoId: d.prospectoId, nombre: d.nombre.trim(), etapaId: d.etapaId, valor: Number(String(d.valor).replace(/\D/g, "")) || 0,
        plan: d.plan || null, modulos: d.modulos.split(",").map((x) => x.trim()).filter(Boolean), cierreEstimado: d.cierreEstimado || null,
        ...(d.id && d.probabilidad !== "" && Number(d.probabilidad) !== inicial.probabilidad ? { probabilidad: Math.min(100, Math.max(0, Number(d.probabilidad))) } : {}),
        proximaAccion: d.proximaAccion || null, motivoPerdida: etapa && etapa.tipo === "perdida" ? d.motivoPerdida : null,
      });
      toast("Oportunidad guardada."); onListo();
    } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-xl">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">Oportunidad</h3>
        <input value={d.nombre || ""} onChange={set("nombre")} className={inputCls} />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-texto-suave">Etapa
            <select value={d.etapaId || ""} onChange={set("etapaId")} className={`${inputCls} mt-1`}>{etapas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}</select>
          </label>
          <label className="text-xs text-texto-suave">Valor por mes ($)<input value={d.valor} onChange={set("valor")} inputMode="numeric" className={`${inputCls} mt-1 f-m`} /></label>
          <label className="text-xs text-texto-suave">Plan de interés<input value={d.plan || ""} onChange={set("plan")} className={`${inputCls} mt-1`} /></label>
          <label className="text-xs text-texto-suave">Cierre estimado<input type="date" value={d.cierreEstimado} onChange={set("cierreEstimado")} className={`${inputCls} mt-1`} /></label>
          {d.id && <label className="text-xs text-texto-suave">Probabilidad (%)<input value={d.probabilidad} onChange={set("probabilidad")} inputMode="numeric" className={`${inputCls} mt-1 f-m`} /></label>}
          <label className="text-xs text-texto-suave">Módulos (separados por coma)<input value={d.modulos} onChange={set("modulos")} className={`${inputCls} mt-1`} /></label>
        </div>
        {etapa && etapa.tipo === "perdida" && (
          <select value={d.motivoPerdida || ""} onChange={set("motivoPerdida")} className={inputCls}>
            <option value="">Por qué se perdió</option>{motivos.map((m) => <option key={m.clave} value={m.clave}>{m.nombre}</option>)}
          </select>
        )}
        <p className="text-[11px] text-texto-tenue">Al cambiar de etapa, la probabilidad toma la de la etapa. El valor ponderado es una estimación, no plata cobrada.</p>
        <div className="flex justify-end gap-2"><Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></div>
      </div>
    </Modal>
  );
}

/* ---------- Editar los datos ---------- */
const CAMPOS = [["nombre", "Nombre"], ["razonSocial", "Razón social"], ["localidad", "Localidad"], ["direccion", "Dirección"], ["telefono", "Teléfono"],
  ["whatsapp", "WhatsApp"], ["email", "Email"], ["instagram", "Instagram"], ["web", "Web"], ["subrubro", "Subrubro"], ["sistemaActual", "Sistema actual"],
  ["competidor", "Competidor"], ["campania", "Campaña"]];
const TEXTOS = [["problemas", "Problemas"], ["necesidades", "Necesidades"], ["objeciones", "Objeciones"], ["descripcion", "Descripción"], ["notas", "Notas"]];

function EditarProspecto({ p, de, onCerrar, onListo, toast }) {
  const [d, setD] = useState({ ...p, modulos: (p.modulos || []).join(", "), etiquetas: (p.etiquetas || []).join(", ") });
  const [dup, setDup] = useState(null);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async (igual = false) => {
    if (!String(d.nombre || "").trim()) return toast("Poné el nombre.", "mal");
    try {
      if (!igual) {
        const m = await posiblesDuplicados({ nombre: d.nombre, localidad: d.localidad || d.zona, telefono: d.telefono || d.whatsapp, email: d.email, excluir: p.id });
        if (m.length) return setDup(m);
      }
      const cambios = {};
      for (const [k] of [...CAMPOS, ...TEXTOS, ["rubro"], ["zona"], ["fuente"], ["interes"], ["tamano"]]) if ((d[k] || "") !== (p[k] || "")) cambios[k] = d[k] || null;
      for (const k of ["sucursales", "usuarios", "presupuesto"]) if (String(d[k] ?? "") !== String(p[k] ?? "")) cambios[k] = d[k] === "" || d[k] == null ? null : Number(d[k]);
      for (const k of ["modulos", "etiquetas"]) { const v = String(d[k]).split(",").map((x) => x.trim()).filter(Boolean); if (v.join() !== (p[k] || []).join()) cambios[k] = v; }
      if (Object.keys(cambios).length) await editarProspecto(p.id, cambios);
      toast("Datos guardados."); onListo();
    } catch (e) { toast(e.message, "mal"); }
  };
  const sel = (k, label, tipo) => (
    <label className="text-xs text-texto-suave">{label}
      <select value={d[k] || ""} onChange={set(k)} className={`${inputCls} mt-1`}><option value="">—</option>{de(tipo).map((i) => <option key={i.clave} value={i.clave}>{i.nombre}</option>)}</select>
    </label>
  );
  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">Editar datos</h3>
        {dup ? (
          <>
            <p className="text-sm">Con estos datos ya existe: {dup.map((m) => `${m.nombre} (por ${m.motivo})`).join(", ")}.</p>
            <div className="flex justify-end gap-2"><Boton variant="quiet" onClick={() => setDup(null)}>Volver</Boton><Boton variant="ghost" onClick={() => guardar(true)}>Guardar igual</Boton></div>
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              {CAMPOS.map(([k, n]) => <label key={k} className="text-xs text-texto-suave">{n}<input value={d[k] || ""} onChange={set(k)} className={`${inputCls} mt-1`} /></label>)}
              {sel("rubro", "Rubro", "rubro")}{sel("zona", "Zona", "zona")}{sel("fuente", "Fuente", "fuente")}
              <label className="text-xs text-texto-suave">Interés
                <select value={d.interes || ""} onChange={set("interes")} className={`${inputCls} mt-1`}><option value="">—</option>{Object.entries(INTERES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
              </label>
              {["sucursales", "usuarios", "presupuesto"].map((k) => <label key={k} className="text-xs text-texto-suave capitalize">{k}<input value={d[k] ?? ""} onChange={(e) => setD({ ...d, [k]: e.target.value.replace(/\D/g, "") })} inputMode="numeric" className={`${inputCls} mt-1`} /></label>)}
              <label className="text-xs text-texto-suave">Módulos (coma)<input value={d.modulos} onChange={set("modulos")} className={`${inputCls} mt-1`} /></label>
              <label className="text-xs text-texto-suave">Etiquetas (coma)<input value={d.etiquetas} onChange={set("etiquetas")} className={`${inputCls} mt-1`} /></label>
            </div>
            {TEXTOS.map(([k, n]) => <label key={k} className="block text-xs text-texto-suave">{n}<textarea value={d[k] || ""} onChange={set(k)} rows={2} className={`${inputCls} mt-1`} /></label>)}
            <div className="flex justify-end gap-2"><Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton><Boton onClick={() => guardar(false)}>Guardar</Boton></div>
          </>
        )}
      </div>
    </Modal>
  );
}
