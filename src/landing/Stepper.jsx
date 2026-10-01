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
  ShoppingCart, ShoppingBasket, Archive, FileText, Truck, Coins, MapPin, ClipboardList, Rocket, Plus, Minus, Leaf, Cherry, Croissant, Hammer, Bath, Martini, Coffee, ConciergeBell, Beer, Drumstick, ShoppingBag,
  Flower2, Scissors, Slice, PersonStanding, Dumbbell, Stethoscope, Flower, Ellipsis, UtensilsCrossed, CalendarDays,
} from "lucide-react";
import { estaOscuro } from "./tema.js";
import { MODULOS_BASE, moduloPorClave, nivelDe } from "../datos/modulos.js";
import { ESCALAS, DOLORES, GENERALES, conDolores, armarModulos, planes, presupuestar, textoDelPresupuesto } from "../datos/presupuesto.js";
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
const ICONO_PLAN = { start: Sprout, pro: Crown, empresa: BarChart3 };

export default function Stepper({ rubro, rubros = [], negocio, onElegirNegocio, onVolver }) {
  const [paso, setPaso] = useState(2);            // 2 problemas · 3 cómo trabajás · 4 módulos · 5 plan · 6 listo
  const [escala, setEscala] = useState("1");
  const [canal, setCanal] = useState("local");    // local | online | ambos
  const [sucursales, setSucursales] = useState(false);
  const [respuestas, setRespuestas] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [sacados, setSacados] = useState([]);
  const [sumados, setSumados] = useState([]);
  const [opcion, setOpcion] = useState(null);      // start | pro | empresa; null = el recomendado
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
  /* Lo que necesita según sus respuestas (para el paso 3 y para
     recomendar), y los tres planes fijos con el recomendado marcado. */
  const necesidad = useMemo(
    () => (rubroArmado ? armarModulos({ rubro: rubroArmado, respuestas: respuestasTotales, sacados, sumados, escala }) : null),
    [rubroArmado, respuestasTotales, sacados, sumados, escala],
  );
  const opciones = useMemo(
    () => (rubroArmado ? planes({ rubro: rubroArmado, respuestas: respuestasTotales, sacados, sumados, escala }) : []),
    [rubroArmado, respuestasTotales, sacados, sumados, escala],
  );
  const recomendada = opciones.find((o) => o.recomendado);
  const elegida = opciones.find((o) => o.k === opcion) || recomendada;
  const presupuesto = useMemo(
    () => (elegida ? presupuestar(tarifas || TARIFAS_VACIAS, elegida.armado.elegidos) : null),
    [tarifas, elegida],
  );

  const arriba = () => window.scrollTo(0, 0);
  const ir = (n) => { setPaso(n); arriba(); };
  const tildar = (k) => setRespuestas((r) => ({ ...r, [k]: !r[k] }));

  if (!rubro) return <ElegiNegocio rubros={rubros} onElegir={onElegirNegocio} onVolver={onVolver} />;

  /* En claro, los pasos que todavía no tienen su maqueta clara siguen en
     el contenedor angosto de antes; los copiados van a todo el ancho. */
  const angosto = (contenido) => (estaOscuro() ? contenido : <div className="max-w-5xl mx-auto px-5 pb-20">{contenido}</div>);
  const p = rubroArmado.presentacion;
  const preguntasRubro = rubro.presentacion.preguntas || [];

  if (paso === 2) {
    return (
      <Problemas respuestas={respuestas} onTildar={tildar} mensaje={mensaje} onMensaje={setMensaje}
        onVolver={onVolver} onSeguir={() => ir(3)} />
    );
  }
  if (paso === 3) {
    return angosto(
      <ComoTrabajas preguntas={preguntasRubro} respuestas={respuestas} onTildar={tildar}
        escala={escala} onEscala={setEscala} canal={canal} onCanal={setCanal} sucursales={sucursales} onSucursales={setSucursales}
        onVolver={() => ir(2)} onSeguir={() => ir(4)} />
    );
  }
  if (paso === 4) {
    return (
      <Modulos armado={necesidad} recomendada={recomendada} sacados={sacados} sumados={sumados}
        onSacar={(k) => setSacados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
        onSumar={(k) => setSumados((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
        onVolver={() => ir(3)} onSeguir={() => { setOpcion(null); ir(5); }} />
    );
  }
  if (paso === 5) {
    return (
      <Plan opciones={opciones} tarifas={tarifas} todos={opciones[opciones.length - 1].armado.elegidos}
        onElegir={(k) => { setOpcion(k); ir(6); }} onVolver={() => ir(4)} />
    );
  }
  return (
    <Listo rubro={rubroArmado} negocio={negocio} escala={escala} canal={canal} sucursales={sucursales}
      respuestas={respuestasTotales} mensaje={mensaje} elegida={elegida} presupuesto={presupuesto} tarifas={tarifas}
      onVolver={() => ir(5)} onCambiarNegocio={onVolver} onEditarProblemas={() => ir(2)} onEditarTrabajo={() => ir(3)}
      onAjustar={() => { setOpcion(null); ir(4); }} onCambiarPlan={() => ir(5)} />
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
/* Un color por plan, el mismo en todos lados: verde Start, naranja Pro,
   azul Empresa. Son los tonos de estado que ya existen en el sistema. */
const TONO_NIVEL = {
  start: "border-bien text-bien",
  pro: "border-acento text-acento",
  empresa: "border-info text-info",
};
const FONDO_NIVEL = {
  start: "bg-bien-suave text-bien",
  pro: "bg-acento-suave text-acento",
  empresa: "bg-info-suave text-info",
};

function TarjetaCasilla({ activa, fija, onClick, icono: I, titulo, detalle, motivo, etiqueta, compacta = false }) {
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
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold leading-snug ${compacta ? "text-[14px]" : "text-[15px]"}`}>{titulo}</span>
        {detalle && <span className="block text-xs text-texto-tenue mt-0.5 leading-snug">{detalle}</span>}
        {motivo && <span className="block text-[11px] text-acento mt-1 leading-snug">{motivo}</span>}
      </span>
      {etiqueta && (
        <span className={`shrink-0 text-[9px] uppercase tracking-wider font-bold rounded border px-1.5 py-0.5 ${TONO_NIVEL[etiqueta.k] || TONO_NIVEL.empresa}`}>{etiqueta.n}</span>
      )}
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
/* En oscuro, el paso 1 es la maqueta del 01/10 copiada tal cual: las
   fotos de cada negocio y los costados son recortes de la maqueta, y el
   resto (buscador, filtros, tarjetas, "Continuar") anda igual que antes.
   El claro sigue con la de antes. */
/* El claro (01/10) es la misma maqueta con otra luz: el mismo paso, con
   sus recortes en alta-claro y la clase an-dia en la sección, que cambia
   los colores de todo lo que es an-*. */
function ElegiNegocio(props) {
  return <ElegiNegocioNoche {...props} claro={!estaOscuro()} />;
}

const slugAlta = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const FOTOS_ALTA = new Set(["almacen", "minimercado", "kiosco", "dietetica", "verduleria", "panaderia", "ferreteria", "casa-de-sanitarios", "bar", "cafe",
  "restaurante", "cerveceria", "rotiseria", "take-away", "estetica", "peluqueria", "barberia", "pilates", "gimnasio", "consultorio", "spa"]);
/* El ícono de cada negocio en la maqueta. Uno nuevo usa el de su rubro. */
const ICONO_NEGOCIO = {
  "Almacén": ShoppingCart, "Minimercado": ShoppingBasket, "Kiosco": Store, "Dietética": Leaf, "Verdulería": Cherry, "Panadería": Croissant,
  "Ferretería": Hammer, "Casa de sanitarios": Bath, "Bar": Martini, "Café": Coffee, "Restaurante": ConciergeBell, "Cervecería": Beer,
  "Rotisería": Drumstick, "Take away": ShoppingBag, "Estética": Flower2, "Peluquería": Scissors, "Barbería": Slice, "Pilates": PersonStanding,
  "Gimnasio": Dumbbell, "Consultorio": Stethoscope, "Spa": Flower,
};
const PILDORA_ALTA = { todos: LayoutGrid, minimercado: Store, gastronomia: UtensilsCrossed, servicios: CalendarDays };

/* Los tres pasos de arriba, como en las maquetas: el actual en naranja
   con su número, los hechos en naranja con tilde, y la línea naranja
   hasta el actual. */
function PasosNoche({ actual, className = "" }) {
  return (
    <ol className={`an-pasos ${className}`}>
      {ETAPAS.map((n, i) => {
        const num = i + 1;
        /* El 2.5 es el paso 2 todavía: naranja y con "2.5" adentro. */
        const activo = num === Math.floor(actual);
        const estado = activo ? "an-paso-activo" : num < actual ? "an-paso-hecho" : "";
        return (
          <li key={n} className={estado}>
            {i > 0 && <span className={`an-linea ${num <= actual ? "an-linea-hecha" : ""}`} aria-hidden="true" />}
            <span className="an-paso">
              <span className="an-numero">{activo ? actual : num < actual ? <Check strokeWidth={3} /> : num}</span>
              <span className="an-paso-nombre">{n}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ElegiNegocioNoche({ rubros, onElegir, onVolver, claro = false }) {
  const dir = claro ? "/landing/alta-claro" : "/landing/alta";
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [sel, setSel] = useState(null);
  const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const negocios = rubros
    .flatMap((r) => (r.presentacion.negocios || [r.presentacion.titulo]).map((n) => ({ n, rubro: r })))
    .filter(({ n, rubro }) => (filtro === "todos" || rubro.clave === filtro)
      && (!busca || norm(n).includes(norm(busca)) || norm(rubro.nombre).includes(norm(busca)) || norm(rubro.presentacion.para).includes(norm(busca))));
  const filtros = [{ clave: "todos", nombre: "Todos" }, ...rubros.filter((r) => r.clave !== "otro")];

  return (
    <section className={`an-seccion ${claro ? "an-dia" : ""} relative overflow-hidden`}>
      <img src={`${dir}/costado-izquierdo.jpg`} alt="" aria-hidden="true" className="an-costado an-costado-izq" />
      <img src={`${dir}/costado-derecho.jpg`} alt="" aria-hidden="true" className="an-costado an-costado-der" />
      <div className="an-contenido relative">
        <div className="an-arriba">
          <button type="button" onClick={onVolver} className="an-volver"><ArrowLeft strokeWidth={1.75} /> Volver a la portada</button>
          <PasosNoche actual={1} />
        </div>

        <div className="an-cabeza">
          <div>
            <div className="an-etiqueta">Paso 1 de 3</div>
            <h1 className="an-titulo">¿Qué <span className="an-naranja">negocio</span> tenés?</h1>
            <p className="an-bajada">Elegí tu rubro y empezamos a armar Genez para vos.</p>
          </div>
          <div className="manuscrita an-nota" aria-hidden="true">
            Tu negocio, en las<br />mejores manos.
            <svg viewBox="0 0 60 40" className="an-nota-flecha" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M52 4 C 48 20, 34 32, 10 34" /><path d="M18 27 L 9 34 L 19 38" />
            </svg>
          </div>
        </div>

        <label className="an-buscador">
          <Search strokeWidth={1.75} className="an-buscador-icono" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscá tu rubro... (ej. almacén, restaurante, estética)" />
        </label>

        <div className="an-pildoras">
          {filtros.map((r) => {
            const I = PILDORA_ALTA[r.clave] || Store;
            return (
              <button key={r.clave} type="button" onClick={() => setFiltro(r.clave)} className={`an-pildora ${filtro === r.clave ? "an-pildora-activa" : ""}`}>
                <I strokeWidth={1.75} className="an-pildora-icono" /> {r.nombre}
              </button>
            );
          })}
        </div>

        <div className="an-grilla">
          {negocios.map(({ n, rubro }) => {
            const otro = rubro.clave === "otro";
            const activa = !!sel && sel.clave === rubro.clave && sel.nombre === n;
            const I = otro ? Ellipsis : (ICONO_NEGOCIO[n] || ICONO_RUBRO[rubro.presentacion.icono] || Store);
            const src = otro ? null : FOTOS_ALTA.has(slugAlta(n)) ? `${dir}/${slugAlta(n)}.jpg` : foto(n);
            return (
              <button key={`${rubro.clave}:${n}`} type="button" aria-pressed={activa} onClick={() => setSel({ clave: rubro.clave, nombre: n })}
                className={`an-tarjeta ${activa ? "an-tarjeta-activa" : ""}`}>
                <span className="an-foto">{src ? <img src={src} alt="" loading="lazy" /> : <Ellipsis strokeWidth={2.5} className="an-otro" />}</span>
                <span className="an-barra">
                  <I strokeWidth={1.75} className="an-icono" />
                  <span className="an-nombre">{otro ? "Otro" : n}</span>
                  <span className="an-ir"><ArrowRight strokeWidth={2.25} /></span>
                </span>
              </button>
            );
          })}
          {negocios.length === 0 && <p className="an-vacio">No encontramos ese rubro. Elegí «Otro» y contanos qué hacés.</p>}
        </div>

        <div className="an-pie">
          <div className="an-aviso"><Lightbulb strokeWidth={1.75} className="an-aviso-icono" /> ¿No encontrás tu rubro? También podemos armar un sistema a medida para tu negocio.</div>
          <button type="button" onClick={() => sel && onElegir(sel.clave, sel.nombre)} disabled={!sel} className="an-continuar">
            Continuar <ArrowRight strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   2 · Contanos sobre tu negocio (los dolores)
   ------------------------------------------------------------ */
/* En oscuro, el paso 2 es la maqueta del 01/10 tal cual: los costados (la
   laptop con el logo, el portapapeles con las tildes) son recortes de la
   maqueta y el resto anda como siempre. El claro sigue con el de antes. */
function Problemas(props) {
  return <ProblemasNoche {...props} claro={!estaOscuro()} />;
}

function ProblemasNoche({ respuestas, onTildar, mensaje, onMensaje, onVolver, onSeguir, claro = false }) {
  const otro = DOLORES.find((d) => d.otro);
  const dir = claro ? "/landing/alta-claro" : "/landing/alta";
  return (
    <section className={`an-seccion pn-seccion ${claro ? "an-dia" : ""} relative overflow-hidden`}>
      <img src={`${dir}/paso2-izquierdo.jpg`} alt="" aria-hidden="true" className="an-costado pn-costado-izq" />
      <img src={`${dir}/paso2-derecho.jpg`} alt="" aria-hidden="true" className="an-costado pn-costado-der" />
      <div className="an-contenido pn-contenido relative">
        <div className="an-arriba pn-arriba">
          <button type="button" onClick={onVolver} className="an-volver"><ArrowLeft strokeWidth={1.75} /> Volver</button>
          <PasosNoche actual={2} className="pn-pasos" />
        </div>

        <div className="an-cabeza">
          <div>
            <div className="an-etiqueta pn-etiqueta">Paso 2 de 3</div>
            <h1 className="an-titulo pn-titulo">Contanos sobre <span className="an-naranja">tu negocio</span></h1>
            <p className="an-bajada pn-bajada">Seleccioná los principales problemas que tenés en el día a día.<br />Nos ayuda a recomendarte la mejor configuración.</p>
          </div>
          <div className="manuscrita pn-nota" aria-hidden="true">
            Contanos lo que te pasa.<br />Es el primer paso para<br />mejorar.
            <svg viewBox="0 0 80 30" className="pn-nota-flecha" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 10 C 20 26, 50 26, 72 18" /><path d="M62 12 L 73 18 L 63 25" />
            </svg>
          </div>
        </div>

        <div className="pn-grilla">
          {DOLORES.map((d) => {
            /* La maqueta muestra un gráfico en "cuánto gano", no el chanchito. */
            const I = (d.k === "d_ganancia" ? BarChart3 : ICONO_DOLOR[d.k]) || MessageCircle;
            const activa = !!respuestas[d.k];
            return (
              <button key={d.k} type="button" onClick={() => onTildar(d.k)} aria-pressed={activa} className={`pn-tarjeta ${activa ? "pn-tarjeta-activa" : ""}`}>
                <span className="pn-casilla">{activa && <Check strokeWidth={3} />}</span>
                <span className="pn-icono"><I strokeWidth={1.75} /></span>
                <span className="pn-textos">
                  <span className="pn-titulo-tarjeta">{d.n}</span>
                  <span className="pn-detalle">{d.d}</span>
                </span>
                <span className="pn-ir" aria-hidden="true"><ArrowRight strokeWidth={2} /></span>
              </button>
            );
          })}
        </div>

        {otro && respuestas[otro.k] && (
          <label className="pn-otro">
            <span>Contanos cuál</span>
            <textarea value={mensaje} onChange={(e) => onMensaje(e.target.value)} rows={3} autoFocus
              placeholder="Ej.: tengo dos cajas y a fin de mes nunca sé cuánto gané" />
          </label>
        )}

        <div className="an-aviso pn-aviso">
          <span className="pn-aviso-icono"><Lightbulb strokeWidth={1.75} /></span>
          Con esta información te vamos a recomendar los módulos que realmente necesitás.
        </div>

        <div className="pn-botones">
          <button type="button" onClick={onVolver} className="pn-volver-boton"><ArrowLeft strokeWidth={2} /> Volver</button>
          <button type="button" onClick={onSeguir} className="an-continuar pn-continuar">Continuar <ArrowRight strokeWidth={2.25} /></button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   2.5 · ¿Cómo trabajás actualmente?
   ------------------------------------------------------------ */
function ComoTrabajas(props) {
  if (estaOscuro()) return <ComoTrabajasNoche {...props} />;
  return <ComoTrabajasClaro {...props} />;
}

/* En oscuro es la maqueta del 01/10 copiada tal cual. Los íconos de "¿Qué
   otras cosas hacés?" son los de la maqueta para las preguntas de
   minimercado; las de otros rubros usan el ícono de su primer módulo. */
const ICONO_PREGUNTA = { stock: Archive, compras: ShoppingCart, peso: ShoppingCart, factura: FileText, pedidos: Truck, equipo: Users, asistente: Sparkles };

function Radio({ activa }) {
  return <span className={`ct-radio ${activa ? "ct-radio-activa" : ""}`} aria-hidden="true">{activa && <Check strokeWidth={3} />}</span>;
}

function Casilla({ activa }) {
  return <span className={`ct-casilla ${activa ? "ct-casilla-activa" : ""}`} aria-hidden="true">{activa && <Check strokeWidth={3} />}</span>;
}

function ComoTrabajasNoche({ preguntas, respuestas, onTildar, escala, onEscala, canal, onCanal, sucursales, onSucursales, onVolver, onSeguir }) {
  return (
    <section className="an-seccion ct-seccion relative overflow-hidden">
      <img src="/landing/alta/paso25-izquierdo.jpg" alt="" aria-hidden="true" className="an-costado ct-costado-izq" />
      <img src="/landing/alta/paso25-derecho.jpg" alt="" aria-hidden="true" className="an-costado ct-costado-der" />
      <div className="an-contenido ct-contenido relative">
        <div className="an-arriba ct-arriba">
          <button type="button" onClick={onVolver} className="an-volver"><ArrowLeft strokeWidth={1.75} /> Volver</button>
          <PasosNoche actual={2.5} className="ct-pasos" />
        </div>
        <div className="manuscrita ct-nota" aria-hidden="true">
          Cada negocio es único.
          <svg viewBox="0 0 60 30" className="ct-nota-flecha" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M56 4 C 50 18, 30 24, 6 22" /><path d="M14 15 L 5 22 L 15 28" />
          </svg>
        </div>

        <div className="an-etiqueta pn-etiqueta ct-etiqueta">Paso 2.5 de 3</div>
        <h1 className="an-titulo ct-titulo">¿Cómo <span className="an-naranja">trabajás</span> actualmente?</h1>
        <p className="an-bajada ct-bajada">Un poco más de detalle para ajustar el sistema a tu realidad.</p>

        <div className="ct-rotulo ct-rotulo-primero">¿Cuántos puestos de venta o atención tenés?</div>
        <div className="ct-tres">
          {ESCALAS.map((e) => {
            const I = ICONO_ESCALA[e.k] || User;
            const activa = escala === e.k;
            return (
              <button key={e.k} type="button" onClick={() => onEscala(e.k)} aria-pressed={activa} className={`ct-opcion ct-escala ${activa ? "ct-activa" : ""}`}>
                <Radio activa={activa} />
                <I className="ct-opcion-icono" strokeWidth={1.5} />
                <span className="ct-opcion-titulo">{e.n}</span>
                <span className="ct-opcion-detalle">{e.d}</span>
              </button>
            );
          })}
        </div>

        <div className="ct-rotulo">¿Dónde vendés principalmente?</div>
        <div className="ct-tres">
          {CANALES.map((c) => {
            const activa = canal === c.k;
            return (
              <button key={c.k} type="button" onClick={() => onCanal(c.k)} aria-pressed={activa} className={`ct-opcion ct-canal ${activa ? "ct-activa" : ""}`}>
                <Radio activa={activa} />
                <c.I className="ct-opcion-icono" strokeWidth={1.5} />
                <span className="ct-opcion-titulo">{c.n}</span>
              </button>
            );
          })}
        </div>

        <div className="ct-rotulo">¿Tenés sucursales?</div>
        <div className="ct-dos">
          {[[false, "No, solo un local"], [true, "Sí, varias sucursales"]].map(([v, t]) => (
            <button key={t} type="button" onClick={() => onSucursales(v)} aria-pressed={sucursales === v} className={`ct-fila ct-sucursal ${sucursales === v ? "ct-activa" : ""}`}>
              <Casilla activa={sucursales === v} />
              <span className="ct-fila-titulo">{t}</span>
            </button>
          ))}
        </div>

        {preguntas.length > 0 && (
          <>
            <div className="ct-rotulo">¿Qué otras cosas hacés?</div>
            <div className="ct-dos">
              {preguntas.map((q) => {
                const I = ICONO_PREGUNTA[q.k] || ICONO_MODULO[(q.modulos || [])[0]] || Check;
                const activa = !!respuestas[q.k];
                const detalle = (q.modulos || []).map(nombreDe).join(" · ");
                return (
                  <button key={q.k} type="button" onClick={() => onTildar(q.k)} aria-pressed={activa} className={`ct-fila ct-pregunta ${activa ? "ct-activa" : ""}`}>
                    <Casilla activa={activa} />
                    <I className="ct-fila-icono" strokeWidth={1.5} />
                    <span className="ct-fila-textos">
                      <span className="ct-fila-titulo ct-pregunta-titulo">{q.n}</span>
                      {detalle && <span className="ct-fila-detalle">{detalle}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="pn-botones ct-botones">
          <button type="button" onClick={onVolver} className="pn-volver-boton ct-volver-boton"><ArrowLeft strokeWidth={2} /> Volver</button>
          <button type="button" onClick={onSeguir} className="an-continuar pn-continuar ct-continuar">Continuar <ArrowRight strokeWidth={2.25} /></button>
        </div>
      </div>
    </section>
  );
}

function ComoTrabajasClaro({ preguntas, respuestas, onTildar, escala, onEscala, canal, onCanal, sucursales, onSucursales, onVolver, onSeguir }) {
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
function Modulos(props) {
  return <ModulosNoche {...props} claro={!estaOscuro()} />;
}

/* En oscuro es la maqueta del 01/10 copiada tal cual. Las fotos de la
   derecha de cada tarjeta son recortes de la maqueta, con el sello y el
   texto que tenían encima pintados; los módulos que la maqueta no
   muestra (los de gastronomía y servicios) van sin foto. */
const FOTOS_MODULO = new Set(["cobro", "caja", "ajustes", "productos", "reportes", "permisos", "stock", "compras", "pedidos", "clientes", "cuentas", "asistente"]);

/* Los dos íconos que la maqueta dibuja distinto. */
const ICONO_MODULO_NOCHE = { cobro: Coins, permisos: FileText };

/* "Porque marcaste" en un renglón y lo que marcó, entre comillas, en el
   otro: así lo corta la maqueta. */
function cortarMotivo(t) {
  const m = /^(.*?)\s(".*")$/.exec(t);
  return m ? <>{m[1]}<br />{m[2]}</> : t;
}

function ModulosNoche({ armado, recomendada, sumados, onSacar, onSumar, onVolver, onSeguir, claro = false }) {
  const { elegidos, motivos, propuestos, sumables } = armado;
  const principales = [...propuestos, ...sumados.filter((k) => elegidos.includes(k) && !propuestos.includes(k)), ...sumables];
  /* El claro (01/10) es el mismo paso con sus recortes en alta-claro. */
  const dir = claro ? "/landing/alta-claro" : "/landing/alta";
  return (
    <section className={`an-seccion mo-seccion ${claro ? "an-dia" : ""} relative overflow-hidden`}>
      <img src={`${dir}/modulos-izquierdo.jpg`} alt="" aria-hidden="true" className="an-costado mo-costado-izq" />
      <img src={`${dir}/modulos-derecho.jpg`} alt="" aria-hidden="true" className="an-costado mo-costado-der" />
      <div className="an-contenido mo-contenido relative">
        <div className="an-arriba mo-arriba">
          <button type="button" onClick={onVolver} className="an-volver"><ArrowLeft strokeWidth={1.75} /> Volver</button>
          <PasosNoche actual={3} className="mo-pasos" />
        </div>
        <div className="manuscrita mo-nota" aria-hidden="true">
          Sumá solo lo que necesitás.<br />Sacá o agregá.
          <svg viewBox="0 0 50 44" className="mo-nota-flecha" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M44 4 C 42 22, 28 34, 6 38" /><path d="M14 30 L 5 38 L 15 43" />
          </svg>
        </div>

        <div className="an-etiqueta pn-etiqueta mo-etiqueta">Paso 3 de 3</div>
        <h1 className="an-titulo mo-titulo">Tus <span className="an-naranja">módulos</span></h1>
        <div className="mo-fila-bajada">
          <p className="an-bajada mo-bajada">Estos son los módulos recomendados para tu negocio. Podés sumar o quitar los que necesites.</p>
          <span className="mo-pildora"><Sparkles strokeWidth={1.75} /> Según tus respuestas</span>
        </div>

        <div className="mo-rotulo">Módulos principales · {elegidos.length} elegidos</div>
        {/* Cada módulo dice en qué plan entra: así nadie se lleva una
            sorpresa al elegir el plan, ni puede armarse Empresa pagando Pro. */}
        {recomendada && (
          <p className="mo-plan">Cada módulo dice en qué plan entra. Con lo que elegiste te corresponde el plan <strong className="an-naranja">{recomendada.n}.</strong></p>
        )}

        <div className="mo-grilla">
          {principales.map((k) => {
            const m = moduloPorClave(k) || { n: k, d: "" };
            const base = MODULOS_BASE.includes(k);
            const activa = elegidos.includes(k);
            const I = ICONO_MODULO_NOCHE[k] || ICONO_MODULO[k] || LayoutGrid;
            const nivel = nivelDe(k);
            const motivo = activa ? (motivos[k] || (base ? "Siempre incluido" : "")) : null;
            return (
              <button key={k} type="button" disabled={base} aria-pressed={activa}
                onClick={() => { if (base) return; if (propuestos.includes(k)) onSacar(k); else onSumar(k); }}
                className={`mo-tarjeta ${activa ? "mo-activa" : ""} ${base ? "mo-fija" : ""}`}>
                {FOTOS_MODULO.has(k) && <img src={`${dir}/modulos/${k}.jpg`} alt="" aria-hidden="true" className="mo-foto" loading="lazy" />}
                <span className="mo-casilla">{activa && <Check strokeWidth={3} />}</span>
                <span className="mo-icono"><I strokeWidth={1.5} /></span>
                <span className="mo-textos">
                  <span className="mo-nombre">{m.n}</span>
                  <span className="mo-detalle">{m.d}{m.d && !/[.!?]$/.test(m.d) ? "." : ""}</span>
                  {motivo && <span className="mo-motivo">{cortarMotivo(motivo)}</span>}
                </span>
                <span className={`mo-sello mo-sello-${nivel.k}`}>{nivel.n}</span>
              </button>
            );
          })}
        </div>

        <div className="pn-botones mo-botones">
          <button type="button" onClick={onVolver} className="pn-volver-boton mo-volver-boton"><ArrowLeft strokeWidth={2} /> Volver</button>
          <button type="button" onClick={onSeguir} className="an-continuar mo-ver">Ver mi presupuesto <ArrowRight strokeWidth={2.25} /></button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   Tu presupuesto · Start, Pro y Empresa
   ------------------------------------------------------------ */
function Plan(props) {
  return <PlanNoche {...props} claro={!estaOscuro()} />;
}

/* En oscuro es la maqueta del 01/10 copiada tal cual: cada plan con su
   color (Start verde, Pro naranja, Empresa azul) y su dibujo recortado de
   la maqueta. "Recomendado" y el botón lleno no son de Empresa sino del
   plan que `planes()` recomienda; el precio sale de las tarifas como
   siempre, y sin tarifas dice "Consultar". "Ver mi presupuesto" sigue con
   el recomendado. El claro (01/10) es el mismo, con sus recortes en
   alta-claro y an-dia: tarjetas claras teñidas del color de cada plan. */
function PlanNoche({ opciones, tarifas, todos, onElegir, onVolver, claro = false }) {
  const recomendado = opciones.find((o) => o.recomendado) || opciones[opciones.length - 1];
  const dir = claro ? "/landing/alta-claro" : "/landing/alta";
  return (
    <section className={`an-seccion pl-seccion ${claro ? "an-dia" : ""} relative overflow-hidden`}>
      <img src={`${dir}/plan-izquierdo.jpg`} alt="" aria-hidden="true" className="an-costado pl-costado-izq" />
      <img src={`${dir}/plan-derecho.jpg`} alt="" aria-hidden="true" className="an-costado pl-costado-der" />
      <div className="an-contenido pl-contenido relative">
        <div className="an-arriba pl-arriba">
          <button type="button" onClick={onVolver} className="an-volver"><ArrowLeft strokeWidth={1.75} /> Volver</button>
          <PasosNoche actual={3} className="pl-pasos" />
        </div>
        <div className="manuscrita pl-nota" aria-hidden="true">
          Mismo sistema.<br />Más posibilidades.
          <svg viewBox="0 0 60 40" className="pl-nota-flecha" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M54 4 C 52 22, 34 32, 8 34" /><path d="M16 26 L 7 34 L 17 39" />
          </svg>
        </div>

        <div className="pl-etiqueta">Tu presupuesto</div>
        <h1 className="an-titulo pl-titulo">Elegí el plan que <span className="an-naranja">mejor se adapta</span></h1>
        <p className="an-bajada pl-bajada">Con los módulos que seleccionaste, te recomendamos estos planes.<br className="qr-br" /> Si en el futuro necesitás más, podés cambiar de plan o sumar módulos.</p>

        <div className="pl-grilla">
          {opciones.map((o) => <TarjetaPlanNoche key={o.k} opcion={o} tarifas={tarifas} todos={todos} dir={dir} onElegir={() => onElegir(o.k)} />)}
        </div>

        <ul className="pl-confianza">
          {CONFIANZA.slice(0, 3).map(([I, t, d]) => (
            <li key={t}>
              <span className="pl-confianza-icono"><I strokeWidth={1.75} /></span>
              <span><span className="pl-confianza-titulo">{t}</span><span className="pl-confianza-detalle">{d}</span></span>
            </li>
          ))}
        </ul>

        <div className="pn-botones pl-botones">
          <button type="button" onClick={onVolver} className="pn-volver-boton pl-volver-boton"><ArrowLeft strokeWidth={2} /> Volver</button>
          <button type="button" onClick={() => onElegir(recomendado.k)} className="an-continuar pl-ver">Ver mi presupuesto <ArrowRight strokeWidth={2.25} /></button>
        </div>
      </div>
    </section>
  );
}

/* Los cortes de renglón de la maqueta; si el texto cambia, corta solo. */
const CORTE_LEMA = {
  "Lo esencial para empezar.": ["Lo esencial", "para empezar."],
  "Más control, más posibilidades.": ["Más control,", "más posibilidades."],
  "Todo lo que tu negocio necesita.": ["Todo lo que tu", "negocio necesita."],
};

function TarjetaPlanNoche({ opcion, tarifas, todos, dir, onElegir }) {
  const pre = presupuestar(tarifas || TARIFAS_VACIAS, opcion.armado.elegidos);
  const calculando = tarifas === null;
  const incluye = (k) => opcion.armado.elegidos.includes(k);
  return (
    <div className={`pl-tarjeta pl-${opcion.k} ${opcion.recomendado ? "pl-recomendado" : ""}`}>
      {opcion.recomendado && <span className="pl-sello">Recomendado</span>}
      <div className="pl-cabeza">
        <img src={`${dir}/plan-${opcion.k}.jpg`} alt="" aria-hidden="true" className="pl-dibujo" />
        <div>
          <div className="pl-nombre">{opcion.n}</div>
          <div className="pl-lema-corto">{CORTE_LEMA[opcion.d] ? <>{CORTE_LEMA[opcion.d][0]}<br />{CORTE_LEMA[opcion.d][1]}</> : opcion.d}</div>
        </div>
      </div>
      <div className="pl-precio">
        {calculando && <div className="pl-monto">Calculando…</div>}
        {!calculando && pre.mensual != null && <div className="pl-monto f-m">{pesos(pre.mensual)} <span className="pl-mes">/mes</span></div>}
        {!calculando && pre.mensual == null && <div className="pl-monto">Consultar</div>}
        <div className="pl-cuantos">{pre.cantidad} módulos: cobro, caja y ajustes incluidos</div>
      </div>
      <button type="button" onClick={onElegir} className="pl-boton">{opcion.recomendado ? "Plan recomendado" : "Seleccionar plan"}</button>
      <ul className="pl-lista">
        {todos.map((k) => {
          const si = incluye(k);
          return (
            <li key={k} className={si ? "pl-si" : ""}>
              <span className="pl-tilde">{si && <Check strokeWidth={3} />}</span>
              {nombreDe(k)}
            </li>
          );
        })}
      </ul>
      {opcion.faltan && opcion.faltan.length > 0 && (
        <p className="pl-faltan">No incluye lo que marcaste: {opcion.faltan.map(nombreDe).join(", ")}.</p>
      )}
      <p className="pl-pie">{opcion.lema}</p>
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

/* ------------------------------------------------------------
   ¡Listo! · el pedido, y el detalle plegado debajo
   ------------------------------------------------------------ */
function Listo({ rubro, negocio, escala, canal, sucursales, respuestas, mensaje, elegida, presupuesto, tarifas,
  onVolver, onCambiarNegocio, onEditarProblemas, onEditarTrabajo, onAjustar, onCambiarPlan }) {
  const p = rubro.presentacion;
  const armado = elegida.armado;
  const { lineas, base, mensual, puestaEnMarcha, faltan, cantidad } = presupuesto;
  const calculando = tarifas === null;
  /* HASTA QUE HAYA PRECIOS, CADA RENGLON DICE "CONSULTAR"

     Antes, sin precios cargados, la columna desaparecia entera y el unico
     aviso era un parrafo al pie. Un renglon en blanco al lado de un modulo
     se lee como "no cuesta nada" o como que la pagina esta rota, y quien
     mira no sabe si tiene que preguntar.

     La palabra va en cada uno porque cada modulo se cotiza aparte: cuando
     haya precios, algunos van a tener numero y otros no, y ahi el renglon
     que dice "Consultar" es exactamente el que hay que preguntar.

     La bandera sigue viva para lo que si desaparece sin precios: el total
     y la puesta en marcha, que no son un renglon a cotizar sino una suma
     que no existe. */
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
    <ListoNoche {...{ elegida, armado, titulo, cantidad, calculando, sinPrecios, mensual, puestaEnMarcha, faltan, base, opcionales, nombresBase,
      dolores, tildes, puestos, canalNombre, sucursales, texto, whatsapp, pedido, mensaje,
      onVolver, onCambiarNegocio, onEditarProblemas, onEditarTrabajo, onAjustar, onCambiarPlan }} claro={!estaOscuro()} />
  );
}

/* En oscuro es la maqueta del 01/10 copiada tal cual. La maqueta
   muestra la pantalla dos veces: arriba con el detalle cerrado y abajo
   abierto. Las filas de "Lo que elegiste" son las de siempre (qué te
   complica, cómo trabajás), no las de la maqueta, que pone un problema
   bajo el rótulo "Sucursales". El detalle se abre con estado y no con
   <details>, para que al imprimir salga entero aunque esté cerrado. */
const PASOS_DESPUES = [
  ["Nos ponemos en contacto por WhatsApp", "Te escribimos con el presupuesto confirmado y contestamos tus dudas."],
  ["Puesta en marcha", "Cargamos tu catálogo y dejamos los módulos configurados para tu negocio."],
  ["Una capacitación corta y arrancás", "La primera venta la hacés con nosotros al lado."],
];

function ListoNoche({ elegida, armado, titulo, cantidad, calculando, sinPrecios, mensual, puestaEnMarcha, faltan, base, opcionales, nombresBase,
  dolores, tildes, puestos, canalNombre, sucursales, texto, whatsapp, pedido, mensaje,
  onVolver, onCambiarNegocio, onEditarProblemas, onEditarTrabajo, onAjustar, onCambiarPlan, claro = false }) {
  const [abierto, setAbierto] = useState(false);
  const dir = claro ? "/landing/alta-claro" : "/landing/alta";
  const precio = (monto) => (calculando ? "…" : monto == null ? "Consultar" : pesos(monto));
  const IconoModulo = (k) => ICONO_MODULO_NOCHE[k] || ICONO_MODULO[k] || LayoutGrid;
  return (
    <section className={`an-seccion li-seccion ${claro ? "an-dia" : ""} relative overflow-hidden`}>
      <img src={`${dir}/listo-izquierdo.jpg`} alt="" aria-hidden="true" className="an-costado li-costado-izq no-imprimir" />
      <img src={`${dir}/listo-derecho.jpg`} alt="" aria-hidden="true" className="an-costado li-costado-der no-imprimir" />
      <div className="an-contenido li-contenido relative">
        <div className="an-arriba li-arriba no-imprimir">
          <button type="button" onClick={onVolver} className="an-volver"><ArrowLeft strokeWidth={1.75} /> Volver</button>
          <PasosNoche actual={4} className="li-pasos" />
        </div>
        <div className="manuscrita li-nota no-imprimir" aria-hidden="true">
          Mismo sistema.<br />Más posibilidades.
          <svg viewBox="0 0 50 34" className="li-nota-flecha" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M44 4 C 44 20, 30 28, 6 26" /><path d="M14 19 L 5 26 L 14 32" />
          </svg>
        </div>

        <div className="li-cabeza">
          <span className="li-tilde"><Check strokeWidth={3} /></span>
          <div className="li-etiqueta">¡Listo!</div>
          <h1 className="li-titulo">Tu Genez está <span className="an-naranja">casi listo.</span></h1>
          <p className="li-bajada">
            Plan <strong>{elegida.n}</strong> para <strong>{titulo}</strong> · {cantidad} módulos
            {!calculando && mensual != null ? <> · <strong>{pesos(mensual)} por mes</strong></> : null}.
            {" "}<br />Dejanos tu WhatsApp y nos ponemos en contacto para dejarlo andando.
          </p>
        </div>

        <div className="li-grilla">
          <div className="li-izquierda">
            <ul className="li-confianza no-imprimir">
              {CONFIANZA.map(([I, t, d]) => (
                <li key={t}>
                  <span className="li-confianza-icono"><I strokeWidth={1.75} /></span>
                  <span><span className="li-confianza-titulo">{t}</span><span className="li-confianza-detalle">{d}</span></span>
                </li>
              ))}
            </ul>

            <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="li-abrir no-imprimir">
              Ver el detalle de tu presupuesto {abierto ? <Minus strokeWidth={2} /> : <Plus strokeWidth={2} />}
            </button>

            <div className={`li-detalle ${abierto ? "" : "li-detalle-cerrado"}`}>
              <div className="li-tarjeta">
                <div className="li-rotulo">Lo que elegiste</div>
                <ul className="li-filas">
                  <EleccionNoche icono={Store} rotulo="Negocio" valor={titulo} accion="Cambiar" onClick={onCambiarNegocio} />
                  <EleccionNoche icono={Crown} rotulo="Plan" valor={`${elegida.n} · ${elegida.d}`} accion="Cambiar" onClick={onCambiarPlan} />
                  <EleccionNoche icono={MapPin} rotulo="Te complica" valor={dolores.length ? dolores.map((q) => q.n).join(" · ") : "No marcaste nada"} accion="Editar" onClick={onEditarProblemas} />
                  <EleccionNoche icono={Users} rotulo="Cómo trabajás" valor={`${puestos.n} · ${canalNombre} · ${sucursales ? "varias sucursales" : "un solo local"}${tildes.length ? " · " + tildes.map((q) => q.n).join(" · ") : ""}`} accion="Editar" onClick={onEditarTrabajo} />
                </ul>
              </div>

              <div className="li-tarjeta">
                <div className="li-rotulo li-rotulo-con-accion">
                  Tus {cantidad} módulos
                  <button type="button" onClick={onAjustar} className="li-accion no-imprimir"><Pencil strokeWidth={2} /> Ajustar</button>
                </div>
                <ul className="li-filas">
                  <LineaNoche icono={IconoModulo("caja")} nombre="Base" detalle={nombresBase} motivo="Siempre incluida" precio={precio(base)} />
                  {opcionales.map((l) => (
                    <LineaNoche key={l.k} icono={IconoModulo(l.k)} nombre={l.n} detalle={l.d} motivo={armado.motivos[l.k]} precio={precio(l.monto)} />
                  ))}
                  {!sinPrecios && !calculando && puestaEnMarcha > 0 && (
                    <LineaNoche icono={Rocket} nombre="Puesta en marcha" detalle="Una sola vez, al arrancar: cargamos tu catálogo y dejamos todo configurado" precio={pesos(puestaEnMarcha)} />
                  )}
                  {!sinPrecios && !calculando && mensual != null && (
                    <li className="li-total"><span>Total por mes</span><span className="f-m">{pesos(mensual)}</span></li>
                  )}
                </ul>
                {sinPrecios && (
                  <p className="li-nota-precios">Todavía no publicamos precios. Dejanos tu WhatsApp y nos ponemos en contacto con el precio de estos {cantidad} módulos, sin sorpresas.</p>
                )}
              </div>

              {!claro && <TarjetaNecesitas necesita={armado.necesita} />}
            </div>

            <div className="manuscrita li-gracias no-imprimir" aria-hidden="true">Gracias por confiar en Genez.</div>
          </div>

          <div className="li-derecha no-imprimir">
            <Resumen noche key={elegida.k} calculando={calculando} sinPrecios={sinPrecios} mensual={mensual} puestaEnMarcha={puestaEnMarcha}
              faltan={faltan} cantidad={cantidad} texto={texto} whatsapp={whatsapp} pedido={pedido} mensajeInicial={mensaje} plan={elegida.n} />
          </div>

          {claro && <TarjetaNecesitas necesita={armado.necesita} className={`li-ancho ${abierto ? "" : "li-detalle-cerrado"}`} />}

          <div className={`li-tarjeta li-despues ${abierto ? "" : "li-detalle-cerrado"}`}>
            <div className="li-rotulo">Qué pasa después</div>
            <div className="li-despues-cuerpo">
              <span className="li-icono li-icono-suelto"><Rocket strokeWidth={1.75} /></span>
              <ol>
                {PASOS_DESPUES.map(([t, d], i) => (
                  <li key={t}>
                    <span className="li-numero">{i + 1}</span>
                    <span><span className="li-despues-titulo">{t}</span><span className="li-despues-detalle">{d}</span></span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* En la maqueta oscura va en la columna del detalle; en la clara, a todo
   el ancho y con los requisitos en dos columnas. */
function TarjetaNecesitas({ necesita, className = "" }) {
  return (
    <div className={`li-tarjeta ${className}`}>
      <div className="li-rotulo">Qué necesitás de tu lado</div>
      <div className="li-necesitas">
        <span className="li-icono"><ClipboardList strokeWidth={1.75} /></span>
        {necesita.length ? (
          <ul>{necesita.map((n) => <li key={n}>{n}</li>)}</ul>
        ) : (
          <p>Nada más que un celular o una computadora con internet.</p>
        )}
      </div>
    </div>
  );
}

function EleccionNoche({ icono: I, rotulo, valor, accion, onClick }) {
  return (
    <li className="li-fila">
      <span className="li-icono"><I strokeWidth={1.75} /></span>
      <span className="li-fila-textos"><span className="li-fila-rotulo">{rotulo}</span><span className="li-fila-valor">{valor}</span></span>
      <button type="button" onClick={onClick} className="li-accion no-imprimir"><Pencil strokeWidth={2} /> {accion}</button>
    </li>
  );
}

function LineaNoche({ icono: I, nombre, detalle, motivo, precio }) {
  const sinNumero = precio === "Consultar" || precio === "…";
  return (
    <li className="li-fila li-linea">
      <span className="li-icono"><I strokeWidth={1.75} /></span>
      <span className="li-fila-textos">
        <span className="li-linea-nombre">{nombre}</span>
        {detalle && <span className="li-linea-detalle">{detalle}{/[.!?]$/.test(detalle) ? "" : "."}</span>}
        {motivo && <span className="li-linea-motivo">{motivo}</span>}
      </span>
      <span className={`li-precio ${sinNumero ? "li-precio-consultar" : "f-m"}`}>{precio}</span>
    </li>
  );
}

const ACCION = "inline-flex items-center justify-center gap-1.5 rounded-md border border-borde-fuerte hover:border-texto-tenue text-sm font-semibold px-2 py-2 transition-colors";

/* El resumen con la acción. Tres estados: ver, pedir (el formulario en
   el mismo lugar, sin ventana encima) y listo. */
function Resumen({ noche = false, calculando, sinPrecios, mensual, puestaEnMarcha, faltan, cantidad, texto, whatsapp, pedido, mensajeInicial, plan }) {
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

  if (noche) {
    return (
      <div className="li-resumen">
        <div className="li-rotulo li-resumen-rotulo">Plan {plan} · por mes</div>
        {calculando && <p className="li-resumen-texto">Calculando…</p>}
        {!calculando && mensual != null && <div className="li-resumen-monto f-m">{pesos(mensual)} <span>por mes</span></div>}
        {!calculando && mensual == null && (
          <>
            <div className="li-resumen-monto">Consultar</div>
            <p className="li-resumen-texto">
              {sinPrecios
                ? `Nos ponemos en contacto con vos por WhatsApp y te pasamos el precio de estos ${cantidad} módulos. Sin compromiso.`
                : `Falta el precio de ${faltan.map(nombreDe).join(", ")}: nos ponemos en contacto y te lo confirmamos.`}
            </p>
          </>
        )}
        <ul className="li-resumen-cuentas">
          <li><span>Módulos</span><span>{cantidad}</span></li>
          {!calculando && puestaEnMarcha > 0 && <li><span>Puesta en marcha, una sola vez</span><span className="f-m">{pesos(puestaEnMarcha)}</span></li>}
        </ul>
        <button type="button" onClick={() => setModo("pedir")} className="an-continuar li-resumen-pedir">
          {mensual == null ? "Quiero que me contacten" : "Quiero empezar"} <ArrowRight strokeWidth={2.25} />
        </button>
        {enlaceWa && (
          <a href={enlaceWa} target="_blank" rel="noopener noreferrer" className="li-resumen-boton li-resumen-wa"><MessageCircle strokeWidth={1.75} /> Escribinos por WhatsApp ahora</a>
        )}
        <div className="li-resumen-dos">
          <button type="button" onClick={copiar} className="li-resumen-boton"><Copy strokeWidth={1.75} /> {copiado ? "Copiado" : "Copiar"}</button>
          <button type="button" onClick={() => window.print()} className="li-resumen-boton"><Printer strokeWidth={1.75} /> Imprimir</button>
        </div>
        <p className="li-resumen-pie">Sin tarjeta, sin compromiso. {mensual == null ? "Te contactamos nosotros." : "El número que te confirmemos es el que pagás."}</p>
      </div>
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
          <div className="f-d text-2xl mt-1">Consultar</div>
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
