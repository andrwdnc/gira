// Color determinista de etiquetas (RF-10): el mismo texto siempre da el mismo
// tono. Se calcula un hash simple y se mapea a un matiz HSL (0-359).
export function tagKey(text) {
  return String(text).trim().toLowerCase();
}

export function tagHue(text) {
  const clave = tagKey(text);
  let hash = 0;
  for (let i = 0; i < clave.length; i += 1) {
    hash = (hash * 31 + clave.codePointAt(i)) % 360000;
  }
  return ((hash % 360) + 360) % 360;
}
