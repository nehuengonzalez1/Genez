/* ============================================================
   GENEZ FOUNDER · informes del embudo
   ============================================================

   Todo sale de los registros, y se lee por cohorte: los prospectos que
   entraron en el período, y hasta dónde llegó cada uno (contactado, con
   demo, con propuesta, ganado). Así la conversión compara cosas
   comparables: un cliente ganado este mes que entró hace tres no infla
   la conversión de este mes.

   Pérdidas y tiempo de cierre, en cambio, miran lo que se cerró en el
   período. Los contenidos aparecen solo con acceso a marketing.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Card, Tabs, Cargando, ErrorEstado, Vacio } from "../ui/Base.jsx";
import { money } from "../utils/helpers.js";
import { cargarProspectos, cargarOportunidadesAbiertas, actividadesDesde } from "../datos/internoCrm.js";
import { cargarContenidos } from "../datos/internoMarketing.js";
import { useConfig, hoyAR } from "./util.js";
import { InformeWhatsapp, InformeDescubrimiento } from "./InformesMensajes.jsx";
import { puedeArea } from "../datos/interno.js";

const CONTACTO = new Set(["llamada", "whatsapp", "email", "visita", "reunion", "demo", "propuesta"]);
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");

function rango(periodo) {
  const hoy = hoyAR();
  const d = (dia) => new Date(`${dia}T00:00:00-03:00`);
  const menos = (n) => new Date(d(hoy).getTime() - n * 86400000);
  const [a, m] = hoy.split("-").map(Number);
  if (periodo === "30") return [menos(29), null];
  if (periodo === "90") return [menos(89), null];
  if (periodo === "mes") return [d(`${hoy.slice(0, 8)}01`), null];
  if (periodo === "mes_pasado") {
    const ini = new Date(Date.UTC(a, m - 2, 1)).toISOString().slice(0, 10);
    return [d(ini), d(`${hoy.slice(0, 8)}01`)];
  }
  return [new Date("2020-01-01T00:00:00-03:00"), null];
}

export function Informes({ interno }) {
  const { cfg, nombre } = useConfig();
  const [periodo, setPeriodo] = useState("30");
  const [vista, setVista] = useState("embudo");
  /* Para los informes que cuenta la base: el período cerrado, y "hasta
     ahora" como mañana, así entra todo lo de hoy. */
  const [desdeP, hastaP] = useMemo(() => { const [a, b] = rango(periodo); return [a, b || new Date(Date.now() + 86400000)]; }, [periodo]);
  const vistas = [{ k: "embudo", n: "Embudo" }, ...(puedeArea(interno, "mensajes") ? [{ k: "whatsapp", n: "WhatsApp y asistente" }] : []), { k: "descubrimiento", n: "Descubrimiento y demos" }];
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const leer = () => Promise.all([
    cargarProspectos(), cargarProspectos({ archivados: true }), cargarOportunidadesAbiertas(),
    actividadesDesde(new Date("2020-01-01T00:00:00-03:00")), cargarContenidos().catch(() => null),
  ]).then(([p, pa, ops, acts, contenidos]) => {
    /* Por id: un prospecto no puede contar dos veces aunque venga en las dos listas. */
    const prospectos = [...new Map([...p, ...pa].map((x) => [x.id, x])).values()];
    setD({ prospectos, ops, acts, contenidos });
  }).catch((e) => setError(e.message));
  useEffect(() => { leer(); }, []);

  const r = useMemo(() => {
    if (!d) return null;
    const [desde, hasta] = rango(periodo);
    const en = (f) => f && f >= desde && (!hasta || f < hasta);
    const cohorte = d.prospectos.filter((p) => en(p.creadoEn));
    const ids = new Set(cohorte.map((p) => p.id));
    const actsDe = {};
    for (const a of d.acts) if (ids.has(a.prospectoId)) (actsDe[a.prospectoId] = actsDe[a.prospectoId] || []).push(a);
    const opsDe = {};
    for (const o of d.ops) (opsDe[o.prospectoId] = opsDe[o.prospectoId] || []).push(o);
    const llego = (p) => {
      const as = actsDe[p.id] || [];
      const os = opsDe[p.id] || [];
      const ganado = os.some((o) => o.estado === "ganada");
      const propuesta = ganado || as.some((a) => a.tipo === "propuesta" || (a.tipo === "cambio_etapa" && /propuesta|negociaci/i.test((a.datos && a.datos.a_nombre) || "")));
      const demo = propuesta || as.some((a) => a.tipo === "demo" || (a.tipo === "cambio_etapa" && /demo realizada/i.test((a.datos && a.datos.a_nombre) || "")));
      const contactado = demo || as.some((a) => CONTACTO.has(a.tipo));
      return { contactado, demo, propuesta, ganado, valor: os.filter((o) => o.estado === "ganada").reduce((s, o) => s + Number(o.valor || 0), 0) };
    };
    const filas = cohorte.map((p) => ({ p, ...llego(p) }));
    const embudo = [["Prospectos que entraron", filas.length], ["Contactados", filas.filter((f) => f.contactado).length], ["Con demo", filas.filter((f) => f.demo).length],
      ["Con propuesta", filas.filter((f) => f.propuesta).length], ["Ganados", filas.filter((f) => f.ganado).length]];
    const agrupar = (clave, tipo) => Object.entries(filas.reduce((g, f) => {
      const k = f.p[clave] || ""; const x = g[k] || (g[k] = { n: 0, ganados: 0, valor: 0 }); x.n++; if (f.ganado) { x.ganados++; x.valor += f.valor; } return g;
    }, {})).map(([k, x]) => ({ k, nombre: k ? nombre(tipo, k) : "Sin dato", ...x })).sort((a, b) => b.n - a.n);

    const ganadasEn = d.ops.filter((o) => o.estado === "ganada" && en(o.ganadaEn));
    const diasCierre = ganadasEn.map((o) => (o.ganadaEn - o.creadoEn) / 86400000).filter((x) => x >= 0).sort((a, b) => a - b);
    const perdidas = d.ops.filter((o) => o.estado === "perdida" && en(o.cerradaEn));
    const motivos = Object.entries(perdidas.reduce((g, o) => { const k = o.motivoPerdida || ""; g[k] = (g[k] || 0) + 1; return g; }, {})).sort((a, b) => b[1] - a[1]);
    const actsPeriodo = d.acts.filter((a) => en(a.fecha) && CONTACTO.has(a.tipo));
    const porTipo = Object.entries(actsPeriodo.reduce((g, a) => { g[a.tipo] = (g[a.tipo] || 0) + 1; return g; }, {})).sort((a, b) => b[1] - a[1]);
    const contenidos = d.contenidos ? d.contenidos.filter((c) => c.prospectosOriginados > 0).sort((a, b) => b.clientesOriginados - a.clientesOriginados || b.prospectosOriginados - a.prospectosOriginados).slice(0, 8) : null;
    return {
      embudo, fuentes: agrupar("fuente", "fuente"), zonas: agrupar("zona", "zona"), rubros: agrupar("rubro", "rubro"),
      ganadas: ganadasEn.length, recurrente: ganadasEn.reduce((s, o) => s + Number(o.valor || 0), 0),
      mediana: diasCierre.length ? diasCierre[Math.floor(diasCierre.length / 2)] : null, promedio: diasCierre.length ? diasCierre.reduce((s, x) => s + x, 0) / diasCierre.length : null,
      perdidas: perdidas.length, motivos, porTipo, contenidos,
    };
  }, [d, periodo, cfg]);

  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  if (!r || !cfg) return <Card><Cargando /></Card>;
  const tope = Math.max(1, r.embudo[0][1]);
  const Tabla = ({ titulo, filas }) => (
    <Card className="overflow-hidden">
      <h3 className="px-4 pt-3 pb-2 f-d text-base">{titulo}</h3>
      {filas.length === 0 ? <p className="px-4 pb-3 text-sm text-texto-tenue">Sin datos en el período.</p> : (
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-texto-tenue"><tr><th className="text-left px-4 py-1.5"></th><th className="px-3 text-right">Entraron</th><th className="px-3 text-right">Ganados</th><th className="px-3 text-right">Conversión</th><th className="px-4 text-right">$/mes</th></tr></thead>
          <tbody className="divide-y divide-borde">
            {filas.map((f) => (
              <tr key={f.k}><td className="px-4 py-1.5">{f.nombre}</td><td className="px-3 text-right f-m">{f.n}</td><td className="px-3 text-right f-m">{f.ganados}</td>
                <td className="px-3 text-right f-m">{pct(f.ganados, f.n)}</td><td className="px-4 text-right f-m">{f.valor ? money(Math.round(f.valor)) : "—"}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="f-d text-3xl">Informes</h1>
          <p className="text-sm text-texto-suave mt-1">El embudo mira a los que entraron en el período y hasta dónde llegaron.</p>
        </div>
        <Tabs value={periodo} onChange={setPeriodo} items={[{ k: "30", n: "30 días" }, { k: "mes", n: "Este mes" }, { k: "mes_pasado", n: "Mes pasado" }, { k: "90", n: "90 días" }, { k: "todo", n: "Todo" }]} />
      </header>
      <Tabs value={vista} onChange={setVista} items={vistas} />
      {vista === "whatsapp" && <InformeWhatsapp desde={desdeP} hasta={hastaP} />}
      {vista === "descubrimiento" && <InformeDescubrimiento desde={desdeP} hasta={hastaP} />}

      {vista === "embudo" && (r.embudo[0][1] === 0 && r.ganadas === 0 && r.perdidas === 0 ? <Card><Vacio>No hay movimiento en este período.</Vacio></Card> : (
        <>
          <Card className="p-5">
            <h2 className="f-d text-lg mb-3">El embudo</h2>
            <ul className="space-y-1.5">
              {r.embudo.map(([n, v], i) => (
                <li key={n} className="flex items-center gap-3 text-sm">
                  <span className="w-44 shrink-0 text-texto-suave">{n}</span>
                  <span className="flex-1 h-2.5 rounded bg-superficie-2 overflow-hidden"><span className="block h-full bg-acento" style={{ width: `${(v / tope) * 100}%` }} /></span>
                  <span className="f-m w-10 text-right">{v}</span>
                  <span className="f-m w-14 text-right text-texto-tenue">{i > 0 ? pct(v, r.embudo[i - 1][1]) : ""}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-texto-tenue mt-3">
              De punta a punta: {pct(r.embudo[4][1], r.embudo[0][1])}. Un prospecto cuenta como "con demo" o "con propuesta" si hay una actividad de ese tipo o pasó por esa etapa; ganado, si su oportunidad está ganada.
            </p>
          </Card>

          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="p-4"><div className="text-[11px] text-texto-tenue">Ventas cerradas en el período</div><div className="f-d f-m text-2xl mt-1">{r.ganadas}</div>
              <div className="text-[11px] text-texto-tenue">{r.recurrente ? `${money(Math.round(r.recurrente))}/mes acordado` : ""}</div></Card>
            <Card className="p-4"><div className="text-[11px] text-texto-tenue">Días hasta cerrar</div>
              <div className="f-d f-m text-2xl mt-1">{r.mediana == null ? "—" : Math.round(r.mediana)}</div>
              <div className="text-[11px] text-texto-tenue">{r.mediana == null ? "sin ventas en el período" : `mediana · promedio ${Math.round(r.promedio)}`}</div></Card>
            <Card className="p-4"><div className="text-[11px] text-texto-tenue">Perdidas en el período</div><div className="f-d f-m text-2xl mt-1">{r.perdidas}</div>
              <div className="text-[11px] text-texto-tenue">{r.motivos.slice(0, 2).map(([k, n]) => `${k ? nombre("motivo_perdida", k) : "sin motivo"} (${n})`).join(" · ")}</div></Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Tabla titulo="Por fuente" filas={r.fuentes} />
            <Tabla titulo="Por zona" filas={r.zonas} />
            <Tabla titulo="Por rubro" filas={r.rubros} />
            <Card className="p-4 space-y-3">
              <div>
                <h3 className="f-d text-base mb-1.5">Contactos del período</h3>
                {r.porTipo.length === 0 ? <p className="text-sm text-texto-tenue">Ninguno.</p> : r.porTipo.map(([t, n]) => (
                  <div key={t} className="flex justify-between text-sm border-b border-borde py-1"><span className="text-texto-suave">{nombre("tipo_actividad", t)}</span><span className="f-m">{n}</span></div>
                ))}
              </div>
              <div>
                <h3 className="f-d text-base mb-1.5">Por qué se perdieron</h3>
                {r.motivos.length === 0 ? <p className="text-sm text-texto-tenue">Ninguna perdida.</p> : r.motivos.map(([k, n]) => (
                  <div key={k || "sin"} className="flex justify-between text-sm border-b border-borde py-1"><span className="text-texto-suave">{k ? nombre("motivo_perdida", k) : "Sin motivo"}</span><span className="f-m">{n}</span></div>
                ))}
              </div>
            </Card>
          </div>

          {r.contenidos && (
            <Card className="overflow-hidden">
              <h3 className="px-4 pt-3 pb-2 f-d text-base">Contenidos que trajeron prospectos <span className="text-[11px] text-texto-tenue font-normal">· de siempre, no solo del período</span></h3>
              {r.contenidos.length === 0 ? <p className="px-4 pb-3 text-sm text-texto-tenue">Todavía ningún prospecto dice de qué contenido vino.</p> : (
                <ul className="divide-y divide-borde">
                  {r.contenidos.map((c) => (
                    <li key={c.id} className="flex gap-3 px-4 py-2 text-sm"><span className="flex-1">{c.titulo}</span>
                      <span className="f-m text-[11px] text-texto-tenue">{c.prospectosOriginados} prospectos · {c.demosOriginadas} demos · <span className={c.clientesOriginados ? "text-bien" : ""}>{c.clientesOriginados} clientes</span></span></li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      ))}
    </div>
  );
}
