# Historial de migraciones de Matearte

El 3 de noviembre de 2026 se alinearon los nombres y números de versión de los archivos locales con las 226 migraciones registradas en el proyecto Supabase `agdkljuulwjwjasftcce`. Supabase compara los números de versión para decidir qué SQL falta aplicar.

Las 15 migraciones de datos iniciales del 18 de agosto se representan con marcadores. El SQL original contiene nombres de clientes y pedidos reales y no se publica en GitHub. Por eso, reconstruir una base local desde cero no reproduce esos registros históricos.

Algunos archivos SQL antiguos fueron adaptados después de su primera ejecución, por ejemplo al retirar el control de stock. La alineación verificada aquí es de **versión y nombre**, no una afirmación de que cada archivo sea idéntico al texto guardado en el historial remoto. Cualquier cambio nuevo de esquema o datos debe tener una migración nueva; no se deben reejecutar las versiones históricas sobre producción.
