/* ============================================================
   CAJA · A PAGAR (0133)
   ============================================================

   Las facturas de proveedores que vencen: qué está vencido, qué vence en
   la semana y en el mes, y si alcanza con lo que hay en la caja grande.
   Pagar registra el pago en la caja grande y marca la factura en un solo
   paso (pagar_factura_proveedor). Ver src/datos/facturasProveedor.js.
   ============================================================ */

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Check } from "lucide-react";
import { Card, Kpi, Boton, Modal, Vacio, Cargando } from "../ui/Base.jsx";
import { money } from "../utils/helpers.js";
import { CUENTAS, cargarSaldos } from "../datos/cajaGrande.js";
import { cargarFacturas, crearFactura, anularFactura, pagarFactura, proveedoresConocidos } from "../datos/facturasProveedor.js";

const campoCls = "w-full border border-borde rounded-md px-3 py-2 text-sm bg-superficie outline-none focus:border-acento";
const hoyBA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const diasHasta = (fecha, hoy) => Math.round((Date.UTC(...fecha.split("-").map((n, i) => (i === 1 ? n - 1 : +n))) - Date.UTC(...hoy.split("-").map((n, i) => (i === 1 ? n - 1 : +n)))) / 86400000);
const fechaCorta = (f) => f.split("-").reverse().slice(0, 2).join("/");
const masDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); };

