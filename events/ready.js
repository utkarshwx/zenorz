const { Events, ActivityType } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const fs = require('fs-extra');
const path = require('path');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      logger.info(`Logged in as ${client.user.tag}`);

      // Set bot presence (activity and status)
      await client.user.setPresence({
        activities: [{ name: '/ticket', type: ActivityType.Watching }],
        status: 'online',
      });
      logger.info('Presence set to Watching /ticket');

      // Load commands to register
      const commands = [];
      const commandsPath = path.join(__dirname, '..', 'commands');
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if ('data' in command && typeof command.data.toJSON === 'function') {
          commands.push(command.data.toJSON());
          logger.debug(`Loaded command for registration: ${command.data.name}`);
        } else {
          logger.warn(`Command file ${file} is missing 'data' or toJSON method.`);
        }
      }

      const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

      if (!process.env.DISCORD_TOKEN) {
        logger.error('DISCORD_TOKEN is missing in .env');
        return;
      }

      try {
        logger.info(`Refreshing ${commands.length} application (/) commands.`);

        if (process.env.APPLICATION_ID) {
          await rest.put(
            Routes.applicationCommands(process.env.APPLICATION_ID),
            { body: commands },
          );
          logger.info('Successfully registered application commands globally.');
        } else {
          logger.warn('APPLICATION_ID not found in .env, skipping global command registration.');
        }
      } catch (error) {
        logger.error('Failed to register commands:', error);
      }

      // Ensure guild_data directory exists
      const guildDataPath = path.join(__dirname, '..', 'guild_data');
      await fs.ensureDir(guildDataPath);

      // Ensure data directories for all cached guilds
      client.guilds.cache.forEach(guild => {
        const guildPath = path.join(guildDataPath, guild.id);
        fs.ensureDirSync(guildPath);
        logger.debug(`Ensured guild data directory for ${guild.id} (${guild.name})`);
      });

      logger.info('Bot is ready and all setup done!');
    } catch (error) {
      logger.error('Error in ClientReady event:', error);
    }
  },
};
