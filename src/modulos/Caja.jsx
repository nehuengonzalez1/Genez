/* ============================================================
   10. CAJA
   ============================================================ */

import React, { useState } from "react";
import { Plus, Wallet, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { mediosDe, medioPorK, money, nf } from "../utils/helpers.js";
import { Kpi, Card, Boton, Modal, Vacio } from "../ui/Base.jsx";

export function Caja({ caja, movCaja, cerrarCaja, abrirCaja, toast, ajustes }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ monto: "", detalle: "", medio: "efectivo" });
  const [contado, setContado] = useState("");
  const [guardando, setGuardando] = useState(false);

  const porMedio = mediosDe(ajustes).map((m) => {
    const ing = caja.movimientos.filter((x) => x.tipo === "ingreso" && x.medio === m.k).reduce((s, x) => s + x.monto, 0);
    const egr = caja.movimientos.filter((x) => x.tipo === "egreso" && x.medio === m.k).reduce((s, x) => s + x.monto, 0);
    return { ...m, ing, egr, neto: ing - egr };
  });
  const ingresos = caja.movimientos.filter((x) => x.tipo === "ingreso").reduce((s, x) => s + x.monto, 0);
  const egresos = caja.movimientos.filter((x) => x.tipo === "egreso").reduce((s, x) => s + x.monto, 0);
  const efectivo = porMedio.find((m) => m.k === "efectivo");
  const efectivoEsperado = caja.saldoInicial + (efectivo ? efectivo.neto : 0);
  const dif = contado === "" ? null : Number(contado) - efectivoEsperado;

  /* El movimiento se guarda en la base: si no entra, el modal queda abierto
     con lo cargado y no se avisa nada que no haya pasado. */
  const guardar = async () => {
    const monto = Number(form.monto);
    if (!monto || guardando) return;
    setGuardando(true);
    const ok = await movCaja({ tipo: "egreso", medio: form.medio, monto, detalle: form.detalle || (modal === "gasto" ? "Gasto" : "Retiro del dueño"), clase: modal });
    setGuardando(false);
    if (!ok) return;
    const era = modal;
    setForm({ monto: "", detalle: "", medio: "efectivo" });
    setModal(null);
    toast(era === "gasto" ? "Gasto registrado." : "Retiro registrado.");
  };

  if (!caja.abierta) return <CajaCerrada caja={caja} abrirCaja={abrirCaja} />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Efectivo en caja" valor={money(efectivoEsperado)} sub={`Apertura ${money(caja.saldoInicial)}`} />
        <Kpi label="Ingresos del día" valor={money(ingresos)} tono="bien" />
        <Kpi label="Egresos del día" valor={money(egresos)} tono={egresos > 0 ? "mal" : "neutro"} />
        <Kpi label="Movimientos" valor={nf.format(caja.movimientos.length)} sub={`Abierta ${caja.hora}`} />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 items-start">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
            <h3 className="f-d">Movimientos de hoy</h3>
            <div className="flex gap-1.5">
              <Boton size="sm" variant="ghost" onClick={() => setModal("gasto")}><Plus size={13} /> Gasto</Boton>
              <Boton size="sm" variant="ghost" onClick={() => setModal("retiro")}><Plus size={13} /> Retiro</Boton>
            </div>
          </div>
          {caja.movimientos.length === 0 ? <Vacio>Todavía no hay movimientos. La primera venta aparece acá.</Vacio> : (
            <ul className="divide-y divide-stone-100 max-h-[460px] overflow-auto">
              {[...caja.movimientos].reverse().map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.tipo === "ingreso" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                    {m.tipo === "ingreso" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-stone-800 truncate">{m.detalle}</div>
                    <div className="text-[11px] text-stone-400">{m.hora} · {medioPorK(ajustes, m.medio).n}</div>
                  </div>
                  <span className={`f-m text-sm font-semibold shrink-0 ${m.tipo === "ingreso" ? "text-emerald-700" : "text-red-600"}`}>
                    {m.tipo === "ingreso" ? "+" : "−"}{money(m.monto)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-3">Cobrado por medio de pago</div>
            <ul className="space-y-2">
              {porMedio.map((m) => (
                <li key={m.k}>
                  <div className="flex justify-between text-sm"><span className="text-stone-600">{m.n}</span><span className="f-m">{money(m.ing)}</span></div>
                  <div className="h-1.5 bg-stone-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-orange-400 rounded-full" style={{ width: `${ingresos ? (m.ing / ingresos) * 100 : 0}%` }} />
                  </div>
                  {m.tasa > 0 && m.ing > 0 && <div className="text-[10px] text-stone-400 mt-0.5">Comisión estimada {money(m.ing * m.tasa / 100)}</div>}
                </li>
              ))}
            </ul>
            <div className="border-t border-stone-100 mt-3 pt-3 text-xs text-stone-500">
              Las comisiones de tarjeta te descuentan <strong>{money(porMedio.reduce((s, m) => s + m.ing * m.tasa / 100, 0))}</strong> hoy. No aparecen en el ticket pero sí en tu ganancia.
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-2">Cerrar caja</div>
            <p className="text-sm text-stone-500">Contá el efectivo y cargá cuánto hay realmente.</p>
            <div className="flex justify-between text-sm mt-3"><span className="text-stone-500">Deberías tener</span><span className="f-m font-semibold">{money(efectivoEsperado)}</span></div>
            <input value={contado} onChange={(e) => setContado(e.target.value.replace(/\D/g, ""))} placeholder="Efectivo contado"
              className="f-m w-full text-right border border-stone-200 rounded-xl px-3 py-2 text-sm mt-2 outline-none focus:border-orange-400" />
            {dif !== null && (
              <div className={`text-sm font-semibold mt-2 ${dif === 0 ? "text-emerald-600" : Math.abs(dif) < 2000 ? "text-amber-600" : "text-red-600"}`}>
                {dif === 0 ? "Cuadra perfecto." : dif > 0 ? `Sobran ${money(dif)}` : `Faltan ${money(-dif)}`}
              </div>
            )}
            <Boton variant="dark" className="w-full mt-3" disabled={contado === "" || guardando}
              onClick={async () => { setGuardando(true); await cerrarCaja(Number(contado)); setGuardando(false); setContado(""); }}>
              Cerrar caja del día
            </Boton>
          </Card>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} ancho="max-w-sm">
        <div className="p-5">
          <h3 className="f-d text-lg">{modal === "gasto" ? "Registrar un gasto" : "Registrar un retiro"}</h3>
          <p className="text-sm text-stone-500 mt-1">
            {modal === "gasto" ? "Alquiler, servicios, flete, sueldos, mantenimiento." : "Plata que sacás del negocio para uso personal."}
          </p>
          <input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} placeholder={modal === "gasto" ? "Detalle (ej. flete de bebidas)" : "Detalle"}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm mt-4 outline-none focus:border-orange-400" />
          <input value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value.replace(/\D/g, "") })} placeholder="Monto"
            className="f-m w-full text-right border border-stone-200 rounded-xl px-3 py-2 text-sm mt-2 outline-none focus:border-orange-400" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {mediosDe(ajustes).map((m) => (
              <button key={m.k} onClick={() => setForm({ ...form, medio: m.k })}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${form.medio === m.k ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500"}`}>{m.n}</button>
            ))}
          </div>
          <Boton className="w-full mt-4" onClick={guardar} disabled={!form.monto || guardando}>Guardar</Boton>
        </div>
      </Modal>
    </div>
  );
}

