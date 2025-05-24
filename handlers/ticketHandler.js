const Ticket = require('../models/Ticket');
const Guild = require('../models/Guild');
const { PermissionsBitField, ChannelType } = require('discord.js');

// Helper to get the ticket request channel ID from guild config
async function getGuildConfig(guildId) {
    return await Guild.findOne({ guildId });
}

// Create a new ticket channel for the user after approval
async function createTicketChannel(guild, user, guildConfig, query) {
    const { channels, supportTeamRoles } = guildConfig;
    const ticketCategoryId = channels.ticketChannel
        ? (await guild.channels.fetch(channels.ticketChannel))?.parentId
        : null;

    // Compose a unique channel name: username-ticket (lowercase, sanitized)
    const safeUsername = user.username.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '');
    const channelName = `${safeUsername}-ticket`;

    // Create ticket channel inside category if possible
    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: ticketCategoryId || undefined,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            ...supportTeamRoles.map(roleId => ({
                id: roleId,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
            })),
            {
                id: user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
            },
        ],
        reason: `Ticket channel created for ${user.tag}`,
    });

    // Save ticket in DB
    const newTicket = new Ticket({
        guildId: guild.id,
        userId: user.id,
        ticketId: ticketChannel.id, // use channel ID as ticketId for uniqueness
        channelId: ticketChannel.id,
        status: 'open',
        query,
    });
    await newTicket.save();

    return ticketChannel;
}

// Handle a ticket request (e.g., a command or message in ticketRequests channel)
async function handleTicketRequest(interaction) {
    const guildConfig = await getGuildConfig(interaction.guild.id);
    if (!guildConfig) {
        return interaction.reply({ content: 'Ticket system not set up yet.', ephemeral: true });
    }

    // Check if the request came from ticketRequests channel or other logic
    if (interaction.channel.id !== guildConfig.channels.ticketRequests) {
        return interaction.reply({ content: 'Please use the ticket requests channel.', ephemeral: true });
    }

    const user = interaction.user;
    const query = interaction.options.getString('query') || 'No query provided';

    // Check if user has too many open tickets (for free tier, limit 10)
    const openTicketsCount = await Ticket.countDocuments({
        guildId: interaction.guild.id,
        userId: user.id,
        status: 'open',
    });

    if (guildConfig.premium?.tier === 'free' && openTicketsCount >= 10) {
        return interaction.reply({ content: 'You have reached the maximum of 10 open tickets. Please close some before opening new ones.', ephemeral: true });
    }

    // Create a message to staff for approval - this would be done via your bot's internal logic,
    // e.g., sending a message with buttons Accept / Reject in the ticketRequests channel for staff

    // For demo, just reply (replace with your actual approval logic)
    return interaction.reply({ content: `Ticket request received. Staff will review it shortly. Your query: "${query}"`, ephemeral: true });
}

// Callbacks for staff to approve/reject requests will call createTicketChannel or send rejection DMs

module.exports = { createTicketChannel, handleTicketRequest };
