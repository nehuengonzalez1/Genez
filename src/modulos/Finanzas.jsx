/* ============================================================
   19. FINANZAS
   ============================================================

   Donde cierra todo lo demás. Los abonos vendidos entran como ingreso,
   las horas del equipo salen como sueldo, y el mes se puede mirar sin
   depender de que la caja del día esté abierta.

   La pantalla de Caja no se rehizo: es la de siempre y entra acá como una
   pestaña. Sigue resolviendo lo suyo —apertura, arqueo, cierre— que es el
   día, no el mes.

   La liquidación vive acá y no en "Clientes y equipo" porque **pagarle a
   alguien es un egreso**: con la liquidación colgando del módulo de
   personal, los egresos del mes mienten.
   ============================================================ */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, Check, ArrowDownRight, ArrowUpRight, Wallet, Calendar,
  ChevronLeft, ChevronRight, Receipt, StickyNote,
} from "lucide-react";
import {
  cargarMovimientos, registrarMovimiento, resumenDelMes, cargarPendientes,
  cargarLiquidaciones, liquidar, ajustarLiquidacion, pagarLiquidacion,
  cargarNotas, anotar, semanaDe, nombreCategoria,
  CATEGORIAS_EGRESO, CATEGORIAS_INGRESO,
} from "../datos/finanzas.js";
import { cargarEquipo } from "../datos/equipo.js";
import { money, moneyk, pct, nf } from "../utils/helpers.js";
import { Caja } from "./Caja.jsx";
import { Card, Kpi, Boton, Modal, Vacio, Tabs, Sello, Cargando, ErrorEstado } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { Drawer } from "../ui/Drawer.jsx";
import { BarraDato } from "../ui/Graficos.jsx";

