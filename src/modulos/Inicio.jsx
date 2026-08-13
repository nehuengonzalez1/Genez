/* ============================================================
   5. INICIO
   ============================================================ */

import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowRight, Truck, Wallet, Barcode } from "lucide-react";
import { HOY, fdatel } from "../datos/generador.js";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import { Card, Kpi, Boton, SEV } from "../ui/Base.jsx";

export function Inicio({ k, ins, ventasHoy, ticketsHoy, ir, negocio, aCobrar }) {
  const serie = k.diario.slice(-30).map((d) => ({ ...d, ganancia: d.ventas - d.costo }));
  const ganHoy = ventasHoy * k.margen30;
  return (
    <div className="space-y-5">
      <div className="bg-superficie-3 text-texto rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-acento/15" />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">
            {negocio} · {fdatel(HOY)}
          </div>
          <h1 className="f-d text-2xl md:text-4xl leading-tight mt-3 max-w-3xl">
            Hoy llevás <span className="text-acento-vivo tabular-nums">{money(ventasHoy)}</span> en{" "}
            <span className="tabular-nums">{ticketsHoy}</span> tickets.
            <br className="hidden md:block" /> Te queda aproximadamente{" "}
            <span className="text-emerald-400 tabular-nums">{money(ganHoy)}</span> de ganancia bruta.
          </h1>
          <p className="text-texto-tenue text-sm mt-3 max-w-2xl">
            Tenés {ins.filter((i) => i.sev === "alta").length} cosas urgentes y {ins.filter((i) => i.sev === "media").length} para
            mirar esta semana. Están abajo, en orden.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Boton onClick={aCobrar} variant="primary"><Barcode size={16} /> Volver a cobrar</Boton>
            <Boton onClick={() => ir("compras")} variant="ghost" className="!bg-superficie/10 !text-texto !border-borde-fuerte hover:!bg-superficie/20"><Truck size={16} /> Pedido sugerido</Boton>
            <Boton onClick={() => ir("caja")} variant="ghost" className="!bg-superficie/10 !text-texto !border-borde-fuerte hover:!bg-superficie/20"><Wallet size={16} /> Caja</Boton>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Ventas 30 días" valor={money(k.v30)} delta={k.v30 / k.v30p - 1} sub="vs. 30 previos" />
        <Kpi label="Margen bruto" valor={pct(k.margen30)} delta={k.margen30 - k.margen30p} tono={k.margen30 >= k.margen30p ? "bien" : "mal"} sub="vs. mes anterior" />
        <Kpi label="Ticket promedio" valor={money(k.ticketProm)} delta={k.ticketProm / k.ticketPromP - 1} />
        <Kpi label="Valor del stock" valor={moneyk(k.valorStock)} sub={`${nf.format(k.dormidos.length)} sin rotar`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="f-d text-lg">Lo que tenés que saber</h2>
            <button onClick={() => ir("asistente")} className="text-xs font-semibold text-acento hover:underline">Ver todo el análisis</button>
          </div>
          {ins.slice(0, 4).map((i) => {
            const s = SEV[i.sev]; const Ico = i.icon;
            return (
              <Card key={i.id} className="p-4 hover:border-borde-fuerte transition-colors">
                <div className="flex gap-3">
                  <div className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-superficie-2 flex items-center justify-center"><Ico size={17} className="text-texto-suave" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2 flex-wrap">
                      <h3 className="font-semibold text-texto leading-snug">{i.titulo}</h3>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${s.pill}`}>{s.label}</span>
                    </div>
                    <p className="text-sm text-texto-suave mt-1.5">{i.que}</p>
                    <p className="text-sm text-texto-suave mt-1">{i.porque}</p>
                    <div className="flex items-center justify-between gap-3 mt-2.5 pt-2.5 border-t border-borde">
                      <p className="text-sm font-medium text-texto">{i.hacer}</p>
                      <button onClick={() => ir(i.tab)} className="shrink-0 text-xs font-semibold text-acento hover:underline inline-flex items-center gap-1">
                        {i.accion} <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="space-y-5">
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Ventas y ganancia · 30 días</div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={serie} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} interval={6} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#a8a29e" }} tickFormatter={moneyk} axisLine={false} tickLine={false} width={54} />
                <Tooltip formatter={(v, n) => [money(v), n === "ventas" ? "Ventas" : "Ganancia"]} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #e7e5e4" }} />
                <Area type="monotone" dataKey="ventas" stroke="#f97316" strokeWidth={2} fill="url(#gV)" />
                <Area type="monotone" dataKey="ganancia" stroke="#16a34a" strokeWidth={1.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Se acaban primero</div>
            <ul className="space-y-2.5">
              {k.criticos.slice(0, 6).map(({ p, cobertura }) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cobertura < 2 ? "bg-mal" : "bg-ojo"}`} />
                  <span className="truncate flex-1 text-texto">{p.nombre}</span>
                  <span className="f-m text-xs text-texto-tenue shrink-0">{cobertura < 1 ? "hoy" : `${Math.round(cobertura)} d`}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => ir("compras")} className="mt-3 text-xs font-semibold text-acento hover:underline">Armar pedido</button>
          </Card>
        </div>
      </div>
    </div>
  );
}
