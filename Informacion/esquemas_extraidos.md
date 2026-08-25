# Extracción de los nuevos esquemas de Enzo (Agosto 2026)

## CAMIONERO (Base: 1800 UYU)

### Tipo/Cuero
- "Camionero Alpaca Cincelado con patas" → delta: 0

### Colores
| Color        | Delta |
|-------------|-------|
| Natural     | 0     |
| Cuero Crudo | 600   |
| Marrón      | 0     |
| Negro       | 0     |

### Virola/Metal
- Alpaca → delta: 0

### Tamaños
| Tamaño   | Delta |
|---------|-------|
| Chico   | 0     |
| Mediano | 0     |
| Grande  | 0     |

### Grabado
- **VIROLA: SÍ** → Láser, Aplique de Bronce, Aplique de Alpaca
- **FLEJE: NO CORRESPONDE**

---

## CRIOLLO (Base: ??? — no se ve base explícita en imagen, las texturas tienen precio propio)

### Tipo/Cuero (3 sub-familias)
| Textura                     | Delta |
|----------------------------|-------|
| Torpedo Criollo Posa Mate  | 1300  |
| Imperial Criollo Posa Mate | 1900  |
| Camionero Criollo Posa Mate| 1300  |

### Colores (iguales para las 3 texturas)
| Color       | Delta |
|------------|-------|
| Vaqueta    | 400   |
| Cuero Crudo| 650   |

### Virola/Metal
- Solo "Torpedo Criollo" y "Imperial Criollo" tienen Alpaca (delta 0):
  - **Torpedo Criollo**: Alpaca Grande (0), Alpaca Grande al Lacre (2500)
  - **Imperial Criollo**: Alpaca Grande (0), Alpaca Grande al Lacre (3000)
- Camionero Criollo: NO se muestra paso virola/metal (no converge al nodo alpaca)

### Tamaños (todos)
| Tamaño   | Delta |
|---------|-------|
| Chico   | 0     |
| Mediano | 0     |
| Grande  | 0     |

### Grabados (sección inferior de la imagen Criollo)
- **Torpedo**: VIROLA DE TORPEDO → Aplique de Bronce, Aplique de Alpaca. NO CORRESPONDE FLEJE.
- **Imperial**: VIROLA SÍ → Láser, Aplique de Bronce, Aplique de Alpaca. FLEJE SÍ → Aplique de Bronce, Aplique de Alpaca.
- **Camionero**: VIROLA SÍ → Láser, Aplique de Bronce, Aplique de Alpaca. NO CORRESPONDE FLEJE.

---

## TORPEDO (Base: 1800 UYU)

### Tipo/Cuero
| Textura                  | Delta |
|-------------------------|-------|
| Cuero Liso (CL)         | 0     |
| Cuero Estampado (CE)    | 200   |
| Cuero Crudo (CCrudo)    | 600   |
| Print / Pelos (CPelos)  | 600   |

### Colores
**Cuero Liso**: Natural (0), Negro (0), Marrón (0)
**Cuero Estampado**: Marrón (0), Negro (0), Natural (0)
**Cuero Crudo**: Marrón (0), Negro (0), Natural (0)
**Print/Pelos**: Marrón y Blanco (0), Negro y Blanco (0), Animal Print (0)

### Virola/Metal (Tipo Alpaca)
| Metal           | Delta |
|----------------|-------|
| Alpaca y Bronce| 300   |
| Alpaca Común   | 0     |
| Alpaca Grande  | 300   |

Igual para las 4 texturas.

### Tamaños (todos)
| Tamaño   | Delta |
|---------|-------|
| Chico   | 0     |
| Mediano | 0     |
| Grande  | 0     |

### Grabado
- **VIROLA DE TORPEDO** → Aplique de Bronce, Aplique de Alpaca
- **NO CORRESPONDE FLEJE**
- **NOTA**: Torpedo NO tiene Láser

---

## IMPERIAL (Base: 2600 UYU)

### Tipo/Cuero
| Textura           | Delta  |
|------------------|--------|
| Cincelado Premium| 3000   |
| Imperial Clásico | 0      |
| Virola Plata 900 | 17500  |

### Colores
**Cincelado Premium**: Pelos Animal Print (600), Negro (0), Marrón (0), Natural (0), Print/Pelos Marrón y Blanco (600), Print/Pelos Blanco y Negro (600), Cuero Crudo (600)
**Imperial Clásico**: Natural (0), Negro (0), Marrón (0)
**Virola Plata 900**: Cuero Crudo (0), Negro (0), Marrón (0), Natural (0), Print (600), Crudo (600), Criollo (0)

### Virola/Metal
- Cincelado Premium e Imperial Clásico: **no se muestra paso metal** (ya incluida)
- Virola Plata 900: **Plata 900** → delta 0

### Tamaños
| Tamaño   | Delta |
|---------|-------|
| Chico   | 0     |
| Mediano | 0     |
| Grande  | 0     |

### Grabado
- **VIROLA SÍ** → Láser, Aplique de Bronce, Aplique de Alpaca
- **FLEJE SÍ** → Aplique de Bronce, Aplique de Alpaca

---

## GRABADOS Y FLEJE (precios de grabado)

### Grabados (aplican a virola y/o fleje según familia)
| Tipo                       | Precio                        |
|---------------------------|-------------------------------|
| Láser                     | 300 UYU (no depende de escudos ni letras) |
| Apliques de Bronce o Plata| 150 UYU cada letra o número   |
|                           | 400 UYU cada escudo o bandera |

### Fleje
- Hasta 14 escudos/íconos (este es un límite nuevo)

---

## CAMBIOS CLAVE vs esquema actual:

1. **NUEVO tipo de grabado**: "Aplique de Alpaca" (antes solo existían "laser" y "bronze-applique")
2. **Grabados diferenciados por VIROLA vs FLEJE**: El usuario quiere que el usuario pueda elegir "para la virola qué aplique querés" y "para el fleje qué aplique querés" por separado
3. **Torpedo NO tiene Láser** — solo apliques
4. **Fleje: máximo 14 íconos** (antes era 3 como la virola)
5. **Pricing de apliques**: 150 UYU por letra/número, 400 UYU por escudo/bandera (pricing por unidad)
6. **Pricing de Láser**: 300 UYU flat (no importa cantidad de letras/escudos)
7. **Imperial Plata 900**: textura nueva con delta 17500
8. **Criollo**: Es una familia nueva con 3 sub-texturas (Torpedo Criollo, Imperial Criollo, Camionero Criollo)
9. **Torpedo Alpaca y Bronce/Alpaca Grande**: deltas de 300 (antes era distinto)
