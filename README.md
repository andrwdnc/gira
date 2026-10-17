# Gira

Gira es un tablero de tareas personal que corre en tu ordenador y guarda todo en
archivos JSON dentro del repositorio. Así puedes sincronizar el estado entre dos
PCs con `git pull` / `git push`, sin servidores ni cuentas.

## Requisitos

- Node.js >= 18 (recomendado 20 o superior).
- Git (para sincronizar entre equipos).

## Instalación y arranque

```bash
npm install
npm start
```

Abre <http://127.0.0.1:3000> en el navegador. El servidor solo escucha en
`127.0.0.1`; puedes cambiar el puerto con la variable `PORT`:

```bash
PORT=3100 npm start
```

## Uso

- **Proyectos**: selector en la cabecera; «Nuevo proyecto», «Renombrar» y
  «Eliminar» (con confirmación). El último proyecto abierto se recuerda en el
  navegador (`localStorage`), no en el repositorio.
- **Tareas**: «Nueva tarea» abre un diálogo con título (obligatorio),
  descripción y etiquetas (separadas por comas). Cada tarea nace en
  `Pendiente`.
- **Arrastrar y soltar**: arrastra una tarjeta a otra columna o reordénala
  dentro de la suya; aparece una línea indicando dónde se insertará.
- **Etiquetas**: se muestran como chips con un color fijo por texto. El selector
  «Etiqueta» filtra las tarjetas del proyecto activo.
- **Recargar desde disco**: el botón de la cabecera relee los JSON. También se
  recarga solo al volver a enfocar la pestaña.

## Estructura del repositorio

```
gira/
├── AGENTS.md            # reglas para agentes que trabajan en el repo
├── server.js            # Express: API REST y estáticos de public/
├── lib/store.js         # lectura/escritura de JSON (slugs, cola, atomicidad)
├── public/              # frontend vanilla: index.html, styles.css, app.js, js/
├── data/                # un JSON por proyecto (¡se versiona!)
├── test/                # tests con node:test
└── docs/                # spec.md, design.md, tasks.md y decisions/ (ADR)
```

## Datos

Cada proyecto es un archivo `data/<slug>.json`. El slug se deriva del nombre
(minúsculas, sin acentos, sin caracteres especiales). **Renombrar un proyecto no
cambia el nombre del archivo**, para no romper el historial de git.

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

Detalles importantes:

- El **orden de las tareas es el orden del array**; no hay campos de posición.
- El JSON se escribe con 2 espacios, claves en orden fijo y salto de línea final,
  para que `git diff` muestre solo lo que ha cambiado.
- Si un JSON está corrupto (por ejemplo, con marcadores de conflicto de git), la
  aplicación lo avisa, lo marca como corrupto y **no lo modifica**.

## Sincronizar entre dos PCs

El flujo es el de cualquier repositorio de git:

```bash
# Al empezar a trabajar en un PC
git pull

# ... usar la aplicación ...

# Al terminar
git add data
git commit -m "Gira: estado del tablero"
git push
```

Como cada proyecto vive en su propio archivo, editar proyectos distintos en cada
PC no genera conflictos. Si se toca **el mismo** proyecto en los dos sin `pull`
intermedio, sí puede haber conflicto; el hábito de `pull` al empezar y `push` al
terminar lo evita.

## Tests

```bash
npm test
```

Usa `node:test` (incluido en Node) y no necesita dependencias de test.

## Más documentación

- `docs/spec.md` — qué se construye y cómo se acepta (RF y CA).
- `docs/design.md` — cómo está construido (datos, API, estructura).
- `docs/tasks.md` — plan de trabajo por tareas.
- `docs/decisions/` — ADR con las decisiones de diseño.
