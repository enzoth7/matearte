# Resumen de Reuniones, Respuestas y Relevamiento Técnico — Matearte

Este documento consolida el historial de propuestas, respuestas, cuestionarios técnicos y relevamientos de las reuniones del **17 de junio** y **25 de junio de 2026** entre Matearte y Polarist.

---

## 1. Hito de Propuesta Inicial y Negociación (18/6 - 23/6)

*   **Propuesta Inicial (18/6):** Julieta (CMO) presentó una propuesta comercial estructurada en 3 planes comerciales diferentes (detallados en [Propuesta_Matearte.html](file:///c:/Orchestrator/Agente%20de%20Negocios/Projects/Polarist/Clientes/Matearte/Propuesta_Matearte.html)).
*   **Respuesta de Matearte (23/6):** Richard y Flor manifestaron interés en:
    *   La automatización del proceso de personalización.
    *   La organización digital de pedidos y el soporte para el área de producción.
    *   La integración con su tienda online actual.
    *   Sistemas de automatización comercial y seguimiento de clientes.
    Solicitaron coordinar una reunión técnica para el 25/6.

---

## 2. Cuestionario Técnico y Respuestas (24/6 - 25/6)

Polarist envió 5 preguntas previas para preparar la reunión, las cuales fueron respondidas por Richard el 25/6:

1.  **Maquinaria y Software en Uso:**
    *   **Grabado en Cuero:** Utilizan el software **LightBurn** para controlar dos máquinas de grabado láser en cuero (una de fibra láser y otra CNC láser).
    *   **Apliques de Bronce:** El cuello de botella operativo. Diseñan en **Inkscape**, exportan en formato de trayecto **Gcode** y lo operan en la fresadora/router mediante el software de control **NCStudio**.
2.  **Plataforma Web:**
    *   La tienda online está desarrollada sobre **Shopify**.
    *   *Credenciales de acceso:* `matearte.ventas@gmail.com` / `MA2026arteytradicion` (Requiere código de verificación 2FA enviado al celular para ingresar).
3.  **Proceso de Diseño Actual:**
    *   Los pedidos se registran a mano en una libreta de pedidos en papel. Richard concuerda en que lo óptimo es que el cliente diseñe su propio mate de forma interactiva en la web y posicione los apliques a su gusto.
4.  **Catálogo de Mates y Variantes de Personalización:**
    *   Los tres modelos más personalizados son:
        1.  **Mate Imperial:** Cuenta con 6 flejes disponibles.
        2.  **Mate Torpedo:** Cuenta con 3 bocas diferentes.
        3.  **Mate Camionero.**
    *   *Variantes comunes:* Virolas personalizadas y dos estilos de cincelados: **Clásico** y **Premium**.
5.  **Preferencia de Costos del Configurador Web:**
    *   Abiertos a utilizar herramientas listas con costo de suscripción (ej. USD 70/mes) si simplifica y optimiza el proceso manual del taller, delegando la decisión técnica en la recomendación final de Polarist.

---

## 3. Relevamiento Técnico del Proceso CNC (25/6)
Detalle del flujo de trabajo de Richard para la fabricación de los apliques de bronce del mate, extraído del análisis de la llamada y de los videos instructivos enviados:

1.  **Generación de la Imagen con IA:**
    *   Usa ChatGPT Plus desde el celular.
    *   Sube una imagen de referencia y solicita con un prompt: *"Armame esta imagen con las mismas características de la anterior"*.
2.  **Vectorización y Edición en Inkscape:**
    *   Descarga el PNG generado.
    *   Abre una plantilla de diseño reciente en Inkscape.
    *   Borra el diseño anterior de la plantilla y pega la nueva imagen PNG.
    *   Accede a **Trayecto -> Vectorizar mapa de bits**. Regula el umbral de vectorización para obtener un trazado limpio y continuo.
    *   Elimina la imagen de mapa de bits original (dejando solo el trazado vectorial).
    *   En el panel de **Relleno y borde**:
        *   *Relleno:* Configura en **Sin Relleno**.
        *   *Color de trazo:* Configura en **Color Uniforme**.
        *   *Estilo de trazo:* Configura el ancho en `0.01` o `0.005`.
    *   Bloquea la relación de aspecto en el panel superior (candado).
    *   Alinea el trazo en las coordenadas de origen `X = 0`, `Y = 0`.
    *   Ajusta la altura del vector en milímetros de acuerdo al tamaño del aplique (ej. `23` mm para apliques grandes, menos para apliques de 20 mm).
    *   Accede a **Trayecto -> Objeto a trayecto**.
    *   Aplica la extensión **GcodeTools -> Trayecto a Gcode** para exportar el archivo en código Gcode.
3.  **Operación en NCStudio y Fresado:**
    *   Abre el software de control del router **NCStudio**.
    *   Usa el clic derecho y selecciona **Top View** para alinear la perspectiva desde arriba.
    *   Coloca físicamente la chapa de bronce sobre la mesa de trabajo del router.
    *   Mueve el cabezal en los ejes X e Y hasta ubicarlo en el punto exacto de la chapa donde desea que inicie el grabado.
    *   Establece en cero (`0.00`) las coordenadas de X e Y en el software. El eje Z no se modifica, ya que su altura de calibración está preconfigurada en la plantilla de origen.
    *   Va a la sección **Abrir** y selecciona el archivo Gcode generado en Inkscape.
    *   Valida límites del grabado con la vista previa del software.
    *   Presiona **F9** para iniciar el maquinado del router CNC.
4.  **Trabajo Manual Posterior:**
    *   Finalizado el grabado, se requiere calar el aplique, soldarlo, pulirlo y acondicionar las chapas de bronce (cada chapa rinde para unos 4 o 5 apliques antes de requerir un cambio físico).

---

## 4. Riesgos y Soluciones Identificadas

*   **Feria del Prado (Septiembre):** Richard viaja durante 15 días a Montevideo. Esto detiene la producción y la preparación previa de stock durante casi un mes, provocando un retraso acumulado grave en las entregas.
*   **Dependencia Operativa:** Flor (quien toma los pedidos) no sabe diseñar apliques en Inkscape ni operar NCStudio/CNC.
*   **Solución NotebookLM:** Crear un asistente virtual interactivo en NotebookLM alimentado con grabaciones de voz y videos de pantalla paso a paso provistos por Richard. Permitirá a Flor resolver dudas técnicas en tiempo real sobre Inkscape y la operación del CNC en ausencia de Richard.
*   **Digitalización de Base de Datos:** Migrar los ~7,000 contactos y el registro de pedidos de papel a una base de datos en Airtable o Excel en línea para automatizar campañas de WhatsApp.
*   **Prototipo de Personalizador Web:** Polarist desarrollará un prototipo inicial y básico del personalizador para validar su viabilidad técnica en Shopify antes de su despliegue final.

---

## 5. Estrategia Comercial y Siguientes Pasos

*   **Subsidio ANDE (Agencia Nacional de Desarrollo):** Richard se postulará a una ayuda económica de la ANDE para proyectos de digitalización y modernización que cubre entre el 70% y el 80% del costo total.
*   **Rediseño Web Ampliado:** Para aprovechar el financiamiento de la ANDE, Richard solicitó incluir el desarrollo integral de la página web de la empresa (actualmente sin mantenimiento ni tráfico orgánico) dentro del presupuesto de Polarist.
*   **Visita Técnica de Enzo:** Enzo realizará una visita presencial al taller y local de Matearte en Paysandú (mañana o el sábado) para relevar físicamente la maquinaria CNC, comprender el proceso in situ y cerrar los detalles de la propuesta comercial completa con opciones que encajen en el régimen de subsidio de la ANDE.
