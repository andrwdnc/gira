const test = require('node:test');
const assert = require('node:assert/strict');

// Los módulos del frontend son ESM puros (sin acceso al DOM al importarlos).
const importar = (ruta) => import(ruta);

test('COLUMNAS: las tres columnas fijas en orden (RF-05)', async () => {
  const { COLUMNAS } = await importar('../public/js/constants.js');
  assert.deepEqual(
    COLUMNAS.map((c) => c.clave),
    ['pendiente', 'en_desarrollo', 'finalizada']
  );
  assert.deepEqual(
    COLUMNAS.map((c) => c.etiqueta),
    ['Pendiente', 'En desarrollo', 'Finalizada']
  );
});

test('tagHue: color determinista y normalizado (RF-10, CA-07)', async () => {
  const { tagHue, tagKey } = await importar('../public/js/tags.js');

  assert.equal(tagHue('urgente'), tagHue('urgente'));
  assert.equal(tagHue('Urgente'), tagHue('  URGENTE  ')); // se normaliza el texto
  assert.equal(tagKey('  Hogar '), 'hogar');

  for (const texto of ['a', 'urgente', 'hogar', 'recados', '', 'ñandú 🎉']) {
    const hue = tagHue(texto);
    assert.ok(Number.isInteger(hue), `${texto}: entero`);
    assert.ok(hue >= 0 && hue < 360, `${texto}: 0..359`);
  }

  assert.notEqual(tagHue('urgente'), tagHue('hogar'));
});

test('insertionIndex: punto de inserción según el cursor (RF-09)', async () => {
  const { insertionIndex } = await importar('../public/js/dnd.js');

  // Tres tarjetas de 100px de alto, una debajo de otra.
  const rects = [
    { top: 0, height: 100 },
    { top: 100, height: 100 },
    { top: 200, height: 100 },
  ];

  assert.equal(insertionIndex([], 50), 0); // columna vacía
  assert.equal(insertionIndex(rects, 10), 0); // sobre la primera
  assert.equal(insertionIndex(rects, 40), 0); // mitad superior de la 1ª
  assert.equal(insertionIndex(rects, 60), 1); // mitad inferior de la 1ª
  assert.equal(insertionIndex(rects, 140), 1); // mitad superior de la 2ª
  assert.equal(insertionIndex(rects, 260), 3); // por debajo de la última
});
