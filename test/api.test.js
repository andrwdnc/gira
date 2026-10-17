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
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gira-api-'));
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

const crear = (nombre) => json('/api/proyectos', { method: 'POST', body: JSON.stringify({ nombre }) });
const listar = () => fetch(base + '/api/proyectos').then((r) => r.json());
const renombrar = (slug, nombre) =>
  json(`/api/proyectos/${slug}`, { method: 'PATCH', body: JSON.stringify({ nombre }) });

test('CA-01: crear «Casa» crea data/casa.json con tres columnas vacías', async () => {
  const res = await crear('Casa');
  assert.equal(res.status, 201);
  const proyecto = await res.json();
  assert.equal(proyecto.nombre, 'Casa');
  assert.match(proyecto.id, /^[0-9a-f-]{36}$/);
  assert.equal(new Date(proyecto.creado).toISOString(), proyecto.creado);
  assert.deepEqual(proyecto.columnas, { pendiente: [], en_desarrollo: [], finalizada: [] });

  const enDisco = JSON.parse(await fs.readFile(path.join(dataDir, 'casa.json'), 'utf8'));
  assert.deepEqual(enDisco, proyecto);

  assert.deepEqual(await fs.readdir(dataDir), ['casa.json']);

  assert.deepEqual(await listar(), [{ slug: 'casa', nombre: 'Casa', total: 0 }]);
});

test('CA-02: nombre duplicado (mayúsculas y acentos) se rechaza con 409', async () => {
  for (const nombre of ['casa', 'CÁSA', ' Casa ']) {
    const res = await crear(nombre);
    assert.equal(res.status, 409, `«${nombre}» debería ser duplicado`);
    const { error } = await res.json();
    assert.ok(error.length > 0);
  }
  assert.deepEqual(await fs.readdir(dataDir), ['casa.json']);
});

test('nombre obligatorio y con alfanuméricos', async () => {
  for (const body of [{ nombre: '   ' }, { nombre: '' }, {}, { nombre: '###' }]) {
    const res = await json('/api/proyectos', { method: 'POST', body: JSON.stringify(body) });
    assert.equal(res.status, 400);
    assert.ok((await res.json()).error);
  }
});

test('JSON inválido en el cuerpo devuelve 400', async () => {
  const res = await json('/api/proyectos', { method: 'POST', body: '{no es json' });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).error);
});

test('GET de un proyecto: 200, 404 y slug inválido 400', async () => {
  const ok = await fetch(`${base}/api/proyectos/casa`);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).nombre, 'Casa');

  assert.equal((await fetch(`${base}/api/proyectos/no-existe`)).status, 404);
  assert.equal((await fetch(`${base}/api/proyectos/a%2Fb`)).status, 400);
});

test('proyecto corrupto: 422 al leerlo y aparece marcado en el listado', async () => {
  await fs.writeFile(
    path.join(dataDir, 'x.json'),
    '<<<<<<< HEAD\n{ "nombre": "Casa" }\n=======\n{ "nombre": "Otra" }\n>>>>>>> abc\n',
    'utf8'
  );

  const res = await fetch(`${base}/api/proyectos/x`);
  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.includes('x'));

  const listado = await listar();
  const casa = listado.find((p) => p.slug === 'casa');
  const corrupto = listado.find((p) => p.slug === 'x');
  assert.deepEqual(casa, { slug: 'casa', nombre: 'Casa', total: 0 });
  assert.equal(corrupto.slug, 'x');
  assert.ok(corrupto.error);
  assert.equal(corrupto.nombre, undefined);
});

test('PATCH renombra sin cambiar el archivo y detecta duplicados', async () => {
  await crear('Trabajo');

  const res = await renombrar('casa', 'Casa nueva');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).nombre, 'Casa nueva');
  // El slug y el nombre de archivo no cambian (design §3).
  assert.deepEqual(await fs.readdir(dataDir), ['casa.json', 'trabajo.json', 'x.json']);
  assert.equal((await fetch(`${base}/api/proyectos/casa`)).status, 200);

  assert.equal((await renombrar('casa', 'TRABAJO')).status, 409);
  assert.equal((await renombrar('casa', '  ')).status, 400);
  assert.equal((await renombrar('no-existe', 'Otra')).status, 404);
});

test('CA-09: DELETE borra el archivo y da 404 si ya no existe', async () => {
  const res = await fetch(`${base}/api/proyectos/casa`, { method: 'DELETE' });
  assert.equal(res.status, 204);
  assert.deepEqual(await fs.readdir(dataDir), ['trabajo.json', 'x.json']);
  assert.equal((await fetch(`${base}/api/proyectos/casa`)).status, 404);

  assert.equal((await fetch(`${base}/api/proyectos/casa`, { method: 'DELETE' })).status, 404);
});

test('un proyecto corrupto no se borra ni se toca', async () => {
  const antes = await fs.readFile(path.join(dataDir, 'x.json'), 'utf8');
  const res = await fetch(`${base}/api/proyectos/x`, { method: 'DELETE' });
  assert.equal(res.status, 422);
  assert.equal(await fs.readFile(path.join(dataDir, 'x.json'), 'utf8'), antes);
});

test('ruta de API desconocida devuelve 404 JSON', async () => {
  const res = await fetch(`${base}/api/lo-que-sea`);
  assert.equal(res.status, 404);
  assert.ok((await res.json()).error);
});
