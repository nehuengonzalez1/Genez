/* ============================================================
   CUENTA CORRIENTE · el fiado
   ============================================================

   Super 25 le fía a mucha gente, y hasta acá la deuda de cada uno se veía
   entrando a la ficha de cada cliente, de a uno. Esta pantalla contesta
   lo que se pregunta el dueño: cuánto hay en la calle, quién debe, desde
   cuándo, y qué pasó con cada cuenta.

   Lo de adentro —cobrar, anular, ajustar, el límite— es `EstadoDeCuenta`,
   que usa también la ficha del cliente: tiene que ser la misma cuenta y
   el mismo saldo miren desde donde se mire.

   Quién puede qué:
   - Cobrar lo puede cualquiera que vea esta pantalla: es tarea de
     mostrador, el cliente viene a pagar y alguien lo atiende.
   - Anular un pago, cargar o perdonar deuda y fijar el límite piden
     `ajustarCuentas` (dueño y encargado de fábrica). La base lo verifica
     igual (0085); acá solo se esconden los botones.
   ============================================================ */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, Printer, MessageCircle, X, Ban, Wallet } from "lucide-react";
import { money, nf, hora, mediosDe, linkWhatsapp, MEDIO_CUENTA_CORRIENTE } from "../utils/helpers.js";
import { fdatel } from "../datos/generador.js";
import {
  cargarDeudores, cargarResumenCuentas, cargarEstadoDeCuenta, cobrarCuenta, anularPago,
  ajustarCuenta, anularAjuste, fijarLimite, limiteDe,
} from "../datos/cuentas.js";
import { Card, Boton, Kpi, Modal, Vacio, armarLineas, imprimirComandera } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

const dias = (d) => (d ? Math.floor((Date.now() - d.getTime()) / 86400000) : null);
const hace = (d) => {
  const n = dias(d);
  if (n == null) return "—";
  if (n === 0) return "hoy";
  if (n === 1) return "ayer";
  return `hace ${n} días`;
};
const aNumero = (s) => Number(String(s || "").replace(/[^\d]/g, "")) || 0;
const inicioDelMes = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; };

const TIPOS = {
  venta: { n: "Compra fiada", tono: "text-texto" },
  pago: { n: "Pago", tono: "text-bien" },
  cargo: { n: "Cargo manual", tono: "text-ojo" },
  descuento: { n: "Descuento", tono: "text-bien" },
};

/* ------------------------------------------------------------
   La pantalla
   ------------------------------------------------------------ */

