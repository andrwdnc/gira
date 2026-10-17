# ADR 0003 — Lectura de disco sin caché

- **Estado:** aceptada
- **Fecha:** 2026-10-17

## Contexto
Los JSON pueden cambiar fuera de la aplicación, por ejemplo con un `git pull`. Si el servidor mantuviera los datos en memoria, habría que reiniciarlo para ver los cambios, y una escritura posterior podría sobrescribir lo recién traído por git.

## Decisión
- El servidor lee el JSON desde disco en cada petición; no hay caché.
- Las escrituras son atómicas (archivo temporal + `rename`) y se serializan por proyecto.
- Si un JSON no se puede parsear, no se modifica y se informa del error.

## Consecuencias
- Tras un `git pull` basta con recargar la página para ver los cambios.
- Se evita pisar cambios externos y se protege un archivo con marcadores de conflicto.
- El coste de leer un archivo pequeño por petición es despreciable para este uso.
