/* ============================================================
   11. REPORTES
   ============================================================ */

import React, { useState, useMemo } from "react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import { Kpi, Card, Boton, TablaSimple } from "../ui/Base.jsx";

export function Reportes({ productos, k, ir }) {
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
