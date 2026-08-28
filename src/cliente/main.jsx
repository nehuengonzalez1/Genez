import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { aplicarTema } from "./tema.js";
import { marcaGuardada, slugDelDominio } from "../datos/cliente.js";
import "../index.css";

/* ------------------------------------------------------------
   La escala de esta aplicación es la del navegador

   `index.css` baja el rem a 13.5 y lo explica: casi todas las pantallas
   donde corre el sistema de gestión están al 125% de Windows, así que lo
   que en el diseño entra cómodo, en el local se ve un cuarto más grande.
   Bajarlo achica el sistema entero de una sola vez.

   Esta aplicación corre en un teléfono, donde no hay ningún 125% que
   cancele nada. Heredando ese número, todo el espaciado de Tailwind
   rendía al 84%: una tarjeta con `p-5` daba 16,9px contra los 18 a 21
   que pide DISENO.md, y el botón que `ui.jsx` documenta como "44px
   mínimo" medía 43. Medido, no deducido.

   Las pantallas igual se veían bien —por eso no saltaba— pero apretadas,
   y el aire es lo primero que se pierde y lo que más se nota.

   Va como estilo del elemento y no como regla de CSS: el rem sale del
   `html` y una regla nueva competiría con la de `index.css` por orden de
   archivos, que es una forma frágil de decidir algo así. Y va acá, en el
   envase, por lo mismo que el tema: el motor no tiene que saber a qué
   escala lo dibujan.

   Antes de que React monte, así que no hay un salto de tamaño: lo único
   que hay en pantalla hasta ese momento es el fondo.
   ------------------------------------------------------------ */
document.documentElement.style.fontSize = "16px";

/* El tema, antes de que React monte y antes de pintar nada.

   Ese día llegó: hasta acá este archivo forzaba el cálido y el comentario
   decía "el día que un comercio pueda elegir tema, va a salir de
   `marca.tema` y este archivo solo cambia de qué variable lo lee". Es
   exactamente lo que pasó, más el teléfono como tercera opción y como
   valor de fábrica.

   Se aplica con la marca que quedó guardada de la vez anterior, así el
   comercio que eligió claro u oscuro lo tiene desde el primer cuadro. La
   primera apertura no la tiene y ahí manda el teléfono, que es la
   respuesta correcta mientras no haya otra.

   Sigue acá y no adentro del motor porque el tema es del envase. Ver
   `tema.js`, que explica por qué seguir al sistema es mejor que forzar el
   claro. */
aplicarTema(marcaGuardada(slugDelDominio()));
/* El service worker se registra despues de cargar, no durante: durante
   compite por la conexion con lo que la persona vino a ver.

   Y solo si el navegador lo soporta. Sin el la app funciona igual: lo
   unico que se pierde es abrir sin conexion, que es una comodidad y no
   la funcionalidad. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* Sin registro no pasa nada: no hay nada que avisarle a nadie. */
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Sin la clase del tema: ahora vive en el <html>, así el fondo de la
        página entera acompaña y no queda una franja del otro color al
        estirar de más. */}
    <div className="min-h-screen bg-fondo text-texto">
      <App />
    </div>
  </React.StrictMode>
);
