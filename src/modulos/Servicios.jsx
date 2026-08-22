/* ============================================================
   20. SERVICIOS Y RECURSOS
   ============================================================

   Qué se ofrece, cuánto dura, cuánto sale y dónde se hace. Es la pantalla
   más barata de todas porque los datos ya estaban: una prestación es un
   `item` con `tipo = 'servicio'` y una sala es un `recurso`. Lo único que
   faltaba era poder verlos y tocarlos sin pasar por SQL.

   Quién da cada cosa se puede editar desde acá y desde Equipo. Es la
   misma tabla vista de los dos lados, porque en la práctica se piensa de
   las dos maneras: "qué hace Carla" y "quién puede dar esto".

   Los campos que no hacen nada todavía no están. Anticipación mínima,
   política de cancelación y comisión por servicio aparecen en las
   maquetas, pero hoy nadie los lee: ponerlos sería inventar una
   configuración que no configura nada.
   ============================================================ */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Check, Search, Users, DoorOpen, Clock } from "lucide-react";
import {
  cargarServicios, guardarServicio, desactivarServicio,
  cargarEspacios, guardarEspacio, desactivarEspacio,
  cargarQuienDaQue, guardarQuienLoDa, usoProximo,
  TIPOS_RECURSO, nombreTipo,
} from "../datos/servicios.js";
import { cargarEquipo } from "../datos/equipo.js";
import { money, nf } from "../utils/helpers.js";
import { Card, Boton, Modal, Vacio, Tabs, Sello, Cargando, ErrorEstado } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

/* ------------------------------------------------------------
   Una prestación
   ------------------------------------------------------------ */

