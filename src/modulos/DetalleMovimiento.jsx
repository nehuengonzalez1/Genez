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
import { Printer, Receipt, FileText, ArrowDownRight, ArrowUpRight, X, Undo2, FilePlus2, RefreshCw, Minus, Plus } from "lucide-react";
import { money, hora, medioPorK, mediosDe, FISCAL_INICIAL, MEDIO_CUENTA_CORRIENTE } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import { cargarVenta, cargarDevuelto, registrarDevolucion, registrarNotaDebito } from "../datos/ventas.js";
import { cargarTicketDeVenta } from "../datos/arca.js";
import { Modal, Boton, Sello, Comandera, ticketVenta, qrDeFactura, imprimirTicket, armarLineas, imprimirComandera } from "../ui/Base.jsx";

const numeroFactura = (f) => `${f.letra} ${String(f.puntoVenta).padStart(5, "0")}-${String(f.numero).padStart(8, "0")}`;
/* `nf` redondea a entero, y 0,4 kg de queso salía como "0". */
const cantidad = (q) => q.toLocaleString("es-AR", { maximumFractionDigits: 3 });
const anchoDe = (ajustes) => (ajustes.ancho === 58 ? 32 : 48);

function Comprobante({ v }) {
  if (!v.fiscal) return <Sello>{v.tipo === "devolucion" ? "Devolución" : "Ticket"}</Sello>;
  const nombre = v.nota === "credito" ? "Nota de crédito" : v.nota === "debito" ? "Nota de débito" : "Factura";
  if (v.estadoFactura === "autorizada") return <Sello tono="bien" className="f-m normal-case tracking-normal">{nombre} {numeroFactura(v.factura)}</Sello>;
  if (v.estadoFactura === "simulada") return <Sello>Factura simulada</Sello>;
  return <Sello tono="ojo">{nombre} sin CAE</Sello>;
}

const Rotulo = ({ children }) => (
  <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mt-5 mb-1">{children}</div>
);

