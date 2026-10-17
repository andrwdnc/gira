# Diseño — Gira

> Documento del **cómo**. Los requisitos (RF-xx) y criterios (CA-xx) están en `spec.md`.

## 1. Arquitectura
Aplicación web local de dos capas:

- **Backend** (`server.js`): Express, escucha en `127.0.0.1:${PORT||3000}`. Expone una API REST JSON y sirve `public/` como estáticos. Es la única capa que toca `data/`.
- **Frontend** (`public/`): HTML + CSS + JS vanilla (módulos ES). Llama a la API con `fetch`. Sin build.

No hay estado persistente fuera de `data/*.json` (salvo el último proyecto abierto, en `localStorage` del navegador).

## 2. Estructura del repositorio
```
gira/
├── AGENTS.md
├── package.json
├── server.js
├── lib/
│   └── store.js          # lectura/escritura de JSON, slugs, cola de escrituras
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js            # puede dividirse en módulos bajo public/js/
├── data/
│   └── .gitkeep
├── test/
│   └── store.test.js     # node:test
├── docs/
│   ├── spec.md
│   ├── design.md
│   ├── tasks.md
│   └── decisions/
├── .gitignore            # solo node_modules/
└── README.md
```

## 3. Modelo de datos
Un archivo por proyecto: `data/<slug>.json`.

```json
{
  "id": "6f1c2d5e-0b6a-4d0c-9a53-8f0f1f2f3a11",
  "nombre": "Casa",
  "creado": "2026-10-17T10:00:00.000Z",
  "columnas": {
    "pendiente": [
      {
        "id": "a2f0c3b4-1d2e-4f56-8a90-123456789abc",
        "titulo": "Pintar el salón",
        "descripcion": "Comprar pintura blanca",
        "etiquetas": ["hogar", "urgente"],
        "creada": "2026-10-17T10:05:00.000Z",
        "actualizada": "2026-10-17T10:05:00.000Z"
      }
    ],
    "en_desarrollo": [],
    "finalizada": []
  }
}
```

Reglas:
- Claves de columna fijas: `pendiente`, `en_desarrollo`, `finalizada`.
- El **orden de las tareas es el orden del array**. No hay campos de posición.
- Fechas en ISO 8601 UTC. `id` con `crypto.randomUUID()`.
- `etiquetas`: strings recortados, sin duplicados (comparación sin mayúsculas), sin cadenas vacías.
- Orden de claves estable (el del ejemplo) al serializar.
- **Slug**: nombre en minúsculas, sin acentos, caracteres no alfanuméricos → `-`, sin guiones repetidos ni en los extremos. Debe cumplir `^[a-z0-9-]+$`. Si colisiona con otro existente se rechaza (RF-01).
- **Renombrar un proyecto** cambia solo `nombre`; el slug y el nombre de archivo **no cambian**. Así git no ve un borrado + alta y los historiales se conservan.

## 4. Persistencia
Implementada en `lib/store.js`.

- `readProject(slug)`: lee y parsea `data/<slug>.json` desde disco en cada llamada. Sin caché.
- `writeProject(slug, data)`: serializa con `JSON.stringify(data, null, 2) + "\n"`, escribe en `data/.<slug>.json.tmp` y hace `rename` sobre el definitivo (atómico).
- **Cola por proyecto**: un `Map<slug, Promise>` encadena las operaciones de lectura-modificación-escritura del mismo proyecto para evitar condiciones de carrera.
- **Validación de slug** en todas las entradas, antes de construir rutas. Se construye la ruta con `path.join` y se comprueba que queda dentro de `data/`.
- **JSON corrupto**: si `JSON.parse` falla, se lanza un error tipado `CorruptProjectError(slug)`. Nunca se escribe sobre ese archivo. El listado de proyectos lo devuelve marcado con `error`.
- Los archivos temporales `.*.tmp` no deben acabar en git: añadir `data/*.tmp` y `data/.*.tmp` a `.gitignore`.

## 5. API REST
Todas las respuestas son JSON. Errores: `{ "error": "mensaje en español" }` con el código HTTP adecuado.

| Método | Ruta | Cuerpo | Respuesta | Errores |
|---|---|---|---|---|
| GET | `/api/proyectos` | — | `[{slug, nombre, total}]`; los corruptos: `{slug, error}` | — |
| POST | `/api/proyectos` | `{nombre}` | 201 proyecto completo | 400 nombre vacío · 409 duplicado |
| GET | `/api/proyectos/:slug` | — | proyecto completo | 400 slug inválido · 404 · 422 JSON corrupto |
| PATCH | `/api/proyectos/:slug` | `{nombre}` | proyecto | 400 · 404 · 409 |
| DELETE | `/api/proyectos/:slug` | — | 204 | 400 · 404 |
| POST | `/api/proyectos/:slug/tareas` | `{titulo, descripcion?, etiquetas?}` | 201 tarea | 400 sin título · 404 |
| PATCH | `/api/proyectos/:slug/tareas/:id` | campos a modificar | tarea | 400 · 404 |
| POST | `/api/proyectos/:slug/tareas/:id/mover` | `{columna, indice}` | proyecto | 400 columna/índice inválidos · 404 |
| DELETE | `/api/proyectos/:slug/tareas/:id` | — | 204 | 404 |

Notas:
- `mover` acepta `indice` entre 0 y la longitud de la columna destino; se inserta en esa posición tras extraer la tarea de su columna origen. Actualiza `actualizada`.
- Cada operación de escritura actualiza `actualizada` de la tarea afectada.

## 6. Frontend
- **Cabecera**: selector de proyecto, botones «Nuevo proyecto», «Renombrar», «Eliminar», «Recargar desde disco», filtro por etiqueta.
- **Tablero**: tres columnas con cabecera y contador (RF-12). Cada tarjeta muestra título, descripción abreviada y chips de etiquetas.
- **Edición**: diálogo (`<dialog>`) para crear/editar tarea con título, descripción y etiquetas.
- **Arrastrar y soltar**: API nativa HTML5. `dragstart` guarda el id de la tarea; `dragover` calcula el índice de inserción según la posición del cursor respecto a las tarjetas y pinta una línea indicadora; `drop` llama a `/mover`.
- **Color de etiqueta**: hash simple del texto (normalizado) → matiz HSL; el mismo texto siempre da el mismo color.
- **Refresco**: tras cada operación se vuelve a pintar con la respuesta del servidor. Además se recarga desde la API en el evento `visibilitychange` (pestaña visible) y con el botón manual.
- **Errores**: banner visible con el mensaje de `error` de la API; un proyecto corrupto se muestra deshabilitado en el selector con su error.
- **Seguridad**: pintar siempre con `textContent` (nunca `innerHTML` con datos del usuario).
- **Tema**: variables CSS y `@media (prefers-color-scheme: dark)`.

## 7. Estrategia de pruebas
Con `node:test` sobre `lib/store.js` y, donde convenga, sobre la API con `fetch` contra un servidor de prueba en un directorio `data` temporal:

- crear proyecto, duplicado, slug generado
- crear/editar/eliminar tarea, título obligatorio
- mover entre columnas y reordenar (CA-05, CA-06)
- JSON corrupto no se sobrescribe (CA-11)
- slug con `../` rechazado (CA-14)
- formato del JSON: indentación, orden de claves, salto de línea final (CA-12)

## 8. Decisiones relacionadas
- `decisions/0001-un-json-por-proyecto.md`
- `decisions/0002-node-express-vanilla.md`
- `decisions/0003-lectura-sin-cache.md`
