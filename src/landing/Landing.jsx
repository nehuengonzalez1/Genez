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
  Smartphone, TrendingUp, MapPin, CreditCard, Unlock, Leaf, Home, Calendar, Gift, User, Check, Clock,
} from "lucide-react";
import { RUBROS_DE_FABRICA, cargarRubrosPublicos } from "../datos/landing.js";
import { MODULOS, MODULOS_BASE, moduloPorClave } from "../datos/modulos.js";
import { presupuestar } from "../datos/presupuesto.js";
import { cargarTarifasPublicas, TARIFAS_VACIAS } from "../datos/tarifas.js";
import { ROTULO } from "../cliente/ui.jsx";
import { LogoGenez } from "../ui/Logo.jsx";
import { estaOscuro, fijarTema } from "./tema.js";
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

/* La frase corta de cada rubro en su fila, como en la maqueta. Un rubro
   nuevo sin frase usa su bajada. */
const FRASE_RUBRO = {
  minimercado: "Para vender más y tener todo en orden.",
  gastronomia: "Para que tu cocina también rinda.",
  servicios: "Para gestionar tu tiempo y el de tus clientes.",
};

/* Una foto por negocio (identificador de Unsplash). Sin foto, el ícono. */
const FOTOS = {
  "Almacén": "photo-1583258292688-d0213dc5a3a8",
  "Minimercado": "photo-1604719312566-8912e9227c6a",
  "Kiosco": "photo-1595263431959-23ccced5e5b5",
  "Dietética": "photo-1542990253-a781e04c0082",
  "Verdulería": "photo-1550989460-0adf9ea622e2",
  "Panadería": "photo-1608198093002-ad4e005484ec",
  "Ferretería": "photo-1519520104014-df63821cb6f9",
  "Casa de sanitarios": "photo-1542855368-ca6ea825bca2",
  "Bar": "photo-1566417713940-fe7c737a9ef2",
  "Café": "photo-1533776992670-a72f4c28235e",
  "Restaurante": "photo-1414235077428-338989a2e8c0",
  "Cervecería": "photo-1567696911980-2eed69a46042",
  "Rotisería": "photo-1606728035253-49e8a23146de",
  "Take away": "photo-1616429368325-d5d7542b0ec3",
  "Estética": "photo-1540555700478-4be289fbecef",
  "Peluquería": "photo-1553521041-d168abd31de3",
  "Barbería": "photo-1585747860715-2ba37e788b70",
  "Pilates": "photo-1747239069226-55382c570116",
  "Gimnasio": "photo-1534438327276-14e5300c3a48",
  "Consultorio": "photo-1710074213379-2a9c2653046a",
  "Spa": "photo-1630595271375-5073a6c0638b",
};
const foto = (nombre) => (FOTOS[nombre] ? `https://images.unsplash.com/${FOTOS[nombre]}?auto=format&fit=crop&w=320&h=200&q=70` : null);

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

/* Lo que le complica a un comerciante, en sus palabras. Cada problema
   enciende módulos, igual que una pregunta del rubro: entra al alta
   guiada ya marcado y con su motivo ("Porque marcaste…"). No es dato de
   la base porque no depende del rubro: son los dolores de cualquiera. */
const PROBLEMAS = [
  { k: "p_stock", n: "Se me escapa el stock", modulos: ["stock"], I: Boxes },
  { k: "p_plata", n: "No sé qué me deja plata", modulos: ["reportes"], I: TrendingUp },
  { k: "p_caja", n: "La caja no me cierra", modulos: ["reportes"], I: Wallet },
  { k: "p_factura", n: "Facturar me lleva horas", modulos: ["clientes"], I: FileText },
  { k: "p_cola", n: "Tengo cola en el mostrador", modulos: ["productos"], I: Clock },
  { k: "p_remitos", n: "Cargar remitos es un infierno", modulos: ["compras"], I: Truck },
  { k: "p_turnos", n: "Pierdo turnos o se me olvidan", modulos: ["agenda", "comunicaciones"], I: CalendarDays },
  { k: "p_volver", n: "No sé quién dejó de venir", modulos: ["crm"], I: MessageCircle },
  { k: "p_equipo", n: "Cada empleado hace lo que quiere", modulos: ["permisos", "equipo"], I: Users },
  { k: "p_reservas", n: "Mis clientes no pueden reservar solos", modulos: ["agenda", "comunicaciones"], I: Smartphone },
];

