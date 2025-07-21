const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('add-into-ticket')
        .setDescription('Manually add a user or role to this ticket channel.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Choose whether to add a user or role.')
                .setRequired(true)
                .addChoices(
                    { name: 'User', value: 'user' },
                    { name: 'Role', value: 'role' }
                )
        )
        .addMentionableOption(option =>
            option.setName('target')
                .setDescription('Mention the user or role to add.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const channel = interaction.channel;

        // Ensure command is used only in ticket channels
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ This command can only be used inside a ticket channel.',
                ephemeral: true,
            });
        }

        const type = interaction.options.getString('type');
        const target = interaction.options.getMentionable('target');

        const permissionUpdate = {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true
        };

        try {
            await channel.permissionOverwrites.edit(target.id, permissionUpdate);

            interaction.reply({
                content: `✅ Successfully added ${type === 'role' ? `<@&${target.id}>` : `<@${target.id}>`} to this ticket.`,
                ephemeral: true,
            });
            try {
                await target.send(`You have been added into a ongoing ticket. \nPlease head over to <#${channel.id}> to continue the conversation`);
            } catch (_) {
                // DMs are closed
            }
        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: '❌ Failed to update channel permissions.',
                ephemeral: true,
            });
        }
    },
};
