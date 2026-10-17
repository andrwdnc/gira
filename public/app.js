import { api } from './js/api.js';
import { COLUMNAS } from './js/constants.js';
import { tagHue, tagKey } from './js/tags.js';
import { insertionIndex } from './js/dnd.js';

const CLAVE_ULTIMO = 'gira.proyectoActivo';
const ID_INDICADOR = 'indicador-arrastre';

const estado = {
  proyectos: [],
  slug: null,
  proyecto: null,
  filtro: '',
};

const el = {
  banner: document.getElementById('banner'),
  bannerTexto: document.getElementById('banner-texto'),
  bannerCerrar: document.getElementById('banner-cerrar'),
  selector: document.getElementById('selector-proyecto'),
  filtro: document.getElementById('filtro-etiqueta'),
  tablero: document.getElementById('tablero'),
  btnNuevo: document.getElementById('btn-nuevo-proyecto'),
  btnRenombrar: document.getElementById('btn-renombrar'),
  btnEliminar: document.getElementById('btn-eliminar'),
  btnRecargar: document.getElementById('btn-recargar'),
  btnNuevaTarea: document.getElementById('btn-nueva-tarea'),
  dialogoProyecto: document.getElementById('dialogo-proyecto'),
  dialogoProyectoTitulo: document.getElementById('dialogo-proyecto-titulo'),
  formProyecto: document.getElementById('form-proyecto'),
  inputNombreProyecto: document.getElementById('input-nombre-proyecto'),
  btnCancelarProyecto: document.getElementById('btn-cancelar-proyecto'),
  errorProyecto: document.getElementById('error-proyecto'),
  dialogoTarea: document.getElementById('dialogo-tarea'),
  dialogoTareaTitulo: document.getElementById('dialogo-tarea-titulo'),
  formTarea: document.getElementById('form-tarea'),
  inputTitulo: document.getElementById('input-titulo'),
  inputDescripcion: document.getElementById('input-descripcion'),
  inputEtiquetas: document.getElementById('input-etiquetas'),
  btnCancelarTarea: document.getElementById('btn-cancelar-tarea'),
  errorTarea: document.getElementById('error-tarea'),
};

let modoProyecto = 'crear';
let modoTarea = 'crear';
let tareaEnEdicion = null;
let arrastre = null;

/* ---------- Avisos ---------- */

function mostrarError(mensaje) {
  el.bannerTexto.textContent = mensaje;
  el.banner.hidden = false;
}

function ocultarError() {
  el.banner.hidden = true;
  el.bannerTexto.textContent = '';
}

/* ---------- Cabecera ---------- */

function pintarSelector() {
  el.selector.textContent = '';
  if (estado.proyectos.length === 0) {
    const opcion = document.createElement('option');
    opcion.value = '';
    opcion.textContent = 'Sin proyectos';
    opcion.selected = true;
    el.selector.appendChild(opcion);
    return;
  }
  for (const proyecto of estado.proyectos) {
    const opcion = document.createElement('option');
    opcion.value = proyecto.slug;
    if (proyecto.error) {
      opcion.textContent = `${proyecto.slug} (corrupto)`;
      opcion.disabled = true; // RF-15: no se puede abrir
      opcion.title = proyecto.error;
    } else {
      opcion.textContent = proyecto.nombre;
    }
    el.selector.appendChild(opcion);
  }
  el.selector.value = estado.slug ?? '';
}

