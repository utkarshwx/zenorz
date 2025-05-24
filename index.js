require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const { connectToDatabase } = require('./utils/database');


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});


client.commands = new Collection();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    logger.info(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`The command at ${filePath} is missing required "data" or "execute" property.`);
  }
}

const registerCommands = async () => {
  try {
    const commands = [];

    for (const file of commandFiles) {
      const command = require(`./commands/${file}`);
      commands.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    logger.info('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands },
    );

    logger.info('Successfully reloaded application (/) commands.');
  } catch (error) {
    logger.error(`Error registering commands: ${error.message}`);
  }
};

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }

  logger.info(`Loaded event: ${event.name}`);
}

const guildDataPath = path.join(__dirname, 'guild_data');
if (!fs.existsSync(guildDataPath)) {
  fs.mkdirSync(guildDataPath);
  logger.info('Created guild_data directory');
}

const init = async () => {
  try {
    await connectToDatabase();

    await registerCommands();

    await client.login(TOKEN);

    logger.info('Bot initialization completed successfully');
  } catch (error) {
    logger.error(`Bot initialization failed: ${error.message}`);
    process.exit(1);
  }
};

process.on('unhandledRejection', (error) => {
  logger.error(`Unhandled promise rejection: ${error.message}`);
  console.error(error);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`);
  console.error(error);
  process.exit(1);
});

init();