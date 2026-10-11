require('dotenv').config({ path: '../.env.local' });
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

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
    console.error('Error registrando comandos:', error);
  }
}

client.on('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}! El Caos Administrado.`);
  registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'muro') {
    const embed = new EmbedBuilder()
      .setColor('#8b5cf6')
      .setTitle('El Muro - Ariel y sus amigos (y Joel)')
      .setDescription('Ve a ver las últimas publicaciones y caos en la web oficial.')
      .setURL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000/muro');

    await interaction.reply({ embeds: [embed] });
  }
  
  if (interaction.commandName === 'meme') {
    await interaction.deferReply();
    const { data, error } = await supabase.from('memories').select('*').eq('type', 'meme');
    
    if (error || !data || data.length === 0) {
      return interaction.editReply('Todavía no hay memes en el museo. ¡Vayan a la web a subir algo!');
    }

    const randomMeme = data[Math.floor(Math.random() * data.length)];
    const embed = new EmbedBuilder()
      .setColor('#d946ef')
      .setTitle(randomMeme.title || 'Meme sin título')
      .setImage(randomMeme.media_url);

    await interaction.editReply({ embeds: [embed] });
  }

  if (interaction.commandName === 'evento') {
    const titulo = interaction.options.getString('titulo');
    await interaction.reply(`📢 **NUEVO EVENTO:** ${titulo}\n¡Todos repórtense o habrá tabla!`);
  }
});

if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN);
} else {
  console.log('Falta token');
}