export function CuentasCorrientes({ empresaId, clientes = [], permisos = {}, caja, ajustes, toast, alMoverCaja, alCambiarClientes }) {
  const [deudores, setDeudores] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(null);
  const [nuevo, setNuevo] = useState(false);

  const recargar = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([
        cargarDeudores(empresaId),
        cargarResumenCuentas(empresaId, inicioDelMes(), new Date(Date.now() + 60000)),
      ]);
      setDeudores(d); setResumen(r); setError(null);
    } catch (e) {
      setError(e.message || "No se pudieron leer las cuentas corrientes.");
    }
  }, [empresaId]);

  useEffect(() => { recargar(); }, [recargar]);

  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lista = useMemo(() => (deudores || []).filter((d) => !q.trim() || norm(d.nombre).includes(norm(q.trim()))), [deudores, q]);

  const cliente = abierto && (clientes.find((c) => c.id === abierto) || (deudores || []).map((d) => ({ id: d.clienteId, razonSocial: d.nombre, tel: d.tel, limiteCredito: d.limite })).find((c) => c.id === abierto));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="En la calle" valor={resumen ? money(resumen.enLaCalle) : "…"} tono={resumen && resumen.enLaCalle > 0 ? "mal" : "neutro"}
          sub={resumen ? `${nf.format(resumen.deudores)} ${resumen.deudores === 1 ? "cliente debe" : "clientes deben"}` : ""} />
        <Kpi label="Fiado este mes" valor={resumen ? money(resumen.fiado + resumen.cargos) : "…"}
          sub={resumen && resumen.cargos ? `${money(resumen.cargos)} en cargos manuales` : "en compras"} />
        <Kpi label="Cobrado este mes" valor={resumen ? money(resumen.cobrado) : "…"} tono="bien" />
        <Kpi label="Perdonado este mes" valor={resumen ? money(resumen.descuentos) : "…"} sub="descuentos manuales" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-borde">
          <h3 className="f-d text-lg mr-auto">Quién debe</h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente"
              className="border border-borde rounded-md pl-8 pr-3 py-1.5 text-sm bg-superficie outline-none focus:border-acento w-56" />
          </div>
          <Boton size="sm" variant="ghost" onClick={() => setNuevo(true)}>
            <Plus size={14} /> Abrir la cuenta de un cliente
          </Boton>
        </div>

        {error && <p className="px-5 py-3 text-sm text-mal">{error}</p>}
        {!deudores && !error ? (
          <p className="px-5 py-4 text-sm text-texto-tenue">Cargando…</p>
        ) : lista.length === 0 ? (
          <div className="p-5"><Vacio>{q ? "Ningún cliente con deuda coincide con la búsqueda." : "Nadie debe nada. Cuando se fíe desde el cobro, las cuentas aparecen acá."}</Vacio></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-texto-tenue border-b border-borde">
                <th className="px-5 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold text-right">Debe</th>
                <th className="px-3 py-2 font-semibold hidden md:table-cell">Límite</th>
                <th className="px-3 py-2 font-semibold hidden md:table-cell">Última compra</th>
                <th className="px-5 py-2 font-semibold hidden md:table-cell">Último pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {lista.map((d) => {
                const usado = d.limite ? Math.min(1, d.saldo / d.limite) : null;
                const pasado = d.limite != null && d.saldo > d.limite;
                const sinPagar = dias(d.ultimoPago || d.ultimaCompra);
                return (
                  <tr key={d.clienteId} onClick={() => setAbierto(d.clienteId)} className="hover:bg-superficie-2 cursor-pointer">
                    <td className="px-5 py-3">
                      <div className="font-medium text-texto">{d.nombre}</div>
                      {d.tel && <div className="text-xs text-texto-tenue">{d.tel}</div>}
                    </td>
                    <td className={`px-3 py-3 text-right f-m font-semibold ${d.saldo > 0 ? "text-mal" : "text-bien"}`}>
                      {d.saldo < 0 ? `A favor ${money(-d.saldo)}` : money(d.saldo)}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {d.limite == null ? <span className="text-texto-tenue text-xs">Sin límite</span> : (
                        <div className="w-32">
                          <div className={`text-xs f-m ${pasado ? "text-mal font-semibold" : "text-texto-suave"}`}>{money(d.limite)}{pasado ? " · pasado" : ""}</div>
                          <div className="h-1 bg-superficie-2 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full rounded-full ${pasado ? "bg-mal" : usado > 0.8 ? "bg-ojo" : "bg-bien"}`} style={{ width: `${Math.max(0, usado) * 100}%` }} />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell text-texto-suave">{hace(d.ultimaCompra)}</td>
                    <td className={`px-5 py-3 hidden md:table-cell ${d.saldo > 0 && sinPagar != null && sinPagar > 30 ? "text-mal" : "text-texto-suave"}`}>
                      {d.ultimoPago ? hace(d.ultimoPago) : "nunca"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {cliente && (
        <Modal open onClose={() => setAbierto(null)} ancho="max-w-3xl">
          <EstadoDeCuenta cliente={cliente} permisos={permisos} caja={caja} ajustes={ajustes} toast={toast}
            alCambiar={() => { recargar(); if (alMoverCaja) alMoverCaja(); if (alCambiarClientes) alCambiarClientes(); }} onCerrar={() => setAbierto(null)} />
        </Modal>
      )}

      {nuevo && (
        <ElegirCliente clientes={clientes} onCerrar={() => setNuevo(false)}
          onElegir={(c) => { setNuevo(false); setAbierto(c.id); }} />
      )}
    </div>
  );
}

/* Para abrir la cuenta de alguien que todavía no debe: el fiado del
   cuaderno se carga así, como un cargo manual en un cliente cualquiera. */
function ElegirCliente({ clientes, onCerrar, onElegir }) {
  const [q, setQ] = useState("");
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const lista = clientes.filter((c) => c.activo !== false && (!q.trim() || norm(c.razonSocial).includes(norm(q)) || String(c.doc || "").includes(q))).slice(0, 30);
  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <h3 className="f-d text-lg">Abrir la cuenta de un cliente</h3>
        <p className="text-sm text-texto-suave mt-1">Para cargar lo que debía antes de Genez, o fijarle un límite antes de que compre fiado. Si no está, se da de alta en Clientes.</p>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o documento" className={`${inputCls} mt-4`} />
        <ul className="mt-3 max-h-80 overflow-auto divide-y divide-borde border border-borde rounded-md">
          {lista.length === 0 && <li className="px-3 py-3 text-sm text-texto-tenue">No hay clientes que coincidan.</li>}
          {lista.map((c) => (
            <li key={c.id}>
              <button onClick={() => onElegir(c)} className="w-full text-left px-3 py-2.5 hover:bg-superficie-2">
                <div className="text-sm font-medium">{c.razonSocial}</div>
                <div className="text-xs text-texto-tenue">{[c.doc, c.tel].filter(Boolean).join(" · ") || "Sin datos de contacto"}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   El estado de cuenta de un cliente
   ------------------------------------------------------------ */

export function EstadoDeCuenta({ cliente, permisos = {}, caja, ajustes, toast, alCambiar, onCerrar }) {
  const [movs, setMovs] = useState(null);
  const [error, setError] = useState(null);
  const [accion, setAccion] = useState(null);   // cobrar | cargo | descuento | limite | { anular }
  const [limite, setLimite] = useState(cliente.limiteCredito ?? null);
  const puedeAjustar = !!permisos.ajustarCuentas;

  const recargar = useCallback(async () => {
    limiteDe(cliente.id).then(setLimite).catch(() => {});
    try { setMovs(await cargarEstadoDeCuenta(cliente.id)); setError(null); }
    catch (e) { setError(e.message || "No se pudo leer la cuenta."); }
  }, [cliente.id]);
  useEffect(() => { recargar(); }, [recargar]);

  const saldo = movs && movs.length ? movs[movs.length - 1].saldo : 0;
  const hecho = (msg) => { toast(msg); setAccion(null); recargar(); if (alCambiar) alCambiar(); };

  const texto = () => {
    const vivos = (movs || []).filter((m) => !m.anulado).slice(-8);
    return [
      `Hola ${cliente.razonSocial}, te paso el resumen de tu cuenta en ${ajustes.negocio || "el negocio"}:`,
      ...vivos.map((m) => `${fdatel(m.fecha)} · ${TIPOS[m.tipo].n}${m.tipo === "venta" ? "" : ` (${m.detalle})`}: ${m.debe ? money(m.debe) : "-" + money(m.haber)}`),
      "",
      saldo > 0 ? `Saldo a pagar: ${money(saldo)}` : saldo < 0 ? `Tenés a favor ${money(-saldo)}` : "Estás al día. ¡Gracias!",
    ].join("\n");
  };

  const imprimir = () => {
    const W = ajustes.ancho === 58 ? 32 : 48;
    const vivos = (movs || []).filter((m) => !m.anulado);
    const b = [
      { t: "c", v: String(ajustes.negocio || "").toUpperCase() },
      { t: "c", v: "ESTADO DE CUENTA" },
      { t: "sep", c: "=" },
      { t: "w", v: `CLIENTE: ${cliente.razonSocial.toUpperCase()}` },
      { t: "lr", a: "Fecha", b: `${fdatel(new Date())} ${hora(new Date())}` },
      { t: "sep" },
      ...vivos.flatMap((m) => [
        { t: "lr", a: `${fdatel(m.fecha)} ${TIPOS[m.tipo].n.toUpperCase()}`, b: m.debe ? money(m.debe) : "-" + money(m.haber) },
        ...(m.tipo === "venta" ? [] : [{ t: "w", v: `  ${m.detalle}` }]),
      ]),
      { t: "sep", c: "=" },
      { t: "lr", a: saldo < 0 ? "SALDO A FAVOR" : "SALDO", b: money(Math.abs(saldo)) },
      { t: "sep", c: "=" },
      { t: "c", v: "NO VALIDO COMO FACTURA" },
    ];
    imprimirComandera(armarLineas(W, b), ajustes.ancho, null, toast);
  };

  const wa = cliente.tel ? linkWhatsapp(cliente.tel, texto()) : null;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="f-d text-xl truncate">{cliente.razonSocial}</h3>
          <p className="text-sm text-texto-suave mt-0.5">
            {limite == null ? "Sin límite de crédito" : `Límite ${money(limite)}`}
            {puedeAjustar && <button onClick={() => setAccion("limite")} className="ml-2 text-acento hover:underline text-xs font-semibold">cambiar</button>}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold">{saldo < 0 ? "A favor" : "Debe"}</div>
          <div className={`f-d text-3xl ${saldo > 0 ? "text-mal" : saldo < 0 ? "text-bien" : "text-texto"}`}>{money(Math.abs(saldo))}</div>
          {limite != null && saldo > limite && <div className="text-xs text-mal font-semibold">Pasó el límite por {money(saldo - limite)}</div>}
        </div>
        {onCerrar && <button onClick={onCerrar} className="text-texto-tenue hover:text-texto p-1 -mr-2 -mt-2"><X size={18} /></button>}
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <Boton onClick={() => setAccion("cobrar")} disabled={saldo <= 0}><Wallet size={15} /> Cobrar</Boton>
        {puedeAjustar && <Boton variant="ghost" onClick={() => setAccion("cargo")}>Cargar deuda</Boton>}
        {puedeAjustar && <Boton variant="ghost" onClick={() => setAccion("descuento")} disabled={saldo <= 0}>Descontar deuda</Boton>}
        <span className="flex-1" />
        <Boton variant="quiet" onClick={imprimir} disabled={!movs || !movs.length}><Printer size={15} /> Imprimir</Boton>
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-md text-texto-suave hover:text-texto hover:bg-superficie-2"><MessageCircle size={15} /> WhatsApp</a>}
      </div>

      {accion && (
        <FormAccion accion={accion} cliente={cliente} saldo={saldo} limite={limite} caja={caja} ajustes={ajustes} toast={toast}
          onCancelar={() => setAccion(null)}
          onLimite={(l) => { setLimite(l); hecho(l == null ? "Límite quitado." : `Límite fijado en ${money(l)}.`); }}
          onHecho={hecho} />
      )}

      <div className="mt-5 border border-borde rounded-lg overflow-hidden">
        {error && <p className="px-4 py-3 text-sm text-mal">{error}</p>}
        {!movs && !error ? <p className="px-4 py-3 text-sm text-texto-tenue">Cargando…</p> : movs && movs.length === 0 ? (
          <p className="px-4 py-4 text-sm text-texto-tenue">Todavía no tiene movimientos. Las compras fiadas aparecen solas; lo que debía de antes se carga con "Cargar deuda".</p>
        ) : movs && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.1em] text-texto-tenue border-b border-borde">
                <th className="px-4 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Movimiento</th>
                <th className="px-3 py-2 font-semibold text-right">Debe</th>
                <th className="px-3 py-2 font-semibold text-right">Pagó</th>
                <th className="px-3 py-2 font-semibold text-right">Saldo</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {[...movs].reverse().map((m) => {
                const anulable = puedeAjustar && !m.anulado && m.tipo !== "venta";
                return (
                  <tr key={`${m.tipo}-${m.id}`} className={m.anulado ? "opacity-50" : ""}>
                    <td className="px-4 py-2.5 f-m text-xs text-texto-suave whitespace-nowrap">{fdatel(m.fecha)} {hora(m.fecha)}</td>
                    <td className="px-3 py-2.5">
                      <div className={`${m.anulado ? "line-through" : ""} ${TIPOS[m.tipo].tono}`}>
                        {TIPOS[m.tipo].n}{m.tipo === "pago" && m.medio ? ` · ${m.medio}` : ""}
                      </div>
                      <div className="text-xs text-texto-tenue">
                        {m.tipo === "venta" ? m.detalle : m.detalle !== "Pago" ? m.detalle : ""}
                        {m.usuario && <span>{m.detalle && m.detalle !== "Pago" ? " · " : ""}{m.usuario}</span>}
                      </div>
                      {m.anulado && <div className="text-xs text-mal">Anulado{m.motivo ? `: ${m.motivo}` : ""}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right f-m">{m.debe ? money(m.debe) : ""}</td>
                    <td className="px-3 py-2.5 text-right f-m text-bien">{m.haber ? money(m.haber) : ""}</td>
                    <td className="px-3 py-2.5 text-right f-m font-semibold">{m.anulado ? "" : money(m.saldo)}</td>
                    <td className="pr-3">
                      {anulable && (
                        <button title="Anular" onClick={() => setAccion({ anular: m })} className="text-texto-tenue hover:text-mal p-1"><Ban size={14} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-texto-tenue mt-2">
        Una compra fiada se corrige desde la venta, no desde acá: la cuenta la toma tal como quedó.
      </p>
    </div>
  );
}

/* El formulario de cada acción, arriba de la tabla y no en otra ventana:
   se decide mirando la cuenta. */
function FormAccion({ accion, cliente, saldo, limite, caja, ajustes, toast, onCancelar, onLimite, onHecho }) {
  const medios = mediosDe(ajustes).filter((m) => m.k !== MEDIO_CUENTA_CORRIENTE);
  const [monto, setMonto] = useState(accion === "cobrar" ? String(Math.max(0, Math.round(saldo))) : accion === "limite" ? (limite == null ? "" : String(limite)) : "");
  const [medio, setMedio] = useState((medios[0] || { k: "efectivo" }).k);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const sesionId = caja && caja.abierta ? caja.sesionId : null;

  const correr = async (fn) => {
    setGuardando(true);
    try { await fn(); } catch (e) { toast(e.message || "No se pudo guardar.", "mal"); } finally { setGuardando(false); }
  };

  const anular = accion && accion.anular;
  let titulo, cuerpo, confirmar;

  if (anular) {
    const esPago = anular.tipo === "pago";
    titulo = `Anular ${esPago ? "el pago" : anular.tipo === "cargo" ? "el cargo" : "el descuento"} de ${money(anular.debe || anular.haber)} del ${fdatel(anular.fecha)}`;
    cuerpo = (
      <>
        {esPago && (
          <p className="text-sm text-texto-suave">La plata sale de la caja abierta con un egreso del mismo medio ({anular.medio}), y la deuda vuelve a la cuenta.{!sesionId && <span className="text-mal"> Abrí la caja primero.</span>}</p>
        )}
        <Campo label="Por qué se anula">
          <input autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: se cargó dos veces" className={inputCls} />
        </Campo>
      </>
    );
    confirmar = () => correr(async () => {
      if (esPago) await anularPago(anular.id, sesionId, texto);
      else await anularAjuste(anular.id, texto);
      onHecho("Anulado. Quedó registrado quién y por qué.");
    });
  } else if (accion === "cobrar") {
    const n = aNumero(monto);
    titulo = "Cobrar";
    cuerpo = (
      <>
        <div className="flex flex-wrap gap-3">
          <Campo label="Importe" ancho="w-40">
            <input autoFocus inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))} className={`${inputCls} f-m`} />
          </Campo>
          <Campo label="Medio" ancho="w-44">
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className={inputCls}>
              {medios.map((m) => <option key={m.k} value={m.k}>{m.n}</option>)}
            </select>
          </Campo>
          <Campo label="Nota (opcional)" ancho="flex-1 min-w-[10rem]">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: pagó la quincena" className={inputCls} />
          </Campo>
        </div>
        {n > saldo && <p className="text-xs text-mal">Es más de lo que debe ({money(saldo)}).</p>}
        {!sesionId && <p className="text-xs text-mal">Abrí la caja antes de cobrar: es plata que entra al cajón.</p>}
        {n > 0 && n < saldo && <p className="text-xs text-texto-tenue">Pago parcial: le quedan {money(saldo - n)}.</p>}
      </>
    );
    confirmar = () => correr(async () => {
      await cobrarCuenta(cliente.id, sesionId, n, medio, texto || null);
      onHecho(`Cobrado ${money(n)}. Entró a la caja.`);
    });
  } else if (accion === "cargo" || accion === "descuento") {
    titulo = accion === "cargo" ? "Cargar deuda" : "Descontar deuda";
    cuerpo = (
      <>
        <p className="text-sm text-texto-suave">
          {accion === "cargo"
            ? "Deuda que no viene de una venta en Genez: lo que debía en el cuaderno, un envase, un error. No mueve la caja."
            : "Deuda que se perdona, toda o una parte. No mueve la caja."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Campo label="Importe" ancho="w-40">
            <input autoFocus inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))} className={`${inputCls} f-m`} />
          </Campo>
          <Campo label="Motivo" ancho="flex-1 min-w-[12rem]">
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={accion === "cargo" ? "Ej.: saldo del cuaderno al 24/09" : "Ej.: redondeo, arreglo con el cliente"} className={inputCls} />
          </Campo>
        </div>
      </>
    );
    confirmar = () => correr(async () => {
      await ajustarCuenta(cliente.id, accion, aNumero(monto), texto);
      onHecho(accion === "cargo" ? "Deuda cargada." : "Deuda descontada.");
    });
  } else if (accion === "limite") {
    titulo = "Límite de crédito";
    cuerpo = (
      <>
        <p className="text-sm text-texto-suave">Hasta cuánto se le puede fiar. El cajero no lo puede pasar; dueño y encargado sí, con aviso. Vacío: sin límite.</p>
        <Campo label="Límite" ancho="w-40">
          <input autoFocus inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d]/g, ""))} placeholder="Sin límite" className={`${inputCls} f-m`} />
        </Campo>
      </>
    );
    confirmar = () => correr(async () => {
      const l = monto === "" ? null : aNumero(monto);
      await fijarLimite(cliente.id, l);
      onLimite(l);
    });
  }

  const listo = anular ? texto.trim() && (anular.tipo !== "pago" || sesionId)
    : accion === "cobrar" ? aNumero(monto) > 0 && aNumero(monto) <= saldo && sesionId
    : accion === "limite" ? true
    : aNumero(monto) > 0 && texto.trim();

  return (
    <div className="mt-4 rounded-lg border border-borde bg-superficie-2 p-4 space-y-3">
      <div className="font-semibold text-sm">{titulo}</div>
      {cuerpo}
      <div className="flex justify-end gap-2">
        <Boton variant="quiet" onClick={onCancelar}>Cancelar</Boton>
        <Boton variant={anular ? "danger" : "primary"} onClick={confirmar} disabled={!listo || guardando}>
          {guardando ? "Guardando…" : anular ? "Anular" : "Confirmar"}
        </Boton>
      </div>
    </div>
  );
}
