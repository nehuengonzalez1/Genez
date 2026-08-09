# Sistema de gestión para minimercado — prototipo

Prototipo navegable de gestión comercial para un minimercado de una caja:
POS con pistola lectora, preparación de pedidos (picking), stock, compras,
caja, reportes y motor de diagnóstico. Los datos son simulados pero coherentes:
972 productos con costo, precio, stock, proveedor, vencimiento e historial de
costos, y 90 días de ventas.

## Levantarlo

Necesitás Node 18 o superior.

```bash
npm install
npm run dev
```

Abre solo en `http://localhost:5173`. La primera carga genera el catálogo en
memoria; no hay base de datos ni backend.

Para compilar la versión de producción:

```bash
npm run build
npm run preview
```

## El asistente (opcional)

Todo el sistema funciona sin conexión. Los diagnósticos de "Lo que tenés que
saber" se calculan localmente sobre los datos: no llaman a ningún modelo.

El chat del Asistente sí necesita la API de Anthropic. Para habilitarlo:

```bash
cp .env.example .env
# editá .env y poné tu clave en ANTHROPIC_API_KEY
```

La clave nunca llega al navegador: el servidor de desarrollo de Vite hace de
intermediario y la agrega del lado del servidor (ver `vite.config.js`). Si
publicás esto en algún lado, ese proxy hay que reemplazarlo por un backend real.

El modelo se configura en `index.html` (`window.__API_MODELO__`).

## Probar la pistola lectora

Un lector de códigos se comporta como un teclado: escribe muy rápido y cierra
con Enter. El sistema detecta esa ráfaga a nivel de ventana, así que se puede
disparar sin hacer clic en ningún campo. Funciona en Vender, Pedidos,
conteo de inventario y recepción de mercadería.

Sin lector físico podés simularlo:

- En **Vender**, escribí un código de barras y Enter (por ejemplo `7790001011137`).
- En **Pedidos → Preparar**, usá el buscador de abajo: hace lo mismo que un disparo.

## Cargar compras desde una foto

En Compras → Cargar compra se puede subir una foto del remito o la factura.
Los renglones se leen con el modelo y quedan en una tabla de revisión: nada se
aplica al stock, al costo ni al precio hasta que confirmes. Los renglones que
no coinciden con el catálogo aparecen marcados en amarillo para asignarlos a
mano.

Esta función necesita la API key (ver más arriba). Sin clave, el botón de la
pistola sigue funcionando igual y es el camino recomendado para el uso diario.

## Operar con el teclado

El cobro está pensado para hacerse sin mouse. F1 abre la lista completa de
atajos dentro de la aplicación. El recorrido típico es: escanear todo, Enter
con el campo de búsqueda vacío para pasar a cobrar, elegir el medio de pago
con las flechas o con las teclas 1 a 5, escribir con cuánto paga, Enter para
confirmar y Enter otra vez para la venta siguiente.

El cobro ocurre en tres ventanas: carga de productos, medio de pago y
resultado. El ticket solo se emite si se pide (tecla I para imprimir,
T para verlo en pantalla).

## Imprimir

El ticket y la comanda se componen como texto de ancho fijo, igual que lo
recibe una impresora térmica: 32 caracteres a 58 mm, 48 a 80 mm. El ancho se
elige en Ajustes. El botón Imprimir manda solo el papel, sin la interfaz.

## Estructura

```
index.html            Punto de entrada. Configura el proxy del asistente.
vite.config.js        Servidor de desarrollo y proxy hacia la API.
src/main.jsx          Montaje de React.
src/Minimercado.jsx   Toda la aplicación (datos, motor y módulos).
```

El archivo `Minimercado.jsx` está dividido en secciones numeradas: generador de
datos, helpers, motor de diagnóstico, componentes base, y después un módulo por
pantalla. Para pasar esto a producción, lo primero que hay que separar es el
generador de datos (secciones 1 y 2) de la interfaz: esas estructuras son, en
la práctica, el modelo de datos del sistema.
