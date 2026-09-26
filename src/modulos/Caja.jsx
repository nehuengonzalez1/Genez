/* ============================================================
   10. CAJA
   ============================================================

   La caja del día y, para quien tiene el permiso `cajaGrande`, la caja
   grande (0095): la plata del negocio que ya no está en el cajón.

   El cierre cuenta todos los medios, no solo el efectivo: el efectivo se
   cuenta, y Mercado Pago y las tarjetas se cargan como los dicen Mercado
   Pago y el posnet. Queda un fondo en el cajón para mañana, y todo lo
   demás pasa a la caja grande en el mismo paso.
   ============================================================ */

import React, { useState, useEffect } from "react";
import { cargarResumenCuentas } from "../datos/cuentas.js";
import { pasarACajaGrande } from "../datos/caja.js";
import { Plus, Wallet, ArrowDownRight, ArrowUpRight, ChevronRight, Landmark, Printer } from "lucide-react";
import { DetalleMovimiento } from "./DetalleMovimiento.jsx";
import { CajaGrande } from "./CajaGrande.jsx";
import { mediosDe, medioPorK, money, nf, MEDIO_CUENTA_CORRIENTE } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import { Kpi, Card, Boton, Modal, Vacio, Tabs, armarLineas, imprimirComandera } from "../ui/Base.jsx";

const inputCls = "f-m w-full text-right border border-borde rounded-md px-3 py-2 text-sm bg-superficie outline-none focus:border-acento";

/* La cuenta de la caja grande a la que va cada medio. La misma regla que
   `cuenta_de_medio` en la base. */
const cuentaDe = (k) => (k === "efectivo" ? "efectivo" : k === "mp" ? "mp" : "banco");
const NOMBRE_CUENTA = { efectivo: "Efectivo", mp: "Mercado Pago", banco: "Banco" };

export function Caja(props) {
  const { permisos = {} } = props;
  const [vista, setVista] = useState("dia");
  if (!permisos.cajaGrande) return <CajaDelDia {...props} />;
  return (
    <div className="space-y-4">
      <Tabs value={vista} onChange={setVista} items={[{ k: "dia", n: "Caja del día" }, { k: "grande", n: "Caja grande" }]} />
      {vista === "dia" ? <CajaDelDia {...props} /> : <CajaGrande empresaId={props.empresaId} toast={props.toast} />}
    </div>
  );
}

