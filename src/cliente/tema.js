/* ============================================================
   EL TEMA DE LA APP DEL CLIENTE
   ============================================================

   Claro, oscuro, o lo que diga el teléfono.

   POR QUÉ NO ERA "SIEMPRE CLARO"
   -----------------------------
   Hasta acá la app forzaba el cálido, y el comentario que lo explicaba
   decía algo cierto: el sistema de gestión vive en una cocina de noche y
   esta app en un colectivo a las tres de la tarde, con sol.

   Lo que ese razonamiento no miraba es que el teléfono ya sabe la
   respuesta. Alguien que puso su teléfono en oscuro lo puso por algo
   —de noche, en la cama, porque le molesta la luz— y una app que igual
   se abre en blanco es la que encandila en la oscuridad. La misma
   persona, el mismo día, necesita las dos cosas.

   TRES ESTADOS Y NO DOS
   ---------------------
     auto     lo que diga el teléfono. Es el de fábrica.
     claro    siempre el cálido, aunque el teléfono esté en oscuro
     oscuro   siempre de noche

   Los dos fijos existen porque la app es la cara de un comercio y hay
   marcas que solo funcionan de una manera. Es una decisión del comercio y
   sale de `marca.tema`, igual que el logo y el lema.

   `calido` se acepta como sinónimo de `claro`: es el valor que tenían los
   rubros antes de que esto existiera, y un comercio que lo haya escrito a
   mano estaba pidiendo el claro.

   SE APLICA EN EL <html> Y NO EN UN DIV
   -------------------------------------
   Antes la clase vivía en un div adentro de `#root`, y `index.css` pinta
   el fondo del `html` con `--fondo`. O sea que el `html` se quedaba con el
   valor de `:root` —el oscuro de la gestión— con la app crema encima: al
   estirar la pantalla de más, abajo aparecía una franja negra.

   En el `html` las variables llegan a todo, incluido el fondo de la
   página, y eso deja de pasar.
   ============================================================ */

const CLASES = ["tema-calido", "tema-noche"];

/* Lo que el navegador de la barra de arriba tiene que pintar. Sin esto,
   la app se pone oscura y la franja del sistema sigue crema, que es peor
   que no cambiar nada: se ve como un error de dibujo. */
const BARRA = { "tema-calido": "#faf7f2", "tema-noche": "#1a1715" };

const consulta = () =>
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

/* Qué clase corresponde. `marca` puede no haber llegado todavía: hasta que
   llega manda el teléfono, que es la respuesta correcta mientras no haya
   otra. */
export function claseDeTema(marca) {
  const elegido = marca && marca.tema ? marca.tema : "auto";

  if (elegido === "oscuro") return "tema-noche";
  if (elegido === "claro" || elegido === "calido") return "tema-calido";

  const m = consulta();
  return m && m.matches ? "tema-noche" : "tema-calido";
}

export function aplicarTema(marca) {
  if (typeof document === "undefined") return;

  const clase = claseDeTema(marca);
  const raiz = document.documentElement;

  for (const c of CLASES) raiz.classList.toggle(c, c === clase);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", BARRA[clase]);
}

/* Escuchar el cambio del sistema, no solo leerlo una vez.

   Alguien que tiene el teléfono en automático por horario cruza el
   atardecer con la app abierta. Sin esto se queda en claro hasta que la
   cierre y la vuelva a abrir, que es justo el momento en que menos ganas
   tiene de que le brille la pantalla en la cara.

   Devuelve cómo dejar de escuchar. */
export function alCambiarElTema(marca, hacer) {
  const m = consulta();
  if (!m) return () => {};

  const avisar = () => hacer(claseDeTema(marca));
  m.addEventListener("change", avisar);
  return () => m.removeEventListener("change", avisar);
}
