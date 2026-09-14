/* ============================================================
   EL ALTA GUIADA · cuatro pasos y tres presupuestos
   ============================================================

   1. Tu negocio — ya viene elegido desde la card de la portada.
   2. Cómo trabajás — cuántos puestos tiene (fijo, de cualquier negocio)
      y tildes que salen de `presentacion.preguntas` del rubro. Cada
      tilde enciende módulos y suma cosas que hay que tener.
   3. Qué te complica — los dolores, en sus palabras ("se me escapa el
      stock"), y un campo libre. Cada dolor enciende módulos igual que
      una tilde; el texto libre viaja con el pedido.
   4. Tus módulos — los que de verdad necesita: base + núcleo del rubro
      + lo que encendieron tildes y dolores. Cada uno dice por qué está,
      se puede sacar (menos la base) y se puede sumar del rubro.
   5. El presupuesto — tres para elegir: "Start" (lo mínimo del rubro),
      "Pro" (lo que salió de sus respuestas, el recomendado) y "Empresa"
      (todo lo que el rubro puede usar). Las tres tarjetas listan los
      mismos módulos, con tilde naranja en los que incluyen. El
      elegido se abre abajo como un documento: resumen con el total y la
      acción, lo que eligió (editable), los módulos con su motivo y su
      precio, qué necesita de su lado y qué pasa después.

   Los precios salen de `tarifas` (la plataforma los edita desde su
   panel). Sin precios publicados no se dibuja columna de precio: se
   dice una sola vez que nos ponemos en contacto, y nunca se inventa.
   "Pedir este presupuesto" guarda una solicitud (0074) con lo que eligió
   y su WhatsApp; la plataforma la ve en su panel. Si además hay un
   WhatsApp cargado, se puede mandar directo.

   La cabeza está en src/datos/presupuesto.js y se prueba sin
   navegador; acá solo se dibuja.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Lock, Plus, MessageCircle, Copy, Printer, Pencil,
  Boxes, TrendingUp, Wallet, FileText, Clock, Truck, CalendarDays, Users, Smartphone,
} from "lucide-react";
import { MODULOS_BASE, moduloPorClave } from "../datos/modulos.js";
import { ESCALAS, DOLORES, conDolores, variantes, presupuestar, textoDelPresupuesto } from "../datos/presupuesto.js";
import { cargarTarifasPublicas, TARIFAS_VACIAS } from "../datos/tarifas.js";
import { pedirPresupuesto, validarPedido } from "../datos/solicitudes.js";
import { Tarjeta, Boton } from "../cliente/ui.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";
const pesos = (n) => "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n));
const nombreDe = (k) => (moduloPorClave(k) || { n: k }).n;
const esDolor = (k) => DOLORES.some((d) => d.k === k);

/* Un ícono por dolor. Es una decisión de esta pantalla, no del dato. */
const ICONO_DOLOR = {
  d_stock: Boxes, d_plata: TrendingUp, d_caja: Wallet, d_factura: FileText, d_cola: Clock,
  d_remitos: Truck, d_turnos: CalendarDays, d_volver: MessageCircle, d_equipo: Users, d_reservas: Smartphone,
};

const PASOS = ["Tu negocio", "Cómo trabajás", "Qué te complica", "Tus módulos", "Presupuesto"];

