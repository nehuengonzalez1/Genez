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

import React, { createContext, useContext, useState } from "react";
import { ArrowRight, Sun, Moon, ShoppingCart, Box, BarChart3, FileText, AlertTriangle, TrendingDown, Truck, ChevronDown } from "lucide-react";
import { LogoGenez } from "../ui/Logo.jsx";
import { estaOscuro, fijarTema } from "./tema.js";

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

export default function LandingNueva() {
  const [oscuro, setOscuro] = useState(estaOscuro());
  const alternarTema = () => { fijarTema(oscuro ? "claro" : "oscuro"); setOscuro(!oscuro); };

  return (
    <TemaCtx.Provider value={oscuro}>
      <div className={`ln ${oscuro ? "" : "ln-claro"}`}>
        <Cabecera onAlternarTema={alternarTema} />
        <main>
          <Inicio />
          <QueHace />
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
        <h2 className="ln-hace-titulo">Vender es una parte.<br /><span className="ln-naranja">Entender tu negocio</span><br />es otra.</h2>
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
