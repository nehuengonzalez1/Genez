/* ============================================================
   20. REPORTES · cómo va el negocio y dónde habría que actuar
   ============================================================

   Un reporte no existe para mostrar datos: existe para ayudar a decidir.
   Por eso el orden de la pantalla no es "primero los gráficos lindos"
   sino el de las preguntas que se hace alguien que abre esto un lunes a
   la mañana. Cada bloque contesta una y solo una; el que no contestaba
   ninguna no está.

   UN SOLO CONTEXTO PARA TODA LA PANTALLA
   --------------------------------------
   El rango de fechas, la comparación y los filtros valen para todo lo que
   se ve. Ninguna tarjeta consulta por su cuenta ni elige su propio
   período: `cargarInforme` arma todo de una y acá solo se dibuja. Dos
   tarjetas mostrando ventanas distintas del mismo negocio es la forma más
   rápida de que nadie vuelva a confiar en el informe.

   LO QUE NO SE PUEDE FILTRAR SE ACLARA, NO SE DISIMULA
   ----------------------------------------------------
   Un alquiler no es de pilates ni de estética: los egresos no tienen
   área. Así que con un filtro puesto, el resultado neto y la curva de
   egresos siguen siendo del negocio entero y la pantalla lo dice. La
   alternativa —mostrar un número que parece filtrado y no lo está— es
   peor que no mostrarlo.

   LO QUE TODAVÍA NO SE PUEDE CALCULAR, NO SE INVENTA
   --------------------------------------------------
   No hay costo cargado en las prestaciones y los egresos no se imputan a
   un área, así que "rentabilidad por área" es hoy "ingresos por área", y
   está dicho al pie de la tarjeta. Un margen inventado en un informe
   financiero no es un detalle estético: es alguien tomando una decisión
   con un número falso.
   ============================================================ */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Wallet, TrendingUp, CalendarClock, PieChart as IconoTorta, Users, Receipt,
  Calendar, GitCompareArrows, Download, X, Sparkles, ArrowRight, RefreshCw,
} from "lucide-react";
import {
  cargarInforme, rangoDe, comparacionDe, PERIODOS, COMPARACIONES,
} from "../datos/informes.js";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import {
  Card, Boton, Tabs, Kpi, Vacio, Cargando, ErrorEstado, TablaSimple, Apagado,
} from "../ui/Base.jsx";
import { Anillo, Referencia, BarraDato } from "../ui/Graficos.jsx";
import { inputCls } from "../ui/Campos.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

const fecha = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
const paraInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deInput = (s) => { const [a, m, d] = s.split("-").map(Number); return new Date(a, m - 1, d); };

const GRANOS = [{ k: "dia", n: "Diario" }, { k: "semana", n: "Semanal" }, { k: "mes", n: "Mensual" }];

const PESTANAS = [
  { k: "resumen", n: "Resumen general" },
  { k: "turnos", n: "Turnos" },
  { k: "finanzas", n: "Finanzas" },
  { k: "servicios", n: "Servicios" },
  { k: "profesionales", n: "Profesionales" },
  { k: "salas", n: "Salas" },
  { k: "clientes", n: "Clientes" },
];

/* Rótulo de sección con su pregunta al lado. La pregunta no es adorno: es
   la única forma de que quien mira sepa para qué está ese bloque, y de
   que el que lo mantenga sepa cuándo sacarlo. */
function Titulo({ children, pregunta, extra }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
      <div className="min-w-0">
        <div className={ROTULO}>{children}</div>
        {pregunta && <p className="text-xs text-texto-suave mt-1">{pregunta}</p>}
      </div>
      {extra}
    </div>
  );
}

function Pastilla({ activo, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
        activo
          ? "bg-superficie-3 text-texto border-superficie-3"
          : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
      {children}
    </button>
  );
}

function Selector({ label, valor, onChange, opciones, todos = "Todas" }) {
  return (
    <div className="min-w-0 flex-1">
      <label className={ROTULO}>{label}</label>
      <select value={valor || ""} onChange={(e) => onChange(e.target.value || null)}
        className={`${inputCls} mt-1.5`}>
        <option value="">{todos}</option>
        {opciones.map((o) => <option key={o.k} value={o.k}>{o.n}</option>)}
      </select>
    </div>
  );
}

