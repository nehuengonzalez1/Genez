/* ============================================================
   0086 · CÓDIGOS DE BARRAS PROPIOS
   ============================================================

   Un producto sin código de barras —lo que se fracciona en el local, lo
   que viene suelto, lo que el proveedor no rotuló— no se puede pasar con
   la pistola. Esto le asigna uno propio al comercio, que después se
   imprime en etiquetas desde Productos.

   EL FORMATO: EAN-8 QUE EMPIEZA CON 2
   -----------------------------------
   El 2 es el rango que el estándar deja para uso interno de cada negocio:
   no lo tiene ningún producto de fábrica, así que no choca con lo que ya
   está en el catálogo. Y de 8 dígitos, no de 13, por dos razones:

   - La balanza. Sus etiquetas son de 13 dígitos y empiezan con 2
     (`leerCodigoBalanza`): un código propio de 13 que empezara con 2 se
     leería como fiambre pesado.
   - Los que empiezan con 0 no sirven: muchos lectores le sacan el 0 a un
     EAN-13 que empieza así, y el código que llega no es el guardado.

   2 + seis dígitos de número + el dígito verificador: un millón de
   códigos por comercio, y un código corto, que entra más veces en una
   hoja de etiquetas.

   EL NÚMERO NO SE REPITE
   ----------------------
   Se toma el más alto que ya tenga el comercio en ese formato y se sigue.
   Dos personas generando a la vez leerían el mismo "más alto": el
   advisory lock por comercio las pone en fila adentro de la transacción.
   Y si un número ya lo tiene otro producto —cargado a mano, importado—,
   se saltea.

   Sin security definer: actualiza `items` con los permisos de quien
   llama, igual que editar la ficha desde Productos.
   ============================================================ */

create or replace function public.digito_ean(p_cuerpo text)
returns int
language sql
immutable
as $$
  /* De derecha a izquierda, pesos 3 y 1 alternados; el dígito es lo que
     falta para llegar a la decena. Vale para EAN-8 y EAN-13. */
  select (10 - (sum(
    substr(reverse(p_cuerpo), i, 1)::int * case when i % 2 = 1 then 3 else 1 end
  ) % 10)) % 10
  from generate_series(1, length(p_cuerpo)) as i
$$;

create or replace function public.asignar_codigos_internos(p_empresa uuid, p_items uuid[])
returns table (item_id uuid, barcode text)
language plpgsql
as $$
declare
  v_item  uuid;
  v_sig   int;
  v_cod   text;
begin
  if p_empresa is null then
    raise exception 'Falta el comercio.';
  end if;

  perform pg_advisory_xact_lock(hashtext('codigos_internos:' || p_empresa::text));

  select coalesce(max(substr(i.barcode, 2, 6)::int), 0) + 1 into v_sig
  from items i
  where i.empresa_id = p_empresa
    and i.barcode ~ '^2[0-9]{7}$'
    and right(i.barcode, 1)::int = public.digito_ean(left(i.barcode, 7));

  for v_item in
    select i.id from items i
    where i.empresa_id = p_empresa
      and i.id = any(p_items)
      and coalesce(btrim(i.barcode), '') = ''
    order by i.nombre
  loop
    loop
      if v_sig > 999999 then
        raise exception 'Se terminaron los códigos propios de este comercio.';
      end if;
      v_cod := '2' || lpad(v_sig::text, 6, '0');
      v_cod := v_cod || public.digito_ean(v_cod)::text;
      v_sig := v_sig + 1;
      exit when not exists (select 1 from items x where x.empresa_id = p_empresa and x.barcode = v_cod);
    end loop;

    update items set barcode = v_cod where id = v_item;
    item_id := v_item;
    barcode := v_cod;
    return next;
  end loop;
end;
$$;

comment on function public.asignar_codigos_internos(uuid, uuid[]) is
  'Le da un EAN-8 propio (2xxxxxxC) a los productos que no tienen código. No pisa ninguno existente.';
