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

export function Reportes({ k, ir, empresaId = null, conPedidos = false }) {
  const [dias, setDias] = useState(30);
  const [aMedida, setAMedida] = useState("");

  /* `k.diario` son los noventa días que Sistema carga al entrar, y con eso
     alcanza para los atajos. Para un período más largo hay que ir a
     buscarlo: `ventas_diarias` acepta cualquier cantidad y devuelve la
     serie continua igual, con ceros en los días sin ventas. */
  const [serieLarga, setSerieLarga] = useState(null);
  const [cargando, setCargando] = useState(false);

  const alcanzaLaCargada = dias <= k.diario.length;
  const diario = alcanzaLaCargada ? k.diario : (serieLarga || []);

  useEffect(() => {
    if (alcanzaLaCargada || !empresaId) return;
    if (serieLarga && serieLarga.length >= dias) return;
    let vigente = true;
    setCargando(true);
    cargarSerieDiaria(empresaId, dias)
      .then((s) => { if (vigente) setSerieLarga(s); })
      .catch((e) => {
        if (!vigente) return;
        /* Sin serie el gráfico queda vacío y los indicadores en cero, que
           es lo que ya hacía Sistema si la consulta fallaba. Un cero
           honesto antes que una curva recortada sin avisar. */
        setSerieLarga([]);
        console.error("No se pudo cargar la serie del período pedido:", e);
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [dias, empresaId, alcanzaLaCargada]);

  const aplicarAMedida = () => {
    const n = Math.floor(Number(aMedida));
    if (!(n >= 1)) return;
    setDias(Math.min(n, TOPE_DIAS));
  };

  const serie = diario.slice(-dias).map((d) => ({ ...d, ganancia: d.ventas - d.costo }));
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
    cargarVentasPorItem(empresaId, dias)
      .then((v) => { if (vigente) setPorItem(v); })
      .catch((e) => {
        if (!vigente) return;
        setPorItem([]);
        console.error("No se pudieron cargar las ventas por producto:", e);
      });
    return () => { vigente = false; };
  }, [empresaId, dias]);

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
          <button key={d} onClick={() => { setDias(d); setAMedida(""); }}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${dias === d ? "bg-superficie-3 text-texto border-superficie-3" : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
            {d} días
          </button>
        ))}

        {/* El campo a medida vive al lado de los atajos y no detrás de un
            menú: es un número y un Enter, y esconderlo lo volvería el
            camino largo para algo que se pide todo el tiempo. */}
        <div className={`flex items-center gap-1 rounded-full border pl-3 pr-1 py-0.5 ${
          ATAJOS.includes(dias) ? "bg-superficie border-borde" : "bg-superficie-3 border-superficie-3"}`}>
          <input value={aMedida} inputMode="numeric" placeholder="otros"
            onChange={(e) => setAMedida(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aplicarAMedida(); } }}
            onBlur={aplicarAMedida}
            className="f-m w-14 bg-transparent text-xs text-right outline-none placeholder:text-texto-tenue placeholder:font-semibold" />
          <span className="text-xs text-texto-suave">días</span>
          <Boton size="sm" variant="ghost" onClick={aplicarAMedida}>Ver</Boton>
        </div>

        {cargando && <Loader2 size={14} className="animate-spin text-texto-tenue" />}

        {/* Qué período se está mirando, dicho con fechas. "212 días" no se
            entiende solo; "desde el 23/02" sí. */}
        {serie.length > 0 && (
          <span className="text-xs text-texto-tenue ml-1">
            {serie[0].label} — {serie[serie.length - 1].label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={`Ventas ${dias} días`} valor={money(ventas)} />
        <Kpi label="Ganancia bruta" valor={money(ventas - costo)} tono="bien" />
        <Kpi label="Margen" valor={pct(ventas ? (ventas - costo) / ventas : 0)} />
        <Kpi label="Promedio por día" valor={money(ventas / dias)} />
      </div>

      {conPedidos && <PorCanal empresaId={empresaId} dias={dias} ir={ir} />}

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

function PorCanal({ empresaId, dias, ir }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(false);
  const vigente = useRef(0);

  useEffect(() => {
    const mio = ++vigente.current;
    const desde = new Date();
    desde.setHours(0, 0, 0, 0);
    desde.setDate(desde.getDate() - (dias - 1));
    const hasta = new Date();
    hasta.setDate(hasta.getDate() + 1);

    estadisticas(empresaId, desde, hasta)
      .then((r) => { if (mio === vigente.current) { setD(r); setError(false); } })
      .catch(() => { if (mio === vigente.current) setError(true); });
  }, [empresaId, dias]);

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
