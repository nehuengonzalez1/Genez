import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "../index.css";

/* El tema cálido, no el oscuro de fábrica del sistema de gestión.

   Las dos aplicaciones se usan en lugares distintos: la gestión en una
   cocina de noche o una caja con la persiana baja, donde el oscuro
   descansa la vista; esta en el teléfono de alguien en el colectivo a las
   tres de la tarde, donde no. Ver la explicación larga en `index.css`.

   Va acá y no adentro del motor porque es del envase: el día que un
   comercio pueda elegir tema, va a salir de `marca.tema` y este archivo
   solo cambia de qué variable lo lee. */
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
    <div className="tema-calido min-h-screen bg-fondo text-texto">
      <App />
    </div>
  </React.StrictMode>
);
