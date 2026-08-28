/* ============================================================
   LAS PIEZAS DE LA APP DEL CLIENTE
   ============================================================

   Aparte de `src/ui/Base.jsx` a propósito. Aquellas están hechas para una
   pantalla de escritorio con mucha información y las manos en un teclado;
   estas para un pulgar en un colectivo.

   Lo que cambia no es el estilo: es la densidad y el tamaño de lo que se
   toca. Una tarjeta del sistema de gestión mete seis datos donde acá va
   uno, y un botón de 28px de alto que en un mouse es cómodo, en un pulgar
   es una lotería.

   Comparten los tokens de color, así que las dos aplicaciones se ven de
   la misma familia sin compartir un solo componente.
   ============================================================ */

import React from "react";
import {
  Home, CalendarDays, CreditCard, User, ShoppingBag, Star, Receipt, WifiOff, ChevronLeft,
} from "lucide-react";

export const ROTULO =
  "text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold";

/* El nombre del ícono viene de la base, no del código: el catálogo de
   módulos es dato y tiene que poder crecer sin que nadie toque esto. Lo
   que sí vive acá es la traducción a un componente, porque un ícono es
   una decisión de esta aplicación y no del modelo. */
const ICONOS = {
  casa: Home,
  calendario: CalendarDays,
  credencial: CreditCard,
  persona: User,
  bolsa: ShoppingBag,
  estrella: Star,
  billete: Receipt,
};

export function Icono({ nombre, size = 20, className = "" }) {
  const C = ICONOS[nombre] || Home;
  return <C size={size} className={className} />;
}

/* ------------------------------------------------------------
   La navegación

   Abajo y no al costado. Una barra lateral en un teléfono se come el
   ancho y queda lejos del pulgar; abajo cae donde la mano ya está.

   `seguro-abajo` deja lugar para la barra del sistema en los iPhone. Sin
   eso, el último botón queda debajo del gesto de volver al inicio y no se
   puede tocar.
   ------------------------------------------------------------ */