export function FacturasAPagar({ empresaId, toast }) {
  const [datos, setDatos] = useState(null);
  const [saldos, setSaldos] = useState(null);
  const [nombres, setNombres] = useState([]);
  const [alta, setAlta] = useState(false);
  const [pagando, setPagando] = useState(null);
  const [error, setError] = useState(null);

  const leer = useCallback(() => {
    cargarFacturas(empresaId).then(setDatos).catch((e) => setError(e.message || "No se pudieron cargar las facturas."));
    cargarSaldos(empresaId).then(setSaldos).catch(() => setSaldos(null));
    proveedoresConocidos(empresaId).then(setNombres).catch(() => setNombres([]));
  }, [empresaId]);
  useEffect(() => { leer(); }, [leer]);

  if (error) return <Card className="p-5"><p className="text-sm text-mal">{error}</p></Card>;
  if (!datos) return <Cargando />;

  const hoy = hoyBA();
  const pend = datos.pendientes.map((f) => ({ ...f, dias: diasHasta(f.vence, hoy) }));
  const suma = (xs) => xs.reduce((s, f) => s + f.monto, 0);
  const vencido = suma(pend.filter((f) => f.dias < 0));
  const en7 = suma(pend.filter((f) => f.dias >= 0 && f.dias <= 7));
  const en30 = suma(pend.filter((f) => f.dias >= 0 && f.dias <= 30));
  const necesita30 = vencido + en30;
  const enCaja = saldos ? Object.values(saldos).reduce((s, v) => s + v, 0) : null;

  const anular = async (f) => {
    if (!window.confirm(`¿Anular la factura de ${f.proveedor} por ${money(f.monto)}? No se va a pagar.`)) return;
    try { await anularFactura(f.id); toast("Factura anulada."); leer(); }
    catch (e) { toast(e.message, "mal"); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Vencido" valor={money(vencido)} tono={vencido > 0 ? "mal" : "neutro"} sub={vencido > 0 ? `${pend.filter((f) => f.dias < 0).length} factura(s)` : "nada vencido"} />
        <Kpi label="Vence en 7 días" valor={money(en7)} />
        <Kpi label="Vence en 30 días" valor={money(en30)} />
        <Kpi label="En la caja grande" valor={enCaja == null ? "—" : money(enCaja)}
          tono={enCaja != null && enCaja < necesita30 ? "mal" : "bien"}
          sub={enCaja == null ? undefined : enCaja >= necesita30 ? "alcanza para los próximos 30 días" : `faltan ${money(necesita30 - enCaja)} para los 30 días`} />
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-borde flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="f-d">Facturas a pagar</h3>
            <p className="text-xs text-texto-suave">Las de los proveedores que te dan plazo. Pagarlas las anota en la caja grande.</p>
          </div>
          <Boton size="sm" onClick={() => setAlta(true)}><Plus size={14} /> Cargar factura</Boton>
        </div>
        {pend.length === 0 ? (
          <Vacio>No hay facturas por pagar.</Vacio>
        ) : (
          <ul className="divide-y divide-borde">
            {pend.map((f) => (
              <li key={f.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{f.proveedor}{f.numero ? <span className="text-texto-tenue font-normal"> · {f.numero}</span> : null}</div>
                  <div className={`text-xs ${f.dias < 0 ? "text-mal font-semibold" : f.dias <= 7 ? "text-ojo" : "text-texto-tenue"}`}>
                    {f.dias < 0 ? `Venció hace ${-f.dias} día${f.dias === -1 ? "" : "s"}` : f.dias === 0 ? "Vence hoy" : `Vence el ${fechaCorta(f.vence)} (en ${f.dias} día${f.dias === 1 ? "" : "s"})`}
                    {f.nota ? ` · ${f.nota}` : ""}
                  </div>
                </div>
                <span className="f-m">{money(f.monto)}</span>
                <Boton size="sm" onClick={() => setPagando(f)}>Pagar</Boton>
                <Boton size="sm" variant="quiet" onClick={() => anular(f)}>Anular</Boton>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {datos.pagadas.length > 0 && (
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Pagadas en los últimos 60 días</div>
          <ul className="text-sm divide-y divide-borde">
            {datos.pagadas.slice(0, 15).map((f) => (
              <li key={f.id} className="flex justify-between gap-3 py-1.5">
                <span className="truncate">{f.proveedor}{f.numero ? ` · ${f.numero}` : ""}</span>
                <span className="f-m text-texto-suave shrink-0">{money(f.monto)} · {f.pagadaEn.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {alta && <AltaFactura empresaId={empresaId} nombres={nombres} toast={toast} onCerrar={() => setAlta(false)} onHecho={() => { setAlta(false); leer(); }} />}
      {pagando && <PagarFactura factura={pagando} saldos={saldos} toast={toast} onCerrar={() => setPagando(null)} onHecho={() => { setPagando(null); leer(); }} />}
    </div>
  );
}

function AltaFactura({ empresaId, nombres, toast, onCerrar, onHecho }) {
  const [d, setD] = useState({ proveedor: "", numero: "", monto: "", vence: masDias(15), nota: "" });
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: k === "monto" ? e.target.value.replace(/\D/g, "") : e.target.value }));
  const guardar = async () => {
    setGuardando(true);
    try { await crearFactura(empresaId, d); toast(`Factura de ${d.proveedor.trim()} cargada.`); onHecho(); }
    catch (e) { toast(e.message, "mal"); setGuardando(false); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-6 space-y-3">
        <h3 className="f-d text-lg">Cargar factura a pagar</h3>
        <label className="block text-sm">
          <span className="block text-xs text-texto-suave mb-1">Proveedor</span>
          <input value={d.proveedor} onChange={set("proveedor")} list="proveedores-conocidos" autoFocus placeholder="Coca, Maxiconsumo…" className={campoCls} />
          <datalist id="proveedores-conocidos">{nombres.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="block text-xs text-texto-suave mb-1">Número (opcional)</span>
            <input value={d.numero} onChange={set("numero")} className={campoCls} />
          </label>
          <label className="block text-sm">
            <span className="block text-xs text-texto-suave mb-1">Monto</span>
            <input value={d.monto} onChange={set("monto")} inputMode="numeric" placeholder="0" className={`${campoCls} f-m text-right`} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="block text-xs text-texto-suave mb-1">Vence</span>
          <input type="date" value={d.vence} onChange={set("vence")} className={campoCls} />
        </label>
        <label className="block text-sm">
          <span className="block text-xs text-texto-suave mb-1">Nota (opcional)</span>
          <input value={d.nota} onChange={set("nota")} className={campoCls} />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={guardar} disabled={guardando || !d.proveedor.trim() || !(Number(d.monto) > 0) || !d.vence}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
      </div>
    </Modal>
  );
}

function PagarFactura({ factura, saldos, toast, onCerrar, onHecho }) {
  const [cuenta, setCuenta] = useState("efectivo");
  const [pagando, setPagando] = useState(false);
  const pagar = async () => {
    setPagando(true);
    try { await pagarFactura(factura.id, cuenta); toast(`Pagada: ${money(factura.monto)} a ${factura.proveedor}.`); onHecho(); }
    catch (e) { toast(e.message, "mal"); setPagando(false); }
  };
  return (
    <Modal open onClose={onCerrar} ancho="max-w-sm">
      <div className="p-6">
        <h3 className="f-d text-lg">Pagar {money(factura.monto)}</h3>
        <p className="text-sm text-texto-suave mt-1">A {factura.proveedor}{factura.numero ? `, factura ${factura.numero}` : ""}. Queda anotado como pago en la caja grande.</p>
        <label className="block text-sm mt-4">
          <span className="block text-xs text-texto-suave mb-1">De qué cuenta sale</span>
          <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={campoCls}>
            {CUENTAS.map((c) => <option key={c.k} value={c.k}>{c.n}{saldos ? ` · ${money(saldos[c.k] || 0)}` : ""}</option>)}
          </select>
        </label>
        <div className="flex justify-end gap-2 mt-5">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={pagar} disabled={pagando}><Check size={15} /> {pagando ? "Pagando…" : "Pagar"}</Boton>
        </div>
      </div>
    </Modal>
  );
}
