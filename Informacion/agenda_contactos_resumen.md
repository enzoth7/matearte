# Importación de la agenda histórica

Fuente: `Todos_los_contactos.xlsx`, hoja `Contactos`, filas 6–8206.

| Control | Resultado |
| --- | ---: |
| Filas del archivo | 8.201 |
| Filas no vacías | 8.198 |
| Filas representadas en fichas importadas | 7.281 |
| Fichas de Agenda en Supabase | 7.149 |
| Fichas minoristas existentes vinculadas | 2 |
| Fichas nuevas | 7.147 |
| Filas duplicadas unificadas con seguridad | 132 |
| Filas apartadas para revisión | 917 |
| Filas importadas con advertencia secundaria | 39 |
| Fichas con categoría inferida del nombre | 1.055 |

Las 917 filas apartadas no se cargaron: carecen de nombre o celular validable, o presentan identidades, correos o países contradictorios. Las 39 advertencias secundarias corresponden a filas que sí se importaron, pero tenían otro teléfono o un correo no válido. El detalle, con número de fila original y motivo, está en `agenda_contactos_revision.json`.

Los teléfonos importados están normalizados con prefijo internacional. La fecha de compra no se dedujo del archivo; las 2 fichas con fecha ya tenían ventas minoristas reales. La categoría inferida se almacena por separado y no cuenta como venta comprobada. No se modificaron clientes ni pedidos mayoristas.