export default function Stepper({ rubro, negocio, onVolver }) {
  /* Los dolores entran como preguntas más del rubro: encienden módulos
     con su motivo y viajan en el pedido como cualquier respuesta. */
  const rubroArmado = useMemo(() => conDolores(rubro), [rubro]);
  const p = rubroArmado.presentacion;
  const preguntasRubro = rubro.presentacion.preguntas || [];
  const [paso, setPaso] = useState(2);                          // 2 | 3 | 4 | 5 (presupuesto)
  const [escala, setEscala] = useState("1");
  const [respuestas, setRespuestas] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [sacados, setSacados] = useState([]);
  const [sumados, setSumados] = useState([]);
  const [opcion, setOpcion] = useState("medida");                // arrancar | medida | completo
  const [tarifas, setTarifas] = useState(null);                  // null = todavía no se sabe

  useEffect(() => {
    let vigente = true;
    cargarTarifasPublicas()
      .then((t) => { if (vigente) setTarifas(t); })
      .catch(() => { if (vigente) setTarifas(TARIFAS_VACIAS); });
    return () => { vigente = false; };
  }, []);

  const opciones = useMemo(
    () => variantes({ rubro: rubroArmado, respuestas, sacados, sumados, escala }),
    [rubroArmado, respuestas, sacados, sumados, escala],
  );
  const medida = opciones.find((o) => o.k === "medida");
  const elegida = opciones.find((o) => o.k === opcion) || medida;
  const presupuesto = useMemo(
    () => presupuestar(tarifas || TARIFAS_VACIAS, elegida.armado.elegidos),
    [tarifas, elegida],
  );

  const arriba = () => window.scrollTo(0, 0);
  const ir = (n) => { setPaso(n); arriba(); };
  const primero = paso === 2;
  const tildar = (k) => setRespuestas((r) => ({ ...r, [k]: !r[k] }));

  return (
    <section className={`pt-4 ${paso === 5 ? "" : "max-w-2xl"}`}>
      <div className="no-imprimir">
        <button onClick={primero ? onVolver : () => ir(paso - 1)}
          className="inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto mb-5">
          <ArrowLeft size={16} /> {primero ? "Cambiar de negocio" : "Volver"}
        </button>

        <Progreso actual={paso} />
      </div>

      <div className="mt-6">
        <div className={ROTULO}>Tu negocio</div>
        <div className="font-semibold text-[17px]">
          {negocio && negocio !== p.titulo
            ? <>{negocio} <span className="text-texto-tenue font-normal">· {p.titulo}</span></>
            : p.titulo}
        </div>
      </div>

      {paso === 2 && (
        <ComoTrabajas preguntas={preguntasRubro} respuestas={respuestas} escala={escala} onEscala={setEscala}
          onTildar={tildar} onSeguir={() => ir(3)} />
      )}

      {paso === 3 && (
        <QueTeComplica respuestas={respuestas} onTildar={tildar} mensaje={mensaje} onMensaje={setMensaje} onSeguir={() => ir(4)} />
      )}

      {paso === 4 && (
        <TusModulos armado={medida.armado} sacados={sacados} sumados={sumados}
          onSacar={(k) => setSacados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
          onSumar={(k) => setSumados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
          onSeguir={() => { setOpcion("medida"); ir(5); }} />
      )}

      {paso === 5 && (
        <Presupuesto rubro={rubroArmado} negocio={negocio} escala={escala} respuestas={respuestas} mensaje={mensaje}
          opciones={opciones} opcion={elegida.k} onOpcion={setOpcion} tarifas={tarifas} presupuesto={presupuesto}
          onCambiarNegocio={onVolver} onEditar={() => ir(2)} onEditarDolores={() => ir(3)} onAjustar={() => { setOpcion("medida"); ir(4); }} />
      )}
    </section>
  );
}

function Progreso({ actual }) {
  /* El paso 1 (el negocio) ya está hecho cuando se llega acá. */
  return (
    <ol className="grid grid-cols-5 gap-1.5 sm:gap-2">
      {PASOS.map((n, i) => {
        const num = i + 1;
        const hecho = num < actual;
        const enCurso = num === actual;
        return (
          <li key={n}>
            <div className={`h-1 rounded-full ${hecho || enCurso ? "bg-acento" : "bg-superficie-3"}`} />
            <div className={`mt-1.5 text-[10px] sm:text-[11px] font-semibold leading-tight ${enCurso ? "text-texto" : "text-texto-tenue"}`}>{n}</div>
          </li>
        );
      })}
    </ol>
  );
}

function ComoTrabajas({ preguntas, respuestas, escala, onEscala, onTildar, onSeguir }) {
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
                detalle={(q.modulos || []).map(nombreDe).join(" · ") || null} />
            ))}
          </div>
        </>
      )}
      <div className="mt-6">
        <Boton onClick={onSeguir}>
          <span className="inline-flex items-center gap-2">Seguir <ArrowRight size={16} /></span>
        </Boton>
      </div>
    </div>
  );
}