function etiquetasDelProyecto() {
  const vistas = new Map();
  const columnas = (estado.proyecto && estado.proyecto.columnas) || {};
  for (const tareas of Object.values(columnas)) {
    for (const tarea of tareas || []) {
      for (const etiqueta of tarea.etiquetas || []) {
        const clave = tagKey(etiqueta);
        if (!vistas.has(clave)) vistas.set(clave, etiqueta);
      }
    }
  }
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

function pintarFiltro() {
  const etiquetas = etiquetasDelProyecto();
  if (estado.filtro && !etiquetas.some((e) => tagKey(e) === tagKey(estado.filtro))) {
    estado.filtro = '';
  }
  el.filtro.textContent = '';
  const todas = document.createElement('option');
  todas.value = '';
  todas.textContent = 'Todas las etiquetas';
  el.filtro.appendChild(todas);
  for (const etiqueta of etiquetas) {
    const opcion = document.createElement('option');
    opcion.value = etiqueta;
    opcion.textContent = etiqueta;
    el.filtro.appendChild(opcion);
  }
  el.filtro.value = estado.filtro;
  el.filtro.disabled = etiquetas.length === 0;
}

function actualizarBotones() {
  const hayProyecto = Boolean(estado.proyecto);
  el.btnRenombrar.disabled = !hayProyecto;
  el.btnEliminar.disabled = !hayProyecto;
  el.btnNuevaTarea.disabled = !hayProyecto;
}

/* ---------- Tablero ---------- */

function pintarTablero() {
  actualizarBotones();
  el.tablero.textContent = '';
  if (!estado.proyecto) {
    const aviso = document.createElement('p');
    aviso.className = 'vacio';
    aviso.textContent =
      estado.proyectos.length === 0
        ? 'Todavía no hay proyectos. Crea uno con «Nuevo proyecto».'
        : 'Selecciona un proyecto para ver su tablero.';
    el.tablero.appendChild(aviso);
    return;
  }
  for (const columna of COLUMNAS) {
    el.tablero.appendChild(crearColumna(columna));
  }
}

function crearColumna(columna) {
  const tareas = estado.proyecto.columnas[columna.clave] || [];

  const seccion = document.createElement('section');
  seccion.className = 'columna';
  seccion.dataset.columna = columna.clave;

  const cabecera = document.createElement('header');
  cabecera.className = 'columna__cabecera';
  const titulo = document.createElement('h2');
  titulo.textContent = columna.etiqueta;
  const contador = document.createElement('span');
  contador.className = 'contador';
  contador.textContent = String(tareas.length); // RF-12
  cabecera.append(titulo, contador);

  const lista = document.createElement('ul');
  lista.className = 'tarjetas';
  lista.dataset.columna = columna.clave;
  for (const tarea of tareas) lista.appendChild(crearTarjeta(tarea));

  lista.addEventListener('dragover', (evento) => alArrastrarSobre(evento, lista, columna.clave));
  lista.addEventListener('dragleave', (evento) => {
    if (!lista.contains(evento.relatedTarget)) quitarIndicador();
  });
  lista.addEventListener('drop', (evento) => alSoltar(evento, columna.clave));

  seccion.append(cabecera, lista);
  return seccion;
}

function crearTarjeta(tarea) {
  const tarjeta = document.createElement('li');
  tarjeta.className = 'tarjeta';
  tarjeta.dataset.id = tarea.id;
  tarjeta.draggable = true;

  if (estado.filtro && !tarea.etiquetas.some((e) => tagKey(e) === tagKey(estado.filtro))) {
    tarjeta.classList.add('oculta'); // RF-11
  }

  const titulo = document.createElement('h3');
  titulo.className = 'tarjeta__titulo';
  titulo.textContent = tarea.titulo; // seguras: siempre textContent
  tarjeta.appendChild(titulo);

  if (tarea.descripcion) {
    const descripcion = document.createElement('p');
    descripcion.className = 'tarjeta__descripcion';
    descripcion.textContent = tarea.descripcion;
    tarjeta.appendChild(descripcion);
  }

  if (tarea.etiquetas.length > 0) {
    const contenedor = document.createElement('div');
    contenedor.className = 'tarjeta__etiquetas';
    for (const etiqueta of tarea.etiquetas) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.style.setProperty('--tag-hue', String(tagHue(etiqueta))); // RF-10
      chip.textContent = etiqueta;
      contenedor.appendChild(chip);
    }
    tarjeta.appendChild(contenedor);
  }

  const acciones = document.createElement('div');
  acciones.className = 'tarjeta__acciones';
  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', () => abrirDialogoTarea(tarea));
  const btnBorrar = document.createElement('button');
  btnBorrar.type = 'button';
  btnBorrar.textContent = 'Eliminar';
  btnBorrar.addEventListener('click', () => eliminarTarea(tarea));
  acciones.append(btnEditar, btnBorrar);
  tarjeta.appendChild(acciones);

  tarjeta.addEventListener('dragstart', (evento) => {
    arrastre = { id: tarea.id, anchorId: null };
    tarjeta.classList.add('arrastrando');
    if (evento.dataTransfer) {
      evento.dataTransfer.setData('text/plain', tarea.id);
      evento.dataTransfer.effectAllowed = 'move';
    }
  });
  tarjeta.addEventListener('dragend', () => {
    tarjeta.classList.remove('arrastrando');
    quitarIndicador();
    arrastre = null;
  });

  return tarjeta;
}

/* ---------- Arrastrar y soltar (RF-09) ---------- */

function tarjetasVisibles(lista) {
  return [...lista.querySelectorAll('.tarjeta:not(.oculta)')];
}

