/* ============================================================
   GENEZ FOUNDER · Prospector → Pedidos de la web (0123)
   ============================================================

   Los presupuestos que se pidieron en la landing, para pasarlos al CRM.
   Es una fuente propia: la persona dejó sus datos para que la contacten.
   Pasar uno arma el prospecto con su contacto y su oportunidad (con los
   módulos y el monto que eligió), o lo vincula al que ya existía si el
   teléfono o el correo coinciden.
   ============================================================ */

import React, { useCallback, useEffect, useState } from "react";
import { Card, Boton, Cargando, ErrorEstado, Vacio, Sello } from "../ui/Base.jsx";
import { money } from "../utils/helpers.js";
import { cargarSolicitudes, solicitudAProspecto } from "../datos/internoMetricas.js";
import { fechaHora } from "./util.js";

export function PedidosWeb({ abrir, toast }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [pasando, setPasando] = useState(null);
  const leer = useCallback(() => cargarSolicitudes().then((l) => { setLista(l); setError(""); }).catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);
  const pasar = async (s) => {
    setPasando(s.id);
    try { const id = await solicitudAProspecto(s.id); toast("Está en el CRM."); await leer(); abrir(id); }
    catch (e) { toast(e.message, "mal"); }
    finally { setPasando(null); }
  };
  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!lista) return <Card><Cargando /></Card>;
  if (!lista.length) return <Card><Vacio>Todavía nadie pidió un presupuesto en genez.com.ar.</Vacio></Card>;
  return (
    <Card className="overflow-hidden">
      <ul className="divide-y divide-borde">
        {lista.map((s) => (
          <li key={s.id} className="px-4 py-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">{s.negocio || s.nombre}</span>
              {s.negocio && <span className="text-xs text-texto-suave">{s.nombre}</span>}
              <span className="text-xs text-texto-suave f-m">{s.telefono}{s.email ? ` · ${s.email}` : ""}</span>
              {s.prospectoId && <Sello tono="bien">en el CRM</Sello>}
              <span className="text-[11px] text-texto-tenue ml-auto">{fechaHora(s.creadoEn)}</span>
            </div>
            <p className="text-xs text-texto-suave">
              {[s.rubro, (s.modulos || []).length ? `módulos: ${s.modulos.join(", ")}` : null, s.mensual ? `${money(Math.round(Number(s.mensual)))}/mes` : null].filter(Boolean).join(" · ")}
            </p>
            {s.mensaje && <p className="text-sm whitespace-pre-wrap">{s.mensaje}</p>}
            <div className="pt-1">
              {s.prospectoId
                ? <Boton size="sm" variant="ghost" onClick={() => abrir(s.prospectoId)}>Ver el prospecto</Boton>
                : <Boton size="sm" onClick={() => pasar(s)} disabled={pasando === s.id}>{pasando === s.id ? "Pasando…" : "Pasar al CRM"}</Boton>}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
