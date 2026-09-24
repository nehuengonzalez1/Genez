/* ============================================================
   CAJA · TICKETS Y FACTURAS
   ============================================================

   Las ventas de un día, una por una: al tocar una se ve qué se vendió,
   cómo se pagó, quién la cobró y, si fue factura, su número y su CAE. Y
   se vuelve a imprimir, igual que salió.

   Lo que pregunta el mostrador es "¿qué se llevó el de recién?", "¿me
   imprimís de nuevo la factura?", "¿a qué hora se vendió el fernet?".
   Por eso se va de a un día, con el más nuevo arriba, y el buscador
   encuentra por número, cliente, importe o producto.

   El papel se relee de la base con `cargarTicketDeVenta` al abrir la
   venta, que es lo mismo que usa Caja → Facturas: la venta puede ser de
   otra caja o de antes de refrescar, y la pantalla del cobro ya no la
   tiene. Se reimprime tal cual, sin marca de copia: una factura
   reimpresa es la misma factura, con el mismo número y el mismo CAE.
   ============================================================ */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Search, Printer, Receipt, FileText, X } from "lucide-react";
import { money, nf, hora, medioPorK } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import { cargarVentasDelDia } from "../datos/ventas.js";
import { cargarTicketDeVenta } from "../datos/arca.js";
import { Card, Boton, Modal, Vacio, Sello, Comandera, ticketVenta, qrDeFactura, imprimirTicket } from "../ui/Base.jsx";

const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const numeroFactura = (f) => `${f.letra} ${String(f.puntoVenta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`;
const mismoDia = (a, b) => a.toDateString() === b.toDateString();
/* `nf` redondea a entero, y 0,4 kg de queso salía como "0". */
const cantidad = (q) => q.toLocaleString("es-AR", { maximumFractionDigits: 3 });

