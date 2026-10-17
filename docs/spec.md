# Especificación — Gira

> Estado: borrador para revisión · Documento de **qué** y **por qué**. El **cómo** está en `design.md`.

## 1. Objetivo
Disponer de **Gira**, un tablero de tareas personal, en local, para gestionar tareas de distintos proyectos, cuya información viva en archivos JSON dentro del repositorio. Así, el estado se mantiene al día en dos PCs con un simple `git pull`.

## 2. Usuario
Una sola persona, trabajando alternativamente desde dos ordenadores. No hay multiusuario ni acceso remoto.

## 3. Historias de usuario
- **HU-1** Como usuario quiero crear varios proyectos para separar mis tareas por contexto.
- **HU-2** Como usuario quiero crear tareas y verlas organizadas en Pendiente, En desarrollo y Finalizada.
- **HU-3** Como usuario quiero arrastrar una tarea entre columnas (y reordenarla) para reflejar su avance.
- **HU-4** Como usuario quiero añadir descripción y etiquetas a las tareas para darles contexto y poder filtrarlas.
- **HU-5** Como usuario quiero que todo se guarde en JSON versionable para sincronizar mis dos PCs con git sin conflictos.
- **HU-6** Como usuario quiero ver los cambios tras un `git pull` con solo recargar, sin reiniciar nada.

## 4. Requisitos funcionales

### Proyectos
- **RF-01** Crear un proyecto indicando su nombre (obligatorio, único ignorando mayúsculas y acentos).
- **RF-02** Renombrar un proyecto.
- **RF-03** Eliminar un proyecto, con confirmación previa.
- **RF-04** Seleccionar el proyecto activo desde un selector visible; se recuerda el último abierto (en `localStorage`, no en el repo).

### Tareas
- **RF-05** Cada proyecto tiene tres columnas fijas: `Pendiente`, `En desarrollo`, `Finalizada`.
- **RF-06** Crear una tarea con título (obligatorio), descripción (opcional) y etiquetas (opcionales). Se crea en `Pendiente`.
- **RF-07** Editar título, descripción y etiquetas de una tarea.
- **RF-08** Eliminar una tarea, con confirmación.
- **RF-09** Mover una tarea entre columnas y reordenarla dentro de su columna mediante arrastrar y soltar, con indicador visual del punto de inserción.
- **RF-10** Mostrar las etiquetas como chips con color determinista derivado del texto de la etiqueta.
- **RF-11** Filtrar las tareas del proyecto activo por etiqueta.
- **RF-12** Mostrar el número de tareas de cada columna.

### Persistencia y sincronización
- **RF-13** Toda la información se guarda en `data/<slug>.json`, un archivo por proyecto.
- **RF-14** Los cambios hechos fuera de la aplicación (p. ej. por `git pull`) se ven al recargar la página, o con el botón «Recargar desde disco», o automáticamente al volver a enfocar la pestaña.
- **RF-15** Si un archivo JSON está corrupto, la aplicación muestra un error indicando cuál, no lo modifica y sigue funcionando con los demás proyectos.

### Interfaz
- **RF-16** Interfaz en español, responsive, con tema claro/oscuro según `prefers-color-scheme`.

## 5. Criterios de aceptación

- **CA-01 (RF-01, RF-13)** Dado que no existe ningún proyecto, cuando creo «Casa», entonces existe `data/casa.json` con tres columnas vacías.
- **CA-02 (RF-01)** Dado un proyecto «Casa», cuando intento crear «casa» o «CÁSA», entonces se rechaza con un mensaje de nombre duplicado.
- **CA-03 (RF-06)** Dado un proyecto abierto, cuando creo una tarea con título «Pintar», entonces aparece en `Pendiente` y se guarda en el JSON con `id`, `creada` y `actualizada`.
- **CA-04 (RF-06)** Cuando intento crear una tarea sin título, entonces se rechaza y no se modifica el JSON.
- **CA-05 (RF-09)** Dada una tarea en `Pendiente`, cuando la arrastro a `Finalizada`, entonces el JSON la refleja en `finalizada` y `pendiente` ya no la contiene.
- **CA-06 (RF-09)** Dada una columna con tres tareas A, B, C, cuando arrastro C entre A y B, entonces el orden guardado es A, C, B.
- **CA-07 (RF-07, RF-10)** Cuando añado la etiqueta «urgente» a una tarea, entonces se muestra como chip y la etiqueta queda en el JSON; el mismo texto siempre produce el mismo color.
- **CA-08 (RF-11)** Dado un proyecto con tareas etiquetadas, cuando filtro por «urgente», entonces solo veo las tareas con esa etiqueta.
- **CA-09 (RF-03)** Cuando elimino un proyecto y confirmo, entonces desaparece su archivo; si cancelo, no pasa nada.
- **CA-10 (RF-14)** Dado que modifico `data/casa.json` a mano o con `git pull`, cuando pulso «Recargar desde disco», entonces veo el cambio sin reiniciar el servidor.
- **CA-11 (RF-15)** Dado un `data/x.json` con marcadores de conflicto de git, cuando abro la aplicación, entonces veo un error que nombra `x.json`, el archivo queda intacto y los demás proyectos funcionan.
- **CA-12 (RF-13)** Tras cualquier cambio, `git diff` muestra solo las líneas modificadas del JSON del proyecto afectado.
- **CA-13 (RF-13)** Si dos PCs editan proyectos distintos y se sincronizan con git, no se produce ningún conflicto.
- **CA-14 (seguridad)** Una petición con un slug como `../x` o `a/b` es rechazada y no accede a ningún archivo.

## 6. Fuera de alcance
- Autenticación, cuentas o multiusuario.
- Columnas personalizables (las tres son fijas).
- Fechas límite, prioridades, subtareas, adjuntos, comentarios.
- Sincronización automática con git (los `pull`/`push` los hace el usuario).
- Acceso desde otros dispositivos de la red (solo `127.0.0.1`).
- Base de datos, frameworks frontend y paso de build.

## 7. Preguntas abiertas
- [ ] ¿Debe existir una papelera o deshacer para tareas eliminadas? (por defecto: **no**).
- [ ] ¿Se renombra el archivo JSON al renombrar un proyecto? (por defecto: **no**, ver `design.md` §3).
