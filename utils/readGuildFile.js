const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

/**
 * Read a guild-specific file from the file system
 * @param {string} guildId - The Discord guild ID
 * @param {string} fileType - The type of file to read (rules, faqs, level_roles)
 * @returns {Promise<string>} - The content of the file
 */
const readGuildFile = async (guildId, fileType) => {
    try {

        const validFileTypes = ['rules', 'faqs', 'level_roles'];
        if (!validFileTypes.includes(fileType)) {
            throw new Error(`Invalid file type: ${fileType}`);
        }

        const guildDataDir = path.join(__dirname, '..', 'guild_data', guildId);
        const filePath = path.join(guildDataDir, `${fileType}.txt`);

        try {
            await fs.access(guildDataDir);
        } catch (error) {

            await fs.mkdir(guildDataDir, { recursive: true });
            logger.info(`Created guild data directory for guild ${guildId}`);

            throw new Error(`File ${fileType}.txt not found for guild ${guildId}`);
        }

        const content = await fs.readFile(filePath, 'utf8');
        return content.trim();
    } catch (error) {
        if (error.code === 'ENOENT') {
            logger.debug(`File ${fileType}.txt not found for guild ${guildId}`);
            return '';
        }

        logger.error(`Error reading guild file: ${error.message}`);
        throw error;
    }
};

/**
 * Write content to a guild-specific file
 * @param {string} guildId - The Discord guild ID
 * @param {string} fileType - The type of file to write (rules, faqs, level_roles)
 * @param {string} content - The content to write to the file
 * @returns {Promise<void>}
 */

const writeGuildFile = async (guildId, fileType, content) => {
    try {
        const validFileTypes = ['rules', 'faqs', 'level_roles'];
        if (!validFileTypes.includes(fileType)) {
            throw new Error(`Invalid file type: ${fileType}`);
        }

        const guildDataDir = path.join(__dirname, '..', 'guild_data', guildId);
        const filePath = path.join(guildDataDir, `${fileType}.txt`);

        try {
            await fs.access(guildDataDir);
        } catch (error) {

            await fs.mkdir(guildDataDir, { recursive: true });
            logger.info(`Created guild data directory for guild ${guildId}`);
        }


        await fs.writeFile(filePath, content);
        logger.info(`Updated ${fileType}.txt for guild ${guildId}`);
    } catch (error) {
        logger.error(`Error writing guild file: ${error.message}`);
        throw error;
    }
};

module.exports = {
    readGuildFile,
    writeGuildFile
};