/* Cómo se nombra un día en la barra: "Hoy", "Ayer" o la fecha. */
function nombreDia(d) {
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (mismoDia(d, hoy)) return "Hoy";
  if (mismoDia(d, ayer)) return "Ayer";
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

/* El comprobante de cada venta, en una palabra. Lo que espera CAE lleva
   el tono de "ojo": es lo único de la lista que pide hacer algo. */
function Comprobante({ v }) {
  if (!v.fiscal) return <Sello>Ticket</Sello>;
  if (v.estadoFactura === "autorizada") return <Sello tono="bien" className="f-m normal-case tracking-normal">Factura {numeroFactura(v.factura)}</Sello>;
  if (v.estadoFactura === "simulada") return <Sello>Factura simulada</Sello>;
  return <Sello tono="ojo">Factura sin CAE</Sello>;
}

const FILTROS = [
  { k: "todas", n: "Todas" },
  { k: "tickets", n: "Tickets" },
  { k: "facturas", n: "Facturas" },
];

export function Comprobantes({ empresaId, ajustes, toast, sinCAE }) {
  const [dia, setDia] = useState(() => new Date());
  const [ventas, setVentas] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [abierta, setAbierta] = useState(null);

  const leer = useCallback(async () => {
    setVentas(null);
    try {
      setVentas(await cargarVentasDelDia(empresaId, dia));
      setError(null);
    } catch (e) {
      setVentas([]);
      setError(e.message || "No se pudieron leer las ventas.");
    }
  }, [empresaId, dia]);
  /* `sinCAE` cambia cuando Sistema consigue CAE por su cuenta: así una
     factura que estaba esperando aparece con su número sin refrescar. */
  useEffect(() => { leer(); }, [leer, sinCAE]);

  const esHoy = mismoDia(dia, new Date());
  const moverDia = (n) => setDia((d) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; });

  const lista = useMemo(() => {
    if (!ventas) return [];
    const t = norm(q.trim());
    const cifras = q.replace(/\D/g, "");
    return ventas.filter((v) => {
      if (filtro === "tickets" && v.fiscal) return false;
      if (filtro === "facturas" && !v.fiscal) return false;
      if (!t) return true;
      return norm(v.cliente).includes(t)
        || v.productos.some((p) => norm(p).includes(t))
        || (cifras && (String(v.numero).replace(/\D/g, "").includes(cifras)
          || String(Math.round(v.total)).includes(cifras)
          || (v.factura && String(v.factura.numero) === String(Number(cifras)))));
    });
  }, [ventas, q, filtro]);

  const total = lista.reduce((s, v) => s + v.total, 0);

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-borde">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="f-d text-lg">Tickets y facturas</h3>
            <p className="text-xs text-texto-tenue mt-0.5">Cada venta, con lo que se vendió. Tocá una para verla o volver a imprimirla.</p>
          </div>
          <div className="flex items-center gap-1">
            <Boton size="sm" variant="quiet" onClick={() => moverDia(-1)} title="Día anterior"><ChevronLeft size={16} /></Boton>
            <span className="text-sm font-semibold min-w-[7.5rem] text-center first-letter:uppercase">{nombreDia(dia)}</span>
            <Boton size="sm" variant="quiet" onClick={() => moverDia(1)} disabled={esHoy} title="Día siguiente"><ChevronRight size={16} /></Boton>
            {!esHoy && <Boton size="sm" variant="ghost" onClick={() => setDia(new Date())} className="ml-1">Hoy</Boton>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div className="relative flex-1 min-w-[14rem]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por número, cliente, importe o producto"
              className="w-full border border-borde rounded-md pl-8 pr-8 py-2 text-sm bg-superficie outline-none focus:border-acento" />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-texto-tenue hover:text-texto" aria-label="Borrar la búsqueda"><X size={14} /></button>
            )}
          </div>
          <div className="flex rounded-md border border-borde overflow-hidden text-xs font-semibold">
            {FILTROS.map((f) => (
              <button key={f.k} onClick={() => setFiltro(f.k)}
                className={`px-3 py-2 ${filtro === f.k ? "bg-superficie-3 text-texto" : "text-texto-suave hover:text-texto"}`}>{f.n}</button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="px-5 py-3 text-sm text-mal border-b border-borde">{error}</p>}

      {ventas === null ? (
        <p className="px-5 py-6 text-sm text-texto-tenue">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="p-5">
          <Vacio>{ventas.length ? "Ninguna venta coincide." : esHoy ? "Todavía no hay ventas hoy." : "Ese día no hubo ventas."}</Vacio>
        </div>
      ) : (
        <>
          <div className="px-5 py-2 flex items-center justify-between text-xs text-texto-tenue border-b border-borde bg-superficie-2">
            <span>{nf.format(lista.length)} {lista.length === 1 ? "venta" : "ventas"}</span>
            <span className="f-m">{money(total)}</span>
          </div>
          <ul className="divide-y divide-borde max-h-[32rem] overflow-auto">
            {lista.map((v) => (
              <li key={v.id}>
                <button onClick={() => setAbierta(v)} className="w-full text-left px-5 py-3 flex items-center gap-4 hover:bg-superficie-2 transition-colors">
                  <span className="f-m text-sm text-texto-suave w-12 shrink-0">{hora(v.fecha)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-semibold">{v.cliente || "Consumidor final"}</span>
                      <Comprobante v={v} />
                    </div>
                    <div className="text-xs text-texto-tenue truncate mt-0.5">
                      <span className="f-m">{v.numero}</span>
                      {v.productos.length ? ` · ${v.productos.join(", ")}` : ""}
                    </div>
                  </div>
                  <span className="hidden sm:block text-xs text-texto-suave text-right w-40 truncate">
                    {v.medios.map((m) => medioPorK(ajustes, m).n).join(" + ")}
                  </span>
                  <span className="f-m text-sm font-semibold w-24 text-right shrink-0">{money(v.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {abierta && <DetalleVenta v={abierta} empresaId={empresaId} ajustes={ajustes} toast={toast} onCerrar={() => setAbierta(null)} />}
    </Card>
  );
}

/* ------------------------------------------------------------
   Una venta abierta: qué se vendió y volver a imprimirla
   ------------------------------------------------------------ */

function DetalleVenta({ v, empresaId, ajustes, toast, onCerrar }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState(null);
  const [verPapel, setVerPapel] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargarTicketDeVenta(empresaId, v.id)
      .then((x) => vivo && setT(x))
      .catch((e) => vivo && setError(e.message || "No se pudo leer la venta."));
    return () => { vivo = false; };
  }, [empresaId, v.id]);

  /* Lo que va al papel. La simulada del prototipo sale como ticket: no
     tiene número de factura que imprimir y no va a tenerlo. */
  const papel = t && (v.estadoFactura === "simulada" ? { ...t, fiscal: false } : { ...t, factura: v.factura });
  const esperando = v.estadoFactura === "sin_cae" || v.estadoFactura === "pidiendo";
  const W = ajustes.ancho === 58 ? 32 : 48;

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-texto-tenue text-[11px] uppercase tracking-[0.1em] font-bold">
              {v.fiscal ? <FileText size={13} /> : <Receipt size={13} />} Venta <span className="f-m normal-case tracking-normal">{v.numero}</span>
            </div>
            <h3 className="f-d text-lg mt-1">{v.cliente || "Consumidor final"}</h3>
            <p className="text-sm text-texto-suave mt-0.5">
              {fdatel(v.fecha)} a las {hora(v.fecha)}{v.cajero ? ` · cobró ${v.cajero}` : ""}
            </p>
          </div>
          <button onClick={onCerrar} className="text-texto-tenue hover:text-texto p-1 -mr-2 -mt-2" aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="mt-3"><Comprobante v={v} /></div>
        {v.factura && (
          <p className="text-xs text-texto-tenue mt-2">
            CAE <span className="f-m">{v.factura.cae}</span>{v.factura.vencimiento ? ` · vence ${v.factura.vencimiento.split("-").reverse().join("/")}` : ""}
            {v.factura.homologacion ? " · ARCA de pruebas, sin validez fiscal" : ""}
          </p>
        )}
        {esperando && (
          <p className="text-xs text-ojo mt-2">Espera su CAE. Se imprime cuando ARCA la autorice (Facturas, más abajo en Caja).</p>
        )}

        {error ? (
          <p className="text-sm text-mal mt-5">{error}</p>
        ) : !t ? (
          <p className="text-sm text-texto-tenue mt-5">Cargando…</p>
        ) : verPapel ? (
          <div className="bg-superficie-2 rounded-lg p-3 mt-5 overflow-auto">
            <Comandera lineas={ticketVenta(papel, ajustes, W)} ancho={ajustes.ancho}
              qr={papel.fiscal && papel.factura ? qrDeFactura(papel.factura) : null} className="py-2" />
          </div>
        ) : (
          <>
            <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mt-5 mb-1">Lo que se vendió</div>
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
              {(t.desc > 0 || t.recargo > 0) && (
                <div className="flex justify-between text-texto-suave"><dt>Subtotal</dt><dd className="f-m">{money(t.sub)}</dd></div>
              )}
              {t.desc > 0 && <div className="flex justify-between text-texto-suave"><dt>Descuento</dt><dd className="f-m">−{money(t.desc)}</dd></div>}
              {t.recargo > 0 && <div className="flex justify-between text-texto-suave"><dt>Recargo</dt><dd className="f-m">{money(t.recargo)}</dd></div>}
              <div className="flex justify-between font-semibold text-base pt-1"><dt>Total</dt><dd className="f-m">{money(t.total)}</dd></div>
            </dl>
            <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mt-5 mb-1">Cómo se pagó</div>
            <dl className="space-y-1 text-sm">
              {t.pagos.map((p, i) => (
                <div key={i} className="flex justify-between"><dt>{medioPorK(ajustes, p.medio).n}</dt><dd className="f-m">{money(p.monto)}</dd></div>
              ))}
            </dl>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-2 mt-6">
          <Boton variant="quiet" onClick={() => setVerPapel((x) => !x)} disabled={!t}>
            {verPapel ? "Ver el detalle" : "Ver cómo sale impreso"}
          </Boton>
          <Boton onClick={() => imprimirTicket(papel, ajustes, toast)} disabled={!t || esperando}>
            <Printer size={15} /> Volver a imprimir
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
