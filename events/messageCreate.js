const { Events, ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const Guild = require('../models/Guild');
const Ticket = require('../models/Ticket');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot || !message.guild) return;

        if (message.author.id === 873125954959061002) {
            if (message.content == 'hi zenorz') message.reply("Yes sir, How can I help you?")
        }

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

            if (existingTicket) {
                await message.author.send("❌ You already have an open or pending ticket. Please wait for support.");
                await message.delete().catch(() => {});
                return;
            }

            // Create pending ticket
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
                .setDescription(`**User:** <@${message.author.id}> (${message.author.tag})\n**Message:** ${message.content}`)
                .setColor('Blue')
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

            await requestChannel.send({ content: `Staff, a new ticket request from <@${message.author.id}>`, embeds: [embed], components: [row] });

            try {
                await message.author.send(`✅ Your ticket request has been sent to our support team. Please wait for a response.`);
            } catch {
                // DMs disabled; ignore
            }

            logger.info(`Ticket request forwarded by ${message.author.tag} in guild ${message.guild.id}`);

        } catch (err) {
            logger.error('Error in messageCreate ticket handler:', err);
        }
    },
};
