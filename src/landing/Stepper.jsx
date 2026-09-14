/* ============================================================
   EL ALTA GUIADA · tres pasos, un plan y listo
   ============================================================

   Sigue la maqueta de seis pantallas:

   1. ¿Qué negocio tenés? — buscador, píldoras por rubro y la grilla de
      negocios con foto. (Si la persona ya tocó su negocio en la portada,
      esta pantalla se saltea.)
   2. Contanos sobre tu negocio — los dolores como tarjetas con casilla,
      ícono, título y explicación. Cada dolor enciende módulos igual que
      una tilde del rubro; "Otro problema" abre un campo libre.
   2.5. ¿Cómo trabajás actualmente? — cuántos puestos, dónde vende,
      si tiene sucursales y qué otras cosas hace (las preguntas del
      rubro, con el módulo que encienden debajo).
   3. Tus módulos — la grilla de tarjetas: base con candado, los
      recomendados marcados con su motivo, y los que se pueden sumar.
   Tu presupuesto — Start, Pro y Empresa, con precio, botón y la misma
      lista de módulos con tilde naranja en los que incluye cada uno.
   ¡Listo! — el tilde grande, las cuatro tarjetas y el pedido: nombre y
      WhatsApp, que queda guardado (0074) y la plataforma ve en su panel.
      El detalle del presupuesto (lo que eligió, módulos con motivo y
      precio, qué necesita, qué pasa después) queda plegado debajo.

   Los precios salen de `tarifas` (la plataforma los edita desde su
   panel). Sin precios publicados se dice "a confirmar" y que nos
   ponemos en contacto; nunca se inventa un número.

   La cabeza está en src/datos/presupuesto.js y se prueba sin
   navegador; acá solo se dibuja.
   ============================================================ */

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, Lock, Search, Lightbulb, Sparkles, User, Users, Building2, Store, Laptop, Layers,
  Sprout, Crown, BarChart3, CreditCard, Headphones, RefreshCw, LayoutGrid, MessageCircle, Copy, Printer, Pencil,
} from "lucide-react";
import { MODULOS_BASE, moduloPorClave } from "../datos/modulos.js";
import { ESCALAS, DOLORES, GENERALES, conDolores, variantes, presupuestar, textoDelPresupuesto } from "../datos/presupuesto.js";
import { cargarTarifasPublicas, TARIFAS_VACIAS } from "../datos/tarifas.js";
import { pedirPresupuesto, validarPedido } from "../datos/solicitudes.js";
import { Tarjeta, Boton } from "../cliente/ui.jsx";
import { ICONO_RUBRO, ICONO_MODULO, ICONO_DOLOR, foto, Anotacion } from "./comun.jsx";

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";
const ETIQUETA = "text-[11px] uppercase tracking-[0.14em] font-bold text-acento";
const pesos = (n) => "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n));
const nombreDe = (k) => (moduloPorClave(k) || { n: k }).n;
const esDolor = (k) => DOLORES.some((d) => d.k === k);
const esGeneral = (k) => GENERALES.some((g) => g.k === k);

const BOTON = "inline-flex items-center justify-center gap-2 rounded-md text-[15px] px-[18px] py-3 transition-colors";
const SOLIDO = `${BOTON} bg-acento hover:bg-acento-vivo text-sobre-acento font-bold`;
const LINEA = `${BOTON} border border-borde-fuerte hover:border-texto-tenue text-texto font-semibold`;
const CAMPO = "mt-1 w-full border border-borde rounded-lg px-3 py-3 text-[15px] bg-superficie outline-none focus:border-acento";

const CANALES = [
  { k: "local", n: "En el local", I: Store },
  { k: "online", n: "Online", I: Laptop },
  { k: "ambos", n: "Ambos", I: Layers },
];
const ICONO_ESCALA = { "1": User, "2-3": Users, "4+": Building2 };
const ICONO_PLAN = { arrancar: Sprout, medida: Crown, completo: BarChart3 };

