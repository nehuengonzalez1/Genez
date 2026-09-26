/* ============================================================
   CAJA · LA CAJA GRANDE
   ============================================================

   La plata del negocio que ya no está en el cajón (0095), en tres
   cuentas: el efectivo guardado, Mercado Pago y el banco. El saldo de
   cada una es la suma de sus movimientos, igual que la caja del día y
   que el stock: no hay un número que alguien escriba.

   Entra sola desde cada cierre y desde el cajón en el día. Lo demás se
   carga acá: un pago a un proveedor, un retiro del dueño, un aporte, un
   pase entre cuentas (depositar el efectivo en el banco) o un ajuste —el
   saldo con el que se empieza, o corregir contra el resumen real—.

   No se edita ni se borra nada: un error se corrige con un ajuste, y así
   el saldo siempre es lo que pasó.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, Plus } from "lucide-react";
import { CUENTAS, CATEGORIAS, nombreCuenta, cargarSaldos, cargarMovimientosGrandes, moverCajaGrande, transferirCajaGrande } from "../datos/cajaGrande.js";
import { money } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import { Kpi, Card, Boton, Modal, Vacio, Cargando } from "../ui/Base.jsx";

const campoCls = "w-full border border-borde rounded-md px-3 py-2 text-sm bg-superficie outline-none focus:border-acento";

/* Lo que se puede cargar a mano, y hacia dónde va la plata. */
const ACCIONES = [
  { k: "pago", n: "Pago", d: "A un proveedor, un servicio, un sueldo: plata del negocio que sale.", tipo: "egreso" },
  { k: "retiro", n: "Retiro del dueño", d: "Plata que el dueño se lleva para uso personal.", tipo: "egreso" },
  { k: "aporte", n: "Aporte", d: "Plata que se pone en el negocio.", tipo: "ingreso" },
  { k: "transferencia", n: "Pase entre cuentas", d: "Depositar el efectivo en el banco, pasar de Mercado Pago al banco.", tipo: null },
  { k: "ajuste", n: "Ajuste", d: "El saldo con el que arranca cada cuenta, o corregir contra el resumen real.", tipo: null },
];

