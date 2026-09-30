/* ============================================================
   Markdown, lo justo para los documentos de Founder
   ============================================================

   No devuelve HTML: devuelve bloques y trozos de texto que la pantalla
   convierte en elementos de React (founder/Markdown.jsx). React escapa
   todo el texto, así que un documento con <script> o con un
   onerror= muestra eso, escrito, y no lo ejecuta. Es la razón de no
   usar dangerouslySetInnerHTML ni una librería que arme HTML.

   Los links solo pueden ser http, https o mailto: un
   [clic](javascript:…) queda como texto.

   Lo que entiende: títulos (#, ##, ###), párrafos, listas con viñeta o
   numeradas, casillas (- [ ] y - [x]), citas (>), código en bloque
   (```) y en línea (`), negrita (**), cursiva (* o _), links y línea
   separadora (---). Lo demás se ve tal cual se escribió.
   ============================================================ */

export const linkSeguro = (url) => {
  const u = String(url || "").trim();
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
};

/* Los trozos de una línea: { t: "texto" | "negrita" | "cursiva" | "codigo" | "link", v, url? }.
   Negrita y cursiva pueden tener adentro otros trozos (hijos). */
export function enLinea(texto) {
  const s = String(texto || "");
  const out = [];
  let resto = s;
  const patrones = [
    ["codigo", /`([^`]+)`/],
    ["link", /\[([^\]]+)\]\(([^)\s]+)\)/],
    ["negrita", /\*\*([^*]+(?:\*(?!\*)[^*]*)*)\*\*/],
    ["cursiva", /(?:^|[^\w*])\*([^*\s][^*]*)\*(?!\*)|(?:^|[^\w])_([^_\s][^_]*)_(?!\w)/],
  ];
  while (resto) {
    let mejor = null;
    for (const [t, re] of patrones) {
      const m = re.exec(resto);
      if (m && (!mejor || m.index < mejor.m.index)) mejor = { t, m };
    }
    if (!mejor) { out.push({ t: "texto", v: resto }); break; }
    const { t, m } = mejor;
    /* La cursiva se engancha también del carácter de antes (para no tomar
       un asterisco en el medio de una palabra): ese carácter es texto. */
    let inicio = m.index, largo = m[0].length;
    if (t === "cursiva" && !/^[*_]/.test(m[0])) { inicio += 1; largo -= 1; }
    if (inicio > 0) out.push({ t: "texto", v: resto.slice(0, inicio) });
    if (t === "codigo") out.push({ t, v: m[1] });
    else if (t === "link") {
      const url = linkSeguro(m[2]);
      out.push(url ? { t, v: enLinea(m[1]), url } : { t: "texto", v: m[0] });
    } else out.push({ t, v: enLinea(m[1] || m[2]) });
    resto = resto.slice(inicio + largo);
  }
  return out;
}

/* Los bloques: { t: "titulo", nivel, v } | { t: "parrafo", v } | { t: "lista", ordenada, items: [{ v, casilla? }] }
   | { t: "cita", v } | { t: "codigo", v } | { t: "linea" }. v son trozos de enLinea, salvo en código. */
export function leerMarkdown(texto) {
  const lineas = String(texto || "").replace(/\r\n?/g, "\n").split("\n");
  const bloques = [];
  let parrafo = [];
  const cerrarParrafo = () => { if (parrafo.length) { bloques.push({ t: "parrafo", v: enLinea(parrafo.join(" ")) }); parrafo = []; } };

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (/^```/.test(l.trim())) {
      cerrarParrafo();
      const codigo = [];
      i++;
      while (i < lineas.length && !/^```/.test(lineas[i].trim())) codigo.push(lineas[i++]);
      bloques.push({ t: "codigo", v: codigo.join("\n") });
      continue;
    }
    if (!l.trim()) { cerrarParrafo(); continue; }
    let m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(l))) { cerrarParrafo(); bloques.push({ t: "titulo", nivel: m[1].length, v: enLinea(m[2]) }); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { cerrarParrafo(); bloques.push({ t: "linea" }); continue; }
    if ((m = /^>\s?(.*)$/.exec(l))) {
      cerrarParrafo();
      const citas = [m[1]];
      while (i + 1 < lineas.length && /^>\s?/.test(lineas[i + 1])) citas.push(lineas[++i].replace(/^>\s?/, ""));
      bloques.push({ t: "cita", v: enLinea(citas.join(" ")) });
      continue;
    }
    const item = (x) => /^\s*([-*+]|\d+[.)])\s+/.exec(x);
    if (item(l)) {
      cerrarParrafo();
      const ordenada = /\d/.test(item(l)[1]);
      const items = [];
      while (i < lineas.length && item(lineas[i]) && /\d/.test(item(lineas[i])[1]) === ordenada) {
        let v = lineas[i].replace(/^\s*([-*+]|\d+[.)])\s+/, "");
        let casilla;
        const c = /^\[([ xX])\]\s+(.*)$/.exec(v);
        if (c) { casilla = c[1] !== " "; v = c[2]; }
        items.push({ v: enLinea(v), ...(casilla !== undefined ? { casilla } : {}) });
        i++;
      }
      i--;
      bloques.push({ t: "lista", ordenada, items });
      continue;
    }
    parrafo.push(l.trim());
  }
  cerrarParrafo();
  return bloques;
}

/* Un resumen en texto plano, para la lista de documentos. */
export function textoPlano(texto, largo = 160) {
  const s = String(texto || "").replace(/```[\s\S]*?```/g, " ").replace(/<[^>]*>/g, " ").replace(/[#>*_`[\]()-]+/g, " ").replace(/\s+/g, " ").trim();
  return s.length > largo ? `${s.slice(0, largo - 1)}…` : s;
}
