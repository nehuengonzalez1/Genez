/* ============================================================
   17. AGENDA
   ============================================================

   La pantalla donde este negocio pasa el día. Todo lo que se ve acá sale
   de la base: los turnos, los profesionales, sus horarios, las salas y
   las prestaciones con su duración y su precio. Nada inventado.

   Lo que impide un turno lo decide la base —`agendar_turno` valida
   choques de sala, de persona, de horario y de ausencias en la misma
   transacción—. Acá se avisa antes para no hacer perder el viaje, pero la
   última palabra la tiene el servidor: dos personas agendando al mismo
   tiempo desde dos dispositivos solo se resuelven ahí.

   Las clases grupales, la lista de espera y la recurrencia todavía no
   tienen base, así que sus pestañas están apagadas. Ninguna finge andar.
   ============================================================ */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, ChevronLeft, ChevronRight, Search, Check, X, CalendarDays,
  Clock, User, MapPin, Trash2, RotateCcw,
} from "lucide-react";
import {
  cargarTurnos, agendarTurno, moverTurno, cambiarEstado, guardarNotas,
  escucharTurnos, ESTADOS, estadoDe, franjasDelDia, minutosDe, aReloj, OCUPAN,
} from "../datos/agenda.js";
import { cargarEquipo, cargarServicios } from "../datos/equipo.js";
import { cargarRecursos } from "../datos/comandas.js";
import { money, nf } from "../utils/helpers.js";
import { Card, Boton, Modal, Vacio, Tabs, Sello, Cargando, ErrorEstado, Apagado } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { Drawer } from "../ui/Drawer.jsx";
import { Calendario } from "../ui/Calendario.jsx";

const DIA_MS = 86400000;

const alArrancar = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sumarDias = (d, n) => new Date(d.getTime() + n * DIA_MS);

/* El lunes de la semana de esa fecha. Domingo es 0 en JavaScript, así que
   hay que correrlo seis días para atrás y no uno. */
function lunesDe(d) {
  const x = alArrancar(d);
  const dow = x.getDay();
  return sumarDias(x, dow === 0 ? -6 : 1 - dow);
}

