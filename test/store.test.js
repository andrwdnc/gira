const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  createStore,
  slugify,
  isValidSlug,
  CorruptProjectError,
  InvalidSlugError,
} = require('../lib/store.js');

async function tempStore() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gira-test-'));
  return { store: createStore(dataDir), dataDir };
}

test('slugify', () => {
  assert.equal(slugify('Casa'), 'casa');
  assert.equal(slugify('CÁSA'), 'casa');
  assert.equal(slugify('  Comprar pan  '), 'comprar-pan');
  assert.equal(slugify('Trabajo / Personal!'), 'trabajo-personal');
  assert.equal(slugify('a---b'), 'a-b');
  assert.equal(slugify('¿¡Ünicornio!'), 'unicornio');
});

test('isValidSlug', () => {
  assert.ok(isValidSlug('casa'));
  assert.ok(isValidSlug('comprar-pan'));
  assert.ok(!isValidSlug(''));
  assert.ok(!isValidSlug('../x'));
  assert.ok(!isValidSlug('a/b'));
  assert.ok(!isValidSlug('Casa'));
  assert.ok(!isValidSlug('con espacios'));
  // La validación es la regex del design §3; los guiones en los extremos los
  // evita slugify al generar, no el validador.
  assert.equal(slugify('Trailing-'), 'trailing');
});

test('CA-14: slugs que intentan salir de data/ rechazados, sin tocar archivos', async () => {
  const { store, dataDir } = await tempStore();
  const outside = path.join(path.dirname(dataDir), 'fuera.json');

  await assert.rejects(store.readProject('../fuera'), InvalidSlugError);
  await assert.rejects(store.writeProject('a/b', {}), InvalidSlugError);
  await assert.rejects(store.readProject('..'), InvalidSlugError);

  await assert.rejects(fs.access(outside));
});

test('CA-12: el JSON escrito tiene formato estable (2 espacios, claves en orden, \\n final)', async () => {
  const { store } = await tempStore();
  const proyecto = {
    id: '6f1c2d5e-0b6a-4d0c-9a53-8f0f1f2f3a11',
    nombre: 'Casa',
    creado: '2026-10-17T10:00:00.000Z',
    columnas: { pendiente: [], en_desarrollo: [], finalizada: [] },
  };

  await store.writeProject('casa', proyecto);

  const raw = await fs.readFile(path.join(store.dataDir, 'casa.json'), 'utf8');
  assert.equal(raw, JSON.stringify(proyecto, null, 2) + '\n');
  assert.ok(raw.endsWith('\n'));
  assert.ok(!raw.includes('\n  \n'));

  const devuelto = await store.readProject('casa');
  assert.deepEqual(devuelto, proyecto);
});

test('no quedan archivos temporales tras escribir', async () => {
  const { store, dataDir } = await tempStore();
  await store.writeProject('casa', { nombre: 'Casa' });
  const entradas = await fs.readdir(dataDir);
  assert.deepEqual(entradas, ['casa.json']);
});

test('lectura sin caché: refleja cambios hechos fuera de la app', async () => {
  const { store, dataDir } = await tempStore();
  await store.writeProject('casa', { nombre: 'Casa', version: 1 });

  await fs.writeFile(
    path.join(dataDir, 'casa.json'),
    JSON.stringify({ nombre: 'Casa', version: 2 }, null, 2) + '\n',
    'utf8'
  );

  const leido = await store.readProject('casa');
  assert.equal(leido.version, 2);
});

test('atomicidad básica: escrituras concurrentes dejan contenido completo y sin .tmp', async () => {
  const { store, dataDir } = await tempStore();
  const escrituras = [];
  for (let i = 0; i < 10; i++) {
    escrituras.push(store.writeProject('casa', { nombre: 'Casa', i }));
  }
  await Promise.all(escrituras);

  const entradas = await fs.readdir(dataDir);
  assert.deepEqual(entradas, ['casa.json']);

  const contenido = JSON.parse(await fs.readFile(path.join(dataDir, 'casa.json'), 'utf8'));
  assert.equal(contenido.i, 9);
});

test('cola por proyecto: updateProject serializa lectura-modificación-escritura', async () => {
  const { store } = await tempStore();
  await store.writeProject('casa', { contador: 0 });

  await Promise.all(
    Array.from({ length: 5 }, () =>
      store.updateProject('casa', (data) => {
        data.contador += 1;
        return data;
      })
    )
  );

  const final = await store.readProject('casa');
  assert.equal(final.contador, 5);
});

test('CA-11: JSON corrupto lanza CorruptProjectError nombrando el slug y no se modifica', async () => {
  const { store, dataDir } = await tempStore();
  const marcadores = `<<<<<<< HEAD
{ "nombre": "Casa" }
=======
{ "nombre": "Casa vieja" }
>>>>>>> abc123
`;
  await fs.writeFile(path.join(dataDir, 'x.json'), marcadores, 'utf8');

  await assert
    .rejects(store.readProject('x'), (err) => {
      assert.ok(err instanceof CorruptProjectError);
      assert.equal(err.slug, 'x');
      assert.ok(err.message.includes('x'));
      return true;
    });

  // El archivo queda intacto.
  const trasElError = await fs.readFile(path.join(dataDir, 'x.json'), 'utf8');
  assert.equal(trasElError, marcadores);

  // Y el resto de proyectos siguen funcionando.
  await store.writeProject('otro', { nombre: 'Otro' });
  const otro = await store.readProject('otro');
  assert.equal(otro.nombre, 'Otro');
});

test('proyecto inexistente: el error ENOENT llega al llamador', async () => {
  const { store } = await tempStore();
  await assert.rejects(store.readProject('no-existe'), (err) => {
    assert.equal(err.code, 'ENOENT');
    return true;
  });
});