const TONO_INSIGHT = {
  bien: "text-bien border-bien bg-bien-suave",
  mal: "text-mal border-mal bg-mal-suave",
  ojo: "text-ojo border-ojo bg-ojo-suave",
  info: "text-info border-info bg-info-suave",
  tenue: "text-texto-tenue border-borde bg-superficie-2",
};

function Tarjeta({ tono, texto, accion, onAccion }) {
  return (
    <div className="border border-borde rounded-lg p-4 flex flex-col gap-2 min-w-0">
      <span className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${TONO_INSIGHT[tono] || TONO_INSIGHT.tenue}`}>
        <Sparkles size={13} />
      </span>
      <p className="text-sm text-texto leading-relaxed">{texto}</p>
      {accion && (
        <button onClick={onAccion}
          className="text-xs font-semibold text-acento hover:underline flex items-center gap-1 mt-auto self-start">
          {accion} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

export function Informes({ empresaId, ir }) {
  const [pestana, setPestana] = useState("resumen");

  const [preset, setPreset] = useState("30d");
  const [rango, setRango] = useState(() => rangoDe("30d"));
  const [modoComparar, setModoComparar] = useState("anterior");
  const [comparaLibre, setComparaLibre] = useState(null);
  const [filtros, setFiltros] = useState({});
  const [grano, setGrano] = useState(null);

  const [abierto, setAbierto] = useState(null);   // 'periodo' | 'comparar'
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  const comparar = useMemo(
    () => comparacionDe(modoComparar, rango.desde, rango.hasta, comparaLibre),
    [modoComparar, rango, comparaLibre]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    cargarInforme(empresaId, { ...rango, comparar, filtros, grano })
      .then((r) => { if (vigente) setD(r); })
      .catch((e) => { if (vigente) setError(e.message || "No pudimos armar el informe."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [empresaId, rango, comparar, filtros, grano, intento]);

  const elegirPreset = useCallback((k) => {
    setPreset(k);
    if (k !== "libre") { setRango(rangoDe(k)); setGrano(null); setAbierto(null); }
  }, []);

  const setFiltro = (k, v) => setFiltros((f) => {
    const nuevo = { ...f };
    if (v) nuevo[k] = v; else delete nuevo[k];
    return nuevo;
  });

  const hayFiltro = Object.keys(filtros).length > 0;

  if (error) return <ErrorEstado onReintentar={() => setIntento((x) => x + 1)}>{error}</ErrorEstado>;
  if (cargando && !d) return <Cargando>Armando el informe…</Cargando>;
  if (!d) return null;

  const { kpis, ingresos, finanzas, ocupacion, asistencia, equipo, clientes } = d;
  const sinNada = ingresos.total === 0 && asistencia.total === 0;

  const irA = (x) => { if (x.tab && ir) ir(x.tab); };

  return (
    <div className="space-y-5">
      {/* ============ ENCABEZADO ============ */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="f-d text-2xl">Reportes</h2>
          <p className="text-sm text-texto-suave mt-0.5">
            Analizá el rendimiento de tu negocio y descubrí dónde actuar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Boton variant="ghost" onClick={() => setAbierto(abierto === "periodo" ? null : "periodo")}>
            <Calendar size={15} /> {fecha(d.desde)} — {fecha(d.hasta)}
          </Boton>
          <Boton variant="ghost" onClick={() => setAbierto(abierto === "comparar" ? null : "comparar")}>
            <GitCompareArrows size={15} />
            {(COMPARACIONES.find((x) => x.k === modoComparar) || {}).n}
          </Boton>
          {/* No hay exportación en el sistema todavía. Un botón que no
              exporta nada es peor que uno apagado que dice por qué. */}
          <Apagado motivo="Exportar" className="px-4 py-2.5 rounded-md text-sm font-semibold">
            <Download size={15} /> Exportar
          </Apagado>
        </div>
      </div>

      {/* ============ PERÍODO ============ */}
      {abierto === "periodo" && (
        <Card className="p-5">
          <Titulo pregunta="Todo lo que se ve abajo usa este rango."
            extra={<button onClick={() => setAbierto(null)} className="text-texto-tenue hover:text-texto"><X size={16} /></button>}>
            Período
          </Titulo>
          <div className="flex flex-wrap gap-1.5">
            {PERIODOS.map((p) => (
              <Pastilla key={p.k} activo={preset === p.k} onClick={() => elegirPreset(p.k)}>{p.n}</Pastilla>
            ))}
          </div>
          {preset === "libre" && (
            <div className="flex flex-wrap items-end gap-3 mt-4">
              <div>
                <label className={ROTULO}>Desde</label>
                <input type="date" value={paraInput(d.desde)}
                  onChange={(e) => { setRango((r) => ({ ...r, desde: deInput(e.target.value) })); setGrano(null); }}
                  className={`${inputCls} mt-1.5`} />
              </div>
              <div>
                <label className={ROTULO}>Hasta</label>
                <input type="date" value={paraInput(d.hasta)}
                  onChange={(e) => { setRango((r) => ({ ...r, hasta: deInput(e.target.value) })); setGrano(null); }}
                  className={`${inputCls} mt-1.5`} />
              </div>
              <p className="text-xs text-texto-tenue pb-2">Cualquier rango, no solo meses enteros.</p>
            </div>
          )}
        </Card>
      )}

      {/* ============ COMPARACIÓN ============ */}
      {abierto === "comparar" && (
        <Card className="p-5">
          <Titulo pregunta="Contra qué se calculan las variaciones de los indicadores."
            extra={<button onClick={() => setAbierto(null)} className="text-texto-tenue hover:text-texto"><X size={16} /></button>}>
            Comparar con
          </Titulo>
          <div className="flex flex-wrap gap-1.5">
            {COMPARACIONES.map((c) => (
              <Pastilla key={c.k} activo={modoComparar === c.k} onClick={() => setModoComparar(c.k)}>{c.n}</Pastilla>
            ))}
          </div>
          {modoComparar === "libre" && (
            <div className="flex flex-wrap items-end gap-3 mt-4">
              <div>
                <label className={ROTULO}>Desde</label>
                <input type="date" value={comparaLibre ? paraInput(comparaLibre.desde) : ""}
                  onChange={(e) => setComparaLibre((c) => ({ desde: deInput(e.target.value), hasta: (c && c.hasta) || deInput(e.target.value) }))}
                  className={`${inputCls} mt-1.5`} />
              </div>
              <div>
                <label className={ROTULO}>Hasta</label>
                <input type="date" value={comparaLibre ? paraInput(comparaLibre.hasta) : ""}
                  onChange={(e) => setComparaLibre((c) => ({ desde: (c && c.desde) || deInput(e.target.value), hasta: deInput(e.target.value) }))}
                  className={`${inputCls} mt-1.5`} />
              </div>
            </div>
          )}
          {d.comparar && (
            <p className="text-xs text-texto-tenue mt-3">
              Comparando contra {fecha(d.comparar.desde)} — {fecha(d.comparar.hasta)}.
            </p>
          )}
        </Card>
      )}

      {/* ============ FILTROS ============ */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          {/* Un filtro que no discrimina nada confunde más que ayuda. */}
          <div className="min-w-0 flex-1">
            <label className={ROTULO}>Sucursal</label>
            <Apagado motivo="Una sola sucursal" className={`${inputCls} mt-1.5 !justify-start`}>Todas</Apagado>
          </div>
          <Selector label="Área" valor={filtros.area} opciones={d.opciones.areas}
            onChange={(v) => setFiltro("area", v)} />
          <Selector label="Profesional" valor={filtros.personal} opciones={d.opciones.profesionales}
            onChange={(v) => setFiltro("personal", v)} todos="Todos" />
          <Selector label="Prestación" valor={filtros.item} opciones={d.opciones.servicios}
            onChange={(v) => setFiltro("item", v)} todos="Todas" />
          <Selector label="Sala o recurso" valor={filtros.recurso} opciones={d.opciones.salas}
            onChange={(v) => setFiltro("recurso", v)} />
          {hayFiltro && (
            <button onClick={() => setFiltros({})}
              className="text-xs font-semibold text-acento hover:underline flex items-center gap-1 pb-2.5 shrink-0">
              <X size={13} /> Limpiar filtros
            </button>
          )}
        </div>
        {hayFiltro && (
          <p className="text-xs text-ojo mt-3">
            Con un filtro puesto, el resultado neto y los egresos siguen siendo del
            negocio entero: un alquiler no pertenece a un área ni a una persona.
          </p>
        )}
      </Card>

      <Tabs value={pestana} onChange={setPestana} items={PESTANAS} />

      {pestana !== "resumen" ? (
        <Card className="p-6">
          <Apagado motivo={(PESTANAS.find((p) => p.k === pestana) || {}).n}>
            Esta pestaña todavía no existe. Lo que se puede calcular hoy con datos
            reales está en el resumen; el resto llega cuando haya de dónde sacarlo.
          </Apagado>
        </Card>
      ) : sinNada ? (
        <Card className="p-6">
          <Vacio>
            No hay movimiento en este período. Probá con un rango más amplio o
            sacando los filtros.
          </Vacio>
        </Card>
      ) : (
        <>
          {/* ============ 1 · ¿CÓMO ESTÁ EL NEGOCIO? ============ */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Ingresos totales" valor={money(ingresos.total)} delta={kpis.ingresos.delta}
              icono={Wallet} sub={d.comparar ? "vs período anterior" : null} />
            <Kpi label="Resultado neto" valor={money(finanzas.resultado)} delta={kpis.resultado.delta}
              icono={TrendingUp} tono={finanzas.resultado >= 0 ? "bien" : "mal"}
              sub={finanzas.margen !== null ? `${pct(finanzas.margen, 0)} de margen` : null} />
            <Kpi label="Turnos totales" valor={nf.format(asistencia.total)} delta={kpis.turnos.delta}
              icono={CalendarClock} />
            <Kpi label="Ocupación promedio" valor={ocupacion.promedio ? pct(ocupacion.promedio, 0) : "—"}
              icono={IconoTorta} sub="del horario del equipo" />
            <Kpi label="Clientes activos" valor={nf.format(clientes.activos)} delta={kpis.clientes.delta}
              icono={Users} sub="vinieron al menos una vez" />
            <Kpi label="Ticket promedio" valor={money(ingresos.ticket)} delta={kpis.ticket.delta}
              icono={Receipt} sub={`${nf.format(ingresos.operaciones)} ventas`} />
          </div>

          {/* ============ 2 · ¿QUÉ ESTÁ PASANDO? ============ */}
          {d.insights.length > 0 && (
            <Card className="p-5">
              <Titulo pregunta="Lo que dicen los números de arriba, dicho en palabras. Sale de este mismo informe.">
                Insights de Genez
              </Titulo>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {d.insights.map((x) => (
                  <Tarjeta key={x.k} tono={x.tono} texto={x.texto} accion={x.accion} onAccion={() => irA(x)} />
                ))}
              </div>
            </Card>
          )}

          {/* ============ 3 · ¿CÓMO CAMBIÓ? · ¿DE DÓNDE VIENE? ============ */}
          <div className="grid xl:grid-cols-3 gap-4">
            <Card className="p-5 xl:col-span-2">
              <Titulo pregunta="Lo que entró, lo que salió y lo que quedó."
                extra={
                  <div className="flex gap-1.5">
                    {GRANOS.map((g) => (
                      <Pastilla key={g.k} activo={(grano || d.grano) === g.k} onClick={() => setGrano(g.k)}>{g.n}</Pastilla>
                    ))}
                  </div>
                }>
                Evolución
              </Titulo>
              {!d.evolucion.length ? <Vacio>Sin movimientos de caja en este período.</Vacio> : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={d.evolucion} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="rgb(var(--borde))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }}
                      axisLine={false} tickLine={false}
                      interval={Math.max(0, Math.floor(d.evolucion.length / 10))} />
                    <YAxis tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }}
                      tickFormatter={moneyk} axisLine={false} tickLine={false} width={58} />
                    <Tooltip formatter={(v, k) => [money(v), k[0].toUpperCase() + k.slice(1)]}
                      contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid rgb(var(--borde))", background: "rgb(var(--superficie))" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="plainline" />
                    <Line type="monotone" dataKey="ingresos" name="Ingresos" stroke="rgb(var(--bien))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="egresos" name="Egresos" stroke="rgb(var(--mal))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="resultado" name="Resultado" stroke="rgb(var(--acento))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-5">
              <Titulo pregunta="Un abono es plata de hoy por horas de las próximas semanas.">
                Ingresos por fuente
              </Titulo>
              <Anillo datos={ingresos.fuentes} centro={moneyk(ingresos.total)} sub="en el período" />
              <div className="mt-3">
                <Referencia datos={ingresos.fuentes}
                  formato={(x) => `${money(x.v)} · ${pct(x.v / (ingresos.total || 1), 0)}`} />
              </div>
            </Card>
          </div>

          {/* ============ 4 · ¿QUÉ VENDO? · ¿USO LA CAPACIDAD? ============ */}
          <div className="grid xl:grid-cols-2 gap-4">
            <Card className="p-5">
              <Titulo pregunta="Ordenado por lo que factura, no por lo que se vende más veces.">
                Prestaciones y planes
              </Titulo>
              {!ingresos.porServicio.length ? <Vacio>Nada facturado en el período.</Vacio> : (
                <div className="space-y-3">
                  {ingresos.porServicio.slice(0, 5).map((s, i) => (
                    <div key={s.nombre} className="flex gap-3">
                      <span className="f-m text-xs text-texto-tenue w-4 shrink-0 pt-0.5">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <BarraDato nombre={s.nombre} valor={s.total} total={ingresos.total} formato={money} />
                        <div className="text-[11px] text-texto-tenue mt-1">
                          {nf.format(s.cantidad)} {s.plan ? "vendidos" : "turnos"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <Titulo pregunta="Horas usadas sobre las horas que el espacio está disponible.">
                Ocupación por sala
              </Titulo>
              {!ocupacion.salas.length ? <Vacio>No hay espacios cargados.</Vacio> : (
                <div className="space-y-3">
                  {ocupacion.salas.map((s) => (
                    <div key={s.id}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate text-texto">{s.nombre}</span>
                        <span className="f-m text-xs shrink-0">
                          {s.pct === null ? "—" : pct(s.pct, 0)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-superficie-2 overflow-hidden mt-1.5">
                        <div className={`h-full rounded-full ${s.horasOcupadas === 0 ? "bg-mal" : "bg-acento"}`}
                          style={{ width: `${Math.max(2, Math.round((s.pct || 0) * 100))}%` }} />
                      </div>
                      <div className="text-[11px] text-texto-tenue mt-1">
                        {s.horasOcupadas.toFixed(1)} de {s.horasOfrecidas.toFixed(0)} hs
                        {s.lugares > 0 && ` · ${nf.format(s.tomados)} de ${nf.format(s.lugares)} lugares`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ============ 5 · ¿VIENEN? · ¿DÓNDE GANO? ============ */}
          <div className="grid xl:grid-cols-2 gap-4">
            <Card className="p-5">
              <Titulo pregunta="Sobre turnos que ya pasaron: los de la semana que viene no faltaron todavía.">
                Asistencia
              </Titulo>
              {!asistencia.porEstado.length ? <Vacio>Sin turnos en este período.</Vacio> : (
                <div className="grid sm:grid-cols-2 gap-4 items-center">
                  <Anillo datos={asistencia.porEstado}
                    centro={asistencia.pct === null ? "—" : pct(asistencia.pct, 0)} sub="asistencia" />
                  <Referencia datos={asistencia.porEstado} formato={(x) => nf.format(x.v)} />
                </div>
              )}
              {asistencia.porServicio.length > 0 && (
                <p className="text-xs text-texto-suave mt-4">
                  Donde más se falta: <span className="text-texto">{asistencia.porServicio[0].nombre}</span>,
                  {" "}{pct(asistencia.porServicio[0].pct, 0)} de asistencia.
                </p>
              )}
            </Card>

            <Card className="p-5">
              <Titulo pregunta="De qué parte del negocio viene cada peso.">
                Ingresos por área
              </Titulo>
              {!ingresos.porArea.length ? <Vacio>Nada facturado en el período.</Vacio> : (
                <div className="space-y-3">
                  {ingresos.porArea.map((a) => (
                    <BarraDato key={a.nombre} nombre={a.nombre} valor={a.total}
                      total={ingresos.total} formato={money} />
                  ))}
                </div>
              )}
              {/* Esto la maqueta lo pedía como "rentabilidad". No se puede
                  todavía y decirlo es parte del trabajo. */}
              <p className="text-xs text-texto-tenue mt-4 leading-relaxed">
                Sin costos: las prestaciones no tienen costo cargado y los egresos
                —alquiler, sueldos, insumos— no se imputan a un área. Cuando existan
                esos dos datos, acá van también el resultado y el margen.
              </p>
            </Card>
          </div>

          {/* ============ 6 · ¿CÓMO TRABAJA EL EQUIPO? ============ */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <Titulo pregunta="Cuánto atendió cada uno, cuánto de su horario usó y cuánto facturó.">
                Rendimiento del equipo
              </Titulo>
            </div>
            <TablaSimple
              cols={["Profesional", "Atendidos", "Asistencia", "Ocupación", "Ingresos"]}
              filas={equipo.map((p) => [
                <div key="a">
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-[11px] text-texto-tenue">
                    {p.especialidad}
                    {p.clases > 0 && ` · ${nf.format(p.clases)} clases`}
                  </div>
                </div>,
                <span className="f-m">{nf.format(p.turnos)}</span>,
                <span className={`f-m ${p.asistencia !== null && p.asistencia < 0.8 ? "text-mal" : ""}`}>
                  {p.asistencia === null ? "—" : pct(p.asistencia, 0)}
                </span>,
                <span className="f-m">{p.ocupacion === null ? "—" : pct(p.ocupacion, 0)}</span>,
                <span className="f-m font-semibold">{money(p.ingresos)}</span>,
              ])}
              vacio="No hay profesionales con actividad en este período."
            />
            <p className="text-xs text-texto-tenue px-5 pb-5 pt-3 leading-relaxed">
              El ingreso junta dos caminos: lo que se cobró derecho al turno y la
              parte del abono que consumió cada clase —un pack de ocho clases pone
              un octavo en cada una—. Lo no consumido todavía no es de nadie.
            </p>
          </Card>

          {/* ============ 7 · ¿DÓNDE TENGO QUE ACTUAR? ============ */}
          {d.oportunidades.length > 0 && (
            <Card className="p-5">
              <Titulo pregunta="Esto no mira el período elegido: es cómo está el negocio hoy. Sale de los mismos segmentos que usa CRM.">
                Atención y oportunidades
              </Titulo>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {d.oportunidades.map((x) => (
                  <Tarjeta key={x.k} tono={x.tono} texto={x.texto} accion={x.accion} onAccion={() => irA(x)} />
                ))}
              </div>
            </Card>
          )}

          {/* ============ PIE ============ */}
          <div className="flex items-center justify-between gap-4 flex-wrap text-xs text-texto-tenue px-1">
            <span className="flex items-center gap-2">
              <RefreshCw size={12} className={cargando ? "animate-spin" : ""} />
              Calculado el {d.generado.toLocaleDateString("es-AR")} a las{" "}
              {d.generado.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
            {/* No hay caché ni proceso diferido: cada carga consulta la base.
                Decir "tiempo real" cuando no lo es sería peor que no decir nada. */}
            <span>Se lee de la base en el momento. Al cambiar un filtro se recalcula todo.</span>
          </div>
        </>
      )}
    </div>
  );
}
