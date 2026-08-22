/* ============================================================
   5 bis. INICIO · el tablero de un negocio que vende horas
   ============================================================

   No hereda nada del tablero de comercio, a propósito. Margen bruto,
   valor del stock y "se acaban primero" no le dicen nada a una estética
   ni a un gimnasio: no tienen góndola, y su costo está en las horas.

   Y hay algo más de fondo. Acá "cuánto cobré hoy" no es la pregunta: un
   estudio de pilates puede no facturar un peso en todo un martes y estar
   teniendo el mejor mes del año, porque cobró los abonos en marzo. Lo que
   esta pantalla tiene que contestar de un vistazo es qué pasa hoy con los
   turnos y qué conviene hacer ahora.

   De dónde sale cada número lo resuelve `cargarTablero`. Esta pantalla
   recibe un objeto y dibuja: no sabe cuáles ya vienen de la base y cuáles
   todavía son de ejemplo, y por eso no hay que tocarla cuando migren.
   ============================================================ */

import React, { useState } from "react";
import {
  ArrowRight, Wallet, Barcode, Users, CalendarDays, Clock, Timer,
  UserPlus, BellRing, Receipt, DollarSign, MapPin, Zap, AlertTriangle,
  ChevronDown, Plus, Tag,
} from "lucide-react";
import { fdatel } from "../datos/generador.js";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import { Card, Kpi, Boton, Vacio, Apagado } from "../ui/Base.jsx";
import { Anillo, Referencia, BarraDato, Chispa } from "../ui/Graficos.jsx";

