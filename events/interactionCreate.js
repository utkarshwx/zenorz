const {
    Events,
    PermissionFlagsBits,
    PermissionsBitField,
    ChannelType,
    ButtonBuilder, ButtonStyle, ActionRowBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    MessageFlags
} = require("discord.js");

const Ticket = require("../models/Ticket");
const Guild = require("../models/Guild");

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // === SLASH COMMANDS ===
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    return interaction.reply({ content: "❌ Unknown command.", ephemeral: true });
                }
                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Error executing command ${interaction.commandName}:`, error);
                    const replyPayload = { content: "❌ There was an error while executing this command.", ephemeral: true };
                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp(replyPayload);
                    } else {
                        await interaction.reply(replyPayload);
                    }
                }
                return;
            }

            // === BUTTONS ===
            if (interaction.isButton()) {
                const { customId, guild, user } = interaction;
                const [action, targetUserId] = customId.split(":");
                const guildConfig = await Guild.findOne({ guildId: guild.id });
                const member = await guild.members.fetch(user.id);
                const supportTeamRoleList = guildConfig?.supportTeamRoles[0];
                const isSupport = guildConfig?.supportTeamRoles?.some(roleId =>
                    member.roles.cache.has(roleId)
                );

                // === ACCEPT TICKET ===
                if (action === "accept_ticket") {
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {

                        if (!isSupport) {
                            
                            return interaction.reply({
                                content: `You need to have the <@&${supportTeamRoleList}> role to use this action.`,
                                flags: MessageFlags.Ephemeral,
                            });
                        }
                    }

                    const targetUser = await guild.members.fetch(targetUserId).catch(() => null);
                    if (!targetUser) {
                        return interaction.reply({
                            content: "❌ Could not find the user.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    const ticket = await Ticket.findOne({
                        guildId: guild.id,
                        userId: targetUserId,
                        status: "pending",
                    });

                    if (!ticket) {
                        return interaction.reply({
                            content: "❌ No pending ticket found for this user.",
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    const openTickets = await Ticket.countDocuments({
                        guildId: guild.id,
                        status: { $in: ["open", "pending"] },
                        userId: ticket.userId,
                    });

                    const premiumTier = guildConfig?.premium?.tier || "free";
                    const isFree = premiumTier === "free";
                    const isBasic = premiumTier === "basic";
                    const maxTickets = isFree ? 10 : isBasic ? 30 : Infinity;

                    if (openTickets >= maxTickets) {
                        return interaction.reply({
                            content: `⚠️ This user has reached the ticket limit of ${maxTickets} for their current tier.`,
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    await interaction.update({ flags: MessageFlags.Ephemeral });

                    try {
                        const ticketCategoryId = guildConfig?.channels?.ticketCategory || null;
                        const ticketChannelName = `ticket-${targetUser.user.username.toLowerCase()}`;

                        const ticketChannel = await guild.channels.create({
                            name: ticketChannelName,
                            type: ChannelType.GuildText,
                            parent: ticketCategoryId,
                            permissionOverwrites: [
                                {
                                    id: guild.roles.everyone,
                                    deny: [PermissionFlagsBits.ViewChannel],
                                },
                                {
                                    id: targetUserId,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles],
                                },
                                ...guildConfig.supportTeamRoles.map(roleId => ({
                                    id: roleId,
                                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.UseApplicationCommands],
                                })),
                            ],
                        });

                        ticket.status = "open";
                        ticket.channelId = ticketChannel.id;
                        ticket.ticketId = ticketChannel.id;
                        await ticket.save();

                        const closeButton = new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('Close Ticket')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🔒');

                        const row = new ActionRowBuilder().addComponents(closeButton);

                        const acceptanceMessage = `Hey there <@${targetUserId}>, your ticket has been accepted by <@${interaction.user.id}>!\n Share your issue below, and our team will help you out as best as we can.`;

                        await ticketChannel.send({
                            content: acceptanceMessage,
                            components: [row],
                        });

                        const ticketQueryMessage = `▫️ Issue: \n \`\`\`${ticket.query}\`\`\``

                        await ticketChannel.send({
                            content: ticketQueryMessage || "No message provided.",
                        });

                        const originalMessage = await interaction.message.fetch();
                        const existingEmbed = originalMessage.embeds?.[0];

                        const newDescription = `${existingEmbed?.description || ""}\n\n✅ **Accepted by <@${interaction.user.id}>**`;

                        const updatedEmbed = {
                            ...existingEmbed?.toJSON(),
                            description: newDescription,
                            color: 0x00a884,
                            timestamp: new Date().toISOString(),
                        };

                        await interaction.editReply({
                            content: `✅ Ticket accepted by <@${user.id}> and moved to ${ticketChannel}`,
                            embeds: [updatedEmbed],
                            components: [],
                        });

                        try {
                            await targetUser.send(`🟢 Your ticket request has been accepted by <@${user.id}>. \nPlease head over to <#${ticketChannel.id}> to continue the conversation`);
                        } catch (_) {
                            // DMs are closed
                        }

                        const logChannel = guild.channels.cache.get(guildConfig?.channels?.logChannel);
                        if (logChannel) {
                            await logChannel.send({
                                content: `📌 Ticket \`${ticketChannel.name}\` accepted by <@${user.id}>.`,
                            });
                        }

                    } catch (err) {
                        console.error("Ticket accept error:", err);
                        await interaction.editReply({
                            content: "❌ Something went wrong while accepting the ticket.",
                        });
                    }

                    return;
                }

                // === REJECT TICKET ===
                if (action === "reject_ticket") {

                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)){

                        if (!isSupport) {
                            return interaction.reply({
                                content: `You need to have the <@&${supportTeamRoleList}> role to use this action.`,
                                ephemeral: true,
                            });
                        }
                    }

                    const isPremium = ["pro", "elite"].includes(guildConfig?.premium?.tier);

                    if (isPremium) {
                        const modal = new ModalBuilder()
                            .setCustomId(`reject_reason_modal:${targetUserId}`)
                            .setTitle('Reason for Rejection');

                        const input = new TextInputBuilder()
                            .setCustomId('rejection_reason')
                            .setLabel('Please provide a reason')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true);

                        modal.addComponents(new ActionRowBuilder().addComponents(input));
                        return interaction.showModal(modal);
                    }

                    const ticket = await Ticket.findOne({
                        guildId: guild.id,
                        userId: targetUserId,
                        status: "pending",
                    });

                    if (!ticket) {
                        return interaction.reply({
                            content: "❌ No pending ticket found for this user.",
                            ephemeral: true,
                        });
                    }

                    ticket.status = "closed";
                    ticket.resolvedAt = new Date();
                    await ticket.save();

                    const targetUser = await guild.members.fetch(targetUserId).catch(() => null);
                    if (targetUser) {
                        try {
                            await targetUser.send(`❌ Your ticket request was rejected by <@${user.id}>.`);
                        } catch (_) { /* DMs off */ }
                    }

                    await interaction.update({
                        content: `❌ Ticket rejected by <@${user.id}>.`,
                        components: [],
                    });

                    const logChannel = guild.channels.cache.get(guildConfig?.logChannel);
                    if (logChannel) {
                        await logChannel.send(`📁 Ticket request from <@${targetUserId}> was rejected by <@${user.id}>.`);
                    }

                    return;
                }

                // === CLOSE TICKET ===
                if (customId === "close_ticket") {
                    const channel = interaction.channel;

                    const ticket = await Ticket.findOne({ channelId: channel.id });
                    if (ticket) {
                        ticket.status = "closed";
                        ticket.resolvedAt = new Date();
                        await ticket.save();

                        await channel.permissionOverwrites.edit(ticket.userId, {
                            ViewChannel: false,
                        });
                    }

                    const logChannel = guild.channels.cache.get(guildConfig?.channels?.logChannel);
                    if (logChannel) {
                        await logChannel.send({
                            content: `📁 Ticket \`${channel.name}\` closed by <@${user.id}>.`,
                        });
                    }

                    await interaction.reply({
                        content: "🛑 Ticket will be closed soon...",
                        ephemeral: true,
                    });

                    setTimeout(async () => {
                        if (channel.deletable) {
                            await channel.delete("Ticket closed.");
                        }
                    }, 10000);

                    return;
                }

                if (customId === "create_ticket") {
                    const userId = user.id;

                    const existingPendingOrOpenTickets = await Ticket.countDocuments({
                        guildId: guild.id,
                        userId,
                        status: { $in: ["open", "pending"] },
                    });

                    const guildConfig = await Guild.findOne({ guildId: guild.id });
                    const tier = guildConfig?.premium?.tier || "free";

                    if (tier === "free" && existingPendingOrOpenTickets >= 10) {
                        return interaction.reply({
                            content: "⚠️ You have reached the maximum of 10 open/pending tickets for the Free tier. Please close existing tickets or upgrade to a higher tier.",
                            ephemeral: true,
                        });
                    }

                    const existingPendingTicket = await Ticket.findOne({
                        guildId: guild.id,
                        userId,
                        channelId: 0,
                        ticketId: 0,
                        query: "User has yet to add his query ticket was created by ",
                        status: "pending",
                    });

                    if (existingPendingTicket) {
                        return interaction.reply({
                            content: "⚠️ You already have a pending ticket request. Please wait for support to accept or reject it.",
                            ephemeral: true,
                        });
                    }

                    const newTicket = new Ticket({
                        guildId: guild.id,
                        userId,
                        status: "pending",
                        channelId: 0,
                        ticketId: 0,
                        createdAt: new Date(),
                        query: "Ticket was created using button",
                    });

                    await newTicket.save();

                    // Send to staff/log channel (if set)
                    const logChannel = guild.channels.cache.get(guildConfig?.channels.ticketRequests);
                    if (logChannel) {
                        const accept = new ButtonBuilder()
                            .setCustomId(`accept_ticket:${userId}`)
                            .setLabel("Accept")
                            .setStyle(ButtonStyle.Success)
                            .setEmoji("✅");

                        const reject = new ButtonBuilder()
                            .setCustomId(`reject_ticket:${userId}`)
                            .setLabel("Reject")
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji("❌");

                        const row = new ActionRowBuilder().addComponents(accept, reject);

                        await logChannel.send({
                            content: `📨 New ticket request from <@${userId}>.`,
                            components: [row],
                        });
                    }

                    return interaction.reply({
                        content: "✅ Your ticket request has been submitted. Please wait for a support member to review it.",
                        ephemeral: true,
                    });
                }
            }

            // === MODAL SUBMISSION HANDLER ===
            if (interaction.isModalSubmit()) {
                const { guild } = interaction;
                const guildConfig = await Guild.findOne({ guildId: guild.id });
                const [modalAction, targetUserId] = interaction.customId.split(":");
                if (modalAction === "reject_reason_modal") {

                    const reason = interaction.fields.getTextInputValue("rejection_reason");

                    const ticket = await Ticket.findOne({
                        guildId: interaction.guild.id,
                        userId: targetUserId,
                        status: "pending",
                    });

                    if (!ticket) {
                        return interaction.reply({
                            content: "❌ Ticket not found or already processed.",
                            ephemeral: true,
                        });
                    }

                    ticket.status = "closed";
                    ticket.resolvedAt = new Date();
                    await ticket.save();

                    // Notify the user
                    const targetUser = await interaction.guild.members.fetch(targetUserId).catch(() => null);
                    if (targetUser) {
                        try {
                            await targetUser.send({
                                content: `🔴 Unfortunately, your ticket was rejected by <@${interaction.user.id}>.\n**Reason:** ${reason}`,
                            });
                        } catch (_) { /* DMs closed */ }
                    }

                    // Update the message embed with reason
                    const originalMessage = await interaction.message.fetch();
                    const existingEmbed = originalMessage.embeds?.[0];
                    const newDescription = `${existingEmbed?.description || ""}\n\n❌ **Rejected by <@${interaction.user.id}>**\n📄 Reason: ${reason}`;

                    const updatedEmbed = {
                        ...existingEmbed?.toJSON(),
                        description: newDescription,
                        color: 0xFF0000,
                        timestamp: new Date().toISOString(),
                    };

                    await interaction.update({
                        embeds: [updatedEmbed],
                        components: [],
                    });

                    const logChannel = interaction.guild.channels.cache.get(guildConfig?.logChannel);
                    if (logChannel) {
                        await logChannel.send({
                            content: `📁 Ticket request from <@${targetUserId}> was rejected by <@${interaction.user.id}>.`,
                            embeds: [embed],
                        });
                    }

                    return;
                }
            }
        } catch (error) {
            console.error("interactionCreate error:", error);
            if (!interaction.deferred && !interaction.replied) {
                await interaction.reply({
                    content: "❌ An unexpected error occurred.",
                    ephemeral: true,
                });
            }
        }
    },
};
