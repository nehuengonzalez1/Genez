/* ============================================================
   LA LANDING NUEVA · una sola pantalla (octubre 2026)
   ============================================================

   Reemplaza a la landing con alta en pasos. La especificación está en
   docs/landing-nueva.md: qué cuenta cada sección, qué no se promete y
   por qué. Todo pasa en esta página: los botones bajan a la sección que
   corresponde, y el registro (al final) es donde el comercio crea su
   cuenta y entra a probar.

   LAS MAQUETAS
   ------------
   Once secciones, en claro y en oscuro (03/10). Como en la landing
   anterior, las imágenes son recortes de la maqueta y el texto va en
   HTML, para que se lea, se traduzca y se acomode al teléfono. En pantalla
   ancha cada sección es un lienzo a escala de su maqueta (`--u` es un
   píxel de la maqueta); en el teléfono los mismos elementos bajan en
   columna.

   Los recortes llevan repintado lo que la maqueta inventó y no conviene
   publicar: el nombre de una persona real y marcas de terceros en la
   pantalla de ejemplo.
   ============================================================ */

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ArrowRight, Sun, Moon, ShoppingCart, Box, BarChart3, FileText, AlertTriangle, TrendingDown, Truck, ChevronDown,
  Store, UtensilsCrossed, Shirt, Scissors, Laptop, Coffee, Beer, Croissant, Apple, Leaf, Wrench, ShowerHead, Candy,
  ChefHat, ShoppingBag, Sparkles, PersonStanding, Dumbbell, Stethoscope, Flower2,
  Coins, Percent, Tag, BellRing, PieChart, Search,
  Wallet, Smartphone, QrCode, WifiOff, MessageCircle, Printer,
  ScanBarcode, Boxes, BookOpen, Users, CalendarDays, Settings, ClipboardList, UserCog, Ticket, Landmark,
  LayoutGrid, HeartHandshake, ShieldCheck, ChevronUp, Check, Headphones, Zap, Globe,
  Network, Puzzle, UserRound, Plus, Minus,
} from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";
import { RUBROS_DE_FABRICA, cargarRubrosPublicos } from "../datos/landing.js";
import { cargarTarifasPublicas, TARIFAS_VACIAS, tarifasAMedida, hayAMedida } from "../datos/tarifas.js";
import { planes, presupuestar, textoDescuento } from "../datos/presupuesto.js";
import { MODULOS_BASE, moduloPorClave } from "../datos/modulos.js";
import { pedirPresupuesto, validarPedido } from "../datos/solicitudes.js";
import { estaOscuro, fijarTema } from "./tema.js";
import { FOTOS, Flecha, ICONO_MODULO } from "./comun.jsx";

const TemaCtx = createContext(true);
const useOscuro = () => useContext(TemaCtx);

/* Las anclas de la página. El menú y los botones bajan a estas. */
const ANCLAS = {
  negocio: "negocios",
  rentabilidad: "rentabilidad",
  ia: "ia",
  modulos: "modulos",
  precios: "precios",
  registro: "registro",
  queHace: "que-hace",
  como: "como-funciona",
};

const irA = (id) => (e) => {
  if (e) e.preventDefault();
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

/* `?rubro=` y `?negocio=` en la dirección: los links que ya circulan
   (por WhatsApp, del alta anterior) llegan al registro con eso elegido. */
function deLaDireccion(clave) {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(clave);
}
function escribirEnLaDireccion(rubro, negocio) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (rubro) url.searchParams.set("rubro", rubro); else url.searchParams.delete("rubro");
  if (negocio) url.searchParams.set("negocio", negocio); else url.searchParams.delete("negocio");
  window.history.replaceState(null, "", url);
}

export default function LandingNueva() {
  const [oscuro, setOscuro] = useState(estaOscuro());
  const alternarTema = () => { fijarTema(oscuro ? "claro" : "oscuro"); setOscuro(!oscuro); };

  const [rubros, setRubros] = useState(RUBROS_DE_FABRICA);
  useEffect(() => {
    let vigente = true;
    cargarRubrosPublicos()
      .then((rs) => { if (vigente && rs.length) setRubros(rs); })
      .catch(() => { /* quedan los de fábrica, que son los mismos */ });
    return () => { vigente = false; };
  }, []);

  /* Los precios: los mismos que usaba el alta, desde la base. null mientras
     no llegan, para no mostrar un precio que después cambia. */
  const [tarifas, setTarifas] = useState(null);
  useEffect(() => {
    let vigente = true;
    cargarTarifasPublicas()
      .then((t) => { if (vigente) setTarifas(t); })
      .catch(() => { if (vigente) setTarifas(TARIFAS_VACIAS); });
    return () => { vigente = false; };
  }, []);

  /* Lo que el visitante eligió en la página (negocio y plan), para que el
     registro lo traiga cargado. */
  const [eleccion, setEleccion] = useState({ rubro: deLaDireccion("rubro"), negocio: deLaDireccion("negocio"), plan: null });
  const elegirPlan = (rubro, plan, modulos = null) => {
    setEleccion((e) => ({ ...e, rubro: rubro || e.rubro, plan, modulos }));
    irA(ANCLAS.registro)();
  };
  const elegirNegocio = (rubro, negocio) => {
    setEleccion((e) => ({ ...e, rubro, negocio }));
    escribirEnLaDireccion(rubro, negocio);
    irA(ANCLAS.registro)();
  };

  return (
    <TemaCtx.Provider value={oscuro}>
      <div className={`ln ${oscuro ? "" : "ln-claro"}`}>
        <Cabecera onAlternarTema={alternarTema} />
        <main>
          <Inicio />
          <QueHace />
          <Negocios rubros={rubros} onElegir={elegirNegocio} />
          <Rentabilidad />
          <GenezIA />
          <Ecosistema />
          <Modulos />
          <ComoFunciona />
          <Precios rubros={rubros} tarifas={tarifas} rubroElegido={eleccion.rubro} onElegir={elegirPlan} />
          <HacemosMas tarifas={tarifas} />
          <Preguntas tarifas={tarifas} />
          <Registro rubros={rubros} tarifas={tarifas} eleccion={eleccion} />
        </main>
        <Pie />
      </div>
    </TemaCtx.Provider>
  );
}

/* ------------------------------------------------------------
   Cabecera · el menú de la maqueta, con anclas
   ------------------------------------------------------------ */
