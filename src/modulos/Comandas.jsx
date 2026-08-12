/* ============================================================
   15. COMANDAS · salón, pedido y cocina
   ============================================================

   La otra forma de vender. En el mostrador el cobro nace y muere en el
   mismo acto; acá la mesa se abre, junta consumos durante una hora y
   recién al final se cobra.

   Tres pantallas para tres manos distintas: el mozo mira el salón y carga
   en el pedido con el celular en una mano, y la cocina lee una pantalla
   colgada en la pared que nadie va a tocar.

   Los totales, los tiempos y los estados los calcula la base (ver
   src/datos/comandas.js). Este archivo dibuja y traduce, no decide.
   ============================================================ */

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ArrowLeft, Users, Clock, Flame, Check, Plus, Minus, Trash2, Search,
  StickyNote, X, RefreshCw, ChefHat, Wallet
} from "lucide-react";
import { money, mediosDe, conRecargo, FISCAL_INICIAL } from "../utils/helpers.js";
import { siguienteNumero } from "../datos/ventas.js";
import {
  cargarSalon, abrirComanda, cargarComanda, cargarCarta, agregarLinea,
  anularLinea, cambiarEstadoLinea, cargarPendientes, cerrarComanda,
} from "../datos/comandas.js";
import { Card, Boton, Modal, Vacio } from "../ui/Base.jsx";

/* Los minutos se calculan contra el reloj real y no contra HOY: acá no se
   está mirando una serie histórica, se está mirando una mesa que espera. */
const minutosDesde = (fecha) =>
  fecha ? Math.max(0, Math.round((Date.now() - fecha.getTime()) / 60000)) : 0;

const espera = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

const activas = (lineas) => (lineas || []).filter((l) => l.estado !== "anulada");

/* ============================================================
   1. SALÓN
   ============================================================ */

