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
  Coins, Percent, Tag, BellRing,
} from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";
import { RUBROS_DE_FABRICA, cargarRubrosPublicos } from "../datos/landing.js";
import { estaOscuro, fijarTema } from "./tema.js";
import { FOTOS, Flecha } from "./comun.jsx";

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

  /* Lo que el visitante eligió en la página (negocio y plan), para que el
     registro lo traiga cargado. */
  const [eleccion, setEleccion] = useState({ rubro: deLaDireccion("rubro"), negocio: deLaDireccion("negocio"), plan: null });
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
        </main>
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

   Los negocios salen de la base (\`presentacion.negocios\`); lo que les
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