export function CajaGrande({ empresaId, toast }) {
  const [saldos, setSaldos] = useState(null);
  const [movs, setMovs] = useState(null);
  const [cuenta, setCuenta] = useState(null);   // filtro
  const [accion, setAccion] = useState(null);
  const [error, setError] = useState(null);

  const releer = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([cargarSaldos(empresaId), cargarMovimientosGrandes(empresaId, { cuenta })]);
      setSaldos(s); setMovs(m); setError(null);
    } catch (e) {
      setError(e.message || "No se pudo leer la caja grande.");
    }
  }, [empresaId, cuenta]);

  useEffect(() => { releer(); }, [releer]);

  if (error) return <Card className="p-5"><p className="text-sm text-mal">{error}</p></Card>;
  if (!saldos || !movs) return <Card><Cargando /></Card>;

  const total = CUENTAS.reduce((s, c) => s + saldos[c.k], 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="La plata del negocio" valor={money(total)} sub="Las tres cuentas juntas" />
        {CUENTAS.map((c) => <Kpi key={c.k} label={c.n} valor={money(saldos[c.k])} tono={saldos[c.k] < 0 ? "mal" : "neutro"} />)}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-borde">
          <div className="flex flex-wrap gap-1.5">
            {[{ k: null, n: "Todas" }, ...CUENTAS].map((c) => (
              <button key={c.k || "todas"} onClick={() => setCuenta(c.k)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${cuenta === c.k ? "bg-superficie-3 text-texto border-superficie-3" : "border-borde text-texto-suave"}`}>{c.n}</button>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            {ACCIONES.map((a) => (
              <Boton key={a.k} size="sm" variant="ghost" onClick={() => setAccion(a)}>
                {a.k === "transferencia" ? <ArrowLeftRight size={13} /> : <Plus size={13} />} {a.n}
              </Boton>
            ))}
          </div>
        </div>
        {movs.length === 0 ? (
          <Vacio>{cuenta ? "Esta cuenta todavía no tiene movimientos." : "Todavía no hay movimientos. Se llena sola con cada cierre de caja; para empezar, cargá con un ajuste lo que hay hoy en cada cuenta."}</Vacio>
        ) : (
          <ul className="divide-y divide-borde max-h-[560px] overflow-auto">
            {movs.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.tipo === "ingreso" ? "bg-bien-suave text-bien" : "bg-mal-suave text-mal"}`}>
                  {m.tipo === "ingreso" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-texto truncate">{m.detalle || CATEGORIAS[m.categoria]}</div>
                  <div className="text-[11px] text-texto-tenue">
                    {fdatel(m.fecha)} {m.fecha.toTimeString().slice(0, 5)} · {nombreCuenta(m.cuenta)} · {CATEGORIAS[m.categoria] || m.categoria}{m.quien ? ` · ${m.quien}` : ""}
                  </div>
                </div>
                <span className={`f-m text-sm font-semibold shrink-0 ${m.tipo === "ingreso" ? "text-bien" : "text-mal"}`}>
                  {m.tipo === "ingreso" ? "+" : "−"}{money(m.monto)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {accion && (
        <Movimiento accion={accion} empresaId={empresaId} saldos={saldos} toast={toast}
          onCerrar={() => setAccion(null)} onHecho={async () => { setAccion(null); await releer(); }} />
      )}
    </div>
  );
}

function Movimiento({ accion, empresaId, saldos, toast, onCerrar, onHecho }) {
  const esPase = accion.k === "transferencia";
  const esAjuste = accion.k === "ajuste";
  const [cuenta, setCuenta] = useState("efectivo");
  const [hacia, setHacia] = useState("banco");
  const [monto, setMonto] = useState("");
  const [detalle, setDetalle] = useState("");
  /* Un ajuste se carga como el saldo real de la cuenta, que es lo que la
     persona tiene en la mano (el resumen del banco, lo que contó): la
     diferencia contra el saldo del sistema la calcula esto. */
  const [real, setReal] = useState("");
  const [guardando, setGuardando] = useState(false);

  const diferencia = esAjuste && real !== "" ? Number(real) - saldos[cuenta] : null;

  const confirmar = async () => {
    setGuardando(true);
    try {
      if (esPase) {
        await transferirCajaGrande({ empresaId, desde: cuenta, hacia, monto: Number(monto), detalle });
        toast(`${money(Number(monto))} pasaron de ${nombreCuenta(cuenta)} a ${nombreCuenta(hacia)}.`);
      } else if (esAjuste) {
        await moverCajaGrande({
          empresaId, cuenta, tipo: diferencia > 0 ? "ingreso" : "egreso", monto: Math.abs(diferencia), categoria: "ajuste",
          detalle: detalle.trim() || `Ajuste de ${nombreCuenta(cuenta)} a ${money(Number(real))}`,
        });
        toast(`${nombreCuenta(cuenta)} quedó en ${money(Number(real))}.`);
      } else {
        await moverCajaGrande({ empresaId, cuenta, tipo: accion.tipo, monto: Number(monto), categoria: accion.k, detalle: detalle.trim() });
        toast(`${accion.n} registrado.`);
      }
      await onHecho();
    } catch (e) {
      toast(e.message, "mal");
      setGuardando(false);
    }
  };

  const listo = esAjuste ? diferencia !== null && diferencia !== 0
    : Number(monto) > 0 && (esPase ? cuenta !== hacia : detalle.trim().length > 0);

  const Selector = ({ valor, onChange, excluir }) => (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={campoCls}>
      {CUENTAS.filter((c) => c.k !== excluir).map((c) => <option key={c.k} value={c.k}>{c.n} · {money(saldos[c.k])}</option>)}
    </select>
  );

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-6">
        <h3 className="f-d text-lg">{accion.n}</h3>
        <p className="text-sm text-texto-suave mt-1">{accion.d}</p>

        <div className={`grid ${esPase ? "grid-cols-2" : "grid-cols-1"} gap-3 mt-5`}>
          <label className="text-sm">
            <span className="block text-xs text-texto-suave mb-1">{esPase ? "Desde" : "Cuenta"}</span>
            <Selector valor={cuenta} onChange={setCuenta} />
          </label>
          {esPase && (
            <label className="text-sm">
              <span className="block text-xs text-texto-suave mb-1">Hacia</span>
              <Selector valor={hacia} onChange={setHacia} excluir={cuenta} />
            </label>
          )}
        </div>

        {esAjuste ? (
          <label className="block text-sm mt-3">
            <span className="block text-xs text-texto-suave mb-1">Cuánto hay de verdad en {nombreCuenta(cuenta)}</span>
            <input value={real} onChange={(e) => setReal(e.target.value.replace(/\D/g, ""))} autoFocus placeholder="0"
              className={`${campoCls} f-m text-right`} />
            {diferencia !== null && (
              <span className="block text-xs text-texto-suave mt-1">
                El sistema dice {money(saldos[cuenta])}: {diferencia === 0 ? "ya coincide, no hay nada que ajustar." : `se ${diferencia > 0 ? "suman" : "restan"} ${money(Math.abs(diferencia))}.`}
              </span>
            )}
          </label>
        ) : (
          <label className="block text-sm mt-3">
            <span className="block text-xs text-texto-suave mb-1">Monto</span>
            <input value={monto} onChange={(e) => setMonto(e.target.value.replace(/\D/g, ""))} autoFocus placeholder="0"
              className={`${campoCls} f-m text-right`} />
          </label>
        )}

        <label className="block text-sm mt-3">
          <span className="block text-xs text-texto-suave mb-1">Detalle{esPase || esAjuste ? " (opcional)" : ""}</span>
          <input value={detalle} onChange={(e) => setDetalle(e.target.value)}
            placeholder={accion.k === "pago" ? "Coca-Cola, factura 1234" : accion.k === "retiro" ? "Para qué" : ""} className={campoCls} />
        </label>

        <div className="flex justify-end gap-2 mt-6">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={confirmar} disabled={guardando || !listo}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
      </div>
    </Modal>
  );
}
