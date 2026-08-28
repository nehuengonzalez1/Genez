# Diseño · la identidad del cliente

Qué hace falta para que el cliente de un comercio —el que saca el turno, el
que tiene el abono— entre a una aplicación propia y vea lo suyo.

**Esto es un diseño, no está construido.** Se escribe antes de tocar código
porque es la decisión que más caro sale corregir después: una vez que hay
turnos y abonos colgando de una identidad, cambiarla es una migración de
datos en caliente.

Lo que sigue marca qué está **decidido**, qué está **propuesto** y qué
queda **abierto**.

---

## 1 · El punto de partida es bueno

Verificado contra la base, no supuesto. Un usuario de Auth **sin perfil**
—que es lo que va a ser un cliente— ve esto hoy:

```
empresa_actual()   NULL
es_plataforma()    false
empresas 0 · clientes 0 · reservas 0 · items 0 · operaciones 0 · perfiles 0
insert en clientes: rechazado (42501)
```

Cero filas y cero escritura. Todas las políticas actuales cuelgan de
`empresa_actual()` o de `es_plataforma()`, y las dos le dicen que no.

**Consecuencia:** sumar clientes no puede debilitar nada de lo que ya
existe. Se arranca desde cero y se abre a mano, que es el orden correcto.
Lo contrario —partir de algo que ya ve de más e ir cerrando— es como
estaba `perfiles` antes de 0048 y ya sabemos cómo terminó.

---

## 2 · La regla que no se puede romper

> **Un cliente nunca tiene una fila en `perfiles`.**

`perfiles` significa "trabaja en este comercio". `puede_ver(empresa_id)` da
verdadero para cualquiera que esté ahí, y de eso cuelga el sistema entero:
la agenda completa, la facturación, la caja.

Si un cliente llegara a tener perfil, con una sola política vería los
turnos de todos los demás. No es un permiso mal dado: es la categoría
equivocada.

**Propuesto:** que la base lo impida y no solo el código. El disparador
`cuidar_el_acceso` ya rechaza cosas parecidas; puede rechazar además crear
un perfil para un usuario que ya está enlazado como cliente. Una regla de
pantalla acá no protege nada, que es la regla 1 del proyecto.

---

## 3 · El modelo: una columna, no una tabla

**Propuesto:**

```sql
alter table clientes
  add column usuario_id uuid references auth.users(id) on delete set null;

create index on clientes (usuario_id);
```

`clientes` ya es por comercio (`empresa_id` not null), y eso está bien: la
relación con el cliente es de cada comercio, con su ficha, sus datos
fiscales y su historia. La misma persona en la barbería y en el gimnasio
son **dos filas**, y tiene que seguir siendo así.

Lo que se agrega es que las dos puedan apuntar a la misma cuenta:

```
auth.users (una persona)
   ├── clientes  (Almha)         turnos, abonos, ficha
   └── clientes  (Bar Rivadavia) sus consumos
```

**Por qué una columna y no una tabla de identidades con su join:** es la
misma decisión que ya tomó 0030 con `personal.perfil_id`, y por la misma
razón que está escrita ahí: *"preverlo ahora cuesta una columna; agregarlo
después cuesta una migración de datos con turnos encima"*. Una tabla
intermedia resuelve un problema que todavía no tenemos.

`on delete set null` y no cascade: si la persona borra su cuenta, la ficha
y su historial quedan. El comercio le facturó y le atendió; eso no
desaparece porque desinstale una app.

---

## 4 · El problema difícil: cómo se enlaza

Es la parte que no es obvia y la que hay que pensar bien.

El comercio cargó a "Sofía Pérez, tel 11-5555" hace ocho meses, cuando
Sofía no tenía ninguna app. Sofía se registra hoy. **¿Cómo sabemos que esa
cuenta es esa ficha?**

Si nos equivocamos, alguien ve la historia clínica de otra persona.

### Tres caminos, y no todos sirven

**a) El comercio invita.** Igual que los accesos del personal: el comercio
tiene el teléfono y el correo, manda la invitación, y aceptarla enlaza el
`usuario_id`. **Es el más seguro**, porque el comercio es el que sabe quién
es quién y está poniendo la firma.

**b) El cliente se registra y reclama su ficha.** Se anota, pone su
teléfono, y el sistema busca la ficha que coincida. **Peligroso tal cual**:
cualquiera pone el teléfono de otro y se lleva su historial. Solo sirve con
verificación, y la verificación tiene que ir **al contacto que ya está
guardado**, no al que la persona escribió recién. Esa diferencia es todo.

**c) El cliente se registra nuevo.** Se crea una ficha nueva en ese
comercio, sin reclamar nada. Seguro y sin fricción, pero deja duplicados
que el comercio va a tener que unir a mano.

**Propuesto:** construir **(a) y (c)**. La (b) queda para después y solo con
código enviado al contacto guardado.

**Abierto:** qué pasa con los duplicados de (c). Unir dos fichas con turnos,
abonos y ventas de cada lado no es trivial, y sin eso el comercio termina
con dos Sofías.

---

## 5 · Qué puede ver, y cómo

