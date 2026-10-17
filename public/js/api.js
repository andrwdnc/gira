// Cliente de la API REST (design §5). Lanza Error con el mensaje en español
// que devuelve el servidor en { error }.
async function request(url, options) {
  const res = await fetch(url, options);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data && data.error ? data.error : `Error ${res.status}`);
  }
  return data;
}

function enviar(method, body) {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

const slugUrl = (slug) => `/api/proyectos/${encodeURIComponent(slug)}`;
const tareaUrl = (slug, id) => `${slugUrl(slug)}/tareas/${encodeURIComponent(id)}`;

export const api = {
  listProjects: () => request('/api/proyectos', undefined),
  createProject: (nombre) => request('/api/proyectos', enviar('POST', { nombre })),
  getProject: (slug) => request(slugUrl(slug), undefined),
  renameProject: (slug, nombre) => request(slugUrl(slug), enviar('PATCH', { nombre })),
  deleteProject: (slug) => request(slugUrl(slug), { method: 'DELETE' }),

  createTask: (slug, tarea) => request(`${slugUrl(slug)}/tareas`, enviar('POST', tarea)),
  updateTask: (slug, id, cambios) => request(tareaUrl(slug, id), enviar('PATCH', cambios)),
  deleteTask: (slug, id) => request(tareaUrl(slug, id), { method: 'DELETE' }),
  moveTask: (slug, id, columna, indice) =>
    request(`${tareaUrl(slug, id)}/mover`, enviar('POST', { columna, indice })),
};
