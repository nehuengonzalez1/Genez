/* ============================================================
   CAJA · FACTURAS
   ============================================================

   Las ventas cobradas como factura: las que esperan su CAE y las que ARCA
   ya autorizó hoy.

   Una factura espera cuando se cobró sin internet o con ARCA caído. No se
   pierde ni se pasa a ticket: la venta quedó marcada como factura desde
   el mostrador y el cliente no se llevó ningún papel. Cuando vuelven la
   red o ARCA, el botón pide los CAE de todas, **de la más vieja a la más
   nueva**, para que la numeración siga el orden de las ventas. No hay
   botón por fila a propósito: pedir una suelta la haría pasar adelante.

   Las que siguen en este equipo —la venta todavía no llegó a la base—
   se muestran aparte y sin botón: hasta que entre la venta no hay nada
   que facturar, y entra sola cuando vuelve internet.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { FileCheck2, Printer, RefreshCw } from "lucide-react";
import { money, hora } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import { cargarFacturas, cargarTicketDeVenta } from "../datos/arca.js";
import { pendientes as ventasEnEsteEquipo } from "../datos/cola.js";
import { Card, Boton, Vacio, imprimirTicket } from "../ui/Base.jsx";

const numeroFactura = (f) => `${f.letra} ${String(f.puntoVenta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`;

const ESTADO = {
  sin_cae: { n: "Sin CAE", cls: "border-ojo bg-ojo-suave text-ojo" },
  pidiendo: { n: "Pidiendo", cls: "border-borde bg-superficie-2 text-texto-suave" },
  equipo: { n: "Sin internet", cls: "border-borde bg-superficie-2 text-texto-suave" },
};

function Sello({ estado }) {
  const e = ESTADO[estado];
  return <span className={`text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-0.5 rounded border ${e.cls}`}>{e.n}</span>;
}

export function Facturas({ empresaId, ajustes, toast, facturacion, pedirCAEs, sinCAE }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [pidiendo, setPidiendo] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(null);

  const recargar = useCallback(async () => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    try {
      setDatos(await cargarFacturas(empresaId, hoy));
      setError(null);
    } catch (e) {
      setError(e.message || "No se pudieron leer las facturas.");
    }
  }, [empresaId]);

  /* `sinCAE` cambia cada vez que Sistema pide CAE por su cuenta —después
     de un cobro o cuando vuelve internet—, así la lista no queda vieja. */
  useEffect(() => { recargar(); }, [recargar, sinCAE]);

  const enEsteEquipo = ventasEnEsteEquipo().filter((v) => v.comprobante && v.comprobante.fiscal);

  const obtener = async () => {
    if (pidiendo) return;
    setPidiendo(true);
    const r = await pedirCAEs({ avisar: false });
    setPidiendo(false);
    await recargar();
    if (!r) return toast("Ya se están pidiendo los CAE. Esperá unos segundos.");
    if (r.autorizadas.length) {
      toast(r.autorizadas.length === 1 ? "ARCA autorizó 1 factura." : `ARCA autorizó ${r.autorizadas.length} facturas.`);
    }
    if (r.error) toast(`${r.autorizadas.length ? "Se frenó en la siguiente: " : ""}${r.error}`, "mal");
    else if (!r.autorizadas.length) toast("No había facturas esperando CAE.");
  };

  /* Se relee la venta de la base: puede ser de otra caja, o de antes de
     refrescar, y el ticket de esta pantalla ya no existe. */
  const imprimir = async (fila) => {
    setImprimiendo(fila.operacionId);
    try {
      const t = await cargarTicketDeVenta(empresaId, fila.operacionId);
      imprimirTicket({ ...t, factura: fila.factura }, ajustes, toast);
    } catch (e) {
      toast(e.message || "No se pudo leer la venta.", "mal");
    } finally {
      setImprimiendo(null);
    }
  };

  const esperan = datos ? datos.esperan : [];
  const hechas = datos ? datos.hechas : [];
  const cuantas = esperan.length + enEsteEquipo.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-borde">
        <div className="min-w-0">
          <h3 className="f-d text-lg">Facturas</h3>
          <p className="text-xs text-texto-tenue mt-0.5">
            {cuantas
              ? `${cuantas} ${cuantas === 1 ? "espera" : "esperan"} su CAE. Se piden en el orden en que se vendieron.`
              : "Todas las facturas tienen su CAE."}
            {facturacion.modo === "homologacion" && " · ARCA de pruebas, sin validez fiscal."}
          </p>
        </div>
        <Boton size="sm" variant={esperan.length ? "primary" : "ghost"} onClick={obtener} disabled={pidiendo || !esperan.length}>
          <RefreshCw size={14} className={pidiendo ? "animate-spin" : ""} /> {pidiendo ? "Pidiendo…" : "Obtener CAE"}
        </Boton>
      </div>

      {error && <p className="px-5 py-3 text-sm text-mal border-b border-borde">{error}</p>}

      {cuantas > 0 && (
        <div className="px-5 py-4 border-b border-borde">
          <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mb-2">Esperando CAE</div>
          <ul className="divide-y divide-borde">
            {esperan.map((f) => (
              <li key={f.operacionId} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    <span className="f-m">{fdatel(f.fecha)} {hora(f.fecha)}</span>
                    <span className="text-texto-tenue"> · venta {f.numeroInterno} · {f.cliente || "Consumidor final"}</span>
                  </div>
                  {f.ultimoError && <div className="text-xs text-mal mt-0.5 truncate" title={f.ultimoError}>{f.ultimoError}</div>}
                </div>
                <span className="f-m text-sm">{money(f.total)}</span>
                <Sello estado={f.estado} />
              </li>
            ))}
            {enEsteEquipo.map((v) => (
              <li key={v.id} className="py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1 text-sm">
                  <span className="f-m">{fdatel(new Date(v.fecha))} {hora(new Date(v.fecha))}</span>
                  <span className="text-texto-tenue"> · venta {v.numero} · todavía en este equipo</span>
                </div>
                <span className="f-m text-sm">{money(v.total)}</span>
                <Sello estado="equipo" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-5 py-4">
        <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mb-2">Autorizadas hoy</div>
        {!datos && !error ? (
          <p className="text-sm text-texto-tenue">Cargando…</p>
        ) : hechas.length ? (
          <ul className="divide-y divide-borde">
            {hechas.map((f) => (
              <li key={f.operacionId} className="py-2.5 flex items-center gap-3">
                <FileCheck2 size={16} className="text-bien shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm f-m">{numeroFactura(f.factura)}</div>
                  <div className="text-xs text-texto-tenue">
                    {hora(f.fecha)} · CAE <span className="f-m">{f.factura.cae}</span> · {f.cliente || "Consumidor final"}
                  </div>
                </div>
                <span className="f-m text-sm">{money(f.total)}</span>
                <Boton size="sm" variant="ghost" onClick={() => imprimir(f)} disabled={imprimiendo === f.operacionId}>
                  <Printer size={14} /> Imprimir
                </Boton>
              </li>
            ))}
          </ul>
        ) : (
          <Vacio>Todavía no hay facturas autorizadas hoy.</Vacio>
        )}
      </div>
    </Card>
  );
}