**Propuesto:** una función que devuelve las fichas de quien pregunta, y
políticas colgadas de ella.

```sql
create or replace function public.mis_fichas()
returns setof uuid
language sql stable security definer
as $$ select id from clientes where usuario_id = auth.uid() $$;
```

### Corregido al construir 0050: funciones, no políticas

Este documento proponía políticas de RLS sobre `reservas` y `abonos`. **Al
mirar las columnas quedó claro que estaba mal**, y así se construyó:

- `items` tiene `costo`, `stock_min` y `proveedor_id`.
- `reservas` y `abonos` tienen `notas`, que es donde recepción escribe
  para adentro.

Una política decide sobre la **fila** y deja pasar todas sus columnas. Darle
lectura de `items` para que vea el catálogo es darle el costo.

Y hay algo peor que el costo de hoy: con una política de fila, **cada
columna que se agregue mañana queda expuesta sola**. El día que alguien
sume `margen` a `items`, pasa a ser pública sin que nadie lo decida.

Por eso **el cliente no lee tablas, lee funciones** que proyectan solo lo
suyo: `mis_fichas`, `mis_comercios`, `mis_turnos`, `mis_abonos`,
`catalogo_de`. Las columnas nuevas nacen privadas, que es el default
correcto para lo único de este sistema que va a mirar gente de afuera.

Tampoco vistas, por dos razones que se suman: una vista con
`security_invoker` —que este proyecto exige en todas— heredaría las
políticas del que pregunta, que para un cliente no existen, y devolvería
vacío. Y sin `security_invoker` sería una vista que saltea RLS, que es
justo lo que la prueba de vistas impide.

**No se tocó ninguna política existente.** El sistema de gestión quedó
exactamente igual.

---

## 6 · La disponibilidad se calcula, no se lee

Acá hay una tensión que conviene ver antes de chocarla.

Para sacar un turno, el cliente necesita saber **qué horarios hay libres**.
Pero los horarios libres se derivan de los ocupados, y los ocupados son los
turnos de otras personas. Si le damos lectura de la agenda para que calcule
los huecos, le dimos la agenda.

**Propuesto:** una función que devuelva **solo los huecos**, nunca las
filas.

```sql
public.huecos_del_cliente(p_empresa, p_servicio, p_desde, p_hasta)
  -> franjas libres
```

`security definer`, mira la agenda por dentro y devuelve horarios, no
turnos. El cliente nunca ve una reserva ajena, ni el nombre, ni que exista.

Es el mismo criterio que ya usa el proyecto con `informe_ocupacion`: la
cuenta se hace en la base, no en la pantalla.

---

## 7 · Reservar es una función, no un insert

**Propuesto:** el cliente no escribe en `reservas`. Llama a algo como
`reservar_como_cliente(...)`, igual que el cobro pasa por `registrar_venta`
y el plano por `guardar_plano`.

Ahí adentro viven las reglas, que son de negocio y no de pantalla:

- Con cuánta anticipación se puede sacar y hasta cuándo se puede cancelar
- Si hace falta abono activo, y qué pasa si está vencido
- Cuántos turnos abiertos puede tener a la vez
- Que no choque — que ya está resuelto en la base desde la agenda

Si fuera un insert directo, cada una de esas reglas habría que repetirla en
la app del cliente, en el sistema de gestión y en cualquier cosa que venga
después. Y la que se olvide es la que alguien va a encontrar.

---

## 8 · Una app, no una por módulo

**Decidido.** Los módulos son una división del sistema de gestión. El
cliente no instala "Agenda": instala *Almha*.

La forma de la app sale del **rubro**, que ya es dato en la base y ya
decide el menú y el tablero del comercio. Es la misma máquina:

| Rubro | Qué ve el cliente |
|---|---|
| Estética, barbería | Sacar turno, sus próximos, su ficha |
| Pilates, gimnasio | Clases con cupo, lista de espera, abono y renovación |
| Gastronomía | Sus consumos, y más adelante el pedido |

Una base de código, una fila de configuración.

---

## 9 · Lo que este documento NO cubre

**El caso del minimercado y la hamburguesería.** Descuentos, puntos y
cupones no están en el modelo y no se parecen a lo demás: no es "lo mismo
para otro rubro", es un producto nuevo. Merece su propio documento y su
propia decisión sobre si vale la pena.

**El costo.** Una app de cliente multiplica los usuarios de Auth por dos
órdenes de magnitud. Ahí los planes pagos de Supabase dejan de ser un
trámite y pasan a ser parte del cálculo.

---

## 10 · Lo que queda abierto

1. Unir fichas duplicadas cuando alguien se registra por el camino (c).
2. Verificación del camino (b): SMS, correo, o directamente no hacerlo.
3. Si el cliente puede editar sus propios datos —domicilio, teléfono— o
   solo pedirle al comercio que los cambie. Tocan datos fiscales.
4. Notificaciones push: el recordatorio de turno que hoy sale por
   WhatsApp desde Comunicaciones podría ser push. Cambia el módulo.
5. Qué pasa cuando un comercio da de baja a un cliente que tiene la app
   instalada.
