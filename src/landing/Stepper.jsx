/* ============================================================
   EL ALTA GUIADA · tres pasos y un presupuesto
   ============================================================

   1. Tu rubro — ya viene elegido desde la card.
   2. Cómo trabajás — cuántos puestos tiene (fijo, de cualquier negocio)
      y tildes que salen de `presentacion.preguntas` del rubro. Cada
      tilde enciende módulos y suma cosas que hay que tener.
   3. Tus módulos — los que de verdad necesita: base + núcleo del rubro
      + lo que encendieron las tildes. Cada uno dice por qué está, se
      puede sacar (menos la base) y se puede sumar del rubro.

   Y el presupuesto: base más un precio por módulo, la puesta en marcha
   y qué necesita de su lado. Los precios salen de `tarifas` (la
   plataforma los edita desde su panel); sin una tarifa, "a confirmar"
   y nunca un número inventado. "Quiero empezar" manda el presupuesto
   por WhatsApp al número que la plataforma cargó.

   La cabeza está en src/datos/presupuesto.js y se prueba sin
   navegador; acá solo se dibuja. Nada de esto escribe en la base: el
   alta con cuenta es otro issue.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock, Plus, MessageCircle } from "lucide-react";
import { MODULOS_BASE, moduloPorClave } from "../datos/modulos.js";
import { ESCALAS, armarModulos, presupuestar, textoDelPresupuesto } from "../datos/presupuesto.js";
import { cargarTarifasPublicas, TARIFAS_VACIAS } from "../datos/tarifas.js";
import { Tarjeta, Boton } from "../cliente/ui.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";
const pesos = (n) => "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n));

const PASOS = ["Tu rubro", "Cómo trabajás", "Tus módulos"];

export default function Stepper({ rubro, negocio, onVolver }) {
  const p = rubro.presentacion;
  const preguntas = p.preguntas || [];
  const [paso, setPaso] = useState(2);                          // 2 | 3 | 4 (presupuesto)
  const [escala, setEscala] = useState("1");
  const [respuestas, setRespuestas] = useState({});
  const [sacados, setSacados] = useState([]);
  const [sumados, setSumados] = useState([]);
  const [tarifas, setTarifas] = useState(null);                  // null = todavía no se sabe

  useEffect(() => {
    let vigente = true;
    cargarTarifasPublicas()
      .then((t) => { if (vigente) setTarifas(t); })
      .catch(() => { if (vigente) setTarifas(TARIFAS_VACIAS); });
    return () => { vigente = false; };
  }, []);

  const armado = useMemo(
    () => armarModulos({ rubro, respuestas, sacados, sumados, escala }),
    [rubro, respuestas, sacados, sumados, escala],
  );
  const presupuesto = useMemo(
    () => presupuestar(tarifas || TARIFAS_VACIAS, armado.elegidos),
    [tarifas, armado],
  );

  const arriba = () => window.scrollTo(0, 0);
  const ir = (n) => { setPaso(n); arriba(); };
  const primero = paso === 2;

  return (
    <section className="pt-4 max-w-2xl">
      <button onClick={primero ? onVolver : () => ir(paso === 4 ? 3 : 2)}
        className="inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto mb-5">
        <ArrowLeft size={16} /> {primero ? "Cambiar de negocio" : "Volver"}
      </button>

      <Progreso actual={paso} />

      <div className="mt-6">
        <div className={ROTULO}>Tu negocio</div>
        <div className="font-semibold text-[17px]">
          {negocio && negocio !== p.titulo
            ? <>{negocio} <span className="text-texto-tenue font-normal">· {p.titulo}</span></>
            : p.titulo}
        </div>
      </div>

      {paso === 2 && (
        <ComoTrabajas preguntas={preguntas} respuestas={respuestas} escala={escala} onEscala={setEscala}
          onTildar={(k) => setRespuestas((r) => ({ ...r, [k]: !r[k] }))} onSeguir={() => ir(3)} />
      )}

      {paso === 3 && (
        <TusModulos armado={armado} sacados={sacados} sumados={sumados}
          onSacar={(k) => setSacados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
          onSumar={(k) => setSumados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
          onSeguir={() => ir(4)} />
      )}

      {paso === 4 && (
        <Presupuesto rubro={rubro} negocio={negocio} escala={escala} armado={armado} presupuesto={presupuesto} tarifas={tarifas} />
      )}
    </section>
  );
}

function Progreso({ actual }) {
  /* El paso 1 (el rubro) ya está hecho cuando se llega acá. */
  const hecho = (i) => i + 1 < Math.min(actual, 4);
  const enCurso = (i) => i + 1 === actual;
  return (
    <ol className="grid grid-cols-3 gap-2">
      {PASOS.map((n, i) => (
        <li key={n}>
          <div className={`h-1 rounded-full ${hecho(i) || enCurso(i) || actual === 4 ? "bg-acento" : "bg-superficie-3"}`} />
          <div className={`mt-1.5 text-[11px] font-semibold ${enCurso(i) ? "text-texto" : "text-texto-tenue"}`}>{n}</div>
        </li>
      ))}
    </ol>
  );
}

