/* ============================================================
   20. INFORMES · para un negocio que vende horas
   ============================================================

   El informe que había —y que sigue vivo para el minimercado y el bar—
   responde "qué se vende y qué margen deja". Un negocio de turnos no
   tiene margen por unidad: tiene horas, y las horas que no se vendieron
   no se recuperan. Por eso el orden de esta pantalla es otro.

   ARRIBA VA LA PLATA, DESPUÉS LA CAPACIDAD
   ----------------------------------------
   Cuánto entró es lo que todos vienen a mirar. Pero lo que hace que ese
   número cambie el mes que viene es la ocupación, así que va segunda y no
   escondida abajo.

   Y se muestran las horas además del porcentaje. "Sala Mat 2: 0%" no dice
   nada; "0 de 305 horas" dice que hay una sala que no se está usando.

   LOS COLORES SALEN DE LAS VARIABLES
   ----------------------------------
   Los gráficos también. `rgb(var(--acento))` funciona como cualquier
   color en un atributo SVG, así que un gráfico no queda con el naranja
   escrito a mano y encima cambia solo entre el tema claro y el oscuro.
   ============================================================ */

import React, { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { CalendarClock, Wallet, Users, UserCheck } from "lucide-react";
import { cargarInforme, PERIODOS } from "../datos/informes.js";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import { Kpi, Card, Vacio, Cargando, ErrorEstado, TablaSimple, Sello } from "../ui/Base.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

function Rotulo({ children, ayuda }) {
  return (
    <div className="mb-3">
      <div className={ROTULO}>{children}</div>
      {ayuda && <p className="text-xs text-texto-suave mt-1">{ayuda}</p>}
    </div>
  );
}

/* Una fila con barra. Se repite en cuatro bloques y en todos significa lo
   mismo: esto es cuánto, comparado con el más grande de la lista. */
function Barra({ nombre, sub, valor, proporcion, tono = "acento" }) {
  const color = tono === "bien" ? "bg-bien" : tono === "mal" ? "bg-mal" : "bg-acento";
  return (
    <li>
      <div className="flex justify-between text-sm gap-3">
        <span className="truncate text-texto">{nombre}</span>
        <span className="f-m shrink-0 text-texto-suave">{valor}</span>
      </div>
      <div className="h-1.5 bg-superficie-2 rounded-full mt-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(2, Math.round((proporcion || 0) * 100))}%` }} />
      </div>
      {sub && <div className="text-[11px] text-texto-tenue mt-1">{sub}</div>}
    </li>
  );
}

const fechaCorta = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

export function Informes({ empresaId }) {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    cargarInforme(empresaId, dias)
      .then((r) => { if (vigente) setD(r); })
      .catch((e) => { if (vigente) setError(e.message || "No pudimos armar el informe."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [empresaId, dias, intento]);

  const serie = useMemo(() => {
    if (!d) return [];
    const fin = new Date(d.hasta);
    return d.ingresos.serie.map((v, i) => {
      const f = new Date(fin.getTime() - (d.ingresos.serie.length - 1 - i) * 86400000);
      return { label: fechaCorta(f), ingresos: v };
    });
  }, [d]);

  if (error) return <ErrorEstado onReintentar={() => setIntento((x) => x + 1)}>{error}</ErrorEstado>;
  if (cargando && !d) return <Cargando>Armando el informe…</Cargando>;
  if (!d) return null;

  const { ingresos, ocupacion, asistencia, clientes } = d;
  const sinNada = ingresos.total === 0 && asistencia.total === 0;

  const maxArea = Math.max(1, ...ingresos.porArea.map((a) => a.total));
  const maxServicio = Math.max(1, ...ingresos.porServicio.map((s) => s.total));
  const maxSala = Math.max(1, ...ocupacion.salas.map((s) => s.horasOcupadas));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5">
        {PERIODOS.map((p) => (
          <button key={p.k} onClick={() => setDias(p.k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              dias === p.k
                ? "bg-superficie-3 text-texto border-superficie-3"
                : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
            {p.n}
          </button>
        ))}
        {cargando && <span className="text-xs text-texto-tenue ml-2">actualizando…</span>}
      </div>

      {sinNada ? (
        <Card className="p-6">
          <Vacio>
            Todavía no hay turnos dictados ni ventas en este período. Cuando
            empiecen a cargarse, el informe se arma solo.
          </Vacio>
        </Card>
      ) : (
        <>
          {/* ---------------------------------------------------------
              1 · La plata
              --------------------------------------------------------- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label={`Ingresos ${dias} días`} valor={money(ingresos.total)}
              delta={ingresos.delta} icono={Wallet}
              sub={`${money(ingresos.promedioDiario)} por día`} />
            <Kpi label="Ticket promedio" valor={money(ingresos.ticket)}
              sub={`${nf.format(ingresos.operaciones)} ventas`} />
            <Kpi label="Ocupación del equipo"
              valor={ocupacion.profesionales.length ? pct(promedio(ocupacion.profesionales), 0) : "—"}
              icono={CalendarClock}
              sub="de las horas que tienen cargadas" />
            <Kpi label="Asistencia"
              valor={asistencia.pct === null ? "—" : pct(asistencia.pct, 0)}
              tono={asistencia.pct !== null && asistencia.pct < 0.8 ? "mal" : "bien"}
              icono={UserCheck}
              sub={`${nf.format(asistencia.cumplidas)} de ${nf.format(asistencia.cumplidas + asistencia.ausentes)}`} />
          </div>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <Rotulo ayuda="Turnos cobrados y abonos vendidos, por día.">Ingresos</Rotulo>
              {/* Un abono es plata que entró hoy por horas que se van a dar
                  en las próximas ocho semanas. Sin este corte, un mes de
                  muchas renovaciones parece un mes de mucha actividad. */}
              <div className="flex items-center gap-5 text-right">
                <div>
                  <div className={ROTULO}>Turnos</div>
                  <div className="f-m text-sm mt-0.5">{money(ingresos.sueltos)}</div>
                </div>
                <div>
                  <div className={ROTULO}>Abonos y packs</div>
                  <div className="f-m text-sm mt-0.5">{money(ingresos.abonos)}</div>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={serie} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="gIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--acento))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="rgb(var(--acento))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgb(var(--borde))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }}
                  interval={Math.max(0, Math.floor(dias / 8))} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }}
                  tickFormatter={moneyk} axisLine={false} tickLine={false} width={60} />
                <Tooltip formatter={(v) => [money(v), "Ingresos"]}
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid rgb(var(--borde))", background: "rgb(var(--superficie))" }} />
                <Area type="monotone" dataKey="ingresos" stroke="rgb(var(--acento))" strokeWidth={2} fill="url(#gIngresos)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <Rotulo ayuda="De qué parte del negocio viene cada peso.">Por área</Rotulo>
              {!ingresos.porArea.length ? <Vacio>Nada facturado en el período.</Vacio> : (
                <ul className="space-y-3">
                  {ingresos.porArea.map((a) => (
                    <Barra key={a.nombre} nombre={a.nombre} valor={money(a.total)}
                      proporcion={a.total / maxArea}
                      sub={pct(a.total / (ingresos.total || 1), 0) + " del total"} />
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <Rotulo ayuda="Lo que más entra, contando cuántas veces se vendió.">Prestaciones y planes</Rotulo>
              {!ingresos.porServicio.length ? <Vacio>Nada facturado en el período.</Vacio> : (
                <ul className="space-y-3">
                  {ingresos.porServicio.map((s) => (
                    <Barra key={s.nombre} nombre={s.nombre} valor={money(s.total)}
                      proporcion={s.total / maxServicio}
                      sub={`${nf.format(s.cantidad)} ${s.plan ? "vendidos" : "turnos"}`} />
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* ---------------------------------------------------------
              2 · La capacidad
              --------------------------------------------------------- */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <Rotulo ayuda="Horas agendadas sobre las horas que cada uno tiene cargadas en su horario.">
                Ocupación del equipo
              </Rotulo>
              {!ocupacion.profesionales.length ? (
                <Vacio>Nadie tiene horarios cargados todavía.</Vacio>
              ) : (
                <ul className="space-y-3">
                  {ocupacion.profesionales.map((p) => (
                    <Barra key={p.id} nombre={p.nombre}
                      valor={p.pct === null ? "sin horario" : pct(p.pct, 0)}
                      proporcion={p.pct || 0}
                      tono={p.pct !== null && p.pct < 0.4 ? "mal" : "acento"}
                      sub={`${p.horasOcupadas.toFixed(1)} de ${p.horasOfrecidas.toFixed(0)} hs · ${p.detalle}`} />
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <Rotulo ayuda="Sobre las horas que abre el local. Una sala vacía no cuesta un sueldo, pero sí un alquiler.">
                Uso de los espacios
              </Rotulo>
              {!ocupacion.salas.length ? <Vacio>No hay espacios cargados.</Vacio> : (
                <ul className="space-y-3">
                  {ocupacion.salas.map((s) => (
                    <Barra key={s.id} nombre={s.nombre}
                      valor={`${s.horasOcupadas.toFixed(1)} hs`}
                      proporcion={s.horasOcupadas / maxSala}
                      tono={s.horasOcupadas === 0 ? "mal" : "acento"}
                      sub={s.horasOcupadas === 0
                        ? "sin usar en todo el período"
                        : `${pct(s.pct || 0, 0)} de las ${s.horasOfrecidas.toFixed(0)} hs que abre el local`} />
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {ocupacion.clases.lugares > 0 && (
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <Rotulo ayuda="Una sala llena de tiempo puede estar medio vacía de gente: son dos cosas distintas y las dos deciden si conviene abrir otra clase.">
                  Lugares de clase
                </Rotulo>
                <div className="text-right">
                  <div className="f-d text-3xl tabular-nums">{pct(ocupacion.clases.pct || 0, 0)}</div>
                  <div className="text-xs text-texto-tenue">
                    {nf.format(ocupacion.clases.tomados)} de {nf.format(ocupacion.clases.lugares)} lugares
                  </div>
                </div>
              </div>
              <ul className="space-y-3 mt-1">
                {ocupacion.profesionales.filter((p) => p.lugares > 0).map((p) => (
                  <Barra key={p.id} nombre={p.nombre}
                    valor={pct(p.pctCupo || 0, 0)}
                    proporcion={p.pctCupo || 0}
                    tono={p.pctCupo !== null && p.pctCupo < 0.5 ? "mal" : "bien"}
                    sub={`${nf.format(p.tomados)} de ${nf.format(p.lugares)} lugares ofrecidos`} />
                ))}
              </ul>
            </Card>
          )}

          {/* ---------------------------------------------------------
              3 · La asistencia
              --------------------------------------------------------- */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <Rotulo ayuda="Solo sobre turnos que ya pasaron. Contar los de la semana que viene como faltas hunde el número sin motivo.">
                Asistencia
              </Rotulo>
              <div className="flex flex-wrap items-center gap-2">
                {asistencia.porEstado.map((e) => (
                  <Sello key={e.k} tono={e.tono}>{e.n} {nf.format(e.v)}</Sello>
                ))}
              </div>
            </div>

            {!asistencia.porServicio.length ? (
              <Vacio>Todavía no hay suficientes turnos cumplidos para sacar conclusiones por prestación.</Vacio>
            ) : (
              <>
                <p className="text-xs text-texto-suave mb-3">
                  Dónde más se falta. Es por acá por donde se va la agenda de una semana.
                </p>
                <TablaSimple
                  cols={["Prestación", "Turnos", "Vinieron", "Faltaron", "Asistencia"]}
                  filas={asistencia.porServicio.map((s) => [
                    <div key="a">
                      <div className="font-medium">{s.nombre}</div>
                      <div className="text-[11px] text-texto-tenue">{s.area}</div>
                    </div>,
                    <span className="f-m text-texto-tenue">{nf.format(s.total)}</span>,
                    <span className="f-m">{nf.format(s.vino)}</span>,
                    <span className="f-m">{nf.format(s.falto)}</span>,
                    <span className={`f-m font-semibold ${s.pct < 0.8 ? "text-mal" : "text-bien"}`}>
                      {pct(s.pct, 0)}
                    </span>,
                  ])}
                  vacio="Sin datos."
                />
              </>
            )}
          </Card>

          {/* ---------------------------------------------------------
              4 · La gente
              --------------------------------------------------------- */}
          <div className="grid lg:grid-cols-3 gap-3">
            <Kpi label="Clientes nuevos" valor={nf.format(clientes.nuevos)}
              delta={clientes.deltaNuevos} icono={Users}
              sub={`en ${dias} días`} />
            <Kpi label="Vinieron al menos una vez" valor={nf.format(clientes.activos)} />
            <Kpi label="Volvieron" valor={nf.format(clientes.recurrentes)}
              sub={clientes.activos ? `${pct(clientes.recurrentes / clientes.activos, 0)} de los que vinieron` : null} />
          </div>

          <Card className="p-5">
            <Rotulo ayuda="Vinieron alguna vez y hace más de 45 días que no aparecen. No están perdidos: están sin llamar.">
              Hace rato que no vienen
            </Rotulo>
            {!clientes.dormidos.length ? (
              <Vacio>Nadie se quedó sin volver. Poco común y buena señal.</Vacio>
            ) : (
              <>
                <TablaSimple
                  cols={["Cliente", "Veces que vino", "Última vez", "Hace"]}
                  filas={clientes.dormidos.map((c) => [
                    <span key="a" className="font-medium">{c.nombre || "Sin nombre"}</span>,
                    <span className="f-m">{nf.format(c.veces)}</span>,
                    <span className="f-m text-texto-suave">{fechaCorta(c.ultima)}</span>,
                    <span className="f-m">{nf.format(c.dias)} días</span>,
                  ])}
                  vacio="Sin datos."
                />
                {clientes.dormidosTotal > clientes.dormidos.length && (
                  <p className="text-xs text-texto-tenue mt-3">
                    Y {nf.format(clientes.dormidosTotal - clientes.dormidos.length)} más.
                  </p>
                )}
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/* El promedio se pondera por horas ofrecidas y no por persona: alguien
   que trabaja cuatro horas por semana no puede mover el número del equipo
   igual que alguien de tiempo completo. */
function promedio(profesionales) {
  const ofrecidas = profesionales.reduce((s, p) => s + p.horasOfrecidas, 0);
  if (!ofrecidas) return 0;
  return profesionales.reduce((s, p) => s + p.horasOcupadas, 0) / ofrecidas;
}