/* Tres presupuestos armados por rubro: para arrancar, el recomendado y el
   completo. Son atajos: el precio sale de las mismas tarifas por módulo
   que el alta guiada, y elegir uno entra al alta con esos módulos ya
   sumados, donde se puede sacar o agregar lo que sea. Los base van
   siempre y no se listan acá. */
const PRESUPUESTOS = {
  minimercado: [
    { k: "arrancar", n: "Para arrancar", d: "Cobrás con lector y sabés qué vendiste.", modulos: ["productos", "reportes"] },
    { k: "ordenar", n: "Para ordenar el stock", d: "Stock, compras y remitos por foto.", modulos: ["productos", "stock", "compras", "reportes"], recomendado: true },
    { k: "completo", n: "Completo", d: "Factura, pedidos, permisos y asistente.", modulos: ["productos", "stock", "compras", "pedidos", "clientes", "reportes", "permisos", "asistente"] },
  ],
  gastronomia: [
    { k: "mostrador", n: "Mostrador", d: "Cobrás y sabés qué vendiste.", modulos: ["productos", "reportes"] },
    { k: "salon", n: "Salón", d: "Mesas, comandas y cocina.", modulos: ["productos", "comandas", "stock", "reportes"], recomendado: true },
    { k: "completo", n: "Completo", d: "Compras, factura y permisos.", modulos: ["productos", "comandas", "stock", "compras", "clientes", "reportes", "permisos"] },
  ],
  servicios: [
    { k: "agenda", n: "Agenda", d: "Turnos, clases y tu lista de servicios.", modulos: ["servicios", "agenda", "informes"] },
    { k: "clientes", n: "Agenda y clientes", d: "Abonos y avisos por WhatsApp.", modulos: ["servicios", "agenda", "informes", "ventas", "comunicaciones"], recomendado: true },
    { k: "completo", n: "Completo", d: "Equipo, liquidaciones y seguimiento.", modulos: ["servicios", "agenda", "informes", "ventas", "equipo", "finanzas", "crm", "comunicaciones", "clientes", "permisos"] },
  ],
};

const unicos = (xs) => Array.from(new Set(xs));
const pesos = (n) => "$" + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(n));

/* Botones de la página. No son los de la app del cliente (ocupan todo el
   ancho, para el pulgar): acá van en línea, con el aire que pide DISENO.md:
   12px arriba y abajo, 18px a los costados, esquina de 6px. */
const BOTON = "inline-flex items-center justify-center gap-2 rounded-md text-[15px] px-[18px] py-3 transition-colors";
const SOLIDO = `${BOTON} bg-acento hover:bg-acento-vivo text-sobre-acento font-bold`;
const LINEA = `${BOTON} border border-borde-fuerte hover:border-texto-tenue text-texto font-semibold`;
const LINEA_ACENTO = `${BOTON} border border-acento text-acento hover:bg-acento-suave/40 font-semibold`;

const ROTULO_ACENTO = "text-[11px] uppercase tracking-[0.14em] font-bold text-acento";

/* Si la página está en oscuro. Lo leen el logo (que tiene una versión
   por fondo) y los aparatos; cambia con el botón de la cabecera. */
