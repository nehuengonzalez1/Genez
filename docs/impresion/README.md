# La impresora de tickets

## Impresión directa: la forma recomendada

Un navegador no puede imprimir sin abrir su ventana, y a todo lo que
imprime le agrega la fecha y la dirección. La impresión directa lo
resuelve con un programa chico que se instala **una vez** en cada
computadora que imprime:

1. En esa computadora, en Genez: **Ajustes → Impresión directa → Bajar el
   instalador**, y abrirlo con doble clic. No pide permisos de
   administrador. Si Windows avisa que es un archivo descargado: **Más
   información → Ejecutar de todas formas**.
2. Volver a Ajustes, **Buscar de nuevo**, elegir la impresora térmica y
   **Imprimir prueba**.
3. La primera vez Chrome puede preguntar si genez.com.ar puede usar
   aplicaciones de esta computadora: permitirlo.

Desde ahí, Imprimir manda el ticket directo a la térmica: sin ventana,
sin encabezados y con corte de papel. Si el programa no contesta, Genez
abre la ventana de siempre y avisa.

Cómo está hecho:

- `public/impresora/genez-impresora.ps1` — PowerShell, que viene en todo
  Windows 10 y 11. Escucha solo en `127.0.0.1:9197`, contesta solo a las
  páginas de Genez (exige el encabezado `X-Genez`, que obliga a Chrome a
  preguntar antes, y responde solo a los orígenes de Genez) y le pasa los
  bytes a la impresora en crudo. No sabe qué es un ticket.
- `src/ui/escpos.js` arma el ticket en ESC/POS: los renglones de
  `armarLineas`, negrita, el QR como imagen, avance y corte. Los acentos
  se sacan, porque la tabla de caracteres de cada impresora es distinta.
- `src/ui/agenteImpresion.js` le habla al programa. La impresora elegida
  se guarda en el navegador, no en el comercio: es de cada computadora.
- Se instala en `%LOCALAPPDATA%\GenezImpresora`, con un acceso directo en
  la carpeta Inicio del usuario; deja un registro en `registro.txt`.
  `desinstalar-impresora-genez.cmd` lo saca.

Lo de abajo sirve solo para las computadoras sin impresión directa.

## La fecha, el título y la dirección que salen arriba y abajo

No los pone Genez: los agrega el navegador. Chrome y Edge tienen una
opción, **"Encabezados y pies de página"**, que imprime la fecha y el
título arriba, y la dirección de la página y el número de hoja abajo.
Ninguna página web puede apagar esa opción: es de cada computadora.

Genez puede imprimir el ticket **como PDF** (`src/ui/ticketPdf.js`), y a
un PDF Chrome no le agrega nada. Se prende en Ajustes → Comandera y
pistola. Está apagado de fábrica porque con un PDF Chrome usa el tamaño
de papel del driver de la impresora y no el de la página: si en Windows
la térmica tiene un papel más ancho que el rollo (80 mm en una de 58,
por ejemplo), el ticket sale centrado en ese papel, corrido a la
derecha, y se corta. Pasó en Super 25. Con el papel del driver en 58 mm
debería salir bien, pero eso vuelve a ser configurar cada computadora.

Imprimiendo como página, hay dos formas de sacar la fecha y la dirección.
**La primera es la que conviene en una caja.**

### 1 · Para siempre, en toda la computadora (recomendado)

`sin-encabezados.reg` apaga la opción en Chrome y en Edge para todos los
usuarios de esa computadora, y nadie la puede volver a prender desde el
diálogo de impresión por error.

1. Copiar `sin-encabezados.reg` a la computadora de la caja.
2. Doble clic → aceptar el aviso de Windows (pide permiso de
   administrador).
3. Cerrar **todas** las ventanas de Chrome y volver a abrirlo.
4. Para comprobar que tomó: entrar a `chrome://policy` y buscar
   `PrintHeaderFooter` con el valor `false`.

Chrome va a mostrar "Tu organización administra este navegador" en el
menú. Es por esto y es normal.

Para deshacerlo: borrar el valor `PrintHeaderFooter` de
`HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome` (y de
`...\Microsoft\Edge`) con el editor del registro.

### 2 · A mano, desde el diálogo de impresión

Sirve si no se puede tocar el registro. Chrome se acuerda de la elección
para las próximas impresiones, pero cualquiera puede volver a
prenderla.

1. Imprimir un ticket.
2. En el diálogo, **Más opciones** (o "Más configuración").
3. **Márgenes: Ninguno**.
4. Destildar **Encabezados y pies de página**.
5. Imprimir. Desde ahí queda así en esa computadora y ese navegador.

## Imprimir sin el diálogo (opcional)

En una caja con una sola impresora se puede evitar el diálogo entero:
Chrome imprime directo en la impresora predeterminada. Se hace con un
acceso directo aparte, con este destino:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing https://genez.com.ar
```

La impresora predeterminada de Windows tiene que ser la térmica. Con el
`.reg` aplicado, tampoco salen encabezados.
