/* ============================================================
   GENEZ FOUNDER · informes de WhatsApp y de descubrimiento (0123)
   ============================================================

   Los números los cuenta la base. Acá se muestran con lo que significan,
   porque un número sin su definición se lee mal: "enviados" incluye a
   los entregados y a los leídos, "leídos" es un piso (depende de las
   confirmaciones de lectura de cada persona), y el costo del asistente
   es una estimación con el precio de lista.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Card, Cargando, ErrorEstado } from "../ui/Base.jsx";
import { informeWhatsapp, informeDescubrimiento } from "../datos/internoMetricas.js";
import { costoEstimado, dolares, PRECIOS_FECHA } from "../utils/costosModelos.js";

const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const ORIGENES = [["equipo", "Del equipo"], ["asistente", "Del asistente"], ["automatico", "Automáticos (plantillas)"]];
const ERRORES = { 131026: "Número sin WhatsApp o que no puede recibir", 131042: "Problema de pago con Meta", 131047: "Fuera de las 24 horas", 131050: "La persona frenó los mensajes de marketing", 132001: "Plantilla inexistente" };

function Dato({ titulo, valor, sub }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-texto-tenue">{titulo}</div>
      <div className="f-d f-m text-2xl mt-1">{valor}</div>
      {sub && <div className="text-[11px] text-texto-tenue mt-0.5">{sub}</div>}
    </Card>
  );
}

function useInforme(fn, desde, hasta) {
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  const leer = () => { setR(null); setError(""); fn(desde, hasta).then(setR).catch((e) => setError(e.message)); };
  useEffect(leer, [desde.getTime(), hasta.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  return { r, error, leer };
}

export function InformeWhatsapp({ desde, hasta }) {
  const { r, error, leer } = useInforme(informeWhatsapp, desde, hasta);
  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!r) return <Card><Cargando /></Card>;
  const a = r.automatizaciones || {};
  const b = r.asistente || {};
  const costos = (r.uso_modelos || []).map((u) => ({ ...u, costo: costoEstimado(u) }));
  const total = costos.reduce((s, u) => s + (u.costo || 0), 0);
  const errores = Object.entries(r.errores || {});
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <h2 className="px-4 pt-3 pb-1 f-d text-lg">Mensajes que salieron</h2>
        <p className="px-4 pb-2 text-[11px] text-texto-tenue">
          Cada columna incluye a la siguiente: un mensaje leído también se entregó y se envió. Leídos es un piso: solo cuenta a quien tiene prendidas las confirmaciones de lectura.
        </p>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-texto-tenue">
            <tr><th className="text-left px-4 py-1.5"></th><th className="px-3 text-right">Enviados</th><th className="px-3 text-right">Entregados</th><th className="px-3 text-right">Leídos</th><th className="px-4 text-right">No salieron</th></tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {ORIGENES.map(([k, n]) => {
              const s = (r.salientes || {})[k] || {};
              return (
                <tr key={k}>
                  <td className="px-4 py-1.5">{n}</td>
                  <td className="px-3 text-right f-m">{s.enviados || 0}</td>
                  <td className="px-3 text-right f-m">{s.entregados || 0} <span className="text-texto-tenue text-[11px]">{s.enviados ? pct(s.entregados, s.enviados) : ""}</span></td>
                  <td className="px-3 text-right f-m">{s.leidos || 0} <span className="text-texto-tenue text-[11px]">{s.enviados ? pct(s.leidos, s.enviados) : ""}</span></td>
                  <td className={`px-4 text-right f-m ${s.fallidos ? "text-mal" : ""}`}>{s.fallidos || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid sm:grid-cols-4 gap-3">
        <Dato titulo="Mensajes recibidos" valor={r.entrantes} sub={`en ${r.conversaciones_con_respuesta} conversaciones`} />
        <Dato titulo="Conversaciones nuevas" valor={r.conversaciones_nuevas} />
        <Dato titulo="Calificadas" valor={r.calificadas} sub={`vinculadas a un prospecto · ${r.calificadas_ganadas} terminaron en venta`} />
        <Dato titulo="Pidieron la baja" valor={r.bajas} sub={`${r.consentimientos} aceptaron recibir mensajes`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 space-y-1.5 text-sm">
          <h3 className="f-d text-base">Automatizaciones</h3>
          <div className="flex justify-between"><span className="text-texto-suave">Enviados</span><span className="f-m">{a.enviados || 0}</span></div>
          <div className="flex justify-between"><span className="text-texto-suave">Con respuesta en 72 h</span><span className="f-m">{a.respondidos || 0} <span className="text-texto-tenue text-[11px]">{pct(a.respondidos || 0, a.enviados || 0)}</span></span></div>
          <div className="flex justify-between"><span className="text-texto-suave">No salieron · omitidos · cancelados</span><span className="f-m">{a.fallidos || 0} · {a.omitidos || 0} · {a.cancelados || 0}</span></div>
          <div className="flex justify-between"><span className="text-texto-suave">Plantillas de utilidad · de marketing</span><span className="f-m">{a.utilidad || 0} · {a.marketing || 0}</span></div>
          <p className="text-[11px] text-texto-tenue pt-1">Lo que Meta cobra por cada plantilla está en el Administrador de WhatsApp: acá se cuentan, no se les pone precio.</p>
        </Card>
        <Card className="p-4 space-y-1.5 text-sm">
          <h3 className="f-d text-base">Asistente</h3>
          <div className="flex justify-between"><span className="text-texto-suave">Respuestas propuestas · usadas</span><span className="f-m">{b.respuestas || 0} · {b.usados || 0} <span className="text-texto-tenue text-[11px]">{pct(b.usados || 0, b.respuestas || 0)}</span></span></div>
          <div className="flex justify-between"><span className="text-texto-suave">Pasadas a una persona</span><span className="f-m">{b.derivadas || 0}</span></div>
          <div className="flex justify-between"><span className="text-texto-suave">Descartadas · con error</span><span className="f-m">{b.descartados || 0} · {b.errores || 0}</span></div>
          {costos.map((u) => (
            <div key={u.modelo} className="flex justify-between"><span className="text-texto-suave">{u.modelo} · {u.pedidos} pedidos</span><span className="f-m">{dolares(u.costo)}</span></div>
          ))}
          <p className="text-[11px] text-texto-tenue pt-1">
            {costos.length ? `Costo estimado: ${dolares(total)}, con los tokens reales y el precio de lista del ${PRECIOS_FECHA}. La factura está en console.anthropic.com.` : "Todavía no hay pedidos al modelo en el período."}
          </p>
        </Card>
      </div>

      {errores.length > 0 && (
        <Card className="p-4 text-sm">
          <h3 className="f-d text-base mb-1.5">Por qué no salieron</h3>
          {errores.map(([k, n]) => (
            <div key={k} className="flex justify-between border-b border-borde py-1"><span className="text-texto-suave">{ERRORES[k] || `Error ${k}`}</span><span className="f-m">{n}</span></div>
          ))}
        </Card>
      )}
    </div>
  );
}

export function InformeDescubrimiento({ desde, hasta }) {
  const { r, error, leer } = useInforme(informeDescubrimiento, desde, hasta);
  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!r) return <Card><Cargando /></Card>;
  const NOMBRE = { osm: "OpenStreetMap", planilla: "Planillas" };
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <h2 className="px-4 pt-3 pb-2 f-d text-lg">Comercios descubiertos</h2>
        {(r.por_proveedor || []).length === 0 ? <p className="px-4 pb-3 text-sm text-texto-tenue">No se descubrió ninguno en el período.</p> : (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-texto-tenue">
              <tr><th className="text-left px-4 py-1.5">Fuente</th><th className="px-3 text-right">Descubiertos</th><th className="px-3 text-right">Con teléfono</th><th className="px-3 text-right">Al CRM</th><th className="px-4 text-right">Descartados</th></tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {r.por_proveedor.map((p) => (
                <tr key={p.proveedor}>
                  <td className="px-4 py-1.5">{NOMBRE[p.proveedor] || p.proveedor}</td>
                  <td className="px-3 text-right f-m">{p.descubiertos}</td>
                  <td className="px-3 text-right f-m">{p.con_telefono} <span className="text-texto-tenue text-[11px]">{pct(p.con_telefono, p.descubiertos)}</span></td>
                  <td className="px-3 text-right f-m">{p.al_crm}</td>
                  <td className="px-4 text-right f-m">{p.descartados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-4 py-2 text-[11px] text-texto-tenue">Un teléfono publicado no es permiso para escribir: sirve para llamar o visitar, no para mandar WhatsApp.</p>
      </Card>
      <div className="grid sm:grid-cols-4 gap-3">
        <Dato titulo="Pedidos de la web" valor={r.pedidos_web} sub={`${r.pedidos_web_al_crm} pasaron al CRM`} />
        <Dato titulo="Búsquedas" valor={r.busquedas} sub={r.busquedas_con_error ? `${r.busquedas_con_error} con error` : "sin errores"} />
        <Dato titulo="Demos agendadas" valor={r.demos_agendadas} sub="cargadas en el período" />
        <Dato titulo="Demos realizadas" valor={r.demos_realizadas} sub={`del período · ${r.demos_canceladas} canceladas · ${r.demos_vencidas} sin marcar`} />
      </div>
    </div>
  );
}
