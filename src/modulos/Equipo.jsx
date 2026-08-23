/* ============================================================
   16. EQUIPO
   ============================================================

   Quién trabaja, qué hace cada uno y cuándo está. Es la pantalla que la
   agenda necesita antes de existir: sin horarios cargados no se puede
   ofrecer un turno ni siquiera a mano.

   Se carga sola desde la base, como la comanda, en vez de recibir todo por
   props: es un módulo nuevo y nadie más necesita estos datos.

   Lo que se le paga solo lo ve quien puede ver costos. Recepción usa esta
   pantalla todos los días para saber quién cubre; no tiene por qué ver el
   sueldo de sus compañeros.
   ============================================================ */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Check, Search, Clock, Trash2, UserCog } from "lucide-react";
import {
  cargarEquipo, crearPersona, guardarPersona,
  desactivarPersona, guardarHorarios, guardarServicios,
  DIAS, MODALIDADES, TIPOS,
} from "../datos/equipo.js";
/* El catálogo de prestaciones vive en su propio módulo desde que existe la
   pantalla de Servicios: es el mismo dato leído desde los dos lados. */
import { cargarServicios } from "../datos/servicios.js";
import { money, nf } from "../utils/helpers.js";
import { Card, Boton, Modal, Vacio, Tabs } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

