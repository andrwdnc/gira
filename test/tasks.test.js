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
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gira-tareas-'));
  const app = createApp(createStore(dataDir));
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
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

const crearProyecto = (nombre) =>
  json('/api/proyectos', { method: 'POST', body: JSON.stringify({ nombre }) });
const crearTarea = (slug, tarea) =>
  json(`/api/proyectos/${slug}/tareas`, { method: 'POST', body: JSON.stringify(tarea) });
const editarTarea = (slug, id, cambios) =>
  json(`/api/proyectos/${slug}/tareas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) });
const borrarTarea = (slug, id) =>
  fetch(`${base}/api/proyectos/${slug}/tareas/${id}`, { method: 'DELETE' });
const leerProyecto = (slug) => fetch(`${base}/api/proyectos/${slug}`).then((r) => r.json());

test('CA-03: crear «Pintar» la guarda en pendiente con id, creada y actualizada', async () => {
  await crearProyecto('Casa');

  const res = await crearTarea('casa', {
    titulo: 'Pintar',
    descripcion: 'Comprar pintura blanca',
    etiquetas: ['Urgente', 'urgente', '  hogar  ', '', '   '],
  });
  assert.equal(res.status, 201);
  const tarea = await res.json();
  assert.match(tarea.id, /^[0-9a-f-]{36}$/);
  assert.equal(tarea.titulo, 'Pintar');
  assert.equal(tarea.descripcion, 'Comprar pintura blanca');
  assert.deepEqual(tarea.etiquetas, ['Urgente', 'hogar']);
  assert.equal(tarea.creada, tarea.actualizada);
  assert.equal(new Date(tarea.creada).toISOString(), tarea.creada);

  const proyecto = await leerProyecto('casa');
  assert.deepEqual(proyecto.columnas.pendiente, [tarea]);
  assert.deepEqual(proyecto.columnas.en_desarrollo, []);
  assert.deepEqual(proyecto.columnas.finalizada, []);

  // Orden de claves estable (design §3).
  const raw = await fs.readFile(path.join(dataDir, 'casa.json'), 'utf8');
  assert.deepEqual(Object.keys(JSON.parse(raw).columnas.pendiente[0]), [
    'id',
    'titulo',
    'descripcion',
    'etiquetas',
    'creada',
    'actualizada',
  ]);
});

test('CA-04: sin título se rechaza y no se modifica el JSON', async () => {
  const antes = await fs.readFile(path.join(dataDir, 'casa.json'), 'utf8');

  for (const tarea of [{ descripcion: 'x' }, { titulo: '' }, { titulo: '   ' }, {}]) {
    const res = await crearTarea('casa', tarea);
    assert.equal(res.status, 400);
    assert.ok((await res.json()).error);
  }

  assert.equal(await fs.readFile(path.join(dataDir, 'casa.json'), 'utf8'), antes);
});

test('crear tarea: 404 si el proyecto no existe y 400 con slug inválido', async () => {
  assert.equal((await crearTarea('no-existe', { titulo: 'X' })).status, 404);
  assert.equal((await crearTarea('a%2Fb', { titulo: 'X' })).status, 400);
});

test('tarea con solo título: descripción vacía y etiquetas vacías', async () => {
  const res = await crearTarea('casa', { titulo: 'Regar plantas' });
  assert.equal(res.status, 201);
  const tarea = await res.json();
  assert.equal(tarea.descripcion, '');
  assert.deepEqual(tarea.etiquetas, []);
});

test('PATCH edita título, descripción y etiquetas y actualiza «actualizada»', async () => {
  const proyecto = await leerProyecto('casa');
  const tarea = proyecto.columnas.pendiente[0];

  const res = await editarTarea('casa', tarea.id, {
    titulo: 'Pintar el salón',
    descripcion: 'Con pintura blanca',
    etiquetas: ['hogar', 'HOGAR', 'urgente'],
  });
  assert.equal(res.status, 200);
  const editada = await res.json();
  assert.equal(editada.titulo, 'Pintar el salón');
  assert.equal(editada.descripcion, 'Con pintura blanca');
  assert.deepEqual(editada.etiquetas, ['hogar', 'urgente']);
  assert.equal(editada.id, tarea.id);
  assert.equal(editada.creada, tarea.creada);

  const guardado = (await leerProyecto('casa')).columnas.pendiente[0];
  assert.deepEqual(guardado, editada);
});

test('PATCH: 404 si la tarea no existe, 400 con título vacío', async () => {
  assert.equal((await editarTarea('casa', 'inexistente', { titulo: 'X' })).status, 404);
  assert.equal((await editarTarea('no-existe', 'x', { titulo: 'X' })).status, 404);

  const proyecto = await leerProyecto('casa');
  const id = proyecto.columnas.pendiente[0].id;
  assert.equal((await editarTarea('casa', id, { titulo: '  ' })).status, 400);
});

test('DELETE quita la tarea de su columna y da 404 si ya no está', async () => {
  const proyecto = await leerProyecto('casa');
  const [primera, segunda] = proyecto.columnas.pendiente;
  assert.ok(segunda, 'debería haber dos tareas en pendiente');

  const res = await borrarTarea('casa', primera.id);
  assert.equal(res.status, 204);

  const tras = await leerProyecto('casa');
  assert.deepEqual(tras.columnas.pendiente.map((t) => t.id), [segunda.id]);

  assert.equal((await borrarTarea('casa', primera.id)).status, 404);
  assert.equal((await borrarTarea('no-existe', primera.id)).status, 404);
});