function ubicarIndicador(lista, ancla) {
  let indicador = document.getElementById(ID_INDICADOR);
  if (!indicador) {
    indicador = document.createElement('li');
    indicador.id = ID_INDICADOR;
    indicador.className = 'indicador-arrastre';
    indicador.setAttribute('aria-hidden', 'true');
  }
  if (ancla) lista.insertBefore(indicador, ancla);
  else lista.appendChild(indicador);
}

function quitarIndicador() {
  const indicador = document.getElementById(ID_INDICADOR);
  if (indicador) indicador.remove();
}

function alArrastrarSobre(evento, lista, columna) {
  if (!arrastre) return;
  evento.preventDefault();
  if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'move';

  const visibles = tarjetasVisibles(lista);
  const rects = visibles.map((t) => t.getBoundingClientRect());
  const indice = insertionIndex(rects, evento.clientY);
  const ancla = visibles[indice] || null;

  arrastre.anchorId = ancla ? ancla.dataset.id : null;
  arrastre.columna = columna;
  ubicarIndicador(lista, ancla);
}

async function alSoltar(evento, columna) {
  evento.preventDefault();
  const enCurso = arrastre;
  quitarIndicador();
  if (!enCurso) return;
  arrastre = null;
  await moverTarea(enCurso.id, columna, enCurso.anchorId);
}

async function moverTarea(id, columna, anchorId) {
  try {
    // Índice sobre la columna destino ya sin la tarea arrastrada (design §5).
    const destino = (estado.proyecto.columnas[columna] || []).filter((t) => t.id !== id);
    let indice = anchorId ? destino.findIndex((t) => t.id === anchorId) : destino.length;
    if (indice === -1) indice = destino.length;

    estado.proyecto = await api.moveTask(estado.slug, id, columna, indice); // respuesta = proyecto
    pintarTablero();
  } catch (err) {
    mostrarError(err.message);
  }
}

/* ---------- Proyectos ---------- */

function abrirDialogoProyecto(modo) {
  modoProyecto = modo;
  el.errorProyecto.hidden = true;
  if (modo === 'crear') {
    el.dialogoProyectoTitulo.textContent = 'Nuevo proyecto';
    el.inputNombreProyecto.value = '';
  } else {
    el.dialogoProyectoTitulo.textContent = 'Renombrar proyecto';
    el.inputNombreProyecto.value = estado.proyecto ? estado.proyecto.nombre : '';
  }
  el.dialogoProyecto.showModal();
  el.inputNombreProyecto.focus();
}

async function guardarProyecto(evento) {
  evento.preventDefault();
  const nombre = el.inputNombreProyecto.value.trim();
  if (!nombre) {
    el.errorProyecto.textContent = 'El nombre del proyecto es obligatorio';
    el.errorProyecto.hidden = false;
    return;
  }
  try {
    if (modoProyecto === 'crear') {
      const creado = await api.createProject(nombre);
      el.dialogoProyecto.close();
      estado.slug = null;
      await recargarTodo();
      const nuevo = estado.proyectos.find((p) => !p.error && p.nombre === creado.nombre);
      if (nuevo) await abrirProyecto(nuevo.slug);
    } else {
      await api.renameProject(estado.slug, nombre);
      el.dialogoProyecto.close();
      await recargarTodo();
    }
  } catch (err) {
    el.errorProyecto.textContent = err.message;
    el.errorProyecto.hidden = false;
  }
}

async function eliminarProyecto() {
  if (!estado.proyecto) return;
  if (!confirm(`¿Eliminar el proyecto «${estado.proyecto.nombre}» y todas sus tareas?`)) return;
  try {
    await api.deleteProject(estado.slug);
    estado.slug = null;
    localStorage.removeItem(CLAVE_ULTIMO);
    await recargarTodo();
  } catch (err) {
    mostrarError(err.message);
  }
}

/* ---------- Tareas ---------- */

function abrirDialogoTarea(tarea) {
  if (!estado.proyecto) return;
  modoTarea = tarea ? 'editar' : 'crear';
  tareaEnEdicion = tarea || null;
  el.errorTarea.hidden = true;
  el.dialogoTareaTitulo.textContent = tarea ? 'Editar tarea' : 'Nueva tarea';
  el.inputTitulo.value = tarea ? tarea.titulo : '';
  el.inputDescripcion.value = tarea ? tarea.descripcion : '';
  el.inputEtiquetas.value = tarea ? tarea.etiquetas.join(', ') : '';
  el.dialogoTarea.showModal();
  el.inputTitulo.focus();
}

