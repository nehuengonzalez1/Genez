/* ============================================================
   UI · CAMPOS  (Campo y inputCls, extraídos de Section 6bis)
   ============================================================ */

import React from "react";

export function Campo({ label, children, ancho = "" }) {
  return (
    <label className={`block ${ancho}`}>
      <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm mt-1 outline-none focus:border-orange-400";
