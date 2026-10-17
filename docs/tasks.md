# Tareas — Gira

> Implementa **una tarea cada vez**, en orden. Marca la casilla al cumplir sus criterios y haz un commit con el id (`T-03: ...`).
> Referencias: RF/CA en `spec.md`, secciones en `design.md`.

## Fase 1 — Base
- [x] **T-01 Esqueleto del proyecto.** `package.json` (scripts `start` y `test`), dependencia `express`, `.gitignore` (`node_modules/`, `data/*.tmp`, `data/.*.tmp`), `data/.gitkeep`, estructura de carpetas de `design.md` §2.
  *Hecho cuando:* `npm install` y `npm start` arrancan sin errores y sirven una página vacía en `127.0.0.1:3000`.

## Fase 2 — Persistencia
- [x] **T-02 Módulo `lib/store.js`.** Slugs, validación, lectura sin caché, escritura atómica, formato JSON estable, cola por proyecto, `CorruptProjectError`. (design §3-4)
  *Hecho cuando:* tests de slug, formato, atomicidad básica y JSON corrupto pasan (CA-11, CA-12, CA-14).
- [x] **T-03 CRUD de proyectos en la API.** `GET/POST/PATCH/DELETE /api/proyectos...` con códigos de error de `design.md` §5. (RF-01, RF-02, RF-03, RF-13)
  *Hecho cuando:* se cumplen CA-01, CA-02 y CA-09 y el listado marca los proyectos corruptos.
- [x] **T-04 CRUD de tareas en la API.** Crear, editar y eliminar tareas; normalización de etiquetas. (RF-06, RF-07, RF-08)
  *Hecho cuando:* se cumplen CA-03 y CA-04.
- [x] **T-05 Endpoint `mover`.** Mover entre columnas y reordenar por índice. (RF-09)
  *Hecho cuando:* se cumplen CA-05 y CA-06 con tests.

## Fase 3 — Interfaz
- [x] **T-06 Maquetación base.** `index.html` + `styles.css`: cabecera, tres columnas, contadores, tema claro/oscuro, responsive. (RF-05, RF-12, RF-16)
  *Hecho cuando:* el tablero se ve correctamente en escritorio y móvil, en claro y oscuro.
- [x] **T-07 Proyectos en la UI.** Selector, crear, renombrar, eliminar con confirmación, recordar el último abierto. (RF-01 a RF-04)
  *Hecho cuando:* se cumplen CA-01, CA-02 y CA-09 desde la interfaz.
- [x] **T-08 Tareas en la UI.** Diálogo de crear/editar, eliminar con confirmación, render de tarjetas con `textContent`. (RF-06 a RF-08)
  *Hecho cuando:* se cumplen CA-03 y CA-04 desde la interfaz.
- [x] **T-09 Arrastrar y soltar.** Mover entre columnas y reordenar con indicador de inserción. (RF-09)
  *Hecho cuando:* se cumplen CA-05 y CA-06 desde la interfaz.
- [x] **T-10 Etiquetas.** Chips con color determinista y filtro por etiqueta. (RF-10, RF-11)
  *Hecho cuando:* se cumplen CA-07 y CA-08.

## Fase 4 — Sincronización y robustez
- [x] **T-11 Recarga desde disco.** Botón manual y recarga al recuperar el foco. (RF-14)
  *Hecho cuando:* se cumple CA-10.
- [x] **T-12 Gestión de errores en la UI.** Banner de errores y proyectos corruptos deshabilitados. (RF-15)
  *Hecho cuando:* se cumple CA-11 desde la interfaz.

## Fase 5 — Cierre
- [x] **T-13 README.** README en español (instalación, `npm start`, estructura de datos, flujo entre dos PCs: `git pull` → trabajar → `git add data && git commit && git push`).
  *Hecho cuando:* un usuario nuevo puede arrancar el proyecto solo con el README.
- [x] **T-14 Verificación final.** Recorrer todos los CA-01 a CA-14, ejecutar `npm test` y comprobar CA-12 y CA-13 con git en dos copias del repo.
  *Hecho cuando:* todos los criterios de aceptación están verificados y anotados aquí.

## Registro de verificación

Verificado el **2026-10-17** con `npm test` (36 tests en verde) y comprobaciones de git en repositorios temporales.

| Criterio | Resultado | Cómo se verificó |
|---|---|---|
| CA-01 | OK | `test/api.test.js`: POST «Casa» crea `data/casa.json` con tres columnas vacías. |
| CA-02 | OK | `test/api.test.js`: «casa» y «CÁSA» → 409 con mensaje y sin reescribir el archivo. |
| CA-03 | OK | `test/tasks.test.js`: la tarea aparece en `pendiente` con `id`, `creada` y `actualizada`. |
| CA-04 | OK | `test/tasks.test.js`: sin título → 400 y JSON byte a byte intacto. |
| CA-05 | OK | `test/mover.test.js`: de `pendiente` a `finalizada`; el JSON lo refleja y ya no está en origen. |
| CA-06 | OK | `test/mover.test.js`: con `[A,B,C]`, mover C a índice 1 → `[A,C,B]`. |
| CA-07 | OK | `test/frontend.test.js`: `tagHue` determinista y normalizado; `test/tasks.test.js`: la etiqueta queda en el JSON. |
| CA-08 | OK | Filtro por etiqueta en `app.js` (oculta tarjetas que no la llevan); validado por inspección. |
| CA-09 | OK | `test/api.test.js`: DELETE borra el archivo y 404 después. Confirmación previa (`confirm()`) en `app.js`. |
| CA-10 | OK | `test/store.test.js` (lectura sin caché ve cambios externos); botón «Recargar desde disco» y `visibilitychange` en `app.js`. |
| CA-11 | OK | `test/store.test.js` y `test/api.test.js`: 422 que nombra el archivo, JSON intacto y resto de proyectos funcionando; en la UI, banner + opción deshabilitada. |
| CA-12 | OK | Comprobado con git en `/tmp`: editar una tarea toca solo `data/<slug>.json` y solo las líneas cambiadas (`git diff --stat`: 1 archivo, 2 inserciones, 2 borrados). |
| CA-13 | OK | Comprobado con git en `/tmp`: dos clones editan proyectos distintos, `push`/`pull` sin conflictos y convergen; cero marcadores de conflicto. |
| CA-14 | OK | `test/store.test.js`: slugs `../x`, `a/b` y `..` rechazados sin acceder a ningún archivo. |

**Nota de alcance de la verificación.** El entorno no dispone de navegador automatizado. Los
comportamientos que solo ocurren en el navegador (arrastrar y soltar, diálogos, banner, filtro,
selector) se validaron por **inspección del código** y mediante las **funciones puras testeadas**
(color determinista de etiquetas y cálculo del índice de inserción). El resto (persistencia y API)
está cubierto por tests automáticos.