function reemplazarTarea(tarea) {
  for (const lista of Object.values(estado.proyecto.columnas)) {
    const indice = lista.findIndex((t) => t.id === tarea.id);
    if (indice !== -1) {
      lista[indice] = tarea;
      return;
    }
  }
}

function quitarTareaDelEstado(id) {
  for (const [clave, lista] of Object.entries(estado.proyecto.columnas)) {
    const indice = lista.findIndex((t) => t.id === id);
    if (indice !== -1) {
      estado.proyecto.columnas[clave].splice(indice, 1);
      return;
    }
  }
}

async function guardarTarea(evento) {
  evento.preventDefault();
  const titulo = el.inputTitulo.value.trim();
  if (!titulo) {
    el.errorTarea.textContent = 'El título de la tarea es obligatorio';
    el.errorTarea.hidden = false;
    return;
  }
  const descripcion = el.inputDescripcion.value;
  const etiquetas = el.inputEtiquetas.value
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  try {
    if (modoTarea === 'crear') {
      const creada = await api.createTask(estado.slug, { titulo, descripcion, etiquetas });
      estado.proyecto.columnas.pendiente.push(creada); // el servidor la crea en pendiente
    } else {
      const editada = await api.updateTask(estado.slug, tareaEnEdicion.id, {
        titulo,
        descripcion,
        etiquetas,
      });
      reemplazarTarea(editada);
    }
    el.dialogoTarea.close();
    ocultarError();
    pintarTablero();
    pintarFiltro();
  } catch (err) {
    el.errorTarea.textContent = err.message;
    el.errorTarea.hidden = false;
  }
}

async function eliminarTarea(tarea) {
  if (!confirm(`¿Eliminar la tarea «${tarea.titulo}»?`)) return;
  try {
    await api.deleteTask(estado.slug, tarea.id);
    quitarTareaDelEstado(tarea.id);
    pintarTablero();
    pintarFiltro();
  } catch (err) {
    mostrarError(err.message);
  }
}

/* ---------- Carga y sincronización (RF-14) ---------- */

async function abrirProyecto(slug) {
  estado.slug = slug || null;
  if (!estado.slug) {
    estado.proyecto = null;
    localStorage.removeItem(CLAVE_ULTIMO);
    pintarSelector();
    pintarFiltro();
    pintarTablero();
    return;
  }
  try {
    estado.proyecto = await api.getProject(estado.slug);
    localStorage.setItem(CLAVE_ULTIMO, estado.slug);
    ocultarError();
  } catch (err) {
    estado.proyecto = null;
    mostrarError(err.message);
  }
  pintarSelector();
  pintarFiltro();
  pintarTablero();
}

async function recargarTodo() {
  try {
    const guardado = estado.slug || localStorage.getItem(CLAVE_ULTIMO);
    estado.proyectos = await api.listProjects();
    const validos = estado.proyectos.filter((p) => !p.error);
    const sigueValido = estado.slug && validos.some((p) => p.slug === estado.slug);
    if (!sigueValido) {
      estado.slug = validos.some((p) => p.slug === guardado) ? guardado : validos[0]?.slug ?? null;
    }
    pintarSelector();
    await abrirProyecto(estado.slug);
  } catch (err) {
    mostrarError(err.message);
  }
}

/* ---------- Arranque ---------- */

function iniciar() {
  el.bannerCerrar.addEventListener('click', ocultarError);
  el.selector.addEventListener('change', () => abrirProyecto(el.selector.value));
  el.filtro.addEventListener('change', () => {
    estado.filtro = el.filtro.value;
    pintarTablero();
  });
  el.btnNuevo.addEventListener('click', () => abrirDialogoProyecto('crear'));
  el.btnRenombrar.addEventListener('click', () => abrirDialogoProyecto('renombrar'));
  el.btnEliminar.addEventListener('click', eliminarProyecto);
  el.btnRecargar.addEventListener('click', recargarTodo);
  el.btnNuevaTarea.addEventListener('click', () => abrirDialogoTarea(null));
  el.formProyecto.addEventListener('submit', guardarProyecto);
  el.formTarea.addEventListener('submit', guardarTarea);
  el.btnCancelarProyecto.addEventListener('click', () => el.dialogoProyecto.close());
  el.btnCancelarTarea.addEventListener('click', () => el.dialogoTarea.close());
  // RF-14: al volver a enfocar la pestaña se recarga desde disco.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recargarTodo();
  });

  estado.filtro = '';
  recargarTodo();
}

iniciar();
