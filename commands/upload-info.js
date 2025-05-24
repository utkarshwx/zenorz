const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { uploadHandler } = require('../handlers/uploadHandler');
const logger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upload-info')
        .setDescription('Upload server information files (rules, FAQs, level roles)')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of information to upload')
                .setRequired(true)
                .addChoices(
                    { name: 'Server Rules', value: 'rules' },
                    { name: 'FAQs', value: 'faqs' },
                    { name: 'Level Roles', value: 'level_roles' }
                ))
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('The file to upload (.txt or .md format)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    async execute(interaction) {
        try {
            const type = interaction.options.getString('type');
            const file = interaction.options.getAttachment('file');

            // Call the uploadHandler with the correct parameters
            // The handler expects: (interaction, fileType, attachment)
            const success = await uploadHandler(interaction, type, file);

            // Note: The uploadHandler already handles the interaction replies,
            // so we don't need to reply again here unless there's an error
            
        } catch (error) {
            logger.error(`Error in upload-info command for guild ${interaction.guild.id}:`, error);
            
            // Only reply if we haven't already replied/deferred
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ There was an error uploading the file. Please try again later.',
                    ephemeral: true
                });
            } else if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ There was an error uploading the file. Please try again later.',
                });
            }
        }
    },
};