function ComoTrabajas({ preguntas, respuestas, escala, onEscala, onTildar, onSeguir }) {
  const marcadas = preguntas.filter((q) => respuestas[q.k]).length;
  return (
    <div className="mt-6">
      <h1 className="f-d text-2xl leading-tight">¿Cómo trabajás?</h1>
      <p className="text-texto-suave mt-2">Cuántos puestos tenés y qué hacés. Cada respuesta suma solo lo que hace falta.</p>

      <div className={`${ROTULO} mt-6`}>¿Cuántos puestos de venta o atención?</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {ESCALAS.map((e) => (
          <button key={e.k} type="button" onClick={() => onEscala(e.k)} aria-pressed={escala === e.k}
            className={`rounded-xl border px-2 py-3 text-center min-h-[72px] ${
              escala === e.k ? "border-acento bg-acento-suave/30" : "border-borde bg-superficie"}`}>
            <span className="block f-d text-lg leading-tight">{e.n}</span>
            <span className="block text-[11px] text-texto-tenue mt-1 leading-snug">{e.d}</span>
          </button>
        ))}
      </div>

      {preguntas.length > 0 && (
        <>
          <div className={`${ROTULO} mt-6`}>¿Algo de esto?</div>
          <div className="mt-2 space-y-2">
            {preguntas.map((q) => (
              <Tilde key={q.k} activa={!!respuestas[q.k]} onClick={() => onTildar(q.k)} titulo={q.n}
                detalle={(q.modulos || []).map((k) => (moduloPorClave(k) || { n: k }).n).join(" · ") || null} />
            ))}
          </div>
        </>
      )}
      <div className="mt-6">
        <Boton onClick={onSeguir}>
          <span className="inline-flex items-center gap-2">
            {marcadas ? `Ver mis módulos` : "Seguir sin marcar nada"} <ArrowRight size={16} />
          </span>
        </Boton>
      </div>
    </div>
  );
}

