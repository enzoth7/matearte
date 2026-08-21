/**
 * SISTEMA CON PRIMARY KEY E INSPECCIÓN DE CLIENTE (COL B)
 * -------------------------------------------------------------------
 * Estructura "Producción":
 * Col A (1): ID Pedido | Col B (2): Cliente | Col C (3): Modelo | Col D (4): Variante | Col E (5): Cantidad | Col F (6): Estado | Col G (7): Total $ ARG
 * 
 * Estructura "Pedidos Históricos":
 * Col A (1): ID Pedido | Col B (2): Fecha Creación | Col C (3): Cliente | Col D (4): Modelo | Col E (5): Variante | Col F (6): Cantidad | Col G (7): Fecha Completado
 */

function onEdit(e) {
  if (!e || !e.range) return;
  
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  const sheetName = sheet.getName().trim();
  
  // 1. Botón de casilla para "Agregar Pedido" (D12 en "Nuevo Pedido")
  if (sheetName === "Nuevo Pedido" && range.getA1Notation() === "D12" && range.getValue() === true) {
    agregarPedido();
    range.setValue(false); // Desmarca la casilla automáticamente
    return;
  }
  
  // 2. Eliminar de Producción al marcar "Completado" (Columna F / 6 en Producción)
  if (sheetName === "Producción" && range.getColumn() === 6 && range.getRow() >= 10) {
    const estado = String(range.getValue()).trim();
    
    if (estado === "Completado") {
      const fila = range.getRow();
      
      // Leer datos del pedido en Producción
      const idPedido = sheet.getRange(fila, 1).getValue(); // Columna A
      const cliente  = sheet.getRange(fila, 2).getValue(); // Columna B
      const producto = sheet.getRange(fila, 3).getValue(); // Columna C
      const variante = sheet.getRange(fila, 4).getValue(); // Columna D
      const cantidad = sheet.getRange(fila, 5).getValue(); // Columna E
      
      // Asentar fecha de completado en Pedidos Históricos
      if (cliente !== "") {
        try {
          const ss = e.source;
          const dbSheet = ss.getSheetByName("Pedidos Históricos");
          if (dbSheet) {
            const lastRowHist = dbSheet.getLastRow();
            if (lastRowHist >= 2) {
              const datos = dbSheet.getRange(1, 1, lastRowHist, 7).getValues();
              const fechaAhora = new Date();
              let encontrado = false;
              
              function norm(txt) {
                return String(txt || "").trim().toLowerCase();
              }
              
              // PASO 1: Si tiene ID Pedido, buscar por ID Pedido (Columna A / Índice 0)
              if (idPedido && String(idPedido).trim() !== "") {
                for (let i = datos.length - 1; i >= 1; i--) {
                  if (String(datos[i][0]).trim() === String(idPedido).trim()) {
                    dbSheet.getRange(i + 1, 7).setValue(fechaAhora); // Columna G
                    encontrado = true;
                    break;
                  }
                }
              }
              
              // PASO 2 (Respaldo para pedidos viejos sin ID): Buscar por Cliente, Modelo, Variante, Cantidad
              if (!encontrado) {
                const pCli  = norm(cliente);
                const pProd = norm(producto);
                const pVar  = norm(variante);
                const pCant = String(cantidad).trim();
                
                for (let i = datos.length - 1; i >= 1; i--) {
                  const hCli  = norm(datos[i][2]); // Columna C (Cliente en Histórico con ID)
                  const hProd = norm(datos[i][3]); // Columna D (Modelo en Histórico)
                  const hVar  = norm(datos[i][4]); // Columna E (Variante en Histórico)
                  const hCant = String(datos[i][5]).trim(); // Columna F (Cantidad en Histórico)
                  const hFechaComp = datos[i][6]; // Columna G (Fecha Completado)
                  
                  const sinFecha = (!hFechaComp || String(hFechaComp).trim() === "");
                  
                  if (sinFecha && hCli === pCli && hProd === pProd && hCant === pCant) {
                    dbSheet.getRange(i + 1, 7).setValue(fechaAhora); // Columna G
                    break;
                  }
                }
              }
            }
          }
        } catch (err) {
          // Ignorar error para no bloquear la eliminación en Producción
        }
      }
      
      // ELIMINAR LA FILA DE PRODUCCIÓN
      sheet.deleteRow(fila);
    }
  }
}

