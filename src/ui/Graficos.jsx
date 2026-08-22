/* ============================================================
   GRÁFICOS · anillos, barras y chispas
   ============================================================

   Los colores se pasan como `rgb(var(--acento))` y no como un hex: así un
   gráfico sigue al tema igual que el resto del sistema. Un `#f97316`
   escrito acá quedaría fijo en claro y en oscuro, que es exactamente lo
   que sacamos de las pantallas.
   ============================================================ */

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export const TONOS = {
  bien: "rgb(var(--bien))",
  ojo: "rgb(var(--ojo))",
  mal: "rgb(var(--mal))",
  info: "rgb(var(--info))",
  acento: "rgb(var(--acento))",
  tenue: "rgb(var(--texto-tenue))",
};

/* Anillo. `datos` es [{ n, v, tono }] o [{ n, v }] a secas.

   Sin tono, todos los gajos van del mismo naranja en distinta intensidad y
   no de cinco colores distintos. Un color fuerte tiene que significar algo:
   una sala más ocupada que otra no es un estado, es una cantidad, y para
   una cantidad alcanza con la intensidad. */
export function Anillo({ datos, centro, sub, alto = 190 }) {
  const total = datos.reduce((s, d) => s + (Number(d.v) || 0), 0);
  if (!total) {
    return (
      <div style={{ height: alto }} className="flex items-center justify-center text-sm text-texto-tenue">
        Sin datos todavía
      </div>
    );
  }
  return (
    <div style={{ height: alto }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={datos} dataKey="v" nameKey="n" innerRadius="62%" outerRadius="92%"
            paddingAngle={2} stroke="none" isAnimationActive={false}>
            {datos.map((d, i) => (
              <Cell key={i}
                fill={d.tono ? TONOS[d.tono] || TONOS.acento : TONOS.acento}
                fillOpacity={d.tono ? 1 : 1 - i * 0.16} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="f-d text-2xl tabular-nums text-texto">{centro}</div>
        {sub && <div className="text-[11px] text-texto-tenue">{sub}</div>}
      </div>
    </div>
  );
}

/* La referencia de un anillo, al costado. Va aparte del gráfico porque en
   pantallas angostas la leyenda baja y el anillo se queda arriba. */
export function Referencia({ datos, formato }) {
  return (
    <ul className="space-y-2 min-w-0">
      {datos.map((d, i) => (
        <li key={d.k || d.n} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full shrink-0"
            style={{
              background: d.tono ? TONOS[d.tono] || TONOS.acento : TONOS.acento,
              opacity: d.tono ? 1 : 1 - i * 0.16,
            }} />
          <span className="truncate flex-1 text-texto-suave">{d.n}</span>
          <span className="f-m text-xs text-texto shrink-0">{formato ? formato(d) : d.v}</span>
        </li>
      ))}
    </ul>
  );
}

/* Barra horizontal con su monto y su parte del total. La usa "ingresos por
   área" y sirve para cualquier ranking con plata. */
export function BarraDato({ nombre, valor, total, formato }) {
  const parte = total > 0 ? valor / total : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="truncate text-texto">{nombre}</span>
        <span className="shrink-0 flex items-baseline gap-2">
          <span className="f-m text-texto">{formato ? formato(valor) : valor}</span>
          <span className="f-m text-xs text-texto-tenue">{Math.round(parte * 100)}%</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-superficie-2 overflow-hidden">
        <div className="h-full rounded-full bg-acento" style={{ width: `${Math.max(2, parte * 100)}%` }} />
      </div>
    </div>
  );
}

/* La chispa de las tarjetas: una línea sin ejes ni números. No es un
   gráfico para leer valores, es para ver si sube o baja, así que se dibuja
   a mano en vez de arrastrar un contenedor de recharts por cada tarjeta. */
export function Chispa({ serie, alto = 28, ancho = 92 }) {
  const xs = (serie || []).filter((n) => Number.isFinite(n));
  if (xs.length < 2) return null;

  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const rango = max - min || 1;
  const paso = ancho / (xs.length - 1);
  const punto = (v, i) => `${(i * paso).toFixed(1)},${(alto - ((v - min) / rango) * (alto - 3) - 1.5).toFixed(1)}`;
  const linea = xs.map(punto).join(" ");

  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} className="overflow-visible" aria-hidden="true">
      <polyline points={linea} fill="none" stroke="rgb(var(--acento))" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
