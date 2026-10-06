/* ============================================================
   OBJETIVOS DEL MES · en Inicio y en Reportes (06/10)
   ============================================================

   El comercio fija en Ajustes → Negocio cuánto quiere vender en el mes,
   con qué margen y con qué ticket promedio. Acá se muestra el mes en
   curso contra eso: lo real hasta hoy, cuánto se cumplió y a qué se
   llega al cierre si se sigue a este ritmo (proyeccionDelMes, en
   src/utils/metricas.js).

   Sale de la serie diaria que Sistema ya carga al entrar (los últimos 90
   días, de todas las sucursales): no hace falta otra consulta, y el
   objetivo es del comercio entero.
   ============================================================ */

import React from "react";
import { Target } from "lucide-react";
import { Card } from "../ui/Base.jsx";
import { money, pct } from "../utils/helpers.js";
import { margen, ticketPromedio, proyeccionDelMes } from "../utils/metricas.js";

const hoyBA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

export const hayObjetivos = (o) => !!(o && (o.ventas > 0 || o.margen > 0 || o.ticket > 0));

export function ObjetivosDelMes({ diario = [], objetivos }) {
  if (!hayObjetivos(objetivos)) return null;
  const hoy = hoyBA();
  const mes = hoy.slice(0, 7);
  const [a, m, d] = hoy.split("-").map(Number);
  const diasDelMes = new Date(a, m, 0).getDate();
  const delMes = diario.filter((x) => {
    const f = x.fecha instanceof Date ? x.fecha : new Date(x.fecha);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}` === mes;
  });
  const ventas = delMes.reduce((s, x) => s + x.ventas, 0);
  const costo = delMes.reduce((s, x) => s + x.costo, 0);
  const tickets = delMes.reduce((s, x) => s + (x.tickets || 0), 0);
  const proyectado = proyeccionDelMes(ventas, d, diasDelMes);
  const nombreMes = new Date(a, m - 1, 1).toLocaleDateString("es-AR", { month: "long" });

  const filas = [];
  if (objetivos.ventas > 0) {
    const cumple = proyectado >= objetivos.ventas;
    const faltan = Math.max(0, objetivos.ventas - ventas);
    const quedan = diasDelMes - d;
    filas.push({
      k: "ventas", n: "Ventas", real: money(ventas), objetivo: money(objetivos.ventas), avance: ventas / objetivos.ventas, cumple,
      detalle: cumple
        ? `A este ritmo cerrás el mes en ${money(proyectado)}.`
        : `A este ritmo cerrás en ${money(proyectado)}. Para llegar: ${money(quedan ? faltan / quedan : faltan)} por día${quedan ? ` los ${quedan} días que quedan` : ""}.`,
    });
  }
  if (objetivos.margen > 0) {
    const real = margen(ventas, costo);
    const obj = objetivos.margen / 100;
    filas.push({ k: "margen", n: "Margen", real: pct(real), objetivo: pct(obj), avance: obj ? real / obj : 0, cumple: real >= obj,
      detalle: real >= obj ? "Arriba del objetivo." : `${((obj - real) * 100).toFixed(1).replace(".", ",")} puntos abajo del objetivo.` });
  }
  if (objetivos.ticket > 0) {
    const real = ticketPromedio(ventas, tickets);
    filas.push({ k: "ticket", n: "Ticket promedio", real: money(real), objetivo: money(objetivos.ticket), avance: real / objetivos.ticket, cumple: real >= objetivos.ticket,
      detalle: real >= objetivos.ticket ? "Arriba del objetivo." : `${money(objetivos.ticket - real)} abajo del objetivo.` });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Target size={15} className="text-acento" />
        <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Objetivos de {nombreMes}</div>
        <span className="ml-auto text-xs text-texto-tenue">día {d} de {diasDelMes}</span>
      </div>
      <ul className="mt-3 space-y-3">
        {filas.map((f) => (
          <li key={f.k}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">{f.n}</span>
              <span className="f-m"><span className={f.cumple ? "text-bien" : "text-texto"}>{f.real}</span> <span className="text-texto-tenue">de {f.objetivo}</span></span>
            </div>
            <div className="h-2 bg-superficie-2 rounded-full overflow-hidden mt-1">
              <div className={`h-full rounded-full ${f.cumple ? "bg-bien" : "bg-acento"}`} style={{ width: `${Math.min(100, Math.max(0, f.avance * 100))}%` }} />
            </div>
            <p className={`text-xs mt-1 ${f.cumple ? "text-bien" : "text-texto-suave"}`}>{f.detalle}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
