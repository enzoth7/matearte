# MateArte Operaciones

Dashboard interno construido a partir de `MATEARTE.xlsx` y la lógica de `Script.md`.

## Funciones

- Resumen de unidades, estados y valor de producción.
- Alta de pedidos con hasta 15 artículos bajo un único ID.
- Cambio de estado y cierre de líneas de producción.
- Histórico consultable y exportable a CSV.
- Catálogo editable, conversión ARG → UYU y recálculo de totales.
- Persistencia automática en `localStorage` del navegador.

## Desarrollo

```bash
pnpm install
pnpm dev
```

La aplicación queda disponible en `http://localhost:5175`.

## Verificación

```bash
pnpm test
pnpm build
```

## Persistencia

Esta primera versión es local-first: cada navegador guarda su propia copia. Para uso simultáneo por varias personas, el siguiente paso es conectar el mismo modelo de datos a una base compartida con autenticación.