export default function Stepper({ rubro, rubros = [], negocio, onElegirNegocio, onVolver }) {
  const [paso, setPaso] = useState(2);            // 2 problemas · 3 cómo trabajás · 4 módulos · 5 plan · 6 listo
  const [escala, setEscala] = useState("1");
  const [canal, setCanal] = useState("local");    // local | online | ambos
  const [sucursales, setSucursales] = useState(false);
  const [respuestas, setRespuestas] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [sacados, setSacados] = useState([]);
  const [sumados, setSumados] = useState([]);
  const [opcion, setOpcion] = useState("medida");  // arrancar | medida | completo
  const [tarifas, setTarifas] = useState(null);    // null = todavía no se sabe

  useEffect(() => {
    let vigente = true;
    cargarTarifasPublicas()
      .then((t) => { if (vigente) setTarifas(t); })
      .catch(() => { if (vigente) setTarifas(TARIFAS_VACIAS); });
    return () => { vigente = false; };
  }, []);

  /* Los dolores y las preguntas generales (dónde vende, sucursales)
     entran como preguntas más del rubro: encienden módulos con su motivo
     y viajan en el pedido como cualquier respuesta. */
  const rubroArmado = useMemo(() => (rubro ? conDolores(rubro) : null), [rubro]);
  const respuestasTotales = useMemo(
    () => ({ ...respuestas, g_online: canal !== "local", g_sucursales: sucursales }),
    [respuestas, canal, sucursales],
  );
  const opciones = useMemo(
    () => (rubroArmado ? variantes({ rubro: rubroArmado, respuestas: respuestasTotales, sacados, sumados, escala }) : []),
    [rubroArmado, respuestasTotales, sacados, sumados, escala],
  );
  const medida = opciones.find((o) => o.k === "medida");
  const elegida = opciones.find((o) => o.k === opcion) || medida;
  const presupuesto = useMemo(
    () => (elegida ? presupuestar(tarifas || TARIFAS_VACIAS, elegida.armado.elegidos) : null),
    [tarifas, elegida],
  );

  const arriba = () => window.scrollTo(0, 0);
  const ir = (n) => { setPaso(n); arriba(); };
  const tildar = (k) => setRespuestas((r) => ({ ...r, [k]: !r[k] }));

  if (!rubro) return <ElegiNegocio rubros={rubros} onElegir={onElegirNegocio} onVolver={onVolver} />;

  const p = rubroArmado.presentacion;
  const preguntasRubro = rubro.presentacion.preguntas || [];

  if (paso === 2) {
    return (
      <Problemas respuestas={respuestas} onTildar={tildar} mensaje={mensaje} onMensaje={setMensaje}
        onVolver={onVolver} onSeguir={() => ir(3)} />
    );
  }
  if (paso === 3) {
    return (
      <ComoTrabajas preguntas={preguntasRubro} respuestas={respuestas} onTildar={tildar}
        escala={escala} onEscala={setEscala} canal={canal} onCanal={setCanal} sucursales={sucursales} onSucursales={setSucursales}
        onVolver={() => ir(2)} onSeguir={() => ir(4)} />
    );
  }
  if (paso === 4) {
    return (
      <Modulos armado={medida.armado} sacados={sacados} sumados={sumados}
        onSacar={(k) => setSacados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
        onSumar={(k) => setSumados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
        onVolver={() => ir(3)} onSeguir={() => { setOpcion("medida"); ir(5); }} />
    );
  }
  if (paso === 5) {
    return (
      <Plan opciones={opciones} tarifas={tarifas} todos={opciones.find((o) => o.k === "completo").armado.elegidos}
        onElegir={(k) => { setOpcion(k); ir(6); }} onVolver={() => ir(4)} />
    );
  }
  return (
    <Listo rubro={rubroArmado} negocio={negocio} escala={escala} canal={canal} sucursales={sucursales}
      respuestas={respuestasTotales} mensaje={mensaje} elegida={elegida} presupuesto={presupuesto} tarifas={tarifas}
      onVolver={() => ir(5)} onCambiarNegocio={onVolver} onEditarProblemas={() => ir(2)} onEditarTrabajo={() => ir(3)}
      onAjustar={() => { setOpcion("medida"); ir(4); }} onCambiarPlan={() => ir(5)} />
  );
}

/* ------------------------------------------------------------
   El marco de cada pantalla: volver, el indicador de tres pasos, la
   etiqueta, el título con una palabra en naranja, la bajada, la
   anotación a mano y los botones de abajo.
   ------------------------------------------------------------ */
function Marco({ indicador, etiqueta, titulo, sub, anotacion, ancho = "max-w-4xl", onVolver, volverTexto = "Volver",
  onSeguir, seguirTexto = "Continuar", seguirDeshabilitado = false, pie, children }) {
  return (
    <section className={`relative pt-4 mx-auto ${ancho}`}>
      <div className="no-imprimir">
        {onVolver && (
          <button type="button" onClick={onVolver} className="inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto">
            <ArrowLeft size={16} /> {volverTexto}
          </button>
        )}
        <Indicador actual={indicador} />
      </div>

      {anotacion && <Anotacion className="!top-24">{anotacion}</Anotacion>}

      <div className="mt-8 lg:pr-52">
        {etiqueta && <div className={ETIQUETA}>{etiqueta}</div>}
        <h1 className="f-d text-3xl sm:text-4xl leading-tight mt-2">{titulo}</h1>
        {sub && <p className="text-texto-suave mt-2 max-w-2xl leading-relaxed">{sub}</p>}
      </div>

      <div className="mt-6">{children}</div>

      {(onVolver || onSeguir) && (
        <div className="no-imprimir mt-8 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          {pie ? <div className="flex-1">{pie}</div>
            : onVolver ? <button type="button" onClick={onVolver} className={LINEA}><ArrowLeft size={16} /> {volverTexto}</button> : <span />}
          {onSeguir && (
            <button type="button" onClick={onSeguir} disabled={seguirDeshabilitado} className={`${SOLIDO} disabled:opacity-40 disabled:cursor-not-allowed`}>
              {seguirTexto} <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

const ETAPAS = ["Tu rubro", "Cómo trabajás", "Tus módulos"];

/* Tres círculos unidos por una línea: número en el que se está, tilde
   en los hechos. "Cómo trabajás" tiene dos pantallas (2 y 2.5). */
function Indicador({ actual }) {
  return (
    <ol className="mt-4 flex items-start justify-center">
      {ETAPAS.map((n, i) => {
        const num = i + 1;
        const activo = actual === num || (num === 2 && actual === 2.5);
        const hecho = !activo && actual > num;
        const rotulo = num === 2 && actual === 2.5 ? "2.5" : String(num);
        return (
          <li key={n} className="flex items-start">
            {i > 0 && <span className={`mt-4 h-[2px] w-10 sm:w-24 ${actual >= num ? "bg-acento" : "bg-borde-fuerte"}`} />}
            <div className="flex flex-col items-center w-[72px] sm:w-28">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold ${
                hecho || activo ? "bg-acento text-sobre-acento" : "bg-superficie border border-borde-fuerte text-texto-tenue"}`}>
                {hecho ? <Check size={15} strokeWidth={3} /> : rotulo}
              </span>
              <span className={`mt-1.5 text-[11px] font-semibold text-center leading-tight ${activo ? "text-texto" : "text-texto-tenue"}`}>{n}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Nota({ children, className = "" }) {
  return (
    <div className={`flex items-start gap-3 bg-superficie border border-borde rounded-xl px-4 py-3 text-sm text-texto-suave ${className}`}>
      <span className="w-8 h-8 rounded-lg bg-acento-suave text-acento flex items-center justify-center shrink-0"><Lightbulb size={16} /></span>
      <span className="leading-snug pt-1">{children}</span>
    </div>
  );
}

/* Una tarjeta con casilla: para los dolores, las preguntas del rubro y
   los módulos. Con `icono` lo muestra al lado de la casilla. */
function TarjetaCasilla({ activa, fija, onClick, icono: I, titulo, detalle, motivo, compacta = false }) {
  return (
    <button type="button" onClick={onClick} disabled={fija} aria-pressed={activa}
      className={`text-left flex items-start gap-3 rounded-xl border transition-colors ${compacta ? "p-3" : "p-4"} ${
        activa ? "border-acento bg-acento-suave/30" : "border-borde bg-superficie hover:border-borde-fuerte"} ${fija ? "opacity-80" : ""}`}>
      <span className={`w-5 h-5 mt-0.5 rounded border flex items-center justify-center shrink-0 ${
        activa ? "bg-acento border-acento text-sobre-acento" : "border-borde-fuerte"}`}>
        {activa && (fija ? <Lock size={11} /> : <Check size={13} strokeWidth={3} />)}
      </span>
      {I && (
        <span className={`${compacta ? "w-8 h-8" : "w-9 h-9"} rounded-lg flex items-center justify-center shrink-0 ${
          activa ? "bg-acento/15 text-acento" : "bg-superficie-2 text-texto-suave"}`}>
          <I size={compacta ? 16 : 18} />
        </span>
      )}
      <span className="min-w-0">
        <span className={`block font-semibold leading-snug ${compacta ? "text-[14px]" : "text-[15px]"}`}>{titulo}</span>
        {detalle && <span className="block text-xs text-texto-tenue mt-0.5 leading-snug">{detalle}</span>}
        {motivo && <span className="block text-[11px] text-acento mt-1 leading-snug">{motivo}</span>}
      </span>
    </button>
  );
}

/* Una opción grande con ícono arriba (puestos, dónde vendés). */
function OpcionGrande({ activa, onClick, icono: I, titulo, detalle }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activa}
      className={`rounded-xl border px-3 py-4 text-center min-h-[96px] flex flex-col items-center justify-center gap-1.5 transition-colors ${
        activa ? "border-acento bg-acento-suave/30" : "border-borde bg-superficie hover:border-borde-fuerte"}`}>
      <I size={22} className={activa ? "text-acento" : "text-texto-suave"} />
      <span className="f-d text-[15px] leading-tight">{titulo}</span>
      {detalle && <span className="text-[11px] text-texto-tenue leading-snug">{detalle}</span>}
    </button>
  );
}

/* ------------------------------------------------------------
   1 · ¿Qué negocio tenés?
   ------------------------------------------------------------ */
function ElegiNegocio({ rubros, onElegir, onVolver }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [sel, setSel] = useState(null);   // { clave, nombre }
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const negocios = rubros
    .flatMap((r) => (r.presentacion.negocios || [r.presentacion.titulo]).map((n) => ({ n, rubro: r })))
    .filter(({ n, rubro }) => (filtro === "todos" || rubro.clave === filtro)
      && (!busca || norm(n).includes(norm(busca)) || norm(rubro.nombre).includes(norm(busca)) || norm(rubro.presentacion.para).includes(norm(busca))));
  const filtros = [{ clave: "todos", nombre: "Todos" }, ...rubros.filter((r) => r.clave !== "otro")];

  return (
    <Marco indicador={1} etiqueta="Paso 1 de 3" titulo={<>¿Qué <span className="text-acento">negocio</span> tenés?</>}
      sub="Elegí tu rubro y empezamos a armar Genez para vos." anotacion="Tu negocio, en las mejores manos." ancho="max-w-5xl"
      onVolver={onVolver} volverTexto="Volver a la portada"
      onSeguir={() => sel && onElegir(sel.clave, sel.nombre)} seguirDeshabilitado={!sel}
      pie={<Nota>¿No encontrás tu rubro? También podemos armar un sistema a medida para tu negocio.</Nota>}>
      <label className="relative block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-tenue" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscá tu rubro… (ej. almacén, restaurante, estética)"
          className="w-full border border-borde rounded-lg pl-9 pr-3 py-3 text-[15px] bg-superficie outline-none focus:border-acento" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {filtros.map((r) => (
          <button key={r.clave} type="button" onClick={() => setFiltro(r.clave)}
            className={`text-sm font-semibold rounded-full border px-4 py-2 transition-colors ${
              filtro === r.clave ? "pildora-activa" : "border-borde-fuerte bg-superficie text-texto-suave hover:text-texto"}`}>
            {r.nombre}
          </button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {negocios.map(({ n, rubro }) => (
          <NegocioFoto key={`${rubro.clave}:${n}`} nombre={n} rubro={rubro}
            activa={!!sel && sel.clave === rubro.clave && sel.nombre === n} onElegir={() => setSel({ clave: rubro.clave, nombre: n })} />
        ))}
        {negocios.length === 0 && (
          <p className="col-span-full text-sm text-texto-suave">No encontramos ese rubro. Elegí «Otro» y contanos qué hacés.</p>
        )}
      </div>
    </Marco>
  );
}

function NegocioFoto({ nombre, rubro, activa, onElegir }) {
  const otro = rubro.clave === "otro";
  const I = otro ? ICONO_RUBRO.otro : (ICONO_RUBRO[rubro.presentacion.icono] || Store);
  const src = otro ? null : foto(nombre);
  return (
    <button type="button" onClick={onElegir} aria-pressed={activa}
      className={`text-left bg-superficie rounded-xl p-2 border transition-colors ${activa ? "border-acento ring-1 ring-acento" : "border-borde hover:border-borde-fuerte"}`}>
      <div className="h-[72px] rounded-lg overflow-hidden bg-superficie-2 flex items-center justify-center text-texto-tenue">
        {src ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" /> : <I size={24} />}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold leading-tight">
        <I size={12} className="text-acento shrink-0" /><span className="truncate">{otro ? "Otro" : nombre}</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------
   2 · Contanos sobre tu negocio (los dolores)
   ------------------------------------------------------------ */
function Problemas({ respuestas, onTildar, mensaje, onMensaje, onVolver, onSeguir }) {
  const otro = DOLORES.find((d) => d.otro);
  return (
    <Marco indicador={2} etiqueta="Paso 2 de 3" titulo={<>Contanos sobre <span className="text-acento">tu negocio</span></>}
      sub="Seleccioná los principales problemas que tenés en el día a día. Nos ayuda a recomendarte la mejor configuración."
      anotacion="Contanos lo que te pasa. Es el primer paso para mejorar." onVolver={onVolver} onSeguir={onSeguir}>
      <div className="grid sm:grid-cols-2 gap-3">
        {DOLORES.map((d) => (
          <TarjetaCasilla key={d.k} activa={!!respuestas[d.k]} onClick={() => onTildar(d.k)} icono={ICONO_DOLOR[d.k]} titulo={d.n} detalle={d.d} />
        ))}
      </div>
      {otro && respuestas[otro.k] && (
        <label className="block mt-3">
          <span className="text-xs font-semibold text-texto-suave">Contanos cuál</span>
          <textarea value={mensaje} onChange={(e) => onMensaje(e.target.value)} rows={3} autoFocus
            placeholder="Ej.: tengo dos cajas y a fin de mes nunca sé cuánto gané" className={CAMPO} />
        </label>
      )}
      <Nota className="mt-4">Con esta información te vamos a recomendar los módulos que realmente necesitás.</Nota>
    </Marco>
  );
}

/* ------------------------------------------------------------
   2.5 · ¿Cómo trabajás actualmente?
   ------------------------------------------------------------ */
function ComoTrabajas({ preguntas, respuestas, onTildar, escala, onEscala, canal, onCanal, sucursales, onSucursales, onVolver, onSeguir }) {
  return (
    <Marco indicador={2.5} etiqueta="Paso 2.5 de 3" titulo={<>¿Cómo <span className="text-acento">trabajás</span> actualmente?</>}
      sub="Un poco más de detalle para ajustar el sistema a tu realidad." anotacion="Cada negocio es único." onVolver={onVolver} onSeguir={onSeguir}>
      <div className={ROTULO}>¿Cuántos puestos de venta o atención tenés?</div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
        {ESCALAS.map((e) => (
          <OpcionGrande key={e.k} activa={escala === e.k} onClick={() => onEscala(e.k)} icono={ICONO_ESCALA[e.k] || User} titulo={e.n} detalle={e.d} />
        ))}
      </div>

      <div className={`${ROTULO} mt-6`}>¿Dónde vendés principalmente?</div>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-3">
        {CANALES.map((c) => <OpcionGrande key={c.k} activa={canal === c.k} onClick={() => onCanal(c.k)} icono={c.I} titulo={c.n} />)}
      </div>

      <div className={`${ROTULO} mt-6`}>¿Tenés sucursales?</div>
      <div className="mt-2 grid sm:grid-cols-2 gap-2 sm:gap-3">
        <TarjetaCasilla compacta activa={!sucursales} onClick={() => onSucursales(false)} titulo="No, solo un local" />
        <TarjetaCasilla compacta activa={sucursales} onClick={() => onSucursales(true)} titulo="Sí, varias sucursales" />
      </div>

      {preguntas.length > 0 && (
        <>
          <div className={`${ROTULO} mt-6`}>¿Qué otras cosas hacés?</div>
          <div className="mt-2 grid sm:grid-cols-2 gap-2 sm:gap-3">
            {preguntas.map((q) => (
              <TarjetaCasilla key={q.k} compacta activa={!!respuestas[q.k]} onClick={() => onTildar(q.k)} titulo={q.n}
                detalle={(q.modulos || []).map(nombreDe).join(" · ") || null} />
            ))}
          </div>
        </>
      )}
    </Marco>
  );
}

/* ------------------------------------------------------------
   3 · Tus módulos
   ------------------------------------------------------------ */
function Modulos({ armado, sacados, sumados, onSacar, onSumar, onVolver, onSeguir }) {
  const { elegidos, motivos, propuestos, sumables } = armado;
  const principales = [...propuestos, ...sumados.filter((k) => elegidos.includes(k) && !propuestos.includes(k)), ...sumables];
  return (
    <Marco indicador={3} etiqueta="Paso 3 de 3" titulo={<>Tus <span className="text-acento">módulos</span></>}
      sub="Estos son los módulos recomendados para tu negocio. Podés sumar o quitar los que necesites."
      anotacion="Sumá solo lo que necesitás. Sacá o agregá." ancho="max-w-5xl" onVolver={onVolver} onSeguir={onSeguir} seguirTexto="Ver mi presupuesto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className={ROTULO}>Módulos principales · {elegidos.length} elegidos</div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-acento border border-acento/60 rounded-full px-3 py-1">
          <Sparkles size={13} /> Según tus respuestas
        </span>
      </div>
      <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {principales.map((k) => {
          const m = moduloPorClave(k) || { n: k, d: "" };
          const base = MODULOS_BASE.includes(k);
          const activa = elegidos.includes(k);
          return (
            <TarjetaCasilla key={k} compacta activa={activa} fija={base} icono={ICONO_MODULO[k] || LayoutGrid} titulo={m.n} detalle={m.d}
              motivo={activa ? (motivos[k] || (base ? "Siempre incluido" : "")) : null}
              onClick={() => { if (base) return; if (propuestos.includes(k)) onSacar(k); else onSumar(k); }} />
          );
        })}
      </div>
    </Marco>
  );
}

/* ------------------------------------------------------------
   Tu presupuesto · Start, Pro y Empresa
   ------------------------------------------------------------ */
function Plan({ opciones, tarifas, todos, onElegir, onVolver }) {
  return (
    <Marco indicador={4} etiqueta="Tu presupuesto" titulo={<>Elegí el plan que <span className="text-acento">mejor se adapta</span></>}
      sub="Con los módulos que seleccionaste, te recomendamos estos planes. Si en el futuro necesitás más, podés cambiar de plan o sumar módulos."
      anotacion="Mismo sistema. Más posibilidades." ancho="max-w-5xl" onVolver={onVolver}>
      <div className="grid md:grid-cols-3 gap-4 pt-3">
        {opciones.map((o) => <TarjetaPlan key={o.k} opcion={o} tarifas={tarifas} todos={todos} onElegir={() => onElegir(o.k)} />)}
      </div>
      <Confianza className="mt-8" />
    </Marco>
  );
}

function TarjetaPlan({ opcion, tarifas, todos, onElegir }) {
  const pre = presupuestar(tarifas || TARIFAS_VACIAS, opcion.armado.elegidos);
  const calculando = tarifas === null;
  const I = ICONO_PLAN[opcion.k] || Sparkles;
  const incluye = (k) => opcion.armado.elegidos.includes(k);
  return (
    <div className={`relative bg-superficie rounded-xl p-5 border flex flex-col ${opcion.recomendado ? "border-acento ring-1 ring-acento" : "border-borde"}`}>
      {opcion.recomendado && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider font-bold bg-acento text-sobre-acento rounded px-2.5 py-1 whitespace-nowrap">Recomendado</span>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="f-d text-xl leading-tight">{opcion.n}</div>
          <div className="text-xs text-texto-suave mt-0.5">{opcion.d}</div>
        </div>
        <span className="w-10 h-10 rounded-lg bg-acento-suave text-acento flex items-center justify-center shrink-0"><I size={20} /></span>
      </div>
      <div className="mt-4">
        {calculando && <div className="text-texto-suave text-sm">Calculando…</div>}
        {!calculando && pre.mensual != null && (
          <div className="f-d f-m text-3xl">{pesos(pre.mensual)} <span className="text-sm text-texto-suave font-normal">/mes</span></div>
        )}
        {!calculando && pre.mensual == null && <div className="f-d text-xl">Precio a confirmar</div>}
        <div className="text-[11px] text-texto-tenue mt-0.5">{pre.cantidad} módulos · cobro, caja y ajustes incluidos</div>
      </div>
      <button type="button" onClick={onElegir} className={`${opcion.recomendado ? SOLIDO : LINEA} mt-4 w-full !py-2.5 text-sm`}>
        {opcion.recomendado ? "Plan recomendado" : "Seleccionar plan"}
      </button>
      <ul className="mt-4 pt-4 border-t border-borde space-y-1.5 flex-1">
        {todos.map((k) => {
          const si = incluye(k);
          return (
            <li key={k} className={`flex items-center gap-2 text-sm ${si ? "text-texto font-semibold" : "text-texto-tenue"}`}>
              {si
                ? <span className="w-4 h-4 rounded-full bg-acento text-sobre-acento flex items-center justify-center shrink-0"><Check size={11} strokeWidth={3} /></span>
                : <span className="w-4 h-4 rounded-full border border-borde-fuerte shrink-0" />}
              {nombreDe(k)}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-texto-suave mt-4 pt-3 border-t border-borde">{opcion.lema}</p>
    </div>
  );
}

/* Lo que se puede prometer hoy. Nada de tarjeta: no se cobra online. */
const CONFIANZA = [
  [CreditCard, "Sin tarjeta para empezar", "Sin compromiso"],
  [Headphones, "Soporte real", "Te acompañamos siempre"],
  [RefreshCw, "Podés cambiar de plan", "Cuando lo necesites"],
  [LayoutGrid, "Todo en un mismo lugar", "Para hacer crecer tu negocio"],
];

function Confianza({ className = "", cuantos = 3 }) {
  return (
    <ul className={`grid sm:grid-cols-${cuantos === 4 ? "2 lg:grid-cols-4" : "3"} gap-3 ${className}`}>
      {CONFIANZA.slice(0, cuantos).map(([I, t, d]) => (
        <li key={t} className="flex items-center gap-3 bg-superficie border border-borde rounded-xl px-4 py-3">
          <span className="w-9 h-9 rounded-lg bg-acento-suave text-acento flex items-center justify-center shrink-0"><I size={17} /></span>
          <span><span className="block text-sm font-bold leading-tight">{t}</span><span className="block text-[11px] text-texto-tenue">{d}</span></span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------
   ¡Listo! · el pedido, y el detalle plegado debajo
   ------------------------------------------------------------ */
function Listo({ rubro, negocio, escala, canal, sucursales, respuestas, mensaje, elegida, presupuesto, tarifas,
  onVolver, onCambiarNegocio, onEditarProblemas, onEditarTrabajo, onAjustar, onCambiarPlan }) {
  const p = rubro.presentacion;
  const armado = elegida.armado;
  const { lineas, base, mensual, puestaEnMarcha, faltan, cantidad } = presupuesto;
  const calculando = tarifas === null;
  const sinPrecios = !calculando && base == null;
  const opcionales = lineas.filter((l) => !l.base);
  const nombresBase = lineas.filter((l) => l.base).map((l) => l.n).join(", ");
  const marcadas = (p.preguntas || []).filter((q) => respuestas[q.k]);
  const tildes = marcadas.filter((q) => !esDolor(q.k) && !esGeneral(q.k));
  const dolores = marcadas.filter((q) => esDolor(q.k));
  const puestos = ESCALAS.find((e) => e.k === escala) || ESCALAS[0];
  const canalNombre = (CANALES.find((c) => c.k === canal) || CANALES[0]).n;
  const texto = textoDelPresupuesto({ rubro, negocio, escala, opcion: elegida.n, presupuesto, pesos });
  const whatsapp = (tarifas && tarifas.whatsapp) || "";
  const titulo = negocio && negocio !== p.titulo ? `${negocio} · ${p.titulo}` : p.titulo;

  /* Lo que se guarda si pide el presupuesto: tal cual lo vio. */
  const pedido = {
    negocio: negocio || p.titulo,
    rubro: rubro.clave,
    escala,
    respuestas: [...marcadas.map((q) => ({ k: q.k, n: q.n })), { k: "presupuesto", n: `Plan ${elegida.n}` }],
    modulos: armado.elegidos,
    mensual,
    puesta_en_marcha: puestaEnMarcha,
  };

  return (
    <section className="relative pt-4 mx-auto max-w-4xl">
      <div className="no-imprimir">
        <button type="button" onClick={onVolver} className="inline-flex items-center gap-1.5 text-sm text-texto-suave hover:text-texto">
          <ArrowLeft size={16} /> Volver
        </button>
        <Indicador actual={4} />
      </div>

      <div className="mt-8 text-center">
        <div className="brillo mx-auto w-28 h-28 rounded-full flex items-center justify-center">
          <span className="w-16 h-16 rounded-full bg-acento text-sobre-acento flex items-center justify-center"><Check size={34} strokeWidth={3} /></span>
        </div>
        <div className={`${ETIQUETA} mt-6`}>¡Listo!</div>
        <h1 className="f-d text-3xl sm:text-4xl leading-tight mt-2">Tu Genez está casi listo.</h1>
        <p className="text-texto-suave mt-3 max-w-xl mx-auto leading-relaxed">
          Plan <strong className="text-texto">{elegida.n}</strong> para <strong className="text-texto">{titulo}</strong>: {cantidad} módulos
          {!calculando && mensual != null ? <>, <strong className="text-texto">{pesos(mensual)} por mes</strong></> : null}.
          Dejanos tu WhatsApp y nos ponemos en contacto para dejarlo andando.
        </p>
      </div>

      <div className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-8 items-start">
        <div className="lg:order-2 lg:sticky lg:top-24 no-imprimir">
          <Resumen key={elegida.k} calculando={calculando} sinPrecios={sinPrecios} mensual={mensual} puestaEnMarcha={puestaEnMarcha}
            faltan={faltan} cantidad={cantidad} texto={texto} whatsapp={whatsapp} pedido={pedido} mensajeInicial={mensaje} plan={elegida.n} />
        </div>

        <div className="lg:order-1 space-y-3">
          <Confianza cuantos={4} className="!grid-cols-2" />

          <details className="group">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 bg-superficie border border-borde rounded-xl px-4 py-3 text-sm font-semibold">
              Ver el detalle de tu presupuesto
              <span className="text-texto-tenue group-open:hidden">+</span><span className="text-texto-tenue hidden group-open:inline">–</span>
            </summary>
            <div className="mt-3 space-y-3">
              <Tarjeta>
                <div className={`${ROTULO} mb-3`}>Lo que elegiste</div>
                <dl className="divide-y divide-borde">
                  <Eleccion rotulo="Negocio" valor={titulo} accion="Cambiar" onClick={onCambiarNegocio} />
                  <Eleccion rotulo="Plan" valor={`${elegida.n} · ${elegida.d}`} accion="Cambiar" onClick={onCambiarPlan} />
                  <Eleccion rotulo="Te complica" valor={dolores.length ? dolores.map((q) => q.n).join(" · ") : "No marcaste nada"} accion="Editar" onClick={onEditarProblemas} />
                  <Eleccion rotulo="Cómo trabajás" valor={`${puestos.n} · ${canalNombre} · ${sucursales ? "varias sucursales" : "un solo local"}${tildes.length ? " · " + tildes.map((q) => q.n).join(" · ") : ""}`} accion="Editar" onClick={onEditarTrabajo} />
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
          </details>

          <div className="manuscrita text-right text-[19px] leading-[1.05] text-texto rotate-2 pt-2 pr-2" aria-hidden="true">Gracias por confiar en Genez.</div>
        </div>
      </div>
    </section>
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

const ACCION = "inline-flex items-center justify-center gap-1.5 rounded-md border border-borde-fuerte hover:border-texto-tenue text-sm font-semibold px-2 py-2 transition-colors";

/* El resumen con la acción. Tres estados: ver, pedir (el formulario en
   el mismo lugar, sin ventana encima) y listo. */
function Resumen({ calculando, sinPrecios, mensual, puestaEnMarcha, faltan, cantidad, texto, whatsapp, pedido, mensajeInicial, plan }) {
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
          Guardamos tu pedido del plan {plan} con {cantidad} módulos. <strong className="text-texto">Nos ponemos en contacto con vos por WhatsApp al {hecho.telefono}</strong>
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
      <div className={ROTULO}>Plan {plan} · por mes</div>
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
            {mensual == null ? "Quiero que me contacten" : "Quiero empezar"} <ArrowRight size={16} />
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
      <div className={ROTULO}>{sinPrecio ? "Dejanos tu WhatsApp" : "Quiero empezar"}</div>
      <p className="text-sm text-texto-suave mt-1 leading-relaxed">
        {sinPrecio
          ? "Nos ponemos en contacto con vos por WhatsApp con el precio y los pasos para arrancar. Sin tarjeta, sin compromiso."
          : "Nos ponemos en contacto con vos por WhatsApp para dejar tu Genez andando. Sin tarjeta, sin compromiso."}
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
        Volver
      </button>
    </form>
  );
}
