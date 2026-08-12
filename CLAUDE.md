# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Prototipo navegable de un sistema de gestión para minimercado (POS, picking, stock,
compras, caja, informes) que corre como inquilino de una plataforma llamada **Genez**.
Todos los datos son simulados y viven en memoria: no hay base de datos ni backend
de dominio. Ver `README.md` para el recorrido funcional.

## Comandos

```bash
npm install
npm run dev       # Vite en http://localhost:5173, abre el navegador solo
npm run build
npm run preview
```

No hay tests, linter ni typechecker configurados. La única verificación disponible
es `npm run build` y probar a mano en el navegador.

Para probar a mano hay que loguearse. Los usuarios están hardcodeados en la sección 0
(`COMERCIOS_INICIALES` y `DUENO_PLATAFORMA`): `axel`/`super25` (dueño de Super 25),
`cristian`/`caja2026` (cajero, sin costos), `ana`/`esquina01` (comercio con menos
módulos contratados), `Nehuen`/`Coronado01` (panel de plataforma).

## Idioma

Todo el código está en español rioplatense: nombres de variables, funciones,
componentes, comentarios y textos de UI (`cobrar`, `productos`, `ajustes`, `movCaja`,
`permisosDe`). Mantener esa convención en cualquier código nuevo; mezclar inglés
rompe la lectura del archivo.

## Arquitectura

Casi todo el sistema es un solo archivo: `src/Minimercado.jsx` (~6.600 líneas),
dividido en secciones numeradas con banners `/* === N. TÍTULO === */`. La numeración
**no** sigue el orden del archivo (la sección 0, la plataforma Genez, está cerca del
final, después de "14. APP"), así que conviene buscar por nombre de sección o de
función, no por número.

El resto son tres archivos chicos: `src/main.jsx` (montaje), `api/anthropic.js` y
`api/mp/pagos.js` (funciones serverless de Vercel).

### Datos simulados y la fecha congelada

Las secciones 1 y 2 son, en la práctica, el modelo de datos del sistema. `generar()`
construye ~970 productos y 90 días de ventas con un PRNG determinista
(`mulberry32(20260809)`), y `const DATA = generar()` corre **al importar el módulo**:
el catálogo es idéntico en cada carga, pero se regenera al refrescar.

`HOY` es una fecha fija (`new Date(2026, 7, 9)`) y es el "hoy" de todos los cálculos
de vencimientos, cobertura y series diarias. `Date.now()` real se usa solo para cosas
del navegador (hora de tickets, sondeo de Mercado Pago, ráfagas del lector). No
mezclar los dos: usar `HOY`/`addDays`/`diasHasta` para lógica de negocio.

### Estado

`Sistema` (línea ~6224) es el contenedor de estado de un comercio: productos,
tickets, pedidos, clientes, proveedores, caja, ajustes, toasts. Todo baja por props;
no hay store ni `localStorage`. Refrescar la página pierde todo, y `App` monta
`Sistema` con `key={comercio.id}` para que cambiar de comercio resetee el estado.

`App` es la raíz de tres estados: sin sesión → `Login`; sesión de plataforma →
`PanelGenez`; sesión de comercio (o plataforma "entrando como") → `Sistema`.

### Permisos

`permisosDe(sesion)` cruza dos cosas: los módulos que el **comercio contrató**
(`comercio.modulos`) y los que el **rol** habilita (`ROLES`). Un módulo no contratado
no lo ve ni el dueño. `MODULOS_BASE` (cobro, caja, ajustes) no se puede desactivar.
Los flags finos (`verCostos`, `descuentos`, `anular`, `cerrarCaja`, `cambiarPrecios`)
viajan como `permisos` hasta los componentes. Al agregar un módulo nuevo hay que
tocar `MODULOS`, `NAV`, `TITULOS`, el `ROLES` correspondiente y el switch de `tab`
en `Sistema`.

### Lector de códigos de barras

