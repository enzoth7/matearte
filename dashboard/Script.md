/\*\*

&#x20;\* SISTEMA CON PRIMARY KEY, INSPECCIÓN DE CLIENTE (COL B) Y DESPLAZAMIENTO EXCLUSIVO DE A:G

&#x20;\* ACTUALIZADO PARA MÚLTIPLES ARTÍCULOS (B7:D21) CON BOTÓN DIBUJO

&#x20;\*/



function onEdit(e) {

&#x20; if (!e || !e.range) return;

&#x20; 

&#x20; const sheet = e.source.getActiveSheet();

&#x20; const range = e.range;

&#x20; const sheetName = sheet.getName().trim();

&#x20; 

&#x20; // Procesar "Completado" en Producción (Columna F / 6 en Producción)

&#x20; if (sheetName === "Producción" \&\& range.getColumn() === 6 \&\& range.getRow() >= 10) {

&#x20;   const estado = String(range.getValue()).trim();

&#x20;   

&#x20;   if (estado === "Completado") {

&#x20;     const fila = range.getRow();

&#x20;     

&#x20;     // Leer datos del pedido en Producción

&#x20;     const idPedido = sheet.getRange(fila, 1).getValue(); // Columna A

&#x20;     const cliente  = sheet.getRange(fila, 2).getValue(); // Columna B

&#x20;     const producto = sheet.getRange(fila, 3).getValue(); // Columna C

&#x20;     const variante = sheet.getRange(fila, 4).getValue(); // Columna D

&#x20;     const cantidad = sheet.getRange(fila, 5).getValue(); // Columna E

&#x20;     

&#x20;     // Asentar fecha de completado en Pedidos Históricos

&#x20;     if (cliente !== "") {

&#x20;       try {

&#x20;         const ss = e.source;

&#x20;         const dbSheet = ss.getSheetByName("Pedidos Históricos");

&#x20;         if (dbSheet) {

&#x20;           const lastRowHist = dbSheet.getLastRow();

&#x20;           if (lastRowHist >= 2) {

&#x20;             const datos = dbSheet.getRange(1, 1, lastRowHist, 7).getValues();

&#x20;             const fechaAhora = new Date();

&#x20;             let encontrado = false;

&#x20;             

&#x20;             function norm(txt) {

&#x20;               return String(txt || "").trim().toLowerCase();

&#x20;             }

&#x20;             

&#x20;             // PASO 1: Si tiene ID Pedido, buscar por ID Pedido (Columna A / Índice 0)

&#x20;             if (idPedido \&\& String(idPedido).trim() !== "") {

&#x20;               for (let i = datos.length - 1; i >= 1; i--) {

&#x20;                 if (String(datos\[i]\[0]).trim() === String(idPedido).trim()) {

&#x20;                   dbSheet.getRange(i + 1, 7).setValue(fechaAhora); // Columna G

&#x20;                   encontrado = true;

&#x20;                   break;

&#x20;                 }

&#x20;               }

&#x20;             }

&#x20;             

&#x20;             // PASO 2 (Respaldo para pedidos viejos sin ID): Buscar por Cliente, Modelo, Variante, Cantidad

&#x20;             if (!encontrado) {

&#x20;               const pCli  = norm(cliente);

&#x20;               const pProd = norm(producto);

&#x20;               const pVar  = norm(variante);

&#x20;               const pCant = String(cantidad).trim();

&#x20;               

&#x20;               for (let i = datos.length - 1; i >= 1; i--) {

&#x20;                 const hCli  = norm(datos\[i]\[2]); // Columna C

&#x20;                 const hProd = norm(datos\[i]\[3]); // Columna D

&#x20;                 const hVar  = norm(datos\[i]\[4]); // Columna E

&#x20;                 const hCant = String(datos\[i]\[5]).trim(); // Columna F

&#x20;                 const hFechaComp = datos\[i]\[6]; // Columna G

&#x20;                 

&#x20;                 const sinFecha = (!hFechaComp || String(hFechaComp).trim() === "");

&#x20;                 

&#x20;                 if (sinFecha \&\& hCli === pCli \&\& hProd === pProd \&\& hCant === pCant) {

&#x20;                   dbSheet.getRange(i + 1, 7).setValue(fechaAhora); 

&#x20;                   break;

&#x20;                 }

&#x20;               }

&#x20;             }

&#x20;           }

&#x20;         }

&#x20;       } catch (err) {

&#x20;         // Ignorar error para no bloquear la eliminación en Producción

&#x20;       }

&#x20;     }

&#x20;     

&#x20;     // OPCIÓN 1: MOVER Y DESPLAZAR ÚNICAMENTE EL RANGO A:G

&#x20;     const lastRowProd = sheet.getLastRow();

&#x20;     

&#x20;     if (lastRowProd > fila) {

&#x20;       const numFilas = lastRowProd - fila;

&#x20;       const rangoAbajo = sheet.getRange(fila + 1, 1, numFilas, 7);

&#x20;       rangoAbajo.moveTo(sheet.getRange(fila, 1));

&#x20;     } else {

&#x20;       sheet.getRange(fila, 1, 1, 7).clearContent();

&#x20;     }

&#x20;   }

&#x20; }

}



