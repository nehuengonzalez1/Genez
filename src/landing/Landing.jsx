/* ============================================================
   LA LANDING · el negocio se reconoce en una card
   ============================================================

   Lo primero que ve un dueño de comercio, casi siempre desde el celular.
   Tiene que convencer en una pantalla y llevar a una sola acción: tocar
   su negocio. Por eso la portada ES el configurador: arriba de todo, la
   pregunta y la grilla. Todo lo demás —qué resuelve, cómo funciona, qué
   incluye, preguntas— está para el que baja a leer, y remata en la
   misma acción.

   NEGOCIOS Y NO RUBROS
   --------------------
   Uno se reconoce en "Kiosco", no en "Comercio y minimercado". La
   grilla muestra los negocios concretos de cada rubro
   (`presentacion.negocios`) y tocar uno elige el rubro que lo contiene;
   el nombre que tocó lo acompaña hasta el WhatsApp.

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
   base no contesta, se quedan. Agregar un negocio a esta página es
   agregarlo a la lista de su rubro.

   NO HAY RUTAS
   ------------
   Igual que en la app del cliente: la pantalla es un estado. `?rubro=`
   (y `negocio=`) en la dirección preseleccionan, y al tocar se escriben
   en la barra para que un refresco no los pierda. Los enlaces del menú
   son anclas dentro de la misma página.
   ============================================================ */

