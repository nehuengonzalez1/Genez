/* ============================================================
   SALÓN · LOS QR DE LAS MESAS (0104)
   ============================================================

   Una hoja A4 con el QR de cada mesa, para imprimir, recortar y pegar.
   Cada QR lleva el código de su mesa: el pedido cae en la comanda de esa
   mesa y en ninguna otra.

   Renovar el código de una mesa deja inservible su QR impreso: es para
   cuando una foto del QR anda circulando y llegan pedidos que nadie de
   la mesa hizo. Pide el permiso de configurar (0104).

   Va en hoja común y no en la comandera: un QR de 3 cm impreso en papel
   térmico se borra con el sol y la grasa en una semana.
   ============================================================ */

import React, { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { X, Printer, RefreshCw } from "lucide-react";
import { Modal, Boton } from "../ui/Base.jsx";
import { cargarRecursos } from "../datos/comandas.js";
import { renovarQr, linkDeMesa } from "../datos/cartaQr.js";

const numerico = (a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { numeric: true });

export function QrMesas({ empresaId, comercio, toast, onCerrar }) {
  const [mesas, setMesas] = useState(null);
  const [renovando, setRenovando] = useState(null);

  const leer = useCallback(async () => {
    try {
      const todas = await cargarRecursos(empresaId);
      const lista = todas.filter((r) => r.tipo === "mesa" && r.activo !== false && r.qr_token).sort(numerico);
      const conQr = await Promise.all(lista.map(async (m) => ({
        id: m.id, nombre: m.nombre, link: linkDeMesa(m.qr_token),
        imagen: await QRCode.toDataURL(linkDeMesa(m.qr_token), { margin: 1, width: 360, errorCorrectionLevel: "M" }),
      })));
      setMesas(conQr);
    } catch (e) {
      toast(e.message || "No se pudieron leer las mesas.", "mal");
      setMesas([]);
    }
  }, [empresaId, toast]);
  useEffect(() => { leer(); }, [leer]);

  const renovar = async (m) => {
    if (!window.confirm(`El QR impreso de la ${m.nombre} va a dejar de funcionar y hay que imprimir uno nuevo. Sirve si llegan pedidos que la mesa no hizo. ¿Renovar?`)) return;
    setRenovando(m.id);
    try { await renovarQr(m.id); await leer(); toast(`QR de la ${m.nombre} renovado: imprimilo de nuevo.`); }
    catch (e) { toast(e.message || "No se pudo renovar.", "mal"); }
    finally { setRenovando(null); }
  };

  /* Una ventana aparte con solo los QR, para que el navegador no imprima
     el resto de la pantalla. Tres por fila, con línea para recortar. */
  const imprimir = () => {
    const v = window.open("", "_blank");
    if (!v) return toast("El navegador bloqueó la ventana de impresión: permitila para este sitio.", "mal");
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    v.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>QR de las mesas</title><style>
      @page { size: A4; margin: 10mm; }
      body { font-family: system-ui, sans-serif; margin: 0; }
      .grilla { display: grid; grid-template-columns: repeat(3, 1fr); }
      .qr { border: 1px dashed #999; padding: 6mm; text-align: center; break-inside: avoid; }
      .qr img { width: 45mm; height: 45mm; }
      .mesa { font-size: 16pt; font-weight: 700; margin-top: 2mm; }
      .bajada { font-size: 9pt; color: #444; margin-top: 1mm; }
      .comercio { font-size: 8pt; color: #777; text-transform: uppercase; letter-spacing: .08em; }
    </style></head><body><div class="grilla">${mesas.map((m) => `
      <div class="qr"><div class="comercio">${esc(comercio || "")}</div><img src="${m.imagen}" alt=""><div class="mesa">${esc(m.nombre)}</div>
      <div class="bajada">Escaneá para ver la carta y pedir</div></div>`).join("")}
    </div><script>window.onload = () => { window.print(); };<\/script></body></html>`);
    v.document.close();
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-3xl">
      <div className="sticky top-0 bg-superficie border-b border-borde px-5 py-3.5 flex items-center justify-between gap-3">
        <div>
          <h3 className="f-d text-lg">QR de las mesas</h3>
          <p className="text-xs text-texto-suave">Quien lo escanea ve la carta y pide. El pedido cae en la comanda de la mesa y el mozo lo confirma.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Boton size="sm" onClick={imprimir} disabled={!mesas || !mesas.length}><Printer size={14} /> Imprimir</Boton>
          <button onClick={onCerrar} className="text-texto-tenue hover:text-texto"><X size={18} /></button>
        </div>
      </div>
      <div className="p-5">
        {!mesas ? <p className="text-sm text-texto-tenue">Armando los QR…</p> : !mesas.length ? (
          <p className="text-sm text-texto-tenue">No hay mesas cargadas.</p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {mesas.map((m) => (
              <li key={m.id} className="border border-borde rounded-lg p-3 text-center">
                <img src={m.imagen} alt={`QR de la ${m.nombre}`} className="w-full aspect-square bg-white rounded" />
                <div className="font-semibold mt-2">{m.nombre}</div>
                <button onClick={() => renovar(m)} disabled={renovando === m.id}
                  className="mt-1 text-xs text-texto-tenue hover:text-texto inline-flex items-center gap-1">
                  <RefreshCw size={11} className={renovando === m.id ? "animate-spin" : ""} /> Renovar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