/* Los dolores, en sus palabras. Son tildes como las del rubro, pero se
   dibujan como chips: se leen de un vistazo y se marcan varios. */
function QueTeComplica({ respuestas, onTildar, mensaje, onMensaje, onSeguir }) {
  const marcados = DOLORES.filter((d) => respuestas[d.k]);
  const modulos = Array.from(new Set(marcados.flatMap((d) => d.modulos))).map(nombreDe);
  return (
    <div className="mt-6">
      <h1 className="f-d text-2xl leading-tight">¿Qué te complica hoy?</h1>
      <p className="text-texto-suave mt-2">Marcá lo que te pasa. Con eso armamos el sistema desde tu problema, no desde un catálogo.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {DOLORES.map((d) => {
          const I = ICONO_DOLOR[d.k] || Check;
          const activo = !!respuestas[d.k];
          return (
            <button key={d.k} type="button" onClick={() => onTildar(d.k)} aria-pressed={activo}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                activo ? "border-acento bg-acento-suave/40 text-texto" : "border-borde-fuerte bg-superficie text-texto-suave hover:text-texto"}`}>
              {activo ? <Check size={15} className="text-acento" /> : <I size={15} className="text-texto-tenue" />} {d.n}
            </button>
          );
        })}
      </div>

      {marcados.length > 0 && (
        <p className="text-sm mt-4"><span className="text-texto-suave">Con esto te proponemos:</span> <strong>{modulos.join(" · ")}</strong></p>
      )}

      <label className="block mt-5">
        <span className="text-xs font-semibold text-texto-suave">Contanos con tus palabras <span className="font-normal text-texto-tenue">(opcional)</span></span>
        <textarea value={mensaje} onChange={(e) => onMensaje(e.target.value)} rows={3}
          placeholder="Ej.: tengo dos cajas y a fin de mes nunca sé cuánto gané"
          className="mt-1 w-full border border-borde rounded-lg px-3 py-3 text-[15px] bg-superficie outline-none focus:border-acento" />
      </label>

      <div className="mt-6">
        <Boton onClick={onSeguir}>
          <span className="inline-flex items-center gap-2">{marcados.length ? "Ver mis módulos" : "Seguir sin marcar nada"} <ArrowRight size={16} /></span>
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
          <span className="inline-flex items-center gap-2">Ver mis presupuestos <ArrowRight size={16} /></span>
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

/* ------------------------------------------------------------
   El presupuesto

   Arriba, las tres opciones para elegir. Abajo, la elegida como
   documento: dos columnas en escritorio (el detalle a la izquierda y,
   fijo a la derecha, el resumen con el total y la acción). En el
   teléfono el resumen va primero: el total y el botón tienen que verse
   sin bajar.
   ------------------------------------------------------------ */

const ACCION = "inline-flex items-center justify-center gap-1.5 rounded-md border border-borde-fuerte hover:border-texto-tenue text-sm font-semibold px-2 py-2 transition-colors";
const CAMPO = "mt-1 w-full border border-borde rounded-lg px-3 py-3 text-[15px] bg-superficie outline-none focus:border-acento";

function Presupuesto({ rubro, negocio, escala, respuestas, mensaje, opciones, opcion, onOpcion, tarifas, presupuesto, onCambiarNegocio, onEditar, onEditarDolores, onAjustar }) {
  const p = rubro.presentacion;
  const elegida = opciones.find((o) => o.k === opcion);
  const armado = elegida.armado;
  const { lineas, base, mensual, puestaEnMarcha, faltan, cantidad } = presupuesto;
  const calculando = tarifas === null;
  const sinPrecios = !calculando && base == null;      // no hay precios publicados: ni columna de precio
  const opcionales = lineas.filter((l) => !l.base);
  const nombresBase = lineas.filter((l) => l.base).map((l) => l.n).join(", ");
  const marcadas = (p.preguntas || []).filter((q) => respuestas[q.k]);
  const tildes = marcadas.filter((q) => !esDolor(q.k));
  const dolores = marcadas.filter((q) => esDolor(q.k));
  const puestos = ESCALAS.find((e) => e.k === escala) || ESCALAS[0];
  const texto = textoDelPresupuesto({ rubro, negocio, escala, opcion: elegida.n, presupuesto, pesos });
  const whatsapp = (tarifas && tarifas.whatsapp) || "";

  /* Lo que se guarda si pide el presupuesto: tal cual lo vio. */
  const pedido = {
    negocio: negocio || p.titulo,
    rubro: rubro.clave,
    escala,
    respuestas: [...marcadas.map((q) => ({ k: q.k, n: q.n })), { k: "presupuesto", n: `Presupuesto «${elegida.n}»` }],
    modulos: armado.elegidos,
    mensual,
    puesta_en_marcha: puestaEnMarcha,
  };

  return (
    <div className="mt-6">
      <h1 className="f-d text-2xl sm:text-3xl leading-tight">Tus tres presupuestos</h1>
      <p className="text-texto-suave mt-2 max-w-2xl">
        El recomendado sale de lo que respondiste. Los otros dos, por si querés arrancar más chico o llevarte todo. Elegí uno y abajo tenés el detalle.
      </p>

      {/* Las tres tarjetas listan los mismos módulos (los de "Empresa", que
          es la que tiene todos): así se compara de un vistazo qué incluye
          cada una. */}
      <div className="mt-6 grid md:grid-cols-3 gap-3">
        {opciones.map((o) => (
          <Opcion key={o.k} opcion={o} activa={o.k === opcion} tarifas={tarifas}
            todos={opciones.find((x) => x.k === "completo").armado.elegidos} onElegir={() => onOpcion(o.k)} />
        ))}
      </div>

      <div className="mt-8 flex items-baseline justify-between gap-3">
        <h2 className="f-d text-xl">Presupuesto «{elegida.n}»</h2>
        <span className="text-sm text-texto-tenue">{cantidad} módulos</span>
      </div>

      <div className="mt-4 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-8 items-start">
        <div className="lg:order-2 lg:sticky lg:top-24 no-imprimir">
          <Resumen key={elegida.k} calculando={calculando} sinPrecios={sinPrecios} mensual={mensual} puestaEnMarcha={puestaEnMarcha}
            faltan={faltan} cantidad={cantidad} texto={texto} whatsapp={whatsapp} pedido={pedido} mensajeInicial={mensaje} />
        </div>

        <div className="lg:order-1 space-y-3">
          <Tarjeta>
            <div className={`${ROTULO} mb-3`}>Lo que elegiste</div>
            <dl className="divide-y divide-borde">
              <Eleccion rotulo="Negocio" valor={negocio && negocio !== p.titulo ? `${negocio} · ${p.titulo}` : p.titulo} accion="Cambiar" onClick={onCambiarNegocio} />
              <Eleccion rotulo="Puestos" valor={`${puestos.n} · ${puestos.d}`} accion="Cambiar" onClick={onEditar} />
              <Eleccion rotulo="Marcaste" valor={tildes.length ? tildes.map((q) => q.n).join(" · ") : "Nada: solo lo que viene con tu rubro"} accion="Editar" onClick={onEditar} />
              <Eleccion rotulo="Te complica" valor={dolores.length ? dolores.map((q) => q.n).join(" · ") : "No marcaste nada"} accion="Editar" onClick={onEditarDolores} />
            </dl>
          </Tarjeta>

          <Tarjeta>
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className={ROTULO}>Tus {cantidad} módulos</div>
              <button type="button" onClick={onAjustar} className="no-imprimir inline-flex items-center gap-1 text-sm font-semibold text-acento hover:text-acento-vivo">
                <Pencil size={13} /> Ajustar
              </button>
            </div>
            <ul className="divide-y divide-borde">
              <Linea nombre="Base" detalle={nombresBase} motivo="Siempre incluida"
                precio={sinPrecios ? null : (calculando ? "…" : base == null ? "a cotizar" : pesos(base))} />
              {opcionales.map((l) => (
                <Linea key={l.k} nombre={l.n} detalle={l.d} motivo={armado.motivos[l.k]}
                  precio={sinPrecios ? null : (calculando ? "…" : l.monto == null ? "a cotizar" : pesos(l.monto))} />
              ))}
              {!sinPrecios && !calculando && puestaEnMarcha > 0 && (
                <Linea nombre="Puesta en marcha" detalle="Una sola vez, al arrancar: cargamos tu catálogo y dejamos todo configurado" precio={pesos(puestaEnMarcha)} />
              )}
              {!sinPrecios && !calculando && mensual != null && (
                <li className="hidden print:flex items-center justify-between pt-3 font-bold">
                  <span>Total por mes</span><span className="f-m">{pesos(mensual)}</span>
                </li>
              )}
            </ul>
            {sinPrecios && (
              <p className="text-sm text-texto-suave mt-3 pt-3 border-t border-borde">
                Todavía no publicamos precios. Dejanos tu WhatsApp y nos ponemos en contacto con el precio de estos {cantidad} módulos, sin sorpresas.
              </p>
            )}
          </Tarjeta>

          <Tarjeta>
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

          <Tarjeta>
            <div className={`${ROTULO} mb-3`}>Qué pasa después</div>
            <ol className="space-y-3">
              {[
                ["Nos ponemos en contacto por WhatsApp", "Te escribimos con el presupuesto confirmado y contestamos tus dudas."],
                ["Puesta en marcha", "Cargamos tu catálogo y dejamos los módulos configurados para tu negocio."],
                ["Una capacitación corta y arrancás", "La primera venta la hacés con nosotros al lado."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="w-7 h-7 rounded-full bg-acento-suave text-acento f-d text-[13px] flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium leading-snug">{t}</span>
                    <span className="block text-xs text-texto-tenue mt-0.5">{d}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}

/* Una de las tres opciones: nombre, precio y la misma lista de módulos
   que las otras dos, con tilde naranja y letra fuerte en los que
   incluye y gris clarito en los que no. */
function Opcion({ opcion, activa, tarifas, todos, onElegir }) {
  const pre = presupuestar(tarifas || TARIFAS_VACIAS, opcion.armado.elegidos);
  const calculando = tarifas === null;
  const incluye = (k) => opcion.armado.elegidos.includes(k);
  return (
    <button type="button" onClick={onElegir} aria-pressed={activa}
      className={`relative text-left bg-superficie rounded-xl p-4 sm:p-5 border transition-colors flex flex-col ${
        activa ? "border-acento ring-1 ring-acento" : "border-borde hover:border-borde-fuerte"}`}>
      {opcion.recomendado && (
        <span className="absolute -top-3 left-4 text-[10px] uppercase tracking-wider font-bold bg-acento text-sobre-acento rounded px-2 py-1">Recomendado</span>
      )}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="f-d text-lg leading-tight">{opcion.n}</div>
          <div className="text-xs text-texto-suave mt-0.5">{opcion.d}</div>
        </div>
        <span className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
          activa ? "bg-acento border-acento text-sobre-acento" : "border-borde-fuerte"}`}>
          {activa && <Check size={14} />}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-borde">
        {calculando && <div className="text-texto-suave text-sm">Calculando…</div>}
        {!calculando && pre.mensual != null && (
          <div className="f-d f-m text-2xl">{pesos(pre.mensual)} <span className="text-xs text-texto-suave font-normal">por mes</span></div>
        )}
        {!calculando && pre.mensual == null && <div className="f-d text-lg">Precio a confirmar</div>}
        <div className="text-[11px] text-texto-tenue mt-0.5">{pre.cantidad} módulos · cobro, caja y ajustes incluidos</div>
      </div>
      <ul className="mt-3 space-y-1.5 flex-1">
        {todos.map((k) => {
          const si = incluye(k);
          return (
            <li key={k} className={`flex items-center gap-2 text-sm ${si ? "text-texto font-semibold" : "text-texto-tenue"}`}>
              {si
                ? <span className="w-4 h-4 rounded-full bg-acento text-sobre-acento flex items-center justify-center shrink-0"><Check size={11} /></span>
                : <span className="w-4 h-4 rounded-full border border-borde-fuerte shrink-0" />}
              {nombreDe(k)}
            </li>
          );
        })}
      </ul>
    </button>
  );
}

function Eleccion({ rotulo, valor, accion, onClick }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <dt className="text-xs text-texto-tenue">{rotulo}</dt>
        <dd className="text-[15px] leading-snug">{valor}</dd>
      </div>
      <button type="button" onClick={onClick} className="no-imprimir shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-acento hover:text-acento-vivo">
        <Pencil size={13} /> {accion}
      </button>
    </div>
  );
}

function Linea({ nombre, detalle, motivo, precio }) {
  return (
    <li className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-[15px] font-medium leading-snug">{nombre}</div>
        {detalle && <div className="text-xs text-texto-tenue mt-0.5">{detalle}</div>}
        {motivo && <div className="text-[11px] text-acento mt-0.5">{motivo}</div>}
      </div>
      {precio != null && <span className={`f-m shrink-0 text-[15px] ${precio === "a cotizar" || precio === "…" ? "text-texto-tenue" : ""}`}>{precio}</span>}
    </li>
  );
}

/* El resumen con la acción. Tres estados: ver, pedir (el formulario en
   el mismo lugar, sin ventana encima) y listo. */
function Resumen({ calculando, sinPrecios, mensual, puestaEnMarcha, faltan, cantidad, texto, whatsapp, pedido, mensajeInicial }) {
  const [modo, setModo] = useState("ver");     // ver | pedir | listo
  const [hecho, setHecho] = useState(null);     // { nombre, telefono }
  const [copiado, setCopiado] = useState(false);
  const enlaceWa = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(texto)}` : null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin permiso para el portapapeles: quedan WhatsApp e imprimir */ }
  };

  if (modo === "pedir") {
    return (
      <Tarjeta className="border-acento">
        <Pedido pedido={pedido} sinPrecio={mensual == null} mensajeInicial={mensajeInicial} onListo={(d) => { setHecho(d); setModo("listo"); }} onCancelar={() => setModo("ver")} />
      </Tarjeta>
    );
  }

  if (modo === "listo") {
    return (
      <Tarjeta className="border-bien">
        <span className="w-10 h-10 rounded-full bg-bien-suave text-bien flex items-center justify-center"><Check size={20} /></span>
        <h2 className="f-d text-xl mt-3">Listo, {hecho.nombre}.</h2>
        <p className="text-[15px] text-texto-suave mt-1 leading-relaxed">
          Guardamos tu pedido con estos {cantidad} módulos. <strong className="text-texto">Nos ponemos en contacto con vos por WhatsApp al {hecho.telefono}</strong>
          {mensual == null ? " con el precio y los pasos para arrancar." : " para confirmarlo y contarte los pasos para arrancar."}
        </p>
        {enlaceWa && (
          <a href={enlaceWa} target="_blank" rel="noopener noreferrer" className={`${ACCION} w-full mt-4 !py-3`}>
            <MessageCircle size={16} className="text-acento" /> ¿Querés adelantarlo? Escribinos ahora
          </a>
        )}
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="border-acento">
      <div className={ROTULO}>Por mes</div>
      {calculando && <p className="text-texto-suave text-[15px] mt-1">Calculando…</p>}
      {!calculando && mensual != null && (
        <div className="f-d f-m text-3xl mt-1">{pesos(mensual)} <span className="text-base text-texto-suave font-normal">por mes</span></div>
      )}
      {!calculando && mensual == null && (
        <>
          <div className="f-d text-2xl mt-1">Precio a confirmar</div>
          <p className="text-sm text-texto-suave mt-1 leading-relaxed">
            {sinPrecios
              ? `Nos ponemos en contacto con vos por WhatsApp y te pasamos el precio de estos ${cantidad} módulos. Sin compromiso.`
              : `Falta el precio de ${faltan.map(nombreDe).join(", ")}: nos ponemos en contacto y te lo confirmamos.`}
          </p>
        </>
      )}

      <ul className="mt-3 pt-3 border-t border-borde text-sm space-y-1.5">
        <li className="flex justify-between gap-3"><span className="text-texto-suave">Módulos</span><span className="font-semibold">{cantidad}</span></li>
        {!calculando && puestaEnMarcha > 0 && (
          <li className="flex justify-between gap-3"><span className="text-texto-suave">Puesta en marcha, una sola vez</span><span className="f-m font-semibold">{pesos(puestaEnMarcha)}</span></li>
        )}
      </ul>

      <div className="mt-4">
        <Boton onClick={() => setModo("pedir")}>
          <span className="inline-flex items-center gap-2">
            {mensual == null ? "Quiero que me contacten" : "Pedir este presupuesto"} <ArrowRight size={16} />
          </span>
        </Boton>
      </div>
      {/* El WhatsApp ahí nomás, y grande: el que prefiere hablar antes que
          llenar un formulario no tiene que buscarlo. */}
      {enlaceWa && (
        <a href={enlaceWa} target="_blank" rel="noopener noreferrer"
          className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-[15px] font-semibold border border-borde-fuerte hover:border-texto-tenue transition-colors">
          <MessageCircle size={17} className="text-acento" /> Escribinos por WhatsApp ahora
        </a>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" onClick={copiar} className={ACCION}><Copy size={15} /> {copiado ? "Copiado" : "Copiar"}</button>
        <button type="button" onClick={() => window.print()} className={ACCION}><Printer size={15} /> Imprimir</button>
      </div>
      <p className="text-[11px] text-texto-tenue mt-3 text-center leading-snug">
        Sin tarjeta, sin compromiso. {mensual == null ? "Te contactamos nosotros." : "El número que te confirmemos es el que pagás."}
      </p>
    </Tarjeta>
  );
}

function Pedido({ pedido, sinPrecio, mensajeInicial = "", onListo, onCancelar }) {
  const [d, setD] = useState({ nombre: "", telefono: "", email: "", mensaje: mensajeInicial });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    const falla = validarPedido(d);
    if (falla) { setError(falla); return; }
    setEnviando(true); setError(null);
    try {
      await pedirPresupuesto({ ...pedido, ...d, origen: typeof window !== "undefined" ? window.location.href : "" });
      onListo(d);
    } catch {
      setError("No pudimos guardar tu pedido. Probá de nuevo en un rato, o mandalo por WhatsApp.");
    }
    setEnviando(false);
  };

  return (
    <form onSubmit={enviar}>
      <div className={ROTULO}>{sinPrecio ? "Dejanos tu WhatsApp" : "Pedir este presupuesto"}</div>
      <p className="text-sm text-texto-suave mt-1 leading-relaxed">
        {sinPrecio
          ? "Nos ponemos en contacto con vos por WhatsApp con el precio y los pasos para arrancar. Sin tarjeta, sin compromiso."
          : "Nos ponemos en contacto con vos por WhatsApp para confirmarlo. Sin tarjeta, sin compromiso."}
      </p>

      <label className="block mt-4">
        <span className="text-xs font-semibold text-texto-suave">Tu nombre</span>
        <input value={d.nombre} onChange={set("nombre")} autoComplete="name" autoFocus className={CAMPO} />
      </label>
      <label className="block mt-3">
        <span className="text-xs font-semibold text-texto-suave">Tu WhatsApp</span>
        <input value={d.telefono} onChange={set("telefono")} inputMode="tel" autoComplete="tel" placeholder="11 2345 6789" className={`${CAMPO} f-m`} />
      </label>
      <label className="block mt-3">
        <span className="text-xs font-semibold text-texto-suave">Email <span className="font-normal text-texto-tenue">(opcional)</span></span>
        <input value={d.email} onChange={set("email")} type="email" autoComplete="email" className={CAMPO} />
      </label>
      <label className="block mt-3">
        <span className="text-xs font-semibold text-texto-suave">Algo que quieras contarnos <span className="font-normal text-texto-tenue">(opcional)</span></span>
        <textarea value={d.mensaje} onChange={set("mensaje")} rows={3} className={CAMPO} />
      </label>

      {error && <p className="text-sm text-mal mt-3">{error}</p>}

      <div className="mt-4">
        <Boton disabled={enviando}>{enviando ? "Enviando…" : "Enviar el pedido"}</Boton>
      </div>
      <button type="button" onClick={onCancelar} className="w-full text-sm text-texto-suave hover:text-texto mt-2 py-2">
        Volver al presupuesto
      </button>
    </form>
  );
}
