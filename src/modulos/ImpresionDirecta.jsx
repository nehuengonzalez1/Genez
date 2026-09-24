/* ============================================================
   AJUSTES · IMPRESIÓN DIRECTA
   ============================================================

   Instalar y elegir el programa de impresión de la caja (ver
   src/ui/agenteImpresion.js). Es de cada computadora, no del comercio:
   lo que se elige acá vale para este navegador y nada más.
   ============================================================ */

import React, { useState, useEffect, useCallback } from "react";
import { Download, RefreshCw, Printer, Check } from "lucide-react";
import { estadoAgente, impresoraElegida, elegirImpresora, imprimirDirecto } from "../ui/agenteImpresion.js";
import { armarEscPos } from "../ui/escpos.js";
import { Card, Boton, armarLineas } from "../ui/Base.jsx";
import { inputCls } from "../ui/Campos.jsx";

export function ImpresionDirecta({ ajustes, toast }) {
  const [estado, setEstado] = useState(undefined);   // undefined: buscando · null: no está
  const [elegida, setElegida] = useState(impresoraElegida());
  const [probando, setProbando] = useState(false);

  const buscar = useCallback(async () => {
    setEstado(undefined);
    setEstado(await estadoAgente());
  }, []);
  useEffect(() => { buscar(); }, [buscar]);

  const elegir = (nombre) => { elegirImpresora(nombre || null); setElegida(nombre || null); };

  const probar = async () => {
    setProbando(true);
    try {
      const W = ajustes.ancho === 58 ? 32 : 48;
      const lineas = armarLineas(W, [
        { t: "c", v: String(ajustes.negocio || "GENEZ").toUpperCase() },
        { t: "c", v: "PRUEBA DE IMPRESION DIRECTA" },
        { t: "sep", c: "=" },
        { t: "lr", a: "Impresora", b: "" },
        { t: "w", v: elegida },
        { t: "lr", a: "Fecha", b: new Date().toLocaleString("es-AR") },
        { t: "sep" },
        { t: "lr", a: "IMPORTE DE PRUEBA", b: "$12.345" },
        { t: "sep", c: "=" },
        { t: "c", v: "Si esto salio completo, sin" },
        { t: "c", v: "fecha arriba ni direccion abajo," },
        { t: "c", v: "la impresion directa anda." },
      ]);
      await imprimirDirecto(elegida, armarEscPos({ lineas, mm: ajustes.ancho === 58 ? 58 : 80 }));
      toast("Prueba enviada a la impresora.");
    } catch (e) {
      toast(e.message || "No se pudo imprimir.", "mal");
    } finally {
      setProbando(false);
    }
  };

  const instalado = !!estado;
  const lista = estado ? estado.impresoras : [];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="f-d text-lg">Impresión directa</h3>
          <p className="text-sm text-texto-suave mt-1">
            El ticket sale directo a la impresora al apretar Imprimir: sin la ventana del navegador, sin la fecha ni la dirección, y con el corte de papel. Se instala una vez en cada computadora que imprime.
          </p>
        </div>
        <span className={`shrink-0 text-[10px] uppercase tracking-[0.1em] font-bold px-2 py-1 rounded border ${
          estado === undefined ? "border-borde text-texto-tenue" : instalado && elegida ? "border-bien bg-bien-suave text-bien" : instalado ? "border-ojo bg-ojo-suave text-ojo" : "border-borde text-texto-tenue"}`}>
          {estado === undefined ? "Buscando…" : instalado && elegida ? "Activa" : instalado ? "Falta elegir" : "No instalada"}
        </span>
      </div>

      {estado === null && (
        <div className="mt-4 space-y-3">
          <ol className="list-decimal pl-5 text-sm text-texto-suave space-y-1">
            <li>Bajá el instalador en la computadora de la caja y abrilo con doble clic. Si Windows avisa que es un archivo descargado, elegí <b>Más información → Ejecutar de todas formas</b>.</li>
            <li>Cuando diga "Listo", volvé acá y apretá <b>Buscar de nuevo</b>.</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <a href="/impresora/instalar-impresora-genez.cmd" download
              className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-md bg-acento text-sobre-acento hover:bg-acento-vivo">
              <Download size={15} /> Bajar el instalador
            </a>
            <Boton variant="ghost" onClick={buscar}><RefreshCw size={14} /> Buscar de nuevo</Boton>
          </div>
          <p className="text-xs text-texto-tenue">
            La primera vez, Chrome puede preguntar si genez.com.ar puede usar aplicaciones de esta computadora: hay que permitirlo.
          </p>
        </div>
      )}

      {instalado && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select value={elegida || ""} onChange={(e) => elegir(e.target.value)} className={`${inputCls} max-w-xs mt-0`}>
              <option value="">Usar la ventana del navegador</option>
              {lista.map((n) => <option key={n} value={n}>{n}{estado.predeterminada === n ? " (predeterminada)" : ""}</option>)}
            </select>
            <Boton variant="ghost" onClick={buscar}><RefreshCw size={14} /></Boton>
            {elegida && (
              <Boton onClick={probar} disabled={probando}><Printer size={15} /> {probando ? "Imprimiendo…" : "Imprimir prueba"}</Boton>
            )}
          </div>
          {elegida ? (
            <p className="text-xs text-texto-tenue flex items-center gap-1.5">
              <Check size={13} className="text-bien" /> En esta computadora, los tickets salen directo por <b>{elegida}</b>. Si el programa no contesta, se abre la ventana de siempre.
            </p>
          ) : (
            <p className="text-xs text-texto-tenue">Elegí la impresora térmica. Es solo para esta computadora.</p>
          )}
        </div>
      )}
    </Card>
  );
}