function TusModulos({ armado, sacados, sumados, onSacar, onSumar, onSeguir }) {
  const { elegidos, motivos, propuestos, sumables } = armado;
  const cuantosBase = elegidos.filter((k) => MODULOS_BASE.includes(k)).length;
  const fila = (k) => moduloPorClave(k) || { n: k, d: "" };

  return (
    <div className="mt-6">
      <h1 className="f-d text-2xl leading-tight">Estos son tus módulos</h1>
      <p className="text-texto-suave mt-2">
        <strong className="text-texto">{elegidos.length} módulos</strong>, {cuantosBase} de ellos incluidos en la base.
        Cada uno dice por qué está. Podés sacar lo que no quieras y sumar lo que te falte.
      </p>

      <div className="mt-5 space-y-2">
        {propuestos.map((k) => {
          const m = fila(k);
          const base = MODULOS_BASE.includes(k);
          return (
            <Tilde key={k} activa={base || !sacados.includes(k)} fija={base} onClick={() => !base && onSacar(k)}
              titulo={m.n} detalle={m.d} motivo={motivos[k] || (base ? "Siempre incluido" : "")} />
          );
        })}
        {sumados.filter((k) => elegidos.includes(k)).map((k) => {
          const m = fila(k);
          return <Tilde key={k} activa onClick={() => onSumar(k)} titulo={m.n} detalle={m.d} motivo="Lo sumaste vos" />;
        })}
      </div>

      {sumables.length > 0 && (
        <div className="mt-6">
          <div className={ROTULO}>¿Te falta algo? Sumalo</div>
          <div className="mt-2 space-y-2">
            {sumables.map((k) => {
              const m = fila(k);
              return (
                <button key={k} type="button" onClick={() => onSumar(k)}
                  className="w-full text-left flex items-center gap-3 rounded-xl border border-dashed border-borde-fuerte px-4 py-3 min-h-[52px] hover:border-texto-tenue">
                  <span className="w-5 h-5 rounded border border-borde-fuerte flex items-center justify-center shrink-0 text-texto-tenue"><Plus size={13} /></span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium leading-snug">{m.n}</span>
                    {m.d && <span className="block text-xs text-texto-tenue mt-0.5">{m.d}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6">
        <Boton onClick={onSeguir}>
          <span className="inline-flex items-center gap-2">Ver mi presupuesto <ArrowRight size={16} /></span>
        </Boton>
      </div>
    </div>
  );
}

function Tilde({ activa, fija, onClick, titulo, detalle, motivo }) {
  return (
    <button type="button" onClick={onClick} disabled={fija}
      className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3.5 min-h-[56px] ${
        activa ? "border-acento bg-acento-suave/30" : "border-borde bg-superficie"} ${fija ? "opacity-80" : ""}`}>
      <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
        activa ? "bg-acento border-acento text-sobre-acento" : "border-borde-fuerte"}`}>
        {activa && (fija ? <Lock size={11} /> : <Check size={13} />)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium leading-snug">{titulo}</span>
        {detalle && <span className="block text-xs text-texto-tenue mt-0.5">{detalle}</span>}
        {/* En el teléfono el motivo va debajo; con lugar, a la derecha. */}
        {motivo && <span className="block sm:hidden text-[11px] text-acento mt-1">{motivo}</span>}
      </span>
      {motivo && <span className="hidden sm:block text-[11px] text-texto-tenue text-right max-w-[40%] leading-snug shrink-0">{motivo}</span>}
    </button>
  );
}

function Presupuesto({ rubro, negocio, escala, armado, presupuesto, tarifas }) {
  const { lineas, base, mensual, puestaEnMarcha, faltan, cantidad } = presupuesto;
  const calculando = tarifas === null;
  const nombresBase = lineas.filter((l) => l.base).map((l) => l.n).join(", ");
  const opcionales = lineas.filter((l) => !l.base);

  const whatsapp = (tarifas && tarifas.whatsapp) || "";
  const enlace = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(textoDelPresupuesto({ rubro, negocio, escala, presupuesto, pesos }))}`
    : null;

  return (
    <div className="mt-6">
      <h1 className="f-d text-2xl leading-tight">Tu presupuesto</h1>
      <p className="text-texto-suave mt-2">
        Con los {cantidad} módulos que elegiste. Si no cambiás nada, esto es lo que pagás: sin sorpresas.
      </p>

      <Tarjeta className="mt-5 border-acento">
        <div className={`${ROTULO} mb-2`}>Por mes</div>
        {calculando && <p className="text-texto-suave text-[15px]">Calculando…</p>}
        {!calculando && mensual != null && (
          <div className="f-d f-m text-3xl">{pesos(mensual)} <span className="text-base text-texto-suave font-normal">por mes</span></div>
        )}
        {!calculando && mensual == null && (
          <>
            <div className="f-d text-2xl">Precio a confirmar</div>
            <p className="text-[15px] text-texto-suave mt-1">
              {faltan.includes("base")
                ? `Te mandamos la propuesta con estos ${cantidad} módulos. El número que te digamos es el que pagás.`
                : `Falta el precio de ${faltan.map((k) => (moduloPorClave(k) || { n: k }).n).join(", ")}: te lo cotizamos aparte.`}
            </p>
          </>
        )}

        {!calculando && (
          <ul className="mt-4 pt-4 border-t border-borde space-y-2 text-[15px]">
            <li className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium">Base</span>
                <span className="block text-xs text-texto-tenue">{nombresBase}</span>
              </span>
              <span className="f-m shrink-0">{base == null ? "a confirmar" : pesos(base)}</span>
            </li>
            {opcionales.map((l) => (
              <li key={l.k} className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-medium">{l.n}</span>
                  {l.d && <span className="block text-xs text-texto-tenue">{l.d}</span>}
                </span>
                <span className="f-m shrink-0">{l.monto == null ? "a confirmar" : pesos(l.monto)}</span>
              </li>
            ))}
            {puestaEnMarcha > 0 && (
              <li className="flex items-start justify-between gap-3 pt-2 border-t border-borde">
                <span className="min-w-0">
                  <span className="font-medium">Puesta en marcha</span>
                  <span className="block text-xs text-texto-tenue">Una sola vez, al arrancar</span>
                </span>
                <span className="f-m shrink-0">{pesos(puestaEnMarcha)}</span>
              </li>
            )}
          </ul>
        )}
      </Tarjeta>

      <Tarjeta className="mt-3">
        <div className={`${ROTULO} mb-3`}>Qué necesitás de tu lado</div>
        {armado.necesita.length ? (
          <ul className="space-y-2">
            {armado.necesita.map((n) => (
              <li key={n} className="flex items-start gap-3 text-[15px]">
                <span className="w-1.5 h-1.5 rounded-full bg-texto-tenue shrink-0 mt-2" />{n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-texto-suave">Nada más que un celular o una computadora con internet.</p>
        )}
      </Tarjeta>

      {/* El alta con cuenta es otro issue. Mientras tanto, el presupuesto
          viaja por WhatsApp al número que la plataforma cargó; sin número,
          se dice con todas las letras en vez de fingir un formulario. */}
      {enlace ? (
        <div className="mt-5">
          <a href={enlace} target="_blank" rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-[15px] bg-acento hover:bg-acento-vivo text-sobre-acento font-bold transition-colors">
            <MessageCircle size={18} /> Quiero empezar
          </a>
          <p className="text-xs text-texto-tenue mt-2 text-center">Se abre WhatsApp con este presupuesto ya escrito. Te contestamos con los pasos para arrancar.</p>
        </div>
      ) : (
        <Tarjeta className="mt-3 border-dashed">
          <div className={`${ROTULO} mb-2`}>Empezar</div>
          <p className="text-[15px] leading-relaxed">
            En breve vas a poder crear tu cuenta acá mismo y entrar al sistema con estos {cantidad} módulos ya armados.
          </p>
        </Tarjeta>
      )}
    </div>
  );
}
