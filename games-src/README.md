# Flujo de Integración de Juegos desde GDevelop / Código Fuente

Este directorio alberga los proyectos de juegos antes de ser publicados en `/arcade/libres`.

---

## 🎮 1. Cómo exportar desde GDevelop 5

1. Abre tu proyecto en **GDevelop 5**.
2. Ve al menú superior: **Archivo (File) > Exportar (Export)**.
3. Elige la opción **Web (HTML5)**.
4. Selecciona **Exportar a una carpeta local (Manual export)**.
5. Selecciona como destino la carpeta `games-src/<slug-del-juego>/`.
   - Ejemplo: `games-src/mi-nuevo-juego/`.
6. Haz clic en **Exportar**.

---

## 🔒 2. Requisitos obligatorios de seguridad y empaquetado

- **Archivo raíz:** Debe existir obligatoriamente `games-src/<slug>/index.html`.
- **Rutas relativas:** Todos los assets (imágenes, audios, scripts `.js`) deben llamarse mediante rutas relativas (`./assets/audio.mp3` o `assets/audio.mp3`), **nunca** con rutas absolutas como `/assets/...` o `C:\...`.
- **Cero trackers o anuncios:** Prohibido incluir SDKs de Google AdSense, Unity Ads, CrazyGames SDK o trackers de analítica externa.
- **Sin scripts de terceros sin auditar:** El código se ejecuta dentro de un sandbox estricto de iframe (`sandbox="allow-scripts allow-pointer-lock allow-fullscreen allow-popups"`).

---

## 🚀 3. Cómo publicar el juego en la plataforma

Una vez que tu carpeta esté en `games-src/<slug>/`, ejecuta el script automatizado:

```bash
node scripts/add-game.mjs <slug>
```

### ¿Qué hace el script?
1. Valida que `games-src/<slug>/index.html` exista y no contenga llamadas peligrosas.
2. Copia todos los archivos a `public/games/<slug>/`.
3. Crea un archivo `LICENSE` si no existe.
4. Genera la sentencia SQL `INSERT INTO public.external_games ...` lista para ser pegada en Supabase SQL Editor.
5. Te recuerda añadir la portada en `public/games/<slug>-cover.webp` (16:10, 640x400).