import React, { useEffect, useState } from "react";
import {
  ShoppingCart, UtensilsCrossed, CalendarDays, Store, ArrowRight, Plus, Minus,
  ScanBarcode, Wallet, Settings, Package, Boxes, Truck, ClipboardList, FileText, Users,
  Ticket, Landmark, LayoutGrid, BarChart3, MessageCircle, Bell, ShieldCheck, Sparkles,
  Smartphone, TrendingUp, Zap, WifiOff, PackageCheck,
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
const SOLIDO = `${BOTON} bg-acento hover:bg-acento-vivo text-sobre-acento font-bold`;
const LINEA = `${BOTON} border border-borde-fuerte hover:border-texto-tenue text-texto font-semibold`;

/* El rótulo sin color, para pintarlo distinto sobre la banda oscura. */
const ROTULO_SIN_COLOR = "text-[11px] uppercase tracking-[0.1em] font-bold";
const SOMBRA_HOVER = "hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)]";

const CTA = "Armar mi sistema";

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
  const [paso, setPaso] = useState(deLaDireccion("rubro") ? "empezar" : "cards");

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
    setElegido(clave); setNegocio(nombre); escribirEnLaDireccion(clave, nombre);
    setPaso("empezar"); window.scrollTo(0, 0);
  };
  const volver = () => { setPaso("cards"); window.scrollTo(0, 0); };

  return (
    <div className="min-h-screen flex flex-col">
      <Cabecera conMenu={paso === "cards"} />

      <main className="flex-1">
        {paso === "cards" || !rubro ? (
          <Portada rubros={todos} elegido={elegido} negocio={negocio} onElegir={elegir} />
        ) : (
          <div className="max-w-5xl mx-auto px-5 pb-20">
            <Stepper key={`${rubro.clave}:${negocio || ""}`} rubro={rubro} negocio={negocio} onVolver={volver} />
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
            <a href="#resuelve" className="hover:text-texto">Qué resuelve</a>
            <a href="#como-funciona" className="hover:text-texto">Cómo funciona</a>
            <a href="#incluye" className="hover:text-texto">Qué incluye</a>
            <a href="#preguntas" className="hover:text-texto">Preguntas</a>
          </nav>
        )}

        <div className="flex items-center gap-2">
          <a href="/" className={`${LINEA} !py-2 !px-4 text-sm`}>Entrar</a>
          {conMenu && (
            <a href="#configurador" className={`${SOLIDO} !py-2 !px-4 text-sm hidden sm:inline-flex`}>{CTA}</a>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------
   La portada: el configurador arriba de todo, y después lo que se lee.
   Todo lleva de vuelta a #configurador.
   ------------------------------------------------------------ */
function Portada({ rubros, elegido, negocio, onElegir }) {
  return (
    <>
      <Configurador rubros={rubros} elegido={elegido} negocio={negocio} onElegir={onElegir} />
      <Confianza />
      <QueResuelve />
      <ComoFunciona />
      <QueIncluye />
      <Preguntas />
      <Cierre />
    </>
  );
}

function Configurador({ rubros, elegido, negocio, onElegir }) {
  const negocios = rubros.flatMap((r) => (r.presentacion.negocios || [r.presentacion.titulo]).map((n) => ({ n, rubro: r })));
  return (
    <section id="configurador" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-10 sm:pt-16 pb-12 sm:pb-16">
      <div className="max-w-3xl mx-auto text-center">
        <div className={`${ROTULO_SIN_COLOR} text-acento`}>Armá tu Genez · 3 pasos · sin tarjeta</div>
        <h1 className="f-d text-[40px] sm:text-5xl lg:text-[60px] leading-[1.05] mt-4">
          ¿Qué <span className="text-acento">negocio</span> tenés?
        </h1>
        <p className="text-texto-suave mt-4 text-[17px] sm:text-lg leading-relaxed">
          Tocá el tuyo y armamos el sistema para vos: solo los módulos que necesitás, con su precio, en tres pasos.
        </p>
        <ul className="mt-5 flex flex-wrap justify-center gap-2">
          {["Hecho en Argentina", "Precio claro antes de empezar", "Celular, tablet o computadora"].map((t) => (
            <li key={t} className="text-[11px] uppercase tracking-[0.08em] font-bold text-texto-suave bg-superficie border border-borde rounded-md px-2.5 py-1">{t}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8 sm:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {negocios.map(({ n, rubro }) => (
          <Negocio key={`${rubro.clave}:${n}`} nombre={n} rubro={rubro}
            activa={rubro.clave === elegido && (negocio === n || !negocio)} onElegir={() => onElegir(rubro.clave, n)} />
        ))}
      </div>
    </section>
  );
}

/* Una card por negocio concreto. El rubro va como rótulo chico: es lo
   que el sistema entiende, y el nombre grande es lo que la persona
   entiende. "Otro" se dibuja con borde punteado: es la salida, no una
   opción más. */
function Negocio({ nombre, rubro, activa, onElegir }) {
  const otro = rubro.clave === "otro";
  const Icono = ICONOS[rubro.presentacion.icono] || Store;
  return (
    <button type="button" onClick={onElegir} aria-pressed={activa}
      className={`text-left flex flex-col justify-between bg-superficie rounded-xl p-4 min-h-[104px] transition-all border ${SOMBRA_HOVER} ${
        activa ? "border-acento ring-1 ring-acento" : otro ? "border-dashed border-borde-fuerte hover:border-texto-tenue" : "border-borde hover:border-borde-fuerte"}`}>
      <span className={`w-8 h-8 rounded-md flex items-center justify-center ${
        activa ? "bg-acento text-sobre-acento" : otro ? "bg-superficie-2 text-texto-suave" : "bg-acento-suave text-acento"}`}>
        <Icono size={16} />
      </span>
      <span className="mt-3 block">
        <span className="block font-bold text-[15px] leading-snug">{nombre}</span>
        <span className={`block ${ROTULO} mt-1 truncate`}>{rubro.nombre}</span>
      </span>
    </button>
  );
}

/* Lo que se puede prometer porque el sistema ya lo hace. Nada de acá es
   un plan: el cobro con lector está en Cobro, la factura en Clientes,
   la venta sin internet en la cola de ventas (src/datos/cola.js). */
function Confianza() {
  const puntos = [
    { I: ScanBarcode, t: "Cobro con lector de códigos" },
    { I: FileText, t: "Factura A, B y C" },
    { I: WifiOff, t: "Seguís cobrando sin internet" },
    { I: Smartphone, t: "Celular, tablet o computadora" },
    { I: PackageCheck, t: "Arrancás con tu catálogo cargado" },
  ];
  return (
    <section className="border-y border-borde bg-superficie">
      <ul className="max-w-6xl mx-auto px-5 py-4 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-semibold text-texto-suave">
        {puntos.map(({ I, t }) => (
          <li key={t} className="inline-flex items-center gap-2"><I size={16} className="text-acento" /> {t}</li>
        ))}
      </ul>
    </section>
  );
}

function QueResuelve() {
  const puntos = [
    { I: Zap, t: "Cobrás en segundos", d: "Lector de códigos, vuelto y ticket. Sin vueltas en la cola." },
    { I: Boxes, t: "El stock baja solo al vender", d: "Alertas de faltante y vencimientos antes de que el cliente pregunte." },
    { I: Truck, t: "Compras con la foto del remito", d: "Costos y proveedores al día sin tipear la lista." },
    { I: TrendingUp, t: "Sabés qué deja plata", d: "Margen por producto y por rubro, todos los días." },
    { I: CalendarDays, t: "Turnos y una app para tus clientes", d: "Reservan solos desde el celular y reciben el aviso por WhatsApp." },
    { I: ShieldCheck, t: "Cada uno ve lo suyo", d: "Permisos por rol y registro de quién cambió qué." },
  ];
  return (
    <section id="resuelve" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <div className={ROTULO}>Qué resuelve</div>
          <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-3">Si vendés todos los días, cada vuelta cuesta plata.</h2>
          <p className="text-texto-suave mt-4 text-[17px] leading-relaxed">
            Llevar el negocio a mano hace que se te escape el stock, que no sepas qué te deja más ganancia y que a fin
            de mes la caja no cierre. Genez ordena ventas, stock, compras y caja en un solo lugar y te lo muestra en
            números, sin que tengas que entender de computación.
          </p>
        </div>
        <Escena />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
        {puntos.map(({ I, t, d }) => (
          <div key={t} className="bg-superficie border border-borde rounded-xl p-5">
            <span className="w-10 h-10 rounded-lg bg-acento-suave text-acento flex items-center justify-center"><I size={19} /></span>
            <h3 className="font-bold text-[16px] leading-snug mt-4">{t}</h3>
            <p className="text-sm text-texto-suave mt-1.5 leading-relaxed">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* El visual del producto. Son fragmentos de la interfaz —mismas
   tarjetas, mismos colores— dibujados acá, no una captura: no envejecen
   cuando cambia una pantalla y no muestran datos de nadie. Los números
   son de ejemplo y se ven como tal. */
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

/* La única banda oscura de la página, y por eso lleva el remate: los
   tres pasos y el botón. Sobre oscuro, el naranja del botón es lo único
   que se toca. */
function ComoFunciona() {
  const pasos = [
    { n: "1", t: "Tocá tu negocio.", d: "Con eso ya sabemos con qué arranca un comercio como el tuyo." },
    { n: "2", t: "Contanos cómo trabajás.", d: "Cuántos puestos tenés y unas tildes: stock, factura, delivery, equipo. Cada una suma solo lo que hace falta." },
    { n: "3", t: "Mirá tu presupuesto.", d: "Base más cada módulo, con su precio. Si te cierra, lo pedís por WhatsApp con todo ya escrito." },
  ];
  return (
    <section id="como-funciona" className="scroll-mt-20 mt-14 sm:mt-20 bg-texto text-fondo">
      <div className="max-w-6xl mx-auto px-5 py-14 sm:py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 lg:gap-16 items-center">
        <div>
          <div className={`${ROTULO_SIN_COLOR} text-fondo/60`}>Cómo funciona</div>
          <h2 className="f-d text-3xl sm:text-4xl leading-tight mt-3">Tres pasos y sabés qué pagás.</h2>
          <p className="text-fondo/70 mt-4 text-[17px] leading-relaxed">
            Sin llamados de venta ni presupuestos por mail. Lo ves vos, en el momento, y hasta ahí no te pedimos tarjeta.
          </p>
          <a href="#configurador" className={`${SOLIDO} mt-8`}>{CTA} <ArrowRight size={16} /></a>
        </div>
        <ol className="space-y-6">
          {pasos.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="w-9 h-9 rounded-full bg-acento text-sobre-acento f-d text-[15px] flex items-center justify-center shrink-0">{s.n}</span>
              <div>
                <div className="font-bold text-[17px] leading-snug">{s.t}</div>
                <div className="text-fondo/70 mt-1 leading-relaxed">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function QueIncluye() {
  /* Dos módulos se llaman "Informes" (uno mira márgenes, el otro
     ocupación). Para el que lee de afuera es uno solo: se muestra una vez. */
  const vistos = new Set();
  const modulos = MODULOS.filter((m) => !vistos.has(m.n) && vistos.add(m.n));

  return (
    <section id="incluye" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
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

/* Las preguntas que hace un dueño antes de tocar nada. Las respuestas
   dicen lo que el sistema hace hoy, no lo que va a hacer. `<details>`
   nativo: se abre sin JavaScript y el lector de pantalla lo entiende. */
function Preguntas() {
  const preguntas = [
    ["¿Cuánto cuesta?", "Una base por mes que incluye cobro, caja y ajustes, más cada módulo que sumes. El número exacto lo ves al final de los tres pasos, antes de hablar con nadie. La puesta en marcha —cargar tu catálogo y capacitarte— se cobra una sola vez."],
    ["¿Necesito comprar equipos?", "Con un celular, una tablet o una computadora ya funciona. Para cobrar en mostrador conviene una impresora térmica y un lector de códigos (o la cámara del celular); para vender por peso, una balanza que imprima etiquetas. El presupuesto te dice exactamente qué te hace falta según lo que marcaste."],
    ["¿Qué pasa si se corta internet?", "Seguís cobrando. La venta se guarda en el equipo y se manda sola cuando vuelve la conexión."],
    ["¿Puedo facturar?", "Sí: el módulo Clientes emite facturas A, B y C. Necesitás tu CUIT y tu condición frente al IVA."],
    ["¿Y si después necesito otro módulo?", "Se suma cuando quieras, y también se puede sacar. Pagás por los que usás."],
    ["¿Cómo empiezo?", "Tocá tu negocio, contestá unas tildes y mirá tu presupuesto. Si te cierra, lo mandás por WhatsApp con todo ya escrito y te contestamos con los pasos para arrancar."],
  ];
  return (
    <section id="preguntas" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
      <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-8 lg:gap-16">
        <div>
          <div className={ROTULO}>Preguntas frecuentes</div>
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

function Cierre() {
  return (
    <section className="max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-16 sm:pb-20 text-center">
      <h2 className="f-d text-3xl sm:text-4xl leading-tight">¿Listo? Tocá tu negocio.</h2>
      <p className="text-texto-suave mt-3 text-[17px]">Tres pasos, sin tarjeta, y un presupuesto que se entiende.</p>
      <a href="#configurador" className={`${SOLIDO} mt-6`}>{CTA} <ArrowRight size={16} /></a>
    </section>
  );
}

function Pie() {
  return (
    <footer className="border-t border-borde">
      <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LogoGenez size={28} conNombre />
          <span className="text-xs text-texto-tenue hidden sm:inline">Sistema de gestión para comercios, armado según tu negocio</span>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-texto-suave">
          <a href="#configurador" className="hover:text-texto">Armar mi sistema</a>
          <a href="#como-funciona" className="hover:text-texto">Cómo funciona</a>
          <a href="#incluye" className="hover:text-texto">Qué incluye</a>
          <a href="#preguntas" className="hover:text-texto">Preguntas</a>
          <a href="/" className="hover:text-texto">Entrar</a>
        </nav>
        <div className="text-xs text-texto-tenue">© {new Date().getFullYear()} Genez · Argentina</div>
      </div>
    </footer>
  );
}
