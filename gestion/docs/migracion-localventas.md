# Integración de LocalVentas

Gestión lee `local_sales_customers`, `local_sales` y sus `local_sale_items` de Supabase. Consulta todas las páginas, sin recortar el historial por fecha. Los productos y variantes de LocalVentas ya viven en `commerce_products` y `commerce_variants`, que Gestión comparte con Commerce Admin.

| Función de LocalVentas | Ubicación en Gestión |
| --- | --- |
| Registrar venta de varios artículos, con fecha, cliente, medio de pago o seña | Comercial → Registrar venta / pedido |
| Historial de ventas y búsqueda | Comercial → Ventas y pedidos, canal Local |
| Detalle con artículos, SKU, variantes e importes | Ficha de venta en Comercial |
| Clientes sin compra y clientes asociados a ventas | Clientes → Base de clientes |
| Crear y editar cliente; nombre, mail, celular, nacimiento, notas | Clientes → Base de clientes |
| Primera y última compra, historial de ventas | Ficha del cliente |
| Catálogo, variantes, precios base, atributos y orden por SKU/precio | Productos → Catálogo general |
| Ventas por período y por canal | Inicio → Resumen general |
| Cobros del local | Finanzas → Cobros y comprobantes |

La escritura de una venta usa exactamente la función `create_local_sale_with_items` del sistema anterior. No se copian tablas ni se realiza una segunda inserción para Gestión. Ambas aplicaciones leen los mismos registros y pueden seguir funcionando durante la convivencia.

En LocalVentas, `local_sales.total_minor` es el monto cobrado. Para ventas con seña, el valor de los artículos se conserva en `local_sale_items`; Gestión muestra el valor vendido y el saldo separado del cobro. Para las demás ventas, el total registrado prevalece incluso si una línea histórica difiere: no se inventa una deuda por esa diferencia. No se modificó ningún registro histórico.

La relación de clientes utiliza `source_user_id` o correo cuando coincide con un cliente de pedidos web; si no coincide, crea una ficha local en la vista compartida. Si se elige un cliente web al registrar una venta local, Gestión crea su ficha compatible en `local_sales_customers` y la vincula con esa venta; la ficha visible permanece única. En clientes vinculados, los datos de contacto editables del local prevalecen en Gestión y los datos de ubicación web se conservan. La identidad compartida por correo es una presentación, todavía no una fusión física de bases ni una sincronización bidireccional de contactos. No se cambió el acceso del servidor: Gestión sigue exigiendo una cuenta activa en `commerce_admin_users`; vincular las cuentas de las Florencias a las políticas reales queda como trabajo de permisos, antes de habilitar su acceso.

Verificación: pruebas de adaptación de datos, registros de seña, importes discrepantes, navegación de ventas/clientes/cobros, escritura única por RPC y persistencia tras recarga. Las pruebas de navegador usan interceptores y no escriben en producción.
