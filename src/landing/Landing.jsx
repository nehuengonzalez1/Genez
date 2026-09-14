/* ============================================================
   LA LANDING · el negocio se reconoce en una card
   ============================================================

   Lo primero que ve un dueño de comercio, casi siempre desde el celular.
   Tiene que convencer en una pantalla y llevar a una sola acción: elegir
   el rubro. Todo lo demás —cómo funciona, qué incluye— está para el que
   baja a leer, y remata en la misma acción.

   POR QUÉ NO SE VE COMO EL SISTEMA
   --------------------------------
   Comparte los tokens de color (misma familia) pero no la densidad: el
   sistema mete seis datos donde acá va una frase. Los títulos son
   grandes, hay aire, y hay una sola cosa naranja por pantalla. El logo
   es el de verdad (src/ui/Logo.jsx), no la palabra tipeada.

   LAS CARDS SON DATO
   ------------------
   Salen de `rubros_publicos()`. Mientras la base contesta se dibujan las
   de fábrica —son las mismas tres— y se reemplazan sin que se note; si la
   base no contesta, se quedan. Agregar un rubro a esta página es una fila.

   NO HAY RUTAS
   ------------
   Igual que en la app del cliente: la pantalla es un estado. `?rubro=`
   en la dirección preselecciona una card, y al elegir se escribe en la
   barra para que un refresco no la pierda. Los enlaces del menú son
   anclas dentro de la misma página.
   ============================================================ */

import React, { useEffect, useState } from "react";
import {
  ShoppingCart, UtensilsCrossed, CalendarDays, Store, Check, ArrowRight, ArrowDown,
  ScanBarcode, Wallet, Settings, Package, Boxes, Truck, ClipboardList, FileText, Users,
  Ticket, Landmark, LayoutGrid, BarChart3, MessageCircle, Bell, ShieldCheck, Sparkles,
  Smartphone, TrendingUp, Zap,
} from "lucide-react";
import { RUBROS_DE_FABRICA, cargarRubrosPublicos } from "../datos/landing.js";
import { MODULOS } from "../datos/modulos.js";
import { ROTULO } from "../cliente/ui.jsx";
import { LogoGenez } from "../ui/Logo.jsx";
import Stepper from "./Stepper.jsx";

const ICONOS = { carrito: ShoppingCart, cubiertos: UtensilsCrossed, agenda: CalendarDays, tienda: Store };

/* Un ícono por módulo. Es una decisión de esta página y no del catálogo:
   el catálogo es dato y no sabe de dibujos. */
const ICONO_MODULO = {
  cobro: ScanBarcode, caja: Wallet, ajustes: Settings, comandas: UtensilsCrossed, productos: Package,
  stock: Boxes, compras: Truck, pedidos: ClipboardList, clientes: FileText, equipo: Users,
  agenda: CalendarDays, ventas: Ticket, finanzas: Landmark, servicios: LayoutGrid, reportes: BarChart3,
  informes: BarChart3, crm: MessageCircle, comunicaciones: Bell, permisos: ShieldCheck, asistente: Sparkles,
};

/* El rubro que no está. No tiene fila en la base porque no es un rubro:
   es la puerta para el que no se reconoció en ninguna card. Sin
   `modulos`, el alta guiada le deja sumar cualquiera del catálogo; las
   preguntas son las que sirven a cualquier negocio. */
const OTRO = {
  clave: "otro",
  nombre: "Otro",
  modulos: [],
  presentacion: {
    titulo: "Otro tipo de negocio",
    bajada: "Contanos qué hacés y vemos cómo se arma.",
    para: "Panaderías, casas de sanitarios, ferreterías, lo que sea",
    icono: "tienda",
    destacados: ["Cobro y caja desde el primer día", "Productos y stock", "Informes de qué deja plata"],
    nucleo: ["productos", "reportes"],
    preguntas: [
      { k: "stock", n: "Controlo el stock", modulos: ["stock"], necesita: [] },
      { k: "compras", n: "Compro a proveedores con remito o factura", modulos: ["compras"], necesita: [] },
      { k: "factura", n: "Facturo A y B", modulos: ["clientes"], necesita: [] },
      { k: "pedidos", n: "Tomo pedidos para preparar o enviar", modulos: ["pedidos"], necesita: [] },
      { k: "turnos", n: "Trabajo con turnos o agenda", modulos: ["agenda", "servicios"], necesita: [] },
      { k: "equipo", n: "Trabajan otras personas conmigo", modulos: ["permisos"], necesita: [] },
    ],
  },
};

