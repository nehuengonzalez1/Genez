/* ============================================================
   MÓDULOS: CUÁLES SE VEN (08/10)
   ============================================================

   Vendi lo tiene en su Panel Admin: prender y apagar secciones del menú.
   Nehuen lo pidió así: "que el comercio pueda elegir, dentro de todos los
   módulos que contrató, si hay alguno que no quiere, poder ocultarlo o
   volver a mostrarlo".

   Es una preferencia de pantalla, no de seguridad ni de facturación:
   - ocultar no da de baja (se sigue pagando; eso es Mi plan);
   - no es un permiso (lo que protege los datos es RLS, y lo que ve cada
     rol se decide en Permisos). Se guarda en la config del comercio
     (`modulosOcultos`) y vale para todos los que entran.

   Lo que no se ofrece ocultar: los módulos base (cobro, caja, ajustes) y
   la pantalla con la que el comercio vende, que es por donde arranca el
   sistema. Ocultarla dejaría a la caja sin pantalla.
   ============================================================ */

import React from "react";
import { EyeOff, Lock } from "lucide-react";
import { Card } from "../ui/Base.jsx";

const rotulo = "text-[11px] uppercase tracking-[0.1em] font-bold";

function Interruptor({ prendido, onCambiar, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={prendido} aria-label={etiqueta} onClick={onCambiar}
      className={`relative w-10 h-6 rounded-full border transition-colors shrink-0 ${prendido ? "bg-acento border-acento" : "bg-superficie-3 border-borde"}`}>
      <span className={`absolute top-0.5 w-[18px] h-[18px] rounded-full bg-superficie shadow-sm transition-all ${prendido ? "left-[19px]" : "left-0.5"}`} />
    </button>
  );
}

/* `grupos`: el menú del rubro con los módulos que el comercio contrató y
   que quien mira puede ver, sin contar los ocultos ([{ nombre, modulos }]).
   `fijos`: las claves que no se ofrecen ocultar. */
export function ModulosVisibles({ grupos, fijos, ajustes, setAjustes }) {
  const ocultos = ajustes.modulosOcultos || [];
  const cambiar = (k) => setAjustes({
    ...ajustes,
    modulosOcultos: ocultos.includes(k) ? ocultos.filter((x) => x !== k) : [...ocultos, k],
  });
  const cuantos = grupos.reduce((n, g) => n + g.modulos.filter((m) => ocultos.includes(m.k)).length, 0);
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="w-8 h-8 rounded-md border border-borde flex items-center justify-center shrink-0"><EyeOff size={16} className="text-acento" /></span>
          <div className="text-sm text-texto-suave leading-relaxed">
            <p>Lo que no usás, ocultalo: sale del menú para todos los que entran al comercio, y lo volvés a mostrar cuando quieras. Lo que tenía cargado sigue ahí.</p>
            <p className="mt-1.5 text-texto-tenue">Ocultar no lo da de baja: eso se hace en Mi plan. Y no es un permiso: para que una persona no vea algo, usá Permisos.</p>
          </div>
        </div>
        {cuantos > 0 && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-borde pt-3 text-sm">
            <span>{cuantos === 1 ? "Hay 1 módulo oculto." : `Hay ${cuantos} módulos ocultos.`}</span>
            <button type="button" onClick={() => setAjustes({ ...ajustes, modulosOcultos: [] })} className="font-semibold text-acento hover:underline">Mostrar todos</button>
          </div>
        )}
      </Card>

      {grupos.map((g) => (
        <Card key={g.clave || g.nombre || "general"} className="p-0 overflow-hidden">
          {g.nombre && <div className={`${rotulo} text-texto-tenue px-5 pt-4 pb-2`}>{g.nombre}</div>}
          <ul className="divide-y divide-borde">
            {g.modulos.map((m) => {
              const fijo = fijos.includes(m.k);
              const visible = fijo || !ocultos.includes(m.k);
              return (
                <li key={m.k} data-modulo={m.k} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold ${visible ? "text-texto" : "text-texto-tenue"}`}>{m.n}</div>
                    {m.d && <div className="text-xs text-texto-tenue mt-0.5">{m.d}</div>}
                  </div>
                  {fijo
                    ? <span className="flex items-center gap-1.5 text-xs text-texto-tenue"><Lock size={13} /> Siempre visible</span>
                    : (
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${visible ? "text-texto-suave" : "text-texto-tenue"}`}>{visible ? "Visible" : "Oculto"}</span>
                        <Interruptor prendido={visible} onCambiar={() => cambiar(m.k)} etiqueta={`${visible ? "Ocultar" : "Mostrar"} ${m.n}`} />
                      </div>
                    )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
