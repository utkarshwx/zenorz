const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Guild = require('../models/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-welcome')
    .setDescription('Configure the welcome message system for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addBooleanOption(option =>
      option.setName('enabled')
        .setDescription('Enable or disable welcome messages')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Select the welcome channel')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('messages')
        .setDescription('Comma-separated custom welcome messages (use {user} and {server})')
        .setRequired(false)
    ),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const enabled = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');
    const rawMessages = interaction.options.getString('messages');

    const update = {
      setupCompleted: true,
    };

    if (!enabled) {
      update.channels = { welcomeChannel: null };
      update.welcomeMessages = [];
    } else {
      if (channel) {
        update['channels.welcomeChannel'] = channel.id;
      }

      if (rawMessages) {
        const messages = rawMessages
          .split(',')
          .map(msg => msg.trim())
          .filter(msg => msg.length > 0);
        update.welcomeMessages = messages;
      }
    }

    await Guild.findOneAndUpdate(
      { guildId },
      { $set: update },
      { upsert: true, new: true }
    );

    return interaction.reply({
      content: enabled
        ? `✅ Welcome system has been **enabled**.\n${channel ? `📨 Channel set to <#${channel.id}>.` : ''}${rawMessages ? `\n📝 Custom messages saved.` : ''}`
        : '🚫 Welcome system has been **disabled**.',
      ephemeral: true
    });
  },
};
