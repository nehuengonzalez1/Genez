/* ============================================================
   CALENDARIO · la grilla de turnos
   ============================================================

   Una grilla con las horas a la izquierda y una columna por profesional
   —o por sala, o por día si se mira la semana—. Los turnos se dibujan
   **proporcionales a su duración**: uno de 30 minutos ocupa la mitad que
   uno de 60. Es lo único que hace que un día se lea de un vistazo.

   El horario laboral va de fondo, más claro. Lo que queda oscuro es
   tiempo en el que no se atiende, y eso responde "¿por qué no puedo poner
   un turno acá?" sin que nadie tenga que preguntarlo.

   Este componente no sabe de reservas ni de Supabase: recibe columnas y
   bloques y los dibuja. Por eso sirve igual para turnos, para clases o
   para lo que venga después.
   ============================================================ */

import React, { useMemo, useRef } from "react";

const MIN_POR_HORA = 60;

/* Alto de una hora en píxeles. 56 entra un día de 8 a 21 en una pantalla
   de escritorio sin desplazar, que es el caso normal. */
const ALTO_HORA = 56;

const reloj = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/* Los que se pisan se reparten el ancho de la columna. Sin esto, dos
   turnos a la misma hora se tapan y uno desaparece. */
function repartir(bloques) {
  const orden = [...bloques].sort((a, b) => a.desde - b.desde || b.hasta - a.hasta);
  const salida = [];
  let grupo = [];

  const cerrar = () => {
    grupo.forEach((b, i) => salida.push({ ...b, columna: i, columnas: grupo.length }));
    grupo = [];
  };

  for (const b of orden) {
    if (grupo.length && !grupo.some((g) => g.desde < b.hasta && g.hasta > b.desde)) cerrar();
    grupo.push(b);
  }
  cerrar();
  return salida;
}

export function Calendario({
  columnas,          // [{ k, n, sub, franjas: [{desde, hasta}] }]  minutos desde medianoche
  bloques,           // [{ id, columna: k, desde, hasta, ... }]     minutos desde medianoche
  desdeHora = 7,
  hastaHora = 22,
  onVacio,           // (columnaK, minutos) => void
  onBloque,          // (bloque) => void
  dibujarBloque,     // (bloque) => nodo
}) {
  const ref = useRef(null);
  const desdeMin = desdeHora * 60;
  const hastaMin = hastaHora * 60;
  const alto = ((hastaMin - desdeMin) / MIN_POR_HORA) * ALTO_HORA;

  const horas = useMemo(() => {
    const xs = [];
    for (let h = desdeHora; h <= hastaHora; h++) xs.push(h);
    return xs;
  }, [desdeHora, hastaHora]);

  const porColumna = useMemo(() => {
    const m = new Map();
    for (const c of columnas) m.set(c.k, []);
    for (const b of bloques) if (m.has(b.columna)) m.get(b.columna).push(b);
    for (const [k, xs] of m) m.set(k, repartir(xs));
    return m;
  }, [columnas, bloques]);

  const y = (min) => ((min - desdeMin) / MIN_POR_HORA) * ALTO_HORA;

  /* Al hacer clic en un hueco se redondea a la media hora de arriba: nadie
     agenda a las 9:07, y pedirle precisión al mouse es maltratarlo. */
  function clicEnVacio(e, columnaK) {
    if (!onVacio) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const min = desdeMin + ((e.clientY - caja.top) / ALTO_HORA) * MIN_POR_HORA;
    onVacio(columnaK, Math.max(desdeMin, Math.round(min / 30) * 30));
  }

  if (columnas.length === 0) {
    return (
      <div className="text-center py-14 text-texto-tenue text-sm">
        No hay a quién mostrarle la agenda todavía.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" ref={ref}>
      <div className="min-w-[640px]">
        {/* Encabezado de columnas */}
        <div className="flex sticky top-0 z-10 bg-superficie border-b border-borde">
          <div className="w-14 shrink-0" />
          {columnas.map((c) => (
            <div key={c.k} className="flex-1 min-w-0 px-2 py-2.5 border-l border-borde">
              <div className="text-sm font-semibold text-texto truncate">{c.n}</div>
              {c.sub && <div className="text-[11px] text-texto-tenue truncate">{c.sub}</div>}
            </div>
          ))}
        </div>

        <div className="flex" style={{ height: alto }}>
          {/* Las horas */}
          <div className="w-14 shrink-0 relative">
            {horas.map((h) => (
              <div key={h} className="absolute right-2 -translate-y-1/2 f-m text-[11px] text-texto-tenue"
                style={{ top: y(h * 60) }}>
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>

          {columnas.map((c) => {
            const franjas = c.franjas || [];
            return (
              <div key={c.k} className="flex-1 min-w-0 relative border-l border-borde"
                onClick={(e) => clicEnVacio(e, c.k)}>

                {/* Fuera de horario queda oscuro; el horario laboral, un
                    poco más claro. Se dibuja el trabajo y no el hueco:
                    son menos rectángulos y se ve igual. */}
                {franjas.map((f, i) => (
                  <div key={i} className="absolute inset-x-0 bg-superficie-2/50"
                    style={{ top: y(Math.max(f.desde, desdeMin)), height: Math.max(0, y(Math.min(f.hasta, hastaMin)) - y(Math.max(f.desde, desdeMin))) }} />
                ))}

                {/* Las líneas de la hora */}
                {horas.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-borde/60" style={{ top: y(h * 60) }} />
                ))}

                {(porColumna.get(c.k) || []).map((b) => {
                  const arriba = y(Math.max(b.desde, desdeMin));
                  const altoB = Math.max(18, y(Math.min(b.hasta, hastaMin)) - arriba);
                  const ancho = 100 / b.columnas;
                  return (
                    <button key={b.id}
                      onClick={(e) => { e.stopPropagation(); onBloque && onBloque(b); }}
                      className="absolute px-0.5 text-left"
                      style={{ top: arriba, height: altoB, left: `${b.columna * ancho}%`, width: `${ancho}%` }}>
                      {dibujarBloque ? dibujarBloque(b, altoB) : (
                        <span className="block h-full rounded-lg border border-borde bg-superficie-2 px-2 py-1 text-xs truncate">
                          {reloj(b.desde)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
