/* ============================================================
   PRUEBAS GRATIS · quién se registró solo y cuándo le vence (0127)
   ============================================================

   Vive en el panel de plataforma, arriba de las solicitudes: una prueba
   es alguien que ya está usando el sistema, más cerca de pagar que quien
   pidió un presupuesto.

   Mientras dure el lanzamiento el cobro es a mano: la persona toca "Ya
   pagué", acá aparece marcado, y Activar le saca el plazo. Extender suma
   siete días desde hoy o desde el vencimiento, lo que sea más tarde.
   Suspender es `activa = false`, lo mismo que en la ficha del comercio.
   ============================================================ */

import React, { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Boton } from "../ui/Base.jsx";
import { cargarPruebas, decidirPrueba, diasDePrueba } from "../datos/autoservicio.js";

const ROTULO = "text-[11px] uppercase tracking-widest text-texto-suave font-bold";
const NOMBRE_PLAN = { start: "Start", pro: "Pro", empresa: "Empresa", medida: "A medida" };
const hoyEnBuenosAires = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const cuando = (iso) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

function estadoDe(p, hoy) {
  if (!p.activo) return { n: "Suspendida", tono: "border-mal text-mal" };
  if (!p.pruebaHasta) return { n: "Contratada", tono: "border-bien text-bien" };
  const dias = diasDePrueba(p.pruebaHasta, hoy);
  if (dias <= 0) return { n: "Vencida", tono: "border-ojo text-ojo" };
  return { n: dias === 1 ? "Último día" : `${dias} días`, tono: "border-acento text-acento" };
}

export function PruebasPanel() {
  const [lista, setLista] = useState([]);
  const [estado, setEstado] = useState("cargando");
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const leer = () => cargarPruebas()
    .then((xs) => { setLista(xs); setEstado("listo"); })
    .catch(() => setEstado("error"));

  useEffect(() => { leer(); }, []);

  const decidir = async (id, accion) => {
    setAviso(null); setOcupado(id);
    try {
      await decidirPrueba(id, accion);
      await leer();
    } catch (e) {
      setAviso(e.message || "No se pudo guardar.");
    } finally {
      setOcupado(null);
    }
  };

  const hoy = hoyEnBuenosAires();
  const pagaron = lista.filter((p) => p.pagoAvisado && p.pruebaHasta).length;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between gap-3 mb-2">
        <div>
          <h2 className={ROTULO}>Pruebas gratis</h2>
          <p className="text-sm text-texto-tenue">Los comercios que se registraron solos desde la landing.</p>
        </div>
        {pagaron > 0 && (
          <span className="text-xs font-bold rounded-md border border-acento text-acento bg-acento-suave/40 px-2 py-1">{pagaron} avisaron que pagaron</span>
        )}
      </div>

      <div className="bg-superficie-3 border border-borde-fuerte rounded-2xl divide-y divide-borde-fuerte">
        {estado === "cargando" && <p className="p-4 text-sm text-texto-suave">Cargando…</p>}
        {estado === "error" && (
          <p className="p-4 text-sm text-texto-suave">No se pudieron leer las pruebas. Si la tabla todavía no existe, hay que aplicar la migración 0127.</p>
        )}
        {estado === "listo" && lista.length === 0 && (
          <p className="p-4 text-sm text-texto-suave">Todavía no se registró nadie. Cuando alguien cree su cuenta desde la landing, aparece acá.</p>
        )}
        {aviso && <p className="p-4 text-sm text-mal">{aviso}</p>}

        {lista.map((p) => {
          const e = estadoDe(p, hoy);
          const enPrueba = p.activo && !!p.pruebaHasta;
          return (
            <div key={p.id} className={`p-4 ${!p.activo ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.comercio}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${e.tono}`}>{e.n}</span>
                    {p.pagoAvisado && p.pruebaHasta && (
                      <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border border-acento text-acento bg-acento-suave/40">Dice que pagó · {cuando(p.pagoAvisado)}</span>
                    )}
                  </div>
                  <div className="text-sm text-texto-suave mt-0.5">
                    {p.nombre} · {p.negocio || p.rubro} · Plan {NOMBRE_PLAN[p.plan] || p.plan}
                    {p.provincia ? ` · ${p.provincia}` : ""} · alta {cuando(p.alta)}
                    {p.pruebaHasta ? ` · vence ${p.pruebaHasta.split("-").reverse().join("/")}` : ""}
                  </div>
                  {p.problema && <p className="text-sm mt-2 italic text-texto-suave">“{p.problema}”</p>}
                  <div className="text-[11px] text-texto-tenue mt-1.5">
                    {p.avisoPorVencer ? `Mail de 3 días: ${cuando(p.avisoPorVencer)}` : "Mail de 3 días: no"}
                    {" · "}{p.avisoVencida ? `Mail de vencida: ${cuando(p.avisoVencida)}` : "Mail de vencida: no"}
                    {p.ejemplosBorrados ? " · borró los ejemplos" : ""}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  {p.telefono && (
                    <a href={`https://wa.me/${p.telefono}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl px-2.5 py-2 border border-borde text-texto-suave hover:text-texto hover:bg-superficie-2">
                      <MessageCircle size={14} /> Escribir por WhatsApp
                    </a>
                  )}
                  <span className="f-m text-xs text-texto-suave">{p.telefono}{p.email ? ` · ${p.email}` : ""}</span>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {enPrueba && <Boton size="sm" disabled={ocupado === p.id} onClick={() => decidir(p.id, "activar")}>Activar</Boton>}
                    {(enPrueba || (p.activo && p.pruebaHasta)) && (
                      <Boton size="sm" variant="ghost" disabled={ocupado === p.id} onClick={() => decidir(p.id, "extender")}>+7 días</Boton>
                    )}
                    {p.activo
                      ? <Boton size="sm" variant="quiet" disabled={ocupado === p.id} onClick={() => decidir(p.id, "suspender")}>Suspender</Boton>
                      : <Boton size="sm" variant="ghost" disabled={ocupado === p.id} onClick={() => decidir(p.id, "reactivar")}>Reactivar</Boton>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
