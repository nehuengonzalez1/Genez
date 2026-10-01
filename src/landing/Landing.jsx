/* ============================================================
   LA LANDING · la maqueta, en claro y en oscuro
   ============================================================

   Lo primero que ve un dueño de comercio, casi siempre desde el celular.
   Sigue una maqueta concreta (la de septiembre 2026) y la misma en los
   dos temas: hero con el sistema en una laptop y la app del cliente en
   un teléfono, "¿Qué negocio tenés?" con una fila por rubro y los
   negocios concretos con foto, "qué resuelve" con el ticket, "qué
   incluye" con los módulos, y un pie con la acción de nuevo.

   NEGOCIOS Y NO RUBROS
   --------------------
   Uno se reconoce en "Kiosco", no en "Comercio y minimercado". Cada
   fila muestra los negocios concretos de su rubro
   (`presentacion.negocios`) y tocar uno elige el rubro que lo contiene;
   el nombre que tocó lo acompaña hasta el WhatsApp.

   LAS FOTOS
   ---------
   Las de la maqueta son generadas. Acá van fotos libres de Unsplash,
   una por negocio, en `FOTOS`: cambiar una es cambiar un identificador.
   Un negocio sin foto muestra su ícono, así un rubro nuevo no rompe
   nada.

   LOS APARATOS SON INTERFAZ, NO CAPTURAS
   --------------------------------------
   La laptop y el teléfono se dibujan con CSS y adentro va interfaz con
   los mismos tokens: no envejece cuando cambia una pantalla y no muestra
   datos de nadie. Los números son de ejemplo y se ven como tal.

   NO HAY RUTAS
   ------------
   Igual que en la app del cliente: la pantalla es un estado. `?rubro=`
   (y `negocio=`) en la dirección preseleccionan, y al tocar se escriben
   en la barra para que un refresco no los pierda. Los enlaces del menú
   son anclas dentro de la misma página.
   ============================================================ */

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ShoppingCart, UtensilsCrossed, CalendarDays, Store, ArrowRight, Plus, Minus, Sun, Moon,
  ScanBarcode, Wallet, Settings, Package, Boxes, Truck, ClipboardList, FileText, Users,
  Ticket, Landmark, LayoutGrid, BarChart3, MessageCircle, Bell, ShieldCheck, Sparkles,
  Smartphone, TrendingUp, MapPin, CreditCard, Unlock, Lock, Leaf, Home, Calendar, Gift, User, Coins, Timer, Monitor, CircleCheck, Database, Wifi, Puzzle, Play, MessageSquare,
} from "lucide-react";
import { RUBROS_DE_FABRICA, cargarRubrosPublicos } from "../datos/landing.js";
import { MODULOS } from "../datos/modulos.js";
import { ROTULO } from "../cliente/ui.jsx";
import { LogoGenez } from "../ui/Logo.jsx";
import { estaOscuro, fijarTema } from "./tema.js";
import { ICONO_RUBRO, ICONO_MODULO, foto, Flecha } from "./comun.jsx";
import Stepper from "./Stepper.jsx";

const ICONOS = ICONO_RUBRO;

/* La frase corta de cada rubro en su fila, como en la maqueta. Un rubro
   nuevo sin frase usa su bajada. */
const FRASE_RUBRO = {
  minimercado: "Para vender más y tener todo en orden.",
  gastronomia: "Para que tu cocina también rinda.",
  servicios: "Para gestionar tu tiempo y el de tus clientes.",
};

/* El rubro que no está. No tiene fila en la base porque no es un rubro:
   es la puerta para el que no se reconoció en ninguna card. Sin
   `modulos`, el alta guiada le deja sumar cualquiera del catálogo; las
   preguntas son las que sirven a cualquier negocio. */
