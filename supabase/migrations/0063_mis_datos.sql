/* ============================================================
   0063 · QUE LA CLIENTA CORRIJA SUS DATOS
   ============================================================

   La pantalla 18 de la maqueta: nombre, correo, teléfono y fecha de
   nacimiento, con "Guardar cambios".

   Hoy no puede: la política de `clientes` es `puede_ver(empresa_id)`, que
   da verdadero para quien trabaja en el comercio y falso para su clienta.
   Y está bien que así sea —esa política es la que impide que una clienta
   vea la ficha de otra— así que esto no la afloja: agrega una función que
   escribe solo lo suyo y solo lo que corresponde.

   §10 DEL MODELO DE IDENTIDAD PREGUNTABA JUSTO ESTO
   -------------------------------------------------
   *"Si el cliente puede editar sus propios datos —domicilio, teléfono— o
   solo pedirle al comercio que los cambie. Tocan datos fiscales."*

   La respuesta es: **los suyos sí, los del comercio no**. Y la línea entre
   una cosa y la otra no es de confianza, es de a quién pertenece el dato.

   LO QUE PUEDE CAMBIAR
   --------------------
   El teléfono, el domicilio y la fecha de nacimiento. Son datos de
   contacto que ella conoce mejor que nadie: si se mudó, la que sabe es
   ella, y hoy tiene que llamar para avisar que cambió de número.

   LO QUE NO, Y POR QUÉ CADA UNO
   -----------------------------
   **El nombre.** `razon_social` es el nombre con el que se le factura.
   Cambiarlo desde la app cambiaría comprobantes ya emitidos de nombre, y
   además es el nombre con el que el comercio la conoce y la busca en su
   lista. Que se llame distinto en la app y en el mostrador es peor que no
   poder cambiarlo.

   HAY DOS CORREOS Y SOLO UNO ES SUYO
   ----------------------------------
   `clientes.email` es a dónde el comercio le escribe, y ese sí lo cambia:
   es su dato de contacto, como el teléfono. Si se cambió de casilla, la
   que sabe es ella.

   El de `auth.users` es con el que entra, y ese no. Cambiarlo es cambiar
   los dos a la vez y verificar el nuevo antes de que el viejo deje de
   servir; hacerlo a medias la deja sin poder entrar. Es otra función y
   otra pantalla, y hasta que existan la app dice cuál es cuál en vez de
   mostrar uno solo y que se descubra el día que no llega un aviso.

   **Lo fiscal** —tipo y número de documento, condición—. No es suyo en el
   sentido que importa: es lo que el comercio declara ante AFIP.

   La pantalla muestra igual el nombre y el correo con el que entra, en
   gris y sin poder tocarlos, con una línea que dice a quién pedírselos.
   Esconderlos sería fingir que no existen.

   NI SIQUIERA PUEDE ELEGIR QUÉ FICHA
   ----------------------------------
   No recibe un id. Escribe sobre las fichas que devuelve `mis_fichas`, que
   son las suyas por definición, filtradas además por empresa para que
   cambiar el teléfono en la estética no lo cambie en el bar: son dos
   relaciones distintas y cada comercio tiene el dato que ella le dio.

   Un parámetro con el id sería una función a la que hay que preguntarle
   "¿y esa ficha es tuya?", y esa pregunta es la que se olvida algún día.
   ============================================================ */

create or replace function public.guardar_mis_datos(
  p_empresa    uuid,
  p_email      text default null,
  p_tel        text default null,
  p_domicilio  text default null,
  p_nacimiento date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ficha uuid;
begin
  /* La ficha sale de quién pregunta y del comercio, nunca de un
     parámetro. Si no tiene ficha en ese comercio, no hay nada que
     escribir y se dice: contestar "listo" sin haber guardado es la peor
     de las respuestas. */
  select c.id into v_ficha
    from clientes c
   where c.id in (select public.mis_fichas())
     and c.empresa_id = p_empresa
   limit 1;

  if v_ficha is null then
    raise exception 'No sos cliente de este comercio.'
      using errcode = 'P00B0';
  end if;

  update clientes
     set email     = coalesce(nullif(trim(p_email), ''), email),
         tel       = coalesce(nullif(trim(p_tel), ''), tel),
         domicilio = coalesce(nullif(trim(p_domicilio), ''), domicilio),
         /* La fecha de nacimiento no es una columna: es de las cosas que
            un rubro usa y otro no. Una estética saluda el cumpleaños; un
            minimercado no le pregunta la fecha de nacimiento a nadie.
            `campos_extra` existe exactamente para esto. */
         campos_extra = case
           when p_nacimiento is null then campos_extra
           else coalesce(campos_extra, '{}'::jsonb)
                || jsonb_build_object('nacimiento', p_nacimiento)
         end
   where id = v_ficha;
end;
$$;

/* Solo alguien con sesión. `anon` no tiene fichas, así que igual no
   escribiría nada, pero no hace falta ofrecérselo. */
revoke all on function public.guardar_mis_datos(uuid, text, text, text, date) from public;
revoke all on function public.guardar_mis_datos(uuid, text, text, text, date) from anon;
grant execute on function public.guardar_mis_datos(uuid, text, text, text, date) to authenticated;

comment on function public.guardar_mis_datos(uuid, text, text, text, date) is
  'La clienta corrige sus datos de contacto: correo de contacto, teléfono, domicilio y nacimiento. No toca el nombre, el correo con el que entra ni lo fiscal: ver el encabezado de 0063.';


/* ------------------------------------------------------------
   Y lo que la app tiene que poder leer para mostrarlos

   `mis_comercios` ya devuelve el nombre; faltan los tres que ahora se
   pueden editar. Van ahí y no en una función nueva porque son de la misma
   ficha y se piden en el mismo momento.
   ------------------------------------------------------------ */

drop function if exists public.mis_comercios();

create or replace function public.mis_comercios()
returns table (
  empresa_id uuid,
  slug       text,
  nombre     text,
  rubro      text,
  ficha_id   uuid,
  mi_nombre  text,
  desde      timestamptz,
  mi_email   text,
  mi_tel     text,
  mi_domicilio text,
  mi_nacimiento date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.slug,
    e.nombre,
    e.rubro,
    c.id,
    c.razon_social,
    /* `creado_en` y no `enlazado_en`: es desde cuándo es clienta del
       comercio, no desde cuándo tiene la app. Victoria viene desde abril
       y se enlazó en agosto; "Con Almha desde agosto" sería falso y
       además borraría cuatro meses de relación de un renglón. */
    c.creado_en,
    c.email,
    c.tel,
    c.domicilio,
    nullif(c.campos_extra ->> 'nacimiento', '')::date
  from clientes c
  join empresas e on e.id = c.empresa_id
 where c.usuario_id = auth.uid()
   and c.activo = true
   and e.activa = true
 order by e.nombre
$$;

grant execute on function public.mis_comercios() to authenticated;
