require('dotenv').config({ path: '../.env.local' });
const http = require('http');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// Servidor HTTP simple para permitir Hosting Gratuito 24/7 en Render (Web Service Free Tier)
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🤖 Administrador del Caos - Bot de Discord Activo 24/7\n');
}).listen(PORT, () => {
  console.log(`Servidor HTTP activo en puerto ${PORT} para Render Free Web Service`);
});

// Supabase Setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const commands = [
  new SlashCommandBuilder()
    .setName('muro')
    .setDescription('Obtén un enlace rápido al muro oficial.'),
  new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Obtén un meme aleatorio del museo.'),
  new SlashCommandBuilder()
    .setName('evento')
    .setDescription('Anuncia un nuevo evento en el servidor.')
    .addStringOption(option => 
      option.setName('titulo')
        .setDescription('El título del evento')
        .setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN || '');

async function registerCommands() {
  try {
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_CLIENT_ID) return;
    
    if (process.env.DISCORD_GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: commands });
      console.log('Comandos registrados en el Servidor (Guild).');
    } else {
      await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
      console.log('Comandos registrados Globalmente.');
    }
  } catch (error) {
    console.error('Error al registrar comandos:', error);
  }
}

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}! El Caos Administrado.`);
  registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'muro') {
    const embed = new EmbedBuilder()
      .setColor(0x00FF99)
      .setTitle('Muro del Servidor')
      .setDescription('Ve a ver las últimas publicaciones y caos en la web oficial.')
      .setURL(process.env.NEXT_PUBLIC_SITE_URL || 'https://ariel-y-sus-amigos.vercel.app/muro');

    await interaction.reply({ embeds: [embed] });
  } else if (commandName === 'meme') {
    const { data, error } = await supabase
      .from('memories')
      .select('media_url, title')
      .eq('type', 'meme');

    if (error || !data || data.length === 0) {
      await interaction.reply('No hay memes en la galería todavía.');
      return;
    }

    const randomMeme = data[Math.floor(Math.random() * data.length)];
    const embed = new EmbedBuilder()
      .setColor(0xFF0055)
      .setTitle(randomMeme.title || 'Meme del Día')
      .setImage(randomMeme.media_url);

    await interaction.reply({ embeds: [embed] });
  } else if (commandName === 'evento') {
    const titulo = interaction.options.getString('titulo');
    await interaction.reply(`📢 **NUEVO EVENTO ANUNCIADO:** ${titulo}\nPreparen sus armas y botanas.`);
  }
});

if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN);
} else {
  console.log('Falta token de Discord');
}
