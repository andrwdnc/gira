// Cálculo puro del punto de inserción durante el arrastre (RF-09): recibe los
// rectángulos de las tarjetas visibles y la coordenada Y del cursor, y devuelve
// el índice donde insertar (0..rects.length).
export function insertionIndex(rects, y) {
  for (let i = 0; i < rects.length; i += 1) {
    const { top, height } = rects[i];
    if (y < top + height / 2) return i;
  }
  return rects.length;
}
