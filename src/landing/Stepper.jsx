/* ============================================================
   EL ALTA GUIADA · tres pasos y un estimado
   ============================================================

   1. Tu rubro — ya viene elegido desde la card.
   2. Qué hacés — tildes que salen de `presentacion.preguntas` del rubro.
      Cada tilde enciende módulos y suma cosas que hay que tener.
   3. Qué necesitás — los módulos propuestos: los del rubro más los que
      encendieron las tildes. Se pueden sacar, salvo los base.

   Y el estimado: módulos, qué te hace falta de tu lado, y el precio del
   plan que los cubre. El precio sale de `planes` (lo edita la plataforma
   desde su panel); sin planes, "a confirmar" y nunca un número inventado.

   Nada de esto escribe en la base: el alta real es otro issue, y hasta
   que exista la pantalla final lo dice con todas las letras.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Lock } from "lucide-react";
import { MODULOS, MODULOS_BASE, moduloPorClave } from "../datos/modulos.js";
import { cargarPlanesPublicos, planParaModulos } from "../datos/planes.js";
import { Tarjeta, Boton } from "../cliente/ui.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";
const unicos = (xs) => Array.from(new Set(xs));
const pesos = (n) => "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n));

const PASOS = ["Tu rubro", "Qué hacés", "Qué necesitás"];

export default function Stepper({ rubro, onVolver }) {
  const p = rubro.presentacion;
  const preguntas = p.preguntas || [];
  const [paso, setPaso] = useState(preguntas.length ? 2 : 3);   // 2 | 3 | 4 (estimado)
  const [tildes, setTildes] = useState({});
  const [sacados, setSacados] = useState([]);
  const [planes, setPlanes] = useState(null);                    // null = todavía no se sabe

  useEffect(() => {
    let vigente = true;
    cargarPlanesPublicos()
      .then((ps) => { if (vigente) setPlanes(ps); })
      .catch(() => { if (vigente) setPlanes([]); });
    return () => { vigente = false; };
  }, []);

  const activas = preguntas.filter((q) => tildes[q.k]);

  /* Lo que el rubro trae más lo que encendieron las tildes. Los base van
     siempre; el resto se puede sacar en el paso 3. */
  const propuestos = useMemo(
    () => unicos([...MODULOS_BASE, ...(rubro.modulos || []), ...activas.flatMap((q) => q.modulos || [])]),
    [rubro, activas],
  );
  const elegidos = propuestos.filter((k) => MODULOS_BASE.includes(k) || !sacados.includes(k));

  const necesita = useMemo(
    () => unicos([
      ...elegidos.flatMap((k) => (moduloPorClave(k) || {}).necesita || []),
      ...activas.flatMap((q) => q.necesita || []),
    ]),
    [elegidos, activas],
  );

  const estimado = planes ? planParaModulos(planes, elegidos, rubro.clave) : null;

  const arriba = () => window.scrollTo(0, 0);
  const ir = (n) => { setPaso(n); arriba(); };

  return (
    <section className="pt-4 max-w-2xl">
      <button onClick={paso === 2 || (paso === 3 && !preguntas.length) ? onVolver : () => ir(paso === 4 ? 3 : 2)}
        className="inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto mb-5">
        <ArrowLeft size={16} /> {paso === 2 || (paso === 3 && !preguntas.length) ? "Elegir otro rubro" : "Volver"}
      </button>

      <Progreso actual={paso} />

      <div className="mt-6">
        <div className={ROTULO}>Tu rubro</div>
        <div className="font-semibold text-[17px]">{p.titulo}</div>
      </div>

      {paso === 2 && (
        <QueHaces preguntas={preguntas} tildes={tildes} onTildar={(k) => setTildes((t) => ({ ...t, [k]: !t[k] }))} onSeguir={() => ir(3)} />
      )}

      {paso === 3 && (
        <QueNecesitas propuestos={propuestos} sacados={sacados}
          onAlternar={(k) => setSacados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
          onSeguir={() => ir(4)} />
      )}

      {paso === 4 && (
        <Estimado modulos={elegidos} necesita={necesita} estimado={estimado} planes={planes} />
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

function QueHaces({ preguntas, tildes, onTildar, onSeguir }) {
  return (
    <div className="mt-6">
      <h1 className="f-d text-2xl leading-tight">¿Cómo trabajás?</h1>
      <p className="text-texto-suave mt-2">Tildá lo que aplica. Con eso armamos lo que necesitás.</p>
      <div className="mt-5 space-y-2">
        {preguntas.map((q) => (
          <Tilde key={q.k} activa={!!tildes[q.k]} onClick={() => onTildar(q.k)} titulo={q.n} />
        ))}
      </div>
      <div className="mt-6">
        <Boton onClick={onSeguir}>
          <span className="inline-flex items-center gap-2">Seguir <ArrowRight size={16} /></span>
        </Boton>
      </div>
    </div>
  );
}

function QueNecesitas({ propuestos, sacados, onAlternar, onSeguir }) {
  return (
    <div className="mt-6">
      <h1 className="f-d text-2xl leading-tight">Esto es lo que necesitás</h1>
      <p className="text-texto-suave mt-2">Lo armamos según tu rubro y lo que marcaste. Podés sacar lo que no quieras.</p>
      <div className="mt-5 space-y-2">
        {propuestos.map((k) => {
          const m = moduloPorClave(k) || { n: k, d: "" };
          const base = MODULOS_BASE.includes(k);
          return (
            <Tilde key={k} activa={base || !sacados.includes(k)} fija={base} onClick={() => !base && onAlternar(k)}
              titulo={m.n} detalle={base ? "Siempre incluido" : m.d} />
          );
        })}
      </div>
      <div className="mt-6">
        <Boton onClick={onSeguir}>
          <span className="inline-flex items-center gap-2">Ver el estimado <ArrowRight size={16} /></span>
        </Boton>
      </div>
    </div>
  );
}

function Tilde({ activa, fija, onClick, titulo, detalle }) {
  return (
    <button type="button" onClick={onClick} disabled={fija}
      className={`w-full text-left flex items-center gap-3 rounded-xl border px-4 py-3.5 min-h-[56px] ${
        activa ? "border-acento bg-acento-suave/30" : "border-borde bg-superficie"} ${fija ? "opacity-80" : ""}`}>
      <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
        activa ? "bg-acento border-acento text-sobre-acento" : "border-borde-fuerte"}`}>
        {activa && (fija ? <Lock size={11} /> : <Check size={13} />)}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium leading-snug">{titulo}</span>
        {detalle && <span className="block text-xs text-texto-tenue mt-0.5">{detalle}</span>}
      </span>
    </button>
  );
}

function Estimado({ modulos, necesita, estimado, planes }) {
  const plan = estimado ? estimado.plan : null;
  const faltan = estimado ? estimado.faltan : [];
  const nombreDe = (k) => (moduloPorClave(k) || { n: k }).n;

  return (
    <div className="mt-6">
      <h1 className="f-d text-2xl leading-tight">Tu estimado</h1>
      <p className="text-texto-suave mt-2">Lo que te corresponde, lo que necesitás de tu lado y lo que pagás para empezar.</p>

      <Tarjeta className="mt-5">
        <div className={`${ROTULO} mb-3`}>Módulos ({modulos.length})</div>
        <ul className="space-y-2">
          {modulos.map((k) => {
            const m = moduloPorClave(k) || { n: k, d: "" };
            return (
              <li key={k} className="flex items-start gap-3">
                <Check size={16} className="text-bien shrink-0 mt-0.5" />
                <span className="min-w-0">
                  <span className="text-[15px] font-medium">{m.n}</span>
                  {m.d && <span className="block text-xs text-texto-tenue">{m.d}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Tarjeta>

      <Tarjeta className="mt-3">
        <div className={`${ROTULO} mb-3`}>Qué necesitás de tu lado</div>
        {necesita.length ? (
          <ul className="space-y-2">
            {necesita.map((n) => (
              <li key={n} className="flex items-start gap-3 text-[15px]">
                <span className="w-1.5 h-1.5 rounded-full bg-texto-tenue shrink-0 mt-2" />{n}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-texto-suave">Nada más que un celular o una computadora con internet.</p>
        )}
      </Tarjeta>

      <Tarjeta className="mt-3 border-acento">
        <div className={`${ROTULO} mb-2`}>Lo que pagás para empezar</div>
        {planes === null && <p className="text-texto-suave text-[15px]">Calculando…</p>}
        {planes !== null && plan && plan.precioMensual != null && (
          <>
            <div className="f-d text-3xl">{pesos(plan.precioMensual)} <span className="text-base text-texto-suave font-normal">por mes</span></div>
            <div className="text-[15px] mt-1">Plan <strong>{plan.nombre}</strong>{plan.bajada ? ` · ${plan.bajada}` : ""}</div>
            {plan.puestaEnMarcha > 0 && (
              <div className="text-sm text-texto-suave mt-1">Más {pesos(plan.puestaEnMarcha)} por única vez para la puesta en marcha.</div>
            )}
            {faltan.length > 0 && (
              <p className="text-sm text-texto-suave mt-3">
                Este plan no incluye {faltan.map(nombreDe).join(", ")}: te lo cotizamos aparte.
              </p>
            )}
          </>
        )}
        {planes !== null && (!plan || plan.precioMensual == null) && (
          <>
            <div className="f-d text-2xl">Precio a confirmar</div>
            <p className="text-[15px] text-texto-suave mt-1">
              Te mandamos la propuesta con estos {modulos.length} módulos. Sin sorpresas: el número que te digamos es el que pagás.
            </p>
          </>
        )}
      </Tarjeta>

      {/* Honesto hasta que exista el alta real (issue aparte): se dice, no se simula. */}
      <Tarjeta className="mt-3 border-dashed">
        <div className={`${ROTULO} mb-2`}>Empezar</div>
        <p className="text-[15px] leading-relaxed">
          En breve vas a poder crear tu cuenta acá mismo y entrar al sistema con estos módulos ya armados.
        </p>
      </Tarjeta>
    </div>
  );
}
