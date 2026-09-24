/* ============================================================
   CAJA · UN MOVIMIENTO ABIERTO
   ============================================================

   Cada renglón de "Movimientos de hoy" se abre. Si viene de una venta se
   ve qué se vendió, cómo se pagó, quién la cobró y, si fue factura, su
   número y su CAE; y se vuelve a imprimir igual que salió. Si es otra
   cosa —un gasto, un retiro, un cobro de cuenta corriente— se ve el
   movimiento y se imprime un comprobante de caja, que es lo que se firma
   cuando alguien se lleva plata del cajón.

   No hay un listado de ventas aparte a propósito: el cajero ya mira los
   movimientos, y ahí es donde se busca "lo del de recién".

   La venta se relee de la base con `cargarTicketDeVenta`, lo mismo que usa
   Caja → Facturas: la pantalla del cobro ya no la tiene si fue en otra
   caja o antes de refrescar. Se reimprime tal cual, sin marca de copia:
   una factura reimpresa es la misma factura, con el mismo número y CAE.
   ============================================================ */

import React, { useState, useEffect } from "react";
import { Printer, Receipt, FileText, ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import { money, hora, medioPorK, FISCAL_INICIAL } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import { cargarVenta } from "../datos/ventas.js";
import { cargarTicketDeVenta } from "../datos/arca.js";
import { Modal, Boton, Sello, Comandera, ticketVenta, qrDeFactura, imprimirTicket, armarLineas, imprimirComandera } from "../ui/Base.jsx";

const numeroFactura = (f) => `${f.letra} ${String(f.puntoVenta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`;
/* `nf` redondea a entero, y 0,4 kg de queso salía como "0". */
const cantidad = (q) => q.toLocaleString("es-AR", { maximumFractionDigits: 3 });
const anchoDe = (ajustes) => (ajustes.ancho === 58 ? 32 : 48);

function Comprobante({ v }) {
  if (!v.fiscal) return <Sello>Ticket</Sello>;
  if (v.estadoFactura === "autorizada") return <Sello tono="bien" className="f-m normal-case tracking-normal">Factura {numeroFactura(v.factura)}</Sello>;
  if (v.estadoFactura === "simulada") return <Sello>Factura simulada</Sello>;
  return <Sello tono="ojo">Factura sin CAE</Sello>;
}

const Rotulo = ({ children }) => (
  <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mt-5 mb-1">{children}</div>
);

export function DetalleMovimiento({ m, empresaId, ajustes, toast, onCerrar }) {
  /* null: todavía se está leyendo. false: no es una venta, o la venta
     no está en la base (se cobró sin internet y sigue en la cola). */
  const [venta, setVenta] = useState(m.operacionId ? null : false);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!m.operacionId) return;
    let vivo = true;
    Promise.all([cargarVenta(empresaId, m.operacionId), cargarTicketDeVenta(empresaId, m.operacionId).catch(() => null)])
      .then(([v, t]) => { if (!vivo) return; setVenta(v && t ? v : false); setTicket(t); })
      .catch((e) => { if (vivo) { setVenta(false); setError(e.message || "No se pudo leer la venta."); } });
    return () => { vivo = false; };
  }, [empresaId, m.operacionId]);

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-6">
        {venta === null ? (
          <p className="text-sm text-texto-tenue">Cargando…</p>
        ) : venta ? (
          <DetalleVenta v={venta} t={ticket} ajustes={ajustes} toast={toast} onCerrar={onCerrar} />
        ) : (
          <DetalleOtro m={m} ajustes={ajustes} toast={toast} onCerrar={onCerrar}
            aviso={error || (m.operacionId ? "La venta todavía no está en la base: si se cobró sin internet, aparece acá cuando se sincroniza." : null)} />
        )}
      </div>
    </Modal>
  );
}

