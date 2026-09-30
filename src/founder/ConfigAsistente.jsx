/* ============================================================
   GENEZ FOUNDER · Configuración → Asistente (0121)
   ============================================================

   Prender el asistente de WhatsApp, elegir si deja borradores o manda
   solo, qué modelo usa y con qué base. La base se escribe en Documentos
   (tipo "Base del asistente"): acá se ve cuál está vigente, que es lo
   único que el asistente lee.

   El modo automático pide confirmación: un error de la base sale
   directo a un cliente. Los frenos de verdad están en la base (0121):
   esto es la perilla, no la seguridad.
   ============================================================ */

import React, { useCallback, useEffect, useState } from "react";
import { Card, Boton, Cargando, ErrorEstado, Sello } from "../ui/Base.jsx";
import { inputCls, TextoDiferido, NumeroDiferido } from "../ui/Campos.jsx";
import { cargarAjustes, guardarAjuste } from "../datos/internoFinanzas.js";
import { cargarBaseDelAsistente, cargarErroresDelAsistente } from "../datos/internoWhatsapp.js";
import { fechaHora } from "./util.js";

/* El de fábrica es el que recomienda Anthropic; los otros dos son más
   baratos y más rápidos, para cuando se mida que alcanzan. */
const MODELOS = [
  ["claude-opus-5-5", "Claude Opus 5.5 (recomendado)"],
  ["claude-sonnet-5-5", "Claude Sonnet 5.5 (más barato)"],
  ["claude-haiku-4-5", "Claude Haiku 4.5 (el más barato y rápido)"],
];

function Fila({ titulo, detalle, children }) {
  return (
    <div className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
      <div className="sm:w-64 shrink-0">
        <div className="text-sm font-semibold">{titulo}</div>
        {detalle && <div className="text-xs text-texto-suave mt-0.5">{detalle}</div>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function ConfigAsistente({ toast }) {
  const [bot, setBot] = useState(null);
  const [base, setBase] = useState(null);
  const [errores, setErrores] = useState([]);
  const [error, setError] = useState("");
  const leer = useCallback(() => Promise.all([cargarAjustes(), cargarBaseDelAsistente(), cargarErroresDelAsistente()])
    .then(([aj, b, e]) => { setBot(aj.bot || {}); setBase(b); setErrores(e); setError(""); })
    .catch((e) => setError(e.message)), []);
  useEffect(() => { leer(); }, [leer]);

  const guardar = async (cambios, ok) => {
    const nuevo = { ...bot, ...cambios };
    try { await guardarAjuste("bot", nuevo); setBot(nuevo); if (ok) toast(ok); } catch (e) { toast(e.message, "mal"); }
  };

  if (error) return <Card><ErrorEstado onReintentar={leer}>{error}</ErrorEstado></Card>;
  if (!bot || !base) return <Card><Cargando /></Card>;

  const vigentes = base.filter((d) => d.estado === "vigente");
  const pasarAAutomatico = () => {
    if (window.confirm("En automático el asistente contesta solo, sin que nadie lo revise antes. ¿Lo pasás a automático?")) {
      guardar({ modo: "automatico" }, "El asistente contesta solo.");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="px-5 py-2 divide-y divide-borde">
        <Fila titulo="Asistente" detalle="Lee cada mensaje que entra y prepara una respuesta con la base de abajo, o te pasa la conversación.">
          <div className="flex items-center gap-3">
            <Sello tono={bot.activo ? "bien" : "tenue"}>{bot.activo ? "prendido" : "apagado"}</Sello>
            <Boton size="sm" variant={bot.activo ? "ghost" : "primary"} onClick={() => guardar({ activo: !bot.activo }, bot.activo ? "Asistente apagado." : "Asistente prendido.")}
              disabled={!bot.activo && vigentes.length === 0}>
              {bot.activo ? "Apagar" : "Prender"}
            </Boton>
            {!bot.activo && vigentes.length === 0 && <span className="text-xs text-texto-suave">Primero pasá al menos un documento de la base a vigente.</span>}
          </div>
        </Fila>

        <Fila titulo="Cómo contesta" detalle="En borrador, la respuesta queda en la conversación y sale cuando alguien la usa.">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => guardar({ modo: "borrador" }, "Deja borradores.")}
              className={`text-sm px-3 py-1.5 rounded-lg border ${bot.modo !== "automatico" ? "border-acento bg-acento-suave" : "border-borde text-texto-suave hover:text-texto"}`}>
              Deja borradores
            </button>
            <button onClick={pasarAAutomatico}
              className={`text-sm px-3 py-1.5 rounded-lg border ${bot.modo === "automatico" ? "border-acento bg-acento-suave" : "border-borde text-texto-suave hover:text-texto"}`}>
              Contesta solo
            </button>
          </div>
        </Fila>

        <Fila titulo="Modelo" detalle="Los más baratos contestan más rápido; conviene probarlos con conversaciones reales antes de cambiar.">
          <select value={bot.modelo || "claude-opus-5-5"} onChange={(e) => guardar({ modelo: e.target.value }, "Modelo cambiado.")} className={`${inputCls} mt-0 max-w-sm`}>
            {MODELOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </Fila>

        <Fila titulo="Presentación" detalle="Va antes de la primera respuesta automática de cada conversación. En borrador no se agrega: lo manda una persona.">
          <TextoDiferido valor={bot.aviso || ""} onGuardar={(t) => guardar({ aviso: t }, "Presentación guardada.")} className={`${inputCls} mt-0`} />
        </Fila>

        <Fila titulo="Tope por hora" detalle="Mensajes automáticos por conversación en una hora. Frena a dos bots contestándose sin fin.">
          <NumeroDiferido valor={bot.max_por_hora ?? 6} onGuardar={(n) => { const v = Math.max(1, Math.min(30, Math.round(Number(n) || 6))); guardar({ max_por_hora: v }, "Tope guardado."); }}
            className={`${inputCls} mt-0 max-w-[6rem]`} />
        </Fila>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 py-3 border-b border-borde">
          <h2 className="font-semibold">La base del asistente</h2>
          <p className="text-xs text-texto-suave mt-0.5">
            Se escribe en Documentos, con el tipo "Base del asistente". Solo lee los que están en <b className="text-texto">vigente</b>; si algo no está ahí, no lo sabe y te pasa la conversación.
          </p>
        </div>
        {base.length === 0
          ? <p className="px-5 py-4 text-sm text-texto-suave">No hay documentos de la base todavía.</p>
          : (
            <ul className="divide-y divide-borde">
              {base.map((d) => (
                <li key={d.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span className="flex-1 min-w-0 truncate">{d.titulo}</span>
                  <span className="text-[11px] text-texto-tenue f-m">v{d.version}</span>
                  <Sello tono={d.estado === "vigente" ? "bien" : d.estado === "obsoleto" ? "tenue" : "ojo"}>{d.estado}</Sello>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {errores.length > 0 && (
        <Card className="overflow-hidden">
          <h2 className="px-5 py-3 font-semibold border-b border-borde">Lo último que falló</h2>
          <ul className="divide-y divide-borde">
            {errores.map((e) => (
              <li key={e.id} className="px-5 py-2 text-xs flex flex-wrap gap-x-3">
                <span className="f-m text-texto-suave">{fechaHora(new Date(e.creadoEn))}</span>
                <span className="text-mal">{e.error}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
