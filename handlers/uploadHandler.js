const {
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const Guild = require('../models/Guild');
const { writeGuildFile } = require('../utils/readGuildFile');

/**
 * Handle file upload for guild-specific information
 * @param {Object} interaction - Discord interaction
 * @param {string} fileType - Type of file (rules, faqs, level_roles)
 * @param {Object} attachment - File attachment
 * @returns {Promise<boolean>} - Whether the upload was successful
 */
const uploadHandler = async (interaction, fileType, attachment) => {
    try {

        if (!interaction.member.permissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({
                content: 'You need Administrator permissions to upload server files.',
                ephemeral: true
            });
            return false;
        }

        const guild = interaction.guild;

        const guildConfig = await Guild.findOne({ guildId: guild.id });

        if (!guildConfig || !guildConfig.setupCompleted) {
            await interaction.reply({
                content: 'Server setup not completed. Please run the `/setup` command first.',
                ephemeral: true
            });
            return false;
        }

        const validFileTypes = ['rules', 'faqs', 'level_roles'];
        if (!validFileTypes.includes(fileType)) {
            await interaction.reply({
                content: `Invalid file type. Please use one of: ${validFileTypes.join(', ')}`,
                ephemeral: true
            });
            return false;
        }

        if (!attachment) {
            await interaction.reply({
                content: `Please attach a file to upload as ${fileType}.`,
                ephemeral: true
            });
            return false;
        }

        if (attachment.size > 1024 * 1024) {
            await interaction.reply({
                content: `File is too large. Maximum size is 1MB.`,
                ephemeral: true
            });
            return false;
        }

        const fileExtension = path.extname(attachment.name).toLowerCase();
        if (!['.txt', '.md'].includes(fileExtension)) {
            await interaction.reply({
                content: 'Only .txt and .md files are supported.',
                ephemeral: true
            });
            return false;
        }

        await interaction.deferReply();

        const response = await fetch(attachment.url);
        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const fileContent = await response.text();

        await writeGuildFile(guild.id, fileType, fileContent);

        guildConfig.uploadedFiles[fileType] = true;
        guildConfig.updatedAt = new Date();
        await guildConfig.save();

        const typeLabel = fileType === 'rules' ? 'Server Rules' :
            fileType === 'faqs' ? 'Frequently Asked Questions' :
                'Level Roles Information';

        const uploadEmbed = new EmbedBuilder()

            .setColor('#00cc99')
            .setTitle(`✅ ${typeLabel} Uploaded`)
            .setDescription(`Successfully uploaded ${attachment.name} as your server's ${typeLabel.toLowerCase()}.`)
            .addFields(
                { name: 'File Size', value: `${Math.round(attachment.size / 1024)} KB`, inline: true },
                { name: 'Content Preview', value: fileContent.substring(0, 100) + (fileContent.length > 100 ? '...' : '') }
            )
            .setFooter({ text: `${guild.name} | Support Ticket System` });

        await interaction.editReply({ embeds: [uploadEmbed] });

        logger.info(`Uploaded ${fileType} for guild ${guild.name} (${guild.id})`);

        return true;
    } catch (error) {
        logger.error(`Error uploading file: ${error.message}`);

        if (interaction.deferred) {
            await interaction.editReply({
                content: `An error occurred during file upload: ${error.message}`,
            });
        } else if (!interaction.replied) {
            await interaction.reply({
                content: `An error occurred during file upload: ${error.message}`,
                ephemeral: true
            });
        }

        return false;
    }
};

module.exports = {
    uploadHandler
};