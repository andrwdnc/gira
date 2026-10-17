const fs = require('node:fs/promises');
const path = require('node:path');

const SLUG_PATTERN = /^[a-z0-9-]+$/;

class CorruptProjectError extends Error {
  constructor(slug) {
    super(`El archivo del proyecto «${slug}» tiene JSON inválido y no se ha modificado`);
    this.name = 'CorruptProjectError';
    this.slug = slug;
  }
}

class InvalidSlugError extends Error {
  constructor(slug) {
    super(`Slug inválido: «${slug}»`);
    this.name = 'InvalidSlugError';
    this.slug = slug;
  }
}

function slugify(nombre) {
  return String(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_PATTERN.test(slug);
}

function assertValidSlug(slug) {
  if (!isValidSlug(slug)) throw new InvalidSlugError(slug);
}

function createStore(dataDir = path.join(__dirname, '..', 'data')) {
  const queues = new Map();

  // Encadena las operaciones del mismo proyecto; un fallo no rompe la cola.
  function enqueue(slug, task) {
    const tail = queues.get(slug) || Promise.resolve();
    const run = tail.then(task);
    queues.set(
      slug,
      run.catch(() => {})
    );
    return run;
  }

  function projectFile(slug) {
    assertValidSlug(slug);
    const dir = path.resolve(dataDir);
    const file = path.resolve(dir, `${slug}.json`);
    if (!file.startsWith(dir + path.sep)) throw new InvalidSlugError(slug);
    return file;
  }

  async function readUnqueued(slug) {
    const raw = await fs.readFile(projectFile(slug), 'utf8');
    try {
      return JSON.parse(raw);
    } catch {
      throw new CorruptProjectError(slug);
    }
  }

  async function writeUnqueued(slug, data) {
    const file = projectFile(slug);
    const tmp = path.join(path.dirname(file), `.${slug}.json.tmp`);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, file);
    return data;
  }

  // Lee desde disco en cada llamada; sin caché (ADR 0003).
  function readProject(slug) {
    return enqueue(slug, () => readUnqueued(slug));
  }

  function writeProject(slug, data) {
    return enqueue(slug, () => writeUnqueued(slug, data));
  }

  // Ciclo lectura-modificación-escritura atómico por proyecto.
  function updateProject(slug, mutate) {
    return enqueue(slug, async () => {
      const current = await readUnqueued(slug);
      const next = await mutate(current);
      return writeUnqueued(slug, next);
    });
  }

  // Lista los proyectos de data/. Los ilegibles se devuelven con `error` en
  // vez de fallar el listado entero; nunca se modifican.
  async function listProjects() {
    let entries;
    try {
      entries = await fs.readdir(path.resolve(dataDir));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    const files = entries.filter((name) => name.endsWith('.json') && !name.startsWith('.')).sort();
    const projects = [];
    for (const file of files) {
      const slug = file.slice(0, -'.json'.length);
      if (!isValidSlug(slug)) continue;
      try {
        projects.push({ slug, data: await readUnqueued(slug) });
      } catch (error) {
        projects.push({ slug, error });
      }
    }
    return projects;
  }

  // Borra el proyecto solo si su JSON es legible: un archivo corrupto no se
  // toca jamás (AGENTS.md).
  function deleteProject(slug) {
    return enqueue(slug, async () => {
      await readUnqueued(slug);
      await fs.unlink(projectFile(slug));
    });
  }

  return { dataDir, readProject, writeProject, updateProject, listProjects, deleteProject };
}

module.exports = {
  createStore,
  slugify,
  isValidSlug,
  CorruptProjectError,
  InvalidSlugError,
};
