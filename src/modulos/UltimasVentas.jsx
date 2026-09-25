/* ============================================================
   COBRO · LAS ÚLTIMAS VENTAS
   ============================================================

   Desde el cobro, con F3 o el botón "Últimas": las cinco ventas más
   recientes del comercio, para reimprimir sin salir del mostrador. Es
   lo que pasa todo el día: el ticket no salió, el cliente vuelve a pedir
   la factura, la impresora se trabó.

   Cada renglón se imprime con su botón o con su número (1 a 5), sin
   tocar el mouse. Tocando el renglón se abre el mismo detalle que en
   Caja, con lo que se vendió, la devolución y la nota de débito.

   Una venta que todavía no llegó a la base (se cobró sin internet)
   aparece arriba, marcada, y no se imprime desde acá: su papel se arma
   con lo que está en la base.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { Printer, X, WifiOff } from "lucide-react";
import { money, hora } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import { cargarUltimasVentas, cargarVenta } from "../datos/ventas.js";
import { cargarTicketDeVenta } from "../datos/arca.js";
import { pendientes as enEsteEquipo } from "../datos/cola.js";
import { Modal, Boton, Sello, imprimirTicket } from "../ui/Base.jsx";
import { DetalleMovimiento } from "./DetalleMovimiento.jsx";

const CUANTAS = 5;
const numeroFactura = (f) => `${f.letra} ${String(f.puntoVenta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`;
const esHoy = (d) => d.toDateString() === new Date().toDateString();

function Comprobante({ v }) {
  if (!v.fiscal) return <Sello>Ticket</Sello>;
  const nombre = v.nota === "debito" ? "Nota de débito" : "Factura";
  if (v.factura) return <Sello tono="bien" className="f-m normal-case tracking-normal">{nombre} {numeroFactura(v.factura)}</Sello>;
  return <Sello tono="ojo">{nombre} sin CAE</Sello>;
}

export function UltimasVentas({ empresaId, ajustes, toast, onCerrar, caja = null, permisos = {}, pedirCAEs = null, onCambio = null }) {
  const [ventas, setVentas] = useState(null);
  const [error, setError] = useState(null);
  const [imprimiendo, setImprimiendo] = useState(null);
  const [abierta, setAbierta] = useState(null);

  const leer = useCallback(() => {
    cargarUltimasVentas(empresaId, CUANTAS)
      .then((v) => { setVentas(v); setError(null); })
      .catch((e) => { setVentas([]); setError(e.message || "No se pudieron leer las ventas."); });
  }, [empresaId]);
  useEffect(() => { leer(); }, [leer]);

  /* Las de este equipo que todavía esperan internet, y que la base no
     tiene: se muestran para que nadie piense que se perdieron. */
  const sinSubir = (() => {
    const ids = new Set((ventas || []).map((v) => v.id));
    return enEsteEquipo().filter((v) => v.empresa_id === empresaId && !ids.has(v.id)).slice(-CUANTAS).reverse();
  })();

  /* Se relee la venta de la base, igual que en Caja: puede ser de otra
     caja o de antes de refrescar. La factura sin CAE no sale: el cliente
     se lleva un solo papel y es la factura (imprimirTicket lo avisa). */
  const imprimir = useCallback(async (v) => {
    if (imprimiendo) return;
    setImprimiendo(v.id);
    try {
      const [venta, t] = await Promise.all([cargarVenta(empresaId, v.id), cargarTicketDeVenta(empresaId, v.id)]);
      const papel = venta && venta.estadoFactura === "simulada" ? { ...t, fiscal: false } : { ...t, factura: venta ? venta.factura : null };
      imprimirTicket(papel, ajustes, toast);
    } catch (e) {
      toast(e.message || "No se pudo leer la venta.", "mal");
    } finally {
      setImprimiendo(null);
    }
  }, [empresaId, ajustes, toast, imprimiendo]);

  /* 1 a 5 imprime ese renglón. Con el detalle abierto, las teclas son de él. */
  useEffect(() => {
    if (abierta) return;
    const h = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= CUANTAS && ventas && ventas[n - 1]) {
        e.preventDefault();
        imprimir(ventas[n - 1]);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [ventas, imprimir, abierta]);

  return (
    <Modal open onClose={onCerrar} ancho="max-w-xl">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="f-d text-lg">Últimas ventas</h3>
            <p className="text-sm text-texto-suave mt-0.5">Para volver a imprimir un ticket o una factura. Tocá una para ver el detalle.</p>
          </div>
          <button onClick={onCerrar} className="text-texto-tenue hover:text-texto p-1 -mr-2 -mt-2" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {error && <p className="text-sm text-mal mt-4">{error}</p>}

        <ul className="mt-5 divide-y divide-borde border-y border-borde">
          {sinSubir.map((v) => (
            <li key={v.id} className="py-3 flex items-center gap-3">
              <span className="w-6 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="f-m text-texto-suave">{hora(new Date(v.fecha))}</span>
                  <span className="f-m">{v.numero}</span>
                  <Sello tono="ojo"><WifiOff size={10} className="inline -mt-0.5 mr-1" />Sin subir</Sello>
                </div>
                <div className="text-xs text-texto-tenue mt-0.5">Se cobró sin internet. Se puede reimprimir cuando llegue a la base.</div>
              </div>
              <span className="f-m text-sm font-semibold">{money(v.total)}</span>
            </li>
          ))}
          {ventas === null ? (
            <li className="py-4 text-sm text-texto-tenue">Cargando…</li>
          ) : ventas.length === 0 && !sinSubir.length ? (
            <li className="py-4 text-sm text-texto-tenue">Todavía no hay ventas.</li>
          ) : ventas.map((v, i) => (
            <li key={v.id} className="flex items-center gap-3">
              <button onClick={() => setAbierta(v)} className="flex-1 min-w-0 flex items-center gap-3 py-3 text-left hover:bg-superficie-2 -ml-2 pl-2 rounded-md">
                <kbd className="f-m text-[11px] w-6 h-6 shrink-0 inline-flex items-center justify-center rounded border border-borde text-texto-suave">{i + 1}</kbd>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="f-m text-texto-suave">{esHoy(v.fecha) ? hora(v.fecha) : `${fdatel(v.fecha)} ${hora(v.fecha)}`}</span>
                    <Comprobante v={v} />
                  </div>
                  <div className="text-xs text-texto-tenue mt-0.5 truncate">
                    <span className="f-m">{v.numero}</span>{v.cliente ? ` · ${v.cliente}` : ""}
                  </div>
                </div>
                <span className="f-m text-sm font-semibold shrink-0">{money(v.total)}</span>
              </button>
              <Boton size="sm" variant="ghost" onClick={() => imprimir(v)} disabled={imprimiendo === v.id}
                title={`Imprimir (tecla ${i + 1})`}>
                <Printer size={14} /> {imprimiendo === v.id ? "…" : "Imprimir"}
              </Boton>
            </li>
          ))}
        </ul>

        <p className="text-xs text-texto-tenue mt-3">
          <kbd className="f-m">1</kbd>–<kbd className="f-m">{CUANTAS}</kbd> imprime · <kbd className="f-m">Esc</kbd> cierra
        </p>
      </div>

      {abierta && (
        <DetalleMovimiento m={{ operacionId: abierta.id, tipo: "ingreso", monto: abierta.total, detalle: `Venta ${abierta.numero}` }}
          empresaId={empresaId} ajustes={ajustes} toast={toast}
          caja={caja} permisos={permisos} pedirCAEs={pedirCAEs}
          onCambio={() => { leer(); if (onCambio) onCambio(); }}
          onCerrar={() => setAbierta(null)} />
      )}
    </Modal>
  );
}
