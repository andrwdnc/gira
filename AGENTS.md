# AGENTS.md — Gira

Reglas permanentes para cualquier agente que trabaje en este repositorio. Léelas completas antes de tocar nada.

## Qué es este proyecto
Gira es un tablero de tareas personal que corre en local y guarda todo en archivos JSON dentro del repo, para sincronizar dos PCs con `git pull` / `git push`.

## Fuente de verdad (orden de lectura)
1. `docs/spec.md` — qué se construye y cómo se acepta.
2. `docs/design.md` — cómo se construye (datos, API, estructura).
3. `docs/tasks.md` — qué toca hacer ahora.
4. `docs/decisions/` — por qué se decidió cada cosa.

**Regla de oro:** si el código y la spec discrepan, manda la spec. Si hay que cambiar el comportamiento, **primero se modifica el `.md` correspondiente y después el código**. Nunca cambies la spec en silencio: indícalo en tu resumen.

## Stack
- Node.js >= 18 + Express (única dependencia de runtime).
- Frontend: HTML + CSS + JavaScript vanilla (módulos ES). Sin frameworks, sin build.
- Tests: `node:test` (incluido en Node). Sin librerías de test.
- Servidor solo en `127.0.0.1`, puerto 3000 (`PORT` configurable).

## Comandos
- `npm install` — instalar dependencias.
- `npm start` — arrancar el servidor.
- `npm test` — ejecutar los tests (`node --test`).

## Convenciones
- Código y nombres de variables/funciones en inglés; textos de la interfaz, README y documentación en español.
- Los datos del dominio (campos JSON) están en español, tal como define `docs/design.md`. No los traduzcas.
- Funciones pequeñas, sin dependencias nuevas sin justificarlo en un ADR.
- Un commit por tarea de `docs/tasks.md`, con el id de la tarea en el mensaje (`T-05: endpoint mover tarea`).

## Reglas de persistencia (no negociables)
- Un archivo JSON por proyecto en `data/<slug>.json`.
- **No cachear datos en memoria**: leer de disco en cada petición.
- Escritura **atómica** (archivo temporal + rename) y serializada por proyecto.
- JSON con 2 espacios de indentación, orden de claves estable, salto de línea final y `\n`.
- **Nunca sobrescribir un JSON que no se pueda parsear** (p. ej. con marcadores de conflicto de git): informar del error y no tocarlo.
- Validar el slug (`^[a-z0-9-]+$`) antes de construir cualquier ruta de archivo.

## Qué NO hacer
- No añadir funcionalidades fuera de `docs/spec.md` (ver sección «Fuera de alcance»).
- No introducir base de datos, autenticación, frameworks ni paso de build.
- No ignorar `data/` en `.gitignore`.
- No marcar una tarea como hecha sin cumplir sus criterios de aceptación.

## Cómo trabajar
1. Lee los documentos en el orden indicado.
2. Si algo es ambiguo, anótalo en «Preguntas abiertas» de `docs/spec.md` y **pregunta**; no inventes.
3. Implementa **una tarea cada vez** de `docs/tasks.md` y marca su casilla al terminar.
4. Verifica contra los criterios de aceptación de la spec y ejecuta `npm test`.
5. Si tomas una decisión de diseño relevante, crea un ADR en `docs/decisions/`.
