/* ============================================================
   11. REPORTES
   ============================================================ */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2 } from "lucide-react";
import { money, moneyk, pct, nf, mediosDe, comisionDe } from "../utils/helpers.js";
import { margen, ganancia, ticketPromedio, porTicket, variacion, puntos, puenteDeRentabilidad, matrizDeProductos, CUADRANTES } from "../utils/metricas.js";
import { cargarPuente } from "../datos/puente.js";
import { bajarExcel } from "../utils/planilla.js";
import { ObjetivosDelMes, hayObjetivos } from "./Objetivos.jsx";
import { cargarPagosPorProveedor } from "../datos/facturasProveedor.js";
import { cargarQuiebres } from "../datos/quiebres.js";
import { Kpi, Card, Boton, TablaSimple, Vacio, Sello } from "../ui/Base.jsx";
import { estadisticas } from "../datos/pedidos.js";
import { cargarSerieDiaria, cargarVentasPorItem } from "../datos/ventas.js";
import { tonoCanal } from "../ui/canales.jsx";

/* Los tres de siempre. El resto se escribe. */
const ATAJOS = [7, 30, 90];
/* Diez años. No es una restricción real —la función de la base arma la
   serie que le pidan— sino un freno para que un cero de más no pida
   trescientos mil días y deje la pantalla colgada armando el gráfico. */
const TOPE_DIAS = 3650;

/* Un día a las doce: así ni el cambio de hora ni la zona corren la fecha. */
const alMediodia = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };
const haceDias = (n) => { const x = alMediodia(new Date()); x.setDate(x.getDate() - (n - 1)); return x; };
const diasEntre = (a, b) => Math.round((alMediodia(b) - alMediodia(a)) / 86400000) + 1;
const paraInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const deInput = (v) => (v ? new Date(`${v}T12:00:00`) : null);

