/* ============================================================
   0138 · EL MENÚ AGRUPADO, CON ADMINISTRACIÓN APARTE
   ============================================================

   Comercio y gastronomía tenían un solo grupo sin rótulo: catorce
   renglones seguidos, con Ajustes, Permisos y Equipo mezclados entre
   Productos y Caja. Nehuen lo comparó con Vendi y Ventario (07/10): los
   dos agrupan por tema con un rótulo, y tienen lo administrativo en un
   lugar propio. Lo de todos los días se encuentra más rápido, y lo que
   se toca una vez por mes no estorba.

   Dos marcas nuevas en la forma del menú (las lee el navegador):

   `rotulo` dibuja el grupo como un título chico con sus módulos abajo,
   cada uno en su renglón. Sin la marca, un grupo con nombre sigue siendo
   lo que era desde 0028: un solo renglón con pestañas adentro, que es
   como se ve servicios ("Clientes y equipo"). No se cambió esa regla
   para no tocar el menú de servicios por la puerta de atrás.

   `abajo` lo manda al pie de la barra, separado del resto. Es el lugar de
   Administración en los tres rubros.

   No cambia qué ve cada uno: los módulos y sus textos son los mismos, se
   toman del menú que ya estaba, y lo que el comercio no contrató o el rol
   no habilita lo sigue filtrando el navegador. Si algún módulo del menú
   viejo no quedara en el nuevo, la migración falla.
   ============================================================ */

/* El módulo tal como está hoy en el menú del rubro: texto, ícono y
   bajada salen de ahí y no se reescriben a mano. */
create function pg_temp.modulo(p_rubro text, p_k text) returns jsonb
language sql stable as $$
  select m from rubros r, jsonb_array_elements(r.menu) g, jsonb_array_elements(g -> 'modulos') m
  where r.clave = p_rubro and m ->> 'k' = p_k
  limit 1
$$;

create function pg_temp.modulos(p_rubro text, p_ks text[]) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(pg_temp.modulo(p_rubro, k) order by o), '[]'::jsonb)
  from unnest(p_ks) with ordinality as u(k, o)
  where pg_temp.modulo(p_rubro, k) is not null
$$;

/* Las claves de módulos de un menú, para comparar el antes y el después. */
create function pg_temp.claves(p_menu jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(m ->> 'k' order by m ->> 'k'), '{}')
  from jsonb_array_elements(p_menu) g, jsonb_array_elements(g -> 'modulos') m
$$;

create temp table menu_antes as select clave, menu from rubros;

update rubros set menu = jsonb_build_array(
  jsonb_build_object('clave', 'inicio', 'nombre', null, 'modulos', pg_temp.modulos('minimercado', array['inicio'])),
  jsonb_build_object('clave', 'ventas', 'nombre', 'Ventas', 'rotulo', true,
    'modulos', pg_temp.modulos('minimercado', array['caja', 'clientes', 'cuentas', 'pedidos', 'presupuestos'])),
  jsonb_build_object('clave', 'mercaderia', 'nombre', 'Mercadería', 'rotulo', true,
    'modulos', pg_temp.modulos('minimercado', array['productos', 'stock', 'compras'])),
  jsonb_build_object('clave', 'numeros', 'nombre', 'Números', 'rotulo', true,
    'modulos', pg_temp.modulos('minimercado', array['reportes', 'asistente'])),
  jsonb_build_object('clave', 'administracion', 'nombre', 'Administración', 'rotulo', true, 'abajo', true,
    'modulos', pg_temp.modulos('minimercado', array['equipo', 'permisos', 'ajustes']))
) where clave = 'minimercado';

update rubros set menu = jsonb_build_array(
  jsonb_build_object('clave', 'inicio', 'nombre', null, 'modulos', pg_temp.modulos('gastronomia', array['inicio'])),
  jsonb_build_object('clave', 'ventas', 'nombre', 'Ventas', 'rotulo', true,
    'modulos', pg_temp.modulos('gastronomia', array['comandas', 'cocina', 'caja', 'clientes', 'cuentas'])),
  jsonb_build_object('clave', 'mercaderia', 'nombre', 'Mercadería', 'rotulo', true,
    'modulos', pg_temp.modulos('gastronomia', array['productos', 'stock', 'compras'])),
  jsonb_build_object('clave', 'numeros', 'nombre', 'Números', 'rotulo', true,
    'modulos', pg_temp.modulos('gastronomia', array['reportes', 'asistente'])),
  jsonb_build_object('clave', 'administracion', 'nombre', 'Administración', 'rotulo', true, 'abajo', true,
    'modulos', pg_temp.modulos('gastronomia', array['equipo', 'ajustes']))
) where clave = 'gastronomia';

/* Servicios ya estaba agrupado a su manera: solo su "Configuración" pasa a
   ser Administración, al pie, como en los otros dos. El resto queda igual. */
update rubros set menu = (
  select jsonb_agg(
    case when g ->> 'clave' = (select g2 ->> 'clave' from jsonb_array_elements(menu) g2 where g2 ->> 'nombre' = 'Configuración' limit 1)
      then (g - 'i' - 'proximo') || jsonb_build_object('clave', 'administracion', 'nombre', 'Administración', 'rotulo', true, 'abajo', true)
      else g end
    order by o)
  from jsonb_array_elements(menu) with ordinality as e(g, o)
) where clave = 'servicios';

do $$
declare r record;
begin
  for r in select a.clave, a.menu as antes, n.menu as despues from menu_antes a join rubros n using (clave) loop
    if pg_temp.claves(r.antes) <> pg_temp.claves(r.despues) then
      raise exception 'El menú de % perdió o ganó módulos: antes %, después %',
        r.clave, pg_temp.claves(r.antes), pg_temp.claves(r.despues);
    end if;
  end loop;
end $$;
