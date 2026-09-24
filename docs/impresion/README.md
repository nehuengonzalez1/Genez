# La impresora de tickets

## La fecha, el título y la dirección que salen arriba y abajo

No los pone Genez: los agrega el navegador. Chrome y Edge tienen una
opción, **"Encabezados y pies de página"**, que imprime la fecha y el
título arriba, y la dirección de la página y el número de hoja abajo.
Ninguna página web puede apagar esa opción: es de cada computadora.

**Desde septiembre de 2026 Genez imprime los tickets como PDF**
(`src/ui/ticketPdf.js`), y a un PDF Chrome no le agrega nada. No hay que
configurar ninguna computadora. Se puede volver a la forma anterior desde
Ajustes → Comandera y pistola, si alguna impresora se lleva mal con el
PDF; solo en ese caso sirve lo de abajo.

Hay dos formas de sacarlo imprimiendo como página. **La primera es la
que conviene en una caja.**

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