/* Botones de la página. No son los de la app del cliente (ocupan todo el
   ancho, para el pulgar): acá van en línea, con el aire que pide DISENO.md:
   12px arriba y abajo, 18px a los costados, esquina de 6px. */
const BOTON = "inline-flex items-center justify-center gap-2 rounded-md text-[15px] px-[18px] py-3 transition-colors";
const SOLIDO = `${BOTON} bg-acento hover:bg-acento-vivo text-sobre-acento font-bold`;
const LINEA = `${BOTON} border border-borde-fuerte hover:border-texto-tenue text-texto font-semibold`;

const SOMBRA_HOVER = "hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]";

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
    <div className="min-h-screen flex flex-col">
      <Cabecera conMenu={paso === "cards"} />

      <main className="flex-1">
        {paso === "cards" ? (
          <Portada rubros={todos} elegido={elegido} rubro={rubro} onElegir={elegir} onContinuar={continuar} />
        ) : (
          <div className="max-w-5xl mx-auto px-5 pb-20">
            <Stepper key={rubro ? rubro.clave : "ninguno"} rubro={rubro} onVolver={volver} />
          </div>
        )}
      </main>

      <Pie />
    </div>
  );
}

/* ------------------------------------------------------------
   Cabecera · pegada arriba, con el logo de verdad

   Los comercios que ya usan el sistema entran por "Entrar". Cuando el
   sistema pase a app.genez.com.ar, ese enlace cambia y nada más.
   ------------------------------------------------------------ */
