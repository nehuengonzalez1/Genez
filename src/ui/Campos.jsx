/* ============================================================
   UI · CAMPOS  (Campo y inputCls, extraídos de Section 6bis)
   ============================================================ */

import React, { useState } from "react";

/* Campo numérico que guarda al salir, no en cada tecla.
   Escribir "1250" con guardado por pulsación son cuatro viajes a la base,
   y como el valor vuelve releído desde el servidor le pisa al usuario lo
   que está tipeando. Mientras el campo está en edición manda el borrador
   local; recién al salir (o con Enter) se confirma, y solo si cambió.
   Escape descarta. */
export function NumeroDiferido({ valor, onGuardar, className, placeholder }) {
  const [borrador, setBorrador] = useState(null);

  const confirmar = () => {
    if (borrador === null) return;
    const n = Number(borrador) || 0;
    setBorrador(null);
    if (n !== Number(valor || 0)) onGuardar(n);
  };

  return (
    <input
      value={borrador ?? (valor || "")}
      onChange={(e) => setBorrador(e.target.value.replace(/\D/g, ""))}
      onBlur={confirmar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") { setBorrador(null); e.currentTarget.blur(); }
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function Campo({ label, children, ancho = "" }) {
  return (
    <label className={`block ${ancho}`}>
      <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm mt-1 outline-none focus:border-orange-400";