Es un mecanismo global, no un input. `useScanner` escucha `keydown` en `window`
(fase de captura), ignora eventos con foco en INPUT/TEXTAREA/SELECT, acumula teclas
que llegan a menos de 90 ms de distancia y dispara con Enter si el buffer tiene 6+
dígitos.

Las pantallas que saben qué hacer con un código se registran con `useScanHandler`,
que apila su callback en `ScanCtx`; **gana el último montado** (un modal le gana a
la pantalla que lo abrió). Si nadie está registrado, el escaneo cae en la ficha
rápida global (`FichaRapida`), y si el código no existe abre el alta de producto.

### Modo oscuro

No hay variantes `dark:`. El tema se aplica poniendo la clase `.tema-oscuro` en un
wrapper (`App.envolver`) y remapeando con `!important` las clases de Tailwind que el
sistema realmente usa, en el bloque `<style>` embebido dentro de `Sistema`
(~línea 6407). Si se introduce un color nuevo (`bg-slate-*`, `bg-blue-50`, etc.) hay
que agregarle su remapeo ahí o queda ilegible en oscuro.

### Impresión

Ticket y comanda se componen como texto de ancho fijo: 32 caracteres a 58 mm, 48 a
80 mm (`ancho` en `ajustes`). `ticketVenta` / `comandaPicking` arman las líneas con
`armarLineas`, y `imprimirComandera` las imprime en un documento aparte dentro de un
iframe invisible con `@page { size: Nmm auto }` — no imprimir la página con CSS,
eso ya falló antes (salían dos hojas en A4).

## Integraciones

### Anthropic

El front nunca tiene la API key. Llama a `${API_BASE}/v1/messages`, donde `API_BASE`
sale de `window.__API_BASE__` (definido en `index.html`, valor `/api/anthropic`), y
el modelo de `window.__API_MODELO__`. Dos entornos, mismo path:

- dev: el proxy de `vite.config.js` reescribe a `api.anthropic.com` y agrega
  `x-api-key` desde `ANTHROPIC_API_KEY` del `.env` local (el `.env` no está en el
  repo; tampoco hay `.gitignore`, cuidado al agregar archivos).
- prod: el rewrite de `vercel.json` lleva a `api/anthropic.js`, que valida el origen,
  limita `max_tokens` a 2000 y siempre habla con `/v1/messages` (no reenvía la ruta
  pedida, a propósito).

Dos lugares consumen el modelo: el chat de `Asistente` (le pasa un `snapshot` JSON de
los KPIs) y `CargarCompra`, que manda la foto de un remito en base64 y espera JSON
estricto. Todo lo demás —incluidos los diagnósticos de "Lo que tenés que saber"— se
calcula localmente en `calcular()` + `insights()` y funciona sin conexión. Cualquier
función nueva tiene que degradar así: sin API key, el camino con pistola sigue vivo.

### Mercado Pago

`api/mp/pagos.js` consulta `/v1/payments/search` con `MP_ACCESS_TOKEN`. No hay
webhooks ni base de datos a propósito: el navegador sondea cada 6 s desde `Sistema`
pidiendo una **ventana fija de los últimos 5 minutos** (solapada, no incremental,
porque MP indexa con demora) y deduplica con el ref `vistos`. La primera vuelta se
marca como vista sin avisar. Un cobro entrante suena, se lee en voz alta y genera un
movimiento de caja. Sin token, Ajustes tiene un botón para simular un cobro.

## Convenciones

- Plata: enteros en pesos, formateada con `money()` / `nf` / `pct`. Los números en
  pantalla llevan la clase `f-m` (mono tabular); los títulos, `f-d`.
- El costo/precio se guarda por producto junto con `costoPrev`/`precioPrev`; el motor
  de diagnóstico compara contra eso para detectar subas y caída de margen.
- Los cambios sobre datos leídos con el modelo (foto de remito, planilla importada)
  nunca se aplican directo: van a una tabla de revisión y se confirman a mano.