function Cabecera({ conMenu }) {
  return (
    <header className="sticky top-0 z-30 bg-fondo/90 backdrop-blur border-b border-borde">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <a href="/landing" aria-label="Genez, inicio" className="shrink-0">
          <LogoGenez size={34} conNombre />
        </a>

        {conMenu && (
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-texto-suave">
            <a href="#rubros" className="hover:text-texto">Rubros</a>
            <a href="#como-funciona" className="hover:text-texto">Cómo funciona</a>
            <a href="#incluye" className="hover:text-texto">Qué incluye</a>
          </nav>
        )}

        <div className="flex items-center gap-2">
          <a href="/" className={`${LINEA} !py-2 !px-4 text-sm`}>Entrar</a>
          {conMenu && (
            <a href="#rubros" className={`${SOLIDO} !py-2 !px-4 text-sm hidden sm:inline-flex`}>Empezar</a>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------
   La portada: hero, por qué, las cards, cómo funciona, qué incluye,
   y el remate. Todo lleva a #rubros.
   ------------------------------------------------------------ */
function Portada({ rubros, elegido, rubro, onElegir, onContinuar }) {
  return (
    <>
      <Hero />
      <PorQue />
      <Rubros rubros={rubros} elegido={elegido} onElegir={onElegir} />
      <ComoFunciona />
      <QueIncluye />
      <Remate />

      {/* La barra de abajo aparece recién cuando hay algo elegido: antes no
          hay nada que continuar, y un botón apagado ocupando el pulgar es
          peor que ninguno. */}
      {rubro && (
        <div className="fixed inset-x-0 bottom-0 z-30 bg-superficie/95 backdrop-blur border-t border-borde px-5 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <span className="hidden sm:flex w-10 h-10 rounded-lg bg-acento-suave text-acento items-center justify-center shrink-0">
              <Check size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={ROTULO}>Elegiste</div>
              <div className="font-semibold truncate">{rubro.presentacion.titulo}</div>
            </div>
            <button type="button" onClick={onContinuar} className={SOLIDO}>
              Continuar <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-5 pt-10 sm:pt-16 pb-10 sm:pb-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-center">
      <div>
        <div className={ROTULO}>Sistema de gestión para comercios</div>
        <h1 className="f-d text-[38px] sm:text-5xl lg:text-[54px] leading-[1.05] mt-4">
          El sistema de gestión que se arma <span className="text-acento">según tu rubro.</span>
        </h1>
        <p className="text-texto-suave mt-5 text-[17px] sm:text-lg leading-relaxed max-w-xl">
          Cobro, stock, caja, turnos y clientes en un solo lugar. Elegí tu rubro y en tres pasos tenés
          tu presupuesto: solo los módulos que necesitás, qué te hace falta de tu lado y cuánto pagás por mes.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a href="#rubros" className={SOLIDO}>Elegir mi rubro <ArrowDown size={16} /></a>
          <a href="#como-funciona" className={LINEA}>Ver cómo funciona</a>
        </div>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-texto-suave">
          {["Sin tarjeta para ver tu presupuesto", "Precio claro antes de empezar", "Celular, tablet o computadora"].map((t) => (
            <li key={t} className="flex items-center gap-2"><Check size={15} className="text-acento" /> {t}</li>
          ))}
        </ul>
      </div>

      <Escena />
    </section>
  );
}

/* El visual del hero. Son fragmentos de la interfaz —mismas tarjetas,
   mismos colores— dibujados acá, no una captura: no envejecen cuando
   cambia una pantalla y no muestran datos de nadie. Los números son de
   ejemplo y se ven como tal. */
function Escena() {
  const barras = [38, 55, 47, 70, 62, 88, 76];
  const dias = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  return (
    <div className="escena relative h-[400px] sm:h-[460px] select-none" aria-hidden="true">
      <div className="absolute inset-x-2 inset-y-6 rounded-xl bg-acento-suave/70" />

      <div className="escena-a absolute left-0 top-4 w-[62%] bg-superficie border border-borde rounded-xl p-4">
        <div className={ROTULO}>Ventas de la semana</div>
        <div className="f-d f-m text-2xl mt-1">$ 1.284.500</div>
        <div className="text-xs text-bien mt-0.5 flex items-center gap-1 font-semibold">
          <TrendingUp size={12} /> 12% más que la anterior
        </div>
        <div className="mt-4 flex items-end gap-1.5 h-20">
          {barras.map((h, i) => (
            <div key={i} className={`flex-1 rounded-sm ${i === 5 ? "bg-acento" : "bg-superficie-3"}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mt-1.5 flex text-[10px] text-texto-tenue">
          {dias.map((d) => <span key={d} className="flex-1 text-center">{d}</span>)}
        </div>
      </div>

      <div className="escena-b absolute right-0 top-[20%] w-[58%] bg-superficie border border-borde rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className={ROTULO}>Cobro</div>
          <span className="text-[10px] font-bold text-texto-tenue">Caja 1</span>
        </div>
        <ul className="mt-3 space-y-2 text-[13px]">
          {[["Leche entera 1 L", "$ 1.450"], ["Pan lactal", "$ 2.900"], ["Queso cremoso · 0,350 kg", "$ 3.640"]].map(([n, p]) => (
            <li key={n} className="flex justify-between gap-2">
              <span className="truncate">{n}</span><span className="f-m whitespace-nowrap shrink-0">{p}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 pt-3 border-t border-borde flex items-center justify-between">
          <span className="text-sm font-semibold">Total</span>
          <span className="f-d f-m text-xl">$ 7.990</span>
        </div>
        <div className="mt-3 rounded-md bg-acento text-sobre-acento text-center text-sm font-bold py-2.5">Cobrar</div>
      </div>

      <div className="escena-c absolute left-[5%] bottom-0 w-[54%] bg-superficie border border-borde rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="w-9 h-9 rounded-lg bg-ojo-suave text-ojo flex items-center justify-center shrink-0"><Boxes size={18} /></span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">Stock bajo</div>
          <div className="text-xs text-texto-tenue truncate">3 productos para reponer hoy</div>
        </div>
      </div>
    </div>
  );
}

function PorQue() {
  const puntos = [
    { I: Zap, t: "Cobrás en segundos", d: "Lector de códigos, vuelto y ticket. Sin vueltas en la cola." },
    { I: TrendingUp, t: "Sabés qué deja plata", d: "Margen por producto y por rubro, todos los días." },
    { I: Smartphone, t: "Tus clientes reservan solos", d: "Una app con tu marca para turnos y avisos por WhatsApp." },
    { I: ShieldCheck, t: "Cada uno ve lo suyo", d: "Permisos por rol y registro de quién cambió qué." },
  ];
  return (
    <section className="border-y border-borde bg-superficie">
      <div className="max-w-6xl mx-auto px-5 py-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {puntos.map(({ I, t, d }) => (
          <div key={t} className="flex gap-4">
            <span className="w-11 h-11 rounded-lg bg-acento-suave text-acento flex items-center justify-center shrink-0"><I size={20} /></span>
            <div>
              <h3 className="font-bold text-[16px] leading-snug">{t}</h3>
              <p className="text-sm text-texto-suave mt-1 leading-relaxed">{d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Rubros({ rubros, elegido, onElegir }) {
  return (
    <section id="rubros" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
      <div className="max-w-2xl">
        <div className={ROTULO}>Paso 1 de 3</div>
        <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-3">¿Qué tipo de negocio tenés?</h2>
        <p className="text-texto-suave mt-3 text-[17px] leading-relaxed">
          Elegí una card. Con eso armamos los módulos que te corresponden y te mostramos el presupuesto.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-8">
        {rubros.map((r) => (
          <Card key={r.clave} rubro={r} activa={r.clave === elegido} onElegir={() => onElegir(r.clave)} />
        ))}
      </div>
    </section>
  );
}

function Card({ rubro, activa, onElegir }) {
  const p = rubro.presentacion;
  const Icono = ICONOS[p.icono] || Store;
  return (
    /* `flex flex-col`: un <button> centra su contenido en vertical, y en
       una grilla de cards de distinto largo la más corta quedaba con el
       ícono flotando a mitad de altura. */
    <button type="button" onClick={onElegir} aria-pressed={activa}
      className={`w-full text-left flex flex-col bg-superficie rounded-xl p-5 sm:p-6 transition-all border ${SOMBRA_HOVER} ${
        activa ? "border-acento ring-1 ring-acento" : "border-borde hover:border-borde-fuerte"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
          activa ? "bg-acento text-sobre-acento" : "bg-acento-suave text-acento"}`}>
          <Icono size={24} />
        </span>
        <span className={`text-xs font-bold rounded-md px-2.5 py-1 inline-flex items-center gap-1 ${
          activa ? "bg-acento text-sobre-acento" : "border border-borde text-texto-tenue"}`}>
          {activa ? <><Check size={13} /> Elegido</> : "Elegir"}
        </span>
      </div>

      <h3 className="f-d text-xl mt-4 leading-snug">{p.titulo}</h3>
      <p className="text-[15px] text-texto-suave mt-1.5 leading-relaxed">{p.bajada}</p>
      <p className="text-xs text-texto-tenue mt-2">{p.para}</p>

      {p.destacados.length > 0 && (
        <ul className="mt-4 pt-4 border-t border-borde grid gap-2">
          {p.destacados.map((d) => (
            <li key={d} className="text-sm flex items-start gap-2 leading-snug">
              <Check size={15} className="text-acento shrink-0 mt-0.5" />{d}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

function ComoFunciona() {
  const pasos = [
    { n: "01", t: "Elegí tu rubro", d: "Comercio, gastronomía, turnos… o contanos el tuyo. Con eso ya sabemos qué módulos van." },
    { n: "02", t: "Contanos cómo trabajás", d: "Unas tildes: si controlás stock, si facturás, si hacés delivery, si tenés equipo. Cada una suma solo lo que hace falta." },
    { n: "03", t: "Mirá tu presupuesto", d: "Solo los módulos que necesitás, con el precio de cada uno, lo que va una sola vez y lo que necesitás de tu lado." },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
      <div className="max-w-2xl">
        <div className={ROTULO}>Cómo funciona</div>
        <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-3">Tres pasos y sabés qué pagás.</h2>
        <p className="text-texto-suave mt-3 text-[17px] leading-relaxed">
          Sin llamados ni presupuestos por mail. El estimado lo ves vos, en el momento.
        </p>
      </div>

      <ol className="grid md:grid-cols-3 gap-4 mt-8">
        {pasos.map((s) => (
          <li key={s.n} className="bg-superficie border border-borde rounded-xl p-5 sm:p-6">
            <div className="f-d f-m text-acento text-3xl">{s.n}</div>
            <h3 className="font-bold text-[17px] mt-3">{s.t}</h3>
            <p className="text-sm text-texto-suave mt-1.5 leading-relaxed">{s.d}</p>
          </li>
        ))}
      </ol>

      <p className="text-sm text-texto-tenue mt-5 max-w-2xl leading-relaxed">
        Si te cierra, lo pedís por WhatsApp con el presupuesto ya escrito y te contestamos con los pasos para arrancar. Hasta ahí no te pedimos tarjeta.
      </p>
    </section>
  );
}

function QueIncluye() {
  /* Dos módulos se llaman "Informes" (uno mira márgenes, el otro
     ocupación). Para el que lee de afuera es uno solo: se muestra una vez. */
  const vistos = new Set();
  const modulos = MODULOS.filter((m) => !vistos.has(m.n) && vistos.add(m.n));

  return (
    <section id="incluye" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-16 sm:pb-20">
      <div className="max-w-2xl">
        <div className={ROTULO}>Qué incluye</div>
        <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-3">Todo lo que un comercio necesita, por módulos.</h2>
        <p className="text-texto-suave mt-3 text-[17px] leading-relaxed">
          Pagás una base que incluye cobro, caja y ajustes, más cada módulo que sumes. Nada más.
        </p>
      </div>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
        {modulos.map((m) => {
          const I = ICONO_MODULO[m.k] || LayoutGrid;
          return (
            <li key={m.k} className="bg-superficie border border-borde rounded-xl px-4 py-3.5 flex items-center gap-3">
              <span className="w-10 h-10 rounded-lg bg-superficie-2 text-texto-suave flex items-center justify-center shrink-0"><I size={19} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[15px]">{m.n}</span>
                  {m.base && <span className="text-[10px] uppercase tracking-wider font-bold text-acento bg-acento-suave rounded px-1.5 py-0.5">Base</span>}
                </div>
                <div className="text-xs text-texto-tenue mt-0.5 truncate">{m.d}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* El remate: la misma acción del hero, en oscuro para cerrar. Es el único
   fondo oscuro de la página, y por eso lleva la versión clara del logo. */
function Remate() {
  return (
    <section className="bg-texto text-fondo">
      <div className="max-w-6xl mx-auto px-5 py-14 sm:py-20 flex flex-col md:flex-row md:items-center gap-8">
        <div className="flex-1">
          <LogoGenez size={44} claro />
          <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-5">Empezá hoy con un sistema hecho para tu rubro.</h2>
          <p className="text-fondo/70 mt-3 text-[17px] leading-relaxed max-w-xl">
            Elegí tu rubro, contanos cómo trabajás y mirá tu presupuesto. Tres pasos, sin compromiso.
          </p>
        </div>
        <a href="#rubros" className={`${SOLIDO} shrink-0`}>Elegir mi rubro <ArrowRight size={16} /></a>
      </div>
    </section>
  );
}

function Pie() {
  return (
    <footer className="border-t border-borde">
      <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LogoGenez size={28} conNombre />
          <span className="text-xs text-texto-tenue hidden sm:inline">Sistema de gestión para comercios</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-texto-suave">
          <a href="#rubros" className="hover:text-texto">Rubros</a>
          <a href="#como-funciona" className="hover:text-texto">Cómo funciona</a>
          <a href="#incluye" className="hover:text-texto">Qué incluye</a>
          <a href="/" className="hover:text-texto">Entrar</a>
        </nav>
        <div className="text-xs text-texto-tenue">© {new Date().getFullYear()} Genez · Argentina</div>
      </div>
    </footer>
  );
}
