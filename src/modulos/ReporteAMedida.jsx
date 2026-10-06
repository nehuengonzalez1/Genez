/* ============================================================
   INFORMES · MI REPORTE (0135)
   ============================================================

   El constructor: agrupar por hasta tres cosas, elegir qué números ver,
   filtrar, y guardar el cuadro con un nombre para todo el comercio.

   El drill-down es "esta fila pasa a ser un filtro": tocar "Bebidas" en
   un cuadro por rubro filtra Bebidas y baja a productos; tocar un
   producto baja a sus tickets. "Volver" deshace el último paso. Así cada
   número se puede abrir hasta la venta que lo forma.

   El período es el de arriba, el mismo de todo Informes: lo guardado es
   la forma del cuadro, no las fechas, así "Rentabilidad por sucursal"
   sirve para este mes y para el que viene.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChevronLeft, X, Loader2 } from "lucide-react";
import { Card, Boton, Vacio } from "../ui/Base.jsx";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import { bajarExcel } from "../utils/planilla.js";
import { DIMENSIONES, METRICAS, dimension, etiqueta, correrReporte, cargarGuardados, guardarReporte, borrarReporte } from "../datos/reportesAMedida.js";

const selCls = "text-xs font-semibold px-3 py-1.5 rounded-full border bg-superficie border-borde text-texto outline-none";
const INICIAL = { dims: ["categoria"], filtros: {}, metricas: ["ventas", "ganancia", "margen", "unidades"] };

/* Lo guardado puede venir de otra versión: se queda con lo que conoce. */
function limpiar(def) {
  const dims = (def.dims || []).filter((d) => DIMENSIONES.some((x) => x.k === d)).slice(0, 3);
  const metricas = (def.metricas || []).filter((m) => METRICAS.some((x) => x.k === m));
  const filtros = Object.fromEntries(Object.entries(def.filtros || {}).filter(([k, v]) => DIMENSIONES.some((x) => x.k === k) && Array.isArray(v) && v.length));
  return { dims: dims.length ? dims : INICIAL.dims, metricas: metricas.length ? metricas : INICIAL.metricas, filtros };
}

const valorDe = (m, f) => {
  const v = f[m.k];
  return m.plata ? money(v) : m.pct ? (f.ventas ? pct(v) : "—") : nf.format(Math.round(v * 100) / 100);
};

/* `sucursal`: el nombre de la elegida arriba, si hay una. Se suma a los
   filtros sin mostrarse como uno: ya se ve en el filtro de arriba. */