export function DetalleMovimiento({ m, empresaId, ajustes, toast, onCerrar, caja = null, permisos = {}, pedirCAEs = null, onCambio = null }) {
  /* La operación que se mira. Arranca en la del movimiento, y pasa a la
     devolución o la nota recién hechas para que se vean e impriman ahí. */
  const [opId, setOpId] = useState(m.operacionId || null);
  const [vuelta, setVuelta] = useState(0);
  /* null: todavía se está leyendo. false: no es una venta, o la venta
     no está en la base (se cobró sin internet y sigue en la cola). */
  const [venta, setVenta] = useState(opId ? null : false);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!opId) return;
    let vivo = true;
    setVenta(null);
    Promise.all([cargarVenta(empresaId, opId), cargarTicketDeVenta(empresaId, opId).catch(() => null)])
      .then(([v, t]) => { if (!vivo) return; setVenta(v && t ? v : false); setTicket(t); })
      .catch((e) => { if (vivo) { setVenta(false); setError(e.message || "No se pudo leer la venta."); } });
    return () => { vivo = false; };
  }, [empresaId, opId, vuelta]);

  /* Una devolución o una nota nueva: la caja se relee, se pide el CAE si
     es fiscal, y el detalle pasa a mostrarla. */
  const alHacer = async (nuevaId, fiscal) => {
    if (onCambio) onCambio();
    if (fiscal && pedirCAEs) {
      const r = await pedirCAEs({ avisar: false });
      if (r && r.error) toast(`La nota quedó esperando su CAE: ${r.error}`, "mal");
    }
    setOpId(nuevaId);
    setVuelta((x) => x + 1);
  };
  const releer = () => setVuelta((x) => x + 1);

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-6">
        {venta === null ? (
          <p className="text-sm text-texto-tenue">Cargando…</p>
        ) : venta ? (
          <DetalleVenta v={venta} t={ticket} ajustes={ajustes} toast={toast} onCerrar={onCerrar}
            empresaId={empresaId} caja={caja} permisos={permisos} pedirCAEs={pedirCAEs} alHacer={alHacer} releer={releer} />
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

function DetalleVenta({ v, t, ajustes, toast, onCerrar, empresaId, caja, permisos, pedirCAEs, alHacer, releer }) {
  const [verPapel, setVerPapel] = useState(false);
  const [haciendo, setHaciendo] = useState(null);   // devolver | debitar
  const [pidiendo, setPidiendo] = useState(false);
  /* Lo que va al papel. La simulada del prototipo sale como ticket: no
     tiene número de factura que imprimir y no va a tenerlo. */
  const papel = v.estadoFactura === "simulada" ? { ...t, fiscal: false } : { ...t, factura: v.factura };
  const esperando = v.estadoFactura === "sin_cae" || v.estadoFactura === "pidiendo";
  const esDevolucion = v.tipo === "devolucion";
  const esNota = !!v.nota;
  const nombre = esDevolucion ? "Devolución" : v.nota === "debito" ? "Nota de débito" : "Venta";

  /* Devolver: una venta cobrada, no una devolución ni una nota, y con la
     factura autorizada si fue factura. La nota de débito, solo sobre una
     factura con CAE. Las dos piden el permiso de anular y la caja abierta
     (la base lo vuelve a controlar). */
  const puede = !!permisos.anular && !!caja && !!caja.abierta;
  const puedeDevolver = !esDevolucion && !esNota && (!v.fiscal || v.estadoFactura === "autorizada");
  const puedeDebitar = !esDevolucion && !esNota && v.estadoFactura === "autorizada";
  const porQueNo = !permisos.anular ? "Tu usuario no puede hacer devoluciones ni notas."
    : !caja || !caja.abierta ? "Abrí la caja: el reintegro sale de ahí." : "";

  const pedirCAE = async () => {
    setPidiendo(true);
    const r = await pedirCAEs({ avisar: false });
    setPidiendo(false);
    if (r && r.error) toast(r.error, "mal");
    releer();
  };

  return (
    <>
      <Encabezado icono={esDevolucion ? Undo2 : v.fiscal ? FileText : Receipt} onCerrar={onCerrar}
        rotulo={<>{nombre} <span className="f-m normal-case tracking-normal">{v.numero}</span></>}
        titulo={v.cliente || "Consumidor final"}
        bajada={`${fdatel(v.fecha)} a las ${hora(v.fecha)}${v.cajero ? ` · ${esDevolucion ? "hizo" : "cobró"} ${v.cajero}` : ""}`} />

      <div className="mt-3"><Comprobante v={v} /></div>
      {t.origen && (
        <p className="text-xs text-texto-suave mt-2">
          {esDevolucion ? "Devuelve " : "Sobre "}
          {t.origen.factura ? <>la factura <span className="f-m">{numeroFactura(t.origen.factura)}</span></> : <>la venta <span className="f-m">{t.origen.numero}</span></>}
          {v.motivo ? ` · ${v.motivo}` : ""}
        </p>
      )}
      {v.factura && (
        <p className="text-xs text-texto-tenue mt-2">
          CAE <span className="f-m">{v.factura.cae}</span>{v.factura.vencimiento ? ` · vence ${v.factura.vencimiento.split("-").reverse().join("/")}` : ""}
          {v.factura.homologacion ? " · ARCA de pruebas, sin validez fiscal" : ""}
        </p>
      )}
      {esperando && (
        <div className="flex items-center gap-3 mt-2">
          <p className="text-xs text-ojo flex-1">Espera su CAE. Se imprime cuando ARCA la autorice.</p>
          {pedirCAEs && (
            <Boton size="sm" variant="ghost" onClick={pedirCAE} disabled={pidiendo}>
              <RefreshCw size={13} className={pidiendo ? "animate-spin" : ""} /> {pidiendo ? "Pidiendo…" : "Pedir CAE"}
            </Boton>
          )}
        </div>
      )}

      {verPapel ? (
        <div className="bg-superficie-2 rounded-lg p-3 mt-5 overflow-auto">
          <Comandera lineas={ticketVenta(papel, ajustes, anchoDe(ajustes))} ancho={ajustes.ancho}
            qr={papel.fiscal && papel.factura ? qrDeFactura(papel.factura) : null} className="py-2" />
        </div>
      ) : (
        <>
          <Rotulo>{esDevolucion ? "Lo que se devolvió" : "Lo que se vendió"}</Rotulo>
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
          <Rotulo>{esDevolucion ? "Cómo se reintegró" : "Cómo se pagó"}</Rotulo>
          <dl className="space-y-1 text-sm">
            {esDevolucion ? (
              <div className="flex justify-between"><dt>{medioPorK(ajustes, t.medio).n}</dt><dd className="f-m">{money(t.total)}</dd></div>
            ) : t.pagos.map((p, i) => (
              <div key={i} className="flex justify-between"><dt>{medioPorK(ajustes, p.medio).n}</dt><dd className="f-m">{money(p.monto)}</dd></div>
            ))}
          </dl>
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 mt-6">
        {(puedeDevolver || puedeDebitar) && (
          <div className="flex gap-2 mr-auto" title={porQueNo}>
            {puedeDevolver && (
              <Boton variant="ghost" onClick={() => setHaciendo("devolver")} disabled={!puede}>
                <Undo2 size={15} /> Devolver
              </Boton>
            )}
            {puedeDebitar && (
              <Boton variant="ghost" onClick={() => setHaciendo("debitar")} disabled={!puede}>
                <FilePlus2 size={15} /> Nota de débito
              </Boton>
            )}
          </div>
        )}
        <Boton variant="quiet" onClick={() => setVerPapel((x) => !x)}>{verPapel ? "Ver el detalle" : "Ver cómo sale impreso"}</Boton>
        <Boton onClick={() => imprimirTicket(papel, ajustes, toast)} disabled={esperando}>
          <Printer size={15} /> {esNota || esDevolucion ? "Imprimir" : "Volver a imprimir"}
        </Boton>
      </div>
      {(puedeDevolver || puedeDebitar) && !puede && <p className="text-xs text-texto-tenue mt-2 text-right">{porQueNo}</p>}

      {haciendo === "devolver" && (
        <Devolver v={v} t={t} ajustes={ajustes} toast={toast} empresaId={empresaId} caja={caja}
          onCerrar={() => setHaciendo(null)} onHecha={(id) => { setHaciendo(null); alHacer(id, v.fiscal); }} />
      )}
      {haciendo === "debitar" && (
        <Debitar v={v} ajustes={ajustes} toast={toast} caja={caja}
          onCerrar={() => setHaciendo(null)} onHecha={(id) => { setHaciendo(null); alHacer(id, true); }} />
      )}
    </>
  );
}

/* Los medios con que se reintegra o se cobra una nota. Cuenta corriente
   solo si la venta tiene cliente: sin cliente no hay cuenta. */
const mediosPara = (ajustes, conCliente) => mediosDe(ajustes)
  .filter((m) => m.activo !== false && (m.k !== MEDIO_CUENTA_CORRIENTE || conCliente));

/* ------------------------------------------------------------
   Devolver una venta, toda o una parte
   ------------------------------------------------------------ */
function Devolver({ v, t, ajustes, toast, empresaId, caja, onCerrar, onHecha }) {
  const [devuelto, setDevuelto] = useState(null);   // lineaId → ya devuelto
  const [cant, setCant] = useState({});
  const [medio, setMedio] = useState((t.pagos[0] && t.pagos[0].medio) || "efectivo");
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const medios = mediosPara(ajustes, !!v.cliente);

  useEffect(() => {
    cargarDevuelto(empresaId, v.id).then(setDevuelto).catch(() => setDevuelto({}));
  }, [empresaId, v.id]);

  const queda = (l) => Math.max(0, +(l.qty - ((devuelto && devuelto[l.lineaId]) || 0)).toFixed(3));
  const lineas = t.items.filter((l) => l.lineaId);
  /* Lo que se reintegra: lo cobrado por esos renglones, con el descuento o
     el recargo de la venta repartidos. La base hace la misma cuenta y
     manda ella; esto es para que se vea antes de confirmar. */
  const factor = t.sub > 0 ? t.total / t.sub : 1;
  const bruto = lineas.reduce((s, l) => s + Math.round(l.precio * (cant[l.lineaId] || 0)), 0);
  const reintegro = Math.round(bruto * factor);
  const elegidas = lineas.filter((l) => (cant[l.lineaId] || 0) > 0);
  const nada = devuelto && lineas.every((l) => queda(l) === 0);

  const fijar = (l, n) => setCant((c) => ({ ...c, [l.lineaId]: Math.min(queda(l), Math.max(0, +(+n).toFixed(3))) }));
  const todo = () => setCant(Object.fromEntries(lineas.map((l) => [l.lineaId, queda(l)])));

  const confirmar = async () => {
    setGuardando(true);
    try {
      const id = await registrarDevolucion({
        ventaId: v.id, sesionId: caja && caja.sesionId, medio, motivo,
        lineas: elegidas.map((l) => ({ lineaId: l.lineaId, cantidad: cant[l.lineaId] })),
      });
      toast(v.fiscal ? "Devolución registrada. Se pide la nota de crédito a ARCA." : "Devolución registrada.");
      onHecha(id);
    } catch (e) {
      toast(e.message, "mal");
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-6">
        <Encabezado icono={Undo2} onCerrar={onCerrar} rotulo="Devolución"
          titulo={`Venta ${v.numero}`}
          bajada={v.fiscal ? "Es una factura: se emite una nota de crédito por lo que se devuelve." : "El stock vuelve y el reintegro sale de la caja."} />

        {devuelto === null ? (
          <p className="text-sm text-texto-tenue mt-5">Cargando…</p>
        ) : nada ? (
          <p className="text-sm text-texto-suave mt-5">Ya se devolvió todo lo de esta venta.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mt-5 mb-1">
              <span className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold">Qué vuelve</span>
              <button onClick={todo} className="text-xs font-semibold text-acento hover:underline">Devolver todo</button>
            </div>
            <ul className="divide-y divide-borde border-y border-borde">
              {lineas.map((l) => {
                const max = queda(l);
                const n = cant[l.lineaId] || 0;
                return (
                  <li key={l.lineaId} className={`py-2.5 flex items-center gap-3 text-sm ${max === 0 ? "opacity-50" : ""}`}>
                    <span className="flex-1 min-w-0">
                      {l.nombre}
                      <span className="block text-xs text-texto-tenue">
                        {max === 0 ? "Ya se devolvió todo" : `Vendidos ${cantidad(l.qty)}${max !== l.qty ? ` · quedan ${cantidad(max)}` : ""} · ${money(l.precio)} c/u`}
                      </span>
                    </span>
                    <div className="inline-flex items-center border border-borde rounded-md">
                      <button className="w-7 h-7 inline-flex items-center justify-center text-texto-suave hover:text-acento disabled:opacity-30"
                        onClick={() => fijar(l, n - 1)} disabled={n <= 0} aria-label="Uno menos"><Minus size={13} /></button>
                      <span className="f-m w-10 text-center">{cantidad(n)}</span>
                      <button className="w-7 h-7 inline-flex items-center justify-center text-texto-suave hover:text-acento disabled:opacity-30"
                        onClick={() => fijar(l, n + 1 > max ? max : n + 1)} disabled={n >= max} aria-label="Uno más"><Plus size={13} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <label className="text-sm">
                <span className="block text-xs text-texto-suave mb-1">Se reintegra en</span>
                <select value={medio} onChange={(e) => setMedio(e.target.value)}
                  className="w-full border border-borde rounded-md px-2.5 py-2 text-sm bg-superficie outline-none focus:border-acento">
                  {medios.map((m) => <option key={m.k} value={m.k}>{m.n}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-xs text-texto-suave mb-1">Motivo (opcional)</span>
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Vencido, roto, error…"
                  className="w-full border border-borde rounded-md px-2.5 py-2 text-sm bg-superficie outline-none focus:border-acento" />
              </label>
            </div>

            <div className="flex items-baseline justify-between mt-5 pt-3 border-t border-borde">
              <span className="text-sm text-texto-suave">{medio === MEDIO_CUENTA_CORRIENTE ? "Baja la deuda en" : "Se reintegra"}</span>
              <span className="f-m text-2xl font-semibold">{money(reintegro)}</span>
            </div>
            {factor !== 1 && reintegro > 0 && (
              <p className="text-xs text-texto-tenue mt-1 text-right">Con el {t.desc > 0 ? "descuento" : "recargo"} de la venta repartido.</p>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={confirmar} disabled={guardando || !elegidas.length || nada}>
            <Undo2 size={15} /> {guardando ? "Registrando…" : v.fiscal ? "Devolver y hacer nota de crédito" : "Devolver"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   Nota de débito: un cargo de más sobre una factura
   ------------------------------------------------------------ */
function Debitar({ v, ajustes, toast, caja, onCerrar, onHecha }) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [guardando, setGuardando] = useState(false);
  const medios = mediosPara(ajustes, !!v.cliente);
  const n = Number(monto) || 0;

  const confirmar = async () => {
    setGuardando(true);
    try {
      const id = await registrarNotaDebito({ ventaId: v.id, concepto: concepto.trim(), monto: n, sesionId: caja && caja.sesionId, medio });
      toast("Nota de débito registrada. Se pide el CAE a ARCA.");
      onHecha(id);
    } catch (e) {
      toast(e.message, "mal");
      setGuardando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-6">
        <Encabezado icono={FilePlus2} onCerrar={onCerrar} rotulo="Nota de débito"
          titulo={`Sobre la factura ${numeroFactura(v.factura)}`}
          bajada="Un cargo de más sobre esta factura: una diferencia de precio, un interés. Se cobra ahora y ARCA la autoriza como nota de débito." />
        <label className="block text-sm mt-5">
          <span className="block text-xs text-texto-suave mb-1">Concepto</span>
          <input autoFocus value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Diferencia de precio"
            className="w-full border border-borde rounded-md px-2.5 py-2 text-sm bg-superficie outline-none focus:border-acento" />
        </label>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="text-sm">
            <span className="block text-xs text-texto-suave mb-1">Importe</span>
            <input value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="0"
              className="f-m w-full border border-borde rounded-md px-2.5 py-2 text-sm bg-superficie outline-none focus:border-acento" />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-texto-suave mb-1">Se cobra en</span>
            <select value={medio} onChange={(e) => setMedio(e.target.value)}
              className="w-full border border-borde rounded-md px-2.5 py-2 text-sm bg-superficie outline-none focus:border-acento">
              {medios.map((m) => <option key={m.k} value={m.k}>{m.n}</option>)}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={confirmar} disabled={guardando || !concepto.trim() || !(n > 0)}>
            <FilePlus2 size={15} /> {guardando ? "Registrando…" : `Cobrar ${money(n)} con nota de débito`}
          </Boton>
        </div>
      </div>
    </Modal>
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
