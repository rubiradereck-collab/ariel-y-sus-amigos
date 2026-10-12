#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const slug = args[0];

if (!slug) {
  console.error(`
❌ Uso: node scripts/add-game.mjs <slug> [opciones]
Ejemplo: node scripts/add-game.mjs laberinto-neon --title="Laberinto Neón" --cat="puzzles"

Opciones disponibles:
  --title="Título del juego"
  --cat="puzzles|arcade|mesa|casual"  (por defecto: casual)
  --desc="Descripción corta"
  --author="Nombre del autor"          (por defecto: Ariel y sus amigos)
  --license="MIT|CC0|Propia"           (por defecto: MIT)
`);
  process.exit(1);
}

// Parsear banderas adicionales
function getArg(flag, defaultValue) {
  const item = args.find(a => a.startsWith(`--${flag}=`));
  return item ? item.split('=')[1].replace(/^["']|["']$/g, '') : defaultValue;
}

const title = getArg('title', slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
const category = getArg('cat', 'casual');
const description = getArg('desc', `Juego casual ${title} para jugar sin descargas.`);
const author = getArg('author', 'Ariel y sus amigos');
const license = getArg('license', 'MIT');

const srcDir = path.join(rootDir, 'games-src', slug);
const destDir = path.join(rootDir, 'public', 'games', slug);

if (!fs.existsSync(srcDir)) {
  console.error(`❌ Error: El directorio de origen no existe: ${srcDir}`);
  process.exit(1);
}

const srcIndex = path.join(srcDir, 'index.html');
if (!fs.existsSync(srcIndex)) {
  console.error(`❌ Error: Falta el archivo index.html en: ${srcIndex}`);
  process.exit(1);
}

// Copiar archivos recursivamente
fs.mkdirSync(destDir, { recursive: true });
fs.cpSync(srcDir, destDir, { recursive: true });

// Comprobar si existe licencia
const destLicense = path.join(destDir, 'LICENSE');
if (!fs.existsSync(destLicense)) {
  const licenseContent = `MIT License

Copyright (c) ${new Date().getFullYear()} ${author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
  fs.writeFileSync(destLicense, licenseContent, 'utf-8');
}

console.log(`\n✅ ¡Juego copiado con éxito!`);
console.log(`📁 Origen:  ${srcDir}`);
console.log(`🚀 Destino: ${destDir}`);
console.log(`🌐 URL pública relativa: /games/${slug}/index.html\n`);

const sqlStatement = `
-- Sentencia SQL para registrar en Supabase:
INSERT INTO public.external_games (
  slug, title, category, description,
  cover_url, embed_url,
  source_type, license, author,
  is_featured, active
) VALUES (
  '${slug}',
  '${title.replace(/'/g, "''")}',
  '${category}',
  '${description.replace(/'/g, "''")}',
  '/games/${slug}-cover.webp',
  '/games/${slug}/index.html',
  'propio',
  '${license}',
  '${author.replace(/'/g, "''")}',
  false,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  cover_url = EXCLUDED.cover_url,
  embed_url = EXCLUDED.embed_url,
  source_type = EXCLUDED.source_type,
  license = EXCLUDED.license,
  author = EXCLUDED.author;
`;

console.log('='.repeat(65));
console.log(sqlStatement.trim());
console.log('='.repeat(65));
console.log(`\n📸 Recuerda colocar la carátula en: public/games/${slug}-cover.webp (16:10)\n`);
