# Ariel y sus amigos (y Joel) - La Comunidad Privada 🚀

Bienvenido al caos. Esta es la plataforma oficial y exclusiva para Dereck, Ariel, Andre, Jefferson, Santiago y Joel.

## 🛠 Arquitectura

- **Frontend/Backend:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4.
- **Base de Datos & Auth:** Supabase (PostgreSQL, Auth, Storage).
- **Iconos & Animaciones:** Lucide React, Framer Motion.
- **Bots:** Node.js (Discord.js).

## 🚀 Cómo Empezar

### 1. Configurar Supabase (La Nube)
1. Crea un proyecto en [Supabase](https://supabase.com).
2. Ve al SQL Editor en Supabase y ejecuta todo el contenido de `supabase_schema.sql` para crear las tablas, políticas de seguridad (RLS) y triggers.
3. Ve a **Project Settings -> API** y copia la `URL` y `anon public key`.
4. En el directorio raíz del proyecto, copia `.env.example` a `.env.local` y pega esas credenciales:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=tu-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```
5. Ve a **Authentication -> Providers** y habilita Email (desactiva confirmación por correo si quieres que sea directo).
6. Crea a los 6 usuarios manualmente desde la pestaña **Authentication -> Users** en Supabase, o pídeles que se registren.

### 2. Ejecutar la Web Localmente
1. Abre una terminal en este directorio y ejecuta:
   ```bash
   npm install
   npm run dev
   ```
2. Abre `http://localhost:3000` en tu navegador.

### 3. Configurar el Bot de Discord (Opcional)
1. Ve al [Portal de Desarrolladores de Discord](https://discord.com/developers/applications) y crea una aplicación.
2. Copia el `Token` del Bot y el `Client ID`.
3. Invita al bot a tu servidor privado usando el generador de URL (Scopes: `bot`, `applications.commands`).
4. Añade estas variables a tu `.env.local`:
   ```env
   DISCORD_BOT_TOKEN=tu-token
   DISCORD_CLIENT_ID=tu-client-id
   DISCORD_GUILD_ID=id-del-servidor
   ```
5. Para encender el bot en otra terminal:
   ```bash
   cd discord-bot
   npm install
   node index.js
   ```

### 4. Automatizaciones
El servidor de Next.js incluye endpoints preparados, pero requerirá un servicio como [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) o similar para automatizaciones recurrentes (como "pregunta diaria" o "resumen semanal") llamando a `GET /api/cron/daily`.

## 🌐 Despliegue en Vercel
1. Sube este repositorio a GitHub.
2. Crea un proyecto en [Vercel](https://vercel.com) e importa tu repositorio.
3. En la configuración de Vercel, añade TODAS las variables de entorno de tu archivo `.env.local`.
4. Despliega. ¡Listo! El caos ahora es público (pero con acceso privado).