function Cabecera({ onAlternarTema }) {
  const oscuro = useOscuro();
  return (
    <header className="ln-cabecera">
      <div className="ln-cabecera-marco">
        <a href="/landing" aria-label="Genez, inicio" className="ln-logo">
          <LogoGenez size={42} conNombre claro={oscuro} />
        </a>
        <nav className="ln-menu" aria-label="Secciones">
          <a href={`#${ANCLAS.negocio}`} onClick={irA(ANCLAS.negocio)}>Tu negocio</a>
          <a href={`#${ANCLAS.rentabilidad}`} onClick={irA(ANCLAS.rentabilidad)}>Rentabilidad</a>
          <a href={`#${ANCLAS.ia}`} onClick={irA(ANCLAS.ia)}>Genez IA</a>
          <a href={`#${ANCLAS.modulos}`} onClick={irA(ANCLAS.modulos)}>Módulos</a>
          <a href={`#${ANCLAS.precios}`} onClick={irA(ANCLAS.precios)}>Precios</a>
        </nav>
        <div className="ln-acciones">
          <a href="/login" className="ln-boton ln-boton-linea ln-entrar">Entrar</a>
          <a href={`#${ANCLAS.registro}`} onClick={irA(ANCLAS.registro)} className="ln-boton ln-boton-lleno ln-armar">
            Armar mi sistema <ArrowRight className="ln-flecha" strokeWidth={2.25} />
          </a>
          <button type="button" onClick={onAlternarTema} className="ln-tema"
            aria-label={oscuro ? "Ver en claro" : "Ver en oscuro"} title={oscuro ? "Ver en claro" : "Ver en oscuro"}>
            {oscuro ? <Sun strokeWidth={1.75} /> : <Moon strokeWidth={1.75} />}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------
   1 · Inicio
   ------------------------------------------------------------
   La pantalla de ejemplo es la de la maqueta con "Nora" en lugar de una
   persona real y sin marcas: "Gaseosa 1,5 L", "Cerveza lata",
   "Proveedor: Norte", y "Caja 2 sin cerrar" en lugar de una alerta de
   sucursal que el sistema todavía no da. */
function Inicio() {
  const oscuro = useOscuro();
  return (
    <section className="ln-inicio">
      <div className="ln-inicio-lienzo">
        <div className="ln-inicio-texto">
          <div className="ln-rotulo">Tu negocio, en orden.</div>
          <h1 className="ln-inicio-titulo">Un sistema<br />que se adapta<br /><span className="ln-naranja">a vos.</span></h1>
          <p className="ln-inicio-parrafo">
            Ventas, stock, caja, costos, clientes, equipo y decisiones.<br className="ln-solo-ancho" /> Todo conectado en un solo sistema.
          </p>
          <div className="ln-inicio-botones">
            <a href={`#${ANCLAS.registro}`} onClick={irA(ANCLAS.registro)} className="ln-boton ln-boton-lleno ln-boton-grande">
              Armar mi sistema <ArrowRight className="ln-flecha" strokeWidth={2.25} />
            </a>
            <a href={`#${ANCLAS.queHace}`} onClick={irA(ANCLAS.queHace)} className="ln-boton ln-boton-linea ln-boton-grande">
              Conocer Genez
            </a>
          </div>
          <p className="ln-inicio-datos">✓ Hecho en Argentina · ✓ Sin tarjeta · ✓ Cancelás cuando quieras</p>
        </div>
        {/* Después del texto: en el teléfono va abajo; en pantalla ancha
            se ubica sola a la derecha. */}
        <img src={oscuro ? "/landing/nueva/inicio-oscuro.jpg" : "/landing/nueva/inicio-claro.jpg"} width="1099" height="759"
          className="ln-inicio-arte" alt="Genez en una computadora y en un teléfono: ventas del día, margen, stock y alertas" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   2 · Vender es una parte
   ------------------------------------------------------------
   El resumen de todo lo que sigue, en cuatro verbos. La tablet y las
   cajas son recortes de la maqueta; el gráfico y las alertas se dibujan
   acá: en la maqueta el título "Conocé tu margen." quedaba encima del
   gráfico, y dibujados se acomodan solos a cada tema. */
const PASOS = [
  { k: "operar", n: "01", verbo: "Operar", icono: ShoppingCart, titulo: "Vendé y cobrá.", texto: "POS, facturación, caja, pedidos y operación diaria." },
  { k: "controlar", n: "02", verbo: "Controlar", icono: Box, titulo: "Sabé qué pasa.", texto: "Stock, compras, proveedores, clientes y equipo." },
  { k: "ganar", n: "03", verbo: "Ganar", icono: BarChart3, titulo: "Conocé tu margen.", texto: "Costos, recetas, precios, markup y rentabilidad." },
  { k: "decidir", n: "04", verbo: "Decidir", icono: FileText, titulo: "Miralo claro.", texto: "Informes, alertas e inteligencia." },
];

function QueHace() {
  const oscuro = useOscuro();
  const tema = oscuro ? "oscuro" : "claro";
  return (
    <section id={ANCLAS.queHace} className="ln-hace">
      <div className="ln-hace-lienzo">
        <div className="ln-rotulo ln-hace-rotulo">No es solo una caja</div>
        <h2 className="ln-hace-titulo">Vender es una parte.{" "}<br /><span className="ln-naranja">Entender tu negocio</span>{" "}<br />es otra.</h2>
        <p className="ln-hace-parrafo">Genez conecta la operación con la rentabilidad y la información que necesitás para decidir.</p>

        <ol className="ln-hace-pasos">
          {PASOS.map((p, i) => {
            const I = p.icono;
            return (
              <li key={p.k} className={`ln-paso ln-paso-${p.k}`}>
                <span className="ln-paso-icono"><I strokeWidth={1.75} /></span>
                <div className="ln-paso-numero">{p.n} · {p.verbo}</div>
                <div className="ln-paso-titulo">{p.titulo}</div>
                <p className="ln-paso-texto">{p.texto}</p>
                {p.k === "operar" && <img src={`/landing/nueva/vender-pos-${tema}.jpg`} width="270" height="186" alt="" aria-hidden="true" className="ln-paso-foto" />}
                {p.k === "controlar" && <img src={`/landing/nueva/vender-cajas-${tema}.jpg`} width="190" height="165" alt="" aria-hidden="true" className="ln-paso-foto" />}
                {p.k === "ganar" && <GraficoRentabilidad />}
                {p.k === "decidir" && <Alertas />}
                {i < PASOS.length - 1 && <span className="ln-paso-flecha" aria-hidden="true"><ArrowRight strokeWidth={2.25} /></span>}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* Un gráfico de ejemplo: barras del mes con su línea y el +12% del mejor
   tramo. Los valores son de muestra. */
function GraficoRentabilidad() {
  const barras = [26, 38, 34, 48, 44, 66, 72];
  return (
    <div className="ln-widget ln-grafico" aria-hidden="true">
      <div className="ln-widget-cabeza">
        <span className="ln-widget-titulo">Rentabilidad</span>
        <span className="ln-grafico-filtro">Este mes <ChevronDown /></span>
      </div>
      <svg viewBox="0 0 210 74" className="ln-grafico-dibujo" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ln-barra" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgb(253 82 4)" stopOpacity="0.85" />
            <stop offset="1" stopColor="rgb(253 82 4)" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {barras.map((h, i) => <rect key={i} x={6 + i * 29} y={74 - h} width="22" height={h} rx="2" fill="url(#ln-barra)" />)}
        <polyline points={barras.map((h, i) => `${17 + i * 29},${70 - h}`).join(" ")} fill="none" stroke="rgb(253 82 4)" strokeWidth="1.4" />
        {barras.map((h, i) => <circle key={i} cx={17 + i * 29} cy={70 - h} r="2" fill="rgb(253 82 4)" />)}
      </svg>
      <span className="ln-grafico-globo">+12%</span>
    </div>
  );
}

function Alertas() {
  return (
    <div className="ln-widget ln-alertas" aria-hidden="true">
      <div className="ln-widget-cabeza">
        <span className="ln-widget-titulo">Alertas</span>
        <span className="ln-alertas-todas">Ver todas <ArrowRight /></span>
      </div>
      <ul>
        <li><span className="ln-alerta-icono"><AlertTriangle /></span>7 productos en stock crítico</li>
        <li><span className="ln-alerta-icono"><TrendingDown /></span>Ventas 12% abajo del promedio</li>
        <li><span className="ln-alerta-icono ln-alerta-azul"><Truck /></span>3 pagos de proveedores pendientes</li>
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------
   3 · Tu forma de trabajar (los negocios)
   ------------------------------------------------------------
   "Todos" muestra las seis tarjetas de la maqueta y, debajo, el resto de
   los negocios en una línea: un filtro que muestra más que "Todos" no
   tendría sentido. Cada rubro muestra todos sus negocios con lo que les
   resolvemos (docs/landing-nueva.md). Indumentaria y Ecommerce van como
   "Próximamente": el sistema todavía no tiene variantes ni tienda online.

   Los negocios salen de la base (`presentacion.negocios`); lo que les
   resolvemos es una decisión de la página y vive acá. Un negocio nuevo sin
   texto muestra lo destacado de su rubro. */
const SOLUCIONES = {
  "Kiosco": "Venta rápida · caja y cierres · stock · fiado",
  "Almacén": "Ventas · stock · compras · fiado",
  "Minimercado": "Cobro con lector · stock y vencimientos · remitos",
  "Dietética": "Vencimientos · lista del proveedor · margen",
  "Verdulería": "Precios del día · caja · compras",
  "Panadería": "Recetas · costo por receta · pedidos",
  "Ferretería": "Catálogo grande · precio sugerido · presupuestos",
  "Casa de sanitarios": "Presupuestos · cuenta corriente · factura A y B",
  "Bar": "Mesas · comandas · promociones · cierre de caja",
  "Café": "Mostrador rápido · carta QR · comandas",
  "Restaurante": "Salón · comandas · cocina · delivery",
  "Cervecería": "Mesas · comandas a la barra · promociones",
  "Rotisería": "Pedidos y delivery · recetas · cobro rápido",
  "Take away": "Centro de pedidos · canales · cobro rápido",
  "Estética": "Turnos · recordatorios · comisiones",
  "Peluquería": "Turnos · recordatorios · comisiones · app del cliente",
  "Barbería": "Turnos · recordatorios · comisiones",
  "Pilates": "Clases con cupo · abonos · asistencia",
  "Gimnasio": "Abonos · asistencia · reservas desde el celular",
  "Consultorio": "Turnos por profesional · recordatorios · factura",
  "Spa": "Turnos por sala · packs · recordatorios",
};
const ICONO_NEGOCIO = {
  "Kiosco": Candy, "Almacén": ShoppingCart, "Minimercado": Store, "Dietética": Leaf, "Verdulería": Apple,
  "Panadería": Croissant, "Ferretería": Wrench, "Casa de sanitarios": ShowerHead,
  "Bar": Beer, "Café": Coffee, "Restaurante": UtensilsCrossed, "Cervecería": Beer, "Rotisería": ChefHat, "Take away": ShoppingBag,
  "Estética": Sparkles, "Peluquería": Scissors, "Barbería": Scissors, "Pilates": PersonStanding, "Gimnasio": Dumbbell,
  "Consultorio": Stethoscope, "Spa": Flower2,
};
/* Las seis fotos de la maqueta. Los demás negocios usan la foto que ya
   tenían en la landing anterior (Unsplash). */
const FOTO_MAQUETA = { "Almacén": "almacen", "Minimercado": "minimercado", "Restaurante": "restaurante", "Indumentaria": "indumentaria", "Servicios": "servicios", "Ecommerce": "ecommerce" };
function fotoNegocio(nombre, tema) {
  if (FOTO_MAQUETA[nombre]) return `/landing/nueva/negocio-${FOTO_MAQUETA[nombre]}-${tema}.jpg`;
  if (FOTOS[nombre]) return `https://images.unsplash.com/${FOTOS[nombre]}?auto=format&fit=crop&w=560&h=420&q=70`;
  return null;
}
const PROXIMAMENTE = [
  { nombre: "Indumentaria", texto: "Variantes · talles · stock · ventas", icono: Shirt, proximamente: true },
  { nombre: "Ecommerce", texto: "Tienda online · stock · envíos", icono: Laptop, proximamente: true },
];
const NOMBRE_FILTRO = { minimercado: "Comercio", gastronomia: "Gastronomía", servicios: "Servicios" };

function Negocios({ rubros, onElegir }) {
  const oscuro = useOscuro();
  const tema = oscuro ? "oscuro" : "claro";
  const [filtro, setFiltro] = useState("todos");

  const negociosDe = (r) => ((r.presentacion && r.presentacion.negocios) || []).map((n) => ({
    nombre: n,
    rubro: r.clave,
    texto: SOLUCIONES[n] || ((r.presentacion && r.presentacion.destacados) || []).slice(0, 3).join(" · "),
    icono: ICONO_NEGOCIO[n] || Store,
  }));
  const todos = rubros.flatMap(negociosDe);
  const busca = (n) => todos.find((x) => x.nombre === n);
  const servicios = rubros.find((r) => r.clave === "servicios");

  const destacados = [
    busca("Almacén"), busca("Minimercado"), busca("Restaurante"), PROXIMAMENTE[0],
    servicios && { nombre: "Servicios", rubro: "servicios", negocioElegido: null, texto: "Turnos · clientes · historial · pagos", icono: Scissors },
    PROXIMAMENTE[1],
  ].filter(Boolean);
  const nombresDestacados = new Set(destacados.map((d) => d.nombre));
  const resto = todos.filter((n) => !nombresDestacados.has(n.nombre));

  const rubroFiltrado = rubros.find((r) => r.clave === filtro);
  const tarjetas = filtro === "todos" ? destacados
    : [...negociosDe(rubroFiltrado), ...(filtro === "minimercado" ? PROXIMAMENTE : [])];

  const elegir = (n) => { if (!n.proximamente) onElegir(n.rubro, n.negocioElegido === null ? null : n.nombre); };

  return (
    <section id={ANCLAS.negocio} className="ln-negocios">
      <div className="ln-negocios-lienzo">
        <div className="ln-rotulo ln-negocios-rotulo">Se adapta a tu negocio</div>
        <h2 className="ln-negocios-titulo">Tu forma de trabajar.{" "}<br /><span className="ln-naranja">Tu Genez.</span></h2>
        <p className="ln-negocios-parrafo">Un mismo motor, configurado para cada realidad.<br className="ln-solo-ancho" /> Elegí tu rubro y descubrí cómo Genez se adapta<br className="ln-solo-ancho" /> a tu negocio.</p>
        <div className="ln-negocios-nota manuscrita" aria-hidden="true">
          Mismo sistema,<br />distintas realidades.
          <Flecha className="ln-negocios-flecha" />
        </div>

        <div className="ln-filtros" role="tablist" aria-label="Rubros">
          {[["todos", "Todos"], ...rubros.filter((r) => NOMBRE_FILTRO[r.clave]).map((r) => [r.clave, NOMBRE_FILTRO[r.clave]])].map(([k, n]) => (
            <button key={k} type="button" role="tab" aria-selected={filtro === k} onClick={() => setFiltro(k)}
              className={`ln-filtro ${filtro === k ? "ln-filtro-activo" : ""}`}>{n}</button>
          ))}
        </div>

        <ul className="ln-negocios-grilla">
          {tarjetas.map((n) => {
            const I = n.icono;
            const foto = fotoNegocio(n.nombre, tema);
            return (
              <li key={n.nombre}>
                <button type="button" onClick={() => elegir(n)} disabled={n.proximamente}
                  className={`ln-negocio ${n.proximamente ? "ln-negocio-pronto" : ""}`}
                  aria-label={n.proximamente ? `${n.nombre}, próximamente` : `${n.nombre}: armar mi sistema`}>
                  {foto && <img src={foto} alt="" aria-hidden="true" loading="lazy" className="ln-negocio-foto" />}
                  <span className="ln-negocio-icono"><I strokeWidth={1.75} /></span>
                  <span className="ln-negocio-nombre">{n.nombre}</span>
                  <span className="ln-negocio-texto">{n.texto}</span>
                  {n.proximamente
                    ? <span className="ln-negocio-pronto-sello">Próximamente</span>
                    : <span className="ln-negocio-ir"><ArrowRight strokeWidth={2} /></span>}
                </button>
              </li>
            );
          })}
        </ul>

        {filtro === "todos" && resto.length > 0 && (
          <div className="ln-negocios-resto">
            <span>También para</span>
            {resto.map((n) => (
              <button key={n.nombre} type="button" onClick={() => elegir(n)} className="ln-negocios-chip">{n.nombre}</button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   4 · Costos + rentabilidad
   ------------------------------------------------------------
   La hamburguesa, la bolsa y las tres tarjetas son el recorte de la
   maqueta. La tarjeta "Costos" decía "ingredientes, mano de obra, gastos
   fijos y variables", y el costo de una receta suma solo sus insumos (al
   costo promedio de las compras, 0076): se repintó. Por lo mismo cambian
   dos de los cuatro puntos de abajo: "Impuestos y gastos" no existe por
   producto, y lo que sí existe es el aviso cuando sube un costo; los
   "precios inteligentes" son el precio sugerido de la lista del
   proveedor. */
const PUNTOS_RENTABILIDAD = [
  { icono: Coins, titulo: "Costos reales", texto: "Desde cada insumo de la receta." },
  { icono: Percent, titulo: "Margen por producto", texto: "Sabé qué te deja ganancia." },
  { icono: Tag, titulo: "Precio sugerido", texto: "Según el margen que querés." },
  { icono: BellRing, titulo: "Alertas de margen", texto: "Te avisa si un costo sube." },
];

function Rentabilidad() {
  const oscuro = useOscuro();
  return (
    <section id={ANCLAS.rentabilidad} className="ln-renta">
      <div className="ln-renta-lienzo">
        <div className="ln-renta-texto">
          <div className="ln-rotulo ln-renta-rotulo">Costos + rentabilidad</div>
          <h2 className="ln-renta-titulo">No alcanza{" "}<br />con saber{" "}<br />cuánto vendés.{" "}<br /><span className="ln-naranja">Tenés que saber{" "}<br />cuánto ganás.</span></h2>
          <p className="ln-renta-parrafo">Armá el costo desde la receta, seguí cada suba del proveedor<br className="ln-solo-ancho" /> y conocé tu margen real en cada producto.</p>
        </div>
        <img src={oscuro ? "/landing/nueva/costos-oscuro.jpg" : "/landing/nueva/costos-claro.jpg"} width="1030" height="455" className="ln-renta-arte"
          alt="Una hamburguesa con su costo total, su precio de venta y su margen, 65,8%" />
        <ul className="ln-renta-puntos">
          {PUNTOS_RENTABILIDAD.map((p) => {
            const I = p.icono;
            return (
              <li key={p.titulo}>
                <span className="ln-renta-icono"><I strokeWidth={1.9} /></span>
                <span className="ln-renta-punto-titulo">{p.titulo}</span>
                <span className="ln-renta-punto-texto">{p.texto}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   5 · Genez IA
   ------------------------------------------------------------
   En la maqueta, "Genez Intelligence": todo el sistema está en
   castellano. El gráfico con sus tarjetas es el recorte de la maqueta
   (datos de ejemplo, sin nombres de nadie). "Filtros flexibles" decía
   "por fecha, sucursal, producto, canal": por sucursal todavía no se
   puede filtrar, así que no se promete. */
const PUNTOS_IA = [
  { icono: BarChart3, titulo: "Filtros flexibles", texto: "Por fecha, producto, canal y más." },
  { icono: PieChart, titulo: "Comparativas claras", texto: "Hacé crecer tu negocio con información real." },
  { icono: Search, titulo: "Detalle del origen", texto: "Llegá al ticket, la venta o el movimiento." },
];

function GenezIA() {
  const oscuro = useOscuro();
  return (
    <section id={ANCLAS.ia} className="ln-ia">
      <div className="ln-ia-lienzo">
        <div className="ln-ia-texto">
          <div className="ln-rotulo">Genez IA</div>
          <h2 className="ln-ia-titulo">Tu sistema{" "}<br />también <span className="ln-naranja">piensa</span>{" "}<br /><span className="ln-naranja">con vos.</span></h2>
          <p className="ln-ia-parrafo">No necesitás mirar todo. Genez detecta qué cambió{" "}<br className="ln-solo-ancho" />y qué conviene abrir.</p>
          <ul className="ln-ia-puntos">
            {PUNTOS_IA.map((p) => {
              const I = p.icono;
              return (
                <li key={p.titulo}>
                  <span className="ln-ia-icono"><I strokeWidth={2} /></span>
                  <span>
                    <span className="ln-ia-punto-titulo">{p.titulo}</span>
                    <span className="ln-ia-punto-texto">{p.texto}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <a href={`#${ANCLAS.registro}`} onClick={irA(ANCLAS.registro)} className="ln-boton ln-boton-linea ln-ia-boton">
            Preguntarle a Genez <ArrowRight className="ln-flecha" strokeWidth={2} />
          </a>
        </div>
        <img src={oscuro ? "/landing/nueva/ia-oscuro.jpg" : "/landing/nueva/ia-claro.jpg"} width="1124" height="846" className="ln-ia-arte"
          alt="Alertas y números de ejemplo: ventas en baja, productos por agotarse, ventas por canal y los más vendidos" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   6 · No termina en el mostrador
   ------------------------------------------------------------
   El diagrama de la maqueta, con otro contenido: sus siete nodos
   repetían los módulos (que tienen su propia sección), y acá van las
   cosas con las que Genez se conecta hacia afuera. Por eso los nodos van
   en HTML y las líneas y el cuadro del centro se dibujan: no hay recorte
   que sirva. Las coordenadas son las de la maqueta (1859 × 846). */
const NODOS = [
  { k: "arriba", icono: FileText, titulo: "Factura electrónica", texto: "A, B y C, directo con ARCA." },
  { k: "izq1", icono: Wallet, titulo: "Mercado Pago", texto: "Te avisa cada cobro, en voz alta." },
  { k: "der1", icono: Smartphone, titulo: "App para tus clientes", texto: "Reservan y ven su plan desde el celular." },
  { k: "izq2", icono: QrCode, titulo: "Carta QR", texto: "En cada mesa, desde el celular." },
  { k: "der2", icono: WifiOff, titulo: "Sin internet", texto: "Seguís cobrando y se manda cuando vuelve." },
  { k: "abajo1", icono: MessageCircle, titulo: "WhatsApp", texto: "Recordatorios y avisos a tus clientes." },
  { k: "abajo2", icono: Printer, titulo: "Lector e impresora", texto: "Código de barras, ticket y comanda." },
];
/* Las líneas: de cada nodo al cuadro del centro, con las esquinas
   redondeadas de la maqueta. Las de la derecha llevan flecha hacia el
   nodo, como en la maqueta. */
const LINEAS = [
  { d: "M1264 200 V323" },
  { d: "M1094 285 H1123 Q1137 285 1137 299 V355 Q1137 369 1151 369 H1169" },
  { d: "M1365 369 H1385 Q1399 369 1399 355 V299 Q1399 285 1413 285 H1468", flecha: true },
  { d: "M1072 472 H1098 Q1112 472 1112 458 V439 Q1112 425 1126 425 H1169" },
  { d: "M1365 425 H1411 Q1425 425 1425 439 V458 Q1425 472 1439 472 H1462", flecha: true },
  { d: "M1125 600 V589 Q1125 575 1139 575 H1230 Q1244 575 1244 561 V518" },
  { d: "M1431 600 V589 Q1431 575 1417 575 H1310 Q1296 575 1296 561 V518" },
];

function Ecosistema() {
  return (
    <section className="ln-eco">
      <div className="ln-eco-lienzo">
        <div className="ln-eco-texto">
          <div className="ln-rotulo">Un ecosistema</div>
          <h2 className="ln-eco-titulo">Genez no{" "}<br />termina en{" "}<br /><span className="ln-naranja">el mostrador.</span></h2>
          <p className="ln-eco-parrafo">Se conecta con lo que ya usás: ARCA, Mercado Pago,{" "}<br className="ln-solo-ancho" />WhatsApp y el celular de tus clientes.{" "}<br className="ln-solo-ancho" />Sin herramientas separadas.</p>
          <a href={`#${ANCLAS.modulos}`} onClick={irA(ANCLAS.modulos)} className="ln-boton ln-eco-boton">
            Ver los módulos <ArrowRight className="ln-flecha" strokeWidth={2} />
          </a>
        </div>

        <svg className="ln-eco-lineas" viewBox="0 0 1859 846" aria-hidden="true">
          <defs>
            <marker id="ln-eco-punta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M1 1 L8 5 L1 9" fill="none" stroke="rgb(253 82 4)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          {LINEAS.map((l, i) => <path key={i} d={l.d} markerEnd={l.flecha ? "url(#ln-eco-punta)" : undefined} />)}
        </svg>

        <div className="ln-eco-centro" aria-hidden="true">
          <LogoGenez size={84} claro />
          <span className="ln-eco-centro-nombre">GENEZ</span>
        </div>

        <ul className="ln-eco-nodos">
          {NODOS.map((n) => {
            const I = n.icono;
            return (
              <li key={n.k} className={`ln-eco-nodo ln-eco-${n.k}`}>
                <span className="ln-eco-icono"><I strokeWidth={1.9} /></span>
                <span>
                  <span className="ln-eco-nodo-titulo">{n.titulo}</span>
                  <span className="ln-eco-nodo-texto">{n.texto}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   7 · Solo los módulos que necesitás
   ------------------------------------------------------------
   Las doce tarjetas de la maqueta, con módulos que existen: "Costos" no
   es un módulo (el costo vive en Productos y en las recetas) y en su
   lugar va Cuenta corriente; "WhatsApp" es Avisos, que es lo que hay;
   "Configuración" se llama Ajustes en el sistema. "Conocé todos los
   módulos" despliega el resto acá mismo: no hay segunda pantalla. Los
   cubos de la derecha son el recorte de la maqueta. */
const MODULOS_LANDING = [
  { icono: ScanBarcode, n: "Cobro", d: "Punto de venta, tickets y vuelto." },
  { icono: Wallet, n: "Caja", d: "Arqueo, gastos y cierre." },
  { icono: Box, n: "Productos", d: "Catálogo, precios y listas." },
  { icono: Boxes, n: "Stock", d: "Inventario, alertas y vencimientos." },
  { icono: Truck, n: "Compras", d: "Remitos, costos y proveedores." },
  { icono: BookOpen, n: "Cuenta corriente", d: "Fiado: quién debe y cuánto." },
  { icono: Users, n: "Clientes", d: "Historial, factura y puntos." },
  { icono: CalendarDays, n: "Agenda", d: "Turnos, clases y disponibilidad." },
  { icono: BarChart3, n: "Informes", d: "Datos claros para decidir." },
  { icono: MessageCircle, n: "Avisos", d: "Recordatorios por WhatsApp." },
  { icono: Sparkles, n: "Asistente con IA", d: "Análisis y recomendaciones." },
  { icono: Settings, n: "Ajustes", d: "Tu negocio, a tu medida." },
];
const MODULOS_MAS = [
  { icono: UtensilsCrossed, n: "Salón", d: "Mesas, comandas y cocina." },
  { icono: ClipboardList, n: "Pedidos", d: "Preparación y delivery." },
  { icono: UserCog, n: "Equipo", d: "Horarios, comisiones y sueldos." },
  { icono: Ticket, n: "Abonos y packs", d: "Planes, clases y sesiones." },
  { icono: Landmark, n: "Finanzas", d: "Ingresos, egresos y sueldos." },
  { icono: LayoutGrid, n: "Servicios", d: "Qué se ofrece y dónde." },
  { icono: HeartHandshake, n: "Seguimiento", d: "A quién escribirle y por qué." },
  { icono: ShieldCheck, n: "Permisos", d: "Qué puede hacer cada uno." },
];

function Modulos() {
  const oscuro = useOscuro();
  const [todos, setTodos] = useState(false);
  const lista = todos ? [...MODULOS_LANDING, ...MODULOS_MAS] : MODULOS_LANDING;
  return (
    <section id={ANCLAS.modulos} className="ln-mod">
      <div className={`ln-mod-lienzo ${todos ? "ln-mod-abierto" : ""}`}>
        <div className="ln-rotulo ln-mod-rotulo">Todo lo que necesitás</div>
        <h2 className="ln-mod-titulo">Solo los módulos{" "}<br /><span className="ln-naranja">que necesitás.</span></h2>
        <p className="ln-mod-parrafo">Empezá simple. Sumá herramientas cuando tu negocio{" "}<br className="ln-solo-ancho" />las necesite.</p>
        <img src={oscuro ? "/landing/nueva/modulos-oscuro.jpg" : "/landing/nueva/modulos-claro.jpg"} width="709" height="816" className="ln-mod-arte"
          alt="" aria-hidden="true" />
        <ul className="ln-mod-grilla">
          {lista.map((m) => {
            const I = m.icono;
            return (
              <li key={m.n} className="ln-mod-tarjeta">
                <span className="ln-mod-icono"><I strokeWidth={2} /></span>
                <span>
                  <span className="ln-mod-nombre">{m.n}</span>
                  <span className="ln-mod-texto">{m.d}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => setTodos(!todos)} aria-expanded={todos} className="ln-boton ln-eco-boton ln-mod-boton">
          {todos ? "Ver menos" : "Conocé todos los módulos"} {todos ? <ChevronUp className="ln-flecha" strokeWidth={2} /> : <ArrowRight className="ln-flecha" strokeWidth={2} />}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   8 · Cómo funciona
   ------------------------------------------------------------
   Los tres pasos de la maqueta contaban el alta anterior (rubro, cómo
   trabajás, presupuesto). Con el registro solo, son otros: crear la
   cuenta, elegir rubro y plan, y empezar a vender con los 10 días
   gratis. Los íconos 3D son recortes de la maqueta y siguen sirviendo
   (el local, la lista, el gráfico que sube). La franja de abajo, "Después,
   te acompañamos", queda como en la maqueta. */
const PASOS_COMO = [
  { n: "01", foto: "paso1", ancho: 160, alto: 150, titulo: "Creá tu cuenta.", texto: "Tu comercio y tus datos, en dos pasos." },
  { n: "02", foto: "paso2", ancho: 180, alto: 150, titulo: "Elegí tu rubro y tu plan.", texto: "Los módulos vienen armados para tu negocio." },
  { n: "03", foto: "paso3", ancho: 210, alto: 172, titulo: "Empezá a vender.", texto: "10 días gratis, sin tarjeta." },
];
const ACOMPANAMOS = [
  "Configuramos el sistema",
  "Te capacitamos a vos y a tu equipo",
  "Revisamos y ajustamos",
  "Seguimos optimizando",
];

function ComoFunciona() {
  const oscuro = useOscuro();
  const tema = oscuro ? "oscuro" : "claro";
  return (
    <section id={ANCLAS.como} className="ln-como">
      <div className="ln-como-lienzo">
        <div className="ln-rotulo ln-como-rotulo">Cómo funciona</div>
        <h2 className="ln-como-titulo">Tres pasos.{" "}<br /><span className="ln-naranja">Y tu Genez está listo.</span></h2>
        <p className="ln-como-parrafo">Te armamos el sistema según tu rubro, en lugar de darte{" "}<br className="ln-solo-ancho" />una lista interminable. Probalo 10 días gratis.</p>

        <ol className="ln-como-pasos">
          {PASOS_COMO.map((p, i) => (
            <li key={p.n} className={`ln-como-paso ln-como-paso-${i + 1}`}>
              <span className="ln-como-numero">{p.n}</span>
              <img src={`/landing/nueva/como-${p.foto}-${tema}.jpg`} width={p.ancho} height={p.alto} alt="" aria-hidden="true" className="ln-como-foto" />
              <span className="ln-como-paso-titulo">{p.titulo}</span>
              <span className="ln-como-paso-texto">{p.texto}</span>
              {i < PASOS_COMO.length - 1 && <ArrowRight className="ln-como-flecha" strokeWidth={2} aria-hidden="true" />}
            </li>
          ))}
        </ol>

        <div className="ln-como-despues">
          <span className="ln-como-despues-icono"><Settings strokeWidth={2} /></span>
          <div className="ln-como-despues-texto">
            <span className="ln-como-despues-titulo">Después, te acompañamos.</span>
            <span className="ln-como-despues-sub">Configuración · capacitación · revisión · optimización</span>
          </div>
          <ol className="ln-como-linea">
            {ACOMPANAMOS.map((a) => <li key={a}><span className="ln-como-punto" aria-hidden="true" />{a}</li>)}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   9 · Precios
   ------------------------------------------------------------
   Los planes salen de `planes()` y los precios de `presupuestar()`, lo
   mismo que usaba el alta: cambiar un precio en el panel de Precios lo
   cambia acá. Por rubro, porque cada rubro arma sus planes con sus
   módulos. Start muestra lo que trae; Pro y Empresa, solo lo que suman
   (docs/landing-nueva.md).

   Diferencias con la maqueta: sin "+ IVA" (el titular no está inscripto)
   y sin el selector de períodos mientras dura el lanzamiento (solo
   mensual); el texto de la derecha, que era de prototipo, dice el
   descuento. La etiqueta de Empresa decía "Para varias sucursales", y
   la multisucursal todavía no está terminada. */
const pesos = (n) => "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n));
const NOMBRE_RUBRO_PRECIOS = { minimercado: "Comercio", gastronomia: "Gastronomía", servicios: "Servicios" };
const ESTILO_PLAN = {
  start: { tono: "verde", etiqueta: "Ideal para empezar", subtitulo: "Lo esencial para tener tu negocio en orden desde el primer día.", boton: "Empezar con Start" },
  pro: { tono: "naranja", etiqueta: "Más elegido", subtitulo: "Más herramientas para hacer crecer tu negocio.", boton: "Empezar con Pro" },
  empresa: { tono: "azul", etiqueta: "Para equipos", subtitulo: "Toda la potencia de Genez para operar en grande.", boton: "Empezar con Empresa" },
};

function Precio({ pre, calculando }) {
  if (calculando) return <div className="ln-plan-precio"><span className="ln-plan-monto ln-plan-calculando">…</span></div>;
  if (pre.mensual == null) return <div className="ln-plan-precio"><span className="ln-plan-monto">Consultar</span></div>;
  return (
    <div className="ln-plan-precio">
      {pre.conDescuento != null && <s className="ln-plan-tachado">{pesos(pre.mensual)}</s>}
      <span className="ln-plan-monto">{pesos(pre.conDescuento != null ? pre.conDescuento : pre.mensual)}</span>
      <span className="ln-plan-mes">/ mes</span>
      {pre.descuento && <span className="ln-plan-oferta">−{textoDescuento(pre.descuento)}</span>}
    </div>
  );
}

function ItemModulo({ k, tono }) {
  const m = moduloPorClave(k) || { n: k, d: "" };
  const I = ICONO_MODULO[k] || LayoutGrid;
  return (
    <li className="ln-plan-item">
      <span className={`ln-plan-item-icono ln-tono-${tono}`}><I strokeWidth={2} /></span>
      <span><span className="ln-plan-item-nombre">{m.n}</span><span className="ln-plan-item-texto">{m.d}</span></span>
    </li>
  );
}

function Precios({ rubros, tarifas, rubroElegido, onElegir }) {
  const oscuro = useOscuro();
  const tema = oscuro ? "oscuro" : "claro";
  const conPlanes = rubros.filter((r) => NOMBRE_RUBRO_PRECIOS[r.clave]);
  const [clave, setClave] = useState(null);
  const rubro = conPlanes.find((r) => r.clave === (clave || rubroElegido)) || conPlanes[0];
  const calculando = tarifas === null;
  const t = tarifas || TARIFAS_VACIAS;

  const lista = rubro ? planes({ rubro }) : [];
  const [medidaAbierta, setMedidaAbierta] = useState(false);
  const universo = lista.length ? lista[lista.length - 1].armado.elegidos : [];
  const [medida, setMedida] = useState(null);
  const elegidosMedida = medida && medida.rubro === (rubro && rubro.clave) ? medida.modulos : (lista[0] ? lista[0].armado.elegidos : []);
  const alternar = (k) => {
    if (MODULOS_BASE.includes(k)) return;
    const actual = new Set(elegidosMedida);
    if (actual.has(k)) actual.delete(k); else actual.add(k);
    setMedida({ rubro: rubro.clave, modulos: universo.filter((x) => actual.has(x)) });
  };
  const preMedida = presupuestar(tarifasAMedida(t), elegidosMedida);
  const descuento = presupuestar(t, []).descuento;

  return (
    <section id={ANCLAS.precios} className="ln-precios">
      <div className="ln-precios-lienzo">
        <div className="ln-filtros ln-precios-rubros" role="tablist" aria-label="Rubro">
          {conPlanes.map((r) => (
            <button key={r.clave} type="button" role="tab" aria-selected={rubro && rubro.clave === r.clave}
              onClick={() => setClave(r.clave)} className={`ln-filtro ${rubro && rubro.clave === r.clave ? "ln-filtro-activo" : ""}`}>
              {NOMBRE_RUBRO_PRECIOS[r.clave]}
            </button>
          ))}
        </div>
        <div className="ln-rotulo ln-precios-rotulo">Precio claro</div>
        <h2 className="ln-precios-titulo">Pagás por lo que{" "}<br /><span className="ln-naranja">necesitás.</span></h2>
        <p className="ln-precios-parrafo">
          {descuento ? <>Precio de lanzamiento: <strong>{textoDescuento(descuento)}</strong>.<br className="ln-solo-ancho" />{" "}</> : null}
          Precio final por mes, sin permanencia:{" "}<br className="ln-solo-ancho" />cancelás cuando quieras.
        </p>

        <ul className="ln-planes">
          {lista.map((p, i) => {
            const e = ESTILO_PLAN[p.k];
            const pre = presupuestar(t, p.armado.elegidos);
            const anterior = i > 0 ? lista[i - 1].armado.elegidos : [];
            const suma = p.armado.elegidos.filter((k) => !anterior.includes(k));
            return (
              <li key={p.k} className={`ln-plan ln-plan-${p.k}`}>
                <div className="ln-plan-cabeza">
                  <img src={`/landing/nueva/plan-${p.k}-${tema}.jpg`} alt="" aria-hidden="true" className="ln-plan-dibujo" />
                  <span className={`ln-plan-etiqueta ln-tono-${e.tono}`}>{e.etiqueta}</span>
                </div>
                <h3 className="ln-plan-nombre">{p.n}</h3>
                <p className="ln-plan-subtitulo">{e.subtitulo}</p>
                <Precio pre={pre} calculando={calculando} />
                {i > 0 && <div className="ln-plan-todo">Todo {lista[i - 1].n}, más:</div>}
                <ul className="ln-plan-items">
                  {suma.map((k) => <ItemModulo key={k} k={k} tono={e.tono} />)}
                  {p.k === "empresa" && (
                    <li className="ln-plan-item">
                      <span className={`ln-plan-item-icono ln-tono-${e.tono}`}><Headphones strokeWidth={2} /></span>
                      <span><span className="ln-plan-item-nombre">Soporte prioritario</span><span className="ln-plan-item-texto">Te atendemos primero.</span></span>
                    </li>
                  )}
                </ul>
                <button type="button" onClick={() => onElegir(rubro.clave, p.k)} className={`ln-boton ln-plan-boton ${p.k === "pro" ? "ln-boton-lleno" : "ln-plan-boton-gris"}`}>
                  {e.boton} <ArrowRight className="ln-flecha" strokeWidth={2} />
                </button>
              </li>
            );
          })}
        </ul>

        {hayAMedida(t) && universo.length > 0 && (
          <div className="ln-medida">
            <div className="ln-medida-cabeza">
              <div>
                <div className="ln-medida-titulo">¿Preferís elegir vos los módulos?</div>
                <div className="ln-medida-texto">Armalo a medida: tildás los que querés y ves el precio al momento.</div>
              </div>
              <button type="button" onClick={() => setMedidaAbierta(!medidaAbierta)} aria-expanded={medidaAbierta} className="ln-boton ln-boton-linea ln-medida-abrir">
                {medidaAbierta ? "Cerrar" : "Armar a medida"} {medidaAbierta ? <ChevronUp className="ln-flecha" /> : <ArrowRight className="ln-flecha" />}
              </button>
            </div>
            {medidaAbierta && (
              <div className="ln-medida-cuerpo">
                <ul className="ln-medida-modulos">
                  {universo.map((k) => {
                    const m = moduloPorClave(k) || { n: k };
                    const base = MODULOS_BASE.includes(k);
                    const activo = elegidosMedida.includes(k);
                    return (
                      <li key={k}>
                        <button type="button" onClick={() => alternar(k)} disabled={base} aria-pressed={activo}
                          className={`ln-medida-modulo ${activo ? "ln-medida-activo" : ""}`}>
                          <span className="ln-medida-casilla">{activo && <Check strokeWidth={3} />}</span>
                          {m.n}{base && <span className="ln-medida-base">incluido</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="ln-medida-pie">
                  <Precio pre={preMedida} calculando={calculando} />
                  <button type="button" onClick={() => onElegir(rubro.clave, "medida", elegidosMedida)} className="ln-boton ln-boton-lleno ln-medida-boton">
                    Empezar a medida <ArrowRight className="ln-flecha" strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   10 · Hacemos más
   ------------------------------------------------------------
   Sin maqueta: la pidió Nehuen el 03/10 para contar que, además del
   sistema, Genez automatiza y hace apps y webs. Se diseñó con el estilo
   de las demás. La consulta queda en `solicitudes` (la misma función que
   usaba el alta, con origen "hacemos-mas") y se ve en el panel de
   plataforma; después, un botón abre el WhatsApp de Genez con el pedido
   armado. El WhatsApp es el de Precios, en el panel. */
const SERVICIOS_EXTRA = [
  { k: "automatizar", icono: Zap, titulo: "Automatizaciones", texto: "Que el sistema haga solo lo que hoy hacés a mano: avisos, reportes, pedidos a proveedores." },
  { k: "app", icono: Smartphone, titulo: "App para tus clientes", texto: "Tu marca en el celular de tus clientes: reservas, su plan, sus puntos." },
  { k: "web", icono: Globe, titulo: "Página web", texto: "Tu negocio en internet, conectado con Genez." },
];

function HacemosMas({ tarifas }) {
  const [marcados, setMarcados] = useState([]);
  const [datos, setDatos] = useState({ nombre: "", telefono: "", mensaje: "" });
  const [estado, setEstado] = useState({ enviando: false, error: null, listo: false });
  const alternar = (k) => setMarcados((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));
  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  const elegidos = SERVICIOS_EXTRA.filter((s) => marcados.includes(s.k));
  const whatsapp = tarifas && tarifas.whatsapp;
  const textoWhatsapp = [
    `Hola, soy ${datos.nombre.trim() || "…"}. Me interesa: ${elegidos.map((s) => s.titulo).join(", ") || "algo a medida"}.`,
    datos.mensaje.trim(),
  ].filter(Boolean).join("\n");

  const enviar = async (e) => {
    e.preventDefault();
    if (!elegidos.length && !datos.mensaje.trim()) { setEstado({ enviando: false, error: "Tildá qué te interesa o contanos qué necesitás.", listo: false }); return; }
    const problema = validarPedido({ nombre: datos.nombre, telefono: datos.telefono });
    if (problema) { setEstado({ enviando: false, error: problema, listo: false }); return; }
    setEstado({ enviando: true, error: null, listo: false });
    try {
      await pedirPresupuesto({
        negocio: "Hacemos más",
        respuestas: elegidos.map((s) => ({ k: s.k, n: s.titulo })),
        nombre: datos.nombre, telefono: datos.telefono, mensaje: datos.mensaje,
        origen: "hacemos-mas",
      });
      setEstado({ enviando: false, error: null, listo: true });
    } catch (err) {
      setEstado({ enviando: false, error: (err && err.message) || "No se pudo enviar. Probá de nuevo.", listo: false });
    }
  };

  return (
    <section className="ln-mas">
      <div className="ln-mas-lienzo">
        <div className="ln-mas-texto">
          <div className="ln-rotulo">Hacemos más</div>
          <h2 className="ln-mas-titulo">Lo que tu negocio{" "}<br />necesite,{" "}<br /><span className="ln-naranja">lo armamos.</span></h2>
          <p className="ln-mas-parrafo">Además del sistema, automatizamos tareas y hacemos{" "}<br className="ln-solo-ancho" />apps y páginas web a medida para tu comercio.</p>
        </div>

        <form className="ln-mas-tarjeta" onSubmit={enviar} noValidate>
          {estado.listo ? (
            <div className="ln-mas-listo">
              <span className="ln-mas-listo-icono"><Check strokeWidth={3} /></span>
              <div className="ln-mas-listo-titulo">¡Recibimos tu consulta!</div>
              <p className="ln-mas-listo-texto">Te escribimos por WhatsApp para contarte cómo lo armamos.</p>
              {whatsapp && (
                <a className="ln-boton ln-boton-lleno ln-mas-enviar" target="_blank" rel="noreferrer"
                  href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(textoWhatsapp)}`}>
                  Escribirnos ahora por WhatsApp <ArrowRight className="ln-flecha" strokeWidth={2} />
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="ln-mas-pregunta">¿Qué te interesa?</div>
              <ul className="ln-mas-opciones">
                {SERVICIOS_EXTRA.map((s) => {
                  const I = s.icono;
                  const activo = marcados.includes(s.k);
                  return (
                    <li key={s.k}>
                      <button type="button" onClick={() => alternar(s.k)} aria-pressed={activo} className={`ln-mas-opcion ${activo ? "ln-mas-activa" : ""}`}>
                        <span className="ln-mas-icono"><I strokeWidth={1.9} /></span>
                        <span className="ln-mas-opcion-textos">
                          <span className="ln-mas-opcion-titulo">{s.titulo}</span>
                          <span className="ln-mas-opcion-texto">{s.texto}</span>
                        </span>
                        <span className="ln-medida-casilla">{activo && <Check strokeWidth={3} />}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="ln-mas-campos">
                <label className="ln-campo">
                  <span>Tu nombre</span>
                  <input value={datos.nombre} onChange={cambiar("nombre")} autoComplete="name" />
                </label>
                <label className="ln-campo">
                  <span>WhatsApp</span>
                  <input value={datos.telefono} onChange={cambiar("telefono")} inputMode="tel" autoComplete="tel" placeholder="Con código de área" />
                </label>
                <label className="ln-campo ln-campo-ancho">
                  <span>Contanos qué necesitás (opcional)</span>
                  <textarea value={datos.mensaje} onChange={cambiar("mensaje")} rows={3} maxLength={1000} />
                </label>
              </div>
              {estado.error && <p className="ln-mas-error" role="alert">{estado.error}</p>}
              <button type="submit" disabled={estado.enviando} className="ln-boton ln-boton-lleno ln-mas-enviar">
                {estado.enviando ? "Enviando…" : "Enviar consulta"} <ArrowRight className="ln-flecha" strokeWidth={2} />
              </button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   11 · Preguntas frecuentes
   ------------------------------------------------------------
   Las cinco de la maqueta, con respuestas que dicen lo que el sistema
   hace hoy, y dos más que el registro solo vuelve necesarias: cuánto
   cuesta (sale de las tarifas, como en la landing anterior: si cambia el
   descuento en Precios, cambia acá) y qué pasa al terminar la prueba.
   "Varias sucursales" no se promete entera: cada local tiene sus cajas y
   su stock, pero verlos juntos todavía está en camino. */
function respuestaDelPrecio(tarifas) {
  const { descuento, puestaEnMarcha } = presupuestar(tarifas || TARIFAS_VACIAS, []);
  const cuando = !descuento || !descuento.meses ? "" : descuento.meses === 1 ? "el primer mes " : `los primeros ${descuento.meses} meses `;
  return [
    "Una base por mes que incluye cobro, caja y ajustes, más los módulos de tu plan. Lo ves arriba, por rubro, antes de registrarte.",
    descuento ? `Por el lanzamiento, ${cuando}pagás un ${descuento.porcentaje}% menos.` : "",
    puestaEnMarcha > 0 ? "La puesta en marcha —cargar tu catálogo y capacitarte— se cobra una sola vez." : "",
    "No hay permanencia: cancelás cuando quieras.",
  ].filter(Boolean).join(" ");
}

const PREGUNTAS_FRECUENTES = [
  { icono: ShoppingCart, q: "¿Necesito comprar equipos?", a: "Con un celular, una tablet o una computadora ya funciona. Para cobrar en el mostrador conviene una impresora térmica y un lector de códigos (o la cámara del celular). Si tenés salón, una impresora en la cocina o la barra para las comandas." },
  { icono: Network, q: "¿Puedo manejar varias sucursales?", a: "Cada local puede tener sus propias cajas, y cada venta queda registrada en su sucursal. Ver y manejar todas desde un solo lugar está en camino: si lo necesitás, contanos y te avisamos cuando esté." },
  { icono: Puzzle, q: "¿Puedo sumar módulos después?", a: "Sí. Se suman o se sacan cuando quieras, y pagás solo por los que usás." },
  { icono: UserRound, q: "¿Me ayudan a configurarlo?", a: "Sí. Configuramos el sistema, cargamos tu catálogo y te capacitamos a vos y a tu equipo. Después seguimos revisando y ajustando con vos." },
  { icono: FileText, q: "¿Puedo facturar?", a: "Sí: factura A, B y C, directo con ARCA. Necesitás tu CUIT y un certificado, que te guiamos a sacar desde Ajustes, paso a paso." },
  { icono: Coins, q: "¿Cuánto cuesta?", a: null },
  { icono: CalendarDays, q: "¿Qué pasa cuando terminan los 10 días?", a: "Tres días antes te avisamos por mail. Si querés seguir, elegís tu plan y cómo pagar; si no, la cuenta se suspende y no se te cobra nada." },
];

function Preguntas({ tarifas }) {
  const [abierta, setAbierta] = useState(null);
  return (
    <section id="preguntas" className="ln-faq">
      <div className="ln-faq-fondo" aria-hidden="true" />
      <div className="ln-faq-lienzo">
        <div className="ln-faq-texto">
          <div className="ln-rotulo">Preguntas frecuentes</div>
          <h2 className="ln-faq-titulo">Lo que{" "}<br />preguntás{" "}<br />antes de{" "}<br /><span className="ln-naranja">empezar.</span></h2>
          <p className="ln-faq-parrafo">Resolvemos las dudas más comunes{" "}<br className="ln-solo-ancho" />para que tengas todo claro.</p>
        </div>
        <ul className="ln-faq-lista">
          {PREGUNTAS_FRECUENTES.map((p, i) => {
            const I = p.icono;
            const abiertaEsta = abierta === i;
            return (
              <li key={p.q} className={`ln-faq-item ${abiertaEsta ? "ln-faq-abierta" : ""}`}>
                <button type="button" className="ln-faq-pregunta" onClick={() => setAbierta(abiertaEsta ? null : i)} aria-expanded={abiertaEsta}>
                  <span className="ln-faq-icono"><I strokeWidth={2} /></span>
                  <span className="ln-faq-q">{p.q}</span>
                  {abiertaEsta ? <Minus className="ln-faq-mas" strokeWidth={1.75} /> : <Plus className="ln-faq-mas" strokeWidth={1.75} />}
                </button>
                {abiertaEsta && <p className="ln-faq-respuesta">{p.a || respuestaDelPrecio(tarifas)}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   12 · Registro
   ------------------------------------------------------------
   Dos pasos en la misma tarjeta (la maqueta tenía cuatro): tu comercio y
   tus datos, y una confirmación. Trae cargado lo que se eligió más arriba
   (negocio, rubro, plan o módulos a medida).

   CREA LA CUENTA, NO EL COMERCIO
   ------------------------------
   Al enviar se crea el usuario y Supabase manda el mail de confirmación;
   el comercio lo arma la base cuando la persona confirma y entra (ver
   src/datos/autoservicio.js). Antes deja una solicitud con origen
   "registro-prueba": quien no confirma el mail igual queda anotado y se
   le puede escribir. Si la solicitud falla, la cuenta se crea igual. */
const PROVINCIAS = [
  "Buenos Aires", "Ciudad de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos",
  "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];
const SUCURSALES = [["1", "Una"], ["2", "Dos o tres"], ["4", "Cuatro o más"]];
const NOMBRE_PLAN = { start: "Start", pro: "Pro", empresa: "Empresa", medida: "A medida" };
const VENTAJAS_REGISTRO = [
  { icono: BarChart3, texto: "Una configuración a tu medida." },
  { icono: Puzzle, texto: "Soluciones para tus problemas reales." },
  { icono: Zap, texto: "Todo en un solo lugar para hacer crecer tu negocio." },
];

function Registro({ rubros, tarifas, eleccion }) {
  const [paso, setPaso] = useState(1);
  const [d, setD] = useState({
    comercio: "", negocio: "", sucursales: "1", provincia: "", problema: "",
    nombre: "", email: "", telefono: "", plan: "pro", clave: "", acepta: false,
  });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  /* Lo que se eligió más arriba en la página entra al formulario, sin
     pisar lo que la persona ya escribió a mano. */
  useEffect(() => {
    setD((x) => ({
      ...x,
      negocio: eleccion.rubro ? `${eleccion.rubro}|${eleccion.negocio || ""}` : x.negocio,
      plan: eleccion.plan || x.plan,
    }));
  }, [eleccion.rubro, eleccion.negocio, eleccion.plan]);

  const cambiar = (campo) => (e) => setD((x) => ({ ...x, [campo]: e.target.value }));
  const [rubroClave, negocioNombre] = (d.negocio || "|").split("|");
  const rubro = rubros.find((r) => r.clave === rubroClave) || null;

  /* Los módulos y el precio del plan elegido, con las mismas funciones que
     la sección de precios. */
  const t = tarifas || TARIFAS_VACIAS;
  const lista = rubro ? planes({ rubro }) : [];
  const modulos = d.plan === "medida"
    ? (eleccion.plan === "medida" && eleccion.modulos ? eleccion.modulos : (lista[0] ? lista[0].armado.elegidos : []))
    : ((lista.find((p) => p.k === d.plan) || {}).armado || {}).elegidos || [];
  const pre = presupuestar(d.plan === "medida" ? tarifasAMedida(t) : t, modulos);

  const seguir = (e) => {
    e.preventDefault();
    if (d.comercio.trim().length < 2) return setError("Escribí el nombre de tu comercio.");
    if (!rubro) return setError("Elegí qué tipo de negocio es.");
    if (d.problema.trim().length < 5) return setError("Contanos en una frase qué te complica hoy.");
    setError(null); setPaso(2);
  };

  const enviar = async (e) => {
    e.preventDefault();
    const problema = validarPedido({ nombre: d.nombre, telefono: d.telefono, email: d.email });
    if (problema) return setError(problema);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return setError("Escribí tu email: ahí te llega el acceso.");
    if (d.clave.length < 8) return setError("La contraseña tiene que tener al menos 8 caracteres.");
    if (!d.acepta) return setError("Para crear la cuenta tenés que aceptar la política de privacidad.");
    setError(null); setEnviando(true);
    try {
      await pedirPresupuesto({
        negocio: negocioNombre || (rubro && rubro.nombre),
        rubro: rubroClave,
        escala: d.sucursales,
        respuestas: [
          { k: "comercio", n: d.comercio.trim() },
          { k: "plan", n: `Plan ${NOMBRE_PLAN[d.plan] || d.plan}` },
          ...(d.provincia ? [{ k: "provincia", n: d.provincia }] : []),
          ...(pre.conDescuento != null ? [{ k: "descuento", n: `${pesos(pre.conDescuento)} por mes, ${textoDescuento(pre.descuento)}` }] : []),
        ],
        modulos,
        mensual: pre.mensual,
        nombre: d.nombre, telefono: d.telefono, email: d.email,
        mensaje: d.problema,
        origen: "registro-prueba",
      }).catch(() => {});
      /* Se carga recién acá: supabase.js lanza si faltan las variables de
         entorno, y la landing no puede morirse por eso al abrir. */
      const { registrarse } = await import("../datos/autoservicio.js");
      await registrarse({
        email: d.email,
        clave: d.clave,
        registro: {
          comercio: d.comercio.trim(), rubro: rubroClave, negocio: negocioNombre || null,
          sucursales: d.sucursales, provincia: d.provincia || null, problema: d.problema.trim(),
          nombre: d.nombre.trim(), telefono: d.telefono, plan: d.plan, modulos,
        },
      });
      setPaso(3);
    } catch (err) {
      setError((err && err.message) || "No se pudo enviar. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const PASOS_REGISTRO = ["Tu comercio", "Tus datos", "Listo"];

  return (
    <section id={ANCLAS.registro} className="ln-reg">
      <div className="ln-faq-fondo ln-reg-fondo" aria-hidden="true" />
      <div className="ln-reg-lienzo">
        <div className="ln-reg-texto">
          <span className="ln-reg-raya" aria-hidden="true" />
          <h2 className="ln-reg-titulo">Contanos{" "}<br />sobre tu{" "}<br /><span className="ln-naranja">comercio.</span></h2>
          <p className="ln-reg-parrafo">Queremos conocer tu negocio{" "}<br className="ln-solo-ancho" />para ofrecerte la mejor solución.</p>
          <ul className="ln-reg-ventajas">
            {VENTAJAS_REGISTRO.map((v) => {
              const I = v.icono;
              return <li key={v.texto}><span className="ln-reg-ventaja-icono"><I strokeWidth={2} /></span><span>{v.texto}</span></li>;
            })}
          </ul>
        </div>

        <div className="ln-reg-tarjeta">
          <ol className="ln-reg-pasos" aria-label="Pasos">
            {PASOS_REGISTRO.map((n, i) => (
              <li key={n} className={`${paso === i + 1 ? "ln-reg-paso-actual" : ""} ${paso > i + 1 ? "ln-reg-paso-hecho" : ""}`}>
                <span className="ln-reg-paso-numero">{paso > i + 1 ? <Check strokeWidth={3} /> : i + 1}</span>
                <span className="ln-reg-paso-nombre">{n}</span>
              </li>
            ))}
          </ol>

          {paso === 1 && (
            <form onSubmit={seguir} noValidate>
              <h3 className="ln-reg-encabezado">Datos del comercio</h3>
              <p className="ln-reg-sub">Contanos un poco sobre tu negocio.</p>
              <div className="ln-reg-campos">
                <label className="ln-campo"><span>Nombre del comercio <b>*</b></span>
                  <input value={d.comercio} onChange={cambiar("comercio")} placeholder="Ej: Almacén Don José" maxLength={80} />
                </label>
                <label className="ln-campo"><span>Rubro <b>*</b></span>
                  <select value={d.negocio} onChange={cambiar("negocio")}>
                    <option value="">Seleccioná un rubro</option>
                    {rubros.map((r) => (
                      <optgroup key={r.clave} label={NOMBRE_RUBRO_PRECIOS[r.clave] || r.nombre}>
                        {((r.presentacion && r.presentacion.negocios) || []).map((n) => <option key={n} value={`${r.clave}|${n}`}>{n}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="ln-campo"><span>Cantidad de sucursales</span>
                  <select value={d.sucursales} onChange={cambiar("sucursales")}>
                    {SUCURSALES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                  </select>
                </label>
                <label className="ln-campo"><span>Provincia</span>
                  <select value={d.provincia} onChange={cambiar("provincia")}>
                    <option value="">Seleccioná</option>
                    {PROVINCIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <label className="ln-campo ln-campo-ancho"><span>¿Cuál es la principal problemática de tu comercio? <b>*</b></span>
                  <textarea value={d.problema} onChange={cambiar("problema")} rows={4} maxLength={500}
                    placeholder="Ej: control de stock, problemas con la caja, falta de reportes claros, manejo de varias sucursales, etc." />
                  <span className="ln-reg-contador">{d.problema.length}/500</span>
                </label>
              </div>
              {error && <p className="ln-mas-error" role="alert">{error}</p>}
              <button type="submit" className="ln-boton ln-boton-lleno ln-reg-boton">Continuar <ArrowRight className="ln-flecha" strokeWidth={2} /></button>
            </form>
          )}

          {paso === 2 && (
            <form onSubmit={enviar} noValidate>
              <h3 className="ln-reg-encabezado">Tus datos</h3>
              <p className="ln-reg-sub">Para activarte la prueba de 10 días, sin tarjeta.</p>
              <div className="ln-reg-campos">
                <label className="ln-campo"><span>Tu nombre <b>*</b></span>
                  <input value={d.nombre} onChange={cambiar("nombre")} autoComplete="name" />
                </label>
                <label className="ln-campo"><span>WhatsApp <b>*</b></span>
                  <input value={d.telefono} onChange={cambiar("telefono")} inputMode="tel" autoComplete="tel" placeholder="Con código de área" />
                </label>
                <label className="ln-campo"><span>Email <b>*</b></span>
                  <input value={d.email} onChange={cambiar("email")} type="email" autoComplete="email" />
                </label>
                <label className="ln-campo"><span>Contraseña <b>*</b></span>
                  <input value={d.clave} onChange={cambiar("clave")} type="password" autoComplete="new-password" placeholder="Al menos 8 caracteres" />
                </label>
                <label className="ln-campo"><span>Plan</span>
                  <select value={d.plan} onChange={cambiar("plan")}>
                    {["start", "pro", "empresa"].map((k) => <option key={k} value={k}>{NOMBRE_PLAN[k]}</option>)}
                    {hayAMedida(t) && <option value="medida">A medida</option>}
                  </select>
                </label>
              </div>
              <div className="ln-reg-resumen">
                <span>{negocioNombre || (rubro && rubro.nombre)} · Plan {NOMBRE_PLAN[d.plan]} · {modulos.length} módulos</span>
                {pre.mensual != null && (
                  <span className="ln-reg-resumen-precio">
                    {pre.conDescuento != null && <s>{pesos(pre.mensual)}</s>} <b>{pesos(pre.conDescuento != null ? pre.conDescuento : pre.mensual)}</b> / mes
                  </span>
                )}
              </div>
              {error && <p className="ln-mas-error" role="alert">{error}</p>}
              <div className="ln-reg-botones">
                <button type="button" onClick={() => { setError(null); setPaso(1); }} className="ln-boton ln-boton-linea ln-reg-volver">Volver</button>
                <button type="submit" disabled={enviando} className="ln-boton ln-boton-lleno ln-reg-boton">
                  {enviando ? "Creando tu cuenta…" : "Empezar mi prueba gratis"} <ArrowRight className="ln-flecha" strokeWidth={2} />
                </button>
              </div>
              <label className="ln-reg-legal ln-reg-acepta">
                <input type="checkbox" checked={d.acepta} onChange={(e) => setD((x) => ({ ...x, acepta: e.target.checked }))} />
                <span>Leí y acepto la <a href="/privacidad" target="_blank" rel="noreferrer">política de privacidad</a>.</span>
              </label>
            </form>
          )}

          {paso === 3 && (
            <div className="ln-mas-listo ln-reg-listo">
              <span className="ln-mas-listo-icono"><Check strokeWidth={3} /></span>
              <div className="ln-mas-listo-titulo">¡Listo, {d.nombre.trim().split(" ")[0]}!</div>
              <p className="ln-mas-listo-texto">
                Te mandamos un mail a <b>{d.email.trim()}</b>. Confirmalo y entrás a probar {d.comercio.trim()} 10 días, con ejemplos para ver cómo funciona.
              </p>
              <p className="ln-mas-listo-texto ln-reg-listo-nota">¿No llegó? Fijate en correo no deseado. Si ya tenías cuenta con ese mail, entrá con tu contraseña.</p>
              <a className="ln-boton ln-boton-linea ln-mas-enviar" href="/login">Ir a entrar <ArrowRight className="ln-flecha" strokeWidth={2} /></a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   Pie · el de la landing anterior, con los mismos datos
   ------------------------------------------------------------ */
function Pie() {
  const oscuro = useOscuro();
  return (
    <footer className="ln-pie">
      <div className="ln-pie-marco">
        <div className="ln-pie-marca">
          <LogoGenez size={30} conNombre claro={oscuro} />
          <span>Sistema de gestión para comercios, armado según tu negocio.</span>
        </div>
        <nav className="ln-pie-enlaces" aria-label="Pie">
          <a href={`#${ANCLAS.negocio}`} onClick={irA(ANCLAS.negocio)}>Tu negocio</a>
          <a href={`#${ANCLAS.precios}`} onClick={irA(ANCLAS.precios)}>Precios</a>
          <a href="#preguntas" onClick={irA("preguntas")}>Preguntas</a>
          <a href="/login">Entrar</a>
          <a href="/privacidad">Privacidad</a>
        </nav>
        <div className="ln-pie-copia">© {new Date().getFullYear()} Genez · Hecho en Argentina</div>
      </div>
    </footer>
  );
}