const diaLargo = (d) => {
  const t = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const iniciales = (nombre) =>
  String(nombre || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/* Un renglón con su dato, su explicación y a dónde ir. Lo comparten el
   bloque de acciones recomendadas y el de alertas: son la misma cosa con
   distinto contenido, y tenerlos dos veces era garantía de que se fueran
   separando solos con el tiempo. */
function Renglon({ icono: Ico, tono = "acento", titulo, detalle, accion, ir, tab, motivo }) {
  const color = tono === "mal" ? "text-mal" : tono === "ojo" ? "text-ojo" : tono === "info" ? "text-info" : "text-acento";
  const pastilla = (
    <span className="shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-borde bg-superficie-2 whitespace-nowrap">
      {accion}
    </span>
  );
  return (
    <li className="flex gap-3 items-start">
      <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-superficie-2 flex items-center justify-center">
        <Ico size={16} className={color} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-texto text-sm leading-snug">{titulo}</div>
        <p className="text-xs text-texto-suave mt-0.5">{detalle}</p>
      </div>
      {accion && (tab
        ? <button onClick={() => ir(tab)} className="shrink-0 rounded-lg hover:opacity-80 transition-opacity">{pastilla}</button>
        : <Apagado motivo={motivo || accion}>{pastilla}</Apagado>)}
    </li>
  );
}

/* Una tarjeta chica del resumen del día. */
function Mini({ icono: Ico, rotulo, valor, pie, accion, ir, tab }) {
  return (
    <div className="rounded-xl border border-borde bg-superficie-2/40 p-3.5 min-w-0">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 shrink-0 rounded-lg bg-superficie-2 flex items-center justify-center">
          <Ico size={14} className="text-acento" />
        </span>
        <span className="text-[10px] uppercase tracking-widest text-texto-tenue font-semibold truncate">{rotulo}</span>
      </div>
      <div className="f-d text-2xl mt-1.5 tabular-nums text-texto">{valor}</div>
      <div className="text-[11px] text-texto-tenue mt-0.5 leading-snug">{pie}</div>
      {accion && (tab
        ? <button onClick={() => ir(tab)} className="mt-2 text-[11px] font-semibold text-acento hover:underline inline-flex items-center gap-1">
            {accion} <ArrowRight size={11} />
          </button>
        : <Apagado motivo={accion} className="mt-2 text-[11px] font-semibold gap-1">{accion} <ArrowRight size={11} /></Apagado>)}
    </div>
  );
}

/* Un botón de la franja de abajo. Sin `hacer` queda apagado, con el motivo
   al pasar el mouse: se ve lo que va a existir, sin aparentar que anda. */
function Rapida({ icono: Ico, texto, hacer }) {
  const cuerpo = (
    <span className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold">
      <Ico size={16} className={hacer ? "text-acento" : "text-texto-tenue"} /> {texto}
    </span>
  );
  const marco = "rounded-xl border border-borde bg-superficie text-texto";
  return hacer
    ? <button onClick={hacer} className={`${marco} hover:bg-superficie-2 transition-colors`}>{cuerpo}</button>
    : <Apagado motivo={texto} className={marco}>{cuerpo}</Apagado>;
}

function Bloque({ titulo, extra, children, className = "" }) {
  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">{titulo}</div>
        {extra}
      </div>
      {children}
    </Card>
  );
}

export function InicioServicios({ datos, cargando, ir, negocio, sucursal, usuario, aCobrar, puedeVer }) {
  const [abierto, setAbierto] = useState(false);

  if (cargando || !datos) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 h-28 animate-pulse"><span className="sr-only">Cargando</span></Card>
        ))}
      </div>
    );
  }

  const d = datos;
  const nombrePila = String(usuario || "").trim().split(/\s+/)[0] || "";

  /* Se navega solo a donde el módulo existe. Lo demás queda apagado y no
     escondido: se ve a dónde va a llevar, sin aparentar que ya lleva. */
  const aDonde = (k) => (puedeVer(k) ? k : null);
  const puedeCobrar = typeof aCobrar === "function" && puedeVer("cobro");

  const rapidas = [
    { k: "turno", n: "Nuevo turno", i: CalendarDays, hacer: null },
    { k: "venta", n: "Venta rápida", i: Barcode, hacer: puedeCobrar ? aCobrar : null },
    { k: "pago", n: "Registrar pago", i: Receipt, hacer: aDonde("caja") ? () => ir("caja") : null },
    { k: "cliente", n: "Nuevo cliente", i: UserPlus, hacer: aDonde("clientes") ? () => ir("clientes") : null },
    { k: "espera", n: "Lista de espera", i: Users, hacer: null },
    { k: "promo", n: "Nueva promoción", i: Tag, hacer: null },
  ];

  const totalArea = d.ingresosPorArea.valor.reduce((s, a) => s + a.total, 0);
  const asistPct = d.asistenciaHoy.sobre ? d.asistenciaHoy.valor / d.asistenciaHoy.sobre : null;
  const salas = d.utilizacionSalas.valor;
  const estados = d.turnosPorEstado.valor;

  return (
    <div className="space-y-4">
      {/* ---------- Saludo ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="f-d text-2xl md:text-3xl leading-tight">
            ¡Hola{nombrePila ? `, ${nombrePila}` : ""}! <span className="align-middle">👋</span>
          </h1>
          <p className="text-sm text-texto-suave mt-1">{diaLargo(new Date())}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Contextual y no un selector: multi sucursal todavía no existe,
              y un desplegable que no hace nada es peor que un texto. */}
          <span className="inline-flex items-center gap-1.5 text-sm text-texto-suave border border-borde rounded-xl px-3 py-2">
            <MapPin size={14} className="text-texto-tenue" /> {sucursal || negocio}
          </span>
          <div className="relative">
            <Boton onClick={() => setAbierto((v) => !v)}>
              <Zap size={16} /> Nueva acción rápida <ChevronDown size={14} />
            </Boton>
            {abierto && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
                <div className="absolute right-0 mt-2 z-40 w-60 rounded-xl border border-borde bg-superficie p-1.5">
                  {rapidas.map((a) => (
                    <button key={a.k} disabled={!a.hacer}
                      onClick={() => { setAbierto(false); if (a.hacer) a.hacer(); }}
                      title={a.hacer ? "" : `${a.n} todavía no está disponible.`}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left text-texto hover:bg-superficie-2 disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                      <a.i size={15} className={a.hacer ? "text-acento" : "text-texto-tenue"} /> {a.n}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Los cinco de arriba ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Facturación hoy" icono={DollarSign} valor={money(d.facturacionHoy.valor)}
          delta={d.facturacionHoy.delta} sub="vs. ayer"
          chispa={<Chispa serie={d.facturacionHoy.serie} />} />
        <Kpi label="Turnos hoy" icono={CalendarDays} valor={nf.format(d.turnosHoy.valor)}
          delta={d.turnosHoy.delta} sub="vs. ayer" />
        <Kpi label="Asistencia hoy" icono={Users} valor={nf.format(d.asistenciaHoy.valor)}
          sub={asistPct != null ? `${pct(asistPct)} del total` : "sin turnos"} />
        <Kpi label="Ingresos del mes" icono={Wallet} valor={money(d.ingresosMes.valor)}
          delta={d.ingresosMes.delta} sub="vs. mes anterior"
          chispa={<Chispa serie={d.ingresosMes.serie} />} />
        <Kpi label="Ticket promedio" icono={Receipt} valor={money(d.ticketPromedio.valor)}
          delta={d.ticketPromedio.delta} sub="vs. mes anterior" />
      </div>

      <div className="grid xl:grid-cols-3 gap-4 items-start">
        {/* ---------- Columna ancha ---------- */}
        <div className="xl:col-span-2 space-y-4">
          <Bloque titulo="Resumen operativo del día">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
              <Mini icono={Clock} rotulo="Próximos turnos" valor={nf.format(d.proximosTurnos.valor)}
                pie="en las próximas 2 hs" accion="Ver agenda" ir={ir} tab={aDonde("agenda")} />
              <Mini icono={Timer} rotulo="Huecos disponibles" valor={nf.format(d.huecos.valor)}
                pie="oportunidades de venta" accion="Ver huecos" ir={ir} tab={aDonde("agenda")} />
              <Mini icono={Users} rotulo="En lista de espera" valor={nf.format(d.listaEspera.valor)}
                pie="esperando un lugar" accion="Ver lista" ir={ir} tab={aDonde("agenda")} />
              <Mini icono={BellRing} rotulo="Abonos por vencer" valor={nf.format(d.abonosPorVencer.valor)}
                pie="vencen esta semana" accion="Ver abonos" ir={ir} tab={aDonde("ventas")} />
              <Mini icono={Receipt} rotulo="Pagos pendientes" valor={money(d.pagosPendientes.valor)}
                pie={`de ${nf.format(d.pagosPendientes.clientes || 0)} clientes`} accion="Ver pendientes" ir={ir} tab={aDonde("caja")} />
            </div>
          </Bloque>

          <div className="grid md:grid-cols-3 gap-4">
            <Bloque titulo="Utilización de salas">
              {salas.length === 0 ? <Vacio>Todavía no hay uso de salas registrado.</Vacio> : (
                <>
                  <Anillo alto={150}
                    datos={salas.map((s) => ({ n: s.nombre, v: Math.round(s.pct * 100) }))}
                    centro={pct(salas.reduce((s, x) => s + x.pct, 0) / salas.length)}
                    sub="promedio" />
                  <div className="mt-3">
                    <Referencia datos={salas.map((s) => ({ n: s.nombre, v: s.pct }))} formato={(x) => pct(x.v)} />
                  </div>
                </>
              )}
            </Bloque>

            <Bloque titulo="Turnos por estado">
              {estados.length === 0 ? <Vacio>Sin turnos para mostrar.</Vacio> : (
                <>
                  <Anillo alto={150} datos={estados}
                    centro={nf.format(estados.reduce((s, x) => s + x.v, 0))} sub="turnos" />
                  <div className="mt-3">
                    <Referencia datos={estados} formato={(x) => nf.format(x.v)} />
                  </div>
                </>
              )}
            </Bloque>

            <Bloque titulo="Ingresos por área" extra={
              puedeVer("reportes")
                ? <button onClick={() => ir("reportes")} className="text-xs font-semibold text-acento hover:underline">Ver informe</button>
                : null
            }>
              {d.ingresosPorArea.valor.length === 0 ? <Vacio>Todavía no hay ingresos este mes.</Vacio> : (
                <div className="space-y-3">
                  {d.ingresosPorArea.valor.map((a) => (
                    <BarraDato key={a.nombre} nombre={a.nombre} valor={a.total} total={totalArea} formato={moneyk} />
                  ))}
                </div>
              )}
            </Bloque>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <Bloque titulo="Acciones recomendadas para hoy">
              {d.acciones.valor.length === 0 ? <Vacio>Nada urgente para hoy.</Vacio> : (
                <ul className="space-y-3.5">
                  {d.acciones.valor.map((a) => (
                    <Renglon key={a.k} icono={AlertTriangle} titulo={a.n} detalle={a.d}
                      accion={a.accion} ir={ir} tab={a.tab ? aDonde(a.tab) : null} />
                  ))}
                </ul>
              )}
            </Bloque>

            <Bloque titulo="Últimos clientes nuevos" extra={
              puedeVer("clientes")
                ? <button onClick={() => ir("clientes")} className="text-xs font-semibold text-acento hover:underline">Ver todos</button>
                : null
            }>
              {d.clientesNuevos.valor.length === 0 ? <Vacio>Todavía no hay clientes cargados.</Vacio> : (
                <ul className="space-y-2.5">
                  {d.clientesNuevos.valor.map((c) => (
                    <li key={c.id} className="flex items-center gap-2.5 text-sm">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-superficie-2 flex items-center justify-center text-[11px] font-bold text-texto-suave">
                        {iniciales(c.nombre)}
                      </span>
                      <span className="truncate flex-1 text-texto">{c.nombre}</span>
                      <span className="f-m text-[11px] text-texto-tenue shrink-0">{c.alta ? fdatel(c.alta) : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>

            <Bloque titulo="Top servicios (este mes)">
              {d.topServicios.valor.length === 0 ? <Vacio>Todavía no se vendió nada este mes.</Vacio> : (
                <ul className="space-y-2.5">
                  {d.topServicios.valor.map((s, i) => (
                    <li key={s.nombre} className="flex items-center gap-2.5 text-sm">
                      <span className="w-6 h-6 shrink-0 rounded-lg bg-superficie-2 flex items-center justify-center text-[11px] font-bold text-texto-tenue">{i + 1}</span>
                      <span className="truncate flex-1 text-texto">{s.nombre}</span>
                      <span className="f-m text-[11px] text-texto-tenue shrink-0">{nf.format(Math.round(s.cantidad))}</span>
                      <span className="f-m text-xs text-texto shrink-0">{moneyk(s.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Bloque>
          </div>
        </div>

        {/* ---------- Columna angosta ---------- */}
        <div className="space-y-4">
          <Bloque titulo="Agenda de hoy" extra={
            aDonde("agenda")
              ? <button onClick={() => ir("agenda")} className="text-xs font-semibold text-acento hover:underline">Ver agenda completa</button>
              : <Apagado motivo="La agenda" className="text-xs font-semibold">Ver agenda completa</Apagado>
          }>
            {d.agendaHoy.valor.length === 0 ? <Vacio>No hay turnos para hoy.</Vacio> : (
              <ul>
                {d.agendaHoy.valor.map((t, i) => (
                  <li key={i} className="flex gap-2.5 py-2.5 border-b border-borde last:border-0">
                    <span className="f-m text-xs text-texto-tenue w-10 shrink-0 pt-0.5">{t.hora}</span>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${t.estado === "en curso" ? "bg-acento" : "bg-bien"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-texto truncate">{t.servicio}</div>
                      <div className="text-[11px] text-texto-suave truncate">{t.persona} · {t.sala}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${
                        t.estado === "en curso"
                          ? "text-acento border-acento bg-acento-suave"
                          : "text-bien border-bien bg-bien-suave"}`}>
                        {t.estado}
                      </span>
                      <div className="f-m text-[11px] text-texto-tenue mt-0.5">{t.ocupados}/{t.cupo}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="pt-3 mt-1 border-t border-borde">
              <Apagado motivo="Cargar un turno" className="text-xs font-semibold gap-1">
                <Plus size={13} /> Nuevo turno rápido
              </Apagado>
            </div>
          </Bloque>

          <Bloque titulo="Alertas importantes">
            {d.alertas.valor.length === 0 ? <Vacio>Nada que requiera atención.</Vacio> : (
              <ul className="space-y-3.5">
                {d.alertas.valor.map((a) => (
                  <Renglon key={a.k} icono={AlertTriangle} tono={a.tono} titulo={a.n} detalle={a.d}
                    accion={a.accion} ir={ir} tab={a.tab ? aDonde(a.tab) : null} />
                ))}
              </ul>
            )}
          </Bloque>

          <Bloque titulo="Rendimiento del mes" extra={
            puedeVer("reportes")
              ? <button onClick={() => ir("reportes")} className="text-xs font-semibold text-acento hover:underline">Ver informe</button>
              : null
          }>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Ingresos", moneyk(d.rendimiento.valor.ingresos), d.ingresosMes.serie],
                ["Asistencia", d.rendimiento.valor.asistencia != null ? pct(d.rendimiento.valor.asistencia) : "—", null],
                ["Conversión", d.rendimiento.valor.conversion != null ? pct(d.rendimiento.valor.conversion) : "—", null],
              ].map(([rotulo, valor, serie]) => (
                <div key={rotulo} className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-semibold truncate">{rotulo}</div>
                  <div className="f-d text-lg mt-0.5 tabular-nums text-texto truncate">{valor}</div>
                  {serie ? <Chispa serie={serie} ancho={70} alto={22} /> : null}
                </div>
              ))}
            </div>
          </Bloque>
        </div>
      </div>

      {/* ---------- Acciones rápidas ---------- */}
      <div>
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Acciones rápidas</div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {rapidas.map((a) => <Rapida key={a.k} icono={a.i} texto={a.n} hacer={a.hacer} />)}
        </div>
      </div>
    </div>
  );
}
