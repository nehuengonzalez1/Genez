/* ============================================================
   11. REPORTES
   ============================================================ */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import { Kpi, Card, Boton, TablaSimple, Vacio } from "../ui/Base.jsx";
import { estadisticas } from "../datos/pedidos.js";
import { tonoCanal } from "../ui/canales.jsx";

export function Reportes({ productos, k, ir, empresaId = null, conPedidos = false }) {
  const [dias, setDias] = useState(30);
  const serie = k.diario.slice(-dias).map((d) => ({ ...d, ganancia: d.ventas - d.costo }));
  const ventas = serie.reduce((s, d) => s + d.ventas, 0);
  const costo = serie.reduce((s, d) => s + d.costo, 0);
  const factor = dias / 30;

  const topVenta = [...productos].sort((a, b) => b.u30 * b.precio - a.u30 * a.precio).slice(0, 10);
  const topGanancia = [...productos].sort((a, b) => (b.precio - b.costo) * b.u30 - (a.precio - a.costo) * a.u30).slice(0, 10);
  const porCat = useMemo(() => {
    const m = {};
    productos.forEach((p) => {
      if (!m[p.categoria]) m[p.categoria] = { cat: p.categoria, venta: 0, ganancia: 0 };
      m[p.categoria].venta += p.precio * p.u30 * factor;
      m[p.categoria].ganancia += (p.precio - p.costo) * p.u30 * factor;
    });
    return Object.values(m).sort((a, b) => b.venta - a.venta);
  }, [productos, factor]);

  const maxVenta = topVenta.length ? topVenta[0].u30 * topVenta[0].precio : 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDias(d)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${dias === d ? "bg-superficie-3 text-texto border-superficie-3" : "bg-superficie border-borde text-texto-suave hover:bg-superficie-2"}`}>
            {d} días
          </button>
        ))}
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
          <ul className="space-y-2.5">
            {topVenta.map((p, i) => (
              <li key={p.id}>
                <div className="flex justify-between text-sm gap-3">
                  <span className="truncate text-texto"><span className="f-m text-texto-tenue mr-2">{i + 1}</span>{p.nombre}</span>
                  <span className="f-m shrink-0">{money(p.u30 * p.precio * factor)}</span>
                </div>
                <div className="h-1.5 bg-superficie-2 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-superficie-3 rounded-full" style={{ width: `${(p.u30 * p.precio / maxVenta) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Los que más ganancia dejan</div>
          <ul className="space-y-2">
            {topGanancia.map((p, i) => (
              <li key={p.id} className="flex items-center justify-between text-sm gap-3 py-0.5">
                <span className="truncate text-texto"><span className="f-m text-texto-tenue mr-2">{i + 1}</span>{p.nombre}</span>
                <span className="shrink-0 text-right">
                  <span className="f-m block">{money((p.precio - p.costo) * p.u30 * factor)}</span>
                  <span className="text-[10px] text-texto-tenue">{pct((p.precio - p.costo) / p.precio, 0)} margen</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Ventas y ganancia por rubro</div>
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
