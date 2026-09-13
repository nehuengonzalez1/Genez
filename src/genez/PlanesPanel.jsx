/* ============================================================
   PLANES Y PRECIOS · lo que la plataforma ofrece y cobra
   ============================================================

   Vive en el panel de plataforma y edita la tabla `planes` (0073). Es lo
   que después lee el alta guiada para decir "lo que vas a pagar para
   empezar": si acá no hay nada, allá dice "a confirmar", nunca un número
   inventado.

   Los módulos base van siempre incluidos y no se pueden sacar: sin cobro,
   caja y ajustes no hay sistema que vender.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Check } from "lucide-react";
import { MODULOS, MODULOS_BASE } from "../datos/modulos.js";
import { cargarPlanes, guardarPlan } from "../datos/planes.js";
import { cargarRubrosPublicos, RUBROS_DE_FABRICA } from "../datos/landing.js";
import { money, nf } from "../utils/helpers.js";
import { Boton, Modal } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

const claveDe = (nombre) =>
  String(nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

const precioDe = (p) => (p.precioMensual == null ? "a confirmar" : `${money(p.precioMensual)}/mes`);

export function PlanesPanel() {
  const [planes, setPlanes] = useState([]);
  const [rubros, setRubros] = useState(RUBROS_DE_FABRICA);
  const [estado, setEstado] = useState("cargando");   // cargando | listo | error
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    let vigente = true;
    cargarPlanes()
      .then((ps) => { if (vigente) { setPlanes(ps); setEstado("listo"); } })
      .catch(() => { if (vigente) setEstado("error"); });
    cargarRubrosPublicos()
      .then((rs) => { if (vigente && rs.length) setRubros(rs); })
      .catch(() => { /* quedan los de fábrica: son los mismos */ });
    return () => { vigente = false; };
  }, []);

  const guardar = async (plan) => {
    const guardado = await guardarPlan(plan);
    setPlanes((ps) => {
      const otros = ps.filter((p) => p.clave !== guardado.clave);
      return [...otros, guardado].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"));
    });
    setEditando(null);
  };

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <h2 className="text-[11px] uppercase tracking-widest text-texto-suave font-bold">Planes y precios</h2>
          <p className="text-sm text-texto-tenue">Lo que ve el alta guiada al final: qué incluye cada plan y cuánto cuesta empezar.</p>
        </div>
        <Boton size="sm" onClick={() => setEditando({ nuevo: true, nombre: "", clave: "", bajada: "", precioMensual: "", puestaEnMarcha: 0, modulos: [...MODULOS_BASE], rubros: [], orden: (planes.length + 1) * 10, activo: true })}>
          <Plus size={14} /> Nuevo plan
        </Boton>
      </div>

      <div className="bg-superficie-3 border border-borde-fuerte rounded-2xl divide-y divide-borde-fuerte">
        {estado === "cargando" && <p className="p-4 text-sm text-texto-suave">Cargando…</p>}
        {estado === "error" && (
          <p className="p-4 text-sm text-texto-suave">
            No se pudieron leer los planes. Si la tabla todavía no existe en esta base, hay que aplicar la migración 0073.
          </p>
        )}
        {estado === "listo" && planes.length === 0 && (
          <p className="p-4 text-sm text-texto-suave">Todavía no hay planes: el alta guiada muestra "precio a confirmar" hasta que cargues el primero.</p>
        )}
        {planes.map((p) => (
          <div key={p.clave} className={`p-4 flex flex-wrap items-start gap-3 ${p.activo ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{p.nombre}</span>
                {!p.activo && <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-borde-fuerte text-texto-suave">Apagado</span>}
              </div>
              {p.bajada && <div className="text-sm text-texto-suave mt-0.5">{p.bajada}</div>}
              <div className="flex flex-wrap gap-1 mt-2">
                {p.modulos.map((k) => (
                  <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-superficie text-texto-tenue">{(MODULOS.find((m) => m.k === k) || { n: k }).n}</span>
                ))}
              </div>
              <div className="text-[11px] text-texto-tenue mt-2">
                {p.rubros.length ? `Para: ${p.rubros.map((r) => (rubros.find((x) => x.clave === r) || { nombre: r }).nombre).join(", ")}` : "Para todos los rubros"}
                {p.puestaEnMarcha > 0 && ` · puesta en marcha ${money(p.puestaEnMarcha)}`}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="f-m text-lg">{precioDe(p)}</div>
              <button onClick={() => setEditando({ ...p })} className="text-xs font-semibold text-texto-suave hover:text-texto mt-1">Editar</button>
            </div>
          </div>
        ))}
      </div>

      <FormPlan plan={editando} rubros={rubros} existentes={planes} onCerrar={() => setEditando(null)} onGuardar={guardar} />
    </section>
  );
}

function FormPlan({ plan, rubros, existentes, onCerrar, onGuardar }) {
  const [d, setD] = useState(plan);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { setD(plan); setError(null); }, [plan]);
  if (!plan || !d) return null;

  const set = (campo, valor) => setD((x) => ({ ...x, [campo]: valor }));
  const alternar = (lista, k) => set(lista, d[lista].includes(k) ? d[lista].filter((x) => x !== k) : [...d[lista], k]);

  const clave = d.nuevo ? (d.clave || claveDe(d.nombre)) : d.clave;
  const claveRepetida = d.nuevo && existentes.some((p) => p.clave === clave);
  const puedeGuardar = d.nombre.trim() && clave && !claveRepetida && !guardando;

  const guardar = async () => {
    setGuardando(true); setError(null);
    try {
      await onGuardar({ ...d, clave, modulos: Array.from(new Set([...MODULOS_BASE, ...d.modulos])) });
    } catch (e) {
      setError(e.message || "No se pudo guardar el plan.");
    }
    setGuardando(false);
  };

  return (
    <Modal open onClose={onCerrar} ancho="max-w-2xl">
      <div className="p-5">
        <h3 className="f-d text-lg">{d.nuevo ? "Nuevo plan" : `Editar ${plan.nombre}`}</h3>

        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <Campo label="Nombre">
            <input value={d.nombre} onChange={(e) => set("nombre", e.target.value)} autoFocus className={inputCls} placeholder="Base, Completo, Turnos…" />
          </Campo>
          <Campo label={d.nuevo ? "Clave (sale del nombre)" : "Clave"}>
            <input value={clave} onChange={(e) => set("clave", claveDe(e.target.value))} disabled={!d.nuevo} className={`${inputCls} f-m`} />
            {claveRepetida && <p className="text-xs text-mal mt-1">Ya hay un plan con esa clave.</p>}
          </Campo>
          <div className="md:col-span-2">
            <Campo label="Bajada (una línea, la ve quien elige)">
              <input value={d.bajada} onChange={(e) => set("bajada", e.target.value)} className={inputCls} />
            </Campo>
          </div>
          <Campo label="Precio mensual (vacío = a confirmar)">
            <input value={d.precioMensual ?? ""} onChange={(e) => set("precioMensual", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Puesta en marcha (una sola vez, 0 si no se cobra)">
            <input value={d.puestaEnMarcha ?? 0} onChange={(e) => set("puestaEnMarcha", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className={`${inputCls} f-m text-right`} />
          </Campo>
          <Campo label="Orden">
            <input value={d.orden} onChange={(e) => set("orden", e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" className={`${inputCls} f-m text-right w-24`} />
          </Campo>
          <Campo label="Estado">
            <button type="button" onClick={() => set("activo", !d.activo)}
              className={`text-xs font-semibold px-2.5 py-2 rounded-lg border ${d.activo ? "border-bien bg-bien-suave text-bien" : "border-borde text-texto-suave"}`}>
              {d.activo ? "Se ofrece" : "Apagado"}
            </button>
          </Campo>
        </div>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mb-2">Módulos incluidos</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {MODULOS.map((m) => {
              const base = MODULOS_BASE.includes(m.k);
              const activo = base || d.modulos.includes(m.k);
              return (
                <button key={m.k} type="button" disabled={base} onClick={() => alternar("modulos", m.k)}
                  className={`flex items-center gap-2 text-left rounded-lg border px-3 py-2 text-sm ${activo ? "border-acento/60 bg-acento-suave/40" : "border-borde"} ${base ? "opacity-70" : ""}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${activo ? "bg-acento border-acento text-sobre-acento" : "border-borde-fuerte"}`}>
                    {activo && <Check size={12} />}
                  </span>
                  <span className="min-w-0">
                    <span className="font-medium">{m.n}</span>
                    <span className="block text-[11px] text-texto-tenue truncate">{base ? "Siempre incluido" : m.d}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5">
          <div className="text-[11px] uppercase tracking-widest text-texto-tenue font-bold mb-2">Se ofrece a</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => set("rubros", [])}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${d.rubros.length === 0 ? "border-acento text-texto bg-acento-suave/40" : "border-borde text-texto-suave"}`}>
              Todos los rubros
            </button>
            {rubros.map((r) => (
              <button key={r.clave} type="button" onClick={() => alternar("rubros", r.clave)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${d.rubros.includes(r.clave) ? "border-acento text-texto bg-acento-suave/40" : "border-borde text-texto-suave"}`}>
                {r.nombre}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-mal mt-4">{error}</p>}

        <div className="flex justify-end gap-2 mt-6">
          <Boton variant="quiet" onClick={onCerrar}>Cancelar</Boton>
          <Boton disabled={!puedeGuardar} onClick={guardar}><Check size={15} /> {guardando ? "Guardando…" : "Guardar"}</Boton>
        </div>
        <p className="text-[11px] text-texto-tenue mt-3">
          {d.modulos.length + MODULOS_BASE.filter((k) => !d.modulos.includes(k)).length} módulos · {nf.format(Number(d.precioMensual) || 0) === "0" ? "sin precio todavía" : `${money(Number(d.precioMensual))} por mes`}
        </p>
      </div>
    </Modal>
  );
}