function FormServicio({ abierto, inicial, equipo, quienLoDa, onGuardar, onCerrar, onBaja }) {
  const [d, setD] = useState({});
  const [dan, setDan] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const base = inicial || {};
    setD({ modalidad: "individual", capacidad: 1, duracion: 60, precio: 0, activo: true, ...base });
    setDan([...(quienLoDa || [])]);
  }, [abierto, inicial, quienLoDa]);

  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const profesionales = equipo.filter((p) => p.tipo === "profesional");

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="f-d text-lg">{d.id ? d.nombre : "Nueva prestación"}</h3>
          {d.id && (
            <button onClick={() => onBaja(d)}
              className="text-xs font-semibold text-mal hover:underline shrink-0">Dar de baja</button>
          )}
        </div>

        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Campo label="Nombre">
                <input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)}
                  autoFocus placeholder="Limpieza facial" className={inputCls} />
              </Campo>
            </div>
            <Campo label="Área">
              <input value={d.categoria || ""} onChange={(e) => set("categoria", e.target.value)}
                placeholder="Estética" className={inputCls} />
            </Campo>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Campo label="Duración (min)">
              <input type="number" step="5" min="5" value={d.duracion}
                onChange={(e) => set("duracion", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Precio">
              <input type="number" value={d.precio} onChange={(e) => set("precio", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Modalidad">
              <select value={d.modalidad} onChange={(e) => set("modalidad", e.target.value)} className={inputCls}>
                <option value="individual">Individual</option>
                <option value="grupal">Grupal</option>
              </select>
            </Campo>
          </div>

          {d.modalidad === "grupal" && (
            <Campo label="Cuánta gente entra">
              <input type="number" min="2" value={d.capacidad}
                onChange={(e) => set("capacidad", e.target.value)} className={inputCls} />
            </Campo>
          )}
          {d.modalidad === "grupal" && (
            <p className="text-xs text-texto-suave -mt-1">
              Es el cupo de referencia. Cada clase puede abrirse con menos —una de principiantes, por ejemplo—
              pero nunca con más de lo que entra en la sala.
            </p>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold mb-1.5">
              Quién lo da
            </div>
            {profesionales.length === 0 ? (
              <p className="text-sm text-texto-tenue">Todavía no hay nadie en el equipo.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-1">
                {profesionales.map((p) => {
                  const puesto = dan.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg hover:bg-superficie-2 cursor-pointer">
                      <input type="checkbox" checked={puesto}
                        onChange={() => setDan((xs) => puesto ? xs.filter((x) => x !== p.id) : [...xs, p.id])} />
                      <span className="truncate flex-1 text-texto">{p.nombre}</span>
                      <span className="text-[11px] text-texto-tenue shrink-0">{p.especialidad}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-texto-suave mt-1.5">
              La agenda usa esto para no ofrecer a alguien para algo que no hace.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-texto-suave">
            <input type="checkbox" checked={d.activo !== false} onChange={(e) => set("activo", e.target.checked)} />
            Se puede agendar
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={!d.nombre || guardando} onClick={async () => {
            setGuardando(true);
            const ok = await onGuardar(d, dan);
            setGuardando(false);
            if (ok) onCerrar();
          }}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   Un espacio
   ------------------------------------------------------------ */

function FormEspacio({ abierto, inicial, enUso, onGuardar, onCerrar, onBaja }) {
  const [d, setD] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) setD({ tipo: "sala", capacidad: 1, orden: 0, activo: true, ...(inicial || {}) });
  }, [abierto, inicial]);

  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const tipo = TIPOS_RECURSO.find((t) => t.k === d.tipo);

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="f-d text-lg">{d.id ? d.nombre : "Nuevo espacio"}</h3>
          {d.id && (
            <button onClick={() => onBaja(d)}
              className="text-xs font-semibold text-mal hover:underline shrink-0">Dar de baja</button>
          )}
        </div>

        <div className="space-y-3 mt-4">
          <Campo label="Nombre">
            <input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)}
              autoFocus placeholder="Sala Reformer 1" className={inputCls} />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Qué es">
              <select value={d.tipo} onChange={(e) => set("tipo", e.target.value)} className={inputCls}>
                {TIPOS_RECURSO.map((t) => <option key={t.k} value={t.k}>{t.n}</option>)}
              </select>
            </Campo>
            <Campo label="Cuánta gente entra">
              <input type="number" min="1" value={d.capacidad}
                onChange={(e) => set("capacidad", e.target.value)} className={inputCls} />
            </Campo>
          </div>
          {tipo && tipo.d && <p className="text-xs text-texto-suave -mt-1">{tipo.d}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Sector">
              <input value={d.sector || ""} onChange={(e) => set("sector", e.target.value)}
                placeholder="Pilates, Estética…" className={inputCls} />
            </Campo>
            <Campo label="Orden">
              <input type="number" value={d.orden} onChange={(e) => set("orden", e.target.value)} className={inputCls} />
            </Campo>
          </div>

          <p className="text-xs text-texto-suave">
            La capacidad es un dato físico: es el techo del cupo de cualquier clase que se abra acá.
          </p>

          {enUso > 0 && (
            <p className="text-xs text-ojo">
              Tiene {nf.format(enUso)} {enUso === 1 ? "turno" : "turnos"} en los próximos 30 días.
            </p>
          )}

          <label className="flex items-center gap-2 text-sm text-texto-suave">
            <input type="checkbox" checked={d.activo !== false} onChange={(e) => set("activo", e.target.checked)} />
            Se puede reservar
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={!d.nombre || guardando} onClick={async () => {
            setGuardando(true);
            const ok = await onGuardar(d);
            setGuardando(false);
            if (ok) onCerrar();
          }}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   La pantalla
   ------------------------------------------------------------ */

export function Servicios({ empresaId, permisos, toast }) {
  const [pestana, setPestana] = useState("servicios");
  const [servicios, setServicios] = useState([]);
  const [espacios, setEspacios] = useState([]);
  const [equipo, setEquipo] = useState([]);
  const [quienDa, setQuienDa] = useState(new Map());
  const [uso, setUso] = useState({ porRecurso: new Map(), porItem: new Map() });

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState(null);
  const [editandoEspacio, setEditandoEspacio] = useState(null);

  const releer = useCallback(async () => {
    const [s, e, eq, qd, u] = await Promise.all([
      cargarServicios(empresaId, { soloActivos: false }),
      cargarEspacios(empresaId, { soloActivos: false }),
      cargarEquipo(empresaId),
      cargarQuienDaQue(empresaId),
      usoProximo(empresaId),
    ]);
    setServicios(s);
    setEspacios(e);
    setEquipo(eq);
    setQuienDa(qd);
    setUso(u);
  }, [empresaId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar el catálogo."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const listaServicios = useMemo(() => (
    q.trim().length >= 2
      ? servicios.filter((s) => norm(s.nombre).includes(norm(q)) || norm(s.categoria).includes(norm(q)))
      : servicios
  ), [servicios, q]);

  const porArea = useMemo(() => {
    const m = new Map();
    for (const s of listaServicios) {
      const k = s.categoria || "Sin área";
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s);
    }
    return [...m.entries()];
  }, [listaServicios]);

  const sinNadie = servicios.filter((s) => s.activo && !(quienDa.get(s.id) || []).length);

  async function grabarServicio(d, dan) {
    try {
      const id = await guardarServicio(empresaId, d);
      await guardarQuienLoDa(empresaId, id, dan);
      await releer();
      toast(`${d.nombre} guardado.`);
      return true;
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "mal");
      return false;
    }
  }

  async function grabarEspacio(d) {
    try {
      await guardarEspacio(empresaId, d);
      await releer();
      toast(`${d.nombre} guardado.`);
      return true;
    } catch (e) {
      toast(e.message || "No se pudo guardar.", "mal");
      return false;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {pestana === "servicios" && (
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o área"
              className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento bg-superficie" />
          </div>
        )}
        <div className="ml-auto">
          {pestana === "servicios"
            ? <Boton size="sm" onClick={() => setEditando({})}><Plus size={14} /> Nueva prestación</Boton>
            : <Boton size="sm" onClick={() => setEditandoEspacio({})}><Plus size={14} /> Nuevo espacio</Boton>}
        </div>
      </div>

      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "servicios", n: "Servicios", badge: servicios.filter((s) => s.activo).length || null },
        { k: "espacios", n: "Salas y recursos", badge: espacios.filter((e) => e.activo).length || null },
      ]} />

      {pestana === "servicios" && sinNadie.length > 0 && (
        <Card className="p-3.5 flex items-center gap-3">
          <Users size={16} className="text-ojo shrink-0" />
          <p className="text-sm text-texto-suave">
            {sinNadie.length === 1
              ? `${sinNadie[0].nombre} no lo tiene habilitado nadie del equipo.`
              : `Hay ${sinNadie.length} prestaciones que no las tiene habilitadas nadie.`}{" "}
            La agenda no las va a poder asignar.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        {error ? (
          <ErrorEstado onReintentar={() => releer().catch((e) => setError(e.message))}>{error}</ErrorEstado>
        ) : cargando ? (
          <Cargando />
        ) : pestana === "espacios" ? (
          espacios.length === 0 ? (
            <Vacio>Todavía no hay salas ni recursos. La agenda los necesita para saber dónde se atiende.</Vacio>
          ) : (
            <ul className="divide-y divide-borde">
              {espacios.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setEditandoEspacio(e)}
                    className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-superficie-2 flex items-center justify-center">
                      <DoorOpen size={16} className="text-texto-suave" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-texto">{e.nombre}</div>
                      <div className="f-m text-[11px] text-texto-tenue">
                        {nombreTipo(e.tipo)}{e.sector && ` · ${e.sector}`} · entran {e.capacidad}
                      </div>
                    </div>
                    {!e.activo && <Sello tono="tenue">De baja</Sello>}
                    {uso.porRecurso.get(e.id) > 0 && (
                      <span className="f-m text-[11px] text-texto-tenue shrink-0">
                        {nf.format(uso.porRecurso.get(e.id))} turnos
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : listaServicios.length === 0 ? (
          <Vacio>
            {servicios.length === 0
              ? "Todavía no hay prestaciones. Son lo que se agenda y lo que se cobra."
              : "Ninguna coincide con esa búsqueda."}
          </Vacio>
        ) : (
          <div>
            {porArea.map(([area, xs]) => (
              <div key={area}>
                <div className="px-4 py-2 bg-superficie-2/50 text-[10px] uppercase tracking-widest text-texto-tenue font-bold">
                  {area}
                </div>
                <ul className="divide-y divide-borde">
                  {xs.map((s) => {
                    const dan = quienDa.get(s.id) || [];
                    return (
                      <li key={s.id}>
                        <button onClick={() => setEditando(s)}
                          className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-texto flex items-center gap-2">
                              {s.nombre}
                              {s.modalidad === "grupal" && <Sello tono="info">Grupal · {s.capacidad}</Sello>}
                            </div>
                            <div className="f-m text-[11px] text-texto-tenue flex items-center gap-1">
                              <Clock size={11} /> {s.duracion} min
                              {dan.length > 0
                                ? ` · ${dan.length} ${dan.length === 1 ? "profesional" : "profesionales"}`
                                : " · sin nadie habilitado"}
                            </div>
                          </div>
                          {!s.activo && <Sello tono="tenue">De baja</Sello>}
                          <span className="f-m text-sm text-texto shrink-0">{money(s.precio)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <FormServicio abierto={!!editando} inicial={editando} equipo={equipo}
        quienLoDa={editando && editando.id ? quienDa.get(editando.id) : []}
        onGuardar={grabarServicio} onCerrar={() => setEditando(null)}
        onBaja={async (s) => {
          try {
            await desactivarServicio(s.id);
            await releer();
            setEditando(null);
            toast(`${s.nombre} dado de baja.`);
          } catch (e) { toast(e.message || "No se pudo.", "mal"); }
        }} />

      <FormEspacio abierto={!!editandoEspacio} inicial={editandoEspacio}
        enUso={editandoEspacio && editandoEspacio.id ? (uso.porRecurso.get(editandoEspacio.id) || 0) : 0}
        onGuardar={grabarEspacio} onCerrar={() => setEditandoEspacio(null)}
        onBaja={async (e) => {
          try {
            await desactivarEspacio(e.id);
            await releer();
            setEditandoEspacio(null);
            toast(`${e.nombre} dado de baja.`);
          } catch (err) { toast(err.message || "No se pudo.", "mal"); }
        }} />
    </div>
  );
}