export function Comandas({ empresaId, sucursalId = null, config = {}, ajustes, caja, toast }) {
  const [mesas, setMesas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [comandaId, setComandaId] = useState(null);
  const [abriendo, setAbriendo] = useState(null);

  /* toast se redefine en cada render de Sistema. Si entra como dependencia,
     el efecto de carga se vuelve a disparar para siempre. */
  const avisar = useRef(toast);
  avisar.current = toast;

  const leerSalon = useCallback(async () => {
    try {
      setMesas(await cargarSalon(empresaId));
    } catch (e) {
      avisar.current(e.message || "No pudimos cargar el salón.", "mal");
    } finally {
      setCargando(false);
    }
  }, [empresaId]);

  useEffect(() => { leerSalon(); }, [leerSalon]);

  const entrar = async (mesa) => {
    if (abriendo) return;
    if (mesa.comandaId) return setComandaId(mesa.comandaId);
    setAbriendo(mesa.id);
    try {
      const id = await abrirComanda({ empresaId, sucursalId, recursoId: mesa.id });
      setComandaId(id);
    } catch (e) {
      avisar.current(e.message || "No se pudo abrir la mesa.", "mal");
    } finally {
      setAbriendo(null);
    }
  };

  const volver = () => { setComandaId(null); leerSalon(); };

  if (comandaId) {
    return (
      <Pedido comandaId={comandaId} empresaId={empresaId} config={config}
        ajustes={ajustes} caja={caja} toast={toast} onVolver={volver} />
    );
  }

  const sectores = agrupar(mesas);
  const ocupadas = mesas.filter((m) => m.ocupada).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-stone-500">
            <strong className="text-stone-900 f-m">{ocupadas}</strong> ocupadas
          </span>
          <span className="text-stone-500">
            <strong className="text-stone-900 f-m">{mesas.length - ocupadas}</strong> libres
          </span>
          {ocupadas > 0 && (
            <span className="text-stone-500">
              <strong className="text-stone-900 f-m">
                {money(mesas.reduce((s, m) => s + m.consumido, 0))}
              </strong> en el salón
            </span>
          )}
        </div>
        <Boton size="sm" variant="ghost" className="ml-auto" onClick={leerSalon}>
          <RefreshCw size={14} /> Actualizar
        </Boton>
      </div>

      {cargando && <Vacio>Cargando el salón…</Vacio>}
      {!cargando && !mesas.length && (
        <Vacio>Todavía no hay mesas cargadas para este comercio.</Vacio>
      )}

      {sectores.map(([sector, delSector]) => (
        <section key={sector}>
          <h3 className="text-[11px] uppercase tracking-widest text-stone-400 font-bold mb-2">{sector}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {delSector.map((m) => <Mesa key={m.id} m={m} abriendo={abriendo === m.id} onTocar={() => entrar(m)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function agrupar(mesas) {
  const por = new Map();
  for (const m of mesas) {
    const s = m.sector || "Salón";
    if (!por.has(s)) por.set(s, []);
    por.get(s).push(m);
  }
  return [...por.entries()];
}

/* Libre y ocupada tienen que distinguirse sin leer: cambia el relleno, el
   borde y el peso del texto, no una etiqueta chiquita en un rincón. */
function Mesa({ m, abriendo, onTocar }) {
  return (
    <button onClick={onTocar} disabled={abriendo}
      className={`text-left rounded-2xl border-2 p-3 min-h-[112px] flex flex-col transition-colors disabled:opacity-50 ${
        m.ocupada
          ? "border-orange-400 bg-orange-50 hover:bg-orange-100"
          : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"}`}>
      <div className="flex items-start justify-between gap-1">
        <span className={`f-d text-base leading-tight ${m.ocupada ? "text-orange-700" : "text-stone-900"}`}>{m.nombre}</span>
        {m.capacidad ? (
          <span className="flex items-center gap-0.5 text-[11px] text-stone-400 shrink-0">
            <Users size={11} /> {m.capacidad}
          </span>
        ) : null}
      </div>

      {m.ocupada ? (
        <>
          <div className="f-m text-xl mt-auto text-stone-900">{money(m.consumido)}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-stone-500">
              <Clock size={11} /> {espera(m.minutos == null ? 0 : m.minutos)}
            </span>
            {m.enCocina > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                <Flame size={10} /> {m.enCocina}
              </span>
            )}
            {m.listos > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check size={10} /> {m.listos}
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="mt-auto text-sm text-stone-400">{abriendo ? "Abriendo…" : "Libre"}</div>
      )}
    </button>
  );
}

/* ============================================================
   2. PEDIDO
   ============================================================ */

function Pedido({ comandaId, empresaId, config, ajustes, caja, toast, onVolver }) {
  const [comanda, setComanda] = useState(null);
  const [carta, setCarta] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState("");
  const [detalle, setDetalle] = useState(null);   // item al que se le cargan modificadores
  const [cobrando, setCobrando] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [panel, setPanel] = useState("carta");    // solo manda en pantalla chica

  const avisar = useRef(toast);
  avisar.current = toast;

  /* Un mozo carga cuatro platos más rápido de lo que contesta el servidor.
     Las respuestas pueden volver desordenadas, así que solo se pinta la
     última pedida: si no, una lectura vieja borra de pantalla lo recién
     agregado. */
  const turno = useRef(0);

  const leerComanda = useCallback(async () => {
    const mio = ++turno.current;
    try {
      const c = await cargarComanda(comandaId);
      if (mio === turno.current) setComanda(c);
    } catch (e) {
      avisar.current(e.message || "No pudimos leer la comanda.", "mal");
    }
  }, [comandaId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.all([cargarComanda(comandaId), cargarCarta(empresaId)])
      .then(([c, ca]) => { if (vigente) { setComanda(c); setCarta(ca); } })
      .catch((e) => { if (vigente) avisar.current(e.message || "No pudimos abrir la mesa.", "mal"); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [comandaId, empresaId]);

  const filtrada = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return carta;
    return carta
      .map((g) => ({ ...g, items: g.items.filter((i) => i.nombre.toLowerCase().includes(t)) }))
      .filter((g) => g.items.length);
  }, [carta, q]);

  /* Agregar no se bloquea a sí mismo: quien toma el pedido no puede quedar
     esperando al servidor entre plato y plato. */
  const agregar = async (item, extra = {}) => {
    try {
      await agregarLinea({
        comandaId, empresaId, item,
        cantidad: extra.cantidad || 1,
        modificadores: extra.modificadores || [],
        notas: extra.notas || "",
        destino: item.destino,
      });
      await leerComanda();
    } catch (e) {
      avisar.current(e.message || "No se pudo agregar el pedido.", "mal");
    }
  };

  const anular = async (linea) => {
    if (trabajando) return;
    setTrabajando(true);
    try {
      await anularLinea(linea.id);
      await leerComanda();
    } catch (e) {
      avisar.current(e.message || "No se pudo anular.", "mal");
    } finally {
      setTrabajando(false);
    }
  };

  /* Una mesa que se tocó por error queda ocupada para siempre si no hay
     forma de soltarla. Sin líneas se cierra sin pagos: no hay venta que
     registrar, pero la mesa se libera igual. */
  const liberar = async () => {
    if (!caja.sesionId) return avisar.current("Abrí la caja antes de liberar la mesa.", "mal");
    setTrabajando(true);
    try {
      await cerrarComanda({ comandaId, sesionId: caja.sesionId, pagos: [] });
      avisar.current(`${comanda.mesa} quedó libre.`);
      onVolver();
    } catch (e) {
      avisar.current(e.message || "No se pudo liberar la mesa.", "mal");
      setTrabajando(false);
    }
  };

  if (cargando || !comanda) {
    return (
      <div>
        <Boton variant="quiet" onClick={onVolver}><ArrowLeft size={16} /> Salón</Boton>
        <Vacio>Abriendo la mesa…</Vacio>
      </div>
    );
  }

  const lineas = activas(comanda.lineas);
  const items = lineas.reduce((s, l) => s + l.cantidad, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Boton variant="ghost" size="lg" onClick={onVolver}><ArrowLeft size={18} /> Salón</Boton>
        <div className="min-w-0">
          <div className="f-d text-lg leading-tight truncate">{comanda.mesa}</div>
          <div className="text-[11px] text-stone-400">
            {comanda.sector}{comanda.abiertaEn ? ` · hace ${espera(minutosDesde(comanda.abiertaEn))}` : ""}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Total</div>
          <div className="f-m text-xl">{money(comanda.total)}</div>
        </div>
      </div>

      {/* En el celular no entran las dos cosas: se muestra una y se cambia
          con un botón grande, sin menús. */}
      <div className="lg:hidden grid grid-cols-2 gap-2">
        <Boton size="lg" variant={panel === "carta" ? "dark" : "ghost"} onClick={() => setPanel("carta")}>Carta</Boton>
        <Boton size="lg" variant={panel === "comanda" ? "dark" : "ghost"} onClick={() => setPanel("comanda")}>
          Comanda {items > 0 ? `(${items})` : ""}
        </Boton>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
        <div className={panel === "carta" ? "" : "hidden lg:block"}>
          <Card className="overflow-hidden">
            <div className="px-3 py-2.5 border-b border-stone-200 flex items-center gap-2">
              <Search size={16} className="text-stone-400 shrink-0" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la carta"
                className="w-full text-base outline-none bg-transparent" />
              {q && <button onClick={() => setQ("")} className="text-stone-400 shrink-0"><X size={16} /></button>}
            </div>

            {!filtrada.length && <Vacio>Ningún plato con ese nombre.</Vacio>}

            <div className="max-h-[62vh] overflow-auto">
              {filtrada.map((g) => (
                <div key={g.categoria}>
                  <div className="sticky top-0 z-10 bg-stone-100 px-3 py-1.5 text-[11px] uppercase tracking-widest text-stone-500 font-bold">
                    {g.categoria}
                  </div>
                  <ul className="divide-y divide-stone-100">
                    {g.items.map((i) => (
                      <li key={i.id} className="flex items-stretch">
                        <button onClick={() => agregar(i)}
                          className="flex-1 min-w-0 text-left px-3 py-3 hover:bg-stone-50 active:bg-stone-100">
                          <div className="text-base leading-tight truncate">{i.nombre}</div>
                          <div className="f-m text-sm text-stone-500 mt-0.5">{money(i.precio)}</div>
                        </button>
                        <button onClick={() => setDetalle(i)} title="Modificadores y nota"
                          className="w-14 shrink-0 flex items-center justify-center text-stone-400 hover:text-stone-900 hover:bg-stone-100 border-l border-stone-100">
                          <StickyNote size={18} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className={panel === "comanda" ? "" : "hidden lg:block"}>
          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h3 className="f-d">Lo que lleva la mesa</h3>
              <span className="text-[11px] text-stone-400">{items} item{items === 1 ? "" : "s"}</span>
            </div>

            {!lineas.length ? (
              <Vacio>Todavía no pidieron nada. Tocá un plato de la carta.</Vacio>
            ) : (
              <ul className="divide-y divide-stone-100 max-h-[46vh] overflow-auto">
                {lineas.map((l) => (
                  <li key={l.id} className="flex items-start gap-2 px-3 py-2.5">
                    <span className="f-m text-sm font-bold text-stone-500 shrink-0 w-7 pt-0.5">{l.cantidad}×</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm leading-tight">{l.nombre}</div>
                      {(l.modificadores || []).map((m, x) => (
                        <div key={x} className="text-[11px] text-stone-500">
                          · {m.nombre}{m.precio ? ` (+${money(m.precio)})` : ""}
                        </div>
                      ))}
                      {l.notas && <div className="text-[11px] text-amber-700 italic">{l.notas}</div>}
                      {l.estado !== "pedido" && (
                        <div className="text-[10px] uppercase tracking-wider text-stone-400 font-bold mt-0.5">{l.estado}</div>
                      )}
                    </div>
                    <span className="f-m text-sm shrink-0">{money(l.total)}</span>
                    <button onClick={() => anular(l)} disabled={trabajando} title="Anular"
                      className="shrink-0 text-stone-300 hover:text-red-600 disabled:opacity-40 p-1">
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-stone-200 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-stone-500">Total</span>
                <span className="f-m text-2xl">{money(comanda.total)}</span>
              </div>
              {lineas.length ? (
                <Boton size="lg" className="w-full mt-3" onClick={() => setCobrando(true)}>
                  <Wallet size={17} /> Cobrar la mesa
                </Boton>
              ) : (
                <Boton size="lg" variant="ghost" className="w-full mt-3" disabled={trabajando} onClick={liberar}>
                  Liberar la mesa
                </Boton>
              )}
            </div>
          </Card>
        </div>
      </div>

      <ModalDetalle item={detalle} onCerrar={() => setDetalle(null)}
        onAgregar={(extra) => { const i = detalle; setDetalle(null); agregar(i, extra); }} />

      <ModalCobro abierto={cobrando} comanda={comanda} comandaId={comandaId} empresaId={empresaId}
        config={config} ajustes={ajustes} caja={caja} toast={toast}
        onCerrar={() => setCobrando(false)} onCobrada={onVolver} />
    </div>
  );
}

/* --- Modificadores y nota ----------------------------------------------
   No hay lista fija de modificadores a propósito: cada cocina tiene los
   suyos y cambian de una semana a la otra. El que toma el pedido escribe
   lo que le dijeron, y le pone precio solo si lo tiene.                  */
function ModalDetalle({ item, onCerrar, onAgregar }) {
  const [cantidad, setCantidad] = useState(1);
  const [mods, setMods] = useState([]);
  const [texto, setTexto] = useState("");
  const [precio, setPrecio] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => {
    if (!item) return;
    setCantidad(1); setMods([]); setTexto(""); setPrecio(""); setNotas("");
  }, [item]);

  if (!item) return null;

  const sumarMod = () => {
    if (!texto.trim()) return;
    setMods((m) => [...m, { nombre: texto.trim(), precio: Number(precio) || 0 }]);
    setTexto(""); setPrecio("");
  };

  const extra = mods.reduce((s, m) => s + (Number(m.precio) || 0), 0);
  const unitario = item.precio + extra;

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <h3 className="f-d text-lg leading-tight">{item.nombre}</h3>
        <div className="f-m text-sm text-stone-500">{money(item.precio)}</div>

        <div className="flex items-center gap-3 mt-4">
          <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold flex-1">Cantidad</span>
          <Boton variant="ghost" size="lg" onClick={() => setCantidad((c) => Math.max(1, c - 1))}><Minus size={18} /></Boton>
          <span className="f-m text-2xl w-10 text-center">{cantidad}</span>
          <Boton variant="ghost" size="lg" onClick={() => setCantidad((c) => c + 1)}><Plus size={18} /></Boton>
        </div>

        <div className="mt-4">
          <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Cómo lo quieren</span>
          {mods.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 mt-1.5">
              {mods.map((m, i) => (
                <li key={i} className="flex items-center gap-1.5 text-sm bg-stone-100 rounded-xl pl-2.5 pr-1.5 py-1">
                  {m.nombre}{m.precio ? <span className="f-m text-stone-500">+{money(m.precio)}</span> : null}
                  <button onClick={() => setMods((xs) => xs.filter((_, x) => x !== i))} className="text-stone-400 hover:text-red-600">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-1.5 mt-1.5">
            <input value={texto} onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sumarMod(); } }}
              placeholder="Sin cebolla, extra queso…"
              className="flex-1 min-w-0 border border-stone-200 rounded-xl px-3 py-2.5 text-base outline-none focus:border-orange-400" />
            <input value={precio} onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sumarMod(); } }}
              placeholder="$"
              className="f-m w-20 shrink-0 text-right border border-stone-200 rounded-xl px-2 py-2.5 text-base outline-none focus:border-orange-400" />
            <Boton variant="ghost" size="lg" disabled={!texto.trim()} onClick={sumarMod}><Plus size={18} /></Boton>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">El precio es opcional. Si lo ponés, se suma a la línea.</p>
        </div>

        <label className="block mt-4">
          <span className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Nota para la cocina</span>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej: que salga con el resto"
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-base mt-1 outline-none focus:border-orange-400" />
        </label>

        <Boton size="lg" className="w-full mt-5"
          onClick={() => onAgregar({ cantidad, modificadores: mods, notas: notas.trim() })}>
          Agregar · {money(unitario * cantidad)}
        </Boton>
        <Boton variant="quiet" className="w-full mt-1.5" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Modal>
  );
}

/* --- Cobrar la mesa ---------------------------------------------------- */
function ModalCobro({ abierto, comanda, comandaId, empresaId, config, ajustes, caja, toast, onCerrar, onCobrada }) {
  const [sel, setSel] = useState(0);
  const [cobrando, setCobrando] = useState(false);

  useEffect(() => { if (abierto) { setSel(0); setCobrando(false); } }, [abierto]);
  if (!abierto) return null;

  const medios = mediosDe(ajustes);
  const medio = medios[sel] || medios[0];
  const rec = conRecargo(comanda.total, medio);

  /* El punto de venta sale de la configuración del comercio: `ajustes`
     todavía arranca con los datos del minimercado y numeraría la mesa en
     la serie equivocada. */
  const puntoVenta =
    (config.fiscal && config.fiscal.puntoVenta) ||
    (ajustes.fiscal || FISCAL_INICIAL).puntoVenta || "0001";

  const cobrar = async () => {
    if (cobrando) return;
    if (!caja.abierta || !caja.sesionId) {
      toast("Abrí la caja antes de cobrar la mesa.", "mal");
      return;
    }
    setCobrando(true);
    try {
      await cerrarComanda({
        comandaId,
        sesionId: caja.sesionId,
        pagos: [{ medio: medio.k, monto: rec.total, recargo: rec.recargo }],
        numero: siguienteNumero(empresaId, puntoVenta),
        recargo: rec.recargo,
      });
      toast(`${comanda.mesa} cobrada · ${money(rec.total)}`);
      onCobrada();
    } catch (e) {
      // La caja cerrada llega por acá con el mensaje ya escrito en claro.
      toast(e.message || "No se pudo cobrar la mesa.", "mal");
      setCobrando(false);
    }
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <div className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Cobrar</div>
        <h3 className="f-d text-lg">{comanda.mesa}</h3>

        <div className="mt-4 space-y-2">
          {medios.map((m, i) => (
            <button key={m.k} onClick={() => setSel(i)}
              className={`w-full flex items-center justify-between gap-2 text-left px-4 py-3.5 rounded-xl border-2 ${
                i === sel ? "border-orange-400 bg-orange-50" : "border-stone-200 hover:bg-stone-50"}`}>
              <span className="text-base font-semibold">{m.n}</span>
              {m.recargo && m.tasa > 0 && (
                <span className="f-m text-xs text-stone-500">+{m.tasa}%</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-baseline justify-between mt-5">
          <span className="text-sm text-stone-500">Total a cobrar</span>
          <span className="f-m text-3xl">{money(rec.total)}</span>
        </div>
        {rec.recargo > 0 && (
          <div className="text-xs text-stone-500 text-right">
            {money(comanda.total)} + {money(rec.recargo)} de recargo
          </div>
        )}

        <Boton size="lg" className="w-full mt-4" disabled={cobrando} onClick={cobrar}>
          <Check size={18} /> {cobrando ? "Cobrando…" : "Cobrar y liberar la mesa"}
        </Boton>
        <Boton variant="quiet" className="w-full mt-1.5" onClick={onCerrar}>Volver al pedido</Boton>
      </div>
    </Modal>
  );
}

/* ============================================================
   3. COCINA
   ============================================================

   Una pantalla colgada en la pared, mirada de lejos y con las manos
   ocupadas: texto grande, tres columnas y un solo botón por comanda.
   Se refresca sola porque nadie la va a tocar para actualizarla.
   ============================================================ */

const COLUMNAS = [
  { k: "pedido", n: "Pedido", sig: "preparando", accion: "Empezar" },
  { k: "preparando", n: "Preparando", sig: "listo", accion: "Listo" },
  { k: "listo", n: "Listo", sig: "entregado", accion: "Entregado" },
];

export function Cocina({ empresaId, config = {}, toast }) {
  const destinos = config.destinos || [];
  const [destino, setDestino] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [cargando, setCargando] = useState(true);

  const avisar = useRef(toast);
  avisar.current = toast;
  const releer = useRef(() => {});

  useEffect(() => {
    let vivo = true;
    const leer = async () => {
      try {
        const d = await cargarPendientes(empresaId, destino);
        if (vivo) setLineas(d);
      } catch (e) {
        if (vivo) avisar.current(e.message || "No pudimos leer la cocina.", "mal");
      } finally {
        if (vivo) setCargando(false);
      }
    };
    releer.current = leer;
    leer();
    const id = setInterval(leer, 15000);
    return () => { vivo = false; clearInterval(id); };
  }, [empresaId, destino]);

  /* El cambio se pinta antes de que conteste el servidor: el que cocina
     tocó el botón y necesita ver que pasó, no esperar a la red. */
  const mover = async (l, estado) => {
    setLineas((xs) => estado === "entregado"
      ? xs.filter((x) => x.id !== l.id)
      : xs.map((x) => (x.id === l.id ? { ...x, estado } : x)));
    try {
      await cambiarEstadoLinea(l.id, estado);
    } catch (e) {
      avisar.current(e.message || "No se pudo cambiar el estado.", "mal");
    }
    releer.current();
  };

  return (
    <div className="space-y-4">
      {destinos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Boton size="lg" variant={destino === null ? "dark" : "ghost"} onClick={() => setDestino(null)}>Todo</Boton>
          {destinos.map((d) => (
            <Boton key={d} size="lg" variant={destino === d ? "dark" : "ghost"} onClick={() => setDestino(d)}>
              <ChefHat size={16} /> {d}
            </Boton>
          ))}
        </div>
      )}

      {cargando && <Vacio>Cargando…</Vacio>}
      {!cargando && !lineas.length && <Vacio>No hay nada esperando. Cocina al día.</Vacio>}

      <div className="grid md:grid-cols-3 gap-3 items-start">
        {COLUMNAS.map((col) => {
          const suyas = lineas.filter((l) => l.estado === col.k);
          return (
            <div key={col.k}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="f-d text-base">{col.n}</h3>
                <span className="f-m text-sm text-stone-400">{suyas.length}</span>
              </div>
              <div className="space-y-2">
                {suyas.map((l) => <Comanda key={l.id} l={l} col={col} onMover={mover} />)}
                {!suyas.length && (
                  <div className="rounded-2xl border-2 border-dashed border-stone-200 py-6 text-center text-xs text-stone-300">
                    vacío
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Comanda({ l, col, onMover }) {
  const min = minutosDesde(l.enviadaEn || l.desde);
  // Lo que espera hace rato tiene que gritar desde el otro lado de la cocina.
  const tono = min >= 20 ? "border-red-200 bg-red-50" : min >= 10 ? "border-amber-200 bg-amber-50" : "border-stone-200 bg-white";

  return (
    <div className={`rounded-2xl border-2 p-3 ${tono}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="f-d text-xl leading-none">{l.mesa}</span>
        <span className="f-m text-xs text-stone-500 shrink-0">{espera(min)}</span>
      </div>
      <div className="text-base mt-2 leading-tight">
        <span className="f-m font-bold">{l.cantidad}×</span> {l.nombre}
      </div>
      {(l.modificadores || []).map((m, i) => (
        <div key={i} className="text-sm text-stone-600">· {m.nombre}</div>
      ))}
      {l.notas && <div className="text-sm italic text-amber-700 mt-1">{l.notas}</div>}
      {l.destino && <div className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mt-1">{l.destino}</div>}
      <Boton size="lg" className="w-full mt-3" variant={col.k === "listo" ? "dark" : "primary"}
        onClick={() => onMover(l, col.sig)}>
        {col.accion}
      </Boton>
    </div>
  );
}
