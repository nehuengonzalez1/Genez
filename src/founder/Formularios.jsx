/* ============================================================
   GENEZ FOUNDER · los formularios que se usan en varios lados
   ============================================================

   El seguimiento rápido (registrar el contacto y programar el próximo
   paso en un solo movimiento), la tarea, el evento y el contacto. Los
   usan la ficha del prospecto, Tareas, Agenda y el Inicio.
   ============================================================ */

import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, Boton } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { registrarActividad, moverOportunidad, guardarTarea, guardarEvento, guardarContacto } from "../datos/internoCrm.js";
import { aInput, deInput, PRIORIDAD, ESTADO_TAREA } from "./util.js";

const Etiqueta = ({ children, className = "" }) => <span className={`block text-xs text-texto-suave ${className}`}>{children}</span>;

/* ---------- Seguimiento rápido ---------- */
/* Lo que pasó, y lo que sigue. Si se elige otra etapa, la mueve (la base
   anota el cambio). Si se pide, el próximo paso queda también como
   tarea o como evento en la agenda. */
export function SeguimientoRapido({ prospecto, oportunidad, etapas, tipos, motivos, onCerrar, onListo, toast }) {
  const [d, setD] = useState({
    tipo: "llamada", fecha: aInput(new Date()), resultado: "", notas: "",
    proximaAccion: "", proximaFecha: "", etapaId: oportunidad ? oportunidad.etapaId : "", motivo: "", tambien: "nada",
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const etapaNueva = etapas.find((e) => e.id === d.etapaId);
  const esNota = d.tipo === "nota";

  const guardar = async () => {
    if (!d.resultado.trim() && !d.notas.trim()) return toast("Contá qué pasó, aunque sea en una línea.", "mal");
    if (d.proximaFecha && !d.proximaAccion.trim()) return toast("¿Qué hay que hacer en esa fecha?", "mal");
    if (etapaNueva && etapaNueva.tipo === "perdida" && !d.motivo) return toast("Elegí por qué se perdió.", "mal");
    setGuardando(true);
    try {
      const proxima = deInput(d.proximaFecha);
      await registrarActividad({
        prospectoId: prospecto.id, oportunidadId: oportunidad ? oportunidad.id : null, tipo: d.tipo, fecha: deInput(d.fecha) || new Date(),
        resultado: d.resultado.trim() || null, notas: d.notas.trim() || null,
        proximaAccion: esNota ? null : d.proximaAccion.trim() || null, proximaFecha: esNota ? null : proxima,
      });
      if (oportunidad && d.etapaId && d.etapaId !== oportunidad.etapaId) await moverOportunidad(oportunidad.id, d.etapaId, d.motivo || null);
      if (!esNota && proxima && d.tambien === "tarea") {
        await guardarTarea({ titulo: d.proximaAccion.trim(), vence: proxima, prospectoId: prospecto.id, oportunidadId: oportunidad ? oportunidad.id : null, categoria: "comercial", prioridad: "normal" });
      }
      if (!esNota && proxima && d.tambien === "evento") {
        await guardarEvento({ titulo: `${d.proximaAccion.trim()} · ${prospecto.nombre}`, tipo: d.tipo === "visita" ? "visita" : d.tipo === "demo" ? "demo" : "llamada",
          inicio: proxima, fin: new Date(proxima.getTime() + 30 * 60000), prospectoId: prospecto.id, oportunidadId: oportunidad ? oportunidad.id : null });
      }
      toast("Seguimiento registrado.");
      onListo();
    } catch (e) {
      toast(e.message, "mal");
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-xl">
      <div className="p-5 space-y-4">
        <div>
          <h3 className="f-d text-xl">Registrar seguimiento</h3>
          <p className="text-sm text-texto-suave">{prospecto.nombre}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tipos.map((t) => (
            <button key={t.clave} type="button" onClick={() => setD({ ...d, tipo: t.clave })}
              className={`text-xs px-2.5 py-1.5 rounded-md border ${d.tipo === t.clave ? "border-acento bg-acento-suave text-texto" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
              {t.nombre}
            </button>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label><Etiqueta>Cuándo</Etiqueta><input type="datetime-local" value={d.fecha} onChange={set("fecha")} className={`${inputCls} mt-1`} /></label>
          {oportunidad && (
            <label><Etiqueta>Etapa</Etiqueta>
              <select value={d.etapaId} onChange={set("etapaId")} className={`${inputCls} mt-1`}>
                {etapas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </label>
          )}
        </div>
        {etapaNueva && etapaNueva.tipo === "perdida" && d.etapaId !== (oportunidad && oportunidad.etapaId) && (
          <label className="block"><Etiqueta>Por qué se perdió</Etiqueta>
            <select value={d.motivo} onChange={set("motivo")} className={`${inputCls} mt-1`}>
              <option value="">Elegí un motivo</option>
              {motivos.map((m) => <option key={m.clave} value={m.clave}>{m.nombre}</option>)}
            </select>
          </label>
        )}
        <label className="block"><Etiqueta>{esNota ? "La nota" : "Qué pasó"}</Etiqueta>
          <input value={d.resultado} onChange={set("resultado")} autoFocus placeholder={esNota ? "" : "Ej: le interesa, pide precio para dos cajas"} className={`${inputCls} mt-1`} />
        </label>
        <label className="block"><Etiqueta>Notas</Etiqueta>
          <textarea value={d.notas} onChange={set("notas")} rows={2} className={`${inputCls} mt-1`} />
        </label>
        {!esNota && (
          <div className="border-t border-borde pt-3 space-y-3">
            <div className="grid sm:grid-cols-[1fr_12rem] gap-3">
              <label><Etiqueta>Próximo paso</Etiqueta><input value={d.proximaAccion} onChange={set("proximaAccion")} placeholder="Ej: mandar propuesta" className={`${inputCls} mt-1`} /></label>
              <label><Etiqueta>Cuándo</Etiqueta><input type="datetime-local" value={d.proximaFecha} onChange={set("proximaFecha")} className={`${inputCls} mt-1`} /></label>
            </div>
            {d.proximaFecha && (
              <div className="flex flex-wrap gap-3 text-sm">
                {[["nada", "Solo el recordatorio"], ["tarea", "Crear una tarea"], ["evento", "Agendarlo"]].map(([k, n]) => (
                  <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="tambien" checked={d.tambien === k} onChange={() => setD({ ...d, tambien: k })} className="accent-acento" /> {n}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Tarea ---------- */
export function FormTarea({ inicial = {}, categorias, onCerrar, onListo, toast }) {
  const [d, setD] = useState({
    titulo: "", descripcion: "", prioridad: "normal", estado: "pendiente", categoria: "", bloqueo: "",
    ...inicial,
    vence: inicial.vence ? aInput(inicial.vence) : "",
    checklist: inicial.checklist || [],
    repite: inicial.repeticion ? inicial.repeticion.cada : "",
  });
  const [item, setItem] = useState("");
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const guardar = async () => {
    if (!d.titulo.trim()) return toast("Poné qué hay que hacer.", "mal");
    if (d.repite && !d.vence) return toast("Una tarea que se repite necesita un vencimiento.", "mal");
    setGuardando(true);
    try {
      const { repite, ...resto } = d;
      await guardarTarea({
        ...resto, titulo: d.titulo.trim(), vence: deInput(d.vence), bloqueo: d.estado === "en_espera" ? d.bloqueo.trim() || null : null,
        repeticion: repite ? { cada: repite, intervalo: 1 } : null,
      });
      toast(inicial.id ? "Tarea guardada." : "Tarea creada.");
      onListo();
    } catch (e) {
      toast(e.message, "mal");
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-xl">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">{inicial.id ? "Tarea" : "Nueva tarea"}</h3>
        {inicial.prospectoNombre && <p className="text-sm text-texto-suave -mt-2">{inicial.prospectoNombre}</p>}
        <input value={d.titulo} onChange={set("titulo")} autoFocus placeholder="Qué hay que hacer" className={inputCls} maxLength={200} />
        <textarea value={d.descripcion || ""} onChange={set("descripcion")} rows={2} placeholder="Detalle (opcional)" className={inputCls} />
        <div className="grid sm:grid-cols-2 gap-3">
          <label><Etiqueta>Vence</Etiqueta><input type="datetime-local" value={d.vence} onChange={set("vence")} className={`${inputCls} mt-1`} /></label>
          <label><Etiqueta>Prioridad</Etiqueta>
            <select value={d.prioridad} onChange={set("prioridad")} className={`${inputCls} mt-1`}>
              {Object.entries(PRIORIDAD).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </label>
          <label><Etiqueta>Estado</Etiqueta>
            <select value={d.estado} onChange={set("estado")} className={`${inputCls} mt-1`}>
              {Object.entries(ESTADO_TAREA).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </label>
          <label><Etiqueta>Categoría</Etiqueta>
            <select value={d.categoria || ""} onChange={set("categoria")} className={`${inputCls} mt-1`}>
              <option value="">—</option>
              {categorias.map((c) => <option key={c.clave} value={c.clave}>{c.nombre}</option>)}
            </select>
          </label>
          <label><Etiqueta>Se repite</Etiqueta>
            <select value={d.repite} onChange={set("repite")} className={`${inputCls} mt-1`}>
              <option value="">No</option><option value="dia">Todos los días</option><option value="semana">Cada semana</option><option value="mes">Cada mes</option>
            </select>
          </label>
        </div>
        {d.estado === "en_espera" && (
          <label className="block"><Etiqueta>Qué la frena</Etiqueta><input value={d.bloqueo || ""} onChange={set("bloqueo")} className={`${inputCls} mt-1`} /></label>
        )}
        <div>
          <Etiqueta>Checklist</Etiqueta>
          <ul className="mt-1 space-y-1">
            {d.checklist.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!c.hecho} className="accent-acento"
                  onChange={() => setD({ ...d, checklist: d.checklist.map((x, j) => (j === i ? { ...x, hecho: !x.hecho } : x)) })} />
                <span className={`flex-1 ${c.hecho ? "line-through text-texto-tenue" : ""}`}>{c.texto}</span>
                <button type="button" aria-label="Quitar" onClick={() => setD({ ...d, checklist: d.checklist.filter((_, j) => j !== i) })} className="text-texto-tenue hover:text-mal"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 mt-1.5">
            <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Agregar un paso" className={inputCls}
              onKeyDown={(e) => { if (e.key === "Enter" && item.trim()) { e.preventDefault(); setD({ ...d, checklist: [...d.checklist, { texto: item.trim(), hecho: false }] }); setItem(""); } }} />
            <Boton variant="ghost" disabled={!item.trim()} onClick={() => { setD({ ...d, checklist: [...d.checklist, { texto: item.trim(), hecho: false }] }); setItem(""); }}><Plus size={14} /></Boton>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Evento ---------- */
/* Con registrar = true, es cerrar una reunión: el resultado, las notas y
   el próximo paso (que va a la línea de tiempo del prospecto). Pasar la
   hora no la marca realizada: lo marca esto. */
/* Un link pegado sin esquema (zoom.us/j/…) lo rechaza la base, que pide
   http o https para que nunca se guarde un javascript:. Se completa acá. */
const conEsquema = (s) => {
  const t = String(s || "").trim();
  return !t ? null : /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export function FormEvento({ inicial = {}, tipos, registrar = false, onCerrar, onListo, toast }) {
  const ahora = new Date(); ahora.setMinutes(ahora.getMinutes() < 30 ? 30 : 60, 0, 0);
  const [d, setD] = useState({
    titulo: "", tipo: "reunion", descripcion: "", lugar: "", link: "", resultado: "", notasPost: "", proximaAccion: "", proximaFecha: "",
    ...inicial,
    inicio: aInput(inicial.inicio || ahora),
    fin: aInput(inicial.fin || new Date((inicial.inicio ? new Date(inicial.inicio) : ahora).getTime() + 60 * 60000)),
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const guardar = async (estado) => {
    if (!d.titulo.trim()) return toast("Poné un título.", "mal");
    const inicio = deInput(d.inicio), fin = deInput(d.fin);
    if (!inicio || !fin) return toast("Poné el horario.", "mal");
    if (fin < inicio) return toast("Termina antes de empezar.", "mal");
    if (registrar && !d.resultado.trim()) return toast("Contá cómo salió.", "mal");
    setGuardando(true);
    try {
      const { proximaAccion, proximaFecha, ...ev } = d;
      await guardarEvento({ ...ev, titulo: d.titulo.trim(), inicio, fin, link: conEsquema(d.link), estado: estado || d.estado || "programado" });
      if (registrar && d.prospectoId) {
        await registrarActividad({
          prospectoId: d.prospectoId, oportunidadId: d.oportunidadId || null, eventoId: d.id,
          tipo: ["demo", "visita", "llamada", "reunion"].includes(d.tipo) ? d.tipo : "reunion", fecha: inicio,
          resultado: d.resultado.trim(), notas: d.notasPost.trim() || null,
          proximaAccion: proximaAccion.trim() || null, proximaFecha: deInput(proximaFecha),
        });
      }
      toast(registrar ? "Resultado registrado." : inicial.id ? "Evento guardado." : "Evento agendado.");
      onListo();
    } catch (e) {
      toast(e.message, "mal");
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-xl">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">{registrar ? "¿Cómo salió?" : inicial.id ? "Evento" : "Agendar"}</h3>
        {inicial.prospectoNombre && <p className="text-sm text-texto-suave -mt-2">{inicial.prospectoNombre}</p>}
        {registrar ? (
          <>
            <p className="text-sm text-texto-suave">{d.titulo}</p>
            <input value={d.resultado} onChange={set("resultado")} autoFocus placeholder="Resultado: ej. le encantó el mostrador, pide propuesta" className={inputCls} />
            <textarea value={d.notasPost} onChange={set("notasPost")} rows={3} placeholder="Notas de la reunión" className={inputCls} />
            {d.prospectoId && (
              <div className="grid sm:grid-cols-[1fr_12rem] gap-3">
                <label><Etiqueta>Próximo paso</Etiqueta><input value={d.proximaAccion} onChange={set("proximaAccion")} className={`${inputCls} mt-1`} /></label>
                <label><Etiqueta>Cuándo</Etiqueta><input type="datetime-local" value={d.proximaFecha} onChange={set("proximaFecha")} className={`${inputCls} mt-1`} /></label>
              </div>
            )}
          </>
        ) : (
          <>
            <input value={d.titulo} onChange={set("titulo")} autoFocus placeholder="Título" className={inputCls} maxLength={200} />
            <div className="grid sm:grid-cols-3 gap-3">
              <label><Etiqueta>Tipo</Etiqueta>
                <select value={d.tipo} onChange={set("tipo")} className={`${inputCls} mt-1`}>
                  {tipos.map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}
                </select>
              </label>
              <label><Etiqueta>Empieza</Etiqueta><input type="datetime-local" value={d.inicio} onChange={(e) => {
                const ini = deInput(e.target.value), dur = deInput(d.fin) - deInput(d.inicio);
                setD({ ...d, inicio: e.target.value, fin: ini && dur >= 0 ? aInput(new Date(ini.getTime() + dur)) : d.fin });
              }} className={`${inputCls} mt-1`} /></label>
              <label><Etiqueta>Termina</Etiqueta><input type="datetime-local" value={d.fin} onChange={set("fin")} className={`${inputCls} mt-1`} /></label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={d.lugar || ""} onChange={set("lugar")} placeholder="Lugar" className={inputCls} />
              <input value={d.link || ""} onChange={set("link")} placeholder="Link de videollamada" className={inputCls} />
            </div>
            <textarea value={d.descripcion || ""} onChange={set("descripcion")} rows={2} placeholder="Descripción" className={inputCls} />
          </>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          {inicial.id && !registrar && d.estado !== "cancelado" && (
            <Boton variant="ghost" disabled={guardando} onClick={() => guardar("cancelado")}>Cancelar el evento</Boton>
          )}
          <Boton variant="quiet" onClick={onCerrar}>Cerrar</Boton>
          <Boton disabled={guardando} onClick={() => guardar(registrar ? "realizado" : undefined)}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Contacto ---------- */
export function FormContacto({ prospectoId, inicial = {}, onCerrar, onListo, toast }) {
  const [d, setD] = useState({ nombre: "", cargo: "", telefono: "", whatsapp: "", email: "", principal: false, notas: "", ...inicial });
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    if (!d.nombre.trim()) return toast("Poné el nombre.", "mal");
    try { await guardarContacto(prospectoId, { ...d, nombre: d.nombre.trim() }); toast("Contacto guardado."); onListo(); }
    catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">{inicial.id ? "Contacto" : "Nuevo contacto"}</h3>
        <input value={d.nombre} onChange={set("nombre")} autoFocus placeholder="Nombre y apellido" className={inputCls} />
        <input value={d.cargo || ""} onChange={set("cargo")} placeholder="Cargo o rol" className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <input value={d.telefono || ""} onChange={set("telefono")} placeholder="Teléfono" className={inputCls} />
          <input value={d.whatsapp || ""} onChange={set("whatsapp")} placeholder="WhatsApp" className={inputCls} />
        </div>
        <input value={d.email || ""} onChange={set("email")} placeholder="Email" className={inputCls} />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!d.principal} onChange={(e) => setD({ ...d, principal: e.target.checked })} className="accent-acento" /> Contacto principal
        </label>
        <div className="flex justify-end gap-2">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}
