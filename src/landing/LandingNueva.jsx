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
import { ArrowRight, Sun, Moon } from "lucide-react";
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
