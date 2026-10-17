const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');

const { createStore, slugify, isValidSlug } = require('./lib/store.js');

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

const COLUMNAS = ['pendiente', 'en_desarrollo', 'finalizada'];

function totalTareas(proyecto) {
  const columnas = proyecto.columnas || {};
  return Object.values(columnas).reduce(
    (total, tareas) => total + (Array.isArray(tareas) ? tareas.length : 0),
    0
  );
}

// Etiquetas: strings recortados, sin duplicados (sin distinguir mayúsculas) y
// sin cadenas vacías (design §3). Devuelve null si no es una lista.
function normalizeTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const vistas = new Set();
  const etiquetas = [];
  for (const etiqueta of value) {
    if (typeof etiqueta !== 'string') continue;
    const limpia = etiqueta.trim();
    if (!limpia) continue;
    const clave = limpia.toLowerCase();
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    etiquetas.push(limpia);
  }
  return etiquetas;
}

function normalizeDescription(value) {
  if (value === undefined) return '';
  return typeof value === 'string' ? value : null;
}

function findTask(proyecto, id) {
  for (const tareas of Object.values(proyecto.columnas || {})) {
    const tarea = (tareas || []).find((t) => t.id === id);
    if (tarea) return tarea;
  }
  return null;
}

function newTask({ titulo, descripcion, etiquetas }) {
  const ahora = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    titulo,
    descripcion,
    etiquetas,
    creada: ahora,
    actualizada: ahora,
  };
}

