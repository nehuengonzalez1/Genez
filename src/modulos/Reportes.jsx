/* ============================================================
   11. REPORTES
   ============================================================ */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2 } from "lucide-react";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import { Kpi, Card, Boton, TablaSimple, Vacio } from "../ui/Base.jsx";
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

export function Reportes({ k, ir, empresaId = null, conPedidos = false }) {
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

  const alcanzaLaCargada = paraInput(rango.hasta) === hoy && dias <= k.diario.length;
  const serieBase = alcanzaLaCargada ? k.diario.slice(-dias) : (serieRango || []);

  useEffect(() => {
    if (alcanzaLaCargada || !empresaId) return undefined;
    let vigente = true;
    setCargando(true);
    setSerieRango(null);
    cargarSerieDiaria(empresaId, { desde: rango.desde, hasta: rango.hasta })
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
  }, [rango, empresaId, alcanzaLaCargada]);

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
    cargarVentasPorItem(empresaId, { desde: rango.desde, hasta: rango.hasta })
      .then((v) => { if (vigente) setPorItem(v); })
      .catch((e) => {
        if (!vigente) return;
        setPorItem([]);
        console.error("No se pudieron cargar las ventas por producto:", e);
      });
    return () => { vigente = false; };
  }, [empresaId, rango]);

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

        {cargando && <Loader2 size={14} className="animate-spin text-texto-tenue" />}
        {problema && <span className="text-xs text-mal">{problema}</span>}

        {/* Cuántos días son: "del 01/09 al 15/09" no dice solo que son 15. */}
        {!problema && <span className="text-xs text-texto-tenue ml-1">{dias} {dias === 1 ? "día" : "días"}</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={`Ventas ${dias} días`} valor={money(ventas)} />
        <Kpi label="Ganancia bruta" valor={money(ventas - costo)} tono="bien" />
        <Kpi label="Margen" valor={pct(ventas ? (ventas - costo) / ventas : 0)} />
        <Kpi label="Promedio por día" valor={money(ventas / dias)} />
      </div>

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
