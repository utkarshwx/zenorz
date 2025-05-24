const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    guildName: { type: String },

    channels: {
        ticketChannel: { type: String, default: null },
        ticketRequests: { type: String, default: null },
        ticketLogs: { type: String, default: null },
        ticketCategory: { type: String, default: null},
    },

    supportTeamRoles: [{ type: String }],
    ticketCategory: { type: String },
    useButton: { type: Boolean, default: true },

    autoCloseAfterDays: { type: Number, default: 7 },
    preventDuplicateTickets: { type: Boolean, default: true },

    premium: {
        isActive: { type: Boolean, default: false },
        tier: { type: String, enum: ['free', 'basic', 'pro', 'elite'], default: 'free' },
        features: {
            multipleSupportChannels: { type: Boolean, default: false },
            aiResponses: { type: Boolean, default: false },
        }
    },

    setupCompleted: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Guild', guildSchema);