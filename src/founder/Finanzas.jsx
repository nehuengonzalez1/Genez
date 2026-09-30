/* ============================================================
   GENEZ FOUNDER · finanzas
   ============================================================

   La plata de Genez, no la de un comercio. El resumen separa lo que el
   brief pide no confundir: lo contratado (MRR), lo devengado (el mes al
   que corresponde), lo facturado y lo cobrado. Cada número tiene su
   definición escrita en la misma pantalla, y todos salen de
   utils/finanzasGenez.js, que se prueba sin pantalla.

   Nada está conectado a un banco ni a una facturadora: lo cobrado es lo
   que se marca como cobrado, y la pantalla lo dice.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { Card, Boton, Tabs, Cargando, ErrorEstado, Vacio, Modal } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";
import { money } from "../utils/helpers.js";
import { cargarFinanzas, guardarMovimiento, guardarSuscripcion, guardarCuenta, generarCobros, comprobantesDe, ESTADO_MOVIMIENTO, ESTADO_SUSCRIPCION, TIPO_CUENTA } from "../datos/internoFinanzas.js";
import { cargarClientes } from "../datos/internoClientes.js";
import { indicadoresDelMes, puntoDeEquilibrio, proyeccion, mrrAl, mesMas, mesDe } from "../utils/finanzasGenez.js";
import { useConfig, hoyAR } from "./util.js";
import { Adjuntos } from "./Adjuntos.jsx";

const L = ({ t, children, className = "" }) => <label className={className}><span className="block text-xs text-texto-suave">{t}</span>{children}</label>;
const $ = (v) => money(Math.round(v || 0));
const diaCorto = (dia) => (dia ? String(dia).slice(0, 10).split("-").reverse().join("/") : "");
const nombreMes = (mes) => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
const mesCorto = (mes) => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" });

export function Finanzas({ toast }) {
  const { cfg, de, nombre } = useConfig();
  const [pestana, setPestana] = useState("resumen");
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [clientes, setClientes] = useState(null);
  const leer = () => cargarFinanzas().then(setD).catch((e) => setError(e.message));
  useEffect(() => { leer(); cargarClientes().then(setClientes).catch(() => setClientes(null)); }, []);
  if (error) return <Card><ErrorEstado onReintentar={() => { setError(""); leer(); }}>{error}</ErrorEstado></Card>;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="f-d text-3xl">Finanzas</h1>
        <p className="text-sm text-texto-suave mt-1">La plata de Genez. Lo cobrado es lo que se marca como cobrado: no hay conexión con bancos ni con facturación.</p>
      </header>
      <Tabs value={pestana} onChange={setPestana} items={[{ k: "resumen", n: "Resumen" }, { k: "ingreso", n: "Ingresos" }, { k: "gasto", n: "Gastos" },
        { k: "suscripciones", n: "Suscripciones" }, { k: "cuentas", n: "Cuentas" }]} />
      {!d || !cfg ? <Card><Cargando /></Card> : (
        <>
          {pestana === "resumen" && <Resumen d={d} toast={toast} leer={leer} />}
          {(pestana === "ingreso" || pestana === "gasto") && <Movimientos key={pestana} tipo={pestana} d={d} de={de} nombre={nombre} clientes={clientes} toast={toast} leer={leer} />}
          {pestana === "suscripciones" && <Suscripciones d={d} clientes={clientes} toast={toast} leer={leer} />}
          {pestana === "cuentas" && <Cuentas d={d} toast={toast} leer={leer} />}
        </>
      )}
    </div>
  );
}

/* ---------- Resumen ---------- */
function Resumen({ d, toast, leer }) {
  const hoy = hoyAR();
  const [mes, setMes] = useState(mesDe(hoy));
  const [definiciones, setDefiniciones] = useState(false);
  const [generando, setGenerando] = useState(false);
  const ind = useMemo(() => indicadoresDelMes(mes, { ...d, hoy }), [d, mes, hoy]);
  const ultimoCompleto = mesMas(mesDe(hoy), -1);
  const fijos = useMemo(() => indicadoresDelMes(ultimoCompleto, { ...d, hoy }).costosFijos, [d, ultimoCompleto, hoy]);
  const pe = puntoDeEquilibrio(fijos, d.suscripciones);
  const proy = proyeccion(mesDe(hoy), 3, d);
  const historia = Array.from({ length: 6 }, (_, i) => mesMas(mes, i - 5)).map((m) => ({ mes: m, ...indicadoresDelMes(m, { ...d, hoy }) }));
  const mrrHoy = mrrAl(hoy, d.cambios, d.suscripciones);
  const generar = async () => {
    setGenerando(true);
    try { const n = await generarCobros(mes); toast(n ? `${n} ${n === 1 ? "cobro creado" : "cobros creados"} para ${nombreMes(mes)}.` : "Ya estaban todos los cobros de ese mes."); leer(); }
    catch (e) { toast(e.message, "mal"); }
    setGenerando(false);
  };
  const Dato = ({ t, v, sub, tono = "" }) => (
    <Card className="p-4"><div className="text-[11px] text-texto-tenue">{t}</div><div className={`f-d f-m text-2xl mt-1 ${tono}`}>{v}</div>{sub && <div className="text-[11px] text-texto-tenue mt-0.5">{sub}</div>}</Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setMes(mesMas(mes, -1))} aria-label="Mes anterior" className="px-2 py-1 rounded-md border border-borde hover:bg-superficie-2">‹</button>
          <button onClick={() => setMes(mesMas(mes, 1))} aria-label="Mes siguiente" className="px-2 py-1 rounded-md border border-borde hover:bg-superficie-2">›</button>
          <h2 className="f-d text-lg first-letter:uppercase">{nombreMes(mes)}</h2>
        </div>
        <Boton variant="ghost" onClick={generar} disabled={generando}>{generando ? "Generando…" : `Generar los cobros de ${nombreMes(mes)}`}</Boton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Dato t="MRR contratado hoy" v={$(mrrHoy)} sub="lo acordado por mes, no plata" />
        <Dato t="Cobrado en el mes" v={$(ind.cobrado)} sub="plata que entró" />
        <Dato t="Flujo de caja del mes" v={$(ind.flujo)} tono={ind.flujo < 0 ? "text-mal" : ""} sub={`cobrado − pagado (${$(ind.pagado)})`} />
        <Dato t="Saldo de cuentas" v={$(ind.saldo)} sub="según lo registrado" />
        <Dato t="Ingresos del mes" v={$(ind.ingresos)} sub="devengado" />
        <Dato t="Gastos del mes" v={$(ind.gastos)} sub={`devengado · fijos ${$(ind.costosFijos)}`} />
        <Dato t="Por cobrar" v={$(ind.porCobrar)} tono={ind.porCobrarVencido ? "text-ojo" : ""} sub={ind.porCobrarVencido ? `${$(ind.porCobrarVencido)} vencido` : "nada vencido"} />
        <Dato t="Por pagar" v={$(ind.porPagar)} tono={ind.porPagarVencido ? "text-ojo" : ""} sub={ind.porPagarVencido ? `${$(ind.porPagarVencido)} vencido` : "nada vencido"} />
      </div>
      {ind.enDolares > 0 && <p className="text-[11px] text-texto-tenue">Hay {ind.enDolares} {ind.enDolares === 1 ? "movimiento" : "movimientos"} en dólares este mes: no se suman a los pesos, se ven en Ingresos y Gastos.</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="f-d text-base mb-2">El MRR en el mes</h3>
          <dl className="text-sm space-y-1">
            {[["Al empezar", ind.mrrInicio], [`Nuevas (${ind.nuevas})`, ind.mrrNuevo, "+"], ["Expansión", ind.expansion, "+"], [`Bajas (${ind.bajas})`, ind.mrrPerdido, "−"],
              ["Contracción", ind.contraccion, "−"], [mes === mesDe(hoy) ? "Hoy" : "Al terminar", ind.mrrFin]].map(([k, v, s]) => (
              <div key={k} className={`flex justify-between border-b border-borde pb-1 ${!s ? "font-semibold" : ""}`}><dt className="text-texto-suave">{s ? `${s} ` : ""}{k}</dt><dd className="f-m">{$(v)}</dd></div>
            ))}
          </dl>
        </Card>
        <Card className="p-5 space-y-3">
          <div>
            <h3 className="f-d text-base">Punto de equilibrio</h3>
            {!pe.costosFijos ? <p className="text-sm text-texto-tenue">Sin gastos fijos cargados en {nombreMes(ultimoCompleto)}. Marcá como fijos el hosting, los dominios y lo que se paga todos los meses.</p>
              : pe.necesarias == null ? <p className="text-sm text-texto-tenue">Hay {$(pe.costosFijos)} de costos fijos pero ninguna suscripción activa para calcular un precio promedio.</p>
              : <p className="text-sm">Con {$(pe.costosFijos)} de costos fijos ({nombreMes(ultimoCompleto)}) y un promedio de {$(pe.promedio)} por suscripción, hacen falta <span className="f-m font-semibold">{pe.necesarias}</span>. Hay <span className={`f-m font-semibold ${pe.activas >= pe.necesarias ? "text-bien" : "text-ojo"}`}>{pe.activas}</span> activas.</p>}
          </div>
          <div>
            <h3 className="f-d text-base">Si nada cambia</h3>
            <ul className="text-sm space-y-1 mt-1">
              {proy.map((p) => <li key={p.mes} className="flex justify-between border-b border-borde pb-1"><span className="text-texto-suave first-letter:uppercase">{nombreMes(p.mes)}</span>
                <span className="f-m">{$(p.total)}{p.otros ? <span className="text-[11px] text-texto-tenue"> ({$(p.otros)} no recurrente)</span> : ""}</span></li>)}
            </ul>
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-texto-tenue border-b border-borde">
            <tr><th className="text-left p-3">Mes</th><th className="p-3 text-right">Ingresos</th><th className="p-3 text-right">Cobrado</th><th className="p-3 text-right">Gastos</th>
              <th className="p-3 text-right">Pagado</th><th className="p-3 text-right">Flujo</th><th className="p-3 text-right">MRR al cierre</th></tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {historia.map((h) => (
              <tr key={h.mes} className={h.mes === mes ? "bg-acento-suave/30" : ""}>
                <td className="p-3 first-letter:uppercase">{mesCorto(h.mes)}</td><td className="p-3 text-right f-m">{$(h.ingresos)}</td><td className="p-3 text-right f-m">{$(h.cobrado)}</td>
                <td className="p-3 text-right f-m">{$(h.gastos)}</td><td className="p-3 text-right f-m">{$(h.pagado)}</td>
                <td className={`p-3 text-right f-m ${h.flujo < 0 ? "text-mal" : ""}`}>{$(h.flujo)}</td><td className="p-3 text-right f-m">{$(h.mrrFin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-hidden">
        <button onClick={() => setDefiniciones(!definiciones)} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-superficie-2">
          {definiciones ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Cómo se calcula cada número
        </button>
        {definiciones && (
          <dl className="px-5 pb-4 text-sm space-y-1.5">
            {[["MRR contratado", "La suma de las suscripciones activas en pesos, a esa fecha, según su historial de cambios. Es lo acordado por mes, no lo cobrado."],
              ["Ingresos y gastos del mes", "Lo devengado: los movimientos cuyo período es ese mes, sin los anulados, estén cobrados o no."],
              ["Cobrado y pagado", "Los movimientos marcados como pagados con fecha de pago en ese mes. Es la plata que entró o salió."],
              ["Flujo de caja", "Cobrado menos pagado del mes."],
              ["Por cobrar y por pagar", "Todo lo pendiente, de cualquier mes; aparte, lo que ya venció."],
              ["Saldo de cuentas", "Para cada cuenta activa en pesos: el saldo inicial cargado, más lo cobrado y menos lo pagado desde esa fecha."],
              ["Nuevas, bajas, expansión y contracción", "Suscripciones que empezaron o se dieron de baja en el mes, y cuánto subieron o bajaron las que siguieron activas."],
              ["Costos fijos", "Los gastos marcados como fijos, devengados en el mes."],
              ["Punto de equilibrio", "Cuántas suscripciones al precio promedio de hoy pagan los costos fijos del último mes completo. No incluye costos variables."],
              ["Si nada cambia", "Para cada mes: el MRR de hoy (sin las que ya tienen fecha de baja antes) más lo pendiente que vence ese mes y no es de una suscripción."],
              ["Dólares", "No se convierten ni se suman a los pesos."]].map(([k, v]) => (
              <div key={k}><dt className="font-medium">{k}</dt><dd className="text-texto-suave">{v}</dd></div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
}

/* ---------- Ingresos y gastos ---------- */
function Movimientos({ tipo, d, de, nombre, clientes, toast, leer }) {
  const hoy = hoyAR();
  const [vista, setVista] = useState("pendientes");
  const [mes, setMes] = useState(mesDe(hoy));
  const [modal, setModal] = useState(null);
  const lista = d.movimientos.filter((m) => m.tipo === tipo)
    .filter((m) => (vista === "pendientes" ? m.estado === "pendiente" : vista === "vencidos" ? m.estado === "pendiente" && m.vencimiento && m.vencimiento < hoy : mesDe(m.periodo) === mes))
    .sort((a, b) => (a.vencimiento || a.periodo || "").localeCompare(b.vencimiento || b.periodo || ""));
  const esIngreso = tipo === "ingreso";
  const pagar = async (m) => {
    const cuenta = d.cuentas.filter((k) => k.activa && k.moneda === m.moneda);
    try { await guardarMovimiento({ id: m.id, estado: "pagado", fechaPago: hoy, cuentaId: m.cuentaId || (cuenta.length === 1 ? cuenta[0].id : null) }); toast(esIngreso ? "Marcado como cobrado hoy." : "Marcado como pagado hoy."); leer(); }
    catch (e) { toast(e.message, "mal"); }
  };
  const duplicar = async (m) => {
    const sig = `${mesMas(mesDe(m.periodo), 1)}-01`;
    const venc = m.vencimiento ? `${mesMas(mesDe(m.vencimiento), 1)}-${m.vencimiento.slice(8)}`.replace(/-(29|30|31)$/, "-28") : null;
    try {
      await guardarMovimiento({ ...m, id: undefined, periodo: sig, emision: null, vencimiento: venc, estado: "pendiente", fechaPago: null, facturado: false, comprobante: null, suscripcionId: null });
      toast("Copiado al mes siguiente, pendiente."); leer();
    } catch (e) { toast(e.message, "mal"); }
  };
  const total = lista.filter((m) => m.estado !== "anulado" && m.moneda !== "USD").reduce((s, m) => s + m.importe, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={vista} onChange={setVista} items={[{ k: "pendientes", n: esIngreso ? "Por cobrar" : "Por pagar" }, { k: "vencidos", n: "Vencidos" }, { k: "mes", n: "Por mes" }]} />
        <div className="flex items-center gap-2">
          {vista === "mes" && <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className={`${inputCls} mt-0 w-auto`} aria-label="Mes" />}
          <Boton onClick={() => setModal({ tipo, periodo: `${mes}-01`, estado: "pendiente", moneda: "ARS", importe: "" })}><Plus size={14} /> {esIngreso ? "Ingreso" : "Gasto"}</Boton>
        </div>
      </div>
      {lista.length === 0 ? <Card><Vacio>{vista === "mes" ? "Nada en ese mes." : "Nada pendiente."}</Vacio></Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-borde">
            {lista.map((m) => (
              <li key={m.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm ${m.estado === "anulado" ? "opacity-50" : ""}`}>
                <button onClick={() => setModal(m)} className="flex-1 min-w-[12rem] text-left">
                  <span className={`block ${m.estado === "anulado" ? "line-through" : ""}`}>{m.concepto}</span>
                  <span className="block text-[11px] text-texto-tenue">
                    {[m.categoria && nombre(esIngreso ? "categoria_ingreso" : "categoria_gasto", m.categoria), esIngreso ? m.clienteNombre : m.proveedor, `período ${mesCorto(mesDe(m.periodo))}`,
                      m.fijo && "fijo", m.facturado && `facturado${m.comprobante ? ` ${m.comprobante}` : ""}`].filter(Boolean).join(" · ")}
                  </span>
                </button>
                <span className={`text-[11px] ${m.estado === "pendiente" && m.vencimiento && m.vencimiento < hoy ? "text-mal" : "text-texto-tenue"}`}>
                  {m.estado === "pagado" ? `${esIngreso ? "cobrado" : "pagado"} ${diaCorto(m.fechaPago)}` : m.estado === "anulado" ? "anulado" : m.vencimiento ? `vence ${diaCorto(m.vencimiento)}` : "sin vencimiento"}
                </span>
                <span className="f-m w-28 text-right">{m.moneda === "USD" ? `US$ ${m.importe.toLocaleString("es-AR")}` : $(m.importe)}</span>
                <span className="flex gap-1">
                  {m.estado === "pendiente" && <Boton size="sm" variant="ghost" onClick={() => pagar(m)}>{esIngreso ? "Cobrado" : "Pagado"}</Boton>}
                  {!esIngreso && <button title="Copiar al mes siguiente" aria-label="Copiar al mes siguiente" onClick={() => duplicar(m)} className="p-1.5 text-texto-tenue hover:text-texto"><Copy size={14} /></button>}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-4 py-2 border-t border-borde text-sm text-right text-texto-suave">Total en pesos: <span className="f-m text-texto">{$(total)}</span></p>
        </Card>
      )}
      {modal && <FormMovimiento inicial={modal} de={de} cuentas={d.cuentas} clientes={clientes} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />}
    </div>
  );
}

function FormMovimiento({ inicial, de, cuentas, clientes, onCerrar, onListo, toast }) {
  const esIngreso = inicial.tipo === "ingreso";
  const [d, setD] = useState({ ...inicial, importe: inicial.importe === "" ? "" : String(inicial.importe), periodo: mesDe(inicial.periodo) });
  const [id, setId] = useState(inicial.id || null);
  const [adjuntos, setAdjuntos] = useState([]);
  const leerAdjuntos = () => id && comprobantesDe(id).then(setAdjuntos).catch(() => setAdjuntos([]));
  useEffect(() => { leerAdjuntos(); }, [id]);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const guardar = async (cerrar = true) => {
    if (!String(d.concepto || "").trim()) return toast("Poné el concepto.", "mal");
    if (!(Number(d.importe) > 0)) return toast("El importe tiene que ser mayor que cero.", "mal");
    if (!d.periodo) return toast("¿A qué mes corresponde?", "mal");
    if (d.estado === "pagado" && !d.fechaPago) return toast(`Poné la fecha en que se ${esIngreso ? "cobró" : "pagó"}.`, "mal");
    const datos = { ...d, concepto: d.concepto.trim(), importe: Number(d.importe), periodo: `${d.periodo}-01`, fechaPago: d.estado === "pagado" ? d.fechaPago : null,
      emision: d.emision || null, vencimiento: d.vencimiento || null, cuentaId: d.cuentaId || null, clienteId: esIngreso ? d.clienteId || null : null, fijo: !esIngreso && !!d.fijo };
    try {
      if (id) await guardarMovimiento({ ...datos, id });
      else { const r = await guardarMovimiento(datos); setId(r.id); if (!cerrar) { toast("Guardado. Ya podés adjuntar el comprobante."); return; } }
      toast("Guardado."); onListo();
    } catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">{id ? "Editar" : "Nuevo"} {esIngreso ? "ingreso" : "gasto"}</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <L t="Concepto *" className="sm:col-span-2"><input value={d.concepto || ""} onChange={set("concepto")} autoFocus className={inputCls} /></L>
          <L t="Categoría"><select value={d.categoria || ""} onChange={set("categoria")} className={inputCls}><option value="">—</option>{de(esIngreso ? "categoria_ingreso" : "categoria_gasto").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select></L>
          <L t="Importe *"><input value={d.importe} onChange={set("importe")} inputMode="decimal" className={`${inputCls} f-m`} /></L>
          <L t="Moneda"><select value={d.moneda} onChange={set("moneda")} className={inputCls}><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></L>
          <L t="Corresponde al mes *"><input type="month" value={d.periodo || ""} onChange={set("periodo")} className={inputCls} /></L>
          {esIngreso ? (
            <L t="Cliente">
              {clientes ? <select value={d.clienteId || ""} onChange={set("clienteId")} className={inputCls}><option value="">—</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
                : <input disabled value={d.clienteNombre || "Sin acceso a clientes"} className={inputCls} />}
            </L>
          ) : <L t="Proveedor"><input value={d.proveedor || ""} onChange={set("proveedor")} className={inputCls} /></L>}
          <L t="Emisión"><input type="date" value={d.emision || ""} onChange={set("emision")} className={inputCls} /></L>
          <L t="Vencimiento"><input type="date" value={d.vencimiento || ""} onChange={set("vencimiento")} className={inputCls} /></L>
          <L t="Estado"><select value={d.estado} onChange={set("estado")} className={inputCls}>{Object.entries(ESTADO_MOVIMIENTO).map(([k, n]) => <option key={k} value={k}>{k === "pagado" && esIngreso ? "Cobrado" : n}</option>)}</select></L>
          {d.estado === "pagado" && <L t={esIngreso ? "Fecha de cobro *" : "Fecha de pago *"}><input type="date" value={d.fechaPago || ""} onChange={set("fechaPago")} className={inputCls} /></L>}
          <L t="Medio de pago"><select value={d.medioPago || ""} onChange={set("medioPago")} className={inputCls}><option value="">—</option>{de("medio_pago").map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}</select></L>
          <L t="Cuenta"><select value={d.cuentaId || ""} onChange={set("cuentaId")} className={inputCls}><option value="">—</option>{cuentas.filter((k) => k.activa).map((k) => <option key={k.id} value={k.id}>{k.nombre} ({k.moneda})</option>)}</select></L>
          <L t="Referencia"><input value={d.referencia || ""} onChange={set("referencia")} className={inputCls} /></L>
          <L t="Notas" className="sm:col-span-3"><textarea value={d.notas || ""} onChange={set("notas")} rows={2} className={inputCls} /></L>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {esIngreso && (
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!d.facturado} onChange={set("facturado")} className="accent-acento" /> Facturado
              {d.facturado && <input value={d.comprobante || ""} onChange={set("comprobante")} placeholder="Número de comprobante" className={`${inputCls} mt-0 w-48`} />}
            </label>
          )}
          {!esIngreso && <label className="flex items-center gap-2"><input type="checkbox" checked={!!d.fijo} onChange={set("fijo")} className="accent-acento" /> Gasto fijo (se paga todos los meses)</label>}
        </div>
        {id ? (
          <div className="border border-borde rounded-lg overflow-hidden">
            <p className="px-4 pt-3 text-xs text-texto-suave">Comprobante</p>
            <Adjuntos area="finanzas" tabla="interno_movimientos" filaId={id} lista={adjuntos} onCambio={leerAdjuntos} toast={toast} />
          </div>
        ) : <p className="text-[11px] text-texto-tenue">El comprobante se adjunta después de guardarlo.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          {!id && <Boton variant="ghost" onClick={() => guardar(false)}>Guardar y adjuntar</Boton>}
          <Boton onClick={() => guardar(true)}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Suscripciones ---------- */
function Suscripciones({ d, clientes, toast, leer }) {
  const hoy = hoyAR();
  const [modal, setModal] = useState(null);
  const [baja, setBaja] = useState(null);
  const [todas, setTodas] = useState(false);
  const lista = d.suscripciones.filter((s) => todas || s.estado !== "baja");
  const conSus = new Set(d.suscripciones.filter((s) => s.estado !== "baja").map((s) => s.clienteId));
  const sinSus = (clientes || []).filter((c) => !conSus.has(c.id) && ["implementacion", "activo", "en_riesgo"].includes(c.estado));
  const cambiar = async (s, c, aviso) => { try { await guardarSuscripcion({ id: s.id, ...c }); if (aviso) toast(aviso); leer(); } catch (e) { toast(e.message, "mal"); } };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-suave">Cada suscripción es lo contratado. El importe mensual de su cliente pasa a ser la suma de sus suscripciones activas en pesos.</p>
        <label className="flex items-center gap-1.5 text-sm text-texto-suave cursor-pointer"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="accent-acento" /> Con las bajas</label>
      </div>
      {sinSus.length > 0 && (
        <Card className="p-4">
          <p className="text-sm mb-2">Clientes vigentes sin suscripción: el MRR no los cuenta hasta que tengan una.</p>
          <div className="flex flex-wrap gap-2">
            {sinSus.map((c) => <Boton key={c.id} size="sm" variant="ghost" onClick={() => setModal({ clienteId: c.id, clienteNombre: c.nombre, plan: c.plan || "", importeMensual: String(Number(c.importeMensual || 0) || ""), inicio: c.alta || hoy, moneda: "ARS", diaCobro: 10 })}>{c.nombre}</Boton>)}
          </div>
        </Card>
      )}
      {clientes === null && <p className="text-[11px] text-texto-tenue">Sin acceso a clientes: se pueden ver y editar las suscripciones, pero no crear nuevas.</p>}
      {lista.length === 0 ? <Card><Vacio>Sin suscripciones.</Vacio></Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-borde">
            {lista.map((s) => (
              <li key={s.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm ${s.estado === "baja" ? "opacity-60" : ""}`}>
                <span className="flex-1 min-w-[10rem]">
                  <span className="block">{s.clienteNombre || "Cliente (sin acceso)"}</span>
                  <span className="block text-[11px] text-texto-tenue">{[s.plan, `desde ${diaCorto(s.inicio)}`, s.fin && `hasta ${diaCorto(s.fin)}`, `cobra el ${s.diaCobro}`, s.motivoBaja].filter(Boolean).join(" · ")}</span>
                </span>
                <input key={s.importeMensual} defaultValue={s.importeMensual} inputMode="decimal" aria-label="Importe mensual" disabled={s.estado === "baja"}
                  onBlur={(e) => Number(e.target.value) !== s.importeMensual && (Number(e.target.value) >= 0 ? cambiar(s, { importeMensual: Number(e.target.value) }, "Importe actualizado: queda en el historial.") : toast("Tiene que ser un número.", "mal"))}
                  className={`${inputCls} mt-0 w-28 f-m text-right`} />
                <span className="text-[11px] text-texto-tenue w-8">{s.moneda === "USD" ? "US$" : "$/mes"}</span>
                <select value={s.estado} onChange={(e) => (e.target.value === "baja" ? setBaja(s) : cambiar(s, { estado: e.target.value, fin: null, motivoBaja: null }))}
                  className="text-xs bg-transparent border border-borde rounded-md px-1.5 py-1" aria-label="Estado">
                  {Object.entries(ESTADO_SUSCRIPCION).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {modal && <FormSuscripcion inicial={modal} clientes={clientes || []} toast={toast} onCerrar={() => setModal(null)} onListo={() => { setModal(null); leer(); }} />}
      {baja && <Baja s={baja} toast={toast} onCerrar={() => setBaja(null)} onGuardar={(fin, motivo) => { const s = baja; setBaja(null); cambiar(s, { estado: "baja", fin, motivoBaja: motivo || null }, "Dada de baja."); }} />}
    </div>
  );
}

function FormSuscripcion({ inicial, clientes, onCerrar, onListo, toast }) {
  const [d, setD] = useState(inicial);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const guardar = async () => {
    if (!d.clienteId) return toast("Elegí el cliente.", "mal");
    if (!(Number(d.importeMensual) >= 0) || d.importeMensual === "") return toast("Poné el importe mensual.", "mal");
    if (!(Number(d.diaCobro) >= 1 && Number(d.diaCobro) <= 28)) return toast("El día de cobro va del 1 al 28.", "mal");
    try { await guardarSuscripcion({ ...d, importeMensual: Number(d.importeMensual), diaCobro: Number(d.diaCobro), estado: "activa" }); toast("Suscripción creada."); onListo(); }
    catch (e) { toast(e.message, "mal"); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-xl">Nueva suscripción</h3>
        <div className="grid grid-cols-2 gap-3">
          <L t="Cliente *" className="col-span-2">
            <select value={d.clienteId || ""} onChange={set("clienteId")} className={inputCls}><option value="">—</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
          </L>
          <L t="Plan"><input value={d.plan || ""} onChange={set("plan")} className={inputCls} /></L>
          <L t="Importe mensual *"><input value={d.importeMensual} onChange={set("importeMensual")} inputMode="decimal" className={`${inputCls} f-m`} /></L>
          <L t="Moneda"><select value={d.moneda} onChange={set("moneda")} className={inputCls}><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></L>
          <L t="Desde"><input type="date" value={d.inicio} onChange={set("inicio")} className={inputCls} /></L>
          <L t="Día de cobro"><input value={d.diaCobro} onChange={set("diaCobro")} inputMode="numeric" className={`${inputCls} f-m`} /></L>
        </div>
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton><Boton onClick={guardar}>Crear</Boton></div>
      </div>
    </Modal>
  );
}

function Baja({ s, onCerrar, onGuardar, toast }) {
  const [fin, setFin] = useState(hoyAR());
  const [motivo, setMotivo] = useState("");
  return (
    <Modal open onClose={onCerrar} ancho="max-w-sm">
      <div className="p-5 space-y-3">
        <h3 className="f-d text-lg">Dar de baja</h3>
        <p className="text-sm text-texto-suave">{s.clienteNombre}</p>
        <L t="Último día"><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={inputCls} /></L>
        <L t="Motivo"><input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputCls} /></L>
        <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => (fin && fin >= s.inicio ? onGuardar(fin, motivo.trim()) : toast("La baja no puede ser antes del inicio.", "mal"))}>Dar de baja</Boton></div>
      </div>
    </Modal>
  );
}

/* ---------- Cuentas ---------- */
function Cuentas({ d, toast, leer }) {
  const [modal, setModal] = useState(null);
  const guardar = async () => {
    if (!String(modal.nombre || "").trim()) return toast("Poné el nombre.", "mal");
    if (modal.saldoInicial === "" || isNaN(Number(modal.saldoInicial))) return toast("El saldo inicial tiene que ser un número.", "mal");
    try { await guardarCuenta({ ...modal, nombre: modal.nombre.trim(), saldoInicial: Number(modal.saldoInicial) }); setModal(null); leer(); } catch (e) { toast(e.message, "mal"); }
  };
  const set = (k) => (e) => setModal({ ...modal, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-texto-suave">El saldo es el inicial más lo cobrado y menos lo pagado desde esa fecha: lo registrado, no lo que dice el banco.</p>
        <Boton onClick={() => setModal({ nombre: "", tipo: "banco", moneda: "ARS", saldoInicial: "0", saldoInicialFecha: hoyAR(), activa: true })}><Plus size={14} /> Cuenta</Boton>
      </div>
      {d.cuentas.length === 0 ? <Card><Vacio>Sin cuentas. Cargá dónde está la plata de Genez (banco, Mercado Pago, efectivo) con su saldo de hoy.</Vacio></Card> : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-borde">
            {d.cuentas.map((k) => (
              <li key={k.id}><button onClick={() => setModal({ ...k, saldoInicial: String(k.saldoInicial) })} className={`w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-superficie-2 ${k.activa ? "" : "opacity-50"}`}>
                <span className="flex-1"><span className="block">{k.nombre}</span><span className="block text-[11px] text-texto-tenue">{TIPO_CUENTA[k.tipo]} · desde {diaCorto(k.saldoInicialFecha)}</span></span>
                <span className="f-m">{k.moneda === "USD" ? `US$ ${k.saldo.toLocaleString("es-AR")}` : $(k.saldo)}</span>
              </button></li>
            ))}
          </ul>
        </Card>
      )}
      {modal && (
        <Modal open onClose={() => setModal(null)} ancho="max-w-md">
          <div className="p-5 space-y-3">
            <h3 className="f-d text-xl">{modal.id ? "Editar cuenta" : "Nueva cuenta"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <L t="Nombre *" className="col-span-2"><input value={modal.nombre} onChange={set("nombre")} autoFocus className={inputCls} /></L>
              <L t="Tipo"><select value={modal.tipo} onChange={set("tipo")} className={inputCls}>{Object.entries(TIPO_CUENTA).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></L>
              <L t="Moneda"><select value={modal.moneda} onChange={set("moneda")} className={inputCls}><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></L>
              <L t="Saldo real"><input value={modal.saldoInicial} onChange={set("saldoInicial")} inputMode="decimal" className={`${inputCls} f-m`} /></L>
              <L t="Al día"><input type="date" value={modal.saldoInicialFecha} onChange={set("saldoInicialFecha")} className={inputCls} /></L>
            </div>
            {modal.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!modal.activa} onChange={set("activa")} className="accent-acento" /> Activa</label>}
            <div className="flex justify-end gap-2"><Boton variant="ghost" onClick={() => setModal(null)}>Cancelar</Boton><Boton onClick={guardar}>Guardar</Boton></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
