/* ============================================================
   PRUEBA · el markdown de los documentos de Founder, sin base
   ============================================================

   Lo que importa primero es que no se pueda inyectar nada: el
   convertidor no produce HTML, así que un <script> tiene que quedar
   como texto, y un link a javascript: no puede ser link.

     node scripts/probar-markdown.mjs
   ============================================================ */

import { leerMarkdown, enLinea, linkSeguro, textoPlano } from "../src/utils/markdown.js";

let fallas = 0;
const decir = (ok, texto) => { if (!ok) fallas++; console.log(`  ${ok ? "ok" : "MAL"}  ${texto}`); };
const plano = (trozos) => trozos.map((x) => (Array.isArray(x.v) ? plano(x.v) : x.v)).join("");
const tipos = (trozos) => trozos.map((x) => x.t).join(",");

console.log("\nNada se ejecuta");
const b1 = leerMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">');
decir(b1.every((b) => b.t === "parrafo" && b.v.every((x) => x.t === "texto")), "HTML queda como párrafo de texto, sin interpretar");
decir(plano(b1[0].v) === "<script>alert(1)</script>", "y se ve tal cual se escribió");
const l1 = enLinea("[clic](javascript:alert(1))");
decir(l1.every((x) => x.t === "texto") && plano(l1) === "[clic](javascript:alert(1))", "un link a javascript: queda como texto, entero");
decir(enLinea("[x](data:text/html;base64,PHNjcmlwdD4=)")[0].t === "texto", "uno a data: también");
decir(linkSeguro(" JAVASCRIPT:alert(1)") === null && linkSeguro("https://genez.com.ar") === "https://genez.com.ar" && linkSeguro("mailto:a@b.c") === "mailto:a@b.c",
  "solo http, https y mailto");
const l2 = enLinea("[**Genez**](https://genez.com.ar)");
decir(l2[0].t === "link" && l2[0].url === "https://genez.com.ar" && l2[0].v[0].t === "negrita", "un link válido, con negrita adentro");

console.log("\nLo que entiende");
const d = leerMarkdown([
  "# Título", "## Sub", "Un párrafo con **negrita**, *cursiva*, _otra_ y `código`.", "sigue el mismo párrafo", "",
  "- uno", "- [x] hecho", "- [ ] pendiente", "", "1. primero", "2. segundo", "", "> una cita", "> que sigue", "", "---", "",
  "```", "const a = '<b>';", "```", "",
  "2*3*4 no es cursiva, ni un_nombre_con_guiones",
].join("\n"));
decir(d[0].t === "titulo" && d[0].nivel === 1 && d[1].nivel === 2, "títulos de dos niveles");
decir(d[2].t === "parrafo" && tipos(d[2].v) === "texto,negrita,texto,cursiva,texto,cursiva,texto,codigo,texto", `negrita, cursiva y código en línea (${tipos(d[2].v)})`);
decir(plano(d[2].v).endsWith("sigue el mismo párrafo"), "dos líneas seguidas son un párrafo");
decir(d[3].t === "lista" && !d[3].ordenada && d[3].items.length === 3 && d[3].items[1].casilla === true && d[3].items[2].casilla === false, "lista con casillas");
decir(d[4].t === "lista" && d[4].ordenada && d[4].items.length === 2, "lista numerada");
decir(d[5].t === "cita" && plano(d[5].v) === "una cita que sigue", "una cita de dos líneas");
decir(d[6].t === "linea" && d[7].t === "codigo" && d[7].v === "const a = '<b>';", "separador y código en bloque, sin tocar");
decir(d[8].t === "parrafo" && d[8].v.every((x) => x.t === "texto"), "un asterisco entre números o un guion bajo en una palabra no son cursiva");
decir(textoPlano("# Hola\n**mundo** y `x`") === "Hola mundo y x", "el resumen en texto plano");

console.log(fallas ? `\n${fallas} MAL\n` : "\nTodo bien\n");
process.exit(fallas ? 1 : 0);
