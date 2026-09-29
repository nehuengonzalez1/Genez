/* ============================================================
   GENEZ FOUNDER · archivos adjuntos
   ============================================================

   Capturas, PDFs y planillas de un cliente o de un ticket, en el bucket
   privado 'interno' (0115). Se abren con un link firmado que vence: un
   link copiado a un chat deja de andar a los diez minutos. Sacar un
   archivo lo archiva; no hay borrado.
   ============================================================ */

import React, { useState } from "react";
import { Paperclip, FileText, Image as Imagen } from "lucide-react";
import { subirAdjunto, abrirAdjunto, archivarAdjunto, validarAdjunto } from "../datos/internoClientes.js";
import { fechaHora } from "./util.js";

const peso = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function Adjuntos({ area, tabla, filaId, lista, onCambio, toast }) {
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (ev) => {
    const archivos = [...(ev.target.files || [])];
    ev.target.value = "";
    if (!archivos.length) return;
    const mal = archivos.map(validarAdjunto).find(Boolean);
    if (mal) return toast(mal, "mal");
    setSubiendo(true);
    try {
      for (const a of archivos) await subirAdjunto(area, tabla, filaId, a);
      toast(archivos.length === 1 ? "Archivo subido." : `${archivos.length} archivos subidos.`);
      onCambio();
    } catch (e) { toast(e.message, "mal"); }
    setSubiendo(false);
  };
  const abrir = async (a) => {
    /* La ventana se abre antes de pedir el link: si se abre después de
       esperar, el navegador la toma como emergente y la bloquea. */
    /* Sin "noopener" en window.open, que la hace devolver null; se corta
       el vínculo a mano para que la pestaña nueva no toque a Founder. */
    const w = window.open("", "_blank");
    if (w) w.opener = null;
    try {
      const url = await abrirAdjunto(a.ruta);
      if (w) w.location.href = url;
      else toast("El navegador bloqueó la ventana. Permití las ventanas emergentes de genez.com.ar.", "mal");
    } catch (e) { if (w) w.close(); toast(e.message, "mal"); }
  };

  return (
    <div>
      {lista.length === 0 ? <p className="px-5 py-4 text-sm text-texto-tenue">Sin archivos.</p> : (
        <ul className="divide-y divide-borde">
          {lista.map((a) => {
            const I = String(a.tipoMime || "").startsWith("image/") ? Imagen : FileText;
            return (
              <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <I size={15} className="text-texto-tenue shrink-0" />
                <button onClick={() => abrir(a)} className="flex-1 min-w-0 text-left truncate hover:text-acento">{a.nombre}</button>
                <span className="text-[11px] text-texto-tenue f-m">{a.tamano ? peso(a.tamano) : ""}</span>
                <span className="text-[11px] text-texto-tenue hidden sm:inline">{fechaHora(a.creadoEn)}</span>
                <button onClick={async () => {
                  if (!window.confirm(`¿Sacar "${a.nombre}"? Se archiva, no se borra.`)) return;
                  try { await archivarAdjunto(a.id); onCambio(); } catch (e) { toast(e.message, "mal"); }
                }} className="text-[11px] text-texto-suave hover:text-texto">Sacar</button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="px-5 py-3 border-t border-borde">
        <label className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-borde ${subiendo ? "opacity-50" : "cursor-pointer hover:bg-superficie-2"}`}>
          <Paperclip size={14} /> {subiendo ? "Subiendo…" : "Adjuntar"}
          <input type="file" multiple className="hidden" disabled={subiendo} onChange={subir}
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.csv,.xlsx" />
        </label>
        <span className="text-[11px] text-texto-tenue ml-3">Imágenes, PDF, texto o planillas, hasta 10 MB.</span>
      </div>
    </div>
  );
}
