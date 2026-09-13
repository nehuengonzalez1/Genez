import React from "react";
import ReactDOM from "react-dom/client";
import Landing from "./Landing.jsx";
import { aplicarTema } from "../cliente/tema.js";
import "../index.css";
import "./landing.css";

/* Misma escala que la app del cliente y por la misma razón: esto se lee
   en un teléfono, donde no hay un 125% de Windows que compense el rem
   de 13.5 que usa el sistema de gestión (ver src/cliente/main.jsx). */
document.documentElement.style.fontSize = "16px";

/* Claro, siempre. El sistema es oscuro porque vive en una cocina de
   noche; la landing es la cara de la marca y se lee de día, y una marca
   se muestra de una sola manera. Es la misma decisión que toma un
   comercio que fija el tema de su app (tema.js): acá la marca es Genez. */
aplicarTema({ tema: "claro" });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <div className="min-h-screen bg-fondo text-texto">
      <Landing />
    </div>
  </React.StrictMode>
);
