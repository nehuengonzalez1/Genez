/* ============================================================
   0073 · LAS TARIFAS SON DATO
   ============================================================

   El alta guiada termina en "lo que vas a pagar para empezar", y hasta
   acá el sistema no tenía ninguna noción de precio: `empresas.plan` es un
   texto suelto y los módulos se contratan sin costo asociado.

   Misma regla que el menú, los roles y las reglas de reserva: el precio
   vive en una fila y lo edita la plataforma desde su panel, no desde el
   código. Sin filas, el alta guiada dice "precio a confirmar" y nunca un
   número inventado; por eso esta migración no siembra nada.

   POR QUÉ POR MÓDULO Y NO POR PLAN
   --------------------------------
   El presupuesto sale de los módulos que la persona de verdad necesita,
   que se arman con sus respuestas. Un plan cerrado ("Básico", "Pro") le
   cobra módulos que no marcó o le esconde uno que sí. Con un precio por
   módulo el presupuesto es una suma que se entiende: base más lo que
   sumaste, y cada línea dice cuánto pesa.

   QUÉ HAY EN LA TABLA
   -------------------
   Una fila por concepto, con la clave como nombre:

     base               lo mensual que incluye los módulos base
                        (cobro, caja, ajustes: sin eso no hay sistema)
     puesta_en_marcha   lo que se cobra una sola vez al arrancar
                        (carga del catálogo, capacitación). Cero si no
                        se cobra.
     modulo:<clave>     lo mensual de cada módulo que no es base, con la
                        clave del catálogo (src/datos/modulos.js)
     whatsapp           el número al que llega el presupuesto cuando la
                        persona toca "Quiero empezar". No es un monto:
                        va en `texto`. Está acá y no en una tabla propia
                        porque es lo único que la plataforma configura
                        para presentarse, y una tabla para una fila es
                        más costosa que una columna.

   `monto` en null es "a confirmar": el alta guiada no suma lo que no
   sabe y lo dice.

   QUIÉN LEE Y QUIÉN ESCRIBE
   -------------------------
   Escribe la plataforma (`es_plataforma()`). Lee cualquiera con sesión,
   y sin sesión `tarifas_publicas()`: security definer y angosta, mismo
   criterio que `rubros_publicos` y `marca_de`.
   ============================================================ */

create table tarifas (
  clave           text primary key,
  monto           numeric(14,2),
  texto           text,
  actualizado_en  timestamptz not null default now()
);

comment on table tarifas is
  'Lo que la plataforma cobra: base, puesta_en_marcha y modulo:<clave> en monto (null = a confirmar); whatsapp en texto.';

alter table tarifas enable row level security;

create policy tarifas_leer on tarifas
  for select to authenticated using (true);

create policy tarifas_escribir on tarifas
  for all to authenticated
  using (public.es_plataforma()) with check (public.es_plataforma());

create or replace function tarifas_publicas()
returns table (clave text, monto numeric, texto text)
language sql
stable
security definer
set search_path = public
as $$
  select t.clave, t.monto, t.texto
  from tarifas t
  order by t.clave;
$$;

grant execute on function tarifas_publicas() to anon, authenticated;

comment on function tarifas_publicas() is
  'Las tarifas, sin sesión, para el alta guiada. Es lo mismo que ve el que edita: no hay precio secreto.';
