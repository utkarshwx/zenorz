const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('./logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Send a prompt to Google Gemini and get a response
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Promise<string>} - The response from Gemini
 */

const sendToGemini = async (prompt) => {
    try {
        
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

        const generationConfig = {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 1024,
        };

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig,
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                },
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_MEDIUM_AND_ABOVE'
                }
            ],
        });

        const response = result.response;
        return response.text();
    } catch (error) {
        logger.error(`Error with Gemini API: ${error.message}`);
        return "I'm sorry, I couldn't process your request right now. Please try again later or contact a staff member for assistance.";
    }
};

/**
 * Determine if a query appears to be a report that should be escalated to staff
 * @param {string} response - The Gemini response
 * @returns {boolean} - Whether the response indicates escalation is needed
 */

const shouldEscalateToStaff = (response) => {
    const escalationIndicators = [
        'staff has been notified',
        'escalating to staff',
        'support team',
        'moderator',
        'administrator',
        'report',
        'harassment',
        'bullying',
        'inappropriate',
        'violation',
        'escalated',
        'require staff attention'
    ];

    const lowerResponse = response.toLowerCase();
    return escalationIndicators.some(indicator => lowerResponse.includes(indicator.toLowerCase()));
};

module.exports = {
    sendToGemini,
    shouldEscalateToStaff
};