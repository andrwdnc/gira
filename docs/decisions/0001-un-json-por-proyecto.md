# ADR 0001 — Un archivo JSON por proyecto

- **Estado:** aceptada
- **Fecha:** 2026-10-17

## Contexto
El estado debe sincronizarse entre dos PCs usando solo git. Un único `data.json` con todos los proyectos haría que cualquier cambio en dos proyectos distintos tocara el mismo archivo y aumentara la probabilidad de conflictos.

## Decisión
Cada proyecto se guarda en su propio archivo `data/<slug>.json`. El orden de las tareas es el orden del array (sin campos de posición) y el JSON se serializa con formato estable (2 espacios, claves en orden fijo, salto de línea final).

## Consecuencias
- Editar proyectos distintos en cada PC no genera conflictos.
- Los diffs de git son pequeños y legibles.
- Renombrar un proyecto no renombra el archivo, para no romper el historial.
- Dos PCs editando **el mismo proyecto** sin `pull` intermedio pueden seguir generando conflictos; se mitiga con el hábito de hacer `pull` al empezar y `push` al terminar.