function agregarPedido() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const formSheet = ss.getSheetByName("Nuevo Pedido");
  const dbSheet = ss.getSheetByName("Pedidos Históricos");
  const prodSheet = ss.getSheetByName("Producción");
  
  // Leer datos del formulario
  const cliente = formSheet.getRange("C4").getValue();
  const producto = formSheet.getRange("C6").getValue();
  const variante = formSheet.getRange("C8").getValue();
  const cantidad = formSheet.getRange("C10").getValue(); 
  
  // Validaciones
  if (cliente === "" || producto === "" || variante === "" || cantidad === "") {
    SpreadsheetApp.getUi().alert("⚠️ Error: Todos los campos son obligatorios.");
    return; 
  }
  
  if (isNaN(cantidad) || cantidad <= 0) {
    SpreadsheetApp.getUi().alert("⚠️ Error: La cantidad debe ser un número mayor a 0.");
    return;
  }
  
  // GENERAR ID ÚNICO AUTOGENERADO (ejemplo: PED-849201)
  const idPedido = "PED-" + Math.floor(100000 + Math.random() * 900000);
  const fechaCreacion = new Date();
  
  // 1. BUSCAR FILA LIBRE EN PEDIDOS HISTÓRICOS (Evaluando Cliente en Columna C)
  let filaLibreHist = 2;
  const lastRowHist = dbSheet.getLastRow();
  if (lastRowHist >= 2) {
    const dbData = dbSheet.getRange(2, 3, lastRowHist - 1, 1).getValues(); // Lee Columna C (Cliente)
    for (let i = 0; i < dbData.length; i++) {
      if (dbData[i][0] === "" || dbData[i][0] === null) {
        filaLibreHist = 2 + i;
        break;
      }
      if (i === dbData.length - 1) {
        filaLibreHist = 2 + i + 1;
      }
    }
  } else {
    filaLibreHist = 2;
  }
  
  // Registrar en Histórico (ID, Fecha Creación, Cliente, Modelo, Variante, Cantidad)
  dbSheet.getRange(filaLibreHist, 1, 1, 6).setValues([[idPedido, fechaCreacion, cliente, producto, variante, cantidad]]);
  
  // 2. BUSCAR FILA LIBRE EN PRODUCCIÓN (Evaluando Cliente en Columna B desde Fila 10)
  let filaDestino = 10;
  const lastRowProd = prodSheet.getLastRow();
  if (lastRowProd >= 10) {
    const prodData = prodSheet.getRange(10, 2, lastRowProd - 9, 1).getValues(); // Lee Columna B (Cliente)
    for (let i = 0; i < prodData.length; i++) {
      if (prodData[i][0] === "" || prodData[i][0] === null) {
        filaDestino = 10 + i;
        break;
      }
      if (i === prodData.length - 1) {
        filaDestino = 10 + i + 1;
      }
    }
  } else {
    filaDestino = 10;
  }
  
  // Escribir en Producción a partir de la filaDestino (Mínimo Fila 10)
  prodSheet.getRange(filaDestino, 1, 1, 6).setValues([[idPedido, cliente, producto, variante, cantidad, "Pendiente"]]);
  
  // Copiar la fórmula de la Columna G (Total) desde G10 a la nueva fila
  prodSheet.getRange("G10").copyTo(prodSheet.getRange("G" + filaDestino));
  
  // Limpiar el formulario
  formSheet.getRange("C4").clearContent();
  formSheet.getRange("C6").clearContent();
  formSheet.getRange("C8").clearContent();
  formSheet.getRange("C10").clearContent();
  
  // Mensaje de éxito
  SpreadsheetApp.getUi().alert("✅ ¡Éxito! El pedido (" + idPedido + ") fue registrado en la fila " + filaDestino + " de Producción.");
}