function CajaDelDia({ caja, movCaja, cerrarCaja, abrirCaja, toast, ajustes, empresaId, permisos = {}, pedirCAEs = null, recargarCaja = null }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ monto: "", detalle: "", medio: "efectivo" });
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [abierto, setAbierto] = useState(null);   // el movimiento que se está mirando

  /* El fiado no pasa por el cajón: no tiene fila en el arqueo. Lo que se
     fió y lo que se cobró de cuentas va aparte, abajo. */
  const porMedio = mediosDe(ajustes).filter((m) => m.k !== MEDIO_CUENTA_CORRIENTE).map((m) => {
    const ing = caja.movimientos.filter((x) => x.tipo === "ingreso" && x.medio === m.k).reduce((s, x) => s + x.monto, 0);
    const egr = caja.movimientos.filter((x) => x.tipo === "egreso" && x.medio === m.k).reduce((s, x) => s + x.monto, 0);
    return { ...m, ing, egr, neto: ing - egr };
  });
  const ingresos = caja.movimientos.filter((x) => x.tipo === "ingreso").reduce((s, x) => s + x.monto, 0);
  const egresos = caja.movimientos.filter((x) => x.tipo === "egreso").reduce((s, x) => s + x.monto, 0);
  const efectivo = porMedio.find((m) => m.k === "efectivo");
  const efectivoEsperado = caja.saldoInicial + (efectivo ? efectivo.neto : 0);

  /* El movimiento se guarda en la base: si no entra, el modal queda abierto
     con lo cargado y no se avisa nada que no haya pasado. */
  const guardar = async () => {
    const monto = Number(form.monto);
    if (!monto || guardando) return;
    setGuardando(true);
    if (modal === "grande") {
      try {
        await pasarACajaGrande({ sesionId: caja.sesionId, monto, detalle: form.detalle });
        if (recargarCaja) await recargarCaja();
        toast(`${money(monto)} pasaron a la caja grande.`);
      } catch (e) {
        toast(e.message, "mal");
        setGuardando(false);
        return;
      }
    } else {
      const ok = await movCaja({ tipo: "egreso", medio: form.medio, monto, detalle: form.detalle || (modal === "gasto" ? "Gasto" : "Retiro del dueño"), clase: modal });
      if (!ok) { setGuardando(false); return; }
      toast(modal === "gasto" ? "Gasto registrado." : "Retiro registrado.");
    }
    setGuardando(false);
    setForm({ monto: "", detalle: "", medio: "efectivo" });
    setModal(null);
  };

  /* Lo fiado hoy y lo cobrado de cuentas. Lo primero no pasa por el
     cajón y lo segundo sí, ya sumado en los ingresos: se muestran juntos
     y aparte para que el arqueo se entienda. Se relee cuando cambian los
     movimientos, que es cuando entra o sale un pago. */
  const [cc, setCc] = useState(null);
  useEffect(() => {
    if (!empresaId || !caja.abierta) return undefined;
    let vigente = true;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    cargarResumenCuentas(empresaId, hoy, new Date(Date.now() + 60000))
      .then((r) => { if (vigente) setCc(r); }).catch(() => {});
    return () => { vigente = false; };
  }, [empresaId, caja.abierta, caja.movimientos.length]);

  if (!caja.abierta) return <CajaCerrada caja={caja} abrirCaja={abrirCaja} ajustes={ajustes} toast={toast} />;

  const titulos = {
    gasto: ["Registrar un gasto", "Alquiler, servicios, flete, sueldos, mantenimiento."],
    retiro: ["Registrar un retiro", "Plata que sacás del negocio para uso personal."],
    grande: ["Pasar a la caja grande", "Efectivo que sacás del cajón y guardás: sale de la caja del día y entra a la caja grande."],
  };

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
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-borde">
            <h3 className="f-d">Movimientos de hoy</h3>
            <div className="flex flex-wrap justify-end gap-1.5">
              <Boton size="sm" variant="ghost" onClick={() => setModal("gasto")}><Plus size={13} /> Gasto</Boton>
              <Boton size="sm" variant="ghost" onClick={() => setModal("retiro")}><Plus size={13} /> Retiro</Boton>
              <Boton size="sm" variant="ghost" onClick={() => setModal("grande")}><Landmark size={13} /> A caja grande</Boton>
            </div>
          </div>
          {caja.movimientos.length === 0 ? <Vacio>Todavía no hay movimientos. La primera venta aparece acá.</Vacio> : (
            <ul className="divide-y divide-borde max-h-[460px] overflow-auto">
              {[...caja.movimientos].reverse().map((m) => (
                <li key={m.id}>
                  <button onClick={() => setAbierto(m)} title="Ver el detalle y volver a imprimir"
                    className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-superficie-2 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${m.tipo === "ingreso" ? "bg-bien-suave text-bien" : "bg-mal-suave text-mal"}`}>
                      {m.tipo === "ingreso" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-texto truncate">{m.detalle}</div>
                      <div className="text-[11px] text-texto-tenue">{m.hora} · {medioPorK(ajustes, m.medio).n}</div>
                    </div>
                    <span className={`f-m text-sm font-semibold shrink-0 ${m.tipo === "ingreso" ? "text-bien" : "text-mal"}`}>
                      {m.tipo === "ingreso" ? "+" : "−"}{money(m.monto)}
                    </span>
                    <ChevronRight size={14} className="text-texto-tenue shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {abierto && (
            <DetalleMovimiento m={abierto} empresaId={empresaId} ajustes={ajustes} toast={toast} onCerrar={() => setAbierto(null)}
              caja={caja} permisos={permisos} pedirCAEs={pedirCAEs} onCambio={recargarCaja} />
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Cobrado por medio de pago</div>
            <ul className="space-y-2">
              {porMedio.map((m) => (
                <li key={m.k}>
                  <div className="flex justify-between text-sm"><span className="text-texto-suave">{m.n}</span><span className="f-m">{money(m.ing)}</span></div>
                  <div className="h-1.5 bg-superficie-2 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-acento-vivo rounded-full" style={{ width: `${ingresos ? (m.ing / ingresos) * 100 : 0}%` }} />
                  </div>
                  {m.tasa > 0 && m.ing > 0 && <div className="text-[10px] text-texto-tenue mt-0.5">Comisión estimada {money(m.ing * m.tasa / 100)}</div>}
                </li>
              ))}
            </ul>
            <div className="border-t border-borde mt-3 pt-3 text-xs text-texto-suave">
              Las comisiones de tarjeta te descuentan <strong>{money(porMedio.reduce((s, m) => s + m.ing * m.tasa / 100, 0))}</strong> hoy. No aparecen en el ticket pero sí en tu ganancia.
            </div>
          </Card>

          {cc && (cc.fiado > 0 || cc.cobrado > 0) && (
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">Cuenta corriente hoy</div>
              <div className="flex justify-between text-sm"><span className="text-texto-suave">Fiado</span><span className="f-m text-mal">{money(cc.fiado)}</span></div>
              <div className="flex justify-between text-sm mt-1.5"><span className="text-texto-suave">Cobrado de cuentas</span><span className="f-m text-bien">{money(cc.cobrado)}</span></div>
              <p className="text-[11px] text-texto-tenue mt-2">Lo fiado no entró al cajón. Lo cobrado ya está sumado en los ingresos.</p>
            </Card>
          )}

          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-2">Cerrar caja</div>
            <p className="text-sm text-texto-suave">Contá el efectivo, cargá lo que dicen Mercado Pago y el posnet, y dejá el fondo para mañana.</p>
            <div className="flex justify-between text-sm mt-3"><span className="text-texto-suave">Efectivo que debería haber</span><span className="f-m font-semibold">{money(efectivoEsperado)}</span></div>
            <Boton variant="dark" className="w-full mt-3" disabled={!permisos.cerrarCaja} onClick={() => setCerrando(true)}>
              Cerrar caja del día
            </Boton>
            {!permisos.cerrarCaja && <p className="text-xs text-texto-tenue mt-2">Tu usuario no puede cerrar la caja.</p>}
          </Card>
        </div>
      </div>

      {cerrando && (
        <CierreCaja caja={caja} porMedio={porMedio} efectivoEsperado={efectivoEsperado} cerrarCaja={cerrarCaja}
          onCerrar={() => setCerrando(false)} />
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} ancho="max-w-sm">
        <div className="p-5">
          <h3 className="f-d text-lg">{modal && titulos[modal][0]}</h3>
          <p className="text-sm text-texto-suave mt-1">{modal && titulos[modal][1]}</p>
          <input value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            placeholder={modal === "gasto" ? "Detalle (ej. flete de bebidas)" : modal === "grande" ? "Detalle (opcional)" : "Detalle"}
            className="w-full border border-borde rounded-md px-3 py-2 text-sm mt-4 bg-superficie outline-none focus:border-acento" />
          <input value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value.replace(/\D/g, "") })} placeholder="Monto"
            className={`${inputCls} mt-2`} />
          {/* A la caja grande pasa efectivo del cajón: no se elige medio. */}
          {modal !== "grande" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {mediosDe(ajustes).filter((m) => m.k !== MEDIO_CUENTA_CORRIENTE).map((m) => (
                <button key={m.k} onClick={() => setForm({ ...form, medio: m.k })}
                  className={`text-xs px-2.5 py-1.5 rounded-md border ${form.medio === m.k ? "bg-superficie-3 text-texto border-superficie-3" : "border-borde text-texto-suave"}`}>{m.n}</button>
              ))}
            </div>
          )}
          <Boton className="w-full mt-4" onClick={guardar} disabled={!form.monto || guardando}>{guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------
   El cierre con todos los medios
   ------------------------------------------------------------
   El efectivo arranca vacío: si se completara solo con lo esperado, el
   cierre "cuadraría" sin que nadie haya contado nada. Mercado Pago y las
   tarjetas arrancan en lo esperado, que es lo que se corrige si el
   resumen de Mercado Pago o el cierre del posnet dicen otra cosa. */
function CierreCaja({ caja, porMedio, efectivoEsperado, cerrarCaja, onCerrar }) {
  const otros = porMedio.filter((m) => m.k !== "efectivo" && (m.neto !== 0 || m.activo !== false));
  const [contado, setContado] = useState("");
  const [dicen, setDicen] = useState(() => Object.fromEntries(otros.map((m) => [m.k, String(Math.max(0, Math.round(m.neto)))])));
  const [fondo, setFondo] = useState(String(Math.round(caja.saldoInicial || 0)));
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);

  const efectivo = contado === "" ? null : Number(contado);
  const fondoN = Number(fondo || 0);
  const filas = [
    { k: "efectivo", n: "Efectivo", esperado: efectivoEsperado, declarado: efectivo },
    ...otros.map((m) => ({ k: m.k, n: m.n, esperado: m.neto, declarado: dicen[m.k] === "" ? null : Number(dicen[m.k]), tasa: m.tasa || 0 })),
  ];
  const fondoMal = efectivo !== null && (fondoN > efectivo);

  /* Lo que pasa a la caja grande, por cuenta: el efectivo menos el fondo,
     y cada medio a la suya menos su comisión estimada. */
  const aGrande = { efectivo: 0, mp: 0, banco: 0 };
  if (efectivo !== null) aGrande.efectivo = Math.max(0, efectivo - fondoN);
  for (const f of filas.slice(1)) {
    if (f.declarado > 0) aGrande[cuentaDe(f.k)] += f.declarado - Math.round(f.declarado * f.tasa / 100);
  }

  const confirmar = async () => {
    setGuardando(true);
    const declarado = { efectivo };
    for (const f of filas.slice(1)) if (f.declarado !== null) declarado[f.k] = f.declarado;
    const ok = await cerrarCaja({ declarado, fondo: fondoN, notas: notas.trim() || null });
    setGuardando(false);
    if (ok) onCerrar();
  };

  const tono = (d) => (d === 0 ? "text-bien" : Math.abs(d) < 2000 ? "text-ojo" : "text-mal");

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-6">
        <h3 className="f-d text-lg">Cerrar la caja del día</h3>
        <p className="text-sm text-texto-suave mt-1">Abierta a las {caja.hora}, con {money(caja.saldoInicial)} de apertura.</p>

        <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mt-5 mb-1">Por medio de pago</div>
        <div className="grid grid-cols-[1fr_auto_8rem] gap-x-3 gap-y-2 items-center text-sm">
          <span className="text-[11px] text-texto-tenue">Medio</span>
          <span className="text-[11px] text-texto-tenue text-right">Debería haber</span>
          <span className="text-[11px] text-texto-tenue text-right">Contado / dicen</span>
          {filas.map((f) => {
            const dif = f.declarado === null ? null : f.declarado - f.esperado;
            return (
              <React.Fragment key={f.k}>
                <span>
                  {f.n}
                  {dif !== null && dif !== 0 && <span className={`block text-xs ${tono(dif)}`}>{dif > 0 ? `Sobran ${money(dif)}` : `Faltan ${money(-dif)}`}</span>}
                  {dif === 0 && <span className="block text-xs text-bien">Cuadra</span>}
                </span>
                <span className="f-m text-right text-texto-suave">{money(f.esperado)}</span>
                <input value={f.k === "efectivo" ? contado : dicen[f.k]} autoFocus={f.k === "efectivo"}
                  placeholder={f.k === "efectivo" ? "Contado" : "0"}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "");
                    if (f.k === "efectivo") setContado(v); else setDicen((d) => ({ ...d, [f.k]: v }));
                  }}
                  className={inputCls} />
              </React.Fragment>
            );
          })}
        </div>
        <p className="text-xs text-texto-tenue mt-2">Mercado Pago y las tarjetas vienen con lo que registró el sistema: corregilos si el resumen de Mercado Pago o el cierre del posnet dicen otra cosa.</p>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <label className="text-sm">
            <span className="block text-xs text-texto-suave mb-1">Fondo que queda para mañana</span>
            <input value={fondo} onChange={(e) => setFondo(e.target.value.replace(/\D/g, ""))} className={inputCls} />
          </label>
          <label className="text-sm">
            <span className="block text-xs text-texto-suave mb-1">Nota (opcional)</span>
            <input value={notas} onChange={(e) => setNotas(e.target.value)}
              className="w-full border border-borde rounded-md px-3 py-2 text-sm bg-superficie outline-none focus:border-acento" />
          </label>
        </div>
        {fondoMal && <p className="text-xs text-mal mt-2">El fondo no puede ser más que el efectivo contado.</p>}

        <div className="border border-borde rounded-lg p-4 mt-5">
          <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold mb-2">Pasa a la caja grande</div>
          {["efectivo", "mp", "banco"].map((c) => (
            <div key={c} className="flex justify-between text-sm py-0.5">
              <span className="text-texto-suave">{NOMBRE_CUENTA[c]}</span>
              <span className="f-m">{money(aGrande[c])}</span>
            </div>
          ))}
          <p className="text-[11px] text-texto-tenue mt-2">Mercado Pago y el banco, ya descontada la comisión estimada de cada medio.</p>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton variant="dark" onClick={confirmar} disabled={guardando || efectivo === null || fondoMal}>
            {guardando ? "Cerrando…" : "Cerrar caja"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* El papel del cierre: lo esperado y lo declarado de cada medio, el
   fondo que quedó y lo que pasó a la caja grande. */
function papelCierre(c, ajustes, W) {
  const f = ajustes.fiscal || {};
  const bloques = [
    { t: "c", v: String(ajustes.negocio || f.nombreFactura || "").toUpperCase() },
    { t: "sep", c: "=" },
    { t: "c", v: "CIERRE DE CAJA" },
    { t: "c", v: "NO VALIDO COMO FACTURA" },
    { t: "lr", a: "Abierta", b: `${fdatel(c.abierta)} ${c.abierta.toTimeString().slice(0, 5)}` },
    { t: "lr", a: "Cerrada", b: `${fdatel(c.fecha)} ${c.fecha.toTimeString().slice(0, 5)}` },
    { t: "lr", a: "Apertura", b: money(c.apertura) },
    { t: "sep" },
  ];
  for (const m of c.medios) {
    bloques.push({ t: "w", v: medioPorK(ajustes, m.k).n.toUpperCase() });
    bloques.push({ t: "lr", a: "  Esperado", b: money(m.esperado) });
    if (m.declarado !== null) {
      bloques.push({ t: "lr", a: m.k === "efectivo" ? "  Contado" : "  Declarado", b: money(m.declarado) });
      if (m.dif) bloques.push({ t: "lr", a: m.dif > 0 ? "  Sobrante" : "  Faltante", b: money(Math.abs(m.dif)) });
    }
  }
  bloques.push({ t: "sep" });
  if (c.fondo !== null) bloques.push({ t: "lr", a: "Fondo para mañana", b: money(c.fondo) });
  if (c.notas) bloques.push({ t: "w", v: c.notas });
  bloques.push({ t: "b" }, { t: "b" }, { t: "c", v: "-".repeat(Math.min(24, W)) }, { t: "c", v: "FIRMA" });
  return armarLineas(W, bloques);
}

/* La misma pantalla la usan Caja y el POS: sin sesión de caja abierta el
   servidor rechaza toda venta, así que cobrar tiene que estar bloqueado
   desde antes de cargar el primer producto. */
export function CajaCerrada({ caja, abrirCaja, bajada, ajustes = null, toast = null }) {
  const ultimo = caja.cierres.length > 0 ? caja.cierres[0] : null;
  /* La apertura propone el fondo que dejó el último cierre (0095): es la
     plata que quedó en el cajón. */
  const [apertura, setApertura] = useState(ultimo && ultimo.fondo !== null && ultimo.fondo !== undefined ? String(Math.round(ultimo.fondo)) : "50000");
  const [tocada, setTocada] = useState(false);
  const [abriendo, setAbriendo] = useState(false);
  useEffect(() => {
    if (!tocada && ultimo && ultimo.fondo !== null && ultimo.fondo !== undefined) setApertura(String(Math.round(ultimo.fondo)));
  }, [ultimo && ultimo.id]);

  return (
    <Card className="p-8 text-center max-w-md mx-auto">
      <Wallet size={28} className="mx-auto text-texto-tenue" />
      <h3 className="f-d text-xl mt-3">La caja está cerrada</h3>
      <p className="text-sm text-texto-suave mt-1">{bajada || "Abrila con el efectivo con el que arrancás el turno para poder cobrar."}</p>
      {ultimo && (
        <div className="text-left text-sm bg-superficie-2 rounded-lg p-3 mt-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold">Último cierre</span>
            {ajustes && (
              <button onClick={() => imprimirComandera(papelCierre(ultimo, ajustes, ajustes.ancho === 58 ? 32 : 48), ajustes.ancho, null, toast)}
                className="text-xs font-semibold text-acento hover:underline inline-flex items-center gap-1"><Printer size={12} /> Imprimir</button>
            )}
          </div>
          {(ultimo.medios && ultimo.medios.length ? ultimo.medios : [{ k: "efectivo", esperado: ultimo.esperado, declarado: ultimo.contado, dif: ultimo.dif }]).map((m) => (
            <div key={m.k} className="flex justify-between gap-2 py-0.5">
              <span>{ajustes ? medioPorK(ajustes, m.k).n : m.k}</span>
              <span className="f-m text-right">
                {m.declarado === null ? money(m.esperado) : money(m.declarado)}
                {m.dif ? <span className={`ml-2 ${m.dif < 0 ? "text-mal" : "text-bien"}`}>{m.dif > 0 ? "+" : "−"}{money(Math.abs(m.dif))}</span> : null}
              </span>
            </div>
          ))}
          {ultimo.fondo !== null && ultimo.fondo !== undefined && (
            <div className="flex justify-between border-t border-borde mt-1.5 pt-1.5"><span>Quedó de fondo</span><span className="f-m">{money(ultimo.fondo)}</span></div>
          )}
        </div>
      )}
      {/* El monto de apertura entra en el arqueo: si no es el que hay de
          verdad en el cajón, el cierre nunca cuadra. */}
      <input value={apertura} onChange={(e) => { setTocada(true); setApertura(e.target.value.replace(/\D/g, "")); }} placeholder="Efectivo con el que arrancás"
        className={`${inputCls} mt-4`} />
      {/* Abrir es asincrónico: sin el candado, dos clics seguidos mandan dos
          aperturas antes de que vuelva la primera. */}
      <Boton className="mt-3 w-full" size="lg" disabled={abriendo}
        onClick={async () => { setAbriendo(true); try { await abrirCaja(Number(apertura || 0)); } finally { setAbriendo(false); } }}>
        {abriendo ? "Abriendo…" : `Abrir caja con ${money(Number(apertura || 0))}`}
      </Boton>
    </Card>
  );
}