function createApp(store) {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/api/proyectos', async (req, res) => {
    const proyectos = await store.listProjects();
    res.json(
      proyectos.map((entry) =>
        entry.error
          ? { slug: entry.slug, error: entry.error.message }
          : { slug: entry.slug, nombre: entry.data.nombre, total: totalTareas(entry.data) }
      )
    );
  });

  app.post('/api/proyectos', async (req, res) => {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });
    }
    const slug = slugify(nombre);
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'El nombre debe contener letras o números' });
    }
    const existentes = await store.listProjects();
    if (existentes.some((proyecto) => proyecto.slug === slug)) {
      return res.status(409).json({ error: `Ya existe un proyecto equivalente a «${nombre}»` });
    }
    const proyecto = {
      id: crypto.randomUUID(),
      nombre,
      creado: new Date().toISOString(),
      columnas: { pendiente: [], en_desarrollo: [], finalizada: [] },
    };
    await store.writeProject(slug, proyecto);
    res.status(201).json(proyecto);
  });

  app.get('/api/proyectos/:slug', async (req, res) => {
    const proyecto = await store.readProject(req.params.slug);
    res.json(proyecto);
  });

  app.patch('/api/proyectos/:slug', async (req, res) => {
    const { slug } = req.params;
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });
    }
    const nuevoSlug = slugify(nombre);
    if (!isValidSlug(nuevoSlug)) {
      return res.status(400).json({ error: 'El nombre debe contener letras o números' });
    }
    const existentes = await store.listProjects();
    if (existentes.some((proyecto) => proyecto.slug === nuevoSlug && proyecto.slug !== slug)) {
      return res.status(409).json({ error: `Ya existe un proyecto equivalente a «${nombre}»` });
    }
    const proyecto = await store.updateProject(slug, (data) => {
      data.nombre = nombre;
      return data;
    });
    res.json(proyecto);
  });

  app.delete('/api/proyectos/:slug', async (req, res) => {
    await store.deleteProject(req.params.slug);
    res.status(204).end();
  });

  app.post('/api/proyectos/:slug/tareas', async (req, res) => {
    const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.trim() : '';
    if (!titulo) {
      return res.status(400).json({ error: 'El título de la tarea es obligatorio' });
    }
    const descripcion = normalizeDescription(req.body?.descripcion);
    if (descripcion === null) {
      return res.status(400).json({ error: 'La descripción debe ser texto' });
    }
    const etiquetas = normalizeTags(req.body?.etiquetas);
    if (etiquetas === null) {
      return res.status(400).json({ error: 'Las etiquetas deben ser una lista' });
    }
    // RF-06: la tarea nueva se crea en «pendiente».
    const tarea = newTask({ titulo, descripcion, etiquetas });
    await store.updateProject(req.params.slug, (data) => {
      data.columnas.pendiente.push(tarea);
      return data;
    });
    res.status(201).json(tarea);
  });

  app.patch('/api/proyectos/:slug/tareas/:id', async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const cambios = {};
    if ('titulo' in body) {
      const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
      if (!titulo) {
        return res.status(400).json({ error: 'El título de la tarea es obligatorio' });
      }
      cambios.titulo = titulo;
    }
    if ('descripcion' in body) {
      const descripcion = normalizeDescription(body.descripcion);
      if (descripcion === null) {
        return res.status(400).json({ error: 'La descripción debe ser texto' });
      }
      cambios.descripcion = descripcion;
    }
    if ('etiquetas' in body) {
      const etiquetas = normalizeTags(body.etiquetas);
      if (etiquetas === null) {
        return res.status(400).json({ error: 'Las etiquetas deben ser una lista' });
      }
      cambios.etiquetas = etiquetas;
    }
    let actualizada;
    await store.updateProject(req.params.slug, (data) => {
      const tarea = findTask(data, id);
      if (!tarea) throw new NotFoundError(`No existe la tarea «${id}»`);
      Object.assign(tarea, cambios, { actualizada: new Date().toISOString() });
      actualizada = { ...tarea };
      return data;
    });
    res.json(actualizada);
  });

  app.delete('/api/proyectos/:slug/tareas/:id', async (req, res) => {
    const { id } = req.params;
    await store.updateProject(req.params.slug, (data) => {
      for (const tareas of Object.values(data.columnas || {})) {
        const indice = (tareas || []).findIndex((t) => t.id === id);
        if (indice !== -1) {
          tareas.splice(indice, 1);
          return data;
        }
      }
      throw new NotFoundError(`No existe la tarea «${id}»`);
    });
    res.status(204).end();
  });

  app.post('/api/proyectos/:slug/tareas/:id/mover', async (req, res) => {
    const { id } = req.params;
    const { columna, indice } = req.body || {};
    if (!COLUMNAS.includes(columna)) {
      return res.status(400).json({
        error: 'La columna debe ser «pendiente», «en_desarrollo» o «finalizada»',
      });
    }
    if (!Number.isInteger(indice) || indice < 0) {
      return res.status(400).json({ error: 'El índice debe ser un número entero mayor o igual que 0' });
    }
    const proyecto = await store.updateProject(req.params.slug, (data) => {
      let tarea = null;
      for (const tareas of Object.values(data.columnas || {})) {
        const posicion = (tareas || []).findIndex((t) => t.id === id);
        if (posicion !== -1) {
          [tarea] = tareas.splice(posicion, 1); // extraer del origen
          break;
        }
      }
      if (!tarea) throw new NotFoundError(`No existe la tarea «${id}»`);

      const destino = data.columnas[columna];
      // El índice se aplica sobre la columna destino ya sin la tarea extraída.
      if (indice > destino.length) {
        throw new ValidationError(
          `El índice ${indice} está fuera de la columna «${columna}» (longitud ${destino.length})`
        );
      }
      destino.splice(indice, 0, tarea);
      tarea.actualizada = new Date().toISOString();
      return data;
    });
    res.json(proyecto);
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.name === 'InvalidSlugError') {
      return res.status(400).json({ error: err.message });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    if (err.name === 'CorruptProjectError') {
      return res.status(422).json({ error: err.message });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON inválido en la petición' });
    }
    if (err.name === 'NotFoundError') {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  createApp(createStore()).listen(PORT, '127.0.0.1', () => {
    console.log(`Servidor escuchando en http://127.0.0.1:${PORT}`);
  });
}

module.exports = { createApp };
