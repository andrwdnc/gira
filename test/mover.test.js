const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { createStore } = require('../lib/store.js');
const { createApp } = require('../server.js');

let server;
let base;
let dataDir;

test.before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gira-mover-'));
  const app = createApp(createStore(dataDir));
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
  await json('/api/proyectos', { method: 'POST', body: JSON.stringify({ nombre: 'Casa' }) });
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(dataDir, { recursive: true, force: true });
});

function json(pathname, options = {}) {
  return fetch(base + pathname, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
}

function nuevaTarea(titulo) {
  return json('/api/proyectos/casa/tareas', {
    method: 'POST',
    body: JSON.stringify({ titulo }),
  }).then((r) => r.json());
}

function mover(id, columna, indice) {
  return json(`/api/proyectos/casa/tareas/${id}/mover`, {
    method: 'POST',
    body: JSON.stringify({ columna, indice }),
  });
}

const leerProyecto = () => fetch(`${base}/api/proyectos/casa`).then((r) => r.json());
const titulos = (proyecto, columna) => proyecto.columnas[columna].map((t) => t.titulo);

test('CA-05: mover de pendiente a finalizada la refleja en finalizada y la quita de pendiente', async () => {
  const tarea = await nuevaTarea('Pintar');

  const res = await mover(tarea.id, 'finalizada', 0);
  assert.equal(res.status, 200);
  const proyecto = await res.json();
  assert.ok(proyecto.columnas, 'la respuesta es el proyecto completo');

  assert.deepEqual(titulos(proyecto, 'finalizada'), ['Pintar']);
  assert.deepEqual(proyecto.columnas.pendiente, []);

  const enDisco = JSON.parse(await fs.readFile(path.join(dataDir, 'casa.json'), 'utf8'));
  assert.deepEqual(titulos(enDisco, 'finalizada'), ['Pintar']);
  assert.deepEqual(enDisco.columnas.pendiente, []);
});

test('CA-06: con A, B, C, mover C entre A y B deja A, C, B', async () => {
  await nuevaTarea('A');
  await nuevaTarea('B');
  const c = await nuevaTarea('C');
  assert.deepEqual(titulos(await leerProyecto(), 'pendiente'), ['A', 'B', 'C']);

  const res = await mover(c.id, 'pendiente', 1);
  assert.equal(res.status, 200);
  assert.deepEqual(titulos(await res.json(), 'pendiente'), ['A', 'C', 'B']);

  assert.deepEqual(titulos(await leerProyecto(), 'pendiente'), ['A', 'C', 'B']);
});

test('mover al final de la misma columna con índice = longitud tras extraer', async () => {
  const proyecto = await leerProyecto();
  const [a, c] = proyecto.columnas.pendiente;

  // [A, C, B] -> extraer A -> [C, B] (longitud 2) -> insertar en 2 -> [C, B, A]
  const res = await mover(a.id, 'pendiente', 2);
  assert.equal(res.status, 200);
  assert.deepEqual(titulos(await res.json(), 'pendiente'), ['C', 'B', 'A']);
  assert.equal(c.id, (await leerProyecto()).columnas.pendiente[0].id);
});

test('mover actualiza «actualizada»', async () => {
  const tarea = await nuevaTarea('Actualizar fecha');
  await new Promise((resolve) => setTimeout(resolve, 10));

  const res = await mover(tarea.id, 'en_desarrollo', 0);
  const proyecto = await res.json();
  const movida = proyecto.columnas.en_desarrollo[0];
  assert.equal(movida.id, tarea.id);
  assert.notEqual(movida.actualizada, tarea.actualizada);
  assert.equal(movida.creada, tarea.creada);
});

test('columna o índice inválidos devuelven 400 y no modifican el JSON', async () => {
  const tarea = await nuevaTarea('Intocable');
  const antes = await fs.readFile(path.join(dataDir, 'casa.json'), 'utf8');

  assert.equal((await mover(tarea.id, 'otra', 0)).status, 400);
  assert.equal((await mover(tarea.id, 'pendiente', -1)).status, 400);
  assert.equal((await mover(tarea.id, 'pendiente', 1.5)).status, 400);
  assert.equal((await mover(tarea.id, 'pendiente', '0')).status, 400);
  // La columna destino «finalizada» tiene 1 tarea: el índice 5 no cabe.
  assert.equal((await mover(tarea.id, 'finalizada', 5)).status, 400);

  assert.equal(await fs.readFile(path.join(dataDir, 'casa.json'), 'utf8'), antes);
});

test('mover: 404 si la tarea o el proyecto no existen', async () => {
  assert.equal((await mover('inexistente', 'pendiente', 0)).status, 404);
  assert.equal(
    (
      await json('/api/proyectos/no-existe/tareas/x/mover', {
        method: 'POST',
        body: JSON.stringify({ columna: 'pendiente', indice: 0 }),
      })
    ).status,
    404
  );
});
