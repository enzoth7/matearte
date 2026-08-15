# Matriz de Variaciones del Mate y Mapeo de Variables (Pipeline IA & Frontend)

Este documento centraliza todas las variables físicas, interactivas e implícitas que definen la configuración del **Mate Customizer**, asegurando que tanto el frontend (React) como el pipeline de IA (OpenAI + Fal.ai) compartan el mismo conjunto de datos.

---

## 1. Modelos Base de Mates (`ModeloMate`)

El personalizador admite tres modelos geométricos principales que determinan la forma general de la copa:
1. **Imperial (`imperial`):** Posee virola superior ancha y permite una banda metálica horizontal intermedia (fleje).
2. **Torpedo (`torpedo`):** Cuerpo estilizado y curvo hacia adentro. No posee fleje central.
3. **Camionero (`camionero`):** Cuerpo ensanchado en la boca superior, virola de gran diámetro. No posee fleje central.

---

## 2. Inventario de Mates Reales (`MATES_REALES`)

Cada clave corresponde a una fotografía real de estudio (`1024x1024px`) calibrada con coordenadas de píxeles específicas para proyectar las curvas de personalización:

| Clave de Configuración (`key`) | Nombre Comercial (`label`) | Modelo Base (`modelo`) | Color de Cuero / Cuerpo | Material Base | Coordenadas de Virola (`defaultCenterY`, `defaultRadiusX`, `defaultRadiusY`) | Coordenadas de Fleje (`defaultFlejeCenterY`, `defaultFlejeRadiusX`, `defaultFlejeRadiusY`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`imperial_1`** | Imperial Marrón Premium | `imperial` | Moro / Marrón | Cuero vacuno | `(178, 114, 34)` | `(334, 68, 16)` |
| **`imperial_base_circular`** | Imperial Base Circular Negro | `imperial` | Negro | Cuero vacuno | `(180, 112, 34)` | `(334, 66, 16)` |
| **`impr_ceram_liso`** | Imperial Cerámica Negro | `imperial` | Negro (Esmalte) | Cerámica brillante | `(173, 112, 32)` | `(312, 70, 16)` |
| **`impr_ceram_liso2`** | Imperial Cerámica Marrón | `imperial` | Moro (Esmalte) | Cerámica brillante | `(173, 112, 32)` | `(312, 70, 16)` |
| **`torpedo_base`** | Torpedo Suela Clásico | `torpedo` | Suela (Marrón claro) | Cuero vacuno | `(178, 104, 32)` | *No aplica* |
| **`torpedo_1`** | Torpedo Negro Premium | `torpedo` | Negro | Cuero vacuno | `(178, 102, 32)` | *No aplica* |
| **`torpedo_2`** | Torpedo Marrón Rústico | `torpedo` | Moro / Marrón | Cuero vacuno | `(178, 102, 32)` | *No aplica* |
| **`torpedo_3`** | Torpedo Labrado Moro | `torpedo` | Moro / Labrado | Cuero vacuno | `(174, 102, 32)` | *No aplica* |
| **`camionero_2`** | Camionero Marrón Moro | `camionero` | Moro / Marrón | Cuero vacuno | `(175, 114, 34)` | *No aplica* |
| **`camionero_3`** | Camionero Suela | `camionero` | Suela (Marrón claro) | Cuero vacuno | `(180, 112, 32)` | *No aplica* |

---

## 3. Variables del Metal (`virolaMetal` y Patrones)

*   **Material de Virola y Fleje (`alpaca` | `bronce`):**
    *   `alpaca`: Acabado plateado brillante y frío (metal pulido similar a la plata).
    *   `bronce`: Acabado dorado cálido pulido.
*   **Patrones de Fleje (`FLEJE_OPTIONS`):**
    *   `fleje1`, `fleje2`, `fleje3`, `fleje4`, `fleje5`: Diseños cincelados / calados metálicos que rodean la cintura del mate (sólo para modelos `imperial`).

---

## 4. Personalización del Grabado (Variables de Entrada de la API)

Tanto para la **Virola (Boquilla)** como para el **Fleje (Banda horizontal)**, se controlan de forma independiente las siguientes variables:

### Grabado de Texto
*   **Texto a Grabar (`textoVirola` / `textoFleje`):** String alfanumérico en mayúsculas.
*   **Estilo del Grabado (`EstiloTexto`):**
    *   `bronce_relieve`: Letras tridimensionales doradas soldadas en relieve sobre el metal base.
    *   `laser_quemado`: Letras grabadas profundamente por láser en bajorrelieve oscuro/negruzco.
*   **Bandera de Activación (`boquillaIncluyeTexto` / `flejeIncluyeTexto`):** Boolean.

### Grabado de Logos/Vectores
*   **Archivo del Logo (`logoBoquillaUrl` / `logoFlejeUrl`):** Imagen vectorial en blanco y negro (silueta) subida por el usuario.
*   **Bandera de Activación (`boquillaIncluyeLogo` / `flejeIncluyeLogo`):** Boolean.

---

## 5. Variables Ocultas y Deducciones Heurísticas (Pipeline de Prompts)

Antes de enviar el prompt a la API de OpenAI (GPT-4o-mini Vision) para estructurar el render final, el frontend procesa heurísticamente el nombre del mate real seleccionado para derivar variables físicas que el usuario no configura a mano pero que son críticas para evitar alucinaciones en la IA:

```typescript
// Extracción de Color del Cuero
const colorCuero = selectedMateConfig?.label.toLowerCase().includes("negro") ? "negro" : "moro";

// Extracción del Material del Cuerpo
let materialBase = "leather";
if (selectedMateConfig) {
  const labelLower = selectedMateConfig.label.toLowerCase();
  if (labelLower.includes("cerámica") || labelLower.includes("ceramica")) {
    materialBase = "smooth glazed ceramic (strictly no leather, shiny ceramic finish)";
  } else if (labelLower.includes("vidrio")) {
    materialBase = "glass";
  } else if (labelLower.includes("madera")) {
    materialBase = "polished wood";
  } else {
    materialBase = "leather";
  }
}
```

---

## 6. Diagrama de Mapeo de Variables (Frontend -> Backend/Vision -> Fal.ai)

```
[FRONTEND STATE]
  |- selectedMateKey (e.g. "impr_ceram_liso")
  |- textoVirola ("ENZO")
  |- estiloTextoVirola ("bronce_relieve")
  |- virolaMetal ("alpaca")
        |
        v [Deducción Heurística en React]
  |- colorCuero = "negro"
  |- materialBase = "smooth glazed ceramic"
        |
        v [OpenAIRequest DTO]
  {
    textoVirola: "ENZO",
    colorCuero: "negro",
    materialVirola: "alpaca",
    materialCuerpo: "smooth glazed ceramic",
    fotoMateRealUrl: (Base64 del canvas de referencia pre-estampado)
  }
        |
        v [GPT-4o-mini Vision Prompt Engineer]
  Genera Prompt Técnico en Inglés:
  "A professional crisp DSLR commercial product photograph... smooth glazed black ceramic,
   the word 'ENZO' custom-welded in raised 3D gold-colored brass letters..."
        |
        v [Llamada a Fal.ai Inpainting]
  fal.run/fal-ai/flux-general/inpainting (o flux-pro/v1/fill) con:
  - image_url: (Composite pre-estampado del Canvas)
  - mask_url: (Máscara quirúrgica del contorno de "ENZO")
  - prompt: (Prompt técnico generado por OpenAI Vision)
  - strength: 0.28
```
