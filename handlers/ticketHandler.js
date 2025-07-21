const Ticket = require('../models/Ticket');
const Guild = require('../models/Guild');
const { PermissionsBitField, ChannelType } = require('discord.js');

// Helper to get the ticket request channel ID from guild config
async function getGuildConfig(guildId) {
    return await Guild.findOne({ guildId });
}

async function createTicketChannel(guild, user, guildConfig, query) {
    const { channels, supportTeamRoles } = guildConfig;
    const ticketCategoryId = channels.ticketCategory;

    // Validate if the category exists and is of correct type
    const categoryChannel = guild.channels.cache.get(ticketCategoryId);
    const isValidCategory = categoryChannel && categoryChannel.type === ChannelType.GuildCategory;
    console.log(categoryChannel);
    console.log(isValidCategory);

    if (!isValidCategory) {
        console.warn(`⚠️ Ticket category "${ticketCategoryId}" is invalid or not found. Channel will be created without category.`);
    }

    // Compose a unique channel name: username-ticket (lowercase, sanitized)
    const safeUsername = user.username.toLowerCase().replace(/[^a-zA-Z0-9-_]/g, '');
    const channelName = `${safeUsername}-ticket`;

    const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: isValidCategory ? ticketCategoryId : undefined,
        permissionOverwrites: [
            {
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            ...supportTeamRoles.map(roleId => ({
                id: roleId,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.AttachFiles,
                    PermissionsBitField.Flags.UseApplicationCommands
                ],
            })),
            {
                id: user.id,
                allow: [
                    PermissionsBitField.Flags.ViewChannel,
                    PermissionsBitField.Flags.SendMessages,
                    PermissionsBitField.Flags.ReadMessageHistory,
                    PermissionsBitField.Flags.AttachFiles
                ],
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

async function handleTicketRequest(interaction) {
    const guildConfig = await getGuildConfig(interaction.guild.id);
    if (!guildConfig) {
        return interaction.reply({ content: 'Ticket system not set up yet.', ephemeral: true });
    }

    if (interaction.channel.id !== guildConfig.channels.ticketRequests) {
        return interaction.reply({ content: 'Please use the ticket requests channel.', ephemeral: true });
    }

    const user = interaction.user;
    const query = interaction.options.getString('query') || 'No query provided';

    const openTicketsCount = await Ticket.countDocuments({
        guildId: interaction.guild.id,
        userId: user.id,
        status: 'open',
    });

    if (guildConfig.premium?.tier === 'free' && openTicketsCount >= 10) {
        return interaction.reply({
            content: 'You have reached the maximum of 10 open tickets. Please close some before opening new ones.',
            ephemeral: true
        });
    }

    // Notify staff for approval (this should ideally send a message with Accept/Reject buttons)
    return interaction.reply({
        content: `🎫 Ticket request received. Staff will review it shortly.\n**Your query:** "${query}"`,
        ephemeral: true
    });
}

module.exports = { createTicketChannel, handleTicketRequest };
