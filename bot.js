require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const { connectDatabase } = require('./utils/database');
const logger = require('./utils/logger');

// Initialize the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// Create collections for commands
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    logger.info(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
  }
}

// Load events
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }

  logger.info(`Loaded event: ${event.name}`);
}

// Ensure guild_data directory exists
fs.ensureDirSync(path.join(__dirname, 'guild_data'));

// Connect to the database and then log in to Discord
(async () => {
  try {
    await connectDatabase();
    logger.info('Database connected successfully.');
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('Discord client logged in successfully.');
  } catch (error) {
    logger.error('Failed to start the bot:', error);
    process.exit(1);
  }
})();

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

module.exports = client; // Export client if needed elsewhere
