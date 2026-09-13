/* ============================================================
   LA LANDING · el negocio se reconoce en una card
   ============================================================

   Lo primero que ve un dueño de comercio, casi siempre desde el celular.
   Una promesa en una frase, las cards por rubro, y "Entrar" para los que
   ya usan el sistema.

   LAS CARDS SON DATO
   ------------------
   Salen de `rubros_publicos()`. Mientras la base contesta se dibujan las
   de fábrica —son las mismas tres— y se reemplazan sin que se note; si la
   base no contesta, se quedan. Agregar un rubro a esta página es una fila.

   NO HAY RUTAS
   ------------
   Igual que en la app del cliente: la pantalla es un estado. `?rubro=`
   en la dirección preselecciona una card, y al elegir se escribe en la
   barra para que un refresco no la pierda. El paso siguiente —el alta
   guiada— vive en su propio issue; hasta que exista, esta pantalla lo
   dice con todas las letras en vez de fingir un formulario.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { ShoppingCart, UtensilsCrossed, CalendarDays, Store, Check, ArrowRight } from "lucide-react";
import { RUBROS_DE_FABRICA, cargarRubrosPublicos } from "../datos/landing.js";
import { Tarjeta, Boton } from "../cliente/ui.jsx";
import Stepper from "./Stepper.jsx";

const ICONOS = { carrito: ShoppingCart, cubiertos: UtensilsCrossed, agenda: CalendarDays, tienda: Store };

const OTRO = {
  clave: "otro",
  nombre: "Otro",
  presentacion: {
    titulo: "Otro tipo de negocio",
    bajada: "Contanos qué hacés y vemos cómo se arma.",
    para: "Panaderías, casas de sanitarios, ferreterías, lo que sea",
    icono: "tienda",
    destacados: [],
    preguntas: [],
  },
};

const ROTULO = "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

function rubroDeLaDireccion() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("rubro");
}

function escribirEnLaDireccion(clave) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (clave) url.searchParams.set("rubro", clave); else url.searchParams.delete("rubro");
  window.history.replaceState(null, "", url);
}

export default function Landing() {
  const [rubros, setRubros] = useState(RUBROS_DE_FABRICA);
  const [elegido, setElegido] = useState(rubroDeLaDireccion());
  const [paso, setPaso] = useState(rubroDeLaDireccion() ? "empezar" : "cards");

  useEffect(() => {
    let vigente = true;
    cargarRubrosPublicos()
      .then((rs) => { if (vigente && rs.length) setRubros(rs); })
      .catch(() => { /* se quedan las de fábrica, que son las mismas */ });
    return () => { vigente = false; };
  }, []);

  const todos = [...rubros, OTRO];
  const rubro = todos.find((r) => r.clave === elegido) || null;

  const elegir = (clave) => { setElegido(clave); escribirEnLaDireccion(clave); };
  const continuar = () => { if (rubro) { setPaso("empezar"); window.scrollTo(0, 0); } };
  const volver = () => { setPaso("cards"); window.scrollTo(0, 0); };

  return (
    <div className="max-w-5xl mx-auto px-5 pb-28">
      <header className="flex items-center justify-between py-5">
        <span className="f-d text-xl tracking-[0.18em]">GENEZ</span>
        {/* Los comercios que ya usan el sistema entran por acá. Cuando el
            sistema pase a app.genez.com.ar, este enlace cambia y nada más. */}
        <a href="/" className="text-sm font-semibold text-texto-suave hover:text-texto border border-borde-fuerte rounded-md px-4 py-2">
          Entrar
        </a>
      </header>

      {paso === "cards" ? (
        <Cards rubros={todos} elegido={elegido} rubro={rubro} onElegir={elegir} onContinuar={continuar} />
      ) : (
        <Stepper key={rubro ? rubro.clave : "ninguno"} rubro={rubro} onVolver={volver} />
      )}

      <footer className="mt-16 pt-6 border-t border-borde text-xs text-texto-tenue">
        Genez · un sistema de gestión para comercios, armado según tu negocio.
      </footer>
    </div>
  );
}

function Cards({ rubros, elegido, rubro, onElegir, onContinuar }) {
  return (
    <>
      <section className="pt-6 pb-8 max-w-2xl">
        <h1 className="f-d text-3xl sm:text-4xl leading-tight">
          Un sistema de gestión que se arma según tu negocio.
        </h1>
        <p className="text-texto-suave mt-4 text-[17px] leading-relaxed">
          Elegí tu rubro y en tres pasos sabés qué módulos necesitás, qué te hace falta de tu lado y cuánto pagás para empezar.
        </p>
      </section>

      <section>
        <h2 className={`${ROTULO} mb-3`}>¿Qué tipo de negocio tenés?</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {rubros.map((r) => (
            <Card key={r.clave} rubro={r} activa={r.clave === elegido} onElegir={() => onElegir(r.clave)} />
          ))}
        </div>
      </section>

      {/* La barra de abajo aparece recién cuando hay algo elegido: antes no
          hay nada que continuar, y un botón apagado ocupando el pulgar es
          peor que ninguno. */}
      {rubro && (
        <div className="fixed inset-x-0 bottom-0 bg-superficie/95 backdrop-blur border-t border-borde px-5 py-3">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className={ROTULO}>Elegiste</div>
              <div className="font-semibold truncate">{rubro.presentacion.titulo}</div>
            </div>
            <div className="w-44">
              <Boton onClick={onContinuar}>
                <span className="inline-flex items-center gap-2">Continuar <ArrowRight size={16} /></span>
              </Boton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Card({ rubro, activa, onElegir }) {
  const p = rubro.presentacion;
  const Icono = ICONOS[p.icono] || Store;
  return (
    <Tarjeta onClick={onElegir} className={activa ? "border-acento ring-1 ring-acento" : ""}>
      <div className="flex items-start gap-4">
        <span className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${activa ? "bg-acento text-sobre-acento" : "bg-superficie-2 text-texto-suave"}`}>
          <Icono size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-[17px] leading-snug">{p.titulo}</h3>
            {activa && <Check size={18} className="text-acento shrink-0 mt-0.5" />}
          </div>
          <p className="text-sm text-texto-suave mt-1 leading-relaxed">{p.bajada}</p>
          <p className="text-xs text-texto-tenue mt-2">{p.para}</p>
          {p.destacados.length > 0 && (
            <ul className="mt-3 space-y-1">
              {p.destacados.map((d) => (
                <li key={d} className="text-sm text-texto flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-texto-tenue shrink-0" />{d}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

