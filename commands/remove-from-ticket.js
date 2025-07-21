const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remove-from-ticket')
        .setDescription('Manually remove a user or role from this ticket channel.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Choose whether to remove a user or role.')
                .setRequired(true)
                .addChoices(
                    { name: 'User', value: 'user' },
                    { name: 'Role', value: 'role' }
                )
        )
        .addMentionableOption(option =>
            option.setName('target')
                .setDescription('Mention the user or role to remove.')
                .setRequired(true)
        ),

    async execute(interaction) {
        const channel = interaction.channel;

        // Restrict command usage to ticket channels
        if (!channel.name.startsWith('ticket-')) {
            return interaction.reply({
                content: '❌ This command can only be used inside a ticket channel.',
                ephemeral: true,
            });
        }

        const type = interaction.options.getString('type');
        const target = interaction.options.getMentionable('target');

        try {
            await channel.permissionOverwrites.delete(target.id);

            return interaction.reply({
                content: `✅ Successfully removed ${type === 'role' ? `<@&${target.id}>` : `<@${target.id}>`} from this ticket.`,
                ephemeral: true,
            });
        } catch (err) {
            console.error(err);
            return interaction.reply({
                content: '❌ Failed to update channel permissions.',
                ephemeral: true,
            });
        }
    },
};