const TemaCtx = createContext(false);
const useOscuro = () => useContext(TemaCtx);
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
  const [oscuro, setOscuro] = useState(estaOscuro());
  const alternarTema = () => { fijarTema(oscuro ? "claro" : "oscuro"); setOscuro(!oscuro); };

  /* Lo que se elige en la portada antes de entrar al alta guiada: los
     problemas marcados, lo que escribió, el presupuesto armado que tocó
     (sus módulos) y el filtro de rubro, compartido por dos secciones. */
  const [problemas, setProblemas] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [preset, setPreset] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [tarifas, setTarifas] = useState(null);
  const alternarProblema = (k) => setProblemas((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));

  useEffect(() => {
    let vigente = true;
    cargarRubrosPublicos()
      .then((rs) => { if (vigente && rs.length) setRubros(rs); })
      .catch(() => { /* se quedan las de fábrica, que son las mismas */ });
    cargarTarifasPublicas()
      .then((t) => { if (vigente) setTarifas(t); })
      .catch(() => { if (vigente) setTarifas(TARIFAS_VACIAS); });
    return () => { vigente = false; };
  }, []);

  const todos = [...rubros, OTRO];
  const rubro = todos.find((r) => r.clave === elegido) || null;

  /* Tocar un negocio elige y avanza en el mismo gesto: la card ya es la
     respuesta, y un "Continuar" aparte era un toque de más. */
  const elegir = (clave, nombre, modulos = []) => {
    setElegido(clave); setNegocio(nombre); setPreset(modulos); escribirEnLaDireccion(clave, nombre);
    setPaso("empezar"); window.scrollTo(0, 0);
  };
  const volver = () => { setPaso("cards"); window.scrollTo(0, 0); };

  return (
    <TemaCtx.Provider value={oscuro}>
      <div className="min-h-screen flex flex-col">
        <Cabecera conMenu={paso === "cards"} onAlternarTema={alternarTema} />

        <main className="flex-1">
          {paso === "cards" || !rubro ? (
            <Portada rubros={rubros} onElegir={elegir} filtro={filtro} onFiltro={setFiltro}
              problemas={problemas} onProblema={alternarProblema} mensaje={mensaje} onMensaje={setMensaje} tarifas={tarifas} />
          ) : (
            <div className="max-w-5xl mx-auto px-5 pb-20">
              <Stepper key={`${rubro.clave}:${negocio || ""}:${preset.join(",")}`} rubro={rubro} negocio={negocio}
                problemas={PROBLEMAS.filter((q) => problemas.includes(q.k)).map(({ k, n, modulos }) => ({ k, n, modulos, necesita: [] }))}
                sumadosIniciales={preset} mensajeInicial={mensaje} onVolver={volver} />
            </div>
          )}
        </main>

        <Pie />
      </div>
    </TemaCtx.Provider>
  );
}

/* ------------------------------------------------------------
   Cabecera · pegada arriba, con el logo de verdad y el tema

   Los comercios que ya usan el sistema entran por "Entrar". Cuando el
   sistema pase a app.genez.com.ar, ese enlace cambia y nada más.
   ------------------------------------------------------------ */
function Cabecera({ conMenu, onAlternarTema }) {
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
          <a href="/" className={`${LINEA} !py-2 !px-4 text-sm`}>Entrar</a>
          {conMenu && (
            <a href="#empecemos" className={`${SOLIDO} !py-2 !px-4 text-sm hidden sm:inline-flex`}>{CTA} <ArrowRight size={15} /></a>
          )}
        </div>
      </div>
    </header>
  );
}

function Portada({ rubros, onElegir, filtro, onFiltro, problemas, onProblema, mensaje, onMensaje, tarifas }) {
  return (
    <>
      <Hero />
      <Empecemos rubros={rubros} onElegir={onElegir} filtro={filtro} onFiltro={onFiltro} problemasMarcados={problemas.length} />
      <QueResuelve />
      <Problemas elegidos={problemas} onAlternar={onProblema} mensaje={mensaje} onMensaje={onMensaje} />
      <QueIncluye />
      <TresPresupuestos rubros={rubros} filtro={filtro} onFiltro={onFiltro} tarifas={tarifas} onElegir={onElegir} />
      <ComoFunciona />
      <Preguntas />
    </>
  );
}

/* Una flecha dibujada a mano, para las anotaciones de la maqueta. */
function Flecha({ className = "" }) {
  return (
    <svg viewBox="0 0 64 44" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5c12 24 28 32 52 26" />
      <path d="M46 24l11 7-5 9" />
    </svg>
  );
}

