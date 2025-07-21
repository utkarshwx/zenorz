const { Events, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');
const Ticket = require('../models/Ticket');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        try {
            const guildConfig = await Guild.findOne({ guildId: message.guild.id });
            if (!guildConfig || !guildConfig.channels?.ticketChannel || !guildConfig.channels?.ticketRequests) return;

            const ticketChannelId = guildConfig.channels.ticketChannel;
            const requestsChannelId = guildConfig.channels.ticketRequests;

            // If message is not in the ticketChannel, ignore
            if (message.channel.id !== ticketChannelId) return;

            // Forward the message to the ticketRequests channel
            const requestChannel = await message.guild.channels.fetch(requestsChannelId).catch(() => null);
            if (!requestChannel) {
                logger.error(`Ticket Requests channel not found in guild ${message.guild.id}`);
                return;
            }

            const existingTicket = await Ticket.findOne({
                guildId: message.guild.id,
                userId: message.author.id,
                status: { $in: ["pending", "open"] }
            });

            const guildInfo = await Guild.findOne({
                guildId: message.guild.id,
            });

            const supportRoles = await guildInfo?.supportTeamRoles[0];

            if (existingTicket) {
                await message.author.send("🛑 You already have an open or pending ticket.\nPlease wait patiently for our team to respond before creating a new one.");
                await message.delete().catch(() => {});
                return;
            }

            const newTicket = await Ticket.create({
                guildId: message.guild.id,
                userId: message.author.id,
                channelId: 0,
                ticketId: 0,
                status: "pending",
                query: message.content || null,
                createdAt: new Date()
            });

            const embed = new EmbedBuilder()
                .setTitle('🎟️ New Ticket Request')
                .setDescription(`**▫️ User:** <@${message.author.id}> (${message.author.tag})\n**▫️ Issue:** \n \`\`\`${message.content}\`\`\``)
                .setColor('Yellow')
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`accept_ticket:${message.author.id}`)
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),

                new ButtonBuilder()
                    .setCustomId(`reject_ticket:${message.author.id}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );

            await message.delete().catch(() => { });

            await requestChannel.send({ content: `<@&${supportRoles}> Alert: A new ticket request has been received from <@${message.author.id}>`, embeds: [embed], components: [row] });

            try {
                await message.author.send(`🟡 We've sent your request to our support team! Please hang tight — you'll hear from us soon.`);
            } catch {
                // DMs disabled; ignore
            }

            logger.info(`Ticket request forwarded by ${message.author.tag} in guild ${message.guild.id}`);

        } catch (err) {
            logger.error('Error in messageCreate ticket handler:', err);
        }
    },
};
