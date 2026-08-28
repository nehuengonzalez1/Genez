import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "../index.css";

/* El wrapper repite lo que hace Genezapp: el oscuro es de fábrica y el
   claro se activa con una clase. Acá todavía no hay dónde elegirlo —una
   persona que mira su turno no viene a configurar temas— así que queda el
   de fábrica y punto. */
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="min-h-screen bg-fondo text-texto">
      <App />
    </div>
  </React.StrictMode>
);
