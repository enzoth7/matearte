# Consignaciones: reglas y límite del acceso externo

## Reglas del piloto

- Cada consignación se vincula a un pedido mayorista guardado y a su `contact_id`. En ese momento se elige UYU o ARS y se copian los precios unitarios del pedido. La moneda, los precios y la cotización histórica quedan fijados en la consignación. Las consignaciones anteriores conservan ARS.
- Enviadas es la suma de movimientos `dispatch`. El envío aumenta de inmediato las unidades en poder del consignatario. Devueltas es `return`; vendidas o conservadas es `kept`, siempre confirmado por MateArte. En poder = enviadas menos devueltas menos conservadas.
- Valor en poder = unidades en poder por precio unitario pactado. Cargo confirmado = unidades conservadas por precio unitario pactado. Pagos aplicados = asignaciones a esa consignación. Saldo = máximo entre cero y cargo confirmado menos pagos aplicados.
- Un cobro de la consignación que todavía no se aplicó queda como crédito separado. El panel solo incluye los cobros marcados para esa consignación y las asignaciones hacia ella. Una entrega general de la cuenta no se muestra hasta que MateArte la aplica a una consignación.
- Los importes del consignatario permanecen en la moneda pactada. Finanzas proyecta ARS a UYU con la cotización guardada; no recalcula el precio ni el saldo del cliente.

## Inventario de datos y operaciones

El cargador interno `useCommerce` obtiene en paralelo datos completos del comercio antes de mostrar una vista. Sus lecturas incluyen:

| Fuente | Datos que puede llevar al navegador interno | Uso para Consignaciones |
| --- | --- | --- |
| `wholesale_consignments`, `wholesale_consignment_lines`, `wholesale_consignment_movements`, `wholesale_consignment_allocations` | Cuentas, pedidos vinculados, precios, movimientos, notas de envío y aplicaciones de cobros de todos los consignatarios | Directo |
| `customer_account_receipts`, `customer_account_allocations`, `wholesale_order_receipts`, `wholesale_order_payment_openings` | Cobros y créditos de clientes, incluidos pedidos ajenos a consignación | Saldo y capacidad de cobro |
| `orders`, `order_items`, `order_lines`, `customers`, `contacts` | Pedidos, artículos, precios y datos personales de clientes | Pedido de origen, nombre y cuenta |
| `settings`, `commerce_products`, `commerce_variants`, `commerce_product_images`, `commerce_categories` | Cotización, catálogo, variantes e imágenes | Creación interna y PDF |
| `commerce_payments`, `local_sales`, `local_sale_items`, `local_sale_receipts`, `local_sales_customers`, `rural_raffle_entries` | Pagos web, ventas locales y datos de participantes | Cargador general, sin necesidad para el panel |
| `purchases`, `fixed_expenses` y demás fuentes de egresos | Costos y gastos internos | Cargador general, sin necesidad para el panel |
| `commerce_admin_users` y RPC `gestion_logs_context` | Perfil, rutas habilitadas y contexto de auditoría | Inicio interno |
| RPC `gestion_customer_profile_details_full`, `gestion_web_leads`, `gestion_contact_origins`, `gestion_customer_first_seen` | Perfiles, prospectos y origen de clientes | Cargador general, sin necesidad para el panel |

Las operaciones internas relacionadas son `gestion_link_wholesale_consignment`, `gestion_record_wholesale_consignment_movement`, `gestion_record_wholesale_consignment_payment`, `gestion_allocate_wholesale_consignment_receipt` y las RPC compartidas `gestion_record_customer_account_receipt`, `gestion_allocate_customer_account_receipt`, `gestion_record_wholesale_payment`. El MCP consulta las mismas tablas y usa las RPC de registro con la credencial interna de Richard. El acceso externo no ejecuta ninguna de ellas.

`admin_users`, `customers`, `local_sale_items`, `local_sales`, `local_sales_customers`, `order_lines`, `products` y `settings` tienen permiso de lectura para `authenticated`, pero son vistas `security_invoker`, no tablas. La migración comprueba esa propiedad para que apliquen las políticas de sus tablas de origen. Las tablas `contacts`, `orders`, `order_items`, `commerce_admin_users` y las de consignación ya tienen RLS. Algunas tablas de catálogo y cotizaciones permiten lecturas más amplias para el sitio público, por lo que el bloqueo de todas las rutas de Data API para una identidad externa es necesario. `private.require_internal_staff()` deniega además cualquier RPC protegida si existe el vínculo externo. La función previa `gestion_data_api_access()` conserva el filtro de rutas y firma del MCP; la nueva función previa lo llama después de denegar las solicitudes de cualquier identidad de consignatario, activa o pausada.

## Proyección externa

`consignment_portal_users` vincula un usuario Auth con un solo `contact_id`; no es una membresía de `commerce_admin_users`. Su rol se comprueba en cada solicitud a `gestion-consignatario`. La función obtiene primero las consignaciones de ese contacto y limita todas las lecturas siguientes a sus identificadores, líneas y cobros. Devuelve únicamente nombre visible, referencia del pedido, moneda, fechas, SKU, artículos, cantidades, precio pactado, totales y eventos de envío, devolución, conservación, cobro y aplicación. No devuelve domicilio, teléfono, correo, notas, transportista, seguimiento, pedidos ajenos ni datos de Finanzas.

En Gestión, el usuario externo entra por `/consignaciones/resumen`; una ruta distinta redirige allí. `useCommerce` reconoce el vínculo externo antes de llamar al cargador general. Una cuenta pausada no recibe la proyección. La membresía se crea pausada. El personal autorizado administra sus cuentas desde la subpestaña `/consignaciones/usuarios`, separada de la lista de usuarios internos en Administración. Richard y Enzo tienen acceso completo; el permiso de esta subpestaña se puede conceder a otros usuarios internos desde Permisos. La función `gestion-users` comprueba ese permiso antes de listar, crear, habilitar, pausar o cambiar contraseñas.

## Puerta de habilitación

Antes de activar una cuenta real: ejecutar la migración y la función en un entorno aislado; conciliar el caso UYU y otro ARS; probar dos cuentas con contactos distintos y una pausada, incluyendo consultas directas a tablas y RPC, rutas ajenas y escrituras; repetir registro de pedidos, movimientos, cobros y funciones del MCP con personal interno. Cualquier lectura cruzada, escritura externa o diferencia de saldo bloquea la invitación. La conciliación real de Paysandú y la entrega de credenciales siguen a cargo de MateArte.

## Verificación local

La compilación de Gestión, sus 356 pruebas unitarias, las cuatro pruebas de pantalla de Consignaciones y el control de tipos de las funciones Edge pasaron. La migración pasó el analizador sintáctico de PostgreSQL. La prueba de pantalla comprueba que dos sesiones externas reciben paneles distintos, que una cuenta pausada no entra y que el cargador interno no consulta otras fuentes al visitar una URL ajena.

Queda pendiente la prueba de integración de RLS y RPC con usuarios Auth reales. El ejecutor `supabase/tests/consignment_portal_isolation.mjs` comprueba dos cuentas activas, una pausada, lecturas directas, RPC de escritura y una lectura interna sin modificar datos. Requiere la URL, la clave pública y credenciales de prueba en variables de entorno. Una rama temporal de Supabase creada para esa prueba contenía solo ocho relaciones públicas y ninguna tabla de consignación: el esquema de producción no se reprodujo desde su historial de migraciones. Esa rama se eliminó. El 10 de noviembre de 2026 se aplicó la migración en producción y se recargó el esquema de PostgREST. Todavía no se creó una cuenta externa real.
