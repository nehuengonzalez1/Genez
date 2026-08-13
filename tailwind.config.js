/* Los colores del sistema salen de las variables de src/index.css, no de
   la paleta de Tailwind. Así una pantalla escribe `bg-superficie` y no
   `bg-stone-50 dark:bg-stone-900`: no sabe de qué color es, solo qué
   papel cumple.

   La sintaxis con <alpha-value> es lo que permite `bg-superficie/60`. */
const color = (nombre) => `rgb(var(--${nombre}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        fondo:        color("fondo"),
        superficie:   color("superficie"),
        "superficie-2": color("superficie-2"),
        "superficie-3": color("superficie-3"),

        texto:        color("texto"),
        "texto-suave": color("texto-suave"),
        "texto-tenue": color("texto-tenue"),

        borde:        color("borde"),
        "borde-fuerte": color("borde-fuerte"),

        acento:       color("acento"),
        "acento-vivo": color("acento-vivo"),
        "acento-suave": color("acento-suave"),
        "sobre-acento": color("sobre-acento"),

        bien:       color("bien"),
        "bien-suave": color("bien-suave"),
        ojo:        color("ojo"),
        "ojo-suave": color("ojo-suave"),
        mal:        color("mal"),
        "mal-suave": color("mal-suave"),
        info:       color("info"),
        "info-suave": color("info-suave"),
      },
      borderColor: { DEFAULT: color("borde") },
    },
  },
  plugins: [],
};