const fechaLarga = (d) => {
  const t = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const soloHora = (d) => d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

/* De una fecha y "09:30" a un instante. Se arma con el constructor local
   para que la hora escrita sea la hora del negocio y no UTC. */
function conHora(fecha, hhmm) {
  const [h, m] = String(hhmm || "09:00").split(":").map(Number);
  const x = new Date(fecha);
  x.setHours(h, m || 0, 0, 0);
  return x;
}

const paraInput = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/* ------------------------------------------------------------
   El formulario de un turno
   ------------------------------------------------------------ */

function FormTurno({ abierto, inicial, equipo, servicios, salas, clientes, onGuardar, onCerrar }) {
  const [d, setD] = useState({});
  const [buscando, setBuscando] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setD({
      fecha: paraInput(new Date()), hora: "09:00", duracion: 60,
      personas: 1, notas: "", estado: "pendiente", ...(inicial || {}),
    });
    setBuscando("");
    setError("");
  }, [abierto, inicial]);

  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));

  const servicio = servicios.find((s) => s.id === d.itemId) || null;

  /* Al elegir el servicio se filtran los profesionales que lo dan. Un
     sistema que te deja poner a la esteticista a dar reformer te hace
     descubrir el error el día del turno. */
  const habilitados = d.itemId
    ? equipo.filter((p) => p.servicios.includes(d.itemId))
    : equipo.filter((p) => p.tipo === "profesional");

  const persona = equipo.find((p) => p.id === d.personalId) || null;

  function elegirServicio(id) {
    const s = servicios.find((x) => x.id === id);
    setD((x) => ({
      ...x,
      itemId: id || null,
      duracion: s && s.duracion ? s.duracion : x.duracion,
      /* Si el profesional elegido no da ese servicio, se suelta: es
         preferible que quede vacío a que quede una combinación inválida
         que el servidor va a rechazar. */
      personalId: id && x.personalId && !equipo.find((p) => p.id === x.personalId && p.servicios.includes(id))
        ? null : x.personalId,
    }));
  }

  const cliente = clientes.find((c) => c.id === d.clienteId) || null;
  const norm = (t) => String(t || "").toLowerCase();
  const coincidencias = buscando.trim().length >= 1
    ? clientes.filter((c) => norm(c.razonSocial).includes(norm(buscando))).slice(0, 6)
    : [];

  const falta = !d.fecha || !d.hora || !d.duracion || (!d.clienteId && !d.nombre);

  return (
    <Modal open onClose={onCerrar} ancho="max-w-xl">
      <div className="p-5">
        <h3 className="f-d text-lg">{d.id ? "Editar turno" : "Nuevo turno"}</h3>

        <div className="space-y-3 mt-4">
          {/* Quién viene */}
          <Campo label="Cliente">
            {cliente ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="flex-1 text-sm text-texto border border-borde rounded-lg px-2.5 py-1.5 truncate">
                  {cliente.razonSocial}
                </span>
                <button onClick={() => setD((x) => ({ ...x, clienteId: null }))}
                  className="p-2 rounded-lg text-texto-tenue hover:text-mal hover:bg-superficie-2" title="Quitar">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
                  <input value={buscando} onChange={(e) => setBuscando(e.target.value)}
                    placeholder={clientes.length ? "Buscar un cliente cargado" : "Todavía no hay clientes cargados"}
                    className={`${inputCls} pl-8`} />
                </div>
                {coincidencias.length > 0 && (
                  <ul className="mt-1 border border-borde rounded-lg divide-y divide-borde max-h-40 overflow-auto">
                    {coincidencias.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => { setD((x) => ({ ...x, clienteId: c.id, nombre: c.razonSocial })); setBuscando(""); }}
                          className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-superficie-2">
                          {c.razonSocial}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)}
                    placeholder="…o anotar un nombre suelto" className={inputCls} />
                  <input value={d.telefono || ""} onChange={(e) => set("telefono", e.target.value)}
                    placeholder="Teléfono" className={inputCls} />
                </div>
              </>
            )}
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Servicio">
              <select value={d.itemId || ""} onChange={(e) => elegirServicio(e.target.value || null)} className={inputCls}>
                <option value="">Sin especificar</option>
                {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Profesional">
              <select value={d.personalId || ""} onChange={(e) => set("personalId", e.target.value || null)} className={inputCls}>
                <option value="">Sin asignar</option>
                {habilitados.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Campo>
          </div>

          {servicio && (
            <p className="text-xs text-texto-suave -mt-1">
              {servicio.duracion} min · {money(servicio.precio)}
              {d.itemId && habilitados.length === 0 && " · nadie del equipo tiene habilitado este servicio"}
            </p>
          )}

          <div className="grid grid-cols-4 gap-3">
            <Campo label="Sala o recurso">
              <select value={d.recursoId || ""} onChange={(e) => set("recursoId", e.target.value || null)} className={inputCls}>
                <option value="">Sin sala</option>
                {salas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Fecha">
              <input type="date" value={d.fecha} onChange={(e) => set("fecha", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Hora">
              <input type="time" value={d.hora} onChange={(e) => set("hora", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Duración">
              <input type="number" step="5" min="5" value={d.duracion}
                onChange={(e) => set("duracion", Number(e.target.value))} className={inputCls} />
            </Campo>
          </div>

          {persona && persona.horarios.length > 0 && d.fecha && (
            <p className="text-xs text-texto-tenue -mt-1">
              {(() => {
                const fr = franjasDelDia(persona, new Date(`${d.fecha}T12:00:00`));
                return fr.length
                  ? `${persona.nombre} trabaja ${fr.map((f) => `${aReloj(f.desde)} a ${aReloj(f.hasta)}`).join(" y ")}.`
                  : `${persona.nombre} no trabaja ese día.`;
              })()}
            </p>
          )}

          <Campo label="Observaciones">
            <input value={d.notas || ""} onChange={(e) => set("notas", e.target.value)}
              placeholder="Traer toalla, primera vez, alergia…" className={inputCls} />
          </Campo>

          {error && <p className="text-sm text-mal">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={falta || guardando} onClick={async () => {
            setGuardando(true);
            setError("");
            const problema = await onGuardar(d);
            setGuardando(false);
            if (problema) setError(problema); else onCerrar();
          }}>
            <Check size={15} /> {guardando ? "Guardando…" : "Guardar turno"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   La pantalla
   ------------------------------------------------------------ */

export function Agenda({ empresaId, sucursalId, permisos, clientes, toast, ir }) {
  const [vista, setVista] = useState("dia");
  const [agrupar, setAgrupar] = useState("profesional");
  const [pestana, setPestana] = useState("calendario");
  const [fecha, setFecha] = useState(() => alArrancar(new Date()));

  const [equipo, setEquipo] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [salas, setSalas] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [alta, setAlta] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [filtro, setFiltro] = useState({ personalId: "", recursoId: "", estado: "" });

  const ventana = useMemo(() => (
    vista === "dia"
      ? { desde: fecha, hasta: sumarDias(fecha, 1) }
      : { desde: lunesDe(fecha), hasta: sumarDias(lunesDe(fecha), 7) }
  ), [vista, fecha]);

  /* El catálogo del rubro se pide una vez; los turnos, cada vez que
     cambia la ventana o un filtro. */
  useEffect(() => {
    let vigente = true;
    Promise.all([cargarEquipo(empresaId), cargarServicios(empresaId), cargarRecursos(empresaId)])
      .then(([e, s, r]) => {
        if (!vigente) return;
        setEquipo(e);
        setServicios(s);
        setSalas((r || []).filter((x) => x.activo));
      })
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar el equipo."); });
    return () => { vigente = false; };
  }, [empresaId]);

  const releer = useCallback(async () => {
    const xs = await cargarTurnos(empresaId, {
      desde: ventana.desde,
      hasta: ventana.hasta,
      personalId: filtro.personalId || null,
      recursoId: filtro.recursoId || null,
      estado: filtro.estado || null,
    });
    setTurnos(xs);
  }, [empresaId, ventana, filtro]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar los turnos."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  /* Recepción y el profesional tienen que ver lo mismo. `reservas` ya
     estaba publicada en tiempo real, así que esto salió gratis. */
  useEffect(() => {
    const cortar = escucharTurnos(empresaId, () => { releer().catch(() => {}); });
    return cortar;
  }, [empresaId, releer]);

  const profesionales = useMemo(() => equipo.filter((p) => p.tipo === "profesional"), [equipo]);

  /* Las columnas del calendario. En el día son las personas o las salas;
     en la semana, los siete días. */
  const columnas = useMemo(() => {
    if (vista === "semana") {
      const persona = filtro.personalId ? equipo.find((p) => p.id === filtro.personalId) : null;
      return Array.from({ length: 7 }, (_, i) => {
        const d = sumarDias(ventana.desde, i);
        const franjas = persona
          ? franjasDelDia(persona, d)
          : unir(profesionales.flatMap((p) => franjasDelDia(p, d)));
        return {
          k: paraInput(d),
          n: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(/^\w/, (c) => c.toUpperCase()),
          sub: `${d.getDate()}/${d.getMonth() + 1}`,
          franjas,
        };
      });
    }
    if (agrupar === "sala") {
      return salas.map((s) => ({ k: s.id, n: s.nombre, sub: s.sector || "", franjas: [{ desde: 0, hasta: 1440 }] }));
    }
    return profesionales
      .filter((p) => !filtro.personalId || p.id === filtro.personalId)
      .map((p) => ({ k: p.id, n: p.nombre, sub: p.especialidad, franjas: franjasDelDia(p, fecha) }));
  }, [vista, agrupar, salas, profesionales, equipo, fecha, ventana.desde, filtro.personalId]);

  const bloques = useMemo(() => turnos.map((t) => ({
    id: t.id,
    columna: vista === "semana" ? paraInput(t.desde) : (agrupar === "sala" ? t.recursoId : t.personalId),
    desde: minutosDe(t.desde),
    hasta: minutosDe(t.desde) + t.duracion,
    turno: t,
  })), [turnos, vista, agrupar]);

  /* El rango de horas que se dibuja sale de los horarios cargados, no de
     un 8 a 20 fijo: un negocio que abre a las 7 no tiene por qué
     desplazar la pantalla para ver su primer turno. */
  const [desdeHora, hastaHora] = useMemo(() => {
    const fs = columnas.flatMap((c) => c.franjas || []).filter((f) => f.hasta - f.desde < 1440);
    const conTurnos = turnos.map((t) => minutosDe(t.desde));
    const min = Math.min(...[...fs.map((f) => f.desde), ...conTurnos, 9 * 60]);
    const max = Math.max(...[...fs.map((f) => f.hasta), ...turnos.map((t) => minutosDe(t.desde) + t.duracion), 18 * 60]);
    return [Math.max(0, Math.floor(min / 60) - 1), Math.min(24, Math.ceil(max / 60) + 1)];
  }, [columnas, turnos]);

  async function guardar(d) {
    const desde = conHora(new Date(`${d.fecha}T12:00:00`), d.hora);
    try {
      if (d.id) {
        await moverTurno(d.id, desde, Number(d.duracion));
      } else {
        await agendarTurno({
          empresaId, sucursalId,
          clienteId: d.clienteId || null,
          personalId: d.personalId || null,
          recursoId: d.recursoId || null,
          itemId: d.itemId || null,
          nombre: d.nombre || (clientes.find((c) => c.id === d.clienteId) || {}).razonSocial || "Sin nombre",
          telefono: d.telefono || null,
          desde, duracion: Number(d.duracion), notas: d.notas, estado: d.estado,
        });
      }
      await releer();
      toast("Turno guardado.");
      return null;
    } catch (e) {
      return e.message || "No se pudo guardar el turno.";
    }
  }

  async function mover(t, estado) {
    try {
      await cambiarEstado(t.id, estado);
      await releer();
      setAbierto((a) => (a && a.id === t.id ? { ...a, estado } : a));
      toast(`Turno marcado como ${estadoDe(estado).n.toLowerCase()}.`);
    } catch (e) {
      toast(e.message || "No se pudo cambiar el estado.", "mal");
    }
  }

  const hoy = alArrancar(new Date());
  const esHoy = fecha.getTime() === hoy.getTime();

  const pestanas = [
    { k: "calendario", n: "Calendario" },
    { k: "lista", n: "Lista", badge: turnos.length || null },
  ];

  return (
    <div className="space-y-4">
      {/* ---------- Barra de control ---------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setFecha((f) => sumarDias(f, vista === "dia" ? -1 : -7))}
            className="p-2 rounded-lg border border-borde text-texto-suave hover:bg-superficie-2" title="Anterior">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setFecha(hoy)}
            className={`px-3 py-2 rounded-lg border text-sm font-semibold ${esHoy && vista === "dia" ? "border-acento text-acento" : "border-borde text-texto-suave hover:bg-superficie-2"}`}>
            Hoy
          </button>
          <button onClick={() => setFecha((f) => sumarDias(f, vista === "dia" ? 1 : 7))}
            className="p-2 rounded-lg border border-borde text-texto-suave hover:bg-superficie-2" title="Siguiente">
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="f-d text-base min-w-[190px]">
          {vista === "dia"
            ? fechaLarga(fecha)
            : `${ventana.desde.getDate()}/${ventana.desde.getMonth() + 1} al ${sumarDias(ventana.hasta, -1).getDate()}/${sumarDias(ventana.hasta, -1).getMonth() + 1}`}
        </div>

        <div className="flex rounded-lg border border-borde overflow-hidden">
          {[["dia", "Día"], ["semana", "Semana"]].map(([k, n]) => (
            <button key={k} onClick={() => setVista(k)}
              className={`px-3 py-1.5 text-sm font-semibold ${vista === k ? "bg-superficie-3 text-texto" : "text-texto-suave hover:bg-superficie-2"}`}>
              {n}
            </button>
          ))}
          <Apagado motivo="La vista de mes" className="px-3 py-1.5 text-sm font-semibold">Mes</Apagado>
        </div>

        {vista === "dia" && (
          <div className="flex rounded-lg border border-borde overflow-hidden">
            {[["profesional", "Por profesional"], ["sala", "Por sala"]].map(([k, n]) => (
              <button key={k} onClick={() => setAgrupar(k)}
                className={`px-3 py-1.5 text-sm font-semibold ${agrupar === k ? "bg-superficie-3 text-texto" : "text-texto-suave hover:bg-superficie-2"}`}>
                {n}
              </button>
            ))}
          </div>
        )}

        <select value={filtro.personalId} onChange={(e) => setFiltro((f) => ({ ...f, personalId: e.target.value }))}
          className="text-sm border border-borde rounded-lg px-2.5 py-2 bg-superficie outline-none focus:border-acento">
          <option value="">Todos los profesionales</option>
          {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        <select value={filtro.estado} onChange={(e) => setFiltro((f) => ({ ...f, estado: e.target.value }))}
          className="text-sm border border-borde rounded-lg px-2.5 py-2 bg-superficie outline-none focus:border-acento">
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e.k} value={e.k}>{e.n}</option>)}
        </select>

        <Boton size="sm" className="ml-auto" onClick={() => setAlta({ fecha: paraInput(fecha) })}>
          <Plus size={14} /> Nuevo turno
        </Boton>
      </div>

      <Tabs value={pestana} onChange={setPestana} items={pestanas} />
      <div className="flex flex-wrap gap-3 -mt-2">
        {["Clases", "Lista de espera", "Asistencia"].map((n) => (
          <Apagado key={n} motivo={n} className="text-sm font-semibold py-2">{n}</Apagado>
        ))}
      </div>

      {/* ---------- Contenido ---------- */}
      <Card className="overflow-hidden">
        {error ? (
          <ErrorEstado onReintentar={() => releer().catch((e) => setError(e.message))}>{error}</ErrorEstado>
        ) : cargando ? (
          <Cargando>Buscando los turnos…</Cargando>
        ) : pestana === "lista" ? (
          turnos.length === 0 ? (
            <Vacio>No hay turnos {vista === "dia" ? "para este día" : "en esta semana"}.</Vacio>
          ) : (
            <ul className="divide-y divide-borde">
              {turnos.map((t) => (
                <li key={t.id}>
                  <button onClick={() => setAbierto(t)} className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                    <span className="f-m text-sm text-texto w-24 shrink-0">
                      {vista === "semana" && <span className="text-texto-tenue">{t.desde.getDate()}/{t.desde.getMonth() + 1} </span>}
                      {soloHora(t.desde)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-texto truncate">{t.cliente}</div>
                      <div className="text-[11px] text-texto-tenue truncate">
                        {[t.servicio, t.profesional, t.sala].filter(Boolean).join(" · ") || "sin detalle"}
                      </div>
                    </div>
                    <span className="f-m text-[11px] text-texto-tenue shrink-0">{t.duracion} min</span>
                    <Sello tono={estadoDe(t.estado).tono}>{estadoDe(t.estado).n}</Sello>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <Calendario
            columnas={columnas}
            bloques={bloques}
            desdeHora={desdeHora}
            hastaHora={hastaHora}
            onBloque={(b) => setAbierto(b.turno)}
            onVacio={(columnaK, min) => {
              const base = vista === "semana" ? new Date(`${columnaK}T12:00:00`) : fecha;
              setAlta({
                fecha: paraInput(base),
                hora: aReloj(min),
                personalId: vista === "dia" && agrupar === "profesional" ? columnaK : "",
                recursoId: vista === "dia" && agrupar === "sala" ? columnaK : "",
              });
            }}
            dibujarBloque={(b, alto) => {
              const t = b.turno;
              const e = estadoDe(t.estado);
              const tono = {
                bien: "border-bien bg-bien-suave text-bien",
                ojo: "border-ojo bg-ojo-suave text-ojo",
                mal: "border-mal bg-mal-suave text-mal",
                info: "border-info bg-info-suave text-info",
                acento: "border-acento bg-acento-suave text-acento",
                tenue: "border-borde bg-superficie-2 text-texto-tenue",
              }[e.tono];
              return (
                <span className={`block h-full rounded-lg border px-2 py-1 overflow-hidden ${tono}`}>
                  <span className="block text-[11px] font-semibold text-texto truncate">
                    {t.servicio || t.cliente}
                  </span>
                  {alto > 34 && (
                    <span className="block text-[10px] truncate opacity-80">
                      {soloHora(t.desde)} · {t.servicio ? t.cliente : t.profesional}
                    </span>
                  )}
                </span>
              );
            }}
          />
        )}
      </Card>

      {/* ---------- El detalle ---------- */}
      <Drawer open={!!abierto} onClose={() => setAbierto(null)}
        titulo={abierto ? abierto.cliente : ""}
        subtitulo={abierto ? `${fechaLarga(abierto.desde)} · ${soloHora(abierto.desde)}` : ""}
        acciones={abierto && (
          <div className="flex flex-wrap gap-2">
            {abierto.estado === "pendiente" && (
              <Boton size="sm" onClick={() => mover(abierto, "confirmada")}><Check size={14} /> Confirmar</Boton>
            )}
            {OCUPAN.includes(abierto.estado) && abierto.estado !== "cumplida" && (
              <Boton size="sm" variant="ghost" onClick={() => mover(abierto, "cumplida")}>Asistió</Boton>
            )}
            {abierto.estado !== "cumplida" && (
              <Boton size="sm" variant="ghost" onClick={() => mover(abierto, "ausente")}>No vino</Boton>
            )}
            <Boton size="sm" variant="ghost" onClick={() => { setAlta({ ...aFormulario(abierto) }); setAbierto(null); }}>
              <RotateCcw size={14} /> Reprogramar
            </Boton>
            {abierto.estado !== "cancelada" && (
              <button onClick={() => mover(abierto, "cancelada")}
                className="text-xs font-semibold text-mal hover:underline px-2">Cancelar turno</button>
            )}
          </div>
        )}>
        {abierto && (
          <div className="space-y-4">
            <Sello tono={estadoDe(abierto.estado).tono}>{estadoDe(abierto.estado).n}</Sello>

            <dl className="space-y-2.5 text-sm">
              {[
                [CalendarDays, "Cuándo", `${fechaLarga(abierto.desde)}, ${soloHora(abierto.desde)} a ${soloHora(abierto.hasta)}`],
                [Clock, "Duración", `${abierto.duracion} minutos`],
                [User, "Profesional", abierto.profesional || "sin asignar"],
                [MapPin, "Sala", abierto.sala || "sin sala"],
              ].map(([Ico, rot, val]) => (
                <div key={rot} className="flex items-start gap-2.5">
                  <Ico size={15} className="text-texto-tenue mt-0.5 shrink-0" />
                  <dt className="text-texto-tenue w-24 shrink-0">{rot}</dt>
                  <dd className="text-texto min-w-0 flex-1">{val}</dd>
                </div>
              ))}
            </dl>

            {abierto.servicio && (
              <div className="rounded-xl border border-borde p-3">
                <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Servicio</div>
                <div className="text-sm text-texto mt-1">{abierto.servicio}</div>
                <div className="f-m text-sm text-texto-suave mt-0.5">{money(abierto.precio)}</div>
                {abierto.pagado > 0 && (
                  <div className="f-m text-xs text-bien mt-1">Cobrado {money(abierto.pagado)}</div>
                )}
              </div>
            )}

            {abierto.telefono && (
              <a href={`https://wa.me/${abierto.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                className="block text-sm text-acento hover:underline">Escribirle por WhatsApp</a>
            )}

            <Campo label="Observaciones">
              <textarea defaultValue={abierto.notas} rows={3} className={inputCls}
                onBlur={async (e) => {
                  if (e.target.value === abierto.notas) return;
                  try { await guardarNotas(abierto.id, e.target.value); await releer(); }
                  catch (err) { toast(err.message || "No se pudo guardar la nota.", "mal"); }
                }} />
            </Campo>

            <p className="text-xs text-texto-tenue">
              Cobrar el turno y descontarlo de un abono todavía no está: llega con el módulo de Ventas.
            </p>
          </div>
        )}
      </Drawer>

      <FormTurno abierto={!!alta} inicial={alta} equipo={equipo} servicios={servicios}
        salas={salas} clientes={clientes} onGuardar={guardar} onCerrar={() => setAlta(null)} />
    </div>
  );
}

/* Del turno al formulario, para reprogramar sin volver a cargar todo. */
function aFormulario(t) {
  return {
    id: t.id,
    fecha: `${t.desde.getFullYear()}-${String(t.desde.getMonth() + 1).padStart(2, "0")}-${String(t.desde.getDate()).padStart(2, "0")}`,
    hora: `${String(t.desde.getHours()).padStart(2, "0")}:${String(t.desde.getMinutes()).padStart(2, "0")}`,
    duracion: t.duracion,
    clienteId: t.clienteId, nombre: t.cliente, telefono: t.telefono,
    personalId: t.personalId, itemId: t.itemId, recursoId: t.recursoId,
    notas: t.notas, estado: t.estado,
  };
}

/* Junta franjas que se tocan o se pisan. Sin esto, el fondo del horario
   se dibuja varias veces encima de sí mismo y queda más claro donde se
   superponen dos personas, que no significa nada. */
function unir(franjas) {
  const orden = [...franjas].sort((a, b) => a.desde - b.desde);
  const salida = [];
  for (const f of orden) {
    const ultima = salida[salida.length - 1];
    if (ultima && f.desde <= ultima.hasta) ultima.hasta = Math.max(ultima.hasta, f.hasta);
    else salida.push({ ...f });
  }
  return salida;
}