function Encabezado({ icono: Ico, rotulo, titulo, bajada, onCerrar }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-texto-tenue text-[11px] uppercase tracking-[0.1em] font-bold">
          <Ico size={13} /> {rotulo}
        </div>
        <h3 className="f-d text-lg mt-1">{titulo}</h3>
        <p className="text-sm text-texto-suave mt-0.5">{bajada}</p>
      </div>
      <button onClick={onCerrar} className="text-texto-tenue hover:text-texto p-1 -mr-2 -mt-2" aria-label="Cerrar"><X size={18} /></button>
    </div>
  );
}

/* ------------------------------------------------------------
   Un movimiento que viene de una venta
   ------------------------------------------------------------ */

function DetalleVenta({ v, t, ajustes, toast, onCerrar }) {
  const [verPapel, setVerPapel] = useState(false);
  /* Lo que va al papel. La simulada del prototipo sale como ticket: no
     tiene número de factura que imprimir y no va a tenerlo. */
  const papel = v.estadoFactura === "simulada" ? { ...t, fiscal: false } : { ...t, factura: v.factura };
  const esperando = v.estadoFactura === "sin_cae" || v.estadoFactura === "pidiendo";

  return (
    <>
      <Encabezado icono={v.fiscal ? FileText : Receipt} onCerrar={onCerrar}
        rotulo={<>Venta <span className="f-m normal-case tracking-normal">{v.numero}</span></>}
        titulo={v.cliente || "Consumidor final"}
        bajada={`${fdatel(v.fecha)} a las ${hora(v.fecha)}${v.cajero ? ` · cobró ${v.cajero}` : ""}`} />

      <div className="mt-3"><Comprobante v={v} /></div>
      {v.factura && (
        <p className="text-xs text-texto-tenue mt-2">
          CAE <span className="f-m">{v.factura.cae}</span>{v.factura.vencimiento ? ` · vence ${v.factura.vencimiento.split("-").reverse().join("/")}` : ""}
          {v.factura.homologacion ? " · ARCA de pruebas, sin validez fiscal" : ""}
        </p>
      )}
      {esperando && <p className="text-xs text-ojo mt-2">Espera su CAE. Se imprime cuando ARCA la autorice (Facturas, más abajo en Caja).</p>}

      {verPapel ? (
        <div className="bg-superficie-2 rounded-lg p-3 mt-5 overflow-auto">
          <Comandera lineas={ticketVenta(papel, ajustes, anchoDe(ajustes))} ancho={ajustes.ancho}
            qr={papel.fiscal && papel.factura ? qrDeFactura(papel.factura) : null} className="py-2" />
        </div>
      ) : (
        <>
          <Rotulo>Lo que se vendió</Rotulo>
          <ul className="divide-y divide-borde border-y border-borde">
            {t.items.map((l, i) => (
              <li key={i} className="py-2.5 flex items-baseline gap-3 text-sm">
                <span className="f-m text-texto-suave w-12 shrink-0 text-right">{cantidad(l.qty)}</span>
                <span className="flex-1 min-w-0">
                  {l.nombre}
                  {l.qty !== 1 && <span className="block text-xs text-texto-tenue f-m">{money(l.precio)} c/u</span>}
                </span>
                <span className="f-m">{money(l.precio * l.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 text-sm">
            {(t.desc > 0 || t.recargo > 0) && <div className="flex justify-between text-texto-suave"><dt>Subtotal</dt><dd className="f-m">{money(t.sub)}</dd></div>}
            {t.desc > 0 && <div className="flex justify-between text-texto-suave"><dt>Descuento</dt><dd className="f-m">−{money(t.desc)}</dd></div>}
            {t.recargo > 0 && <div className="flex justify-between text-texto-suave"><dt>Recargo</dt><dd className="f-m">{money(t.recargo)}</dd></div>}
            <div className="flex justify-between font-semibold text-base pt-1"><dt>Total</dt><dd className="f-m">{money(t.total)}</dd></div>
          </dl>
          <Rotulo>Cómo se pagó</Rotulo>
          <dl className="space-y-1 text-sm">
            {t.pagos.map((p, i) => (
              <div key={i} className="flex justify-between"><dt>{medioPorK(ajustes, p.medio).n}</dt><dd className="f-m">{money(p.monto)}</dd></div>
            ))}
          </dl>
        </>
      )}

      <div className="flex flex-wrap justify-end gap-2 mt-6">
        <Boton variant="quiet" onClick={() => setVerPapel((x) => !x)}>{verPapel ? "Ver el detalle" : "Ver cómo sale impreso"}</Boton>
        <Boton onClick={() => imprimirTicket(papel, ajustes, toast)} disabled={esperando}>
          <Printer size={15} /> Volver a imprimir
        </Boton>
      </div>
    </>
  );
}

/* ------------------------------------------------------------
   Cualquier otro movimiento: gasto, retiro, cobro de cuenta
   ------------------------------------------------------------ */

const NOMBRE = { gasto: "Gasto", retiro: "Retiro" };

/* El papel de un movimiento que no es venta. Un egreso lleva renglón para
   la firma: un retiro del dueño o un pago a un proveedor en efectivo es
   plata que sale del cajón, y el papel firmado es lo que cierra el arqueo. */
function papelMovimiento(m, ajustes, W) {
  const f = ajustes.fiscal || FISCAL_INICIAL;
  const cuando = m.fecha ? new Date(m.fecha) : new Date();
  const egreso = m.tipo === "egreso";
  return armarLineas(W, [
    { t: "c", v: (f.nombreFactura || f.razonSocial || ajustes.negocio || "").toUpperCase() },
    { t: "sep", c: "=" },
    { t: "c", v: `COMPROBANTE DE ${egreso ? "EGRESO" : "INGRESO"}` },
    { t: "c", v: "NO VALIDO COMO FACTURA" },
    { t: "c", v: `${fdatel(cuando)} ${m.hora || hora(cuando)}` },
    { t: "sep" },
    { t: "w", v: (m.detalle || NOMBRE[m.clase] || "Movimiento de caja").toUpperCase() },
    { t: "lr", a: "MEDIO", b: medioPorK(ajustes, m.medio).n.toUpperCase() },
    { t: "sep", c: "=" },
    { t: "lr", a: "IMPORTE", b: `${egreso ? "-" : ""}${money(m.monto)}` },
    { t: "sep", c: "=" },
    ...(egreso ? [{ t: "b" }, { t: "b" }, { t: "c", v: "-".repeat(Math.min(24, W)) }, { t: "c", v: "FIRMA" }] : []),
  ]);
}

function DetalleOtro({ m, ajustes, toast, onCerrar, aviso }) {
  const egreso = m.tipo === "egreso";
  const lineas = papelMovimiento(m, ajustes, anchoDe(ajustes));
  return (
    <>
      <Encabezado icono={egreso ? ArrowUpRight : ArrowDownRight} onCerrar={onCerrar}
        rotulo={NOMBRE[m.clase] || (egreso ? "Egreso" : "Ingreso")}
        titulo={m.detalle || "Movimiento de caja"}
        bajada={`${m.fecha ? fdatel(new Date(m.fecha)) + " a las " : "Hoy a las "}${m.hora} · ${medioPorK(ajustes, m.medio).n}`} />

      {aviso && <p className="text-xs text-ojo mt-3">{aviso}</p>}

      <div className={`f-m text-3xl font-semibold mt-5 ${egreso ? "text-mal" : "text-bien"}`}>
        {egreso ? "−" : "+"}{money(m.monto)}
      </div>

      {/* Una venta que todavía no llegó a la base no se imprime como
          movimiento: el papel de una venta es su ticket, y ese sale
          cuando la venta se sincroniza. */}
      {!m.operacionId && (
        <>
          <Rotulo>Cómo sale impreso</Rotulo>
          <div className="bg-superficie-2 rounded-lg p-3 overflow-auto">
            <Comandera lineas={lineas} ancho={ajustes.ancho} className="py-2" />
          </div>
          <div className="flex justify-end mt-6">
            <Boton onClick={() => imprimirComandera(lineas, ajustes.ancho, null, toast)}>
              <Printer size={15} /> Imprimir
            </Boton>
          </div>
        </>
      )}
    </>
  );
}
