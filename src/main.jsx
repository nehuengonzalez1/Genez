import React from "react";
import ReactDOM from "react-dom/client";
import App from "./Genezapp.jsx";
import "./index.css";

/* Lo que permite instalar el sistema y volver a abrirlo sin conexión
   (public/sw-gestion.js). Solo en producción: en desarrollo guardaría
   archivos que cambian a cada rato. Y después de cargar, para no competir
   con la pantalla por la conexión. Sin él el sistema anda igual. */
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw-gestion.js").catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
