const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { readGuildFile } = require('./readGuildFile');

/**
 * Build a prompt for Gemini based on the guild's data and user query
 * @param {string} guildId - The Discord guild ID
 * @param {string} guildName - The Discord guild name
 * @param {string} query - The user's question or report
 * @returns {Promise<Object>} - Object containing the prompt and which content was used
 */
const buildPrompt = async (guildId, guildName, query) => {
    try {
        const usedContent = {
            rules: false,
            faqs: false,
            levelRoles: false
        };

        let rulesContent = '';
        try {
            rulesContent = await readGuildFile(guildId, 'rules');
            if (rulesContent) usedContent.rules = true;
        } catch (error) {
            logger.debug(`No rules.txt file found for guild ${guildId}: ${error.message}`);
        }

        let faqsContent = '';
        try {
            faqsContent = await readGuildFile(guildId, 'faqs');
            if (faqsContent) usedContent.faqs = true;
        } catch (error) {
            logger.debug(`No faqs.txt file found for guild ${guildId}: ${error.message}`);
        }

        let levelRolesContent = '';
        try {
            levelRolesContent = await readGuildFile(guildId, 'level_roles');
            if (levelRolesContent) usedContent.levelRoles = true;
        } catch (error) {
            logger.debug(`No level_roles.txt file found for guild ${guildId}: ${error.message}`);
        }

        const prompt = `You are a helpful Discord support assistant for the server: "${guildName}".

        SERVER RULES:
        ${rulesContent || "No rules have been uploaded for this server yet."}

        LEVEL ROLES:
        ${levelRolesContent || "No level roles information has been uploaded for this server yet."}

        FAQS:
        ${faqsContent || "No FAQs have been uploaded for this server yet."}

        User's Query:
        "${query}"

        Task:
        1. If the query can be answered using the server's information above, please provide a helpful, accurate response based on that information.
        2. If it's a general report (e.g. harassment, rule violation, technical issue, etc.), ask follow-up questions about what happened, who was involved, and when - then clearly indicate this needs staff attention.
        3. If you don't have enough information in the provided server data, politely say so and suggest the user contact a staff member directly.
        4. Format your response in a clean, readable way using Markdown.
        5. Keep your response concise but comprehensive.
        6. If you detect that this is a support ticket that requires escalation to staff, include the phrase "This requires staff attention" somewhere in your response.
        7. Please avoid mentioning the server rules when answering users quert
        

        Remember, your goal is to help resolve the user's issue efficiently while following the server's specific rules and guidelines.`;

        return { prompt, usedContent };
    } catch (error) {
        logger.error(`Error building Gemini prompt: ${error.message}`);
        throw error;
    }
};

module.exports = { buildPrompt };