function Hero() {
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
        <a href="#empecemos" className={`${SOLIDO} mt-7`}>{CTA} <ArrowRight size={16} /></a>
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
function Empecemos({ rubros, onElegir, filtro, onFiltro, problemasMarcados = 0 }) {
  const visibles = rubros.filter((r) => filtro === "todos" || r.clave === filtro);

  return (
    <section id="empecemos" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className={ROTULO_ACENTO}>Empecemos</div>
          <h2 className="f-d text-4xl sm:text-5xl leading-tight mt-3">¿Qué <span className="text-acento">negocio</span> tenés?</h2>
          <p className="text-texto-suave mt-3 text-[17px]">Elegí el tuyo y armamos Genez con los módulos que necesitás.</p>
          {problemasMarcados > 0 && (
            <p className="text-sm font-semibold text-acento mt-2">
              Marcaste {problemasMarcados} {problemasMarcados === 1 ? "problema" : "problemas"}: al tocar tu negocio los tomamos en cuenta.
            </p>
          )}
        </div>
        <div className="flex items-end gap-5">
          <div className="manuscrita hidden md:block text-[18px] leading-[1.05] text-texto-suave -rotate-6 text-right">
            Seleccioná tu rubro<br />y visualizá tu sistema
            <Flecha className="w-10 ml-auto mt-1" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[{ clave: "todos", nombre: "Todos" }, ...rubros].map((r) => (
              <button key={r.clave} type="button" onClick={() => onFiltro(r.clave)}
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
        <button type="button" onClick={() => onElegir("otro", "Otro negocio")} className="text-acento font-semibold hover:text-acento-vivo">
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
          <button type="button" onClick={() => onElegir(rubro.clave, null)}
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-acento border border-acento/60 rounded-md px-3 py-1.5 hover:bg-acento-suave/40">
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
    <button type="button" onClick={onElegir}
      className="shrink-0 w-[124px] text-left bg-superficie border border-borde rounded-xl p-2 hover:border-acento transition-colors">
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
function QueResuelve() {
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
function QueIncluye() {
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
   Contanos tus problemas · el sistema desde el dolor, no desde el catálogo
   ------------------------------------------------------------ */
function Problemas({ elegidos, onAlternar, mensaje, onMensaje }) {
  const marcados = PROBLEMAS.filter((q) => elegidos.includes(q.k));
  const modulos = unicos(marcados.flatMap((q) => q.modulos)).map((k) => (moduloPorClave(k) || { n: k }).n);
  return (
    <section id="problemas" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
      <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 items-start">
        <div>
          <div className={ROTULO_ACENTO}>Contanos tus problemas</div>
          <h2 className="f-d text-4xl sm:text-5xl leading-[1.05] mt-3">¿Qué te está <span className="text-acento">complicando</span> hoy?</h2>
          <p className="text-texto-suave mt-4 text-[17px] leading-relaxed">
            Marcá lo que te pasa. Con eso armamos el sistema desde tu problema, no desde un catálogo.
          </p>
          {marcados.length > 0 && (
            <div className="mt-6 bg-superficie border border-acento rounded-xl p-4">
              <div className={ROTULO}>Con esto te proponemos</div>
              <div className="font-semibold mt-1 leading-snug">{modulos.join(" · ")}</div>
              <a href="#empecemos" className={`${SOLIDO} mt-4`}>Elegir mi negocio y ver la solución <ArrowRight size={16} /></a>
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {PROBLEMAS.map(({ k, n, I }) => {
              const activo = elegidos.includes(k);
              return (
                <button key={k} type="button" onClick={() => onAlternar(k)} aria-pressed={activo}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                    activo ? "border-acento bg-acento-suave/40 text-texto" : "border-borde-fuerte bg-superficie text-texto-suave hover:text-texto"}`}>
                  {activo ? <Check size={15} className="text-acento" /> : <I size={15} className="text-texto-tenue" />} {n}
                </button>
              );
            })}
          </div>
          <label className="block mt-5">
            <span className="text-xs font-semibold text-texto-suave">Contanos con tus palabras <span className="font-normal text-texto-tenue">(opcional)</span></span>
            <textarea value={mensaje} onChange={(e) => onMensaje(e.target.value)} rows={3}
              placeholder="Ej.: tengo dos cajas y a fin de mes nunca sé cuánto gané"
              className="mt-1 w-full border border-borde rounded-lg px-3 py-3 text-[15px] bg-superficie outline-none focus:border-acento" />
          </label>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   Tenés tres presupuestos · atajos armados por rubro
   ------------------------------------------------------------ */
function TresPresupuestos({ rubros, filtro, onFiltro, tarifas, onElegir }) {
  const conPresupuestos = rubros.filter((r) => PRESUPUESTOS[r.clave]);
  const clave = PRESUPUESTOS[filtro] ? filtro : (conPresupuestos[0] || {}).clave;
  const rubro = rubros.find((r) => r.clave === clave);
  if (!rubro) return null;
  const opciones = PRESUPUESTOS[clave];

  return (
    <section id="presupuestos" className="scroll-mt-20 max-w-6xl mx-auto px-5 pt-14 sm:pt-20 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className={ROTULO_ACENTO}>Tres presupuestos</div>
          <h2 className="f-d text-4xl sm:text-5xl leading-tight mt-3">Tenés <span className="text-acento">tres presupuestos</span> para empezar.</h2>
          <p className="text-texto-suave mt-3 text-[17px]">Todos incluyen cobro, caja y ajustes. Elegís uno, o armás el tuyo módulo por módulo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {conPresupuestos.map((r) => (
            <button key={r.clave} type="button" onClick={() => onFiltro(r.clave)}
              className={`text-sm font-semibold rounded-full border px-4 py-2 transition-colors ${
                clave === r.clave ? "pildora-activa" : "border-borde-fuerte bg-superficie text-texto-suave hover:text-texto"}`}>
              {r.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {opciones.map((o) => <TarjetaPresupuesto key={o.k} opcion={o} tarifas={tarifas} onElegir={() => onElegir(rubro.clave, null, o.modulos)} />)}
      </div>
      <p className="text-sm text-texto-tenue mt-4">El precio final sale del alta guiada, con lo que respondas. Sin tarjeta, sin compromiso.</p>
    </section>
  );
}

function TarjetaPresupuesto({ opcion, tarifas, onElegir }) {
  const modulos = unicos([...MODULOS_BASE, ...opcion.modulos]);
  const pre = presupuestar(tarifas || TARIFAS_VACIAS, modulos);
  const calculando = tarifas === null;
  return (
    <div className={`relative bg-superficie border rounded-xl p-5 sm:p-6 flex flex-col ${opcion.recomendado ? "border-acento ring-1 ring-acento" : "border-borde"}`}>
      {opcion.recomendado && (
        <span className="absolute -top-3 left-5 text-[10px] uppercase tracking-wider font-bold bg-acento text-sobre-acento rounded px-2 py-1">Recomendado</span>
      )}
      <div className="f-d text-xl">{opcion.n}</div>
      <p className="text-sm text-texto-suave mt-1">{opcion.d}</p>

      <div className="mt-4 pt-4 border-t border-borde">
        {calculando && <div className="text-texto-suave text-[15px]">Calculando…</div>}
        {!calculando && pre.mensual != null && (
          <div className="f-d f-m text-3xl">{pesos(pre.mensual)} <span className="text-sm text-texto-suave font-normal">por mes</span></div>
        )}
        {!calculando && pre.mensual == null && (
          <div className="f-d text-2xl">Precio a confirmar</div>
        )}
        <div className="text-xs text-texto-tenue mt-1">{pre.cantidad} módulos · cobro, caja y ajustes incluidos</div>
      </div>

      <ul className="mt-4 space-y-1.5 flex-1">
        {opcion.modulos.map((k) => (
          <li key={k} className="flex items-center gap-2 text-sm">
            <Check size={14} className="text-acento shrink-0" /> {(moduloPorClave(k) || { n: k }).n}
          </li>
        ))}
      </ul>

      <button type="button" onClick={onElegir} className={`${opcion.recomendado ? SOLIDO : LINEA_ACENTO} mt-5 w-full`}>
        Elegir este presupuesto <ArrowRight size={15} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------
   Cómo funciona · la banda con los tres pasos
   ------------------------------------------------------------ */
function ComoFunciona() {
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
          <a href="#empecemos" className={`${SOLIDO} mt-8`}>{CTA} <ArrowRight size={16} /></a>
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
function Preguntas() {
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
function Pie() {
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
        <a href="#empecemos" className={`${SOLIDO} shrink-0`}>{CTA} <ArrowRight size={16} /></a>
      </div>
      <div className="border-t border-borde">
        <div className="max-w-6xl mx-auto px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-texto-suave">
            <a href="#empecemos" className="hover:text-texto">Armar mi sistema</a>
            <a href="#como-funciona" className="hover:text-texto">Cómo funciona</a>
            <a href="#incluye" className="hover:text-texto">Qué incluye</a>
            <a href="#preguntas" className="hover:text-texto">Preguntas</a>
            <a href="/" className="hover:text-texto">Entrar</a>
          </nav>
          <div className="text-xs text-texto-tenue">© {new Date().getFullYear()} Genez · Argentina</div>
        </div>
      </div>
    </footer>
  );
}