const iniciales = (nombre) =>
  String(nombre || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const nombreDia = (d) => (DIAS.find((x) => x.d === d) || { corto: "?" }).corto;

/* "8 hs" y no "8.00 hs". Media hora se escribe 8.5, que es como la gente
   la dice, y no 8:30, que se confunde con una hora del día. */
const horas = (h) => `${Number(h) % 1 === 0 ? Math.round(h) : Number(h).toFixed(1)} hs`;

const modalidadN = (k) => (MODALIDADES.find((m) => m.k === k) || { n: k }).n;

/* Cómo se le paga, en una línea. La comisión no muestra un monto porque no
   lo tiene: depende de lo que facture. */
function loQueCobra(p) {
  if (p.modalidad === "comision") return `${nf.format(p.comision)}% de comisión`;
  if (p.modalidad === "fijo") return `${money(p.valor)} por mes`;
  if (p.modalidad === "clase") return `${money(p.valor)} por clase`;
  return `${money(p.valor)} la hora`;
}

/* ------------------------------------------------------------
   El formulario
   ------------------------------------------------------------ */

function FormPersona({ abierto, inicial, servicios, permisos, onGuardar, onCerrar, onBaja }) {
  const [d, setD] = useState({});
  const [franjas, setFranjas] = useState([]);
  const [habilitados, setHabilitados] = useState([]);
  const [pestana, setPestana] = useState("datos");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const base = inicial || {};
    setD({ tipo: "profesional", modalidad: "hora", valor: 0, comision: 0, ...base });
    setFranjas((base.horarios || []).map((h) => ({ ...h })));
    setHabilitados([...(base.servicios || [])]);
    setPestana("datos");
  }, [abierto, inicial]);

  if (!abierto) return null;

  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const esNueva = !d.id;

  const porCategoria = servicios.reduce((m, s) => {
    (m[s.categoria] = m[s.categoria] || []).push(s);
    return m;
  }, {});

  const totalHoras = franjas.reduce((s, f) => {
    if (!f.desde || !f.hasta || f.hasta <= f.desde) return s;
    const [hd, md] = f.desde.split(":").map(Number);
    const [hh, mh] = f.hasta.split(":").map(Number);
    return s + (hh * 60 + mh - hd * 60 - md) / 60;
  }, 0);

  const solapadas = franjas.some((a, i) =>
    franjas.some((b, j) => j > i && a.dia === b.dia && a.desde < b.hasta && b.desde < a.hasta));

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="f-d text-lg">{esNueva ? "Sumar a alguien al equipo" : d.nombre}</h3>
          {!esNueva && (
            <button onClick={() => onBaja(d)} title="Dar de baja"
              className="text-xs font-semibold text-mal hover:underline shrink-0">Dar de baja</button>
          )}
        </div>

        <div className="mt-4">
          <Tabs value={pestana} onChange={setPestana} items={[
            { k: "datos", n: "Datos" },
            { k: "horarios", n: "Horarios", badge: franjas.length || null },
            { k: "servicios", n: "Qué hace", badge: habilitados.length || null },
          ]} />
        </div>

        <div className="mt-4 min-h-[280px]">
          {pestana === "datos" && (
            <div className="space-y-3">
              <Campo label="Nombre">
                <input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)} autoFocus className={inputCls} />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Rol">
                  <select value={d.tipo} onChange={(e) => set("tipo", e.target.value)} className={inputCls}>
                    {TIPOS.map((t) => <option key={t.k} value={t.k}>{t.n}</option>)}
                  </select>
                </Campo>
                <Campo label="Especialidad">
                  <input value={d.especialidad || ""} onChange={(e) => set("especialidad", e.target.value)}
                    placeholder="Pilates, estética…" className={inputCls} />
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Teléfono">
                  <input value={d.tel || ""} onChange={(e) => set("tel", e.target.value)} className={inputCls} />
                </Campo>
                <Campo label="Correo">
                  <input value={d.email || ""} onChange={(e) => set("email", e.target.value)} className={inputCls} />
                </Campo>
              </div>

              {permisos.verCostos && (
                <div className="pt-3 border-t border-borde space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Cómo se le paga">
                      <select value={d.modalidad} onChange={(e) => set("modalidad", e.target.value)} className={inputCls}>
                        {MODALIDADES.map((m) => <option key={m.k} value={m.k}>{m.n}</option>)}
                      </select>
                    </Campo>
                    {d.modalidad === "comision" ? (
                      <Campo label="Porcentaje">
                        <input type="number" value={d.comision} onChange={(e) => set("comision", e.target.value)} className={inputCls} />
                      </Campo>
                    ) : (
                      <Campo label={d.modalidad === "fijo" ? "Sueldo mensual" : d.modalidad === "clase" ? "Por clase" : "Valor hora"}>
                        <input type="number" value={d.valor} onChange={(e) => set("valor", e.target.value)} className={inputCls} />
                      </Campo>
                    )}
                  </div>
                  <p className="text-xs text-texto-suave">
                    {(MODALIDADES.find((m) => m.k === d.modalidad) || {}).d}
                  </p>
                </div>
              )}

              {!esNueva && (
                <p className="text-xs text-texto-tenue pt-2">
                  {d.tieneCuenta
                    ? "Tiene cuenta para entrar al sistema."
                    : "No entra al sistema. Se le puede dar acceso cuando haga falta."}
                </p>
              )}
            </div>
          )}

          {pestana === "horarios" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-texto-suave">
                  Las franjas se repiten todas las semanas. Las excepciones —vacaciones, un día que faltó— van aparte.
                </p>
                <span className="f-m text-sm text-texto shrink-0">{horas(totalHoras)}/semana</span>
              </div>

              {franjas.length === 0 && <Vacio>Sin horarios cargados. Sin esto no se le puede agendar nada.</Vacio>}

              <ul className="space-y-2">
                {franjas.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <select value={f.dia} className={`${inputCls} w-36`}
                      onChange={(e) => setFranjas((xs) => xs.map((x, j) => j === i ? { ...x, dia: Number(e.target.value) } : x))}>
                      {DIAS.map((x) => <option key={x.d} value={x.d}>{x.n}</option>)}
                    </select>
                    <input type="time" value={f.desde} className={`${inputCls} w-28`}
                      onChange={(e) => setFranjas((xs) => xs.map((x, j) => j === i ? { ...x, desde: e.target.value } : x))} />
                    <span className="text-texto-tenue text-sm">a</span>
                    <input type="time" value={f.hasta} className={`${inputCls} w-28`}
                      onChange={(e) => setFranjas((xs) => xs.map((x, j) => j === i ? { ...x, hasta: e.target.value } : x))} />
                    <button onClick={() => setFranjas((xs) => xs.filter((_, j) => j !== i))}
                      title="Quitar" className="ml-auto p-2 rounded-lg text-texto-tenue hover:text-mal hover:bg-superficie-2">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>

              <Boton size="sm" variant="ghost"
                onClick={() => setFranjas((xs) => [...xs, { dia: 1, desde: "09:00", hasta: "13:00" }])}>
                <Plus size={14} /> Agregar franja
              </Boton>

              {solapadas && (
                <p className="text-xs text-mal">
                  Hay dos franjas del mismo día que se pisan. Se puede guardar igual, pero la agenda va a ofrecer ese rato dos veces.
                </p>
              )}
            </div>
          )}

          {pestana === "servicios" && (
            <div className="space-y-4">
              <p className="text-xs text-texto-suave">
                Lo que esta persona puede dar. La agenda usa esto para no ofrecer a alguien para algo que no hace.
              </p>
              {servicios.length === 0 && <Vacio>Todavía no hay prestaciones cargadas en el catálogo.</Vacio>}
              {Object.entries(porCategoria).map(([cat, lista]) => (
                <div key={cat}>
                  <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold mb-1.5">{cat}</div>
                  <div className="grid sm:grid-cols-2 gap-1">
                    {lista.map((s) => {
                      const puesto = habilitados.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-superficie-2 cursor-pointer">
                          <input type="checkbox" checked={puesto}
                            onChange={() => setHabilitados((xs) => puesto ? xs.filter((x) => x !== s.id) : [...xs, s.id])} />
                          <span className="truncate flex-1 text-texto">{s.nombre}</span>
                          <span className="f-m text-[11px] text-texto-tenue shrink-0">{s.duracion} min</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={!d.nombre || guardando}
            onClick={async () => {
              setGuardando(true);
              const ok = await onGuardar(d, franjas, habilitados);
              setGuardando(false);
              if (ok) onCerrar();
            }}>
            <Check size={15} /> {guardando ? "Guardando…" : "Guardar"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   La pantalla
   ------------------------------------------------------------ */

export function Equipo({ empresaId, permisos, toast }) {
  const [gente, setGente] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState(null);

  const releer = useCallback(async () => {
    const [g, s] = await Promise.all([cargarEquipo(empresaId), cargarServicios(empresaId)]);
    setGente(g);
    setServicios(s);
  }, [empresaId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    releer()
      .catch((e) => { if (vigente) toast(e.message || "No pudimos cargar el equipo.", "mal"); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lista = useMemo(() => (
    q.trim().length >= 2
      ? gente.filter((p) => norm(p.nombre).includes(norm(q)) || norm(p.especialidad).includes(norm(q)))
      : gente
  ), [gente, q]);

  const sinHorario = gente.filter((p) => p.horarios.length === 0).length;

  /* Se guarda la persona, sus horarios y sus servicios en ese orden: los
     dos últimos necesitan el id, que recién existe después del alta. */
  async function guardar(d, franjas, habilitados) {
    try {
      const id = d.id || await crearPersona(empresaId, d);
      if (d.id) await guardarPersona(d.id, d);
      await Promise.all([
        guardarHorarios(empresaId, id, franjas),
        guardarServicios(empresaId, id, habilitados),
      ]);
      await releer();
      toast(`${d.nombre} guardado.`);
      return true;
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "mal");
      return false;
    }
  }

  async function darDeBaja(p) {
    try {
      await desactivarPersona(p.id);
      await releer();
      setEditando(null);
      toast(`${p.nombre} ya no está en el equipo.`);
    } catch (e) {
      toast(e.message || "No se pudo dar de baja.", "mal");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o especialidad"
            className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento bg-superficie" />
        </div>
        <Boton size="sm" onClick={() => setEditando({})}><Plus size={14} /> Sumar a alguien</Boton>
      </div>

      {sinHorario > 0 && (
        <Card className="p-3.5 flex items-center gap-3">
          <Clock size={16} className="text-ojo shrink-0" />
          <p className="text-sm text-texto-suave">
            {sinHorario === 1 ? "Hay una persona sin horario cargado." : `Hay ${sinHorario} personas sin horario cargado.`}{" "}
            Hasta que lo tengan, la agenda no les va a poder asignar nada.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        {cargando ? (
          <div className="p-8 text-center text-sm text-texto-tenue">Cargando…</div>
        ) : lista.length === 0 ? (
          <Vacio>
            {gente.length === 0
              ? "Todavía no hay nadie en el equipo. Empezá por acá: la agenda necesita saber quién trabaja y cuándo."
              : "Nadie coincide con esa búsqueda."}
          </Vacio>
        ) : (
          <ul className="divide-y divide-borde">
            {lista.map((p) => (
              <li key={p.id}>
                <button onClick={() => setEditando(p)}
                  className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                  <span className="w-9 h-9 shrink-0 rounded-full bg-superficie-2 flex items-center justify-center text-xs font-bold text-texto-suave">
                    {iniciales(p.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-texto flex items-center gap-2">
                      {p.nombre}
                      {p.tipo !== "profesional" && (
                        <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-borde bg-superficie-2 text-texto-suave">
                          {(TIPOS.find((t) => t.k === p.tipo) || {}).n}
                        </span>
                      )}
                      {p.tieneCuenta && <UserCog size={13} className="text-texto-tenue" title="Entra al sistema" />}
                    </div>
                    <div className="f-m text-[11px] text-texto-tenue">
                      {p.especialidad || "sin especialidad"}
                      {p.servicios.length > 0 && ` · ${p.servicios.length} servicios`}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {p.horarios.length === 0 ? (
                      <span className="text-xs text-ojo font-semibold">sin horario</span>
                    ) : (
                      <>
                        <div className="f-m text-sm text-texto">{horas(p.horasSemana)}</div>
                        <div className="text-[11px] text-texto-tenue">
                          {[...p.horarios]
                            .sort((a, b) => (a.dia === 0 ? 7 : a.dia) - (b.dia === 0 ? 7 : b.dia))
                            .map((h) => nombreDia(h.dia))
                            .filter((v, i, xs) => xs.indexOf(v) === i)
                            .join(" ")}
                        </div>
                      </>
                    )}
                  </div>

                  {permisos.verCostos && (
                    <div className="f-m text-sm text-texto-suave shrink-0 w-36 text-right">{loQueCobra(p)}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <FormPersona abierto={!!editando} inicial={editando} servicios={servicios} permisos={permisos}
        onCerrar={() => setEditando(null)} onGuardar={guardar} onBaja={darDeBaja} />
    </div>
  );
}
