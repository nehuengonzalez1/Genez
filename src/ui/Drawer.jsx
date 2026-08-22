/* ============================================================
   DRAWER · el panel que se abre al costado
   ============================================================

   Hermano de `Modal`, con una diferencia que importa: el modal tapa la
   pantalla y el drawer la deja ver. Para el detalle de un turno eso es
   todo — se mira la ficha sin perder de vista la agenda de atrás, que es
   justamente contra lo que se compara para decidir.

   En el celular no hay costado que valga, así que sube desde abajo. Es el
   mismo criterio que ya usa `Overlay` en el POS.
   ============================================================ */

import React, { useEffect } from "react";
import { X } from "lucide-react";

export function Drawer({ open, onClose, titulo, subtitulo, acciones, children, ancho = "max-w-md" }) {
  /* Escape cierra, y mientras está abierto el fondo no se desplaza: si se
     desplaza, al cerrar el drawer la agenda quedó en otro lado. */
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = antes;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Menos opaco que el del modal, a propósito: lo de atrás tiene que
          seguir leyéndose. */}
      <div className="absolute inset-0 bg-fondo/60" onClick={onClose} />

      <aside
        className={`relative w-full ${ancho} h-full bg-superficie border-l border-borde flex flex-col seguro-abajo`}>
        <header className="flex items-start gap-3 p-4 border-b border-borde shrink-0">
          <div className="min-w-0 flex-1">
            <h3 className="f-d text-lg leading-tight truncate">{titulo}</h3>
            {subtitulo && <p className="text-sm text-texto-suave mt-0.5 truncate">{subtitulo}</p>}
          </div>
          <button onClick={onClose} title="Cerrar"
            className="shrink-0 p-1.5 rounded-lg text-texto-tenue hover:text-texto hover:bg-superficie-2">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        {acciones && (
          <footer className="p-4 border-t border-borde shrink-0">{acciones}</footer>
        )}
      </aside>
    </div>
  );
}