const dia = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
const diaHora = (d) => `${dia(d)} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
const mesLargo = (d) => {
  const t = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/* ------------------------------------------------------------
   Cargar un movimiento a mano
   ------------------------------------------------------------ */

function FormMovimiento({ abierto, tipo, medios, cajaAbierta, onGuardar, onCerrar }) {
  const [d, setD] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setD({ medio: "efectivo", categoria: tipo === "egreso" ? "otros" : "otros", monto: "" });
    setError("");
  }, [abierto, tipo]);

  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));
  const categorias = tipo === "egreso" ? CATEGORIAS_EGRESO : CATEGORIAS_INGRESO;

  return (
    <Modal open onClose={onCerrar} ancho="max-w-md">
      <div className="p-5">
        <h3 className="f-d text-lg">{tipo === "egreso" ? "Registrar un gasto" : "Registrar un ingreso"}</h3>

        <div className="space-y-3 mt-4">
          <Campo label="Detalle">
            <input value={d.detalle || ""} onChange={(e) => set("detalle", e.target.value)} autoFocus
              placeholder={tipo === "egreso" ? "Alquiler de agosto" : "Venta de una crema"} className={inputCls} />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Monto">
              <input type="number" value={d.monto} onChange={(e) => set("monto", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Categoría">
              <select value={d.categoria} onChange={(e) => set("categoria", e.target.value)} className={inputCls}>
                {categorias.map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Medio">
            <select value={d.medio} onChange={(e) => set("medio", e.target.value)} className={inputCls}>
              {medios.map((m) => <option key={m.k} value={m.k}>{m.n}</option>)}
            </select>
          </Campo>

          {/* En efectivo sí toca la caja; por transferencia no, y obligar a
              abrirla sería inventar un arqueo que no existió. */}
          {d.medio === "efectivo" && !cajaAbierta && (
            <p className="text-sm text-ojo">
              No hay caja abierta, así que esto no va a entrar en el arqueo del día. Queda como movimiento del mes.
            </p>
          )}

          {error && <p className="text-sm text-mal">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={!d.detalle || !Number(d.monto) || guardando} onClick={async () => {
            setGuardando(true);
            const problema = await onGuardar({ ...d, tipo });
            setGuardando(false);
            if (problema) setError(problema); else onCerrar();
          }}>
            <Check size={15} /> Guardar
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   La pantalla
   ------------------------------------------------------------ */

export function Finanzas({ empresaId, caja, movCaja, abrirCaja, cerrarCaja, ajustes, permisos, toast }) {
  const [pestana, setPestana] = useState("resumen");
  const [mes, setMes] = useState(() => new Date());
  const [semana, setSemana] = useState(() => semanaDe());

  const [resumen, setResumen] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [equipo, setEquipo] = useState([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [cargar, setCargar] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [notas, setNotas] = useState([]);
  const [nota, setNota] = useState("");

  const medios = useMemo(() => (
    ((ajustes && ajustes.medios) || []).filter((m) => m.activo !== false)
  ), [ajustes]);

  const releer = useCallback(async () => {
    const desde = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const hasta = new Date(mes.getFullYear(), mes.getMonth() + 1, 1);
    const [r, m, p, l, e] = await Promise.all([
      resumenDelMes(empresaId, mes),
      cargarMovimientos(empresaId, { desde, hasta }),
      cargarPendientes(empresaId),
      cargarLiquidaciones(empresaId),
      cargarEquipo(empresaId),
    ]);
    setResumen(r);
    setMovimientos(m);
    setPendientes(p);
    setLiquidaciones(l);
    setEquipo(e);
  }, [empresaId, mes]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar las finanzas."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  useEffect(() => {
    if (!abierta) { setNotas([]); return; }
    let vigente = true;
    cargarNotas(empresaId, abierta.id)
      .then((xs) => { if (vigente) setNotas(xs); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [abierta, empresaId]);

  async function guardarMovimiento(d) {
    try {
      await registrarMovimiento({
        empresaId,
        /* Solo el efectivo toca la caja del día. Lo demás es del mes. */
        sesionId: d.medio === "efectivo" && caja && caja.abierta ? caja.sesionId : null,
        tipo: d.tipo, medio: d.medio, monto: Number(d.monto),
        detalle: d.detalle, categoria: d.categoria,
      });
      await releer();
      toast(d.tipo === "egreso" ? "Gasto registrado." : "Ingreso registrado.");
      return null;
    } catch (e) {
      return e.message || "No se pudo registrar.";
    }
  }

  const deLaSemana = liquidaciones.filter((l) => {
    const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
    return iso(l.desde) === semana.desde;
  });

  const sinLiquidar = equipo.filter((p) => !deLaSemana.some((l) => l.personalId === p.id));

  async function armar(personalId) {
    try {
      await liquidar(personalId, semana.desde, semana.hasta);
      await releer();
    } catch (e) {
      toast(e.message || "No se pudo armar la liquidación.", "mal");
    }
  }

  const totalPendiente = pendientes.reduce((s, p) => s + p.falta, 0);
  const aPagarSemana = deLaSemana.filter((l) => l.estado === "borrador").reduce((s, l) => s + l.aPagar, 0);

  return (
    <div className="space-y-4">
      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "resumen", n: "Resumen" },
        { k: "caja", n: "Caja" },
        { k: "movimientos", n: "Movimientos", badge: movimientos.length || null },
        { k: "pendientes", n: "Pendientes", badge: pendientes.length || null },
        { k: "liquidaciones", n: "Liquidaciones", badge: deLaSemana.length || null },
      ]} />

      {/* La caja es del día y se dibuja sola: no tiene mes ni filtros. */}
      {pestana === "caja" ? (
        <Caja caja={caja} movCaja={movCaja} toast={toast} ajustes={ajustes}
          abrirCaja={abrirCaja} cerrarCaja={cerrarCaja} />
      ) : error ? (
        <Card><ErrorEstado onReintentar={() => releer().catch((e) => setError(e.message))}>{error}</ErrorEstado></Card>
      ) : cargando ? (
        <Card><Cargando /></Card>
      ) : (
        <>
          {/* ---------- Selector de mes ---------- */}
          {(pestana === "resumen" || pestana === "movimientos") && (
            <div className="flex items-center gap-1">
              <button onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="p-2 rounded-lg border border-borde text-texto-suave hover:bg-superficie-2"><ChevronLeft size={15} /></button>
              <span className="f-d text-base px-2 min-w-[150px]">{mesLargo(mes)}</span>
              <button onClick={() => setMes((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="p-2 rounded-lg border border-borde text-texto-suave hover:bg-superficie-2"><ChevronRight size={15} /></button>
              <div className="ml-auto flex gap-2">
                <Boton size="sm" variant="ghost" onClick={() => setCargar("ingreso")}><Plus size={14} /> Ingreso</Boton>
                <Boton size="sm" variant="ghost" onClick={() => setCargar("egreso")}><Plus size={14} /> Gasto</Boton>
              </div>
            </div>
          )}

          {/* ---------- Resumen ---------- */}
          {pestana === "resumen" && resumen && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Ingresos del mes" icono={ArrowUpRight} valor={money(resumen.ingresos)}
                  delta={resumen.variacion} sub="vs. mes anterior" />
                <Kpi label="Egresos del mes" icono={ArrowDownRight} valor={money(resumen.egresos)}
                  tono={resumen.egresos > 0 ? "mal" : "neutro"} sub={`${nf.format(resumen.movimientos)} movimientos`} />
                <Kpi label="Resultado" icono={Wallet} valor={money(resumen.resultado)}
                  tono={resumen.resultado >= 0 ? "bien" : "mal"}
                  sub={`el mes pasado ${money(resumen.previo.resultado)}`} />
                <Kpi label="Falta cobrar" icono={Receipt} valor={money(totalPendiente)}
                  tono={totalPendiente > 0 ? "ojo" : "neutro"}
                  sub={`${nf.format(pendientes.length)} operaciones`} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">
                    Por dónde entró
                  </div>
                  {resumen.porMedio.length === 0 ? <Vacio>Todavía no entró nada este mes.</Vacio> : (
                    <div className="space-y-3">
                      {resumen.porMedio.map((x) => (
                        <BarraDato key={x.k} nombre={(medios.find((m) => m.k === x.k) || { n: x.k }).n}
                          valor={x.total} total={resumen.ingresos} formato={moneyk} />
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-semibold mb-3">
                    En qué se fue
                  </div>
                  {resumen.porCategoria.length === 0 ? <Vacio>No hubo gastos este mes.</Vacio> : (
                    <div className="space-y-3">
                      {resumen.porCategoria.map((x) => (
                        <BarraDato key={x.k} nombre={nombreCategoria(x.k)}
                          valor={x.total} total={resumen.egresos} formato={moneyk} />
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* ---------- Movimientos ---------- */}
          {pestana === "movimientos" && (
            <Card className="overflow-hidden">
              {movimientos.length === 0 ? (
                <Vacio>No hubo movimientos en {mesLargo(mes).toLowerCase()}.</Vacio>
              ) : (
                <ul className="divide-y divide-borde">
                  {movimientos.map((m) => (
                    <li key={m.id} className="px-4 py-2.5 flex items-center gap-3">
                      <span className="f-m text-xs text-texto-tenue w-24 shrink-0">{diaHora(m.fecha)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-texto truncate">{m.detalle || "Sin detalle"}</div>
                        <div className="text-[11px] text-texto-tenue">
                          {(medios.find((x) => x.k === m.medio) || { n: m.medio }).n}
                          {m.categoria && ` · ${nombreCategoria(m.categoria)}`}
                          {!m.sesionId && " · fuera de caja"}
                        </div>
                      </div>
                      <span className={`f-m text-sm shrink-0 ${m.tipo === "ingreso" ? "text-bien" : "text-mal"}`}>
                        {m.tipo === "ingreso" ? "+" : "−"}{money(m.monto)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {/* ---------- Pendientes ---------- */}
          {pestana === "pendientes" && (
            <Card className="overflow-hidden">
              {pendientes.length === 0 ? (
                <Vacio>No hay nada pendiente de cobro.</Vacio>
              ) : (
                <ul className="divide-y divide-borde">
                  {pendientes.map((p) => {
                    const dias = Math.floor((Date.now() - p.fecha) / 86400000);
                    return (
                      <li key={p.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                        <span className="f-m text-xs text-texto-tenue w-16 shrink-0">{dia(p.fecha)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-texto truncate">{p.cliente}</div>
                          <div className="text-[11px] text-texto-tenue">
                            {money(p.pagado)} de {money(p.total)}
                            {dias > 15 && ` · ${dias} días`}
                          </div>
                        </div>
                        {dias > 15 && <Sello tono="mal">Atrasado</Sello>}
                        <span className="f-m text-sm text-texto shrink-0">{money(p.falta)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}

          {/* ---------- Liquidaciones ---------- */}
          {pestana === "liquidaciones" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setSemana(semanaDe(new Date(semana.lunes.getTime() - 7 * 86400000)))}
                  className="p-2 rounded-lg border border-borde text-texto-suave hover:bg-superficie-2"><ChevronLeft size={15} /></button>
                <span className="f-d text-base px-1">
                  {dia(semana.lunes)} al {dia(semana.domingo)}
                </span>
                <button onClick={() => setSemana(semanaDe(new Date(semana.lunes.getTime() + 7 * 86400000)))}
                  className="p-2 rounded-lg border border-borde text-texto-suave hover:bg-superficie-2"><ChevronRight size={15} /></button>
                {aPagarSemana > 0 && (
                  <span className="f-m text-sm text-texto-suave ml-2">{money(aPagarSemana)} por pagar</span>
                )}
              </div>

              {sinLiquidar.length > 0 && (
                <Card className="p-3.5">
                  <div className="text-sm text-texto-suave mb-2">
                    Sin liquidar esta semana: las horas salen de la agenda y después se corrigen si hace falta.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sinLiquidar.map((p) => (
                      <Boton key={p.id} size="sm" variant="ghost" onClick={() => armar(p.id)}>
                        <Plus size={14} /> {p.nombre}
                      </Boton>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden">
                {deLaSemana.length === 0 ? (
                  <Vacio>Todavía no se armó ninguna liquidación de esta semana.</Vacio>
                ) : (
                  <ul className="divide-y divide-borde">
                    {deLaSemana.map((l) => (
                      <li key={l.id}>
                        <button onClick={() => setAbierta(l)}
                          className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-texto flex items-center gap-2">
                              {l.persona}
                              {l.notas > 0 && <StickyNote size={13} className="text-texto-tenue" />}
                            </div>
                            <div className="f-m text-[11px] text-texto-tenue">
                              {l.modalidad === "hora" ? `${l.horas} hs × ${money(l.valor)}`
                                : l.modalidad === "clase" ? `${l.clases} clases × ${money(l.valor)}`
                                : "sueldo fijo"}
                              {l.ajuste !== 0 && ` · ajuste ${money(l.ajuste)}`}
                            </div>
                          </div>
                          <Sello tono={l.estado === "pagada" ? "bien" : "ojo"}>
                            {l.estado === "pagada" ? "Pagada" : "Borrador"}
                          </Sello>
                          <span className="f-m text-sm text-texto shrink-0 w-24 text-right">{money(l.aPagar)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {/* ---------- El detalle de una liquidación ---------- */}
      <Drawer open={!!abierta} onClose={() => setAbierta(null)}
        titulo={abierta ? abierta.persona : ""}
        subtitulo={abierta ? `${dia(abierta.desde)} al ${dia(abierta.hasta)}` : ""}
        acciones={abierta && abierta.estado === "borrador" && (
          <div className="flex flex-wrap gap-2 items-center">
            {medios.slice(0, 3).map((m) => (
              <Boton key={m.k} size="sm" variant={m.k === "efectivo" ? "primary" : "ghost"}
                onClick={async () => {
                  try {
                    await pagarLiquidacion(abierta.id, m.k,
                      m.k === "efectivo" && caja && caja.abierta ? caja.sesionId : null);
                    await releer();
                    setAbierta(null);
                    toast(`${abierta.persona} pagado.`);
                  } catch (e) { toast(e.message || "No se pudo pagar.", "mal"); }
                }}>
                Pagar por {m.n.toLowerCase()}
              </Boton>
            ))}
          </div>
        )}>
        {abierta && (
          <div className="space-y-4">
            <Sello tono={abierta.estado === "pagada" ? "bien" : "ojo"}>
              {abierta.estado === "pagada" ? `Pagada por ${abierta.medio}` : "Borrador"}
            </Sello>

            <dl className="space-y-2 text-sm">
              {[
                ["Modalidad", abierta.modalidad === "hora" ? "Por hora" : abierta.modalidad === "clase" ? "Por clase" : abierta.modalidad === "fijo" ? "Sueldo fijo" : "Comisión"],
                ["Horas", `${abierta.horas} hs`],
                ["Clases dadas", nf.format(abierta.clases)],
                ["Valor", money(abierta.valor)],
                ["Subtotal", money(abierta.total)],
                ["Ajuste", money(abierta.ajuste)],
              ].map(([rot, val]) => (
                <div key={rot} className="flex gap-2">
                  <dt className="text-texto-tenue w-28 shrink-0">{rot}</dt>
                  <dd className="text-texto">{val}</dd>
                </div>
              ))}
              <div className="flex gap-2 pt-2 border-t border-borde">
                <dt className="text-texto w-28 shrink-0 font-semibold">A pagar</dt>
                <dd className="f-m text-texto font-semibold">{money(abierta.aPagar)}</dd>
              </div>
            </dl>

            {abierta.estado === "borrador" && (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Corregir horas">
                  <input type="number" step="0.5" defaultValue={abierta.horas} className={inputCls}
                    onBlur={async (e) => {
                      const h = Number(e.target.value);
                      if (h === abierta.horas) return;
                      try {
                        await ajustarLiquidacion(abierta.id, { horas: h });
                        await releer();
                        setAbierta((a) => ({ ...a, horas: h }));
                      } catch (err) { toast(err.message || "No se pudo.", "mal"); }
                    }} />
                </Campo>
                <Campo label="Ajuste (adelantos, extras)">
                  <input type="number" defaultValue={abierta.ajuste} className={inputCls}
                    onBlur={async (e) => {
                      const a = Number(e.target.value);
                      if (a === abierta.ajuste) return;
                      try {
                        await ajustarLiquidacion(abierta.id, { ajuste: a });
                        await releer();
                        setAbierta((x) => ({ ...x, ajuste: a }));
                      } catch (err) { toast(err.message || "No se pudo.", "mal"); }
                    }} />
                </Campo>
              </div>
            )}

            {/* Las notas van pegadas al período: son la explicación de por
                qué estas horas no cierran con lo habitual. */}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold mb-2">
                Notas de la semana
              </div>
              {notas.length === 0 ? (
                <p className="text-sm text-texto-tenue">Sin notas. Acá van los reemplazos y lo que haga falta explicar.</p>
              ) : (
                <ul className="space-y-2">
                  {notas.map((x) => (
                    <li key={x.id} className="text-sm">
                      <span className="f-m text-[11px] text-texto-tenue">{dia(x.fecha)}</span>
                      <p className="text-texto">{x.texto}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 mt-3">
                <input value={nota} onChange={(e) => setNota(e.target.value)}
                  placeholder="Cubrió a Carla el jueves…" className={inputCls} />
                <Boton size="sm" variant="ghost" disabled={!nota.trim()} onClick={async () => {
                  try {
                    await anotar(empresaId, abierta.id, nota.trim());
                    setNota("");
                    const xs = await cargarNotas(empresaId, abierta.id);
                    setNotas(xs);
                    await releer();
                  } catch (e) { toast(e.message || "No se pudo anotar.", "mal"); }
                }}>Anotar</Boton>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <FormMovimiento abierto={!!cargar} tipo={cargar} medios={medios}
        cajaAbierta={!!(caja && caja.abierta)}
        onGuardar={guardarMovimiento} onCerrar={() => setCargar(null)} />
    </div>
  );
}
