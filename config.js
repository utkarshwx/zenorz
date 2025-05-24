const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const TicketSchema = require('../models/Ticket');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows ticket statistics')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  
  async execute(interaction) {
    await interaction.deferReply();
    
    try {
      // Get ticket statistics from the database
      const totalTickets = await TicketSchema.countDocuments();
      const openTickets = await TicketSchema.countDocuments({ status: 'OPEN' });
      const closedTickets = await TicketSchema.countDocuments({ status: 'CLOSED' });
      const staffPendingTickets = await TicketSchema.countDocuments({ status: 'STAFF_PENDING' });
      const awaitingInfoTickets = await TicketSchema.countDocuments({ status: 'AWAITING_INFO' });
      
      // Calculate the percentage of tickets resolved by AI
      const aiResolvedCount = await TicketSchema.countDocuments({
        status: 'CLOSED',
        messages: { $size: 3 } // Assuming AI resolved if there are only 3 messages (user query, AI response, and close)
      });
      
      const aiResolvedPercentage = totalTickets > 0 ? Math.round((aiResolvedCount / totalTickets) * 100) : 0;
      
      // Create and send the stats embed
      const statsEmbed = new EmbedBuilder()
        .setTitle('📊 Ticket Statistics')
        .setColor(0x2ecc71)
        .addFields(
          { name: 'Total Tickets', value: totalTickets.toString(), inline: true },
          { name: 'Open Tickets', value: openTickets.toString(), inline: true },
          { name: 'Closed Tickets', value: closedTickets.toString(), inline: true },
          { name: 'Staff Pending', value: staffPendingTickets.toString(), inline: true },
          { name: 'Awaiting Info', value: awaitingInfoTickets.toString(), inline: true },
          { name: 'AI Resolution Rate', value: `${aiResolvedPercentage}%`, inline: true }
        )
        .setFooter({ text: 'Last updated' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [statsEmbed] });
    } catch (error) {
      console.error('Error fetching ticket statistics:', error);
      await interaction.editReply('An error occurred while fetching ticket statistics.');
    }
  }
};