# Despliegue en Vercel y PWA (F3-09)

El repositorio ya trae `vercel.json` y el build genera la PWA. Falta solo conectar la cuenta.

## Pasos (una vez)

1. Sube el repositorio a GitHub (la carpeta `ARTE/` no está en git; no hace falta para el build).
2. En [vercel.com](https://vercel.com) → **Add New… → Project** → importa el repositorio.
3. Vercel detecta Vite por `vercel.json` (`npm run build`, salida `dist/`). No hay que tocar nada.
4. (Fase 4, opcional) Añade las variables de entorno de Supabase: ver `docs/ONLINE.md`.
5. **Deploy**. Cada push a la rama principal vuelve a desplegar.

## Qué hace el build

- `tools/artAssets.ts` publica sprites, iconos, baldosas y `assets/manifest.json`.
- `tools/pwa.ts` publica `manifest.webmanifest`, los iconos de `assets/app/` y `sw.js`.
- `sw.js` precachea **todo** el build (~10 MB, sobre todo sprites) en la primera visita: después el juego
  funciona sin conexión. Cada build con ficheros distintos cambia el nombre de la caché y borra la vieja.
- `vercel.json` sirve `sw.js` sin caché y `static/` (ficheros con hash) como inmutables.

## Comprobar

```bash
npm run build
```

```bash
npm run preview
```

Abre `http://localhost:4173`, espera a que cargue, corta el servidor y recarga: debe seguir funcionando.
Para la nota de Lighthouse (pestaña **Lighthouse** de Chrome DevTools, categoría PWA) hace falta HTTPS,
así que pásalo sobre el despliegue de Vercel.

## Iconos

`python tools/make_icons.py` regenera `assets/app/*.png` (esfera de contador Geiger dibujada con código).