// ESTA ES LA FUNCIÓN QUE SE EJECUTA AL HACER CLIC EN TU BOTÓN

function agregarPedido() {

&#x20; const ss = SpreadsheetApp.getActiveSpreadsheet();

&#x20; const formSheet = ss.getSheetByName("Nuevo Pedido");

&#x20; const dbSheet = ss.getSheetByName("Pedidos Históricos");

&#x20; const prodSheet = ss.getSheetByName("Producción");

&#x20; 

&#x20; // Leer Cliente

&#x20; const cliente = formSheet.getRange("C4").getValue();

&#x20; 

&#x20; // Leer todos los artículos de la tabla extendida (B7:D21)

&#x20; const rangoArticulos = formSheet.getRange("B7:D21");

&#x20; const valoresArticulos = rangoArticulos.getValues();

&#x20; 

&#x20; let articulosAProcesar = \[];

&#x20; 

&#x20; // Recorrer las filas de la tabla para ver cuáles tienen datos

&#x20; for (let i = 0; i < valoresArticulos.length; i++) {

&#x20;   const producto = String(valoresArticulos\[i]\[0]).trim();

&#x20;   const variante = String(valoresArticulos\[i]\[1]).trim();

&#x20;   const cantidad = valoresArticulos\[i]\[2];

&#x20;   

&#x20;   // Si la fila tiene al menos un dato, la consideramos para validación

&#x20;   if (producto !== "" || variante !== "" || cantidad !== "") {

&#x20;     articulosAProcesar.push({

&#x20;       producto: producto,

&#x20;       variante: variante,

&#x20;       cantidad: cantidad,

&#x20;       filaFormulario: i + 7 // Para mostrar en qué fila está el error si lo hay

&#x20;     });

&#x20;   }

&#x20; }

&#x20; 

&#x20; // --- VALIDACIONES ---

&#x20; if (cliente === "") {

&#x20;   SpreadsheetApp.getUi().alert("⚠️ Error: El nombre del cliente es obligatorio en C4.");

&#x20;   return; 

&#x20; }

&#x20; 

&#x20; if (articulosAProcesar.length === 0) {

&#x20;   SpreadsheetApp.getUi().alert("⚠️ Error: Debes ingresar al menos un artículo en la tabla.");

&#x20;   return;

&#x20; }

&#x20; 

&#x20; for (let item of articulosAProcesar) {

&#x20;   if (item.producto === "" || item.variante === "" || item.cantidad === "") {

&#x20;     SpreadsheetApp.getUi().alert(`⚠️ Error: Faltan datos (Modelo, Variante o Cantidad) en la fila ${item.filaFormulario}.`);

&#x20;     return;

&#x20;   }

&#x20;   if (isNaN(item.cantidad) || item.cantidad <= 0) {

&#x20;     SpreadsheetApp.getUi().alert(`⚠️ Error: La cantidad debe ser un número mayor a 0 en la fila ${item.filaFormulario}.`);

&#x20;     return;

&#x20;   }

&#x20; }

&#x20; 

&#x20; // GENERAR UN ÚNICO ID PARA TODO EL PEDIDO

&#x20; const idPedido = "PED-" + Math.floor(100000 + Math.random() \* 900000);

&#x20; const fechaCreacion = new Date();

&#x20; 

&#x20; // --- 1. BUSCAR FILA LIBRE EN PEDIDOS HISTÓRICOS ---

&#x20; let filaLibreHist = 2;

&#x20; const lastRowHist = dbSheet.getLastRow();

&#x20; if (lastRowHist >= 2) {

&#x20;   const dbData = dbSheet.getRange(2, 3, lastRowHist - 1, 1).getValues(); 

&#x20;   for (let i = 0; i < dbData.length; i++) {

&#x20;     if (dbData\[i]\[0] === "" || dbData\[i]\[0] === null) {

&#x20;       filaLibreHist = 2 + i;

&#x20;       break;

&#x20;     }

&#x20;     if (i === dbData.length - 1) {

&#x20;       filaLibreHist = 2 + i + 1;

&#x20;     }

&#x20;   }

&#x20; }

&#x20; 

&#x20; // Preparar matriz de datos para Histórico y escribir todo de una vez

&#x20; const datosHist = articulosAProcesar.map(item => \[idPedido, fechaCreacion, cliente, item.producto, item.variante, item.cantidad]);

&#x20; dbSheet.getRange(filaLibreHist, 1, datosHist.length, 6).setValues(datosHist);

&#x20; 

&#x20; // --- 2. BUSCAR FILA LIBRE EN PRODUCCIÓN ---

&#x20; let filaDestino = 10;

&#x20; const lastRowProd = prodSheet.getLastRow();

&#x20; if (lastRowProd >= 10) {

&#x20;   const prodData = prodSheet.getRange(10, 2, lastRowProd - 9, 1).getValues(); 

&#x20;   for (let i = 0; i < prodData.length; i++) {

&#x20;     if (prodData\[i]\[0] === "" || prodData\[i]\[0] === null) {

&#x20;       filaDestino = 10 + i;

&#x20;       break;

&#x20;     }

&#x20;     if (i === prodData.length - 1) {

&#x20;       filaDestino = 10 + i + 1;

&#x20;     }

&#x20;   }

&#x20; }

&#x20; 

&#x20; // Preparar matriz de datos para Producción y escribir todo de una vez

&#x20; const datosProd = articulosAProcesar.map(item => \[idPedido, cliente, item.producto, item.variante, item.cantidad, "Pendiente"]);

&#x20; prodSheet.getRange(filaDestino, 1, datosProd.length, 6).setValues(datosProd);

&#x20; 

&#x20; // Copiar la fórmula de la Columna G (Total) a todas las nuevas filas

&#x20; const formulaRange = prodSheet.getRange("G10");

&#x20; formulaRange.copyTo(prodSheet.getRange(filaDestino, 7, datosProd.length, 1));

&#x20; 

&#x20; // --- LIMPIAR EL FORMULARIO ---

&#x20; formSheet.getRange("C4").clearContent();

&#x20; formSheet.getRange("B7:D21").clearContent();

&#x20; 

&#x20; // Mensaje de éxito

&#x20; SpreadsheetApp.getUi().alert(`✅ ¡Éxito! El pedido (${idPedido}) con ${articulosAProcesar.length} artículo(s) fue registrado.`);

}



