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

        telon:        color("telon"),
        "sobre-telon": color("sobre-telon"),

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
        reserva:    color("reserva"),
        "reserva-suave": color("reserva-suave"),

        "canal-mostrador":       color("canal-mostrador"),
        "canal-mostrador-suave": color("canal-mostrador-suave"),
        "canal-retiro":          color("canal-retiro"),
        "canal-retiro-suave":    color("canal-retiro-suave"),
        "canal-reparto":         color("canal-reparto"),
        "canal-reparto-suave":   color("canal-reparto-suave"),
        "canal-pedidosya":       color("canal-pedidosya"),
        "canal-pedidosya-suave": color("canal-pedidosya-suave"),
        "canal-rappi":           color("canal-rappi"),
        "canal-rappi-suave":     color("canal-rappi-suave"),
        "canal-ubereats":        color("canal-ubereats"),
        "canal-ubereats-suave":  color("canal-ubereats-suave"),
        "canal-app":             color("canal-app"),
        "canal-app-suave":       color("canal-app-suave"),
      },
      borderColor: { DEFAULT: color("borde") },
    },
  },
  plugins: [],
};
