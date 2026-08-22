/* ============================================================
   18. VENTAS · abonos, packs y planes
   ============================================================

   Un estudio de pilates cobra ocho clases en marzo y las consume hasta
   mayo. Esta pantalla es la que hace que la caja pueda reflejar eso: sin
   ella, un martes sin cobrar un peso parece un mal martes cuando puede
   ser el mejor mes del año.

   Los planes son items del catálogo, así que venderlos pasa por el mismo
   camino que cualquier venta: operación, línea, pago y movimiento de
   caja. Acá arriba solo se elige el plan y el cliente.

   El crédito se descuenta al reservar, no al asistir. Se ve en la agenda,
   no acá: esta pantalla muestra cuánto queda, no lo gasta.
   ============================================================ */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Check, Search, Ticket, Calendar, X } from "lucide-react";
import {
  cargarAbonos, cargarPlanes, guardarPlan, venderAbono, anularAbono,
  cargarConsumos, estadoAbono,
} from "../datos/abonos.js";
import { estadoDe } from "../datos/agenda.js";
import { money, nf } from "../utils/helpers.js";
import { Card, Boton, Modal, Vacio, Tabs, Sello, Cargando, ErrorEstado } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";
import { Drawer } from "../ui/Drawer.jsx";

const fecha = (d) => (d ? d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");

/* Cómo se lee un plan en una línea: "8 clases · 60 días · 2 por semana". */
function condiciones(p) {
  const partes = [];
  partes.push(p.clases ? `${p.clases} ${p.clases === 1 ? "clase" : "clases"}` : "libre");
  if (p.vigenciaDias) partes.push(`${p.vigenciaDias} días`);
  if (p.topeSemanal) partes.push(`${p.topeSemanal} por semana`);
  return partes.join(" · ");
}

/* ------------------------------------------------------------
   Vender un abono
   ------------------------------------------------------------ */

function FormVenta({ abierto, planes, clientes, medios, cajaAbierta, onGuardar, onCerrar }) {
  const [d, setD] = useState({});
  const [buscando, setBuscando] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    setD({ medio: "efectivo", cobrar: true });
    setBuscando("");
    setError("");
  }, [abierto]);

  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));

  const plan = planes.find((p) => p.id === d.itemId) || null;
  const cliente = clientes.find((c) => c.id === d.clienteId) || null;
  const precio = d.precio !== undefined && d.precio !== "" ? Number(d.precio) : (plan ? plan.precio : 0);

  const norm = (t) => String(t || "").toLowerCase();
  const coincidencias = buscando.trim().length >= 1
    ? clientes.filter((c) => norm(c.razonSocial).includes(norm(buscando))).slice(0, 6)
    : [];

  const falta = !d.clienteId || !d.itemId;

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">Vender un abono</h3>

        <div className="space-y-3 mt-4">
          <Campo label="Cliente">
            {cliente ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="flex-1 text-sm text-texto border border-borde rounded-lg px-2.5 py-1.5 truncate">
                  {cliente.razonSocial}
                </span>
                <button onClick={() => set("clienteId", null)} title="Quitar"
                  className="p-2 rounded-lg text-texto-tenue hover:text-mal hover:bg-superficie-2"><X size={15} /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-texto-tenue" />
                  <input value={buscando} onChange={(e) => setBuscando(e.target.value)}
                    placeholder={clientes.length ? "Buscar un cliente" : "Todavía no hay clientes cargados"}
                    className={`${inputCls} pl-8`} autoFocus />
                </div>
                {coincidencias.length > 0 && (
                  <ul className="mt-1 border border-borde rounded-lg divide-y divide-borde max-h-40 overflow-auto">
                    {coincidencias.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => { set("clienteId", c.id); setBuscando(""); }}
                          className="w-full text-left px-2.5 py-1.5 text-sm hover:bg-superficie-2">{c.razonSocial}</button>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Un abono es de alguien: no hay "consumidor final" acá.
                    Sin cliente no se sabe de quién es el crédito. */}
                {clientes.length === 0 && (
                  <p className="text-xs text-texto-suave mt-1">
                    Un abono es de una persona, así que hace falta tenerla cargada en Clientes.
                  </p>
                )}
              </>
            )}
          </Campo>

          <Campo label="Plan">
            <select value={d.itemId || ""} onChange={(e) => set("itemId", e.target.value || null)} className={inputCls}>
              <option value="">Elegir…</option>
              {planes.filter((p) => p.activo).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} — {money(p.precio)}</option>
              ))}
            </select>
          </Campo>

          {plan && (
            <p className="text-xs text-texto-suave -mt-1">
              {condiciones(plan)}
              {plan.vigenciaDias && ` · vence el ${fecha(new Date(Date.now() + plan.vigenciaDias * 86400000))}`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Precio">
              <input type="number" value={d.precio !== undefined ? d.precio : (plan ? plan.precio : "")}
                onChange={(e) => set("precio", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Medio de pago">
              <select value={d.medio} onChange={(e) => set("medio", e.target.value)}
                disabled={!d.cobrar} className={inputCls}>
                {medios.map((m) => <option key={m.k} value={m.k}>{m.n}</option>)}
              </select>
            </Campo>
          </div>

          <label className="flex items-center gap-2 text-sm text-texto-suave">
            <input type="checkbox" checked={d.cobrar} onChange={(e) => set("cobrar", e.target.checked)} />
            Cobrarlo ahora
          </label>
          {!d.cobrar && (
            <p className="text-xs text-texto-suave -mt-1">
              El abono queda activo y la venta con saldo pendiente. Aparece en Finanzas como cuenta por cobrar.
            </p>
          )}

          {d.cobrar && !cajaAbierta && (
            <p className="text-sm text-ojo">
              No hay caja abierta. Abrila en Caja, o destildá “cobrarlo ahora” y cobralo después.
            </p>
          )}

          {error && <p className="text-sm text-mal">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={falta || guardando || (d.cobrar && !cajaAbierta)} onClick={async () => {
            setGuardando(true);
            const problema = await onGuardar({ ...d, precio });
            setGuardando(false);
            if (problema) setError(problema); else onCerrar();
          }}>
            <Check size={15} /> {guardando ? "Guardando…" : d.cobrar ? `Cobrar ${money(precio)}` : "Guardar sin cobrar"}
          </Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   El catálogo de planes
   ------------------------------------------------------------ */

function FormPlan({ abierto, inicial, onGuardar, onCerrar }) {
  const [d, setD] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (abierto) setD({ activo: true, precio: 0, ...(inicial || {}) });
  }, [abierto, inicial]);

  if (!abierto) return null;
  const set = (c, v) => setD((x) => ({ ...x, [c]: v }));

  return (
    <Modal open onClose={onCerrar} ancho="max-w-lg">
      <div className="p-5">
        <h3 className="f-d text-lg">{d.id ? "Editar plan" : "Nuevo plan"}</h3>

        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Campo label="Nombre">
                <input value={d.nombre || ""} onChange={(e) => set("nombre", e.target.value)}
                  placeholder="Pack 8 clases" autoFocus className={inputCls} />
              </Campo>
            </div>
            <Campo label="Precio">
              <input type="number" value={d.precio} onChange={(e) => set("precio", e.target.value)} className={inputCls} />
            </Campo>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Campo label="Clases">
              <input type="number" min="1" value={d.clases ?? ""} onChange={(e) => set("clases", e.target.value)}
                placeholder="vacío = libre" className={inputCls} />
            </Campo>
            <Campo label="Días de vigencia">
              <input type="number" min="1" value={d.vigenciaDias ?? ""} onChange={(e) => set("vigenciaDias", e.target.value)}
                placeholder="sin vencimiento" className={inputCls} />
            </Campo>
            <Campo label="Tope semanal">
              <input type="number" min="1" value={d.topeSemanal ?? ""} onChange={(e) => set("topeSemanal", e.target.value)}
                placeholder="sin tope" className={inputCls} />
            </Campo>
          </div>

          <p className="text-xs text-texto-suave">
            Sin clases es un plan libre: se paga el período y se viene lo que el tope semanal permita.
            El tope se controla al reservar, que es cuando importa.
          </p>

          <label className="flex items-center gap-2 text-sm text-texto-suave">
            <input type="checkbox" checked={d.activo !== false} onChange={(e) => set("activo", e.target.checked)} />
            Se puede vender
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-borde">
          <Boton variant="ghost" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={!d.nombre || guardando} onClick={async () => {
            setGuardando(true);
            const ok = await onGuardar(d);
            setGuardando(false);
            if (ok) onCerrar();
          }}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------
   La pantalla
   ------------------------------------------------------------ */

export function Ventas({ empresaId, sucursalId, clientes, ajustes, caja, permisos, toast, ir }) {
  const [pestana, setPestana] = useState("abonos");
  const [abonos, setAbonos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [vendiendo, setVendiendo] = useState(false);
  const [editandoPlan, setEditandoPlan] = useState(null);
  const [abierto, setAbierto] = useState(null);
  const [consumos, setConsumos] = useState([]);

  const releer = useCallback(async () => {
    const [a, p] = await Promise.all([cargarAbonos(empresaId), cargarPlanes(empresaId)]);
    setAbonos(a);
    setPlanes(p);
  }, [empresaId]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    releer()
      .catch((e) => { if (vigente) setError(e.message || "No pudimos cargar los abonos."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [releer]);

  useEffect(() => {
    if (!abierto) { setConsumos([]); return; }
    let vigente = true;
    cargarConsumos(empresaId, abierto.id)
      .then((xs) => { if (vigente) setConsumos(xs); })
      .catch(() => {});
    return () => { vigente = false; };
  }, [abierto, empresaId]);

  const medios = useMemo(() => (
    ((ajustes && ajustes.medios) || []).filter((m) => m.activo !== false)
  ), [ajustes]);

  const norm = (t) => String(t || "").toLowerCase();
  const lista = useMemo(() => (
    q.trim().length >= 2
      ? abonos.filter((a) => norm(a.cliente).includes(norm(q)) || norm(a.nombre).includes(norm(q)))
      : abonos
  ), [abonos, q]);

  const activos = abonos.filter((a) => a.estado === "activo");
  const porVencer = activos.filter((a) => a.vence && (a.vence - Date.now()) / 86400000 <= 7);

  async function vender(d) {
    try {
      await venderAbono({
        empresaId, sucursalId,
        clienteId: d.clienteId,
        itemId: d.itemId,
        precio: Number(d.precio) || 0,
        sesionId: d.cobrar ? (caja && caja.sesionId) || null : null,
        pagos: d.cobrar ? [{ medio: d.medio, monto: Number(d.precio) || 0 }] : [],
      });
      await releer();
      toast("Abono vendido.");
      return null;
    } catch (e) {
      return e.message || "No se pudo vender.";
    }
  }

  async function grabarPlan(d) {
    try {
      await guardarPlan(empresaId, d);
      await releer();
      toast(`${d.nombre} guardado.`);
      return true;
    } catch (e) {
      toast(e.message || "No se pudo guardar el plan.", "mal");
      return false;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {pestana === "abonos" && (
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente o plan"
              className="w-full pl-9 pr-3 py-2 text-sm border border-borde rounded-xl outline-none focus:border-acento bg-superficie" />
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          {pestana === "planes"
            ? <Boton size="sm" onClick={() => setEditandoPlan({})}><Plus size={14} /> Nuevo plan</Boton>
            : <Boton size="sm" onClick={() => setVendiendo(true)}><Plus size={14} /> Vender un abono</Boton>}
        </div>
      </div>

      <Tabs value={pestana} onChange={setPestana} items={[
        { k: "abonos", n: "Abonos", badge: activos.length || null },
        { k: "planes", n: "Planes", badge: planes.length || null },
      ]} />

      {porVencer.length > 0 && pestana === "abonos" && (
        <Card className="p-3.5 flex items-center gap-3">
          <Calendar size={16} className="text-ojo shrink-0" />
          <p className="text-sm text-texto-suave">
            {porVencer.length === 1
              ? `Hay un abono que vence esta semana: ${porVencer[0].cliente}.`
              : `Hay ${porVencer.length} abonos que vencen esta semana.`}
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        {error ? (
          <ErrorEstado onReintentar={() => releer().catch((e) => setError(e.message))}>{error}</ErrorEstado>
        ) : cargando ? (
          <Cargando />
        ) : pestana === "planes" ? (
          planes.length === 0 ? (
            <Vacio>
              Todavía no hay planes. Son lo que se vende: un pack de clases, una cuota mensual.
            </Vacio>
          ) : (
            <ul className="divide-y divide-borde">
              {planes.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setEditandoPlan(p)}
                    className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-texto">{p.nombre}</div>
                      <div className="f-m text-[11px] text-texto-tenue">{condiciones(p)}</div>
                    </div>
                    {!p.activo && <Sello tono="tenue">No se vende</Sello>}
                    <span className="f-m text-sm text-texto shrink-0">{money(p.precio)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : lista.length === 0 ? (
          <Vacio>
            {abonos.length === 0
              ? "Todavía no se vendió ningún abono. Cargá primero los planes y después vendelos."
              : "Ningún abono coincide con esa búsqueda."}
          </Vacio>
        ) : (
          <ul className="divide-y divide-borde">
            {lista.map((a) => {
              const e = estadoAbono(a.estado);
              return (
                <li key={a.id}>
                  <button onClick={() => setAbierto(a)}
                    className="w-full text-left px-4 py-3 hover:bg-superficie-2 flex flex-wrap items-center gap-3">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-superficie-2 flex items-center justify-center">
                      <Ticket size={16} className="text-texto-suave" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-texto truncate">{a.cliente}</div>
                      <div className="f-m text-[11px] text-texto-tenue truncate">
                        {a.nombre}{a.vence ? ` · vence ${fecha(a.vence)}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="f-m text-sm text-texto">
                        {a.clases === null ? "libre" : `${a.restantes} de ${a.clases}`}
                      </div>
                      {a.topeSemanal && (
                        <div className="text-[11px] text-texto-tenue">{a.topeSemanal} por semana</div>
                      )}
                    </div>
                    <Sello tono={e.tono}>{e.n}</Sello>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Drawer open={!!abierto} onClose={() => setAbierto(null)}
        titulo={abierto ? abierto.cliente : ""}
        subtitulo={abierto ? abierto.nombre : ""}
        acciones={abierto && abierto.estado !== "anulado" && (
          <button onClick={async () => {
            try {
              await anularAbono(abierto.id);
              await releer();
              setAbierto(null);
              toast("Abono anulado.");
            } catch (e) { toast(e.message || "No se pudo anular.", "mal"); }
          }} className="text-xs font-semibold text-mal hover:underline px-2">Anular abono</button>
        )}>
        {abierto && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sello tono={estadoAbono(abierto.estado).tono}>{estadoAbono(abierto.estado).n}</Sello>
              {abierto.clases !== null && (
                <Sello tono={abierto.restantes > 0 ? "bien" : "mal"}>
                  {abierto.restantes} de {abierto.clases}
                </Sello>
              )}
            </div>

            <dl className="space-y-2 text-sm">
              {[
                ["Desde", fecha(abierto.desde)],
                ["Vence", abierto.vence ? fecha(abierto.vence) : "sin vencimiento"],
                ["Usadas", nf.format(abierto.usadas)],
                ["Tope semanal", abierto.topeSemanal ? `${abierto.topeSemanal} por semana` : "sin tope"],
              ].map(([rot, val]) => (
                <div key={rot} className="flex gap-2">
                  <dt className="text-texto-tenue w-28 shrink-0">{rot}</dt>
                  <dd className="text-texto">{val}</dd>
                </div>
              ))}
            </dl>

            <div>
              <div className="text-[10px] uppercase tracking-widest text-texto-tenue font-bold mb-2">
                En qué se usó
              </div>
              {consumos.length === 0 ? (
                <Vacio>Todavía no se tomó ningún turno con este abono.</Vacio>
              ) : (
                <ul className="space-y-1.5">
                  {consumos.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-sm">
                      <span className="f-m text-xs text-texto-tenue w-16 shrink-0">{fecha(t.desde)}</span>
                      <span className="truncate flex-1 text-texto">{t.servicio || "Turno"}</span>
                      <Sello tono={estadoDe(t.estado).tono}>{estadoDe(t.estado).n}</Sello>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <FormVenta abierto={vendiendo} planes={planes} clientes={clientes} medios={medios}
        cajaAbierta={!!(caja && caja.abierta)} onGuardar={vender} onCerrar={() => setVendiendo(false)} />

      <FormPlan abierto={!!editandoPlan} inicial={editandoPlan}
        onGuardar={grabarPlan} onCerrar={() => setEditandoPlan(null)} />
    </div>
  );
}