const OTRO = {
  clave: "otro",
  nombre: "Contanos qué hacés",
  modulos: [],
  presentacion: {
    titulo: "Otro tipo de negocio",
    bajada: "Contanos qué hacés y vemos cómo se arma.",
    para: "Lo que sea que vendas o atiendas",
    icono: "tienda",
    destacados: [],
    negocios: ["Otro negocio"],
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
/* Las variantes `disabled:` solo pintan cuando el boton esta apagado, asi
   que no molestan donde SOLIDO se usa habilitado. */
const SOLIDO = `${BOTON} bg-acento hover:bg-acento-vivo text-sobre-acento font-bold disabled:opacity-50 disabled:cursor-default disabled:hover:bg-acento`;
const LINEA = `${BOTON} border border-borde-fuerte hover:border-texto-tenue text-texto font-semibold`;
const LINEA_ACENTO = `${BOTON} border border-acento text-acento hover:bg-acento-suave/40 font-semibold`;

const ROTULO_ACENTO = "text-[11px] uppercase tracking-[0.14em] font-bold text-acento";

/* Si la página está en oscuro. Lo leen el logo (que tiene una versión
   por fondo) y los aparatos; cambia con el botón de la cabecera. */
const TemaCtx = createContext(false);
const useOscuro = () => useContext(TemaCtx);
/* EL ALTA GUIADA ESTÁ CERRADA HASTA QUE EL SISTEMA ESTÉ LISTO

   La landing se ve entera —sirve para mostrar el producto, y el link se le
   puede pasar a alguien— pero no se puede pedir nada. El alta guiada
   termina mandando un pedido por WhatsApp y guardándolo en `solicitudes`,
   y recibir pedidos antes de poder atenderlos es peor que no tener
   landing: alguien espera una respuesta que no va a llegar.

   Es un interruptor y no un borrado. Cuando se abra, esta línea pasa a
   `true` y vuelve todo: las tarjetas de rubro, el botón y el enlace
   directo con `?rubro=`. No hay nada más que deshacer.

   Abierta el 30/09 para probar el alta de punta a punta: los pedidos llegan
   de verdad (a `solicitudes` y al WhatsApp de Precios, en el Panel). */
const ALTA_ABIERTA = true;

const CTA = ALTA_ABIERTA ? "Armar mi sistema" : "Próximamente";

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

export default function Landing() {
  const [rubros, setRubros] = useState(RUBROS_DE_FABRICA);
  const [elegido, setElegido] = useState(deLaDireccion("rubro"));
  const [negocio, setNegocio] = useState(deLaDireccion("negocio"));
  /* El `?rubro=` de la dirección también entra al alta guiada, así que
     cerrarla solo en los botones dejaría la puerta de atrás abierta: un
     link viejo compartido por WhatsApp seguiría llevando al formulario. */
  const [paso, setPaso] = useState(ALTA_ABIERTA && deLaDireccion("rubro") ? "empezar" : "cards");
  const [oscuro, setOscuro] = useState(estaOscuro());
  const alternarTema = () => { fijarTema(oscuro ? "claro" : "oscuro"); setOscuro(!oscuro); };

  useEffect(() => {
    let vigente = true;
    cargarRubrosPublicos()
      .then((rs) => { if (vigente && rs.length) setRubros(rs); })
      .catch(() => { /* se quedan las de fábrica, que son las mismas */ });
    return () => { vigente = false; };
  }, []);

  const todos = [...rubros, OTRO];
  const rubro = todos.find((r) => r.clave === elegido) || null;

  /* Tocar un negocio elige y avanza en el mismo gesto: la card ya es la
     respuesta, y un "Continuar" aparte era un toque de más. */
  const elegir = (clave, nombre) => {
    if (!ALTA_ABIERTA) return;
    setElegido(clave); setNegocio(nombre); escribirEnLaDireccion(clave, nombre);
    setPaso("empezar"); window.scrollTo(0, 0);
  };
  /* "Armar mi sistema" entra al alta guiada por su paso 1 (elegir el
     negocio); tocar una card de la portada lo saltea. */
  const empezar = () => {
    if (!ALTA_ABIERTA) return;
    setElegido(null); setNegocio(null); escribirEnLaDireccion(null, null);
    setPaso("empezar"); window.scrollTo(0, 0);
  };
  const volver = () => { setPaso("cards"); window.scrollTo(0, 0); };

  return (
    <TemaCtx.Provider value={oscuro}>
      <div className="min-h-screen flex flex-col">
        <Cabecera conMenu={paso === "cards"} onAlternarTema={alternarTema} onEmpezar={empezar} />

        <main className="flex-1">
          {paso === "cards" ? (
            <Portada rubros={rubros} onElegir={elegir} onEmpezar={empezar} />
          ) : (
            /* En oscuro el alta decide su propio ancho: los pasos copiados de su
               maqueta van a todo el ancho y los demás se encierran solos. */
            <div className={oscuro ? "" : "max-w-5xl mx-auto px-5 pb-20"}>
              <Stepper key={rubro ? `${rubro.clave}:${negocio || ""}` : "ninguno"} rubro={rubro} rubros={todos} negocio={negocio}
                onElegirNegocio={elegir} onVolver={volver} />
            </div>
          )}
        </main>

        <Pie onEmpezar={empezar} />
      </div>
    </TemaCtx.Provider>
  );
}

/* ------------------------------------------------------------
   Cabecera · pegada arriba, con el logo de verdad y el tema

   Los comercios que ya usan el sistema entran por "Entrar". Cuando el
   sistema pase a app.genez.com.ar, ese enlace cambia y nada más.
   ------------------------------------------------------------ */
function Cabecera({ conMenu, onAlternarTema, onEmpezar }) {
  const oscuro = useOscuro();
  return (
    <header className="sticky top-0 z-30 bg-fondo/90 backdrop-blur border-b border-borde">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <a href="/landing" aria-label="Genez, inicio" className="shrink-0">
          <LogoGenez size={34} conNombre claro={oscuro} />
        </a>

        {conMenu && (
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-texto-suave">
            <a href="#resuelve" className="hover:text-texto">Qué resuelve</a>
            <a href="#como-funciona" className="hover:text-texto">Cómo funciona</a>
            <a href="#incluye" className="hover:text-texto">Qué incluye</a>
            <a href="#preguntas" className="hover:text-texto">Preguntas</a>
          </nav>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={onAlternarTema} aria-label={oscuro ? "Ver en claro" : "Ver en oscuro"} title={oscuro ? "Ver en claro" : "Ver en oscuro"}
            className="w-10 h-10 rounded-md border border-borde-fuerte text-texto-suave hover:text-texto flex items-center justify-center">
            {oscuro ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a href="/login" className={`${LINEA} !py-2 !px-4 text-sm`}>Entrar</a>
          {conMenu && (
            <button type="button" onClick={onEmpezar} disabled={!ALTA_ABIERTA} className={`${SOLIDO} !py-2 !px-4 text-sm hidden sm:inline-flex`}>{CTA} <ArrowRight size={15} /></button>
          )}
        </div>
      </div>
    </header>
  );
}

function Portada({ rubros, onElegir, onEmpezar }) {
  return (
    <>
      <Hero onEmpezar={onEmpezar} />
      <Empecemos rubros={rubros} onElegir={onElegir} />
      <QueResuelve />
      <QueIncluye />
      <ComoFunciona onEmpezar={onEmpezar} />
      <Preguntas />
    </>
  );
}

/* En oscuro, la portada es la de la maqueta del 01/10, copiada tal cual:
   los aparatos son la imagen de la maqueta (recortada, sin el texto) y
   el texto va en HTML, para que se lea, se traduzca y se adapte al
   teléfono. El claro sigue con la de antes hasta que se haga el suyo. */
function Hero({ onEmpezar }) {
  if (useOscuro()) return <HeroNoche onEmpezar={onEmpezar} />;
  return (
    <section className="max-w-6xl mx-auto px-5 pt-10 sm:pt-14 pb-10 sm:pb-14 grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-8 items-center">
      <div>
        <div className={ROTULO_ACENTO}>Tu negocio, en orden</div>
        <h1 className="f-d text-[44px] sm:text-6xl lg:text-[64px] leading-[1.0] mt-4">
          Un sistema<br />que se adapta<br /><span className="text-acento">a vos.</span>
        </h1>
        <p className="text-texto-suave mt-5 text-[17px] leading-relaxed max-w-md">
          Ventas, stock, turnos, clientes, finanzas y más. Solo los módulos que necesitás, con un precio claro desde el primer día.
        </p>
        <button type="button" onClick={onEmpezar} disabled={!ALTA_ABIERTA} className={`${SOLIDO} mt-7`}>{CTA} <ArrowRight size={16} /></button>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-texto-suave">
          {[[MapPin, "Hecho en Argentina"], [CreditCard, "Sin tarjeta"], [Unlock, "Cancelás cuando quieras"]].map(([I, t]) => (
            <li key={t} className="inline-flex items-center gap-1.5"><I size={14} className="text-texto-tenue" /> {t}</li>
          ))}
        </ul>
      </div>

      <Aparatos />
    </section>
  );
}

function HeroNoche({ onEmpezar }) {
  return (
    <section className="hero-noche relative overflow-hidden">
      <div className="lg:flex lg:items-stretch">
        <div className="relative z-10 px-5 pt-10 pb-8 lg:p-0 lg:pl-[5.4vw] lg:w-[38%] lg:shrink-0 flex flex-col justify-center">
          <div className="hn-rotulo">Tu negocio, en orden <span className="hn-raya" aria-hidden="true" /></div>
          <h1 className="hn-titulo">
            Un sistema<br />que se adapta<br /><span className="hn-naranja">a vos.</span>
          </h1>
          <p className="hn-parrafo">
            Ventas, stock, turnos, clientes, finanzas y más. Solo los módulos que necesitás, con un precio claro desde el primer día.
          </p>
          <div>
            <button type="button" onClick={onEmpezar} disabled={!ALTA_ABIERTA} className="hn-boton">
              {CTA} <ArrowRight className="hn-flecha" strokeWidth={2.25} />
            </button>
          </div>
          <ul className="hn-datos">
            <li><span className="hn-bandera" aria-hidden="true" /><span>Hecho en Argentina</span></li>
            <li><CreditCard className="hn-icono" strokeWidth={1.75} aria-hidden="true" /><span>Precio claro<br />desde el inicio</span></li>
            <li><Lock className="hn-icono" strokeWidth={1.75} aria-hidden="true" /><span>Cancelás<br />cuando quieras</span></li>
          </ul>
        </div>
        <div className="hn-arte lg:w-[62%]">
          <img src="/landing/hero-oscuro.jpg" width="1214" height="803" className="block w-full h-auto"
            alt="El sistema Genez en una computadora y la app del cliente en un teléfono" />
        </div>
      </div>
    </section>
  );
}

/* La laptop con el sistema y el teléfono con la app del cliente, con las
   anotaciones a mano de la maqueta. */
function Aparatos() {
  return (
    <div className="relative select-none pt-6 lg:pt-16 pb-4" aria-hidden="true">
      <div className="absolute inset-x-6 inset-y-10 rounded-[40px] bg-acento-suave/60 blur-2xl" />

      {/* Las dos anotaciones van fuera del camino de los aparatos: la de la
          izquierda a media altura, la de la derecha arriba del teléfono. */}
      <div className="manuscrita hidden lg:block absolute left-0 top-[58%] w-32 text-[19px] leading-[1.05] text-texto -rotate-6">
        Todo tu negocio en un solo lugar
        <Flecha className="w-14 mt-1 ml-14 text-texto-suave" />
      </div>

      <div className="manuscrita hidden lg:block absolute right-0 top-0 w-44 text-[19px] leading-[1.05] text-texto rotate-3 text-right">
        Tu negocio también puede tener su propia app
        <Flecha className="w-10 mt-0.5 ml-auto mr-6 text-texto-suave -scale-x-100 rotate-12" />
      </div>

      <div className="relative lg:ml-24 lg:mr-28">
        <Laptop />
      </div>
      <div className="absolute right-0 lg:right-2 bottom-0 w-[32%] max-w-[150px]">
        <Telefono />
      </div>
    </div>
  );
}

function Kpi({ t, v, d, ojo }) {
  return (
    <div className="bg-superficie border border-borde rounded p-1.5 min-w-0">
      <div className="text-[6px] text-texto-tenue uppercase tracking-wider font-bold truncate">{t}</div>
      <div className="f-d f-m text-[11px] leading-tight mt-0.5">{v}</div>
      <div className={`text-[6px] font-semibold mt-0.5 ${ojo ? "text-acento" : "text-bien"}`}>{d}</div>
    </div>
  );
}

function Laptop() {
  const menu = ["Inicio", "Ventas", "Caja", "Productos", "Clientes", "Equipo", "Finanzas", "Informes", "Ajustes"];
  const barras = [38, 55, 47, 70, 62, 88, 76];
  const dias = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  const oscuro = useOscuro();
  return (
    <div>
      <div className="laptop-pantalla">
        <div className="rounded-lg overflow-hidden bg-fondo text-texto flex" style={{ aspectRatio: "16 / 10" }}>
          <aside className="w-[24%] bg-superficie border-r border-borde p-2 min-w-0">
            <div className="scale-75 origin-top-left"><LogoGenez size={18} conNombre claro={oscuro} /></div>
            <ul className="mt-2 space-y-[2px] text-[7px] font-semibold text-texto-suave">
              {menu.map((n, i) => (
                <li key={n} className={`px-1.5 py-[3px] rounded ${i === 0 ? "bg-superficie-2 text-texto" : ""}`}>{n}</li>
              ))}
            </ul>
          </aside>
          <div className="flex-1 p-2 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="text-[10px] font-bold leading-tight">Hola, Nehuen</div>
                <div className="text-[6px] text-texto-tenue">Acá tenés un resumen de tu negocio.</div>
              </div>
              <div className="text-[6px] text-texto-tenue whitespace-nowrap">Hoy, 13 de septiembre</div>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mt-2">
              <Kpi t="Ventas hoy" v="$ 284.500" d="▲ 12%" />
              <Kpi t="Turnos hoy" v="24" d="▲ 3%" />
              <Kpi t="Stock bajo" v="7" d="Ver productos" ojo />
            </div>
            <div className="grid grid-cols-[1fr_1.7fr] gap-1.5 mt-1.5">
              <Kpi t="Clientes" v="156" d="▲ 8%" />
              <div className="bg-superficie border border-borde rounded p-1.5 min-w-0">
                <div className="text-[6px] text-texto-tenue uppercase tracking-wider font-bold">Ventas de la semana</div>
                <div className="flex items-end gap-[3px] h-7 mt-1">
                  {barras.map((h, i) => <div key={i} className={`flex-1 rounded-[1px] ${i === 5 ? "bg-acento" : "bg-superficie-3"}`} style={{ height: `${h}%` }} />)}
                </div>
                <div className="flex text-[5px] text-texto-tenue mt-0.5">{dias.map((d) => <span key={d} className="flex-1 text-center">{d}</span>)}</div>
              </div>
            </div>
            <div className="text-[6px] text-texto-tenue uppercase tracking-wider font-bold mt-2">Accesos rápidos</div>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {[[ShoppingCart, "Nueva venta"], [CalendarDays, "Nuevo turno"], [Package, "Producto"], [User, "Cliente"]].map(([I, t]) => (
                <div key={t} className="bg-superficie border border-borde rounded p-1 flex flex-col items-center gap-0.5">
                  <I size={9} className="text-acento" /><span className="text-[5px] font-semibold text-texto-suave">{t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="laptop-base" />
    </div>
  );
}

/* La app del cliente de un comercio real (Almha): siempre en su propio
   oscuro cálido, sea cual sea el tema de la página, porque es otra app. */
function Telefono() {
  return (
    <div className="telefono">
      <div className="telefono-pantalla relative bg-[#1a1715] text-[#f7f3ed]" style={{ aspectRatio: "9 / 19" }}>
        <div className="pt-5 text-center">
          <div className="f-d text-[17px] leading-none">almha</div>
          <div className="text-[5px] tracking-[0.25em] uppercase text-[#b7afa5] mt-1">by Genez</div>
        </div>
        <div className="px-2.5 mt-3">
          <div className="rounded-lg bg-[#2a2320] p-2">
            <div className="text-[8px] font-bold leading-snug">Tu espacio.<br />Tu bienestar.<br />Tu tiempo.</div>
            <div className="mt-2 h-10 rounded-md bg-gradient-to-br from-[#3a2f28] to-[#221b18] flex items-end justify-end p-1">
              <Leaf size={12} className="text-[#8fbf85]" />
            </div>
          </div>
          <div className="mt-2 rounded-md bg-acento text-sobre-acento text-center text-[7px] font-bold py-1.5">Reservá tu turno</div>
        </div>
        <div className="absolute bottom-0 inset-x-0 flex justify-around text-[4.5px] text-[#87786f] py-1.5 border-t border-[#38322d]">
          {[[Home, "Inicio"], [Calendar, "Turnos"], [Ticket, "Mi plan"], [Gift, "Beneficios"], [User, "Cuenta"]].map(([I, t], i) => (
            <span key={t} className={`flex flex-col items-center gap-0.5 ${i === 0 ? "text-acento" : ""}`}><I size={7} />{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Empecemos · una fila por rubro, los negocios con foto
   ------------------------------------------------------------ */
/* En oscuro, "¿Qué negocio tenés?" es la maqueta del 01/10 copiada tal
   cual. Las fotos (de cada negocio, del fondo de cada rubro y de los
   costados) son recortes de la maqueta; los textos, los filtros y las
   tarjetas son de verdad, porque llevan al alta. El claro sigue con la
   de antes. */
function Empecemos(props) {
  if (useOscuro()) return <EmpecemosNoche {...props} />;
  return <EmpecemosClaro {...props} />;
}

/* Las fotos recortadas de la maqueta, por negocio. Uno que la maqueta no
   tiene (Casa de sanitarios) usa la de Unsplash de siempre. */
const FOTOS_NOCHE = new Set(["almacen", "minimercado", "kiosco", "dietetica", "verduleria", "panaderia", "ferreteria", "bar", "cafe", "restaurante",
  "cerveceria", "rotiseria", "take-away", "estetica", "peluqueria", "barberia", "pilates", "gimnasio", "consultorio", "spa"]);
const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const fotoNoche = (nombre) => (FOTOS_NOCHE.has(slug(nombre)) ? `/landing/empecemos/${slug(nombre)}.jpg` : foto(nombre));
const PANEL_NOCHE = { minimercado: "comercio", gastronomia: "gastronomia", servicios: "servicios" };
const PILDORA_NOCHE = { todos: LayoutGrid, minimercado: Store, gastronomia: UtensilsCrossed, servicios: CalendarDays };

function EmpecemosNoche({ rubros, onElegir }) {
  const [filtro, setFiltro] = useState("todos");
  const visibles = rubros.filter((r) => filtro === "todos" || r.clave === filtro);
  return (
    <section id="empecemos" className="en-seccion scroll-mt-20 relative overflow-hidden">
      <img src="/landing/empecemos/costado-izquierdo.jpg" alt="" aria-hidden="true" className="en-costado en-costado-izq" />
      <img src="/landing/empecemos/costado-derecho.jpg" alt="" aria-hidden="true" className="en-costado en-costado-der" />
      <div className="en-contenido relative">
        <div className="en-cabeza">
          <div>
            <div className="hn-rotulo">Empecemos <span className="hn-raya en-raya-larga" aria-hidden="true" /></div>
            <h2 className="en-titulo">¿Qué <span className="hn-naranja">negocio</span> tenés?</h2>
            <p className="en-bajada">Elegí el tuyo y armamos Genez con los módulos que necesitás.</p>
          </div>
          <div className="manuscrita en-nota" aria-hidden="true">
            Seleccioná tu rubro<br />y visualizá tu sistema
            <Flecha className="en-nota-flecha" />
          </div>
        </div>

        <div className="en-pildoras">
          {[{ clave: "todos", nombre: "Todos" }, ...rubros].map((r) => {
            const I = PILDORA_NOCHE[r.clave] || Store;
            return (
              <button key={r.clave} type="button" onClick={() => setFiltro(r.clave)} className={`en-pildora ${filtro === r.clave ? "en-pildora-activa" : ""}`}>
                <I className="en-pildora-icono" strokeWidth={1.75} /> {r.nombre}
              </button>
            );
          })}
        </div>

        <div className="en-filas">
          {visibles.map((r) => <FilaNoche key={r.clave} rubro={r} onElegir={onElegir} />)}
        </div>

        <p className="en-pie">
          <MessageCircle className="en-pie-icono" strokeWidth={1.5} aria-hidden="true" />
          ¿No ves el tuyo?{" "}
          <button type="button" onClick={() => onElegir("otro", "Otro negocio")} disabled={!ALTA_ABIERTA} className="en-pie-enlace">
            Contanos qué hacés <ArrowRight className="en-flechita" strokeWidth={2.25} />
          </button>
        </p>
      </div>
    </section>
  );
}

function FilaNoche({ rubro, onElegir }) {
  const p = rubro.presentacion;
  const Icono = ICONOS[p.icono] || Store;
  const negocios = p.negocios || [p.titulo];
  const panel = PANEL_NOCHE[rubro.clave];
  return (
    <div className="en-fila">
      <div className="en-panel">
        {panel && <img src={`/landing/empecemos/panel-${panel}.jpg`} alt="" aria-hidden="true" className="en-panel-foto" />}
        <div className="relative">
          <span className="en-circulo"><Icono className="en-circulo-icono" strokeWidth={2} /></span>
          <div className="en-panel-nombre">{rubro.nombre}</div>
          <div className="en-panel-frase">{FRASE_RUBRO[rubro.clave] || p.bajada}</div>
          <button type="button" onClick={() => onElegir(rubro.clave, null)} disabled={!ALTA_ABIERTA} className="en-elegir">
            Elegir este rubro <ArrowRight className="en-flechita" strokeWidth={2.25} />
          </button>
        </div>
      </div>
      <div className="en-negocios fila-negocios">
        {negocios.map((n) => (
          <button key={n} type="button" onClick={() => onElegir(rubro.clave, n)} disabled={!ALTA_ABIERTA} className="en-tarjeta">
            <span className="en-tarjeta-foto">{fotoNoche(n) ? <img src={fotoNoche(n)} alt="" loading="lazy" /> : <Icono size={22} />}</span>
            <span className="en-tarjeta-nombre"><Icono className="en-tarjeta-icono" strokeWidth={2} />{n}</span>
            <span className="en-tarjeta-ir"><ArrowRight strokeWidth={2.25} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmpecemosClaro({ rubros, onElegir }) {
  const [filtro, setFiltro] = useState("todos");
  const visibles = rubros.filter((r) => filtro === "todos" || r.clave === filtro);

  return (
    <section id="empecemos" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className={ROTULO_ACENTO}>Empecemos</div>
          <h2 className="f-d text-4xl sm:text-5xl leading-tight mt-3">¿Qué <span className="text-acento">negocio</span> tenés?</h2>
          <p className="text-texto-suave mt-3 text-[17px]">Elegí el tuyo y armamos Genez con los módulos que necesitás.</p>
        </div>
        <div className="flex items-end gap-5">
          <div className="manuscrita hidden md:block text-[18px] leading-[1.05] text-texto-suave -rotate-6 text-right">
            Seleccioná tu rubro<br />y visualizá tu sistema
            <Flecha className="w-10 ml-auto mt-1" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[{ clave: "todos", nombre: "Todos" }, ...rubros].map((r) => (
              <button key={r.clave} type="button" onClick={() => setFiltro(r.clave)}
                className={`text-sm font-semibold rounded-full border px-4 py-2 transition-colors ${
                  filtro === r.clave ? "pildora-activa" : "border-borde-fuerte bg-superficie text-texto-suave hover:text-texto"}`}>
                {r.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {visibles.map((r) => <FilaRubro key={r.clave} rubro={r} onElegir={onElegir} />)}
      </div>

      <p className="text-sm text-texto-tenue mt-5">
        ¿No ves el tuyo?{" "}
        <button type="button" onClick={() => onElegir("otro", "Otro negocio")} disabled={!ALTA_ABIERTA} className="text-acento font-semibold hover:text-acento-vivo">
          Contanos qué hacés →
        </button>
      </p>
    </section>
  );
}

function FilaRubro({ rubro, onElegir }) {
  const p = rubro.presentacion;
  const Icono = ICONOS[p.icono] || Store;
  const negocios = p.negocios || [p.titulo];
  return (
    <div className="bg-superficie border border-borde rounded-xl p-3 sm:p-4 grid md:grid-cols-[190px_minmax(0,1fr)] gap-4 items-center">
      <div className="flex md:block items-center gap-3 md:pl-1">
        <span className="w-11 h-11 rounded-full bg-acento text-sobre-acento flex items-center justify-center shrink-0"><Icono size={20} /></span>
        <div className="md:mt-3 min-w-0">
          <div className="font-bold text-[17px] leading-tight">{rubro.nombre}</div>
          <div className="text-[13px] text-texto-suave mt-1 leading-snug">{FRASE_RUBRO[rubro.clave] || p.bajada}</div>
          <button type="button" onClick={() => onElegir(rubro.clave, null)} disabled={!ALTA_ABIERTA}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-acento border border-acento/60 rounded-md px-3 py-1.5 hover:bg-acento-suave/40 disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent">
            Elegir este rubro <ArrowRight size={13} />
          </button>
        </div>
      </div>

      <div className="fila-negocios flex gap-3 overflow-x-auto pb-1">
        {negocios.map((n) => <TarjetaNegocio key={n} nombre={n} rubro={rubro} onElegir={() => onElegir(rubro.clave, n)} />)}
      </div>
    </div>
  );
}

function TarjetaNegocio({ nombre, rubro, onElegir }) {
  const Icono = ICONOS[rubro.presentacion.icono] || Store;
  const src = foto(nombre);
  return (
    <button type="button" onClick={onElegir} disabled={!ALTA_ABIERTA}
      className="shrink-0 w-[124px] text-left bg-superficie border border-borde rounded-xl p-2 hover:border-acento transition-colors disabled:opacity-60 disabled:cursor-default disabled:hover:border-borde">
      <div className="h-[66px] rounded-lg overflow-hidden bg-superficie-2 flex items-center justify-center text-texto-tenue">
        {src ? <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Icono size={22} />}
      </div>
      <div className="mt-2 flex items-start gap-1.5 text-[13px] font-semibold leading-tight min-h-[32px]">
        <Icono size={12} className="text-acento shrink-0 mt-[2px]" /><span>{nombre}</span>
      </div>
      <ArrowRight size={14} className="text-acento mt-0.5" />
    </button>
  );
}

/* ------------------------------------------------------------
   Qué resuelve · el ticket en claro, el papel de preguntas en oscuro
   ------------------------------------------------------------ */
/* En oscuro, "Qué resuelve" es la maqueta del 01/10 copiada tal cual: la
   tablet con el papel "Sin Genez" y la luz de la derecha (con el "Simple.
   Rápido. Sin vueltas." escrito a mano) son recortes de la maqueta; el
   texto, el botón y la lista van en HTML. El claro sigue con la de antes. */
function QueResuelve() {
  if (useOscuro()) return <QueResuelveNoche />;
  return <QueResuelveClaro />;
}

const PUNTOS_NOCHE = [
  [Package, <>Controlá tu stock en<br />tiempo real</>],
  [BarChart3, <>Sabé qué productos<br />dan más ganancia</>],
  [Bell, <>Evitá faltantes<br />y vencimientos</>],
  [Coins, <>Tené tus números<br />siempre claros</>],
  [Smartphone, <>Todo desde el celu,<br />la compu o la tablet.</>],
];
const DATOS_RESUELVE = [
  [Timer, <>Implementación<br />rápida</>],
  [Monitor, <>Funciona en celu,<br />compu y tablet</>],
  [Settings, <>Sin vueltas<br />ni configuraciones complejas</>],
];

function QueResuelveNoche() {
  return (
    <section id="resuelve" className="qr-seccion scroll-mt-20 relative overflow-hidden">
      <div className="qr-lienzo">
        <div className="qr-texto">
          <div className="hn-rotulo">Qué resuelve <span className="hn-raya" aria-hidden="true" /></div>
          <h2 className="qr-titulo">Si vendés todos los<br />días, <span className="hn-naranja">cada uno<br />cuesta plata.</span></h2>
          {/* Los cortes de renglón son los de la maqueta; en el teléfono no van. */}
          <p className="qr-parrafo">
            Llevar el negocio a mano hace que se te escape el stock,<br className="qr-br" /> que no sepas qué te deja más ganancia y que a fin de mes<br className="qr-br" />{" "}
            la caja no cierre. Genez ordena ventas, stock, compras y<br className="qr-br" /> caja en un solo lugar, y te lo muestra en números, sin que<br className="qr-br" />{" "}
            tengas que entender de computación.
          </p>
          <a href="#como-funciona" className="hn-boton qr-boton">Conocé cómo funciona <ArrowRight className="hn-flecha" strokeWidth={2.25} /></a>
          <ul className="qr-datos">
            {DATOS_RESUELVE.map(([I, t], i) => (
              <li key={i}><span className="qr-dato-icono"><I strokeWidth={1.75} /></span><span>{t}</span></li>
            ))}
          </ul>
        </div>
        <img src="/landing/resuelve/centro.jpg" width="745" height="803" className="qr-centro"
          alt="El inicio de Genez en una tablet, y al lado un papel &quot;Sin Genez&quot; lleno de signos de pregunta" />
        <img src="/landing/resuelve/derecha-arriba.jpg" width="418" height="215" className="qr-derecha" alt="" aria-hidden="true" />
        <ul className="qr-panel">
          {PUNTOS_NOCHE.map(([I, t], i) => (
            <li key={i}><span className="qr-panel-icono"><I strokeWidth={2} /></span><span>{t}</span></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function QueResuelveClaro() {
  const puntos = [
    [Boxes, "Controlá tu stock en tiempo real"],
    [TrendingUp, "Sabé qué productos dan más ganancia"],
    [Bell, "Evitá faltantes y vencimientos"],
    [BarChart3, "Tené tus números siempre claros"],
    [Smartphone, "Todo desde el celu, la compu o la tablet."],
  ];
  return (
    <section id="resuelve" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
      <div>
        <div className={ROTULO_ACENTO}>Qué resuelve</div>
        <h2 className="f-d text-4xl sm:text-5xl leading-[1.05] mt-3">
          Si vendés todos los días, <span className="text-acento">cada uno cuesta plata.</span>
        </h2>
        <p className="text-texto-suave mt-4 text-[17px] leading-relaxed">
          Llevar el negocio a mano hace que se te escape el stock, que no sepas qué te deja más ganancia y que a fin de mes la caja no
          cierre. Genez ordena ventas, stock, compras y caja en un solo lugar, y te lo muestra en números, sin que tengas que entender
          de computación.
        </p>
        <a href="#como-funciona" className={`${SOLIDO} mt-7`}>Conocé cómo funciona <ArrowRight size={16} /></a>
      </div>

      <div className="grid sm:grid-cols-[1fr_1.05fr] gap-8 items-center pt-12">
        <div>
          <div className="solo-claro"><TicketGenez /></div>
          <div className="solo-oscuro"><PapelSinGenez /></div>
        </div>
        <div className="relative">
          <div className="manuscrita hidden sm:block absolute -top-16 right-2 text-[18px] leading-[1.05] text-texto-suave -rotate-3 text-right">
            Simple.<br />Rápido.<br />Sin vueltas.
            <Flecha className="w-10 ml-auto -mt-1 -scale-x-100" />
          </div>
          <ul className="bg-superficie border border-borde rounded-xl p-5 space-y-3.5">
            {puntos.map(([I, t]) => (
              <li key={t} className="flex items-center gap-3 text-[15px] font-medium">
                <span className="w-8 h-8 rounded-md bg-acento-suave text-acento flex items-center justify-center shrink-0"><I size={16} /></span>{t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function TicketGenez() {
  const lineas = [["Leche entera 1 L", "$ 1.450"], ["Pan lactal", "$ 2.900"], ["Queso cremoso 0,350 kg", "$ 3.640"], ["Café molido 250 g", "$ 4.200"]];
  return (
    <div className="ticket rounded-t-lg p-5 -rotate-3 max-w-[290px] mx-auto">
      <div className="flex justify-center"><LogoGenez size={22} conNombre /></div>
      <ul className="mt-4 space-y-2 text-[13px]">
        {lineas.map(([n, p]) => <li key={n} className="flex justify-between gap-3"><span>{n}</span><span className="f-m">{p}</span></li>)}
      </ul>
      <div className="mt-3 pt-3 border-t border-dashed border-[#d6d3d1] flex justify-between font-bold text-[15px]">
        <span>Total</span><span className="f-m">$ 12.190</span>
      </div>
      <div className="mt-4 text-center">
        <span className="manuscrita inline-block text-acento text-[18px] leading-[1.05] border-2 border-acento rounded-[50%] px-4 py-2 -rotate-3">
          Cada venta cuenta<br />(sin perder plata)
        </span>
      </div>
    </div>
  );
}

function PapelSinGenez() {
  const preguntas = ["Ventas del día", "Stock", "Cuentas por pagar", "Ganancia real", "Clientes que vuelven"];
  return (
    <div className="papel rounded-md p-5 rotate-3 max-w-[290px] mx-auto">
      <div className="text-[12px] font-bold tracking-[0.2em] text-center">SIN GENEZ</div>
      <ul className="manuscrita mt-3 space-y-2 text-[20px] leading-none">
        {preguntas.map((t) => <li key={t} className="flex justify-between border-b border-dotted border-[#a8a29e] pb-1"><span>{t}:</span><span>?</span></li>)}
      </ul>
      <div className="manuscrita text-[18px] mt-4 text-center text-[#57534e]">Demasiadas preguntas</div>
    </div>
  );
}

/* ------------------------------------------------------------
   Qué incluye · los módulos del catálogo, con el teléfono al costado
   ------------------------------------------------------------ */
/* En oscuro, "Qué incluye" es la maqueta del 01/10 copiada tal cual. El
   fondo (las rayas de luz, la ola y la tablet) es la maqueta con la zona
   del texto y de las tarjetas pintada del color del fondo; encima van el
   texto y las tarjetas en HTML, en el mismo lugar. "Ver todos los
   módulos" sigue andando: suma los demás abajo. El claro, la de antes. */
function QueIncluye() {
  if (useOscuro()) return <QueIncluyeNoche />;
  return <QueIncluyeClaro />;
}

/* Lo que dice cada tarjeta en la maqueta. Un módulo que no está acá
   (aparecen con "Ver todos") usa su descripción de siempre. */
const DESCRIPCION_NOCHE = {
  cobro: <>Punto de venta, tickets<br />y múltiples medios de pago.</>,
  caja: <>Arqueo, gastos, cierre<br />y control de efectivo.</>,
  ajustes: <>Configuración del negocio,<br />usuarios y permisos.</>,
  comandas: <>Mesas, comandas y cocina<br />en tiempo real.</>,
  productos: <>Catálogo, precios, listas<br />y variantes.</>,
  stock: <>Alertas, vencimientos<br />y movimientos.</>,
  compras: <>Remitos, costos<br />y proveedores.</>,
  pedidos: <>Preparación con pistola<br />y control de entregas.</>,
  clientes: <>Ficha, historial, promociones<br />y cuentas corrientes.</>,
  cuentas: <>Fiado: quién debe, cobros<br />y recordatorios.</>,
  equipo: <>Quién trabaja, horarios,<br />comisiones y reportes.</>,
  agenda: <>Turnos, clases y reservas<br />según tu rubro.</>,
};
const DATOS_INCLUYE = [
  [CircleCheck, <>Activás solo<br />lo que necesitás</>],
  [Settings, <>Escalás cuando<br />tu negocio crece</>],
  [BarChart3, <>Todo integrado<br />en un solo lugar</>],
];

function TarjetaModuloNoche({ m, activa }) {
  const I = ICONO_MODULO[m.k] || LayoutGrid;
  return (
    <li className={`qi-tarjeta ${activa ? "qi-tarjeta-activa" : ""}`}>
      <span className="qi-icono"><I strokeWidth={2} /></span>
      <div className="qi-cuerpo">
        <div className="qi-nombre">{m.n}{m.base && <span className="qi-base">Base</span>}</div>
        <div className="qi-descripcion">{DESCRIPCION_NOCHE[m.k] || m.d}</div>
      </div>
      <span className="qi-ir" aria-hidden="true"><ArrowRight strokeWidth={2.25} /></span>
    </li>
  );
}

function QueIncluyeNoche() {
  const [todos, setTodos] = useState(false);
  const vistos = new Set();
  const modulos = MODULOS.filter((m) => !vistos.has(m.n) && vistos.add(m.n));
  return (
    <section id="incluye" className="qi-seccion scroll-mt-20 relative overflow-hidden">
      <div className="qi-lienzo">
        <img src="/landing/incluye/fondo.jpg" width="1958" height="803" className="qi-fondo" alt="" aria-hidden="true" />
        <div className="qi-texto">
          <div className="hn-rotulo qi-rotulo">Qué incluye <span className="qi-raya" aria-hidden="true" /></div>
          <h2 className="qi-titulo">Todo lo que un<br />comercio necesita,<br /><span className="hn-naranja">por módulos.</span></h2>
          <p className="qi-parrafo">Pagás una base que incluye cobro, caja y<br className="qr-br" /> ajustes, más cada módulo que sumes.<br className="qr-br" /> Nada más.</p>
          <button type="button" onClick={() => setTodos(!todos)} className="hn-boton qi-boton">
            {todos ? "Ver menos" : "Ver todos los módulos"} <ArrowRight className="hn-flecha" strokeWidth={2.25} />
          </button>
          <ul className="qi-datos">
            {DATOS_INCLUYE.map(([I, t], i) => <li key={i}><I className="qi-dato-icono" strokeWidth={2} aria-hidden="true" /><span>{t}</span></li>)}
          </ul>
        </div>
        <ul className="qi-grilla">
          {modulos.slice(0, 12).map((m, i) => <TarjetaModuloNoche key={m.k} m={m} activa={i === 0} />)}
        </ul>
      </div>
      {todos && (
        <div className="qi-resto-caja">
          <ul className="qi-grilla qi-resto">
            {modulos.slice(12).map((m) => <TarjetaModuloNoche key={m.k} m={m} />)}
          </ul>
        </div>
      )}
    </section>
  );
}

function QueIncluyeClaro() {
  const [todos, setTodos] = useState(false);
  /* Dos módulos se llaman "Informes" (uno mira márgenes, el otro
     ocupación). Para el que lee de afuera es uno solo: se muestra una vez. */
  const vistos = new Set();
  const modulos = MODULOS.filter((m) => !vistos.has(m.n) && vistos.add(m.n));
  const lista = todos ? modulos : modulos.slice(0, 12);

  return (
    <section id="incluye" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-10 grid lg:grid-cols-[0.62fr_1.38fr] gap-10 items-start">
      <div>
        <div className={ROTULO_ACENTO}>Qué incluye</div>
        <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-3">Todo lo que un comercio necesita, <span className="text-acento">por módulos.</span></h2>
        <p className="text-texto-suave mt-3 text-[17px] leading-relaxed">
          Pagás una base que incluye cobro, caja y ajustes, más cada módulo que sumes. Nada más.
        </p>
        <button type="button" onClick={() => setTodos(!todos)} className={`${LINEA_ACENTO} mt-6`}>
          {todos ? "Ver menos" : "Ver todos los módulos"} <ArrowRight size={15} />
        </button>
      </div>

      <div className="relative">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:pr-24">
          {lista.map((m) => {
            const I = ICONO_MODULO[m.k] || LayoutGrid;
            return (
              <li key={m.k} className="bg-superficie border border-borde rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-superficie-2 text-texto flex items-center justify-center shrink-0"><I size={17} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[14px]">{m.n}</span>
                    {m.base && <span className="text-[9px] uppercase tracking-wider font-bold text-acento bg-acento-suave rounded px-1.5 py-0.5">Base</span>}
                  </div>
                  <div className="text-[11px] text-texto-tenue mt-0.5 truncate">{m.d}</div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden lg:block absolute right-0 bottom-0 w-[150px]" aria-hidden="true">
          <TelefonoModulos />
        </div>
      </div>
    </section>
  );
}

function TelefonoModulos() {
  const barras = [30, 48, 42, 66, 58, 84, 72];
  const oscuro = useOscuro();
  return (
    <div className="relative">
      <div className="telefono">
        <div className="telefono-pantalla relative bg-fondo text-texto" style={{ aspectRatio: "9 / 16" }}>
          <div className="p-2.5">
            <div className="scale-75 origin-top-left"><LogoGenez size={16} conNombre claro={oscuro} /></div>
            <div className="mt-2 bg-superficie border border-borde rounded p-1.5">
              <div className="text-[5px] text-texto-tenue uppercase tracking-wider font-bold">Ventas de la semana</div>
              <div className="flex items-end gap-[2px] h-8 mt-1">
                {barras.map((h, i) => <div key={i} className={`flex-1 rounded-[1px] ${i === 5 ? "bg-acento" : "bg-superficie-3"}`} style={{ height: `${h}%` }} />)}
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <div className="bg-superficie border border-borde rounded p-1.5"><div className="text-[5px] text-texto-tenue uppercase font-bold">Stock bajo</div><div className="f-d text-[10px]">7</div></div>
              <div className="bg-superficie border border-borde rounded p-1.5"><div className="text-[5px] text-texto-tenue uppercase font-bold">Turnos</div><div className="f-d text-[10px]">24</div></div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -left-20 bottom-6 w-[150px] bg-superficie border border-borde rounded-xl p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]">
        <span className="w-8 h-8 rounded-md bg-acento text-sobre-acento flex items-center justify-center"><BarChart3 size={16} /></span>
        <div className="f-d text-[15px] leading-tight mt-2">Sumá módulos y hacé crecer tu negocio.</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   Cómo funciona · la banda con los tres pasos
   ------------------------------------------------------------ */
/* En oscuro es la maqueta del 01/10 copiada tal cual: el fondo (la
   tablet, el presupuesto, los números y los íconos de cada paso) es la
   maqueta con el texto pintado del color de lo que tiene atrás, y encima
   va el texto en HTML, con los cortes de renglón de la maqueta. En el
   teléfono el fondo no entra, así que los números se dibujan aparte. */
const PASOS_NOCHE = [
  { t: "Tocá tu negocio.", d: <>Con eso ya sabemos con qué arranca<br className="qr-br" /> un comercio como el tuyo.</> },
  { t: "Contanos cómo trabajás.", d: <>Cuántos puestos tenés y unas tildes:<br className="qr-br" /> stock, factura, delivery, equipo.<br className="qr-br" /> Cada una suma solo lo que hace falta.</> },
  { t: "Mirá tu presupuesto.", d: <>Base más cada módulo, con su precio.<br className="qr-br" /> Si te cierra, lo pedís y nos ponemos<br className="qr-br" /> en contacto por WhatsApp.</> },
];

function ComoFuncionaNoche({ onEmpezar }) {
  return (
    <section id="como-funciona" className="cf-seccion scroll-mt-20 relative overflow-hidden">
      <div className="cf-lienzo">
        <img src="/landing/como-funciona/fondo.jpg" width="1958" height="803" className="cf-fondo"
          alt="El inicio de Genez en una tablet y una tarjeta con el presupuesto" />
        <div className="cf-texto">
          <div className="hn-rotulo cf-rotulo">Cómo funciona <span className="cf-raya" aria-hidden="true" /></div>
          <h2 className="cf-titulo">Tres pasos y<br />sabés <span className="hn-naranja">qué pagás.</span></h2>
          <p className="cf-parrafo">Sin llamados de venta ni presupuestos por mail.<br className="qr-br" /> Lo ves vos, en el momento, y hasta ahí no te<br className="qr-br" /> pedimos tarjeta.</p>
          <button type="button" onClick={onEmpezar} disabled={!ALTA_ABIERTA} className="hn-boton cf-boton">{CTA} <ArrowRight className="hn-flecha" strokeWidth={2.25} /></button>
        </div>
        <ol className="cf-pasos">
          {PASOS_NOCHE.map((p, i) => (
            <li key={i} className={`cf-paso cf-paso-${i + 1}`}>
              <span className="cf-numero" aria-hidden="true">{i + 1}</span>
              <div>
                <div className="cf-paso-titulo">{p.t}</div>
                <div className="cf-paso-texto">{p.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ComoFunciona({ onEmpezar }) {
  if (useOscuro()) return <ComoFuncionaNoche onEmpezar={onEmpezar} />;
  return <ComoFuncionaClaro onEmpezar={onEmpezar} />;
}

function ComoFuncionaClaro({ onEmpezar }) {
  const pasos = [
    { n: "1", t: "Tocá tu negocio.", d: "Con eso ya sabemos con qué arranca un comercio como el tuyo." },
    { n: "2", t: "Contanos cómo trabajás.", d: "Cuántos puestos tenés y unas tildes: stock, factura, delivery, equipo. Cada una suma solo lo que hace falta." },
    { n: "3", t: "Mirá tu presupuesto.", d: "Base más cada módulo, con su precio. Si te cierra, lo pedís y nos ponemos en contacto por WhatsApp." },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 mt-10 sm:mt-14 banda">
      <div className="max-w-6xl mx-auto px-5 py-14 sm:py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center">
        <div>
          <div className={ROTULO_ACENTO}>Cómo funciona</div>
          <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-3">Tres pasos y sabés qué pagás.</h2>
          <p className="opacity-70 mt-4 text-[17px] leading-relaxed">
            Sin llamados de venta ni presupuestos por mail. Lo ves vos, en el momento, y hasta ahí no te pedimos tarjeta.
          </p>
          <button type="button" onClick={onEmpezar} disabled={!ALTA_ABIERTA} className={`${SOLIDO} mt-8`}>{CTA} <ArrowRight size={16} /></button>
        </div>
        <ol className="space-y-6">
          {pasos.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="w-9 h-9 rounded-full bg-acento text-sobre-acento f-d text-[15px] flex items-center justify-center shrink-0">{s.n}</span>
              <div>
                <div className="font-bold text-[17px] leading-snug">{s.t}</div>
                <div className="opacity-70 mt-1 leading-relaxed">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* Las preguntas que hace un dueño antes de tocar nada. Las respuestas
   dicen lo que el sistema hace hoy, no lo que va a hacer. `<details>`
   nativo: se abre sin JavaScript y el lector de pantalla lo entiende. */
/* En oscuro, las preguntas son la maqueta del 01/10 copiada tal cual: el
   fondo (los globos de pregunta y las curvas) es la maqueta con el texto
   y la lista pintados del color del fondo, y encima va todo en HTML. Cada
   pregunta muestra la respuesta corta de la maqueta y se abre con la
   larga de siempre. Las seis están a la vista, así que "Ver todas las
   preguntas" las abre todas. El claro sigue con la de antes. */
function Preguntas() {
  if (useOscuro()) return <PreguntasNoche />;
  return <PreguntasClaro />;
}

const PREGUNTAS = [
  [Database, "¿Cuánto cuesta?", "Planes claros y sin costos ocultos.", "Una base por mes que incluye cobro, caja y ajustes, más cada módulo que sumes. El número exacto lo ves al final de los tres pasos, antes de hablar con nadie. La puesta en marcha —cargar tu catálogo y capacitarte— se cobra una sola vez."],
  [ShoppingCart, "¿Necesito comprar equipos?", "Funciona en tus dispositivos actuales.", "Con un celular, una tablet o una computadora ya funciona. Para cobrar en mostrador conviene una impresora térmica y un lector de códigos (o la cámara del celular); para vender por peso, una balanza que imprima etiquetas. El presupuesto te dice exactamente qué te hace falta según lo que marcaste."],
  [Wifi, "¿Qué pasa si se corta internet?", "Podés seguir trabajando sin problemas.", "Seguís cobrando. La venta se guarda en el equipo y se manda sola cuando vuelve la conexión."],
  [FileText, "¿Puedo facturar?", "Sí. Emitís comprobantes de forma simple.", "Sí: el módulo Clientes emite facturas A, B y C. Necesitás tu CUIT y tu condición frente al IVA."],
  [Puzzle, "¿Y si después necesito otro módulo?", "Podés sumar módulos cuando quieras.", "Se suma cuando quieras, y también se puede sacar. Pagás por los que usás."],
  [Play, "¿Cómo empiezo?", "Te ayudamos paso a paso en la implementación.", "Tocá tu negocio, contestá unas tildes y mirá tu presupuesto. Si te cierra, lo pedís y nos ponemos en contacto con vos por WhatsApp con los pasos para arrancar."],
];
const DATOS_PREGUNTAS = [
  [MessageSquare, <>Respuesta<br />rápida</>],
  [Settings, <>Sin vueltas<br />ni tecnicismos</>],
  [CircleCheck, <>Te acompañamos<br />en todo el proceso</>],
];

function PreguntasNoche() {
  const [abiertas, setAbiertas] = useState(() => new Set());
  const todas = abiertas.size === PREGUNTAS.length;
  const alternar = (i) => setAbiertas((a) => { const n = new Set(a); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <section id="preguntas" className="pf-seccion scroll-mt-20 relative overflow-hidden">
      <img src="/landing/preguntas/fondo.jpg" width="1958" height="803" className="pf-fondo" alt="" aria-hidden="true" />
      <div className="pf-lienzo">
        <div className="pf-texto">
          <div className="hn-rotulo pf-rotulo">Preguntas frecuentes</div>
          <h2 className="pf-titulo">Lo que preguntan<br /><span className="hn-naranja">antes de empezar.</span></h2>
          <p className="pf-parrafo">Acá respondemos las dudas más comunes<br className="qr-br" /> para que tengas toda la información<br className="qr-br" /> antes de dar el primer paso.</p>
          <button type="button" onClick={() => setAbiertas(todas ? new Set() : new Set(PREGUNTAS.map((_, i) => i)))} className="hn-boton pf-boton">
            {todas ? "Cerrar las respuestas" : "Ver todas las preguntas"} <ArrowRight className="hn-flecha" strokeWidth={2.25} />
          </button>
          <ul className="pf-datos">
            {DATOS_PREGUNTAS.map(([I, t], i) => <li key={i}><span className="pf-dato-icono"><I strokeWidth={2} /></span><span>{t}</span></li>)}
          </ul>
        </div>
        <ul className="pf-lista">
          {PREGUNTAS.map(([I, q, corta, larga], i) => {
            const abierta = abiertas.has(i);
            return (
              <li key={q} className={`pf-fila ${i === 0 || abierta ? "pf-fila-activa" : ""}`}>
                <button type="button" className="pf-cabeza" onClick={() => alternar(i)} aria-expanded={abierta}>
                  <span className="pf-icono"><I strokeWidth={2} /></span>
                  <span className="pf-textos">
                    <span className="pf-pregunta">{q}</span>
                    <span className="pf-corta">{corta}</span>
                  </span>
                  {abierta ? <Minus className="pf-mas" strokeWidth={1.75} /> : <Plus className="pf-mas" strokeWidth={1.75} />}
                </button>
                {abierta && <p className="pf-larga">{larga}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function PreguntasClaro() {
  const preguntas = [
    ["¿Cuánto cuesta?", "Una base por mes que incluye cobro, caja y ajustes, más cada módulo que sumes. El número exacto lo ves al final de los tres pasos, antes de hablar con nadie. La puesta en marcha —cargar tu catálogo y capacitarte— se cobra una sola vez."],
    ["¿Necesito comprar equipos?", "Con un celular, una tablet o una computadora ya funciona. Para cobrar en mostrador conviene una impresora térmica y un lector de códigos (o la cámara del celular); para vender por peso, una balanza que imprima etiquetas. El presupuesto te dice exactamente qué te hace falta según lo que marcaste."],
    ["¿Qué pasa si se corta internet?", "Seguís cobrando. La venta se guarda en el equipo y se manda sola cuando vuelve la conexión."],
    ["¿Puedo facturar?", "Sí: el módulo Clientes emite facturas A, B y C. Necesitás tu CUIT y tu condición frente al IVA."],
    ["¿Y si después necesito otro módulo?", "Se suma cuando quieras, y también se puede sacar. Pagás por los que usás."],
    ["¿Cómo empiezo?", "Tocá tu negocio, contestá unas tildes y mirá tu presupuesto. Si te cierra, lo pedís y nos ponemos en contacto con vos por WhatsApp con los pasos para arrancar."],
  ];
  return (
    <section id="preguntas" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-16 sm:pb-20">
      <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16">
        <div>
          <div className={ROTULO_ACENTO}>Preguntas frecuentes</div>
          <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-3">Lo que preguntan antes de empezar.</h2>
        </div>
        <div className="border-t border-borde">
          {preguntas.map(([q, a]) => (
            <details key={q} className="group border-b border-borde py-4">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-semibold text-[16px]">
                {q}
                <Plus size={18} className="text-texto-tenue shrink-0 group-open:hidden" />
                <Minus size={18} className="text-texto-tenue shrink-0 hidden group-open:block" />
              </summary>
              <p className="text-texto-suave mt-3 leading-relaxed text-[15px]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* El pie de la maqueta: marca, tres datos ciertos y la acción de nuevo.
   Los números son los de verdad: cuántos negocios y rubros hay hoy. */
function Pie({ onEmpezar }) {
  const oscuro = useOscuro();
  const negocios = RUBROS_DE_FABRICA.reduce((n, r) => n + (r.presentacion.negocios || []).length, 0);
  const datos = [
    [Store, `${negocios} negocios`, `en ${RUBROS_DE_FABRICA.length} rubros, y sumando`],
    [Unlock, "Sin permanencia", "Cancelás cuando quieras"],
    [MapPin, "Hecho en Argentina", "Pensado para el mostrador de acá"],
  ];
  return (
    <footer className="border-t border-borde">
      <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-center gap-3 lg:w-[36%]">
          <span className="shrink-0"><LogoGenez size={30} conNombre claro={oscuro} /></span>
          <span className="text-xs text-texto-tenue leading-snug max-w-[200px]">Sistema de gestión para comercios, armado según tu negocio.</span>
        </div>
        <ul className="flex flex-wrap gap-x-7 gap-y-3 flex-1">
          {datos.map(([I, t, d]) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full border border-acento text-acento flex items-center justify-center shrink-0"><I size={15} /></span>
              <span><span className="block text-sm font-bold leading-tight">{t}</span><span className="block text-[11px] text-texto-tenue">{d}</span></span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={onEmpezar} disabled={!ALTA_ABIERTA} className={`${SOLIDO} shrink-0`}>{CTA} <ArrowRight size={16} /></button>
      </div>
      <div className="border-t border-borde">
        <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-texto-suave">
            <a href="#empecemos" className="hover:text-texto">Armar mi sistema</a>
            <a href="#como-funciona" className="hover:text-texto">Cómo funciona</a>
            <a href="#incluye" className="hover:text-texto">Qué incluye</a>
            <a href="#preguntas" className="hover:text-texto">Preguntas</a>
            <a href="/login" className="hover:text-texto">Entrar</a>
            <a href="/privacidad" className="hover:text-texto">Privacidad</a>
          </nav>
          <div className="text-xs text-texto-tenue">© {new Date().getFullYear()} Genez · Argentina</div>
        </div>
      </div>
    </footer>
  );
}
