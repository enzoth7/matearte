# Análisis del Organigrama y Estructura Operativa — Matearte
*Fecha: 2 de julio de 2026*

Este documento detalla la estructura organizativa de Matearte a partir del relevamiento del organigrama gráfico provisto por Richard Ortiz, identifica los cuellos de botella del flujo actual de trabajo y describe el impacto directo del desarrollo de software y automatizaciones de Polarist.

---

## 1. Estructura Organizativa Actual (Relevamiento)

*   **Dirección General / CEO (Richard Ortiz):**
    *   Foco: Estrategia, desarrollo de nuevos productos, expansión nacional e internacional, alianzas.
*   **Área Comercial (Florencia Costa):**
    *   Foco: Atención al público en local físico y ventas en redes sociales (WhatsApp, Instagram, Facebook).
    *   Tareas: Recepción manual de pedidos personalizados, cobros, entregas y control de stock del local.
*   **Área de Operaciones (Florencia Pizzorno):**
    *   Foco: Coordinación central, administración general, compras y facturación.
    *   Tareas: Planificación de la producción de pedidos personalizados, seguimiento de estados, coordinación ventas-producción, operación física de las máquinas grabadoras láser y elaboración manual de los apliques de bronce.
*   **Área de Producción (Nicolás - Encargado):**
    *   Foco: Organización de la producción física y control de calidad.
    *   Equipo:
        *   **Rovert:** Armado físico de mates.
        *   **Julio:** Armado de bocas cinceladas y personalizadas.
*   **Área de Marketing (Betiana):**
    *   Foco: Planificación de contenido, gestión de redes sociales, campañas digitales y posicionamiento de marca.

---

## 2. Cuellos de Botella y Fricciones Detectadas

### A. Sobrecarga Operativa y de Gestión en Operaciones (Florencia Pizzorno)
*   **Situación:** Florencia Pizzorno concentra tareas puramente administrativas (facturación, cobros, compras) y tareas productivas físicas críticas (operación del láser, elaboración de apliques de bronce, planificación de producción y seguimiento).
*   **Riesgo:** Esta mezcla de gestión y producción física genera un cuello de botella de alta dependencia. Si las tareas administrativas aumentan (por ejemplo, en temporada de alta demanda), la producción física del taller se ralentiza, retrasando las entregas.

### B. Fricción y Margen de Error en el Traspaso Manual de Pedidos (Ventas $\rightarrow$ Operaciones $\rightarrow$ Producción)
*   **Situación:** Hoy el pedido personalizado pasa de forma verbal o por mensajes informales por tres personas antes de ser ejecutado (Flor Costa toma el dato del cliente en la libreta $\rightarrow$ Flor Pizzorno organiza y planifica el pedido $\rightarrow$ Nicolás lo asigna en el taller).
*   **Riesgo:** Al depender de la transcripción manual de virolas, flejes y tipos de cincelado, el margen de error humano es alto. Requiere un esfuerzo constante de coordinación cruzada para asegurar que el taller arme exactamente lo que el cliente pidió.

### C. Dependencia de Información en el Taller (Producción $\rightarrow$ Operaciones)
*   **Situación:** El equipo de producción (Nicolás, Rovert, Julio) no tiene acceso directo a la cola de pedidos pendientes en tiempo real. Dependen de que la Coordinadora de Operaciones les baje la planificación de la libreta física al pizarrón o taller.
*   **Riesgo:** Imposibilidad de autoplanificación. Producción no puede adelantarse a la demanda preparando stock específico de bocas o mates antes de que el pedido sea "bajado" formalmente por operaciones.

---

## 3. Impacto del Sistema Polarist en el Flujo de Trabajo

La implementación del configurador interactivo, la base de datos centralizada (Airtable) y el asistente técnico (NotebookLM) mitiga directamente estas fricciones:

### 1. Descongestión del Área de Operaciones
*   **Acción:** El pipeline digital automatiza el seguimiento de pedidos y actualiza los estados sin intervención manual. 
*   **Resultado:** Florencia Pizzorno se libera de la carga de coordinación de estados, pudiendo enfocarse en la administración o en optimizar el tiempo de grabado láser.

### 2. Eliminación de Errores de Traspaso (Ficha Digital Única)
*   **Acción:** El cliente diseña el mate de forma interactiva en la tienda Shopify. La orden entra automáticamente al sistema con los detalles visuales exactos y la chapa de bronce seleccionada.
*   **Resultado:** Se elimina la libreta de papel. El taller recibe una ficha de producción digital exacta y estandarizada, reduciendo el margen de error a cero en la toma de pedidos.

### 3. Autonomía y Planificación en Producción
*   **Acción:** Nicolás y su equipo tienen una pantalla o tablet con la cola de pedidos digitalizada en Airtable en tiempo real, clasificada por prioridad de entrega y tipo de mate (Imperial, Torpedo, Camionero).
*   **Resultado:** Producción puede planificar sus insumos y adelantarse en el cincelado o armado de mates con base en la demanda real que entra al sitio web.

### 4. Soporte Técnico Autónomo del Taller (NotebookLM)
*   **Acción:** El asistente de IA entrenado con los videos del proceso CNC y configuración de Inkscape/NCStudio sirve como soporte para resolver dudas técnicas del taller en tiempo real.
*   **Resultado:** Reduce la dependencia de Richard ante problemas técnicos y permite que otros operarios resuelvan descalibraciones menores de forma autónoma.
