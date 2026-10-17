# ADR 0002 — Node.js + Express con frontend vanilla

- **Estado:** aceptada
- **Fecha:** 2026-10-17

## Contexto
La aplicación es personal, corre en local y debe funcionar igual en dos PCs con el mínimo de pasos. Un navegador no puede escribir archivos del repo por sí solo, así que hace falta un proceso local que lea y escriba los JSON.

## Decisión
- Backend: Node.js (>= 18) con Express como única dependencia de runtime.
- Frontend: HTML + CSS + JavaScript vanilla con módulos ES, sin framework ni paso de build.
- Tests con `node:test` (incluido en Node).

## Alternativas descartadas
- **HTML estático sin servidor:** no puede escribir en disco sin la File System Access API, que es poco práctica para este flujo.
- **Framework frontend (Angular/React) o Electron:** añaden build y dependencias que no aportan valor para una herramienta de este tamaño.

## Consecuencias
- Instalación y arranque: `npm install` y `npm start`.
- Muy pocas dependencias que mantener.
- Si el frontend creciera mucho, se podría reevaluar con un nuevo ADR.