/* La misma pantalla la usan Caja y el POS: sin sesión de caja abierta el
   servidor rechaza toda venta, así que cobrar tiene que estar bloqueado
   desde antes de cargar el primer producto. */
export function CajaCerrada({ caja, abrirCaja, bajada }) {
  const [apertura, setApertura] = useState("50000");
  const [abriendo, setAbriendo] = useState(false);

  return (
    <Card className="p-8 text-center max-w-md mx-auto">
      <Wallet size={28} className="mx-auto text-stone-300" />
      <h3 className="f-d text-xl mt-3">La caja está cerrada</h3>
      <p className="text-sm text-stone-500 mt-1">{bajada || "Abrila con el efectivo con el que arrancás el turno para poder cobrar."}</p>
      {caja.cierres.length > 0 && (
        <div className="text-left text-sm bg-stone-50 rounded-xl p-3 mt-4">
          <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold mb-1">Último cierre</div>
          <div className="flex justify-between"><span>Esperado</span><span className="f-m">{money(caja.cierres[0].esperado)}</span></div>
          <div className="flex justify-between"><span>Contado</span><span className="f-m">{money(caja.cierres[0].contado)}</span></div>
          <div className="flex justify-between font-semibold"><span>Diferencia</span><span className={`f-m ${caja.cierres[0].dif < 0 ? "text-red-600" : "text-emerald-600"}`}>{money(caja.cierres[0].dif)}</span></div>
        </div>
      )}
      {/* El monto de apertura entra en el arqueo: si no es el que hay de
          verdad en el cajón, el cierre nunca cuadra. */}
      <input value={apertura} onChange={(e) => setApertura(e.target.value.replace(/\D/g, ""))} placeholder="Efectivo con el que arrancás"
        className="f-m w-full text-right border border-stone-200 rounded-xl px-3 py-2 text-sm mt-4 outline-none focus:border-orange-400" />
      {/* Abrir es asincrónico: sin el candado, dos clics seguidos mandan dos
          aperturas antes de que vuelva la primera. */}
      <Boton className="mt-3 w-full" size="lg" disabled={abriendo}
        onClick={async () => { setAbriendo(true); try { await abrirCaja(Number(apertura || 0)); } finally { setAbriendo(false); } }}>
        {abriendo ? "Abriendo…" : `Abrir caja con ${money(Number(apertura || 0))}`}
      </Boton>
    </Card>
  );
}
