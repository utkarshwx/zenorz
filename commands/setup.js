const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { setupGuild } = require('../handlers/setupHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Set up the ticket system')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to create tickets in')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addRoleOption(option =>
      option
        .setName('support_role')
        .setDescription('Role for support team')
        .setRequired(true)
    )
    .addChannelOption(option =>
      option
        .setName('category')
        .setDescription('Ticket category (optional)')
        .addChannelTypes(ChannelType.GuildCategory)
    )
    .addChannelOption(option =>
      option
        .setName('log_channel')
        .setDescription('Log channel for ticket actions (optional)')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addIntegerOption(option =>
      option
        .setName('auto_close_days')
        .setDescription('Auto close ticket after X days (optional)')
    )
    .addBooleanOption(option =>
      option
        .setName('prevent_duplicates')
        .setDescription('Prevent users from opening multiple tickets (default: true)')
    )
    .addBooleanOption(option =>
      option
        .setName('use_button')
        .setDescription('Use ticket creation button (default: true)')
    ),

  async execute(interaction) {
    try {
      const supportRoles = [];
      const primaryRole = interaction.options.getRole('support_role');
      if (primaryRole) supportRoles.push(primaryRole.id);

      await setupGuild(interaction, {
        supportRoles,
        ticketChannel: interaction.options.getChannel('channel')?.id,
        ticketCategory: interaction.options.getChannel('category')?.id || null,
        logChannel: interaction.options.getChannel('log_channel')?.id || null,
        autoCloseAfterDays: interaction.options.getInteger('auto_close_days') || 7,
        preventDuplicateTickets: interaction.options.getBoolean('prevent_duplicates') ?? true,
        useButton: interaction.options.getBoolean('use_button') ?? false,
      });
    } catch (error) {
      console.error('Setup error:', error);

      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: '❌ An error occurred during setup.',
          ephemeral: true,
        });
      }
    }
  },
};