export function Navegacion({ modulos, actual, onIr }) {
  if (!modulos.length) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-superficie border-t border-borde seguro-abajo z-40">
      <div className="max-w-lg mx-auto flex">
        {modulos.map((m) => {
          const activo = m.k === actual;
          return (
            <button key={m.k} onClick={() => onIr(m.k)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${
                activo ? "text-acento" : "text-texto-tenue hover:text-texto-suave"
              }`}>
              <Icono nombre={m.icono} size={21} />
              <span className="text-[10px] font-semibold">{m.n}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------
   Contenedores
   ------------------------------------------------------------ */

/* El alto de la barra de abajo más su margen: sin esto, el último
   elemento de cualquier lista queda tapado y nadie lo ve. */
export function Pantalla({ titulo, onVolver, children }) {
  return (
    <div className="max-w-lg mx-auto px-5 pb-28">
      {titulo && (
        <header className="pt-6 pb-4">
          {/* Con flecha, el título se corre al lado y baja de tamaño: una
              pantalla a la que se entra desde otra no es una sección de la
              barra de abajo, y no tiene por qué pesar lo mismo. Los 44px
              son el mínimo de lo que se toca con el pulgar, en píxeles
              porque es una medida física. */}
          {onVolver ? (
            <div className="flex items-center gap-2 -ml-[11px]">
              <button type="button" onClick={onVolver} aria-label="Volver"
                className="w-[44px] h-[44px] flex items-center justify-center text-texto-suave hover:text-texto transition-colors shrink-0">
                <ChevronLeft size={22} />
              </button>
              <h1 className="f-d text-xl">{titulo}</h1>
            </div>
          ) : (
            <h1 className="f-d text-2xl">{titulo}</h1>
          )}
        </header>
      )}
      {children}
    </div>
  );
}

/* `aire` en false deja la tarjeta sin padding, para las que llevan una
   foto de borde a borde: la imagen tiene que llegar al filo y el texto de
   abajo pone el suyo. */
export function Tarjeta({ children, className = "", onClick, aire = true }) {
  const Como = onClick ? "button" : "div";
  return (
    <Como onClick={onClick}
      className={`w-full text-left bg-superficie border border-borde rounded-xl overflow-hidden ${
        aire ? "p-5" : ""} ${
        onClick ? "hover:shadow-sm transition-shadow" : ""} ${className}`}>
      {children}
    </Como>
  );
}

/* Sin título es una sección igual: agrupa y separa. Antes dibujaba el
   rótulo vacío y quedaba un renglón de aire que no decía nada. */
export function Seccion({ titulo, accion, children }) {
  return (
    <section className="mt-7 first:mt-0">
      {(titulo || accion) && (
        <div className="flex items-baseline justify-between gap-3 mb-3">
          {titulo ? <h2 className={ROTULO}>{titulo}</h2> : <span />}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------
   Botones

   Alto generoso: 44px es el mínimo que se toca sin errar. Lo que en el
   sistema de gestión sería un botón chico, acá no existe.
   ------------------------------------------------------------ */

export function Boton({ children, onClick, variante = "solido", disabled, className = "" }) {
  const estilos = {
    solido: "bg-acento hover:bg-acento-vivo text-sobre-acento font-bold",
    suave: "bg-superficie-2 hover:bg-superficie-3 text-texto font-semibold",
    linea: "border border-borde-fuerte hover:border-texto-tenue text-texto font-semibold",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full rounded-lg px-4 py-3 text-[15px] transition-colors disabled:opacity-50 ${estilos[variante]} ${className}`}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------
   Los estados

   Están acá y no en cada pantalla porque son la mitad de lo que una app
   muestra de verdad. Una lista con datos se dibuja sola; lo que se nota
   es qué dice cuando está vacía, cuando falla y cuando no hay señal.
   ------------------------------------------------------------ */

export function Cargando({ children }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-7 h-7 rounded-full border-2 border-borde-fuerte border-t-acento animate-spin" />
      {children && <p className="text-sm text-texto-suave">{children}</p>}
    </div>
  );
}

/* El vacío lleva la salida puesta. "No tenés turnos" sin un botón para
   sacar uno es una pantalla que informa y no sirve. */
export function Vacio({ icono, titulo, children, accion }) {
  return (
    <div className="text-center py-14 px-6">
      {icono && (
        <div className="w-12 h-12 rounded-xl bg-superficie-2 flex items-center justify-center mx-auto mb-4">
          <Icono nombre={icono} size={22} className="text-texto-tenue" />
        </div>
      )}
      <h3 className="text-base">{titulo}</h3>
      {children && <p className="text-sm text-texto-suave mt-1.5 leading-relaxed">{children}</p>}
      {accion && <div className="mt-6 max-w-[240px] mx-auto">{accion}</div>}
    </div>
  );
}

/* ------------------------------------------------------------
   Sin conexión

   Aparte del error común, y no es cosmético: son dos problemas distintos
   y la persona puede hacer algo con uno y nada con el otro. "No pudimos
   cargar esto" cuando lo que pasa es que se cortó el wifi manda a
   sospechar de la app; decirle que revise la conexión le da la acción.

   Se enciende con `navigator.onLine`, que el navegador ya sabe, y se
   apaga sola cuando vuelve: escuchar `online` evita que alguien quede
   mirando esta pantalla con internet andando, esperando a tocar un botón
   que no hacía falta.
   ------------------------------------------------------------ */

export function useHayConexion() {
  const [hay, setHay] = React.useState(
    typeof navigator === "undefined" || navigator.onLine !== false
  );

  React.useEffect(() => {
    const prender = () => setHay(true);
    const apagar = () => setHay(false);
    window.addEventListener("online", prender);
    window.addEventListener("offline", apagar);
    return () => {
      window.removeEventListener("online", prender);
      window.removeEventListener("offline", apagar);
    };
  }, []);

  return hay;
}

export function SinConexion({ onReintentar, onInicio }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-8">
      <div className="w-14 h-14 rounded-full bg-superficie-2 flex items-center justify-center">
        <WifiOff size={24} className="text-texto-tenue" />
      </div>
      <h1 className="f-d text-xl mt-6">Sin conexión</h1>
      <p className="text-sm text-texto-suave mt-2 leading-relaxed max-w-[280px]">
        Parece que no tenés internet. Verificá tu conexión e intentá de nuevo.
      </p>

      <div className="mt-8 w-full max-w-[280px]">
        <Boton onClick={onReintentar}>Reintentar</Boton>
      </div>
      {onInicio && (
        <button type="button" onClick={onInicio}
          className="text-[13px] text-texto-tenue hover:text-acento mt-5 transition-colors">
          Volver al inicio
        </button>
      )}
    </div>
  );
}

export function Error({ children, onReintentar }) {
  return (
    <div className="text-center py-14 px-6">
      <h3 className="text-base">No pudimos cargar esto</h3>
      <p className="text-sm text-texto-suave mt-1.5 leading-relaxed">{children}</p>
      {onReintentar && (
        <div className="mt-6 max-w-[240px] mx-auto">
          <Boton variante="linea" onClick={onReintentar}>Reintentar</Boton>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   Fechas

   Un turno de hoy o de mañana se dice con palabras: es lo que la persona
   está buscando cuando abre esto, y "mañana 9:00" se lee más rápido que
   "jueves 28 de agosto".
   ------------------------------------------------------------ */

export const hora = (d) =>
  d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });

export const diaCorto = (d) =>
  d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

export function cuando(d) {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const mismoDia = (a, b) => a.toDateString() === b.toDateString();

  if (mismoDia(d, hoy)) return `Hoy ${hora(d)}`;
  if (mismoDia(d, manana)) return `Mañana ${hora(d)}`;
  return `${d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}, ${hora(d)}`;
}

const TONO_ESTADO = {
  pendiente: "text-texto-suave border-borde bg-superficie-2",
  confirmada: "text-bien border-bien bg-bien-suave",
  cancelada: "text-mal border-mal bg-mal-suave",
  ausente: "text-ojo border-ojo bg-ojo-suave",
};

export function Estado({ estado }) {
  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${
      TONO_ESTADO[estado] || TONO_ESTADO.pendiente}`}>
      {estado}
    </span>
  );
}
