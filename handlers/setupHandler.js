const {
    ChannelType,
    PermissionsBitField,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    roleMention,
} = require('discord.js');

const Guild = require('../models/Guild');

const setupGuild = async (interaction, rawOpts = {}) => {
    await interaction.deferReply({ ephemeral: true });

    const opts = {
        supportRoles: [],
        ticketCategory: null,
        ticketChannel: null,
        ticketRequestsChannel: null,
        logChannel: null,
        useButton: true,
        autoCloseAfterDays: 7,
        preventDuplicateTickets: true,
        ...rawOpts,
    };

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.editReply({
            content: '❌ You need Administrator permission to use this command.',
            ephemeral: true,
        });
    }

    const guild = interaction.guild;
    let guildConfig = await Guild.findOne({ guildId: guild.id });

    if (guildConfig?.setupCompleted && guildConfig?.premium?.tier === 'free') {
        return interaction.editReply({
            content: '⚠️ You are on the free plan. You can only have one ticket system setup. Upgrade to **basic** or **pro** to enable multiple configurations.',
            ephemeral: true,
        });
    }
    
    if (!guildConfig) {
        guildConfig = new Guild({ guildId: guild.id });
    }

    let supportRoleIds = [];
    if (Array.isArray(opts.supportRoles) && opts.supportRoles.length > 0) {
        supportRoleIds = opts.supportRoles.filter(rId => guild.roles.cache.has(rId));
    } else if (typeof opts.supportRoles === 'string' && guild.roles.cache.has(opts.supportRoles)) {
        supportRoleIds = [opts.supportRoles];
    }

    if (supportRoleIds.length === 0) {
        const defaultSupportRole = await guild.roles.create({
            name: 'Support Team',
            color: '#00aaff',
            reason: 'Ticket support role created by bot setup',
        });
        supportRoleIds.push(defaultSupportRole.id);
    }

    let categoryChannel = opts.ticketCategory ? guild.channels.cache.get(opts.ticketCategory) : null;
    if (!categoryChannel) {
        categoryChannel = await guild.channels.create({
            name: 'Support Tickets',
            type: ChannelType.GuildCategory,
            reason: 'Default ticket category created by bot',
        });
    }

    let ticketChannel = opts.ticketChannel ? guild.channels.cache.get(opts.ticketChannel) : null;
    if (!ticketChannel) {
        ticketChannel = await guild.channels.create({
            name: 'create-ticket',
            type: ChannelType.GuildText,
            parent: categoryChannel.id,
            reason: 'Ticket creation channel',
        });
    } else if (ticketChannel.parentId !== categoryChannel.id) {
        await ticketChannel.setParent(categoryChannel.id);
    }

    let ticketRequestsChannel = opts.ticketRequestsChannel ? guild.channels.cache.get(opts.ticketRequestsChannel) : null;
    if (!ticketRequestsChannel) {
        ticketRequestsChannel = await guild.channels.create({
            name: 'ticket-requests',
            type: ChannelType.GuildText,
            parent: categoryChannel.id,
            reason: 'Channel for ticket approval requests',
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                ...supportRoleIds.map(roleId => ({
                    id: roleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                })),
            ],
        });
    }

    let logChannel = opts.logChannel ? guild.channels.cache.get(opts.logChannel) : null;

    if (opts.useButton) {
        await ticketChannel.permissionOverwrites.set([
            {
                id: guild.roles.everyone.id,
                deny: [PermissionsBitField.Flags.SendMessages],
                allow: [PermissionsBitField.Flags.ViewChannel],
            },
            ...supportRoleIds.map(roleId => ({
                id: roleId,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            })),
        ]);
    } else {
        await ticketChannel.permissionOverwrites.set([
            {
                id: guild.roles.everyone.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            },
            ...supportRoleIds.map(roleId => ({
                id: roleId,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            })),
        ]);
        await ticketChannel.setRateLimitPerUser(1800);
    }

    let welcomeText = '';
    let components = [];

    if (opts.useButton) {
        const createBtn = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫');

        welcomeText = `🎫 **Support Ticket System**\nNeed help? Click **Create Ticket** below.\nModerator will respond in some time.`;
        components = [new ActionRowBuilder().addComponents(createBtn)];
    } else {
        welcomeText = `🎫 **Support Ticket System**\nNeed help? Just send a message here.\nModerator will respond in some time.`;
    }

    const fetchedMessages = await ticketChannel.messages.fetch({ limit: 5 });
    const oldMessage = fetchedMessages.find(m => m.author.id === guild.members.me.id);
    if (oldMessage) {
        await oldMessage.edit({ content: welcomeText, components });
    } else {
        await ticketChannel.send({ content: welcomeText, components });
    }

    guildConfig.guildName = guild.name;
    guildConfig.supportTeamRoles = supportRoleIds;
    guildConfig.channels = {
        ticketChannel: ticketChannel ? ticketChannel.id : null,
        ticketRequests: ticketRequestsChannel ? ticketRequestsChannel.id : null,
        ticketLogs: logChannel ? logChannel.id : null,
    };
    guildConfig.useButton = Boolean(opts.useButton);
    guildConfig.autoCloseAfterDays = opts.autoCloseAfterDays || 7;
    guildConfig.preventDuplicateTickets = opts.preventDuplicateTickets !== false;
    guildConfig.setupCompleted = true;
    guildConfig.updatedAt = new Date();

    await guildConfig.save();

    await interaction.editReply({
        content: `✅ Ticket system setup complete! Use <#${ticketChannel.id}> to open tickets.`,
        ephemeral: true,
    });

    return guildConfig;
};

module.exports = { setupGuild };
