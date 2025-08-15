const mongoose = require('mongoose');

const Server = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    guildName: {
        type: String,
        required: true
    },
    ownerId: {
        type: String,
        required: true
    },
    prefix: {
        type: String,
        default: 'z'
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    settings: {
        welcomeChannelId: String,
        logChannelId: String,
        language: {
            type: String,
            default: 'en'
        }
    },
    features: {
        moderation: {
            enabled: {
                type: Boolean,
                default: false
            }
        },
        music: {
            enabled: {
                type: Boolean,
                default: false
            }
        },
        welcome: { 
            enabled: {
                type: Boolean,
                default: false
            }
        }
    }
});

module.exports = mongoose.model('Server', Server);