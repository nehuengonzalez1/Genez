/* ============================================================
   GENEZ FOUNDER · mostrar markdown
   ============================================================

   Los bloques de utils/markdown.js, como elementos de React. Nada pasa
   por dangerouslySetInnerHTML: React escapa todo el texto, y los links
   ya llegan filtrados (http, https o mailto). Por eso un documento no
   puede inyectar código aunque alguien lo intente.
   ============================================================ */

import React, { useMemo } from "react";
import { leerMarkdown } from "../utils/markdown.js";

function Trozos({ v }) {
  return v.map((x, i) => {
    if (x.t === "texto") return <React.Fragment key={i}>{x.v}</React.Fragment>;
    if (x.t === "codigo") return <code key={i} className="f-m text-[0.9em] px-1 py-0.5 rounded bg-superficie-2">{x.v}</code>;
    if (x.t === "negrita") return <strong key={i}><Trozos v={x.v} /></strong>;
    if (x.t === "cursiva") return <em key={i}><Trozos v={x.v} /></em>;
    if (x.t === "link") return <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" className="text-acento underline underline-offset-2"><Trozos v={x.v} /></a>;
    return null;
  });
}

export function Markdown({ texto, className = "" }) {
  const bloques = useMemo(() => leerMarkdown(texto), [texto]);
  if (!bloques.length) return <p className="text-sm text-texto-tenue">Sin contenido.</p>;
  return (
    <div className={`space-y-3 text-sm leading-relaxed ${className}`}>
      {bloques.map((b, i) => {
        if (b.t === "titulo") {
          const T = `h${b.nivel + 1}`;
          const tam = { 1: "text-xl", 2: "text-lg", 3: "text-base" }[b.nivel];
          return <T key={i} className={`f-d ${tam} pt-1`}><Trozos v={b.v} /></T>;
        }
        if (b.t === "parrafo") return <p key={i}><Trozos v={b.v} /></p>;
        if (b.t === "cita") return <blockquote key={i} className="border-l-2 border-acento pl-3 text-texto-suave"><Trozos v={b.v} /></blockquote>;
        if (b.t === "codigo") return <pre key={i} className="f-m text-xs p-3 rounded-lg bg-superficie-2 overflow-x-auto whitespace-pre">{b.v}</pre>;
        if (b.t === "linea") return <hr key={i} className="border-borde" />;
        if (b.t === "lista") {
          const L = b.ordenada ? "ol" : "ul";
          return (
            <L key={i} className={`pl-5 space-y-1 ${b.ordenada ? "list-decimal" : b.items.some((x) => x.casilla !== undefined) ? "list-none pl-1" : "list-disc"}`}>
              {b.items.map((it, j) => (
                <li key={j} className={it.casilla !== undefined ? "flex items-start gap-2" : ""}>
                  {it.casilla !== undefined && <input type="checkbox" checked={it.casilla} readOnly className="accent-acento mt-1" aria-label={it.casilla ? "hecho" : "pendiente"} />}
                  <span className={it.casilla ? "line-through text-texto-tenue" : ""}><Trozos v={it.v} /></span>
                </li>
              ))}
            </L>
          );
        }
        return null;
      })}
    </div>
  );
}
