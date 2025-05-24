const mongoose = require('mongoose');
const logger = require('./logger');

/**
    * Connect to MongoDB database
    * @returns {Promise} Mongoose connection
*/

const connectDatabase = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;

        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI environment variable is not defined');
        }

        await mongoose.connect(MONGODB_URI);

        logger.info('Successfully connected to MongoDB');

        mongoose.connection.on('error', (error) => {
            logger.error(`MongoDB connection error: ${error.message}`);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });

        return mongoose.connection;
    } catch (error) {
        logger.error(`Failed to connect to MongoDB: ${error.message}`);
        throw error;
    }
};

module.exports = { connectDatabase };