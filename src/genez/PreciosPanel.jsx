/* ============================================================
   PRECIOS · lo que la plataforma cobra
   ============================================================

   Vive en el panel de plataforma y edita la tabla `tarifas` (0073). Es lo
   que después lee el alta guiada para armar el presupuesto: la base por
   mes más un precio por cada módulo que la persona de verdad necesita.
   Lo que quede vacío se muestra allá como "a confirmar", nunca como un
   número inventado.

   Una sola pantalla y un solo Guardar: son quince números y un
   teléfono, y un formulario por módulo sería más clics que precios.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { MODULOS, MODULOS_BASE, nivelDe } from "../datos/modulos.js";
import { cargarTarifas, guardarTarifas, TARIFAS_VACIAS } from "../datos/tarifas.js";
import { money } from "../utils/helpers.js";
import { Boton } from "../ui/Base.jsx";
import { Campo, inputCls } from "../ui/Campos.jsx";

const soloNumero = (v) => String(v).replace(/[^\d]/g, "");
const aMonto = (v) => (soloNumero(v) === "" ? null : Number(soloNumero(v)));
const ROTULO = "text-[11px] uppercase tracking-widest text-texto-suave font-bold";

export function PreciosPanel() {
  const [t, setT] = useState({ ...TARIFAS_VACIAS, modulos: {} });
  const [estado, setEstado] = useState("cargando");   // cargando | listo | error
  const [guardando, setGuardando] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [aviso, setAviso] = useState(null);            // { tipo: "ok" | "mal", texto }

  useEffect(() => {
    let vigente = true;
    cargarTarifas()
      .then((x) => { if (vigente) { setT(x); setEstado("listo"); } })
      .catch(() => { if (vigente) setEstado("error"); });
    return () => { vigente = false; };
  }, []);

  const tocar = (cambio) => { setT((x) => ({ ...x, ...cambio })); setSucio(true); setAviso(null); };
  const tocarModulo = (k, v) => tocar({ modulos: { ...t.modulos, [k]: aMonto(v) } });

  const guardar = async () => {
    setGuardando(true); setAviso(null);
    try {
      await guardarTarifas(t);
      setSucio(false);
      setAviso({ tipo: "ok", texto: "Guardado. El alta guiada ya presupuesta con estos precios." });
    } catch (e) {
      setAviso({ tipo: "mal", texto: e.message || "No se pudo guardar." });
    }
    setGuardando(false);
  };

  const opcionales = MODULOS.filter((m) => !MODULOS_BASE.includes(m.k));
  const conPrecio = opcionales.filter((m) => t.modulos[m.k] != null).length;
  const nombresBase = MODULOS_BASE.map((k) => MODULOS.find((m) => m.k === k).n).join(", ");

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <h2 className={ROTULO}>Precios</h2>
          <p className="text-sm text-texto-tenue">Lo que ve el alta guiada al final: base por mes más cada módulo que la persona necesita. Vacío = a confirmar.</p>
        </div>
        <Boton size="sm" disabled={estado !== "listo" || !sucio || guardando} onClick={guardar}>
          <Check size={14} /> {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </div>

      <div className="bg-superficie-3 border border-borde-fuerte rounded-2xl">
        {estado === "cargando" && <p className="p-4 text-sm text-texto-suave">Cargando…</p>}
        {estado === "error" && (
          <p className="p-4 text-sm text-texto-suave">
            No se pudieron leer las tarifas. Si la tabla todavía no existe en esta base, hay que aplicar la migración 0073.
          </p>
        )}

        {estado === "listo" && (
          <>
            <div className="p-4 grid md:grid-cols-3 gap-3">
              <Campo label={`Base por mes (incluye ${nombresBase})`}>
                <input value={t.base ?? ""} onChange={(e) => tocar({ base: aMonto(e.target.value) })} inputMode="numeric" placeholder="a confirmar" className={`${inputCls} f-m text-right`} />
              </Campo>
              <Campo label="Puesta en marcha (una sola vez, vacío = no se cobra)">
                <input value={t.puestaEnMarcha ?? ""} onChange={(e) => tocar({ puestaEnMarcha: aMonto(e.target.value) })} inputMode="numeric" placeholder="0" className={`${inputCls} f-m text-right`} />
              </Campo>
              <Campo label="WhatsApp al que llega el presupuesto (con 549…)">
                <input value={t.whatsapp || ""} onChange={(e) => tocar({ whatsapp: soloNumero(e.target.value) })} inputMode="tel" placeholder="5491112345678" className={`${inputCls} f-m`} />
              </Campo>
            </div>

            <div className="border-t border-borde-fuerte px-4 py-3 flex items-baseline justify-between gap-3">
              <span className={ROTULO}>Por módulo, por mes</span>
              <span className="text-[11px] text-texto-tenue">{conPrecio} de {opcionales.length} con precio</span>
            </div>
            <div className="divide-y divide-borde-fuerte">
              {opcionales.map((m) => (
                <label key={m.k} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{m.n}</span>
                    <span className="ml-2 text-[10px] uppercase tracking-wider font-bold text-texto-tenue">{nivelDe(m.k).n}</span>
                    <span className="block text-[11px] text-texto-tenue truncate">{m.d}</span>
                  </span>
                  <span className="text-xs text-texto-tenue">$</span>
                  <input value={t.modulos[m.k] ?? ""} onChange={(e) => tocarModulo(m.k, e.target.value)} inputMode="numeric" placeholder="a confirmar"
                    className={`${inputCls} f-m text-right !mt-0 w-32`} />
                </label>
              ))}
            </div>

            <div className="border-t border-borde-fuerte px-4 py-3 text-[11px] text-texto-tenue">
              {t.base == null
                ? "Sin la base no hay presupuesto: el alta guiada dice \"a confirmar\" hasta que la cargues."
                : `Un comercio con solo los módulos base paga ${money(t.base)} por mes${t.puestaEnMarcha ? ` más ${money(t.puestaEnMarcha)} por única vez` : ""}.`}
              {aviso && <span className={`block mt-1 ${aviso.tipo === "ok" ? "text-bien" : "text-mal"}`}>{aviso.texto}</span>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
