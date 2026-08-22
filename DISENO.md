# Cómo tiene que verse Genez

Reglas sacadas de un sistema que el cliente considera bien hecho (el de
legajos de RRHH). No son gustos: son las decisiones concretas que hacen
que una pantalla se vea fina en vez de armada con un editor de páginas.

Cuando algo "se ve precario", casi siempre es una de estas seis.

## 1. Las líneas son finas

`1px`, en un gris apenas visible contra el fondo. Nunca 2px, nunca un
borde que compita con el contenido.

El borde separa, no decora. Si se nota antes que lo que contiene, está mal.

## 2. Las esquinas son discretas

- Botones y campos: **6px**
- Tarjetas y paneles: **9 a 12px**
- Diálogos: **10px**

Nada de `rounded-2xl` ni `rounded-3xl`. Una esquina muy redondeada lee
como aplicación de celular, no como herramienta de trabajo.

## 3. Hay aire

- Paneles: **24px** de padding
- Tarjetas: **18 a 21px**
- Botones: **12px arriba y abajo, 18px a los costados**
- Entre elementos de una lista: **10 a 12px**

Es lo que más se nota y lo primero que se pierde cuando se aprieta una
pantalla para que entre todo.

## 4. Las sombras casi no existen

Solo al pasar el mouse, y muy suave: `0 4px 14px` con un negro al 5%.
En estado normal, nada. Una tarjeta se separa del fondo por su borde y su
color, no por flotar.

## 5. El texto tiene jerarquía

Tres niveles, bien distintos entre sí:

- **Título o número**: grande y con peso. Un indicador va en 34px.
- **Cuerpo**: tamaño normal, color principal.
- **Secundario**: más chico y en gris apagado.

Los rótulos de sección van en mayúsculas, chicos, con `letter-spacing`
de 1.6px y en gris. Eso solo ya ordena una pantalla.

El interlineado del texto corrido es 1.5; el de las listas de datos, 1.8.

## 6. El color se usa poco

Un acento naranja para lo que se toca, y nada más. Los estados usan
fondos muy claros con el texto en el mismo tono oscuro —verde sobre verde
muy pálido, no verde saturado—.

Una pantalla con seis colores fuertes no se lee: se mira.

---

## Cómo se aplica acá

Los colores ya salen de variables en `src/index.css` y no hay que tocar
eso. Lo que falta ajustar es la **forma**: bordes, esquinas, padding,
sombras y escala tipográfica.

En Tailwind eso es:

| Regla | Clase |
|---|---|
| Borde fino | `border` (1px), nunca `border-2` |
| Esquina de botón | `rounded-md` |
| Esquina de tarjeta | `rounded-lg` o `rounded-xl` |
| Padding de panel | `p-6` |
| Padding de tarjeta | `p-5` |
| Sombra al pasar | `hover:shadow-sm` |
| Rótulo de sección | `text-[11px] uppercase tracking-[0.1em] text-texto-tenue font-bold` |

## Lo que no se puede resolver leyendo esto

Estas reglas evitan lo peor, pero el ajuste fino se hace mirando. Antes
de dar una pantalla por terminada hay que **sacar una captura y compararla
contra la maqueta**. Sin eso, se entrega a ciegas y se nota.
