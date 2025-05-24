const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  ticketId: {
    type: String,
    required: true
  },
  channelId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'escalated', 'pending'],
    default: 'open'
  },
  query: {
    type: String,
    required: true
  },
  response: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  escalatedToStaff: {
    type: Boolean,
    default: false
  },
  usedContent: {
    rules: { type: Boolean, default: false },
    faqs: { type: Boolean, default: false },
    levelRoles: { type: Boolean, default: false }
  }
});


TicketSchema.index({ guildId: 1, userId: 1, status: 1 });

module.exports = mongoose.model('Ticket', TicketSchema);