export function Reportes({ k, ir, empresaId = null, conPedidos = false, lugar = { sucursales: [], varias: false }, ajustes = {} }) {
  /* La sucursal que se mira (0108). "" es todas, como siempre. */
  const [sucursal, setSucursal] = useState("");
  /* El período es de una fecha a otra, las dos incluidas. Los atajos son
     "los últimos N días hasta hoy"; lo demás se elige con las dos fechas.
     Antes "otros" pedía una cantidad de días hacia atrás desde hoy, y no
     había forma de mirar, por ejemplo, del 1 al 15 del mes pasado
     (Super 25, 26/09). */
  const [rango, setRango] = useState(() => ({ desde: haceDias(30), hasta: alMediodia(new Date()), atajo: 30 }));
  const [elegido, setElegido] = useState(() => ({ desde: paraInput(haceDias(30)), hasta: paraInput(new Date()) }));
  const dias = diasEntre(rango.desde, rango.hasta);
  const hoy = paraInput(new Date());

  /* `k.diario` son los noventa días hasta hoy que Sistema carga al
     entrar, y con eso alcanza para los atajos. Otro período se va a
     buscar: `ventas_diarias_rango` (0096) devuelve la serie continua, con
     ceros en los días sin ventas. */
  const [serieRango, setSerieRango] = useState(null);
  const [cargando, setCargando] = useState(false);

  /* La serie cargada al entrar es de todas las sucursales: mirando una
     sola, se va a buscar siempre. */
  const alcanzaLaCargada = !sucursal && paraInput(rango.hasta) === hoy && dias <= k.diario.length;
  const serieBase = alcanzaLaCargada ? k.diario.slice(-dias) : (serieRango || []);

  useEffect(() => {
    if (alcanzaLaCargada || !empresaId) return undefined;
    let vigente = true;
    setCargando(true);
    setSerieRango(null);
    cargarSerieDiaria(empresaId, { desde: rango.desde, hasta: rango.hasta, sucursal: sucursal || null })
      .then((s) => { if (vigente) setSerieRango(s); })
      .catch((e) => {
        if (!vigente) return;
        /* Sin serie el gráfico queda vacío y los indicadores en cero, que
           es lo que ya hacía Sistema si la consulta fallaba. Un cero
           honesto antes que una curva recortada sin avisar. */
        setSerieRango([]);
        console.error("No se pudo cargar la serie del período pedido:", e);
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [rango, empresaId, alcanzaLaCargada, sucursal]);

  const usarAtajo = (n) => {
    setRango({ desde: haceDias(n), hasta: alMediodia(new Date()), atajo: n });
    setElegido({ desde: paraInput(haceDias(n)), hasta: hoy });
  };

  const d0 = deInput(elegido.desde);
  const d1 = deInput(elegido.hasta);
  const problema = !d0 || !d1 ? "Elegí las dos fechas."
    : d0 > d1 ? "La fecha de inicio es después de la de fin."
    : elegido.hasta > hoy ? "La fecha de fin no puede ser después de hoy."
    : diasEntre(d0, d1) > TOPE_DIAS ? "Como mucho, diez años." : null;
  const cambioElegido = !problema && (paraInput(rango.desde) !== elegido.desde || paraInput(rango.hasta) !== elegido.hasta);
  const aplicarFechas = () => { if (!problema) setRango({ desde: d0, hasta: d1, atajo: null }); };

  const serie = serieBase.map((d) => ({ ...d, ganancia: d.ventas - d.costo }));
  const ventas = serie.reduce((s, d) => s + d.ventas, 0);
  const costo = serie.reduce((s, d) => s + d.costo, 0);
  /* LOS TRES CUADROS SALEN DEL HISTORIAL

     Antes escalaban `u30` —la venta de los últimos treinta días— por el
     período elegido. Era una proyección, no lo que pasó, y con un período
     a medida se leía como si fuera historia. `ventas_por_item` (0080) lee
     las líneas de las ventas confirmadas del período, con el mismo
     criterio que la serie de arriba. */
  const [porItem, setPorItem] = useState([]);

  useEffect(() => {
    if (!empresaId) return;
    let vigente = true;
    cargarVentasPorItem(empresaId, { desde: rango.desde, hasta: rango.hasta, sucursal: sucursal || null })
      .then((v) => { if (vigente) setPorItem(v); })
      .catch((e) => {
        if (!vigente) return;
        setPorItem([]);
        console.error("No se pudieron cargar las ventas por producto:", e);
      });
    return () => { vigente = false; };
  }, [empresaId, rango, sucursal]);

  /* EL PERÍODO ANTERIOR (06/10)

     Cada número se muestra contra el período anterior del mismo largo:
     "30 días" contra los 30 de antes; "del 1 al 15" contra los 15 días
     previos. Un número solo no dice si es bueno o malo. */
  const rangoPrevio = useMemo(() => {
    const h = new Date(rango.desde); h.setDate(h.getDate() - 1);
    const d = new Date(h); d.setDate(d.getDate() - (dias - 1));
    return { desde: d, hasta: h };
  }, [rango, dias]);
  const [previo, setPrevio] = useState(null);
  useEffect(() => {
    if (!empresaId) return undefined;
    let vigente = true;
    setPrevio(null);
    const p = { desde: rangoPrevio.desde, hasta: rangoPrevio.hasta, sucursal: sucursal || null };
    Promise.all([cargarSerieDiaria(empresaId, p), cargarVentasPorItem(empresaId, p)])
      .then(([s, i]) => { if (vigente) setPrevio({ serie: s, porItem: i }); })
      .catch((e) => { if (vigente) console.error("No se pudo cargar el período anterior:", e); });
    return () => { vigente = false; };
  }, [empresaId, rangoPrevio, sucursal]);

  /* El puente de rentabilidad: descuentos, devoluciones, cobros por medio
     y mermas del período (src/datos/puente.js). */
  const [puenteDatos, setPuenteDatos] = useState(null);
  useEffect(() => {
    if (!empresaId) return undefined;
    let vigente = true;
    setPuenteDatos(null);
    cargarPuente({ empresaId, desde: rango.desde, hasta: rango.hasta, sucursal: sucursal || null })
      .then((p) => { if (vigente) setPuenteDatos(p); })
      .catch((e) => { if (vigente) console.error("No se pudo armar el puente:", e); });
    return () => { vigente = false; };
  }, [empresaId, rango, sucursal]);

  /* Lo pagado a cada proveedor en el período (pagos de la caja grande).
     Sin el permiso de la caja grande, RLS devuelve vacío y no se muestra. */
  const [pagosProv, setPagosProv] = useState([]);
  useEffect(() => {
    if (!empresaId) return undefined;
    let vigente = true;
    cargarPagosPorProveedor(empresaId, rango.desde, rango.hasta)
      .then((p) => { if (vigente) setPagosProv(p); })
      .catch(() => { if (vigente) setPagosProv([]); });
    return () => { vigente = false; };
  }, [empresaId, rango]);

  /* Los productos que se quedaron sin stock en el período (0134). */
  const [quiebres, setQuiebres] = useState(null);
  useEffect(() => {
    if (!empresaId) return undefined;
    let vigente = true;
    setQuiebres(null);
    cargarQuiebres(empresaId, rango.desde, rango.hasta)
      .then((q) => { if (vigente) setQuiebres(q); })
      .catch((e) => { if (vigente) { console.error("No se pudieron leer los quiebres:", e); setQuiebres([]); } });
    return () => { vigente = false; };
  }, [empresaId, rango]);

  const tickets = serie.reduce((s, d) => s + (d.tickets || 0), 0);
  const unidades = porItem.reduce((s, p) => s + p.unidades, 0);
  const ant = previo && {
    ventas: previo.serie.reduce((s, d) => s + d.ventas, 0),
    costo: previo.serie.reduce((s, d) => s + d.costo, 0),
    tickets: previo.serie.reduce((s, d) => s + (d.tickets || 0), 0),
    unidades: previo.porItem.reduce((s, p) => s + p.unidades, 0),
  };
  const margenAhora = margen(ventas, costo);
  const margenAntes = ant ? margen(ant.ventas, ant.costo) : null;
  const comisiones = puenteDatos
    ? mediosDe(ajustes).reduce((s, m) => s + comisionDe(m, puenteDatos.cobradoPorMedio[m.k] || 0), 0)
    : 0;
  const puente = puenteDatos && puenteDeRentabilidad({
    ventasNetas: ventas, costo, descuentos: puenteDatos.descuentos, devoluciones: puenteDatos.devoluciones,
    comisiones, mermas: puenteDatos.mermas,
  });
  const matriz = useMemo(() => matrizDeProductos(porItem, margen(ventas, costo)), [porItem, ventas, costo]);
  const vsAnterior = ant ? "vs período anterior" : undefined;

  /* Exportar (06/10): lo mismo que se ve, en una planilla con una hoja por
     bloque. Los números van como números, para poder sumar. */
  const [exportando, setExportando] = useState(false);
  const exportar = async () => {
    setExportando(true);
    try {
      const periodo = `${paraInput(rango.desde)} al ${paraInput(rango.hasta)}`;
      const medios = mediosDe(ajustes);
      const hojas = [
        { nombre: "Resumen", anchos: [30, 16, 18], filas: [
          ["Período", periodo, ""],
          ["", "Este período", "Período anterior"],
          ["Ventas netas", ventas, ant ? ant.ventas : ""],
          ["Ganancia bruta", ganancia(ventas, costo), ant ? ganancia(ant.ventas, ant.costo) : ""],
          ["Margen", +margenAhora.toFixed(4), ant ? +margenAntes.toFixed(4) : ""],
          ["Tickets", tickets, ant ? ant.tickets : ""],
          ["Ticket promedio", Math.round(ticketPromedio(ventas, tickets)), ant ? Math.round(ticketPromedio(ant.ventas, ant.tickets)) : ""],
          ["Unidades por ticket", +porTicket(unidades, tickets).toFixed(2), ant ? +porTicket(ant.unidades, ant.tickets).toFixed(2) : ""],
        ] },
        ...(puente ? [{ nombre: "De lo vendido a lo que queda", anchos: [30, 16], filas: [["Concepto", "Importe"], ...puente.pasos.map((p) => [p.n, p.valor])] }] : []),
        { nombre: "Por día", anchos: [12, 14, 14, 10], filas: [["Fecha", "Ventas", "Costo", "Tickets"], ...serie.map((d) => [d.fecha instanceof Date ? paraInput(d.fecha) : (d.label || ""), d.ventas, d.costo, d.tickets || 0])] },
        { nombre: "Por producto", anchos: [36, 18, 10, 14, 14, 10], filas: [["Producto", "Rubro", "Unidades", "Venta", "Ganancia", "Margen"],
          ...porItem.map((p) => [p.nombre, p.categoria, p.unidades, p.venta, p.ganancia, +p.margen.toFixed(4)])] },
        ...(puenteDatos ? [
          { nombre: "Por día de la semana", anchos: [12, 14, 10], filas: [["Día", "Ventas", "Tickets"], ...puenteDatos.porDia.map((d) => [NOMBRE_DIA[d.dia], d.ventas, d.tickets])] },
          { nombre: "Por hora", anchos: [8, 14, 10], filas: [["Hora", "Ventas", "Tickets"], ...puenteDatos.porHora.filter((h) => h.tickets).map((h) => [h.hora, h.ventas, h.tickets])] },
          { nombre: "Medios de pago", anchos: [22, 14, 14], filas: [["Medio", "Cobrado", "Comisión"],
            ...Object.entries(puenteDatos.cobradoPorMedio).map(([k, c]) => { const m = medios.find((x) => x.k === k) || { k, n: k }; return [m.n, c, comisionDe(m, c)]; })] },
          { nombre: "Vendedores", anchos: [24, 14, 10, 14, 12], filas: [["Vendedor", "Ventas", "Tickets", "Descuentos", "Desc. promedio"],
            ...puenteDatos.vendedores.map((v) => [v.nombre, v.ventas, v.tickets, v.descuentos, +v.descuentoPromedio.toFixed(4)])] },
        ] : []),
        ...(quiebres && quiebres.length ? [
          { nombre: "Quiebres de stock", anchos: [36, 12, 12, 14, 14, 14, 14], filas: [["Producto", "Días sin stock", "Venta por día", "Unidades perdidas", "Venta perdida", "Ganancia perdida", "Sin stock desde"],
            ...quiebres.map((q) => [q.nombre, q.diasSinStock, q.ventaDiaria ?? "", q.perdidas ?? "", q.ventaPerdida ?? "", q.gananciaPerdida ?? "", q.sinStockDesde || ""])] },
        ] : []),
      ];
      await bajarExcel(`Genez - reporte ${periodo}`, hojas);
    } finally {
      setExportando(false);
    }
  };

  /* Ya viene ordenado por venta desde la base. */
  const topVenta = porItem.slice(0, 10);
  const topGanancia = [...porItem].sort((a, b) => b.ganancia - a.ganancia).slice(0, 10);

  const porCat = useMemo(() => {
    const m = {};
    porItem.forEach((p) => {
      if (!m[p.categoria]) m[p.categoria] = { cat: p.categoria, venta: 0, ganancia: 0 };
      m[p.categoria].venta += p.venta;
      m[p.categoria].ganancia += p.ganancia;
    });
    return Object.values(m).sort((a, b) => b.venta - a.venta);
  }, [porItem]);

  const maxVenta = topVenta.length ? topVenta[0].venta : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5">
        {ATAJOS.map((d) => (
          <button key={d} onClick={() => usarAtajo(d)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${rango.atajo === d ? "bg-superficie-3 text-texto border-superficie-3" : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
            {d} días
          </button>
        ))}

        {/* Las dos fechas viven al lado de los atajos y no detrás de un
            menú: se piden todo el tiempo. Se aplican con "Ver" (o Enter),
            no al tocar cada una: si no, elegir el desde ya pediría a la
            base un período que nadie quiso mirar. */}
        <form onSubmit={(e) => { e.preventDefault(); aplicarFechas(); }}
          className={`flex flex-wrap items-center gap-1.5 rounded-full border pl-3 pr-1 py-0.5 ${
            rango.atajo ? "bg-superficie border-borde" : "bg-superficie-3 border-superficie-3"}`}>
          <span className="text-xs text-texto-suave">Desde</span>
          <input type="date" value={elegido.desde} max={elegido.hasta || hoy}
            onChange={(e) => setElegido((x) => ({ ...x, desde: e.target.value }))}
            className="f-m bg-transparent text-xs outline-none [color-scheme:inherit]" />
          <span className="text-xs text-texto-suave">hasta</span>
          <input type="date" value={elegido.hasta} min={elegido.desde || undefined} max={hoy}
            onChange={(e) => setElegido((x) => ({ ...x, hasta: e.target.value }))}
            className="f-m bg-transparent text-xs outline-none [color-scheme:inherit]" />
          <Boton size="sm" variant={cambioElegido ? "primary" : "ghost"} disabled={!!problema}>Ver</Boton>
        </form>

        {lugar.varias && (
          <select value={sucursal} onChange={(e) => setSucursal(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-superficie border-borde text-texto-suave outline-none">
            <option value="">Todas las sucursales</option>
            {lugar.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}

        {cargando && <Loader2 size={14} className="animate-spin text-texto-tenue" />}
        {problema && <span className="text-xs text-mal">{problema}</span>}

        {/* Cuántos días son: "del 01/09 al 15/09" no dice solo que son 15. */}
        {!problema && <span className="text-xs text-texto-tenue ml-1">{dias} {dias === 1 ? "día" : "días"}</span>}
        <Boton size="sm" variant="ghost" className="ml-auto" onClick={exportar} disabled={exportando || !puenteDatos}>
          {exportando ? "Armando…" : "Exportar a Excel"}
        </Boton>
      </div>

      {/* El mes en curso contra sus objetivos (06/10), sea cual sea el
          período elegido: el objetivo es del mes. Sin objetivos, una línea
          que dice dónde se cargan. */}
      {hayObjetivos(ajustes.objetivos)
        ? <ObjetivosDelMes diario={k.diario} objetivos={ajustes.objetivos} />
        : <p className="text-xs text-texto-tenue">¿Querés ver el mes contra un objetivo? Cargalo en Ajustes → Negocio → Objetivos del mes.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={`Ventas ${dias} días`} valor={money(ventas)} delta={ant ? variacion(ventas, ant.ventas) : null} sub={vsAnterior} />
        <Kpi label="Ganancia bruta" valor={money(ganancia(ventas, costo))} tono="bien"
          delta={ant ? variacion(ganancia(ventas, costo), ganancia(ant.ventas, ant.costo)) : null} sub={vsAnterior} />
        {/* El margen se compara en puntos, no en porcentaje del margen: de
            30% a 33% son "3 puntos", no "+10%". */}
        <Kpi label="Margen" valor={pct(margenAhora)} delta={ant && ant.ventas ? puntos(margenAhora, margenAntes) : null}
          sub={ant && ant.ventas ? "puntos vs período anterior" : undefined} />
        <Kpi label="Promedio por día" valor={money(ventas / dias)} />
      </div>

      {/* El ticket (06/10): cuántas ventas, de cuánto y con cuántas cosas.
          Unidades por ticket mide si se vende de a una o se arma la compra. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Ventas (tickets)" valor={nf.format(tickets)} delta={ant ? variacion(tickets, ant.tickets) : null} sub={vsAnterior} />
        <Kpi label="Ticket promedio" valor={money(ticketPromedio(ventas, tickets))}
          delta={ant ? variacion(ticketPromedio(ventas, tickets), ticketPromedio(ant.ventas, ant.tickets)) : null} sub={vsAnterior} />
        <Kpi label="Unidades por ticket" valor={unidades ? porTicket(unidades, tickets).toFixed(1).replace(".", ",") : "—"}
          delta={ant ? variacion(porTicket(unidades, tickets), porTicket(ant.unidades, ant.tickets)) : null} sub={vsAnterior} />
        <Kpi label="Lo que queda" valor={puente ? money(puente.queda) : "…"} tono={puente && puente.queda < 0 ? "mal" : "bien"}
          sub="después de comisiones y mermas" />
      </div>

      {puente && <PuenteDeRentabilidad puente={puente} />}

      <MatrizDeProductos matriz={matriz} />

      {quiebres && <QuiebresDeStock quiebres={quiebres} ir={ir} />}

      {puenteDatos && <CuandoSeVende porHora={puenteDatos.porHora} porDia={puenteDatos.porDia} />}
      {puenteDatos && <MediosDelPeriodo cobradoPorMedio={puenteDatos.cobradoPorMedio} ajustes={ajustes} />}
      {puenteDatos && <PorVendedor vendedores={puenteDatos.vendedores} />}
      <PagosAProveedores pagos={pagosProv} ventas={ventas} />


      {conPedidos && <PorCanal empresaId={empresaId} rango={rango} ir={ir} />}

      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Ventas y ganancia por día</div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={serie} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="gV2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gG2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} interval={Math.floor(dias / 8)} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v, n) => [money(v), n === "ventas" ? "Ventas" : "Ganancia"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
            <Area type="monotone" dataKey="ventas" stroke="#f97316" strokeWidth={2} fill="url(#gV2)" />
            <Area type="monotone" dataKey="ganancia" stroke="#16a34a" strokeWidth={2} fill="url(#gG2)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Los que más facturan</div>
          {topVenta.length === 0 ? (
            <Vacio>No hubo ventas en este período.</Vacio>
          ) : (
          <ul className="space-y-2.5">
            {topVenta.map((p, i) => (
              <li key={p.nombre}>
                <div className="flex justify-between text-sm gap-3">
                  <span className="truncate text-texto"><span className="f-m text-texto-tenue mr-2">{i + 1}</span>{p.nombre}</span>
                  <span className="f-m shrink-0">{money(p.venta)}</span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <div className="h-1.5 bg-superficie-2 rounded-full mt-1 overflow-hidden flex-1">
                    <div className="h-full bg-superficie-3 rounded-full" style={{ width: `${(p.venta / maxVenta) * 100}%` }} />
                  </div>
                  {/* Cuántas se vendieron: el importe solo no distingue
                      entre lo que sale mucho y lo que sale caro. */}
                  <span className="f-m text-[10px] text-texto-tenue shrink-0">{nf.format(p.unidades)} u</span>
                </div>
              </li>
            ))}
          </ul>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Los que más ganancia dejan</div>
          {topGanancia.length === 0 ? (
            <Vacio>No hubo ventas en este período.</Vacio>
          ) : (
          <ul className="space-y-2">
            {topGanancia.map((p, i) => (
              <li key={p.nombre} className="flex items-center justify-between text-sm gap-3 py-0.5">
                <span className="truncate text-texto"><span className="f-m text-texto-tenue mr-2">{i + 1}</span>{p.nombre}</span>
                <span className="shrink-0 text-right">
                  <span className="f-m block">{money(p.ganancia)}</span>
                  <span className="text-[10px] text-texto-tenue">{pct(p.margen, 0)} margen</span>
                </span>
              </li>
            ))}
          </ul>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Ventas y ganancia por rubro</div>
        {/* La suma de estas barras es el SUBTOTAL del período, no el total:
            el descuento y el recargo de una venta viven en la operación y
            no repartidos por línea. Con descuentos queda por encima del
            gráfico de arriba, y repartirlos sería inventar un criterio. */}
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={porCat} margin={{ top: 4, right: 8, left: -14, bottom: 40 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
            <XAxis dataKey="cat" tick={{ fontSize: 10, fill: "#78716c" }} angle={-35} textAnchor="end" axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v, n) => [money(v), n === "venta" ? "Venta" : "Ganancia"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
            <Bar dataKey="venta" fill="#e7e5e4" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ganancia" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-borde flex items-center justify-between">
          <div>
            <h3 className="f-d">Productos que perdieron margen</h3>
            <p className="text-xs text-texto-suave">Subió el costo y el precio quedó donde estaba.</p>
          </div>
          <Boton size="sm" variant="ghost" onClick={() => ir("productos", "margen")}>Ver todos</Boton>
        </div>
        <TablaSimple
          cols={["Producto", "Costo antes", "Costo hoy", "Margen", "Cuánto te cuesta"]}
          filas={k.subas.slice(0, 12).map((x) => [
            <div key="a"><div className="font-medium">{x.p.nombre}</div><div className="text-[11px] text-texto-tenue">{x.p.proveedor}</div></div>,
            <span className="f-m text-texto-tenue">{money(x.p.costoPrev)}</span>,
            <span className="f-m">{money(x.p.costo)} <span className="text-[10px] text-mal">+{pct(x.subaPct, 0)}</span></span>,
            <span className="f-m">{pct(x.margenAntes, 0)} → <span className="text-mal font-semibold">{pct(x.margenHoy, 0)}</span></span>,
            <span className="f-m font-semibold">{money(x.impacto)}/mes</span>,
          ])}
          vacio="Ningún costo subió en los últimos 30 días."
        />
      </Card>
    </div>
  );
}

/* ============================================================
   POR DÓNDE SE VENDIÓ
   ============================================================

   Un negocio que vende por mostrador, por delivery y por tres
   aplicaciones necesita saber cuánto deja cada uno: no es lo mismo
   facturar por PedidosYa que por la puerta, aunque el plato sea igual.

   Las cuentas son las mismas que muestra el centro de pedidos —la misma
   función de la base— para que dos pantallas del sistema no puedan decir
   números distintos del mismo día.
   ============================================================ */

function PorCanal({ empresaId, rango, ir }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(false);
  const vigente = useRef(0);

  /* De las 00:00 del primer día a las 00:00 del siguiente al último:
     `estadisticas_pedidos` toma el final sin incluirlo. */
  useEffect(() => {
    const mio = ++vigente.current;
    const desde = new Date(rango.desde);
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(rango.hasta);
    hasta.setHours(0, 0, 0, 0);
    hasta.setDate(hasta.getDate() + 1);

    estadisticas(empresaId, desde, hasta)
      .then((r) => { if (mio === vigente.current) { setD(r); setError(false); } })
      .catch(() => { if (mio === vigente.current) setError(true); });
  }, [empresaId, rango]);

  if (error) return null;
  if (!d) return <Card className="p-4"><Vacio>Calculando los pedidos…</Vacio></Card>;

  const canales = d.por_canal || [];
  const max = Math.max(1, ...canales.map((c) => Number(c.ventas)));
  const min = (v) => (v == null ? "—" : `${Math.round(Number(v))} min`);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Pedidos por canal</div>
          <p className="text-xs text-texto-suave">Take away, delivery y aplicaciones. El salón va aparte.</p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Pedidos</div>
            <div className="f-m text-sm">{nf.format(d.pedidos || 0)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Ticket</div>
            <div className="f-m text-sm">{money(d.ticket || 0)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold">Preparación</div>
            <div className="f-m text-sm">{min(d.minutos_preparacion)}</div>
          </div>
        </div>
      </div>

      {!canales.length ? (
        <Vacio>No entró ningún pedido en el período.</Vacio>
      ) : (
        <ul className="space-y-2.5">
          {canales.map((c) => (
            <li key={c.canal}>
              <div className="flex justify-between text-sm gap-3">
                <span className="truncate text-texto">{c.nombre}</span>
                <span className="f-m shrink-0">
                  {money(c.ventas)} <span className="text-[11px] text-texto-tenue">· {c.pedidos} ped.</span>
                </span>
              </div>
              <div className="h-1.5 bg-superficie-2 rounded-full mt-1 overflow-hidden">
                <div className={`h-full rounded-full ${tonoCanal({ color: c.color }).punto}`}
                  style={{ width: `${(Number(c.ventas) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {d.cancelados > 0 && (
        <p className="text-xs text-texto-suave mt-3">
          {d.cancelados} pedido{d.cancelados === 1 ? "" : "s"} cancelado{d.cancelados === 1 ? "" : "s"} en el período.
        </p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------
   El puente de rentabilidad (06/10)

   De lo que se hubiera cobrado sin descuentos a lo que de verdad queda:
   dónde se va la plata. Las definiciones están en src/utils/metricas.js.
   Cada barra es proporcional a las ventas sin descuentos.
   ------------------------------------------------------------ */
function PuenteDeRentabilidad({ puente }) {
  const base = Math.max(1, ...puente.pasos.map((p) => Math.abs(p.valor)));
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">De lo que vendiste a lo que te queda</div>
      <ul className="mt-3 space-y-1.5">
        {puente.pasos.map((p) => {
          const fuerte = p.tipo === "total" || p.tipo === "subtotal";
          const negativo = p.valor < 0;
          if (!fuerte && p.valor === 0) return null;
          return (
            <li key={p.k} className={`grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm ${fuerte ? "font-semibold" : "text-texto-suave"}`}>
              <span className="truncate">{p.n}</span>
              <span className="h-2 bg-superficie-2 rounded-full overflow-hidden">
                <span className={`block h-full rounded-full ${negativo ? "bg-mal" : p.tipo === "total" ? "bg-acento" : "bg-superficie-3"}`}
                  style={{ width: `${(Math.abs(p.valor) / base) * 100}%` }} />
              </span>
              <span className={`f-m text-right ${negativo ? "text-mal" : ""}`}>{negativo ? "−" : ""}{money(Math.abs(p.valor))}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-texto-tenue mt-3">
        Las comisiones se estiman con los medios de pago de Ajustes (con su IVA si lo tienen); las mermas, al costo de hoy.
        No incluye gastos fijos como alquiler o sueldos.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------
   La matriz de productos (06/10)

   Cuánto se vende contra cuánto deja, con cortes del propio comercio
   (ver matrizDeProductos en src/utils/metricas.js).
   ------------------------------------------------------------ */
const TONO_CUADRANTE = { estrella: "text-bien", volumen: "text-ojo", rentable: "text-acento", problema: "text-mal" };

function MatrizDeProductos({ matriz }) {
  const total = Object.values(matriz.grupos).reduce((s, g) => s + g.length, 0);
  if (!total) return null;
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Tus productos, por lo que venden y lo que dejan</div>
      <p className="text-xs text-texto-tenue mt-1">
        "Vende mucho": más de {money(matriz.corteVenta)} en el período (la mitad de arriba). "Deja mucho": margen arriba de {pct(matriz.corteMargen)}, el de todo el período.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        {CUADRANTES.map((c) => {
          const g = matriz.grupos[c.k];
          return (
            <div key={c.k} className="border border-borde rounded-xl p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className={`font-semibold ${TONO_CUADRANTE[c.k]}`}>{c.n}</span>
                <span className="f-m text-sm text-texto-suave">{nf.format(g.length)}</span>
              </div>
              <p className="text-xs text-texto-suave mt-0.5">{c.d}</p>
              {g.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {g.slice(0, 4).map((p) => (
                    <li key={p.nombre} className="flex justify-between gap-2">
                      <span className="truncate">{p.nombre}</span>
                      <span className="f-m text-xs text-texto-tenue shrink-0">{money(p.venta)} · {pct(p.margen, 0)}</span>
                    </li>
                  ))}
                  {g.length > 4 && <li className="text-xs text-texto-tenue">y {nf.format(g.length - 4)} más</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------
   Quiebres de stock (0134)

   Lo que se quedó sin stock en el período y cuánto se dejó de vender.
   Solo los productos con el stock cargado: del resto no se sabe cuándo
   hubo y cuándo no. Los días que se vendió con el stock en cero no son
   venta perdida sino un número mal contado, y se avisan aparte.
   ------------------------------------------------------------ */
const fechaCortaQ = (f) => f.split("-").reverse().slice(0, 2).join("/");

function QuiebresDeStock({ quiebres, ir }) {
  const conFalta = quiebres.filter((q) => q.diasSinStock > 0);
  const malContados = quiebres.filter((q) => q.diasVendiendoEnCero > 0);
  /* Se terminaron hoy o ayer: todavía no hay un día entero en falta. */
  const recienAgotados = quiebres.filter((q) => !q.diasSinStock && !q.diasVendiendoEnCero && q.stock <= 0);
  const perdida = conFalta.reduce((s, q) => s + (q.ventaPerdida || 0), 0);
  const gananciaPerdida = conFalta.reduce((s, q) => s + (q.gananciaPerdida || 0), 0);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Quiebres de stock</div>
          <p className="text-xs text-texto-suave mt-1">
            {conFalta.length
              ? <>Productos que estuvieron días enteros sin stock. Se dejaron de vender unos <span className="f-m text-texto">{money(perdida)}</span>{gananciaPerdida ? <>, <span className="f-m text-texto">{money(gananciaPerdida)}</span> de ganancia</> : null}.</>
              : "Ningún producto estuvo un día entero sin stock en el período."}
          </p>
        </div>
        {ir && <Boton size="sm" variant="quiet" onClick={() => ir("stock")}>Ir a Stock</Boton>}
      </div>
      {conFalta.length > 0 && (
        <div className="mt-3 -mx-4">
          <TablaSimple
            cols={["Producto", "Días sin stock", "Vende por día", "Se perdieron", "Venta perdida"]}
            filas={conFalta.slice(0, 15).map((q) => [
              <span key="n" className="flex items-center gap-2 min-w-0">
                <span className="truncate">{q.nombre}</span>
                {q.sinStockDesde && <Sello tono="mal">sin stock desde {fechaCortaQ(q.sinStockDesde)}</Sello>}
              </span>,
              <span key="d" className="f-m">{nf.format(q.diasSinStock)} <span className="text-texto-tenue">de {nf.format(q.diasContados)}</span></span>,
              <span key="v" className="f-m">{q.ventaDiaria == null ? "—" : q.ventaDiaria.toFixed(1).replace(".", ",")}</span>,
              <span key="p" className="f-m">{q.perdidas == null ? "—" : `${q.perdidas.toFixed(0)} u`}</span>,
              <span key="$" className="f-m">{q.ventaPerdida == null ? "—" : money(q.ventaPerdida)}</span>,
            ])}
          />
          {conFalta.length > 15 && <p className="text-xs text-texto-tenue mt-2 px-4">y {nf.format(conFalta.length - 15)} más en la planilla.</p>}
        </div>
      )}
      {recienAgotados.length > 0 && (
        <p className="text-xs text-texto-suave mt-3">
          Se terminaron hace poco: {recienAgotados.map((q) => q.nombre).join(", ")}.
        </p>
      )}
      {malContados.length > 0 && (
        <p className="text-xs text-ojo mt-3">
          Se vendió con el stock en cero: {malContados.slice(0, 5).map((q) => q.nombre).join(", ")}{malContados.length > 5 ? ` y ${malContados.length - 5} más` : ""}. El producto estaba y el número no: conviene contarlo de nuevo.
        </p>
      )}
      <p className="text-[11px] text-texto-tenue mt-3">
        Solo cuenta los productos con el stock cargado. La venta perdida es una estimación: días sin stock por lo que se vende un día con stock, al precio de hoy.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------
   Cuándo se vende (06/10)

   Por día de la semana y por hora, en Buenos Aires: para saber cuándo
   reforzar la caja y cuándo sobra gente. Las horas sin ventas se ocultan
   en las puntas para que el gráfico no sea medio vacío.
   ------------------------------------------------------------ */
const NOMBRE_DIA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function CuandoSeVende({ porHora, porDia }) {
  const conVentas = porHora.filter((h) => h.tickets > 0);
  if (!conVentas.length) return null;
  const desde = conVentas[0].hora, hasta = conVentas[conVentas.length - 1].hora;
  const horas = porHora.filter((h) => h.hora >= desde && h.hora <= hasta).map((h) => ({ ...h, label: `${h.hora}h` }));
  const mejorDia = [...porDia].sort((a, b) => b.ventas - a.ventas)[0];
  const mejorHora = [...porHora].sort((a, b) => b.ventas - a.ventas)[0];
  const maxDia = Math.max(1, ...porDia.map((x) => x.ventas));
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Por día de la semana</div>
        <p className="text-xs text-texto-suave mt-1">El que más vende: <b className="text-texto">{NOMBRE_DIA[mejorDia.dia]}</b>.</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {porDia.map((d) => (
            <li key={d.dia} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3">
              <span className="text-texto-suave">{NOMBRE_DIA[d.dia]}</span>
              <span className="h-2 bg-superficie-2 rounded-full overflow-hidden">
                <span className="block h-full bg-acento rounded-full" style={{ width: `${(d.ventas / maxDia) * 100}%` }} />
              </span>
              <span className="f-m text-right text-xs">
                {money(d.ventas)} <span className="text-texto-tenue">· {nf.format(d.tickets)} t · {money(d.tickets ? d.ventas / d.tickets : 0)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-texto-tenue mt-2">Ventas · tickets · ticket promedio.</p>
      </Card>
      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Por hora</div>
        <p className="text-xs text-texto-suave mt-1">La hora más fuerte: <b className="text-texto">de {mejorHora.hora} a {mejorHora.hora + 1}</b>.</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={horas} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v, n) => [n === "ventas" ? money(v) : v, n === "ventas" ? "Ventas" : "Tickets"]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
            <Bar dataKey="ventas" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------
   Medios de pago del período (06/10)

   Cuánto entró por cada medio y cuánto se llevó cada uno en comisiones
   (con su IVA): el costo financiero de cobrar. Con la configuración de
   Ajustes de hoy.
   ------------------------------------------------------------ */
function MediosDelPeriodo({ cobradoPorMedio, ajustes }) {
  const medios = mediosDe(ajustes);
  const filas = Object.entries(cobradoPorMedio)
    .map(([k, cobrado]) => {
      const m = medios.find((x) => x.k === k) || { k, n: k, tasa: 0 };
      return { k, n: m.n, cobrado, comision: comisionDe(m, cobrado), dias: m.dias || 0 };
    })
    .sort((a, b) => b.cobrado - a.cobrado);
  if (!filas.length) return null;
  const total = filas.reduce((s, f) => s + f.cobrado, 0);
  const comisiones = filas.reduce((s, f) => s + f.comision, 0);
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Cómo te pagaron</div>
      <p className="text-xs text-texto-suave mt-1">
        Cobrar te costó <b className="text-texto">{money(comisiones)}</b> en comisiones: el {pct(total ? comisiones / total : 0)} de lo cobrado.
      </p>
      <TablaSimple
        cols={["Medio", "Cobrado", "Del total", "Comisión", "Se acredita"]}
        filas={filas.map((f) => [
          f.n,
          <span key="c" className="f-m">{money(f.cobrado)}</span>,
          <span key="p" className="f-m">{pct(total ? f.cobrado / total : 0, 0)}</span>,
          <span key="m" className="f-m">{f.comision ? money(f.comision) : "—"}</span>,
          f.dias ? `a ${f.dias} días` : "en el día",
        ])}
      />
    </Card>
  );
}

/* ------------------------------------------------------------
   Por vendedor (06/10)

   Quién cobró cada venta. El descuento promedio sirve para ver si alguien
   descuenta mucho más que el resto.
   ------------------------------------------------------------ */
function PorVendedor({ vendedores }) {
  if (vendedores.length < 2) return null;
  const promedio = vendedores.reduce((s, v) => s + v.descuentos, 0) / Math.max(1, vendedores.reduce((s, v) => s + v.ventas + v.descuentos, 0));
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Por vendedor</div>
      <p className="text-xs text-texto-suave mt-1">Quién cobró cada venta. Descuento promedio de todos: {pct(promedio)}.</p>
      <TablaSimple
        cols={["Vendedor", "Ventas", "Tickets", "Ticket promedio", "Descuento promedio"]}
        filas={vendedores.map((v) => [
          v.nombre,
          <span key="v" className="f-m">{money(v.ventas)}</span>,
          <span key="t" className="f-m">{nf.format(v.tickets)}</span>,
          <span key="tp" className="f-m">{money(v.ticketPromedio)}</span>,
          <span key="d" className={`f-m ${v.descuentoPromedio > promedio * 1.5 && v.descuentoPromedio > 0.02 ? "text-mal font-semibold" : ""}`}>{pct(v.descuentoPromedio)}</span>,
        ])}
      />
    </Card>
  );
}

/* ------------------------------------------------------------
   A quién le pagaste (06/10)

   Los pagos de la caja grande del período, por a quién: proveedores y
   también servicios (la luz, el alquiler). Agrupa por el nombre, sin
   mayúsculas ni tildes: "Coca" y "coca" son el mismo.
   ------------------------------------------------------------ */
function PagosAProveedores({ pagos, ventas }) {
  if (!pagos.length) return null;
  const total = pagos.reduce((s, p) => s + p.total, 0);
  const max = pagos[0].total || 1;
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">A quién le pagaste</div>
      <p className="text-xs text-texto-suave mt-1">
        Pagos de la caja grande en el período: {money(total)}{ventas ? `, el ${pct(total / ventas, 0)} de lo vendido` : ""}.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {pagos.slice(0, 12).map((p) => (
          <li key={p.nombre} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
            <span className="truncate capitalize">{p.nombre}</span>
            <span className="h-2 bg-superficie-2 rounded-full overflow-hidden">
              <span className="block h-full bg-superficie-3 rounded-full" style={{ width: `${(p.total / max) * 100}%` }} />
            </span>
            <span className="f-m text-right text-xs">{money(p.total)} <span className="text-texto-tenue">· {p.pagos} pago{p.pagos === 1 ? "" : "s"}</span></span>
          </li>
        ))}
      </ul>
      {pagos.length > 12 && <p className="text-xs text-texto-tenue mt-2">y {pagos.length - 12} más.</p>}
    </Card>
  );
}