export function ReporteAMedida({ empresaId, rango, sucursal = null }) {
  const [def, setDef] = useState(INICIAL);
  const [pasos, setPasos] = useState([]);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [guardados, setGuardados] = useState([]);
  const [abierto, setAbierto] = useState("");
  const [aviso, setAviso] = useState(null);

  const leerGuardados = () => cargarGuardados(empresaId).then(setGuardados).catch(() => setGuardados([]));
  useEffect(() => { if (empresaId) leerGuardados(); }, [empresaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const clave = JSON.stringify([def.dims, def.filtros, rango.desde, rango.hasta, sucursal]);
  useEffect(() => {
    if (!empresaId) return undefined;
    let vigente = true;
    setFilas(null); setError(null);
    correrReporte(empresaId, { desde: rango.desde, hasta: rango.hasta, dims: def.dims, filtros: sucursal ? { ...def.filtros, sucursal: [sucursal] } : def.filtros })
      .then((f) => { if (vigente) setFilas(f); })
      .catch((e) => { if (vigente) { setError(e.message); setFilas([]); } });
    return () => { vigente = false; };
  }, [empresaId, clave]); // eslint-disable-line react-hooks/exhaustive-deps

  const decir = (texto, tono = "bien") => { setAviso({ texto, tono }); setTimeout(() => setAviso(null), 3500); };
  const cambiar = (nuevo, conPaso = false) => {
    if (conPaso) setPasos((p) => [...p, def]); else setPasos([]);
    setDef((d) => ({ ...d, ...nuevo }));
  };

  const primera = dimension(def.dims[0]);
  /* El tiempo se lee en orden; lo demás, de mayor a menor venta (como
     viene de la base). */
  const ordenadas = useMemo(() => {
    if (!filas) return [];
    return primera.tiempo ? [...filas].sort((a, b) => String(a.claves[0]).localeCompare(String(b.claves[0])) || b.ventas - a.ventas) : filas;
  }, [filas, primera.tiempo]);

  const metricas = METRICAS.filter((m) => def.metricas.includes(m.k));
  const totales = useMemo(() => {
    const t = (filas || []).reduce((s, f) => ({ ventas: s.ventas + f.ventas, costo: s.costo + f.costo, unidades: s.unidades + f.unidades }), { ventas: 0, costo: 0, unidades: 0 });
    return { ...t, ganancia: t.ventas - t.costo, margen: t.ventas ? (t.ventas - t.costo) / t.ventas : 0 };
  }, [filas]);

  /* El gráfico: la primera métrica por la primera dimensión. Con más de
     una dimensión se suma por la primera. */
  const metricaGrafico = metricas.find((m) => !m.pct && m.k !== "ticketPromedio") || METRICAS[0];
  const grafico = useMemo(() => {
    const m = new Map();
    for (const f of ordenadas) {
      const k = f.claves[0];
      m.set(k, (m.get(k) || 0) + f[metricaGrafico.k]);
    }
    const xs = [...m.entries()].map(([k, v]) => ({ k, label: etiqueta(def.dims[0], k), v }));
    return primera.tiempo ? xs : xs.slice(0, 15);
  }, [ordenadas, metricaGrafico.k, def.dims, primera.tiempo]);

  const abrir = (f) => {
    const ultima = def.dims[def.dims.length - 1];
    const sigue = dimension(ultima).sigue;
    if (!sigue) return;
    const filtros = { ...def.filtros };
    def.dims.forEach((d, i) => { filtros[d] = [f.claves[i]]; });
    const dims = [sigue === def.dims[0] || def.dims.includes(sigue) ? "ticket" : sigue];
    cambiar({ dims, filtros }, true);
  };
  const volver = () => {
    if (!pasos.length) return;
    setDef(pasos[pasos.length - 1]);
    setPasos(pasos.slice(0, -1));
  };

  const quitarFiltro = (k) => { const f = { ...def.filtros }; delete f[k]; cambiar({ filtros: f }); };
  const ponerDim = (i, v) => {
    const dims = [...def.dims];
    if (!v) dims.splice(i, 1); else dims[i] = v;
    cambiar({ dims: dims.filter((d, j) => d && dims.indexOf(d) === j) });
  };
  const alternarMetrica = (k) => {
    const ms = def.metricas.includes(k) ? def.metricas.filter((x) => x !== k) : [...def.metricas, k];
    if (ms.length) setDef((d) => ({ ...d, metricas: METRICAS.map((m) => m.k).filter((x) => ms.includes(x)) }));
  };

  const abrirGuardado = (id) => {
    setAbierto(id);
    const g = guardados.find((x) => x.id === id);
    if (g) cambiar(limpiar(g.definicion));
  };
  const guardar = async () => {
    const actual = guardados.find((g) => g.id === abierto);
    const nombre = window.prompt("¿Con qué nombre lo guardás? Lo va a ver todo el comercio.", actual ? actual.nombre : "");
    if (!nombre || !nombre.trim()) return;
    try { await guardarReporte(empresaId, nombre, { dims: def.dims, filtros: def.filtros, metricas: def.metricas }); decir(`Guardado como "${nombre.trim()}".`); leerGuardados(); }
    catch (e) { decir(e.message, "mal"); }
  };
  const borrar = async () => {
    const g = guardados.find((x) => x.id === abierto);
    if (!g || !window.confirm(`¿Borrar "${g.nombre}"? Deja de estar para todo el comercio.`)) return;
    try { await borrarReporte(g.id); setAbierto(""); decir("Borrado."); leerGuardados(); }
    catch (e) { decir(e.message, "mal"); }
  };

  const exportar = () => bajarExcel(`Genez - mi reporte`, [{
    nombre: "Mi reporte", anchos: [...def.dims.map(() => 26), ...metricas.map(() => 14)],
    filas: [
      [...def.dims.map((d) => dimension(d).n), ...metricas.map((m) => m.n)],
      ...ordenadas.map((f) => [...f.claves.map((c, i) => etiqueta(def.dims[i], c)), ...metricas.map((m) => (m.pct ? +f[m.k].toFixed(4) : Math.round(f[m.k] * 100) / 100))]),
    ],
  }]);

  const ultimaSigue = dimension(def.dims[def.dims.length - 1]).sigue;

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mr-1">Guardados</span>
          <select value={abierto} onChange={(e) => abrirGuardado(e.target.value)} className={selCls}>
            <option value="">{guardados.length ? "Elegí uno…" : "Todavía no hay"}</option>
            {guardados.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
          </select>
          <Boton size="sm" variant="ghost" onClick={guardar}>Guardar este</Boton>
          {abierto && <Boton size="sm" variant="quiet" onClick={borrar}>Borrar</Boton>}
          {aviso && <span className={`text-xs ${aviso.tono === "mal" ? "text-mal" : "text-bien"}`}>{aviso.texto}</span>}
          <Boton size="sm" variant="ghost" className="ml-auto" onClick={exportar} disabled={!ordenadas.length}>Exportar a Excel</Boton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-texto-suave">Agrupar por</span>
          {[0, 1, 2].map((i) => (i <= def.dims.length && i < 3) && (
            <select key={i} value={def.dims[i] || ""} onChange={(e) => ponerDim(i, e.target.value)} className={selCls}>
              {i > 0 && <option value="">{def.dims[i] ? "— sacar —" : "+ y por…"}</option>}
              {DIMENSIONES.filter((d) => d.k === def.dims[i] || !def.dims.includes(d.k)).map((d) => <option key={d.k} value={d.k}>{d.n}</option>)}
            </select>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-texto-suave mr-1">Ver</span>
          {METRICAS.map((m) => {
            const on = def.metricas.includes(m.k);
            return (
              <button key={m.k} type="button" onClick={() => alternarMetrica(m.k)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${on ? "bg-superficie-3 text-texto border-superficie-3" : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
                {m.n}
              </button>
            );
          })}
        </div>

        {(Object.keys(def.filtros).length > 0 || pasos.length > 0) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {pasos.length > 0 && <Boton size="sm" variant="ghost" onClick={volver}><ChevronLeft size={14} /> Volver</Boton>}
            {Object.entries(def.filtros).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-borde bg-superficie-2">
                <span className="text-texto-tenue">{dimension(k).n}:</span> {v.map((x) => etiqueta(k, x)).join(", ")}
                <button type="button" onClick={() => quitarFiltro(k)} className="text-texto-tenue hover:text-texto" aria-label={`Sacar filtro ${dimension(k).n}`}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {filas === null ? (
        <Card className="p-6 flex items-center gap-2 text-sm text-texto-suave"><Loader2 size={15} className="animate-spin" /> Armando el reporte…</Card>
      ) : error ? (
        <Card className="p-5"><p className="text-sm text-mal">{error}</p></Card>
      ) : !filas.length ? (
        <Card><Vacio>No hubo ventas con estos filtros en el período.</Vacio></Card>
      ) : (
        <>
          {grafico.length > 1 && (
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">{metricaGrafico.n} por {primera.n.toLowerCase()}</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={grafico} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--borde))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "rgb(var(--texto-tenue))" }} tickFormatter={(v) => (metricaGrafico.plata ? moneyk(v) : nf.format(v))} />
                  <Tooltip cursor={{ fill: "rgb(var(--superficie-2))" }} contentStyle={{ background: "rgb(var(--superficie))", border: "1px solid rgb(var(--borde))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [metricaGrafico.plata ? money(v) : nf.format(v), metricaGrafico.n]} />
                  <Bar dataKey="v" fill="rgb(var(--acento))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-borde text-xs text-texto-suave flex flex-wrap gap-x-4 gap-y-1">
              <span>{nf.format(filas.length)} fila{filas.length === 1 ? "" : "s"}{filas.length >= 2000 ? " (las primeras 2.000)" : ""}</span>
              <span>Ventas <span className="f-m text-texto">{money(totales.ventas)}</span></span>
              <span>Ganancia <span className="f-m text-texto">{money(totales.ganancia)}</span> · {pct(totales.margen)}</span>
              {ultimaSigue && <span className="text-texto-tenue">Tocá una fila para abrirla por {dimension(ultimaSigue).n.toLowerCase()}.</span>}
            </div>
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
                    {def.dims.map((d) => <th key={d} className="px-4 py-2.5 font-semibold">{dimension(d).n}</th>)}
                    {metricas.map((m) => <th key={m.k} className="px-4 py-2.5 font-semibold text-right">{m.n}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-borde">
                  {ordenadas.slice(0, 300).map((f, i) => (
                    <tr key={i} onClick={ultimaSigue ? () => abrir(f) : undefined} className={ultimaSigue ? "cursor-pointer hover:bg-superficie-2" : ""}>
                      {f.claves.map((c, j) => <td key={j} className="px-4 py-2 max-w-[16rem] truncate">{etiqueta(def.dims[j], c)}</td>)}
                      {metricas.map((m) => <td key={m.k} className="px-4 py-2 text-right f-m whitespace-nowrap">{valorDe(m, f)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ordenadas.length > 300 && <p className="text-xs text-texto-tenue px-4 py-2 border-t border-borde">Se ven las primeras 300; el resto está en el Excel.</p>}
          </Card>
          <p className="text-[11px] text-texto-tenue">
            Suma las líneas de las ventas, con las devoluciones restando, como "Por producto". Un descuento sobre el total del ticket no está en las líneas: por eso las ventas de acá pueden dar un poco más que las del resumen.
          </p>
        </>
      )}
    </div>
  );
}
